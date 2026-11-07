/** Compact sidebar/dock regression — source-level geometry and accessibility checks. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const cssText = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const editor = fs.readFileSync(path.join(root, 'src/pages/CircuitEditorPage.tsx'), 'utf8');
const dock = fs.readFileSync(path.join(root, 'src/circuit-lab/workbench-dock.tsx'), 'utf8');
const parsed = postcss.parse(cssText);
const blocks = [];
function visit(nodes, media = '') {
  for (const node of nodes) {
    if (node.type === 'atrule' && node.name === 'media') visit(node.nodes ?? [], node.params);
    else if (node.type === 'rule') blocks.push({ selector: node.selector, media, declarations: Object.fromEntries((node.nodes ?? []).filter(n => n.type === 'decl').map(n => [n.prop, n.value])) });
  }
}
visit(parsed.nodes);
const latest = (selector, media = '') => blocks.filter(x => x.selector === selector && x.media === media).at(-1);
const latestProperty = (selector, property, media = '') => blocks.filter(x => x.selector === selector && x.media === media && x.declarations[property] !== undefined).at(-1)?.declarations[property];
// The studio workspace replaces the old single sidebar width map with a
// genuinely three-column layout. Keep its narrower breakpoints under test.
assert.equal(latest('.editor-reference-ui .editor-sidebar').declarations.width, '270px');
for (const [media, expected] of [
  ['(max-width:1500px)', '245px'],
  ['(max-width:1250px)', '218px'],
  ['(max-width:760px)', '186px'],
]) assert.equal(latest('.editor-reference-ui .editor-sidebar', media)?.declarations.width, expected, `sidebar width at ${media}`);
assert.equal(latest('.editor-reference-ui .editor-studio-properties.is-closed').declarations.width, '42px');
assert.equal(latest('.editor-reference-ui .editor-diagnostics-body').declarations['max-height'], '132px');
assert.equal(latestProperty('.editor-reference-ui .editor-bench-power','min-height'), '42px');
assert.equal(latest('.editor-reference-ui .editor-parts-grid').declarations.gap, '6px');
assert.match(editor, /aria-label="Return to projects"/);
assert.doesNotMatch(editor, /className="editor-brand" aria-label="ElectroLab Circuit Simulator"/);
for (const label of ['Monitor', 'Wiring Guide', 'Truth Table', 'Show monitor & code', 'Hide bottom controls']) assert(dock.includes(label), `dock must preserve ${label}`);
console.log('Studio sidebar breakpoints, collapsible properties rail, compact monitor, retained controls and back button: PASS');
