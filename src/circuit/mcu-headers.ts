/**
 * Independent 3-D Arduino header terminals.
 * A header socket is NOT one of the breadboard's five-hole strips.
 * The serialized identity remains stable when the view/camera changes.
 */
import { BOARD, colX, holePosition, holeStrip } from './breadboard';
import type { HoleId, PlacedPart, Wire } from './types';

export const UNO_DIGITAL = Array.from({length:14},(_,i)=>`d${i}`);
export const UNO_ANALOG = Array.from({length:6},(_,i)=>`a${i}`);
export const UNO_POWER = ['ioref','reset','3v3','vcc','gnd','gnd2','vin'];
export const UNO_HEADER_NAMES = [...UNO_DIGITAL, ...UNO_ANALOG, ...UNO_POWER];
export const DEFAULT_MCU_ANCHOR = 'F22';

export function mcuTerminalId(partId: string, pin: string): HoleId {
  return `mcu:${partId}:${pin}`;
}
export function parseMcuTerminal(id: HoleId): { partId: string; pin: string } | null {
  if (!id.startsWith('mcu:')) return null;
  const n = id.lastIndexOf(':');
  if (n < 5) return null;
  return {partId: id.slice(4,n), pin:id.slice(n+1)};
}
export function isMcuTerminal(id: HoleId) {return parseMcuTerminal(id)!==null;}

export function mcuBoardOrigin(part: PlacedPart): [number,number,number] {
  const anchor = part.props.headerAnchor ?? DEFAULT_MCU_ANCHOR;
  const m = /^[A-T](\d+)$/.exec(anchor);
  const firstCol = m ? Number(m[1]) : 22;
  // Legacy MCU models averaged 23 pins F(start)..F(start+22).
  const centerX = colX(firstCol + 11) + 0.15;
  const z = Math.min(0.3 - 1.75, -(BOARD.depth/2 + 1.12));
  return [centerX, BOARD.height + 0.075/2 + 0.035, z];
}
export function mcuPinLocal(pin: string): [number,number,number] | null {
  const digital = UNO_DIGITAL.indexOf(pin);
  if (digital >= 0) return [-0.685 + digital*0.105,0.075/2+0.085,-2.12/2+0.115];
  const analog = UNO_ANALOG.indexOf(pin);
  if (analog >= 0) return [0.02 + analog*0.105,0.075/2+0.085,2.12/2-0.115];
  const power = UNO_POWER.indexOf(pin);
  if (power >= 0) return [-0.73 + power*0.105,0.075/2+0.085,2.12/2-0.115];
  return null;
}
export function mcuHeaderPosition(part: PlacedPart,pin:string): [number,number,number] | null {
  const local=mcuPinLocal(pin);
  if (!local) return null;
  const origin=mcuBoardOrigin(part);
  // Header metal socket opening is 0.125 above the local pin center.
  return [origin[0]+local[0],origin[1]+local[1]+0.125,origin[2]+local[2]];
}
export function terminalPosition(id:HoleId,parts:readonly PlacedPart[]): [number,number,number] {
  const h=parseMcuTerminal(id);
  if (h) {
    const p=parts.find(part=>part.kind==='mcu'&&part.id===h.partId);
    const xyz=p?mcuHeaderPosition(p,h.pin):null;
    if(xyz) return xyz;
    return [NaN,NaN,NaN];
  }
  return holePosition(id);
}

/** Legacy migration: only translate explicit jumper endpoints on the old MCU
 * ghost strips. After migration those terminal columns become free breadboard
 * space. Preserves all other components and the source Arduino sketch. */
export function upgradeMcuHeaders(parts:readonly PlacedPart[], wires:readonly Wire[]): {parts:PlacedPart[];wires:Wire[]} {
  const oldContactToHeader=new Map<string,HoleId>();
  const newParts=parts.map(part=>{
    if(part.kind!=='mcu')return {...part,pins:{...part.pins},props:{...part.props}};
    const old=part.pins;
    const legacy=Object.values(old).some(h=>/^[A-T]\d+$/.test(h));
    let anchor=part.props.headerAnchor;
    if(!anchor && legacy) {
      const p=old.vcc ?? old.d0 ?? 'F22';
      // vcc uses index 0 in the old 23-column virtual socket footprint.
      anchor=/^[A-T]\d+$/.test(p)?p:DEFAULT_MCU_ANCHOR;
    }
    anchor ??= DEFAULT_MCU_ANCHOR;
    if(legacy) {
      for(const [name,hole] of Object.entries(old)) {
        if(UNO_HEADER_NAMES.includes(name) && /^[A-T]\d+$/.test(hole)) {
          oldContactToHeader.set(holeStrip(hole),mcuTerminalId(part.id,name));
        }
      }
    }
    const pins=Object.fromEntries(UNO_HEADER_NAMES.map(name=>[name,mcuTerminalId(part.id,name)]));
    return {...part,pins,props:{...part.props,headerAnchor:anchor}};
  });
  const migrate=(h:HoleId)=>{
    if(isMcuTerminal(h))return h;
    const newId=oldContactToHeader.get(holeStrip(h));
    return newId??h;
  };
  const newWires=wires.map(w=>{
    const a=migrate(w.a),b=migrate(w.b);
    if(a===w.a&&b===w.b)return {...w};
    return {...w,a,b,bends:undefined,bendAnchors:undefined,routeLocked:undefined};
  });
  return {parts:newParts,wires:newWires};
}
