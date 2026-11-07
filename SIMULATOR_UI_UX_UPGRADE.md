# ElectroLab 3D Simulator — UI/UX Upgrade

## Updated interface

- A cleaner two-row editor header separates project actions from editing tools.
- A clear *Delete selected* action replaces the misleading delete-mode toggle.
- Select, Wire, Pan, Rotate, Undo, Redo, Zoom, Fit Board, and 3D Drag/Pin Mode have visible, keyboard-accessible controls.
- Rotate/Delete and Undo/Redo are disabled when they cannot act on a valid target/history state.
- The breadboard selector is now compact and unobtrusive, with a confirmation dialog only when changing boards would erase existing work.
- The component palette is collapsible, searchable by category and model number, and supports Favorites and Recent items.
- Favorites persist locally in the user's browser. The recent list is per editing session.
- When wiring, the palette reveals solid/jumper styles, color swatches, wire progress, and current-flow animation.
- Removed the unavailable VAC palette option and the unnecessary More Components navigation button.
- Tools now have contextual hints over the workbench and a keyboard shortcut help panel.
- Secondary options (Export, Help, Shortcuts, Clear Board) moved into an explicit More menu, with Clear requiring confirmation.
- The 2D view switch now shows a read-only schematic of the current breadboard, not an unrelated 2D editor state. A link opens the standalone 2D editor separately.

## Components added to the palette

No unsupported physics models were introduced. All entries reuse the simulator's existing component and simulation implementations.

- Existing LED model now has red, green, yellow, blue presets.
- Exposed all supported BJT model variants: 2N3904, 2N3906, BC547, BC557, 2N2222, TIP31, TIP32, 2N3055.
- Exposed supported SPST, SPDT, DPST, DPDT switch types.
- Exposed 3 V, 5 V, 9 V, and 12 V motor presets.
- Added searchable electronic part numbers: 74HC04, 74HC00, 74HC02, 74HC08, 74HC32, 74HC86, CD4077B, NE555, SSD1306, HD44780, etc.

The component palette now has 57 distinct entries, including preconfigured variants.

## Additional bug fixes

- Ctrl+Z/Redo now respects active input and textarea editing (including the Arduino sketch editor).
- Ctrl+Y added for redo, with select/wire shortcut synchronization when leaving pan mode.
- Moving only the power clips now triggers circuit autosave.
- No confirmation when switching breadboard formats on a completely empty project.
- 2D tab now reflects the current project circuit rather than starting an unrelated schematic editing session.

## Validation performed

These commands passed in the working environment:

```
npm run test:ui
npm run test:circuits
npm run test:projects
npm run test:editor
npm run test:drag
npm run test:physical
npm run test:displays
```

60 TypeScript/TSX source files were parsed with zero syntax errors.

A full Vite build and interactive WebGL browser test are NOT verified because dependencies were unavailable and the npm registry could not be reached in the tool environment. On a local machine with dependencies installed, run `npm run build`, then `npm run dev`.

## Installation

Extract the *complete* ZIP into the root of your ElectroLab directory (after backing up local changes). It preserves the previous display demo circuits and 3D physical simulation code.

If you only need the editor update and have the latest display-guide release installed, use the *patch-only* ZIP and copy its contents over the corresponding paths in your project root.
