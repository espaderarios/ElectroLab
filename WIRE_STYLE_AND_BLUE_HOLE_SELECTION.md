# Wiring ribbon and blue hole selection

## Wiring ribbon

- Select **Solid** or **Jumper** to activate the Wire tool automatically. There is no separate Wire button in this tab. The Home quick-action and W keyboard shortcut still work.
- Changing Solid/Jumper during a partly completed wire keeps the first selected endpoint; it does not restart the wire. Changing style also clears any stale routing error.
- The active style is highlighted only while Wire mode is selected. Select switches back to normal pointer interactions.

## Selected breadboard hole indicators

- In Wire mode, the first clicked socket or breadboard hole is outlined with a persistent blue ring. The ring disappears once the wire is completed or cancelled.
- With **3D Drag off**, each picked breadboard hole for a multi-pin component is outlined blue until all pins are selected, the placement is completed, or the operation is cancelled.
- A lighter blue ring follows the hovered hole. Previously selected wire endpoints and selected component pins take priority over hover.
- The visible ring sits above the physical socket surface and **does not intercept clicks**, so clicking an outlined hole again can still cancel the pick.

## Verification

- `node node_modules/typescript/bin/tsc -b`
- `node tests/wiring-blue-hole-selection.cjs`
- `node tests/wire-editor.cjs`
- Run the rest of the suites in `tests/*.cjs` for regression checks.

This update is based on the full project that includes the corrected 4-digit display and previous ribbon and 3D model fixes.
