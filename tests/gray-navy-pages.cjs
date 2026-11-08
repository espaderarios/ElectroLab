/* Verify the gray reference palette was preserved, interactive accents are
   navy, and GitHub Pages editor deep links use the correct built asset base. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const css = read('src/index.css');
const sheet = postcss.parse(css, {from: 'src/index.css'});
function ruleBody(selector) {
  const matches = [];
  sheet.walkRules(rule => {
    if (rule.selector === selector) matches.push(rule);
  });
  assert.ok(matches.length, `Missing CSS selector ${selector}`);
  return matches.map(rule => rule.toString().toLowerCase()).join('\n');
}
const gray = [
  ['.editor-reference-ui.editor-workspace', '#191c24'],
  ['.editor-reference-ui .editor-topbar', '#242630'],
  ['.editor-reference-ui .editor-actions', '#20222b'],
  ['.editor-reference-ui .editor-sidebar', '#232630'],
  ['.editor-reference-ui .editor-studio-properties', '#282a35'],
  ['.editor-reference-ui .editor-diagnostics', '#242730'],
];
for (const [selector,color] of gray) {
  const body=ruleBody(selector);
  assert.ok(body.includes(color), `${selector} lost neutral gray ${color}`);
}
for (const [selector,color] of [
  ['.editor-reference-ui .editor-studio-modes button.active', '#194479'],
  ['.editor-reference-ui .editor-view-switch button.active', '#2765aa'],
  ['.editor-reference-ui .editor-diagnostics-tabs button.active', '#1d4d86'],
  ['.editor-reference-ui .editor-main-action', '#153d70'],
]) assert.ok(ruleBody(selector).includes(color), `Navy accent missing from ${selector}`);
const vite = read('vite.config.ts');
assert.match(vite, /command\s*===\s*'serve'\s*\?\s*'\/'\s*:\s*mode\s*===\s*'desktop'\s*\?\s*'\.\/'\s*:\s*'\/ElectroLab\/'/);
// Exercise the Vite config factory, not just the textual ternary.
const ts = require('typescript');
const viteJS = ts.transpileModule(vite, {
  fileName: 'vite.config.ts',
  compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true},
}).outputText;
const fakeModule = {exports: {}};
const fakeRequire = name => {
  if (name === 'vite') return {defineConfig: config => config};
  if (name === '@vitejs/plugin-react') return {__esModule:true, default: () => ({name: 'react-stub'})};
  if (name === 'path') return require('node:path');
  throw Error(`Unknown config dependency: ${name}`);
};
new Function('require','module','exports','__dirname',viteJS)(fakeRequire,fakeModule,fakeModule.exports,root);
const factory = fakeModule.exports.default;
assert.equal(factory({command:'serve',mode:'development'}).base, '/');
assert.equal(factory({command:'build',mode:'production'}).base, '/ElectroLab/');
assert.equal(factory({command:'build',mode:'desktop'}).base, './');
const main = read('src/main.tsx');
assert.match(main, /import\.meta\.env\.BASE_URL/);
assert.match(main, /<BrowserRouter basename=\{basename\}/);
const pkg = JSON.parse(read('package.json'));
assert.match(pkg.scripts['build:desktop'], /vite build --mode desktop/);
assert.match(read('src-tauri/tauri.conf.json'), /"beforeBuildCommand": "npm run build:desktop"/);
const workflow = read('.github/workflows/deploy.yml');
assert.match(workflow, /cp dist\/index\.html dist\/404\.html/);
assert.match(read('404.html'), /sessionStorage\.setItem\('electrolab:spa-return-v1'/);
assert.match(read('index.html'), /history\.replaceState\(history\.state, '', route\)/);
assert.match(read('src/App.tsx'), /electrolab-workspace bg-\[#191c24\]/);
assert.match(read('src/App.tsx'), /darkMode \? \"#242630\"/);
assert.match(read('src/circuit/types.ts'), /red: "#c2413b"/);
console.log('Gray studio backgrounds + navy highlights + GitHub Pages /ElectroLab/ deep-link and desktop path separation: PASS');
