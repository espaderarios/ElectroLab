# ElectroLab: hover labels no longer block switches/buttons

## Changes

- Floating names and pin labels remain **hover-only** and are now displayed **above and to the side** of the component, instead of centered over the actuator.
- The **entire** React Three Fiber / Drei HTML tooltip wrapper and its children use `pointer-events: none`, so the HTML element cannot intercept a click intended for the physical 3D mesh.
- Clicking the actual blue SPST switch lever now toggles the switch on the **first click**. Clicking the rest of the housing still selects it for property edits.
- Tactile push buttons react to the **first press**, even if they were not previously selected; the pointer-up/release behavior is preserved.
- Labels continue disappearing when the cursor leaves the part or canvas. No changes to saved circuits, electrical logic, Arduino pins, or the gray/navy color theme.

## Test

Run `npm run test:hover-click-target`. The new test checks that the tooltip wrapper is click-through, visually offset, and that direct 3D switch/button interactions remain enabled.

This is a source-level interaction fix; a final live WebGL/browser hover check is recommended after `npm ci && npm run dev` on your computer.
