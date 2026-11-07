# ElectroLab — Arduino placement / wire-clearance fix

## Reported issue
Dropping a component onto an apparently empty breadboard hole near the Arduino Uno displayed:
"Placement blocks existing wiring. Choose a clearer location."

## Root causes
1. The Arduino 3D model is a separate PCB outside the breadboard; its simulated I/O pins use virtual breadboard contact addresses. Earlier collision code mistook all those virtual contact columns for the Arduino's physical package footprint.
2. The editor rejected every new placement if any already-saved wire was unroutable, even when the new part did not introduce that obstruction.
3. The drag preview only checked solid-object footprints and could appear valid despite a new wire-clearance obstruction.

## Changes
- Model the Arduino's physical footprint using the same actual 3D position and dimensions as `McuMesh`.
- Ignore virtual MCU pins for physical hole-occupancy collisions. Real component shells and pin occupancy still block invalid placement.
- Reject new placements, moves, rotations, or pin edits only if they introduce a NEW blocked wire route; existing saved wiring issues no longer lock an otherwise-free board.
- Make the 3D preview's red/cyan indicator use the same wire-clearance validation as the final placement action.
- Upgrade older browser project lists to include the Arduino + seven-segment example without overwriting existing projects.

## Validation
`npm run test:circuits`, `npm run test:projects`, `npm run test:editor`, `npm run test:drag`, `npm run test:physical`, `npm run test:displays`, `npm run test:ui` and `npm run test:seven-segment` pass in the source-test environment.

The full Vite/WebGL build has not been verified in this container because the project npm dependencies aren't installed here. Run `npm install && npm run build` from your own ElectroLab directory.

## Remaining model limitation
Arduino header pins currently use virtual breadboard contact identifiers for educational simulation; this fix corrects 3D space and placement, not the entire off-board wiring/net abstraction. If you place a component on the same virtual breadboard net, it may share that simulated electrical connection until a later header-terminal refactor.
