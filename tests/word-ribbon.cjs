/** Source-contract checks for the functional Word-inspired ribbon. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'),'utf8');
const dock = fs.readFileSync(path.join(root,'src/circuit-lab/workbench-dock.tsx'),'utf8');
const css = fs.readFileSync(path.join(root,'src/index.css'),'utf8');
for (const [name,code] of [['editor',page],['dock',dock]]) {
  assert.equal(ts.createSourceFile(`${name}.tsx`,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0,`${name} TSX syntax`);
}
postcss.parse(css);
const tabsStart = page.indexOf('<div className="editor-ribbon-tabs"');
const panelStart = page.indexOf('id="editor-ribbon-panel"');
const panelEnd = page.indexOf('</header>',panelStart);
const tabs = page.slice(tabsStart,panelStart);
const panel = page.slice(panelStart,panelEnd);
assert.ok(tabsStart>0 && panelStart>tabsStart && panelEnd>panelStart,'new ribbon rows exist');
for (const key of ['home','insert','wiring','simulation','view']) assert.ok(tabs.includes(`['${key}',`),`ribbon ${key} tab`);
for (const key of ['home','insert','wiring','simulation','view']) assert.ok(panel.includes(`ribbonTab === '${key}'`),`ribbon ${key} contextual group`);
assert.match(page,/!ribbonCollapsed && <div id="editor-ribbon-panel"/,'ribbon collapses completely');
assert.match(page,/setRibbonCollapsed\(v => !v\)/,'ribbon button toggles');
assert.match(page,/e\.ctrlKey && e\.key === 'F1'/,'Ctrl+F1 shortcut');
assert.doesNotMatch(tabs,/editor-ribbon-library-toggle/,'Components toggle retired');
assert.match(panel,/aria-label="Insert component kinds"/,'insert ribbon groups by kind');
assert.match(page,/\{paletteOpen && use3D && ribbonTab === 'insert' && !ribbonCollapsed/,'floating Insert gallery visibility follows ribbon');
assert.doesNotMatch(page,/<aside id="editor-library-panel"/,'no permanent component sidebar');
assert.match(page,/useState\(false\)\n  \/\/ Component Library|setPaletteOpen\(false\)/,'space-saving sidebar collapse supported');
assert.match(page,/const \[propertiesOpen, setPropertiesOpen\] = useState\(false\)/,'Properties minimized until used');
assert.match(page,/if \(selectedItem && selectedItem !== lastSelectedForInspectorRef\.current && !focusMode\)/,'selected part reveals inspector');
assert.match(page,/const toggleFocusMode = \(\) =>/,'Focus mode has working callback');
assert.match(page,/setPaletteOpen\(false\)[\s\S]*setPropertiesOpen\(false\)[\s\S]*setRibbonCollapsed\(true\)/,'Focus mode maximizes workbench');
assert.match(dock,/const visibleExpanded = expanded && !props\.focusMode/,'Focus hides bottom monitor without destroying content');
assert.match(dock,/props\.onExitFocusMode\?\.\(\)/,'bottom monitor can exit Focus mode');
for (const label of ['Select','Pan','Wire','Undo','Redo','Rotate','Delete','Fit board','Focus parts','Zoom in','Zoom out','Fullscreen'])
  assert.ok(panel.includes(`label="${label}"`),`${label} still accessible`);
for (const action of ["toggleToolbarTool('wire')","setWireStyle(style)","setWireColor(color)","setShowWireFlow(!showWireFlow)","setOpenArduinoCodeRequest(request=>request+1)","setOpenMonitorRequest(request=>request+1)","handleRunSimulation", "togglePower()"])
  assert.ok(page.includes(action), `${action} remains functional`);
assert.match(css,/\.editor-reference-ui \.editor-ribbon-panel\s*\{[^}]*overflow-x:auto/s,'commands scroll on constrained screens');
assert.match(css,/\.editor-reference-ui \.editor-ribbon-group-label/,'ribbon commands labeled by group');
assert.match(css,/@media\(max-width:740px\)[\s\S]*?editor-insert-gallery/,'mobile insert gallery fits viewport');
console.log('Word ribbon: tabs, wiring/sim handlers, responsive layout, accessible collapse, Focus mode and inspector: PASS');
