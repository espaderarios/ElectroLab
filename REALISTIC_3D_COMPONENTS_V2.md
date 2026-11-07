# ElectroLab – realistic physical models v2

This update starts from `ElectroLab_Realistic_3D_Components_Update.zip` and preserves the solid-object collision avoidance, 3D drag/drop, wire routing, full/half-adder project presets, and neon UI.

## Changes

- **Printed component markings:** values are rendered as transparent CanvasTexture lettering directly on 3D resistor bodies (alongside standard color bands), capacitors, and semiconductor packages; nothing is a screen-space floating label.
- **Capacitors:** marked capacitance and voltage rating, curved negative stripe and metal pressure vent on aluminum electrolytics, positive marking on tantalums; electrolytic and tantalum cans now stand upright with routed radial leads.
- **Transistors:** physically shaped TO-92, TO-18, TO-220, TO-3 packages with printed model markings. TO-220 and TO-3 tabs/ears now have true through-holes, rather than painted black dots.
- **LEDs:** larger optically tinted lens, molded flange, cathode flat, emitter die, lead frame, delicate internal bond wire, and controlled optical shine.
- **Switches and buttons:** molded mechanical details, steel retaining plate/screws, textured grip, color-specific tactile pushbutton caps, and mechanical button travel preserved.
- **DC motor:** scaled metal can and reserved collision clearance, stamped ribs, ventilation, metal endbells, bearing collar, rear terminals, visible manufacturer/rating marking, while retaining the animated shaft and propeller.
- **Breadboard:** custom high-resolution procedural manufacturing/silkscreen texture with socket numbers, A–J (and K–T on double boards) labels, rail polarity, and ElectroLab branding. Printed overlays do not intercept hole clicks.

## Performance and limitations

- This is procedural 3D modeling, not photogrammetry or a verified product-specific CAD assembly. Relative dimensions and surface treatments are approximate.
- No additional npm dependencies or external downloadable assets are required; the textures are created in-browser from local canvas data.
- Full Vite/WebGL rendering must still be verified with `npm install && npm run dev` on a machine with npm dependencies installed. The sandbox has no registry access; code syntax and the included node-based circuit/editor regression tests were run successfully.

## Validation commands

```bash
npm install
npm run test:circuits
npm run test:projects
npm run test:editor
npm run test:drag
npm run test:physical
npm run dev
```
