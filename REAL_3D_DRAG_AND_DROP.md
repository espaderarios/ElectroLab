# ElectroLab – physical 3D drag and drop

## Updated interaction

- Drag a component from the **Components** sidebar toward the breadboard. The
  floating pointer preview is a real Three.js rendering of the same
  `PartSwitch` 3D model used in the simulator (not the schematic icon/label).
- On reaching the 3D board, the preview transitions into the bench scene and
  snaps to the nearest available breadboard position. The footprint pins are
  marked in cyan. Release to place. Release outside the board to cancel.
- A single click on a component **selects** it. Click and drag a placed
  component **immediately** (7px movement threshold) to move it; **no long
  press**. The grabbed offset is preserved, avoiding a jump on the first move.
- **W** wire mode, **V** select mode, **R** rotate the selected part,
  **Delete** delete the selected item, **Ctrl+Z** undo, **Escape** cancel.
- Existing *Drag ON/OFF* control is now shown as *3D Drag / Pin mode*. Pin mode
  retains manual pin-by-pin breadboard placement.
- The original mesh stays mounted (but hidden) while moving so the window
  `pointerup` handler survives. Dropping on the original hole is a no-op and
  does not create an extra undo step. Esc/canceled drags restore the original.
- Regular wire, probe, and PSU contact tools still use click-to-connect;
  Solid/Jumper wire styles and electrical simulation behavior are unchanged.

## Source files

- `src/pages/CircuitEditorPage.tsx` – palette drag, pointer coordinates, controls
- `src/circuit-lab/drag-preview-3d.tsx` – floating 3D model preview
- `src/circuit-lab/scene.tsx` – anchored 3D ghost and direct drag on board
- `src/circuit-lab/index.tsx` – keyboard shortcuts
- `src/store/lab.ts` – do-not-save-no-op moves
- `tests/drag-interaction.cjs` – movement, pin mapping, undo, and lifecycle tests

## Testing

```bash
npm install
npm run test:drag
npm run test:editor
npm run test:circuits
npm run test:projects
npm run build
npm run dev
```

Source syntax and Node-based regression tests were checked in the delivery
workspace. A Vite browser build and pointer-driven visual acceptance test
could not be run in that environment because dependency packages were not
available from the local npm cache. Verify 3D previews in a desktop browser
with WebGL enabled after `npm install`.
