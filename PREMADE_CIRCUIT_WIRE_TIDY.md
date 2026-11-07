# Premade circuit wiring cleanup — ElectroLab

## What changed

- The five factory examples (Arduino LCD, Arduino OLED, Arduino 7-segment, Half Adder, Full Adder) have saved 2D visual bend paths. Endpoints / electrical nets are unchanged.
- The routing engine tries four whole-bundle planning orders and picks the least crowded valid configuration based on close contacts, bends, length, and lift. The display/body collision checks remain active.
- **Auto Tidy wires** in the 3D toolbar and More project actions recalculates the whole bundle without changing wire endpoints. It is undoable and auto-saves.
- With a wire selected, More project actions offers **Lock / Unlock selected wire route** and small **Shift wire lane** controls (up, down, left, right). Blocked paths are rejected and display a warning.
- **Editor settings → Focus connections** dims unrelated wires when a part or wire is selected.
- Existing browser versions below 8 receive route hints for premade project IDs when those circuits have no previously saved bends. Their components, pins, wires, simulation inputs, custom projects, and prior edits are not replaced.
- Visual paths are stored in `Wire.bends` + `Wire.bendAnchors`; stale saved routes are ignored automatically if connection endpoints move.

## Validation

Run from the project root after `npm install`:

```powershell
npm run test:tidy-wires
npm run test:clean-3d
npm run test:displays
npm run test:circuits
npm run build
npm run dev
```

The shared planner is intended for manageable breadboard-size circuits. This is a deterministic routed visualization, **not** a physically accurate wire-mechanics simulator and not a manufacturer CAD geometry generator. Some crossings in dense projects will still need raised jumpers.

## Existing browser-saved example circuits

The one-time project store migration automatically adds visual bend metadata on compatible premade circuits without clearing your saved parts or real electrical connections. To re-optimize any circuit at any time, click **Auto Tidy wires**. Manual locked routes survive the tidy operation.
