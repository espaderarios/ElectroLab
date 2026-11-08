# ElectroLab — Realistic Component Library Expansion (Batch 1)

This source update starts from the latest **gray studio + navy highlights** version, with the GitHub Pages `/ElectroLab/` deployment-path fix preserved.

## Nine new selectable catalog choices

| Component | Electrical model | Detailed 3D mesh / appearance |
|---|---|---|
| Electrolytic capacitor, 100 µF / 25 V | Existing capacitor with 100 µF default | Radial cylindrical aluminum package, polarity band and detailed finish |
| Film capacitor, 100 nF / 63 V | Existing capacitor with 100 nF default | Molded film package |
| Tantalum capacitor, 10 µF / 16 V | Existing capacitor with 10 µF default | Dipped tantalum body |
| 1N5819 Schottky diode | Corrected diode model, approximate Vf 0.3 V | Axial dark bluish diode with metallic leads and cathode band |
| Magnetic reed switch | Normally-open SPST; clicking the body toggles it | New transparent glass capsule, metal end seals and visible reed contacts |
| Mini SPDT slide switch | COM/NO/NC contacts; clicking cycles open/NO/NC | New three-pin housing, groove, metal clips and moving slider |
| Glass cartridge fuse, 500 mA | Existing fuse over-current model, 0.5 A default | Transparent cylinder, metal end caps, visible fuse element |
| Blue tactile pushbutton | Existing momentary switch logic | Blue-capped tactile switch |
| White tactile pushbutton | Existing momentary switch logic | White-capped tactile switch |

**These are nine new named selectable variants, not nine independent physics engines.** They reuse the existing electrical component families so saved projects and wiring remain compatible. Two switch mesh implementations are new; capacitor and fuse variants reuse previously detailed procedural meshes.

## Website/editor integration

- Every choice appears in **Components** and the **3D Simulator → Parts** palette.
- Click a tile, then a breadboard hole, or drag from the library to place its true 3D object.
- Pin positions use the existing breadboard network, Wire tool, movement, pin-inspector controls, and electrical solver.
- Each item's model, rating, capacitance, or physical variant is saved on the placed component and preserved by Undo/Redo and project snapshots.
- Hover-only component labels remain in effect. The gray/navy interface and GitHub Pages routing fix are untouched.

## Diode electrical correction

The existing diode implementation had represented a diode as a 1 kΩ bidirectional resistor. This update replaces that approximation with a forward threshold plus 8 Ω dynamic resistance for both silicon and Schottky diodes. Reverse-biased junctions no longer contribute false current to the bench supply measurement. This is an educational DC model, not a SPICE datasheet model.

## Known scope / remaining work

- The models are detailed **procedural meshes**, not exact manufacturer-certified CAD/GLB assets.
- Magnetic field strength is **not simulated**; a reed switch closes when the user toggles it.
- Capacitor polarity, leakage, temperature-dependent Schottky curves, and real-time fuse heating remain approximations.
- Full production Vite build and live WebGL interaction verification require installing npm dependencies (`npm ci`) in an environment with registry access.
- To update the live website, commit/push the source and let the existing GitHub Pages deployment workflow run. Extracting locally does not publish it.

## Test instructions

```powershell
npm ci
npm run test:components-expanded
npm run test:circuits
npm run build
npm run dev
```
