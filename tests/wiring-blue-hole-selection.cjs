/** UI+store regression: style buttons arm Wire mode and selection halos are non-interactive. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const page = fs.readFileSync(path.resolve(__dirname, '../src/pages/CircuitEditorPage.tsx'),'utf8');
const scene = fs.readFileSync(path.resolve(__dirname, '../src/circuit-lab/scene.tsx'),'utf8');
const store = fs.readFileSync(path.resolve(__dirname, '../src/store/lab.ts'),'utf8');
for (const [name,source] of [['editor',page],['scene',scene]]) {
  const parse = ts.createSourceFile(`${name}.tsx`, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(parse.parseDiagnostics.length, 0, `${name} must remain valid TSX`);
}
const ribbon = page.slice(page.indexOf("{ribbonTab === 'wiring' && <>"),page.indexOf("{ribbonTab === 'simulation' && <>"));
assert.ok(ribbon.includes("(['solid','jumper'] as WireStyle[]).map"));
assert.match(ribbon,/lab\.setWireStyle\(style\);[\s\S]*?if \(lab\.tool !== 'wire'\) selectTool\('wire'\)/,'Clicking either wire style arms wire mode');
assert.doesNotMatch(ribbon,/label="Wire"/,'No redundant Wire button in Wiring tab');
assert.match(ribbon,/activeTool==='wire' && wireStyle===style/,'Selected style becomes active only in Wire mode');
assert.match(scene,/const showPicked = tool === "wire" \|\| \(!partDragEnabled/,'Show picked nodes in wire and drag-disabled component modes');
assert.match(scene,/kind: "pending"/,'Render all selected pending endpoints');
assert.match(scene,/const color = picked \? "#3b82f6"/,'Persistent picked pins are blue');
assert.match(scene,/const y = onBoard \? BOARD\.height \+ 0\.098/,'Halo sits above physical breadboard well');
assert.equal((scene.match(/raycast=\{\(\) => null\}/g)||[]).length>=3,true,'All halo geometries must pass pointer through to holes');
assert.match(store,/if \(!state\.partDragEnabled\) \{[\s\S]*?pendingHoles: holes/,'Drag-disabled placement retains multiple selected pins');
assert.match(store,/if \(placement\.kind === "wire"\) \{[\s\S]*?pendingHoles: holes/,'Wire mode retains the first selected endpoint');
console.log('Wiring style auto-activation, clear blue hole rings, safe click-through: PASS');
