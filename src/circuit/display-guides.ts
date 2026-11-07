/** Read-only wiring suggestions: never inserts components or wires. */
import { holeStrip } from './breadboard';
import type { HoleId, PlacedPart, Wire, WireColor } from './types';

export type DisplayGuideLink = {
  id: string;
  fromPin: string;
  toPin: string;
  fromHole: HoleId;
  toHole: HoleId;
  description: string;
  color: WireColor;
  connected: boolean;
};
export type DisplayGuide = {
  id: string;
  title: string;
  deviceId: string;
  deviceKind: 'lcd' | 'oled' | 'seven-segment';
  links: DisplayGuideLink[];
  notes: string[];
};

/** Names used on actual header and connection-inspector labels. */
export function displayPinLabel(kind: PlacedPart['kind'], name: string): string {
  if (kind === 'mcu') {
    const pins: Record<string,string> = {
      vcc: '5V — Arduino power header', gnd:'GND — ground reference', gnd2:'GND — second ground socket', '3v3':'3.3V — regulated output',
      vin:'VIN — external supply input (limited simulation)', ioref:'IOREF — I/O logic reference',reset:'RESET — active-low reset',
      a4:'A4 / SDA — I²C data', a5:'A5 / SCL — I²C clock',
      d0:'D0 / RX — serial input', d1:'D1 / TX — serial output',
      d3:'D3 — PWM output', d5:'D5 — PWM output', d6:'D6 — PWM output',
      d9:'D9 — PWM output', d10:'D10 — PWM / SS', d11:'D11 — PWM / MOSI',
      d12:'D12 / MISO', d13:'D13 / SCK / onboard LED',
    };
    return pins[name] ?? name.toUpperCase().replace(/^D(\d+)$/, 'D$1 — digital I/O').replace(/^A(\d+)$/, 'A$1 — analog input');
  }
  if (kind === 'lcd') {
    const lcd: Record<string,string> = {
      vss:'1 VSS — GND', vdd:'2 VDD — +5 V', v0:'3 VO — contrast',
      rs:'4 RS — register select', rw:'5 R/W — read/write', e:'6 E — enable',
      d0:'7 D0 — data (unused in 4-bit mode)', d1:'8 D1 — data (unused in 4-bit mode)',
      d2:'9 D2 — data (unused in 4-bit mode)', d3:'10 D3 — data (unused in 4-bit mode)',
      d4:'11 D4 — data', d5:'12 D5 — data', d6:'13 D6 — data', d7:'14 D7 — data',
      a:'15 A — backlight anode (resistor)', k:'16 K — backlight cathode',
    };
    return lcd[name] ?? name.toUpperCase();
  }
  if (kind === 'oled') {
    const oled: Record<string,string> = {vcc:'1 VCC — 3.3 V', gnd:'2 GND — ground', sda:'3 SDA — I²C data', scl:'4 SCL — I²C clock'};
    return oled[name] ?? name.toUpperCase();
  }
  if (kind === 'seven-segment') {
    const seg: Record<string,string> = {
      e:'1 E — segment E', d:'2 D — segment D', com1:'3 COM — common cathode/anode', c:'4 C — segment C',
      dp:'5 DP — decimal point', b:'6 B — segment B', a:'7 A — segment A', com2:'8 COM — common cathode/anode',
      f:'9 F — segment F', g:'10 G — segment G',
    };
    return seg[name] ?? name.toUpperCase();
  }
  return name.toUpperCase();
}

/** Breadboard rows A–E and F–J share five-hole columns; wire endpoints join them. */
export function netConnected(a: HoleId, b: HoleId, wires: readonly Wire[]): boolean {
  if (a === b || holeStrip(a) === holeStrip(b)) return true;
  const adjacency = new Map<string, Set<string>>();
  for (const wire of wires) {
    const x = holeStrip(wire.a), y = holeStrip(wire.b);
    if (!adjacency.has(x)) adjacency.set(x, new Set());
    if (!adjacency.has(y)) adjacency.set(y, new Set());
    adjacency.get(x)!.add(y); adjacency.get(y)!.add(x);
  }
  const start = holeStrip(a), target = holeStrip(b);
  const seen = new Set<string>([start]), todo = [start];
  while (todo.length) {
    for (const next of adjacency.get(todo.shift()!) ?? []) {
      if (next === target) return true;
      if (!seen.has(next)) {seen.add(next); todo.push(next);}
    }
  }
  return false;
}

/** Guide endpoints use a spare hole on the same 5-hole metal strip. */
export function accessibleGuideHole(pinHole: HoleId): HoleId {
  const m = /^([A-T])(\d+)$/.exec(pinHole);
  if (!m) return pinHole;
  const row = m[1], col = m[2];
  if ('ABCDE'.includes(row)) return `${row==='A'?'E':'A'}${col}`;
  if ('FGHIJ'.includes(row)) return `${row==='J'?'F':'J'}${col}`;
  if ('KLMNO'.includes(row)) return `${row==='K'?'O':'K'}${col}`;
  if ('PQRST'.includes(row)) return `${row==='T'?'P':'T'}${col}`;
  return pinHole;
}

type Recipe = readonly [string, string, string, WireColor];
const LCD_RECIPE: readonly Recipe[] = [
  ['vcc','vdd','5V supply','red'], ['gnd','vss','Ground','black'],
  ['gnd','rw','Write-only (R/W low)','black'],
  ['d12','rs','Register select (D12)','blue'], ['d11','e','Enable (D11)','blue'],
  ['d5','d4','Data D4 ↔ D5','green'], ['d4','d5','Data D5 ↔ D4','green'],
  ['d3','d6','Data D6 ↔ D3','green'], ['d2','d7','Data D7 ↔ D2','green'],
];
const OLED_RECIPE: readonly Recipe[] = [
  ['3v3','vcc','3.3 V only','red'], ['gnd','gnd','Common ground','black'],
  ['a4','sda','I²C data (A4/SDA)','blue'], ['a5','scl','I²C clock (A5/SCL)','yellow'],
];
const SEVEN_SEG_RECIPE: readonly Recipe[] = [
  ['gnd','com1','Common cathode to ground','black'],
  ['d2','a','Segment A (D2)','green'],
  ['d3','b','Segment B (D3)','blue'],
  ['d4','c','Segment C (D4)','orange'],
  ['d5','d','Segment D (D5)','green'],
  ['d6','e','Segment E (D6)','yellow'],
  ['d7','f','Segment F (D7)','white'],
  ['d8','g','Segment G (D8)','blue'],
  ['d9','dp','Decimal point (D9)','orange'],
];

export function getDisplayWiringGuides(parts: readonly PlacedPart[], wires: readonly Wire[]): DisplayGuide[] {
  const mcu = parts.find(p => p.kind === 'mcu');
  if (!mcu) return [];
  return parts.filter(p => p.kind === 'lcd' || p.kind === 'oled' || p.kind === 'seven-segment').map(display => {
    const lcd = display.kind === 'lcd';
    const oled = display.kind === 'oled';
    const recipe = lcd ? LCD_RECIPE : oled ? OLED_RECIPE : SEVEN_SEG_RECIPE;
    const displayName = lcd ? 'LCD 16×2' : oled ? 'OLED 128×64' : '7-Segment';
    const notes = lcd ? [
      'Connect LCD VO (pin 3) to the wiper of a 10 kΩ contrast potentiometer; connect the pot ends to 5 V and GND.',
      'Connect backlight A (pin 15) through a current-limiting resistor to 5 V; connect K (pin 16) to GND. Use regulated 5 V on Arduino 5V pin.' ,
      'LCD D0–D3 are unused in 4-bit mode. The guide does not create any wires.',
    ] : oled ? [
      'This example models a 3.3 V SSD1306 module. Check the actual breakout voltage rating and level shifting before using physical hardware.',
      'SDA and SCL may require I²C pull-ups to 3.3 V. If your Uno drives them at 5 V, use a bidirectional level shifter for a 3.3 V-only module. The guide does not add wires.',
    ] : [
      'This guide follows an Arduino Uno directly driving a single common-cathode seven-segment display, similar to the reference layout.',
      'Use a separate current-limiting resistor for each segment wire. A single shared resistor is only acceptable for very limited demonstrations and gives uneven brightness.',
      'Pin 3 and pin 8 are internally common. The guide only needs one COM connection to GND and does not add any wires automatically.',
    ];
    return {
      id: `${mcu.id}:${display.id}`, title: `${mcu.props.label ?? 'Arduino Uno'} → ${display.props.label ?? displayName}`,
      deviceId: display.id,
      deviceKind: display.kind as 'lcd' | 'oled' | 'seven-segment',
      links: recipe.flatMap(([fromPin,toPin,description,color]) => {
        const fromPhysical = mcu.pins[fromPin], toPhysical = display.pins[toPin];
        return fromPhysical && toPhysical ? [{
          id: `${fromPin}:${toPin}`, fromPin, toPin,
          fromHole: accessibleGuideHole(fromPhysical), toHole: accessibleGuideHole(toPhysical),
          description, color, connected: netConnected(fromPhysical,toPhysical,wires),
        }] : [];
      }),
      notes,
    };
  });
}
