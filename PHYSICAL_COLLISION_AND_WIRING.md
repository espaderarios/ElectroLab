# ElectroLab — Physical 3D placement and wiring

## Solid component placement

- A placed part has a reserved rectangular 3D footprint (an approximation of its package and lead clearance).
- Dragging a part shows a **cyan translucent footprint and outline** when the target is free.
- If a different part's footprint or pin blocks the target, the outline turns **red**, the obstruction is highlighted, and the drop is rejected.
- Place, drag-move, rotate, and single-pin-reassign all run the same collision check.
- Failed placement does not add an Undo-history entry. A visible, dismissible warning explains the problem.

## Physically separated wires

- The routing engine uses separate **wire-body bounds** (not oversized lead-clearance bounds), so the IC pins can still be reached.
- Paths are orthogonal. A candidate path is invalid if its insulated tube would run through a component body.
- If ordinary L-shaped or three-bend paths are blocked, an obstacle-aware shortest-path search finds a detour around bodies.
- **No-route case:** a new wire is rejected with an explanation. For a previously saved, impossible connection the simulator shows a red terminal stub instead of drawing an insulated tube *through* the package. The original electrical netlist is not altered or deleted.
- Wires are re-routed when parts move or rotate. A change that would block existing connections is rejected.

## Wire layering

- Solid wires get the lowest available shallow lane; overlapping paths get additional clearance height.
- Raised jumper wires are **always above the highest solid wire**, even if they were created first.
- Jumper tracks also receive independent clearance lanes where their paths cross.
- 3D wire preview and committed geometry share one point generator, so they appear in the same physical position.
- All wire styling/routing is visual; no signal connectivity or electronic part model is changed.

## Validation

Run `npm install`, then `npm run test:physical`, `npm run test:editor`, `npm run test:drag`, `npm run test:circuits`, `npm run test:projects`, and `npm run build` from the project root.

`test:physical` verifies IC collision rejection, moving parts, obstacle-free routing, wire layering, and half/full adder compatibility.

## Scope and limitations

This is **approximate engineering collision geometry**, not exact mesh-to-mesh rigid-body physics for every model. Breadboard holes and component bodies use approximated footprints rather than per-triangle collision meshes. Shared electrical plug endpoints can coincide in older saved circuits. Previously saved overlapping components are preserved; the new rules prevent invalid *new* placements and flag unroutable wires. Full browser pointer/WebGL testing still needs to be performed in a working Vite installation.
