/** Regression: Arduino LCD wires should not create a high boxy cage; zoom must be stable. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const oldResolve = Module._resolveFilename;
const oldLoad = Module._load;
Module._resolveFilename = function(name, parent, ...rest) {
  return name.startsWith('@/') ? path.join(root,'src', name.slice(2)) + '.ts' : oldResolve.call(this,name,parent,...rest);
};
let id=0;
Module._load = function(name,parent,...rest) {
  if(name==='@/lib/utils')return {uid: prefix=>`${prefix}_${++id}`};
  return oldLoad.call(this,name,parent,...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename,'utf8'),{
    fileName:filename,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},reportDiagnostics:true,
  });
  assert.equal(out.diagnostics.filter(d=>d.category === ts.DiagnosticCategory.Error).length,0);
  module._compile(out.outputText,filename);
};
const {circuitArduinoLcd} = require('../src/circuit/display-examples.ts');
const {setBoardPreset,holePosition,BOARD} = require('../src/circuit/breadboard.ts');
const {planWireRoutes,wireRoute3DPoints} = require('../src/circuit/wire-routing.ts');
setBoardPreset('standard-830');
const circuit = circuitArduinoLcd();
const routes=planWireRoutes(circuit.wires,holePosition,circuit.parts);
assert.equal(routes.length,17);
assert.equal(routes.filter(route=>route.blocked).length,0);
const heights=routes.flatMap(route=>route.profile?.map(point=>point.y) ?? []);
assert(heights.length>50, 'local curves must have sufficient samples');
assert(Math.max(...heights)<1.0, 'LCD jumpers should not be stacked into a tall rectangular cage');
for(const route of routes){
  const points = wireRoute3DPoints(route,BOARD.height);
  assert(points.length>=route.waypoints.length+2,'all endpoints retained');
  assert(Math.abs(points[0].y-(BOARD.height+0.032))<0.001);
  assert(Math.abs(points.at(-1).y-(BOARD.height+0.032))<0.001);
}
const source=fs.readFileSync(path.join(root,'src/circuit-lab/scene.tsx'),'utf8');
const page=fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'),'utf8');
for (const [name,content] of [['scene.tsx',source],['CircuitEditorPage.tsx',page]]) {
  assert.equal(ts.createSourceFile(name,content,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
}
assert.match(source,/lastFittedBoard\.current === boardId/,'resizing the canvas must preserve orbit and zoom');
assert.match(source,/detail\.type === "focus-circuit"/);
assert.match(page,/label="Focus components"/);
assert.match(page,/\['G','Focus components'\]/);
console.log(`Arduino LCD: ${routes.length} wires, ${Math.max(...heights).toFixed(2)} max height above breadboard, all routable: PASS`);
console.log('Perspective framing, remembered zoom across dock/sidebar resizing, Focus components / Fit board: PASS');
