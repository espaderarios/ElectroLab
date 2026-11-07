const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const palette = read('src/circuit-lab/workbench-palette.ts');
const scene = read('src/circuit-lab/scene.tsx');
const canvas = read('src/circuit-lab/lab-canvas.tsx');
const css = read('src/index.css');
const editor = read('src/pages/CircuitEditorPage.tsx');

for (const color of ['#282f39', '#303843', '#46515f', '#5a6877']) {
  assert(palette.includes(color), `Palette missing ${color}`);
}
assert.match(scene, /<color attach="background" args=\{\[WORKBENCH_PALETTE\.background\]\}/);
assert.match(scene, /<fog attach="fog" args=\{\[WORKBENCH_PALETTE\.background,/);
assert.match(scene, /meshStandardMaterial color=\{WORKBENCH_PALETTE\.floor\}/);
assert.match(scene, /cellColor=\{WORKBENCH_PALETTE\.gridCell\}/);
assert.match(scene, /sectionColor=\{WORKBENCH_PALETTE\.gridSection\}/);
assert.match(canvas, /background: WORKBENCH_PALETTE\.background/);
assert.match(css, /\.editor-reference-ui \.editor-board-stage \{background:radial-gradient\(ellipse at 60% 44%,#323b47,#282f39 84%\)/);
assert.match(editor, /editor-board-stage[^\n]+bg-\[#282f39\]/);
for (const file of ['src/circuit-lab/workbench-palette.ts','src/circuit-lab/scene.tsx','src/circuit-lab/lab-canvas.tsx','src/pages/CircuitEditorPage.tsx']) {
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, kind);
  assert.equal(source.parseDiagnostics.length,0, `${file}: syntax diagnostics`);
}
console.log('Dark-gray 3D scene, matching fog/floor/grid, responsive fallback, source syntax: PASS');
