import { useMemo, useState } from 'react';
import { Cable, CheckCircle2, CircleDashed, X, Info } from 'lucide-react';
import { useLab } from '@/store/lab';
import { displayPinLabel, getDisplayWiringGuides } from '@/circuit/display-guides';

/** Read-only pin-pair reference; highlight does not place or remove wiring. */
export function WiringGuidePanel({ onClose, left = 16 }: { onClose: () => void; left?: number }) {
  const parts = useLab(s => s.parts);
  const wires = useLab(s => s.wires);
  const selectedId = useLab(s => s.selectedId);
  const target = useLab(s => s.guideTarget);
  const setGuideTarget = useLab(s => s.setGuideTarget);
  const setTool = useLab(s => s.setTool);
  const [preferredDisplay, setPreferredDisplay] = useState<string | null>(null);
  const guides = useMemo(() => getDisplayWiringGuides(parts, wires), [parts, wires]);
  const selectedDisplay = parts.find(p => p.id === selectedId && (p.kind === 'lcd' || p.kind === 'oled' || p.kind === 'seven-segment'));
  const selected = guides.find(g => g.deviceId === preferredDisplay)
    ?? guides.find(g => g.deviceId === selectedDisplay?.id)
    ?? guides[0];
  const count = selected?.links.filter(l => l.connected).length ?? 0;
  return (
    <aside aria-label="Suggested wiring guide" className="lab-wiring-guide" style={{position:'absolute', left, top:82, width:320, maxWidth:'calc(100% - 32px)', maxHeight:'min(68vh,620px)', overflowY:'auto', pointerEvents:'auto', zIndex:90, background:'rgba(7,22,40,.97)', border:'1px solid rgba(34,211,238,.34)', borderRadius:16, boxShadow:'0 16px 60px rgba(0,0,0,.45)', color:'#e2e8f0', padding:15}}>
      <div style={{display:'flex', alignItems:'flex-start', gap:9}}>
        <span style={{padding:8, background:'rgba(34,211,238,.1)',borderRadius:9,color:'#67e8f9'}}><Cable size={18}/></span>
        <div style={{flex:1,minWidth:0}}><div style={{fontSize:14,fontWeight:800}}>Suggested wiring guide</div><div style={{fontSize:10,color:'#9db6d2',marginTop:4}}>Reference only — no automatic wiring.</div></div>
        <button type="button" onClick={() => {setGuideTarget(null);onClose();}} aria-label="Close wiring guide" style={{background:'rgba(255,255,255,.06)', border:'1px solid rgba(255,255,255,.12)', borderRadius:8, color:'#cbd5e1', padding:5,cursor:'pointer'}}><X size={16}/></button>
      </div>
      {!parts.some(p=>p.kind === 'mcu') && <p style={{fontSize:12, marginTop:16, lineHeight:1.5,color:'#fbbf24'}}>Add an Arduino/MCU component to begin. The guide works on your own circuits too.</p>}
      {parts.some(p=>p.kind === 'mcu') && guides.length === 0 && <p style={{fontSize:12, marginTop:16, lineHeight:1.5,color:'#fbbf24'}}>Add a 16×2 LCD, I²C OLED, or 7-segment display to see pin-by-pin connections. No wires will be added automatically.</p>}
      {selected && <>
        {guides.length > 1 && <label style={{display:'block',fontSize:10,color:'#9fb5d0',marginTop:14}}>Display
          <select value={selected.id} onChange={e => {setPreferredDisplay(guides.find(g=>g.id===e.target.value)?.deviceId ?? null);setGuideTarget(null);}} style={{display:'block',width:'100%',marginTop:5,padding:9,borderRadius:8,background:'#10253b',color:'#e2e8f0',border:'1px solid #315575'}}>
            {guides.map(g=><option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </label>}
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between',gap:8,marginTop:14}}><div style={{fontWeight:700,fontSize:12}}>{selected.title}</div><div style={{fontSize:10,color:count===selected.links.length?'#86efac':'#93c5fd'}}>{count}/{selected.links.length} connected</div></div>
        <div style={{height:5,marginTop:9,borderRadius:6,overflow:'hidden',background:'#153047'}}><div style={{width:`${selected.links.length?100*count/selected.links.length:0}%`,height:'100%',background:'#2dd4bf',transition:'width .2s'}}/></div>
        <div style={{marginTop:12,display:'grid',gap:6}}>
          {selected.links.map(link => {
            const active = target?.a===link.fromHole && target?.b===link.toHole;
            return <button type="button" key={link.id}
              onClick={()=>setGuideTarget(active?null:{a:link.fromHole,b:link.toHole})}
              aria-pressed={active}
              title="Highlight both endpoints in the 3D breadboard. Does not connect them."
              style={{display:'grid', gridTemplateColumns:'16px minmax(0,1fr)',alignItems:'start',gap:8,textAlign:'left',cursor:'pointer',borderRadius:9,padding:9,background:active?'rgba(34,211,238,.14)':'rgba(255,255,255,.04)',border:active?'1px solid rgba(34,211,238,.65)':'1px solid rgba(148,163,184,.12)',color:'#dbeafe'}}>
              {link.connected?<CheckCircle2 size={15} color="#4ade80"/>:<CircleDashed size={15} color="#fbbf24"/>}
              <span style={{display:'grid',gap:3,minWidth:0}}>
                <span style={{fontSize:11,fontWeight:700}}>{link.description}</span>
                <span style={{fontSize:10,color:'#a8bdd4',lineHeight:1.4}}>{displayPinLabel('mcu',link.fromPin)} → {displayPinLabel(selected.deviceKind,link.toPin)}</span>
                <span style={{fontSize:10,color:'#67e8f9',fontFamily:'ui-monospace,monospace'}}>{link.fromHole} → {link.toHole} · {link.connected?'Connected':'Needs jumper'}</span>
              </span>
            </button>;
          })}
        </div>
        <button type="button" onClick={()=>setTool('wire')} style={{width:'100%',padding:'10px',marginTop:12,borderRadius:9,border:'1px solid rgba(56,189,248,.5)',background:'rgba(14,116,198,.2)',color:'#bae6fd',fontSize:12,fontWeight:700,cursor:'pointer'}}>Use Wire tool — click two holes to connect</button>
        <div style={{marginTop:12,padding:10,borderRadius:10,background:'rgba(251,191,36,.06)',border:'1px solid rgba(251,191,36,.18)',display:'grid',gap:7}}>
          <div style={{fontSize:10,fontWeight:700,color:'#fcd34d',display:'flex',gap:6,alignItems:'center'}}><Info size={13}/> Physical wiring notes</div>
          {selected.notes.map(note=><p key={note} style={{fontSize:10,margin:0,color:'#cbd5e1',lineHeight:1.55}}>{note}</p>)}
        </div>
      </>}
    </aside>
  );
}
