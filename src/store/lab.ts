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
   */
  placePartAt: (tool: ToolId, anchor: HoleId) => void;

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
  /** Rotate selected part 180° on the breadboard (swap / reverse pin holes). */
  rotateSelected: () => void;
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

  placePartAt: (tool, anchor) => {
    const state = get();
    const placement = getPlacement(tool);
    if (!placement) return;

    const parsed = parseTerminalHole(anchor);
    if (!parsed && placement.kind !== "wire") {
      // Anchor must be a terminal strip hole for components.
      return;
    }

    // Map pin names → holes by walking across adjacent columns.
    const holes: HoleId[] = [];
    if (placement.kind === "wire") {
      holes.push(anchor);
      const next = offsetHole(anchor, 1) ?? anchor;
      holes.push(next);
    } else if (placement.pins.length === 2) {
      holes.push(anchor);
      const b =
        offsetHole(anchor, placement.kind === "led" || placement.kind === "diode" ? 0 : 3) ??
        anchor;
      // LEDs/diodes: a and k on same column different rows when possible
      if (placement.kind === "led" || placement.kind === "diode") {
        const row = parsed!.row;
        const opposite =
          "ABCDE".includes(row)
            ? (`F${parsed!.col}` as HoleId)
            : (`E${parsed!.col}` as HoleId);
        holes.push(opposite);
      } else {
        holes.push(b === anchor ? (offsetHole(anchor, 1) ?? anchor) : b);
      }
    } else {
      // Multi-pin parts must fit completely on the board. The old code used
      // offsetHole(), which clamps at BOARD.cols; placing an LCD/Arduino near
      // the right edge therefore collapsed several pins onto the same hole.
      // That made VCC/GND (and unrelated GPIO pins) share one breadboard net,
      // producing the fake 2 A short shown in the lab.
      const maxStartCol = Math.max(1, BOARD.cols - placement.pins.length + 1);
      const startCol = Math.min(parsed!.col, maxStartCol);
      const row = parsed!.row;
      for (let i = 0; i < placement.pins.length; i++) {
        holes.push(`${row}${startCol + i}` as HoleId);
      }
    }

    if (placement.kind === "wire") {
      const [a, b] = holes;
      if (a === b || holeStrip(a) === holeStrip(b)) return;
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

    const pins = Object.fromEntries(
      placement.pins.map((name, index) => [name, holes[index] ?? anchor]),
    ) as Record<string, HoleId>;

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

      // Collect pin entries that sit on terminal holes (letter+column).
      const entries = Object.entries(part.pins).filter(
        ([, hole]) => hole && /^[A-T]\d+$/.test(hole),
      ) as [string, HoleId][];
      if (entries.length < 2) return state;

      // Sort left→right by column so we can reverse for a 180° footprint flip.
      entries.sort((a, b) => {
        const ca = Number(a[1].slice(1));
        const cb = Number(b[1].slice(1));
        if (ca !== cb) return ca - cb;
        return a[1].localeCompare(b[1]);
      });

      const holes = entries.map(([, h]) => h);
      const reversedHoles = [...holes].reverse();
      const newPins = { ...part.pins };
      entries.forEach(([pin], i) => {
        newPins[pin] = reversedHoles[i];
      });

      const parts = state.parts.map((p) =>
        p.id === part.id
          ? {
              ...p,
              pins: newPins,
              props: {
                ...p.props,
                rotation: ((Number(p.props.rotation) || 0) + 180) % 360,
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

    // Components with three or four terminals (potentiometers and relays)
    // use the same direct placement flow as two-terminal parts.
    if (state.pendingHoles.includes(hole)) {
      set({ pendingHole: null, pendingHoles: [] });
      return;
    }

    const holes = [...state.pendingHoles, hole];
    if (holes.length < placement.pins.length) {
      set({ pendingHole: holes[0], pendingHoles: holes });
      return;
    }

    if (placement.kind === "wire") {
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

    const pins = Object.fromEntries(
      placement.pins.map((name, index) => [name, holes[index]]),
    ) as Record<string, HoleId>;
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
          placement.kind === "capacitor"
            ? state.capacitorValue
            : undefined,
        ledColor: placement.kind === "led" ? state.ledColor : undefined,
        closed:
          placement.kind === "switch" || placement.kind === "button"
            ? false
            : undefined,
        mcuModel:
          placement.kind === "mcu" ? "arduino-uno" : undefined,
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
      selectedId: part.id,
      sim: runSimulation(next),
      history: [...state.history, snapshot(state)],
      future: [],
      tool: "select",
    });
  },
}));
