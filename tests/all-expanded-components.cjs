/** New catalog component integration: actual placement, pin maps, undo, circuit logic.
 * Does not claim an automated WebGL screenshot test. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
const originalLoad = Module._load;
Module._resolveFilename = function(request, parent, ...rest) {
  if (request.startsWith('@/')) return path.join(root, 'src', request.slice(2)) + '.ts';
  return originalResolve.call(this, request, parent, ...rest);
};
let sequence = 0;
Module._load = function(request, parent, ...rest) {
  if (request === '@/lib/utils') return { uid: prefix => `${prefix}-${++sequence}` };
  if (request === 'zustand') return { create: initializer => {
    const build = init => {
      let state;
      const set = updater => { const next = typeof updater === 'function' ? updater(state) : updater; state = { ...state, ...next }; };
      const get = () => state;
      state = init(set, get);
      const hook = selector => selector ? selector(state) : state;
      hook.getState = get;
      return hook;
    };
    return initializer ? build(initializer) : build;
  }};
  if (request === 'zustand/middleware') return { persist: fn => fn };
  return originalLoad.call(this, request, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const code = fs.readFileSync(filename, 'utf8');
  const result = ts.transpileModule(code, {fileName: filename, compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  }, reportDiagnostics: true});
  assert.equal(result.diagnostics.filter(d => d.category === ts.DiagnosticCategory.Error).length, 0, filename);
  module._compile(result.outputText, filename);
};

const {EXPANSION_COMPONENTS,expansionById} = require('../src/circuit/expansion-catalog.ts');
const {getAllHoles,setBoardPreset,holeStrip} = require('../src/circuit/breadboard.ts');
const {computePinLayout,buildPreviewPart,useLab} = require('../src/store/lab.ts');
const {expansionLogicOutputs} = require('../src/circuit/expansion-logic.ts');
const {simulate} = require('../src/circuit/simulate.ts');
setBoardPreset('standard-830');
const holes=new Set(getAllHoles());
assert.equal(EXPANSION_COMPONENTS.length,37);
assert.equal(new Set(EXPANSION_COMPONENTS.map(x=>x.id)).size,37);
for(const spec of EXPANSION_COMPONENTS) {
  const layout=computePinLayout(spec.id, 'E3');
  assert.ok(layout,`no placement for ${spec.id}`);
  assert.equal(layout.kind,'module',spec.id);
  assert.deepEqual(Object.keys(layout.pins),spec.pins,`${spec.id} pin order`);
  if(spec.shape==='microcontroller') {
    assert.ok(Object.values(layout.pins).every(h=>h.startsWith('module:__preview__:')),`${spec.id} not wired to independent header sockets`);
    assert.ok(Object.values(layout.pins).every(h=>!holes.has(h)),`${spec.id} incorrectly occupies breadboard holes`);
  } else {
    assert.ok(Object.values(layout.pins).every(h=>holes.has(h)),`${spec.id} invalid hole`);
  }
  assert.equal(new Set(Object.values(layout.pins).map(holeStrip)).size,spec.pins.length,`${spec.id} shorted pins`);
  const preview=buildPreviewPart(spec.id,'E3');
  assert.ok(preview && preview.props.moduleId===spec.id,`${spec.id} preview not connected to catalog`);
  assert.equal(preview.props.label,spec.name);
}
// Real save, placement, selection and history for one expansion model.
const state=()=>useLab.getState();
state().setTool('ic-74hc283');
const before=state().parts.length;
state().placePartAt('ic-74hc283','E18');
assert.equal(state().parts.length,before+1,`new IC placement: ${state().placementError}`);
const placed=state().parts.at(-1);
assert.equal(placed.props.moduleId,'ic-74hc283');
const stored=JSON.parse(JSON.stringify(state().getCircuitSnapshot()));
assert.equal(stored.parts.at(-1).props.moduleId,'ic-74hc283');
state().undo(); assert.equal(state().parts.length,before);
state().redo(); assert.equal(state().parts.length,before+1);
// Pure truth tables including all carry combinations and enable controls.
for(let a=0;a<16;a++)for(let b=0;b<16;b++)for(let cin=0;cin<=1;cin++) {
  const high = pin => {
    const A=[5,3,14,12], B=[6,2,15,11];
    let idx=A.findIndex(n=>`p${n}`===pin);
    if(idx>=0) return !!(a&(1<<idx));
    idx=B.findIndex(n=>`p${n}`===pin);
    if(idx>=0) return !!(b&(1<<idx));
    return pin==='p7'&&!!cin;
  };
  const out=expansionLogicOutputs('ic-74hc283',high);
  const num=[4,1,13,10,9].reduce((sum,p,i)=>sum+(out[`p${p}`]?(1<<i):0),0);
  assert.equal(num,a+b+cin,`${a}+${b}+${cin}`);
}
for(let digit=0;digit<16;digit++) {
  const bits=[7,1,2,6];
  const out=expansionLogicOutputs('ic-cd4511',pin=>pin==='p4'||pin==='p3'||bits.some((n,i)=>pin===`p${n}`&&Boolean(digit&(1<<i))));
  assert.equal(Object.values(out).filter(Boolean).length,digit<10?[6,2,5,5,4,5,6,3,7,6][digit]:0,`${digit} segments`);
}
for(let active=0;active<8;active++){
  const out=expansionLogicOutputs('ic-74hc138',pin=>pin==='p6'||[1,2,3].some((n,i)=>pin===`p${n}`&&Boolean(active&(1<<i))));
  assert.equal(Object.values(out).filter(v=>!v).length,1);
}
function nodeV(chip, wires, pin){
  const result=simulate({parts:[chip],wires,psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
  assert.equal(result.shortCircuit,false);
  return result.voltages[chip.pins[pin]]??0;
}
const chip=buildPreviewPart('ic-74hc283','E3');
chip.id='module-test';
const wires=[
{id:'vcc',a:'tp5',b:chip.pins.p16,color:'red'},
{id:'gnd',a:'tn5',b:chip.pins.p8,color:'black'},
{id:'a1',a:'tp5',b:chip.pins.p5,color:'red'},
{id:'b1',a:'tp5',b:chip.pins.p6,color:'red'},
];
const vS1=nodeV(chip,wires,'p4');
const vS2=nodeV(chip,wires,'p1');
assert.ok(vS1<0.9 && vS2>3.7,`adder output 1+1: S1=${vS1}, S2=${vS2}`);
const powered=simulate({parts:[chip],wires,psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
assert.equal(powered.logicGates[chip.id].powered,true);
const disconnected=simulate({parts:[chip],wires:[],psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
assert.equal(disconnected.logicGates[chip.id].powered,false);
// No made-up electrical drive on a hardware prototype or virtual instrument.
const proto=buildPreviewPart('board-esp32','E3');proto.id='esp-proto';
const noDrive=simulate({parts:[proto],wires:[{id:'protoPower',a:'tp5',b:proto.pins.vcc,color:'red'}],psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
assert.ok((noDrive.voltages[proto.pins.io0]??0)<0.1,'prototype GPIO incorrectly driven');
console.log(`Expansion 37/37: catalog, accurate mapped hole connectivity, save, undo, all adder inputs, CD4511 and 74HC138 truth tables, DC solve and prototype isolation: PASS`);
