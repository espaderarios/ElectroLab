> **November 8, 2026 — Insert gallery update:** The old Components drawer described below has been replaced by a floating, categorized gallery that opens under **Insert**. The library no longer takes space from the 3D viewport. See `INSERT_RIBBON_COMPONENT_KINDS.md` for the current behavior. The notes below describe the previous ribbon iteration.

# ElectroLab: Word-inspired 3D simulator ribbon

This update uses Microsoft Word's **tab + contextual ribbon + grouped commands** interaction pattern as a reference while keeping ElectroLab's own navy/gray appearance. It replaces the previous long row of buttons, prioritizing a large 3D breadboard workbench.

## Layout

- **Title / quick actions:** Back to Projects, project name and auto-save status, 3D/2D switch, Run & Results, More, Settings and Help.
- **Ribbon tabs:** Components panel toggle, **Home**, **Insert**, **Wiring**, **Simulation**, and **View**.
- **Contextual ribbon:** Only the commands for the selected tab are visible, with small group labels similar to a document editor. Controls scroll horizontally on narrow screens.
- **Component drawer:** Minimized by default so the 3D workbench has more room; reopens using the Components toggle, **Home → Parts library**, or **Insert → Show library**. Within Insert, **Parts / Circuits / Examples** appear only while the library is open, and disappear with it on closing.
- **Properties rail:** Minimized until a component is selected; selecting a different part opens its existing live inspector. The panel can also be toggled from **View → Properties**.
- **Bottom dock:** Keeps the previous monitor, wiring guide, truth table, code and voltage controls. Open it with Code, Monitor or its bottom-edge toggle.

## Ribbon commands

| Tab | Controls |
|---|---|
| Home | Parts library, Select, Wire, Pan, Rotate, Delete, Tidy wires, Undo/Redo, Run, Monitor, Code, Fit board, Focus parts |
| Insert | Show library; Parts, Circuits, Examples (while library is open); quick-insert Resistor, LED, Switch, Arduino; Select, Pan |
| Wiring | Wire, Select, Auto tidy, Solid/Jumper wire style, seven wire colors, Animate flow |
| Simulation | Run, power on/off, Results, Monitor, Arduino code |
| View | 3D/2D, zoom, Fit board, Focus parts, Fullscreen, Components drawer, Properties, Focus mode |

### Screen-space tools

- **Hide ribbon** minimizes the command groups and leaves the tab row; click a tab or press **Ctrl+F1** to reopen.
- **Focus workbench** collapses the ribbon, component library, inspector and expanded bottom dock. Click it again to restore the previous layout. Opening the monitor from Focus mode exits Focus automatically.
- **Alt+B** toggles the diagnostics dock.
- On smaller screens, the component library overlays the 3D viewport rather than permanently narrowing it.
- An unobtrusive **Start building: open Parts library** hint is shown only for empty projects with the library hidden.

## Functional compatibility

All actions continue calling the existing simulation, palette, undo/redo, camera, physical placement, 3D controller header, inspector and wiring state handlers. Existing 3D component and controller wiring fixes from the previous complete ZIP remain included.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc -b --pretty false` — passed.
- Regression suites: 34/34 `.cjs` files — passed (the two old one-row toolbar tests and six other layout-dependent expectations were updated for the new tabbed ribbon).
- Production Vite build: not verified in this environment because the provided `node_modules` contains Windows Rollup native packages but not `@rollup/rollup-linux-x64-gnu`. Run `npm ci` on your own system before `npm run build`.
- Actual interactive browser/GPU behavior needs browser verification on the user's device.

## Run

```bash
npm ci
npm run dev
```

The full ZIP intentionally excludes `node_modules`, `dist` and Git history. The Patch ZIP can be extracted into the root of the previously delivered `ElectroLab_Collapsible_Components_Toolbar_Fixed.zip` project, allowing file replacement while preserving other project assets.
