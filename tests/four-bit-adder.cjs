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


const {circuitFourBitAdder}=require('../src/circuit/four-bit-adder-demo.ts');
const {getAllHoles,setBoardPreset,BOARD,holePosition}=require('../src/circuit/breadboard.ts');
const {collidesWithExisting,partObstacle,rectsOverlap}=require('../src/circuit/placement-obstacles.ts');
const {simulate}=require('../src/circuit/simulate.ts');
const {planWireRoutes}=require('../src/circuit/wire-routing.ts');
setBoardPreset('standard-830');
const demo=circuitFourBitAdder();
assert.equal(demo.boardId,'extended-1400');
setBoardPreset(demo.boardId);
const holes=new Set(getAllHoles());
assert.equal(demo.parts.filter(p=>p.kind==='switch').length,8);
assert.equal(demo.parts.filter(p=>p.kind==='led').length,5);
assert.equal(demo.parts.filter(p=>p.kind==='module').length,1);
for(const part of demo.parts) {
 for(const hole of Object.values(part.pins)) assert(holes.has(hole),`${part.kind}: ${hole}`);
}
for(const wire of demo.wires)assert(holes.has(wire.a)&&holes.has(wire.b),`${wire.a}->${wire.b}`);
for(let i=0;i<demo.parts.length;i++)for(let j=i+1;j<demo.parts.length;j++) {
 const a=partObstacle(demo.parts[i]),b=partObstacle(demo.parts[j]);
 if(a&&b)assert(!rectsOverlap(a,b),`overlap ${demo.parts[i].props.label} and ${demo.parts[j].props.label}`);
}
const blocked=planWireRoutes(demo.wires,holePosition,demo.parts).filter(r=>r.blocked);
assert.equal(blocked.length, 0, '3D wiring should have no blocked paths');
let count=0;
for(let a=0;a<16;a++)for(let b=0;b<16;b++){
 const sw=demo.parts.filter(p=>p.kind==='switch');
 const parts=demo.parts.map(p=>{
 const idx=sw.findIndex(q=>q.id===p.id);
 return idx<0?p:{...p,props:{...p.props,closed:Boolean((idx<4?a:b)&(1<<(idx%4)))}};
 });
 const result=simulate({...demo,parts,powerOn:true});
 const sum=a+b;
 
 const leds=parts.filter(p=>p.kind==='led');
 for(let i=0;i<leds.length;i++){
   const expected=Boolean(sum&(1<<i));
   const actual=Boolean(result.leds[leds[i].id]?.on);
   assert.equal(actual,expected,`LED${i} ${a}+${b}=${sum}, voltage=${result.voltages[leds[i].pins.a]} on=${actual}`);
 }
 assert(!result.shortCircuit,`short ${a}+${b}`);
 count++;
}
console.log(`Four-bit project: ${demo.parts.length} placed parts, ${demo.wires.length} connections, ${count} binary input combinations, 5 real LED outputs: PASS`);
