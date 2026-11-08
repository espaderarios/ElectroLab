/** 2D physical breadboard shares the exact project and simulator model with 3D. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const editor = fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'),'utf8');
const view = fs.readFileSync(path.join(root,'src/circuit-lab/breadboard-2d.tsx'),'utf8');
const css = fs.readFileSync(path.join(root,'src/circuit-lab/breadboard-2d.css'),'utf8');
assert.equal(ts.createSourceFile('breadboard-2d.tsx', view, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics.length,0,'top-down view parses');
assert.match(editor, /<PhysicalBreadboard2D panMode=\{moveMode\}/,'2D toggle renders editable physical breadboard');
assert.match(editor, /\{use3D \? \(/,'2D and 3D share current project in one editor');
assert.doesNotMatch(editor, /Read-only 2D view of this breadboard/,'2D is no longer read-only');
assert.match(editor, /<StudioProperties open=\{propertiesOpen\}/,'properties accessible from either view');
assert.match(editor, /const showLibrary = \([\s\S]*?setRibbonTab\('insert'\)/,'Insert component picker shared');
assert.doesNotMatch(editor.slice(editor.indexOf('const showLibrary ='),editor.indexOf('const toggleMoreKinds =')),/setUse3D\(true\)/,'Insert does not switch away from 2D');
assert.match(editor, /PHYSICAL_2D_DROP_EVENT/,'palette drag releases to correct 2D coordinates');
for (const state of ['parts','wires','tool','sim','powerOn','psuPositive','psuNegative','boardId','selectedId']) {
  assert.match(view, new RegExp(`useLab\\(s=>s\\.${state}\\)`),`2D uses live shared ${state} state`);
}
for (const action of ['clickHole','placePartAt','moveSelectedTo','select','setSelectedProp','setTool','rotateSelected','deleteSelected','undo','redo']) {
  assert.match(view, new RegExp(`\\.${action}\\(`),`${action} works in 2D`);
}
assert.match(view, /getAllHoles\(\)/,'renders active board holes, not mockup dots');
assert.match(view, /terminalPosition\(id,parts\)/,'uses same electrical header geometry');
assert.match(view, /isOffboardController\(part\)/,'off-board controllers rendered independently');
assert.match(view, /wire\.bends/,'retains saved visual bends');
assert.match(view, /sim\.leds/,'live simulated LED illumination');
assert.match(view, /sim\.burned/,'damaged component warning');
assert.match(view, /sim\.shortCircuit/,'power faults exposed');
const modelArtwork = fs.readFileSync(path.join(root,'src/circuit-lab/physical-models-2d.tsx'),'utf8');
assert.match(view, /<PhysicalModel2D /,'renders the detailed physical-model library');
assert.match(modelArtwork, /function SevenDigit/,'draws individual physical seven-segment bars');
assert.doesNotMatch(view, />8888<\/text>/,'single digit is not erroneously drawn as four');
assert.match(view, /showWireFlow&&powerOn/,'wire flow animation shares 3D option');
assert.match(view, /aria-label=\{`Breadboard hole/,'holes are interactive and accessible');
assert.match(view, /aria-label=\{`\$\{readableLabel\(part\)\} pin/,'external terminals individually targetable');
assert.match(view, /pointerEvents=\{tool==='wire'/,'wires do not block new terminal clicks');
assert.match(css,/\.physical-2d-canvas\{width:100%;height:100%/,'top-down view fills the workspace');
assert.doesNotMatch(view, /const \[parts, setParts\]/,'2D cannot fork component data');
assert.doesNotMatch(view, /const \[wires, setWires\]/,'2D cannot fork wire data');
console.log('Physical 2D/3D shared-state editor, all input paths, headers, simulation and layout: PASS');
