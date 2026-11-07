/** Read-only simulator-event console. This is deliberately not a fake USB serial
 * port: Serial.print()/Serial.read() aren't implemented by the MCU interpreter. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Clipboard, Monitor, Trash2 } from 'lucide-react';
import { useLab } from '@/store/lab';

type EventRow = {id:number;time:string;text:string};

function timeString() {
  return new Date().toLocaleTimeString(undefined, {hour12:false});
}

export function SimulationConsole({fullAdder=false}: {fullAdder?:boolean}) {
  const parts = useLab(s=>s.parts);
  const sim = useLab(s=>s.sim);
  const powerOn = useLab(s=>s.powerOn);
  const [rows, setRows] = useState<EventRow[]>([]);
  const lastSignature = useRef<string>('');
  const nextId = useRef(0);
  const logRef = useRef<HTMLDivElement|null>(null);
  const switchParts = useMemo(()=>parts.filter(p=>p.kind==='switch'),[parts]);
  const inputLabel = (name:string,index:number) => {
    const label = name.toLowerCase();
    if(label.includes('cin'))return 'Cin';
    if(/\ba\b/.test(label))return 'A';
    if(/\bb\b/.test(label))return 'B';
    return `IN${index+1}`;
  };
  const switches = switchParts.map((p,i)=>({name:inputLabel(p.props.label??'',i), value:Number(Boolean(p.props.closed))}));
  const a = switches.find(s=>s.name==='A')?.value ?? 0;
  const b = switches.find(s=>s.name==='B')?.value ?? 0;
  const cin = switches.find(s=>s.name==='Cin')?.value ?? 0;
  const display = Object.values(sim.sevenSegments??{})[0];
  const sum = a ^ b ^ cin;
  const carry = Number(a+b+cin>=2);
  const mcu = Object.values(sim.mcus??{})[0];
  const mcuState = mcu ? `${mcu.powered?'powered':'off'}${mcu.error?` · ${mcu.error}`:''}` : '';
  const signature = JSON.stringify({powerOn, switches, display:display?.digit, mcuState, short:sim.shortCircuit});

  useEffect(()=>{
    if(lastSignature.current===signature)return;
    lastSignature.current=signature;
    const messages:string[]=[];
    if(!powerOn) messages.push('Power OFF — simulation paused');
    else if(fullAdder && switches.length>=3)
      messages.push(`A=${a} B=${b} Cin=${cin}  →  S=${sum} Cout=${carry} (Dec: ${display?.digit??sum+2*carry})`);
    else if(display?.digit !== undefined) messages.push(`7-segment output: ${display.digit}`);
    else if(mcu) messages.push(`Arduino ${mcuState || 'status unknown'} · output pins: ${Object.values(mcu.digital??{}).filter(Boolean).length} HIGH`);
    else messages.push(`Simulation running · ${parts.length} components`);
    if(sim.shortCircuit) messages.push('WARNING: short circuit detected');
    setRows(previous=>[...previous,...messages.map(text=>({id:nextId.current++,time:timeString(),text}))].slice(-80));
  },[signature]);

  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[rows]);
  return <section className="editor-simulation-console" aria-label="Simulation event console">
    <div className="editor-console-heading">
      <strong><Monitor size={15}/> Simulation Console</strong>
      <div className="editor-console-actions">
        <span className={`editor-console-dot ${powerOn?'running':''}`}/>
        <span>{powerOn?'Live':'Paused'}</span>
        <button type="button" title="Copy simulation log" aria-label="Copy simulation log" onClick={()=>{void navigator.clipboard?.writeText(rows.map(row=>`[${row.time}] ${row.text}`).join('\n'));}}><Clipboard size={14}/></button>
        <button type="button" title="Clear simulation log" aria-label="Clear simulation log" onClick={()=>setRows([])}><Trash2 size={14}/></button>
      </div>
    </div>
    <div className="editor-console-log" ref={logRef} role="log" aria-live="polite">
      <div className="editor-console-preamble">// ElectroLab simulator events — not a physical serial port</div>
      {rows.length===0 && <p>Turn power on or change an input to see simulator activity.</p>}
      {rows.map(row=><div className="editor-console-line" key={row.id}><span>[{row.time}]</span> {row.text}</div>)}
    </div>
    <div className="editor-console-footnote">Serial.print / Serial.println are not yet emulated. This panel reports observed circuit states.</div>
  </section>;
}
