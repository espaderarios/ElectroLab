/** Hardware pinout, 3D/logic contract, and decimal-point regression checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const origResolve = Module._resolveFilename;
const origLoad = Module._load;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) return path.join(root, 'src', name.slice(2)) + '.ts';
  return origResolve.call(this, name, parent, ...rest);
};
let seq = 0;
Module._load = function(name, parent, ...rest) {
  if (name === '@/lib/utils') return {uid: name => `${name}_${++seq}`};
  if (name === 'zustand') return {create: cb => {
    const build = f => {let state;const set = updater => {state = {...state,...(typeof updater==='function' ? updater(state) : updater)}};const get=()=>state;state=f(set,get);return {getState:get};};
    return cb ? build(cb) : build;
  }};
  if (name === 'zustand/middleware') return {persist: f => f};
  return origLoad.call(this,name,parent,...rest);
};
require.extensions['.ts'] = (m,filename)=>{
  const out=ts.transpileModule(fs.readFileSync(filename,'utf8'),{fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true});
  assert.equal(out.diagnostics?.filter(d=>d.category===ts.DiagnosticCategory.Error).length ?? 0,0,`syntax error ${filename}`);
  m._compile(out.outputText,filename);
};
const {SEVEN_SEGMENT_PINS,SEVEN_SEGMENT_PIN_NUMBERS,SEVEN_SEGMENT_LED_NAMES}=require('../src/circuit/seven-segment.ts');
const {computePinLayout,buildPreviewPart,useLab}=require('../src/store/lab.ts');
const {setBoardPreset,getAllHoles}=require('../src/circuit/breadboard.ts');
const {simulate}=require('../src/circuit/simulate.ts');
setBoardPreset('standard-830');
assert.deepEqual([...SEVEN_SEGMENT_PINS], ['e','d','com1','c','dp','b','a','com2','f','g']);
assert.equal(SEVEN_SEGMENT_LED_NAMES.length,8);
assert.equal(SEVEN_SEGMENT_PIN_NUMBERS.dp,5);
assert.equal(SEVEN_SEGMENT_PIN_NUMBERS.com2,8);
const layout=computePinLayout('seven-segment','F16');
assert.equal(layout.holes.length,10,'ten physical pins');
assert.equal(new Set(layout.holes).size,10,'ten unique breadboard holes');
assert.equal(layout.pins.e,'F16');
assert.equal(layout.pins.dp,'F20');
assert.equal(layout.pins.g,'E16');
assert.equal(layout.pins.com2,'E18');
for (const hole of layout.holes) assert(getAllHoles().includes(hole));
const preview=buildPreviewPart('seven-segment','F16');
assert.deepEqual(preview.pins,layout.pins);
const pkg={...preview,id:'seven-seg',props:{...preview.props,sevenSegCommon:'cathode'}};
// Current-limiting resistors: one per driven segment, not a direct 5 V short.
const aR={id:'R-a',kind:'resistor',pins:{a:'A5',b:'A9'},props:{resistance:330}};
const dpR={id:'R-dp',kind:'resistor',pins:{a:'A10',b:'A14'},props:{resistance:330}};
const W=(a,b)=>({id:`w-${a}-${b}`,a,b,color:'red',style:'solid'});
const circuit={
  parts:[pkg,aR,dpR],
  wires:[W('tp5','A5'),W('A9','A19'),W('tp5','A10'),W('A14','J20'),W('A18','tn5')],
  psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true,
};
const result=simulate(circuit);
assert.equal(result.shortCircuit,false);
const seg=result.sevenSegments[pkg.id];
assert(seg,'segment state exists');
assert.equal(seg.segments.length,8,'seven bars AND DP in simulation state');
assert.deepEqual(seg.segments,[true,false,false,false,false,false,false,true]);
assert(result.supplyCurrent > 0.001 && result.supplyCurrent < 0.035,`current plausible ${result.supplyCurrent}`);
const unpowered=simulate({...circuit,powerOn:false});
assert.equal(unpowered.sevenSegments?.[pkg.id],undefined,'No lights while powered off');
// Legacy 9-terminal projects still calculate using the old COM alias.
const legacy={...pkg,pins:{a:'A19',b:'E24',c:'E25',d:'E26',e:'E27',f:'E28',g:'E29',dp:'J20',com:'A18'}};
const legacySim=simulate({...circuit,parts:[legacy,aR,dpR]});
assert.equal(legacySim.sevenSegments[legacy.id].segments[0],true);
assert.equal(legacySim.sevenSegments[legacy.id].segments[7],true);
// An empty board can place the package, but a second one on top is blocked.
useLab.getState().loadCircuit({boardId:'standard-830',parts:[],wires:[],psuPositive:null,psuNegative:null});
useLab.getState().placePartAt('seven-segment','F16');
assert.equal(useLab.getState().parts.length,1);
useLab.getState().placePartAt('seven-segment','F16');
assert.equal(useLab.getState().parts.length,1);
console.log('10-pin 7-segment, a-g+DP illumination, common pins, legacy projects, placement: PASS');
const {freshPremadeCircuit}=require('../src/store/projects.ts');
const restored=freshPremadeCircuit('arduino-lcd-demo');
assert(restored.parts.some(p=>p.kind==='mcu') && restored.parts.some(p=>p.kind==='lcd'));
assert(restored.wires.length>0,'factory LCD demo has editable wires');
const sevenDemo=freshPremadeCircuit('arduino-seven-segment-demo');
assert(sevenDemo.parts.some(p=>p.kind==='mcu') && sevenDemo.parts.some(p=>p.kind==='seven-segment'));
assert.equal(sevenDemo.wires.length, 11, 'factory 7-segment demo includes editable power + segment wires');
const sevenDemoSim = simulate({...sevenDemo, powerOn:true});
const sevenSegPart = sevenDemo.parts.find(p=>p.kind==='seven-segment');
assert(sevenSegPart && sevenDemoSim.sevenSegments[sevenSegPart.id],'factory 7-segment demo simulates');
assert.deepEqual(sevenDemoSim.sevenSegments[sevenSegPart.id].segments,[true,true,true,true,true,true,true,true],'factory 7-segment demo lights 8 with decimal point');
assert.equal(freshPremadeCircuit('custom-user-project'),null,'non-demo project cannot be replaced');
console.log('Factory demo restore contract: PASS');
