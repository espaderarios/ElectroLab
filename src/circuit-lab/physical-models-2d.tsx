/**
 * Original SVG artwork for ElectroLab's top-down physical breadboard view.
 * Art is deliberately separate from the circuit graph: callers continue to draw
 * and wire each terminal at its stored electrical position, not at an image pixel.
 *
 * Design references: Fritzing breadboard graphic standards (0.1-inch grid,
 * metallic pins, distinct packages) and Wokwi's component diagram editor.
 * No third-party circuit illustrations are embedded or copied.
 */
import type { ReactNode } from 'react';
import { expansionById } from '@/circuit/expansion-catalog';
import { controllerDimensionsForPart, isOffboardController } from '@/circuit/offboard-controllers';
import type { PlacedPart } from '@/circuit/types';

export type SvgPoint = {x:number; y:number};
export type PhysicalModelProps = {
  part: PlacedPart;
  center: SvgPoint;
  pins: readonly SvgPoint[];
  selected: boolean;
  lit: boolean;
  segments?: readonly boolean[];
};
const SCALE = 76;
const ink = '#e4eef4';
const metal = '#abb6c0';
const metalDark = '#607183';
const silk = {pointerEvents:'none' as const, userSelect:'none' as const};
const R = (n:number)=>Math.round(n*10)/10;

function Print({x=0,y=0,children,size=8,color=ink,weight=700,anchor='middle'}:{x?:number;y?:number;children:ReactNode;size?:number;color?:string;weight?:number;anchor?:'middle'|'start'|'end'}) {
  return <text x={x} y={y} textAnchor={anchor} fontFamily="Arial,Helvetica,sans-serif" fontSize={size} fontWeight={weight} fill={color} style={silk}>{children}</text>;
}
function Screw({x,y,r=4}:{x:number;y:number;r?:number}) {
  return <g><circle cx={x} cy={y} r={r} fill="#cad3da" stroke="#687b87" strokeWidth="1.2"/><path d={`M${x-r*.56} ${y-r*.23}L${x+r*.56} ${y+r*.23}`} stroke="#677887" strokeWidth="1.3"/></g>;
}
function Chip({x=0,y=0,w=32,h=19,text='IC',pins=true}:{x?:number;y?:number;w?:number;h?:number;text?:string;pins?:boolean}) {
  return <g>
    {pins&&Array.from({length:Math.max(3,Math.floor(w/9))},(_,i)=>{const xx=x-w/2+(i+.5)*w/Math.max(3,Math.floor(w/9));return <g key={i}><rect x={xx-2} y={y-h/2-4} width="4" height="6" fill={metal}/><rect x={xx-2} y={y+h/2-2} width="4" height="6" fill={metal}/></g>})}
    <rect x={x-w/2} y={y-h/2} width={w} height={h} rx="2" fill="#111923" stroke="#536273" strokeWidth="1.1"/>
    <path d={`M${x-w/2+3} ${y-h/2+3}H${x+w/2-3}`} stroke="#69788b" opacity=".5"/>
    <circle cx={x-w/2+5} cy={y-h/2+6} r="1.8" fill="#b0b9c1"/>
    <Print x={x} y={y+2.5} size={Math.min(8,Math.max(5.5,w/(text.length*.72+2)))} color="#b9c7d0">{text}</Print>
  </g>;
}
function Pad({x,y,r=3.7}:{x:number;y:number;r?:number}) {return <g><circle cx={x} cy={y} r={r+1.5} fill="#233039"/><circle cx={x} cy={y} r={r} fill="#d2a44f"/><circle cx={x} cy={y} r={r*.48} fill="#172934"/></g>}
function Pcb({w,h,color='#146a8a',children,holes=true}:{w:number;h:number;color?:string;children?:ReactNode;holes?:boolean}) {
  return <g><rect x={-w/2+2} y={-h/2+3} width={w} height={h} rx="4" fill="#182935" opacity=".22"/>
    <rect x={-w/2} y={-h/2} width={w} height={h} rx="3.2" fill={color} stroke="#15384b" strokeWidth="2"/>
    <rect x={-w/2+3} y={-h/2+3} width={w-6} height={h-6} rx="2" stroke="#8fc6c8" opacity=".35" fill="none"/>
    {holes&&[[-1,-1],[1,-1],[-1,1],[1,1]].map(([sx,sy],i)=><g key={i}><circle cx={sx*(w/2-8)} cy={sy*(h/2-8)} r="4" fill="#cad6db"/><circle cx={sx*(w/2-8)} cy={sy*(h/2-8)} r="2.35" fill="#29424f"/></g>)}
    {children}
  </g>;
}
function TerminalBlock({x,y,count=2,horizontal=true}:{x:number;y:number;count?:number;horizontal?:boolean}) {
  return <g transform={`translate(${x} ${y})`}>
    <rect x={-((horizontal?count:1)*11)/2} y={-((horizontal?1:count)*11)/2} width={(horizontal?count:1)*11} height={(horizontal?1:count)*11} rx="2" fill="#167b46" stroke="#074329" strokeWidth="1.2"/>
    {Array.from({length:count},(_,i)=><g key={i}><circle cx={horizontal?(i-(count-1)/2)*11:0} cy={horizontal?0:(i-(count-1)/2)*11} r="3.8" fill="#e4e8e9" stroke="#67747c" strokeWidth="1"/><path d={`M${horizontal?(i-(count-1)/2)*11-2.2:-2.2} ${horizontal?-1.2:(i-(count-1)/2)*11-1.2}l4.4 2.4`} stroke="#7d909d" strokeWidth=".8"/></g>)}
  </g>;
}
function LedDot({x,y,r=3,on=false,color='#e34c46'}:{x:number;y:number;r?:number;on?:boolean;color?:string}) {
  return <g><circle cx={x} cy={y} r={r+1} fill="#15222c"/><circle cx={x} cy={y} r={r} fill={color} opacity={on?1:.68}/><circle cx={x-r*.24} cy={y-r*.3} r={r*.27} fill="#fff" opacity=".7"/>{on&&<circle cx={x} cy={y} r={r*1.7} fill={color} opacity=".15"/>}</g>;
}
function Wheel({x=0,y=0,r=14,metallic=true}:{x?:number;y?:number;r?:number;metallic?:boolean}) {
  return <g><circle cx={x} cy={y} r={r} fill={metallic?'#b7c1ca':'#292e36'} stroke="#657484" strokeWidth="1.7"/><circle cx={x} cy={y} r={r*.76} fill={metallic?'#8798a6':'#111a24'} stroke="#c6d2da" strokeWidth="1.1"/>
    <circle cx={x} cy={y} r={r*.34} fill={metallic?'#d8e0e5':'#6e8999'} stroke="#536a78"/><path d={`M${x} ${y-r*.71}V${y-r*.2}`} stroke="#3b5161" strokeWidth="2" strokeLinecap="round"/></g>;
}
function SevenDigit({x,y,size=35,segments}:{x:number;y:number;size?:number;segments?:readonly boolean[]}) {
  const w=size*.58,h=size,t=Math.max(2,size*.11),left=x-w/2,top=y-h/2;
  const lines=[
    [left+t,top,w-2*t,t],[left+w-t,top+t,t,h/2-t],[left+w-t,top+h/2,t,h/2-t],
    [left+t,top+h-t,w-2*t,t],[left,top+h/2,t,h/2-t],[left,top+t,t,h/2-t],
    [left+t,top+h/2-t/2,w-2*t,t],
  ];
  return <g>{lines.map(([xx,yy,ww,hh],i)=><rect key={i} x={xx} y={yy} width={ww} height={hh} rx={t*.28} fill={segments?.[i]?'#ff5355':'#72242d'} opacity={segments?.[i]?1:.75}/>)}<circle cx={left+w+3} cy={top+h-2} r={t*.58} fill={segments?.[7]?'#ff5b60':'#61242e'}/></g>;
}
function Screen({w=100,h=60,type='lcd',value=''}:{w?:number;h?:number;type?:'lcd'|'oled'|'seven'|'four'|'bar';value?:string}) {
  const lcd=type==='lcd', oled=type==='oled';
  return <Pcb w={w} h={h} color={lcd?'#176c4c':'#12678d'}>
    <rect x={-w*.43} y={-h*.37} width={w*.86} height={h*.74} rx="2" fill="#18202b" stroke="#547e90" strokeWidth="1.3"/>
    <rect x={-w*.39} y={-h*.3} width={w*.78} height={h*.59} rx="1.5" fill={lcd?'#9aaf59':oled?'#080f23':'#280c17'} stroke="#243b43"/>
    {lcd?<g><Print x={-w*.34} y={-3} size={10} color="#253c23" anchor="start">{value.slice(0,16)||'ElectroLab'}</Print><Print x={-w*.34} y={10} size={10} color="#253c23" anchor="start">{value.slice(16,32)||'16 x 2  LCD'}</Print></g>:
    oled?<g><Print x={0} y={-2} size={10} color="#e0f9ff">{value||'ElectroLab'}</Print><Print x={0} y={11} size={8} color="#82dfff">OLED · 128×64</Print></g>:
    type==='bar'?Array.from({length:10},(_,i)=><rect key={i} x={-w*.36+i*w*.072} y={-h*.2} width={w*.055} height={h*.42} rx="1" fill={['#2ab65e','#2ab65e','#32bb60','#e7b943','#e7b943','#eb7f3b','#ed544c'][Math.min(6,Math.floor(i*.75))]} opacity=".76"/>):
    Array.from({length:type==='four'?4:1},(_,i)=><SevenDigit key={i} x={(i-((type==='four'?4:1)-1)/2)*(type==='four'?w*.196:0)} y={0} size={Math.min(h*.47,w*.45)} />)}
  </Pcb>;
}

// A stable style identity for every catalog entry. Tools that share a body (e.g.
// color variants) still use distinct artwork derived from their saved properties.
export function physical2DModelKey(part:PlacedPart):string {
  if(part.kind==='module') return part.props.moduleId ?? 'module-unknown';
  if(part.kind==='capacitor')return `capacitor-${part.props.capacitorType??'ceramic'}`;
  if(part.kind==='switch')return `switch-${part.props.componentVariant??part.props.switchType??'spst'}`;
  if(part.kind==='button')return `button-${part.props.switchStyle??'tactile-black'}`;
  if(part.kind==='fuse')return `fuse-${part.props.componentVariant??'ceramic'}`;
  if(part.kind==='diode')return `diode-${part.props.diodeType??'silicon'}`;
  if(part.kind==='transistor')return `transistor-${part.props.transistorModel??'to92'}`;
  if(part.kind==='mosfet')return `mosfet-${part.props.mosfetModel??'to220'}`;
  if(part.kind==='led')return `led-${part.props.ledColor??'red'}`;
  if(part.kind==='motor')return `motor-${part.props.motorModel??'5v'}`;
  if(part.kind==='thyristor')return `thyristor-${part.props.thyristorModel??'default'}`;
  if(part.kind==='triac')return `triac-${part.props.triacModel??'default'}`;
  return part.kind;
}

function Discrete({part,pins,lit}:{part:PlacedPart;pins:readonly SvgPoint[];lit:boolean}) {
  const a=pins[0]??{x:-24,y:0},b=pins[1]??{x:24,y:0};
  const mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  const delta=Math.hypot(a.x-b.x,a.y-b.y);
  const angle=Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI;
  const len=Math.max(21,Math.min(44,delta*.6));
  const k=part.kind;
  const colors:Record<string,string>={red:'#e33643',green:'#23ae53',blue:'#258ddf',yellow:'#f4c326'};
  return <g transform={`translate(${mid.x} ${mid.y}) rotate(${angle})`}>
    <path d={`M${-delta/2} 0H${-len/2} M${len/2} 0H${delta/2}`} stroke={metalDark} strokeWidth="3" fill="none" strokeLinecap="round"/>
    {k==='resistor'?<g><rect x={-len/2} y="-6.8" width={len} height="13.6" rx="5.2" fill="#e3cca3" stroke="#978263"/><path d={`M${-len/2+3} -5H${len/2-3}`} stroke="#fff2d4" opacity=".8"/>{['#8c3f24','#201b1a','#d45830','#ba9d4b'].map((c,i)=><rect key={i} x={-len*.30+i*len*.18} y="-6.1" width="3.7" height="12.2" fill={c}/>)}</g>:
    k==='inductor'?<g><rect x={-len/2} y="-7.8" width={len} height="15.6" rx="3" fill="#a98f55" stroke="#785526"/>{Array.from({length:8},(_,i)=><path key={i} d={`M${-len/2+3+i*(len-6)/8} -7.2q-4 7 0 14.4`} stroke="#b16629" strokeWidth="2.2" fill="none"/>)}</g>:
    k==='fuse'?<g><rect x={-len/2} y="-6" width={len} height="12" rx="2" fill={part.props.componentVariant==='glass-fuse'?'#d1e5ef':'#e2c6a0'} opacity=".86" stroke="#73848e" strokeWidth="1.3"/><path d={`M${-len/2+4} 0H${len/2-4}`} stroke="#b96b3b" strokeWidth="1.5"/>{[-1,1].map((s,i)=><rect key={i} x={s*len/2-(s===1?5:0)} y="-6.6" width="5" height="13.2" fill="#aeb8bf"/>)}</g>:
    k==='thermistor'?<g><circle r="10" fill="#2b677b" stroke="#34505b" strokeWidth="1.8"/><circle r="7" fill="#185769"/><path d="M-7 -2H-3L0 4L3 -4L7 2" stroke="#ebca8d" fill="none" strokeWidth="1.7"/></g>:
    k==='ldr'?<g><circle r="11.2" fill="#d9a96c" stroke="#6f5949" strokeWidth="1.8"/><circle r="8.1" fill="#e1b581"/><path d="M-5 -5H2V-2H-3V1H4V4H-5" fill="none" stroke="#a45b32" strokeWidth="2"/></g>:
    k==='led'||k==='rgb-led'?<g>{k==='rgb-led'?<g><circle r="11.6" fill="#e8eff2" opacity=".85" stroke="#91aab4"/>{['#ea4c4c','#45d67d','#4598f5'].map((c,i)=><path key={i} d={`M0 0L${Math.cos(i*2*Math.PI/3)*8} ${Math.sin(i*2*Math.PI/3)*8}`} stroke={c} strokeWidth="6" strokeLinecap="round"/>)}</g>:<circle r="10.4" fill={colors[part.props.ledColor??'red']} stroke="#6f8799" strokeWidth="1.6"/>}<ellipse cx="-3" cy="-4" rx="3.2" ry="2.1" fill="#fff" opacity=".68"/>{lit&&<circle r="19" fill={colors[part.props.ledColor??'red']} opacity=".19"/>}<path d="M-9 5L-5 9" stroke="#dae4ed" strokeWidth="1.8"/></g>:
    <g><rect x={-len*.33} y="-5.4" width={len*.66} height="10.8" rx="1.7" fill={k==='diode'?'#161d26':'#a95c42'} stroke="#6d7e85"/>
    {k==='zener'||k==='diode'?<rect x={-len*.21} y="-5.4" width="5" height="10.8" fill="#d1d8da"/>:<rect x={-len*.21} y="-5.4" width="4" height="10.8" fill="#c4d0d8"/>}</g>}
  </g>;
}

function BaseDevice({part,center,segments}:{part:PlacedPart;center:SvgPoint;segments?:readonly boolean[]}) {
  const k=part.kind; const type=part.props.capacitorType??'ceramic';
  return <g transform={`translate(${center.x} ${center.y})`}>
    {k==='capacitor'?type==='electrolytic'?<g><circle r="13" fill="#4c687a" stroke="#889fad" strokeWidth="1.5"/><circle r="10" fill="#9cabb8" stroke="#dce4e8" strokeWidth="1.4"/><path d="M-6 -6L6 6 M6 -6L-6 6" stroke="#72818d"/><rect x="6.2" y="-9" width="3.5" height="18" rx="1.5" fill="#f7f8fa" opacity=".65"/></g>:
    type==='film'?<g><rect x="-17" y="-11" width="34" height="22" rx="2" fill="#e5b453" stroke="#a47627" strokeWidth="1.6"/><Print y={3} size={7} color="#4c3a1d">100nF</Print></g>:
    type==='tantalum'?<g><rect x="-12" y="-13" width="24" height="26" rx="10" fill="#bd7940" stroke="#83542c"/><path d="M4 -8V8" stroke="#f1d39c" strokeWidth="3"/></g>:
    <g><ellipse rx="12" ry="14.3" fill="#d89e55" stroke="#aa7136" strokeWidth="1.5"/><path d="M-7 -10Q0 -14 7 -10" stroke="#fff0c2" strokeWidth="2"/></g>:
    k==='pot'?<g><rect x="-17" y="-17" width="34" height="34" rx="2.5" fill="#297caa" stroke="#194b71"/><Wheel r={11}/><path d="M0 -12V-5" stroke="#2d4c5d" strokeWidth="2"/><Print y={-20} size={7} color="#2e5d79">10k</Print></g>:
    k==='button'?<g><rect x="-15" y="-14" width="30" height="28" rx="4" fill="#8e959e" stroke="#4d5a63" strokeWidth="1.8"/>{[[-10,-8],[10,-8],[-10,8],[10,8]].map(([x,y],i)=><rect key={i} x={x-3} y={y-3} width="6" height="6" fill="#c9d0d5" stroke="#566572"/>)}<circle r="9.5" fill={part.props.switchStyle==='tactile-blue'?'#146fbe':part.props.switchStyle==='tactile-white'?'#e7edf2':part.props.switchStyle==='tactile-red'?'#bb3748':'#25272b'} stroke="#4c545d" strokeWidth="2"/></g>:
    k==='switch'?part.props.componentVariant==='reed-switch'?<g><rect x="-26" y="-5" width="52" height="10" rx="5" fill="#c6e5e5" opacity=".72" stroke="#5d8c92"/><path d="M-21 0H-4M4 0H21" stroke="#9a7451" strokeWidth="2"/><path d="M-6 0L3 -2" stroke="#ad794d" strokeWidth="2"/></g>:
    <g><rect x="-21" y="-12" width="42" height="24" rx="3" fill="#343d47" stroke="#8a9ba9"/><rect x={part.props.closed?0:-13} y="-8" width="13" height="16" rx="2" fill={part.props.componentVariant==='slide-spdt'?'#477ab1':'#e6edf2'} stroke="#a9b6c2"/><Print x={-12} y={-15} size={7} color="#4c5d6e">OFF</Print><Print x={12} y={-15} size={7} color="#4c5d6e">ON</Print><Print y={23} size={8} color="#394e61">{(part.props.switchType??'SPST').toUpperCase()}</Print></g>:
    k==='motor'?<g><rect x="-28" y="-18" width="56" height="36" rx="11" fill="#b2bdc5" stroke="#687780" strokeWidth="2"/><path d="M-20 -15V15M20 -15V15" stroke="#788995"/><circle r="9" fill="#d6dde2" stroke="#81939f"/><circle r="3.8" fill="#536678"/><rect x="-33" y="-8" width="7" height="16" fill="#9b7453"/><Print y={-23} size={7} color="#596c7a">{part.props.motorModel??'5v'} DC</Print></g>:
    k==='servo'?<g><rect x="-23" y="-19" width="46" height="38" rx="5" fill="#24619a" stroke="#173d69" strokeWidth="2"/><rect x="-28" y="-10" width="56" height="20" rx="1.5" fill="#305c93"/>{[-1,1].map((s,i)=><Screw key={i} x={s*23} y={0} r={3}/>) }<Wheel r={12} metallic={false}/><Print y={-22} size={9} color="#2870aa">SG90</Print></g>:
    k==='buzzer'?<g><circle r="18" fill="#202a34" stroke="#687783" strokeWidth="2"/><circle r="13" fill="#121821" stroke="#555f65"/><circle r="5.5" fill="#080e12"/><Print y={-21} size={7} color="#445261">BUZZER</Print><Print x={12} y={3} size={12} color="#d0d8df">+</Print></g>:
    k==='speaker'?<g><circle r="23" fill="#414b54" stroke="#97a4b0" strokeWidth="2"/><circle r="18" fill="#19212a" stroke="#6d7b86"/><circle r="10" fill="#687585" stroke="#24303a" strokeWidth="2"/><circle r="4.5" fill="#273540"/></g>:
    k==='relay'?<g><rect x="-27" y="-18" width="54" height="36" rx="3" fill="#2078c2" stroke="#124d83" strokeWidth="1.5"/><rect x="-21" y="-12" width="42" height="24" rx="2" fill="#1d5da0" stroke="#7ea4c3"/><Print y={-1} size={8} color="#e0eefb">SRD-05VDC</Print><Print y={9} size={6.5} color="#e2f4ff">SONGLE · RELAY</Print></g>:
    k==='lcd'?<Screen w={160} h={82} type="lcd" value={part.props.label?.includes('Hello')?'Hello World!':''}/>:
    k==='oled'?<Screen w={90} h={62} type="oled" value="ElectroLab"/>:
    k==='seven-segment'?<g><rect x="-24" y="-33" width="48" height="66" rx="2" fill="#171a22" stroke="#65737b" strokeWidth="2"/><rect x="-19" y="-27" width="38" height="54" fill="#310c16"/><SevenDigit x={0} y={0} size={44} segments={segments}/></g>:
    k==='transistor'||k==='mosfet'||k==='thyristor'||k==='triac'||k==='diac'||k==='regulator'?<g>
      {k==='transistor'&&part.props.transistorModel==='2n3055'?<g><ellipse rx="33" ry="19" fill="#bcc6cb" stroke="#687b89" strokeWidth="2"/><ellipse rx="20" ry="14" fill="#919fa9" stroke="#cbd5dd"/><Screw x={-25} y={0} r={3}/><Screw x={25} y={0} r={3}/></g>:
      k==='transistor'&&part.props.transistorModel==='2n2222'?<g><circle r="15" fill="#aab9c1" stroke="#657889" strokeWidth="1.6"/><circle r="10" fill="#cdd5da" stroke="#8798a1"/><path d="M-9 5H9" stroke="#748491"/></g>:
      k==='mosfet'&&/ao340/i.test(part.props.mosfetModel??'')?<g><rect x="-10" y="-7" width="20" height="14" rx="2" fill="#242b32" stroke="#788795"/>{[-1,1].map((s,i)=><rect key={i} x={s*8-3} y="-11" width="6" height="4" fill="#aebdc9"/>)}</g>:
      ['regulator','triac'].includes(k)||(k==='thyristor'&&part.props.thyristorModel!=='2n5060')||/irf|tip|bt|bta/i.test(`${part.props.transistorModel??''}${part.props.mosfetModel??''}`)?<g><rect x="-15" y="-18" width="30" height="36" rx="2" fill="#242b32" stroke="#788795"/><rect x="-13" y="-18" width="26" height="9" fill="#a9b4bc" stroke="#57697a"/><circle cx="0" cy="-14" r="2.5" fill="#3c5262"/></g>:<g><path d="M-14 11V-2Q-14 -16 0 -16Q14 -16 14 -2V11Z" fill="#202832" stroke="#7d8b98" strokeWidth="1.5"/><path d="M-11 8H11" stroke="#444e55"/></g>}
      <Print y={3} size={8} color="#ccd8e1">{k==='regulator'?'7805':k==='thyristor'?'SCR':k==='triac'?'TRIAC':k==='diac'?'DIAC':k==='mosfet'?(part.props.mosfetModel??'FET').toUpperCase().slice(0,7):part.props.transistorModel?.toUpperCase().slice(0,7)??'NPN'}</Print>
    </g>:
    <Chip w={Math.max(37,Math.min(72,part.pins?Object.keys(part.pins).length*4.2:42))} h={23} text={k==='timer555'?'NE555':k==='optocoupler'?'PC817':k==='opamp'?'LM358':k==='not'?'74HC04':k==='and'?'74HC08':k==='or'?'74HC32':k==='nand'?'74HC00':k==='nor'?'74HC02':k==='xor'?'74HC86':k==='xnor'?'CD4077':k.toUpperCase().slice(0,10)} />
    }
  </g>;
}

function Controller({part,center,pins}:{part:PlacedPart;center:SvgPoint;pins:readonly SvgPoint[]}) {
  const type=part.kind==='mcu'?'uno':part.props.moduleId==='board-nano'?'nano':part.props.moduleId==='board-mega'?'mega':part.props.moduleId==='board-pico'?'pico':'esp32';
  const dim=controllerDimensionsForPart(part),w=dim.width*SCALE,h=dim.depth*SCALE;
  const color=type==='pico'?'#16774b':type==='esp32'?'#172d43':'#1176a8';
  const isLong=type==='mega', small=type==='nano'||type==='pico'||type==='esp32';
  const chipW=small?w*.31:w*.33;
  return <g transform={`translate(${center.x} ${center.y})`}>
    <Pcb w={w} h={h} color={color} holes={!small}>
      {/* Board-mounted components, silkscreen, and USB are drawn in board units;
          actual interactive header pins are drawn from stored terminal positions. */}
      <rect x={-w*.51} y={-h*.19} width={w*.19} height={h*.31} rx="3" fill="#bac6cd" stroke="#607686" strokeWidth="1.6"/>
      <rect x={-w*.5} y={-h*.13} width={w*.1} height={h*.19} fill="#3e4c59" rx="1"/>
      {!small&&<g><rect x={-w*.49} y={h*.17} width={w*.2} height={h*.22} rx="2" fill="#1b252b" stroke="#a6b3bd"/><circle cx={-w*.39} cy={h*.29} r="5" fill="#131f27" stroke="#606b72"/></g>}
      <Chip x={w*.05} y={0} w={chipW} h={h*.27} text={type==='esp32'?'ESP-WROOM':type==='pico'?'RP2040':type==='mega'?'ATMEGA2560':'ATMEGA328P'}/>
      <rect x={w*.32} y={-h*.2} width={w*.12} height={h*.15} rx="1" fill="#e3eef6" stroke="#8599a5"/>
      <Chip x={-w*.16} y={-h*.25} w={Math.max(15,w*.12)} h={Math.max(10,h*.14)} text="USB"/>
      <LedDot x={w*.28} y={h*.23} color="#50cd78" on r={Math.max(2.6,w*.018)}/>
      <LedDot x={w*.39} y={h*.23} color="#e4ba3e" r={Math.max(2.6,w*.018)}/>
      <Print x={w*.15} y={-h*.36} size={Math.max(9,Math.min(16,w*.11))} color="#f7f9fe">{type==='uno'?'UNO R3':type==='mega'?'MEGA 2560':type==='pico'?'PICO':type==='nano'?'NANO':'ESP32'}</Print>
      <Print x={w*.1} y={h*.39} size={Math.max(6,Math.min(10,w*.07))} color="#d8f3f8">ELECTROLAB · {type.toUpperCase()}</Print>
    </Pcb>
    {pins.map((p,i)=>{const xx=p.x-center.x,yy=p.y-center.y;return <g key={i}><rect x={xx-4.9} y={yy-4.9} width="9.8" height="9.8" rx="1" fill="#142937" stroke="#d4dfe7" strokeWidth=".8"/><Pad x={xx} y={yy} r={2.8}/></g>})}
    {isLong&&<Screw x={-w*.35} y={h*.18} r={4}/>}
  </g>;
}

function Module({part,center,segments}:{part:PlacedPart;center:SvgPoint;segments?:readonly boolean[]}) {
  const spec=expansionById(part.props.moduleId);if(!spec)return <g transform={`translate(${center.x} ${center.y})`}><Chip w={46} text="MODULE"/></g>;
  const id=spec.id;
  const heading=spec.name.split(' · ')[0].replace(/ Module$/,'');
  const pcb=(color:string,w:number,h:number,contents:ReactNode)=> <Pcb color={color} w={w} h={h}>{contents}</Pcb>;
  const moduleMark=(text:string,y=0,size=8)=> <Print y={y} size={size}>{text}</Print>;
  let art:ReactNode;
  switch(id){
    // Individual chip part numbers are printed on realistic DIP packages.
    case 'ic-74hc283':case 'ic-cd4511':case 'ic-74hc595':case 'ic-74hc74':case 'ic-74hc161':case 'ic-74hc138':
      art=<Chip w={86} h={32} text={id.replace('ic-','').toUpperCase()}/>;break;
    case 'module-clock':
      art=pcb('#166785',88,53,<><Chip x={-15} w={34} text="555"/><rect x="17" y="-12" width="25" height="23" rx="2" fill="#d7e3ed" stroke="#638ba3"/><Print x={29} y={2} color="#475a65">XTAL</Print><LedDot x={-31} y={-18} color="#26c777"/><Print y={23} size={7}>CLOCK · OUT</Print></>);break;
    case 'sensor-hcsr04':
      art=pcb('#157c92',110,59,<><Wheel x={-28} y={-2} r={19}/><Wheel x={28} y={-2} r={19}/><Chip x={0} y={21} w={27} h={9} text="HC-SR04"/><Print y={-25} size={8}>ULTRASONIC</Print></>);break;
    case 'sensor-dht22':
      art=<g><rect x="-31" y="-36" width="62" height="72" rx="9" fill="#f0f0eb" stroke="#aab5bc" strokeWidth="2"/>{Array.from({length:7},(_,i)=><rect key={i} x="-24" y={-26+i*8} width="48" height="3.1" rx="1.2" fill="#9eb1b9"/>)}<Print y={32} size={8} color="#51636c">DHT22</Print></g>;break;
    case 'sensor-pir':
      art=pcb('#1d7184',82,76,<><circle cy="-3" r="28" fill="#ebedf0" stroke="#adb9c1" strokeWidth="2"/>{Array.from({length:5},(_,i)=><circle key={i} cy="-3" r={5+i*5} stroke="#bbc3cc" fill="none" opacity=".65"/>)}<Print y={35} size={7}>PIR · OUT</Print></>);break;
    case 'sensor-ir':
      art=pcb('#1e79b4',91,45,<><circle cx={-23} cy={0} r="10" fill="#121923" stroke="#aeb4b8" strokeWidth="1.7"/><circle cx={3} cy={0} r="10" fill="#232b35" stroke="#aeb4b8" strokeWidth="1.7"/><Wheel x={30} y={0} r={8}/><Print y={-15} size={7}>IR · SENSOR</Print></>);break;
    case 'sensor-hall':
      art=pcb('#2b6d9b',79,47,<><path d="M-9 15V-4Q-9 -18 1 -18Q11 -18 11 -4V15Z" fill="#252a30" stroke="#8d9da8"/><Print x={26} y={3} size={7}>HALL</Print><LedDot x={-27} y={0} r={3}/></>);break;
    case 'sensor-mpu6050':
      art=pcb('#246dbe',75,63,<><Chip w={31} h={29} text="MPU-6050"/><Print y={-25} size={8}>GY-521</Print><Print y={26} size={7}>X · Y · Z</Print></>);break;
    case 'input-keypad':
      art=<g><rect x="-48" y="-63" width="96" height="126" rx="5" fill="#dae1e6" stroke="#8497a9" strokeWidth="2"/>{Array.from({length:16},(_,i)=>{const xx=(i%4-1.5)*22,yy=(Math.floor(i/4)-1.5)*29;const texts='123A456B789C*0#D';return <g key={i}><rect x={xx-9.2} y={yy-10} width="18.4" height="21" rx="3.4" fill="#333b46" stroke="#7a8793"/><Print x={xx} y={yy+4} size={11} color="#f9f9fa">{texts[i]}</Print></g>})}</g>;break;
    case 'input-encoder':
      art=pcb('#256e9d',79,72,<><Wheel r={25}/><Print y={32} size={7}>ROTARY · A/B/SW</Print></>);break;
    case 'display-8x8':case 'display-max7219':
      art=(id==='display-max7219'?pcb('#175b91',117,117,<><rect x="-48" y="-45" width="96" height="90" rx="3" fill="#151821" stroke="#516679"/>{Array.from({length:64},(_,i)=><LedDot key={i} x={-38+(i%8)*10.8} y={-37+Math.floor(i/8)*10.5} r={3.2} color="#ce353b"/>)}<Print y={53} size={7}>MAX7219</Print></>):<g><rect x="-52" y="-52" width="104" height="104" rx="3" fill="#171b24" stroke="#5e6a78" strokeWidth="2"/>{Array.from({length:64},(_,i)=><LedDot key={i} x={-39+(i%8)*11} y={-39+Math.floor(i/8)*11} r={3.5} color="#e64144"/>)}</g>);break;
    case 'display-4digit':
      art=<g><rect x="-77" y="-35" width="154" height="70" rx="3" fill="#171921" stroke="#627080" strokeWidth="2"/><rect x="-72" y="-31" width="144" height="62" rx="1" fill="#2b0c17"/>{Array.from({length:4},(_,i)=><SevenDigit key={i} x={(i-1.5)*34} y={0} size={45}/>)}</g>;break;
    case 'display-ledbar':
      art=<g><rect x="-84" y="-17" width="168" height="34" rx="3" fill="#181d24" stroke="#667688" strokeWidth="2"/>{Array.from({length:10},(_,i)=><rect key={i} x={-77+i*15.6} y="-10" width="12.3" height="20" rx="1" fill={i<6?'#43bb55':i<8?'#ecbe35':'#e24a44'} opacity=".83" stroke="#263947"/>)}</g>;break;
    case 'driver-l298n':
      art=pcb('#c83236',145,95,<><rect x="-44" y="-20" width="57" height="40" rx="1.5" fill="#232a31" stroke="#8a9a9c"/>{Array.from({length:7},(_,i)=><rect key={i} x={-44+i*8} y="-27" width="4.5" height="54" fill="#424e5a" stroke="#16232e" strokeWidth=".5"/>)}<TerminalBlock x={48} y={-28} count={3}/><TerminalBlock x={48} y={24} count={3}/><Chip x={14} y={0} w={26} h={22} text="L298N"/><Print y={-39} size={9}>H-BRIDGE</Print><LedDot x={-60} y={30} on color="#2ddc69"/></>);break;
    case 'driver-uln2003':
      art=pcb('#2168af',122,77,<><Chip x={4} w={55} h={23} text="ULN2003"/>{Array.from({length:4},(_,i)=><LedDot key={i} x={-42+i*13} y={-22} r={4} color="#e64d4e"/>)}<rect x="33" y="-27" width="19" height="48" rx="3" fill="#f4f7f8" stroke="#9faeb6"/><Print x={41} y={0} size={7} color="#536977">MOTOR</Print><Print y={31} size={8}>STEPPER DRIVER</Print></>);break;
    case 'motor-28byj48':
      art=<g><circle r="34" fill="#b7c1ca" stroke="#697787" strokeWidth="2"/><circle r="29" fill="#d3dae0" stroke="#7a8792"/><circle r="22" fill="#a1afb9" stroke="#667783"/><circle r="8.4" fill="#e3e8eb" stroke="#7d8c97"/><circle r="3.2" fill="#626e78"/><Print y={19} size={7} color="#3e5262">28BYJ-48</Print></g>;break;
    case 'actuator-solenoid':
      art=<g><rect x="-40" y="-20" width="80" height="40" rx="9" fill="#363f45" stroke="#7b8794" strokeWidth="2"/>{Array.from({length:14},(_,i)=><rect key={i} x={-28+i*4.2} y="-17" width="2.8" height="34" fill={i%2?'#b46b2d':'#d88936'}/>)}<rect x="27" y="-9" width="37" height="18" fill="#c7d2d9" stroke="#718391"/><Print y={31} size={8} color="#5a6a77">SOLENOID</Print></g>;break;
    case 'power-buck':case 'power-boost':
      art=pcb(id==='power-buck'?'#146baf':'#174c86',122,74,<><Wheel x={-17} y={0} r={22} metallic={false}/><path d="M-29 -5Q-18 -17-6 -5M-29 2Q-18 -10-6 2M-29 8Q-18 -4-6 8" fill="none" stroke="#a16d2c" strokeWidth="2.6"/><Chip x={24} y={-11} w={31} text={id==='power-buck'?'LM2596':'BOOST'}/>{[-1,1].map((s,i)=><g key={i}><circle cx={s*43} cy="23" r="9" fill="#323a4b" stroke="#9caeb9"/><circle cx={s*43} cy="23" r="5.3" fill="#aebcc8"/></g>)}<Print y={-29} size={8}>{id==='power-buck'?'STEP-DOWN':'STEP-UP'}</Print></>);break;
    case 'power-bridge':
      art=<g><rect x="-34" y="-31" width="68" height="62" rx="4" fill="#222c34" stroke="#8694a1" strokeWidth="2"/><circle r="9" fill="#d4dce1" stroke="#8997a3"/><circle r="4.3" fill="#293845"/>{[['+',-23,-19],['−',23,-19],['~',-23,23],['~',23,23]].map(([t,x,y],i)=><Print key={i} x={Number(x)} y={Number(y)} size={12}>{String(t)}</Print>)}<Print y={-36} size={8} color="#495462">BRIDGE</Print></g>;break;
    case 'power-battery':
      art=<g><rect x="-73" y="-26" width="146" height="52" rx="9" fill="#252e39" stroke="#6d8290" strokeWidth="2.2"/><rect x="-57" y="-21" width="115" height="42" rx="18" fill="#1d8854" stroke="#0e4835" strokeWidth="2"/><rect x="-57" y="-21" width="24" height="42" rx="15" fill="#cad4d6"/><rect x="-3" y="-18" width="37" height="36" fill="#c8e4ca" opacity=".2"/><Print x={6} y={4} size={13}>18650</Print><Print x={-65} y={3} size={11} color="#e2b146">+</Print><Print x={65} y={3} size={11} color="#e2b146">−</Print></g>;break;
    case 'power-tp4056':
      art=pcb('#155ab0',117,49,<><rect x="-60" y="-10" width="20" height="20" rx="2" fill="#cad6df" stroke="#748ba0"/><rect x="-61" y="-6" width="12" height="12" rx="1" fill="#233648"/><Chip x={-6} w={26} h={17} text="TP4056"/><Chip x={27} y={-8} w={14} h={12} text="DW"/><LedDot x={25} y={15} r={3} color="#e94d52"/><LedDot x={36} y={15} r={3} color="#58b4ff"/><Print y={-18} size={8}>LI-ION CHARGER</Print></>);break;
    case 'instrument-scope':
      art=<g><rect x="-85" y="-53" width="170" height="106" rx="11" fill="#33414d" stroke="#869ba7" strokeWidth="2"/><rect x="-72" y="-41" width="116" height="70" rx="3" fill="#071b21" stroke="#688da0"/>{Array.from({length:8},(_,i)=><line key={i} x1={-72+i*16} x2={-72+i*16} y1="-41" y2="29" stroke="#1c5a52" strokeWidth=".6"/>)}<path d="M-67 -7H-50L-35 -24L-20 10L-4 -12L12 -4L23 -9H39" fill="none" stroke="#54eac0" strokeWidth="2.2"/><Wheel x={61} y={-17} r={10}/><Wheel x={61} y={16} r={10}/><Print y={44} size={9}>OSCILLOSCOPE</Print></g>;break;
    case 'instrument-generator':
      art=<g><rect x="-81" y="-48" width="162" height="96" rx="9" fill="#c0cad1" stroke="#738693" strokeWidth="2"/><rect x="-68" y="-35" width="105" height="49" rx="3" fill="#112d36"/><path d="M-60 -11Q-49 -37 -38 -11T-16 -11T6 -11T28 -11" fill="none" stroke="#7fead3" strokeWidth="2.2"/><Wheel x={57} y={-10} r={17}/><Print x={-14} y={33} size={9} color="#344957">FUNCTION GENERATOR</Print></g>;break;
    case 'instrument-meter':
      art=<g><rect x="-54" y="-83" width="108" height="166" rx="19" fill="#e7ad32" stroke="#7c5c21" strokeWidth="3"/><rect x="-42" y="-66" width="84" height="52" rx="3" fill="#bdd1ba" stroke="#6f815e"/><Print y={-32} size={22} color="#25352c">0.00</Print><Wheel x={0} y={15} r={25} metallic={false}/>{[-28,28].map((x,i)=><g key={i}><circle cx={x} cy="62" r="8" fill={i===0?'#c83837':'#242a32'} stroke="#e6dbbf" strokeWidth="2"/></g>)}<Print y={-73} size={9} color="#1e2b37">DMM</Print></g>;break;
    case 'instrument-logic':
      art=pcb('#252d36',155,58,<><Print y={-20} size={9}>LOGIC ANALYZER</Print>{Array.from({length:8},(_,i)=><g key={i}><LedDot x={-63+i*18} y={0} r={4.5} color="#50c98a"/><Print x={-63+i*18} y={19} size={7}>D{i}</Print></g>)}</>);break;
    case 'instrument-frequency':
      art=<g><rect x="-81" y="-40" width="162" height="80" rx="8" fill="#353e46" stroke="#81949f" strokeWidth="2"/><rect x="-70" y="-28" width="112" height="39" rx="4" fill="#101e25"/><Print x={-13} y={-4} size={23} color="#8eef88">0.000</Print><Wheel x={61} y={-7} r={11}/><Print y={30} size={8}>FREQUENCY · Hz</Print></g>;break;
    default:
      // New catalog entries inherit a recognizable named package from their
      // declared physical shape, rather than a featureless generic rectangle.
      art=spec.shape==='dip'?<Chip w={76} h={30} text={heading.slice(0,12)}/>:pcb('#19749c',83,58,<><Chip w={33} text={heading.slice(0,7)}/>{moduleMark(heading,24)}</>);
  }
  return <g transform={`translate(${center.x} ${center.y})`} data-component-model={id}>{art}</g>;
}

/** The 103 catalog choices share a renderer but never share a generic icon. */
export function PhysicalModel2D({part,center,pins,lit,selected,segments}:PhysicalModelProps) {
  const key=physical2DModelKey(part);
  if(isOffboardController(part))return <g data-physical-model={key}><Controller part={part} center={center} pins={pins}/></g>;
  if(part.kind==='module')return <g data-physical-model={key}><Module part={part} center={center} segments={segments}/></g>;
  const small=['resistor','diode','led','zener','ldr','thermistor','inductor','fuse','rgb-led'];
  if(small.includes(part.kind))return <g data-physical-model={key}><Discrete part={part} pins={pins} lit={lit}/></g>;
  return <g data-physical-model={key}><BaseDevice part={part} center={center} segments={segments}/>{selected&&<circle cx={center.x} cy={center.y} r="3" fill="#33a6f8" opacity=".65" pointerEvents="none"/>}</g>;
}
