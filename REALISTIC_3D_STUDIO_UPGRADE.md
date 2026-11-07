# ElectroLab: Realism and Graphics Quality Upgrade

## Implemented in this release

- **Uno R3 blue solder-mask finish**: the 3D board is no longer green. Added fine procedural PCB mask traces, vias, industrial-style silkscreen on the model (non-interactive and electrically inert), and corrected the header body's plastic color.
- **Interactive sockets preserved**: header geometry is aligned with the existing 3D pin terminal IDs. No changes to electrical simulation, project persistence or headers.
- **Breadboard contact finish**: each recessed hole has a plastic rim plus a secondary recessed metal-spring detail. Instanced geometry maintains a low number of draw calls even on the extended Full Adder board. Plastic rails no longer resemble exposed metal channels.
- **Wire ends**: visible short metal ends on both Solid and Jumper wires; small insulated plug shoulders on Jumper wires. They move with the wire's true interactive endpoints.
- **7-segment casing**: refined glazing and molded rim highlights; the segment illumination is still driven by actual simulation outputs.
- **Graphics presets**: Low/Fast (no shadows), Medium (balanced shadows), High (higher res shadows plus procedural PBR environment), Ultra (max available pixel ratio/contact-shadow quality). Switch them from the bottom workbench power dock using the **Quality** dropdown. Saved for future sessions.
- **Lighting**: additional soft fill and rim lighting, a self-contained high/ultra environment map for metal/glass reflections, corrected extended-board shadow coverage and adjustable tone-mapping exposure.
- **Existing studio UI**: all existing panels, Arduino editor, simulation console, 3D Drag, wire and components behavior are retained.

## Notes on appearance and accuracy

This is a **procedural realism pass**, not an externally sourced licensed photogrammetry scan or manufacturer CAD assembly. The 3D Arduino still uses ElectroLab's interactive geometry with added texture/material detail. The procedural PCB mask artwork is artistic, **not a faithful circuit-board netlist**. The seven-segment result and logic are simulated, not driven by the appearance layer. More exact realism would require importing carefully licensed, device-specific CAD/Blender GLB assets and mapping their sockets to existing `mcuTerminalId()` coordinates.

Do not rely on the rendered component model to verify hardware pin dimensions or wiring clearances in a physical manufacturing context.

## Install / verify

Extract the patch at the existing project's **root** so `src/` and `tests/` replace their counterparts; do not nest the patch directory inside the project.

```sh
npm install
npm run test:realism
npm run test:circuits
npm run test:physical
npm run build
npm run dev
```

Graphics settings > Low for integrated GPUs; Medium or High for typical desktops; Ultra for strong discrete GPUs. FPS and appearance require live measurement on the target browser. If a browser has GPU driver instability, revert to Low.
