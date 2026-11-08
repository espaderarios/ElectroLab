/** Bottom dock and Fast 3D source contracts. Browser GPU performance must be measured separately. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const dock = read('src/circuit-lab/workbench-dock.tsx');
const page = read('src/pages/CircuitEditorPage.tsx');
const canvas = read('src/circuit-lab/lab-canvas.tsx');
const scene = read('src/circuit-lab/scene.tsx');
const lab = read('src/circuit-lab/index.tsx');
const css = read('src/index.css');
for (const name of ['src/circuit-lab/workbench-dock.tsx','src/pages/CircuitEditorPage.tsx','src/circuit-lab/lab-canvas.tsx','src/circuit-lab/scene.tsx','src/circuit-lab/index.tsx']) {
 const parsed = ts.createSourceFile(name,read(name),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,`${name} must parse`);
}
assert.match(dock,/editor-dock-handle-row/,'real bottom-edge handle is required');
assert.match(dock,/Hide bottom controls/);
assert.match(dock,/Show monitor & code/);
assert.match(dock,/aria-expanded=\{visibleExpanded\}/,'expansion must be accessible');
assert.match(dock,/visibleExpanded && <div id="editor-workbench-controls"><WorkbenchDockContent/,'heavy diagnostic content must unmount when hidden');
assert.match(dock,/localStorage\.setItem\(DOCK_STORAGE_KEY/,'dock state must persist');
assert.match(dock,/event\.altKey/,'keyboard shortcut must be guarded');
assert.match(dock,/Fast 3D/,'rendering quality control must be reachable');
assert.match(page,/<CircuitLab performanceMode=\{performanceMode\}/);
assert.match(page,/<WorkbenchDock projectId=\{projectId\} focusMode=\{focusMode\}/);
assert.match(lab,/<Canvas performanceMode=\{performanceMode\}/);
assert.match(canvas,/dpr=\{performanceMode \? 1 : /,'Fast 3D must lower pixel ratio');
assert.match(canvas,/shadows=\{!performanceMode\}/,'Fast 3D must turn off shadow mapping');
assert.match(canvas,/frameloop=\{performanceMode \? \"demand\" : \"always\"\}/,'Fast 3D should avoid an unrestricted animation loop');
assert.match(canvas,/window\.clearInterval\(interval\)/,'Fast mode frame scheduler must clean up');
assert.match(scene,/!performanceMode && <ContactShadows/,'Fast 3D must skip costly contact shadows');
assert.match(scene,/tickSimulation\(Math\.min\(elapsed, 100\)\)/,'MCU ticks must remain available');
for (const selector of ['.editor-dock-handle-row','.editor-dock-handle','.editor-quality-switch']) assert.ok(css.includes(selector));
console.log('Bottom drawer toggle, persisted state, diagnostics unmount, Fast 3D rendering and MCU tick contracts: PASS');
