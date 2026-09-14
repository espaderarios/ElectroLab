import { create } from "zustand";
import {
  BOARD,
  holeStrip,
  offsetHole,
  parseTerminalHole,
  setBoardPreset,
  BOARD_PRESETS,
  type BoardPresetId,
} from "@/circuit/breadboard";
import { helloWorldPreset, type LabPreset } from "@/circuit/presets";
import { simulate } from "@/circuit/simulate";
import type {
  HoleId,
  PartKind,
  PlacedPart,
  SimResult,
  ToolId,
  Wire,
  WireColor,
} from "@/circuit/types";
import { MOTOR_MODELS } from "@/circuit/types";
import { uid } from "@/lib/utils";

/** Suppress accidental double placement from drag-drop + hole-click on the same gesture. */
let _lastPlace: { key: string; at: number; tool: string } = {
  key: "",
  at: 0,
  tool: "",
};
/** Hole clicks are ignored until this timestamp (ms). */
let _suppressHolePlaceUntil = 0;

/** Terminal-strip row groups (same half of the board). */
const ROW_GROUPS: string[][] = [
  ["A", "B", "C", "D", "E"],
  ["F", "G", "H", "I", "J"],
  ["K", "L", "M", "N", "O"],
  ["P", "Q", "R", "S", "T"],
];

/**
 * Rotate pin holes 90° clockwise in the breadboard grid, staying in the same
 * half (A–E / F–J / …). Used by rotateSelected for 90° steps.
 */
function rotatePins90Clockwise(
  pins: Record<string, HoleId>,
): Record<string, HoleId> | null {
  const entries = Object.entries(pins).filter(
    ([, hole]) => hole && /^[A-T]\d+$/.test(hole),
  ) as [string, HoleId][];
  if (entries.length === 0) return null;

  const first = parseTerminalHole(entries[0][1]);
  if (!first) return null;
  const group =
    ROW_GROUPS.find((g) => g.includes(first.row)) ?? ROW_GROUPS[0];

  const parsed = entries.map(([name, hole]) => {
    const p = parseTerminalHole(hole)!;
    let ri = group.indexOf(p.row);
    if (ri < 0) ri = 0; // snap foreign-half pins into this half
    return { name, col: p.col, ri };
  });

  const cols = parsed.map((p) => p.col);
  const ris = parsed.map((p) => p.ri);
  const centerC = (Math.min(...cols) + Math.max(...cols)) / 2;
  const centerR = (Math.min(...ris) + Math.max(...ris)) / 2;

  const newPins = { ...pins };
  for (const p of parsed) {
    // 90° CW in (col, rowIndex) space: (c, r) → (c0+(r-r0), r0-(c-c0))
    let nc = Math.round(centerC + (p.ri - centerR));
    let nr = Math.round(centerR - (p.col - centerC));
    nc = Math.min(BOARD.cols, Math.max(1, nc));
    nr = Math.min(group.length - 1, Math.max(0, nr));
    newPins[p.name] = `${group[nr]}${nc}` as HoleId;
  }
  return newPins;
}

interface LabSnapshot {
  parts: PlacedPart[];
  wires: Wire[];
  psuPositive: HoleId | null;
  psuNegative: HoleId | null;
}

interface LabState {
  tool: ToolId;
  wireColor: WireColor;

  resistorValue: number;
  transistorModel: import("@/circuit/types").TransistorModelId;
  thyristorModel: import("@/circuit/types").ThyristorModelId;
  triacModel: import("@/circuit/types").TriacModelId;
  diacModel: import("@/circuit/types").DiacModelId;
  motorModel: import("@/circuit/types").MotorModelId;
  capacitorValue: number;

  ledColor: NonNullable<PlacedPart["props"]["ledColor"]>;

  pendingHole: HoleId | null;
  pendingHoles: HoleId[];
  hoverHole: HoleId | null;

  selectedId: string | null;
  probeHole: HoleId | null;

  /**
   * When set, the next hole click reassigns this pin on the part
   * (edit where individual nodes go).
   */
  pinEditTarget: { partId: string; pinName: string } | null;

  /**
   * When true, the next hole click moves the selected part's whole footprint
   * so its first pin lands on that hole.
   */
  movingSelected: boolean;

  /**
   * True while the user is mid drag-from-palette. Hole clicks must not also
   * place a part (that was causing double placement on drop).
   */
  paletteDragging: boolean;

  /**
   * When true, long-press / drag can move placed components on the board.
   * When false, parts behave like the original lab (click to select only).
   */
  partDragEnabled: boolean;

  parts: PlacedPart[];
  wires: Wire[];

  powerOn: boolean;
  psuVoltage: number;

  psuPositive: HoleId | null;
  psuNegative: HoleId | null;

  sim: SimResult;

  labId: string;

  /** Active breadboard size / style preset. */
  boardId: BoardPresetId;

  history: LabSnapshot[];
  future: LabSnapshot[];

  setCapacitorValue: (value: number) => void;
  setSelectedCapacitance: (value: number) => void;

  setBoard: (id: BoardPresetId) => void;
  /**
   * Place a component in one gesture starting at `anchor` hole.
   * Multi-pin parts fan out across adjacent columns automatically.
   * Pass `explicitPins` to place with user-chosen holes (pin-by-pin mode).
   */
  placePartAt: (
    tool: ToolId,
    anchor: HoleId,
    explicitPins?: Record<string, HoleId>,
  ) => void;

  /** Mark palette drag in progress so hole-click does not double-place. */
  setPaletteDragging: (active: boolean) => void;

  /** Enable / disable long-press drag-to-move for placed components. */
  setPartDragEnabled: (enabled: boolean) => void;

  setTool: (tool: ToolId) => void;
  setWireColor: (color: WireColor) => void;

  setResistorValue: (value: number) => void;

  setLedColor: (
    color: NonNullable<PlacedPart["props"]["ledColor"]>
  ) => void;

  setSelectedResistance: (value: number) => void;
  setSelectedProp: (key: keyof PlacedPart["props"], value: unknown) => void;

  setTransistorModel: (model: import("@/circuit/types").TransistorModelId) => void;
  setSelectedTransistorModel: (model: import("@/circuit/types").TransistorModelId) => void;
  setThyristorModel: (model: import("@/circuit/types").ThyristorModelId) => void;
  setSelectedThyristorModel: (model: import("@/circuit/types").ThyristorModelId) => void;
  setTriacModel: (model: import("@/circuit/types").TriacModelId) => void;
  setSelectedTriacModel: (model: import("@/circuit/types").TriacModelId) => void;
  setDiacModel: (model: import("@/circuit/types").DiacModelId) => void;
  setSelectedDiacModel: (model: import("@/circuit/types").DiacModelId) => void;
  setMotorModel: (model: import("@/circuit/types").MotorModelId) => void;
  setSelectedMotorModel: (model: import("@/circuit/types").MotorModelId) => void;
  setSelectedLedColor: (
    color: NonNullable<PlacedPart["props"]["ledColor"]>
  ) => void;

  setSelectedLabel: (label: string) => void;
  /** Update sketch on the selected MCU. */
  setSelectedCode: (code: string) => void;
  /** Update sketch on a specific MCU by id. */
  setMcuCode: (id: string, code: string) => void;

  setHover: (hole: HoleId | null) => void;
  clickHole: (hole: HoleId) => void;
  select: (id: string | null) => void;

  togglePower: () => void;
  /** Power on + resimulate (toolbar “Run Simulation”). */
  runNow: () => void;
  setVoltage: (voltage: number) => void;
  toggleSwitch: (id: string) => void;
  /** Momentary push-button: true while held, false on release. */
  setButtonPressed: (id: string, pressed: boolean) => void;

  deleteSelected: () => void;
  /** Rotate selected part 90° clockwise on the breadboard (pin grid + visual). */
  rotateSelected: () => void;
  /**
   * Move the selected part so its footprint is re-anchored at `anchor`
   * (same relative pin layout as when first placed).
   */
  moveSelectedTo: (anchor: HoleId) => void;
  /** Toggle "click a hole to move the selected part" mode. */
  setMovingSelected: (active: boolean) => void;
  /** Begin editing a single pin: next hole click assigns that node. */
  startPinEdit: (partId: string, pinName: string) => void;
  cancelPinEdit: () => void;
  /** Directly set one pin of a part to a hole (used by pin editor). */
  setPartPin: (partId: string, pinName: string, hole: HoleId) => void;
  undo: () => void;
  redo: () => void;

  loadPreset: (preset: LabPreset) => void;
  /**
   * Replace the entire board state from a project circuit snapshot.
   * Used when opening a different project file.
   */
  loadCircuit: (circuit: {
    boardId?: BoardPresetId;
    psuVoltage?: number;
    psuPositive: HoleId | null;
    psuNegative: HoleId | null;
    parts: PlacedPart[];
    wires: Wire[];
  }) => void;
  /** Snapshot current board for saving into a project file. */
  getCircuitSnapshot: () => {
    boardId: BoardPresetId;
    psuVoltage: number;
    psuPositive: HoleId | null;
    psuNegative: HoleId | null;
    parts: PlacedPart[];
    wires: Wire[];
  };
  clearBoard: () => void;
  resetPending: () => void;
}

const initialPreset = {
  id: "free",
  parts: [],
  wires: [],
  psuPositive: null,
  psuNegative: null,
};

export interface McuProgram {
  language: "arduino";
  code: string;
}

function snapshot(state: LabState): LabSnapshot {
  return {
    parts: state.parts.map((p) => ({
      ...p,
      pins: { ...p.pins },
      props: { ...p.props },
    })),

    wires: state.wires.map((w) => ({ ...w })),

    psuPositive: state.psuPositive,

    psuNegative: state.psuNegative,
  };
}

function runSimulation(state: {
  parts: PlacedPart[];
  wires: Wire[];
  powerOn: boolean;
  psuVoltage: number;
  psuPositive: HoleId | null;
  psuNegative: HoleId | null;
  /** Prior sim result — used so SCR/TRIAC holding current can keep devices latched. */
  sim?: SimResult;
}) {
  const prevLatched: Record<string, boolean> = {};
  const prevMotorCurrents: Record<string, number> = {};
  if (state.powerOn && state.sim) {
    for (const [id, t] of Object.entries(state.sim.thyristors ?? {})) {
      if (t.conducting) prevLatched[id] = true;
    }
    for (const [id, t] of Object.entries(state.sim.triacs ?? {})) {
      if (t.conducting) prevLatched[id] = true;
    }
    for (const [id, m] of Object.entries(state.sim.motors ?? {})) {
      if (typeof m.current === "number") prevMotorCurrents[id] = m.current;
    }
  }
  return simulate({ ...state, prevLatched, prevMotorCurrents });
}

function getTwoPinKind(tool: ToolId): PartKind | "wire" | null {
  switch (tool) {
    case "wire":
      return "wire";

    case "resistor":
      return "resistor";

    case "led":
      return "led";

    case "diode":
      return "diode";

    case "switch":
      return "switch";

    case "button":
      return "button";

    case "capacitor":
      return "capacitor";

    case "inductor":
      return "inductor";

    case "buzzer":
      return "buzzer";

    case "lcd":
      return "lcd";

    case "oled":
      return "oled";

    case "mcu":
      return "mcu";

    case "transistor":
      return "transistor";

    case "thyristor":
      return "thyristor";

    case "triac":
      return "triac";

    case "diac":
      return "diac";

    case "motor":
      return "motor";

    case "speaker":
      return "speaker";

    default:
      return null;
  }
}

/**
 * Compute the hole list / pin map for placing (or previewing) a tool at an anchor.
 * Returns null if the anchor is invalid for that tool.
 */
export function computePinLayout(
  tool: ToolId,
  anchor: HoleId,
): { holes: HoleId[]; pins: Record<string, HoleId>; kind: PartKind | "wire" } | null {
  const placement = getPlacement(tool);
  if (!placement) return null;

  const parsed = parseTerminalHole(anchor);
  if (!parsed && placement.kind !== "wire") {
    return null;
  }

  const holes: HoleId[] = [];
  if (placement.kind === "wire") {
    holes.push(anchor);
    const next = offsetHole(anchor, 1) ?? anchor;
    holes.push(next);
  } else if (placement.pins.length === 2) {
    holes.push(anchor);
    // LED / diode: adjacent columns on the same row (typical breadboard span).
    // Never jump the center trench — that left the body floating mid-board
    // with no connecting leads.
    if (placement.kind === "led" || placement.kind === "diode") {
      const next = offsetHole(anchor, 1) ?? offsetHole(anchor, -1) ?? anchor;
      holes.push(next);
    } else {
      // Resistors etc.: span ~3 columns when possible.
      const b = offsetHole(anchor, 3) ?? offsetHole(anchor, 1) ?? anchor;
      holes.push(b);
    }
  } else {
    const maxStartCol = Math.max(1, BOARD.cols - placement.pins.length + 1);
    const startCol = Math.min(parsed!.col, maxStartCol);
    const row = parsed!.row;
    for (let i = 0; i < placement.pins.length; i++) {
      holes.push(`${row}${startCol + i}` as HoleId);
    }
  }

  const pins = Object.fromEntries(
    placement.pins.map((name, index) => [name, holes[index] ?? anchor]),
  ) as Record<string, HoleId>;

  return { holes, pins, kind: placement.kind };
}

/**
 * Build a transient PlacedPart used as a 3D mesh ghost while dragging/placing.
 */
export function buildPreviewPart(
  tool: ToolId,
  anchor: HoleId,
  defaults?: {
    resistorValue?: number;
    capacitorValue?: number;
    ledColor?: NonNullable<PlacedPart["props"]["ledColor"]>;
    transistorModel?: import("@/circuit/types").TransistorModelId;
    thyristorModel?: import("@/circuit/types").ThyristorModelId;
    triacModel?: import("@/circuit/types").TriacModelId;
    diacModel?: import("@/circuit/types").DiacModelId;
    motorModel?: import("@/circuit/types").MotorModelId;
  },
): PlacedPart | null {
  const layout = computePinLayout(tool, anchor);
  if (!layout || layout.kind === "wire") return null;

  const kind = layout.kind as PartKind;
  return {
    id: "__preview__",
    kind,
    pins: layout.pins,
    props: {
      resistance:
        kind === "resistor" || kind === "pot"
          ? defaults?.resistorValue ?? 1000
          : undefined,
      capacitance:
        kind === "capacitor" ? defaults?.capacitorValue ?? 10e-6 : undefined,
      tolerance: kind === "resistor" ? 5 : undefined,
      powerRating: kind === "resistor" || kind === "pot" ? 0.25 : undefined,
      ledColor: kind === "led" ? defaults?.ledColor ?? "red" : undefined,
      closed:
        kind === "switch" || kind === "button" ? false : undefined,
      mcuModel: kind === "mcu" ? "arduino-uno" : undefined,
      transistorModel:
        kind === "transistor" ? defaults?.transistorModel : undefined,
      thyristorModel:
        kind === "thyristor" ? defaults?.thyristorModel : undefined,
      triacModel: kind === "triac" ? defaults?.triacModel : undefined,
      diacModel: kind === "diac" ? defaults?.diacModel : undefined,
      motorModel: kind === "motor" ? defaults?.motorModel : undefined,
      capacitorType: kind === "capacitor" ? "ceramic" : undefined,
      diodeType: kind === "diode" ? "silicon" : undefined,
    },
  };
}

/**
 * Re-anchor an existing part's footprint at a new hole, preserving the current
 * relative pin layout (including after 90° rotations).
 * Exported so the move-ghost can preview the same orientation the drop will use.
 */
export function reanchorPartPins(
  part: PlacedPart,
  anchor: HoleId,
): Record<string, HoleId> | null {
  const parsed = parseTerminalHole(anchor);
  if (!parsed) return null;

  const entries = Object.entries(part.pins).filter(
    ([, hole]) => hole && /^[A-T]\d+$/.test(hole),
  ) as [string, HoleId][];
  if (entries.length === 0) return null;

  // Sort so the "first" pin is a stable anchor (leftmost, then topmost).
  entries.sort((a, b) => {
    const pa = parseTerminalHole(a[1])!;
    const pb = parseTerminalHole(b[1])!;
    if (pa.col !== pb.col) return pa.col - pb.col;
    return pa.row.localeCompare(pb.row);
  });

  // Anchor = first pin in sorted order; every other pin keeps the same
  // (Δcol, Δrow) relative offset so a 90°/180°/270° footprint stays oriented.
  const origin = parseTerminalHole(entries[0][1])!;
  const originGroup =
    ROW_GROUPS.find((g) => g.includes(origin.row)) ?? ROW_GROUPS[0];
  const targetGroup =
    ROW_GROUPS.find((g) => g.includes(parsed.row)) ?? originGroup;
  const originRi = Math.max(0, originGroup.indexOf(origin.row));
  const targetRi = Math.max(0, targetGroup.indexOf(parsed.row));

  const newPins = { ...part.pins };
  for (const [name, hole] of entries) {
    const p = parseTerminalHole(hole)!;
    const srcGroup =
      ROW_GROUPS.find((g) => g.includes(p.row)) ?? originGroup;
    const ri = Math.max(0, srcGroup.indexOf(p.row));
    const relCol = p.col - origin.col;
    const relRow = ri - originRi;
    let nc = parsed.col + relCol;
    let nr = targetRi + relRow;
    nc = Math.min(BOARD.cols, Math.max(1, nc));
    nr = Math.min(targetGroup.length - 1, Math.max(0, nr));
    newPins[name] = `${targetGroup[nr]}${nc}` as HoleId;
  }
  return newPins;
}

/**
 * Build a preview of `part` as it would look after moving its footprint so the
 * first pin sits on `anchor` — keeps rotation / relative pin layout.
 */
export function previewMovedPart(
  part: PlacedPart,
  anchor: HoleId,
): PlacedPart | null {
  const newPins = reanchorPartPins(part, anchor);
  if (!newPins) return null;
  return {
    ...part,
    id: "__move_preview__",
    pins: newPins,
    props: { ...part.props },
  };
}

function getPlacement(tool: ToolId) {
  const kind = getTwoPinKind(tool);
  if (kind) {
    if (kind === "wire") return { kind, pins: ["a", "b"] };
    if (kind === "led" || kind === "diode") return { kind, pins: ["a", "k"] };
    if (kind === "lcd") {
      return {
        kind,
        pins: [
          "vss",
          "vdd",
          "v0",
          "rs",
          "rw",
          "e",
          "d0",
          "d1",
          "d2",
          "d3",
          "d4",
          "d5",
          "d6",
          "d7",
          "a",
          "k",
        ],
      };
    }
    if (kind === "oled") {
      return {
        kind,
        pins: ["vcc", "gnd", "sda", "scl"],
      };
    }
    if (kind === "transistor") {
      return { kind, pins: ["e", "b", "c"] };
    }
    if (kind === "thyristor") {
      // Real TO-220 SCR pinout (TYN612, BT151, etc.): Cathode, Anode, Gate
      // Matches datasheet front-view order (leads down, marking facing you)
      return { kind, pins: ["k", "a", "g"] };
    }
    if (kind === "triac") {
      // TRIAC: MT1, gate, MT2 (gate referenced to MT1)
      return { kind, pins: ["mt1", "g", "mt2"] };
    }
    if (kind === "speaker") {
      return { kind, pins: ["a", "b"] };
    }
    if (kind === "mcu") {
      return {
        kind,
        pins: [
          "vcc",
          "gnd",
          "3v3",
          "d0",
          "d1",
          "d2",
          "d3",
          "d4",
          "d5",
          "d6",
          "d7",
          "d8",
          "d9",
          "d10",
          "d11",
          "d12",
          "d13",
          "a0",
          "a1",
          "a2",
          "a3",
          "a4",
          "a5",
        ],
      };
    }
    // All other two-terminal parts (resistor, switch, button, capacitor, …)
    return { kind, pins: ["a", "b"] };
  }

  if (tool === "pot") return { kind: "pot" as const, pins: ["a", "w", "b"] };
  if (tool === "relay") {
    return { kind: "relay" as const, pins: ["coilA", "coilB", "com", "no"] };
  }

  return null;
}

/** Default Arduino sketch (matches auto-wire pin map below). */
export const DEFAULT_MCU_CODE = `#include <LiquidCrystal.h>

// RS, E, D4, D5, D6, D7
LiquidCrystal lcd(12, 11, 5, 4, 3, 2);

void setup() {
  lcd.begin(16, 2);
  lcd.print("Hello, world!");
}

void loop() {
}
`;

/**
 * Wire MCU ↔ LCD to match LiquidCrystal lcd(12, 11, 5, 4, 3, 2)
 * plus power / backlight / RW→GND.
 */
function autoWireMcuLcd(
  mcu: PlacedPart,
  lcd: PlacedPart,
  existing: Wire[],
): Wire[] {
  const pairs: Array<{
    a?: HoleId;
    b?: HoleId;
    color: WireColor;
  }> = [
    { a: mcu.pins.d12, b: lcd.pins.rs, color: "blue" },
    { a: mcu.pins.d11, b: lcd.pins.e, color: "blue" },
    { a: mcu.pins.d5, b: lcd.pins.d4, color: "green" },
    { a: mcu.pins.d4, b: lcd.pins.d5, color: "green" },
    { a: mcu.pins.d3, b: lcd.pins.d6, color: "green" },
    { a: mcu.pins.d2, b: lcd.pins.d7, color: "green" },
    // LCD power comes from the Arduino power header, not directly from the
    // bench PSU. The Arduino's VCC/5V rail is the source seen by the LCD.
    { a: mcu.pins.vcc, b: lcd.pins.vdd, color: "red" },
    { a: mcu.pins.gnd, b: lcd.pins.vss, color: "black" },
    { a: mcu.pins.gnd, b: lcd.pins.rw, color: "black" },
    { a: mcu.pins.vcc, b: lcd.pins.a, color: "orange" },
    { a: mcu.pins.gnd, b: lcd.pins.k, color: "black" },
  ];

  const wires = [...existing];
  const hasLink = (a: HoleId, b: HoleId) =>
    wires.some(
      (w) =>
        (w.a === a && w.b === b) || (w.a === b && w.b === a),
    );

  for (const { a, b, color } of pairs) {
    if (!a || !b) continue;
    if (a === b) continue;
    if (hasLink(a, b)) continue;
    wires.push({ id: uid("wire"), a, b, color });
  }
  return wires;
}


function autoWireMcuOled(
  mcu: PlacedPart,
  oled: PlacedPart,
  existing: Wire[],
): Wire[] {
  // Uno I2C: SDA = A4, SCL = A5
  const pairs: Array<{ a?: string; b?: string; color: WireColor }> = [
    { a: mcu.pins["3v3"], b: oled.pins.vcc, color: "red" },
    { a: mcu.pins.gnd, b: oled.pins.gnd, color: "black" },
    { a: mcu.pins.a4 ?? mcu.pins.sda, b: oled.pins.sda, color: "blue" },
    { a: mcu.pins.a5 ?? mcu.pins.scl, b: oled.pins.scl, color: "yellow" },
  ];
  const wires = [...existing];
  const hasLink = (a: string, b: string) =>
    wires.some((w) => (w.a === a && w.b === b) || (w.a === b && w.b === a));
  for (const { a, b, color } of pairs) {
    if (!a || !b || a === b || hasLink(a, b)) continue;
    wires.push({ id: uid("wire"), a, b, color });
  }
  return wires;
}


/** Default bench rails when the user has not clipped the PSU yet. */
function defaultPowerRails(): { pos: HoleId; neg: HoleId } {
  if (!BOARD.hasRails) {
    return { pos: "A1", neg: "J1" };
  }
  if (BOARD.presetId === "full-1660") {
    return { pos: "otp1", neg: "otn1" };
  }
  return { pos: "tp1", neg: "tn1" };
}

/**
 * Ensure PSU clips exist and MCU VCC/GND (and LCD/OLED power) reach them.
 */
function ensurePowerWiring(
  state: {
    parts: PlacedPart[];
    wires: Wire[];
    psuPositive: HoleId | null;
    psuNegative: HoleId | null;
  },
): {
  wires: Wire[];
  psuPositive: HoleId;
  psuNegative: HoleId;
} {
  const rails = defaultPowerRails();
  const psuPositive = state.psuPositive ?? rails.pos;
  const psuNegative = state.psuNegative ?? rails.neg;
  let wires = [...state.wires];

  // Migration/safety cleanup for circuits created by older simulator builds.
  // Older builds wired LCD/OLED power directly to the bench PSU. Remove those
  // exact display-to-PSU links so the displays are now powered only through
  // the Arduino power outputs. Manual signal wiring is left untouched.
  const displayPowerPins = new Set<HoleId>();
  for (const part of state.parts) {
    if (part.kind === "lcd") {
      for (const pin of [part.pins.vdd, part.pins.a]) {
        if (pin) displayPowerPins.add(pin);
      }
      for (const pin of [part.pins.vss, part.pins.k]) {
        if (pin) displayPowerPins.add(pin);
      }
    }
    if (part.kind === "oled") {
      if (part.pins.vcc) displayPowerPins.add(part.pins.vcc);
      if (part.pins.gnd) displayPowerPins.add(part.pins.gnd);
    }
  }

  wires = wires.filter((w) => {
    const directDisplayPsuLink =
      (w.a === psuPositive || w.a === psuNegative ||
        w.b === psuPositive || w.b === psuNegative) &&
      (displayPowerPins.has(w.a) || displayPowerPins.has(w.b));
    return !directDisplayPsuLink;
  });

  const hasLink = (a: HoleId, b: HoleId) =>
    wires.some(
      (w) => (w.a === a && w.b === b) || (w.a === b && w.b === a),
    );
  const link = (a: HoleId | undefined, b: HoleId | undefined, color: WireColor) => {
    if (!a || !b || a === b || hasLink(a, b)) return;
    wires.push({ id: uid("wire"), a, b, color });
  };

  if (BOARD.hasRails) {
    // Bridge adjacent rail segments so a single bus is continuous when the
    // physical board has a break (e.g. standard-830 has two 25-hole segments).
    // For continuous rails (mb-102, segment === railHoles) this is a no-op.
    const seg = Math.max(1, BOARD.railSegment);
    const midCol = Math.min(BOARD.railHoles, seg + 1);

    if (BOARD.presetId === "full-1660") {
      // Positive rails (red): otp, itp, ibp, obp
      for (const prefix of ["otp", "itp", "ibp", "obp"] as const) {
        if (midCol > 1 && midCol <= BOARD.railHoles) {
          link(`${prefix}1` as HoleId, `${prefix}${midCol}` as HoleId, "red");
        }
      }
      // Negative rails (black): otn, itn, ibn, obn
      for (const prefix of ["otn", "itn", "ibn", "obn"] as const) {
        if (midCol > 1 && midCol <= BOARD.railHoles) {
          link(`${prefix}1` as HoleId, `${prefix}${midCol}` as HoleId, "black");
        }
      }
      // Optionally tie outer top ↔ outer bottom positives/negatives for a
      // single bench bus (user can still cut the wire if they want isolation).
      link("otp1", "obp1", "red");
      link("otn1", "obn1", "black");
    } else {
      for (const prefix of ["tp", "bp"] as const) {
        if (midCol > 1 && midCol <= BOARD.railHoles) {
          link(`${prefix}1` as HoleId, `${prefix}${midCol}` as HoleId, "red");
        }
      }
      for (const prefix of ["tn", "bn"] as const) {
        if (midCol > 1 && midCol <= BOARD.railHoles) {
          link(`${prefix}1` as HoleId, `${prefix}${midCol}` as HoleId, "black");
        }
      }
      // Top ↔ bottom buses share the same net by default
      link("tn1", "bn1", "black");
      link("tp1", "bp1", "red");
    }
  }

  for (const part of state.parts) {
    if (part.kind === "mcu") {
      link(part.pins.vcc, psuPositive, "red");
      link(part.pins.gnd, psuNegative, "black");
    }
    if (part.kind === "lcd") {
      // IMPORTANT: LCD power is supplied by the Arduino, not by the bench
      // PSU directly. The Arduino VCC/5V pin is already connected to the PSU
      // input above, so the LCD receives power through the MCU power rail.
      // This models the real wiring and prevents the LCD from being treated
      // as an independent PSU load/short.
      const mcu = state.parts.find((p) => p.kind === "mcu");
      link(mcu?.pins.vcc, part.pins.vdd, "red");
      link(mcu?.pins.gnd, part.pins.vss, "black");
      link(mcu?.pins.gnd, part.pins.rw, "black");
      link(mcu?.pins.vcc, part.pins.a, "orange");
      link(mcu?.pins.gnd, part.pins.k, "black");
    }
    if (part.kind === "oled") {
      // OLED power also comes from the Arduino, specifically its regulated
      // 3.3 V output. Never connect the OLED directly to the bench PSU.
      const mcu = state.parts.find((p) => p.kind === "mcu");
      link(mcu?.pins["3v3"], part.pins.vcc, "red");
      link(mcu?.pins.gnd, part.pins.gnd, "black");
    }
  }

  return { wires, psuPositive, psuNegative };
}

export const useLab = create<LabState>((set, get) => ({

  tool: "select",

  wireColor: "red",

  resistorValue: 1000,
  transistorModel: "2n3904",
  thyristorModel: "2n5060",
  triacModel: "bt136",
  diacModel: "db3",
  motorModel: "5v",

  // Default capacitor = 10 µF
  capacitorValue: 10e-6,

  ledColor: "red",

  pendingHole: null,

  pendingHoles: [],

  hoverHole: null,

  selectedId: null,

  probeHole: null,

  pinEditTarget: null,

  movingSelected: false,

  paletteDragging: false,

  partDragEnabled: true,

  parts: initialPreset.parts,

  wires: initialPreset.wires,

  powerOn: true,

  psuVoltage: 5,

  psuPositive: "tp1",

  psuNegative: "tn1",

  sim: simulate({
    parts: initialPreset.parts,

    wires: initialPreset.wires,

    powerOn: true,

    psuVoltage: 5,

    psuPositive: "tp1",

    psuNegative: "tn1",
  }),

  labId: initialPreset.id,

  boardId: "standard-830",

  history: [],

  future: [],

  setBoard: (id) => {
  const state = get();

  // Do nothing if the selected board is already active.
  if (id === state.boardId) return;

  const currentBoard =
    BOARD_PRESETS.find((p) => p.id === state.boardId)?.label ??
    "current breadboard";

  const newBoard =
    BOARD_PRESETS.find((p) => p.id === id)?.label ??
    "new breadboard";

  const confirmed = window.confirm(
    `Change breadboard?\n\n` +
      `Changing from ${currentBoard} to ${newBoard} will clear the entire breadboard, including all components and wires.\n\n` +
      `Do you want to continue?`,
  );

  if (!confirmed) return;

  setBoardPreset(id);

  set({
    boardId: id,

    // CLEAR THE CIRCUIT
    parts: [],
    wires: [],

    // CLEAR POWER CONNECTIONS
    psuPositive: null,
    psuNegative: null,

    // CLEAR PLACEMENT / SELECTION
    pendingHole: null,
    pendingHoles: [],
    selectedId: null,
    probeHole: null,
    hoverHole: null,

    // CLEAR UNDO / REDO so old boards cannot be restored onto the new layout
    history: [],
    future: [],

    // RESET SIMULATION
    powerOn: false,
    sim: simulate({
      parts: [],
      wires: [],
      powerOn: false,
      psuVoltage: get().psuVoltage,
      psuPositive: null,
      psuNegative: null,
    }),
  });
},

  setPaletteDragging: (active) => set({ paletteDragging: active }),

  setPartDragEnabled: (enabled) =>
    set({
      partDragEnabled: enabled,
      // Switching modes cancels in-progress move / pin picks.
      movingSelected: false,
      pinEditTarget: null,
      pendingHole: null,
      pendingHoles: [],
    }),

  placePartAt: (tool, anchor, explicitPins) => {
    const state = get();
    const placement = getPlacement(tool);
    if (!placement) return;

    // Dedupe: drag-drop + hole-click (or double pointerup) often fire together.
    // Block any second place of the same tool within 500ms, even on a nearby hole.
    // Skip dedupe when the user is placing pin-by-pin with explicit holes.
    if (!explicitPins) {
      const now = Date.now();
      const key = `${tool}:${anchor}`;
      if (
        now - _lastPlace.at < 500 &&
        (_lastPlace.key === key || _lastPlace.tool === tool)
      ) {
        return;
      }
      _lastPlace = { key, at: now, tool };
      _suppressHolePlaceUntil = now + 500;
    }

    let pins: Record<string, HoleId>;
    let holes: HoleId[];

    if (explicitPins) {
      pins = explicitPins;
      holes = placement.pins
        .map((name) => explicitPins[name])
        .filter(Boolean) as HoleId[];
    } else {
      const pinResult = computePinLayout(tool, anchor);
      if (!pinResult) return;
      pins = pinResult.pins;
      holes = pinResult.holes;
    }

    if (placement.kind === "wire") {
      const [a, b] = holes;
      if (!a || !b || a === b || holeStrip(a) === holeStrip(b)) return;
      const wire: Wire = {
        id: uid("wire"),
        a,
        b,
        color: state.wireColor,
      };
      const wires = [...state.wires, wire];
      const next = { ...state, wires };
      set({
        wires,
        pendingHole: null,
        pendingHoles: [],
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
        tool: "select",
      });
      return;
    }

    const part: PlacedPart = {
      id: uid(placement.kind),
      kind: placement.kind,
      pins,
      props: {
        resistance:
          placement.kind === "resistor" || placement.kind === "pot"
            ? state.resistorValue
            : undefined,
        capacitance:
          placement.kind === "capacitor" ? state.capacitorValue : undefined,
        tolerance: placement.kind === "resistor" ? 5 : undefined,
        powerRating: placement.kind === "resistor" || placement.kind === "pot" ? 0.25 : undefined,
        voltageRating:
          placement.kind === "resistor" ? 200 :
          placement.kind === "capacitor" ? 16 :
          placement.kind === "led" ? 5 :
          placement.kind === "diode" ? 50 : undefined,
        maxCurrent:
          placement.kind === "led" ? 0.02 :
          placement.kind === "diode" ? 1 : undefined,
        forwardVoltage:
          placement.kind === "led"
            ? ({ red: 1.9, green: 2.2, yellow: 2.1, blue: 3.0 } as const)[state.ledColor]
            : undefined,
        capacitorType: placement.kind === "capacitor" ? "ceramic" : undefined,
        diodeType: placement.kind === "diode" ? "silicon" : undefined,
        package: placement.kind === "resistor" ? "axial" : undefined,
        ledColor: placement.kind === "led" ? state.ledColor : undefined,
        closed:
          placement.kind === "switch" || placement.kind === "button"
            ? false
            : undefined,
        mcuModel: placement.kind === "mcu" ? "arduino-uno" : undefined,
        code: placement.kind === "mcu" ? DEFAULT_MCU_CODE : undefined,
        transistorModel:
          placement.kind === "transistor" ? state.transistorModel : undefined,
        thyristorModel:
          placement.kind === "thyristor" ? state.thyristorModel : undefined,
        triacModel:
          placement.kind === "triac" ? state.triacModel : undefined,
        diacModel:
          placement.kind === "diac" ? state.diacModel : undefined,
        motorModel:
          placement.kind === "motor" ? state.motorModel : undefined,
        label:
          placement.kind === "diode"
            ? "D1"
            : placement.kind === "relay"
              ? "K1"
              : placement.kind === "buzzer"
                ? "BZ1"
                : placement.kind === "lcd"
                  ? "LCD 16x2"
                  : placement.kind === "oled"
                    ? "OLED 128x64"
                    : placement.kind === "transistor"
                      ? state.transistorModel.toUpperCase()
                      : placement.kind === "thyristor"
                        ? state.thyristorModel.toUpperCase()
                        : placement.kind === "triac"
                          ? state.triacModel.toUpperCase()
                          : placement.kind === "diac"
                            ? state.diacModel.toUpperCase()
                            : placement.kind === "motor"
                              ? (MOTOR_MODELS[state.motorModel]?.label ?? "Motor")
                              : placement.kind === "speaker"
                                ? "Speaker"
                                : placement.kind === "mcu"
                                  ? "Arduino Uno"
                                  : undefined,
      },
    };

    let parts = [...state.parts, part];
    let wires = state.wires;

    // Auto-connect MCU ↔ LCD / OLED when both are on the board.
    if (
      placement.kind === "mcu" ||
      placement.kind === "lcd" ||
      placement.kind === "oled"
    ) {
      const mcu =
        placement.kind === "mcu"
          ? part
          : parts.find((p) => p.kind === "mcu");
      const lcd =
        placement.kind === "lcd"
          ? part
          : parts.find((p) => p.kind === "lcd");
      const oled =
        placement.kind === "oled"
          ? part
          : parts.find((p) => p.kind === "oled");
      if (mcu && lcd) {
        wires = autoWireMcuLcd(mcu, lcd, wires);
      }
      if (mcu && oled) {
        wires = autoWireMcuOled(mcu, oled, wires);
      }
    }

    const powered = ensurePowerWiring({
      parts,
      wires,
      psuPositive: state.psuPositive,
      psuNegative: state.psuNegative,
    });
    wires = powered.wires;

    const next = {
      ...state,
      parts,
      wires,
      psuPositive: powered.psuPositive,
      psuNegative: powered.psuNegative,
    };
    set({
      parts,
      wires,
      psuPositive: powered.psuPositive,
      psuNegative: powered.psuNegative,
      pendingHole: null,
      pendingHoles: [],
      hoverHole: null,
      selectedId: part.id,
      sim: runSimulation(next),
      history: [...state.history, snapshot(state)],
      future: [],
      tool: "select",
    });
  },

  setTool: (tool) =>
    set((state) => ({
      tool,
      pendingHole: null,
      pendingHoles: [],
      pinEditTarget: null,
      movingSelected: false,
      // Idle tool clears selection so nothing stays highlighted
      ...(tool === "none" ? { selectedId: null as string | null } : {}),
    })),

  setWireColor: (wireColor) =>
    set((state) => {
      const selectedWire = state.wires.some(
        (wire) => wire.id === state.selectedId
      );

      if (!selectedWire) {
        return { wireColor };
      }

      const wires = state.wires.map((wire) =>
        wire.id === state.selectedId
          ? { ...wire, color: wireColor }
          : wire
      );

      const next = {
        ...state,
        wireColor,
        wires,
      };

      return {
        wireColor,
        wires,
        sim: runSimulation(next),
        history: [
          ...state.history,
          snapshot(state),
        ],
        future: [],
      };
    }),

  setResistorValue: (resistorValue) =>
    set({
      resistorValue,
    }),

  setTransistorModel: (transistorModel) =>
    set({
      transistorModel,
    }),

  setSelectedTransistorModel: (transistorModel) =>
    set((state) => {
      if (!state.selectedId) {
        return { transistorModel };
      }
      const parts = state.parts.map((part) => {
        if (part.id !== state.selectedId || part.kind !== "transistor") {
          return part;
        }
        return {
          ...part,
          props: {
            ...part.props,
            transistorModel,
            label: transistorModel.toUpperCase(),
          },
        };
      });
      const next = { ...state, parts, transistorModel };
      return {
        parts,
        transistorModel,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setThyristorModel: (thyristorModel) =>
    set({
      thyristorModel,
    }),

  setSelectedThyristorModel: (thyristorModel) =>
    set((state) => {
      if (!state.selectedId) {
        return { thyristorModel };
      }
      const parts = state.parts.map((part) => {
        if (part.id !== state.selectedId || part.kind !== "thyristor") {
          return part;
        }
        return {
          ...part,
          props: {
            ...part.props,
            thyristorModel,
            label: thyristorModel.toUpperCase(),
          },
        };
      });
      const next = { ...state, parts, thyristorModel };
      return {
        parts,
        thyristorModel,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setTriacModel: (triacModel) =>
    set({
      triacModel,
    }),

  setSelectedTriacModel: (triacModel) =>
    set((state) => {
      if (!state.selectedId) {
        return { triacModel };
      }
      const parts = state.parts.map((part) => {
        if (part.id !== state.selectedId || part.kind !== "triac") {
          return part;
        }
        return {
          ...part,
          props: {
            ...part.props,
            triacModel,
            label: triacModel.toUpperCase(),
          },
        };
      });
      const next = { ...state, parts, triacModel };
      return {
        parts,
        triacModel,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setDiacModel: (diacModel) =>
    set({
      diacModel,
    }),

  setSelectedDiacModel: (diacModel) =>
    set((state) => {
      if (!state.selectedId) {
        return { diacModel };
      }
      const parts = state.parts.map((part) => {
        if (part.id !== state.selectedId || part.kind !== "diac") {
          return part;
        }
        return {
          ...part,
          props: {
            ...part.props,
            diacModel,
            label: diacModel.toUpperCase(),
          },
        };
      });
      const next = { ...state, parts, diacModel };
      return {
        parts,
        diacModel,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setMotorModel: (motorModel) =>
    set({
      motorModel,
    }),

  setSelectedMotorModel: (motorModel) =>
    set((state) => {
      if (!state.selectedId) {
        return { motorModel };
      }
      const parts = state.parts.map((part) => {
        if (part.id !== state.selectedId || part.kind !== "motor") {
          return part;
        }
        const info = MOTOR_MODELS[motorModel];
        return {
          ...part,
          props: {
            ...part.props,
            motorModel,
            label: info?.label ?? part.props.label ?? "Motor",
          },
        };
      });
      const next = { ...state, parts, motorModel };
      return {
        parts,
        motorModel,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setCapacitorValue: (capacitorValue) =>
    set({
      capacitorValue,
    }),

  setLedColor: (ledColor) =>
    set({
      ledColor,
    }),

  setHover: (hoverHole) =>
    set({
      hoverHole,
    }),

  resetPending: () =>
    set({
      pendingHole: null,
      pendingHoles: [],
    }),

  select: (selectedId) =>
    set((state) => {
      // Delete tool: clicking a part or wire removes it immediately.
      if (state.tool === "delete" && selectedId) {
        const parts = state.parts.filter((p) => p.id !== selectedId);
        const wires = state.wires.filter((w) => w.id !== selectedId);
        const next = {
          ...state,
          parts,
          wires,
          selectedId: null,
          pendingHole: null,
          pendingHoles: [] as HoleId[],
        };
        return {
          parts,
          wires,
          selectedId: null,
          pendingHole: null,
          pendingHoles: [],
          pinEditTarget: null,
          movingSelected: false,
          sim: runSimulation(next),
          history: [...state.history, snapshot(state)],
          future: [],
        };
      }

      // Select mode OFF ("none") or another placement tool: do not change selection.
      // Explicit clear (null) is still allowed so deselect-on-background works when needed.
      if (
        selectedId != null &&
        state.tool !== "select" &&
        state.tool !== "probe"
      ) {
        return {};
      }

      return {
        selectedId,
        pendingHole: null,
        pendingHoles: [],
        // Switching selection cancels in-progress pin edit / move.
        pinEditTarget:
          selectedId && state.pinEditTarget?.partId === selectedId
            ? state.pinEditTarget
            : null,
        movingSelected:
          selectedId != null && state.movingSelected ? true : false,
      };
    }),

  togglePower: () =>
    set((state) => {
      const powerOn = !state.powerOn;
      const powered = ensurePowerWiring(state);
      const next = {
        ...state,
        powerOn,
        wires: powered.wires,
        psuPositive: powered.psuPositive,
        psuNegative: powered.psuNegative,
      };

      return {
        powerOn,
        wires: powered.wires,
        psuPositive: powered.psuPositive,
        psuNegative: powered.psuNegative,
        sim: runSimulation(next),
      };
    }),

  /**
   * Explicit "Run Simulation": force power ON, ensure PSU clips wired,
   * and recompute the nodal solution so results/UI stay in sync.
   */
  runNow: () =>
    set((state) => {
      const powered = ensurePowerWiring(state);
      const next = {
        ...state,
        powerOn: true,
        wires: powered.wires,
        psuPositive: powered.psuPositive,
        psuNegative: powered.psuNegative,
      };
      return {
        powerOn: true,
        wires: powered.wires,
        psuPositive: powered.psuPositive,
        psuNegative: powered.psuNegative,
        sim: runSimulation(next),
      };
    }),

  setVoltage: (psuVoltage) =>
    set((state) => {
      const next = {
        ...state,
        psuVoltage,
      };

      return {
        psuVoltage,
        sim: runSimulation(next),
      };
    }),

  setSelectedResistance: (resistance) =>
    set((state) => {
      if (!state.selectedId) return state;

      const parts = state.parts.map((part) => {
        if (
          part.id !== state.selectedId ||
          (part.kind !== "resistor" && part.kind !== "pot")
        ) {
          return part;
        }

        return {
          ...part,
          props: {
            ...part.props,
            resistance,
          },
        };
      });

      const next = {
        ...state,
        parts,
      };

      return {
        parts,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setSelectedProp: (key, value) =>
    set((state) => {
      if (!state.selectedId) return state;
      const parts = state.parts.map((part) =>
        part.id === state.selectedId
          ? { ...part, props: { ...part.props, [key]: value } }
          : part
      );
      const next = { ...state, parts };
      return {
        parts,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

setSelectedCapacitance: (capacitance) =>
  set((state) => {
    if (!state.selectedId) {
      return state;
    }

    const parts = state.parts.map((part) => {
      if (
        part.id !== state.selectedId ||
        part.kind !== "capacitor"
      ) {
        return part;
      }

      return {
        ...part,
        props: {
          ...part.props,
          capacitance,
        },
      };
    });

    const next = {
      ...state,
      parts,
    };

    return {
      parts,
      sim: runSimulation(next),
      history: [
        ...state.history,
        snapshot(state),
      ],
      future: [],
    };
  }),

  setSelectedLedColor: (ledColor) =>
    set((state) => {
      if (!state.selectedId) return state;

      const parts = state.parts.map((part) => {
        if (
          part.id !== state.selectedId ||
          part.kind !== "led"
        ) {
          return part;
        }

        return {
          ...part,
          props: {
            ...part.props,
            ledColor,
          },
        };
      });

      const next = {
        ...state,
        parts,
      };

      return {
        parts,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setSelectedLabel: (label) =>
    set((state) => {
      if (!state.selectedId) return state;

      const parts = state.parts.map((part) =>
        part.id === state.selectedId
          ? {
              ...part,
              props: {
                ...part.props,
                label,
              },
            }
          : part
      );

      return {
        parts,
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setSelectedCode: (code) =>
    set((state) => {
      if (!state.selectedId) return state;
      const parts = state.parts.map((part) => {
        if (part.id !== state.selectedId || part.kind !== "mcu") {
          return part;
        }
        return {
          ...part,
          props: {
            ...part.props,
            code,
          },
        };
      });
      const next = { ...state, parts };
      return {
        parts,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setMcuCode: (id, code) =>
    set((state) => {
      const parts = state.parts.map((part) => {
        if (part.id !== id || part.kind !== "mcu") return part;
        return {
          ...part,
          props: { ...part.props, code },
        };
      });
      const powered = ensurePowerWiring({
        parts,
        wires: state.wires,
        psuPositive: state.psuPositive,
        psuNegative: state.psuNegative,
      });
      const next = {
        ...state,
        parts,
        wires: powered.wires,
        psuPositive: powered.psuPositive,
        psuNegative: powered.psuNegative,
      };
      return {
        parts,
        wires: powered.wires,
        psuPositive: powered.psuPositive,
        psuNegative: powered.psuNegative,
        selectedId: id,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  toggleSwitch: (id) =>
    set((state) => {
      // Toggle only for maintained switches — not momentary buttons.
      const parts = state.parts.map((part) => {
        if (part.id !== id || part.kind !== "switch") {
          return part;
        }

        return {
          ...part,
          props: {
            ...part.props,
            closed: !part.props.closed,
          },
        };
      });

      const next = {
        ...state,
        parts,
      };

      return {
        parts,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setButtonPressed: (id, pressed) =>
    set((state) => {
      const parts = state.parts.map((part) => {
        if (part.id !== id || part.kind !== "button") {
          return part;
        }
        if (Boolean(part.props.closed) === pressed) {
          return part;
        }
        return {
          ...part,
          props: {
            ...part.props,
            closed: pressed,
          },
        };
      });
      const next = { ...state, parts };
      return {
        parts,
        sim: runSimulation(next),
        // No history for momentary press/release — avoids undo spam
      };
    }),

  loadPreset: (preset) =>
    set((state) => {
      const next = {
        ...state,

        parts: preset.parts.map((p) => ({
          ...p,
          pins: { ...p.pins },
          props: { ...p.props },
        })),

        wires: preset.wires.map((w) => ({ ...w })),

        psuPositive: preset.psuPositive,

        psuNegative: preset.psuNegative,

        labId: preset.id,

        pendingHole: null,

        pendingHoles: [],

        selectedId: null,

        probeHole: null,
      };

      return {
        ...next,

        sim: runSimulation(next),

        history: [
          ...state.history,
          snapshot(state),
        ],

        future: [],
      };
    }),

  loadCircuit: (circuit) =>
    set((state) => {
      if (circuit.boardId && circuit.boardId !== state.boardId) {
        setBoardPreset(circuit.boardId);
      }
      const next = {
        ...state,
        boardId: circuit.boardId ?? state.boardId,
        psuVoltage: circuit.psuVoltage ?? state.psuVoltage,
        psuPositive: circuit.psuPositive,
        psuNegative: circuit.psuNegative,
        parts: circuit.parts.map((p) => ({
          ...p,
          pins: { ...p.pins },
          props: { ...p.props },
        })),
        wires: circuit.wires.map((w) => ({ ...w })),
        powerOn: false,
        pendingHole: null,
        pendingHoles: [] as HoleId[],
        selectedId: null,
        probeHole: null,
        history: [] as LabSnapshot[],
        future: [] as LabSnapshot[],
        labId: "project",
      };
      return {
        ...next,
        sim: runSimulation(next),
      };
    }),

  getCircuitSnapshot: () => {
    const s = get();
    return {
      boardId: s.boardId,
      psuVoltage: s.psuVoltage,
      psuPositive: s.psuPositive,
      psuNegative: s.psuNegative,
      parts: s.parts.map((p) => ({
        ...p,
        pins: { ...p.pins },
        props: { ...p.props },
      })),
      wires: s.wires.map((w) => ({ ...w })),
    };
  },

  clearBoard: () =>
    set((state) => {
      const next = {
        ...state,

        parts: [],

        wires: [],

        psuPositive: null,

        psuNegative: null,

        pendingHole: null,

        pendingHoles: [],

        selectedId: null,

        probeHole: null,

        labId: "free",
      };

      return {
        ...next,

        sim: runSimulation(next),

        history: [
          ...state.history,
          snapshot(state),
        ],

        future: [],
      };
    }),

  deleteSelected: () =>
    set((state) => {
      if (!state.selectedId) return state;

      const parts = state.parts.filter(
        (part) => part.id !== state.selectedId
      );

      const wires = state.wires.filter(
        (wire) => wire.id !== state.selectedId
      );

      const next = {
        ...state,
        parts,
        wires,
        selectedId: null,
      };

      return {
        parts,
        wires,
        selectedId: null,

        sim: runSimulation(next),

        history: [
          ...state.history,
          snapshot(state),
        ],

        future: [],
      };
    }),

  rotateSelected: () =>
    set((state) => {
      if (!state.selectedId) return state;
      const part = state.parts.find((p) => p.id === state.selectedId);
      if (!part) return state;

      const newPins = rotatePins90Clockwise(part.pins);
      if (!newPins) return state;

      const nextRotation = ((Number(part.props.rotation) || 0) + 90) % 360;

      const parts = state.parts.map((p) =>
        p.id === part.id
          ? {
              ...p,
              pins: newPins,
              props: {
                ...p.props,
                rotation: nextRotation,
              },
            }
          : p,
      );

      const next = { ...state, parts };
      return {
        parts,
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setMovingSelected: (active) =>
    set({
      movingSelected: active,
      pinEditTarget: null,
      tool: active ? "select" : get().tool,
    }),

  moveSelectedTo: (anchor) => {
    const state = get();
    if (!state.selectedId) return;
    const part = state.parts.find((p) => p.id === state.selectedId);
    if (!part) return;

    const newPins = reanchorPartPins(part, anchor);
    if (!newPins) return;

    // Keep props (including rotation) so orientation survives the move.
    const parts = state.parts.map((p) =>
      p.id === part.id
        ? {
            ...p,
            pins: newPins,
            props: { ...p.props },
          }
        : p,
    );
    const next = { ...state, parts };
    set({
      parts,
      movingSelected: false,
      pinEditTarget: null,
      selectedId: part.id,
      sim: runSimulation(next),
      history: [...state.history, snapshot(state)],
      future: [],
    });
  },

  startPinEdit: (partId, pinName) =>
    set({
      pinEditTarget: { partId, pinName },
      movingSelected: false,
      selectedId: partId,
      tool: "select",
    }),

  cancelPinEdit: () => set({ pinEditTarget: null }),

  setPartPin: (partId, pinName, hole) => {
    const state = get();
    const part = state.parts.find((p) => p.id === partId);
    if (!part || !(pinName in part.pins)) return;

    const parts = state.parts.map((p) =>
      p.id === partId
        ? { ...p, pins: { ...p.pins, [pinName]: hole } }
        : p,
    );
    const next = { ...state, parts };
    set({
      parts,
      pinEditTarget: null,
      sim: runSimulation(next),
      history: [...state.history, snapshot(state)],
      future: [],
    });
  },

  undo: () =>
    set((state) => {
      const previous =
        state.history[state.history.length - 1];

      if (!previous) return state;

      const next = {
        ...state,
        ...previous,
      };

      return {
        ...previous,

        sim: runSimulation(next),

        history: state.history.slice(0, -1),

        future: [
          snapshot(state),
          ...state.future,
        ],

        pendingHole: null,
        pendingHoles: [],
      };
    }),

  redo: () =>
    set((state) => {
      const nextHistory = state.future[0];

      if (!nextHistory) return state;

      const next = {
        ...state,
        ...nextHistory,
      };

      return {
        ...nextHistory,

        sim: runSimulation(next),

        history: [
          ...state.history,
          snapshot(state),
        ],

        future: state.future.slice(1),

        pendingHole: null,
        pendingHoles: [],
      };
    }),

  clickHole: (hole) => {
    const state = get();

    /*
     * PIN EDIT — reassign a single node of the selected (or targeted) part.
     */
    if (state.pinEditTarget) {
      const { partId, pinName } = state.pinEditTarget;
      get().setPartPin(partId, pinName, hole);
      return;
    }

    /*
     * MOVE SELECTED — re-anchor the whole footprint at this hole.
     */
    if (state.movingSelected && state.selectedId) {
      get().moveSelectedTo(hole);
      return;
    }

    /*
     * VOLTMETER
     */
    if (state.tool === "probe") {
      set({
        probeHole: hole,
        selectedId: null,
        pendingHole: null,
        pendingHoles: [],
      });

      return;
    }

    /*
     * POWER SUPPLY POSITIVE
     */
    if (state.tool === "psu-positive") {
      const next = {
        ...state,
        psuPositive: hole,
      };

      set({
        psuPositive: hole,

        sim: runSimulation(next),

        pendingHole: null,

        pendingHoles: [],

        tool: "select",

        history: [
          ...state.history,
          snapshot(state),
        ],

        future: [],
      });

      return;
    }

    /*
     * POWER SUPPLY NEGATIVE
     */
    if (state.tool === "psu-negative") {
      const next = {
        ...state,
        psuNegative: hole,
      };

      set({
        psuNegative: hole,

        sim: runSimulation(next),

        pendingHole: null,

        pendingHoles: [],

        tool: "select",

        history: [
          ...state.history,
          snapshot(state),
        ],

        future: [],
      });

      return;
    }

    /*
     * SELECT / PROBE
     */
    if (state.tool === "select") {
      set({
        probeHole: hole,
        selectedId: null,
        pendingHole: null,
        pendingHoles: [],
      });

      return;
    }

    const placement = getPlacement(state.tool);
    if (!placement) return;

    // While a palette drag is in progress (or just finished), hole-click must
    // not place again — the drop handler already called placePartAt.
    if (
      placement.kind !== "wire" &&
      (state.paletteDragging || Date.now() < _suppressHolePlaceUntil)
    ) {
      return;
    }

    /*
     * WIRES always need two clicks (from → to).
     */
    if (placement.kind === "wire") {
      if (state.pendingHoles.includes(hole)) {
        set({ pendingHole: null, pendingHoles: [] });
        return;
      }

      const holes = [...state.pendingHoles, hole];
      if (holes.length < 2) {
        set({ pendingHole: holes[0], pendingHoles: holes });
        return;
      }

      const [a, b] = holes;
      if (holeStrip(a) === holeStrip(b)) {
        set({ pendingHole: null, pendingHoles: [] });
        return;
      }

      const wire: Wire = { id: uid("wire"), a, b, color: state.wireColor };
      const wires = [...state.wires, wire];
      const next = { ...state, wires };
      set({
        wires,
        pendingHole: null,
        pendingHoles: [],
        sim: runSimulation(next),
        history: [...state.history, snapshot(state)],
        future: [],
      });
      return;
    }

    /*
     * Drag OFF (classic mode): click one hole per node.
     * Example: resistor → click hole for lead A, then hole for lead B.
     */
    if (!state.partDragEnabled) {
      if (state.pendingHoles.includes(hole)) {
        // Re-clicking a chosen hole cancels the in-progress placement.
        set({ pendingHole: null, pendingHoles: [] });
        return;
      }

      const holes = [...state.pendingHoles, hole];
      const needed = placement.pins.length;

      if (holes.length < needed) {
        set({
          pendingHole: holes[0] ?? hole,
          pendingHoles: holes,
        });
        return;
      }

      const explicitPins: Record<string, HoleId> = {};
      placement.pins.forEach((name, i) => {
        explicitPins[name] = holes[i]!;
      });

      get().placePartAt(state.tool, holes[0]!, explicitPins);
      return;
    }

    // Drag ON: single-click / drag-drop places the whole footprint at once.
    get().placePartAt(state.tool, hole);
  },
}));
