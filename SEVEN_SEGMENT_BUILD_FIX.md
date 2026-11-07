# ElectroLab — 7-Segment / Build Error Update

## Fixed build error
- `src/circuit-lab/parts-3d.tsx`: corrected LED lens `useRef` to `THREE.MeshPhysicalMaterial`, matching the attached `<meshPhysicalMaterial ref={lensMaterial}>`. This fixes TS2322 reported at the old line 1309.

## New 0.56-inch single-digit seven-segment LED component
- Seven actual LED bars A-G plus one independent DP (eight light elements).
- Ten separate physical pins, placed across the breadboard center channel.
- Modeled after the 5161AS/5161BS common-cathode/common-anode pinout:
  pin 1 E, 2 D, 3 COM, 4 C, 5 DP, 6 B, 7 A, 8 COM, 9 F, 10 G.
- Pins 3 and 8 are electrically common inside the part (no fake visible jumper).
- Dark epoxy housing, tinted red light pipes, and realistic diffused light when driven.
- Pin numbers and clear wiring explanation in the component inspector.
- Existing saved nine-pin 7-segment circuits still simulate with their legacy `com` pin.
- Physical footprint/collision routing updated to fit the actual package.
- Use individual 220–330 ohm current-limiting resistors for each driven segment at 5 V.

## Why an Arduino + LCD project could show an unrelated component
Saved demo projects live in the browser. They can differ from the factory templates after editing.
The editor's More menu now has **Restore original demo (backs up edits)** for the built-in demo projects.
If an Arduino LCD/OLED demo no longer contains its required parts, the editor shows a restore button in the 3D workspace.
Restore creates an independently saved backup project first and then loads a fresh factory demo. It never clears unrelated saved projects.

## Verification
- `npm run test:seven-segment`: pass
- Existing `test:circuits`, `test:projects`, `test:editor`, `test:drag`, `test:physical`, `test:displays`, `test:ui`: pass
- TypeScript/TSX parser: all 61 files parsed successfully
- Full Vite build: requires the project's npm dependencies. Not executed in the artifact environment because npm registry cache is unavailable.

## Run on Windows
```powershell
cd D:\GitHub\ElectroLab
npm run test:seven-segment
npm run build
npm run dev
```
Do not hide the Vite overlay: it reports real compile errors.
