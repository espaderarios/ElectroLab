# ElectroLab 3D Simulator – Solid Object Placement Fixes

## Added
- Physical footprint collision checks for component placement
- Collision checks for moving components
- Collision checks for rotating components
- Collision checks for manual pin reassignment
- Part-body obstacle avoidance for wire routing
- Red placement rings on the 3D ghost when the target position is blocked

## Behavior changes
- Components can no longer be dropped on top of other component bodies
- ICs now behave like solid packages instead of only checking whether pins use different holes
- Wires try to route around ICs and other larger parts instead of visually cutting through them
- Wider detour lanes were added so routing can avoid large parts more cleanly

## Notes
- Electrical connectivity still depends on the real pin/hole assignments.
- The new obstacle system only affects placement validation and 3D wire rendering paths.
