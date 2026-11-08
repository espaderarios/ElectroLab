/** Separate Properties and Utilities rails; no bottom navigation. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const page=read('src/pages/CircuitEditorPage.tsx');
const utilities=read('src/circuit-lab/workbench-utilities.tsx');
const inspector=read('src/circuit-lab/studio-properties.tsx');
const dock=read('src/circuit-lab/workbench-dock.tsx');
const css=read('src/index.css');
for (const file of ['src/pages/CircuitEditorPage.tsx','src/circuit-lab/workbench-utilities.tsx','src/circuit-lab/studio-properties.tsx','src/circuit-lab/workbench-dock.tsx']) {
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(source.parseDiagnostics.length,0,`${file} should parse`);
}
assert.match(page,/<div className="editor-right-side-system">/);
assert.match(page,/<StudioProperties open=\{propertiesOpen\}/);
assert.match(page,/<WorkbenchUtilities open=\{utilitiesOpen\}/);
assert.match(page,/aria-label="Toggle Properties sidebar"/);
assert.match(page,/aria-label="Circuit utility panels"/);
assert.ok(page.indexOf('<StudioProperties open=') < page.indexOf('<WorkbenchUtilities open='));
assert.ok(page.indexOf('<WorkbenchUtilities open=') < page.indexOf('className="editor-right-side-launchers"'));
assert.doesNotMatch(page,/<WorkbenchDock projectId=/,'Legacy bottom drawer not mounted');
assert.match(utilities,/aria-label="Workbench utilities"/);
for(const label of ['Monitor','Wiring Guide','Truth Table','Arduino Code']) assert.ok(utilities.includes(label));
assert.match(utilities,/WorkbenchSidebarContent/);
assert.doesNotMatch(inspector,/WorkbenchSidebarContent|editor-sidebar-utility-nav/,'Utilities must NOT live inside Properties');
assert.match(inspector,/id="electrolab-studio-inspector"/,'component inspector retains portal target');
assert.match(dock,/getDisplayWiringGuides/);
assert.match(dock,/SimulationConsole/);
assert.match(dock,/ArduinoCodePanel/);
assert.match(css,/\.editor-right-side-launchers/);
assert.match(css,/\.editor-workbench-utilities\.is-open/);
assert.match(page,/setUtilitiesOpen\(false\)/,'focus/selection must dismiss Utilities');
console.log('Independent right rail, Utilities navigation, no bottom drawer, preserved properties and simulation: PASS');

assert.doesNotMatch(page,/aria-label="Toggle Utilities sidebar"/,'No redundant Utilities launcher');
