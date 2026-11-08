/** Regression of off-board PCB, independent pin nets, wiring, drag, save and cleanup. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const oldResolve = Module._resolveFilename, oldLoad=Module._load;
let id=0;
Module._resolveFilename=function(r,p,...rest){
 if (r.startsWith('@/')) return path.join(root,'src',r.slice(2))+'.ts';
 return oldResolve.call(this,r,p,...rest);
};
Module._load=function(r,p,...rest){
 if(r==='@/lib/utils')return {uid:prefix=>prefix+'-'+(++id)};
 if(r==='zustand')return {create:init=>{
   const build=fn=>{let state;const set=v=>state={...state,...(typeof v==='function'?v(state):v)};
   const get=()=>state;state=fn(set,get);
   const use=fn=>fn?fn(state):state;use.getState=get;return use;};
   return init?build(init):build;
 }};
 if(r==='zustand/middleware')return {persist:fn=>fn};
 return oldLoad.call(this,r,p,...rest);
};
require.extensions['.ts']=(module,name)=>{
 const {outputText,diagnostics}=ts.transpileModule(fs.readFileSync(name,'utf8'),{fileName:name,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
 assert.equal(diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,name);
 module._compile(outputText,name);
};
const {setBoardPreset,BOARD,holeStrip,getAllHoles}=require('../src/circuit/breadboard.ts');
const {isOffboardController,controllerPosition,constrainBenchPoint,moduleTerminalId,upgradeControllerHeaders}=require('../src/circuit/offboard-controllers.ts');
const {terminalPosition}=require('../src/circuit/mcu-headers.ts');
const {useLab,buildPreviewPart}=require('../src/store/lab.ts');
const {placementIsBlocked}=require('../src/circuit/placement-obstacles.ts');
const {planWireRoutes}=require('../src/circuit/wire-routing.ts');
const get=()=>useLab.getState();
setBoardPreset('standard-830');
function clear(){get().loadCircuit({boardId:'standard-830',psuVoltage:5,psuPositive:'tp5',psuNegative:'tn5',parts:[],wires:[]});}
const ids=['mcu','board-nano','board-mega','board-esp32','board-pico'];
for (const tool of ids) {
 clear();get().setTool(tool);get().placePartAt(tool,'F12');
 assert.equal(get().parts.length,1,tool+': placement '+get().placementError);
 const part=get().parts[0];assert(isOffboardController(part));
 const pos=controllerPosition(part);
 assert(Math.abs(pos.z)>BOARD.depth/2+.48,tool+': PCB is not on bench');
 assert(Object.values(part.pins).every(h=>h.startsWith(tool==='mcu'?'mcu:':'module:')),tool+': independent terminal IDs');
 assert(Object.values(part.pins).every(h=>!getAllHoles().includes(h)),tool+': phantom contacts');
 const pin=Object.keys(part.pins)[0],term=part.pins[pin];
 const contact=terminalPosition(term,get().parts);
 assert(contact.every(Number.isFinite),tool+': no real contact position');
 assert(Math.abs(contact[2])>BOARD.depth/2,tool+': socket embedded in board');
 assert.equal(holeStrip(term),term,tool+': net not independent');
 const ghost=buildPreviewPart(tool,'F12');
 assert(ghost && isOffboardController(ghost),tool+': ghost missing');
 get().setTool('wire');get().clickHole(term);get().clickHole('A18');
 assert.equal(get().wires.length,1,tool+': unable to connect lead to breadboard. '+get().placementError);
 assert.equal(get().wires[0].a,term);
 assert.equal(planWireRoutes(get().wires,h=>terminalPosition(h,get().parts),get().parts)[0].blocked,false,tool+': wire blocked');
 const destination=constrainBenchPoint({x:pos.x+.55,z:pos.z-.4},part.props.moduleId);
 get().setTool('select');get().select(part.id);get().moveSelectedTo('F12',destination);
 assert.equal(get().parts[0].props.benchPosition.x,destination.x,tool+': drag x failed '+get().placementError);
 assert.equal(get().wires[0].a,term,tool+': moved pin ID');
 get().undo();assert.equal(get().parts[0].props.benchPosition.x,pos.x,tool+': undo');
 get().redo();assert.equal(get().parts[0].props.benchPosition.x,destination.x,tool+': redo');
 const saved=get().getCircuitSnapshot();get().loadCircuit(saved);
 assert.deepEqual(get().parts[0].props.benchPosition,destination,tool+': persistence');
 assert.equal(get().wires[0].a,term,tool+': saved wiring');
 get().setTool('select');get().select(part.id);get().deleteSelected();
 assert.equal(get().wires.length,0,tool+': orphaned wires on delete');
 get().undo();assert.equal(get().wires.length,1,tool+': deletion undo');
 console.log('PASS',tool,'outside bench; independent headers; connected wire; moved; undo/redo; saved; deleted');
}
// Verify an older Nano project moves the explicitly attached wire to a new offboard header.
clear();
const oldPins=Object.fromEntries(Array.from({length:30},(_,i)=>[i===0?'gnd':i===1?'vcc':'io'+(i-2),`F${i+3}`]));
const legacy={id:'old-nano',kind:'module',props:{moduleId:'board-nano'},pins:oldPins};
const wires=[{id:'old-wire',a:'F3',b:'A6',color:'red'}];
const migrated=upgradeControllerHeaders([legacy],wires);
assert.equal(migrated.parts[0].pins.gnd,'module:old-nano:gnd');
assert.equal(migrated.wires[0].a,'module:old-nano:gnd');
assert(terminalPosition(migrated.wires[0].a,migrated.parts).every(Number.isFinite));
const again=upgradeControllerHeaders(migrated.parts,migrated.wires);
assert.deepEqual(again,migrated);
console.log('PASS legacy project migrations, 5/5 off-board controller types');
