/** The four circuit tools have icon-only launchers, distinct controlled content,
 * and accessible hover/focus labels. No standalone Utilities menu remains. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname,'..');
const read = p => fs.readFileSync(path.join(root,p),'utf8');
const page = read('src/pages/CircuitEditorPage.tsx');
const panel = read('src/circuit-lab/workbench-utilities.tsx');
const css = read('src/index.css');
const dock = read('src/circuit-lab/workbench-dock.tsx');
for (const filename of ['src/pages/CircuitEditorPage.tsx','src/circuit-lab/workbench-utilities.tsx']) {
  const source = ts.createSourceFile(filename,read(filename),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(source.parseDiagnostics.length,0,`${filename} must parse correctly`);
}
const labels = ['Monitor','Wiring Guide','Truth Table','Arduino Code'];
const types = ['monitor','guide','truth','code'];
for (let i=0;i<labels.length;i++) {
  assert.ok(page.includes(`tab: '${types[i]}', label: '${labels[i]}'`),`${labels[i]} has a separate icon`);
  assert.ok(panel.includes(`${types[i]}: {label: '${labels[i]}'`),`${labels[i]} has distinct content and a heading`);
}
assert.match(page, /className="editor-utility-launcher-group"/);
assert.match(page, /aria-label="Circuit utility panels"/);
assert.match(page, /aria-label=\{`Open \$\{label\} panel`\}/);
assert.match(page, /data-tooltip=\{label\}/);
assert.match(page, /onClick=\{\(\) => toggleUtilityPanel\(tab\)\}/);
assert.match(page, /utilitiesOpen && utilityTab === tab/);
assert.match(page, /setUtilitiesOpen\(false\);\s*return;/,'same icon closes active utility');
assert.match(page, /setUtilityTab\(tab\);/,'different icon switches utility');
assert.match(page, /setPropertiesOpen\(false\);\s*setUtilityTab\(tab\)/,'tool selection dismisses separate Properties panel');
assert.match(page, /aria-label="Toggle Properties sidebar"/);
assert.doesNotMatch(page, /aria-label="Toggle Utilities sidebar"|<span>Utilities<\/span>/);
assert.match(panel, /tab=\{tab\} showDetails onTabChange=\{select\}/);
assert.match(panel, /utilityItems\[tab\]/);
assert.match(panel, /onTabChange\('code'\)/,'top code commands open the same code panel');
assert.match(panel, /onTabChange\('monitor'\)/,'top monitor commands open the same monitor panel');
assert.match(panel, /<WorkbenchSidebarContent/,'actual diagnostic content remains mounted');
assert.match(dock, /<ArduinoCodePanel/);
assert.match(dock, /<SimulationConsole/);
assert.match(css, /\.editor-utility-launcher:hover::after/,'visible hover tooltip');
assert.match(css, /\.editor-utility-launcher:focus-visible::after/,'keyboard tooltip');
assert.match(css, /content:attr\(data-tooltip\)/,'tooltip text mirrors the accessible button name');
assert.match(css, /\.editor-workbench-utilities\.is-open\[data-utility-tab="code"\]/,'code pane receives more editing width');
assert.doesNotMatch(page, /<WorkbenchDock projectId=/,'bottom drawer remains retired');
console.log('Four direct icon launchers, hover/focus tooltips, utility switching, shared code/monitor, no bottom drawer: PASS');
