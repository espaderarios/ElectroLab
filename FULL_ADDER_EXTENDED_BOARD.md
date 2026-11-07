# ElectroLab — Extended Full Adder Breadboard (2026-11-07)

## Why the display shows 0–3, not 0–9

A one-bit Full Adder adds A, B, and Carry-in (each either 0 or 1). It has 8 possible input combinations and 4 possible decimal totals, from 0 to 3. The **seven-segment display hardware** can display digits 0 through 9; to generate sums through 9, use a *multi-bit adder* (more inputs, more full-adder stages) and the appropriate seven-segment decoder.

## What was changed

- Added an **Extended 1400** virtual solderless breadboard size with 100 terminal columns and four 100-hole power rails (1400 contacts in total).
- The Full Adder factory preset now uses this bigger board. Components and their wires are spread across the additional columns so the seven-segment module has its own room at the right.
- Powered the split rails in four sections through explicit bridging wires. All real electrical endpoints remain editable.
- Preserved the real Full Adder functions and decoding of (Carry, Sum) onto one seven-segment display.
- Upgraded the saved-project migration to version 10. Older Full Adder factory projects on smaller boards are backed up as separate projects before receiving the expanded example. Custom project IDs are not replaced.
- Updated the Projects/Templates descriptions and monitor explanations.
- Added `npm run test:extended-adder` to check geometry, valid connections, blocked routes, 8 combinations and output digits.

## Verification

- `npm run test:extended-adder`: PASS — 11 components, 47 wires, 0 component-body overlaps, 0 blocked routes, 8/8 expected results.
- `npm run test:circuits`: PASS — Half and Full Adder electrical tables.
- `npm run test:projects`: PASS — legacy migration and backup preservation.
- `npm run test:tidy-wires`: PASS — routable wire geometry.
- All 20 available `test:*` scripts passed.
- 66 source TS/TSX modules passed independent TypeScript syntax parsing.
- Full Vite production build and browser/WebGL visual check could not be verified in this environment because the project does not have installed npm dependencies.

## Installation

Use the patch ZIP in the existing `D:\GitHub\ElectroLab` directory so that `src/`, `tests/`, and `package.json` overwrite the matching files. Run:

```powershell
npm install
npm run test:extended-adder
npm run test:circuits
npm run test:projects
npm run build
npm run dev
```

If a browser has an older cached Full Adder, its existing project is backed up and the preset is upgraded on the next app load. You can also select **More > Restore original demo** in the editor to get the latest factory version (which backs up edits).

### Note on electrical realism

The existing simplified educational 7-segment display model draws idealized segment current. Real-world hardware needs a separate current-limiting resistor or suitable driver for each lit segment.
