/** Editor-integrated power + diagnostics dock. No hidden electrical wiring. */
import { useEffect, useMemo, useState } from 'react';
import { Activity, Cable, ChevronDown, ChevronUp, Lightbulb, Monitor, Power, Table2, Move, Gauge } from 'lucide-react';
import { useLab } from '@/store/lab';
import { getDisplayWiringGuides, displayPinLabel } from '@/circuit/display-guides';
import type { PlacedPart } from '@/circuit/types';

type Tab = 'monitor' | 'guide' | 'truth';

type Props = {
  projectId?: string;
  is3D: boolean;
  partDragEnabled: boolean;
  setPartDragEnabled: (enabled: boolean) => void;
  onStartWiring: () => void;
  performanceMode: boolean;
  setPerformanceMode: (enabled: boolean) => void;
};

const isAdder = (projectId?: string) => projectId === 'half-adder' || projectId === 'full-adder';
const logicRows = (full: boolean) => Array.from({length: full ? 8 : 4}, (_, n) => {
  const a = Number(Boolean(n & (full ? 4 : 2)));
  const b = Number(Boolean(n & (full ? 2 : 1)));
  const cin = full ? Number(Boolean(n & 1)) : 0;
  const sum = a ^ b ^ cin;
  const carry = Number(a + b + cin >= 2);
  return {a,b,cin,sum,carry,digit:(carry << 1) | sum};
});

function formatCurrent(current: number) {
  const n = Math.abs(current || 0);
  if (n < 1e-9) return '0.0 µA';
  if (n < 0.001) return `${(n * 1e6).toFixed(1)} µA`;
  if (n < 1) return `${(n * 1000).toFixed(2)} mA`;
  return `${n.toFixed(2)} A`;
}

function switchName(part: PlacedPart, index: number) {
  const name = (part.props.label ?? '').toLowerCase();
  if (/cin/.test(name)) return 'Cin';
  const match = name.match(/\b([ab])\b/);
  return match ? match[1].toUpperCase() : String.fromCharCode(65 + index);
}

/** The collapsed dock unsubscribes from simulation details and keeps the 3D canvas large. */
const DOCK_STORAGE_KEY = 'electrolab-workbench-dock-expanded-v1';

export function WorkbenchDock(props: Props) {
  const [expanded, setExpanded] = useState(() => {
    try { return window.localStorage.getItem(DOCK_STORAGE_KEY) === 'true'; }
    catch { return false; }
  });
  const powerOn = useLab(s => s.powerOn);

  useEffect(() => {
    try { window.localStorage.setItem(DOCK_STORAGE_KEY, String(expanded)); } catch { /* private browsing */ }
    if (!expanded) useLab.getState().setGuideTarget(null);
  }, [expanded]);

  // Alt+B toggles the dock, unless the user is editing text.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.key.toLowerCase() !== 'b' ||
          ['INPUT','TEXTAREA','SELECT'].includes(target?.tagName ?? '') || target?.isContentEditable) return;
      event.preventDefault();
      setExpanded(value => !value);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return <section className={`editor-bench-dock ${expanded ? 'expanded' : 'collapsed'}`} aria-label="Power and circuit diagnostics">
    {expanded && <div id="editor-workbench-controls"><WorkbenchDockContent {...props}/></div>}
    <div className="editor-dock-handle-row">
      <button type="button" className="editor-dock-handle" aria-label={expanded ? 'Hide bottom workbench controls' : 'Show bottom workbench controls'}
        aria-expanded={expanded} title="Toggle bottom controls (Alt+B)" onClick={() => setExpanded(value => !value)}>
        {expanded ? <ChevronDown size={17}/> : <ChevronUp size={17}/>}
        <span>{expanded ? 'Hide bottom controls' : 'Show power & monitor'}</span>
        {!expanded && <span className={`editor-dock-power-status ${powerOn ? 'on' : ''}`}>Power {powerOn ? 'ON' : 'OFF'}</span>}
      </button>
    </div>
  </section>;
}

function WorkbenchDockContent({projectId, is3D, partDragEnabled, setPartDragEnabled, onStartWiring, performanceMode, setPerformanceMode}: Props) {
  const [tab, setTab] = useState<Tab>('monitor');
  const [selectedGuide, setSelectedGuide] = useState(0);
  const parts = useLab(s => s.parts);
  const wires = useLab(s => s.wires);
  const sim = useLab(s => s.sim);
  const powerOn = useLab(s => s.powerOn);
  const voltage = useLab(s => s.psuVoltage);
  const guides = useMemo(() => getDisplayWiringGuides(parts, wires), [parts, wires]);
  const guide = guides[Math.min(selectedGuide, Math.max(0,guides.length-1))];
  const switches = parts.filter(p => p.kind === 'switch' && (p.props.switchType ?? 'spst') === 'spst');
  const leds = parts.filter(p => p.kind === 'led');
  const adder = isAdder(projectId);
  const fullAdder = projectId === 'full-adder';
  const switchState = (name: string) => {
    const match = switches.find((p,i) => switchName(p,i).toLowerCase() === name.toLowerCase());
    return Number(Boolean(match?.props.closed));
  };
  const a = switchState('A'), b = switchState('B'), cin = fullAdder ? switchState('Cin') : 0;
  const segments = Object.values(sim.sevenSegments ?? {});
  const activeOutputs = leds.filter(p => /sum|carry/i.test(p.props.label ?? ''));
  const outputLed = (name: 'sum' | 'carry') => activeOutputs.find(p => (p.props.label ?? '').toLowerCase().includes(name));
  const showWarnings = Boolean(sim.shortCircuit || sim.error || sim.warnings?.length);

  return <>
    <div className="editor-bench-power" role="group" aria-label="Power supply controls">
      <div className="editor-power-actions">
        <button type="button" className={`editor-power-button on ${powerOn ? 'is-on' : ''}`} aria-pressed={powerOn} onClick={() => {if(!useLab.getState().powerOn) useLab.getState().togglePower();}}><Power size={17}/> Power On</button>
        <button type="button" className={`editor-power-button off ${!powerOn ? 'is-off' : ''}`} aria-pressed={!powerOn} onClick={() => {if(useLab.getState().powerOn) useLab.getState().togglePower();}}><Power size={17}/> Power Off</button>
      </div>
      <div className="editor-power-separator"/>
      <label className="editor-power-voltage" title="Bench power supply voltage"><span>V</span><input type="number" min={0} max={24} step={0.1} aria-label="Power supply voltage" value={voltage} onChange={e => useLab.getState().setVoltage(Number(e.target.value) || 0)}/><span className="editor-power-unit">V</span></label>
      <div className="editor-power-current" title="Current drawn from simulated power supply"><Activity size={16}/><span>I = {formatCurrent(sim.supplyCurrent)}</span></div>
      {showWarnings && <span className="editor-power-warning" title={sim.error || sim.warnings?.[0] || 'Simulation warning'}>Check wiring</span>}
      <div className="editor-bench-spacer"/>
      <button type="button" className={`editor-quality-switch ${performanceMode ? 'active' : ''}`} disabled={!is3D} aria-pressed={performanceMode} aria-label="Fast 3D mode" title={performanceMode ? 'Fast 3D is enabled: reduced rendering cost. Click for detailed rendering.' : 'Detailed rendering is enabled. Click for faster 3D.'} onClick={() => setPerformanceMode(!performanceMode)}><Gauge size={16}/> <span>{performanceMode ? 'Fast 3D' : 'Detail 3D'}</span></button>
      <button type="button" className={`editor-bench-drag ${partDragEnabled ? 'active':''}`} aria-pressed={partDragEnabled} disabled={!is3D} onClick={() => setPartDragEnabled(!partDragEnabled)} title="Drag placed parts directly in 3D"><Move size={16}/><span>3D Drag</span><span className="editor-mini-switch" aria-hidden="true"/></button>
    </div>
    <div className="editor-diagnostics">
      <div className="editor-diagnostics-tabs" role="tablist" aria-label="Circuit information">
        <button type="button" role="tab" aria-selected={tab==='monitor'} className={tab === 'monitor' ? 'active' : ''} onClick={() => {setTab('monitor');useLab.getState().setGuideTarget(null);}}><Monitor size={16}/> Monitor</button>
        <button type="button" role="tab" aria-selected={tab==='guide'} className={tab === 'guide' ? 'active' : ''} onClick={() => setTab('guide')}><Cable size={16}/> Wiring Guide</button>
        <button type="button" role="tab" aria-selected={tab==='truth'} className={tab === 'truth' ? 'active' : ''} onClick={() => {setTab('truth');useLab.getState().setGuideTarget(null);}}><Table2 size={16}/> Truth Table</button>
      </div>
      <div className="editor-diagnostics-body" role="tabpanel">
        {tab === 'monitor' && <div className="editor-monitor-grid">
          <section className="editor-monitor-section">
            <h3>Outputs {adder && <span>({fullAdder ? 'Full Adder' : 'Half Adder'})</span>}</h3>
            {activeOutputs.length ? <div className="editor-output-pills">{(['sum','carry'] as const).map(name => {
              const part = outputLed(name);
              const lit = Boolean(part && powerOn && sim.leds[part.id]?.on);
              return <div className="editor-output-pill" key={name} title={`${name.toUpperCase()} observed from the simulated LED`}><span className={`editor-output-led ${lit ? (name === 'carry' ? 'red-lit' : 'green-lit') : ''}`}/><span>{name === 'sum' ? 'Sum (S)' : 'Carry (C)'}</span></div>;
            })}</div> : <div className="editor-readouts">{segments.length ? <>7-segment: <strong>{segments[0].digit ?? '—'}</strong></> : sim.lcdPowered ? <>LCD: <strong>{sim.lcdText?.replace(/\n/g,' · ') || 'Ready'}</strong></> : sim.oledPowered ? <>OLED: <strong>{sim.oledText?.replace(/\n/g,' · ') || 'Ready'}</strong></> : <>No digital outputs in this circuit.</>}</div>}
          </section>
          <section className="editor-monitor-section">
            <h3>Input switches</h3>
            {switches.length ? <div className="editor-input-pills">{switches.slice(0,5).map((p,i) => <label key={p.id} className="editor-input-pill" title={`Toggle ${p.props.label ?? switchName(p,i)} in the circuit`}><span>{switchName(p,i)}</span><input type="checkbox" checked={Boolean(p.props.closed)} onChange={() => useLab.getState().toggleSwitch(p.id)}/><span className="editor-toggle-visual"/></label>)}</div> : <p className="editor-diagnostics-empty">Add a switch to control an input.</p>}
          </section>
          <section className="editor-monitor-section editor-monitor-info">
            <h3>Circuit: {adder ? (fullAdder ? 'Full Adder' : 'Half Adder') : 'Workbench'}</h3>
            {adder ? <p>{fullAdder ? 'Sum = A ⊕ B ⊕ Cin; Carry = AB + Cin(A ⊕ B). A 7-segment decoder converts (Carry, Sum) into decimal 0–3 for a complete visual demonstration.' : '74HC86 (XOR) drives Sum and 74HC08 (AND) drives Carry.'} {fullAdder ? 'The 7-segment can show digits 0–9, but this single Full Adder produces only 0–3. The display and truth table update live.' : 'Output lights above show the simulated circuit.'}</p> : <p>{powerOn ? 'Power is enabled.' : 'Power is off.'} {parts.length} components and {wires.length} editable wires. Select a component to inspect its properties.</p>}
          </section>
        </div>}
        {tab === 'guide' && <div className="editor-guide-content">
          {guide ? <>
            {guides.length > 1 && <label className="editor-guide-select">Display <select value={selectedGuide} onChange={e=>setSelectedGuide(Number(e.target.value))}>{guides.map((g,i)=><option value={i} key={g.id}>{g.title}</option>)}</select></label>}
            <div className="editor-guide-header"><strong>{guide.title}</strong><span>{guide.links.filter(x=>x.connected).length}/{guide.links.length} connected</span></div>
            <div className="editor-guide-links">{guide.links.map(link => <button type="button" key={link.id} className={link.connected?'connected':''} onClick={() => useLab.getState().setGuideTarget({a:link.fromHole,b:link.toHole})} title="Highlight both breadboard endpoints; doesn't add wires"><span>{link.connected ? '✓' : '○'} {link.description}</span><small>{displayPinLabel('mcu',link.fromPin)} → {displayPinLabel(guide.deviceKind,link.toPin)}</small></button>)}</div>
            <p className="editor-guide-note">Choose any connection to highlight its endpoints. Wires are never added automatically.</p>
          </> : <div className="editor-guide-empty"><Cable size={20}/><div><strong>{adder ? 'Adder wiring reference' : 'Connect components with Wire mode'}</strong><p>{adder ? (fullAdder ? 'For a full adder, cascade two XOR gates to generate SUM, use two AND gates plus one OR gate for CARRY, then decode the (Carry, Sum) result onto the 7-segment display.' : 'For a half adder, connect inputs A and B to the first gates of both the 74HC86 XOR and 74HC08 AND.') : 'Select Wire and click two breadboard holes. Arduino display guides appear here when an Arduino and display are present.'} {adder && `${fullAdder ? 'Power each logic IC at pin 14 (+5 V) and pin 7 (GND). The 7-segment can display 0–9 in general, but a one-bit Full Adder can only generate 0–3. This is a simplified simulation: real LED segments require separate current-limiting resistors.' : 'Power each logic IC at pin 14 (+5 V) and pin 7 (GND). Use current-limiting resistors for both output LEDs.'} ${wires.length} editable wires are in this circuit.`}</p></div><button type="button" onClick={() => {onStartWiring();useLab.getState().setTool('wire');}}>Start wiring</button></div>}
        </div>}
        {tab === 'truth' && (adder ? <div className="editor-truth-wrap"><div><strong>{fullAdder?'Full Adder':'Half Adder'} truth table</strong><p>The active row follows the current switch positions. Values represent expected Boolean outputs.</p></div><table className="editor-truth-table"><thead><tr><th>A</th><th>B</th>{fullAdder && <th>Cin</th>}<th>Sum</th><th>Carry</th>{fullAdder && <th>Digit</th>}</tr></thead><tbody>{logicRows(fullAdder).map((row,i) => <tr key={i} className={row.a===a&&row.b===b&&row.cin===cin?'active':''}><td>{row.a}</td><td>{row.b}</td>{fullAdder&&<td>{row.cin}</td>}<td>{row.sum}</td><td>{row.carry}</td>{fullAdder&&<td>{row.digit}</td>}</tr>)}</tbody></table></div> : <div className="editor-guide-empty"><Lightbulb size={20}/><div><strong>Logic truth tables</strong><p>Open the premade Half Adder or Full Adder circuit to compare its Boolean input combinations. This project is currently a general circuit.</p></div></div>)}
      </div>
    </div>
  </>;
}
