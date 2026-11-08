/* ElectroLab studio navy-blue palette regression, without changing circuit colors. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root,p),'utf8');
const css = read('src/index.css');
const studio = css.slice(css.indexOf('/* ElectroLab Studio —'));
const tailwind = read('tailwind.config.js');
const dock = read('src/circuit-lab/workbench-dock.tsx');
const page = read('src/pages/CircuitEditorPage.tsx');
assert.ok(studio.length > 2000, 'Studio styles must exist');
postcss.parse(css, {from:'src/index.css'});
postcss.parse(read('src/styles.css'), {from:'src/styles.css'});
for (const token of ['--studio-accent:#2a65ab', '--studio-accent-soft:#91c2f0'])
  assert.ok(studio.includes(token), `Missing navy token ${token}`);
for (const token of ['#194479', '#2466ab', '#1d4d86', '#1b518b', '#153d70'])
  assert.ok(studio.includes(token), `Missing navy active state ${token}`);
for (const selector of ['.editor-studio-modes button.active','.editor-view-switch button.active',
  '.editor-workspace-tabs button.active','.editor-properties-tabs button.active',
  '.editor-diagnostics-tabs button.active','.editor-toolbar-action.active',
  '.editor-properties-primary', '.editor-main-action'])
  assert.ok(studio.includes(selector), `Missing studio selector ${selector}`);
// Detect genuinely purple colors only within studio UI CSS, not meaningful 3D LED colors.
const colors = studio.match(/#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?\b/g) || [];
function hue(c) {
  const [r,g,b] = [1,3,5].map(n => parseInt(c.slice(n,n+2),16)/255);
  const max=Math.max(r,g,b), min=Math.min(r,g,b),d=max-min;
  if(d===0) return {h:0,s:0,v:max};
  let h=max===r?((g-b)/d)%6:max===g?(b-r)/d+2:(r-g)/d+4;
  return {h:(h*60+360)%360,s:d/max,v:max};
}
const purple = colors.filter(c=>{const x=hue(c);return x.h>=242&&x.h<=315&&x.s>.13&&x.v>.19;});
assert.deepEqual([...new Set(purple)], [], `Studio theme still has purple: ${purple.join(', ')}`);
assert.match(tailwind,/const cobalt = \{/);
assert.match(tailwind,/900:'#102d53'/);
assert.match(tailwind,/violet:cobalt/);
assert.match(page,/editor-ribbon-panel/);
assert.match(dock,/editor-diagnostics-toolbar/);
assert.doesNotMatch(dock,/Power On|Power Off|editor-power-actions/, 'Power buttons must not return to dock');
assert.match(read('src/circuit/types.ts'),/red: "#c2413b"/, 'Real wire colors preserved');
console.log('Navy theme: studio active states, focus, workspace, properties and dock use navy; no purple accents; circuit colors preserved: PASS');
