/**
 * Off-breadboard physical controller boards. The PCB is supported by the dark
 * workbench and never consumes breadboard strips. Every socket uses a stable
 * per-part terminal ID; moving the PCB changes only its 3D position.
 */
import { BOARD, colX } from './breadboard';
import { expansionById } from './expansion-catalog';
import type { HoleId, PlacedPart, ToolId, Wire } from './types';

export type BenchPoint = { x: number; z: number };
export const isControllerTool = (tool: ToolId): boolean =>
  tool === 'mcu' || expansionById(tool)?.shape === 'microcontroller';
export const isOffboardController = (part: PlacedPart): boolean =>
  part.kind === 'mcu' || (part.kind === 'module' && expansionById(part.props.moduleId)?.shape === 'microcontroller');

/** Width and depth in virtual bench units; board variants keep different actual footprints. */
export function controllerDimensions(moduleId?: string): { width: number; depth: number } {
  switch (moduleId) {
    case 'board-nano': return {width: 1.95, depth: .91};
    case 'board-mega': return {width: 3.95, depth: 1.78};
    case 'board-esp32': return {width: 2.35, depth: 1.12};
    case 'board-pico': return {width: 1.99, depth: .88};
    default: return {width: 2.72, depth: 2.12}; // Arduino Uno
  }
}
export function controllerDimensionsForPart(part: PlacedPart) {
  return controllerDimensions(part.kind === 'mcu' ? undefined : part.props.moduleId);
}
const snap = (value: number) => Math.round(value * 20) / 20;
/** Keep PCBs clear of breadboard sides/rails while allowing genuine free bench movement. */
export function constrainBenchPoint(point: BenchPoint, moduleId?: string): BenchPoint {
  const {width,depth} = controllerDimensions(moduleId);
  const xMin = -BOARD.width / 2 + width / 2 + 0.12;
  const xMax = BOARD.width / 2 - width / 2 - 0.12;
  const x = snap(Math.max(xMin, Math.min(xMax, point.x)));
  const nearestClearZ = BOARD.depth / 2 + depth / 2 + .46;
  const zSign = point.z > 0 ? 1 : -1;
  const z = snap(zSign * Math.max(nearestClearZ, Math.min(Math.abs(point.z), nearestClearZ + 3.5)));
  return { x, z };
}
export function defaultControllerPosition(anchor: HoleId, moduleId?: string): BenchPoint {
  const match = /^[A-T](\d+)$/.exec(anchor);
  // Existing Uno projects used the 23-column pin centroid as an X-only anchor.
  const col = Math.min(BOARD.cols, Math.max(1, Number(match?.[1] ?? 12)));
  const offset = moduleId ? 5 : 11;
  return constrainBenchPoint({x: colX(Math.min(BOARD.cols, col + offset)), z: -(BOARD.depth/2+2)}, moduleId);
}
export function controllerPosition(part: PlacedPart): BenchPoint {
  const moduleId = part.kind === 'mcu' ? undefined : part.props.moduleId;
  const saved = part.props.benchPosition;
  return constrainBenchPoint(saved && Number.isFinite(saved.x) && Number.isFinite(saved.z)
    ? saved : defaultControllerPosition(part.props.headerAnchor ?? 'F12', moduleId), moduleId);
}
export const controllerBodyY = .105;
export function moduleTerminalId(partId: string, pin: string): HoleId {
  return `module:${partId}:${pin}`;
}
export function parseModuleTerminal(id: HoleId): {partId:string;pin:string}|null {
  if (!id.startsWith('module:')) return null;
  const n = id.lastIndexOf(':');
  return n > 7 ? {partId:id.slice(7,n),pin:id.slice(n+1)} : null;
}
export function modulePinLocal(part: PlacedPart, pin: string): [number,number,number]|null {
  const spec = expansionById(part.props.moduleId);
  if (!spec || spec.shape !== 'microcontroller') return null;
  const index = spec.pins.indexOf(pin);
  if (index < 0) return null;
  const {width, depth} = controllerDimensions(spec.id);
  const half = Math.ceil(spec.pins.length / 2);
  const i = index < half ? index : index - half;
  const span = Math.min(width - .26, (half - 1) * .13);
  const x = half === 1 ? 0 : -span/2 + (span * i)/(half - 1);
  const z = index < half ? -depth/2 + .105 : depth/2 - .105;
  // Sockets align with the gold contacts in ExpansionPartMesh.
  return [x, .155, z];
}
export function moduleHeaderPosition(part: PlacedPart, pin:string): [number,number,number]|null {
  const local = modulePinLocal(part, pin);
  if (!local) return null;
  const center = controllerPosition(part);
  return [center.x + local[0], controllerBodyY + local[1], center.z + local[2]];
}

/** Convert older breadboard-bound controller chips and explicitly attached wires. */
export function upgradeControllerHeaders(parts: readonly PlacedPart[], wires: readonly Wire[]) {
  const replacements = new Map<string,HoleId>();
  const nextParts = parts.map(part => {
    if (part.kind !== 'module' || expansionById(part.props.moduleId)?.shape !== 'microcontroller') return part;
    const spec = expansionById(part.props.moduleId)!;
    const oldPins = part.pins;
    const legacy = spec.pins.some(name => !oldPins[name]?.startsWith(`module:${part.id}:`));
    if (!legacy && part.props.benchPosition) return part;
    if (legacy) for (const name of spec.pins) {
      const old = oldPins[name];
      if (old && /^[A-T]\d+$/.test(old)) replacements.set(old,moduleTerminalId(part.id,name));
    }
    const firstOld = spec.pins.map(name=>oldPins[name]).find(h=>/^[A-T]\d+$/.test(h ?? ''));
    return {...part, pins:Object.fromEntries(spec.pins.map(name=>[name,moduleTerminalId(part.id,name)])),
      props:{...part.props,benchPosition:controllerPosition({...part,props:{...part.props,headerAnchor:part.props.headerAnchor ?? firstOld ?? 'F12'}})}};
  });
  const nextWires = wires.map(w => {
    const a = replacements.get(w.a) ?? w.a, b = replacements.get(w.b) ?? w.b;
    return a === w.a && b === w.b ? w : {...w,a,b,bends:undefined,bendAnchors:undefined,routeLocked:undefined};
  });
  return {parts:nextParts,wires:nextWires};
}
