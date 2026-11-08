# ElectroLab — Short Circuit, Source Conflict and 3D Smoke Fix

This change continues from `ElectroLab_Auto_Wire_Blue_Hole_Selection_Fixed.zip` and preserves the Word-style ribbon, Insert-by-kind gallery, and prior dragging/wiring improvements.

## Improvements

- **Bench-supply direct short:** The simulator flags direct connections between the PSU's positive and negative electrical nodes and renders a protection warning at the supply.
- **Low-impedance path:** Source-current estimates above 2 A with equivalent resistance at or below 2.5 ohms are flagged as near-shorts. Other currents exceeding 2 A are identified as supply overloads, not mislabeled as short circuits.
- **18650 battery safety:** A 18650 cell whose positive and negative terminals share an electrical net is flagged even when the bench PSU is switched off. Direct connections across a bench PSU are warned about as uncontrolled parallel sources, including reversed polarity and nominal-voltage mismatches.
- **Component stress:** Existing resistor, LED, diode, buzzer, fuse, Arduino and LCD stress checks are retained. Additional conservative educational ratings now check current and dissipated power in modeled branches (including speakers, motors, inductors, potentiometers, analog/logic devices, RGB LEDs and 7-segment displays); capacitor and OLED overvoltage are also checked. Prototype 5 V modules with actual VCC/GND pins get a conservative supply-overvoltage warning.
- **All physical 3D part types:** Any rendered part with `sim.burned[part.id]` now has a smoke emitter, including expansion-library modules. Existing custom smoke emitters are retained, and smoke cannot intercept clicks on parts or wires. Inactive fallback emitters are not mounted, avoiding needless 3D particles.
- **Diagnostics:** The bench PSU shows an in-world protection indicator for source overcurrent, short circuits, and directly incompatible power sources. The simulation console and results report the hazards.

## Electrical limitations

- **Crossed wire geometry is not a connection.** A short must exist in the simulator's electrical nets; a 3D view cannot establish this purely from wire proximity.
- The breadboard model is a simplified DC educational simulator, **not SPICE**, and has no detailed transient thermal/charging calculations. The 18650 remains a prototype *as a power source*: source-to-source conflicts and cell terminal shorts are diagnosed, but normal battery discharge and regulated charging are **not** simulated.
- Many catalog expansion parts are intentionally electrically high-impedance prototypes. Smoke is supported for all their models **if the simulation marks them damaged**; it is not appropriate to invent an overcurrent fault for an unmodeled internal circuit.
- The PSU near-short behavior is a current-budget warning based on the ideal-source DC solution; a detailed physical current-limit voltage foldback isn't modeled.
- The numbers in the added generic thermal ratings are **conservative teaching defaults**, not the manufacturer datasheet ratings for every device variant.

## Validation

```
npm ci
node node_modules/typescript/bin/tsc -b --pretty false
node tests/short-circuit-thermal-smoke.cjs
```

Also run every `tests/*.cjs` file after updating the dependencies. The full 40-suite regression run and TypeScript checks passed during packaging. The production bundler remains unverified because the available Windows-oriented dependencies lacked Rollup's Linux platform-specific executable; retry with a clean `npm ci` on your machine.
