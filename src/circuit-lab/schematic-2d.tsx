/**
 * Independent 2D schematic editor + simulator.
 * Completely separate from the 3D breadboard lab — own parts, wires, power, and current-flow model.
 */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { PartKind } from "@/circuit/types";

const WIDTH = 1100;
const HEIGHT = 680;
const GRID = 20;

type Point = { x: number; y: number };
type PinId = string;
type Terminal = { symbolId: string; pin: PinId };
type LogicGateKind = "not" | "and" | "or" | "nand" | "nor" | "xor" | "xnor";
type SchematicKind = PartKind | LogicGateKind | "vcc" | "gnd" | "dc-source" | "probe";
type SymbolModel = {
  id: string;
  kind: SchematicKind;
  label: string;
  value: string;
  variant: string;
  x: number;
  y: number;
  rotation: number;
};
type Endpoint = { point: Point; terminal?: Terminal };
type SchematicWire = { id: string; a: Endpoint; b: Endpoint; waypoints: Point[] };
type Junction = Point & { id: string };
type Snapshot = { symbols: SymbolModel[]; wires: SchematicWire[]; junctions: Junction[] };
export type SchematicFile = {
  format: "electrolab-schematic";
  version: 1;
  name: string;
  psuVoltage: number;
  symbols: SymbolModel[];
  wires: SchematicWire[];
  junctions: Junction[];
};
type RecentSchematic = SchematicFile & { savedAt: number };
type PinDef = { id: PinId; x: number; y: number; label?: string };

const COLORS = {
  wire: "#64748b",
  wireSel: "#60a5fa",
  pin: "#93c5fd",
  pinActive: "#60a5fa",
  symbol: "#94a3b8",
  label: "#bfdbfe",
  value: "#94a3b8",
  grid: "#334155",
  bg: "#111827",
};

const PALETTE: Array<{ title: string; items: SchematicKind[] }> = [
  { title: "Sources", items: ["vcc", "gnd", "dc-source", "probe"] },
  { title: "Passives", items: ["resistor", "capacitor", "inductor", "pot"] },
  { title: "Semiconductors", items: ["led", "diode", "transistor", "thyristor", "triac", "diac"] },
  { title: "Switching & loads", items: ["switch", "button", "relay", "motor", "buzzer", "speaker"] },
  { title: "Logic ICs", items: ["not", "and", "or", "nand", "nor", "xor", "xnor"] },
  { title: "Modules", items: ["mcu", "lcd", "oled"] },
];

const PREFIX: Record<string, string> = {
  resistor: "R",
  capacitor: "C",
  inductor: "L",
  pot: "RV",
  led: "D",
  diode: "D",
  transistor: "Q",
  thyristor: "Q",
  triac: "Q",
  diac: "D",
  switch: "SW",
  button: "PB",
  relay: "K",
  motor: "M",
  buzzer: "BZ",
  speaker: "SP",
  not: "U",
  and: "U",
  or: "U",
  nand: "U",
  nor: "U",
  xor: "U",
  xnor: "U",
  mcu: "U",
  lcd: "U",
  oled: "U",
  vcc: "VCC",
  gnd: "GND",
  "dc-source": "V",
  probe: "TP",
};


/** Variant options shown in the properties panel per component kind. */
type VariantOption = { id: string; label: string; group?: string };

const VARIANTS: Partial<Record<SchematicKind, VariantOption[]>> = {
  transistor: [
    { id: "npn", label: "NPN (general)", group: "Type" },
    { id: "pnp", label: "PNP (general)", group: "Type" },
    { id: "2n3904", label: "2N3904 — TO-92 NPN", group: "NPN models" },
    { id: "bc547", label: "BC547 — TO-92 NPN", group: "NPN models" },
    { id: "2n2222", label: "2N2222 — TO-18 NPN", group: "NPN models" },
    { id: "tip31", label: "TIP31 — TO-220 NPN", group: "NPN models" },
    { id: "2n3055", label: "2N3055 — TO-3 NPN", group: "NPN models" },
    { id: "2n3906", label: "2N3906 — TO-92 PNP", group: "PNP models" },
    { id: "bc557", label: "BC557 — TO-92 PNP", group: "PNP models" },
    { id: "tip32", label: "TIP32 — TO-220 PNP", group: "PNP models" },
  ],
  diode: [
    { id: "silicon", label: "Silicon (1N4148 / 1N400x)" },
    { id: "schottky", label: "Schottky (1N5819…)" },
    { id: "zener", label: "Zener (BZX…)" },
  ],
  capacitor: [
    { id: "ceramic", label: "Ceramic (non-polar)" },
    { id: "film", label: "Film (non-polar)" },
    { id: "electrolytic", label: "Electrolytic (polar)" },
    { id: "tantalum", label: "Tantalum (polar)" },
  ],
  led: [
    { id: "red", label: "Red" },
    { id: "green", label: "Green" },
    { id: "yellow", label: "Yellow" },
    { id: "blue", label: "Blue" },
  ],
  resistor: [
    { id: "axial", label: "Axial through-hole" },
    { id: "smd", label: "SMD chip" },
  ],
  switch: [
    { id: "spst", label: "SPST" },
    { id: "spdt", label: "SPDT" },
  ],
  button: [
    { id: "no", label: "Normally open (NO)" },
    { id: "nc", label: "Normally closed (NC)" },
  ],
  motor: [
    { id: "3v", label: "3 V hobby" },
    { id: "5v", label: "5 V hobby" },
    { id: "6v", label: "6 V hobby" },
    { id: "9v", label: "9 V hobby" },
    { id: "12v", label: "12 V hobby" },
  ],
  thyristor: [
    { id: "2n5060", label: "2N5060 — TO-92" },
    { id: "tic106", label: "TIC106 — TO-220" },
    { id: "c106", label: "C106 — TO-220" },
    { id: "bt151", label: "BT151 — TO-220" },
    { id: "tyn612", label: "TYN612 — TO-220" },
    { id: "2n6508", label: "2N6508 — TO-220" },
  ],
  triac: [
    { id: "mac97a", label: "MAC97A — TO-92" },
    { id: "bt136", label: "BT136 — TO-220" },
    { id: "tic226", label: "TIC226 — TO-220" },
    { id: "bt139", label: "BT139 — TO-220" },
    { id: "bta16", label: "BTA16 — TO-220" },
  ],
  diac: [
    { id: "db3", label: "DB3 (~32 V)" },
    { id: "db4", label: "DB4 (~40 V)" },
    { id: "ht32", label: "HT32 (~32 V)" },
  ],
  mcu: [
    { id: "arduino-uno", label: "Arduino Uno" },
    { id: "esp32", label: "ESP32" },
  ],
  "dc-source": [
    { id: "dc", label: "DC voltage source" },
    { id: "battery", label: "Battery cell" },
  ],
  not: [{ id: "7404", label: "7404 — Hex inverter" }],
  and: [{ id: "7408", label: "7408 — Quad 2-input AND" }],
  or: [{ id: "7432", label: "7432 — Quad 2-input OR" }],
  nand: [
    { id: "7400", label: "7400 — Quad 2-input NAND" },
    { id: "7410", label: "7410 — Triple 3-input NAND" },
    { id: "7420", label: "7420 — Dual 4-input NAND" },
  ],
  nor: [{ id: "7402", label: "7402 — Quad 2-input NOR" }],
  xor: [{ id: "7486", label: "7486 — Quad 2-input XOR" }],
  xnor: [{ id: "747266", label: "74LS266 — Quad 2-input XNOR" }],
};

const DEFAULT_VARIANT: Partial<Record<SchematicKind, string>> = {
  transistor: "npn",
  diode: "silicon",
  capacitor: "ceramic",
  led: "red",
  resistor: "axial",
  switch: "spst",
  button: "no",
  motor: "5v",
  thyristor: "2n5060",
  triac: "bt136",
  diac: "db3",
  mcu: "arduino-uno",
  "dc-source": "dc",
  not: "7404",
  and: "7408",
  or: "7432",
  nand: "7400",
  nor: "7402",
  xor: "7486",
  xnor: "747266",
};

function logicPinLabel(kind: LogicGateKind, variant: string, pin: number): string {
  const pkg = variant.toLowerCase();
  if (kind === "not" || pkg === "7404") {
    const channels: Record<number, string> = {
      1: "A1", 2: "Y1", 3: "A2", 4: "Y2", 5: "A3", 6: "Y3",
      8: "Y4", 9: "A4", 10: "Y5", 11: "A5", 12: "Y6", 13: "A6",
    };
    return channels[pin] ?? (pin === 7 ? "GND" : "VCC");
  }
  if (kind === "nor" || pkg === "7402") {
    const channels: Record<number, string> = {
      1: "Y1", 2: "A1", 3: "B1", 4: "Y2", 5: "A2", 6: "B2",
      8: "Y3", 9: "A3", 10: "B3", 11: "A4", 12: "B4", 13: "Y4",
    };
    return channels[pin] ?? (pin === 7 ? "GND" : "VCC");
  }
  if (pkg === "7410") {
    const channels: Record<number, string> = {
      1: "A1", 2: "B1", 3: "A2", 4: "B2", 5: "C2", 6: "Y2",
      8: "Y3", 9: "A3", 10: "B3", 11: "C3", 12: "Y1", 13: "C1",
    };
    return channels[pin] ?? (pin === 7 ? "GND" : "VCC");
  }
  if (pkg === "7420") {
    const channels: Record<number, string> = {
      1: "A1", 2: "B1", 4: "C1", 5: "D1", 6: "Y1",
      8: "Y2", 9: "A2", 10: "B2", 12: "C2", 13: "D2",
    };
    return channels[pin] ?? (pin === 7 ? "GND" : "VCC");
  }
  const channels: Record<number, string> = {
    1: "A1", 2: "B1", 3: "Y1", 4: "A2", 5: "B2", 6: "Y2",
    8: "Y3", 9: "A3", 10: "B3", 11: "Y4", 12: "A4", 13: "B4",
  };
  return channels[pin] ?? (pin === 7 ? "GND" : "VCC");
}

/** DIP-14 pin positions (schematic top view, notch on the left). */
function dip14PinDefs(kind: LogicGateKind, variant: string): PinDef[] {
  const step = 16;
  const x0 = -48;
  const yBot = 42;
  const yTop = -42;
  const pins: PinDef[] = [];
  for (let i = 1; i <= 7; i++) {
    pins.push({ id: `p${i}`, x: x0 + (i - 1) * step, y: yBot, label: `${logicPinLabel(kind, variant, i)} (${i})` });
  }
  for (let i = 8; i <= 14; i++) {
    pins.push({ id: `p${i}`, x: x0 + (14 - i) * step, y: yTop, label: `${logicPinLabel(kind, variant, i)} (${i})` });
  }
  return pins;
}

function logicPackageLabel(kind: SchematicKind, variant: string): string {
  if (variant) return variant.toUpperCase().replace("747266", "74LS266");
  const defaults: Record<string, string> = {
    not: "7404",
    and: "7408",
    or: "7432",
    nand: "7400",
    nor: "7402",
    xor: "7486",
    xnor: "74LS266",
  };
  return defaults[kind] ?? "74xx";
}


function isPnp(variant: string): boolean {
  return variant === "pnp" || variant === "2n3906" || variant === "bc557" || variant === "tip32";
}

function isPolarCap(variant: string): boolean {
  return variant === "electrolytic" || variant === "tantalum";
}

const LED_HEX: Record<string, string> = {
  red: "#ef4444",
  green: "#22c55e",
  yellow: "#eab308",
  blue: "#38bdf8",
};

const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const titleOf = (kind: SchematicKind) =>
  kind === "dc-source" ? "DC Source" : kind === "vcc" ? "VCC" : kind === "gnd" ? "GND" : kind === "probe" ? "Probe" : kind[0].toUpperCase() + kind.slice(1);
const snap = (n: number) => Math.round(n / GRID) * GRID;


/** Components that show a value field (and a value label on the sheet). */
const VALUE_KINDS = new Set<SchematicKind>([
  "resistor",
  "capacitor",
  "inductor",
  "pot",
  "led",
  "diode",
  "buzzer",
  "speaker",
  "motor",
]);

function valueUnit(kind: SchematicKind): string {
  switch (kind) {
    case "resistor":
    case "pot":
      return "Ω";
    case "capacitor":
      return "F";
    case "inductor":
      return "H";
    case "led":
    case "diode":
      return "V"; // forward / zener voltage when given
    case "motor":
      return "V";
    case "buzzer":
    case "speaker":
      return "Ω";
    default:
      return "";
  }
}

function valuePlaceholder(kind: SchematicKind): string {
  switch (kind) {
    case "resistor":
      return "e.g. 220, 1k, 10k";
    case "pot":
      return "e.g. 10k";
    case "capacitor":
      return "e.g. 100n, 10u, 47µ";
    case "inductor":
      return "e.g. 100u, 1m";
    case "led":
      return "e.g. 2.0 (Vf)";
    case "diode":
      return "e.g. 0.7 or 5.1 (Vz)";
    case "motor":
      return "e.g. 5, 12";
    case "buzzer":
    case "speaker":
      return "e.g. 8, 16";
    default:
      return "Value";
  }
}

/** Format value for the sheet: append unit if the user didn't already type one. */
function formatValueLabel(kind: SchematicKind, raw: string): string {
  const v = (raw || "").trim();
  if (!v) return "";
  const unit = valueUnit(kind);
  if (!unit) return v;
  // Already has a unit-ish suffix
  if (/[a-zA-ZΩµμ°]+$/.test(v)) return v;
  // Metric prefix only (1k, 10u) — still add base unit
  if (/^[0-9]*\.?[0-9]+\s*[pnumkMGT]?$/i.test(v)) {
    const m = v.match(/^([0-9]*\.?[0-9]+)\s*([pnumkMGT])?$/i);
    if (m) {
      const n = m[1];
      const p = m[2] || "";
      if (kind === "resistor" || kind === "pot") return p ? `${n}${p}Ω` : `${n}Ω`;
      if (kind === "capacitor") return p ? `${n}${p}F` : `${n}F`;
      if (kind === "inductor") return p ? `${n}${p}H` : `${n}H`;
      return `${v}${unit}`;
    }
  }
  return `${v}${unit}`;
}


/** Pin layouts in local symbol coordinates (center = 0,0). */
function pinsFor(kind: SchematicKind, variant: string = ""): PinDef[] {
  switch (kind) {
    case "vcc":
      // Wire leaves downward from the rail symbol
      return [{ id: "a", x: 0, y: 28 }];
    case "gnd":
      // Wire arrives from above into the ground symbol
      return [{ id: "a", x: 0, y: -28 }];
    case "dc-source":
      // Two-terminal source: + on top, − on bottom (stems end at these pins)
      return [
        { id: "pos", x: 0, y: -36, label: "+" },
        { id: "neg", x: 0, y: 36, label: "−" },
      ];
    case "probe":
      return [{ id: "a", x: 0, y: 28 }];
    case "resistor":
    case "inductor":
    case "diode":
    case "led":
    case "diac":
    case "buzzer":
    case "speaker":
    case "motor":
      return [
        { id: "a", x: -40, y: 0 },
        { id: "b", x: 40, y: 0 },
      ];
    case "capacitor":
      return isPolarCap(variant)
        ? [
            { id: "a", x: -40, y: 0, label: "+" },
            { id: "b", x: 40, y: 0, label: "−" },
          ]
        : [
            { id: "a", x: -40, y: 0 },
            { id: "b", x: 40, y: 0 },
          ];
    case "switch":
      if (variant === "spdt") {
        return [
          { id: "com", x: -40, y: 0, label: "COM" },
          { id: "no", x: 40, y: -16, label: "NO" },
          { id: "nc", x: 40, y: 16, label: "NC" },
        ];
      }
      return [
        { id: "a", x: -40, y: 0 },
        { id: "b", x: 40, y: 0 },
      ];
    case "button":
      return [
        { id: "a", x: -40, y: 0 },
        { id: "b", x: 40, y: 0 },
      ];
    case "pot":
      return [
        { id: "a", x: -40, y: 0, label: "1" },
        { id: "w", x: 0, y: 28, label: "W" },
        { id: "b", x: 40, y: 0, label: "2" },
      ];
    case "transistor":
      return [
        { id: "c", x: 0, y: -36, label: "C" },
        { id: "b", x: -36, y: 0, label: "B" },
        { id: "e", x: 0, y: 36, label: "E" },
      ];
    case "thyristor":
      return [
        { id: "a", x: 0, y: -36, label: "A" },
        { id: "k", x: 0, y: 36, label: "K" },
        { id: "g", x: 36, y: 0, label: "G" },
      ];
    case "triac":
      return [
        { id: "a", x: 0, y: -36, label: "MT2" },
        { id: "k", x: 0, y: 36, label: "MT1" },
        { id: "g", x: 36, y: 0, label: "G" },
      ];
    case "relay":
      return [
        { id: "coilA", x: -40, y: -16, label: "A1" },
        { id: "coilB", x: -40, y: 16, label: "A2" },
        { id: "com", x: 40, y: -16, label: "COM" },
        { id: "no", x: 40, y: 16, label: "NO" },
      ];
    case "not":
    case "and":
    case "or":
    case "nand":
    case "nor":
    case "xor":
    case "xnor":
      // 14-pin DIP logic IC (7400-series style)
      return dip14PinDefs(kind, variant);
    case "mcu":
      return [
        { id: "vcc", x: -48, y: -40, label: "VCC" },
        { id: "gnd", x: -48, y: 40, label: "GND" },
        { id: "d2", x: 48, y: -28, label: "D2" },
        { id: "d3", x: 48, y: -8, label: "D3" },
        { id: "d4", x: 48, y: 12, label: "D4" },
        { id: "d5", x: 48, y: 32, label: "D5" },
      ];
    case "lcd":
    case "oled":
      return [
        { id: "vcc", x: -48, y: -20, label: "VCC" },
        { id: "gnd", x: -48, y: 0, label: "GND" },
        { id: "sda", x: -48, y: 20, label: "SDA" },
        { id: "scl", x: 48, y: 0, label: "SCL" },
      ];
    default:
      return [
        { id: "a", x: -40, y: 0 },
        { id: "b", x: 40, y: 0 },
      ];
  }
}

function rotatePoint(p: Point, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  const c = Math.cos(a);
  const s = Math.sin(a);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

function terminalPoint(symbol: SymbolModel, pin: PinId): Point {
  const def = pinsFor(symbol.kind, symbol.variant).find((p) => p.id === pin);
  if (!def) return { x: symbol.x, y: symbol.y };
  const local = rotatePoint({ x: def.x, y: def.y }, symbol.rotation);
  return { x: symbol.x + local.x, y: symbol.y + local.y };
}

function nextRef(kind: SchematicKind, existing: SymbolModel[]): string {
  const prefix = PREFIX[kind] ?? "X";
  if (kind === "vcc" || kind === "gnd") return prefix;
  let n = 1;
  const used = new Set(existing.map((s) => s.label));
  while (used.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/** Draw standard schematic symbol body for the given kind + variant. */
function SymbolBody({ kind, variant, lit = false }: { kind: SchematicKind; variant: string; lit?: boolean }) {
  const s = COLORS.symbol;
  switch (kind) {
    case "resistor":
      if (variant === "smd") {
        return (
          <>
            <rect x="-20" y="-8" width="40" height="16" rx="2" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-36 0H-20M20 0H36" fill="none" stroke={s} strokeWidth="2" />
          </>
        );
      }
      return <path d="M-28 0H-20L-16 -10L-8 10L0 -10L8 10L16 -10L20 0H28" fill="none" stroke={s} strokeWidth="2" strokeLinejoin="round" />;

    case "capacitor":
      if (isPolarCap(variant)) {
        return (
          <>
            <path d="M-28 0H-6" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-6 -14V14" fill="none" stroke={s} strokeWidth="2.5" />
            <path d="M8 -12C14 -6 14 6 8 12" fill="none" stroke={s} strokeWidth="2.5" />
            <path d="M10 0H28" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-18 -10H-12M-15 -13V-7" fill="none" stroke={s} strokeWidth="1.5" />
          </>
        );
      }
      return (
        <>
          <path d="M-28 0H-6M6 0H28" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-6 -14V14M6 -14V14" fill="none" stroke={s} strokeWidth="2.5" />
        </>
      );

    case "inductor":
      return (
        <path
          d="M-28 0H-18C-18 -12 -6 -12 -6 0C-6 -12 6 -12 6 0C6 -12 18 -12 18 0H28"
          fill="none"
          stroke={s}
          strokeWidth="2"
        />
      );

    case "pot":
      return (
        <>
          <path d="M-28 0H-20L-16 -10L-8 10L0 -10L8 10L16 -10L20 0H28" fill="none" stroke={s} strokeWidth="2" strokeLinejoin="round" />
          <path d="M0 0L0 18M-5 13L0 18L5 13" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "diode":
      // Standard: anode (left) —▷|— cathode (right); triangle points to cathode
      if (variant === "zener") {
        return (
          <>
            <path d="M-28 0H-10" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-10 -12L10 0L-10 12Z" fill={s} opacity="0.9" />
            <path d="M10 -12V12" fill="none" stroke={s} strokeWidth="2.5" />
            <path d="M10 -12L16 -16M10 12L16 16" fill="none" stroke={s} strokeWidth="2" />
            <path d="M10 0H28" fill="none" stroke={s} strokeWidth="2" />
          </>
        );
      }
      if (variant === "schottky") {
        return (
          <>
            <path d="M-28 0H-10" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-10 -12L10 0L-10 12Z" fill={s} opacity="0.9" />
            <path d="M10 -12V12" fill="none" stroke={s} strokeWidth="2.5" />
            <path d="M10 -12H6M10 12H14" fill="none" stroke={s} strokeWidth="2" />
            <path d="M10 0H28" fill="none" stroke={s} strokeWidth="2" />
          </>
        );
      }
      return (
        <>
          <path d="M-28 0H-10" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-10 -12L10 0L-10 12Z" fill={s} opacity="0.9" />
          <path d="M10 -12V12" fill="none" stroke={s} strokeWidth="2.5" />
          <path d="M10 0H28" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "led": {
      const ledColor = LED_HEX[variant] ?? LED_HEX.red;
      return (
        <g className={lit ? "led-lit" : undefined}>
          {lit && (
            <>
              <circle cx="0" cy="0" r="22" fill={ledColor} opacity="0.15" className="led-halo" />
              <circle cx="0" cy="0" r="14" fill={ledColor} opacity="0.25" className="led-halo-core" />
            </>
          )}
          <path d="M-28 0H-10" fill="none" stroke={ledColor} strokeWidth="2" />
          <path
            d="M-10 -12L10 0L-10 12Z"
            fill={ledColor}
            opacity={lit ? 1 : 0.85}
            style={lit ? { filter: `drop-shadow(0 0 6px ${ledColor})` } : undefined}
          />
          <path d="M10 -12V12" fill="none" stroke={ledColor} strokeWidth="2.5" />
          <path d="M10 0H28" fill="none" stroke={ledColor} strokeWidth="2" />
          <path
            d="M4 -18L12 -26M10 -18L18 -26"
            fill="none"
            stroke={ledColor}
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity={lit ? 1 : 0.7}
            className={lit ? "led-rays" : undefined}
          />
          <path d="M12 -26L9 -23M12 -26L15 -23" fill="none" stroke={ledColor} strokeWidth="1.3" opacity={lit ? 1 : 0.7} />
          <path d="M18 -26L15 -23M18 -26L21 -23" fill="none" stroke={ledColor} strokeWidth="1.3" opacity={lit ? 1 : 0.7} />
        </g>
      );
    }

    case "diac":
      return (
        <>
          <path d="M-28 0H-10M10 0H28" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-10 -10L0 0L-10 10Z" fill={s} opacity="0.85" />
          <path d="M10 -10L0 0L10 10Z" fill={s} opacity="0.5" />
        </>
      );

    case "transistor": {
      const pnp = isPnp(variant);
      return (
        <>
          <path d="M-18 -22V22" fill="none" stroke={s} strokeWidth="2.5" />
          <path d="M-36 0H-18" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-18 -10L0 -28" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-18 10L0 28" fill="none" stroke={s} strokeWidth="2" />
          <path d="M0 -28V-36M0 28V36" fill="none" stroke={s} strokeWidth="2" />
          {pnp ? (
            <path d="M-6 16L-18 10L-8 8" fill="none" stroke={s} strokeWidth="2" strokeLinejoin="round" />
          ) : (
            <path d="M-10 14L0 28L4 18" fill="none" stroke={s} strokeWidth="2" strokeLinejoin="round" />
          )}
          <text x="18" y="4" fill="#64748b" fontSize="9" fontWeight="600">
            {pnp ? "PNP" : "NPN"}
          </text>
        </>
      );
    }

    case "thyristor":
      return (
        <>
          <path d="M0 -36V-18M0 18V36" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-14 -18H14L0 10Z" fill={s} opacity="0.85" />
          <path d="M-14 18H14" fill="none" stroke={s} strokeWidth="2.5" />
          <path d="M0 0H36" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "triac":
      return (
        <>
          <path d="M0 -36V-18M0 18V36" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-14 -18H14L0 -2Z" fill={s} opacity="0.9" />
          <path d="M-14 18H14L0 2Z" fill={s} opacity="0.5" />
          <path d="M0 0H36" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "switch":
      if (variant === "spdt") {
        return (
          <>
            <circle cx="-20" cy="0" r="3" fill={s} />
            <circle cx="20" cy="-16" r="3" fill={s} />
            <circle cx="20" cy="16" r="3" fill={s} />
            <path d="M-20 0L16 -12" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-36 0H-20M20 -16H36M20 16H36" fill="none" stroke={s} strokeWidth="2" />
          </>
        );
      }
      return (
        <>
          <circle cx="-20" cy="0" r="3" fill={s} />
          <circle cx="20" cy="0" r="3" fill={s} />
          <path d="M-20 0L16 -12" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-28 0H-20M20 0H28" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "button":
      if (variant === "nc") {
        return (
          <>
            <circle cx="-18" cy="0" r="3" fill={s} />
            <circle cx="18" cy="0" r="3" fill={s} />
            <path d="M-18 0H18" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-10 -8H10M0 -8V-16" fill="none" stroke={s} strokeWidth="2" />
            <path d="M-28 0H-18M18 0H28" fill="none" stroke={s} strokeWidth="2" />
          </>
        );
      }
      return (
        <>
          <circle cx="-18" cy="0" r="3" fill={s} />
          <circle cx="18" cy="0" r="3" fill={s} />
          <path d="M-18 0H-6V-10H6V0H18" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-28 0H-18M18 0H28" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "relay":
      return (
        <>
          <rect x="-28" y="-24" width="24" height="48" rx="2" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-22 -8C-18 -16 -10 -16 -6 -8C-10 0 -18 0 -22 -8" fill="none" stroke={s} strokeWidth="1.5" />
          <text x="-16" y="18" textAnchor="middle" fill={s} fontSize="8">coil</text>
          <circle cx="20" cy="-16" r="2.5" fill={s} />
          <circle cx="20" cy="16" r="2.5" fill={s} />
          <path d="M20 -16L32 -8" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-40 -16H-28M-40 16H-28M28 -16H40M28 16H40" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "motor":
      return (
        <>
          <circle cx="0" cy="0" r="18" fill="none" stroke={s} strokeWidth="2" />
          <text x="0" y="5" textAnchor="middle" fill={s} fontSize="14" fontWeight="700">M</text>
          <path d="M-28 0H-18M18 0H28" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "buzzer":
      return (
        <>
          <path d="M-12 -14H4L16 0L4 14H-12Z" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-28 0H-12M16 0H28" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "speaker":
      return (
        <>
          <path d="M-10 -12H2V12H-10Z" fill="none" stroke={s} strokeWidth="2" />
          <path d="M2 -12L16 -20V20L2 12" fill="none" stroke={s} strokeWidth="2" />
          <path d="M-28 0H-10M16 0H28" fill="none" stroke={s} strokeWidth="2" />
        </>
      );

    case "vcc":
      // Rail symbol: label on top, T-bar, stem down to pin at y=28
      return (
        <>
          <text y="-14" textAnchor="middle" fill="#60a5fa" fontSize="11" fontWeight="700">VCC</text>
          <path d="M-14 0H14" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M0 0V28" fill="none" stroke="#60a5fa" strokeWidth="2" />
        </>
      );

    case "gnd":
      // Ground: pin at top (y=-28), stem down into earth bars
      return (
        <>
          <path d="M0 -28V0" fill="none" stroke="#60a5fa" strokeWidth="2" />
          <path d="M-16 0H16" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M-10 7H10" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
          <path d="M-4 14H4" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
        </>
      );

    case "dc-source":
      if (variant === "battery") {
        // Battery cell stack: long plate = +, short = −
        return (
          <>
            <path d="M0 -36V-16" fill="none" stroke="#60a5fa" strokeWidth="2" />
            <path d="M-14 -16H14" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M-8 -8H8" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
            <path d="M-14 0H14" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M-8 8H8" fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
            <path d="M0 8V36" fill="none" stroke="#60a5fa" strokeWidth="2" />
            <text x="20" y="-12" fill="#60a5fa" fontSize="12" fontWeight="700">+</text>
            <text x="20" y="12" fill="#94a3b8" fontSize="12" fontWeight="700">−</text>
          </>
        );
      }
      // Ideal independent voltage source: circle, + top, − bottom, stems to pins
      return (
        <>
          <path d="M0 -36V-20" fill="none" stroke="#60a5fa" strokeWidth="2" />
          <circle cx="0" cy="0" r="20" fill="#0f172a" stroke="#60a5fa" strokeWidth="2.25" />
          <text x="0" y="-6" textAnchor="middle" fill="#60a5fa" fontSize="14" fontWeight="700">+</text>
          <text x="0" y="14" textAnchor="middle" fill="#94a3b8" fontSize="16" fontWeight="700">−</text>
          <path d="M0 20V36" fill="none" stroke="#60a5fa" strokeWidth="2" />
        </>
      );

    case "probe":
      return (
        <>
          <circle r="14" fill="#101827" stroke="#fbbf24" strokeWidth="2" />
          <path d="M-7 7L7-7M-7-7L7 7" stroke="#fbbf24" strokeWidth="2" />
        </>
      );

    case "not":
    case "and":
    case "or":
    case "nand":
    case "nor":
    case "xor":
    case "xnor": {
      const pkg = logicPackageLabel(kind, variant);
      const s2 = "#64748b";
      // Mini gate glyph helpers (local coordinates)
      const andG = (x: number, y: number, inv = false) => (
        <g key={`g-${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M-8 -6H0C5 -6 8 -3 8 0C8 3 5 6 0 6H-8Z" fill="none" stroke={s2} strokeWidth="1.2" />
          {inv && <circle cx="10.5" cy="0" r="2" fill="none" stroke={s2} strokeWidth="1.2" />}
        </g>
      );
      const orG = (x: number, y: number, inv = false) => (
        <g key={`g-${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M-8 -6C-2 -6 2 -3 5 0C2 3 -2 6 -8 6C-5 2 -5 -2 -8 -6" fill="none" stroke={s2} strokeWidth="1.2" />
          {inv && <circle cx="7.5" cy="0" r="2" fill="none" stroke={s2} strokeWidth="1.2" />}
        </g>
      );
      const notG = (x: number, y: number) => (
        <g key={`g-${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M-6 -5V5L6 0Z" fill="none" stroke={s2} strokeWidth="1.2" />
          <circle cx="8" cy="0" r="2" fill="none" stroke={s2} strokeWidth="1.2" />
        </g>
      );
      const xorG = (x: number, y: number, inv = false) => (
        <g key={`g-${x}-${y}`} transform={`translate(${x} ${y})`}>
          <path d="M-10 -6C-7 -2 -7 2 -10 6" fill="none" stroke={s2} strokeWidth="1.2" />
          <path d="M-7 -6C-1 -6 3 -3 6 0C3 3 -1 6 -7 6C-4 2 -4 -2 -7 -6" fill="none" stroke={s2} strokeWidth="1.2" />
          {inv && <circle cx="8.5" cy="0" r="2" fill="none" stroke={s2} strokeWidth="1.2" />}
        </g>
      );

      let gates = [] as any[];
      if (kind === "not" || pkg === "7404") {
        gates = [notG(-28, -16), notG(0, -16), notG(28, -16), notG(-28, 16), notG(0, 16), notG(28, 16)];
      } else if (kind === "nand" && pkg === "7410") {
        gates = [andG(-24, -14, true), andG(24, -14, true), andG(0, 16, true)];
      } else if (kind === "nand" && pkg === "7420") {
        gates = [andG(-20, 0, true), andG(24, 0, true)];
      } else if (kind === "nand" || pkg === "7400") {
        gates = [andG(-24, -14, true), andG(24, -14, true), andG(-24, 14, true), andG(24, 14, true)];
      } else if (kind === "nor" || pkg === "7402") {
        gates = [orG(-24, -14, true), orG(24, -14, true), orG(-24, 14, true), orG(24, 14, true)];
      } else if (kind === "and" || pkg === "7408") {
        gates = [andG(-24, -14), andG(24, -14), andG(-24, 14), andG(24, 14)];
      } else if (kind === "or" || pkg === "7432") {
        gates = [orG(-24, -14), orG(24, -14), orG(-24, 14), orG(24, 14)];
      } else if (kind === "xor" || pkg === "7486") {
        gates = [xorG(-24, -14), xorG(24, -14), xorG(-24, 14), xorG(24, 14)];
      } else {
        gates = [xorG(-24, -14, true), xorG(24, -14, true), xorG(-24, 14, true), xorG(24, 14, true)];
      }

      // Pin stubs from body edge to pin pads
      const stubs = [] as any[];
      for (let i = 1; i <= 7; i++) {
        const x = -48 + (i - 1) * 16;
        stubs.push(<path key={`sb${i}`} d={`M${x} 30V42`} fill="none" stroke={s} strokeWidth="1.5" />);
      }
      for (let i = 8; i <= 14; i++) {
        const x = -48 + (14 - i) * 16;
        stubs.push(<path key={`st${i}`} d={`M${x} -30V-42`} fill="none" stroke={s} strokeWidth="1.5" />);
      }

      return (
        <>
          {/* DIP body */}
          <rect x="-56" y="-30" width="112" height="60" rx="3" fill="#0f172a" stroke={s} strokeWidth="2" />
          {/* Notch */}
          <path d="M-56 -8A8 8 0 0 1 -56 8" fill="none" stroke={s} strokeWidth="1.5" />
          {stubs}
          {/* Pin numbers */}
          {Array.from({ length: 7 }, (_, i) => (
            <text key={`n${i + 1}`} x={-48 + i * 16} y={26} textAnchor="middle" fill="#475569" fontSize="7">
              {i + 1}
            </text>
          ))}
          {Array.from({ length: 7 }, (_, i) => (
            <text key={`n${14 - i}`} x={-48 + i * 16} y={-20} textAnchor="middle" fill="#475569" fontSize="7">
              {14 - i}
            </text>
          ))}
          {/* VCC / GND labels */}
          <text x={-48} y={-12} textAnchor="middle" fill="#60a5fa" fontSize="6" fontWeight="700">
            VCC
          </text>
          <text x={48} y={18} textAnchor="middle" fill="#60a5fa" fontSize="6" fontWeight="700">
            GND
          </text>
          {/* Internal gates */}
          {gates}
          {/* Part number */}
          <text y={4} textAnchor="middle" fill="#94a3b8" fontSize="9" fontWeight="700">
            {pkg}
          </text>
        </>
      );
    }


    case "mcu":
      return (
        <>
          <rect x="-36" y="-44" width="72" height="88" rx="4" fill="#101827" stroke={s} strokeWidth="2" />
          <text y="-4" textAnchor="middle" fill={s} fontSize="11" fontWeight="700">MCU</text>
          <text y="12" textAnchor="middle" fill="#64748b" fontSize="9">
            {variant === "esp32" ? "ESP32" : "Arduino"}
          </text>
        </>
      );

    case "lcd":
      return (
        <>
          <rect x="-40" y="-28" width="80" height="56" rx="3" fill="#101827" stroke={s} strokeWidth="2" />
          <rect x="-28" y="-14" width="56" height="20" fill="#1e3a5f" stroke="#3b82f6" strokeWidth="1" />
          <text y="24" textAnchor="middle" fill={s} fontSize="9">LCD 16×2</text>
        </>
      );

    case "oled":
      return (
        <>
          <rect x="-40" y="-28" width="80" height="56" rx="3" fill="#101827" stroke={s} strokeWidth="2" />
          <rect x="-28" y="-14" width="56" height="20" fill="#0f172a" stroke="#64748b" strokeWidth="1" />
          <text y="24" textAnchor="middle" fill={s} fontSize="9">OLED</text>
        </>
      );

    default:
      return <rect x="-24" y="-16" width="48" height="32" rx="3" fill="none" stroke={s} strokeWidth="2" />;
  }
}



function orthogonalPath(points: Point[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    if (prev.x === curr.x || prev.y === curr.y) {
      parts.push(`L ${curr.x} ${curr.y}`);
    } else {
      // Prefer horizontal-then-vertical for a clean schematic look
      const midX = snap((prev.x + curr.x) / 2);
      parts.push(`L ${midX} ${prev.y} L ${midX} ${curr.y} L ${curr.x} ${curr.y}`);
    }
  }
  return parts.join(" ");
}


/** Parse a schematic value string into ohms (educational model). */
function parseResistance(value: string, kind: SchematicKind): number {
  const v = (value || "").trim().toLowerCase().replace(/\s/g, "");
  if (!v) {
    if (kind === "resistor" || kind === "pot") return 1000;
    if (kind === "led") return 100;
    if (kind === "diode") return 50;
    if (kind === "motor" || kind === "buzzer" || kind === "speaker") return 30;
    if (kind === "inductor") return 5;
    if (kind === "capacitor") return 1e9;
    return 100;
  }
  const m = v.match(/^([0-9]*\.?[0-9]+)\s*([kmg])?(ohm|ω|Ω|r)?$/i);
  if (m) {
    let n = parseFloat(m[1]);
    const u = (m[2] || "").toLowerCase();
    if (u === "k") n *= 1e3;
    if (u === "m") n *= 1e6;
    if (u === "g") n *= 1e9;
    return Math.max(n, 0.01);
  }
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 1000;
}


/**
 * Independent schematic current-flow model (NOT the 3D lab simulator).
 *
 * Robust against "looks connected but terminal metadata is missing":
 * wire ends are snapped to nearby pins by geometry, then a path search
 * from every source (+) to every source (−)/GND marks live wires.
 */

/** Re-attach only free wire ends to the nearest pin. Never steal an existing valid terminal. */
function rebindWireEndpoints(symbols: SymbolModel[], wires: SchematicWire[]): SchematicWire[] {
  const LOGIC = new Set(["not", "and", "or", "nand", "nor", "xor", "xnor"]);
  const pinRefs: { symbolId: string; pin: string; x: number; y: number; tight: boolean }[] = [];
  for (const sym of symbols) {
    const tight = LOGIC.has(sym.kind); // DIP pins are dense — require closer snap
    for (const p of pinsFor(sym.kind, sym.variant)) {
      const pt = terminalPoint(sym, p.id);
      pinRefs.push({ symbolId: sym.id, pin: p.id, x: pt.x, y: pt.y, tight });
    }
  }
  const nearest = (pt: Point): Terminal | undefined => {
    let best: { t: Terminal; d: number } | undefined;
    for (const pr of pinRefs) {
      const limit = pr.tight ? 12 : 20;
      const d = Math.hypot(pr.x - pt.x, pr.y - pt.y);
      if (d <= limit && (!best || d < best.d)) best = { t: { symbolId: pr.symbolId, pin: pr.pin }, d };
    }
    return best?.t;
  };
  const resolveEnd = (end: Endpoint): Endpoint => {
    // Keep explicit terminal if the symbol still exists
    if (end.terminal) {
      const s = symbols.find((x) => x.id === end.terminal!.symbolId);
      if (s) {
        const pins = pinsFor(s.kind, s.variant);
        if (pins.some((p) => p.id === end.terminal!.pin)) {
          return { terminal: end.terminal, point: terminalPoint(s, end.terminal.pin) };
        }
      }
    }
    // Free end — snap only if clearly on a pin
    const term = nearest(end.point);
    if (term) {
      const s = symbols.find((x) => x.id === term.symbolId)!;
      return { terminal: term, point: terminalPoint(s, term.pin) };
    }
    return { point: { x: snap(end.point.x), y: snap(end.point.y) } };
  };
  return wires.map((w) => ({ ...w, a: resolveEnd(w.a), b: resolveEnd(w.b) }));
}



/** True if point is on a component pin. */
function pointOnPin(symbols: SymbolModel[], pt: Point, limit = 14): boolean {
  for (const sym of symbols) {
    for (const p of pinsFor(sym.kind, sym.variant)) {
      const tp = terminalPoint(sym, p.id);
      if (Math.hypot(tp.x - pt.x, tp.y - pt.y) < limit) return true;
    }
  }
  return false;
}

/** Create junction dots at every wire end that is not on a component pin. */
function ensureFreeEndJunctions(
  symbols: SymbolModel[],
  wires: SchematicWire[],
  junctions: Junction[]
): Junction[] {
  const next = [...junctions];
  const hasNear = (pt: Point) => next.some((j) => Math.hypot(j.x - pt.x, j.y - pt.y) < 12);

  for (const w of wires) {
    for (const end of [w.a, w.b]) {
      let pt: Point;
      if (end.terminal) {
        const s = symbols.find((x) => x.id === end.terminal!.symbolId);
        if (s) {
          const pins = pinsFor(s.kind, s.variant);
          if (pins.some((p) => p.id === end.terminal!.pin)) continue;
        }
        pt = end.point;
      } else {
        pt = { x: snap(end.point.x), y: snap(end.point.y) };
      }
      if (pointOnPin(symbols, pt)) continue;
      if (hasNear(pt)) continue;
      next.push({ id: uid("junction"), x: pt.x, y: pt.y });
    }
  }
  return next;
}

type WireFlow = { activity: number; /** true = conventional current along wire a → b */ aToB: boolean };

/** 74xx gate definitions: pin numbers on the DIP-14 package. */
type GateDef = { inputs: number[]; output: number; op: "not" | "and" | "or" | "nand" | "nor" | "xor" | "xnor" };

function gatesForPackage(kind: SchematicKind, variant: string): GateDef[] {
  const pkg = (variant || "").toLowerCase() || {
    not: "7404", and: "7408", or: "7432", nand: "7400", nor: "7402", xor: "7486", xnor: "747266",
  }[kind as string] || "";

  // 7404 hex inverter: 1→2, 3→4, 5→6, 9→8, 11→10, 13→12
  if (kind === "not" || pkg === "7404") {
    return [
      { inputs: [1], output: 2, op: "not" },
      { inputs: [3], output: 4, op: "not" },
      { inputs: [5], output: 6, op: "not" },
      { inputs: [9], output: 8, op: "not" },
      { inputs: [11], output: 10, op: "not" },
      { inputs: [13], output: 12, op: "not" },
    ];
  }
  // 7402 quad NOR — unique pinout (output is first pin of each gate group)
  if (kind === "nor" || pkg === "7402") {
    return [
      { inputs: [2, 3], output: 1, op: "nor" },
      { inputs: [5, 6], output: 4, op: "nor" },
      { inputs: [8, 9], output: 10, op: "nor" },
      { inputs: [11, 12], output: 13, op: "nor" },
    ];
  }
  // 7410 triple 3-input NAND
  if (pkg === "7410") {
    return [
      { inputs: [1, 2, 13], output: 12, op: "nand" },
      { inputs: [3, 4, 5], output: 6, op: "nand" },
      { inputs: [9, 10, 11], output: 8, op: "nand" },
    ];
  }
  // 7420 dual 4-input NAND
  if (pkg === "7420") {
    return [
      { inputs: [1, 2, 4, 5], output: 6, op: "nand" },
      { inputs: [9, 10, 12, 13], output: 8, op: "nand" },
    ];
  }
  // 7400 / 7408 / 7432 / 7486 / 74LS266 style quad 2-input (same pinout)
  const op: GateDef["op"] =
    kind === "and" || pkg === "7408" ? "and" :
    kind === "or" || pkg === "7432" ? "or" :
    kind === "xor" || pkg === "7486" ? "xor" :
    kind === "xnor" || pkg.includes("266") ? "xnor" :
    "nand";
  return [
    { inputs: [1, 2], output: 3, op },
    { inputs: [4, 5], output: 6, op },
    { inputs: [9, 10], output: 8, op },
    { inputs: [12, 13], output: 11, op },
  ];
}

function evalGate(op: GateDef["op"], inputs: boolean[]): boolean {
  switch (op) {
    case "not":
      return !inputs[0];
    case "and":
      return inputs.every(Boolean);
    case "or":
      return inputs.some(Boolean);
    case "nand":
      return !inputs.every(Boolean);
    case "nor":
      return !inputs.some(Boolean);
    case "xor":
      return inputs.filter(Boolean).length % 2 === 1;
    case "xnor":
      return inputs.filter(Boolean).length % 2 === 0;
    default:
      return false;
  }
}

/**
 * Hybrid schematic simulator:
 * 1) Wire connectivity → nets
 * 2) Sources drive HIGH / LOW nets
 * 3) 74xx logic ICs evaluate when powered (pin 14 VCC, pin 7 GND)
 * 4) Gate outputs force nets HIGH or LOW
 * 5) Current only flows through passives between HIGH and LOW nets
 *    (logic ICs are NOT resistive shorts between pins)
 */
function simulateSchematic(
  symbols: SymbolModel[],
  wires: SchematicWire[],
  powerOn: boolean,
  psuVoltage: number
): Map<string, WireFlow> {
  const activity = new Map<string, WireFlow>();
  if (!powerOn || symbols.length === 0) return activity;

  const pinNode = (symbolId: string, pin: string) => `${symbolId}::${pin}`;

  type PinRef = { node: string; x: number; y: number; symbolId: string; pin: string };
  const pinRefs: PinRef[] = [];
  for (const sym of symbols) {
    for (const p of pinsFor(sym.kind, sym.variant)) {
      const pt = terminalPoint(sym, p.id);
      pinRefs.push({ node: pinNode(sym.id, p.id), x: pt.x, y: pt.y, symbolId: sym.id, pin: p.id });
    }
  }

  const LOGIC_KINDS_SNAP = new Set(["not", "and", "or", "nand", "nor", "xor", "xnor"]);

  const resolveEndpoint = (endpoint: Endpoint): string => {
    // Explicit terminal always wins
    if (endpoint.terminal) {
      const sym = symbols.find((s) => s.id === endpoint.terminal!.symbolId);
      if (sym) {
        const pins = pinsFor(sym.kind, sym.variant);
        if (pins.some((p) => p.id === endpoint.terminal!.pin)) {
          return pinNode(endpoint.terminal.symbolId, endpoint.terminal.pin);
        }
      }
    }
    let best: { node: string; d: number } | null = null;
    for (const pr of pinRefs) {
      const sym = symbols.find((s) => s.id === pr.symbolId);
      const tight = sym ? LOGIC_KINDS_SNAP.has(sym.kind) : false;
      const limit = tight ? 12 : 20;
      const d = Math.hypot(pr.x - endpoint.point.x, pr.y - endpoint.point.y);
      if (d <= limit && (!best || d < best.d)) best = { node: pr.node, d };
    }
    if (best) return best.node;
    return `free::${snap(endpoint.point.x)},${snap(endpoint.point.y)}`;
  };

  // ---- Union-Find for wire-shorted nets only (no component edges yet) ----
  const parent = new Map<string, string>();
  const find = (a: string): string => {
    if (!parent.has(a)) parent.set(a, a);
    let x = a;
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const pr of pinRefs) find(pr.node);

  const resolvedWires: { id: string; a: string; b: string }[] = [];
  for (const w of wires) {
    const na = resolveEndpoint(w.a);
    const nb = resolveEndpoint(w.b);
    find(na);
    find(nb);
    union(na, nb);
    resolvedWires.push({ id: w.id, a: na, b: nb });
  }

  // Also short free nodes at identical coordinates (already same key via snap)

  // ---- Seed digital levels from sources ----
  // netLevel: root → true(HIGH) | false(LOW) | undefined(floating)
  const netLevel = new Map<string, boolean | undefined>();

  const setNet = (node: string, level: boolean) => {
    const r = find(node);
    const prev = netLevel.get(r);
    // GND / LOW wins conflicts with HIGH for safety; last write otherwise
    if (prev === undefined) netLevel.set(r, level);
    else if (prev !== level && level === false) netLevel.set(r, false);
  };

  for (const sym of symbols) {
    if (sym.kind === "vcc") setNet(pinNode(sym.id, "a"), true);
    else if (sym.kind === "gnd") setNet(pinNode(sym.id, "a"), false);
    else if (sym.kind === "dc-source") {
      setNet(pinNode(sym.id, "pos"), true);
      setNet(pinNode(sym.id, "neg"), false);
    }
  }

  // ---- Evaluate logic ICs (combinational, few iterations for chains) ----
  const LOGIC_KINDS = new Set(["not", "and", "or", "nand", "nor", "xor", "xnor"]);

  for (let iter = 0; iter < 6; iter++) {
    let changed = false;
    for (const sym of symbols) {
      if (!LOGIC_KINDS.has(sym.kind)) continue;

      const vccNode = pinNode(sym.id, "p14");
      const gndNode = pinNode(sym.id, "p7");
      const vccLvl = netLevel.get(find(vccNode));
      const gndLvl = netLevel.get(find(gndNode));
      // IC must have VCC high and GND low to operate
      const powered = vccLvl === true && gndLvl === false;
      if (!powered) continue;

      for (const gate of gatesForPackage(sym.kind, sym.variant)) {
        // Only evaluate when every input is driven (HIGH or LOW). Floating = no output drive.
        const levels = gate.inputs.map((pinNum) => netLevel.get(find(pinNode(sym.id, `p${pinNum}`))));
        if (levels.some((l) => l === undefined)) continue;
        const inputs = levels.map((l) => l === true);
        const out = evalGate(gate.op, inputs);
        const outRoot = find(pinNode(sym.id, `p${gate.output}`));
        const prev = netLevel.get(outRoot);
        if (prev !== out) {
          netLevel.set(outRoot, out);
          changed = true;
        }
      }
    }
    if (!changed) break;
  }

  // ---- Passive conduction graph for current flow (LEDs, resistors, etc.) ----
  // Nodes at digital HIGH act like connected to + ; LOW to −
  type Adj = { to: string; r: number; wireId?: string };
  const adj = new Map<string, Adj[]>();
  const addEdge = (a: string, b: string, r: number, wireId?: string) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a)!.push({ to: b, r, wireId });
    adj.get(b)!.push({ to: a, r, wireId });
  };

  // Ideal short: every pin/node on the same net (wire-union) shares a supernode —
  // model as edges along each wire (R≈0) and also link all nodes in a net together via find roots
  for (const w of resolvedWires) {
    addEdge(w.a, w.b, 0.001, w.id);
  }

  // Passive components only (NOT logic IC pins)
  for (const sym of symbols) {
    if (LOGIC_KINDS.has(sym.kind)) continue;
    if (sym.kind === "vcc" || sym.kind === "gnd" || sym.kind === "dc-source" || sym.kind === "probe") continue;
    if (sym.kind === "button" || sym.kind === "capacitor") continue;
    if (["mcu", "lcd", "oled"].includes(sym.kind)) continue;

    const pins = pinsFor(sym.kind, sym.variant);
    if (pins.length < 2) continue;

    if (sym.kind === "switch" && sym.variant === "spdt") {
      const com = pins.find((p) => p.id === "com");
      const no = pins.find((p) => p.id === "no");
      if (com && no) addEdge(pinNode(sym.id, com.id), pinNode(sym.id, no.id), 0.05);
      continue;
    }
    if (sym.kind === "transistor") {
      const c = pins.find((p) => p.id === "c");
      const e = pins.find((p) => p.id === "e");
      const b = pins.find((p) => p.id === "b");
      if (c && e) addEdge(pinNode(sym.id, c.id), pinNode(sym.id, e.id), 50);
      if (b && e) addEdge(pinNode(sym.id, b.id), pinNode(sym.id, e.id), 1000);
      continue;
    }
    if (sym.kind === "relay") {
      const a1 = pins.find((p) => p.id === "coilA");
      const a2 = pins.find((p) => p.id === "coilB");
      if (a1 && a2) addEdge(pinNode(sym.id, a1.id), pinNode(sym.id, a2.id), 200);
      continue;
    }
    if (sym.kind === "pot" && pins.length >= 3) {
      const r = parseResistance(sym.value, sym.kind);
      addEdge(pinNode(sym.id, "a"), pinNode(sym.id, "w"), r / 2);
      addEdge(pinNode(sym.id, "w"), pinNode(sym.id, "b"), r / 2);
      continue;
    }
    const r = parseResistance(sym.value, sym.kind);
    addEdge(pinNode(sym.id, pins[0].id), pinNode(sym.id, pins[pins.length - 1].id), Math.max(r, 0.01));
  }

  // Collect power (HIGH) and return (LOW) nodes from sources + gate outputs
  const powerNodes: string[] = [];
  const returnNodes: string[] = [];

  for (const sym of symbols) {
    if (sym.kind === "vcc") powerNodes.push(pinNode(sym.id, "a"));
    else if (sym.kind === "gnd") returnNodes.push(pinNode(sym.id, "a"));
    else if (sym.kind === "dc-source") {
      powerNodes.push(pinNode(sym.id, "pos"));
      returnNodes.push(pinNode(sym.id, "neg"));
    }
  }

  // Gate outputs that are HIGH act as power sources; LOW act as returns
  // (TTL totem-pole can source/sink — model as connection to rail)
  for (const sym of symbols) {
    if (!LOGIC_KINDS.has(sym.kind)) continue;
    const vccLvl = netLevel.get(find(pinNode(sym.id, "p14")));
    const gndLvl = netLevel.get(find(pinNode(sym.id, "p7")));
    if (vccLvl !== true || gndLvl !== false) continue;

    // Connect VCC pin to ideal power, GND to ideal return (already via wires ideally)
    powerNodes.push(pinNode(sym.id, "p14"));
    returnNodes.push(pinNode(sym.id, "p7"));

    for (const gate of gatesForPackage(sym.kind, sym.variant)) {
      const outNode = pinNode(sym.id, `p${gate.output}`);
      const lvl = netLevel.get(find(outNode));
      if (lvl === true) {
        // Output HIGH: can source current from VCC into the load
        addEdge(pinNode(sym.id, "p14"), outNode, 50); // output impedance ~50Ω
        powerNodes.push(outNode);
      } else if (lvl === false) {
        // Output LOW: can sink current to GND
        addEdge(outNode, pinNode(sym.id, "p7"), 50);
        returnNodes.push(outNode);
      }
    }
  }

  if (!powerNodes.length || !returnNodes.length) return activity;

  // Dijkstra from HIGH nodes
  const dist = new Map<string, number>();
  const viaWire = new Map<string, Set<string>>();
  const heap: { node: string; d: number }[] = [];

  for (const p of powerNodes) {
    dist.set(p, 0);
    viaWire.set(p, new Set());
    heap.push({ node: p, d: 0 });
  }

  while (heap.length) {
    heap.sort((a, b) => a.d - b.d);
    const cur = heap.shift()!;
    const curD = dist.get(cur.node);
    if (curD === undefined || cur.d > curD + 1e-12) continue;
    const curWires = viaWire.get(cur.node) ?? new Set();
    for (const e of adj.get(cur.node) ?? []) {
      const nd = cur.d + e.r;
      const prev = dist.get(e.to);
      if (prev === undefined || nd < prev - 1e-9) {
        dist.set(e.to, nd);
        const nextW = new Set(curWires);
        if (e.wireId) nextW.add(e.wireId);
        viaWire.set(e.to, nextW);
        heap.push({ node: e.to, d: nd });
      } else if (prev !== undefined && Math.abs(nd - prev) <= 1e-9) {
        const existing = viaWire.get(e.to) ?? new Set();
        let changed = false;
        for (const id of curWires) {
          if (!existing.has(id)) {
            existing.add(id);
            changed = true;
          }
        }
        if (e.wireId && !existing.has(e.wireId)) {
          existing.add(e.wireId);
          changed = true;
        }
        if (changed) viaWire.set(e.to, existing);
      }
    }
  }

  // Nodes that can reach a return (GND / source − / LOW output)
  const canReturn = new Set<string>();
  {
    const rev = new Map<string, string[]>();
    for (const [a, list] of adj) {
      for (const e of list) {
        if (!rev.has(e.to)) rev.set(e.to, []);
        rev.get(e.to)!.push(a);
      }
    }
    const rq = [...returnNodes];
    for (const n of rq) canReturn.add(n);
    while (rq.length) {
      const n = rq.pop()!;
      for (const prev of rev.get(n) ?? []) {
        if (!canReturn.has(prev)) {
          canReturn.add(prev);
          rq.push(prev);
        }
      }
    }
  }

  const reachPower = new Set(dist.keys());

  // Path resistance for intensity (cheapest power→return path)
  let pathR = Infinity;
  for (const g of returnNodes) {
    if (dist.has(g)) pathR = Math.min(pathR, dist.get(g)!);
  }
  if (!Number.isFinite(pathR)) return activity;
  const iEst = psuVoltage / Math.max(pathR, 0.1);
  const act = Math.min(1, Math.max(0.35, iEst / 0.015));

  // Mark EVERY wire whose both ends are on a live path (reachable from + AND can reach −).
  // This includes the source + feed wire, which the pure Dijkstra viaWire set often skipped
  // because both ends start at dist=0 (both treated as power seeds).
  for (const w of resolvedWires) {
    const liveA = reachPower.has(w.a) && canReturn.has(w.a);
    const liveB = reachPower.has(w.b) && canReturn.has(w.b);
    if (!liveA || !liveB) continue;

    const da = dist.get(w.a) ?? 0;
    const db = dist.get(w.b) ?? 0;
    // Conventional current: away from source (+) toward return (−)
    let aToB = da <= db;
    // Tie-break when both ends are at the source rail (dist 0): flow from actual source pin outward
    if (Math.abs(da - db) < 1e-12) {
      const aIsSrc = powerNodes.includes(w.a);
      const bIsSrc = powerNodes.includes(w.b);
      if (aIsSrc && !bIsSrc) aToB = true;
      else if (bIsSrc && !aIsSrc) aToB = false;
    }
    activity.set(w.id, { activity: act, aToB });
  }

  return activity;
}

function glowColor(activity: number): string {
  if (activity < 0.35) return "#22d3ee";
  if (activity < 0.7) return "#34d399";
  return "#fbbf24";
}

export function Schematic2D({
  compact = false,
  initialFile,
}: {
  compact?: boolean;
  initialFile?: SchematicFile;
}) {
  // Independent of the 3D breadboard lab
  const [symbols, setSymbols] = useState<SymbolModel[]>([]);
  const [wires, setWires] = useState<SchematicWire[]>([]);
  const [powerOn, setPowerOn] = useState(false);
  const [psuVoltage, setPsuVoltage] = useState(5);
  const togglePower = () => setPowerOn((v) => !v);
  const setVoltage = (v: number) => setPsuVoltage(Math.max(0.5, Math.min(24, v)));
  const [junctions, setJunctions] = useState<Junction[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [tool, setTool] = useState<"select" | "wire" | "junction" | "pan">("select");
  const [wireDraft, setWireDraft] = useState<{ start: Endpoint; points: Point[]; cursor?: Point } | null>(null);
  const [drag, setDrag] = useState<{ id: string; offset: Point } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [future, setFuture] = useState<Snapshot[]>([]);
  const [componentSearch, setComponentSearch] = useState("");
  const [showGrid, setShowGrid] = useState(true);
  const [spaceDown, setSpaceDown] = useState(false);
  const [fileName, setFileName] = useState("Untitled Schematic");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [showRecent, setShowRecent] = useState(true);
  const [recentSchematics, setRecentSchematics] = useState<RecentSchematic[]>([]);
  const importInputRef = useRef<HTMLInputElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const hydratedRef = useRef(false);
  const autosaveKey = "electrolab:schematic:autosave";
  const recentKey = "electrolab:schematic:recent";

  // Keep a junction at every unconnected wire end so users can always attach parts
  useEffect(() => {
    setJunctions((js) => {
      const next = ensureFreeEndJunctions(symbols, wires, js);
      return next.length === js.length ? js : next;
    });
  }, [symbols, wires]);


  const snapshot = (): Snapshot => ({ symbols, wires, junctions });
  const commit = (update: () => void) => {
    setHistory((items) => [...items.slice(-39), snapshot()]);
    setFuture([]);
    update();
  };
  const restore = (value: Snapshot) => {
    setSymbols(value.symbols);
    setWires(value.wires);
    setJunctions(value.junctions);
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setFuture((items) => [snapshot(), ...items]);
    restore(previous);
    setHistory((items) => items.slice(0, -1));
    setSelected(null);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setHistory((items) => [...items, snapshot()]);
    restore(next);
    setFuture((items) => items.slice(1));
  };

  const fileData = (): SchematicFile => ({
    format: "electrolab-schematic",
    version: 1,
    name: fileName,
    psuVoltage,
    symbols,
    wires,
    junctions,
  });

  const downloadFile = (content: string, name: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const saveLocal = () => {
    const saved = { ...fileData(), savedAt: Date.now() };
    localStorage.setItem(autosaveKey, JSON.stringify(saved));
    setRecentSchematics((items) => {
      const next = [saved, ...items.filter((item) => item.name !== saved.name)].slice(0, 8);
      localStorage.setItem(recentKey, JSON.stringify(next));
      return next;
    });
    setOpenMenu(null);
  };

  const saveAs = () => {
    const name = window.prompt("Save schematic as:", fileName);
    if (!name?.trim()) return;
    setFileName(name.trim());
    const saved = { ...fileData(), name: name.trim(), savedAt: Date.now() };
    localStorage.setItem(autosaveKey, JSON.stringify(saved));
    setRecentSchematics((items) => {
      const next = [saved, ...items.filter((item) => item.name !== saved.name)].slice(0, 8);
      localStorage.setItem(recentKey, JSON.stringify(next));
      return next;
    });
    setOpenMenu(null);
  };

  const newSchematic = () => {
    if ((symbols.length || wires.length) && !window.confirm("Start a new schematic? Unsaved changes will be replaced.")) return;
    setSymbols([]);
    setWires([]);
    setJunctions([]);
    setSelected(null);
    setHistory([]);
    setFuture([]);
    setFileName("Untitled Schematic");
    setOpenMenu(null);
  };

  const exportJson = () => {
    downloadFile(`${JSON.stringify(fileData(), null, 2)}\n`, `${fileName.replace(/[^a-z0-9-_]+/gi, "-") || "schematic"}.json`, "application/json");
    setOpenMenu(null);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as Partial<SchematicFile>;
        if (parsed.format !== "electrolab-schematic" || !Array.isArray(parsed.symbols) || !Array.isArray(parsed.wires)) {
          throw new Error("Invalid ElectroLab schematic file.");
        }
        setSymbols(parsed.symbols);
        setWires(parsed.wires);
        setJunctions(Array.isArray(parsed.junctions) ? parsed.junctions : []);
        setPsuVoltage(typeof parsed.psuVoltage === "number" ? Math.max(0.5, Math.min(24, parsed.psuVoltage)) : 5);
        setFileName(parsed.name?.trim() || file.name.replace(/\.json$/i, ""));
        setSelected(null);
        setHistory([]);
        setFuture([]);
        const saved: RecentSchematic = {
          format: "electrolab-schematic",
          version: 1,
          name: parsed.name?.trim() || file.name.replace(/\.json$/i, ""),
          psuVoltage: typeof parsed.psuVoltage === "number" ? parsed.psuVoltage : 5,
          symbols: parsed.symbols,
          wires: parsed.wires,
          junctions: Array.isArray(parsed.junctions) ? parsed.junctions : [],
          savedAt: Date.now(),
        };
        setRecentSchematics((items) => {
          const next = [saved, ...items.filter((item) => item.name !== saved.name)].slice(0, 8);
          localStorage.setItem(recentKey, JSON.stringify(next));
          return next;
        });
      } catch {
        window.alert("That file is not a valid ElectroLab schematic.");
      }
    };
    reader.readAsText(file);
    setOpenMenu(null);
  };

  const exportSvg = () => {
    if (!svgRef.current) return;
    const copy = svgRef.current.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    downloadFile(new XMLSerializer().serializeToString(copy), `${fileName.replace(/[^a-z0-9-_]+/gi, "-") || "schematic"}.svg`, "image/svg+xml");
    setOpenMenu(null);
  };

  useEffect(() => {
    const recent = localStorage.getItem(recentKey);
    if (recent) {
      try {
        const parsed = JSON.parse(recent) as RecentSchematic[];
        if (Array.isArray(parsed)) setRecentSchematics(parsed.slice(0, 8));
      } catch {
        localStorage.removeItem(recentKey);
      }
    }
    if (initialFile) {
      setSymbols(initialFile.symbols);
      setWires(initialFile.wires);
      setJunctions(initialFile.junctions);
      setPsuVoltage(initialFile.psuVoltage);
      setFileName(initialFile.name);
      hydratedRef.current = true;
      return;
    }
    const raw = localStorage.getItem(autosaveKey);
    if (!raw) {
      hydratedRef.current = true;
      return;
    }
    try {
      const saved = JSON.parse(raw) as Partial<SchematicFile>;
      if (saved.format === "electrolab-schematic" && Array.isArray(saved.symbols) && Array.isArray(saved.wires)) {
        setSymbols(saved.symbols);
        setWires(saved.wires);
        setJunctions(Array.isArray(saved.junctions) ? saved.junctions : []);
        setPsuVoltage(typeof saved.psuVoltage === "number" ? saved.psuVoltage : 5);
        setFileName(saved.name?.trim() || "Untitled Schematic");
      }
    } catch {
      localStorage.removeItem(autosaveKey);
    }
    hydratedRef.current = true;
  }, [initialFile]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      const saved: RecentSchematic = { ...fileData(), savedAt: Date.now() };
      localStorage.setItem(autosaveKey, JSON.stringify(saved));
      setRecentSchematics((items) => {
        const next = [saved, ...items.filter((item) => item.name !== saved.name)].slice(0, 8);
        localStorage.setItem(recentKey, JSON.stringify(next));
        return next;
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [symbols, wires, junctions, psuVoltage, fileName]);

  const openRecent = (saved: RecentSchematic) => {
    setSymbols(saved.symbols);
    setWires(saved.wires);
    setJunctions(saved.junctions);
    setPsuVoltage(saved.psuVoltage);
    setFileName(saved.name);
    setSelected(null);
    setHistory([]);
    setFuture([]);
    setOpenMenu(null);
    localStorage.setItem(autosaveKey, JSON.stringify(saved));
  };

  const removeRecent = (name: string) => {
    setRecentSchematics((items) => {
      const next = items.filter((item) => item.name !== name);
      localStorage.setItem(recentKey, JSON.stringify(next));
      return next;
    });
  };

  const selectedSymbol = symbols.find((item) => item.id === selected);

  const pointFromEvent = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const rawX = (((event.clientX - rect.left) / rect.width) * WIDTH - pan.x) / zoom;
    const rawY = (((event.clientY - rect.top) / rect.height) * HEIGHT - pan.y) / zoom;
    return { x: snap(rawX), y: snap(rawY) };
  };

  const findTerminal = (point: Point): Terminal | undefined => {
    let closest: { value: Terminal; distance: number } | undefined;
    for (const symbol of symbols) {
      for (const pin of pinsFor(symbol.kind, symbol.variant)) {
        const p = terminalPoint(symbol, pin.id);
        const distance = Math.hypot(p.x - point.x, p.y - point.y);
        if (distance < 20 && (!closest || distance < closest.distance)) {
          closest = { value: { symbolId: symbol.id, pin: pin.id }, distance };
        }
      }
    }
    return closest?.value;
  };

  const endpointPoint = (endpoint: Endpoint): Point => {
    if (endpoint.terminal) {
      const sym = symbols.find((s) => s.id === endpoint.terminal!.symbolId);
      if (sym) return terminalPoint(sym, endpoint.terminal.pin);
    }
    return endpoint.point;
  };

  const wirePoints = (wire: SchematicWire): Point[] => [
    endpointPoint(wire.a),
    ...wire.waypoints,
    endpointPoint(wire.b),
  ];

  const setVariant = (variant: string) => {
    if (!selectedSymbol) return;
    commit(() =>
      setSymbols((items) =>
        items.map((item) => (item.id === selected ? { ...item, variant } : item))
      )
    );
  };

  const addSymbol = (kind: SchematicKind) => {
    const symbol: SymbolModel = {
      id: uid("schematic"),
      kind,
      label: nextRef(kind, symbols),
      value: "",
      variant: DEFAULT_VARIANT[kind] ?? "",
      x: snap((WIDTH / 2 - pan.x) / zoom),
      y: snap((HEIGHT / 2 - pan.y) / zoom),
      rotation: 0,
    };
    commit(() => {
      setSymbols((items) => [...items, symbol]);
      setSelected(symbol.id);
      setTool("select");
    });
  };

  const rotate = () =>
    selectedSymbol &&
    commit(() =>
      setSymbols((items) =>
        items.map((item) => (item.id === selected ? { ...item, rotation: (item.rotation + 90) % 360 } : item))
      )
    );

  const removeSelected = () => {
    if (!selected) return;
    commit(() => {
      setSymbols((items) => items.filter((item) => item.id !== selected));
      setWires((items) =>
        items.filter(
          (wire) =>
            wire.a.terminal?.symbolId !== selected &&
            wire.b.terminal?.symbolId !== selected &&
            wire.id !== selected
        )
      );
      setJunctions((items) => items.filter((item) => item.id !== selected));
      setSelected(null);
    });
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const t = event.target as HTMLElement | null;
      const typing =
        !!t &&
        (t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT" ||
          t.isContentEditable);
      // Never steal Delete/Backspace/letters while editing a field
      if (typing) return;

      if (event.key === " " || event.code === "Space") {
        setSpaceDown(true);
        event.preventDefault();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        event.shiftKey ? saveAs() : saveLocal();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o") {
        event.preventDefault();
        importInputRef.current?.click();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? redo() : undo();
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        redo();
      } else if ((event.key === "Delete" || event.key === "Backspace") && selected) {
        event.preventDefault();
        removeSelected();
      } else if (event.key.toLowerCase() === "r" && selected) rotate();
      else if (event.key === "Escape") {
        setWireDraft(null);
        setTool("select");
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === " ") setSpaceDown(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", up);
    };
  });

  const filteredPalette = useMemo(
    () =>
      PALETTE.map((section) => ({
        ...section,
        items: section.items.filter((kind) => titleOf(kind).toLowerCase().includes(componentSearch.toLowerCase())),
      })).filter((section) => section.items.length),
    [componentSearch]
  );

  const boundWires = useMemo(() => rebindWireEndpoints(symbols, wires), [symbols, wires]);
  const liveWires = useMemo(
    () => simulateSchematic(symbols, boundWires, powerOn, psuVoltage),
    [symbols, boundWires, powerOn, psuVoltage]
  );

  const wirePaths = boundWires
    .map((wire) => {
      const pts = wirePoints(wire);
      const flow = liveWires.get(wire.id);
      const activity = flow?.activity ?? 0;
      // Path for drawing (always a → b). Flow path follows conventional current (+ → −).
      const path = orthogonalPath(pts);
      const flowPath = flow && !flow.aToB ? orthogonalPath([...pts].reverse()) : path;
      return { wire, path, flowPath, activity, aToB: flow?.aToB ?? true };
    })
    .filter(({ wire }) => {
      if (wire.a.terminal && !symbols.some((s) => s.id === wire.a.terminal!.symbolId)) return false;
      if (wire.b.terminal && !symbols.some((s) => s.id === wire.b.terminal!.symbolId)) return false;
      return true;
    });

  /** Free wire ends (not attached to a component pin) — shown as connectable nodes. */
  const freeNodes = useMemo(() => {
    const nodes: { key: string; x: number; y: number; live: boolean }[] = [];
    const seen = new Set<string>();
    const pinHit = (pt: Point) => {
      for (const sym of symbols) {
        for (const p of pinsFor(sym.kind, sym.variant)) {
          const tp = terminalPoint(sym, p.id);
          if (Math.hypot(tp.x - pt.x, tp.y - pt.y) < 18) return true;
        }
      }
      return false;
    };
    for (const w of boundWires) {
      for (const end of [w.a, w.b] as const) {
        const pt = endpointPoint(end);
        // Treat as free if no terminal, or terminal target missing, or not near any pin
        const hasValidTerminal =
          !!end.terminal &&
          symbols.some((s) => s.id === end.terminal!.symbolId) &&
          pinHit(pt);
        if (hasValidTerminal) continue;
        const key = `${pt.x},${pt.y}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const live = (liveWires.get(w.id)?.activity ?? 0) > 0.08;
        nodes.push({ key, x: pt.x, y: pt.y, live });
      }
    }
    return nodes;
  }, [boundWires, symbols, liveWires]);

  /** LEDs light only when both terminals sit on a live net (current through the LED). */
  const litLedIds = useMemo(() => {
    const lit = new Set<string>();
    if (!powerOn) return lit;
    for (const sym of symbols) {
      if (sym.kind !== "led") continue;
      const pins = pinsFor(sym.kind, sym.variant);
      if (pins.length < 2) continue;
      const pinLive = (pinId: string) => {
        for (const w of boundWires) {
          const act = liveWires.get(w.id)?.activity ?? 0;
          if (act < 0.08) continue;
          for (const end of [w.a, w.b]) {
            if (end.terminal?.symbolId === sym.id && end.terminal.pin === pinId) return true;
            const pt = endpointPoint(end);
            const tp = terminalPoint(sym, pinId);
            if (Math.hypot(tp.x - pt.x, tp.y - pt.y) < 14) return true;
          }
        }
        return false;
      };
      // Both anode and cathode nets must be energized for current to pass through the LED
      if (pinLive(pins[0].id) && pinLive(pins[1].id)) lit.add(sym.id);
    }
    return lit;
  }, [symbols, boundWires, liveWires, powerOn]);

  const findFreeNode = (point: Point): Point | undefined => {
    let best: { p: Point; d: number } | undefined;
    for (const n of freeNodes) {
      const d = Math.hypot(n.x - point.x, n.y - point.y);
      if (d < 16 && (!best || d < best.d)) best = { p: { x: n.x, y: n.y }, d };
    }
    // also allow connecting to junction dots
    for (const j of junctions) {
      const d = Math.hypot(j.x - point.x, j.y - point.y);
      if (d < 16 && (!best || d < best.d)) best = { p: { x: j.x, y: j.y }, d };
    }
    return best?.p;
  };

  const draftPath = wireDraft
    ? orthogonalPath([
        endpointPoint(wireDraft.start),
        ...wireDraft.points,
        ...(wireDraft.cursor ? [wireDraft.cursor] : []),
      ])
    : "";

  const minimapScale = 0.16;
  const menus: Array<{ label: string; items: Array<[string, () => void]> }> = [
    { label: "File", items: [["New schematic", newSchematic], ["Save", saveLocal], ["Save as…", saveAs], ["Open recent", () => setShowRecent(true)], ["Import JSON…", () => importInputRef.current?.click()], ["Export JSON", exportJson], ["Export SVG", exportSvg]] },
    { label: "Edit", items: [["Undo", undo], ["Redo", redo], ["Delete selection", removeSelected]] },
    { label: "View", items: [["Show grid", () => setShowGrid((value) => !value)], ["Fit schematic", () => { setZoom(1); setPan({ x: 0, y: 0 }); }]] },
    { label: "Place", items: [["Wire tool", () => setTool("wire")], ["Junction tool", () => setTool("junction")]] },
    { label: "Inspect", items: [["Clear selection", () => setSelected(null)]] },
  ];

  return (
    <div
      className={`${compact ? "relative h-full w-full" : "absolute inset-0"} flex flex-col overflow-hidden bg-[#0b1220] text-slate-200 select-none`}
      style={{ userSelect: "none", WebkitUserSelect: "none" }}
    >
      <style>{`
        .menu-btn, .tool-btn, .zoom-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          border: 1px solid transparent;
          border-radius: 6px;
          color: #94a3b8;
          background: transparent;
          cursor: pointer;
          transition: background .15s, border-color .15s, color .15s;
        }
        .menu-btn { padding: 6px 9px; font-weight: 600; }
        .tool-btn { min-width: 74px; padding: 7px 9px; font-size: 11px; font-weight: 600; }
        .zoom-btn { min-width: 28px; height: 27px; padding: 0 7px; font-size: 11px; }
        .menu-btn:hover, .tool-btn:hover:not(:disabled), .zoom-btn:hover {
          color: #f8fafc; background: #1e293b; border-color: #334155;
        }
        .menu-btn.active, .tool-btn.active {
          color: #dbeafe; background: #1d4ed8; border-color: #3b82f6;
        }
        .tool-btn.danger:hover:not(:disabled) { color: #fecaca; border-color: #7f1d1d; background: #450a0a; }
        .menu-btn:disabled, .tool-btn:disabled { opacity: .4; cursor: not-allowed; }
        .power-btn {
          border: 0; border-radius: 999px; padding: 6px 12px;
          font-size: 11px; font-weight: 700; cursor: pointer;
          transition: filter .15s, background .15s;
        }
        .power-btn:hover { filter: brightness(1.12); }
        .menu-panel {
          position: absolute; z-index: 50; top: calc(100% + 5px); left: 0;
          min-width: 155px; padding: 5px; border: 1px solid #334155;
          border-radius: 8px; background: #111827; box-shadow: 0 12px 30px #0008;
        }
        .menu-item {
          display: block; width: 100%; padding: 7px 9px; border: 0;
          border-radius: 5px; color: #cbd5e1; background: transparent;
          text-align: left; font-size: 11px; cursor: pointer;
        }
        .menu-item:hover { color: #fff; background: #1e3a5f; }
      `}</style>
      <header className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-700 bg-[#080e19] px-3 text-xs">
        <strong className="text-sm text-slate-100">
          ElectroLab <span className="text-blue-400">Schematic</span>
        </strong>
        <input
          ref={importInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) importJson(file);
            event.target.value = "";
          }}
        />
        {menus.map((menu) => (
          <div key={menu.label} className="relative">
            <button
              type="button"
              className={`menu-btn ${openMenu === menu.label ? "active" : ""}`}
              onClick={() => setOpenMenu((value) => value === menu.label ? null : menu.label)}
            >
              {menu.label}
            </button>
            {openMenu === menu.label && (
              <div className="menu-panel">
                {menu.items.map(([label, action]) => (
                  <button type="button" key={label} className="menu-item" onClick={() => action()}>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        <button
          className={`menu-btn ml-1 ${powerOn ? "active text-emerald-300" : ""}`}
          onClick={() => togglePower()}
          title="Toggle simulation power"
        >
          Simulate
        </button>
        <span className="ml-2 max-w-44 truncate text-[10px] text-slate-500" title={fileName}>{fileName}</span>
        <span className="ml-auto flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-slate-400">
            PSU
            <input
              type="number"
              min={1}
              max={24}
              step={0.5}
              value={psuVoltage}
              onChange={(e) => setVoltage(Number(e.target.value) || 5)}
              className="w-14 rounded border border-slate-600 bg-[#111827] px-1.5 py-0.5 text-xs text-slate-200 outline-none focus:border-blue-400"
            />
            V
          </label>
          <button
            type="button"
            onClick={() => togglePower()}
            className={`power-btn ${
              powerOn
                ? "bg-emerald-500 text-emerald-950 shadow shadow-emerald-500/30"
                : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            }`}
          >
            {powerOn ? "● Power ON" : "○ Power OFF"}
          </button>
        </span>
      </header>

      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-slate-700 bg-[#131d2d] px-3 text-xs">
        <button type="button" className="tool-btn" onClick={undo} disabled={!history.length}>
          ↶ <span>Undo</span>
        </button>
        <button type="button" className="tool-btn" onClick={redo} disabled={!future.length}>
          ↷ <span>Redo</span>
        </button>
        <span className="mx-2 h-6 border-l border-slate-600" />
        <button type="button" className={`tool-btn ${tool === "select" ? "active" : ""}`} onClick={() => setTool("select")}>
          ↖ <span>Select</span>
        </button>
        <button type="button" className={`tool-btn ${tool === "wire" ? "active" : ""}`} onClick={() => setTool("wire")}>
          ⌁ <span>Wire</span>
        </button>
        <button type="button" className={`tool-btn ${tool === "junction" ? "active" : ""}`} onClick={() => setTool("junction")}>
          ● <span>Junction</span>
        </button>
        <button type="button" className="tool-btn" onClick={rotate} disabled={!selectedSymbol}>
          ↻ <span>Rotate</span>
        </button>
        <button type="button" className="tool-btn danger" onClick={removeSelected} disabled={!selected}>
          ⌫ <span>Delete</span>
        </button>
        <span className="ml-auto flex items-center gap-1">
          <button type="button" className="zoom-btn" onClick={() => setZoom((v) => Math.max(0.5, v - 0.1))}>
            −
          </button>
          <span className="w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button type="button" className="zoom-btn" onClick={() => setZoom((v) => Math.min(2.5, v + 0.1))}>
            +
          </button>
          <button
            type="button"
            className="zoom-btn"
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
          >
            Fit
          </button>
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-[76px] shrink-0 border-r border-slate-700 bg-[#0d1523] py-2">
          {(
            [
              ["select", "↖", "Select"],
              ["wire", "⌁", "Wire"],
              ["junction", "●", "Junction"],
              ["pan", "✋", "Pan"],
            ] as const
          ).map(([id, icon, label]) => (
            <button
              key={id}
              title={label}
              onClick={() => setTool(id)}
              className={`flex w-full flex-col items-center gap-1 py-3 text-[10px] ${
                tool === id ? "bg-blue-500/20 text-blue-300" : "text-slate-400 hover:bg-slate-800"
              }`}
            >
              <span className="text-lg">{icon}</span>
              {label}
            </button>
          ))}
        </aside>

        <main className="relative min-w-0 flex-1 bg-[#111827]">
          <div className="absolute left-3 top-3 z-10 rounded border border-slate-700 bg-[#111827]/90 px-3 py-2 text-[11px] text-slate-400 shadow-lg">
            Schematic sheet 1 · <span className="text-blue-300">+V {psuVoltage.toFixed(1)}V</span>
            {powerOn ? (
              <span className="ml-2 text-cyan-400">· sim live</span>
            ) : (
              <span className="ml-2 text-slate-500">· power off</span>
            )}
            <div className="mt-1 text-slate-500">
              {tool === "wire"
                ? "Click pin/node to start · empty = bend · double-click / right-click / Enter = end with junction"
                : "Drag to move · R rotate · Delete remove · Space+drag pan"}
            </div>
          </div>

          <svg
            ref={svgRef}
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className={`h-full w-full select-none ${tool === "pan" || spaceDown ? "cursor-grab" : ""}`}
            style={{ userSelect: "none", WebkitUserSelect: "none" }}
            onDoubleClick={(event) => {
              // Finish in-progress wire at cursor — prevents OS text selection side-effects
              event.preventDefault();
              event.stopPropagation();
              if (tool !== "wire" || !wireDraft) return;
              const point = pointFromEvent(event);
              const terminal = findTerminal(point);
              const freePt = !terminal ? findFreeNode(point) : undefined;
              const b: Endpoint = terminal
                ? {
                    point: terminalPoint(symbols.find((s) => s.id === terminal.symbolId)!, terminal.pin),
                    terminal,
                  }
                : { point: freePt ?? { x: snap(point.x), y: snap(point.y) } };
              const newWire: SchematicWire = {
                id: uid("wire"),
                a: wireDraft.start,
                b,
                waypoints: wireDraft.points,
              };
              commit(() => {
                setWires((items) => {
                  const nextWires = [...items, newWire];
                  setJunctions((js) => ensureFreeEndJunctions(symbols, nextWires, js));
                  return nextWires;
                });
              });
              setWireDraft(null);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              if (!wireDraft) return;
              const point = pointFromEvent(event);
              const terminal = findTerminal(point);
              const freePt = !terminal ? findFreeNode(point) : undefined;
              const b: Endpoint = terminal
                ? {
                    point: terminalPoint(symbols.find((s) => s.id === terminal.symbolId)!, terminal.pin),
                    terminal,
                  }
                : { point: freePt ?? { x: snap(point.x), y: snap(point.y) } };
              const newWire: SchematicWire = {
                id: uid("wire"),
                a: wireDraft.start,
                b,
                waypoints: wireDraft.points,
              };
              commit(() => {
                setWires((items) => {
                  const nextWires = [...items, newWire];
                  setJunctions((js) => ensureFreeEndJunctions(symbols, nextWires, js));
                  return nextWires;
                });
              });
              setWireDraft(null);
            }}
            onPointerDown={(event) => {
              // Block native double-click text selection on the canvas
              if (event.detail > 1) {
                event.preventDefault();
              }
              const point = pointFromEvent(event);
              const panMode = tool === "pan" || spaceDown;
              if (panMode) {
                const start = { x: event.clientX, y: event.clientY };
                const initial = pan;
                const rect = svgRef.current!.getBoundingClientRect();
                const move = (e: PointerEvent) =>
                  setPan({
                    x: initial.x + ((e.clientX - start.x) / rect.width) * WIDTH,
                    y: initial.y + ((e.clientY - start.y) / rect.height) * HEIGHT,
                  });
                const up = () => {
                  window.removeEventListener("pointermove", move);
                  window.removeEventListener("pointerup", up);
                };
                window.addEventListener("pointermove", move);
                window.addEventListener("pointerup", up);
                return;
              }
              if (tool === "wire") {
                const terminal = findTerminal(point);
                const freePt = !terminal ? findFreeNode(point) : undefined;
                const endPoint = terminal
                  ? terminalPoint(symbols.find((s) => s.id === terminal.symbolId)!, terminal.pin)
                  : freePt ?? point;

                const finishWire = (b: Endpoint) => {
                  const newWire: SchematicWire = {
                    id: uid("wire"),
                    a: wireDraft!.start,
                    b,
                    waypoints: wireDraft!.points,
                  };
                  commit(() => {
                    setWires((items) => {
                      const nextWires = [...items, newWire];
                      setJunctions((js) => ensureFreeEndJunctions(symbols, nextWires, js));
                      return nextWires;
                    });
                  });
                  setWireDraft(null);
                };

                if (!wireDraft) {
                  setWireDraft({
                    start: { point: endPoint, terminal },
                    points: [],
                    cursor: endPoint,
                  });
                } else if (terminal) {
                  if (
                    wireDraft.start.terminal &&
                    terminal.symbolId === wireDraft.start.terminal.symbolId &&
                    terminal.pin === wireDraft.start.terminal.pin
                  ) {
                    return;
                  }
                  finishWire({ point: endPoint, terminal });
                } else if (freePt) {
                  finishWire({ point: freePt });
                } else if (event.detail >= 2) {
                  finishWire({ point: { x: snap(point.x), y: snap(point.y) } });
                } else {
                  setWireDraft((draft) => (draft ? { ...draft, points: [...draft.points, point], cursor: point } : null));
                }
                return;
              }
              if (tool === "junction") {
                commit(() => setJunctions((items) => [...items, { id: uid("junction"), x: point.x, y: point.y }]));
                setTool("select");
                return;
              }
              setSelected(null);
            }}
            onPointerMove={(event) => {
              const p = pointFromEvent(event);
              if (wireDraft) {
                setWireDraft((d) => (d ? { ...d, cursor: p } : null));
              }
              if (!drag) return;
              setSymbols((items) =>
                items.map((item) =>
                  item.id === drag.id ? { ...item, x: p.x - drag.offset.x, y: p.y - drag.offset.y } : item
                )
              );
            }}
            onPointerUp={() => setDrag(null)}
          >
            <defs>
              <pattern id="schematic-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r=".8" fill={COLORS.grid} />
              </pattern>
              <filter id="wire-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="wire-glow-strong" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <style>{`
              @keyframes schematic-current-flow {
                to { stroke-dashoffset: -28; }
              }
              @keyframes schematic-current-pulse {
                0%, 100% { opacity: 0.55; }
                50% { opacity: 1; }
              }
              .wire-current-flow {
                animation: schematic-current-flow 0.65s linear infinite;
              }
              .wire-current-pulse {
                animation: schematic-current-pulse 1.2s ease-in-out infinite;
              }
              @keyframes led-halo-pulse {
                0%, 100% { opacity: 0.12; r: 20; }
                50% { opacity: 0.28; }
              }
              @keyframes led-rays-pulse {
                0%, 100% { opacity: 0.55; }
                50% { opacity: 1; }
              }
              .led-halo {
                animation: led-halo-pulse 1.1s ease-in-out infinite;
              }
              .led-halo-core {
                animation: led-halo-pulse 1.1s ease-in-out infinite;
                animation-delay: 0.15s;
              }
              .led-rays {
                animation: led-rays-pulse 0.9s ease-in-out infinite;
              }
              @keyframes free-node-pulse {
                0%, 100% { opacity: 0.85; }
                50% { opacity: 1; }
              }
              .wire-free-node {
                cursor: crosshair;
              }
              svg text {
                user-select: none;
                -webkit-user-select: none;
              }
              svg {
                user-select: none;
                -webkit-user-select: none;
              }
              .wire-free-node:hover {
                fill: #60a5fa;
              }
            `}</style>
            <rect width={WIDTH} height={HEIGHT} fill={COLORS.bg} />
            <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
              {showGrid && <rect width={WIDTH * 2} height={HEIGHT * 2} x={-WIDTH / 2} y={-HEIGHT / 2} fill="url(#schematic-grid)" />}

              {/* Wires */}
              {wirePaths.map(({ wire, path, flowPath, activity }) => {
                const live = activity > 0.08;
                const color = live ? glowColor(activity) : selected === wire.id ? COLORS.wireSel : COLORS.wire;
                const width = live ? 2.5 + activity * 1.5 : selected === wire.id ? 3 : 2;
                return (
                  <g
                    key={wire.id}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (tool === "select") setSelected(wire.id);
                    }}
                  >
                    <path d={path} fill="none" stroke="transparent" strokeWidth="14" />
                    {live && (
                      <path
                        d={path}
                        fill="none"
                        stroke={color}
                        strokeWidth={width + 6}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        opacity={0.2 + activity * 0.35}
                        filter={activity > 0.5 ? "url(#wire-glow-strong)" : "url(#wire-glow)"}
                        className="wire-current-pulse"
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth={width}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={live ? 0.95 : 1}
                    />
                    {/* Dashes move + → − (conventional current) along flowPath */}
                    {live && (
                      <path
                        d={flowPath}
                        fill="none"
                        stroke="#e0f2fe"
                        strokeWidth={Math.max(1.4, width * 0.6)}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="7 11"
                        className="wire-current-flow"
                        opacity={0.65 + activity * 0.35}
                        style={{ pointerEvents: "none" }}
                      />
                    )}
                  </g>
                );
              })}

              {/* Wire draft (live orthogonal preview) */}
              {wireDraft && draftPath && (
                <path d={draftPath} fill="none" stroke={COLORS.wireSel} strokeDasharray="6 4" strokeWidth="2" strokeLinecap="round" />
              )}
              {wireDraft && wireDraft.cursor && (
                <g style={{ pointerEvents: "none" }}>
                  {/* Preview junction at free end */}
                  <circle
                    cx={wireDraft.cursor.x}
                    cy={wireDraft.cursor.y}
                    r="7"
                    fill="#1d4ed8"
                    stroke="#93c5fd"
                    strokeWidth="2"
                    opacity="0.85"
                  />
                  <circle cx={wireDraft.cursor.x} cy={wireDraft.cursor.y} r="2.5" fill="#eff6ff" />
                </g>
              )}

              {/* Free wire-end nodes — always a connectable junction */}
              {freeNodes.map((n) => (
                <g key={`free-${n.key}`}>
                  <circle
                    className="wire-free-node"
                    cx={n.x}
                    cy={n.y}
                    r="8"
                    fill={n.live ? "#22d3ee" : "#1d4ed8"}
                    stroke={n.live ? "#ecfeff" : "#93c5fd"}
                    strokeWidth="2"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      if (tool !== "wire") setTool("wire");
                      const pt = { x: n.x, y: n.y };
                      if (!wireDraft) {
                        setWireDraft({ start: { point: pt }, points: [], cursor: pt });
                      } else {
                        const newWire: SchematicWire = {
                          id: uid("wire"),
                          a: wireDraft.start,
                          b: { point: pt },
                          waypoints: wireDraft.points,
                        };
                        commit(() => {
                          setWires((items) => {
                            const nextWires = [...items, newWire];
                            setJunctions((js) => ensureFreeEndJunctions(symbols, nextWires, js));
                            return nextWires;
                          });
                        });
                        setWireDraft(null);
                      }
                    }}
                  />
                  <circle cx={n.x} cy={n.y} r="3" fill="#eff6ff" style={{ pointerEvents: "none" }} />
                </g>
              ))}

              {/* Explicit junctions (skip if free-node already covers this spot) */}
              {junctions.map((junction) => {
                if (freeNodes.some((n) => Math.hypot(n.x - junction.x, n.y - junction.y) < 8)) return null;
                return (
                  <g key={junction.id}>
                    <circle
                      className="wire-free-node"
                      cx={junction.x}
                      cy={junction.y}
                      r="8"
                      fill="#1d4ed8"
                      stroke="#93c5fd"
                      strokeWidth="2"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (tool === "select") {
                          setSelected(junction.id);
                          return;
                        }
                        if (tool !== "wire") setTool("wire");
                        const pt = { x: junction.x, y: junction.y };
                        if (!wireDraft) {
                          setWireDraft({ start: { point: pt }, points: [], cursor: pt });
                        } else {
                          const newWire: SchematicWire = {
                            id: uid("wire"),
                            a: wireDraft.start,
                            b: { point: pt },
                            waypoints: wireDraft.points,
                          };
                          commit(() => {
                            setWires((items) => {
                              const nextWires = [...items, newWire];
                              setJunctions((js) => ensureFreeEndJunctions(symbols, nextWires, js));
                              return nextWires;
                            });
                          });
                          setWireDraft(null);
                        }
                      }}
                    />
                    <circle cx={junction.x} cy={junction.y} r="3" fill="#eff6ff" style={{ pointerEvents: "none" }} />
                  </g>
                );
              })}

              {/* Symbols */}
              {symbols.map((symbol) => {
                const pins = pinsFor(symbol.kind, symbol.variant);
                return (
                  <g
                    key={symbol.id}
                    transform={`translate(${symbol.x} ${symbol.y}) rotate(${symbol.rotation})`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      if (tool !== "select") return;
                      const p = pointFromEvent(event);
                      setSelected(symbol.id);
                      setDrag({ id: symbol.id, offset: { x: p.x - symbol.x, y: p.y - symbol.y } });
                    }}
                  >
                    {selected === symbol.id && (
                      <rect
                        x={["not","and","or","nand","nor","xor","xnor"].includes(symbol.kind) ? -70 : -60}
                        y={["not","and","or","nand","nor","xor","xnor"].includes(symbol.kind) ? -58 : -52}
                        width={["not","and","or","nand","nor","xor","xnor"].includes(symbol.kind) ? 140 : 120}
                        height={["not","and","or","nand","nor","xor","xnor"].includes(symbol.kind) ? 116 : 104}
                        rx="6"
                        fill="rgba(59,130,246,.12)"
                        stroke="#3b82f6"
                        strokeDasharray="4 3"
                      />
                    )}
                    <SymbolBody kind={symbol.kind} variant={symbol.variant} lit={litLedIds.has(symbol.id)} />
                    {symbol.kind !== "vcc" && symbol.kind !== "gnd" && (
                      <text
                        y={
                          symbol.kind === "dc-source"
                            ? -48
                            : ["not", "and", "or", "nand", "nor", "xor", "xnor"].includes(symbol.kind)
                              ? -56
                              : -36
                        }
                        textAnchor="middle"
                        fill={COLORS.label}
                        fontSize="12"
                        fontWeight="600"
                      >
                        {symbol.label}
                      </text>
                    )}
                    {VALUE_KINDS.has(symbol.kind) && symbol.value.trim() ? (
                      <text y={42} textAnchor="middle" fill={COLORS.value} fontSize="11">
                        {formatValueLabel(symbol.kind, symbol.value)}
                      </text>
                    ) : null}
                    {symbol.kind === "vcc" ? (
                      <text x={20} y={10} fill="#64748b" fontSize="10">
                        {psuVoltage.toFixed(1)}V
                      </text>
                    ) : null}
                    {symbol.kind === "dc-source" ? (
                      <text x={28} y={4} fill="#64748b" fontSize="10">
                        {psuVoltage.toFixed(1)}V
                      </text>
                    ) : null}
                    {/* Pin connection points */}
                    {pins.map((pin) => {
                      const isActive =
                        wireDraft?.start.terminal?.symbolId === symbol.id &&
                        wireDraft.start.terminal.pin === pin.id;
                      return (
                        <g key={pin.id}>
                          <circle
                            cx={pin.x}
                            cy={pin.y}
                            r="6"
                            fill={isActive ? COLORS.pinActive : "#0f172a"}
                            stroke={isActive ? "#93c5fd" : COLORS.pin}
                            strokeWidth="1.5"
                            className="cursor-crosshair"
                            onPointerDown={(event) => {
                              event.stopPropagation();
                              if (tool !== "wire") {
                                setTool("wire");
                              }
                              const world = terminalPoint(symbol, pin.id);
                              const value: Terminal = { symbolId: symbol.id, pin: pin.id };
                              if (!wireDraft) {
                                setWireDraft({ start: { point: world, terminal: value }, points: [], cursor: world });
                              } else {
                                if (
                                  wireDraft.start.terminal &&
                                  wireDraft.start.terminal.symbolId === value.symbolId &&
                                  wireDraft.start.terminal.pin === value.pin
                                ) {
                                  return;
                                }
                                commit(() =>
                                  setWires((items) => [
                                    ...items,
                                    {
                                      id: uid("wire"),
                                      a: wireDraft.start,
                                      b: { point: world, terminal: value },
                                      waypoints: wireDraft.points,
                                    },
                                  ])
                                );
                                setWireDraft(null);
                              }
                            }}
                          />
                          {pin.label && (
                            <text
                              x={pin.x + (pin.x < 0 ? -10 : pin.x > 0 ? 10 : 0)}
                              y={pin.y + (pin.y > 10 ? 14 : pin.y < -10 ? -8 : -10)}
                              textAnchor="middle"
                              fill="#64748b"
                              fontSize="8"
                            >
                              {pin.label}
                            </text>
                          )}
                        </g>
                      );
                    })}
                  </g>
                );
              })}
            </g>
          </svg>

          <div className="absolute bottom-3 left-3 flex gap-3 rounded border border-slate-700 bg-[#0b1220]/90 px-3 py-1.5 text-[10px] text-slate-400">
            <span>Grid: {GRID}px</span>
            <button onClick={() => setShowGrid((v) => !v)} className="text-blue-300">
              {showGrid ? "Hide grid" : "Show grid"}
            </button>
            <span>
              Objects: {symbols.length + wires.length}
            </span>
          </div>

          <svg
            className="absolute bottom-3 right-3 h-[112px] w-[176px] rounded border border-slate-600 bg-[#0b1220] shadow-xl"
            viewBox={`0 0 ${WIDTH * minimapScale} ${HEIGHT * minimapScale}`}
          >
            <rect width={WIDTH * minimapScale} height={HEIGHT * minimapScale} fill="#111827" />
            {wires.map((wire) => (
              <path
                key={wire.id}
                d={orthogonalPath(wirePoints(wire)).replace(/(-?\d+(?:\.\d+)?)/g, (n) => `${Number(n) * minimapScale}`)}
                stroke="#64748b"
                fill="none"
                strokeWidth="1.5"
              />
            ))}
            {symbols.map((s) => (
              <rect
                key={s.id}
                x={(s.x - 10) * minimapScale}
                y={(s.y - 7) * minimapScale}
                width="20"
                height="14"
                fill={selected === s.id ? "#60a5fa" : "#475569"}
              />
            ))}
          </svg>
        </main>

        <aside className="hidden w-72 shrink-0 flex-col border-l border-slate-700 bg-[#0d1523] lg:flex">
          <section className="shrink-0 border-b border-slate-700 p-3">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowRecent((value) => !value)}
            >
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Recent schematics</span>
              <span className="text-[10px] text-slate-500">{showRecent ? "Hide" : "Show"}</span>
            </button>
            {showRecent && (
              <div className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                <div className="rounded-md border border-blue-500/50 bg-blue-500/10 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-blue-100" title={fileName}>{fileName}</span>
                    <span className="shrink-0 rounded bg-blue-400/20 px-1.5 py-0.5 text-[9px] text-blue-200">Editing</span>
                  </div>
                  <div className="mt-1 text-[10px] text-slate-500">{symbols.length} components · {wires.length} wires</div>
                </div>
                {recentSchematics.length === 0 ? (
                  <div className="rounded-md border border-dashed border-slate-700 px-2 py-3 text-center text-[10px] text-slate-500">
                    Save a schematic to see it here.
                  </div>
                ) : (
                  recentSchematics.map((saved) => (
                    <div key={`${saved.name}-${saved.savedAt}`} className="group rounded-md border border-slate-700/80 bg-[#111827] p-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="min-w-0 flex-1 truncate text-left text-xs text-slate-200 hover:text-blue-300"
                          title={`Open ${saved.name}`}
                          onClick={() => openRecent(saved)}
                        >
                          {saved.name}
                        </button>
                        <button
                          type="button"
                          className="rounded px-1.5 py-0.5 text-[10px] text-slate-500 hover:bg-red-500/15 hover:text-red-300"
                          title={`Remove ${saved.name} from recent schematics`}
                          onClick={() => removeRecent(saved.name)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{saved.symbols.length} components · {saved.wires.length} wires</span>
                        <span>{new Date(saved.savedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>
          {/* Properties first — so Type/model is always visible when something is selected */}
          <div className="shrink-0 border-b border-slate-700 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">Properties</div>
              {selectedSymbol && (
                <span className="rounded bg-blue-500/20 px-2 py-0.5 text-[10px] font-medium text-blue-300">
                  {selectedSymbol.label}
                </span>
              )}
            </div>
            {selectedSymbol ? (
              <div className="space-y-3 text-xs">
                <div className="rounded-lg border border-slate-600/80 bg-[#111827] p-2.5">
                  <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Component type
                  </div>
                  <div className="text-sm font-medium text-slate-100">{titleOf(selectedSymbol.kind)}</div>
                  {VARIANTS[selectedSymbol.kind] && VARIANTS[selectedSymbol.kind]!.length > 0 ? (
                    <div className="mt-2">
                      <div className="mb-1 text-[10px] text-slate-500">Choose variant / model</div>
                      {/* Quick chips for LED colors */}
                      {selectedSymbol.kind === "led" && (
                        <div className="mb-2 flex flex-wrap gap-1.5">
                          {(["red", "green", "yellow", "blue"] as const).map((c) => {
                            const hex = { red: "#ef4444", green: "#22c55e", yellow: "#eab308", blue: "#38bdf8" }[c];
                            const active = selectedSymbol.variant === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                title={c}
                                onClick={() => setVariant(c)}
                                className={`h-8 w-8 rounded-full border-2 transition ${
                                  active ? "scale-110 ring-2 ring-white/40" : "opacity-70 hover:opacity-100"
                                }`}
                                style={{ backgroundColor: hex, borderColor: active ? "#fff" : "transparent" }}
                              />
                            );
                          })}
                        </div>
                      )}
                      {/* Quick chips for NPN / PNP */}
                      {selectedSymbol.kind === "transistor" && (
                        <div className="mb-2 flex gap-1.5">
                          <button
                            type="button"
                            onClick={() => setVariant("npn")}
                            className={`flex-1 rounded border px-2 py-1.5 text-[11px] font-semibold ${
                              !isPnp(selectedSymbol.variant)
                                ? "border-blue-400 bg-blue-500/20 text-blue-200"
                                : "border-slate-600 text-slate-400 hover:border-slate-500"
                            }`}
                          >
                            NPN
                          </button>
                          <button
                            type="button"
                            onClick={() => setVariant("pnp")}
                            className={`flex-1 rounded border px-2 py-1.5 text-[11px] font-semibold ${
                              isPnp(selectedSymbol.variant)
                                ? "border-amber-400 bg-amber-500/20 text-amber-200"
                                : "border-slate-600 text-slate-400 hover:border-slate-500"
                            }`}
                          >
                            PNP
                          </button>
                        </div>
                      )}
                      {/* Quick chips for diode types */}
                      {selectedSymbol.kind === "diode" && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {(["silicon", "schottky", "zener"] as const).map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => setVariant(d)}
                              className={`rounded border px-2 py-1 text-[10px] capitalize ${
                                selectedSymbol.variant === d
                                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                                  : "border-slate-600 text-slate-400 hover:border-slate-500"
                              }`}
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Quick chips for capacitor */}
                      {selectedSymbol.kind === "capacitor" && (
                        <div className="mb-2 flex flex-wrap gap-1">
                          {VARIANTS.capacitor!.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setVariant(opt.id)}
                              className={`rounded border px-2 py-1 text-[10px] ${
                                selectedSymbol.variant === opt.id
                                  ? "border-blue-400 bg-blue-500/20 text-blue-200"
                                  : "border-slate-600 text-slate-400 hover:border-slate-500"
                              }`}
                            >
                              {opt.id}
                            </button>
                          ))}
                        </div>
                      )}
                      <select
                        value={selectedSymbol.variant}
                        onChange={(e) => setVariant(e.target.value)}
                        className="w-full rounded border border-blue-500/50 bg-[#0b1220] px-2 py-2 text-xs font-medium text-slate-100 outline-none focus:border-blue-400"
                      >
                        {VARIANTS[selectedSymbol.kind]!.map((opt) => (
                          <option key={opt.id} value={opt.id}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
                        Changing the type updates the schematic symbol (e.g. NPN vs PNP arrow, Zener bar, LED color).
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-[10px] text-slate-500">No subtypes for this component.</p>
                  )}
                </div>

                <label className="block text-slate-500">
                  Reference designator
                  <input
                    value={selectedSymbol.label}
                    onChange={(e) =>
                      setSymbols((items) =>
                        items.map((item) => (item.id === selected ? { ...item, label: e.target.value } : item))
                      )
                    }
                    onKeyDown={(e) => e.stopPropagation()}
                    className="mt-1 w-full rounded border border-slate-600 bg-[#111827] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-400"
                  />
                </label>
                {VALUE_KINDS.has(selectedSymbol.kind) && (
                  <label className="block text-slate-500">
                    Value
                    <div className="mt-1 flex items-center gap-1">
                      <input
                        value={selectedSymbol.value}
                        onChange={(e) =>
                          setSymbols((items) =>
                            items.map((item) => (item.id === selected ? { ...item, value: e.target.value } : item))
                          )
                        }
                        onKeyDown={(e) => e.stopPropagation()}
                        placeholder={valuePlaceholder(selectedSymbol.kind)}
                        className="w-full rounded border border-slate-600 bg-[#111827] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-400"
                      />
                      <span className="shrink-0 rounded border border-slate-700 bg-[#111827] px-2 py-1.5 text-[10px] text-slate-400">
                        {valueUnit(selectedSymbol.kind)}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-600">
                      {selectedSymbol.kind === "resistor" || selectedSymbol.kind === "pot"
                        ? "Use k / M for kilo / mega (e.g. 4.7k)"
                        : selectedSymbol.kind === "capacitor"
                          ? "Use p / n / u for pico / nano / micro (e.g. 100n, 10u)"
                          : selectedSymbol.kind === "inductor"
                            ? "Use u / m for micro / milli (e.g. 100u)"
                            : "Enter a number; unit is shown on the right"}
                    </p>
                  </label>
                )}
                <label className="block text-slate-500">
                  Rotation
                  <div className="mt-1 flex gap-1">
                    <input
                      type="number"
                      step="90"
                      value={selectedSymbol.rotation}
                      onChange={(e) =>
                        setSymbols((items) =>
                          items.map((item) =>
                            item.id === selected ? { ...item, rotation: Number(e.target.value) || 0 } : item
                          )
                        )
                      }
                      className="w-full rounded border border-slate-600 bg-[#111827] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-400"
                    />
                    <button
                      type="button"
                      onClick={rotate}
                      className="rounded border border-slate-600 px-2 text-slate-300 hover:bg-slate-800"
                      title="Rotate 90°"
                    >
                      ↻
                    </button>
                  </div>
                </label>
                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <span>
                    X <b className="text-slate-200">{selectedSymbol.x}</b>
                  </span>
                  <span>
                    Y <b className="text-slate-200">{selectedSymbol.y}</b>
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Pins:{" "}
                  <span className="text-slate-300">
                    {pinsFor(selectedSymbol.kind, selectedSymbol.variant)
                      .map((p) => p.label ?? p.id)
                      .join(", ")}
                  </span>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-600 bg-[#111827]/60 px-3 py-4 text-center text-[11px] text-slate-500">
                Select a component on the canvas to choose its type (NPN/PNP, LED color, diode model, …) and edit properties.
              </div>
            )}
          </div>

          {/* Component palette — scrollable */}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Add components</div>
            <input
              value={componentSearch}
              onChange={(e) => setComponentSearch(e.target.value)}
              placeholder="Search components…"
              className="w-full rounded border border-slate-600 bg-[#111827] px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-400"
            />
            {filteredPalette.map((section) => (
              <div key={section.title} className="mt-3">
                <div className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">{section.title}</div>
                {section.items.map((kind) => (
                  <button
                    key={kind}
                    onClick={() => addSymbol(kind)}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-slate-300 hover:bg-slate-800 hover:text-blue-300"
                  >
                    <span className="flex h-6 w-7 items-center justify-center rounded border border-slate-600 text-[10px]">
                      {(PREFIX[kind] ?? titleOf(kind).slice(0, 2)).toUpperCase()}
                    </span>
                    {titleOf(kind)}
                    {VARIANTS[kind] && (
                      <span className="ml-auto text-[9px] text-slate-600">{VARIANTS[kind]!.length} types</span>
                    )}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>
      </div>

      <footer className="flex h-7 shrink-0 items-center gap-5 border-t border-slate-700 bg-[#080e19] px-3 text-[10px] text-slate-500">
        <span className="text-emerald-400">● Ready</span>
        <span>Tool: {tool}</span>
        <span>Zoom {Math.round(zoom * 100)}%</span>
        <span className="ml-auto">
          {powerOn ? (
            <span className="text-cyan-400">Schematic sim live — current + → −</span>
          ) : (
            "Power off — click Power ON to simulate this schematic"
          )}
          {" · "}Wire: click pin/node · bend on empty · double-click / right-click / Enter = free junction
        </span>
      </footer>
    </div>
  );
}
