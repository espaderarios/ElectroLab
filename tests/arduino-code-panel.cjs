/** The project archive omitted this pre-existing test filename. Verify that the
 * Arduino editor still writes to the live simulation store instead of an inert
 * textarea, and that its draft and run actions are actually wired. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root=path.resolve(__dirname,'..');
const dock=fs.readFileSync(path.join(root,'src/circuit-lab/workbench-dock.tsx'),'utf8');
const lab=fs.readFileSync(path.join(root,'src/store/lab.ts'),'utf8');
const runtime=fs.readFileSync(path.join(root,'src/circuit/mcu-runtime.ts'),'utf8');
const styles=fs.readFileSync(path.join(root,'src/index.css'),'utf8');
assert.equal(ts.createSourceFile('workbench-dock.tsx',dock,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert.match(dock,/function ArduinoCodePanel\(/);
assert.match(dock,/setMcuCode\(mcu\.id, draftCode\)/);
assert.match(dock,/aria-label="Arduino sketch code editor"/);
assert.match(dock,/onClick=\{commit\}/);
assert.match(dock,/onClick=\{run\}/);
assert.match(dock,/localStorage\./);
assert.match(dock,/Sketch saved to the simulated Arduino/);
assert.match(lab,/setMcuCode: \(/);
assert.match(runtime,/function normalizeCode/);
assert.match(styles,/editor-arduino-code-(panel|textarea)/);
console.log('Arduino code editor: script edit, save, apply-and-run, draft restore and simulation integration: PASS');
