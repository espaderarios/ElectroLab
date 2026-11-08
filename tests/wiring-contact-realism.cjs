/** Regression: interactive breakout sockets, actual wire endpoints and cable routing. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const resolve=Module._resolveFilename, load=Module._load;
let sequence=0;
Module._resolveFilename=function(r,p,...rest){
  if(r.startsWith('@/'))return path.join(root,'src',r.slice(2))+'.ts';
  return resolve.call(this,r,p,...rest);
};
Module._load=function(r,p,...rest){
  if(r==='@/lib/utils')return {uid:prefix=>`${prefix}-${++sequence}`};
  if(r==='zustand')return {create:init=>{
    const build=fn=>{let state;const set=v=>{state={...state,...(typeof v==='function'?v(state):v)}};
      const get=()=>state;state=fn(set,get);const use=sel=>sel?sel(state):state;use.getState=get;return use;};
    return init?build(init):build;
  }};
  if(r==='zustand/middleware')return {persist:fn=>fn};
  return load.call(this,r,p,...rest);
};
require.extensions['.ts']=(m,name)=>{
  const {outputText,diagnostics}=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,name);
  m._compile(outputText,name);
};
const {setBoardPreset,BOARD,holeStrip}=require('../src/circuit/breadboard.ts');
const {EXPANSION_COMPONENTS}=require('../src/circuit/expansion-catalog.ts');
const {isOffboardController}=require('../src/circuit/offboard-controllers.ts');
const {terminalPosition}=require('../src/circuit/mcu-headers.ts');
const {planWireRoutes,wireRoute3DPoints}=require('../src/circuit/wire-routing.ts');
const {useLab}=require('../src/store/lab.ts');
const lab=()=>useLab.getState();
setBoardPreset('standard-830');
const clear=()=>lab().loadCircuit({boardId:'standard-830',psuVoltage:5,psuPositive:'tp5',psuNegative:'tn5',parts:[],wires:[]});
// Same-strip and duplicate wires should show meaningful errors, and retain
// first anchor so a user can fix only the destination click.
clear();lab().setTool('wire');lab().clickHole('A1');lab().clickHole('B1');
assert.equal(lab().wires.length,0);
assert.equal(lab().pendingHoles[0],'A1');
assert.match(lab().placementError,/already connected/);
lab().clickHole('A4');assert.equal(lab().wires.length,1);
lab().clickHole('A1');lab().clickHole('A4');
assert.match(lab().placementError,/already connects/);
assert.equal(lab().pendingHoles[0],'A1');
console.log('PASS: invalid wire feedback and repair without restarting the wire');
let checked=0;
for(const spec of EXPANSION_COMPONENTS){
 clear();lab().setTool(spec.id);lab().placePartAt(spec.id,'F12');
 const part=lab().parts[0];
 assert(part,`${spec.id} could not be placed: ${lab().placementError}`);
 const first=spec.pins[0],source=part.pins[first];
 const xyz=terminalPosition(source,lab().parts);
 assert(xyz.every(Number.isFinite),`${spec.id}: invalid socket position`);
 if(!isOffboardController(part)){
   if(spec.footprint==='dip')assert(xyz[1]<=BOARD.height+.08,`${spec.id}: DIP raised`);
   else assert(xyz[1]>BOARD.height+.20,`${spec.id}: breakout header hidden under PCB`);
 }
 const dest=holeStrip(source)===holeStrip('A1')?'J1':'A1';
 lab().setTool('wire');lab().setWireStyle('jumper');
 lab().clickHole(source);lab().clickHole(dest);
 assert.equal(lab().wires.length,1,`${spec.id}: wire connection failed: ${lab().placementError}`);
 const route=planWireRoutes(lab().wires,id=>terminalPosition(id,lab().parts),lab().parts)[0];
 assert(!route.blocked,`${spec.id}: routed cable blocked`);
 const points=wireRoute3DPoints(route,BOARD.height);
 assert(points.length>=2 && points.every(pt=>Number.isFinite(pt.y)),`${spec.id}: invalid geometry`);
 assert(Math.abs(points[0].y-(xyz[1]+.032))<.15,`${spec.id}: cable starts at wrong pin height`);
 const saved=lab().getCircuitSnapshot();lab().loadCircuit(saved);
 assert.equal(lab().wires.length,1,`${spec.id}: lost wire during save/reload`);
 checked++;
}
const model=fs.readFileSync(path.join(root,'src/circuit-lab/expansion-meshes.tsx'),'utf8');
assert.match(model,/function Pin\(/);
assert.match(model,/raised=\{spec\.footprint!=='dip'\}/);
assert.match(model,/lab\.clickHole\(hole\)/);
assert.match(model,/sharedBoardManufacturingMap/);
for(const cue of ['DHT22','28BYJ-48','18650 Li-ion','sensor-hcsr04','display-ledbar'])assert(model.includes(cue),`Missing physical model: ${cue}`);
console.log(`PASS: ${checked} expansion component families wired to visible contacts, routes + persistence; procedural physical models`);
