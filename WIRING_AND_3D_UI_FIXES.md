# ElectroLab: 3D simulator deletion, wiring, and UX fixes

## Using the updated editor

1. Open a project and choose **Select**. Click an IC, resistor, or any other component to open its inspector; click **Delete component** or press **Delete / Backspace**. Alternatively, choose the **Delete** tool and click the component or an existing wire. **Undo / Redo** works for both components and wires.
2. Choose **Wire** in the toolbar. A **Wire routing** section appears directly below the component search box on the left. Select **Solid** for low, neat runs or **Jumper** for raised connections. Choose an insulation color, then click a starting breadboard hole and an ending hole. **Cancel** clears an unfinished connection. Existing wires can be selected and changed from the inspector, without changing the circuit topology.
3. Enable **Animate current flow** in the wire settings to show optional particles on connected wires carrying calculated current. This can be switched off for a less cluttered view.
4. The renderer tries alternative orthogonal lanes, separates nearby routes, and lifts wire bridges/arched jumpers over difficult crossings. This is **visual routing only** and does not affect electrical nets; in crowded circuits some projected paths may still cross, but raised wire segments are not electrical junctions.

## Bug fixes

- Universal part selection/deletion for 3D models, including logic ICs, with a fallback scene-level pointer handler.
- Potentiometer shaft and MCU pin/reset interactions no longer steal Delete/Select input.
- Part drag pointer-cancel cleanup, stale selection cleanup, and text-input-safe keyboard deletion.
- Visual style saved as `style: "solid" | "jumper"` on wire records; old wires without the field are rendered as solid.
- Automatic lane/height planning and selected/hovered wire highlighting; black-wire contrast improved.
- Duplicate point-to-point wires are blocked; component preview tool list expanded to supported parts.
- Main 3D editor sidebar now exposes wire choices rather than relying on the simulator's hidden palette.

## Validation

Run from the extracted project root:

```powershell
npm install
npm run test:editor
npm run test:circuits
npm run test:projects
npm run dev
```

The script tests check IC/component and wire deletion, undo/redo, wire-style editing, endpoint preservation, route planning, duplicate prevention, adder truth tables, existing example circuits, and old saved project upgrade. TypeScript/TSX parse checks were also run. A full production build and browser-based 3D appearance test **have not** been verified here, as package installation from the npm registry was unavailable.
