import type { PlacedPart } from "./types";
import { runArduinoSketch } from "./arduino-interpreter";

export type PinMode =
  | "INPUT"
  | "OUTPUT"
  | "INPUT_PULLUP";

export interface McuRuntimeState {
  powered: boolean;
  running: boolean;
  error?: string;

  digital: Record<string, 0 | 1>;
  modes: Record<string, PinMode>;

  lcdPins?: {
    rs: string;
    e: string;
    d4: string;
    d5: string;
    d6: string;
    d7: string;
  };

  /** Soft text buffer for SSD1306-style OLED sketches. */
  oledLines?: string[];
  oledActive?: boolean;

  /**
   * Direct text buffer from lcd.print / lcd.println.
   * Used when the electrical HD44780 path has no net connectivity.
   * Length follows lcdSoftRows; each line is lcdSoftCols characters.
   */
  lcdSoftLines?: string[];
  /** Soft buffer width from lcd.begin(cols, rows). Default 16. */
  lcdSoftCols?: number;
  /** Soft buffer height from lcd.begin(cols, rows). Default 2. */
  lcdSoftRows?: number;
}

export interface McuPinEvent {
  pin: string;
  value: 0 | 1;
}

export interface McuProgramResult {
  state: McuRuntimeState;
  pinEvents: McuPinEvent[];
}

/**
 * Inputs sampled from the simulated electrical circuit before the sketch runs.
 * Values are already reduced to Arduino digital logic levels (LOW/HIGH).
 */
export interface McuRuntimeInputs {
  digital?: Record<string, 0 | 1>;
  analog?: Record<string, number>;
  reset?: boolean;
}

/**
 * Runtime controls used by the simulator tick. `deltaMs` is virtual MCU time,
 * not wall-clock time, so pausing the canvas does not make the sketch jump.
 */
export interface McuRuntimeOptions {
  inputs?: McuRuntimeInputs;
  deltaMs?: number;
  reset?: boolean;
}

/** Simple sketch variables that survive across simulation ticks. */
export type McuGlobalValue = number | boolean | string;

export interface PersistentMcuRuntime {
  state: McuRuntimeState;
  setupComplete: boolean;
  timeMs: number;
  /** User-declared variables (int / bool / unsigned long / …). */
  globals: Record<string, McuGlobalValue>;
  /** Fingerprint of the last sketch text so edits force a full reset. */
  codeHash: string;
  /**
   * Debounced digital levels presented to digitalRead().
   * Raw electrical samples must stay stable for DEBOUNCE_MS before they land here.
   */
  stableDigital: Record<string, 0 | 1>;
  /** Last raw sample per pin (pre-debounce). */
  rawDigital: Record<string, 0 | 1>;
  /** Virtual time when the raw level last changed. */
  rawChangedAtMs: Record<string, number>;
  /** Previous stable level — used for rising/falling edge helpers. */
  prevStableDigital: Record<string, 0 | 1>;
  /** Approximate OUTPUT pin source/sink current (mA), educational budget. */
  gpioCurrentMa: Record<string, number>;
  /** Soft PWM duty 0–255 for analogWrite pins. */
  pwmDuty: Record<string, number>;
}

/** Mechanical / contact debounce window (virtual MCU ms). */
export const MCU_INPUT_DEBOUNCE_MS = 40;

/** Arduino Uno absolute max per GPIO (educational limit, not datasheet hard clamp). */
export const MCU_GPIO_PIN_MAX_MA = 20;
/** Total GPIO budget for ATmega328P-class parts. */
export const MCU_GPIO_TOTAL_MAX_MA = 200;

const runtimeCache = new Map<string, PersistentMcuRuntime>();

/** Reset one MCU, or all MCUs when no id is supplied. */
export function resetMcuRuntime(id?: string): void {
  if (id) {
    runtimeCache.delete(id);
    return;
  }
  runtimeCache.clear();
}

/** Remove cached runtimes for MCUs that no longer exist on the board. */
export function pruneMcuRuntimes(ids: Iterable<string>): void {
  const keep = new Set(ids);
  for (const id of runtimeCache.keys()) {
    if (!keep.has(id)) runtimeCache.delete(id);
  }
}

function hashCode(source: string): string {
  // Fast non-crypto fingerprint — enough to detect sketch edits.
  let h = 2166136261;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function createPersistentRuntime(codeHash: string): PersistentMcuRuntime {
  return {
    state: createInitialState(),
    setupComplete: false,
    timeMs: 0,
    globals: {},
    codeHash,
    stableDigital: {},
    rawDigital: {},
    rawChangedAtMs: {},
    prevStableDigital: {},
    gpioCurrentMa: {},
    pwmDuty: {},
  };
}

function clearInputHistory(runtime: PersistentMcuRuntime): void {
  runtime.stableDigital = {};
  runtime.rawDigital = {};
  runtime.rawChangedAtMs = {};
  runtime.prevStableDigital = {};
  runtime.gpioCurrentMa = {};
  runtime.pwmDuty = {};
}

/**
 * Contact debounce: a new raw level must hold for MCU_INPUT_DEBOUNCE_MS
 * before it becomes the stable level that digitalRead() sees.
 * Also snapshots previous stable levels for edge detection.
 */
export function debounceDigitalInputs(
  runtime: PersistentMcuRuntime,
  raw: Record<string, 0 | 1>,
  nowMs: number,
  debounceMs: number = MCU_INPUT_DEBOUNCE_MS,
): Record<string, 0 | 1> {
  // Snapshot previous stable before we mutate.
  runtime.prevStableDigital = { ...runtime.stableDigital };

  for (const [pin, level] of Object.entries(raw)) {
    const prevRaw = runtime.rawDigital[pin];
    if (prevRaw === undefined || prevRaw !== level) {
      runtime.rawDigital[pin] = level;
      runtime.rawChangedAtMs[pin] = nowMs;
    }
    const changedAt = runtime.rawChangedAtMs[pin] ?? nowMs;
    if (nowMs - changedAt >= debounceMs) {
      runtime.stableDigital[pin] = level;
    } else if (!(pin in runtime.stableDigital)) {
      // First sample: accept immediately so setup() sees a defined level.
      runtime.stableDigital[pin] = level;
    }
  }

  return { ...runtime.stableDigital };
}

/** Rising edge on a debounced input since the previous tick. */
export function digitalRisingEdge(
  runtime: PersistentMcuRuntime,
  pin: string,
): boolean {
  const prev = runtime.prevStableDigital[pin];
  const cur = runtime.stableDigital[pin];
  return prev === 0 && cur === 1;
}

/** Falling edge on a debounced input since the previous tick. */
export function digitalFallingEdge(
  runtime: PersistentMcuRuntime,
  pin: string,
): boolean {
  const prev = runtime.prevStableDigital[pin];
  const cur = runtime.stableDigital[pin];
  return prev === 1 && cur === 0;
}

/**
 * Educational GPIO current budget.
 * OUTPUT HIGH ≈ sourcing; OUTPUT LOW ≈ sinking.
 * Uses soft PWM duty when present. Clamped to pin / package limits.
 */
export function estimateGpioCurrents(
  runtime: PersistentMcuRuntime,
): Record<string, number> {
  const out: Record<string, number> = {};
  let total = 0;
  for (const [pin, mode] of Object.entries(runtime.state.modes)) {
    if (mode !== "OUTPUT") {
      out[pin] = 0;
      continue;
    }
    const duty = runtime.pwmDuty[pin];
    const digital = runtime.state.digital[pin] ?? 0;
    // Typical LED-scale educational load ~10 mA when driven hard HIGH/LOW.
    const fullMa = 10;
    let ma = 0;
    if (duty !== undefined) {
      ma = (fullMa * Math.max(0, Math.min(255, duty))) / 255;
    } else if (digital === 1 || digital === 0) {
      // Both source and sink count toward the package budget.
      ma = fullMa;
    }
    ma = Math.min(MCU_GPIO_PIN_MAX_MA, ma);
    out[pin] = ma;
    total += ma;
  }
  if (total > MCU_GPIO_TOTAL_MAX_MA) {
    const scale = MCU_GPIO_TOTAL_MAX_MA / total;
    for (const pin of Object.keys(out)) out[pin] *= scale;
  }
  runtime.gpioCurrentMa = out;
  return out;
}

/** Access persistent runtime (for simulate.ts debounce / edges). */
export function getPersistentMcuRuntime(
  id: string,
): PersistentMcuRuntime | undefined {
  return runtimeCache.get(id);
}

const DIGITAL_PINS = Array.from(
  { length: 14 },
  (_, i) => `d${i}`,
);

// ------------------------------------------------------------
// CODE NORMALIZATION
// ------------------------------------------------------------

function normalizeCode(code: string): string {
  return code
    // Remove /* ... */ comments
    .replace(/\/\*[\s\S]*?\*\//g, "")
    // Remove // comments
    .replace(/\/\/.*$/gm, "")
    .replace(/\r/g, "");
}

// ------------------------------------------------------------
// VALUE HELPERS
// ------------------------------------------------------------

function numberValue(value: string): number {
  const n = Number(value.trim());

  return Number.isFinite(n) ? n : 0;
}

function pinName(value: string): string {
  const v = value.trim();

  // Arduino style:
  // 13 -> d13
  if (/^\d+$/.test(v)) {
    return `d${v}`;
  }

  // D13 -> d13
  if (/^D\d+$/i.test(v)) {
    return v.toLowerCase();
  }

  return v.toLowerCase();
}

function highLowValue(value: string): 0 | 1 {
  const v = value.trim().toUpperCase();

  return v === "HIGH" || v === "1"
    ? 1
    : 0;
}

// ------------------------------------------------------------
// INITIAL MCU STATE
// ------------------------------------------------------------

function createInitialState(): McuRuntimeState {
  const digital: Record<string, 0 | 1> = {};
  const modes: Record<string, PinMode> = {};

  for (const pin of DIGITAL_PINS) {
    digital[pin] = 0;
    modes[pin] = "INPUT";
  }

  return {
    powered: false,
    running: false,
    digital,
    modes,
  };
}

// ------------------------------------------------------------
// LIQUIDCRYSTAL CONSTRUCTOR
// ------------------------------------------------------------
//
// Supports:
//
// LiquidCrystal lcd(rs, enable, d4, d5, d6, d7);
//
// Example:
//
// LiquidCrystal lcd(12, 11, 5, 4, 3, 2);
//
// becomes:
//
// rs = d12
// e  = d11
// d4 = d5
// d5 = d4
// d6 = d3
// d7 = d2
//
// ------------------------------------------------------------

function parseLiquidCrystal(
  source: string,
): McuRuntimeState["lcdPins"] | undefined {
  const regex =
    /LiquidCrystal\s+\w+\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/i;

  const match = source.match(regex);

  if (!match) {
    return undefined;
  }

  return {
    rs: pinName(match[1]),
    e: pinName(match[2]),
    d4: pinName(match[3]),
    d5: pinName(match[4]),
    d6: pinName(match[5]),
    d7: pinName(match[6]),
  };
}

// ------------------------------------------------------------
// EXECUTE MCU PROGRAM
// ------------------------------------------------------------
//
// This is intentionally a SAFE Arduino subset interpreter.
//
// It does NOT eval arbitrary JavaScript.
//
// Supported currently:
//
// pinMode()
// digitalWrite()
// LiquidCrystal lcd()
// lcd.begin()
// lcd.clear()
// lcd.home()
// lcd.setCursor()
// lcd.print()
// lcd.write()
// lcd.display()
// lcd.noDisplay()
// lcd.cursor()
// lcd.noCursor()
// lcd.blink()
// lcd.noBlink()
// delay()
//
// LCD functions generate real GPIO transitions which are later
// consumed by the HD44780 emulator.
// ------------------------------------------------------------

function legacyExecuteMcuProgram(
  part: PlacedPart,
  code: string,
  powered: boolean,
  options: McuRuntimeOptions = {},
): McuProgramResult {
  const deltaMs = Math.max(0, Math.min(1000, options.deltaMs ?? 0));
  const shouldReset = Boolean(options.reset || options.inputs?.reset);
  const source = normalizeCode(code || "");
  const codeHash = hashCode(source);

  if (shouldReset) {
    runtimeCache.delete(part.id);
  }

  let runtime = runtimeCache.get(part.id);
  if (!runtime || runtime.codeHash !== codeHash) {
    // Fresh MCU or sketch text changed → full reset (like uploading new code).
    runtime = createPersistentRuntime(codeHash);
    runtimeCache.set(part.id, runtime);
  }

  const state = runtime.state;
  const previousPowered = state.powered;
  state.powered = powered;
  const pinEvents: McuPinEvent[] = [];

  // Power removal is a real MCU reset condition for this simulator.
  if (!powered) {
    runtime.setupComplete = false;
    runtime.timeMs = 0;
    runtime.globals = {};
    state.running = false;
    for (const pin of DIGITAL_PINS) state.digital[pin] = 0;
    return { state, pinEvents };
  }

  // A fresh power-up starts the Arduino sketch from setup().
  if (!previousPowered) {
    runtime.setupComplete = false;
    runtime.timeMs = 0;
    runtime.globals = {};
  } else {
    runtime.timeMs += deltaMs;
  }

  // ----------------------------------------------------------
  // EMPTY PROGRAM
  // ----------------------------------------------------------

  if (!source.trim()) {
    return {
      state,
      pinEvents,
    };
  }

  // Inputs are sampled at the beginning of a simulator tick. OUTPUT pins are
  // intentionally ignored here because their value is driven by the MCU.
  const inputDigital = options.inputs?.digital ?? {};
  for (const [pin, value] of Object.entries(inputDigital)) {
    if ((state.modes[pin] ?? "INPUT") !== "OUTPUT") {
      state.digital[pin] = value;
    }
  }

  state.running = true;

  try {
    // ========================================================
    // LiquidCrystal
    // ========================================================

    state.lcdPins =
      parseLiquidCrystal(source);

    // ========================================================
    // pinMode()
    // ========================================================

    const pinModeRegex =
      /pinMode\s*\(\s*([^,]+)\s*,\s*(OUTPUT|INPUT_PULLUP|INPUT)\s*\)/gi;

    for (const match of source.matchAll(
      pinModeRegex,
    )) {
      const pin = pinName(match[1]);

      const mode =
        match[2].toUpperCase() as PinMode;

      state.modes[pin] = mode;

      if (!(pin in state.digital)) {
        state.digital[pin] =
          mode === "INPUT_PULLUP"
            ? 1
            : 0;
      }
    }

    // The AVR's internal pull-up is enabled whenever an input is configured
    // as INPUT_PULLUP and no external circuit is actively driving it. The
    // electrical solver supplies an explicit input level when a wire/button
    // is present, so this is only the fallback level.
    for (const [pin, mode] of Object.entries(state.modes)) {
      if (mode === "INPUT_PULLUP" && !(pin in inputDigital)) {
        state.digital[pin] = 1;
      }
    }

    // ========================================================
    // Simple declarations + assignments (persist in globals)
    // ========================================================
    //
    // Supported examples:
    //   int mode = 0;
    //   unsigned long counter = 0;
    //   bool ready = true;
    //   mode = digitalRead(7);
    //   counter = millis();
    //   counter++;
    //   mode += 1;
    //
    // This is intentionally a small safe subset — full statement
    // interpretation (if/switch/for) arrives in Phase 2.
    processGlobalsAndAssignments(source, runtime, state);

    // ========================================================
    // digitalWrite()
    // ========================================================

    const digitalWriteRegex =
      /digitalWrite\s*\(\s*([^,]+)\s*,\s*(HIGH|LOW|1|0)\s*\)/gi;

    for (const match of source.matchAll(
      digitalWriteRegex,
    )) {
      const pin = pinName(match[1]);

      const value =
        highLowValue(match[2]);

      state.digital[pin] = value;

      pinEvents.push({
        pin,
        value,
      });
    }

    // ========================================================
    // LIQUIDCRYSTAL COMMANDS
    // ========================================================

    if (state.lcdPins) {
      executeLiquidCrystalProgram(
        source,
        state,
        pinEvents,
        runtime,
      );
    }

    // ========================================================
    // SSD1306 / Adafruit_SSD1306 style OLED text
    // ========================================================
    executeOledProgram(source, state, runtime);

    // Mark this runtime as initialized. The current interpreter still executes
    // its safe command subset on every tick; the lifecycle flag is kept in the
    // persistent runtime so the upcoming statement interpreter can make setup()
    // strictly one-shot without changing the public simulation API.
    runtime.setupComplete = true;

    return {
      state,
      pinEvents,
    };
  } catch (error) {
    state.running = false;

    state.error =
      error instanceof Error
        ? error.message
        : "MCU program error";

    return {
      state,
      pinEvents,
    };
  }
}

// ------------------------------------------------------------
// LCD GPIO HELPERS
// ------------------------------------------------------------

function setPin(
  state: McuRuntimeState,
  events: McuPinEvent[],
  pin: string,
  value: 0 | 1,
): void {
  state.digital[pin] = value;

  events.push({
    pin,
    value,
  });
}

function pulseEnable(
  state: McuRuntimeState,
  events: McuPinEvent[],
  ePin: string,
): void {
  setPin(
    state,
    events,
    ePin,
    1,
  );

  setPin(
    state,
    events,
    ePin,
    0,
  );
}

// ------------------------------------------------------------
// WRITE ONE 4-BIT LCD NIBBLE
// ------------------------------------------------------------

function writeNibble(
  state: McuRuntimeState,
  events: McuPinEvent[],
  pins: NonNullable<McuRuntimeState["lcdPins"]>,
  nibble: number,
): void {
  setPin(
    state,
    events,
    pins.d4,
    ((nibble >> 0) & 1) as 0 | 1,
  );

  setPin(
    state,
    events,
    pins.d5,
    ((nibble >> 1) & 1) as 0 | 1,
  );

  setPin(
    state,
    events,
    pins.d6,
    ((nibble >> 2) & 1) as 0 | 1,
  );

  setPin(
    state,
    events,
    pins.d7,
    ((nibble >> 3) & 1) as 0 | 1,
  );

  pulseEnable(
    state,
    events,
    pins.e,
  );
}

// ------------------------------------------------------------
// WRITE ONE BYTE TO HD44780
// ------------------------------------------------------------

function writeLcdByte(
  state: McuRuntimeState,
  events: McuPinEvent[],
  pins: NonNullable<McuRuntimeState["lcdPins"]>,
  value: number,
  rs: 0 | 1,
): void {
  // RS
  setPin(
    state,
    events,
    pins.rs,
    rs,
  );

  // High nibble
  writeNibble(
    state,
    events,
    pins,
    (value >> 4) & 0x0f,
  );

  // Low nibble
  writeNibble(
    state,
    events,
    pins,
    value & 0x0f,
  );
}

// ------------------------------------------------------------
// LCD STRING
// ------------------------------------------------------------

function writeLcdText(
  state: McuRuntimeState,
  events: McuPinEvent[],
  pins: NonNullable<McuRuntimeState["lcdPins"]>,
  text: string,
): void {
  for (const char of text) {
    writeLcdByte(
      state,
      events,
      pins,
      char.charCodeAt(0),
      1,
    );
  }
}

// ------------------------------------------------------------
// EXECUTE LIQUIDCRYSTAL FUNCTIONS
// ------------------------------------------------------------

// ------------------------------------------------------------
// SIMPLE EXPRESSION + GLOBALS (Phase 1 micro-upgrade)
// ------------------------------------------------------------
//
// Evaluates a tiny safe subset used by assignments and lcd.print:
//   millis()
//   digitalRead(pin)
//   HIGH / LOW / true / false
//   number literals
//   known global variable names
//   var++ / var--  (postfix, returns previous value then updates)
//   simple binary: a + b, a - b, a % b  (left-to-right, no precedence)
//
// Full Arduino expression trees arrive with the Phase 2 interpreter.
// ------------------------------------------------------------

function evalSimpleExpression(
  raw: string,
  runtime: PersistentMcuRuntime,
  state: McuRuntimeState,
): McuGlobalValue {
  let expr = raw.trim();
  if (!expr) return 0;

  // Strip a single outer pair of parentheses.
  while (
    expr.startsWith("(") &&
    expr.endsWith(")") &&
    expr.indexOf(")", 1) === expr.length - 1
  ) {
    expr = expr.slice(1, -1).trim();
  }

  // Postfix ++ / --
  const postfix = expr.match(/^([A-Za-z_]\w*)\s*(\+\+|--)$/);
  if (postfix) {
    const name = postfix[1];
    const cur = Number(runtime.globals[name] ?? 0);
    const next = postfix[2] === "++" ? cur + 1 : cur - 1;
    runtime.globals[name] = next;
    return cur;
  }

  // millis()
  if (/^millis\s*\(\s*\)$/i.test(expr)) {
    return runtime.timeMs;
  }

  // digitalRead(pin)
  const digRead = expr.match(/^digitalRead\s*\(\s*([^)]+)\s*\)$/i);
  if (digRead) {
    const pin = pinName(digRead[1]);
    return state.digital[pin] ?? 0;
  }

  // analogRead(pin) → rough 0–1023 from sampled volts (A0–A5)
  const anaRead = expr.match(/^analogRead\s*\(\s*([^)]+)\s*\)$/i);
  if (anaRead) {
    // Phase 1: analog values live on the options path; fall back to 0 here.
    // Full analog path is already sampled in simulate.ts for McuSimState.
    return 0;
  }

  // HIGH / LOW / true / false
  if (/^(HIGH|true)$/i.test(expr)) return 1;
  if (/^(LOW|false)$/i.test(expr)) return 0;

  // String literal
  const strLit = expr.match(/^"([^"]*)"$/);
  if (strLit) return strLit[1];

  // Number literal
  if (/^[+-]?\d+(\.\d+)?$/.test(expr)) {
    return numberValue(expr);
  }

  // Known global
  if (/^[A-Za-z_]\w*$/.test(expr) && expr in runtime.globals) {
    return runtime.globals[expr];
  }

  // Simple left-to-right binary: a + b, a - b, a * b, a / b, a % b
  const bin = expr.match(
    /^(.+?)\s*(\+|-|\*|\/|%)\s*(.+)$/,
  );
  if (bin) {
    const left = Number(evalSimpleExpression(bin[1], runtime, state));
    const right = Number(evalSimpleExpression(bin[3], runtime, state));
    switch (bin[2]) {
      case "+":
        return left + right;
      case "-":
        return left - right;
      case "*":
        return left * right;
      case "/":
        return right === 0 ? 0 : left / right;
      case "%":
        return right === 0 ? 0 : left % right;
    }
  }

  // Unknown identifier → 0 (Arduino-ish undefined behaviour as zero)
  return 0;
}

/**
 * Scan the sketch for simple declarations and assignments and update
 * the persistent globals map. Runs every tick so loop()-style updates
 * (counter++, mode = digitalRead(...)) keep working even before a full
 * statement interpreter exists.
 */
function processGlobalsAndAssignments(
  source: string,
  runtime: PersistentMcuRuntime,
  state: McuRuntimeState,
): void {
  // Declarations: int mode = 0;  unsigned long counter = 0;  bool flag = true;
  const declRegex =
    /\b(?:int|long|unsigned\s+long|byte|bool|boolean|float|double|char)\s+([A-Za-z_]\w*)\s*=\s*([^;]+);/gi;

  for (const match of source.matchAll(declRegex)) {
    const name = match[1];
    // Only seed on first encounter so values persist across ticks.
    if (!(name in runtime.globals)) {
      runtime.globals[name] = evalSimpleExpression(
        match[2],
        runtime,
        state,
      );
    }
  }

  // Bare declarations without initializer: int mode;
  const bareDeclRegex =
    /\b(?:int|long|unsigned\s+long|byte|bool|boolean|float|double|char)\s+([A-Za-z_]\w*)\s*;/gi;
  for (const match of source.matchAll(bareDeclRegex)) {
    const name = match[1];
    if (!(name in runtime.globals)) {
      runtime.globals[name] = 0;
    }
  }

  // Assignments and compound assigns: mode = ...;  counter += 1;  x++;
  // Process in source order so later statements see earlier updates.
  const stmtRegex =
    /(?:^|[;\n{])\s*(?:([A-Za-z_]\w*)\s*(\+\+|--)\s*;|([A-Za-z_]\w*)\s*([+\-*/%]?=)\s*([^;]+);)/g;

  for (const match of source.matchAll(stmtRegex)) {
    if (match[1] && match[2]) {
      // postfix ++ / --
      const name = match[1];
      const cur = Number(runtime.globals[name] ?? 0);
      runtime.globals[name] =
        match[2] === "++" ? cur + 1 : cur - 1;
      continue;
    }

    const name = match[3];
    const op = match[4];
    const rhsRaw = match[5];
    if (!name || !op || rhsRaw === undefined) continue;

    // Skip if this looks like a type declaration (already handled).
    // (The decl regex already seeded the variable.)

    const rhs = evalSimpleExpression(rhsRaw, runtime, state);
    const cur = Number(runtime.globals[name] ?? 0);
    const rhsNum = Number(rhs);

    switch (op) {
      case "=":
        runtime.globals[name] = rhs;
        break;
      case "+=":
        runtime.globals[name] = cur + rhsNum;
        break;
      case "-=":
        runtime.globals[name] = cur - rhsNum;
        break;
      case "*=":
        runtime.globals[name] = cur * rhsNum;
        break;
      case "/=":
        runtime.globals[name] = rhsNum === 0 ? 0 : cur / rhsNum;
        break;
      case "%=":
        runtime.globals[name] = rhsNum === 0 ? 0 : cur % rhsNum;
        break;
    }
  }
}

function valueToPrintString(value: McuGlobalValue): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") {
    // Arduino-style: integers print without decimals when whole.
    if (Number.isInteger(value)) return String(value);
    return String(value);
  }
  return String(value);
}

function executeLiquidCrystalProgram(
  source: string,
  state: McuRuntimeState,
  events: McuPinEvent[],
  runtime: PersistentMcuRuntime,
): void {
  const pins = state.lcdPins;

  if (!pins) {
    return;
  }

  const softCols = () =>
    Math.min(40, Math.max(8, state.lcdSoftCols ?? 16));
  const softRows = () =>
    Math.min(4, Math.max(1, state.lcdSoftRows ?? 2));

  const ensureSoftBuffer = () => {
    const c = softCols();
    const r = softRows();
    if (!state.lcdSoftLines || state.lcdSoftLines.length !== r) {
      state.lcdSoftLines = Array.from({ length: r }, () => " ".repeat(c));
    } else {
      state.lcdSoftLines = state.lcdSoftLines.map((line) => {
        if (line.length === c) return line;
        if (line.length < c) return line.padEnd(c, " ");
        return line.slice(0, c);
      });
    }
  };

  ensureSoftBuffer();
  let softRow = 0;
  let softCol = 0;

  const softWrite = (text: string, newline: boolean) => {
    ensureSoftBuffer();
    const c = softCols();
    const r = softRows();
    const lines = state.lcdSoftLines!;
    for (const ch of text) {
      if (ch === "\n") {
        softRow = Math.min(r - 1, softRow + 1);
        softCol = 0;
        continue;
      }
      // Wrap to next line when the current row is full (use the full width).
      if (softCol >= c) {
        softRow = Math.min(r - 1, softRow + 1);
        softCol = 0;
      }
      const line = lines[softRow] ?? " ".repeat(c);
      lines[softRow] =
        line.slice(0, softCol) + ch + line.slice(softCol + 1);
      softCol++;
    }
    if (newline) {
      softRow = Math.min(r - 1, softRow + 1);
      softCol = 0;
    }
  };

  // ========================================================
  // lcd.begin(columns, rows)
  // ========================================================

  const beginRegex =
    /\b\w+\.begin\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;

  for (const match of source.matchAll(
    beginRegex,
  )) {
    const columns = numberValue(match[1]);
    const rows = numberValue(match[2]);

    // Standard HD44780 initialization:
    //
    // The actual power-up sequence is more complicated,
    // but these commands put the simulated LCD into the
    // expected 4-bit, display-on state.

    writeNibble(
      state,
      events,
      pins,
      0x03,
    );

    writeNibble(
      state,
      events,
      pins,
      0x03,
    );

    writeNibble(
      state,
      events,
      pins,
      0x03,
    );

    writeNibble(
      state,
      events,
      pins,
      0x02,
    );

    const functionSet =
      rows > 1
        ? 0x28
        : 0x20;

    writeLcdByte(
      state,
      events,
      pins,
      functionSet,
      0,
    );

    // Display ON
    writeLcdByte(
      state,
      events,
      pins,
      0x0c,
      0,
    );

    // Clear
    writeLcdByte(
      state,
      events,
      pins,
      0x01,
      0,
    );

    // Entry mode: left to right
    writeLcdByte(
      state,
      events,
      pins,
      0x06,
      0,
    );

    // Apply sketch size to the soft text buffer (and 3D display).
    if (columns != null && columns > 0) {
      state.lcdSoftCols = Math.min(40, Math.max(8, Math.floor(columns)));
    }
    if (rows != null && rows > 0) {
      state.lcdSoftRows = Math.min(4, Math.max(1, Math.floor(rows)));
    }
    ensureSoftBuffer();
  }

  // ========================================================
  // lcd.clear()
  // ========================================================

  const clearRegex =
    /\b\w+\.clear\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    clearRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x01,
      0,
    );
    ensureSoftBuffer();
    const c = softCols();
    const r = softRows();
    state.lcdSoftLines = Array.from({ length: r }, () => " ".repeat(c));
    softRow = 0;
    softCol = 0;
  }

  // ========================================================
  // lcd.home()
  // ========================================================

  const homeRegex =
    /\b\w+\.home\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    homeRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x02,
      0,
    );
  }

  // ========================================================
  // lcd.setCursor(column, row)
  // ========================================================

  const cursorRegex =
    /\b\w+\.setCursor\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;

  for (const match of source.matchAll(
    cursorRegex,
  )) {
    const column =
      numberValue(match[1]);

    const row =
      numberValue(match[2]);

    // Standard 16x2 addresses:
    //
    // row 0 -> 0x00
    // row 1 -> 0x40
    //
    // For additional rows we use the common
    // HD44780 DDRAM layout.

    const rowOffset =
      row === 0
        ? 0x00
        : row === 1
          ? 0x40
          : row === 2
            ? 0x14
            : 0x54;

    const address =
      0x80 +
      rowOffset +
      column;

    writeLcdByte(
      state,
      events,
      pins,
      address,
      0,
    );
  }

  // ========================================================
  // lcd.print(...)  — string literals and simple expressions
  // ========================================================
  //
  // Supports:
  //   lcd.print("Hello");
  //   lcd.print(counter);
  //   lcd.print(millis());
  //   lcd.print(digitalRead(7));
  //   lcd.print(25 + (counter % 6));
  //
  // String literals are preferred when both match.

  const printAnyRegex =
    /\b\w+\.print\s*\(\s*([^;]+?)\s*\)\s*;/gi;

  for (const match of source.matchAll(printAnyRegex)) {
    const arg = match[1].trim();
    const strLit = arg.match(/^"([^"]*)"$/);
    const text = strLit
      ? strLit[1]
      : valueToPrintString(
          evalSimpleExpression(arg, runtime, state),
        );
    writeLcdText(state, events, pins, text);
    softWrite(text, false);
  }

  // ========================================================
  // lcd.println(...)
  // ========================================================

  const printlnAnyRegex =
    /\b\w+\.println\s*\(\s*([^;]*?)\s*\)\s*;/gi;

  for (const match of source.matchAll(printlnAnyRegex)) {
    const arg = match[1].trim();
    let text = "";
    if (arg) {
      const strLit = arg.match(/^"([^"]*)"$/);
      text = strLit
        ? strLit[1]
        : valueToPrintString(
            evalSimpleExpression(arg, runtime, state),
          );
    }
    writeLcdText(state, events, pins, text);
    softWrite(text, true);

    // Move cursor to next line (common 16x2 second-row address).
    writeLcdByte(state, events, pins, 0xc0, 0);
  }

  // ========================================================
  // lcd.write(number | expression)
  // ========================================================

  const writeAnyRegex =
    /\b\w+\.write\s*\(\s*([^)]+)\s*\)/gi;

  for (const match of source.matchAll(writeAnyRegex)) {
    const value =
      Number(
        evalSimpleExpression(match[1], runtime, state),
      ) & 0xff;

    writeLcdByte(state, events, pins, value, 1);
  }

  // ========================================================
  // lcd.display()
  // ========================================================

  const displayRegex =
    /\b\w+\.display\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    displayRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x0c,
      0,
    );
  }

  // ========================================================
  // lcd.noDisplay()
  // ========================================================

  const noDisplayRegex =
    /\b\w+\.noDisplay\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    noDisplayRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x08,
      0,
    );
  }

  // ========================================================
  // lcd.cursor()
  // ========================================================

  const cursorOnRegex =
    /\b\w+\.cursor\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    cursorOnRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x0e,
      0,
    );
  }

  // ========================================================
  // lcd.noCursor()
  // ========================================================

  const cursorOffRegex =
    /\b\w+\.noCursor\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    cursorOffRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x0c,
      0,
    );
  }

  // ========================================================
  // lcd.blink()
  // ========================================================

  const blinkRegex =
    /\b\w+\.blink\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    blinkRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x0d,
      0,
    );
  }

  // ========================================================
  // lcd.noBlink()
  // ========================================================

  const noBlinkRegex =
    /\b\w+\.noBlink\s*\(\s*\)/gi;

  for (const _match of source.matchAll(
    noBlinkRegex,
  )) {
    writeLcdByte(
      state,
      events,
      pins,
      0x0e,
      0,
    );
  }
}

// ------------------------------------------------------------
// OLED (SSD1306) TEXT BUFFER
// ------------------------------------------------------------
// Supports a safe subset of Adafruit_SSD1306 / U8g2-style calls:
//   display.clearDisplay() / clear()
//   display.setCursor(x, y)
//   display.print("...") / println("...")
//   display.println()
//   u8g2.drawStr(x, y, "...")
// Lines are 21 chars (approx 128px / 6px font) × 8 rows.
// ------------------------------------------------------------

function executeOledProgram(
  source: string,
  state: McuRuntimeState,
  runtime: PersistentMcuRuntime,
) {
  const hasOled =
    /Adafruit_SSD1306|SSD1306|U8G2_|u8g2\.|display\.(clearDisplay|setCursor|print|println|display)\s*\(/i.test(
      source,
    );
  if (!hasOled) return;

  const COLS = 21;
  const ROWS = 8;
  const lines = Array.from({ length: ROWS }, () => " ".repeat(COLS));
  let row = 0;
  let col = 0;
  let active = false;

  const writeText = (text: string, newline: boolean) => {
    active = true;
    for (const ch of text) {
      if (ch === "\n") {
        row = Math.min(ROWS - 1, row + 1);
        col = 0;
        continue;
      }
      if (row >= ROWS) break;
      const line = lines[row];
      if (col < COLS) {
        lines[row] =
          line.slice(0, col) + ch + line.slice(col + 1);
        col++;
      }
    }
    if (newline) {
      row = Math.min(ROWS - 1, row + 1);
      col = 0;
    }
  };

  // Process statements roughly in source order
  const statementRegex =
    /\b(?:display|u8g2|oled)\s*\.\s*(clearDisplay|clearBuffer|clear|setCursor|setFont|print|println|drawStr|display)\s*\(([^)]*)\)/gi;

  for (const match of source.matchAll(statementRegex)) {
    const method = match[1].toLowerCase();
    const args = match[2].trim();

    if (
      method === "cleardisplay" ||
      method === "clearbuffer" ||
      method === "clear"
    ) {
      for (let i = 0; i < ROWS; i++) lines[i] = " ".repeat(COLS);
      row = 0;
      col = 0;
      active = true;
      continue;
    }

    if (method === "setcursor") {
      const parts = args.split(",").map((s) => s.trim());
      const x = numberValue(parts[0] ?? "0");
      const y = numberValue(parts[1] ?? "0");
      // Adafruit uses pixel coords; map y/8 to row, x/6 to col
      col = Math.max(0, Math.min(COLS - 1, Math.floor(x / 6)));
      row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / 8)));
      continue;
    }

    if (method === "drawstr") {
      const m = args.match(
        /^\s*([^,]+)\s*,\s*([^,]+)\s*,\s*"([^"]*)"\s*$/,
      );
      if (m) {
        const x = numberValue(m[1]);
        const y = numberValue(m[2]);
        col = Math.max(0, Math.min(COLS - 1, Math.floor(x / 6)));
        row = Math.max(0, Math.min(ROWS - 1, Math.floor(y / 8)));
        writeText(m[3], false);
      }
      continue;
    }

    if (method === "print" || method === "println") {
      const str = args.match(/^\s*"([^"]*)"\s*$/);
      if (str) {
        writeText(str[1], method === "println");
      } else if (method === "println" && !args) {
        writeText("", true);
      } else if (args) {
        // Expression: millis(), counter, digitalRead(7), …
        const text = valueToPrintString(
          evalSimpleExpression(args, runtime, state),
        );
        writeText(text, method === "println");
      }
      continue;
    }

    if (method === "display") {
      active = true;
    }
  }

  state.oledActive = active;
  state.oledLines = lines.map((l) => l.trimEnd());
}


/** Read the current virtual Arduino clock for UI/debugging. */
export function getMcuRuntimeMillis(id: string): number {
  return runtimeCache.get(id)?.timeMs ?? 0;
}

/** Expose a read-only snapshot for the electrical simulator's input sampler. */
export function getMcuRuntimeState(id: string): McuRuntimeState | undefined {
  return runtimeCache.get(id)?.state;
}

/** Read-only view of persistent sketch variables (for UI / debug panels). */
export function getMcuRuntimeGlobals(
  id: string,
): Record<string, McuGlobalValue> {
  const g = runtimeCache.get(id)?.globals;
  return g ? { ...g } : {};
}

/** Whether setup() has completed at least once for this MCU instance. */
export function getMcuSetupComplete(id: string): boolean {
  return Boolean(runtimeCache.get(id)?.setupComplete);
}


export function executeMcuProgram(
  part: PlacedPart,
  code: string,
  powered: boolean,
  options: McuRuntimeOptions = {},
): McuProgramResult {
  const deltaMs = Math.max(0, Math.min(1000, options.deltaMs ?? 0));
  const source = normalizeCode(code || "");
  const codeHash = hashCode(source);
  const shouldReset = Boolean(options.reset || options.inputs?.reset);

  if (shouldReset) {
    runtimeCache.delete(part.id);
  }

  let runtime = runtimeCache.get(part.id);
  if (!runtime || runtime.codeHash !== codeHash) {
    runtime = createPersistentRuntime(codeHash);
    runtimeCache.set(part.id, runtime);
  }
  // Older cache entries from Phase 1 may miss new fields — backfill.
  if (!runtime.stableDigital) clearInputHistory(runtime);

  const state = runtime.state;
  const wasPowered = state.powered;
  state.powered = powered;
  const events: McuPinEvent[] = [];

  // Power removal clears persistent MCU state (real reset behaviour).
  if (!powered) {
    runtime.setupComplete = false;
    runtime.timeMs = 0;
    runtime.globals = {};
    clearInputHistory(runtime);
    state.running = false;
    state.error = undefined;
    for (const pin of DIGITAL_PINS) state.digital[pin] = 0;
    return { state, pinEvents: events };
  }

  // Rising power edge → cold start (setup will run again).
  if (!wasPowered) {
    runtime.setupComplete = false;
    runtime.timeMs = 0;
    runtime.globals = {};
    clearInputHistory(runtime);
  } else {
    runtime.timeMs += deltaMs;
  }

  if (!source.trim()) {
    return { state, pinEvents: events };
  }

  // Debounce raw electrical samples before the sketch sees them.
  const rawDigital = options.inputs?.digital ?? {};
  const stable = debounceDigitalInputs(runtime, rawDigital, runtime.timeMs);
  const inputsForSketch: McuRuntimeInputs = {
    ...options.inputs,
    digital: stable,
  };

  try {
    state.running = true;
    state.error = undefined;
    runArduinoSketch(source, state, runtime, inputsForSketch, events);
    estimateGpioCurrents(runtime);
    return { state, pinEvents: events };
  } catch (e) {
    state.running = false;
    state.error =
      e instanceof Error ? e.message : "MCU program error";
    return { state, pinEvents: events };
  }
}
