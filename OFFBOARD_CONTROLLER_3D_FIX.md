# ElectroLab — 3D Controller Dragging, Real Headers & Model Detail

This update was made **directly from ElectroLab(2).zip**, including its 37 added component models. It preserves the charcoal workbench, navy interface, existing presets, circuits and part catalog.

## Changes

- **Every new catalog part gets an actual live 3D placement ghost.** The newly added expansion tools are recognized in the same scene-preview pipeline as the older components.
- **Arduino Uno, Nano, Mega 2560, ESP32 DevKit and Raspberry Pi Pico are separate workbench PCBs.** Drag from the sidebar into the scene; they move beside the breadboard instead of covering its holes. Choose **Select (V)**, then drag a placed board to rearrange it. Small snaps stabilize placement and preserve the grab offset.
- **Female header sockets have independent terminal IDs**, instead of occupying an unrelated breadboard strip. Choose **Wire (W)**, click a visible controller socket, then a breadboard hole. Each wire remains attached when the board moves.
- **Placement is checked against physical PCB rectangles**, so one controller cannot be dropped on top of another. Arduino/expansion-controller footprints no longer block ordinary breadboard holes.
- **Realistic procedural detail:** distinct PCB dimensions/colors, gold/black pin sockets, mounting pads, metal USB ports, chip packages, ESP32 RF shielding/antenna detail, component markings, board stand-offs and material roughness. No external GLB files required.
- **Legacy expansion-controller circuits migrate on load:** the old on-breadboard controller contact IDs are turned into separate module header IDs and directly attached wires are remapped. Ordinary noncontroller components remain unchanged.
- **Undo, redo, save, restore and delete** preserve independent headers; deleting a board removes its attached wires.
- **Wire paths can extend beyond the board**, with correct endpoint height at the visible sockets. Normal breadboard wire height remains unchanged.

## How to use

1. Install dependencies in the project root: `npm ci`.
2. Start with `npm run dev`; open the 3D editor on a desktop browser.
3. Drag Arduino Uno, Nano, Mega, ESP32 or Pico from the left sidebar to the workbench. It will sit beside the breadboard.
4. Select **Wire (W)**; click a gold controller socket, then click a breadboard hole. Click a connected board in **Select (V)** mode and drag it; wires stay connected.
5. For a regular resistor or IC, drag it directly over a breadboard hole and release.
6. Run `npm run test:offboard` to check new controller wiring and `npm run build` to prepare deployable assets.

## Scope and testing

- TypeScript project compilation and all `.cjs` source regression suites passed in the development container, including the new five-controller placement, wiring, movement, save and migration suite.
- The uploaded ZIP includes Windows node_modules rather than Linux Rollup's optional native binary. A full Vite build and interactive browser/WebGL acceptance test could not be completed here. Run `npm ci && npm run build` on the target machine before deploying.
- These 3D models are detailed procedural educational approximations, **not verified manufacturer CAD**. Nano/Mega/ESP32/Pico remain **wiring-capable prototypes**, not complete firmware/protocol emulators. Do not treat the simulation as an electrical safety or pin-rating authority.
