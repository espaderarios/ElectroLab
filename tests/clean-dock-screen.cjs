/** Regression: no duplicate bottom power buttons; readable in-glass text. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const dock = read('src/circuit-lab/workbench-dock.tsx');
const model = read('src/circuit-lab/parts-3d.tsx');
const page = read('src/pages/CircuitEditorPage.tsx');
const css = read('src/index.css');
for (const name of ['src/circuit-lab/workbench-dock.tsx','src/circuit-lab/parts-3d.tsx']) {
  assert.equal(ts.createSourceFile(name, read(name), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length, 0, `${name} parses`);
}
postcss.parse(css);
assert.doesNotMatch(dock, /Power On|Power Off|editor-power-actions/, 'No duplicated power-toggle buttons in the bottom dock');
assert.match(dock, /editor-diagnostics-toolbar/, 'Settings must share the compact diagnostics toolbar');
assert.match(dock, /role="group" aria-label="Workbench voltage and graphics settings"/, 'Retain non-duplicate workbench settings');
assert.match(dock, /editor-power-voltage/, 'Keep editable voltage');
assert.match(dock, /editor-power-current/, 'Keep live current status');
assert.match(dock, /editor-graphics-quality/, 'Keep four quality presets');
assert.match(dock, /editor-bench-drag/, 'Keep 3D dragging');
assert.match(dock, /Show monitor & code/, 'Collapse hint should describe the remaining controls');
assert.match(page, /editor-studio-run/, 'Top Run control must remain usable');
assert.match(css, /\.editor-reference-ui \.editor-diagnostics-toolbar \.editor-dock-instruments/, 'Compact styling must be present');
const oled = model.split('export function OledMesh(')[1].split('const TRANSISTOR_META')[0];
assert.match(oled, /canvas\.width = 1024;/);
assert.match(oled, /canvas\.height = 512;/);
assert.match(oled, /count <= 2 \? 59 : 48/, 'Short OLED text uses a larger adaptive font');
assert.match(oled, /ctx\.measureText\(line\)/, 'Long lines must fit the OLED glass');
assert.match(oled, /ctx\.clip\(\)/, 'OLED pixel content must be clipped');
assert.match(oled, /texture\.anisotropy = 16;/, 'Readable text when the model is angled');
assert.match(oled, /toneMapped=\{false\}/, 'OLED emissive text stays bright');
const lcd = model.split('export function LcdMesh(')[1].split('export function OledMesh(')[0];
assert.match(lcd, /canvas\.width = 1024;/);
assert.match(lcd, /canvas\.height = 256;/);
assert.match(lcd, /ctx\.scale\(4, 4\)/);
console.log('Compact dock without duplicate power buttons; adaptive crisp OLED/LCD text: PASS');
