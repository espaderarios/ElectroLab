import { create } from "zustand";
import {
  BOARD,
  holePosition,
  holeStrip,
  offsetHole,
  parseTerminalHole,
  setBoardPreset,
  BOARD_PRESETS,
  type BoardPresetId,
} from "@/circuit/breadboard";
import { helloWorldPreset, type LabPreset } from "@/circuit/presets";
import { componentVariantProps } from "@/circuit/component-variants";
import { expansionById } from "@/circuit/expansion-catalog";
import { LOGIC_IC_PINOUTS } from "@/circuit/logic-ics";
import { SEVEN_SEGMENT_PINS } from "@/circuit/seven-segment";
import { simulate } from "@/circuit/simulate";
import { placementIsBlocked } from "@/circuit/placement-obstacles";
import { planWireRoutes } from "@/circuit/wire-routing";
import { mcuTerminalId, terminalPosition, upgradeMcuHeaders, UNO_HEADER_NAMES } from "@/circuit/mcu-headers";
import { isControllerTool, isOffboardController, controllerPosition, constrainBenchPoint, defaultControllerPosition, moduleTerminalId, upgradeControllerHeaders, type BenchPoint } from '@/circuit/offboard-controllers';
import { autoTidyWireBundle } from "@/circuit/tidy-wires";
import type {
  HoleId,
  PartKind,
  PlacedPart,
  SimResult,
  SwitchPosition,
  ToolId,
  Wire,
  WireColor,
  WireStyle,
} from "@/circuit/types";
import { MOTOR_MODELS } from "@/circuit/types";
import { uid } from "@/lib/utils";

/**
 * Existing user projects can contain an unroutable saved wire (for example
 * from an older simulator version). A NEW part should only be rejected if it
 * introduces a NEW wire obstruction. Existing problems must not lock the
 * whole breadboard against editing.
 *
 * A route is compared by its permanent wire id, never by list position,
 * because solid/jumper tracks may be reordered by the planner.
 */
export function introducesWireObstruction(
  previousWires: readonly Wire[],
  previousParts: readonly PlacedPart[],
  nextWires: readonly Wire[],
  nextParts: readonly PlacedPart[],
): boolean {
  if (!nextWires.length) return false;
  const previouslyBlocked = new Set(
    planWireRoutes(previousWires, (id) => terminalPosition(id, previousParts), previousParts)
      .filter((route) => route.blocked)
      .map((route) => route.id),
  );
  return planWireRoutes(nextWires, (id) => terminalPosition(id, nextParts), nextParts)
    .some((route) => route.blocked && !previouslyBlocked.has(route.id));
}

/** Suppress accidental double placement from drag-drop + hole-click on the same gesture. */
let _lastPlace: { key: string; at: number; tool: string } = {
  key: "",
  at: 0,
  tool: "",
};
/** Hole clicks are ignored until this timestamp (ms). */
let _suppressHolePlaceUntil = 0;

/** Dual-inline packages that straddle the centre channel. */
const DIP_KINDS = new Set<string>([
  "not", "and", "or", "nand", "nor", "xor", "xnor", "timer555", "opamp", "seven-segment",
]);

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
  wireStyle: WireStyle;
  showWireFlow: boolean;
  focusConnections: boolean;

  resistorValue: number;
  transistorModel: import("@/circuit/types").TransistorModelId;
  thyristorModel: import("@/circuit/types").ThyristorModelId;
  triacModel: import("@/circuit/types").TriacModelId;
  diacModel: import("@/circuit/types").DiacModelId;
  motorModel: import("@/circuit/types").MotorModelId;
  capacitorValue: number;

  ledColor: NonNullable<PlacedPart["props"]["ledColor"]>;
  switchStyle: NonNullable<PlacedPart["props"]["switchStyle"]>;

  pendingHole: HoleId | null;
  pendingHoles: HoleId[];
  hoverHole: HoleId | null;
  /** Nonintrusive error/status shown after a physically invalid drop. */
  placementError: string | null;

  selectedId: string | null;
  probeHole: HoleId | null;
  /** Read-only guide highlight; this never changes circuit connectivity. */
  guideTarget: { a: HoleId; b: HoleId } | null;
  setGuideTarget: (target: { a: HoleId; b: HoleId } | null) => void;

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
    benchPosition?: BenchPoint,
  ) => void;

  /** Mark palette drag in progress so hole-click does not double-place. */
  setPaletteDragging: (active: boolean) => void;

  /** Enable / disable long-press drag-to-move for placed components. */
  setPartDragEnabled: (enabled: boolean) => void;

  setTool: (tool: ToolId) => void;
  setWireColor: (color: WireColor) => void;
  setWireStyle: (style: WireStyle) => void;
  setShowWireFlow: (enabled: boolean) => void;
  setFocusConnections: (enabled: boolean) => void;
  /** Plan a cleaner shared layout without altering wire endpoints. Undoable. */
  autoTidyWires: () => void;
  /** Preserve or release the selected wire's manually adjusted visual path. */
  setSelectedWireRouteLocked: (locked: boolean) => void;
  /** Move a selected wire's main routing corridor in board units. */
  nudgeSelectedWireLane: (axis: 'x' | 'z', delta: number) => void;

  setResistorValue: (value: number) => void;

  setLedColor: (
    color: NonNullable<PlacedPart["props"]["ledColor"]>
  ) => void;
  setSwitchStyle: (
    style: NonNullable<PlacedPart["props"]["switchStyle"]>,
  ) => void;

  setSelectedResistance: (value: number) => void;
  setSelectedProp: (key: keyof PlacedPart["props"], value: unknown) => void;
  /** Replace a blown fuse (clears its persisted blown state). */
  replaceFuse: (partId: string) => void;

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
  hoverBenchPoint: BenchPoint | null;
  setHoverBenchPoint: (point: BenchPoint | null) => void;
  dismissPlacementError: () => void;
  clickHole: (hole: HoleId) => void;
  select: (id: string | null) => void;

  togglePower: () => void;
  /** Power on + resimulate (toolbar “Run Simulation”). */
  runNow: () => void;
  /** Advance MCU/peripheral virtual time without changing the circuit topology. */
  tickSimulation: (deltaMs: number) => void;
  setVoltage: (voltage: number) => void;
  toggleSwitch: (id: string) => void;
  /** Momentary push-button: true while held, false on release. */
  setButtonPressed: (id: string, pressed: boolean) => void;
  /** Hold the physical RESET tactile on an Arduino MCU (active-low). */
  setMcuResetPressed: (id: string, pressed: boolean) => void;
  /**
   * Momentary onboard / header pin button for an MCU.
   * pin is Arduino style ("7", "d7", "D7") — forces that GPIO LOW while held
   * when the pin is an input (INPUT_PULLUP friendly).
   */
  setMcuPinButtonPressed: (
    id: string,
    pin: string,
    pressed: boolean,
  ) => void;

  deleteSelected: () => void;
  /** Rotate selected part 90° clockwise on the breadboard (pin grid + visual). */
  rotateSelected: () => void;
  /**
   * Move the selected part so its footprint is re-anchored at `anchor`
   * (same relative pin layout as when first placed).
   */
  moveSelectedTo: (anchor: HoleId, benchPosition?: BenchPoint) => void;
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

    wires: state.wires.map((w) => ({ ...w, bends: w.bends?.map(p => ({ ...p })), bendAnchors: w.bendAnchors ? { ...w.bendAnchors } : undefined })),

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
  /** Virtual MCU time advanced for this simulation pass. */
  mcuDeltaMs?: number;
  /** Hardware RESET assertion for all MCUs on this simulation step. */
  mcuReset?: boolean;
}) {
  const prevLatched: Record<string, boolean> = {};
  const prevMotorCurrents: Record<string, number> = {};
  const prevBlownFuses: Record<string, boolean> = {};
  const prevTimer555: NonNullable<SimResult["timer555s"]> = {};
  // A blown fuse stays open (even across power cycles) until it is replaced.
  for (const [id, f] of Object.entries(state.sim?.fuses ?? {})) {
    if (f.blown) prevBlownFuses[id] = true;
  }
  if (state.powerOn && state.sim) {
    Object.assign(prevTimer555, state.sim.timer555s ?? {});
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
  return simulate({
    ...state,
    prevLatched,
    prevMotorCurrents,
    prevBlownFuses,
    prevTimer555,
    mcuDeltaMs: state.mcuDeltaMs,
  });
}

function getTwoPinKind(tool: ToolId): PartKind | "wire" | null {
  if (expansionById(tool)) return "module";
  switch (tool) {
    case "wire":
      return "wire";

    case "resistor":
      return "resistor";

    case "led":
      return "led";

    case "diode":
    case "diode-schottky":
      return "diode";

    case "switch":
    case "switch-spst":
    case "switch-spdt":
    case "switch-dpst":
    case "switch-dpdt":
    case "switch-reed":
    case "switch-slide":
      return "switch";

    case "button":
    case "button-blue":
    case "button-white":
      return "button";

    case "capacitor":
    case "capacitor-electrolytic":
    case "capacitor-film":
    case "capacitor-tantalum":
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

    case "not":
      return "not";
    case "and":
      return "and";
    case "or":
      return "or";
    case "nand":
      return "nand";
    case "nor":
      return "nor";
    case "xor":
      return "xor";
    case "xnor":
      return "xnor";

    case "mosfet":
      return "mosfet";
    case "zener":
      return "zener";
    case "ldr":
      return "ldr";
    case "rgb-led":
      return "rgb-led";
    case "seven-segment":
      return "seven-segment";
    case "timer555":
      return "timer555";
    case "opamp":
      return "opamp";
    case "servo":
      return "servo";
    case "thermistor":
      return "thermistor";
    case "optocoupler":
      return "optocoupler";
    case "regulator":
      return "regulator";
    case "fuse":
    case "fuse-glass":
      return "fuse";

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

  if (isControllerTool(tool) && placement.kind === 'module') {
    const pins = Object.fromEntries(placement.pins.map(name => [name,moduleTerminalId('__preview__',name)]));
    return {holes:Object.values(pins),pins,kind:placement.kind};
  }
  const parsed = parseTerminalHole(anchor);
  if (!parsed && placement.kind !== "wire") {
    return null;
  }

  const holes: HoleId[] = [];
  if (placement.kind === "wire") {
    holes.push(anchor);
    const next = offsetHole(anchor, 1) ?? anchor;
    holes.push(next);
  } else if ((DIP_KINDS.has(placement.kind) || (placement.kind === "module" && ["dip", "header"].includes(expansionById(tool)?.footprint ?? "") && placement.pins.length % 2 === 0))) {
    // A DIP straddles the centre channel. With the package notch at the
    // left, the lower/near row is pins 1..n/2 and the upper/far row returns
    // the remaining pins from right to left, matching physical DIP numbering.
    const half = placement.pins.length / 2;
    const startCol = Math.min(Math.max(1, parsed!.col), BOARD.cols - half + 1);
    for (let i = 0; i < half; i++) {
      holes.push(`F${startCol + i}` as HoleId);
    }
    for (let i = 0; i < half; i++) {
      holes.push(`E${startCol + half - 1 - i}` as HoleId);
    }
  } else if (placement.pins.length === 2) {
    holes.push(anchor);
    // LED / diode: adjacent columns on the same row (typical breadboard span).
    // Never jump the center trench — that left the body floating mid-board
    // with no connecting leads.
    if (
      placement.kind === "led" ||
      placement.kind === "diode" ||
      placement.kind === "zener"
    ) {
      const next = offsetHole(anchor, 1) ?? offsetHole(anchor, -1) ?? anchor;
      holes.push(next);
    } else {
      // Resistors / LDR / thermistor / fuse etc.: span ~3 columns when possible.
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

  if (["not", "and", "or", "nand", "nor", "xor", "xnor"].includes(placement.kind)) {
    // Keep legacy A/B/Y aliases in sync with each IC's *real* first gate.
    // In particular, the NOR 74HC02 output is pin 1, not pin 3.
    const chip = LOGIC_IC_PINOUTS[placement.kind as keyof typeof LOGIC_IC_PINOUTS];
    const firstGate = chip.gates[0];
    pins.vcc = pins.p14;
    pins.gnd = pins.p7;
    pins.a = pins[`p${firstGate.inputs[0]}`];
    if (firstGate.inputs.length > 1) pins.b = pins[`p${firstGate.inputs[1]}`];
    pins.y = pins[`p${firstGate.output}`];
  }

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
    switchStyle?: NonNullable<PlacedPart["props"]["switchStyle"]>;
    switchType?: import("@/circuit/types").SwitchType;
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
          : kind === "ldr" || kind === "thermistor"
            ? 10000
            : kind === "fuse"
              ? 0.05
              : undefined,
      capacitance:
        kind === "capacitor" ? defaults?.capacitorValue ?? 10e-6 : undefined,
      tolerance: kind === "resistor" ? 5 : undefined,
      powerRating: kind === "resistor" || kind === "pot" ? 0.25 : undefined,
      ledColor: kind === "led" ? defaults?.ledColor ?? "red" : undefined,
      mosfetModel: kind === "mosfet" ? "2n7000" : undefined,
      zenerModel: kind === "zener" ? "5v1" : undefined,
      diodeType: kind === "zener" ? "zener" : kind === "diode" ? "silicon" : undefined,
      lightLevel: kind === "ldr" ? 0.5 : undefined,
      temperatureC: kind === "thermistor" ? 25 : undefined,
      r25: kind === "thermistor" ? 10000 : undefined,
      fuseCurrent: kind === "fuse" ? 0.5 : undefined,
      fuseBlown: kind === "fuse" ? false : undefined,
      servoAngle: kind === "servo" ? 90 : undefined,
      sevenSegCommon: kind === "seven-segment" ? "cathode" : undefined,
      rgbCommon: kind === "rgb-led" ? "cathode" : undefined,
      timer555Mode: kind === "timer555" ? "astable" : undefined,
      opampMode: kind === "opamp" ? "comparator" : undefined,
      regulatorVout: kind === "regulator" ? 5 : undefined,
      closed:
        kind === "switch" || kind === "button" ? false : undefined,
      switchType:
        kind === "switch"
          ? defaults?.switchType ?? (
              tool === "switch-spdt" ? "spdt" :
              tool === "switch-dpst" ? "dpst" :
              tool === "switch-dpdt" ? "dpdt" : "spst"
            )
          : undefined,
      switchStyle: kind === "button" ? defaults?.switchStyle ?? "tactile-black" : undefined,
      mcuModel: kind === "mcu" ? "arduino-uno" : undefined,
      headerAnchor: isControllerTool(tool) ? anchor : undefined,
      benchPosition: isControllerTool(tool) ? defaultControllerPosition(anchor,kind==='mcu'?undefined:tool) : undefined,
      transistorModel:
        kind === "transistor" ? defaults?.transistorModel : undefined,
      thyristorModel:
        kind === "thyristor" ? defaults?.thyristorModel : undefined,
      triacModel: kind === "triac" ? defaults?.triacModel : undefined,
      diacModel: kind === "diac" ? defaults?.diacModel : undefined,
      motorModel: kind === "motor" ? defaults?.motorModel : undefined,
      gateFamily:
        ["not", "and", "or", "nand", "nor", "xor", "xnor"].includes(kind)
          ? kind as PlacedPart["props"]["gateFamily"]
          : undefined,
      capacitorType: kind === "capacitor" ? "ceramic" : undefined,
      ...componentVariantProps(tool),
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
  if (isOffboardController(part)) return { ...part.pins };

  if (DIP_KINDS.has(part.kind) || (part.kind === "module" && ["dip","header"].includes(expansionById(part.props.moduleId)?.footprint ?? "") && Object.keys(part.pins).length % 2 === 0)) {
    return computePinLayout(part.kind === "module" ? (part.props.moduleId ?? "module-clock") : part.kind, anchor)?.pins ?? null;
  }

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
    id: isOffboardController(part) ? part.id : "__move_preview__",
    pins: newPins,
    props: { ...part.props, ...(isOffboardController(part) ? { benchPosition: defaultControllerPosition(anchor,part.props.moduleId) } : {}) },
  };
}

function getPlacement(tool: ToolId) {
  const expanded = expansionById(tool);
  if (expanded) return {kind: "module" as const, pins: [...expanded.pins]};
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
    if (kind === "mosfet") {
      // G, D, S — common educational breadboard order
      return { kind, pins: ["g", "d", "s"] };
    }
    if (kind === "zener") {
      return { kind, pins: ["a", "k"] };
    }
    if (kind === "ldr" || kind === "thermistor" || kind === "fuse") {
      return { kind, pins: ["a", "b"] };
    }
    if (kind === "rgb-led") {
      // Common cathode RGB: R, G, B, GND
      return { kind, pins: ["r", "g", "b", "k"] };
    }
    if (kind === "seven-segment") {
      // Physical 10-pin 5161AS/5161BS: a–g, DP and two internal COM leads.
      return { kind, pins: [...SEVEN_SEGMENT_PINS] };
    }
    if (kind === "timer555") {
      // NE555 DIP-8: 1 GND, 2 TRIG, 3 OUT, 4 RESET, 5 CONT, 6 THRES, 7 DISCH, 8 VCC
      return { kind, pins: ["gnd", "trig", "out", "reset", "cont", "thres", "disch", "vcc"] };
    }
    if (kind === "opamp") {
      // Single op-amp DIP-8 (741 / OP07 style): 1 NULL, 2 IN−, 3 IN+, 4 V−,
      // 5 NULL, 6 OUT, 7 V+, 8 NC
      return { kind, pins: ["nc1", "inn", "inp", "vee", "nc5", "out", "vcc", "nc8"] };
    }
    if (kind === "servo") {
      return { kind, pins: ["vcc", "gnd", "sig"] };
    }
    if (kind === "optocoupler") {
      // LED anode/cathode + phototransistor collector/emitter
      return { kind, pins: ["la", "lk", "c", "e"] };
    }
    if (kind === "regulator") {
      // 78xx: IN, GND, OUT
      return { kind, pins: ["in", "gnd", "out"] };
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
    if (["not", "and", "or", "nand", "nor", "xor", "xnor"].includes(kind)) {
      return {
        kind,
        pins: Array.from({ length: 14 }, (_, index) => `p${index + 1}`),
      };
    }
    if (kind === "switch") {
      switch (tool) {
        case "switch-spdt":
        case "switch-slide":
          return { kind, pins: ["no", "com", "nc"] };
        case "switch-dpst":
          return { kind, pins: ["a1", "b1", "a2", "b2"] };
        case "switch-dpdt":
          return { kind, pins: ["com1", "no1", "nc1", "com2", "no2", "nc2"] };
        default:
          return { kind, pins: ["a", "b"] };
      }
    }
    // All other two-terminal parts (resistor, button, capacitor, …)
    return { kind, pins: ["a", "b"] };
  }

  if (tool === "pot") return { kind: "pot" as const, pins: ["a", "w", "b"] };
  if (tool === "relay") {
    return { kind: "relay" as const, pins: ["coilA", "coilB", "com", "no"] };
  }

  return null;
}

/** Default Arduino sketch example for an HD44780 LCD in 4-bit mode. */
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
 * Establish bench supply clip positions, but NEVER invent or remove physical
 * wires. Even rail segment bridges must be placed explicitly by the user.
 */
function ensurePowerWiring(
  state: {
    parts: PlacedPart[];
    wires: Wire[];
    psuPositive: HoleId | null;
    psuNegative: HoleId | null;
  },
): { wires: Wire[]; psuPositive: HoleId; psuNegative: HoleId } {
  const defaults = defaultPowerRails();
  return {
    wires: [...state.wires],
    psuPositive: state.psuPositive ?? defaults.pos,
    psuNegative: state.psuNegative ?? defaults.neg,
  };
}

export const useLab = create<LabState>((set, get) => ({

  tool: "select",

  wireColor: "red",
  wireStyle: "solid",
  showWireFlow: false,
  focusConnections: false,

  resistorValue: 1000,
  transistorModel: "2n3904",
  thyristorModel: "2n5060",
  triacModel: "bt136",
  diacModel: "db3",
  motorModel: "5v",

  // Default capacitor = 10 µF
  capacitorValue: 10e-6,

  ledColor: "red",
  switchStyle: "tactile-black",

  pendingHole: null,

  pendingHoles: [],

  hoverHole: null,
  hoverBenchPoint: null,
  placementError: null,

  selectedId: null,

  probeHole: null,
  guideTarget: null,

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

  // Empty boards can change size immediately. Only warn when the user would
  // lose placed components, wires or custom PSU connections.
  const containsWork = state.parts.length > 0 || state.wires.length > 0 || Boolean(state.psuPositive || state.psuNegative);
  if (containsWork && !window.confirm(
    `Change breadboard?\n\n` +
    `Switching from ${currentBoard} to ${newBoard} will clear all placed parts, wires, and power connections.\n\n` +
    `Export a backup first if you need this layout. Continue?`,
  )) return;

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
    guideTarget: null,
    pendingHole: null,
    pendingHoles: [],
    placementError: null,
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

  setGuideTarget: (guideTarget) => set({ guideTarget }),

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

  placePartAt: (tool, anchor, explicitPins, benchPosition) => {
    const state = get();
    const placement = getPlacement(tool);
    if (!placement) return;

    // Dedupe duplicate pointer events on the *same* location only. A user
    // deliberately dropping two identical parts in different holes must work
    // even when the second drag happens quickly.
    // Skip dedupe when placing pin-by-pin with explicit holes.
    if (!explicitPins) {
      const now = Date.now();
      // Off-board controllers can be dropped at many distinct bench locations
      // with the same fallback breadboard anchor. Dedupe only truly identical drops.
      const key = `${tool}:${anchor}:${benchPosition ? `${Math.round(benchPosition.x*20)},${Math.round(benchPosition.z*20)}` : ''}`;
      if (
        now - _lastPlace.at < 350 &&
        _lastPlace.key === key
      ) {
        return;
      }
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
        style: state.wireStyle,
      };
      const wires = [...state.wires, wire];
      if (planWireRoutes(wires, (id) => terminalPosition(id, state.parts), state.parts).slice(-1)[0]?.blocked) {
        set({ placementError: "Wire would intersect a component. Try another pair of breadboard holes." });
        return;
      }
      const next = { ...state, wires };
      set({
        wires,
        pendingHole: null,
        pendingHoles: [],
        placementError: null,
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
            : placement.kind === "ldr"
              ? 10000
              : placement.kind === "thermistor"
                ? 10000
                : placement.kind === "fuse"
                  ? 0.05
                  : undefined,
        capacitance:
          placement.kind === "capacitor" ? state.capacitorValue : undefined,
        tolerance: placement.kind === "resistor" ? 5 : undefined,
        powerRating: placement.kind === "resistor" || placement.kind === "pot" ? 0.25 : undefined,
        voltageRating:
          placement.kind === "resistor" ? 200 :
          placement.kind === "capacitor" ? 16 :
          placement.kind === "led" ? 5 :
          placement.kind === "diode" || placement.kind === "zener" ? 50 : undefined,
        maxCurrent:
          placement.kind === "led" ? 0.02 :
          placement.kind === "diode" || placement.kind === "zener" ? 1 : undefined,
        forwardVoltage:
          placement.kind === "led"
            ? ({ red: 1.9, green: 2.2, yellow: 2.1, blue: 3.0 } as const)[state.ledColor]
            : undefined,
        capacitorType: placement.kind === "capacitor" ? "ceramic" : undefined,
        diodeType: placement.kind === "zener" ? "zener" : placement.kind === "diode" ? "silicon" : undefined,
        package: placement.kind === "resistor" ? "axial" : undefined,
        ledColor: placement.kind === "led" ? state.ledColor : undefined,
        mosfetModel: placement.kind === "mosfet" ? "2n7000" : undefined,
        zenerModel: placement.kind === "zener" ? "5v1" : undefined,
        lightLevel: placement.kind === "ldr" ? 0.5 : undefined,
        temperatureC: placement.kind === "thermistor" ? 25 : undefined,
        r25: placement.kind === "thermistor" ? 10000 : undefined,
        fuseCurrent: placement.kind === "fuse" ? 0.5 : undefined,
        fuseBlown: placement.kind === "fuse" ? false : undefined,
        servoAngle: placement.kind === "servo" ? 90 : undefined,
        sevenSegCommon: placement.kind === "seven-segment" ? "cathode" : undefined,
        rgbCommon: placement.kind === "rgb-led" ? "cathode" : undefined,
        timer555Mode: placement.kind === "timer555" ? "astable" : undefined,
        opampMode: placement.kind === "opamp" ? "comparator" : undefined,
        regulatorVout: placement.kind === "regulator" ? 5 : undefined,
        closed:
          placement.kind === "switch" || placement.kind === "button"
            ? false
            : undefined,
        switchType:
          placement.kind === "switch"
            ? (tool === "switch-spdt" || tool === "switch-slide") ? "spdt" :
              tool === "switch-dpst" ? "dpst" :
              tool === "switch-dpdt" ? "dpdt" : "spst"
            : undefined,
        switchStyle:
          placement.kind === "button" ? state.switchStyle : undefined,
        mcuModel: placement.kind === "mcu" ? "arduino-uno" : undefined,
        headerAnchor: isControllerTool(tool) ? anchor : undefined,
        benchPosition: isControllerTool(tool) ? constrainBenchPoint(benchPosition ?? defaultControllerPosition(anchor,tool==='mcu'?undefined:tool),tool==='mcu'?undefined:tool) : undefined,
        code: placement.kind === "mcu" ? DEFAULT_MCU_CODE : undefined,
        lcdCols: placement.kind === "lcd" ? 16 : undefined,
        lcdRows: placement.kind === "lcd" ? 2 : undefined,
        transistorModel:
          placement.kind === "transistor" ? state.transistorModel : undefined,
        thyristorModel:
          placement.kind === "thyristor" ? state.thyristorModel : undefined,
        triacModel:
          placement.kind === "triac" ? state.triacModel : undefined,
        diacModel:
          placement.kind === "diac" ? state.diacModel : undefined,
        gateFamily:
          ["not", "and", "or", "nand", "nor", "xor", "xnor"].includes(placement.kind)
            ? placement.kind as PlacedPart["props"]["gateFamily"]
            : undefined,
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
        ...componentVariantProps(tool),
      },
    };

    if (part.kind === 'mcu') {
      part.pins = Object.fromEntries(UNO_HEADER_NAMES.map(name => [name, mcuTerminalId(part.id,name)]));
    } else if (isOffboardController(part)) {
      part.pins = Object.fromEntries(Object.keys(part.pins).map(name => [name,moduleTerminalId(part.id,name)]));
    }

    if (placementIsBlocked(part, state.parts)) {
      set({ placementError: "Position occupied. Move the part to an empty, cyan-outlined footprint." });
      return;
    }

    let parts = [...state.parts, part];
    let wires = state.wires;

    const powered = ensurePowerWiring({
      parts,
      wires,
      psuPositive: state.psuPositive,
      psuNegative: state.psuNegative,
    });
    wires = powered.wires;
    if (introducesWireObstruction(state.wires, state.parts, wires, parts)) {
      set({ placementError: "Placement blocks existing wiring. Choose a clearer location." });
      return;
    }

    if (!explicitPins) {
      const now = Date.now();
      _lastPlace = { key: `${tool}:${anchor}`, at: now, tool };
      _suppressHolePlaceUntil = now + 500;
    }
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
      placementError: null,
      sim: runSimulation(next),
      history: [...state.history, snapshot(state)],
      future: [],
      tool: "select",
    });
  },

  dismissPlacementError: () => set({ placementError: null }),

  setTool: (tool) =>
    set((state) => ({
      tool,
      placementError: null,
      pendingHole: null,
      pendingHoles: [],
      pinEditTarget: null,
      movingSelected: false,
      // Don't accidentally restyle a previously selected wire when configuring
      // a new wire, or leave a stale inspector on top of placement controls.
      ...(tool !== "select" ? { selectedId: null as string | null } : {}),
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

  setWireStyle: (wireStyle) =>
    set((state) => {
      const selected = state.wires.some((wire) => wire.id === state.selectedId);
      if (!selected) return { wireStyle };
      const wires = state.wires.map((wire) =>
        wire.id === state.selectedId ? { ...wire, style: wireStyle } : wire,
      );
      return {
        wireStyle,
        wires,
        // Electrical connectivity is unchanged by appearance settings.
        history: [...state.history, snapshot(state)],
        future: [],
      };
    }),

  setShowWireFlow: (showWireFlow) => set({ showWireFlow }),
  setFocusConnections: (focusConnections) => set({ focusConnections }),

  autoTidyWires: () => set((state) => {
    if (!state.wires.length) return state;
    const wires = autoTidyWireBundle(state.wires, state.parts, (id) => terminalPosition(id, state.parts));
    const unchanged = state.wires.every((wire, i) =>
      JSON.stringify(wire) === JSON.stringify(wires[i]));
    if (unchanged) return state;
    return {
      wires,
      // This is a layout-only operation; no electrical simulation recompute.
      history: [...state.history, snapshot(state)],
      future: [],
      placementError: null,
    };
  }),

  setSelectedWireRouteLocked: (locked) => set((state) => {
    const wire = state.wires.find(w => w.id === state.selectedId);
    if (!wire || Boolean(wire.routeLocked) === locked) return state;
    const visual = locked && !wire.bends
      ? planWireRoutes(state.wires, (id) => terminalPosition(id, state.parts), state.parts).find(r => r.id === wire.id)
      : null;
    const wires = state.wires.map(w => w.id === state.selectedId ? {
      ...w,
      routeLocked: locked,
      ...(visual && !visual.blocked ? {
        bends: visual.waypoints.slice(1, -1).map(p => ({ x: p.x, z: p.z })),
        bendAnchors: { a: w.a, b: w.b },
      } : {}),
    } : w);
    return { wires, history: [...state.history, snapshot(state)], future: [] };
  }),

  nudgeSelectedWireLane: (axis, delta) => set((state) => {
    const wire = state.wires.find(w => w.id === state.selectedId);
    if (!wire || !Number.isFinite(delta) || !delta) return state;
    const route = planWireRoutes(state.wires, (id) => terminalPosition(id, state.parts), state.parts).find(r => r.id === wire.id);
    if (!route || route.blocked || route.waypoints.length < 2) return state;
    const from = route.waypoints[0], to = route.waypoints[route.waypoints.length - 1];
    const current = route.waypoints[Math.floor(route.waypoints.length / 2)];
    const lane = (axis === 'z' ? current.z : current.x) + delta;
    const bends = axis === 'z'
      ? [{ x: from.x, z: lane }, { x: to.x, z: lane }]
      : [{ x: lane, z: from.z }, { x: lane, z: to.z }];
    const changed = { ...wire, bends, bendAnchors: { a: wire.a, b: wire.b }, routeLocked: true };
    const wires = state.wires.map(w => w.id === wire.id ? changed : w);
    const planned = planWireRoutes(wires, (id) => terminalPosition(id, state.parts), state.parts).find(r => r.id === wire.id);
    // A blocked lane must be rejected rather than silently replaced with the
    // old route (which would make an "Edit wire" button appear broken).
    const valid = planned && !planned.blocked && bends.every(p =>
      planned.waypoints.some(q => Math.abs(p.x - q.x) < 0.001 && Math.abs(p.z - q.z) < 0.001));
    if (!valid) return { placementError: 'That wire lane crosses a component. Try another direction.' };
    return { wires, history: [...state.history, snapshot(state)], future: [], placementError: null };
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

  setSwitchStyle: (switchStyle) =>
    set({
      switchStyle,
    }),

  setHoverBenchPoint: (hoverBenchPoint) => set({ hoverBenchPoint }),

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
        const wires = state.wires.filter((w) => w.id !== selectedId && !w.a.startsWith(`mcu:${selectedId}:`) && !w.b.startsWith(`mcu:${selectedId}:`) && !w.a.startsWith(`module:${selectedId}:`) && !w.b.startsWith(`module:${selectedId}:`));
        const next = {
          ...state,
          parts,
          wires,
          selectedId: null,
        guideTarget: null,
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

  /** Advance MCU/peripheral virtual time without changing the circuit topology. */
  tickSimulation: (deltaMs) =>
    set((state) => {
      if (
        !state.powerOn ||
        !state.parts.some((part) => part.kind === "mcu" || part.kind === "timer555")
      ) {
        return state;
      }
      const clamped = Math.max(0, Math.min(100, deltaMs));
      const next = { ...state, mcuDeltaMs: clamped };
      return { sim: runSimulation(next) };
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

  replaceFuse: (partId) =>
    set((state) => {
      const fuses = { ...(state.sim?.fuses ?? {}) };
      delete fuses[partId];
      const parts = state.parts.map((part) =>
        part.id === partId
          ? { ...part, props: { ...part.props, fuseBlown: false } }
          : part,
      );
      return { parts, sim: runSimulation({ ...state, parts, sim: { ...state.sim, fuses } }) };
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

        const type = part.props.switchType ?? (
          part.pins.com1 ? "dpdt" :
          part.pins.a1 ? "dpst" :
          part.pins.com ? "spdt" : "spst"
        );
        const nextPosition: SwitchPosition | undefined =
          type === "spdt" || type === "dpdt"
            ? (
                (part.props.switchPosition ?? (part.props.closed ? "no" : "open")) === "open"
                  ? "no"
                  : (part.props.switchPosition ?? "no") === "no"
                    ? "nc"
                    : "open"
              )
            : undefined;
        return {
          ...part,
          props: {
            ...part.props,
            closed: nextPosition ? nextPosition !== "open" : !part.props.closed,
            switchPosition: nextPosition,
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

  setMcuResetPressed: (id, pressed) =>
    set((state) => {
      const parts = state.parts.map((part) => {
        if (part.id !== id || part.kind !== "mcu") return part;
        if (Boolean(part.props.resetPressed) === pressed) return part;
        return {
          ...part,
          props: { ...part.props, resetPressed: pressed },
        };
      });
      const next = { ...state, parts };
      return {
        parts,
        // While held, force a reset edge into the MCU runtime.
        sim: runSimulation({ ...next, mcuReset: pressed }),
      };
    }),

  setMcuPinButtonPressed: (id, pin, pressed) =>
    set((state) => {
      const pinKey = pin.trim().toLowerCase().replace(/^d/, "d");
      const normalized =
        /^\d+$/.test(pinKey) ? `d${pinKey}` : pinKey.startsWith("d") ? pinKey : `d${pinKey}`;
      const parts = state.parts.map((part) => {
        if (part.id !== id || part.kind !== "mcu") return part;
        const map = {
          ...(part.props.pinButtons as Record<string, boolean> | undefined),
        };
        if (Boolean(map[normalized]) === pressed) return part;
        if (pressed) map[normalized] = true;
        else delete map[normalized];
        return {
          ...part,
          props: { ...part.props, pinButtons: map },
        };
      });
      const next = { ...state, parts };
      return {
        parts,
        sim: runSimulation(next),
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

        wires: preset.wires.map((w) => ({ ...w, bends: w.bends?.map(p => ({ ...p })), bendAnchors: w.bendAnchors ? { ...w.bendAnchors } : undefined })),

        psuPositive: preset.psuPositive,

        psuNegative: preset.psuNegative,

        labId: preset.id,

        pendingHole: null,

        pendingHoles: [],

        selectedId: null,
        guideTarget: null,
        placementError: null,

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
      const mcuNormalized = upgradeMcuHeaders(circuit.parts, circuit.wires);
      const normalized = upgradeControllerHeaders(mcuNormalized.parts, mcuNormalized.wires);
      const changedEndpoints = normalized.wires.some((w,i) => w.a !== circuit.wires[i]?.a || w.b !== circuit.wires[i]?.b);
      // Migrated header paths need a new initial tidy geometry. This also
      // preserves the existing undo baseline for older premade projects.
      const normalizedWires = changedEndpoints
        ? autoTidyWireBundle(normalized.wires, normalized.parts, (id)=>terminalPosition(id,normalized.parts))
        : normalized.wires;
      const next = {
        ...state,
        boardId: circuit.boardId ?? state.boardId,
        psuVoltage: circuit.psuVoltage ?? state.psuVoltage,
        psuPositive: circuit.psuPositive,
        psuNegative: circuit.psuNegative,
        parts: normalized.parts.map((p) => ({
          ...p,
          pins: { ...p.pins },
          props: { ...p.props },
        })),
        wires: normalizedWires.map((w) => ({ ...w, bends: w.bends?.map(p => ({ ...p })), bendAnchors: w.bendAnchors ? { ...w.bendAnchors } : undefined })),
        powerOn: false,
        pendingHole: null,
        pendingHoles: [] as HoleId[],
        selectedId: null,
        guideTarget: null,
        probeHole: null,
        placementError: null,
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
      wires: s.wires.map((w) => ({ ...w, bends: w.bends?.map(p => ({ ...p })), bendAnchors: w.bendAnchors ? { ...w.bendAnchors } : undefined })),
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
      if (!state.selectedId ||
          (!state.parts.some((part) => part.id === state.selectedId) &&
           !state.wires.some((wire) => wire.id === state.selectedId))) return state;

      const parts = state.parts.filter(
        (part) => part.id !== state.selectedId
      );

      const wires = state.wires.filter(
        (wire) => wire.id !== state.selectedId &&
          !wire.a.startsWith(`mcu:${state.selectedId}:`) &&
          !wire.b.startsWith(`mcu:${state.selectedId}:`) &&
          !wire.a.startsWith(`module:${state.selectedId}:`) &&
          !wire.b.startsWith(`module:${state.selectedId}:`)
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
        movingSelected: false,
        pinEditTarget: null,
        pendingHoles: [],
        pendingHole: null,

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
      // DIP-8 packages must keep straddling the centre channel.
      if (part.kind === "timer555" || part.kind === "opamp" || part.kind === "seven-segment") return state;

      const newPins = rotatePins90Clockwise(part.pins);
      if (!newPins) return state;

      const nextRotation = ((Number(part.props.rotation) || 0) + 90) % 360;

      const rotatedPart = {
        ...part,
        pins: newPins,
        props: {
          ...part.props,
          rotation: nextRotation,
        },
      };
      if (placementIsBlocked(rotatedPart, state.parts, part.id)) {
        return { placementError: "Cannot rotate: the component would collide with another part." };
      }
      if (introducesWireObstruction(state.wires, state.parts, state.wires, state.parts.map((p) => p.id === part.id ? rotatedPart : p))) {
        return { placementError: "Cannot rotate: there is no collision-free wire route." };
      }

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
        placementError: null,
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

  moveSelectedTo: (anchor, benchPosition) => {
    const state = get();
    if (!state.selectedId) return;
    const part = state.parts.find((p) => p.id === state.selectedId);
    if (!part) return;

    const controller = isOffboardController(part);
    const newPins = controller ? part.pins : reanchorPartPins(part, anchor);
    const nextBench = controller ? constrainBenchPoint(benchPosition ?? defaultControllerPosition(anchor,part.props.moduleId),part.props.moduleId) : undefined;
    if (!newPins) return;
    // Dropping at the original location is a no-op: do not create an undo step
    // or unnecessarily re-run simulation.
    if (Object.entries(part.pins).every(([name, hole]) => newPins[name] === hole) && (!controller || (controllerPosition(part).x === nextBench?.x && controllerPosition(part).z === nextBench?.z))) {
      set({ movingSelected: false });
      return;
    }

    // Keep props (including rotation) so orientation survives the move.
    const movedPart = { ...part, pins: newPins, props: { ...part.props, ...(controller ? { benchPosition: nextBench, headerAnchor: benchPosition ? part.props.headerAnchor : anchor } : {}) } };
    if (placementIsBlocked(movedPart, state.parts, part.id)) {
      set({ placementError: "Cannot drop: the component would occupy another solid object." });
      return;
    }
    if (introducesWireObstruction(state.wires, state.parts, state.wires, state.parts.map((p) => p.id === part.id ? movedPart : p))) {
      set({ placementError: "Cannot drop: attached wires cannot safely route around nearby parts." });
      return;
    }

    const parts = state.parts.map((p) =>
      p.id === part.id
        ? movedPart
        : p,
    );
    const next = { ...state, parts };
    set({
      parts,
      movingSelected: false,
      pinEditTarget: null,
      selectedId: part.id,
      placementError: null,
      sim: runSimulation(next),
      history: [...state.history, snapshot(state)],
      future: [],
    });
  },

  startPinEdit: (partId, pinName) =>
    set((state) => state.parts.some(p => p.id === partId && isOffboardController(p)) ? {} : ({
      pinEditTarget: { partId, pinName },
      movingSelected: false,
      selectedId: partId,
      tool: "select",
    })),

  cancelPinEdit: () => set({ pinEditTarget: null }),

  setPartPin: (partId, pinName, hole) => {
    const state = get();
    const part = state.parts.find((p) => p.id === partId);
    if (!part || isOffboardController(part) || !(pinName in part.pins)) return;

    const updatedPart = { ...part, pins: { ...part.pins, [pinName]: hole } };
    if (placementIsBlocked(updatedPart, state.parts, partId)) {
      set({ placementError: "Pin location occupied by a solid component." });
      return;
    }
    if (introducesWireObstruction(state.wires, state.parts, state.wires, state.parts.map((p) => p.id === partId ? updatedPart : p))) {
      set({ placementError: "Moving that pin would obstruct a wire route." });
      return;
    }

    const parts = state.parts.map((p) =>
      p.id === partId
        ? updatedPart
        : p,
    );
    const next = { ...state, parts };
    set({
      parts,
      pinEditTarget: null,
      placementError: null,
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
      if (a === b || holeStrip(a) === holeStrip(b)) {
        set({ placementError: 'These terminals are already connected by the same breadboard strip. Choose a different destination.', pendingHole: a, pendingHoles: [a] });
        return;
      }
      if (state.wires.some((wire) => (wire.a === a && wire.b === b) || (wire.a === b && wire.b === a))) {
        set({ placementError: 'A wire already connects those two terminals.', pendingHole: a, pendingHoles: [a] });
        return;
      }
      const wire: Wire = { id: uid("wire"), a, b, color: state.wireColor, style: state.wireStyle };
      const wires = [...state.wires, wire];
      if (planWireRoutes(wires, (id) => terminalPosition(id, state.parts), state.parts).slice(-1)[0]?.blocked) {
        set({ placementError: "No safe path around the components for a solid wire. Switch to Jumper to arch over the parts, or choose a different endpoint.", pendingHoles: [a], pendingHole: a });
        return;
      }
      const next = { ...state, wires };
      set({
        wires,
        pendingHole: null,
        pendingHoles: [],
        placementError: null,
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
