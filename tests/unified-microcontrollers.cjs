/** One category for Uno, Nano, Mega, ESP32 and Pico, without changing their IDs or headers. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/pages/CircuitEditorPage.tsx'),'utf8');
const catalog = fs.readFileSync(path.join(root,'src/circuit/expansion-catalog.ts'),'utf8');
const library = fs.readFileSync(path.join(root,'src/pages/ComponentLibrary.tsx'),'utf8');
assert.equal(ts.createSourceFile('page.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
assert.match(page, /title: 'Microcontrollers'/);
assert.match(page, /EXPANSION_COMPONENTS\.filter\(spec => spec\.category === 'Microcontrollers'\)/);
assert.doesNotMatch(page, /'Microcontrollers','Controllers'/);
assert.doesNotMatch(catalog, /category:'Controllers'/);
assert.match(library, /name: "Arduino Uno"[^\n]+type: "Microcontrollers"/);
assert.doesNotMatch(library, /"Controllers"/);
const match = [...catalog.matchAll(/\{id:'(board-(?:nano|mega|esp32|pico))'[^\n]+category:'Microcontrollers'/g)];
assert.deepEqual(match.map(m=>m[1]).sort(), ['board-esp32','board-mega','board-nano','board-pico']);
assert.match(page, /id: 'mcu', label: 'Arduino Uno'/);
assert.match(page, /All parts \(\{paletteCount\}\)/);
// One section produces 5 items but leaves every stable tool and model ID unchanged.
assert.equal(match.length + 1,5);
console.log('Unified Microcontrollers category: Uno, Nano, Mega, ESP32, Pico and preserved electrical IDs: PASS');
