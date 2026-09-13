import { getAllHoles, holeStrip } from "./breadboard";
import type {
  HoleId,
  PlacedPart,
  RelayState,
  ThyristorState,
  TriacState,
  DiacState,
  MotorState,
  MotorModelId,
  CapacitorState,
  SimResult,
  Wire,
} from "./types";
import { MOTOR_MODELS, THYRISTOR_MODELS, TRIAC_MODELS } from "./types";
import type { ThyristorModelId, TriacModelId } from "./types";
import {
  executeMcuProgram,
  type McuRuntimeState,
} from "./mcu-runtime";
import {
  createHd44780,
  clockHd44780,
  lcdText,
  type Hd44780Pins,
  type Hd44780State,
} from "./hd44780";


const GMIN = 1e-9;
const LED_VF: Record<string, number> = {
  red: 1.8,
  green: 2.1,
  yellow: 2.0,
  blue: 2.9,
};
const DIODE_VF = 0.7;
const DIODE_RD = 8;
const DIODE_MAX_MA = 100;
const LED_RD = 18;
const LED_MAX_MA = 25;

// -----------------------------------------------------------------------------
// Realistic module-level electrical models
// -----------------------------------------------------------------------------
// These are intentionally conservative educational equivalents, not transistor
// level models. They let the DC solver account for the current a module draws
// while keeping the Arduino/LCD runtime separate from the visual model.
const ARDUINO_UNO_NOMINAL_V = 5.0;
const ARDUINO_UNO_ACTIVE_MA = 9.2;
const ARDUINO_UNO_MIN_V = 2.7;
const ARDUINO_UNO_16MHZ_MIN_V = 4.5;
const ARDUINO_UNO_MAX_V = 5.5;
const ARDUINO_UNO_EQ_RESISTANCE =
  ARDUINO_UNO_NOMINAL_V / (ARDUINO_UNO_ACTIVE_MA / 1000);

const LCD_HD44780_NOMINAL_V = 5.0;
const LCD_HD44780_MIN_V = 4.5;
const LCD_HD44780_MAX_V = 5.5;
const LCD_LOGIC_MAX_MA = 0.6;
const LCD_BACKLIGHT_TYPICAL_MA = 120;
const LCD_LOGIC_EQ_RESISTANCE =
  LCD_HD44780_NOMINAL_V / (LCD_LOGIC_MAX_MA / 1000);
const LCD_BACKLIGHT_EQ_RESISTANCE =
  LCD_HD44780_NOMINAL_V / (LCD_BACKLIGHT_TYPICAL_MA / 1000);

// Generic 0.96" SSD1306-style I2C OLED module.
// The simulator intentionally treats the module as a 3.3 V device so
// a bare/raw OLED can never be silently fed from the 5 V bench rail.
const OLED_NOMINAL_V = 3.3;
const OLED_MIN_V = 2.7;
const OLED_MAX_V = 3.6;
const OLED_TYPICAL_MA = 15;
const OLED_EQ_RESISTANCE =
  OLED_NOMINAL_V / (OLED_TYPICAL_MA / 1000);

// These are output-budget limits, not short-circuit thresholds. A display
// drawing 100–150 mA is a normal peripheral load and must not be classified
// as a short. The Arduino supplies the display through its VCC/3V3 pins.
const ARDUINO_5V_PERIPHERAL_LIMIT_MA = 500;
const ARDUINO_3V3_PERIPHERAL_LIMIT_MA = 50;

const PSU_SHORT_CURRENT_A = 2.0;

class UnionFind {
  parent = new Map<number, number>();
  find(x: number): number {
    if (!this.parent.has(x)) this.parent.set(x, x);
    const p = this.parent.get(x)!;
    if (p !== x) this.parent.set(x, this.find(p));
    return this.parent.get(x)!;
  }
  union(a: number, b: number) {
    const pa = this.find(a);
    const pb = this.find(b);
    if (pa !== pb) this.parent.set(pa, pb);
  }
}

/** Gaussian elimination for Ax = b. Returns null on singular system. */
function solveLinear(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  if (n === 0) return [];
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (Math.abs(M[pivot][col]) < 1e-12) continue;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    const div = M[col][col];
    for (let c = col; c <= n; c++) M[col][c] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col];
      if (f === 0) continue;
      for (let c = col; c <= n; c++) M[r][c] -= f * M[col][c];
    }
  }
  const x = Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (Math.abs(M[i][i]) < 1e-10) {
      if (Math.abs(M[i][n]) > 1e-6) return null;
      x[i] = 0;
    } else {
      x[i] = M[i][n];
    }
  }
  return x;
}

/**
 * DC nodal analysis for a network of two-terminal resistive elements
 * driven by a single ideal voltage source between positiveNode and
 * negativeNode (ground).
 */
function solve(opts: {
  nodes: number[];
  elements: Array<{
    a: number;
    b: number;
    resistance: number;
    id: string;
    forwardVoltage?: number;
  }>;
  positiveNode: number;
  negativeNode: number;
  voltage: number;
}): Record<number, number> {
  const { nodes, elements, positiveNode, negativeNode, voltage } = opts;

  // Piecewise-linear junction state for LEDs/diodes.
  // We first use a low-resistance probe to determine whether a forward
  // path exists, then solve the conducting junction as Vf + I*Rd.
  const conducting = new Map<string, boolean>();

  for (const el of elements) {
    if (el.forwardVoltage !== undefined) {
      conducting.set(el.id, false);
    }
  }

  function solveNetwork(
    probeOffJunctions = false,
  ): Record<number, number> {
    const unknowns = nodes.filter((n) => n !== negativeNode);
    const index = new Map<number, number>();
    unknowns.forEach((n, i) => index.set(n, i));

    const n = unknowns.length;
    if (n === 0) {
      const result: Record<number, number> = {};
      for (const node of nodes) result[node] = 0;
      return result;
    }

    const G: number[][] = Array.from(
      { length: n },
      () => Array(n).fill(0),
    );
    const I: number[] = Array(n).fill(0);

    for (let i = 0; i < n; i++) {
      G[i][i] += GMIN;
    }

    for (const el of elements) {
      const isJunction = el.forwardVoltage !== undefined;
      const isOn = !isJunction || conducting.get(el.id) === true;

      let resistance: number;
      if (isJunction && !isOn) {
        // Probe an OFF junction as a tiny resistance. This is only used
        // to discover whether the surrounding circuit can drive it.
        resistance = probeOffJunctions ? 0.01 : 1e12;
      } else {
        resistance = Math.max(el.resistance, 1e-9);
      }

      const g = 1 / resistance;
      const ia = index.get(el.a);
      const ib = index.get(el.b);

      if (ia !== undefined && ib !== undefined) {
        G[ia][ia] += g;
        G[ib][ib] += g;
        G[ia][ib] -= g;
        G[ib][ia] -= g;
      } else if (ia !== undefined) {
        G[ia][ia] += g;
      } else if (ib !== undefined) {
        G[ib][ib] += g;
      }

      // ON junction model:
      //   I = (Va - Vb - Vf) / Rd
      if (isJunction && isOn) {
        const source =
          (el.forwardVoltage ?? 0) / resistance;

        if (ia !== undefined) I[ia] += source;
        if (ib !== undefined) I[ib] -= source;
      }
    }

    // Approximate an ideal voltage source with a very large conductance.
    const ip = index.get(positiveNode);
    if (ip !== undefined) {
      const Gfix = 1e9;
      G[ip][ip] += Gfix;
      I[ip] += Gfix * voltage;
    }

    const x = solveLinear(G, I);
    const result: Record<number, number> = {};
    result[negativeNode] = 0;

    if (x) {
      unknowns.forEach((node, i) => {
        result[node] = x[i];
      });
    } else {
      for (const node of unknowns) result[node] = 0;
    }

    return result;
  }

  // IMPORTANT: determine forward bias from the OPEN-circuit voltage across
  // the LED/diode. The old implementation temporarily replaced an OFF LED
  // with 0.01 ohm, which effectively shorted the LED during the probe. That
  // collapsed its voltage to almost 0 V, so a perfectly valid series LED
  // could never become forward biased.
  //
  // Start with all junctions open, inspect their voltage, then close only
  // the junctions that are actually forward biased and solve again.
  let solved = solveNetwork(false);

  for (let pass = 0; pass < 16; pass++) {
    let changed = false;

    for (const el of elements) {
      if (el.forwardVoltage === undefined) continue;

      const wasOn = conducting.get(el.id) === true;
      const va = solved[el.a] ?? 0;
      const vb = solved[el.b] ?? 0;
      const junctionVoltage = va - vb;
      const vf = el.forwardVoltage;

      // Turn on once the actual terminal voltage reaches the forward
      // threshold. Once conducting, keep it on until the voltage falls
      // clearly below Vf. This hysteresis prevents rapid ON/OFF chatter.
      const shouldBeOn = wasOn
        ? junctionVoltage >= vf - 0.05
        : junctionVoltage >= vf;

      if (shouldBeOn !== wasOn) {
        conducting.set(el.id, shouldBeOn);
        changed = true;
      }
    }

    if (!changed) break;
    solved = solveNetwork(false);
  }

  return solved;
}

/**
 * Per-model SCR / TRIAC thresholds come from THYRISTOR_MODELS / TRIAC_MODELS
 * in types.ts (IGT, VGT, IH, IL). Fallbacks below are sensitive-gate class.
 *
 * Turn-on:  Vak forward + Vgk ≥ VGT + Ig ≥ IGT, then Iak ≥ IL to latch.
 * Hold:     stay on while Iak ≥ IH after the gate is released.
 * Turn-off: Iak drops below IH (or power removed).
 */
const SCR_HOLDING_A = 0.005; // fallback IH
const SCR_LATCHING_A = 0.010; // fallback IL
const TRIAC_HOLDING_A = 0.005;
const TRIAC_LATCHING_A = 0.015;

function scrParams(modelId: string | undefined) {
  const id = (modelId ?? "2n5060") as ThyristorModelId;
  return THYRISTOR_MODELS[id] ?? THYRISTOR_MODELS["2n5060"];
}

function triacParams(modelId: string | undefined) {
  const id = (modelId ?? "mac97a") as TriacModelId;
  return TRIAC_MODELS[id] ?? TRIAC_MODELS["mac97a"];
}

/** Estimate gate current available at a hole from network element currents. */
function estimateNodeCurrent(
  hole: string | undefined,
  indexOf: Map<string, number>,
  uf: { find: (i: number) => number },
  elements: Array<{ a: number; b: number; resistance: number; forwardVoltage?: number }>,
  solved: Record<number, number>,
): number {
  if (!hole) return 0;
  const idx = indexOf.get(hole);
  if (idx === undefined) return 0;
  const node = uf.find(idx);
  let sum = 0;
  for (const el of elements) {
    if (el.a !== node && el.b !== node) continue;
    const va = solved[el.a] ?? 0;
    const vb = solved[el.b] ?? 0;
    sum += Math.abs((va - vb - (el.forwardVoltage ?? 0)) / Math.max(el.resistance, 1e-9));
  }
  return sum / 2;
}

export function simulate(input: {
  parts: PlacedPart[];
  wires: Wire[];
  powerOn: boolean;
  psuVoltage: number;
  psuPositive: HoleId | null;
  psuNegative: HoleId | null;
  /** Previously latched SCR/TRIAC part ids (from last sim frame). */
  prevLatched?: Record<string, boolean>;
  /** Previous motor armature currents for inductive dynamics (A). */
  prevMotorCurrents?: Record<string, number>;
}): SimResult {
  // ============================================================
  // EMPTY / SAFE RESULT
  // ============================================================

  const empty: SimResult = {
    voltages: {},
    currents: {},
    nodeCurrents: {},
    leds: {},
    diodes: {},
    switches: {},
    buttons: {},
    capacitors: {},
    inductors: {},
    buzzers: {},
    relays: {},

    // New MCU / LCD runtime state
    mcus: {},
    lcds: {},

    supplyCurrent: 0,
    warnings: [],

    // Backwards-compatible fields
    lcdPowered: false,
    lcdText: "",
    oledPowered: false,
    oledText: "",
    oledVoltage: 0,
    oledElectricalState: "off",
    burned: {},
    transistors: {},
    thyristors: {},
    triacs: {},
    diacs: {},
    motors: {},
    speakers: {},
    mcuPowered: false,
    shortCircuit: false,
  };

  if (!input.powerOn) {
    return empty;
  }

  // ============================================================
  // BUILD ELECTRICAL NETS
  // ============================================================

  const uf = new UnionFind();

  const indexOf = new Map<HoleId, number>();

  getAllHoles().forEach((hole, index) => {
    indexOf.set(hole, index);
  });

  function union(a: HoleId | undefined, b: HoleId | undefined) {
    if (!a || !b) return;

    const ia = indexOf.get(a);
    const ib = indexOf.get(b);

    if (ia === undefined || ib === undefined) return;

    uf.union(ia, ib);
  }

  // ============================================================
  // BREADBOARD INTERNAL CONNECTIONS
  // ============================================================
  // Group holes that share a strip (rails and vertical columns),
  // then short them together. holeStrip is a function that maps a
  // hole id → strip id; it is not itself an iterable of strips.

  const strips = new Map<string, HoleId[]>();
  for (const hole of getAllHoles()) {
    const stripId = holeStrip(hole);
    let group = strips.get(stripId);
    if (!group) {
      group = [];
      strips.set(stripId, group);
    }
    group.push(hole);
  }

  for (const group of strips.values()) {
    for (let i = 1; i < group.length; i++) {
      union(group[0], group[i]);
    }
  }

  // ============================================================
  // WIRES
  // ============================================================
  // Display power is a downstream Arduino supply, not a direct PSU branch.
  // Keep those display-power wires visible in the UI, but do not merge them
  // into the bench PSU electrical net. The display models below receive their
  // voltage from the Arduino 5 V / 3.3 V outputs. This prevents a display
  // load from being mistaken for a PSU short.
  const displayPowerPins = new Set<HoleId>();
  const mcuPowerPins = new Set<HoleId>();
  for (const part of input.parts) {
    if (part.kind === "lcd") {
      for (const pin of [part.pins.vdd, part.pins.vss, part.pins.a, part.pins.k]) {
        if (pin) displayPowerPins.add(pin);
      }
    }
    if (part.kind === "oled") {
      for (const pin of [part.pins.vcc, part.pins.gnd]) {
        if (pin) displayPowerPins.add(pin);
      }
    }
    if (part.kind === "mcu") {
      for (const pin of [part.pins.vcc, part.pins.gnd, part.pins["3v3"]]) {
        if (pin) mcuPowerPins.add(pin);
      }
    }
  }

  const isPowerRail = (hole: HoleId) =>
    /^(tp|tn|bp|bn|otp|otn|itp|itn|ibp|ibn|obp|obn)\d+$/.test(hole);

  for (const wire of input.wires) {
    const displayPowerWire =
      displayPowerPins.has(wire.a) || displayPowerPins.has(wire.b);

    if (displayPowerWire) {
      const other = displayPowerPins.has(wire.a) ? wire.b : wire.a;
      // LCD/OLED power connections are represented by the Arduino's regulated
      // outputs. Do not let these visual wires become a direct PSU path.
      if (mcuPowerPins.has(other) || isPowerRail(other)) continue;
    }

    union(wire.a, wire.b);
  }

  // ============================================================
  // CLOSED SWITCHES / BUTTONS
  // ============================================================

  for (const part of input.parts) {
    if (part.kind === "switch" && part.props.closed) {
      union(part.pins.a, part.pins.b);
    }

    if (part.kind === "button" && part.props.closed) {
      union(part.pins.a, part.pins.b);
    }
  }

  // ============================================================
  // POWER SUPPLY
  // ============================================================

  const positiveNode =
    input.psuPositive
      ? uf.find(indexOf.get(input.psuPositive) ?? 0)
      : null;

  const negativeNode =
    input.psuNegative
      ? uf.find(indexOf.get(input.psuNegative) ?? 0)
      : null;

  // A Union-Find collapse of PSU+ and PSU- is a true hard short. The old
  // solver simply skipped the matrix in this case, which made current = 0
  // and prevented the thermal/smoke system from ever seeing the fault.
  const hardShort =
    input.powerOn &&
    positiveNode !== null &&
    negativeNode !== null &&
    positiveNode === negativeNode;

  // ============================================================
  // NODE LIST
  // ============================================================

  const nodes = new Set<number>();

  for (const hole of getAllHoles()) {
    const index = indexOf.get(hole);

    if (index === undefined) continue;

    nodes.add(uf.find(index));
  }

  const nodeList = Array.from(nodes);

  // ============================================================
  // NODE VOLTAGES
  // ============================================================

  const voltages: Record<string, number> = {};

  // Start everything at 0 V.
  for (const hole of getAllHoles()) {
    voltages[hole] = 0;
  }

  // ============================================================
  // BUILD DC ELEMENTS
  // ============================================================

  const elements: Array<{
    a: number;
    b: number;
    resistance: number;
    id: string;
    forwardVoltage?: number;
  }> = [];

  for (const part of input.parts) {
    // ----------------------------------------------------------
    // RESISTOR
    // ----------------------------------------------------------

    if (part.kind === "resistor") {
      const a = part.pins.a;
      const b = part.pins.b;

      if (!a || !b) continue;

      const ia = indexOf.get(a);
      const ib = indexOf.get(b);

      if (ia === undefined || ib === undefined) continue;

      elements.push({
        a: uf.find(ia),
        b: uf.find(ib),
        resistance: Math.max(
          0.001,
          part.props.resistance ?? 1000,
        ),
        id: part.id,
      });
    }

    // ----------------------------------------------------------
    // POTENTIOMETER
    // ----------------------------------------------------------

    if (part.kind === "pot") {
      const a = part.pins.a;
      const b = part.pins.b;
      const w = part.pins.w;

      if (!a || !b || !w) continue;

      const ia = indexOf.get(a);
      const ib = indexOf.get(b);
      const iw = indexOf.get(w);

      if (
        ia === undefined ||
        ib === undefined ||
        iw === undefined
      ) {
        continue;
      }

      const total =
        Math.max(
          1,
          part.props.resistance ?? 10000,
        );

      // Keep the existing simulator's simple potentiometer model.
      elements.push({
        a: uf.find(ia),
        b: uf.find(iw),
        resistance: total / 2,
        id: `${part.id}:aw`,
      });

      elements.push({
        a: uf.find(iw),
        b: uf.find(ib),
        resistance: total / 2,
        id: `${part.id}:wb`,
      });
    }

    // ----------------------------------------------------------
    // LED
    // ----------------------------------------------------------

    if (part.kind === "led") {
      const a = part.pins.a;
      const k = part.pins.k;

      if (!a || !k) continue;

      const ia = indexOf.get(a);
      const ik = indexOf.get(k);

      if (ia === undefined || ik === undefined) continue;

      elements.push({
        a: uf.find(ia),
        b: uf.find(ik),
        // Realistic educational LED model: Vf + I*Rd.
        resistance: LED_RD,
        forwardVoltage:
          LED_VF[part.props.ledColor ?? "red"] ?? LED_VF.red,
        id: part.id,
      });
    }

    // ----------------------------------------------------------
    // DIODE
    // ----------------------------------------------------------

    if (part.kind === "diode") {
      const a = part.pins.a;
      const k = part.pins.k;

      if (!a || !k) continue;

      const ia = indexOf.get(a);
      const ik = indexOf.get(k);

      if (ia === undefined || ik === undefined) continue;

      elements.push({
        a: uf.find(ia),
        b: uf.find(ik),
        resistance: 1000,
        id: part.id,
      });
    }

    // ----------------------------------------------------------
    // CAPACITOR
    // ----------------------------------------------------------

    if (part.kind === "capacitor") {
      const a = part.pins.a;
      const b = part.pins.b;

      if (!a || !b) continue;

      const ia = indexOf.get(a);
      const ib = indexOf.get(b);

      if (ia === undefined || ib === undefined) continue;

      // DC steady-state: capacitor behaves as open circuit.
      // Voltage is still reported later.
    }

    // ----------------------------------------------------------
    // INDUCTOR
    // ----------------------------------------------------------

    if (part.kind === "inductor") {
      const a = part.pins.a;
      const b = part.pins.b;

      if (!a || !b) continue;

      const ia = indexOf.get(a);
      const ib = indexOf.get(b);

      if (ia === undefined || ib === undefined) continue;

      // DC steady-state approximation.
      elements.push({
        a: uf.find(ia),
        b: uf.find(ib),
        resistance: 0.01,
        id: part.id,
      });
    }

    // ----------------------------------------------------------
    // BUZZER
    // ----------------------------------------------------------

    if (part.kind === "buzzer") {
      const a = part.pins.a;
      const b = part.pins.b;

      if (!a || !b) continue;

      const ia = indexOf.get(a);
      const ib = indexOf.get(b);

      if (ia === undefined || ib === undefined) continue;

      elements.push({
        a: uf.find(ia),
        b: uf.find(ib),
        resistance: 100,
        id: part.id,
      });
    }

    if (part.kind === "speaker") {
      const a = part.pins.a;
      const b = part.pins.b;
      if (!a || !b) continue;
      const ia = indexOf.get(a);
      const ib = indexOf.get(b);
      if (ia === undefined || ib === undefined) continue;
      elements.push({
        a: uf.find(ia),
        b: uf.find(ib),
        resistance: 32,
        id: part.id,
      });
    }

    // DC motor — resistance from rated-voltage model (3V…12V)
    if (part.kind === "motor") {
      const a = part.pins.a;
      const b = part.pins.b;
      if (!a || !b) continue;
      const ia = indexOf.get(a);
      const ib = indexOf.get(b);
      if (ia === undefined || ib === undefined) continue;
      const modelId = (part.props.motorModel ?? "5v") as MotorModelId;
      const model = MOTOR_MODELS[modelId] ?? MOTOR_MODELS["5v"];
      elements.push({
        a: uf.find(ia),
        b: uf.find(ib),
        resistance: model.resistance,
        id: part.id,
      });
    }

    if (part.kind === "transistor") {
      const e = part.pins.e;
      const c = part.pins.c;
      if (!e || !c) continue;
      const ie = indexOf.get(e);
      const ic = indexOf.get(c);
      if (ie === undefined || ic === undefined) continue;
      elements.push({
        a: uf.find(ie),
        b: uf.find(ic),
        resistance: 50000,
        id: part.id,
      });
    }

    // ----------------------------------------------------------
    // THYRISTOR / SCR
    // Already-latched devices start in the on-state so holding current
    // can keep the load (LED, motor, …) powered after the gate pulse.
    // ----------------------------------------------------------
    if (part.kind === "thyristor") {
      const a = part.pins.a;
      const k = part.pins.k;
      if (a && k) {
        const ia = indexOf.get(a);
        const ik = indexOf.get(k);
        if (ia !== undefined && ik !== undefined) {
          const latched = Boolean(input.prevLatched?.[part.id]);
          elements.push({
            a: uf.find(ia),
            b: uf.find(ik),
            resistance: latched ? 0.8 : 1e6,
            forwardVoltage: latched ? 0.9 : undefined,
            id: latched ? `${part.id}:ak-on` : `${part.id}:ak-off`,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // TRIAC (same latching model, bidirectional main terminals)
    // ----------------------------------------------------------
    if (part.kind === "triac") {
      const mt1 = part.pins.mt1;
      const mt2 = part.pins.mt2;
      if (mt1 && mt2) {
        const i1 = indexOf.get(mt1);
        const i2 = indexOf.get(mt2);
        if (i1 !== undefined && i2 !== undefined) {
          const latched = Boolean(input.prevLatched?.[part.id]);
          elements.push({
            a: uf.find(i1),
            b: uf.find(i2),
            resistance: latched ? 0.6 : 1e6,
            forwardVoltage: latched ? 0.8 : undefined,
            id: latched ? `${part.id}:mt-on` : `${part.id}:mt-off`,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // DIAC (high-R until breakover voltage; closes on 2nd pass)
    // ----------------------------------------------------------
    if (part.kind === "diac") {
      const a = part.pins.a;
      const b = part.pins.b;
      if (a && b) {
        const ia = indexOf.get(a);
        const ib = indexOf.get(b);
        if (ia !== undefined && ib !== undefined) {
          elements.push({
            a: uf.find(ia),
            b: uf.find(ib),
            resistance: 1e7,
            id: `${part.id}:off`,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // RELAY COIL (contact handled after first solve if energized)
    // ----------------------------------------------------------
    if (part.kind === "relay") {
      const coilA = part.pins.coilA;
      const coilB = part.pins.coilB;
      if (coilA && coilB) {
        const ia = indexOf.get(coilA);
        const ib = indexOf.get(coilB);
        if (ia !== undefined && ib !== undefined) {
          elements.push({
            a: uf.find(ia),
            b: uf.find(ib),
            // Typical small signal relay coil ~70–400 Ω; 200 Ω is a good educational default.
            resistance: 200,
            id: `${part.id}:coil`,
          });
        }
      }
    }

    // ----------------------------------------------------------
    // ARDUINO / MCU POWER LOAD
    // ----------------------------------------------------------
    // Model the MCU's own active consumption as a high-value equivalent
    // resistor. GPIO/peripheral loads remain separate circuit elements.
    if (part.kind === "mcu") {
      const vcc = part.pins.vcc;
      const gnd = part.pins.gnd;
      if (vcc && gnd) {
        const ivcc = indexOf.get(vcc);
        const ignd = indexOf.get(gnd);
        if (ivcc !== undefined && ignd !== undefined) {
          elements.push({
            a: uf.find(ivcc),
            b: uf.find(ignd),
            resistance: ARDUINO_UNO_EQ_RESISTANCE,
            id: `${part.id}:mcu-core`,
          });
        }
      }
    }

    // ==========================================================
    // IMPORTANT: LCD/OLED POWER IS NOT PART OF THE BENCH-PSU DC NETWORK.
    //
    // The Arduino model below supplies the displays through its own 5 V /
    // 3.3 V outputs. Their current is calculated as downstream peripheral
    // current and added to the reported PSU current at the end.
    // ==========================================================
  }

  // ============================================================
  // SOLVE NORMAL DC CIRCUIT
  // ============================================================

  let solved: Record<number, number> = {};

  if (
    positiveNode !== null &&
    negativeNode !== null &&
    positiveNode !== negativeNode
  ) {
    try {
      solved = solve({
        nodes: nodeList,
        elements,
        positiveNode,
        negativeNode,
        voltage: input.psuVoltage,
      });
    } catch {
      solved = {};
    }
  }

  // ============================================================
  // RELAY CONTACTS + THYRISTOR TRIGGER (second pass)
  // ============================================================
  // After the first solve we know coil / gate voltages. Energized relays
  // short COM–NO; triggered SCRs switch to a low on-state resistance.
  {
    let needsResolve = false;
    const elementsExtra: typeof elements = [];

    for (const part of input.parts) {
      if (part.kind === "relay") {
        const coilA = part.pins.coilA;
        const coilB = part.pins.coilB;
        if (!coilA || !coilB) continue;
        const ia = indexOf.get(coilA);
        const ib = indexOf.get(coilB);
        if (ia === undefined || ib === undefined) continue;
        const va = solved[uf.find(ia)] ?? 0;
        const vb = solved[uf.find(ib)] ?? 0;
        const coilV = Math.abs(va - vb);
        // Typical 5 V relay pick-up is ~3–4 V; use 2.5 V as a reliable threshold.
        if (input.powerOn && coilV >= 2.5) {
          const com = part.pins.com;
          const no = part.pins.no;
          if (com && no) {
            union(com, no);
            needsResolve = true;
          }
        }
      }

      if (part.kind === "thyristor") {
        // Already latched devices were modeled on in the first pass.
        if (input.prevLatched?.[part.id]) continue;
        const aPin = part.pins.a;
        const kPin = part.pins.k;
        const gPin = part.pins.g;
        if (!aPin || !kPin) continue;
        const ia = indexOf.get(aPin);
        const ik = indexOf.get(kPin);
        if (ia === undefined || ik === undefined) continue;
        const va = solved[uf.find(ia)] ?? 0;
        const vk = solved[uf.find(ik)] ?? 0;
        const vak = va - vk;
        let vgk = 0;
        if (gPin) {
          const igIdx = indexOf.get(gPin);
          if (igIdx !== undefined) {
            const vg = solved[uf.find(igIdx)] ?? 0;
            vgk = vg - vk;
          }
        }
        const p = scrParams(part.props.thyristorModel);
        // Gate current at the gate node (approx from connected network elements)
        const igate = estimateNodeCurrent(gPin, indexOf, uf, elements, solved);
        // Also accept a strong Vgk as implying enough drive through a series resistor:
        // Ig ≈ max(0, (Vgk − VGT) / 470 Ω) as a typical educational series-R estimate.
        const igFromV = Math.max(0, (vgk - p.vgt) / 470);
        const ig = Math.max(igate, igFromV);
        // Gate trigger: anode forward, Vgk ≥ VGT, and Ig ≥ IGT
        if (input.powerOn && vak > 0.5 && vgk >= p.vgt && ig >= p.igt) {
          elementsExtra.push({
            a: uf.find(ia),
            b: uf.find(ik),
            resistance: 0.8,
            forwardVoltage: 0.9,
            id: `${part.id}:ak-on`,
          });
          needsResolve = true;
        }
      }

      if (part.kind === "triac") {
        if (input.prevLatched?.[part.id]) continue;
        const mt1 = part.pins.mt1;
        const mt2 = part.pins.mt2;
        const gPin = part.pins.g;
        if (!mt1 || !mt2) continue;
        const i1 = indexOf.get(mt1);
        const i2 = indexOf.get(mt2);
        if (i1 === undefined || i2 === undefined) continue;
        const v1 = solved[uf.find(i1)] ?? 0;
        const v2 = solved[uf.find(i2)] ?? 0;
        const vmt = v2 - v1;
        let vg = 0;
        if (gPin) {
          const ig = indexOf.get(gPin);
          if (ig !== undefined) {
            const vgNode = solved[uf.find(ig)] ?? 0;
            vg = vgNode - v1;
          }
        }
        const tp = triacParams(part.props.triacModel);
        const igate = estimateNodeCurrent(gPin, indexOf, uf, elements, solved);
        const igFromV = Math.max(0, (Math.abs(vg) - tp.vgt) / 470);
        const ig = Math.max(igate, igFromV);
        if (input.powerOn && Math.abs(vmt) > 0.5 && Math.abs(vg) >= tp.vgt && ig >= tp.igt) {
          elementsExtra.push({
            a: uf.find(i1),
            b: uf.find(i2),
            resistance: 0.6,
            forwardVoltage: 0.8,
            id: `${part.id}:mt-on`,
          });
          needsResolve = true;
        }
      }

      if (part.kind === "diac") {
        const aPin = part.pins.a;
        const bPin = part.pins.b;
        if (!aPin || !bPin) continue;
        const ia = indexOf.get(aPin);
        const ib = indexOf.get(bPin);
        if (ia === undefined || ib === undefined) continue;
        const va = solved[uf.find(ia)] ?? 0;
        const vb = solved[uf.find(ib)] ?? 0;
        const v = Math.abs(va - vb);
        // Breakover ≈ 30–40 V depending on model
        const model = part.props.diacModel ?? "db3";
        const vbo = model === "db4" ? 40 : 32;
        if (input.powerOn && v >= vbo) {
          elementsExtra.push({
            a: uf.find(ia),
            b: uf.find(ib),
            resistance: 20,
            id: `${part.id}:on`,
          });
          needsResolve = true;
        }
      }
    }

    if (needsResolve && positiveNode !== null && negativeNode !== null) {
      const nodes2 = new Set<number>();
      for (const hole of getAllHoles()) {
        const index = indexOf.get(hole);
        if (index === undefined) continue;
        nodes2.add(uf.find(index));
      }
      const nodeList2 = Array.from(nodes2);
      const elements2 = [
        ...elements.map((el) => ({
          ...el,
          a: uf.find(el.a),
          b: uf.find(el.b),
        })),
        ...elementsExtra,
      ];
      // Keep on-state SCR elements in the main list so current accounting works.
      for (const el of elementsExtra) elements.push(el);

      const pos2 = uf.find(positiveNode);
      const neg2 = uf.find(negativeNode);
      if (pos2 !== neg2) {
        try {
          solved = solve({
            nodes: nodeList2,
            elements: elements2,
            positiveNode: pos2,
            negativeNode: neg2,
            voltage: input.psuVoltage,
          });
        } catch {
          // keep previous solution
        }
      }
    }
  }

  // ============================================================
  // COPY NODE VOLTAGES BACK TO HOLES
  // ============================================================

  for (const hole of getAllHoles()) {
    const index = indexOf.get(hole);

    if (index === undefined) continue;

    const node = uf.find(index);

    voltages[hole] = solved[node] ?? 0;
  }

  // Guarantee supply rails show the programmed voltage when the supply is
  // healthy. During a hard short the ideal source is considered current
  // limited and its output collapses toward 0 V.
  if (
    input.powerOn &&
    input.psuPositive &&
    input.psuNegative &&
    positiveNode !== null &&
    negativeNode !== null
  ) {
    for (const hole of getAllHoles()) {
      const index = indexOf.get(hole);
      if (index === undefined) continue;
      const node = uf.find(index);
      if (hardShort && node === positiveNode) {
        voltages[hole] = 0;
      } else {
        if (node === positiveNode) voltages[hole] = input.psuVoltage;
        if (node === negativeNode) voltages[hole] = 0;
      }
    }
  }

  function voltageAtRaw(
    table: Record<string, number>,
    part: PlacedPart,
    pin: string,
  ): number {
    const hole = part.pins[pin];
    return hole ? (table[hole] ?? 0) : 0;
  }

  // ============================================================
  // MCU 3.3 V REGULATOR RAIL
  // ============================================================
  // A real Arduino-style board can accept 5 V at its input/USB rail while
  // exposing a regulated 3.3 V output for peripherals. Model that output as
  // a protected internal rail. It is deliberately NOT the same node as the
  // 5 V PSU rail.
  for (const mcu of input.parts) {
    if (mcu.kind !== "mcu") continue;
    const railHole = mcu.pins["3v3"];
    if (!railHole) continue;

    const railIndex = indexOf.get(railHole);
    if (railIndex === undefined) continue;

    const railNode = uf.find(railIndex);
    const inputVoltage =
      voltageAtRaw(voltages, mcu, "vcc") -
      voltageAtRaw(voltages, mcu, "gnd");

    const regulatorShorted =
      negativeNode !== null && railNode === negativeNode;
    const regulatorTiedTo5V =
      positiveNode !== null && railNode === positiveNode;

    if (input.powerOn && !hardShort && !regulatorShorted && !regulatorTiedTo5V && inputVoltage >= 4.0) {
      for (const hole of getAllHoles()) {
        const index = indexOf.get(hole);
        if (index !== undefined && uf.find(index) === railNode) {
          voltages[hole] = OLED_NOMINAL_V;
        }
      }
    }
  }

  // ============================================================
  // HELPER: VOLTAGE AT PART PIN
  // ============================================================

  function voltageAt(
    part: PlacedPart,
    pin: string,
  ): number {
    const hole = part.pins[pin];

    if (!hole) return 0;

    return voltages[hole] ?? 0;
  }

  // ============================================================
  // NORMAL COMPONENT RESULTS
  // ============================================================

  const currents: Record<string, number> = {};
  const leds: SimResult["leds"] = {};

  const diodes: SimResult["diodes"] = {};

  const switches: Record<
    string,
    {
      closed: boolean;
    }
  > = {};

  const buttons: Record<string, { closed: boolean }> = {};

  const capacitors: Record<string, CapacitorState> = {};

  const inductors: Record<
    string,
    {
      current: number;
    }
  > = {};

  const buzzers: SimResult["buzzers"] = {};

  const transistors: Record<
    string,
    {
      id: string;
      conducting: boolean;
      vbe: number;
      ice: number;
    }
  > = {};

  const speakers: Record<
    string,
    {
      id: string;
      on: boolean;
      current: number;
      loudness: number;
    }
  > = {};

  const relays: Record<string, RelayState> = {};
  const thyristors: Record<string, ThyristorState> = {};
  const triacs: Record<string, TriacState> = {};
  const diacs: Record<string, DiacState> = {};
  const motors: Record<string, MotorState> = {};
  const warnings: string[] = [];
  let supplyCurrent = 0;

  // ============================================================
  // COMPONENT ANALYSIS
  // ============================================================

  for (const part of input.parts) {
    // ----------------------------------------------------------
    // RESISTOR
    // ----------------------------------------------------------

    if (part.kind === "resistor") {
      const va = voltageAt(part, "a");
      const vb = voltageAt(part, "b");

      const resistance = Math.max(
        0.001,
        part.props.resistance ?? 1000,
      );

      currents[part.id] =
        (va - vb) / resistance;
    }

    // ----------------------------------------------------------
    // POT
    // ----------------------------------------------------------

    if (part.kind === "pot") {
      const va = voltageAt(part, "a");
      const vw = voltageAt(part, "w");
      const vb = voltageAt(part, "b");

      const resistance = Math.max(
        1,
        part.props.resistance ?? 10000,
      );

      currents[`${part.id}:aw`] =
        (va - vw) / (resistance / 2);

      currents[`${part.id}:wb`] =
        (vw - vb) / (resistance / 2);
    }

    // ----------------------------------------------------------
    // LED
    // ----------------------------------------------------------

    if (part.kind === "led") {
      const va = voltageAt(part, "a");
      const vk = voltageAt(part, "k");
      const voltage = va - vk;
      const vf =
        LED_VF[part.props.ledColor ?? "red"] ?? LED_VF.red;

      // Current is based on the LED's forward-voltage model, not a
      // generic resistor. This is what makes a series resistor work.
      const iLed = voltage >= vf
        ? Math.max(0, (voltage - vf) / LED_RD)
        : 0;

      const on =
        input.powerOn &&
        iLed > 0.00001;

      // ~15 mA is treated as full brightness. Very small forward
      // currents still produce a faint visible glow.
      const brightness = on
        ? Math.min(1, Math.max(0.04, iLed / 0.015))
        : 0;

      const overcurrent =
        iLed > LED_MAX_MA / 1000;

      currents[part.id] = iLed;

      leds[part.id] = {
        id: part.id,
        on,
        current: iLed,
        brightness: overcurrent ? 1 : brightness,
        overcurrent,
      };
    }

    // ----------------------------------------------------------
    // DIODE
    // ----------------------------------------------------------

    if (part.kind === "diode") {
      const va = voltageAt(part, "a");
      const vk = voltageAt(part, "k");

      const voltage = va - vk;

      diodes[part.id] = {
        id: part.id,
        on: voltage > 0.55,
        forwardVoltage: voltage,
        current: Math.abs(currents[part.id] ?? 0),
      };
    }

    // ----------------------------------------------------------
    // SWITCH
    // ----------------------------------------------------------

    if (part.kind === "switch") {
      switches[part.id] = {
        closed: Boolean(part.props.closed),
      };
    }

    // ----------------------------------------------------------
    // BUTTON
    // ----------------------------------------------------------

    if (part.kind === "button") {
      buttons[part.id] = {
        closed: Boolean(part.props.closed),
      };
    }

    // ----------------------------------------------------------
    // CAPACITOR
    // ----------------------------------------------------------

    if (part.kind === "capacitor") {
      capacitors[part.id] = {
        id: part.id,
        voltage:
          voltageAt(part, "a") -
          voltageAt(part, "b"),
        charge: 0,
      };
    }

    // ----------------------------------------------------------
    // INDUCTOR
    // ----------------------------------------------------------

    if (part.kind === "inductor") {
      const va = voltageAt(part, "a");
      const vb = voltageAt(part, "b");

      inductors[part.id] = {
        current:
          (va - vb) / 0.01,
      };
    }

    // ----------------------------------------------------------
    // BUZZER
    // ----------------------------------------------------------

    if (part.kind === "buzzer") {
      const voltage =
        voltageAt(part, "a") -
        voltageAt(part, "b");

      let acrossSupply = false;
      if (
        input.powerOn &&
        positiveNode !== null &&
        negativeNode !== null
      ) {
        const ha = part.pins.a;
        const hb = part.pins.b;
        const ia = ha ? indexOf.get(ha) : undefined;
        const ib = hb ? indexOf.get(hb) : undefined;
        if (ia !== undefined && ib !== undefined) {
          const na = uf.find(ia);
          const nb = uf.find(ib);
          acrossSupply =
            (na === positiveNode && nb === negativeNode) ||
            (nb === positiveNode && na === negativeNode);
        }
      }

      const on =
        input.powerOn &&
        (Math.abs(voltage) >= 1.5 || acrossSupply);
      const loudness = on
        ? Math.min(1, Math.max(0.4, Math.abs(voltage) / 5 || 0.7))
        : 0;

      const iBz = Math.abs(voltage) / 100;
      const overcurrent = on && iBz > 0.05;
      buzzers[part.id] = {
        id: part.id,
        on,
        loudness: overcurrent ? 1 : loudness,
        current: iBz,
        overcurrent,
      };
    }

    // ----------------------------------------------------------
    // TRANSISTOR (simple switch model)
    // ----------------------------------------------------------
    if (part.kind === "transistor") {
      const e = part.pins.e;
      const b = part.pins.b;
      const c = part.pins.c;
      if (!e || !b || !c) continue;
      const ve = voltages[e] ?? 0;
      const vb = voltages[b] ?? 0;
      const vc = voltages[c] ?? 0;
      const model = part.props.transistorModel ?? "2n3904";
      const pnp = /3906|557|tip32|pnp/i.test(model);
      const vbe = pnp ? ve - vb : vb - ve;
      const conducting = input.powerOn && vbe > 0.65;
      const ice = conducting ? Math.abs(vc - ve) / 50 : 0;
      transistors[part.id] = {
        id: part.id,
        conducting,
        vbe,
        ice,
      };
    }

    // ----------------------------------------------------------
    // SPEAKER
    // ----------------------------------------------------------
    if (part.kind === "speaker") {
      const voltage =
        voltageAt(part, "a") - voltageAt(part, "b");
      const on = input.powerOn && Math.abs(voltage) >= 1.0;
      speakers[part.id] = {
        id: part.id,
        on,
        current: Math.abs(voltage) / 32,
        loudness: on ? Math.min(1, Math.abs(voltage) / 5) : 0,
      };
    }

    // ----------------------------------------------------------
    // DC MOTOR — current / speed from armature model
    //
    //   Istart = V / Ra                         (stall / startup)
    //   BackEMF ≈ n × Vrated × 0.95             (n = relative speed 0…1)
    //   Ia = (V − BackEMF) / Ra                 (armature current)
    //   Irun ≈ max(I_noload × n, Ia)            (running under light load)
    //   on when supply is up and Ia or V is enough to overcome friction
    //
    // Network element still uses Ra so series SCR/TRIAC see stall-class
    // current for latching / holding education.
    // ----------------------------------------------------------
    if (part.kind === "motor") {
      const modelId = (part.props.motorModel ?? "5v") as MotorModelId;
      const model = MOTOR_MODELS[modelId] ?? MOTOR_MODELS["5v"];
      const Ra = Math.max(model.resistance, 1e-3);
      const L = Math.max(model.inductance ?? 0.002, 1e-6);
      const tau = L / Ra; // electrical time constant (s)
      const Vrated = model.ratedVoltage;
      const voltage = voltageAt(part, "a") - voltageAt(part, "b");
      const V = Math.abs(voltage);

      // Network current through the motor element (if solved)
      const iNet = Math.abs(currents[part.id] ?? 0);

      // Stall / start current: Istart = V / Ra
      const Istart = V / Ra;

      // First-pass relative speed from applied voltage (no-load curve)
      let speed = input.powerOn && V >= Vrated * 0.08
        ? Math.min(1, V / Vrated)
        : 0;

      // Back EMF ≈ speed × Vrated × 0.95 (Ke·ω normalized)
      let backEmf = speed * Vrated * 0.95;

      // Steady-state armature current target: Ia_ss = (V − BackEMF) / Ra
      let Ia_ss = Math.max(0, (V - backEmf) / Ra);

      // First-order inductive dynamics toward steady state.
      // Δt ≈ one UI frame (~33 ms). τ = L/Ra is typically 0.1–0.3 ms for
      // hobby motors, so current reaches steady state within a few frames.
      const dt = 1 / 30;
      const prevI = Math.abs(input.prevMotorCurrents?.[part.id] ?? 0);
      const alpha = 1 - Math.exp(-dt / Math.max(tau, 1e-6));
      let Ia = prevI + (Ia_ss - prevI) * alpha;

      // Running current floor (no-load) scales with speed
      const Irun = Math.max(model.noLoadCurrent * speed, Ia);

      // Prefer solved network current when higher (series path with SCR drop)
      let current = Math.max(iNet, Irun);

      // Refine speed under load, then re-apply inductive step toward new target
      if (speed > 0 && Istart > 1e-6) {
        const loadFactor = Math.min(1, current / Istart);
        speed = Math.min(1, (V / Vrated) * (1 - 0.25 * loadFactor));
        speed = Math.max(0, speed);
        backEmf = speed * Vrated * 0.95;
        Ia_ss = Math.max(0, (V - backEmf) / Ra);
        Ia = prevI + (Ia_ss - prevI) * alpha;
        current = Math.max(iNet, Math.max(model.noLoadCurrent * speed, Ia));
      }

      const on =
        input.powerOn &&
        (V >= Vrated * 0.12 || current >= model.noLoadCurrent * 0.5 || current >= 0.015);

      const direction: -1 | 0 | 1 = !on ? 0 : voltage >= 0 ? 1 : -1;

      motors[part.id] = {
        id: part.id,
        on: on && speed > 0.02,
        voltage,
        current: on ? Math.max(current, Ia) : 0,
        stallCurrent: Istart,
        backEmf,
        inductance: L,
        timeConstant: tau,
        speed: on ? speed : 0,
        direction,
      };

      if (!currents[part.id] && on) {
        currents[part.id] = (on ? Math.max(current, Ia) : 0) * (direction || 1);
      }
    }

    // ----------------------------------------------------------
    // RELAY
    // ----------------------------------------------------------
    if (part.kind === "relay") {
      const coilA = part.pins.coilA;
      const coilB = part.pins.coilB;
      let coilVoltage = 0;
      if (coilA && coilB) {
        coilVoltage = Math.abs(
          (voltages[coilA] ?? 0) - (voltages[coilB] ?? 0),
        );
      }
      const on = input.powerOn && coilVoltage >= 2.5;
      relays[part.id] = {
        id: part.id,
        on,
        coilVoltage,
      };
      if (on) {
        currents[`${part.id}:coil`] = coilVoltage / 200;
      }
    }

    // ----------------------------------------------------------
    // THYRISTOR / SCR — per-model latching + holding current
    //
    // Gate: Vgk ≥ VGT and Ig ≥ IGT while anode is forward (Vak > 0.5 V)
    // Latch:  anode current Iak ≥ IL right after a valid gate pulse
    // Hold:   stay on while Iak ≥ IH after the gate is removed
    // Turn-off: Iak drops below IH (or power removed)
    // ----------------------------------------------------------
    if (part.kind === "thyristor") {
      const aPin = part.pins.a;
      const kPin = part.pins.k;
      const gPin = part.pins.g;
      const va = aPin ? (voltages[aPin] ?? 0) : 0;
      const vk = kPin ? (voltages[kPin] ?? 0) : 0;
      const vg = gPin ? (voltages[gPin] ?? 0) : 0;
      const vak = va - vk;
      const vgk = vg - vk;
      const p = scrParams(part.props.thyristorModel);
      const ih = p.ih;
      const il = p.il;
      const igate = estimateNodeCurrent(gPin, indexOf, uf, elements, solved);
      const igFromV = Math.max(0, (vgk - p.vgt) / 470);
      const ig = Math.max(igate, igFromV);
      const gateTriggered =
        vak > 0.5 && vgk >= p.vgt && ig >= p.igt;
      const wasLatched = Boolean(input.prevLatched?.[part.id]);
      const onElement = elements.some((el) => el.id === `${part.id}:ak-on`);

      let iak = 0;
      if (onElement || gateTriggered || wasLatched) {
        iak =
          Math.abs(currents[`${part.id}:ak-on`] ?? 0) ||
          Math.max(0, (vak - 0.9) / 0.8);
      }

      let conducting = false;
      if (input.powerOn) {
        if (wasLatched) {
          // Holding: unlatches when anode current falls below IH
          conducting = iak >= ih;
        } else if (gateTriggered || onElement) {
          // Latching: need Iak ≥ IL to turn on and stay on
          conducting = iak >= il;
        }
      }
      thyristors[part.id] = {
        id: part.id,
        conducting,
        vak,
        vgk,
        iak,
        ig,
        ih,
        il,
        igt: p.igt,
      };
      if (conducting) {
        currents[part.id] = iak;
      }
    }

    // ----------------------------------------------------------
    // TRIAC — per-model latching + holding (bidirectional)
    // ----------------------------------------------------------
    if (part.kind === "triac") {
      const mt1 = part.pins.mt1;
      const mt2 = part.pins.mt2;
      const gPin = part.pins.g;
      const v1 = mt1 ? (voltages[mt1] ?? 0) : 0;
      const v2 = mt2 ? (voltages[mt2] ?? 0) : 0;
      const vgNode = gPin ? (voltages[gPin] ?? 0) : 0;
      const vmt = v2 - v1;
      const vg = vgNode - v1;
      const tp = triacParams(part.props.triacModel);
      const ih = tp.ih;
      const il = tp.il;
      const igate = estimateNodeCurrent(gPin, indexOf, uf, elements, solved);
      const igFromV = Math.max(0, (Math.abs(vg) - tp.vgt) / 470);
      const ig = Math.max(igate, igFromV);
      const gateTriggered =
        Math.abs(vmt) > 0.5 && Math.abs(vg) >= tp.vgt && ig >= tp.igt;
      const wasLatched = Boolean(input.prevLatched?.[part.id]);
      const onElement = elements.some((el) => el.id === `${part.id}:mt-on`);
      let imt = 0;
      if (onElement || gateTriggered || wasLatched) {
        imt =
          Math.abs(currents[`${part.id}:mt-on`] ?? 0) ||
          Math.max(0, (Math.abs(vmt) - 0.8) / 0.6);
      }
      let conducting = false;
      if (input.powerOn) {
        if (wasLatched) {
          conducting = imt >= ih;
        } else if (gateTriggered || onElement) {
          conducting = imt >= il;
        }
      }
      triacs[part.id] = {
        id: part.id,
        conducting,
        vmt,
        vg,
        imt,
      };
      if (conducting) {
        currents[part.id] = imt;
      }
    }

    // ----------------------------------------------------------
    // DIAC
    // ----------------------------------------------------------
    if (part.kind === "diac") {
      const aPin = part.pins.a;
      const bPin = part.pins.b;
      const va = aPin ? (voltages[aPin] ?? 0) : 0;
      const vb = bPin ? (voltages[bPin] ?? 0) : 0;
      const voltage = va - vb;
      const model = part.props.diacModel ?? "db3";
      const vbo = model === "db4" ? 40 : 32;
      const onElement =
        currents[`${part.id}:on`] !== undefined ||
        elements.some((el) => el.id === `${part.id}:on`);
      const conducting =
        input.powerOn && (onElement || Math.abs(voltage) >= vbo);
      const current = conducting
        ? Math.abs(currents[`${part.id}:on`] ?? 0) || Math.abs(voltage) / 20
        : 0;
      diacs[part.id] = {
        id: part.id,
        conducting,
        voltage,
        current,
      };
      if (conducting) {
        currents[part.id] = current;
      }
    }
  }

  // Series motor current helps SCR/TRIAC stay above holding when latched.
  // Runs after all motors are evaluated so order of `parts` does not matter.
  {
    let motorI = 0;
    for (const m of Object.values(motors)) {
      if (m.on) motorI = Math.max(motorI, Math.abs(m.current));
    }
    if (motorI > 0) {
      for (const id of Object.keys(thyristors)) {
        const t = thyristors[id];
        if (!t) continue;
        if (t.conducting || t.iak > 0) {
          t.iak = Math.max(t.iak, motorI);
          const hold = t.ih ?? SCR_HOLDING_A;
          if (input.powerOn && t.iak >= hold) {
            t.conducting = true;
            currents[id] = t.iak;
          }
        }
      }
      for (const id of Object.keys(triacs)) {
        const t = triacs[id];
        if (!t) continue;
        if (t.conducting || t.imt > 0) {
          t.imt = Math.max(t.imt, motorI);
          const hold = TRIAC_HOLDING_A;
          if (input.powerOn && t.imt >= hold) {
            t.conducting = true;
            currents[id] = t.imt;
          }
        }
      }
    }
  }

  // ============================================================
  // MCU RUNTIME
  // ============================================================

  const mcus: SimResult["mcus"] = {};
  let oledTextFromMcu = "";
  let oledActiveFromMcu = false;
  let lcdSoftFromMcu = "";

  for (const mcu of input.parts) {
    if (mcu.kind !== "mcu") continue;

    const vcc =
      voltageAt(mcu, "vcc");

    const gnd =
      voltageAt(mcu, "gnd");

    const mcuVoltage = vcc - gnd;
    const model = mcu.props.mcuModel ?? "arduino-uno";
    const electricallyPowered =
      model === "arduino-uno"
        ? mcuVoltage >= ARDUINO_UNO_MIN_V && mcuVoltage <= 6.0
        : mcuVoltage >= 2.7 && mcuVoltage <= 5.5;
    const powered = input.powerOn && electricallyPowered && !hardShort;

    const code =
      mcu.props.code ??
      "";

    const runtime =
      executeMcuProgram(
        mcu,
        code,
        powered,
      );

    if (powered && runtime.state.oledActive) {
      oledActiveFromMcu = true;
      oledTextFromMcu = (runtime.state.oledLines ?? [])
        .join("\n")
        .replace(/[ \t]+$/gm, "");
    }
    if (powered && runtime.state.lcdSoftLines) {
      const soft = runtime.state.lcdSoftLines
        .map((l) => l.replace(/[ \t]+$/g, ""))
        .join("\n")
        .replace(/\n+$/g, "");
      if (soft.trim()) lcdSoftFromMcu = soft;
    }

    mcus[mcu.id] = {
      id: mcu.id,
      model:
        mcu.props.mcuModel ??
        "arduino-uno",

      powered,

      running:
        powered &&
        runtime.state.running,

      digital:
        runtime.state.digital,

      pinModes:
        runtime.state.modes,

      error:
        runtime.state.error,
      supplyVoltage: vcc - gnd,
      electricalState:
        hardShort ? "shorted" :
        vcc - gnd < ARDUINO_UNO_MIN_V ? "off" :
        vcc - gnd < ARDUINO_UNO_16MHZ_MIN_V ? "undervoltage" :
        vcc - gnd <= ARDUINO_UNO_MAX_V ? "normal" : "overvoltage",
      current: Math.abs(vcc - gnd) / ARDUINO_UNO_EQ_RESISTANCE,
    };
  }

  // ============================================================
  // LCD RUNTIME
  // ============================================================

  const lcds: SimResult["lcds"] = {};

  // Each LCD gets its own HD44780 state.
  const lcdRuntime =
    new Map<string, Hd44780State>();

  // ============================================================
  // FIND MCU DIGITAL PIN VALUE
  // ============================================================

  function mcuDigitalValue(
    mcu: PlacedPart,
    pinName: string,
    runtime: ReturnType<
      typeof executeMcuProgram
    >,
  ): 0 | 1 {
    const value =
      runtime.state.digital[pinName];

    if (value === 1) return 1;

    return 0;
  }

  // ============================================================
  // READ LCD PIN FROM ITS ELECTRICAL NET
  // ============================================================

  function lcdPinValue(
    lcd: PlacedPart,
    pinName: string,
    mcuRuntimes: Map<
      string,
      ReturnType<typeof executeMcuProgram>
    >,
  ): 0 | 1 {
    const lcdHole =
      lcd.pins[pinName];

    if (!lcdHole) {
      return 0;
    }

    const lcdIndex =
      indexOf.get(lcdHole);

    if (lcdIndex === undefined) {
      return 0;
    }

    const lcdNode =
      uf.find(lcdIndex);

    // ----------------------------------------------------------
    // First check MCU outputs connected to this same net.
    // ----------------------------------------------------------

    for (const mcu of input.parts) {
      if (mcu.kind !== "mcu") continue;

      const runtime =
        mcuRuntimes.get(mcu.id);

      if (!runtime) continue;

      for (
        const [digitalPin, value]
        of Object.entries(runtime.state.digital)
      ) {
        const mcuHole =
          mcu.pins[digitalPin];

        if (!mcuHole) continue;

        const mcuIndex =
          indexOf.get(mcuHole);

        if (mcuIndex === undefined) continue;

        const mcuNode =
          uf.find(mcuIndex);

        if (mcuNode === lcdNode) {
          return value === 1
            ? 1
            : 0;
        }
      }
    }

    // ----------------------------------------------------------
    // If connected to the PSU negative rail, treat as LOW.
    // ----------------------------------------------------------

    if (
      negativeNode !== null &&
      lcdNode === negativeNode
    ) {
      return 0;
    }

    // ----------------------------------------------------------
    // If connected to the positive rail, treat as HIGH.
    // ----------------------------------------------------------

    if (
      positiveNode !== null &&
      lcdNode === positiveNode &&
      input.psuVoltage >= 3
    ) {
      return 1;
    }

    return 0;
  }

  // ============================================================
  // EXECUTE MCU PROGRAMS AGAIN
  //
  // We need the runtime objects because their pin events
  // represent the actual digital activity sent to peripherals.
  // ============================================================

  const mcuRuntimes =
    new Map<
      string,
      ReturnType<typeof executeMcuProgram>
    >();

  for (const mcu of input.parts) {
    if (mcu.kind !== "mcu") continue;

    const vcc2 = voltageAt(mcu, "vcc");
    const gnd2 = voltageAt(mcu, "gnd");
    const mcuVoltage2 = vcc2 - gnd2;
    const model2 = mcu.props.mcuModel ?? "arduino-uno";
    const electricallyPowered =
      model2 === "arduino-uno"
        ? mcuVoltage2 >= ARDUINO_UNO_MIN_V && mcuVoltage2 <= 6.0
        : mcuVoltage2 >= 2.7 && mcuVoltage2 <= 5.5;
    const powered = input.powerOn && electricallyPowered && !hardShort;

    const runtime =
      executeMcuProgram(
        mcu,
        mcu.props.code ?? "",
        powered,
      );

    mcuRuntimes.set(
      mcu.id,
      runtime,
    );

    if (powered && runtime.state.lcdSoftLines) {
      const soft = runtime.state.lcdSoftLines
        .map((l) => l.replace(/[ \t]+$/g, ""))
        .join("\n")
        .replace(/\n+$/g, "");
      if (soft.trim()) lcdSoftFromMcu = soft;
    }

    // Keep the exact state returned by this execution.
    mcus[mcu.id] = {
      id: mcu.id,
      model:
        mcu.props.mcuModel ??
        "arduino-uno",

      powered,

      running:
        powered &&
        runtime.state.running,

      digital:
        runtime.state.digital,

      pinModes:
        runtime.state.modes,

      error:
        runtime.state.error,
      supplyVoltage: vcc2 - gnd2,
      electricalState:
        hardShort ? "shorted" :
        vcc2 - gnd2 < ARDUINO_UNO_MIN_V ? "off" :
        vcc2 - gnd2 < ARDUINO_UNO_16MHZ_MIN_V ? "undervoltage" :
        vcc2 - gnd2 <= ARDUINO_UNO_MAX_V ? "normal" : "overvoltage",
      current: Math.abs(vcc2 - gnd2) / ARDUINO_UNO_EQ_RESISTANCE,
    };
  }

  // ============================================================
  // PROCESS EVERY LCD
  // ============================================================

  for (const lcd of input.parts) {
    if (lcd.kind !== "lcd") continue;

    // LCD power comes from the Arduino 5 V output. The display's visual
    // power wires are intentionally not merged into the bench PSU net.
    const lcdMcu = input.parts.find((part) => part.kind === "mcu");
    const lcdVoltage = lcdMcu
      ? voltageAt(lcdMcu, "vcc") - voltageAt(lcdMcu, "gnd")
      : 0;
    const powered =
      input.powerOn &&
      lcdVoltage >= LCD_HD44780_MIN_V &&
      lcdVoltage <= 6.0 &&
      !hardShort;

    let state =
      lcdRuntime.get(lcd.id);

    if (!state) {
      state = createHd44780();

      lcdRuntime.set(
        lcd.id,
        state,
      );
    }

    // ----------------------------------------------------------
    // Current LCD bus values.
    // ----------------------------------------------------------

    let previous: Hd44780Pins = {
      rs: 0,
      rw: 0,
      e: 0,
      d4: 0,
      d5: 0,
      d6: 0,
      d7: 0,
    };

    // ----------------------------------------------------------
    // Replay MCU digital pin events.
    //
    // This is important:
    //
    // We do NOT simply read the final MCU pin state.
    //
    // HD44780 communication depends on E transitions.
    // ----------------------------------------------------------

    for (const mcu of input.parts) {
      if (mcu.kind !== "mcu") continue;

      const runtime =
        mcuRuntimes.get(mcu.id);

      if (!runtime) continue;

      for (const event of runtime.pinEvents) {
        const current: Hd44780Pins = {
          rs: previous.rs,
          rw: previous.rw,
          e: previous.e,
          d4: previous.d4,
          d5: previous.d5,
          d6: previous.d6,
          d7: previous.d7,
        };

        // ------------------------------------------------------
        // Update the changed MCU pin.
        // ------------------------------------------------------

        const eventHole =
          mcu.pins[event.pin];

        if (!eventHole) continue;

        const eventIndex =
          indexOf.get(eventHole);

        if (eventIndex === undefined) continue;

        const eventNode =
          uf.find(eventIndex);

        // ------------------------------------------------------
        // Find which LCD pin shares this electrical net.
        // ------------------------------------------------------

        const lcdPinNames = [
          "rs",
          "rw",
          "e",
          "d4",
          "d5",
          "d6",
          "d7",
        ] as const;

        for (
          const lcdPin of lcdPinNames
        ) {
          const lcdHole =
            lcd.pins[lcdPin];

          if (!lcdHole) continue;

          const lcdIndex =
            indexOf.get(lcdHole);

          if (lcdIndex === undefined) {
            continue;
          }

          const lcdNode =
            uf.find(lcdIndex);

          if (
            lcdNode === eventNode
          ) {
            current[lcdPin] =
              event.value;
          }
        }

        // ------------------------------------------------------
        // Clock the LCD.
        //
        // HD44780 captures data when E goes HIGH -> LOW.
        // ------------------------------------------------------

        const nextState = clockHd44780(
          state,
          previous,
          current,
        );
        if (nextState) state = nextState;

        previous = current;
      }
    }

    // ----------------------------------------------------------
    // If R/W is physically grounded, force LOW.
    // ----------------------------------------------------------

    const rw =
      lcdPinValue(
        lcd,
        "rw",
        mcuRuntimes,
      );

    // ----------------------------------------------------------
    // Save LCD state.
    // ----------------------------------------------------------

    // Prefer the sketch print() soft buffer — the electrical HD44780
    // path often produces garbage when nets are partially connected.
    let text = "";
    if (powered) {
      if (lcdSoftFromMcu.trim()) {
        text = lcdSoftFromMcu;
      } else {
        const bus = lcdText(state) || "";
        // Only accept bus text if it looks like printable content
        const printable = bus.replace(/[^\x20-\x7E\n]/g, "").trim();
        text = printable.length >= 2 ? bus : "";
      }
    }

    lcds[lcd.id] = {
      id: lcd.id,
      powered,

      text,

      displayOn:
        powered &&
        state.displayOn,

      cursorOn:
        powered &&
        state.cursorOn,

      blinkOn:
        powered &&
        state.blinkOn,

      cursorColumn:
        state.cursorColumn,

      cursorRow:
        state.cursorRow,
      supplyVoltage: lcdVoltage,
      electricalState:
        hardShort ? "shorted" :
        lcdVoltage <= 0 ? "off" :
        lcdVoltage < LCD_HD44780_MIN_V ? "undervoltage" :
        lcdVoltage <= LCD_HD44780_MAX_V ? "normal" : "overvoltage",
      current:
        Math.max(0, lcdVoltage) / LCD_LOGIC_EQ_RESISTANCE +
        Math.max(0, lcdVoltage) / LCD_BACKLIGHT_EQ_RESISTANCE,
    };
  }

  // ============================================================
  // OLED ELECTRICAL MODEL
  // ============================================================
  let oledVoltage = 0;
  let oledElectricalState: SimResult["oledElectricalState"] = "off";

  for (const oled of input.parts) {
    if (oled.kind !== "oled") continue;

    // OLED power comes from the Arduino's regulated 3.3 V output. It is not
    // treated as a direct connection to the bench PSU.
    const oledMcu = input.parts.find((part) => part.kind === "mcu");
    const mcuSupply = oledMcu
      ? voltageAt(oledMcu, "vcc") - voltageAt(oledMcu, "gnd")
      : 0;
    const v = input.powerOn && !hardShort && mcuSupply >= 4.0
      ? OLED_NOMINAL_V
      : 0;
    oledVoltage = v;

    if (hardShort) {
      oledElectricalState = "off";
      currents[oled.id] = 0;
      continue;
    }

    currents[oled.id] = Math.max(0, v) / OLED_EQ_RESISTANCE;

    if (v <= 0.05) {
      oledElectricalState = "off";
    } else if (v < OLED_MIN_V) {
      oledElectricalState = "undervoltage";
      warnings.push(`OLED ${oled.id}: ${v.toFixed(2)} V is below the 3.3 V module operating range.`);
    } else if (v <= OLED_MAX_V) {
      oledElectricalState = "normal";
    } else {
      oledElectricalState = "overvoltage";
      warnings.push(`OLED ${oled.id}: ${v.toFixed(2)} V is above the 3.6 V safe limit for the generic 3.3 V model.`);
    }
  }

  // ============================================================
  // ARDUINO PERIPHERAL POWER BUDGET
  // ============================================================
  // LCD/OLED current is intentionally treated as current delivered by the
  // Arduino's power outputs. It is NOT a short merely because the display
  // consumes more current than the MCU core itself. A short is only detected
  // by the topology check above (VCC and GND collapsed onto one net).
  const firstMcuPart = input.parts.find((part) => part.kind === "mcu");
  if (firstMcuPart) {
    const lcdLoadA = Object.values(lcds).reduce(
      (sum, lcd) => sum + Math.max(0, lcd.current ?? 0),
      0,
    );
    const oledLoadA = Object.values(input.parts)
      .filter((part) => part.kind === "oled")
      .reduce((sum, oled) => sum + Math.max(0, currents[oled.id] ?? 0), 0);

    const lcdLoadMa = lcdLoadA * 1000;
    const oledLoadMa = oledLoadA * 1000;

    if (lcdLoadMa > ARDUINO_5V_PERIPHERAL_LIMIT_MA) {
      warnings.push(
        `Arduino ${firstMcuPart.id}: 5 V peripheral load is ${lcdLoadMa.toFixed(0)} mA, above the simulated ${ARDUINO_5V_PERIPHERAL_LIMIT_MA} mA output budget. This is an overload, not a short circuit.`,
      );
    }
    if (oledLoadMa > ARDUINO_3V3_PERIPHERAL_LIMIT_MA) {
      warnings.push(
        `Arduino ${firstMcuPart.id}: 3.3 V peripheral load is ${oledLoadMa.toFixed(0)} mA, above the simulated ${ARDUINO_3V3_PERIPHERAL_LIMIT_MA} mA regulator budget. This is an overload, not a short circuit.`,
      );
    }
  }

  // ============================================================
  // BACKWARDS-COMPATIBILITY DISPLAY VALUES
  // ============================================================

  const firstLcd =
    Object.values(lcds)[0];

  const firstMcu =
    Object.values(mcus)[0];

  const mcuPowered =
    Boolean(firstMcu?.powered);

  const lcdPowered =
    Boolean(firstLcd?.powered);

  let displayText = firstLcd?.text ?? "";
  if (lcdSoftFromMcu.trim() && mcuPowered) {
    displayText = lcdSoftFromMcu;
  }

  // OLED is only considered powered when its electrical rail is in the
  // safe 3.3 V window. The MCU text buffer alone can never bypass the
  // electrical safety model.
  let oledPowered =
    input.powerOn &&
    oledElectricalState === "normal";

  // Also require an active MCU for simulated I2C text output.
  if (!mcuPowered || !oledActiveFromMcu) {
    oledPowered = false;
  }

  const oledText = oledPowered ? oledTextFromMcu : "";

  // ============================================================
  // FINAL RESULT
  // ============================================================

  // Rough total current drawn from the supply. A hard short is a special
  // topology condition: there is no finite resistor for Ohm's law to use,
  // so the educational PSU model clamps the fault at its 2 A limit.
  if (hardShort) {
    supplyCurrent = PSU_SHORT_CURRENT_A;
    warnings.push(`SHORT CIRCUIT: PSU current limited to ${PSU_SHORT_CURRENT_A.toFixed(2)} A.`);
  } else {
    for (const el of elements) {
      if (el.a === positiveNode || el.b === positiveNode) {
        const va = solved[el.a] ?? 0;
        const vb = solved[el.b] ?? 0;
        const i =
          (va - vb - (el.forwardVoltage ?? 0)) /
          Math.max(el.resistance, 1e-9);
        if (el.a === positiveNode) supplyCurrent += i;
        else supplyCurrent -= i;
      }
    }

    // Downstream display current is supplied by the Arduino. It is therefore
    // part of the PSU's total load, but it is never itself a PSU short.
    const lcdLoadA = Object.values(lcds).reduce(
      (sum, lcd) => sum + Math.max(0, lcd.current ?? 0),
      0,
    );
    const oledLoadA = Object.values(input.parts)
      .filter((part) => part.kind === "oled")
      .reduce((sum, oled) => sum + Math.max(0, currents[oled.id] ?? 0), 0);

    supplyCurrent = Math.abs(supplyCurrent) + lcdLoadA + oledLoadA;
  }

  const burned: Record<string, boolean> = {};

  // Components that have both terminals/power pins collapsed onto the PSU
  // short node are physically across a hard short. Mark them burned so the
  // existing smoke animation can react.
  if (hardShort && positiveNode !== null) {
    for (const part of input.parts) {
      const candidatePins =
        // A bench-supply hard short should trip the PSU protection model,
        // not automatically destroy every powered module. Modules are only
        // marked burned by their own overvoltage/overcurrent conditions.
        part.kind === "mcu" || part.kind === "lcd"
          ? []
          : part.kind === "resistor" ||
                part.kind === "led" ||
                part.kind === "diode" ||
                part.kind === "buzzer" ||
                part.kind === "speaker" ||
                part.kind === "inductor" ||
                part.kind === "capacitor"
              ? Object.values(part.pins).slice(0, 2)
              : [];

      if (candidatePins.length >= 2) {
        const indices = candidatePins
          .map((h) => h ? indexOf.get(h) : undefined)
          .filter((n): n is number => n !== undefined);
        if (indices.length >= 2) {
          const n0 = uf.find(indices[0]);
          const n1 = uf.find(indices[1]);
          if (n0 === positiveNode && n1 === positiveNode) {
            burned[part.id] = true;
          }
        }
      }
    }
  }
  for (const [id, led] of Object.entries(leds)) {
    if (led.overcurrent) burned[id] = true;
  }
  for (const [id, bz] of Object.entries(buzzers)) {
    if (bz.overcurrent) burned[id] = true;
  }
  // Resistors: P = I²R. Respect the selected component power/current/voltage ratings.
  for (const part of input.parts) {
    if (part.kind !== "resistor") continue;
    const i = Math.abs(currents[part.id] ?? 0);
    const r = Math.max(0.001, part.props.resistance ?? 1000);
    const power = i * i * r;
    const voltage = Math.abs(voltageAt(part, "a") - voltageAt(part, "b"));
    const powerRating = Math.max(0.001, part.props.powerRating ?? 0.25);
    const voltageRating = Math.max(0.1, part.props.voltageRating ?? 200);
    const currentRating = Math.sqrt(powerRating / r);

    // A resistor burns when any of its configured electrical limits is exceeded.
    // Keep the legacy 50 mA floor only as a safety fallback for old saved parts
    // that do not contain rating metadata.
    if (power > powerRating || voltage > voltageRating || i > currentRating || i > 0.05) {
      burned[part.id] = true;
    }
  }
  // Diodes: > 1 A treated as overcurrent
  for (const [id, d] of Object.entries(diodes)) {
    if (Math.abs(d.current ?? 0) > 1) burned[id] = true;
  }

  // Module-level electrical state. Keep the runtime state separate from the
  // physical voltage/current state so 4.0 V can be represented as an Arduino
  // undervoltage condition without pretending the board is instantly burned.
  for (const mcu of input.parts) {
    if (mcu.kind !== "mcu") continue;
    const v = voltageAt(mcu, "vcc") - voltageAt(mcu, "gnd");
    currents[mcu.id] = hardShort ? 0 : Math.max(0, v) / ARDUINO_UNO_EQ_RESISTANCE;
    const model = mcu.props.mcuModel ?? "arduino-uno";
    const state = mcus[mcu.id];
    if (!state) continue;
    if (hardShort && state) {
      state.powered = false;
      state.running = false;
      state.error = "Hard short circuit on MCU supply. PSU protection is active; MCU is powered down rather than automatically burned.";
    } else if (model === "arduino-uno" && v >= ARDUINO_UNO_MIN_V && v < ARDUINO_UNO_16MHZ_MIN_V) {
      state.error = `Undervoltage: ${v.toFixed(2)} V. 16 MHz operation is outside the specified 4.5–5.5 V range.`;
      warnings.push(`Arduino ${mcu.id}: ${v.toFixed(2)} V is below the 4.5 V / 16 MHz operating range.`);
    } else if (v > ARDUINO_UNO_MAX_V && v <= 6.0) {
      state.error = `Overvoltage stress: ${v.toFixed(2)} V is above the 5.5 V operating limit.`;
    } else if (v > 6.0) {
      state.powered = false;
      state.running = false;
      state.error = `Severe overvoltage: ${v.toFixed(2)} V. MCU treated as damaged.`;
      burned[mcu.id] = true;
    }
  }

  for (const lcd of input.parts) {
    if (lcd.kind !== "lcd") continue;
    const v = voltageAt(lcd, "vdd") - voltageAt(lcd, "vss");
    currents[lcd.id] = hardShort
      ? 0
      : Math.max(0, v) / LCD_LOGIC_EQ_RESISTANCE +
        Math.max(0, v) / LCD_BACKLIGHT_EQ_RESISTANCE;
    const state = lcds[lcd.id];
    if (!state) continue;
    if (hardShort) {
      state.powered = false;
      state.displayOn = false;
    } else if (v > LCD_HD44780_MAX_V && v <= 6.0) {
      warnings.push(`LCD ${lcd.id}: ${v.toFixed(2)} V is above the 5.5 V HD44780 supply limit; overvoltage stress.`);
    } else if (v > 6.0) {
      state.powered = false;
      state.displayOn = false;
      burned[lcd.id] = true;
      warnings.push(`LCD ${lcd.id}: severe overvoltage at ${v.toFixed(2)} V.`);
    } else if (v > 0 && v < LCD_HD44780_MIN_V) {
      state.powered = false;
      state.displayOn = false;
      warnings.push(`LCD ${lcd.id}: ${v.toFixed(2)} V is below the 4.5 V operating range of a 5 V HD44780 module.`);
    }
  }

  // ============================================================
  // NODE CURRENTS (probe / ammeter at a hole)
  // ============================================================
  // For each electrical node, sum |I| of every two-terminal network
  // element attached to it, then divide by 2 so each element is not
  // double-counted. Map that magnitude onto every hole on the node.
  const nodeCurrentByUf = new Map<number, number>();
  for (const el of elements) {
    const va = solved[el.a] ?? 0;
    const vb = solved[el.b] ?? 0;
    const i = Math.abs(
      (va - vb - (el.forwardVoltage ?? 0)) / Math.max(el.resistance, 1e-9),
    );
    nodeCurrentByUf.set(el.a, (nodeCurrentByUf.get(el.a) ?? 0) + i);
    nodeCurrentByUf.set(el.b, (nodeCurrentByUf.get(el.b) ?? 0) + i);
  }
  const nodeCurrents: Record<string, number> = {};
  for (const hole of getAllHoles()) {
    const index = indexOf.get(hole);
    if (index === undefined) continue;
    const node = uf.find(index);
    nodeCurrents[hole] = (nodeCurrentByUf.get(node) ?? 0) / 2;
  }

  return {
    voltages,
    currents,
    nodeCurrents,
    shortCircuit: hardShort,

    leds,
    diodes,

    switches,
    buttons,

    capacitors,
    inductors,
    buzzers,
    relays,
    transistors,
    thyristors,
    triacs,
    diacs,
    motors,
    speakers,

    mcus,
    lcds,

    supplyCurrent,
    warnings,

    // Compatibility with the current mesh code.
    mcuPowered,
    lcdPowered,
    lcdText: displayText,
    oledPowered,
    oledText,
    oledVoltage,
    oledElectricalState,
    burned,
  };
}