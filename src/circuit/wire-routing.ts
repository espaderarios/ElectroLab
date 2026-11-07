/**
 * Physical, deterministic 3-D wire layout.
 *
 * Wires remain electrically connected at Wire.a / Wire.b. Their *visual* path
 * uses orthogonal detours around component shells. A crossing is never silently
 * allowed to tunnel through a package: the router validates every segment and
 * marks an impossible path as blocked rather than drawing an invalid tube.
 *
 * Solid wires occupy low height lanes; flexible jumpers occupy higher lanes.
 * Both types clear other wire tubes in 3-D even when their projections cross.
 */
import { BOARD } from './breadboard';
import { collectWireBodyObstacles, segmentRectDistance, type BoardRect } from './placement-obstacles';
import type { HoleId, PlacedPart, Wire, WireStyle } from './types';

export type RoutePoint = { x: number; z: number };
export type RoutePoint3D = RoutePoint & { y: number };
export type RoutedWire = {
  id: string;
  style: WireStyle;
  waypoints: RoutePoint[];
  /** Absolute plug heights; off-board component headers are higher than board holes. */
  startY?: number;
  endY?: number;
  /** Absolute amount ABOVE the board surface for the high part of the route. */
  lift: number;
  crossings: number;
  /** Never render an invalid connection through a physical object. */
  blocked?: boolean;
  /** True if endpoints sit within their own component's access envelope. */
  portEscapes?: number;
  /** Local overpass profile: only crossing sections rise, not the whole cable. */
  profile?: RoutePoint3D[];
};

const EPS = 1e-5;
const BODY_GAP = 0.055; // 0.028-unit cable radius plus physical clearance
const TRACK_GAP = 0.092; // two insulated wires (diameter ~0.056) plus clearance
const STUB_HEIGHT = 0.032;
const rounding = (v: number) => Math.round(v * 100000) / 100000;
const same = (a: RoutePoint, b: RoutePoint) => Math.hypot(a.x - b.x, a.z - b.z) < EPS;
const distance = (a: RoutePoint, b: RoutePoint) => Math.abs(b.x - a.x) + Math.abs(b.z - a.z);
const axisAligned = (a: RoutePoint, b: RoutePoint) => Math.abs(a.x - b.x) < EPS || Math.abs(a.z - b.z) < EPS;

function tidy(path: RoutePoint[]): RoutePoint[] {
  const unique = path.filter((p, i) => i === 0 || !same(p, path[i - 1]));
  const result: RoutePoint[] = [];
  for (const p of unique) {
    const len = result.length;
    if (len >= 2 && axisAligned(result[len - 2], p)) result.pop();
    result.push(p);
  }
  return result;
}

function intervalDistance(a0: number, a1: number, b0: number, b1: number): number {
  return Math.max(0, Math.max(Math.min(b0, b1) - Math.max(a0, a1), Math.min(a0, a1) - Math.max(b0, b1)));
}

/** Accurate minimum distance for the horizontal/vertical segments used here. */
function segmentSeparation(a: RoutePoint, b: RoutePoint, c: RoutePoint, d: RoutePoint): number {
  const ah = Math.abs(a.z - b.z) < EPS;
  const ch = Math.abs(c.z - d.z) < EPS;
  if (ah && ch) return Math.hypot(Math.abs(a.z - c.z), intervalDistance(a.x, b.x, c.x, d.x));
  if (!ah && !ch) return Math.hypot(Math.abs(a.x - c.x), intervalDistance(a.z, b.z, c.z, d.z));
  const h0 = ah ? a : c;
  const h1 = ah ? b : d;
  const v0 = ah ? c : a;
  const v1 = ah ? d : b;
  return Math.hypot(
    intervalDistance(v0.x, v0.x, h0.x, h1.x),
    intervalDistance(h0.z, h0.z, v0.z, v1.z),
  );
}

function inside(rect: BoardRect, p: RoutePoint, inset = 0) {
  return p.x > rect.minX - inset && p.x < rect.maxX + inset &&
    p.z > rect.minZ - inset && p.z < rect.maxZ + inset;
}

/**
 * An existing part may enclose a pin inside its body-envelope (e.g. an LCD).
 * Find the shortest *terminal exit*; the interior step is a pin lead, not a
 * horizontal insulated wire. The main routing algorithm never enters a body.
 */
function portExit(point: RoutePoint, obstacles: readonly BoardRect[], toward: RoutePoint): RoutePoint[] {
  const blockers = obstacles.filter((o) => inside(o, point, BODY_GAP));
  if (!blockers.length) return [point];
  const variants: RoutePoint[] = [];
  for (const o of blockers) {
    variants.push(
      { x: rounding(o.minX - BODY_GAP - 0.008), z: point.z },
      { x: rounding(o.maxX + BODY_GAP + 0.008), z: point.z },
      { x: point.x, z: rounding(o.minZ - BODY_GAP - 0.008) },
      { x: point.x, z: rounding(o.maxZ + BODY_GAP + 0.008) },
    );
  }
  const clear = variants.filter((p) => !obstacles.some((o) => inside(o, p, BODY_GAP)));
  const pool = clear.length ? clear : variants;
  pool.sort((a, b) => distance(point, a) - distance(point, b) || distance(a, toward) - distance(b, toward));
  const best = pool[0];
  return best && !same(best, point) ? [point, best] : [point];
}

function segmentClear(a: RoutePoint, b: RoutePoint, obstacles: readonly BoardRect[]): boolean {
  if (!axisAligned(a, b)) return false;
  return obstacles.every((rect) => segmentRectDistance(a, b, rect) > BODY_GAP - 0.0001);
}

function routeClear(path: RoutePoint[], obstacles: readonly BoardRect[]): boolean {
  return path.every((p, i) => i === 0 || segmentClear(path[i - 1], p, obstacles));
}

function projectedContacts(path: RoutePoint[], planned: readonly RoutedWire[]): number {
  let contacts = 0;
  for (let i = 1; i < path.length; i++) {
    for (const other of planned) {
      if (other.blocked) continue;
      for (let j = 1; j < other.waypoints.length; j++) {
        const d = segmentSeparation(path[i - 1], path[i], other.waypoints[j - 1], other.waypoints[j]);
        if (d < TRACK_GAP) contacts++;
      }
    }
  }
  return contacts;
}

function candidatePaths(a: RoutePoint, b: RoutePoint): RoutePoint[][] {
  const result: RoutePoint[][] = [
    tidy([a, { x: b.x, z: a.z }, b]),
    tidy([a, { x: a.x, z: b.z }, b]),
  ];
  for (const delta of [0.14, -0.14, 0.32, -0.32, 0.65, -0.65, 1.2, -1.2]) {
    const x = rounding((a.x + b.x) / 2 + delta);
    const z = rounding((a.z + b.z) / 2 + delta);
    result.push(tidy([a, { x, z: a.z }, { x, z: b.z }, b]));
    result.push(tidy([a, { x: a.x, z }, { x: b.x, z }, b]));
  }
  // Broad dedicated lanes alongside the terminal strips. These let a whole
  // group of Arduino-to-display wires fan out without repeatedly crossing the
  // component body or climbing over each other.
  for (const lane of [-1.68, -1.5, -1.36, 1.36, 1.5, 1.68, -2.55, 2.55]) {
    result.push(tidy([a, { x: a.x, z: lane }, { x: b.x, z: lane }, b]));
  }
  return result;
}

/** Min-heap for A* on an orthogonal visibility grid. */
class MinHeap {
  private values: Array<{ key: number; score: number }> = [];
  push(item: { key: number; score: number }) {
    const values = this.values;
    values.push(item);
    let at = values.length - 1;
    while (at > 0) {
      const parent = (at - 1) >> 1;
      if (values[parent].score <= item.score) break;
      values[at] = values[parent];
      at = parent;
    }
    values[at] = item;
  }
  pop(): { key: number; score: number } | undefined {
    const list = this.values;
    if (!list.length) return undefined;
    const top = list[0];
    const tail = list.pop()!;
    if (list.length) {
      let pos = 0;
      while (true) {
        const left = pos * 2 + 1;
        if (left >= list.length) break;
        const right = left + 1;
        const next = right < list.length && list[right].score < list[left].score ? right : left;
        if (list[next].score >= tail.score) break;
        list[pos] = list[next];
        pos = next;
      }
      list[pos] = tail;
    }
    return top;
  }
  get length() { return this.values.length; }
}

/** Fallback search when a 2- or 3-turn route is obstructed by a component. */
function detour(
  start: RoutePoint, end: RoutePoint,
  obstacles: readonly BoardRect[], planned: readonly RoutedWire[],
): RoutePoint[] | null {
  const xs = new Set([rounding(start.x), rounding(end.x)]);
  const zs = new Set([rounding(start.z), rounding(end.z)]);
  const xLimit = BOARD.width / 2 + 0.14;
  const zLimit = BOARD.depth / 2 + 0.14;
  const offset = BODY_GAP + 0.026;
  for (const o of obstacles) {
    for (const x of [o.minX - offset, o.maxX + offset]) xs.add(rounding(x));
    for (const z of [o.minZ - offset, o.maxZ + offset]) zs.add(rounding(z));
  }
  // Fine alternate lanes help multiple insulated wires avoid coincident runs.
  for (const d of [-0.18, 0.18]) {
    xs.add(rounding(start.x + d)); xs.add(rounding(end.x + d));
    zs.add(rounding(start.z + d)); zs.add(rounding(end.z + d));
  }
  const xx = [...xs].filter((v) => Math.abs(v) <= xLimit).sort((a, b) => a - b);
  const zz = [...zs].filter((v) => Math.abs(v) <= zLimit).sort((a, b) => a - b);
  if (!xx.length || !zz.length || xx.length * zz.length > 18000) return null;
  const nx = xx.length;
  const nz = zz.length;
  const coord = (node: number): RoutePoint => ({ x: xx[node % nx], z: zz[Math.floor(node / nx)] });
  const startX = xx.indexOf(rounding(start.x));
  const startZ = zz.indexOf(rounding(start.z));
  const endX = xx.indexOf(rounding(end.x));
  const endZ = zz.indexOf(rounding(end.z));
  if ([startX, startZ, endX, endZ].some((v) => v < 0)) return null;
  const startNode = startZ * nx + startX;
  const endNode = endZ * nx + endX;
  if (startNode === endNode) return [start];

  // Directions: 0=start, 1=left, 2=right, 3=up, 4=down.
  const state = (node: number, dir: number) => node * 5 + dir;
  const distances = new Float64Array(nx * nz * 5).fill(Infinity);
  const parent = new Int32Array(distances.length).fill(-1);
  const heap = new MinHeap();
  const initial = state(startNode, 0);
  distances[initial] = 0;
  heap.push({ key: initial, score: distance(start, end) });
  let target = -1;
  let iterations = 0;
  while (heap.length && iterations++ < 90000) {
    const current = heap.pop()!;
    const stateKey = current.key;
    const node = Math.floor(stateKey / 5);
    const lastDir = stateKey % 5;
    const here = coord(node);
    if (current.score > distances[stateKey] + distance(here, end) + 1e-5) continue;
    if (node === endNode) { target = stateKey; break; }
    const ix = node % nx;
    const iz = Math.floor(node / nx);
    const moves: Array<[number, number, number]> = [
      [ix - 1, iz, 1], [ix + 1, iz, 2], [ix, iz - 1, 3], [ix, iz + 1, 4],
    ];
    for (const [x, z, dir] of moves) {
      if (x < 0 || x >= nx || z < 0 || z >= nz) continue;
      const nextNode = z * nx + x;
      const next = coord(nextNode);
      if (!segmentClear(here, next, obstacles)) continue;
      const len = distance(here, next);
      const contacts = projectedContacts([here, next], planned);
      const bend = lastDir !== 0 && lastDir !== dir ? 0.1 : 0;
      const g = distances[stateKey] + len + bend + contacts * Math.min(0.45, 0.13 + len * 0.12);
      const newState = state(nextNode, dir);
      if (g + 1e-7 < distances[newState]) {
        distances[newState] = g;
        parent[newState] = stateKey;
        heap.push({ key: newState, score: g + distance(next, end) });
      }
    }
  }
  if (target < 0) return null;
  const reversed: RoutePoint[] = [];
  for (let key = target; key >= 0; key = parent[key]) reversed.push(coord(Math.floor(key / 5)));
  return tidy(reversed.reverse());
}

function choosePath(
  a: RoutePoint, b: RoutePoint,
  obstacles: readonly BoardRect[], planned: readonly RoutedWire[],
): RoutePoint[] | null {
  let best: RoutePoint[] | null = null;
  let bestScore = Infinity;
  for (const path of candidatePaths(a, b)) {
    if (!routeClear(path, obstacles)) continue;
    const score = path.reduce((sum, point, i) => sum + (i ? distance(point, path[i - 1]) : 0), 0)
      + Math.max(0, path.length - 2) * 0.11
      + projectedContacts(path, planned) * 0.62;
    if (score < bestScore) { best = path; bestScore = score; }
  }
  if (best) return best;
  return detour(a, b, obstacles, planned);
}

/** Subdivide only long runs so local overpasses can rise gradually near a
 * crossing without lifting the entire wire into a tall rectangular cage. */
function samplePath(path: readonly RoutePoint[], step = 0.19): RoutePoint[] {
  if (!path.length) return [];
  const sampled: RoutePoint[] = [path[0]];
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1];
    const b = path[i];
    const count = Math.max(1, Math.ceil(distance(a, b) / step));
    for (let k = 1; k <= count; k++) {
      const t = k / count;
      sampled.push({ x: rounding(a.x + (b.x - a.x) * t), z: rounding(a.z + (b.z - a.z) * t) });
    }
  }
  return sampled;
}

/** Closest point in X/Z on a straight segment, including its interpolated Y. */
function nearSegment(point: RoutePoint, a: RoutePoint3D, b: RoutePoint3D) {
  const vx = b.x - a.x, vz = b.z - a.z;
  const d = vx * vx + vz * vz;
  const t = d < EPS ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * vx + (point.z - a.z) * vz) / d));
  return {distance: Math.hypot(point.x - a.x - vx * t, point.z - a.z - vz * t),
    y: a.y + (b.y - a.y) * t};
}

function sharedPort(point: RoutePoint, current: RoutedWire, previous: RoutedWire) {
  const a = current.waypoints, b = previous.waypoints;
  if (!a.length || !b.length) return false;
  return [a[0], a[a.length - 1]].some(p =>
    [b[0], b[b.length - 1]].some(q => same(p, q) && distance(point, p) < 0.19));
}

/** Cable separation is applied only near projected contacts, not as a global
 * lift. This avoids 1–2 unit-high stacks in Arduino/LCD example circuits. */
function buildLocalProfile(current: RoutedWire, previous: readonly RoutedWire[]): RoutePoint3D[] {
  const samples = samplePath(current.waypoints);
  const base = current.lift;
  const heights = new Float64Array(samples.length).fill(base);
  const clearance = 0.082; // 2 cable radii + visual clearance
  for (let i = 1; i < samples.length - 1; i++) {
    const p = samples[i];
    for (const route of previous) {
      if (route.blocked || !route.profile || sharedPort(p, current, route)) continue;
      const other = route.profile;
      for (let j = 1; j < other.length; j++) {
        const a = other[j - 1], b = other[j];
        if (p.x < Math.min(a.x,b.x) - clearance || p.x > Math.max(a.x,b.x) + clearance ||
            p.z < Math.min(a.z,b.z) - clearance || p.z > Math.max(a.z,b.z) + clearance) continue;
        const closest = nearSegment(p, a, b);
        if (closest.distance >= clearance) continue;
        const required = closest.y + Math.sqrt(clearance*clearance - closest.distance*closest.distance) + 0.01;
        if (required > heights[i]) heights[i] = required;
      }
    }
  }
  // Blend overpasses into the low lane over ~0.5 board units; there should
  // never be an instantaneous vertical jump through a neighboring cable.
  const spread = [...heights];
  for (let i = 0; i < samples.length; i++) {
    const rise = heights[i] - base;
    if (rise <= 0) continue;
    for (let k = -3; k <= 3; k++) {
      const j = i + k;
      if (j <= 0 || j >= samples.length - 1) continue;
      spread[j] = Math.max(spread[j], base + rise * (1 - Math.abs(k) / 4));
    }
  }
  // Preserve all visual corners and height changes, omit redundant samples
  // along flat straight runs to keep the WebGL tube mesh lightweight.
  const result: RoutePoint3D[] = [];
  for (let i = 0; i < samples.length; i++) {
    const p: RoutePoint3D = { ...samples[i], y: spread[i] };
    const a = samples[Math.max(0, i - 1)], b = samples[Math.min(samples.length - 1, i + 1)];
    const corner = !axisAligned(a, b);
    const slope = i > 0 && i < samples.length - 1 &&
      (Math.abs(spread[i] - spread[i - 1]) > 0.005 || Math.abs(spread[i] - spread[i + 1]) > 0.005);
    if (i === 0 || i === samples.length - 1 || corner || slope) result.push(p);
  }
  return result;
}

/** Returns one orthogonal layout for every wire, in the input order. */
export function planWireRoutes(
  wires: readonly Wire[],
  position: (hole: HoleId) => readonly [number, number, number],
  parts: readonly PlacedPart[] = [],
  /** Optional whole-circuit planning order; output remains in original wire order. */
  ordering: 'default' | 'shortest' | 'longest' | 'reverse' = 'default',
): RoutedWire[] {
  const obstacles = collectWireBodyObstacles(parts);
  const wireDistance = (wire: Wire) => {
    const a = position(wire.a), b = position(wire.b);
    return Math.abs(a[0] - b[0]) + Math.abs(a[2] - b[2]);
  };
  const ordered = wires.map((wire, index) => ({ wire, index }))
    .sort((a, b) =>
      Number(Boolean(b.wire.routeLocked)) - Number(Boolean(a.wire.routeLocked))
      || (a.wire.style === 'jumper' ? 1 : 0) - (b.wire.style === 'jumper' ? 1 : 0)
      || (ordering === 'shortest' ? wireDistance(a.wire) - wireDistance(b.wire)
        : ordering === 'longest' ? wireDistance(b.wire) - wireDistance(a.wire)
        : ordering === 'reverse' ? b.index - a.index : a.index - b.index),
    );
  const planned: RoutedWire[] = [];
  for (const { wire } of ordered) {
    const ap = position(wire.a);
    const bp = position(wire.b);
    if (!ap || !bp || ![ap[0], ap[2], bp[0], bp[2]].every(Number.isFinite)) continue;
    const a = { x: rounding(ap[0]), z: rounding(ap[2]) };
    const b = { x: rounding(bp[0]), z: rounding(bp[2]) };
    const from = portExit(a, obstacles, b);
    const to = portExit(b, obstacles, a);
    const hasSavedBends = Array.isArray(wire.bends) &&
      wire.bendAnchors?.a === wire.a && wire.bendAnchors?.b === wire.b &&
      wire.bends.length <= 24 && wire.bends.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z));
    const saved = hasSavedBends
      ? tidy([from[from.length - 1], ...wire.bends!, to[to.length - 1]])
      : null;
    // Prefer valid user/preset bend paths; never render a stale or colliding
    // path from an older saved project. Electrical endpoints are untouched.
    const routed = saved && routeClear(saved, obstacles)
      ? saved
      : choosePath(from[from.length - 1], to[to.length - 1], obstacles, planned);
    const style: WireStyle = wire.style === 'jumper' ? 'jumper' : 'solid';
    const waypoints = routed ? tidy([...from.slice(0, -1), ...routed, ...to.slice(0, -1).reverse()]) : [a, b];
    const blocked = !routed || !routeClear(routed, obstacles);
    planned.push({
      id: wire.id,
      style,
      waypoints,
      startY: ap[1],
      endY: bp[1],
      lift: 0,
      crossings: blocked ? 0 : projectedContacts(waypoints, planned),
      blocked,
      portEscapes: (from.length - 1) + (to.length - 1),
    });
  }
  // Solid wire stays close to the breadboard; jumper wires clear that layer.
  // All crossing-specific height changes live in a LOCAL overpass profile,
  // rather than raising an entire wire higher for every previous crossing.
  for (const route of planned) {
    route.lift = route.style === 'jumper' ? 0.245 : 0.105;
    if (route.blocked) continue;
    const before = planned.slice(0, planned.indexOf(route));
    route.profile = buildLocalProfile(route, before);
  }
  const byId = new Map(planned.map((route) => [route.id, route]));
  return wires.map((wire) => byId.get(wire.id) ?? {
    id: wire.id, style: wire.style === 'jumper' ? 'jumper' : 'solid',
    waypoints: [], lift: wire.style === 'jumper' ? 0.245 : 0.105, crossings: 0, blocked: true,
  });
}

/** The EXACT same world-space wire points are used by actual wires and previews. */
export function wireRoute3DPoints(route: RoutedWire, boardHeight = BOARD.height): RoutePoint3D[] {
  if (!route.waypoints.length) return [];
  const first = route.waypoints[0];
  const last = route.waypoints[route.waypoints.length - 1];
  const plugY = boardHeight + STUB_HEIGHT;
  // Breadboard socket plugs remain flush with the older visual baseline.
  // Off-board Arduino header plugs rise from the actual socket height.
  const startY = Number.isFinite(route.startY) && route.startY! > boardHeight + 0.10
    ? route.startY! + STUB_HEIGHT : plugY;
  const endY = Number.isFinite(route.endY) && route.endY! > boardHeight + 0.10
    ? route.endY! + STUB_HEIGHT : plugY;
  if (route.blocked) {
    return [
      { ...first, y: startY },
      { ...first, y: startY + 0.09 },
    ];
  }
  const center = route.profile?.length
    ? route.profile.map((p) => ({ ...p, y: boardHeight + p.y }))
    : route.waypoints.map((p) => ({ ...p, y: boardHeight + route.lift }));
  return [{ ...first, y: startY }, ...center, { ...last, y: endY }];
}
