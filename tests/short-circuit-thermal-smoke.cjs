/** Circuit-fault regression: direct/low-Z shorts, stress ratings, and all-mesh smoke dispatch. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) return path.join(root, 'src', name.slice(2)) + '.ts';
  return originalResolve.call(this, name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
    reportDiagnostics: true,
  });
  assert.equal(output.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  module._compile(output.outputText, filename);
};
const {simulate} = require('../src/circuit/simulate.ts');
const {setBoardPreset} = require('../src/circuit/breadboard.ts');
setBoardPreset('standard-830');
const base = {parts:[],wires:[],powerOn:true,psuVoltage:5,psuPositive:'tp5',psuNegative:'tn5'};
const run = overrides => simulate({...base,...overrides});
const safe = run({});
assert.equal(safe.shortCircuit,false,'idle supply is not shorted');
assert.equal(safe.supplyOverload,false,'idle supply is not overloaded');
assert.equal(Object.keys(safe.burned).length,0,'unpowered parts do not burn');
const direct = run({wires:[{id:'jumper',a:'tp5',b:'tn5',style:'solid',color:'black'}]});
assert.equal(direct.shortCircuit,true,'wire shorting positive rail to negative rail triggers fault');
assert.equal(direct.supplyCurrent,2,'direct hard short hits PSU simulated current limit');
assert.match(direct.warnings.join(' '),/SHORT CIRCUIT/);
const resistor = (r, id='R1', extra={}) => ({id,kind:'resistor',pins:{a:'tp5',b:'tn5'},props:{resistance:r,powerRating:0.25, ...extra}});
const lowR = run({parts:[resistor(0.05)]});
assert.equal(lowR.shortCircuit,true,'low-impedance resistor path is a short risk');
assert.equal(lowR.supplyOverload,true,'low impedance exceeds supply 2 A budget');
assert.equal(lowR.burned?.R1,true,'overstressed resistor has thermal smoke flag');
const normal = run({parts:[resistor(1000)]});
assert.equal(normal.shortCircuit,false,'normal resistance must not be flagged');
assert.equal(normal.supplyOverload,false,'normal current is below PSU rating');
assert.equal(Boolean(normal.burned?.R1),false,'normal resistor stays unburned');
const hot = run({parts:[resistor(10)]});
assert.equal(hot.shortCircuit,false,'high-power resistor is not automatically a source short');
assert.equal(hot.burned?.R1,true,'resistor overheats when power rating exceeded');
const speaker = run({parts:[{id:'SP1',kind:'speaker',pins:{a:'tp5',b:'tn5'},props:{}}]});
assert.equal(speaker.burned?.SP1,true,'speaker exceeding educational power rating burns');
const prototypeModule = run({psuVoltage:12,parts:[{id:'S1',kind:'module',pins:{vcc:'tp5',gnd:'tn5'},props:{moduleId:'sensor-dht22'}}]});
assert.equal(prototypeModule.burned?.S1,true,'a 5 V prototype module is warned on 12 V supply');
const oled = run({parts:[{id:'OLED1',kind:'oled',pins:{vcc:'tp5',gnd:'tn5'},props:{}}]});
assert.equal(oled.burned?.OLED1,true,'bare 3.3 V OLED exposed to bench 5 V receives thermal fault');
const battery = (p,m) => ({id:'BAT1',kind:'module',pins:{plus:p,minus:m},props:{moduleId:'power-battery'}});
const healthyBattery = run({parts:[battery('A5','A6')]});
assert.equal(healthyBattery.sourceConflict,false,'unconnected cell is not in source conflict');
assert.equal(healthyBattery.shortCircuit,false,'unconnected cell is not shorted');
const parallel = run({parts:[battery('tp5','tn5')]});
assert.equal(parallel.sourceConflict,true,'5 V PSU directly paralleled against nominal 3.7 V cell is incompatible');
assert.equal(parallel.burned?.BAT1,true,'conflicting battery shows thermal warning smoke');
assert.match(parallel.warnings.join(' '),/SOURCE CONFLICT/);
const reversed = run({parts:[battery('tn5','tp5')]});
assert.equal(reversed.sourceConflict,true,'reverse cell / PSU connection trips safety warning');
assert.match(reversed.warnings.join(' '),/REVERSED SOURCES/);
const deadShortCell = run({powerOn:false,parts:[battery('tp5','tp6')]});
assert.equal(deadShortCell.shortCircuit,true,'shorted cell is hazardous even with PSU turned off');
assert.equal(deadShortCell.burned?.BAT1,true,'shorted cell animates thermal warning');
const safeParallel = run({psuVoltage:3.7,parts:[battery('tp5','tn5')]});
assert.equal(safeParallel.sourceConflict,true,'directly paralleling a Li-ion cell with a supply is unsafe even at matching nominal voltage');
assert.match(safeParallel.warnings.join(' '),/UNCONTROLLED BATTERY CONNECTION/);
const open = run({powerOn:false,parts:[resistor(0.05)]});
assert.equal(open.shortCircuit,false,'power-off circuit cannot trigger fault');
assert.equal(Object.keys(open.burned).length,0,'power-off circuit does not smoke');
const file = fs.readFileSync(path.join(root,'src/circuit-lab/parts-3d.tsx'),'utf8');
assert.match(file,/!builtInSmoke && Boolean\(sim\.burned\?\.\[part\.id\]\) && <SmokePuffs position=\{smokePosition\} active/,'fallback smoke emitter on all component mesh families');
assert.match(file,/active=\{powerOn && faultActive\}/,'PSU protection plume when fault active');
assert.match(file,/raycast=\{\(\) => null\}/,'smoke must not intercept clicking components');
console.log('Hard/low-impedance shorts, overloaded source, thermal damage, PSU warning, and universal 3D smoke: PASS');
