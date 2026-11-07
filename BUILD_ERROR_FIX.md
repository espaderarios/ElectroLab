# Vite duplicate-declaration fix (November 7, 2026)

## Error
`[plugin:vite:react-babel] Duplicate declaration "formatCapacitance"`

## Root cause
In `src/circuit-lab/parts-3d.tsx`, `formatCapacitance` **and**
`formatResistance` were imported from `./realistic-details` despite existing
as local function declarations in the same module. This violates JavaScript
module binding rules and causes the React Babel transform to stop.

## Correction
The import now includes only `BreadboardSilkscreen` and `PrintedMark`.
The existing local formatting functions continue to be used, retaining
resistor and capacitor value labels and the realism changes.

## Validation performed
- TypeScript parser: 58 TS/TSX source files, 0 syntax diagnostics.
- Module-level binding scan: 0 duplicate top-level declarations/imports.
- `npm run test:circuits`: PASS
- `npm run test:projects`: PASS
- `npm run test:editor`: PASS
- `npm run test:drag`: PASS
- `npm run test:physical`: PASS

A complete Vite build could not be run here because this environment has no
installed npm project dependencies. Run `npm install && npm run build` locally
to verify the full bundling and type checks.
