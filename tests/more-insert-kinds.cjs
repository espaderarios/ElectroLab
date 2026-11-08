/** Insert ribbon More Kinds lists only categories not already pinned to the ribbon. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/pages/CircuitEditorPage.tsx'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8');
const ast = ts.createSourceFile('editor.tsx', page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
assert.equal(ast.parseDiagnostics.length, 0, 'TSX must parse');
function stringArray(name, map) {
  let result;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      let init = node.initializer;
      if (init && ts.isAsExpression(init)) init = init.expression;
      assert.ok(init && ts.isArrayLiteralExpression(init), `${name} must be an array`);
      result = init.elements.map(map);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(result, `found ${name}`);
  return result;
}
const visible = stringArray('RIBBON_INSERT_KINDS', item => item.text);
const literalCatalog = stringArray('PALETTE', item => {
  if (ts.isSpreadElement(item)) return null;
  assert.ok(ts.isObjectLiteralExpression(item));
  const title = item.properties.find(prop => ts.isPropertyAssignment(prop) && prop.name.getText(ast) === 'title');
  assert.ok(title, 'each palette section needs a title');
  return title.initializer.text;
}).filter(Boolean);
const expansionText = fs.readFileSync(path.join(root, 'src/circuit/expansion-catalog.ts'), 'utf8');
const expansionNames = expansionText.match(/export const EXPANSION_CATEGORIES\s*=\s*\[([^\]]+)\]/)[1]
  .match(/'[^']+'/g).map(text => text.slice(1, -1));
const catalog = [...literalCatalog, ...expansionNames];
assert.equal(visible.length, 6);
assert.equal(new Set(visible).size, visible.length);
for (const kind of visible) assert.ok(catalog.includes(kind), `pinned kind exists in catalog: ${kind}`);
const missing = catalog.filter(kind => !visible.includes(kind));
assert.ok(missing.length > 5, 'there should be additional kinds in the dropdown');
assert.equal(new Set(missing).size, missing.length, 'no duplicates in dropdown');
assert.match(page, /MORE_INSERT_KINDS\s*=\s*PALETTE\.filter\(/);
assert.match(page, /RIBBON_INSERT_KINDS\.map\(kind\s*=>/);
assert.match(page, /<button ref=\{moreKindsButtonRef\}[\s\S]{0,800}?onClick=\{toggleMoreKinds\}[\s\S]{0,200}?aria-expanded=\{moreKindsOpen\}/);
assert.match(page, /<div id="editor-more-kinds-menu" ref=\{moreKindsMenuRef\}/);
assert.match(page, /MORE_INSERT_KINDS\.map\(section\s*=>/);
assert.match(page, /onClick=\{\(\)\s*=>\s*showLibrary\('parts', section\.title\)\}/);
assert.match(page, /setPaletteOpen\(false\)\s*\n\s*setMoreKindsOpen\(true\)/);
assert.match(page, /if \(event\.key !== 'Escape'\) return/);
assert.match(page, /window\.addEventListener\('pointerdown', dismissOutside\)/);
assert.match(css, /\.editor-more-kinds-menu\s*\{\s*position:absolute;/);
assert.match(css, /max-height:min\(58vh,440px\);overflow-y:auto/);
console.log(`More Kinds dropdown: ${missing.length} exclusive kinds, pinned ${visible.length}, select/close/scroll checks: PASS`);
