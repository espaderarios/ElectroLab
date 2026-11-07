# ElectroLab — Toolbar toggle & contextual pin label fix

## Toolbar
- Click **Select**, **Wire**, or **Pan** again to exit that mode. No editor mode remains highlighted after exiting.
- V and W keyboard shortcuts also toggle Select/Wire off when already active; P toggles Pan; Escape cancels the active mode.
- Mode switching clears unfinished wire endpoints and stale selection state through the existing store action.
- In neutral mode, camera navigation remains available without accidentally selecting or placing a component.

## 3D labels
- Arduino socket labels appear on hover, and a wire's selected start socket remains identified until the connection is completed or canceled.
- Hover labels are cleared as soon as the pointer leaves the 3D canvas (including moves into the toolbar), or when the window loses focus.
- The tooltip's secondary instruction appears only in Wire mode to reduce clutter.
- LCD's floating component-name label appears only when the LCD is selected or one of its pins is hovered; the actual LCD/OLED screen text is unchanged.

## Verification
- `npm run test:toolbar-hover` checks the mode-transition logic, keyboard integration and hover-label contracts.
- The existing 15 regression suites also pass (Arduino headers, adders, displays, projects, editing and UI).
- TypeScript/TSX syntax checked across the source. Full Vite build not executed here: npm offline installation is blocked because package `zustand` is absent from the local cache.

Extract the patch into the ElectroLab root folder, replacing matching source files.
