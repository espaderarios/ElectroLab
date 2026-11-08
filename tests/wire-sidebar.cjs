/** Wire commands remain in the Wiring ribbon, not a component sidebar. */
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const page=fs.readFileSync(path.resolve(__dirname,'../src/pages/CircuitEditorPage.tsx'),'utf8');
assert.match(page,/if \(use3D && activeTool === 'wire'\) \{\s*setRibbonTab\('wiring'\)\s*setPaletteOpen\(false\)/,'W shortcut opens Wiring tab rather than a parts sidebar');
assert.match(page,/if \(next === 'wire'\) \{\s*setRibbonTab\('wiring'\)\s*setPaletteOpen\(false\)/,'Wire command moves to Wiring tab');
assert.match(page,/lab\.setWireStyle\(style\);[\s\S]*?if \(lab\.tool !== 'wire'\) selectTool\('wire'\)/,'Solid and Jumper activate Wire mode automatically');
const wiring = page.slice(page.indexOf("{ribbonTab === 'wiring' && <>"),page.indexOf("{ribbonTab === 'simulation' && <>"));
assert.doesNotMatch(wiring,/label="Wire"/,'The Wiring ribbon avoids a duplicate explicit Wire button');
assert.match(page,/setWireStyle\(style\)/);
assert.match(page,/setWireColor\(color\)/);
assert.match(page,/onStartWiring=\{\(\) => \{setUse3D\(true\);setRibbonTab\('wiring'\)/,'Dock wiring action moves to Wiring tab');
assert.doesNotMatch(page,/<aside id="editor-library-panel"/);
assert.equal(ts.createSourceFile('editor.tsx',page,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX).parseDiagnostics.length,0);
console.log('Wiring ribbon: wire tools, wire styles, wire colors, shortcuts and dock navigation: PASS');
