/**
 * Textbook-style schematic view.
 *
 * Conventions (IEC/ANSI / All About Circuits practice):
 * 1. Positive supply TOP, ground BOTTOM.
 * 2. Main power path VERTICAL through load / SCR.
 * 3. Gate / control branch to the RIGHT of the SCR.
 * 4. Orthogonal wires only; junction dots at joins.
 * 5. Reference designators (M1, SCR1, R1, SW1).
 *
 *        +V
 *         |
 *       Motor
 *         |
 *      SCR (A)
 *         |---- gate — R — SW — +V
 *      SCR (K)
 *         |
 *        GND
 */
import { useMemo, type ReactNode } from "react";
import { useLab } from "@/store/lab";
import { holeStrip } from "@/circuit/breadboard";
import type { HoleId, PlacedPart, Wire } from "@/circuit/types";

const STROKE = "#1e3a8a";
const GRID = 20;

// Shared layout geometry. The main VCC->GND power column always runs
// between these two y-values; the wire router (below) needs this range to
// know when a connection would otherwise cut behind a main-path symbol and
// should detour around it instead, per standard schematic drafting practice
// (route long ties via a clear bus channel rather than through a symbol).
const CX = 300;
const TOP_Y = 105;
const STEP_Y = 64;
const BRANCH_X = 470;
const BRANCH_STEP_X = 105;

type Pt = { x: number; y: number };

function stripOf(hole: string): string {
  try {
    return holeStrip(hole as HoleId);
  } catch {
    return hole;
  }
}

type ElectricalNode = {
  id: string;
  // Every component terminal assigned to this electrical node.
  pins: { partId: string; pin: string; hole: string }[];
};

/**
 * Build the electrical node table from the ACTUAL breadboard topology.
 *
 * A schematic connection is never inferred from where a symbol happens to be
 * drawn.  The source of truth is:
 *   1. the breadboard strip/rail containing each component pin, and
 *   2. jumper wires that electrically join two strips/rails.
 *
 * Therefore two pins are assigned to the same node only when their holes are
 * electrically common.  This is the important distinction between a
 * schematic router and a visual line-drawing algorithm.
 */
function buildNets(parts: PlacedPart[], wires: Wire[]) {
  const parent = new Map<string, string>();

  const find = (a: string): string => {
    const p = parent.get(a);
    if (!p || p === a) {
      parent.set(a, a);
      return a;
    }
    const r = find(p);
    parent.set(a, r);
    return r;
  };

  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  // Register every terminal's physical breadboard node first.  This means a
  // component pin is always assigned a node even when it is currently open.
  const pinHole = new Map<string, string>();
  for (const part of parts) {
    for (const pin of Object.keys(part.pins)) {
      const hole = part.pins[pin];
      if (!hole) continue;
      const strip = stripOf(hole);
      find(strip);
      pinHole.set(`${part.id}:${pin}`, strip);
    }
  }

  // Jumper wires are the only extra conductor introduced by the user.  Join
  // their endpoint nodes before assigning final node IDs to component pins.
  for (const w of wires) {
    if (!w.a || !w.b) continue;
    const a = stripOf(w.a);
    const b = stripOf(w.b);
    union(a, b);
  }

  const pinNet = new Map<string, string>();
  const nodes = new Map<string, ElectricalNode>();

  for (const part of parts) {
    for (const pin of Object.keys(part.pins)) {
      const hole = part.pins[pin];
      if (!hole) continue;

      const nodeId = find(stripOf(hole));
      pinNet.set(`${part.id}:${pin}`, nodeId);

      const node = nodes.get(nodeId) ?? { id: nodeId, pins: [] };
      node.pins.push({ partId: part.id, pin, hole });
      nodes.set(nodeId, node);
    }
  }

  // Normalize all nodes after union-find compression.  This also gives us a
  // deterministic list of which component terminals actually share a node.
  return { pinNet, nodes, find };
}

function netOf(pinNet: Map<string, string>, id: string, pin: string) {
  return pinNet.get(`${id}:${pin}`);
}

function refDes(part: PlacedPart, indexByKind: Map<string, number>): string {
  const kindKey =
    part.kind === "thyristor" || part.kind === "triac"
      ? "SCR"
      : part.kind === "button" || part.kind === "switch"
        ? "SW"
        : part.kind === "resistor"
          ? "R"
          : part.kind === "capacitor"
            ? "C"
            : part.kind === "motor"
              ? "M"
              : part.kind === "led" || part.kind === "diode"
                ? "D"
                : part.kind === "transistor"
                  ? "Q"
                  : part.kind.slice(0, 2).toUpperCase();
  const n = (indexByKind.get(kindKey) ?? 0) + 1;
  indexByKind.set(kindKey, n);
  return `${kindKey}${n}`;
}

function valueText(part: PlacedPart): string {
  if (part.props.resistance != null) {
    const r = part.props.resistance;
    return r >= 1000 ? `${r / 1000}k\u03A9` : `${r}\u03A9`;
  }
  if (part.props.capacitance != null) {
    const c = part.props.capacitance;
    if (c >= 1e-6) return `${(c * 1e6).toFixed(1)}\u00B5F`;
    if (c >= 1e-9) return `${(c * 1e9).toFixed(0)}nF`;
    return `${c}`;
  }
  if (part.props.label) return String(part.props.label);
  return "";
}

function SymResistorV({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d="M0 -32 V-18 l-8 4 16 8 -16 8 16 8 -16 8 8 4 V32"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.8"
      />
    </g>
  );
}

function SymResistorH({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <path
        d="M-32 0 H-18 l4-8 8 16 8-16 8 16 8-16 4 8 H32"
        fill="none"
        stroke={STROKE}
        strokeWidth="1.8"
      />
    </g>
  );
}

function SymMotorV({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-32" x2="0" y2="-16" stroke={STROKE} strokeWidth="1.8" />
      <circle
        cx="0"
        cy="0"
        r="16"
        fill={on ? "rgba(217,119,6,0.15)" : "none"}
        stroke={STROKE}
        strokeWidth="1.8"
      />
      <text x="0" y="5" textAnchor="middle" fill={STROKE} fontSize="13" fontWeight="700">
        M
      </text>
      <line x1="0" y1="16" x2="0" y2="32" stroke={STROKE} strokeWidth="1.8" />
    </g>
  );
}

function SymScrV({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-32" x2="0" y2="-10" stroke={STROKE} strokeWidth="1.8" />
      <path
        d="M-12 -10 L12 -10 L0 12 Z"
        fill={on ? "rgba(14,165,233,0.25)" : "none"}
        stroke={STROKE}
        strokeWidth="1.8"
      />
      <line x1="-14" y1="12" x2="14" y2="12" stroke={STROKE} strokeWidth="2" />
      <line x1="0" y1="12" x2="0" y2="32" stroke={STROKE} strokeWidth="1.8" />
      <line x1="0" y1="4" x2="28" y2="16" stroke={STROKE} strokeWidth="1.6" />
      <line x1="28" y1="16" x2="36" y2="16" stroke={STROKE} strokeWidth="1.6" />
    </g>
  );
}

function SymSwitchH({ x, y, closed }: { x: number; y: number; closed?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="-32" y1="0" x2="-8" y2="0" stroke={STROKE} strokeWidth="1.8" />
      <circle cx="-8" cy="0" r="2.2" fill={STROKE} />
      <line
        x1="-8"
        y1="0"
        x2={closed ? 16 : 12}
        y2={closed ? 0 : -10}
        stroke={STROKE}
        strokeWidth="1.8"
      />
      <circle cx="16" cy="0" r="2.2" fill={STROKE} />
      <line x1="16" y1="0" x2="32" y2="0" stroke={STROKE} strokeWidth="1.8" />
    </g>
  );
}

function SymSwitchV({ x, y, closed }: { x: number; y: number; closed?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) rotate(90)`}>
      <line x1="-32" y1="0" x2="-8" y2="0" stroke={STROKE} strokeWidth="1.8" />
      <circle cx="-8" cy="0" r="2.2" fill={STROKE} />
      <line
        x1="-8"
        y1="0"
        x2={closed ? 16 : 12}
        y2={closed ? 0 : -10}
        stroke={STROKE}
        strokeWidth="1.8"
      />
      <circle cx="16" cy="0" r="2.2" fill={STROKE} />
      <line x1="16" y1="0" x2="32" y2="0" stroke={STROKE} strokeWidth="1.8" />
    </g>
  );
}

function SymDiodeV({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-32" x2="0" y2="-8" stroke={STROKE} strokeWidth="1.8" />
      <path d="M-10 -8 L10 -8 L0 10 Z" fill="none" stroke={STROKE} strokeWidth="1.8" />
      <line x1="-12" y1="10" x2="12" y2="10" stroke={STROKE} strokeWidth="2" />
      <line x1="0" y1="10" x2="0" y2="32" stroke={STROKE} strokeWidth="1.8" />
    </g>
  );
}

function SymLedV({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-32" x2="0" y2="-8" stroke={STROKE} strokeWidth="1.8" />
      <path
        d="M-10 -8 L10 -8 L0 10 Z"
        fill={on ? "rgba(245,158,11,0.35)" : "none"}
        stroke={STROKE}
        strokeWidth="1.8"
      />
      <line x1="-12" y1="10" x2="12" y2="10" stroke={STROKE} strokeWidth="2" />
      <line x1="0" y1="10" x2="0" y2="32" stroke={STROKE} strokeWidth="1.8" />
      <path d="M14 -4 l8 -6 M16 2 l8 -6" fill="none" stroke={STROKE} strokeWidth="1.3" />
    </g>
  );
}

function SymCapV({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-32" x2="0" y2="-4" stroke={STROKE} strokeWidth="1.8" />
      <line x1="-12" y1="-4" x2="12" y2="-4" stroke={STROKE} strokeWidth="2.2" />
      <line x1="-12" y1="4" x2="12" y2="4" stroke={STROKE} strokeWidth="2.2" />
      <line x1="0" y1="4" x2="0" y2="32" stroke={STROKE} strokeWidth="1.8" />
    </g>
  );
}

function SymGeneric({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-24" y="-14" width="48" height="28" rx="3" fill="none" stroke={STROKE} strokeWidth="1.6" />
      <text x="0" y="4" textAnchor="middle" fill={STROKE} fontSize="10">
        {label.slice(0, 6)}
      </text>
      <line x1="0" y1="-32" x2="0" y2="-14" stroke={STROKE} strokeWidth="1.6" />
      <line x1="0" y1="14" x2="0" y2="32" stroke={STROKE} strokeWidth="1.6" />
    </g>
  );
}

function SymVcc({ x, y, v }: { x: number; y: number; v: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="8" x2="0" y2="18" stroke={STROKE} strokeWidth="1.8" />
      <line x1="-12" y1="18" x2="12" y2="18" stroke={STROKE} strokeWidth="2" />
      <text x="0" y="0" textAnchor="middle" fill={STROKE} fontSize="13" fontWeight="700">
        {Number.isFinite(v) ? `${v.toFixed(1)}V` : "VCC"}
      </text>
    </g>
  );
}

function SymGnd({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="0" x2="0" y2="8" stroke={STROKE} strokeWidth="1.8" />
      <line x1="-14" y1="8" x2="14" y2="8" stroke={STROKE} strokeWidth="2" />
      <line x1="-9" y1="13" x2="9" y2="13" stroke={STROKE} strokeWidth="1.6" />
      <line x1="-4" y1="18" x2="4" y2="18" stroke={STROKE} strokeWidth="1.4" />
      <text x="0" y="34" textAnchor="middle" fill="#64748b" fontSize="11">
        GND
      </text>
    </g>
  );
}

function Dot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="3" fill={STROKE} />;
}

function WireHV({ a, b }: { a: Pt; b: Pt }) {
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) {
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={STROKE} strokeWidth="1.7" />;
  }
  return (
    <path
      d={`M ${a.x} ${a.y} L ${a.x} ${b.y} L ${b.x} ${b.y}`}
      fill="none"
      stroke={STROKE}
      strokeWidth="1.7"
    />
  );
}



type Placed = {
  part: PlacedPart;
  ref: string;
  x: number;
  y: number;
  pins: Record<string, Pt>;
  role: "series" | "gate" | "branch" | "other";
  // For two-terminal symbols this is the visual order of the pins.
  // It is derived from the actual net path, never from the component's
  // arbitrary a/b insertion order.
  pinOrder?: [string, string];
};

type CircuitEdge = {
  part: PlacedPart;
  fromPin: string;
  toPin: string;
  fromNet: string;
  toNet: string;
};

/**
 * Canonical terminal plan per component kind.
 *
 * 1. List every electrical pin the part has.
 * 2. `seriesPair` (optional) = the two pins that form the main conduction
 *    path used as a graph edge for VCC→GND pathfinding.
 * 3. All other pins (gate, base, …) stay multipin terminals: they join the
 *    schematic only when their net is shared with another seated pin.
 *
 * Polar = series direction matters for the symbol (diode, LED, SCR).
 * Non-polar = either orientation is fine (resistor, switch, motor, …).
 */
type TerminalPlan = {
  /** Preferred pin names in schematic order when present. */
  pins: string[];
  /** Main conduction pair for pathfinding, if any. */
  seriesPair?: [string, string];
  polar: boolean;
};

function terminalPlan(kind: PlacedPart["kind"]): TerminalPlan {
  switch (kind) {
    case "resistor":
    case "pot":
    case "inductor":
      return { pins: ["a", "b"], seriesPair: ["a", "b"], polar: false };
    case "capacitor":
      return { pins: ["a", "b"], seriesPair: ["a", "b"], polar: false };
    case "switch":
    case "button":
      return { pins: ["a", "b"], seriesPair: ["a", "b"], polar: false };
    case "motor":
    case "buzzer":
    case "speaker":
    case "relay":
      return { pins: ["a", "b"], seriesPair: ["a", "b"], polar: false };
    case "diode":
    case "led":
      return { pins: ["a", "k"], seriesPair: ["a", "k"], polar: true };
    case "diac":
      return { pins: ["a", "b"], seriesPair: ["a", "b"], polar: false };
    case "thyristor":
      // Real TO-220 order: Cathode, Anode, Gate (matches TYN612 datasheet)
      // seriesPair stays A–K for the main conduction path
      return { pins: ["k", "a", "g"], seriesPair: ["a", "k"], polar: true };
    case "triac":
      return { pins: ["mt1", "g", "mt2"], seriesPair: ["mt1", "mt2"], polar: false };
    case "transistor":
      // No single series pair — collector/emitter depend on NPN/PNP bias;
      // treat C–E as series for layout pathfinding, base is control.
      return { pins: ["c", "b", "e"], seriesPair: ["c", "e"], polar: true };
    case "oled":
      return { pins: ["vcc", "gnd", "sda", "scl"], polar: true };
    case "lcd":
      return {
        pins: [
          "vss", "vdd", "v0", "rs", "rw", "e",
          "d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "a", "k",
        ],
        polar: true,
      };
    case "mcu":
      return {
        pins: ["vcc", "gnd", "3v3", "d0", "d1", "d2", "d3"],
        polar: true,
      };
    default:
      return { pins: ["a", "b"], seriesPair: ["a", "b"], polar: false };
  }
}

/** Seated pins on the breadboard for this part (hole assigned). */
function seatedPins(part: PlacedPart): string[] {
  const plan = terminalPlan(part.kind);
  const preferred = plan.pins.filter((p) => Boolean(part.pins[p]));
  if (preferred.length >= 1) return preferred;
  // Fallback: whatever keys are actually present
  return Object.keys(part.pins).filter((p) => Boolean(part.pins[p]));
}

/**
 * Two pins that form the main schematic edge for pathfinding.
 * Returns null for pure multipin devices without a series pair seated.
 */
function electricalTerminals(part: PlacedPart): [string, string] | null {
  const plan = terminalPlan(part.kind);
  const seated = seatedPins(part);

  if (plan.seriesPair) {
    const [p0, p1] = plan.seriesPair;
    if (part.pins[p0] && part.pins[p1]) return [p0, p1];
  }

  // Generic two-terminal: any two seated pins form the edge (non-polar).
  if (seated.length === 2) return [seated[0], seated[1]];
  if (seated.length > 2 && plan.seriesPair) {
    // Series pair missing one pin — cannot form main edge
    return null;
  }
  return null;
}

function isNonPolar(part: PlacedPart): boolean {
  return !terminalPlan(part.kind).polar;
}

/**
 * Build undirected edges: each two-terminal conduction path is one graph edge.
 *
 * Algorithm per part:
 *   1. Determine its terminal plan (how many nodes, which pair is series).
 *   2. Map each seated pin → electrical net (strip ∪ wires).
 *   3. If the series pair sits on two different nets → push edge N1—part—N2.
 *   4. Extra pins (gate, base, …) are not extra edges; they attach when routing
 *      pin → net anchor, and only if that net is on the powered circuit.
 */
function makeEdges(parts: PlacedPart[], pinNet: Map<string, string>): CircuitEdge[] {
  const edges: CircuitEdge[] = [];

  for (const part of parts) {
    const terminals = electricalTerminals(part);
    if (!terminals) continue;

    const [pinA, pinB] = terminals;
    const netA = netOf(pinNet, part.id, pinA);
    const netB = netOf(pinNet, part.id, pinB);
    if (!netA || !netB) continue;
    if (netA === netB) continue; // shorted leads — not a useful edge

    edges.push({
      part,
      fromPin: pinA,
      toPin: pinB,
      fromNet: netA,
      toNet: netB,
    });
  }

  return edges;
}

/**
 * Find a real electrical path between two nets.
 * This is used only to decide which connected branch deserves the primary
 * vertical presentation. It never creates a connection that isn't present
 * in pinNet.
 */
function findNetPath(
  startNet: string | null,
  endNet: string | null,
  edges: CircuitEdge[],
  excludedIds = new Set<string>(),
): CircuitEdge[] {
  if (!startNet || !endNet || startNet === endNet) return [];

  const graph = new Map<string, { edge: CircuitEdge; next: string; cost: number }[]>();

  const add = (net: string, item: { edge: CircuitEdge; next: string; cost: number }) => {
    const list = graph.get(net) ?? [];
    list.push(item);
    graph.set(net, list);
  };

  for (const edge of edges) {
    if (excludedIds.has(edge.part.id)) continue;

    // Prefer the real power path (motor + SCR) when several routes exist.
    // Resistors stay cheap enough to appear on a closed series string or gate
    // branch — they are never skipped just because they are non-polar.
    const cost =
      edge.part.kind === "thyristor" || edge.part.kind === "triac"
        ? 0.15
        : edge.part.kind === "motor"
          ? 0.25
          : edge.part.kind === "resistor"
            ? 0.45
            : edge.part.kind === "switch" || edge.part.kind === "button"
              ? 0.40
              : 1;

    add(edge.fromNet, { edge, next: edge.toNet, cost });
    add(edge.toNet, { edge, next: edge.fromNet, cost });
  }

  const dist = new Map<string, number>([[startNet, 0]]);
  const previous = new Map<string, { net: string; edge: CircuitEdge }>();
  const open = [startNet];

  while (open.length) {
    open.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const current = open.shift()!;
    if (current === endNet) break;

    for (const item of graph.get(current) ?? []) {
      const nextDist = (dist.get(current) ?? Infinity) + item.cost;
      if (nextDist < (dist.get(item.next) ?? Infinity)) {
        dist.set(item.next, nextDist);
        previous.set(item.next, { net: current, edge: item.edge });
        if (!open.includes(item.next)) open.push(item.next);
      }
    }
  }

  if (!previous.has(endNet)) return [];

  const path: CircuitEdge[] = [];
  let cursor = endNet;

  while (cursor !== startNet) {
    const step = previous.get(cursor);
    if (!step) return [];
    path.push(step.edge);
    cursor = step.net;
  }

  return path.reverse();
}

function orientPath(
  startNet: string | null,
  path: CircuitEdge[],
): { edge: CircuitEdge; entryNet: string; exitNet: string }[] {
  if (!startNet) return [];

  const result: { edge: CircuitEdge; entryNet: string; exitNet: string }[] = [];
  let currentNet = startNet;

  for (const edge of path) {
    if (edge.fromNet === currentNet) {
      result.push({ edge, entryNet: edge.fromNet, exitNet: edge.toNet });
      currentNet = edge.toNet;
    } else if (edge.toNet === currentNet) {
      result.push({ edge, entryNet: edge.toNet, exitNet: edge.fromNet });
      currentNet = edge.fromNet;
    } else {
      // A path returned by findNetPath should always be contiguous. If it is
      // not, stop rather than inventing a visual connection.
      break;
    }
  }

  return result;
}

function pinPoint(
  part: PlacedPart,
  pin: string,
  x: number,
  y: number,
  role: Placed["role"],
  pinOrder?: [string, string],
): Pt {
  const vertical = role === "series" || role === "branch";

  if (vertical) {
    // Two-terminal parts are explicitly oriented according to the actual
    // electrical path: pinOrder[0] is the upstream/top net and pinOrder[1]
    // is the downstream/bottom net. This fixes reversed/floating-looking
    // resistors and switches without changing their real connectivity.
    if (pinOrder && pinOrder.length === 2 && pin === pinOrder[0]) {
      return { x, y: y - 32 };
    }
    if (pinOrder && pinOrder.length === 2 && pin === pinOrder[1]) {
      return { x, y: y + 32 };
    }

    if (part.kind === "thyristor") {
      if (pin === "a") return { x, y: y - 32 };
      if (pin === "k") return { x, y: y + 32 };
      if (pin === "g") return { x: x + 36, y: y + 16 };
    }

    if (part.kind === "triac") {
      if (pin === "mt1" || pin === "a") return { x, y: y - 32 };
      if (pin === "mt2" || pin === "k") return { x, y: y + 32 };
      if (pin === "g") return { x: x + 36, y: y + 16 };
    }

    if (part.kind === "transistor") {
      // Standard vertical BJT: C top, E bottom, B left
      if (pin === "c") return { x, y: y - 28 };
      if (pin === "e") return { x, y: y + 28 };
      if (pin === "b") return { x: x - 28, y };
    }

    // Use the actual electrical terminals. A resistor's a/b pins are non-polar,
    // so either physical side may be upstream; both sides still get their own
    // node assignment and wire.
    const terminals = electricalTerminals(part);
    if (terminals) {
      if (pin === terminals[0]) {
        return { x, y: y - 32 };
      }
      if (pin === terminals[1]) {
        return { x, y: y + 32 };
      }
    }

    // Unknown/multi-pin fallback: keep the historical a/b behavior.
    if (part.kind === "thyristor") {
      if (pin === "a") return { x, y: y - 32 };
      if (pin === "k") return { x, y: y + 32 };
    }
    if (part.kind === "triac") {
      if (pin === "mt1" || pin === "a") return { x, y: y - 32 };
      if (pin === "mt2" || pin === "k") return { x, y: y + 32 };
    }
    return { x, y: y + (pin === "a" ? -32 : 32) };
  }

  // Gate/control components are drawn left-to-right, ordered from the SCR
  // gate (small x, near the main path) out toward +V (large x). pinOrder[0]
  // is the upstream net (normally +V) and pinOrder[1] is the downstream net
  // (normally the SCR gate). Upstream is placed on the RIGHT and downstream
  // on the LEFT so each component's pins face its actual neighbor and the
  // branch reads as a clean straight run instead of crossing wires.
  if (pinOrder && pinOrder.length === 2) {
    if (pin === pinOrder[0]) return { x: x + 28, y };
    if (pin === pinOrder[1]) return { x: x - 28, y };
  }

  // Horizontal two-terminal symbols must also use the component's real pin
  // identities.  This is especially important for resistors whose pins are not
  // guaranteed to be named "a"/"b".
  const terminals = electricalTerminals(part);
  if (terminals) {
    if (pin === terminals[0]) return { x: x - 32, y };
    if (pin === terminals[1]) return { x: x + 32, y };
  }

  return { x: x + (pin === "a" ? -32 : 32), y };
}

function placePart(
  part: PlacedPart,
  ref: string,
  x: number,
  y: number,
  role: Placed["role"],
  pinOrder?: [string, string],
): Placed {
  const pins: Record<string, Pt> = {};
  for (const pin of Object.keys(part.pins)) {
    pins[pin] = pinPoint(part, pin, x, y, role, pinOrder);
  }
  return { part, ref, x, y, pins, role, pinOrder };
}

/**
 * Return the two pins of an edge in the requested net direction.
 * The edge itself is intentionally undirected in the graph, so we must not
 * assume that its `fromPin` is visually first.
 */
function pinsForNetDirection(
  edge: CircuitEdge,
  entryNet: string,
  exitNet: string,
): [string, string] | undefined {
  const aPin = edge.fromNet === entryNet && edge.toNet === exitNet
    ? edge.fromPin
    : edge.toNet === entryNet && edge.fromNet === exitNet
      ? edge.toPin
      : undefined;
  const bPin = edge.fromNet === entryNet && edge.toNet === exitNet
    ? edge.toPin
    : edge.toNet === entryNet && edge.fromNet === exitNet
      ? edge.fromPin
      : undefined;
  return aPin && bPin ? [aPin, bPin] : undefined;
}

type Netlist = {
  pinNet: Map<string, string>;
  nodes: Map<string, ElectricalNode>;
  find: (id: string) => string;
  components: PlacedPart[];
  edges: CircuitEdge[];
};

/**
 * Build the circuit as a bipartite electrical graph:
 *
 *   component -- pin -- NET -- pin -- component
 *
 * Breadboard coordinates are used ONLY to discover the electrical nets.  They
 * are never used as schematic coordinates.
 */
function buildNetlist(parts: PlacedPart[], wires: Wire[]): Netlist {
  const { pinNet, nodes, find } = buildNets(parts, wires);
  return { pinNet, nodes, find, components: parts, edges: makeEdges(parts, pinNet) };
}

/**
 * Analyze the circuit after node assignment.  This is the schematic source of
 * truth: each component is represented by its pins, each pin has exactly one
 * electrical node, and component-to-component connections are derived by
 * comparing those node IDs.  Physical screen position is deliberately absent
 * from this analysis.
 */
type ComponentNodeInfo = {
  part: PlacedPart;
  pins: Record<string, string>;
  connectedParts: Map<string, string[]>;
};

function analyzeComponentNodes(netlist: Netlist): Map<string, ComponentNodeInfo> {
  const result = new Map<string, ComponentNodeInfo>();
  const byNode = new Map<string, { partId: string; pin: string }[]>();

  for (const part of netlist.components) {
    const pins: Record<string, string> = {};
    for (const pin of Object.keys(part.pins)) {
      const node = netOf(netlist.pinNet, part.id, pin);
      if (!node) continue;
      pins[pin] = node;
      const list = byNode.get(node) ?? [];
      list.push({ partId: part.id, pin });
      byNode.set(node, list);
    }
    result.set(part.id, { part, pins, connectedParts: new Map() });
  }

  // For every node, connect every participating component to every other
  // participating component. The node itself is the reason for the connection.
  for (const [node, members] of byNode) {
    for (const member of members) {
      const info = result.get(member.partId);
      if (!info) continue;
      const peers = info.connectedParts.get(node) ?? [];
      for (const other of members) {
        if (other.partId !== member.partId && !peers.includes(other.partId)) {
          peers.push(other.partId);
        }
      }
      info.connectedParts.set(node, peers);
    }
  }

  return result;
}


/**
 * Node-first connection analysis.
 *
 * The schematic is generated from this table, not from component positions:
 *
 *   COMPONENT -> PIN -> NODE
 *                     |
 *                     +-> other COMPONENT/PIN
 *
 * For each component we retain the exact node attached to every pin.  A
 * component-to-component connection exists only when the corresponding pins
 * share the same electrical node.  This is deliberately separate from the
 * visual layout so a resistor can never be connected merely because it is
 * nearby another symbol.
 */
type TopologyConnection = {
  node: string;
  a: { partId: string; pin: string };
  b: { partId: string; pin: string };
};

type CircuitTopology = {
  componentNodes: Map<string, ComponentNodeInfo>;
  nodeMembers: Map<string, { partId: string; pin: string }[]>;
  connections: TopologyConnection[];
};

function analyzeCircuitTopology(netlist: Netlist): CircuitTopology {
  const componentNodes = analyzeComponentNodes(netlist);
  const nodeMembers = new Map<string, { partId: string; pin: string }[]>();

  for (const [partId, info] of componentNodes) {
    for (const [pin, node] of Object.entries(info.pins)) {
      const members = nodeMembers.get(node) ?? [];
      members.push({ partId, pin });
      nodeMembers.set(node, members);
    }
  }

  const connections: TopologyConnection[] = [];
  for (const [node, members] of nodeMembers) {
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        if (members[i].partId === members[j].partId) continue;
        connections.push({ node, a: members[i], b: members[j] });
      }
    }
  }

  return { componentNodes, nodeMembers, connections };
}

function pathScore(edge: CircuitEdge): number {
  switch (edge.part.kind) {
    case "thyristor":
    case "triac":
      return 0.15;
    case "motor":
      return 0.25;
    case "switch":
    case "button":
      return 0.40;
    case "resistor":
      // Non-polar — same cost either way; low enough to stay on closed paths
      return 0.45;
    default:
      return 0.80;
  }
}

/** Dijkstra over NET nodes. Components are graph edges. */
function shortestNetPath(start: string | null, goal: string | null, edges: CircuitEdge[], blocked = new Set<string>()) {
  if (!start || !goal) return [] as CircuitEdge[];
  if (start === goal) return [] as CircuitEdge[];

  const graph = new Map<string, { next: string; edge: CircuitEdge; cost: number }[]>();
  const add = (a: string, next: string, edge: CircuitEdge) => {
    const list = graph.get(a) ?? [];
    list.push({ next, edge, cost: pathScore(edge) });
    graph.set(a, list);
  };

  for (const edge of edges) {
    if (blocked.has(edge.part.id)) continue;
    add(edge.fromNet, edge.toNet, edge);
    add(edge.toNet, edge.fromNet, edge);
  }

  const dist = new Map<string, number>([[start, 0]]);
  const prev = new Map<string, { net: string; edge: CircuitEdge }>();
  const queue = [start];

  while (queue.length) {
    queue.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const cur = queue.shift()!;
    if (cur === goal) break;

    for (const item of graph.get(cur) ?? []) {
      const nd = (dist.get(cur) ?? Infinity) + item.cost;
      if (nd < (dist.get(item.next) ?? Infinity)) {
        dist.set(item.next, nd);
        prev.set(item.next, { net: cur, edge: item.edge });
        if (!queue.includes(item.next)) queue.push(item.next);
      }
    }
  }

  if (!prev.has(goal)) return [] as CircuitEdge[];
  const result: CircuitEdge[] = [];
  let cur = goal;
  while (cur !== start) {
    const step = prev.get(cur);
    if (!step) return [] as CircuitEdge[];
    result.push(step.edge);
    cur = step.net;
  }
  return result.reverse();
}

function orientEdgesFrom(startNet: string | null, path: CircuitEdge[]) {
  if (!startNet) return [] as { edge: CircuitEdge; entryNet: string; exitNet: string }[];
  const out: { edge: CircuitEdge; entryNet: string; exitNet: string }[] = [];
  let current = startNet;
  for (const edge of path) {
    if (edge.fromNet === current) {
      out.push({ edge, entryNet: edge.fromNet, exitNet: edge.toNet });
      current = edge.toNet;
    } else if (edge.toNet === current) {
      out.push({ edge, entryNet: edge.toNet, exitNet: edge.fromNet });
      current = edge.fromNet;
    } else {
      break;
    }
  }
  return out;
}

/**
 * Orient a non-polar edge for drawing: which pin faces the entry net vs exit.
 * Resistor a/b names are ignored — only the electrical nets matter.
 */
function edgePins(edge: CircuitEdge, entryNet: string, exitNet: string): [string, string] | undefined {
  if (edge.fromNet === entryNet && edge.toNet === exitNet) {
    return [edge.fromPin, edge.toPin];
  }
  if (edge.toNet === entryNet && edge.fromNet === exitNet) {
    // Flip: non-polar part is walked in reverse direction along the path
    return [edge.toPin, edge.fromPin];
  }
  // Soft match for layout when only one side is known (branch attachment)
  if (edge.fromNet === entryNet) return [edge.fromPin, edge.toPin];
  if (edge.toNet === entryNet) return [edge.toPin, edge.fromPin];
  if (edge.fromNet === exitNet) return [edge.toPin, edge.fromPin];
  if (edge.toNet === exitNet) return [edge.fromPin, edge.toPin];
  return undefined;
}

function netDegree(net: string, edges: CircuitEdge[]): number {
  let degree = 0;
  for (const edge of edges) {
    if (edge.fromNet === net || edge.toNet === net) {
      degree++;
    }
  }
  return degree;
}

function edgeTouchesNet(edge: CircuitEdge, net: string): boolean {
  return edge.fromNet === net || edge.toNet === net;
}

/**
 * A junction is an electrical NET with more than two distinct component
 * terminals.  The degree check prevents a simple two-terminal chain from
 * being rendered as a junction just because it happens to have several
 * geometric points in the final SVG.
 */
function getJunctionNets(netlist: Netlist): Set<string> {
  const junctions = new Set<string>();

  for (const [net, node] of netlist.nodes) {
    const distinctPins = new Set(
      node.pins.map((pin) => `${pin.partId}:${pin.pin}`),
    );

    if (distinctPins.size > 2 && netDegree(net, netlist.edges) >= 2) {
      junctions.add(net);
    }
  }

  return junctions;
}

function placeGraphLayout(netlist: Netlist, vccNet: string | null, gndNet: string | null): Placed[] {
  const { components, edges } = netlist;
  const topology = analyzeCircuitTopology(netlist);
  const componentNodes = topology.componentNodes;
  const refs = new Map<string, number>();
  const placed: Placed[] = [];
  const used = new Set<string>();

  // 1) The primary path is a REAL graph path from VCC to GND.
  const mainPath = shortestNetPath(vccNet, gndNet, edges);
  const orientedMain = orientEdgesFrom(vccNet, mainPath);
  const mainIds = new Set(orientedMain.map(s => s.edge.part.id));
  const mainNets = new Set<string>();
  if (vccNet) mainNets.add(vccNet);
  for (const step of orientedMain) mainNets.add(step.exitNet);
  if (gndNet) mainNets.add(gndNet);

  // Compact graph layout: each component occupies one slot.  There is no
  // fixed 120->430 spine and no component is painted on top of a wire.
  orientedMain.forEach((step, i) => {
    const pins = edgePins(step.edge, step.entryNet, step.exitNet);
    const y = TOP_Y + i * STEP_Y + STEP_Y / 2;
    placed.push(placePart(
      step.edge.part,
      refDes(step.edge.part, refs),
      CX,
      y,
      "series",
      pins,
    ));
    used.add(step.edge.part.id);
  });

  // 2) Gate/control layout is driven by the SAME NET graph as the main path.
  // Find the actual chain from the SCR gate node back toward the supply.  Do not
  // place every gate-connected part at the same x/y coordinate: each component
  // must sit BETWEEN the two nets that it actually connects.
  const scr = components.find(p => p.kind === "thyristor" || p.kind === "triac");
  const gatePin = scr && scr.pins.g ? "g" : null;
  const gateNet = scr && gatePin
    ? netOf(netlist.pinNet, scr.id, gatePin) ?? null
    : null;

  const scrPlaced = scr ? placed.find(p => p.part.id === scr.id) : undefined;
  const gateY = scrPlaced?.pins.g?.y ?? (TOP_Y + STEP_Y);

  if (scr && gateNet) {
    const gateX = BRANCH_X;

    // The control network is another graph path.  Its left end is the SCR gate
    // node and its right end is the supply node.  Because the path is derived
    // from pinNet, every symbol placed here represents a real component edge.
    const gatePath = shortestNetPath(gateNet, vccNet, edges, mainIds);
    const orientedGate = orientEdgesFrom(gateNet, gatePath);

    orientedGate.forEach((step, i) => {
      const pins = edgePins(step.edge, step.entryNet, step.exitNet);
      if (!pins) return;

      // gate/control symbols are horizontal.  pinOrder is [right/upstream,
      // left/downstream] because pinPoint() intentionally puts the upstream
      // terminal on the right and the downstream terminal on the left.
      const pinOrder: [string, string] = [pins[1], pins[0]];
      const x = gateX + (i + 0.5) * BRANCH_STEP_X;

      placed.push(placePart(
        step.edge.part,
        refDes(step.edge.part, refs),
        x,
        gateY,
        "gate",
        pinOrder,
      ));
      used.add(step.edge.part.id);
    });

    // If the gate is not connected to VCC through a complete two-terminal path
    // (for example a standalone gate-control source), still place every real
    // two-terminal component touching the gate net.  They are laid out as
    // individual horizontal branches rather than stacked on top of one another.
    const gateEdges = edges.filter(
      e => !used.has(e.part.id) && edgeTouchesNet(e, gateNet),
    );

    gateEdges.forEach((edge, i) => {
      const gateIsFrom = edge.fromNet === gateNet;
      const gatePinName = gateIsFrom ? edge.fromPin : edge.toPin;
      const otherPinName = gateIsFrom ? edge.toPin : edge.fromPin;
      const x = gateX + (orientedGate.length + i + 0.5) * BRANCH_STEP_X;

      // downstream/gate pin is LEFT, other net is RIGHT.
      placed.push(placePart(
        edge.part,
        refDes(edge.part, refs),
        x,
        gateY,
        "gate",
        [otherPinName, gatePinName],
      ));
      used.add(edge.part.id);
    });

    // Multi-pin devices connected to the gate node are anchored beside the
    // control chain.  Their other pins retain their own electrical nodes.
    for (const part of components) {
      if (used.has(part.id) || mainIds.has(part.id)) continue;
      const pinsOnGate = Object.keys(part.pins).filter(
        pin => netOf(netlist.pinNet, part.id, pin) === gateNet,
      );
      if (!pinsOnGate.length) continue;

      const x = gateX + (orientedGate.length + gateEdges.length + 1) * BRANCH_STEP_X;
      placed.push(placePart(part, refDes(part, refs), x, gateY, "gate"));
      used.add(part.id);
    }
  }

  // 3) Any remaining two-terminal component connected to a main NET is a
  // branch. If both terminals are on the main path, it is drawn vertically in
  // parallel. If only one terminal touches the main path, draw it outward and
  // keep its far end as its own node (no fake return wire).
  const mainNetY = new Map<string, number>();
  if (vccNet) mainNetY.set(vccNet, TOP_Y);
  orientedMain.forEach((step, i) => {
    mainNetY.set(step.entryNet, TOP_Y + i * STEP_Y);
    mainNetY.set(step.exitNet, TOP_Y + (i + 1) * STEP_Y);
  });
  if (gndNet) mainNetY.set(gndNet, TOP_Y + orientedMain.length * STEP_Y);

  const branchEdges = edges.filter(e => {
    if (used.has(e.part.id)) return false;
    const info = componentNodes.get(e.part.id);
    if (!info) return false;
    const fromNode = info.pins[e.fromPin];
    const toNode = info.pins[e.toPin];
    return Boolean(fromNode && mainNets.has(fromNode)) || Boolean(toNode && mainNets.has(toNode));
  });
  let branchIndex = 0;
  for (const edge of branchEdges) {
    if (used.has(edge.part.id)) continue;
    const fromMain = mainNets.has(edge.fromNet);
    const toMain = mainNets.has(edge.toNet);
    const bothMain = fromMain && toMain;
    const anchorNet = fromMain ? edge.fromNet : edge.toNet;
    const anchorY = (() => {
      return mainNetY.get(anchorNet) ?? TOP_Y + STEP_Y * Math.min(orientedMain.length, branchIndex + 1);
    })();

    if (bothMain) {
      const a = mainNets.has(edge.fromNet) ? edge.fromNet : edge.toNet;
      const b = a === edge.fromNet ? edge.toNet : edge.fromNet;
      const yA = mainNetY.get(a) ?? TOP_Y;
      const yB = mainNetY.get(b) ?? TOP_Y + STEP_Y;
      const mid = (yA + yB) / 2;
      const pins = edgePins(edge, a, b);
      placed.push(placePart(edge.part, refDes(edge.part, refs), BRANCH_X + branchIndex * BRANCH_STEP_X, mid, "branch", pins));
    } else {
      const entryNet = fromMain ? edge.fromNet : edge.toNet;
      const exitNet = fromMain ? edge.toNet : edge.fromNet;
      const pins = edgePins(edge, entryNet, exitNet);
      placed.push(placePart(edge.part, refDes(edge.part, refs), BRANCH_X + branchIndex * BRANCH_STEP_X, anchorY, "gate", pins));
    }
    used.add(edge.part.id);
    branchIndex++;
  }

  // 4) Multi-pin and otherwise disconnected components still get a symbol.
  // They are not silently dropped and are never electrically connected by
  // proximity.  Their actual nets will be rendered by the terminal router.
  for (const part of components) {
    if (used.has(part.id)) continue;
    const x = BRANCH_X + (branchIndex % 5) * BRANCH_STEP_X;
    const y = TOP_Y + orientedMain.length * STEP_Y + 100 + Math.floor(branchIndex / 5) * 90;
    placed.push(placePart(part, refDes(part, refs), x, y, "other"));
    used.add(part.id);
    branchIndex++;
  }

  // Invariant: every two-terminal symbol in `placed` came from a real edge whose
  // two pins were assigned to two real electrical nodes. The renderer later
  // connects only terminals that carry the same node ID.
  return placed;
}


/**
 * TRUE NODE-FIRST SCHEMATIC LAYOUT
 *
 * 1. `netlist` already contains the real electrical node for every pin.
 * 2. We analyse those nodes into a graph of NODE <-> COMPONENT <-> NODE.
 * 3. We assign schematic coordinates to nodes first.
 * 4. Every component is then placed from its two node coordinates.
 * 5. The renderer connects only pins belonging to the same node.
 *
 * There is intentionally no breadboard-position sorting, nearest-neighbour
 * matching, or "main path first" heuristic in this function.
 */
function placeNodeFirstLayout(
  netlist: Netlist,
  vccNet: string | null,
  gndNet: string | null,
): { placed: Placed[]; nodeAnchors: Map<string, Pt>; mainNets: Set<string> } {
  const topology = analyzeCircuitTopology(netlist);
  const edges = netlist.edges;
  const refs = new Map<string, number>();
  const placed: Placed[] = [];
  const used = new Set<string>();
  const nodeAnchors = new Map<string, Pt>();
  const mainNets = new Set<string>();

  type Adj = { node: string; edge: CircuitEdge };
  const adjacency = new Map<string, Adj[]>();
  const addAdj = (node: string, item: Adj) => {
    const list = adjacency.get(node) ?? [];
    list.push(item);
    adjacency.set(node, list);
  };
  for (const edge of edges) {
    addAdj(edge.fromNet, { node: edge.toNet, edge });
    addAdj(edge.toNet, { node: edge.fromNet, edge });
  }

  // -----------------------------------------------------------------------
  // 1. BUILD THE GRAPH FROM ELECTRICAL NODES.
  // -----------------------------------------------------------------------
  // At this point breadboard coordinates are gone.  Every edge below is a
  // real component whose two terminals belong to the two named electrical
  // nodes.  The only job of this function is to give that graph a readable
  // schematic geometry.
  // -----------------------------------------------------------------------
  const mainPath = orientPath(vccNet, findNetPath(vccNet, gndNet, edges));
  if (vccNet) mainNets.add(vccNet);
  for (const step of mainPath) mainNets.add(step.exitNet);

  // Main power path: VCC -> ... -> GND is the vertical reference column.
  // The path itself is selected from the graph, never from breadboard order.
  if (vccNet) nodeAnchors.set(vccNet, { x: CX, y: TOP_Y });
  mainPath.forEach((step, i) => {
    const next = TOP_Y + (i + 1) * STEP_Y;
    nodeAnchors.set(step.exitNet, { x: CX, y: next });
  });
  if (gndNet && !nodeAnchors.has(gndNet)) {
    nodeAnchors.set(gndNet, {
      x: CX,
      y: TOP_Y + mainPath.length * STEP_Y,
    });
    mainNets.add(gndNet);
  }

  // If there is no VCC/GND path, use the largest connected graph as the
  // primary island.  This still uses only topology, so a floating circuit is
  // represented instead of silently disappearing.
  if (!mainPath.length && !nodeAnchors.size) {
    const seed = edges[0]?.fromNet ?? Array.from(topology.nodeMembers.keys())[0];
    if (seed) nodeAnchors.set(seed, { x: CX, y: TOP_Y });
  }

  // -----------------------------------------------------------------------
  // 2. PLACE ALL REMAINING NODES.
  // -----------------------------------------------------------------------
  // A non-main node is attached to the nearest already-positioned graph node.
  // Each branch receives its own horizontal lane.  Crucially, the node gets a
  // coordinate BEFORE its components are placed; components never determine
  // where a node is by looking at their rendered terminal positions.
  // -----------------------------------------------------------------------
  const distance = new Map<string, number>();
  const owner = new Map<string, string>();
  const queue: string[] = [];
  for (const node of nodeAnchors.keys()) {
    distance.set(node, 0);
    owner.set(node, node);
    queue.push(node);
  }

  while (queue.length) {
    const cur = queue.shift()!;
    const d = distance.get(cur) ?? 0;
    for (const item of adjacency.get(cur) ?? []) {
      if (!distance.has(item.node)) {
        distance.set(item.node, d + 1);
        owner.set(item.node, owner.get(cur) ?? cur);
        queue.push(item.node);
      }
    }
  }

  // Allocate branch nodes by graph distance.  The main column stays centered;
  // sibling branches are spread left/right so their node anchors are explicit
  // routing points rather than inferred hubs.
  const branchGroups = new Map<string, string[]>();
  for (const node of topology.nodeMembers.keys()) {
    if (nodeAnchors.has(node)) continue;
    const root = owner.get(node) ?? node;
    const list = branchGroups.get(root) ?? [];
    list.push(node);
    branchGroups.set(root, list);
  }

  let floatingIndex = 0;
  for (const [root, ids] of branchGroups) {
    const rootPoint = nodeAnchors.get(root);
    if (!rootPoint) continue;
    ids.sort((a, b) => (distance.get(a) ?? 0) - (distance.get(b) ?? 0) || a.localeCompare(b));

    ids.forEach((node, i) => {
      const d = distance.get(node) ?? 1;
      const sameDepth = ids.filter((n) => (distance.get(n) ?? 0) === d);
      const slot = sameDepth.indexOf(node);
      const side = slot % 2 === 0 ? 1 : -1;
      const column = Math.floor(slot / 2) + 1;
      nodeAnchors.set(node, {
        x: rootPoint.x + side * column * 150,
        y: rootPoint.y + d * STEP_Y,
      });
    });

    floatingIndex++;
  }

  // Disconnected islands get their own graph region below the powered graph.
  // No electrical connection is invented between islands.
  for (const node of topology.nodeMembers.keys()) {
    if (nodeAnchors.has(node)) continue;
    const x = CX + (floatingIndex % 4 - 1.5) * 180;
    const y = TOP_Y + 260 + Math.floor(floatingIndex / 4) * 140;
    nodeAnchors.set(node, { x, y });
    floatingIndex++;
  }

  // -----------------------------------------------------------------------
  // 3. PLACE COMPONENTS FROM THEIR NODE PAIRS.
  // -----------------------------------------------------------------------
  // Components do not establish connections here.  Their two real pin-nodes
  // are already known.  We simply put the symbol between those node anchors.
  // Parallel components share the same two node IDs and therefore receive
  // parallel lanes instead of being mistaken for a series connection.
  // -----------------------------------------------------------------------
  const pairCounts = new Map<string, number>();
  const pairIndex = new Map<string, number>();
  const pairKey = (a: string, b: string) => [a, b].sort().join("|");
  for (const edge of edges) {
    const key = pairKey(edge.fromNet, edge.toNet);
    pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1);
  }

  // Main path first, so the textbook VCC-to-GND column is visually dominant.
  for (const step of mainPath) {
    const edge = step.edge;
    const a = nodeAnchors.get(step.entryNet);
    const b = nodeAnchors.get(step.exitNet);
    const pins = edgePins(edge, step.entryNet, step.exitNet);
    if (!a || !b || !pins) continue;

    placed.push(placePart(
      edge.part,
      refDes(edge.part, refs),
      a.x,
      (a.y + b.y) / 2,
      "series",
      pins,
    ));
    used.add(edge.part.id);
  }

  // All other two-terminal graph edges (gate resistors, switches, …).
  // Non-polar orientation follows node geometry: the pin on the "entry" net
  // faces that net's anchor so wires meet the symbol cleanly.
  for (const edge of edges) {
    if (used.has(edge.part.id)) continue;
    const a = nodeAnchors.get(edge.fromNet);
    const b = nodeAnchors.get(edge.toNet);
    if (!a || !b) continue;

    const key = pairKey(edge.fromNet, edge.toNet);
    const index = pairIndex.get(key) ?? 0;
    pairIndex.set(key, index + 1);
    const count = pairCounts.get(key) ?? 1;

    // Choose visual entry/exit from positions, not pin names (non-polar).
    let entryNet = edge.fromNet;
    let exitNet = edge.toNet;
    if (isNonPolar(edge.part)) {
      const horizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
      if (horizontal) {
        // left → right
        if (a.x <= b.x) {
          entryNet = edge.fromNet;
          exitNet = edge.toNet;
        } else {
          entryNet = edge.toNet;
          exitNet = edge.fromNet;
        }
      } else {
        // top → bottom
        if (a.y <= b.y) {
          entryNet = edge.fromNet;
          exitNet = edge.toNet;
        } else {
          entryNet = edge.toNet;
          exitNet = edge.fromNet;
        }
      }
    }

    const pins = edgePins(edge, entryNet, exitNet);
    if (!pins) continue;

    const sameY = Math.abs(a.y - b.y) < 1;
    const sameX = Math.abs(a.x - b.x) < 1;
    let role: Placed["role"];
    let x: number;
    let y: number;
    let pinOrder = pins;

    if (sameX) {
      // Vertical branch/series component between the exact node anchors.
      role = "branch";
      const laneOffset = (index - (count - 1) / 2) * 72;
      x = a.x + laneOffset;
      y = (a.y + b.y) / 2;
    } else if (sameY) {
      // Horizontal component between nodes on the same schematic row.
      role = "gate";
      const laneOffset = (index - (count - 1) / 2) * 72;
      x = (a.x + b.x) / 2;
      y = a.y + laneOffset;
      pinOrder = pins;
    } else {
      // Diagonal node anchors are resolved into an orthogonal symbol lane.
      // The node anchors remain authoritative; the short stubs from the
      // symbol to those anchors are routed later.
      const preferHorizontal = Math.abs(a.x - b.x) >= Math.abs(a.y - b.y);
      role = preferHorizontal ? "gate" : "branch";
      if (role === "gate") {
        x = (a.x + b.x) / 2;
        y = (a.y + b.y) / 2;
      } else {
        x = (a.x + b.x) / 2;
        y = (a.y + b.y) / 2;
      }
      pinOrder = pins;
    }

    placed.push(placePart(edge.part, refDes(edge.part, refs), x, y, role, pinOrder));
    used.add(edge.part.id);
  }

  // -----------------------------------------------------------------------
  // 4. MULTI-PIN DEVICES.
  // -----------------------------------------------------------------------
  // These have more than one electrical pin, so they are not represented as a
  // single graph edge.  Put the symbol near the centroid of its real node
  // anchors.  Their pin-to-node wires are generated by the renderer below.
  // -----------------------------------------------------------------------
  let extra = 0;
  for (const info of topology.componentNodes.values()) {
    if (used.has(info.part.id)) continue;

    const anchors = Object.values(info.pins)
      .map((node) => nodeAnchors.get(node))
      .filter((p): p is Pt => Boolean(p));

    const x = anchors.length
      ? anchors.reduce((sum, p) => sum + p.x, 0) / anchors.length
      : CX + 180 + (extra % 3) * 170;
    const y = anchors.length
      ? anchors.reduce((sum, p) => sum + p.y, 0) / anchors.length
      : TOP_Y + 280 + Math.floor(extra / 3) * 110;

    placed.push(placePart(info.part, refDes(info.part, refs), x, y, "other"));
    used.add(info.part.id);
    extra++;
  }

  // Same-node two-terminal components are intentionally not in `edges`.
  // They still need a visible symbol.  Place them beside their real node.
  for (const part of netlist.components) {
    if (used.has(part.id)) continue;
    const terminals = electricalTerminals(part);
    if (!terminals) continue;
    const aNet = netOf(netlist.pinNet, part.id, terminals[0]);
    const bNet = netOf(netlist.pinNet, part.id, terminals[1]);
    if (!aNet || aNet !== bNet) continue;
    const anchor = nodeAnchors.get(aNet) ?? { x: CX, y: TOP_Y + 300 };
    const x = anchor.x + 100;
    const y = anchor.y;
    placed.push(placePart(part, refDes(part, refs), x, y, "gate", [terminals[0], terminals[1]]));
    used.add(part.id);
  }

  return { placed, nodeAnchors, mainNets };
}

function renderBody(p: Placed, sim: ReturnType<typeof useLab.getState>["sim"]): ReactNode {
  const onScr = Boolean(sim.thyristors?.[p.part.id]?.conducting);
  const onLed = Boolean(sim.leds?.[p.part.id]?.on);
  const onMotor = Boolean(sim.motors?.[p.part.id]?.on);
  const closed = Boolean(p.part.props.closed);

  if (p.role === "series" || p.role === "branch") {
    switch (p.part.kind) {
      case "motor":
        return <SymMotorV x={p.x} y={p.y} on={onMotor} />;
      case "thyristor":
      case "triac":
        return <SymScrV x={p.x} y={p.y} on={onScr} />;
      case "resistor":
        return <SymResistorV x={p.x} y={p.y} />;
      case "diode":
        return <SymDiodeV x={p.x} y={p.y} />;
      case "led":
        return <SymLedV x={p.x} y={p.y} on={onLed} />;
      case "capacitor":
        return <SymCapV x={p.x} y={p.y} />;
      case "button":
      case "switch":
        return <SymSwitchV x={p.x} y={p.y} closed={closed} />;
      default:
        return <SymGeneric x={p.x} y={p.y} label={p.ref} />;
    }
  }

  switch (p.part.kind) {
    case "motor":
      return <SymMotorV x={p.x} y={p.y} on={onMotor} />;
    case "resistor":
      return <SymResistorH x={p.x} y={p.y} />;
    case "button":
    case "switch":
      return <SymSwitchH x={p.x} y={p.y} closed={closed} />;
    default:
      return <SymGeneric x={p.x} y={p.y} label={p.ref} />;
  }
}

function routeOrthogonal(a: Pt, b: Pt, preferHorizontal = false): Pt[] {
  if (Math.abs(a.x - b.x) < 1 || Math.abs(a.y - b.y) < 1) return [a, b];
  if (preferHorizontal) {
    const midX = (a.x + b.x) / 2;
    return [a, { x: midX, y: a.y }, { x: midX, y: b.y }, b];
  }
  const midY = (a.y + b.y) / 2;
  return [a, { x: a.x, y: midY }, { x: b.x, y: midY }, b];
}

/**
 * Nets / parts that belong to the live circuit (reachable from VCC or GND
 * through real component edges).
 *
 * Plan:
 *   1. Seed with supply nets.
 *   2. Walk every two-terminal edge (R, motor, SCR A–K, switch, …).
 *   3. A part is "in circuit" iff at least one of its seated pins sits on a
 *      powered net.
 *   4. Once a multipin device (SCR, transistor, …) is in circuit, its other
 *      seated pins' nets are still only "powered" if an edge path reaches
 *      them — we do NOT force-connect a floating gate/base into the diagram.
 */
function poweredConnectivity(
  vccNet: string | null,
  gndNet: string | null,
  edges: CircuitEdge[],
  pinNet: Map<string, string>,
  parts: PlacedPart[],
): { poweredNets: Set<string>; poweredPartIds: Set<string> } {
  const poweredNets = new Set<string>();
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const la = adj.get(a) ?? [];
    if (!la.includes(b)) la.push(b);
    adj.set(a, la);
  };
  for (const e of edges) {
    link(e.fromNet, e.toNet);
    link(e.toNet, e.fromNet);
  }

  const queue: string[] = [];
  if (vccNet) {
    poweredNets.add(vccNet);
    queue.push(vccNet);
  }
  if (gndNet) {
    poweredNets.add(gndNet);
    queue.push(gndNet);
  }
  while (queue.length) {
    const n = queue.shift()!;
    for (const next of adj.get(n) ?? []) {
      if (!poweredNets.has(next)) {
        poweredNets.add(next);
        queue.push(next);
      }
    }
  }

  const poweredPartIds = new Set<string>();
  for (const part of parts) {
    for (const pin of seatedPins(part)) {
      const net = netOf(pinNet, part.id, pin);
      if (net && poweredNets.has(net)) {
        poweredPartIds.add(part.id);
        break;
      }
    }
  }
  return { poweredNets, poweredPartIds };
}

export function Schematic2D() {
  const parts = useLab((s) => s.parts);
  const wires = useLab((s) => s.wires);
  const sim = useLab((s) => s.sim);
  const select = useLab((s) => s.select);
  const selectedId = useLab((s) => s.selectedId);
  const psuVoltage = useLab((s) => s.psuVoltage);
  const psuPositive = useLab((s) => s.psuPositive);
  const psuNegative = useLab((s) => s.psuNegative);

  const netlist = useMemo(() => buildNetlist(parts, wires), [parts, wires]);
  const { pinNet, nodes, find, edges } = netlist;
  const vccNet = psuPositive ? find(stripOf(psuPositive)) : null;
  const gndNet = psuNegative ? find(stripOf(psuNegative)) : null;

  const { poweredNets, poweredPartIds } = useMemo(
    () => poweredConnectivity(vccNet, gndNet, edges, pinNet, parts),
    [vccNet, gndNet, edges, pinNet, parts],
  );

  const layoutResult = useMemo(
    () => placeNodeFirstLayout(netlist, vccNet, gndNet),
    [netlist, vccNet, gndNet],
  );
  const { placed: layout, nodeAnchors } = layoutResult;

  const cx = CX;
  const vccY = 45;
  const vccRail: Pt = { x: cx, y: vccY + 18 };
  const nodePointsForBounds: Pt[] = Array.from(nodeAnchors.values());
  const maxY = Math.max(
    TOP_Y + STEP_Y,
    ...nodePointsForBounds.map((point: Pt) => point.y),
    ...layout.map((p) => p.y + 50),
  );
  const gndY = Math.max(300, maxY + 70);
  const minX = Math.min(40, ...nodePointsForBounds.map((point: Pt) => point.x - 90), ...layout.map((p) => p.x - 100));
  const maxX = Math.max(760, ...nodePointsForBounds.map((point: Pt) => point.x + 110), ...layout.map((p) => p.x + 120));
  const width = Math.max(760, maxX - minX + 80);
  const height = Math.max(420, gndY + 70);

  // -----------------------------------------------------------------------
  // NODE-FIRST ROUTING
  // -----------------------------------------------------------------------
  // Every route starts at a canonical electrical node anchor.  We do NOT pick
  // a hub from the rendered terminals.  This is the key correction: topology
  // determines the node, the node determines its coordinate, and only then do
  // component terminals get wired to that coordinate.
  // -----------------------------------------------------------------------
  const nodeWires: { net: string; index: number; points: Pt[] }[] = [];
  const junctions: { net: string; point: Pt }[] = [];
  let wireIndex = 0;

  const samePoint = (a: Pt, b: Pt) => Math.abs(a.x - b.x) < 1 && Math.abs(a.y - b.y) < 1;
  const addRoute = (net: string, points: Pt[]) => {
    const clean: Pt[] = [];
    for (const p of points) {
      if (!clean.length || !samePoint(clean[clean.length - 1], p)) clean.push(p);
    }
    if (clean.length >= 2) nodeWires.push({ net, index: wireIndex++, points: clean });
  };

  // Route every seated pin of an in-circuit part to its net anchor —
  // but only for powered nets, and only when the net has a real connection
  // (2+ terminals or a supply clip). Lone floating pins stay dark.
  for (const [net, node] of nodes) {
    if (!poweredNets.has(net)) continue;
    const anchor = nodeAnchors.get(net);
    if (!anchor) continue;

    const members = node.pins.filter((m) => poweredPartIds.has(m.partId));
    if (members.length < 1) continue;

    const isSupply = net === vccNet || net === gndNet;
    // Count distinct component terminals on this net
    const distinct = new Set(members.map((m) => `${m.partId}:${m.pin}`));
    // Don't draw a net that only has one lonely pin and isn't supply
    if (distinct.size < 2 && !isSupply) continue;

    let connectedCount = 0;
    for (const member of members) {
      const p = layout.find((candidate) => candidate.part.id === member.partId);
      // Only route pins that exist on the symbol
      const terminal = p?.pins[member.pin];
      if (!terminal) continue;
      connectedCount++;
      const horizontal =
        Math.abs(terminal.x - anchor.x) >= Math.abs(terminal.y - anchor.y);
      addRoute(net, routeOrthogonal(terminal, anchor, horizontal));
    }
    if (connectedCount >= 3) junctions.push({ net, point: anchor });
  }

  // PSU rails only if those nets are actually used by the circuit.
  if (vccNet && poweredNets.has(vccNet) && nodeAnchors.has(vccNet)) {
    addRoute(vccNet, [vccRail, nodeAnchors.get(vccNet)!]);
  }
  const gndRail: Pt = { x: cx, y: gndY };
  if (gndNet && poweredNets.has(gndNet) && nodeAnchors.has(gndNet)) {
    addRoute(gndNet, [nodeAnchors.get(gndNet)!, gndRail]);
  }

  // Shorted two-terminal parts (both pins same net) — only if that net is live.
  for (const p of layout) {
    if (!poweredPartIds.has(p.part.id)) continue;
    const terminals = electricalTerminals(p.part);
    if (!terminals) continue;
    const aNet = netOf(pinNet, p.part.id, terminals[0]);
    const bNet = netOf(pinNet, p.part.id, terminals[1]);
    if (!aNet || aNet !== bNet || !poweredNets.has(aNet)) continue;
    const anchor = nodeAnchors.get(aNet);
    const a = p.pins[terminals[0]];
    const b = p.pins[terminals[1]];
    if (!anchor || !a || !b) continue;
    addRoute(aNet, routeOrthogonal(a, anchor, true));
    addRoute(aNet, routeOrthogonal(b, anchor, true));
  }

  return (
    <div className="absolute inset-0 overflow-auto bg-[#f8fafc]">
      <svg width={width} height={height} className="block mx-auto my-3" viewBox={`${minX} 0 ${width} ${height}`}>
        <defs>
          <pattern id="sch-grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.7" fill="#cbd5e1" />
          </pattern>
        </defs>
        <rect x={minX} width={width} height={height} fill="#f8fafc" />
        <rect x={minX} width={width} height={height} fill="url(#sch-grid)" />

        <text x={minX + 24} y={28} fill="#64748b" fontSize="12">
          Topology schematic · actual electrical nodes · +V top · GND bottom
        </text>

        <SymVcc x={cx} y={vccY} v={psuVoltage} />

        {nodeWires.map((wire) => (
          <path
            key={`node-wire-${wire.net}-${wire.index}`}
            d={wire.points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")}
            fill="none"
            stroke={STROKE}
            strokeWidth="1.7"
          />
        ))}

        {junctions.map((j, i) => (
          <Dot key={`junction-${j.net}-${i}`} x={j.point.x} y={j.point.y} />
        ))}

        {vccNet && nodeAnchors.has(vccNet) && <Dot x={nodeAnchors.get(vccNet)!.x} y={nodeAnchors.get(vccNet)!.y} />}
        {gndNet && nodeAnchors.has(gndNet) && <Dot x={nodeAnchors.get(gndNet)!.x} y={nodeAnchors.get(gndNet)!.y} />}
        <SymGnd x={cx} y={gndY} />

        {layout.map((p) => {
          const inCircuit = poweredPartIds.has(p.part.id);
          return (
            <g
              key={p.part.id}
              style={{ cursor: "pointer", opacity: inCircuit ? 1 : 0.35 }}
              onClick={() => select(p.part.id)}
            >
              {selectedId === p.part.id && (
                <rect
                  x={p.x - 44}
                  y={p.y - 44}
                  width="88"
                  height="88"
                  rx="6"
                  fill="rgba(59,130,246,0.08)"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}
              {renderBody(p, sim)}
              <text
                x={p.x + (p.role === "series" || p.role === "branch" ? 40 : 0)}
                y={p.y + (p.role === "series" || p.role === "branch" ? -8 : -28)}
                textAnchor={p.role === "series" || p.role === "branch" ? "start" : "middle"}
                fill={STROKE}
                fontSize="12"
                fontWeight="600"
              >
                {p.ref}
              </text>
              {valueText(p.part) && (
                <text
                  x={p.x + (p.role === "series" || p.role === "branch" ? 40 : 0)}
                  y={p.y + (p.role === "series" || p.role === "branch" ? 8 : 40)}
                  textAnchor={p.role === "series" || p.role === "branch" ? "start" : "middle"}
                  fill="#475569"
                  fontSize="11"
                >
                  {valueText(p.part)}
                </text>
              )}
              {!inCircuit && (
                <text
                  x={p.x}
                  y={p.y + 52}
                  textAnchor="middle"
                  fill="#94a3b8"
                  fontSize="10"
                >
                  not connected
                </text>
              )}
            </g>
          );
        })}

        {parts.length === 0 && (
          <text x={cx} y={height / 2} textAnchor="middle" fill="#94a3b8" fontSize="14">
            Empty — place parts on the breadboard first
          </text>
        )}
      </svg>
    </div>
  );
}
