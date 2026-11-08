# ElectroLab — 3D wiring and physical-model improvements

## Wiring reliability

- **Expanded module contacts:** Unlike DIP chips, sensor/driver/power/instrument modules now expose raised, plated header sockets on top of their PCB bodies. Larger transparent 3D hit targets make the contacts selectable from the Wiring tool without changing the actual electrical terminal IDs or breadboard connectivity.
- **Correct wire endings:** A connected cable ends at the physical socket height of a breakout module instead of vanishing into the breadboard below the module.
- **Crowded layouts:** Jumper wires can rise above blocking component shells with a high, visible arch when no safe planar path exists. Low-profile solid wiring still enforces collision routing.
- **Better feedback:** Clicking two points on the same electrical strip, or creating a duplicate wire, now explains the issue and retains the first endpoint so you can choose another destination.
- **Wiring workflow:** A compact in-workspace status hint identifies the start endpoint and reminds users to click the second terminal; the floating ribbon/gallery remain unchanged.
- **No circuit schema change:** Existing save/load, pin names, wire styles, electrical logic, off-board controllers, drag interactions, and simulations are preserved.

## Physical 3D visuals

- Shared, lightweight manufacturing traces and vias printed onto the PCBs, plus refinements to solder-mask materials (one reused texture rather than a large texture per board).
- More detailed HC-SR04 transducers and PIR lens; improved DHT22 vents and printed markings.
- More distinct L298N/ULN2003 motor-driver screw terminals.
- More characteristic 28BYJ-48 stepper and solenoid housings.
- Battery cradle, cell caps and contacts on the 18650 holder.
- Four-digit seven-segment display modeled as separate molded segments rather than a flat glyph.
- Bench instrument enclosure, glassy inset display, and control knobs.
- Hover labels are pointer-transparent; physical socket meshes remain connectable.

## Checks

- TypeScript `tsc -b`: passed.
- 35 original regression suites: passed.
- Added test: `npm run test:wiring-realism` — 37 expansion component families, endpoint heights, routing, saved connections, and invalid-wire recovery.
- Browser production bundle **not verified in this environment**: provided `node_modules` has Windows-only optional Rollup native packages; Linux requires `@rollup/rollup-linux-x64-gnu`. Install dependencies in your own system with `npm ci` before `npm run build`.

These parts are improved procedural teaching models, not certified manufacturer CAD geometry. Several expanded module behaviors remain intentionally simulation prototypes; do not treat the visuals as a guarantee of component specifications.
