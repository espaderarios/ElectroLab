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
const {getAllHoles, setBoardPreset, holeStrip} = require('../src/circuit/breadboard.ts');
const {computePinLayout, buildPreviewPart, useLab} = require('../src/store/lab.ts');
const {simulate} = require('../src/circuit/simulate.ts');
const variants = require('../src/circuit/component-variants.ts').COMPONENT_VARIANTS;
const state = () => useLab.getState();
setBoardPreset('standard-830');
const knownHoles = new Set(getAllHoles());
const entries = [
  ['capacitor-electrolytic','capacitor',2,'E8',{capacitorType:'electrolytic',capacitance:100e-6}],
  ['capacitor-film','capacitor',2,'E13',{capacitorType:'film',capacitance:100e-9}],
  ['capacitor-tantalum','capacitor',2,'E18',{capacitorType:'tantalum',capacitance:10e-6}],
  ['diode-schottky','diode',2,'E23',{diodeType:'schottky',forwardVoltage:0.3}],
  ['switch-reed','switch',2,'E28',{componentVariant:'reed-switch',switchType:'spst'}],
  ['switch-slide','switch',3,'E34',{componentVariant:'slide-spdt',switchType:'spdt'}],
  ['fuse-glass','fuse',2,'E41',{componentVariant:'glass-fuse',fuseCurrent:0.5}],
  ['button-blue','button',2,'E48',{switchStyle:'tactile-blue'}],
  ['button-white','button',2,'E55',{switchStyle:'tactile-white'}],
];
for (const [tool,kind,n,anchor,props] of entries) {
  assert.ok(variants[tool], `${tool}: no variant definition`);
  const layout = computePinLayout(tool,anchor);
  assert.ok(layout, `${tool}: cannot compute footprint`);
  assert.equal(layout.kind,kind);
  assert.equal(Object.keys(layout.pins).length,n);
  assert.equal(new Set(Object.values(layout.pins).map(holeStrip)).size,n,`${tool}: pins shorted to same strip`);
  assert.ok(Object.values(layout.pins).every(hole=>knownHoles.has(hole)),`${tool}: invalid hole`);
  const preview = buildPreviewPart(tool,anchor);
  assert.ok(preview,`${tool}: missing 3D preview part`);
  for (const [key,value] of Object.entries(props)) assert.deepEqual(preview.props[key],value,`${tool}: preview ${key}`);
  state().setTool(tool);
  const oldCount = state().parts.length;
  state().placePartAt(tool,anchor);
  assert.equal(state().parts.length,oldCount+1,`${tool}: placement failed: ${state().placementError}`);
  const placed = state().parts.at(-1);
  for (const [key,value] of Object.entries(props)) assert.deepEqual(placed.props[key],value,`${tool}: placement ${key}`);
  assert.deepEqual(placed.pins,preview.pins,`${tool}: preview differs from placed model`);
  const reloaded = JSON.parse(JSON.stringify(state().getCircuitSnapshot()));
  assert.deepEqual(reloaded.parts.at(-1).props, JSON.parse(JSON.stringify(placed.props)),`${tool}: persistence lost props`);
  state().undo();
  assert.equal(state().parts.length,oldCount,`${tool}: undo failed`);
  state().redo();
  assert.equal(state().parts.length,oldCount+1,`${tool}: redo failed`);
}
const reed = state().parts.find(p=>p.props.componentVariant==='reed-switch');
const slide = state().parts.find(p=>p.props.componentVariant==='slide-spdt');
assert.ok(reed && slide);
const result = simulate({parts:state().parts,wires:state().wires,
  psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
assert.equal(result.shortCircuit,false);
assert.equal(result.switches[reed.id].type,'spst');
assert.equal(result.switches[slide.id].type,'spdt');
// The native node union should pass voltage across contacts, not merely
// update a visual slider. These same pin IDs are exposed to the wire tool.
function switchVoltage(part, props, pin) {
  const supplyPin = part.props.switchType === 'spdt' ? part.pins.com : part.pins.a;
  const result = simulate({
    parts:[{...part, props:{...part.props,...props}}],
    wires:[{id:'supply',a:'tp5',b:supplyPin,color:'red'}],
    psuPositive:'tp5', psuNegative:'tn5', psuVoltage:5, powerOn:true,
  });
  return result.voltages[part.pins[pin]] ?? 0;
}
assert.ok(switchVoltage(reed,{closed:true},'b') > 4.9, 'Reed contacts do not conduct when closed');
assert.ok(switchVoltage(reed,{closed:false},'b') < 0.1, 'Open reed does not isolate');
assert.ok(switchVoltage(slide,{switchPosition:'no',closed:true},'no') > 4.9, 'Slide NO contact not connected');
assert.ok(switchVoltage(slide,{switchPosition:'nc',closed:true},'nc') > 4.9, 'Slide NC contact not connected');
assert.ok(switchVoltage(slide,{switchPosition:'open',closed:false},'no') < 0.1, 'Slide open contact leaks');
state().toggleSwitch(reed.id);
assert.equal(state().parts.find(p=>p.id===reed.id).props.closed,true);
state().toggleSwitch(slide.id);
assert.equal(state().parts.find(p=>p.id===slide.id).props.switchPosition,'nc');

// Real two-terminal electrical behavior: Schottky conducts forward at a
// lower drop than silicon, blocks reverse current, and uses the same holes.
function diodeSeries(diodeProps, reverse = false) {
  const diode = {id:'D',kind:'diode',pins: reverse ? {a:'A13',k:'A10'} : {a:'A10',k:'A13'},props:diodeProps};
  const resistor = {id:'R',kind:'resistor',pins:{a:'E13',b:'E16'},props:{resistance:1000}};
  const wires = [
    {id:'w+',a:'tp5',b:'B10',color:'red'},
    {id:'w-',a:'tn5',b:'B16',color:'black'},
  ];
  const sim = simulate({parts:[diode,resistor],wires,psuPositive:'tp5',psuNegative:'tn5',psuVoltage:5,powerOn:true});
  assert.equal(sim.shortCircuit,false);
  if (reverse) assert.ok(sim.supplyCurrent < 1e-5, `Reverse-biased diode drew bench current: ${sim.supplyCurrent}`);
  return sim.diodes.D.current;
}
const iSchottky = diodeSeries({diodeType:'schottky',forwardVoltage:0.3});
const iSilicon = diodeSeries({diodeType:'silicon'});
const iReverse = diodeSeries({diodeType:'schottky',forwardVoltage:0.3},true);
assert.ok(iSchottky > 0.003,`Schottky should conduct forward: ${iSchottky}`);
assert.ok(iSilicon > 0.002,`Silicon should conduct forward: ${iSilicon}`);
assert.ok(iSchottky > iSilicon,`Schottky should have lower Vf: ${iSchottky} <= ${iSilicon}`);
assert.ok(iReverse < 1e-6,`Reverse diode should block: ${iReverse}`);

const editor = fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'),'utf8');
const library = fs.readFileSync(path.join(root,'src/pages/ComponentLibrary.tsx'),'utf8');
const scene = fs.readFileSync(path.join(root,'src/circuit-lab/scene.tsx'),'utf8');
const meshes = fs.readFileSync(path.join(root,'src/circuit-lab/parts-3d.tsx'),'utf8');
for (const [tool] of entries) {
  assert.ok(editor.includes(`tool: '${tool}'`), `${tool}: not listed in 3D sidebar`);
  assert.ok(library.includes(`tool: "${tool}"`), `${tool}: not listed in component library`);
  assert.ok(scene.includes(`"${tool}"`), `${tool}: not placeable in 3D scene`);
}
assert.match(meshes,/ReedSwitchMesh part=\{part\}/);
assert.match(meshes,/SlideSwitchMesh part=\{part\}/);
const specialized = fs.readFileSync(path.join(root,'src/circuit-lab/component-variant-meshes.tsx'),'utf8');
for(const piece of ['meshPhysicalMaterial','tubeGeometry','switchInteraction','MetalLead'])assert.ok(specialized.includes(piece));
console.log(`Component expansion: ${entries.length} named variants, 3D assets, placement, electrical switch behavior, save, undo/redo, library/editor integration: PASS`);
