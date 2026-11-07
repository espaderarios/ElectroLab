# ElectroLab — OLED screen and wire-routing build fix

## Fixes

1. `src/circuit/wire-routing.ts`: replaces the undefined `jumperBase` fallback with explicit, style-dependent wire heights. Fixes TS2304 at the route fallback.
2. `src/circuit-lab/parts-3d.tsx`: the SSD1306 OLED no longer renders its screen text with a floating HTML element. It draws bounded 128×64-style pixels onto a 512×256 canvas texture attached to a plane on the 3D glass. Only the first eight rows and 16 characters per row are drawn; the display clips text and disposes old textures when content changes.
3. OLED module name is now rendered as a tiny physical PCB silkscreen instead of an overlay that appears detached from the device.
4. Added `tests/oled-screen-build.cjs` and `npm run test:oled-screen` to detect regressions.

## Install

Extract the complete ZIP into the root of your ElectroLab repository, or extract the small patch ZIP over the existing root, replacing matching files. Existing projects and browser storage are not intentionally modified.

```powershell
cd D:\GitHub\ElectroLab
npm run test:oled-screen
npm run test:displays
npm run build
npm run dev
```

## Validation

All 12 available automated test scripts passed in the source workspace. All 63 TypeScript and TSX source files parsed without syntax diagnostics. A complete `npm run build` could not be verified here because runtime npm dependencies are not installed in this workspace. This isn't equivalent to a TypeScript typecheck or browser/WebGL visual verification; run the build locally.
