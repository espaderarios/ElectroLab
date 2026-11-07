/** Drag/snap behavior regression tests without a browser/WebGL runtime. */
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')
const root = path.resolve(__dirname, '..')
const originalResolve = Module._resolveFilename
const originalLoad = Module._load
Module._resolveFilename = function (name, parent, ...rest) {
  if (name.startsWith('@/')) return path.join(root, 'src', name.slice(2)) + '.ts'
  return originalResolve.call(this, name, parent, ...rest)
}
let seq = 0
Module._load = function (name, parent, ...rest) {
  if (name === '@/lib/utils') return { uid: (prefix) => `${prefix}-${++seq}` }
  if (name === 'zustand') return {
    create: (init) => {
      const construct = (fn) => {
        let state
        const get = () => state
        const set = (update) => {
          const change = typeof update === 'function' ? update(state) : update
          state = { ...state, ...change }
        }
        state = fn(set, get)
        const hook = (selector) => selector ? selector(state) : state
        hook.getState = get
        return hook
      }
      return init ? construct(init) : construct
    },
  }
  if (name === 'zustand/middleware') return { persist: (init) => init }
  return originalLoad.call(this, name, parent, ...rest)
}
require.extensions['.ts'] = (module, filename) => {
  const js = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  })
  module._compile(js.outputText, filename)
}
const { useLab, buildPreviewPart, previewMovedPart } = require('../src/store/lab.ts')
const { setBoardPreset, holePosition } = require('../src/circuit/breadboard.ts')
const { circuitHalfAdder } = require('../src/circuit/adder-circuits.ts')
const lab = () => useLab.getState()
setBoardPreset('standard-830')

// All selectable logic-IC types must build a real 14-pin 3D footprint.
for (const tool of ['not','and','or','nand','nor','xor','xnor']) {
  const preview = buildPreviewPart(tool, 'F10')
  assert.ok(preview, `${tool}: no 3D preview model`)
  assert.equal(preview.kind, tool)
  assert.equal(Object.keys(preview.pins).filter(k => /^p\d+$/.test(k)).length, 14)
}
// Values and selection properties pass through to the model preview.
const resistorPreview = buildPreviewPart('resistor', 'C15', {resistorValue: 470})
assert.equal(resistorPreview.props.resistance, 470)

lab().loadCircuit(circuitHalfAdder())
const chip = lab().parts.find(p => p.kind === 'xor')
assert.ok(chip)
lab().setTool('select')
lab().select(chip.id)
const start = Object.entries(chip.pins).filter(([name]) => name.startsWith('p'))
  .sort((a,b) => Number(a[1].slice(1)) - Number(b[1].slice(1)) || a[1].localeCompare(b[1]))[0][1]
const movedPreview = previewMovedPart(chip, 'F25')
assert.ok(movedPreview)
assert.equal(movedPreview.kind, chip.kind)
assert.equal(movedPreview.props.gateFamily, chip.props.gateFamily)
assert.notDeepEqual(movedPreview.pins, chip.pins)
const count = lab().history.length
lab().moveSelectedTo(start)
assert.equal(lab().history.length, count, 'Dropping without moving added history')
lab().moveSelectedTo('F25')
assert.deepEqual(lab().parts.find(p => p.id === chip.id).pins, movedPreview.pins,
  'The final drop differs from the live 3D preview')
assert.equal(lab().history.length, count + 1)
lab().undo()
assert.deepEqual(lab().parts.find(p => p.id === chip.id).pins, chip.pins)

// The live move gesture must preserve its event handler while showing the ghost.
const scene = fs.readFileSync(path.join(root, 'src/circuit-lab/scene.tsx'), 'utf8')
assert.match(scene, /DRAG_THRESHOLD_PX = 7/)
assert.match(scene, /visible=\{!\(movingSelected && selected\)\}/)
assert.match(scene, /<MovablePart\s+key=\{p\.id\}/)
assert.ok(!scene.includes('movingSelected && p.id === selectedId ? null'),
  'Unmounting a part mid-drag loses its pointerup handler')
const editor = fs.readFileSync(path.join(root,'src/pages/CircuitEditorPage.tsx'), 'utf8')
const threePreview = fs.readFileSync(path.join(root,'src/circuit-lab/drag-preview-3d.tsx'), 'utf8')
assert.match(editor, /<DraggedPart3D tool=\{dragPreview\.tool\}/)
assert.match(threePreview, /<PartSwitch part=\{part\}/)
assert.ok(!editor.includes('dragPreview.symbol'), 'Old floating icon used instead of actual 3D model')
assert.match(editor, /suppressPaletteClickRef/, 'Dragging must not reselect placement tool on synthetic click')
assert.match(editor, /Do not fall back to a stale hover/)

console.log('3D palette model, IC footprints, move snapping, no-op, undo and drag lifecycle: PASS')
