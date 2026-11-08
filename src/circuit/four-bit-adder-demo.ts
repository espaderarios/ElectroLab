import { uid } from '@/lib/utils';
import type { ProjectCircuit } from '@/store/projects';
import type { PlacedPart, Wire, WireColor } from './types';
import { getActiveBoardPreset, setBoardPreset, holePosition } from './breadboard';
import { autoTidyWireBundle } from './tidy-wires';

/** 74HC283 educational 4-bit binary adder: eight switch inputs, actual DIP-16
 * pin numbers, eight pull-downs, four sum LEDs plus C4 carry LED. All wiring
 * remains editable, and this is a real circuit rather than a screenshot. */
export function circuitFourBitAdder(): ProjectCircuit {
  const previous=getActiveBoardPreset().id;
  setBoardPreset('extended-1400');
  try {
    const parts:PlacedPart[]=[];
    const wires:Wire[]=[];
    const W=(a:string,b:string,color:WireColor='blue')=>wires.push({id:uid('w'),a,b,color});
    const chipPins:Record<string,string>={};
    for(let i=1;i<=8;i++) chipPins[`p${i}`]=`F${50+i-1}`;
    for(let i=9;i<=16;i++) chipPins[`p${i}`]=`E${50+16-i}`;
    const chip:PlacedPart={id:uid('module'),kind:'module',pins:chipPins,props:{moduleId:'ic-74hc283',label:'U1 · 74HC283 · 4-bit Binary Adder'}};
    parts.push(chip);
    W('tp5',chipPins.p16,'red');
    W('tn5',chipPins.p8,'black');
    W('tn5',chipPins.p7,'black'); // carry-in LOW
    const definitions=[
      ['A0',3,'p5'],['A1',11,'p3'],['A2',19,'p14'],['A3',27,'p12'],
      ['B0',35,'p6'],['B1',43,'p2'],['B2',65,'p15'],['B3',73,'p11'],
    ] as const;
    for(const [label,start,chipPin] of definitions) {
      const end=start+2,pull=start+4;
      parts.push({id:uid('sw'),kind:'switch',pins:{a:`C${start}`,b:`C${end}`},props:{switchType:'spst',closed:false,label:`${label} input`}});
      parts.push({id:uid('r'),kind:'resistor',pins:{a:`E${end}`,b:`E${pull}`},props:{resistance:10000,label:`${label} · 10k pull-down`}});
      W('tp5',`A${start}`,'red');
      W(`E${pull}`,'tn5','black');
      W(`A${end}`,chipPins[chipPin],label.startsWith('A')?'yellow':'green');
    }
    // Output load: 330Ω resistor, LED, return to GND.
    const outputs=[['S0','p4',81],['S1','p1',85],['S2','p13',89],['S3','p10',93],['C4','p9',97]] as const;
    for(const [label,chipPin,ledCol] of outputs){
      parts.push({id:uid('r'),kind:'resistor',pins:{a:`C${ledCol-2}`,b:`C${ledCol}`},props:{resistance:330,label:`${label} · 330Ω`}});
      parts.push({id:uid('led'),kind:'led',pins:{a:`E${ledCol}`,k:`E${ledCol+1}`},props:{ledColor:label==='C4'?'red':'green',label}});
      W(chipPins[chipPin],`A${ledCol-2}`,label==='C4'?'orange':'blue');
      W(`E${ledCol+1}`,'tn5','black');
    }
    return {boardId:'extended-1400',psuVoltage:5,psuPositive:'tp5',psuNegative:'tn5',parts,
      wires:autoTidyWireBundle(wires,parts,holePosition)};
  } finally {setBoardPreset(previous);}
}
