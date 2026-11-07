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
const {circuitArduinoLcd,circuitArduinoOled} = require('../src/circuit/display-examples.ts');
const {getDisplayWiringGuides,displayPinLabel,netConnected} = require('../src/circuit/display-guides.ts');
const {setBoardPreset,holePosition,getAllHoles} = require('../src/circuit/breadboard.ts');
const {planWireRoutes} = require('../src/circuit/wire-routing.ts');
const {simulate} = require('../src/circuit/simulate.ts');
setBoardPreset('standard-830');
assert.match(displayPinLabel('mcu','a4'), /SDA/);
assert.match(displayPinLabel('oled','vcc'), /3.3 V/);
for (const [name, build, expected] of [['LCD',circuitArduinoLcd,9],['OLED',circuitArduinoOled,4]]) {
  const c=build();
  const before=JSON.stringify(c);
  assert(c.parts.some(p=>p.kind==='mcu'));
  assert(c.parts.some(p=>p.kind===name.toLowerCase()));
  assert(c.wires.every(w=>w.style==='solid'||w.style==='jumper'));
  const known=new Set(getAllHoles());
  for (const p of c.parts) for (const hole of Object.values(p.pins)) assert(known.has(hole),`${name}: pin ${hole} off board`);
  for (const w of c.wires) assert(known.has(w.a)&&known.has(w.b));
  const guides=getDisplayWiringGuides(c.parts,c.wires);
  assert.equal(guides.length,1);
  assert.equal(guides[0].links.length,expected);
  for (const l of guides[0].links) assert(l.connected,`${name}: ${l.fromPin} → ${l.toPin} not connected`);
  const routes=planWireRoutes(c.wires,holePosition,c.parts);
  assert.equal(routes.length,c.wires.length);
  const blocked=routes.filter(r=>r.blocked);
  console.log(`${name}: ${c.parts.length} components, ${c.wires.length} wires, ${blocked.length} blocked routes`);
  assert.equal(JSON.stringify(c),before,'Guide mutated the project');
  // Disconnect the I2C SDA or LCD RS endpoint, then check the guide detects it.
  const lastPin = name==='OLED'?'sda':'rs';
  const lastRow=guides[0].links.find(l=>l.toPin===lastPin);
  const removed=c.wires.filter(w => !([w.a,w.b].some(h=>h===lastRow.toHole || (name==='OLED'?h==='A12':h==='A9'))));
  assert(!netConnected(lastRow.fromHole,lastRow.toHole,removed),`${name}: deleted wire not detected`);
  const after=getDisplayWiringGuides(c.parts,removed);
  assert(after[0].links.some(l=>!l.connected));
  const altered=simulate({parts:c.parts,wires:removed,psuVoltage:c.psuVoltage,psuPositive:c.psuPositive,psuNegative:c.psuNegative,powerOn:true});
  if(name==='OLED') assert.equal(altered.oledPowered,false,'I2C disconnect must blank OLED');
  // Simulation may warn for unsupported physical detail, but should never throw.
  const result=simulate({parts:c.parts,wires:c.wires,psuVoltage:c.psuVoltage,psuPositive:c.psuPositive,psuNegative:c.psuNegative,powerOn:true});
  assert(result && result.mcus);
  if(name==='LCD') {
    assert.equal(result.lcdPowered, true, 'LCD should power with explicit VDD and VSS wires');
    assert.match(result.lcdText, /ElectroLab/);
  } else {
    assert.equal(result.oledPowered, true, 'OLED should power only with four explicit I2C + power wires');
    assert.match(result.oledText, /ElectroLab/);
  }
}
// Guide on a blank circuit does not invent display links.
assert.deepEqual(getDisplayWiringGuides([],[]),[]);
// Placing hardware must not produce any hidden pre-wired connections.
const {useLab}=require('../src/store/lab.ts');
const lab=()=>useLab.getState();
lab().loadCircuit({boardId:'standard-830',parts:[],wires:[],psuPositive:null,psuNegative:null});
lab().setTool('mcu');
lab().placePartAt('mcu','F29');
assert.equal(lab().parts.filter(p=>p.kind==='mcu').length,1);
assert.equal(lab().wires.length,0,'MCU must not auto-generate wires');
lab().setTool('oled');
lab().placePartAt('oled','E10');
assert.equal(lab().parts.filter(p=>p.kind==='oled').length,1);
assert.equal(lab().wires.length,0,'OLED placement must not auto-wire I2C or supply');
lab().loadCircuit({boardId:'standard-830',parts:[],wires:[],psuPositive:null,psuNegative:null});
lab().setTool('lcd');
lab().placePartAt('lcd','E6');
assert.equal(lab().parts.filter(p=>p.kind==='lcd').length,1);
assert.equal(lab().wires.length,0,'LCD placement must not auto-wire backlight or signals');

console.log('Display circuit seed/guide regression: PASS');
