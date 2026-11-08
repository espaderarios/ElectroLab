/** Selection-driven component names; hover never mounts floating 3D text. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
const parts = read('src/circuit-lab/parts-3d.tsx');
const exp = read('src/circuit-lab/expansion-meshes.tsx');
const scene = read('src/circuit-lab/scene.tsx');
const css = read('src/index.css');
assert.match(parts, /<PartLabelSelectionContext\.Provider value=\{selected && showLabels\}>/);
assert.doesNotMatch(parts, /onPointerMove=\{\(\) => setHovered\(true\)\}/);
assert.doesNotMatch(parts, /onPointerOver=\{\(\) => setHovered\(true\)\}/);
assert.match(parts, /selectedWireEndpoint === part\.pins\[name\] && <DreiHtml/);
assert.equal((parts.match(/selectedWireEndpoint === pinEntries\[index\]\[1\] && <DreiHtml/g) || []).length,2);
assert.doesNotMatch(parts, /hoveredPin === pinEntries\[index\]\[0\] && <DreiHtml/);
assert.match(exp, /activePin && <Html/);
assert.equal((exp.match(/activePin && <Html/g)||[]).length,2);
assert.doesNotMatch(exp, /hovered && <Html/);
assert.equal((exp.match(/selected && showSelectedLabel && <Html/g)||[]).length,2);
assert.match(scene, /<PartSwitch part=\{preview\} selected sim=\{sim\} showLabels=\{false\}/);
assert.match(css, /\.ece-selected-part-tooltip/);
for(const file of ['src/circuit-lab/parts-3d.tsx','src/circuit-lab/expansion-meshes.tsx','src/circuit-lab/scene.tsx']){
 const source=ts.createSourceFile(file,read(file),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 assert.equal(source.parseDiagnostics.length,0,`${file} JSX parsing error`);
}
console.log('PASS: selected-only floating labels, explicit wire pins, no hover tooltips and no placement ghost labels');
