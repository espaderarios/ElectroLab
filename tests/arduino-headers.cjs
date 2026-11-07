/** Wiring guide and new premade circuit regressions. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const resolveOriginal = Module._resolveFilename;
const loadOriginal = Module._load;
let seq = 0;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) return path.join(root, 'src', name.slice(2)) + '.ts';
  return resolveOriginal.call(this, name, parent, ...rest);
};
Module._load = function(name, parent, ...rest) {
  if (name === '@/lib/utils') return {uid: prefix=>`${prefix}_${++seq}`};
  if (name === 'zustand') return {create: cb => {const build=fn=>{let state;const set=partial=>{state={...state,...(typeof partial==='function'?partial(state):partial)}};const get=()=>state;state=fn(set,get);return {getState:get}};return cb?build(cb):build;}};
  if (name === 'zustand/middleware') return {persist: fn => fn};
  return loadOriginal.call(this, name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename,'utf8'), {fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(out.diagnostics?.filter(x=>x.category === ts.DiagnosticCategory.Error).length??0, 0,`Syntax: ${filename}`);
  module._compile(out.outputText, filename);
};
const {circuitArduinoLcd,circuitArduinoOled,circuitArduinoSevenSegment}=require('../src/circuit/display-examples.ts');
const {upgradeMcuHeaders,terminalPosition,mcuTerminalId,parseMcuTerminal}=require('../src/circuit/mcu-headers.ts');
const {getDisplayWiringGuides}=require('../src/circuit/display-guides.ts');
const {setBoardPreset,getAllHoles,holeStrip}=require('../src/circuit/breadboard.ts');
const {planWireRoutes}=require('../src/circuit/wire-routing.ts');
const {simulate}=require('../src/circuit/simulate.ts');
const {useLab}=require('../src/store/lab.ts');
setBoardPreset('standard-830');
for(const [name,make] of [['LCD',circuitArduinoLcd],['OLED',circuitArduinoOled],['7SEG',circuitArduinoSevenSegment]]) {
  const legacy=make();
  const migrated=upgradeMcuHeaders(legacy.parts, legacy.wires);
  const mcu=migrated.parts.find(p=>p.kind==='mcu');
  assert(mcu,`${name} includes MCU`);
  assert(mcu.props.headerAnchor,`${name} has offboard anchor`);
  assert(Object.entries(mcu.pins).every(([pin,h])=>h===mcuTerminalId(mcu.id,pin)));
  for(const w of migrated.wires) {
    assert(w.a.startsWith('mcu:') || w.b.startsWith('mcu:') || (w.a===legacy.wires.find(old=>old.id===w.id)?.a && w.b===legacy.wires.find(old=>old.id===w.id)?.b),`${name} wiring converted`);
    const a=terminalPosition(w.a,migrated.parts),b=terminalPosition(w.b,migrated.parts);
    assert([...a,...b].every(Number.isFinite),`${name} ${w.id} physical wire endpoints`);
  }
  assert.notEqual(holeStrip(mcu.pins.d2),holeStrip('F34'),`${name} header pin is NOT a phantom breadboard strip`);
  assert.notEqual(holeStrip(mcu.pins.d2),holeStrip(mcu.pins.d3),`${name} independent headers`);
  const routes=planWireRoutes(migrated.wires,h=>terminalPosition(h,migrated.parts),migrated.parts);
  assert.equal(routes.length,migrated.wires.length);
  assert.equal(routes.filter(r=>r.blocked).length,0,`${name} no blocked wire`);
  const originalSim=simulate({...legacy, powerOn:true});
  const afterSim=simulate({...legacy,parts:migrated.parts,wires:migrated.wires,powerOn:true});
  assert.equal(afterSim.shortCircuit,originalSim.shortCircuit,`${name} no new short`);
  assert.equal(Boolean(Object.values(afterSim.mcus??{})[0]?.powered),true,`${name} Arduino powered through header`);
  if(name==='LCD') {
    assert.equal(afterSim.lcdPowered,true,`${name} LCD still powers`);
    assert.match(afterSim.lcdText,/ElectroLab/);
    assert(getDisplayWiringGuides(migrated.parts,migrated.wires)[0].links.every(l=>l.connected));
  }
  if(name==='OLED') {
    assert.equal(afterSim.oledPowered,true,`${name} OLED still powers`);
    assert.match(afterSim.oledText,/ElectroLab/);
    assert(getDisplayWiringGuides(migrated.parts,migrated.wires)[0].links.every(l=>l.connected));
  }
  if(name==='7SEG'){
    const seg=Object.values(afterSim.sevenSegments??{})[0];
    assert(seg && seg.segments.every(Boolean),`${name} segment outputs active`);
  }
  const same=upgradeMcuHeaders(migrated.parts,migrated.wires);
  assert.deepEqual(same.parts.map(p=>p.pins),migrated.parts.map(p=>p.pins),`${name} migration idempotent`);
  console.log(`${name}: ${migrated.wires.length} real wires routed to clickable UNO sockets, simulation preserved: PASS`);
}
const state=()=>useLab.getState();
state().loadCircuit({boardId:'standard-830',psuVoltage:5,psuPositive:'tp5',psuNegative:'tn5',parts:[],wires:[]});
state().setTool('mcu');state().placePartAt('mcu','F24');
let mcu=state().parts.find(p=>p.kind==='mcu');
assert(mcu && mcu.props.headerAnchor==='F24');
const end=mcu.pins.d13;
const p=terminalPosition(end,state().parts);
assert(p[2]<-2.5,'header physically outside breadboard');
state().setTool('wire');state().clickHole(end);state().clickHole('A13');
assert.equal(state().wires.length,1,'wire tool connects D13 to a breadboard hole');
assert.equal(state().wires[0].a,end);
assert.equal(state().wires[0].b,'A13');
state().undo();assert.equal(state().wires.length,0);
state().redo();assert.equal(state().wires.length,1);
const anchor=state().parts[0].props.headerAnchor;
state().setTool('select');state().select(mcu.id);state().moveSelectedTo('F26');
assert.notEqual(state().parts[0].props.headerAnchor,anchor,'Arduino can move without losing its wire terminal identity');
assert.equal(state().wires[0].a,end);
assert(!getAllHoles().includes(end),'header is NOT in breadboard holes');
// Saving and reopening the project retains the independent header contact and wiring.
const saved=state().getCircuitSnapshot();
state().loadCircuit(saved);
assert.equal(state().wires[0].a,end);
assert.equal(state().parts[0].props.headerAnchor,'F26');
state().setTool('select');state().select(mcu.id);state().deleteSelected();
assert.equal(state().parts.length,0,'delete MCU');
assert.equal(state().wires.length,0,'attached MCU wires removed instead of left dangling');
state().undo();
assert.equal(state().parts.length,1,'undo restores MCU');
assert.equal(state().wires.length,1,'undo restores attached wires');
const files=['src/circuit-lab/parts-3d.tsx','src/circuit-lab/scene.tsx','src/circuit-lab/overlay.tsx'];
for(const file of files){
  const code=fs.readFileSync(path.join(root,file),'utf8');
  const syntax=ts.transpileModule(code,{fileName:file,compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
  assert(!syntax.diagnostics?.some(d=>d.category===ts.DiagnosticCategory.Error),`${file} JSX parses`);
}
console.log('New Arduino, D13 click-to-wire, Undo/Redo, independent nets, moved PCB and JSX syntax: PASS');
