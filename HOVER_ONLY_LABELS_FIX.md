# ElectroLab — Hover-Only 3D Labels

- Floating annotations on components (ICs, diodes, transistors, etc.) are hidden when the pointer is not over that particular component.
- Arduino and LCD/OLED connector tooltips appear on actual pin hover only.
- The visible lettering on the LCD/OLED display is rendered in the 3D screen texture and remains visible while powered.
- Permanent top-left placement-status banner removed; full placement instructions collapse into a small `?` at the lower left. Hover or focus the `?` to reveal instructions.
- Wire tool, drag and drop, simulator electrical logic, and premade project connections are unchanged.

To validate the new label behavior: `npm run test:hover-labels`, then `npm run dev` to check the visual behavior with the cursor in a WebGL browser.

Build validation caveat: automated source and contract checks passed but full browser/WebGL rendering and Vite production build were not verified here due to unavailable npm dependencies.
