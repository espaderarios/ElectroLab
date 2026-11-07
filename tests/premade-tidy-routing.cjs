/** Regression: globally tidied premades, locked routes, no electrical changes. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const origResolve = Module._resolveFilename;
const origLoad = Module._load;
let seq = 0;
Module._resolveFilename = function(name,parent,...rest){
  if(name.startsWith('@/')) return path.join(root,'src',name.slice(2))+'.ts';
  return origResolve.call(this,name,parent,...rest);
};
Module._load = function(name,parent,...rest){
  if(name === '@/lib/utils') return {uid: n=>`${n}_${++seq}`};
  if(name === 'zustand') return {create: cb => {const build = f => {
    let state; const set=u=>{state={...state,...(typeof u==='function'?u(state):u)}};
    const get=()=>state; state=f(set,get); return {getState:get};
  }; return cb?build(cb):build;}};
  if(name==='zustand/middleware') return {persist:f=>f};
  return origLoad.call(this,name,parent,...rest);
};
require.extensions['.ts'] = (m,filename)=>{
  const out=ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,
  });
  assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length??0,0,`syntax: ${filename}`);
  m._compile(out.outputText,filename);
};
const {setBoardPreset,holePosition} = require('../src/circuit/breadboard.ts');
const {planWireRoutes}=require('../src/circuit/wire-routing.ts');
const {autoTidyWireBundle,routeQuality}=require('../src/circuit/tidy-wires.ts');
const {simulate}=require('../src/circuit/simulate.ts');
const {circuitArduinoLcd,circuitArduinoOled,circuitArduinoSevenSegment}=require('../src/circuit/display-examples.ts');
const {circuitHalfAdder,circuitFullAdder}=require('../src/circuit/adder-circuits.ts');
const {useLab}=require('../src/store/lab.ts');
const {freshPremadeCircuit}=require('../src/store/projects.ts');
setBoardPreset('standard-830');
const pairs=[
  ['Arduino LCD',circuitArduinoLcd], ['Arduino OLED',circuitArduinoOled],
  ['Arduino 7-segment',circuitArduinoSevenSegment],
  ['Half Adder',circuitHalfAdder], ['Full Adder',circuitFullAdder],
];
for(const [name,factory] of pairs){
  const circuit=factory();
  assert(circuit.wires.every(w=>Array.isArray(w.bends) && w.bendAnchors?.a===w.a && w.bendAnchors?.b===w.b),`${name}: saved bends`);
  const auto=planWireRoutes(circuit.wires,holePosition,circuit.parts);
  assert.equal(auto.length,circuit.wires.length,`${name}: number of connections unchanged`);
  assert.equal(auto.filter(r=>r.blocked).length,0,`${name}: no blocked wires`);
  // Rerouting never changes connectivity or computed circuit state.
  const old=circuit.wires.map(({bends,bendAnchors,routeLocked,...w})=>w);
  const rawRoutes=planWireRoutes(old,holePosition,circuit.parts);
  const newNear=auto.reduce((n,r)=>n+r.crossings,0);
  const oldNear=rawRoutes.reduce((n,r)=>n+r.crossings,0);
  assert(newNear<=oldNear,`${name}: shared routing must not increase projected wire contacts (${oldNear} to ${newNear})`);
  const oldResult=simulate({...circuit,wires:old,powerOn:true});
  const newResult=simulate({...circuit,powerOn:true});
  assert.equal(newResult.shortCircuit,oldResult.shortCircuit,`${name}: short status`);
  assert.equal(newResult.supplyCurrent,oldResult.supplyCurrent,`${name}: supply current`);
  if(name.includes('LCD')) assert.equal(newResult.lcdText,oldResult.lcdText);
  if(name.includes('OLED')) assert.equal(newResult.oledText,oldResult.oledText);
  if(name.includes('Adder')) assert.deepEqual(newResult.gates,oldResult.gates);
  const points=auto.flatMap(r=>r.profile??[]);
  const peak=Math.max(...points.map(p=>p.y),0);
  assert(peak<1.15,`${name}: tall overlapping wires (${peak})`);
  console.log(`${name}: ${circuit.wires.length} wires, nearby path contacts ${oldNear} → ${newNear}, max height ${peak.toFixed(2)}: PASS`);
}
const sample=circuitArduinoOled();
const first=sample.wires[0];
const original=JSON.stringify(sample);
const locked={...first,routeLocked:true,bends:[...first.bends]};
const adjusted=autoTidyWireBundle([locked,...sample.wires.slice(1)],sample.parts,holePosition);
assert.deepEqual(adjusted[0],locked,'locked visual path unchanged by global tidy');
assert.equal(JSON.stringify(sample),original,'tidy did not mutate caller');
const state=useLab.getState();
state.loadCircuit(sample);
const startWires=JSON.stringify(useLab.getState().wires);
useLab.getState().autoTidyWires();
useLab.getState().select(first.id);
useLab.getState().setSelectedWireRouteLocked(true);
assert.equal(useLab.getState().wires.find(w=>w.id===first.id).routeLocked,true);
useLab.getState().autoTidyWires();
assert.equal(useLab.getState().wires.find(w=>w.id===first.id).routeLocked,true);
useLab.getState().undo();
assert.equal(useLab.getState().wires.find(w=>w.id===first.id).routeLocked,undefined);
assert.equal(JSON.stringify(useLab.getState().wires),startWires,'Undo restores original wire layout');
// User-editable wire lane and Undo on an unobstructed board.
useLab.getState().loadCircuit({boardId:'standard-830',parts:[],wires:[{
  id:'simple-wire',a:'A5',b:'A15',color:'blue',style:'jumper',
}],psuPositive:null,psuNegative:null});
useLab.getState().select('simple-wire');
useLab.getState().nudgeSelectedWireLane('z',0.16);
let editable=useLab.getState().wires[0];
assert(editable.routeLocked, 'editing a lane locks its path');
assert(editable.bends?.length===2 && editable.bendAnchors?.a==='A5', 'bend path is saved');
useLab.getState().undo();
assert(!useLab.getState().wires[0].routeLocked, 'lane edit is undoable');
const reloaded=freshPremadeCircuit('arduino-lcd-demo');
assert(reloaded.wires.every(w=>Array.isArray(w.bends)),'fresh demo includes saved route metadata');
const page=fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'),'utf8');
assert.match(page,/Auto Tidy wires/);
assert.match(page,/Lock selected wire route/);
assert.match(page,/Focus connections/);
console.log('Locked routes, unchanged electrical nets, Undo, factory restoration, and UI controls: PASS');
