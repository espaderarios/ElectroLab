import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { BoardPresetId } from "@/circuit/breadboard";
import type { HoleId, PlacedPart, Wire } from "@/circuit/types";
import { uid } from "@/lib/utils";
import { circuitHalfAdder, circuitFullAdder } from "@/circuit/adder-circuits";
import { circuitArduinoLcd, circuitArduinoOled, circuitArduinoSevenSegment } from "@/circuit/display-examples";
import { autoTidyWireBundle } from "@/circuit/tidy-wires";
import { holePosition } from "@/circuit/breadboard";

export type ProjectStatus = "Pass" | "Warning" | "Failed" | "Draft";

/** Full breadboard circuit saved with each project. */
export interface ProjectCircuit {
  boardId: BoardPresetId;
  psuVoltage: number;
  psuPositive: HoleId | null;
  psuNegative: HoleId | null;
  parts: PlacedPart[];
  wires: Wire[];
}

export interface ProjectRecord {
  id: string;
  name: string;
  status: ProjectStatus;
  updatedAt: number;
  createdAt: number;
  description?: string;
  /** Independent circuit data for this project only. */
  circuit: ProjectCircuit;
}

export interface ActivityItem {
  id: string;
  projectId: string;
  title: string;
  desc: string;
  time: number;
  ok: boolean;
}

export interface SimRunRecord {
  id: string;
  projectId: string;
  projectName: string;
  status: ProjectStatus;
  time: number;
  notes?: string;
}

interface ProjectsState {
  projects: ProjectRecord[];
  activity: ActivityItem[];
  simRuns: SimRunRecord[];
  darkMode: boolean;
  activeProjectId: string | null;

  createProject: (name?: string) => ProjectRecord;
  getProject: (id: string) => ProjectRecord | undefined;
  renameProject: (id: string, name: string) => void;
  deleteProject: (id: string) => void;
  touchProject: (id: string, status?: ProjectStatus) => void;
  saveCircuit: (id: string, circuit: ProjectCircuit) => void;
  setActiveProjectId: (id: string | null) => void;
  importCircuit: (json: string, name?: string) => ProjectRecord | null;
  exportProject: (id: string) => string | null;
  addActivity: (
    item: Omit<ActivityItem, "id" | "time"> & { time?: number },
  ) => void;
  recordSimRun: (
    run: Omit<SimRunRecord, "id" | "time"> & { time?: number },
  ) => void;
  toggleDarkMode: () => void;
  setDarkMode: (on: boolean) => void;
}

function emptyCircuit(): ProjectCircuit {
  return {
    boardId: "standard-830",
    psuVoltage: 5,
    psuPositive: null,
    psuNegative: null,
    parts: [],
    wires: [],
  };
}

export function circuitLedBlink(): ProjectCircuit {
  const led = uid("led");
  const r = uid("r");
  const btn = uid("btn");
  // Continuous path on the same terminal half (row E):
  // + → LED → 220Ω → button → GND
  return {
    boardId: "standard-830",
    psuVoltage: 5,
    psuPositive: "tp5",
    psuNegative: "tn5",
    parts: [
      {
        id: led,
        kind: "led",
        pins: { a: "E5", k: "E8" },
        props: { ledColor: "red", label: "LED" },
      },
      {
        id: r,
        kind: "resistor",
        pins: { a: "E8", b: "E12" },
        props: { resistance: 220, label: "220Ω" },
      },
      {
        id: btn,
        kind: "button",
        pins: { a: "E12", b: "E15" },
        props: { closed: false, label: "BTN" },
      },
    ],
    wires: [
      { id: uid("w"), a: "tp5", b: "A5", color: "red" },
      { id: uid("w"), a: "A15", b: "tn5", color: "black" },
    ],
  };
}

export function circuitDcMotor(): ProjectCircuit {
  const motor = uid("motor");
  const scr = uid("scr");
  const rg = uid("r");
  const btn = uid("btn");
  /*
   * Spaced layout (not one cramped row):
   *
   *   + rail ──► Motor (left) ──► SCR (center) ──► GND
   *                              gate ◄── button ◄── 1k ◄── +
   *
   * Power path on upper half (F–J), gate control on lower half (A–E).
   */
  return {
    boardId: "standard-830",
    psuVoltage: 5,
    psuPositive: "tp10",
    psuNegative: "tn25",
    parts: [
      {
        id: motor,
        kind: "motor",
        pins: { a: "F10", b: "F18" },
        props: { label: "Motor" },
      },
      {
        id: scr,
        kind: "thyristor",
        // anode shares column 18 with motor return (F strip)
        pins: { a: "F18", g: "F22", k: "F28" },
        props: { thyristorModel: "2n5060", label: "2N5060 SCR" },
      },
      {
        id: rg,
        kind: "resistor",
        pins: { a: "C10", b: "C16" },
        props: { resistance: 1000, label: "1k gate" },
      },
      {
        id: btn,
        kind: "button",
        pins: { a: "C16", b: "C22" },
        props: { closed: false, label: "GATE" },
      },
    ],
    wires: [
      // + → motor
      { id: uid("w"), a: "tp10", b: "J10", color: "red" },
      // SCR cathode → GND
      { id: uid("w"), a: "J28", b: "tn25", color: "black" },
      // + → gate resistor (lower half)
      { id: uid("w"), a: "tp10", b: "A10", color: "red" },
      // button out → SCR gate (cross the trench)
      { id: uid("w"), a: "E22", b: "F22", color: "yellow" },
    ],
  };
}

export function circuitRcLpf(): ProjectCircuit {
  const r = uid("r");
  const c = uid("c");
  // + → R → mid node → C → GND
  return {
    boardId: "standard-830",
    psuVoltage: 5,
    psuPositive: "tp10",
    psuNegative: "tn10",
    parts: [
      {
        id: r,
        kind: "resistor",
        pins: { a: "E10", b: "E15" },
        props: { resistance: 10000, label: "10k" },
      },
      {
        id: c,
        kind: "capacitor",
        pins: { a: "E15", b: "E20" },
        props: { capacitance: 0.0001, label: "100µF" },
      },
    ],
    wires: [
      { id: uid("w"), a: "tp10", b: "A10", color: "red" },
      { id: uid("w"), a: "A20", b: "tn10", color: "black" },
    ],
  };
}

export function circuitBattery(): ProjectCircuit {
  const r = uid("r");
  const led = uid("led");
  const d = uid("d");
  // + → R → diode → LED → GND
  return {
    boardId: "standard-830",
    psuVoltage: 9,
    psuPositive: "tp3",
    psuNegative: "tn3",
    parts: [
      {
        id: r,
        kind: "resistor",
        pins: { a: "E5", b: "E9" },
        props: { resistance: 470, label: "470Ω" },
      },
      {
        id: d,
        kind: "diode",
        pins: { a: "E9", k: "E13" },
        props: { label: "1N4007" },
      },
      {
        id: led,
        kind: "led",
        pins: { a: "E13", k: "E16" },
        props: { ledColor: "green", label: "CHG" },
      },
    ],
    wires: [
      { id: uid("w"), a: "tp3", b: "A5", color: "red" },
      { id: uid("w"), a: "A16", b: "tn3", color: "black" },
    ],
  };
}

function makeSeed(
  id: string,
  name: string,
  status: ProjectStatus,
  description: string,
  circuit: ProjectCircuit,
  hoursAgo: number,
): ProjectRecord {
  const t = Date.now() - hoursAgo * 3600_000;
  return {
    id,
    name,
    status,
    description,
    circuit,
    updatedAt: t,
    createdAt: t - 86400_000,
  };
}

function cloneCircuit(c: ProjectCircuit): ProjectCircuit {
  return {
    boardId: c.boardId,
    psuVoltage: c.psuVoltage,
    psuPositive: c.psuPositive,
    psuNegative: c.psuNegative,
    parts: c.parts.map((p) => ({
      ...p,
      pins: { ...p.pins },
      props: { ...p.props },
    })),
    wires: c.wires.map((w) => ({ ...w, bends: w.bends?.map(p => ({ ...p })), bendAnchors: w.bendAnchors ? { ...w.bendAnchors } : undefined })),
  };
}

/** Recreate a factory demo without replacing anyone's persisted edits. */
export function freshPremadeCircuit(id: string): ProjectCircuit | null {
  switch (id) {
    case "arduino-lcd-demo": return circuitArduinoLcd();
    case "arduino-oled-demo": return circuitArduinoOled();
    case "arduino-seven-segment-demo": return circuitArduinoSevenSegment();
    case "half-adder": return circuitHalfAdder();
    case "full-adder": return circuitFullAdder();
    default: return null;
  }
}

const SEED_PROJECTS: ProjectRecord[] = [
  makeSeed(
    "arduino-lcd-demo", "Arduino Uno + 16×2 LCD", "Draft",
    "Hand-wired HD44780 4-bit display with contrast potentiometer and protected backlight.",
    circuitArduinoLcd(), 0,
  ),
  makeSeed(
    "arduino-oled-demo", "Arduino Uno + I²C OLED", "Draft",
    "Six editable bench/jumper wires: 5 V bench input, 3.3 V OLED, SDA and SCL.",
    circuitArduinoOled(), 0,
  ),
  makeSeed(
    "arduino-seven-segment-demo", "Arduino Uno + 7-Segment", "Draft",
    "Arduino Uno directly drives a common-cathode seven-segment display in the same editable breadboard style as the reference layout.",
    circuitArduinoSevenSegment(), 0,
  ),
  makeSeed(
    "half-adder",
    "Half Adder · 74HC86 + 74HC08",
    "Draft",
    "Two switch inputs, XOR sum, AND carry, with pull-down resistors and indicator LEDs.",
    circuitHalfAdder(),
    0,
  ),
  makeSeed(
    "full-adder",
    "Full Adder · 74HC86 + 74HC08 + 74HC32",
    "Draft",
    "Three switch inputs, cascaded XOR sum, two AND gates and OR carry; 14-pin DIP ICs.",
    circuitFullAdder(),
    0,
  ),
  makeSeed(
    "dc-motor",
    "DC Motor Speed Control",
    "Draft",
    "SCR gate-triggered motor control — unique parts and wiring.",
    circuitDcMotor(),
    2,
  ),
  makeSeed(
    "rc-lpf",
    "RC Low Pass Filter",
    "Draft",
    "10kΩ + 100µF passive filter on its own board layout.",
    circuitRcLpf(),
    24,
  ),
  makeSeed(
    "battery",
    "9 V Diode and LED Indicator",
    "Draft",
    "Series resistor, protection diode and indicator LED; not an actual battery charger.",
    circuitBattery(),
    48,
  ),
  makeSeed(
    "led-blink",
    "LED Blink Circuit",
    "Draft",
    "LED + 220Ω + push button — separate from the motor project.",
    circuitLedBlink(),
    72,
  ),
];

const SEED_ACTIVITY: ActivityItem[] = [
  {
    id: "a1",
    projectId: "dc-motor",
    title: "DC Motor Speed Control",
    desc: "Simulation passed",
    time: Date.now() - 2 * 3600_000,
    ok: true,
  },
  {
    id: "a2",
    projectId: "rc-lpf",
    title: "RC Low Pass Filter",
    desc: "Simulation passed",
    time: Date.now() - 1 * 86400_000,
    ok: true,
  },
  {
    id: "a3",
    projectId: "battery",
    title: "Battery Charger Circuit",
    desc: "Voltage limit warning",
    time: Date.now() - 2 * 86400_000,
    ok: false,
  },
  {
    id: "a4",
    projectId: "led-blink",
    title: "LED Blink Circuit",
    desc: "Simulation passed",
    time: Date.now() - 3 * 3600_000,
    ok: true,
  },
];

const SEED_RUNS: SimRunRecord[] = [
  {
    id: "r1",
    projectId: "dc-motor",
    projectName: "DC Motor Speed Control",
    status: "Pass",
    time: Date.now() - 2 * 3600_000,
  },
  {
    id: "r2",
    projectId: "rc-lpf",
    projectName: "RC Low Pass Filter",
    status: "Pass",
    time: Date.now() - 1 * 86400_000,
  },
  {
    id: "r3",
    projectId: "battery",
    projectName: "Battery Charger Circuit",
    status: "Warning",
    time: Date.now() - 2 * 86400_000,
    notes: "Voltage limit warning",
  },
  {
    id: "r4",
    projectId: "led-blink",
    projectName: "LED Blink Circuit",
    status: "Pass",
    time: Date.now() - 3 * 3600_000,
  },
];

export function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "Just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 14) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set, get) => ({
      projects: SEED_PROJECTS.map((p) => ({
        ...p,
        circuit: cloneCircuit(p.circuit),
      })),
      activity: SEED_ACTIVITY,
      simRuns: SEED_RUNS,
      darkMode: true,
      activeProjectId: null,

      getProject: (id) => get().projects.find((p) => p.id === id),

      setActiveProjectId: (id) => set({ activeProjectId: id }),

      createProject: (name) => {
        const project: ProjectRecord = {
          id: uid("proj"),
          name: name?.trim() || `Untitled Project ${get().projects.length + 1}`,
          status: "Draft",
          updatedAt: Date.now(),
          createdAt: Date.now(),
          description: "New empty breadboard — place your own components.",
          circuit: emptyCircuit(),
        };
        set((s) => ({
          projects: [project, ...s.projects],
          activity: [
            {
              id: uid("act"),
              projectId: project.id,
              title: project.name,
              desc: "Project created (empty board)",
              time: Date.now(),
              ok: true,
            },
            ...s.activity,
          ],
          activeProjectId: project.id,
        }));
        return project;
      },

      renameProject: (id, name) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id ? { ...p, name, updatedAt: Date.now() } : p,
          ),
        })),

      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          activity: s.activity.filter((a) => a.projectId !== id),
          simRuns: s.simRuns.filter((r) => r.projectId !== id),
          activeProjectId:
            s.activeProjectId === id ? null : s.activeProjectId,
        })),

      touchProject: (id, status) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  updatedAt: Date.now(),
                  status: status ?? p.status,
                }
              : p,
          ),
        })),

      saveCircuit: (id, circuit) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === id
              ? {
                  ...p,
                  circuit: cloneCircuit(circuit),
                  updatedAt: Date.now(),
                }
              : p,
          ),
        })),

      importCircuit: (json, name) => {
        try {
          const parsed = JSON.parse(json) as {
            name?: string;
            circuit?: ProjectCircuit;
            parts?: PlacedPart[];
            wires?: Wire[];
            boardId?: BoardPresetId;
            psuVoltage?: number;
            psuPositive?: HoleId | null;
            psuNegative?: HoleId | null;
          };
          const circuit: ProjectCircuit = parsed.circuit
            ? cloneCircuit(parsed.circuit)
            : {
                boardId: parsed.boardId || "standard-830",
                psuVoltage: parsed.psuVoltage ?? 5,
                psuPositive: parsed.psuPositive ?? null,
                psuNegative: parsed.psuNegative ?? null,
                parts: (parsed.parts || []).map((p) => ({
                  ...p,
                  pins: { ...p.pins },
                  props: { ...p.props },
                })),
                wires: (parsed.wires || []).map((w) => ({ ...w, bends: w.bends?.map(p => ({ ...p })), bendAnchors: w.bendAnchors ? { ...w.bendAnchors } : undefined })),
              };
          const project: ProjectRecord = {
            id: uid("proj"),
            name:
              name?.trim() ||
              parsed.name ||
              `Imported ${get().projects.length + 1}`,
            status: "Draft",
            updatedAt: Date.now(),
            createdAt: Date.now(),
            description: "Imported circuit file.",
            circuit,
          };
          set((s) => ({
            projects: [project, ...s.projects],
            activity: [
              {
                id: uid("act"),
                projectId: project.id,
                title: project.name,
                desc: "Circuit imported from file",
                time: Date.now(),
                ok: true,
              },
              ...s.activity,
            ],
            activeProjectId: project.id,
          }));
          return project;
        } catch {
          return null;
        }
      },

      exportProject: (id) => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return null;
        return JSON.stringify(
          {
            name: p.name,
            id: p.id,
            status: p.status,
            description: p.description,
            circuit: p.circuit,
            exportedAt: new Date().toISOString(),
          },
          null,
          2,
        );
      },

      addActivity: (item) =>
        set((s) => ({
          activity: [
            {
              id: uid("act"),
              time: item.time ?? Date.now(),
              ...item,
            },
            ...s.activity,
          ].slice(0, 50),
        })),

      recordSimRun: (run) =>
        set((s) => ({
          simRuns: [
            {
              id: uid("run"),
              time: run.time ?? Date.now(),
              ...run,
            },
            ...s.simRuns,
          ].slice(0, 100),
          activity: [
            {
              id: uid("act"),
              projectId: run.projectId,
              title: run.projectName,
              desc:
                run.status === "Pass"
                  ? "Simulation passed"
                  : run.status === "Warning"
                    ? run.notes || "Simulation warning"
                    : "Simulation failed",
              time: run.time ?? Date.now(),
              ok: run.status === "Pass",
            },
            ...s.activity,
          ].slice(0, 50),
          projects: s.projects.map((p) =>
            p.id === run.projectId
              ? { ...p, status: run.status, updatedAt: Date.now() }
              : p,
          ),
        })),

      toggleDarkMode: () =>
        set((s) => {
          const darkMode = !s.darkMode;
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("light", !darkMode);
            document.documentElement.classList.toggle("dark", darkMode);
          }
          return { darkMode };
        }),

      setDarkMode: (on) =>
        set(() => {
          if (typeof document !== "undefined") {
            document.documentElement.classList.toggle("light", !on);
            document.documentElement.classList.toggle("dark", on);
          }
          return { darkMode: on };
        }),
    }),
    {
      name: "electrolab-projects-v4",
      // v8 adds visual bend routes to saved factory examples without
      // modifying a single pin, electrical wire endpoint, or custom project.
      version: 8,
      migrate: (persistedState, fromVersion) => {
        const previous = (persistedState ?? {}) as Partial<ProjectsState>;
        const savedProjects = Array.isArray(previous.projects) ? previous.projects : [];
        const eligibleIds = [
          ...(fromVersion < 5 ? ["half-adder", "full-adder"] : []),
          ...(fromVersion < 6 ? ["arduino-lcd-demo", "arduino-oled-demo"] : []),
          ...(fromVersion < 7 ? ["arduino-seven-segment-demo"] : []),
        ];
        const newSeeds = SEED_PROJECTS.filter(preset => eligibleIds.includes(preset.id))
          .filter(preset => !savedProjects.some(project => project.id === preset.id))
          .map(preset => ({ ...preset, circuit: cloneCircuit(preset.circuit) }));
        const exampleIds = new Set([
          'arduino-lcd-demo', 'arduino-oled-demo', 'arduino-seven-segment-demo',
          'half-adder', 'full-adder',
        ]);
        const upgraded = savedProjects.map(project => {
          const circuit = project.circuit;
          if (fromVersion >= 8 || !exampleIds.has(project.id) || !circuit ||
              circuit.boardId !== 'standard-830' || !Array.isArray(circuit.wires) ||
              !Array.isArray(circuit.parts) || circuit.wires.some(w => Array.isArray(w.bends) || w.routeLocked)) {
            return project;
          }
          return {
            ...project,
            circuit: {
              ...circuit,
              wires: autoTidyWireBundle(circuit.wires, circuit.parts, holePosition),
            },
          };
        });
        return { ...previous, projects: [...newSeeds, ...upgraded] } as ProjectsState;
      },
      partialize: (s) => ({
        projects: s.projects,
        activity: s.activity,
        simRuns: s.simRuns,
        darkMode: s.darkMode,
      }),
    },
  ),
);
