/** Reference-inspired shell regression tests; source contracts, not browser/WebGL screenshots. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const page = read('src/pages/CircuitEditorPage.tsx');
const dock = read('src/circuit-lab/workbench-dock.tsx');
const overlay = read('src/circuit-lab/overlay.tsx');
const lab = read('src/circuit-lab/index.tsx');
const css = read('src/index.css');
for(const filename of ['src/pages/CircuitEditorPage.tsx','src/circuit-lab/workbench-dock.tsx','src/circuit-lab/overlay.tsx','src/circuit-lab/index.tsx']) {
 const txt=read(filename);
 const parsed=ts.createSourceFile(filename,txt,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(parsed.parseDiagnostics.length,0,`parse error in ${filename}`);
}
for(const tab of ['parts','circuits','examples']) assert.match(page,new RegExp(`sidebarTab==='${tab}'`),`missing ${tab} navigation`);
for(const control of ['Zoom in','Zoom out','Fit board','Fullscreen','Select','Pan','Wire','Delete','Undo','Redo']) assert.ok(page.includes(`label="${control}"`),`missing ${control} button`);
assert.match(page,/<WorkbenchDock projectId=/);
assert.match(lab,/LabOverlay showPalette=\{false\} embedded/,'3D scene overlay should not duplicate dock power controls');
assert.match(overlay,/!embedded &&/,'overlay power bar should be optional');
assert.match(dock,/aria-label="Power supply voltage"/);
assert.match(page,/lab\.togglePower\(\)/,'top Run control must power on the simulation without duplicate bottom buttons');
assert.doesNotMatch(dock, /editor-power-actions|Power On|Power Off/,'bottom dock must not duplicate power controls');
assert.match(dock,/useLab\.getState\(\)\.toggleSwitch\(p\.id\)/,'input switches must actually toggle physical parts');
assert.match(dock,/sim\.leds\[part\.id\]/,'output indicators must use simulated LEDs');
assert.match(dock,/getDisplayWiringGuides/,'wiring guides must use net connectivity');
assert.match(dock,/logicRows\(fullAdder\)/,'truth table depends on project type');
assert.match(dock,/setGuideTarget\(\{a:link\.fromHole,b:link\.toHole\}\)/,'guide pin click must highlight endpoints');
assert.match(page,/openPremade\(project\.id\)/,'examples must open stored projects');
assert.match(page,/useLab\.getState\(\)\.select\(part\.id\)/,'parts in current circuit list must select real objects');
assert.match(page,/document\.fullscreenElement/);
for(const cls of ['editor-reference-ui','editor-workspace-tabs','editor-bench-power','editor-diagnostics-tabs','editor-output-led','editor-truth-table']) assert.ok(css.includes(`.${cls}`),`missing ${cls} styling`);
assert.match(css,/@media\(max-width:1050px\)/,'toolbar must have compact breakpoint');
assert.match(css, /prefers-reduced-motion:reduce/,'animations need reduced-motion handling');
console.log('Reference-inspired shell: tabs, actions, power, display monitor, truth table, wiring guide and responsive CSS: PASS');
