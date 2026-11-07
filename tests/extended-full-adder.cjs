/** Verify the larger board, physical footprints, isolated rail sections, and result digit. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const resolve=Module._resolveFilename, load=Module._load;
let n=0;
Module._resolveFilename=function(request,parent,...rest){
  if(request.startsWith('@/')) return path.join(root,'src',request.slice(2))+'.ts';
  return resolve.call(this,request,parent,...rest);
};
Module._load=function(request,parent,...rest){
  if(request==='@/lib/utils') return {uid:prefix=>`${prefix}-${++n}`};
  if(request==='zustand') return {create:cb=>{const build=f=>{
    let state; const set=u=>{state={...state,...(typeof u==='function'?u(state):u)};};
    const get=()=>state;state=f(set,get);return {getState:get};
  };return cb?build(cb):build;}};
  if(request==='zustand/middleware') return {persist:f=>f};
  return load.call(this,request,parent,...rest);
};
require.extensions['.ts']=(m,file)=>m._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),
  {fileName:file,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {getBoardPreset,setBoardPreset,getAllHoles,BOARD, holePosition}=require('../src/circuit/breadboard.ts');
const {circuitFullAdder}=require('../src/circuit/adder-circuits.ts');
const {partObstacle,rectsOverlap}=require('../src/circuit/placement-obstacles.ts');
const {planWireRoutes}=require('../src/circuit/wire-routing.ts');
const {simulate}=require('../src/circuit/simulate.ts');
const previous='standard-830';
setBoardPreset(previous);
const circuit=circuitFullAdder();
assert.equal(circuit.boardId,'extended-1400');
assert.equal(BOARD.presetId,previous,'factory must restore the previous active board');
const preset=getBoardPreset(circuit.boardId);
assert.equal(preset.cols,100);
assert.equal(preset.cols*10+4*preset.railHoles,1400);
setBoardPreset(circuit.boardId);
const holes=new Set(getAllHoles());
for(const part of circuit.parts){
  for(const pin of Object.values(part.pins)) assert(holes.has(pin),`missing pin ${pin}`);
  const r=partObstacle(part);
  if(r) {
    assert(r.minX>=-BOARD.width/2 && r.maxX<=BOARD.width/2,`part outside board: ${part.kind}`);
    assert(r.minZ>=-BOARD.depth/2 && r.maxZ<=BOARD.depth/2,`part off board depth: ${part.kind}`);
  }
}
for(let i=0;i<circuit.parts.length;i++) for(let j=i+1;j<circuit.parts.length;j++) {
  const a=partObstacle(circuit.parts[i]),b=partObstacle(circuit.parts[j]);
  if(a&&b) assert(!rectsOverlap(a,b),`overlapping bodies: ${circuit.parts[i].kind} and ${circuit.parts[j].kind}`);
}
for(const w of circuit.wires) assert(holes.has(w.a)&&holes.has(w.b),`invalid wire ${w.a}→${w.b}`);
const routes=planWireRoutes(circuit.wires,holePosition,circuit.parts);
assert(routes.every(r=>!r.blocked),'routes must be clear');
const switches=circuit.parts.filter(p=>p.kind==='switch');
const display=circuit.parts.find(p=>p.kind==='seven-segment');
assert.equal(switches.length,3);
assert(display);
for(let mask=0;mask<8;mask++){
  const parts=circuit.parts.map(p=>p.kind==='switch'?{
    ...p,props:{...p.props,closed:Boolean(mask&(1<<switches.findIndex(sw=>sw.id===p.id)))},
  }:p);
  const result=simulate({...circuit,parts,powerOn:true});
  const expected=parts.filter(p=>p.kind==='switch'&&p.props.closed).length;
  assert(!result.shortCircuit,`short at input ${mask}`);
  assert.equal(result.sevenSegments[display.id]?.digit,expected,`incorrect decimal at ${mask}`);
}
setBoardPreset(previous);
console.log(`Extended 1400: ${circuit.parts.length} parts, ${circuit.wires.length} wires, 0 body overlaps, 0 blocked routes, 8/8 decimal outcomes: PASS`);
