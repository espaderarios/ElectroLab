/** Studio properties rail. The detailed inspector is portalled from LabOverlay,
 * so existing part editing, pin reassignment and wiring keep their real logic. */
import { useState } from 'react';
import { Cable, ChevronLeft, ChevronRight, Cpu, Gauge, SlidersHorizontal, X, Zap } from 'lucide-react';
import { useLab } from '@/store/lab';
import { WIRE_HEX, type WireColor, type WireStyle } from '@/circuit/types';

type StudioTab = 'component' | 'wiring' | 'simulation';

export function StudioProperties({open, onToggle}: {open:boolean;onToggle:()=>void}) {
  const [tab, setTab] = useState<StudioTab>('component');
  const parts = useLab(s=>s.parts);
  const wires = useLab(s=>s.wires);
  const selectedId = useLab(s=>s.selectedId);
  const wireColor = useLab(s=>s.wireColor);
  const wireStyle = useLab(s=>s.wireStyle);
  const powerOn = useLab(s=>s.powerOn);
  const sim = useLab(s=>s.sim);
  const selected = parts.find(p=>p.id===selectedId);
  const wire = wires.find(w=>w.id===selectedId);
  const powerState = powerOn ? 'Running' : 'Stopped';

  return <aside className={`editor-studio-properties ${open?'is-open':'is-closed'}`} aria-label="Properties panel">
    <div className="editor-properties-header">
      <div className="editor-properties-title"><SlidersHorizontal size={18}/> <strong>Properties</strong></div>
      <button type="button" aria-label={open?'Hide properties panel':'Show properties panel'} title={open?'Hide properties panel':'Show properties panel'} onClick={onToggle}>
        {open?<X size={18}/>:<ChevronLeft size={18}/>}
      </button>
    </div>
    <div className={`editor-properties-contents ${open?'':'is-hidden'}`} aria-hidden={!open}>
      <div className="editor-properties-tabs" role="tablist" aria-label="Properties categories">
        {(['component','wiring','simulation'] as const).map(name=><button key={name} type="button" role="tab" aria-selected={tab===name} className={tab===name?'active':''} onClick={()=>setTab(name)}>{name[0].toUpperCase()+name.slice(1)}</button>)}
      </div>
      <div className="editor-properties-subject">
        <span className="editor-properties-subject-icon"><Cpu size={22}/></span>
        <div><strong>{selected?.props.label ?? (selected?selected.kind.toUpperCase():wire?'Selected wire':'No component selected')}</strong>
          <small>{selected?`${selected.kind} · ${Object.keys(selected.pins).length} terminals`:wire?`${wire.a} → ${wire.b}`:'Click a component in the 3D scene to inspect and edit it.'}</small>
        </div>
      </div>
      <div className={`editor-properties-scroll ${tab==='component'?'inspector-tab':''}`}>
        {/* The full original inspector is moved here with createPortal, not duplicated.
            Keep its DOM node mounted across tab changes so editing stays intact. */}
        <div id="electrolab-studio-inspector" className={tab==='component'?'':'editor-inspector-hidden'} />
        {tab==='component' && !selected && !wire && <div className="editor-properties-empty"><SlidersHorizontal size={26}/><strong>Select a part</strong><span>Click a resistor, Arduino, display or wire to open its real editable controls. Pin connection buttons remain functional.</span></div>}
        {tab==='wiring' && <div className="editor-properties-options">
          <h3><Cable size={16}/> Wiring setup</h3>
          <p>Choose a wire style and insulation color. Click Wire, then two terminals on the breadboard or Arduino.</p>
          <div className="editor-properties-option-caption">Style</div>
          <div className="editor-properties-segments">{(['solid','jumper'] as WireStyle[]).map(style=><button type="button" key={style} className={wireStyle===style?'active':''} aria-pressed={wireStyle===style} onClick={()=>useLab.getState().setWireStyle(style)}>{style==='solid'?'Solid':'Jumper'}</button>)}</div>
          <div className="editor-properties-option-caption">Color</div>
          <div className="editor-properties-color-row">{(Object.keys(WIRE_HEX) as WireColor[]).map(color=><button key={color} type="button" aria-label={`${color} wire`} title={`${color} wire`} aria-pressed={wireColor===color} className={wireColor===color?'active':''} style={{background:WIRE_HEX[color]}} onClick={()=>useLab.getState().setWireColor(color)}/>)}</div>
          <button type="button" className="editor-properties-primary" onClick={()=>useLab.getState().setTool('wire')}><Cable size={15}/> Start wiring</button>
          <div className="editor-properties-note">{wires.length} editable wires on this board.</div>
        </div>}
        {tab==='simulation' && <div className="editor-properties-options">
          <h3><Gauge size={16}/> Simulation status</h3>
          <div className="editor-properties-stat"><span>Power</span><strong>{powerState}</strong></div>
          <div className="editor-properties-stat"><span>Supply current</span><strong>{(sim.supplyCurrent*1000).toFixed(2)} mA</strong></div>
          <div className="editor-properties-stat"><span>Parts</span><strong>{parts.length}</strong></div>
          <div className="editor-properties-stat"><span>Connections</span><strong>{wires.length}</strong></div>
          {sim.shortCircuit && <p role="alert">Short circuit detected. Check the connections.</p>}
          <button type="button" className="editor-properties-primary" onClick={()=>useLab.getState().togglePower()}><Zap size={15}/>{powerOn?'Turn power off':'Turn power on'}</button>
        </div>}
      </div>
    </div>
    {!open && <button type="button" className="editor-properties-reopen" title="Expand properties" aria-label="Expand properties" onClick={onToggle}><ChevronRight size={16}/></button>}
  </aside>;
}
