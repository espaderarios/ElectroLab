/**
 * Global wire layout for saved projects and premade laboratories.
 *
 * This is purely cosmetic: every Wire keeps its a/b contact holes. We try
 * several whole-circuit planning orders, score the COMPLETE bundle (not just
 * each new wire), then persist the best valid bend path on each unlocked wire.
 * Locked wires stay fixed and are routed first, avoiding accidental rewrites.
 */
import type { HoleId, PlacedPart, Wire } from './types';
import { planWireRoutes, type RoutedWire } from './wire-routing';

export type WirePoint = { x: number; z: number };
const orders = ['default', 'shortest', 'longest', 'reverse'] as const;

export function routeQuality(routes: readonly RoutedWire[]): number {
  const bad = routes.filter(route => route.blocked).length;
  const crossings = routes.reduce((sum, route) => sum + route.crossings, 0);
  const bends = routes.reduce((sum, route) => sum + Math.max(0, route.waypoints.length - 2), 0);
  const length = routes.reduce((sum, route) => sum + route.waypoints.reduce((total, p, i) =>
    total + (i ? Math.abs(p.x - route.waypoints[i - 1].x) + Math.abs(p.z - route.waypoints[i - 1].z) : 0), 0), 0);
  const height = routes.reduce((sum, route) => sum + Math.max(0, ...(route.profile?.map(p => p.y) ?? [0])), 0);
  // Make overlap avoidance more important than shaving a few centimeters.
  return bad * 1e6 + crossings * 10 + bends * 0.36 + length * 0.075 + height * 0.45;
}

export function autoTidyWireBundle(
  wires: readonly Wire[],
  parts: readonly PlacedPart[],
  position: (hole: HoleId) => readonly [number, number, number],
): Wire[] {
  if (!wires.length) return [];
  // Work with a clean slate for unlocked routes. Locked routes are preserved.
  const input = wires.map(wire => wire.routeLocked ? { ...wire } : {
    ...wire, bends: undefined, bendAnchors: undefined,
  });
  let best: RoutedWire[] | null = null;
  let bestScore = Infinity;
  for (const order of orders) {
    const planned = planWireRoutes(input, position, parts, order);
    const score = routeQuality(planned);
    if (score < bestScore) { best = planned; bestScore = score; }
  }
  if (!best) return input;
  const paths = new Map(best.map(route => [route.id, route]));
  return input.map(wire => {
    const route = paths.get(wire.id);
    if (wire.routeLocked || !route || route.blocked || route.waypoints.length < 2) return wire;
    return {
      ...wire,
      bends: route.waypoints.slice(1, -1).map(({ x, z }) => ({ x, z })),
      bendAnchors: { a: wire.a, b: wire.b },
    };
  });
}
