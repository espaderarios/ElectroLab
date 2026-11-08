# Selected-only 3D component labels

3D component floating annotations appear only for the selected component. Pointer hover no longer mounts a component label or a pin-name tooltip.

- The component selection context gates labels on existing part meshes.
- Expanded component boards have one selected-only floating name label.
- Breadboard module contacts, MCU pins, LCD/OLED headers, and off-board controller sockets only display their pin-name label once the pin has been explicitly chosen as a wire endpoint.
- Hover highlights and hole targeting remain functional.
- 3D placement ghost previews show no floating component names.
- Printed PCB markings, screen textures, and PSU panel markings are unchanged.
- Floating labels remain pointer-transparent to preserve tactile switches and wiring clicks.

Validation: TypeScript compilation, all 43 .cjs regression suites passed. Full Vite production build not verified because bundled dependency cache lacks Linux Rollup native binary; run `npm ci && npm run build` on a configured environment.
