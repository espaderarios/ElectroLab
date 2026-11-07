# ElectroLab – Bottom Dock & 3D Performance Update

## Full bottom dock toggle
- A bottom-center **Show power & monitor / Hide bottom controls** button hides or restores the entire power and diagnostics dock.
- The collapsed dock leaves a slim bottom handle with power status; the 3D canvas expands into the freed space.
- Use **Alt+B** to toggle, except while editing an input or text area.
- The choice is remembered in this browser via `localStorage`, defaulting to collapsed for more 3D workbench space.
- Closing the dock removes the detailed monitor, wiring guide, and truth table from the React tree rather than just hiding them with CSS. The circuit itself keeps running, and no data is erased.

## Faster 3D mode
- **Fast 3D** is enabled by default and is switchable to **Detail 3D** in the dock's power bar.
- Fast 3D renders at device pixel ratio 1, suppresses dynamic mesh/contact shadows, and uses a demand-based ~30 Hz render heartbeat (user interactions can request extra frames).
- Fast 3D runs virtual MCU/peripheral simulation ticks at ~10 Hz instead of 20 Hz. Detail mode retains 20 Hz ticks.
- Detail 3D keeps higher pixel density and lighting/shadow effects.
- Fast/Detail preference persists in local browser storage.
- These are targeted performance optimizations, not a measured FPS guarantee. Results depend on the user's GPU, device, and circuit size.

## Tests
Run from the project root with dependencies installed:

```powershell
npm run test:performance-ui
npm run test:reference-ui
npm run test:ui
npm run test:circuits
npm run test:physical
npm run build
npm run dev
```

The static UI tests validate that controls are wired correctly; WebGL frame rate and pointer interactions still require browser testing.
