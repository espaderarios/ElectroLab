/** Regression contract: floating labels must not clutter an idle 3D board. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const parts = read('src/circuit-lab/parts-3d.tsx');
const editor = read('src/pages/CircuitEditorPage.tsx');
const overlay = read('src/circuit-lab/overlay.tsx');
const css = read('src/index.css');

assert.match(parts, /const PartLabelSelectionContext = React\.createContext<boolean \| null>\(null\)/);
assert.match(parts, /function Html\(props: React\.ComponentProps<typeof DreiHtml>\)/);
assert.match(parts, /if \(componentSelected === false\) return null/, 'Idle part annotations must be unmounted, not hidden via opacity');
assert.match(parts, /<PartLabelSelectionContext\.Provider value=\{selected && showLabels\}>/);
assert.doesNotMatch(parts, /onPointerMove=\{\(\) => setHovered\(true\)\}/);
assert.doesNotMatch(parts, /onPointerOut=\{\(\) => setHovered\(false\)\}/);
assert.doesNotMatch(parts, /window\.addEventListener\("pointermove", dismissOutside/, 'Component labels are never hover-state driven');
assert.match(parts, /selectedWireEndpoint === part\.pins\[name\] && <DreiHtml/, 'Arduino pin name requires explicit endpoint selection');
assert.match(parts, /selectedWireEndpoint === pinEntries\[index\]\[1\] && <DreiHtml/, 'Display pin names require explicit endpoint selection');
assert.match(parts, /The shared PartSwitch selection context controls this annotation/);
assert.match(parts, /new THREE\.CanvasTexture\(canvas\)/, 'LCD/OLED screen text must remain part of the 3D model');
assert.doesNotMatch(editor, /<div className="editor-stage-hud/, 'Remove always-visible floating top-left help');
assert.match(overlay, /tabIndex=\{0\}[\s\S]*?aria-label="Hover or focus for component placement instructions"/);
assert.match(css, /\.lab-placement-tip:not\(:hover\):not\(:focus-within\)/, 'Placement guidance stays collapsed until hover/focus');

for (const f of ['src/circuit-lab/parts-3d.tsx', 'src/circuit-lab/overlay.tsx', 'src/pages/CircuitEditorPage.tsx']) {
  const tree = ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(tree.parseDiagnostics.length, 0, `${f}: ${tree.parseDiagnostics.map(e => ts.flattenDiagnosticMessageText(e.messageText, ' ')).join('; ')}`);
}
console.log('Selected-only labels, explicit pin endpoint labels, unobstructed workbench, real LCD/OLED text: PASS');
