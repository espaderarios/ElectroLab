const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

// Test the actual pure click-mode transition logic without requiring a browser.
require.extensions['.ts'] = (module, filename) => {
  const result = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  assert.equal(result.diagnostics?.filter(d => d.category === ts.DiagnosticCategory.Error).length ?? 0, 0);
  module._compile(result.outputText, filename);
};
const { nextToggleableTool } = require('../src/circuit/editor-toolbar-state.ts');
assert.equal(nextToggleableTool('select', 'select'), 'none');
assert.equal(nextToggleableTool('wire', 'wire'), 'none');
assert.equal(nextToggleableTool('none', 'select'), 'select');
assert.equal(nextToggleableTool('none', 'wire'), 'wire');
assert.equal(nextToggleableTool('select', 'wire'), 'wire');
assert.equal(nextToggleableTool('wire', 'select'), 'select');
assert.equal(nextToggleableTool('none', 'select', true), 'select', 'pan does not absorb the new tool');

const page = read('src/pages/CircuitEditorPage.tsx');
const sim = read('src/circuit-lab/index.tsx');
const part = read('src/circuit-lab/parts-3d.tsx');
assert.match(page, /onClick=\{\(\) => toggleToolbarTool\('select'\)\}/);
assert.match(page, /onClick=\{\(\) => toggleToolbarTool\('wire'\)\}/);
assert.match(page, /const next = !moveMode[\s\S]*?setMoveMode\(next\)[\s\S]*?setTool\('none'\)/);
assert.match(page, /aria-pressed=\{active\}/, 'Inactive buttons expose false rather than undefined');
assert.match(sim, /nextToggleableTool\(useLab\.getState\(\)\.tool, 'wire'\)/);
assert.match(sim, /nextToggleableTool\(useLab\.getState\(\)\.tool, 'select'\)/);
assert.match(part, /function useTransientPinHover\(\)/);
assert.match(part, /window\.addEventListener\("pointermove", clearOutsideCanvas/);
assert.match(part, /window\.addEventListener\("blur", clear\)/);
assert.match(part, /window\.removeEventListener\("pointermove", clearOutsideCanvas\)/);
assert.match(part, /hoveredPin === name && <DreiHtml/, 'Arduino header tooltip should only mount while hovering');
assert.match(part, /<PartLabelHoverContext\.Provider value=\{hovered\}>/, 'All component labels are contextual');

// A syntax check catches inadvertent JSX breakage from conditional label edits.
for (const file of ['src/pages/CircuitEditorPage.tsx', 'src/circuit-lab/parts-3d.tsx', 'src/circuit-lab/index.tsx']) {
  const abs = path.join(root, file);
  const sf = ts.createSourceFile(abs, read(file), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(sf.parseDiagnostics.length, 0, `${file}: ${sf.parseDiagnostics.map(d => d.messageText).join(',')}`);
}
console.log('Select/Wire/Pan toggle-off, keyboard consistency, transient Arduino/LCD labels and JSX syntax: PASS');
