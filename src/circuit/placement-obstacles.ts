import { BOARD, holePosition, parseTerminalHole } from './breadboard';
import { mcuBoardOrigin } from './mcu-headers';
import { controllerDimensionsForPart, controllerPosition, isOffboardController } from './offboard-controllers';
import type { HoleId, PlacedPart } from './types';
import { expansionById } from './expansion-catalog';

export type BoardRect = {
  id: string;
  kind: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

type RectPadding = { x: number; z: number };

const LARGE_DIP = new Set(['not', 'and', 'or', 'nand', 'nor', 'xor', 'xnor']);
const MEDIUM_DIP = new Set(['timer555', 'opamp', 'optocoupler']);
const PANEL_PARTS = new Set(['lcd', 'oled', 'mcu', 'relay', 'seven-segment']);
const TRANSISTORISH = new Set(['transistor', 'thyristor', 'triac', 'mosfet', 'regulator']);
const CYLINDRICAL_TWO_PIN = new Set(['resistor', 'diode', 'zener', 'led', 'capacitor', 'inductor', 'ldr', 'thermistor', 'fuse', 'speaker', 'motor', 'buzzer']);
const SMALL_SWITCH = new Set(['switch', 'button', 'pot', 'servo', 'rgb-led']);

const RECT_EPS = 0.03;

function rowRank(row: string): number {
  const table = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return Math.max(0, table.indexOf(row.toUpperCase()));
}

function rectPadding(part: PlacedPart): RectPadding {
  if (part.kind === 'module') return expansionById(part.props.moduleId)?.footprint === 'dip' ? {x:0.10,z:0.26} : {x:0.12,z:0.20};
  if (LARGE_DIP.has(part.kind)) return { x: 0.12, z: 0.34 };
  if (MEDIUM_DIP.has(part.kind)) return { x: 0.11, z: 0.28 };
  if (part.kind === 'seven-segment') return { x: 0.2, z: 0.5 };
  if (PANEL_PARTS.has(part.kind)) return { x: 0.16, z: 0.34 };
  if (part.kind === 'motor') return { x: 0.21, z: 0.23 };
  if (TRANSISTORISH.has(part.kind)) return { x: 0.08, z: 0.18 };
  if (SMALL_SWITCH.has(part.kind)) return { x: 0.1, z: 0.18 };
  if (CYLINDRICAL_TWO_PIN.has(part.kind)) return { x: 0.08, z: 0.14 };
  return { x: 0.08, z: 0.14 };
}

function terminalPins(part: PlacedPart): HoleId[] {
  return Object.values(part.pins).filter((hole): hole is HoleId => /^[A-T]\d+$/.test(hole));
}

function pinBounds(part: PlacedPart): BoardRect | null {
  const pins = terminalPins(part);
  if (!pins.length) return null;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (const hole of pins) {
    const [x, , z] = holePosition(hole);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const pad = rectPadding(part);
  return {
    id: part.id,
    kind: part.kind,
    minX: minX - pad.x,
    maxX: maxX + pad.x,
    minZ: minZ - pad.z,
    maxZ: maxZ + pad.z,
  };
}

/**
 * The bounding rectangle for a two-pin PART'S BODY, not its entire lead span.
 *
 * A breadboard contact belongs to a lead, but the narrow lead between a hole
 * and the package is NOT a solid plastic box. Earlier pinBounds() padded the
 * entire span in X and Z, so an LED one row away from a resistor was rejected
 * even when the packages clearly did not touch (0.20 row pitch versus
 * ~0.18 combined body radii). Hole sharing is protected separately by
 * pinConflict(), so we can use the real package envelope here.
 *
 * Sizes match the rendered ResistorMesh / LedMesh / DiodeMesh / ZenerMesh.
 * Small physical clearance is included to avoid visible body intersections.
 */
function smallTwoPinBodyRect(part: PlacedPart): BoardRect | null {
  if (!['resistor', 'led', 'diode', 'zener'].includes(part.kind)) return null;
  const a = part.pins.a;
  const b = part.kind === 'resistor' ? part.pins.b : part.pins.k;
  if (!a || !b || !parseTerminalHole(a) || !parseTerminalHole(b)) return null;
  const [ax, , az] = holePosition(a);
  const [bx, , bz] = holePosition(b);
  const dx = bx - ax;
  const dz = bz - az;
  const pinSpan = Math.hypot(dx, dz);
  if (pinSpan < 1e-6) return null;
  const cx = (ax + bx) / 2;
  const cz = (az + bz) / 2;
  const clearance = 0.007;

  // The LED bulb sits above the midpoint of its two leads. Its flange is
  // wider than its translucent dome, and defines the physical clearance.
  if (part.kind === 'led') {
    const r = 0.124 + clearance;
    return { id: part.id, kind: part.kind,
      minX: cx - r, maxX: cx + r, minZ: cz - r, maxZ: cz + r };
  }

  const bodyLength = part.kind === 'resistor'
    ? 0.38
    : part.kind === 'zener'
      ? 0.32
      : Math.min(0.38, Math.max(0.22, pinSpan * 0.48));
  const radius = (part.kind === 'resistor' ? 0.058 : part.kind === 'zener' ? 0.078 : 0.058) + clearance;
  const halfLength = bodyLength / 2;
  // Orientation comes from the two physical contacts, so rotated bodies
  // receive the correct X/Z clearance rather than a fixed horizontal box.
  const hx = Math.abs(dx / pinSpan) * halfLength + radius;
  const hz = Math.abs(dz / pinSpan) * halfLength + radius;
  return { id: part.id, kind: part.kind,
    minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
}

/**
 * Arduino Uno is a separate PCB alongside the breadboard, not a 23-pin DIP.
 * Its pins now use independent socket IDs (mcu:<id>:<pin>), not breadboard
 * hole strips. The physical obstacle is only the actual 2.72×2.12 PCB.
 * Position is shared with the rendered McuMesh model.
 */
function mcuBodyRect(part: PlacedPart): BoardRect | null {
  const {x,z} = controllerPosition(part);
  const {width,depth} = controllerDimensionsForPart(part);
  return { id:part.id,kind:part.kind,minX:x-width/2,maxX:x+width/2,minZ:z-depth/2,maxZ:z+depth/2 };
}

function icBodyRect(part: PlacedPart): BoardRect | null {
  const pins = terminalPins(part).map((hole) => parseTerminalHole(hole)).filter(Boolean) as Array<{ row: string; col: number }>;
  if (!pins.length) return pinBounds(part);
  const cols = pins.map((p) => p.col);
  const top = pins.reduce((best, p) => (rowRank(p.row) < rowRank(best.row) ? p : best), pins[0]);
  const bottom = pins.reduce((best, p) => (rowRank(p.row) > rowRank(best.row) ? p : best), pins[0]);
  const leftCol = Math.min(...cols);
  const rightCol = Math.max(...cols);
  const [minX] = holePosition(`${top.row}${leftCol}`);
  const [maxX] = holePosition(`${bottom.row}${rightCol}`);
  const [, , minZRaw] = holePosition(`${top.row}${leftCol}`);
  const [, , maxZRaw] = holePosition(`${bottom.row}${rightCol}`);
  const pad = rectPadding(part);
  return {
    id: part.id,
    kind: part.kind,
    minX: Math.min(minX, maxX) - pad.x,
    maxX: Math.max(minX, maxX) + pad.x,
    minZ: Math.min(minZRaw, maxZRaw) - pad.z,
    maxZ: Math.max(minZRaw, maxZRaw) + pad.z,
  };
}

export function partObstacle(part: PlacedPart): BoardRect | null {
  if (isOffboardController(part)) return mcuBodyRect(part);
  // Leads may be close together or occupy adjacent rows. Reserve the actual
  // component shell instead of padding all the air between its terminal pins.
  const smallBody = smallTwoPinBodyRect(part);
  if (smallBody) return smallBody;
  if (LARGE_DIP.has(part.kind) || MEDIUM_DIP.has(part.kind) || (part.kind==='module' && expansionById(part.props.moduleId)?.footprint==='dip')) return icBodyRect(part);
  return pinBounds(part);
}

export function collectPartObstacles(parts: readonly PlacedPart[], ignoreId?: string): BoardRect[] {
  return parts
    .filter((part) => part.id !== ignoreId)
    .map((part) => partObstacle(part))
    .filter((rect): rect is BoardRect => Boolean(rect));
}

export function rectsOverlap(a: BoardRect, b: BoardRect, margin = RECT_EPS): boolean {
  return !(a.maxX <= b.minX + margin || a.minX >= b.maxX - margin || a.maxZ <= b.minZ + margin || a.minZ >= b.maxZ - margin);
}

export function collidesWithExisting(part: PlacedPart, others: readonly PlacedPart[], ignoreId?: string): boolean {
  const rect = partObstacle(part);
  if (!rect) return false;
  return collectPartObstacles(others, ignoreId).some((other) => rectsOverlap(rect, other));
}

export function pinConflict(part: PlacedPart, others: readonly PlacedPart[], ignoreId?: string): boolean {
  const used = new Set<string>();
  for (const other of others) {
    if (other.id === ignoreId || isOffboardController(other)) continue;
    for (const hole of Object.values(other.pins)) used.add(hole);
  }
  // An Arduino header is represented by virtual electrical net anchors,
  // not real leads inserted into the breadboard's F/J holes.
  if (isOffboardController(part)) return false;
  return Object.values(part.pins).some((hole) => used.has(hole));
}

export function placementIsBlocked(part: PlacedPart, others: readonly PlacedPart[], ignoreId?: string): boolean {
  return pinConflict(part, others, ignoreId) || collidesWithExisting(part, others, ignoreId);
}

function intervalDistance(a0: number, a1: number, b0: number, b1: number): number {
  if (a1 < b0) return b0 - a1;
  if (b1 < a0) return a0 - b1;
  return 0;
}

export function segmentRectDistance(
  a: { x: number; z: number },
  b: { x: number; z: number },
  rect: BoardRect,
): number {
  const horizontal = Math.abs(a.z - b.z) < 1e-5;
  if (horizontal) {
    return Math.hypot(
      intervalDistance(Math.min(a.x, b.x), Math.max(a.x, b.x), rect.minX, rect.maxX),
      intervalDistance(a.z, a.z, rect.minZ, rect.maxZ),
    );
  }
  return Math.hypot(
    intervalDistance(a.x, a.x, rect.minX, rect.maxX),
    intervalDistance(Math.min(a.z, b.z), Math.max(a.z, b.z), rect.minZ, rect.maxZ),
  );
}

/**
 * The collision footprint used to PLACE a part is deliberately larger than its
 * plastic shell: it reserves space for leads. For wire routing, however, the
 * leads must remain accessible. Use the actual body approximation here rather
 * than blocking every pin in the padded placement footprint.
 *
 * Units match the Three.js breadboard. The DIP-14 shell is 1.42 × 0.48, as
 * rendered by LogicGateMesh in parts-3d.tsx.
 */
export function wireBodyObstacle(part: PlacedPart): BoardRect | null {
  if (isOffboardController(part)) return mcuBodyRect(part);
  const holes = terminalPins(part);
  if (!holes.length) return null;
  const points = holes.map((hole) => {
    const [x, , z] = holePosition(hole);
    return { x, z };
  });
  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minZ = Math.min(...points.map((p) => p.z));
  const maxZ = Math.max(...points.map((p) => p.z));
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;

  if (LARGE_DIP.has(part.kind) || MEDIUM_DIP.has(part.kind)) {
    return {
      id: part.id, kind: part.kind,
      minX: minX - 0.11, maxX: maxX + 0.11,
      minZ: cz - 0.24, maxZ: cz + 0.24,
    };
  }
  if (part.kind === 'motor') {
    const radius = part.props.motorModel === '12v' ? 0.19 : 0.17;
    const length = part.props.motorModel === '12v' ? 0.44 : 0.40;
    return { id: part.id, kind: part.kind,
      minX: cx - length / 2, maxX: cx + length / 2,
      minZ: cz - radius, maxZ: cz + radius };
  }
  if (CYLINDRICAL_TWO_PIN.has(part.kind) && points.length >= 2) {
    const dx = points[1].x - points[0].x;
    const dz = points[1].z - points[0].z;
    const length = Math.hypot(dx, dz) || 1;
    const axisLength = Math.min(part.kind === 'led' ? 0.12 : 0.46, length * 0.70);
    const hx = axisLength / 2 * Math.abs(dx / length) + 0.045;
    const hz = axisLength / 2 * Math.abs(dz / length) + 0.045;
    return { id: part.id, kind: part.kind, minX: cx - hx, maxX: cx + hx, minZ: cz - hz, maxZ: cz + hz };
  }
  if (part.kind === 'seven-segment') {
    return { id: part.id, kind: part.kind,
      minX: cx - 0.53, maxX: cx + 0.53, minZ: cz - 0.71, maxZ: cz + 0.71 };
  }
  if (PANEL_PARTS.has(part.kind)) {
    return { id: part.id, kind: part.kind, minX: minX + 0.03, maxX: maxX - 0.03,
      minZ: minZ - 0.14, maxZ: maxZ + 0.14 };
  }
  return { id: part.id, kind: part.kind, minX: cx - Math.max(0.09, (maxX - minX) / 2 - 0.05),
    maxX: cx + Math.max(0.09, (maxX - minX) / 2 - 0.05),
    minZ: cz - Math.max(0.08, (maxZ - minZ) / 2 + 0.03),
    maxZ: cz + Math.max(0.08, (maxZ - minZ) / 2 + 0.03) };
}

export function collectWireBodyObstacles(parts: readonly PlacedPart[]): BoardRect[] {
  return parts.map(wireBodyObstacle).filter((rect): rect is BoardRect => rect !== null && rect.maxX > rect.minX && rect.maxZ > rect.minZ);
}
