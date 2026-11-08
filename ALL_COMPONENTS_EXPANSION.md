# ElectroLab – 37 additional 3D components + four-bit adder

This expansion builds upon the **gray/charcoal studio with navy-blue accents** and the hover-label click-through fix.

## New parts available in Component Library and 3D Parts sidebar

| Group | New components | Current electrical support |
| --- | --- | --- |
| Digital Logic (7) | 74HC283, CD4511, 74HC595, 74HC74, 74HC161, 74HC138, clock module | 74HC283, CD4511, 74HC138: simplified combinational DC models; the rest are prototype-only. |
| Controllers (4) | Arduino Nano, Arduino Mega, ESP32 DevKit, Raspberry Pi Pico | Physical wiring and models only; no board firmware emulation. Some boards expose only 30 representative header contacts. |
| Sensors (6) | HC-SR04, DHT22, PIR, IR obstacle, Hall, MPU-6050 | Physical wiring and models only; no sensor protocol or environmental-input emulation. |
| Inputs and Displays (6) | 4×4 keypad, rotary encoder, 8×8 LED matrix, MAX7219 module, four-digit seven-segment, 10-LED bar | Physical wiring and models only; scanning, multiplexing and dynamic display behavior pending. |
| Motor Control (4) | L298N, ULN2003, 28BYJ-48 stepper, DC solenoid | Physical wiring and models only; motor-control physics/timing not modeled. |
| Power Modules (5) | LM2596 buck, boost converter, bridge rectifier, 18650 holder, TP4056 | Physical wiring and models only; no switching, AC rectification, charging or battery physics. These parts do not inject fake power. |
| Instruments (5) | Oscilloscope, function generator, DMM, logic analyzer, frequency counter | DMM measures DC voltage; scope reads DC channel voltage; logic analyzer reads static digital voltage levels. No waveform sampling, frequency measurement, or generator output yet. |

The new components use distinct **procedural Three.js meshes** (PCB, DIP, molded case, leads/terminals, labels, housings, sensor transducers, display faces), not manufacturer-supplied photorealistic CAD/GLB models. Geometry is educational and representative. Pin maps are stored with each circuit and align with the simulator's `clickHole`/wire system. Use **Wire** mode and click the visible metallic leads or their underlying breadboard holes to connect them.

The Components Library **Use in editor** link now pre-selects the requested component, including when opening a new project.

## Working 4-Bit Binary Adder example

Open **3D Simulator → Circuits → 4-Bit Binary Adder (74HC283)**. The new premade example uses an extended breadboard, a 74HC283 DIP-16, 8 switches (A0–A3 and B0–B3), pull-down resistors, and **5 working LED outputs** (sum S0–S3 and carry C4). The LEDs display the *binary* result, not two-digit decimal seven-segment output. The project is saved and editable, and appears in existing users' project lists through the v11 seed migration without erasing prior circuits. All 256 values of A and B were tested. The 74HC283 electrical model separately passed 512 A/B/carry-in combinations.

## Technical integration

- `src/circuit/expansion-catalog.ts`: 37 IDs, names, categories, 3D model types, pin maps, support level.
- `src/circuit-lab/expansion-meshes.tsx`: custom 3D meshes and wire-clickable lead positions.
- `src/circuit/expansion-logic.ts`: combinational truth models (74HC283, CD4511, 74HC138).
- `src/circuit/four-bit-adder-demo.ts`: premade binary adder and wiring.
- `src/circuit/types.ts`, `component-variants.ts`, `placement-obstacles.ts`, `simulate.ts`: part kind, catalog recognition, collision detection, simplified DC simulation.
- `src/store/lab.ts`, `projects.ts`: placement, undo/redo, save/restore, seed migration.
- `src/pages/CircuitEditorPage.tsx`, `ComponentLibrary.tsx`, `src/circuit-lab/parts-3d.tsx`, `overlay.tsx`: component discovery, 3D visualization, Properties view, and direct editor links.

## Running and deploying

Apply the patch by extracting it to your project root, preserving directory paths and overwriting matching files, or extract the complete project.

```powershell
cd D:\GitHub\ElectroLab
npm ci
npm run test:all-components
npm run test:projects
npm run build
npm run dev
```

To publish, commit and push your repository changes so your GitHub Pages workflow builds and deploys the new source. This ZIP by itself **does not** update the live website.

## Tests and limits

All 30 available `.cjs` test suites passed in this environment. These cover catalog IDs, pin geometry, placement and saved projects, circuit logic, the complete 4-bit LED example, and the existing site regressions. TypeScript/TSX source transpile syntax checks passed. An actual Vite production build and browser/WebGL visual test were **not available** here because project dependencies could not be installed from the offline package cache. Run the build and visually inspect 3D pin clicking after applying.
