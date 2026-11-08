/** The UX shell is React/WebGL; this suite validates its static action contracts
 * and component catalog without pretending to do a browser visual test. */
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')
const src = read('src/pages/CircuitEditorPage.tsx')
const lab = read('src/circuit-lab/index.tsx')
const overlay = read('src/circuit-lab/overlay.tsx')
const types = read('src/circuit/types.ts')

// Parse every source file, not just the changed component.
let parsed = 0
let syntaxErrors = []
function visit(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes:true })) {
    const pathname = path.join(dir, entry.name)
    if (entry.isDirectory()) visit(pathname)
    else if (/\.(tsx?|jsx?)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      const text = fs.readFileSync(pathname,'utf8')
      const source = ts.createSourceFile(pathname,text,ts.ScriptTarget.ESNext,true,entry.name.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
      syntaxErrors.push(...source.parseDiagnostics.map(d => `${pathname}:${d.start} ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`))
      parsed++
    }
  }
}
visit(path.join(root,'src'))
assert.deepEqual(syntaxErrors,[],`Found source parse errors: ${syntaxErrors.join('\n')}`)

const paletteStart = src.indexOf('const PALETTE: PaletteSection[] = [')
const paletteEnd = src.indexOf('\nexport function CircuitEditorPage()',paletteStart)
assert.ok(paletteStart >= 0 && paletteEnd > paletteStart)
const palette = src.slice(paletteStart,paletteEnd)
const items = [...palette.matchAll(/\{\s*id:\s*'([^']+)',\s*label:\s*'([^']+)'[\s\S]*?tool:\s*'([^']+)'/g)]
const ids = items.map(x => x[1])
assert.equal(new Set(ids).size,ids.length,'Duplicate palette item ID')
for (const id of ['switch-spdt','switch-dpst','switch-dpdt','led-green','led-yellow','led-blue','2n3906','bc547','tip31','mcu','lcd','oled','xor','xnor']) assert.ok(ids.includes(id),`Missing exposed component ${id}`)
assert.ok(!ids.includes('vac'),'Unavailable VAC is still visible')
const toolType = types.match(/export type ToolId\s*=([\s\S]*?);/)
assert.ok(toolType, 'Could not inspect ToolId union')
const supportedTools = new Set([...toolType[1].matchAll(/\| \"([^\"]+)\"/g)].map(match => match[1]))
for (const match of items) assert.ok(supportedTools.has(match[3]), `Unsupported palette tool: ${match[1]} (${match[3]})`)
assert.match(types,/\| "switch-spdt"/)
assert.match(src,/handleRunSimulation/)
assert.match(src,/onClick=\{\(\) => useLab\.getState\(\)\.deleteSelected\(\)\}/,'Delete must act on selection, not enable a mode')
assert.doesNotMatch(src,/setTool\('delete'\)/,'Avoid misleading delete mode in top toolbar')
assert.match(src,/disabled=\{!use3D \|\| !selectedItem\}/,'Delete should be disabled when nothing is selected')
assert.match(src,/canUndo/)
assert.match(src,/canRedo/)
assert.match(src,/editor-view-switch/)
assert.match(src,/<SchematicFallback \/>/, 'The 2D tab should show the current 3D project circuit')
assert.doesNotMatch(src,/<Schematic2D \/>/, 'Do not open an independent schematic when switching the current project view')
assert.match(src,/editor-more-menu/)
assert.match(src,/editor-palette-filters/)
assert.match(src,/editor-ribbon-color-picker/,'Wire options are in Wiring ribbon')
assert.match(src,/editor-favorite/)
assert.doesNotMatch(src,/<div className="editor-stage-hud/, 'Workbench help must not obscure components')
assert.match(src,/window\.confirm\('Clear all parts and wires/)
assert.match(src,/aria-label="Breadboard size"/,'Breadboard selection is in Insert')
assert.match(lab,/if \(!typing && \(e\.metaKey \|\| e\.ctrlKey\)/, 'Keyboard Undo/Redo must not affect inputs')
assert.match(lab,/e\.key\.toLowerCase\(\) === 'y'/, 'Ctrl+Y redo support')
assert.match(overlay,/Wiring guide/)

assert.match(src, /psuPositive, psuNegative, boardPreset, saveCircuit/, 'PSU clip changes must trigger autosave')
assert.match(read('src/store/lab.ts'), /const containsWork = state\.parts\.length/, 'Empty board changes should not require confirmation')
for(const chip of ['74HC86','74HC02','CD4077B','NE555','SSD1306']) assert.ok(palette.includes(chip), `Search metadata missing ${chip}`)

console.log(`${parsed} source files parsed, ${items.length} unique palette entries, toolbar, favorites, wiring, destructive-action and keyboard contracts: PASS`)
