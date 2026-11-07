/** Regressions: the SSD1306 screen must not render text in CSS over the 3D scene;
 * every route including fallback paths must have a finite lift. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const file = fs.readFileSync(path.join(root, 'src/circuit-lab/parts-3d.tsx'), 'utf8');
const ast = ts.createSourceFile('parts-3d.tsx', file, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length, 0, '3D models must parse correctly');
const section = file.split('export function OledMesh(')[1].split('const TRANSISTOR_META')[0];
assert.match(section, /new THREE\.CanvasTexture\(canvas\)/, 'OLED text must be drawn on glass texture');
assert.match(section, /ctx\.clip\(\)/, 'OLED text must be clipped to screen pixels');
assert.match(section, /planeGeometry args=\{\[width \* 0\.76, depth \* 0\.53\]\}/, 'screen texture must have physical screen dimensions');
assert.doesNotMatch(section, /distanceFactor=\{5\.2\}/, 'do not use floating HTML text for the screen');
assert.match(section, /screenMap\?\.dispose\(\)/, 'GPU texture should be disposed when changed');
const wireSource = fs.readFileSync(path.join(root, 'src/circuit/wire-routing.ts'), 'utf8');
assert.doesNotMatch(wireSource, /jumperBase/, 'removed router variable must not remain');
const oldResolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) return path.join(root, 'src', name.slice(2)) + '.ts';
  return oldResolve.call(this, name, parent, ...rest);
};
require.extensions['.ts'] = (module, filename) => {
  const out = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename, compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022}, reportDiagnostics: true,
  });
  assert.equal(out.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  module._compile(out.outputText, filename);
};
const { planWireRoutes } = require('../src/circuit/wire-routing.ts');
const invalid = [{id:'bad-jumper',a:'A1',b:'A2',color:'blue',style:'jumper'}, {id:'bad-solid',a:'A2',b:'A3',color:'red',style:'solid'}];
const fallback = planWireRoutes(invalid, () => [NaN, 0, NaN]);
assert.deepEqual(fallback.map(p => p.blocked), [true,true]);
assert.deepEqual(fallback.map(p => p.lift), [0.245,0.105]);
console.log('OLED in-glass text; bounded pixel texture; no floating label; router fallback: PASS');
