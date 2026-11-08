/** Arduino Code side utility must dedicate its height to sketch + live console,
 * without repeating bench power, graphics and drag settings. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const read = pathName => fs.readFileSync(path.join(root, pathName), 'utf8');
const dock = read('src/circuit-lab/workbench-dock.tsx');
const utilities = read('src/circuit-lab/workbench-utilities.tsx');
const css = read('src/index.css');
for (const pathName of ['src/circuit-lab/workbench-dock.tsx','src/circuit-lab/workbench-utilities.tsx']) {
  const sf = ts.createSourceFile(pathName, read(pathName), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(sf.parseDiagnostics.length, 0, `${pathName} parses`);
}
postcss.parse(css);
assert.match(dock, /sidebar && tab === 'code' \? 'editor-code-workspace'/);
assert.match(dock, /!\(sidebar && tab === 'code'\) && <div className="editor-diagnostics-toolbar">/);
assert.match(dock, /tab === 'code' && <div className="editor-studio-code-split"><ArduinoCodePanel .*<SimulationConsole/s);
assert.match(dock, /aria-label="Arduino sketch code editor"/);
assert.match(dock, /onClick=\{commit\}/);
assert.match(dock, /onClick=\{run\}/);
assert.match(utilities, /editor-utilities-code-body/);
assert.match(css, /\.editor-workbench-utilities\.is-open\[data-utility-tab="code"\] \{\s*width: clamp\(480px, 47vw, 800px\)/);
assert.match(css, /\.editor-code-workspace \.editor-arduino-code-textarea \{[\s\S]*?flex: 1 1 auto;[\s\S]*?max-height: none;/);
assert.match(css, /\.editor-code-workspace \.editor-simulation-console \{[\s\S]*?flex: 0 0 27%;/);
assert.match(css, /\.editor-utilities-code-body \{[\s\S]*?overflow: hidden;/);
assert.doesNotMatch(utilities, /<WorkbenchDock /, 'bottom panel must remain removed');
console.log('Arduino Code focused editor + console, expanded vertical editor, preserved save/run and no redundant controls: PASS');
