# ElectroLab — Navy-Blue Theme Update

This update changes the Studio simulator interface from violet/purple to navy blue, while retaining the dark-gray 3D workspace, editable electronics, and clear OLED/LCD text.

## Visual changes

- Active Design/Wiring/Code/Simulate buttons: navy-to-blue gradient with light blue borders.
- Selected editing tools, 3D/2D toggle, project library filters and component tiles: navy-blue selection and hover states.
- Right-side Properties panel, pin inspector and action buttons: navy backgrounds, steel-blue surfaces and accents.
- Monitor, Wiring Guide, Truth Table and Arduino Code tabs: blue active indicators.
- Code Terminal and Simulation Console: navy-tinted panels with soft blue accents.
- Top Run & Results action: navy-blue gradient. Green Run and red warnings retain their meaningful status colors.
- Updated Tailwind's legacy `violet-*`, `purple-*`, and `indigo-*` utility palette so older views use navy shades rather than purple.
- Blue focus outlines and hover states for accessibility.

The physical components and electrical simulation are unchanged. LED colors, resistor bands, multicolored wiring and warning/status colors remain intact.

## Install the patch

1. Extract the **patch ZIP** into the root of the existing ElectroLab project, e.g. `D:\GitHub\ElectroLab`. The patch contains `src/index.css`, `tailwind.config.js`, `package.json`, a new regression test, and this document at the ZIP root.
2. Overwrite matching files.
3. Run:

```powershell
npm install
npm run test:navy-theme
npm run build
npm run dev
```

Reload the browser with Ctrl+Shift+R if existing style assets are cached.

## Tests

- The new `npm run test:navy-theme` checks all primary Studio accents and validates that no purple colors remain in the Studio CSS.
- Existing studio, clean-dock, editor, Arduino code, reference UI, hover-label, realism and seven-segment source/regression suites passed.
- CSS parses successfully with PostCSS.
- **A full production build could not be completed in this environment** because local npm dependency folders lack some required package files/type definitions. Run `npm install` and `npm run build` on your machine to verify the finished bundle.
