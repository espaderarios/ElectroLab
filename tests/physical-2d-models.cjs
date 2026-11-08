/** Every catalog component has its own physical SVG artwork, not a generic rectangle. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.resolve(__dirname, '..');
function compile(relative, dependencies={}) {
  const filename=path.join(root, relative);
  const result=ts.transpileModule(fs.readFileSync(filename,'utf8'), {
    fileName:filename, compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2020},
    reportDiagnostics:true,
  });
  assert.equal(result.diagnostics.filter(d=>d.category===ts.DiagnosticCategory.Error).length,0,`${relative} transpiles`);
  const mod={exports:{}};
  const localRequire=id=>id in dependencies?dependencies[id]:require(id);
  new Function('require','module','exports',result.outputText)(localRequire,mod,mod.exports);
  return mod.exports;
}
const catalog=compile('src/circuit/expansion-catalog.ts');
const models=compile('src/circuit-lab/physical-models-2d.tsx',{
  '@/circuit/expansion-catalog':catalog,
  '@/circuit/offboard-controllers':{
    isOffboardController:part=>part.kind==='mcu'||Boolean(/^board-(nano|mega|esp32|pico)$/.test(part.props.moduleId??'')),
    controllerDimensionsForPart:()=>({width:2.72,depth:2.12}),
  },
});
const display=(part,pins=[])=>renderToStaticMarkup(React.createElement('svg',null,React.createElement(models.PhysicalModel2D,{
  part,center:{x:0,y:0},pins,selected:false,lit:false,
})));
const shapes=new Set();
const controllerIds=new Set(['board-nano','board-mega','board-esp32','board-pico']);
for(const component of catalog.EXPANSION_COMPONENTS) {
  const part={id:component.id,kind:'module',props:{moduleId:component.id},pins:{}};
  const markup=display(part,Array.from({length:component.pins.length},(_,i)=>({x:(i%15-7)*11,y:i<15?-52:52})));
  assert.match(markup,/data-physical-model=/,`${component.id} has physical vector model`);
  assert.ok(markup.length>500,`${component.id} has meaningful visible geometry`);
  assert.doesNotMatch(markup,/NaN|\bundefined\b/,`${component.id} contains valid drawing attributes`);
  assert.ok(controllerIds.has(component.id)||markup.includes(`data-component-model="${component.id}"`),`${component.id} uses its own model rather than a generic fallback`);
  shapes.add(models.physical2DModelKey(part));
}
assert.equal(shapes.size,catalog.EXPANSION_COMPONENTS.length,'every expanded component has a unique visual identity');
const kinds=['resistor','led','diode','switch','button','capacitor','inductor','buzzer','relay','lcd','oled','mcu','pot','transistor','thyristor','triac','diac','motor','speaker','not','and','or','nand','nor','xor','xnor','mosfet','zener','ldr','rgb-led','seven-segment','timer555','opamp','servo','thermistor','optocoupler','regulator','fuse'];
for(const kind of kinds){
  const part={id:kind,kind,props:{},pins:{a:'A1',b:'A4'}};
  const markup=display(part,[{x:-29,y:0},{x:29,y:0}]);
  assert.ok(markup.length>190,`${kind} rendered as physical component`);
  assert.doesNotMatch(markup,/NaN|\bundefined\b/,`${kind} has valid SVG coordinates`);
  shapes.add(models.physical2DModelKey(part));
}
const variants=[
  ['capacitor',{capacitorType:'electrolytic'}],['capacitor',{capacitorType:'film'}],['capacitor',{capacitorType:'tantalum'}],
  ['button',{switchStyle:'tactile-blue'}],['button',{switchStyle:'tactile-white'}],
  ['switch',{componentVariant:'reed-switch'}],['switch',{componentVariant:'slide-spdt'}],
  ['fuse',{componentVariant:'glass-fuse'}],['diode',{diodeType:'schottky'}],
  ['led',{ledColor:'green'}],['led',{ledColor:'yellow'}],['led',{ledColor:'blue'}],
  ['transistor',{transistorModel:'2n2222'}],['transistor',{transistorModel:'tip31'}],
  ['mosfet',{mosfetModel:'irf540'}],
];
for(const [kind,props] of variants){
  const part={id:kind,kind,props,pins:{}};
  const markup=display(part,[{x:-24,y:0},{x:24,y:0}]);
  assert.ok(markup.length>190,`${kind} variant rendered`);
  shapes.add(models.physical2DModelKey(part));
}
console.log(`Detailed physical SVG: ${catalog.EXPANSION_COMPONENTS.length} expanded parts, ${kinds.length} base kinds, ${variants.length} variants, ${shapes.size} identity keys PASS`);
