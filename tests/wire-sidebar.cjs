/** UI regression for automatically revealing the wire controls. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'), 'utf8');

assert.match(page, /if \(next === 'wire'\)\s*\{\s*setSidebarTab\('parts'\)\s*setPaletteOpen\(true\)/,
  'Clicking Wire must reveal the Parts sidebar');
assert.match(page, /if \(use3D && activeTool === 'wire'\)\s*\{\s*setSidebarTab\('parts'\)\s*setPaletteOpen\(true\)/,
  'Entering Wire mode by keyboard or another tool must also reveal Parts');
assert.match(page, /onClick=\{\(\) => toggleToolbarTool\('wire'\)\}/,
  'Wire toolbar button must use the toggle handler');
assert.match(page, /\{activeTool === 'wire' && <section className="editor-wire-controls"/,
  'Parts sidebar should show wire styles and colors in Wire mode');
assert.match(page, /onClick=\{\(\) => setPaletteOpen\(v=>!v\)\}/,
  'Manual sidebar toggle must remain available');

const file = path.join(root, 'src/pages/CircuitEditorPage.tsx');
const tree = ts.createSourceFile(file, page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(tree.parseDiagnostics.length, 0, `TSX syntax: ${tree.parseDiagnostics.map(x=>x.messageText).join(', ')}`);
console.log('Wire opens Parts for toolbar/keyboard; wire options visible; manual close and toggle-off preserved: PASS');
