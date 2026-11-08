# ElectroLab – unified simulator toolbar redesign

## Layout

- A single second-row toolbar starts with the Components panel toggle. When expanded, it shows Parts, Circuits, and Examples on that SAME row.
- **Close Components:** the sidebar AND all three tabs (including their divider) disappear together, leaving only the Components button. Code, Simulate, Run, and edit tools immediately slide left into the freed space rather than keeping a blank gap.
- **Reopen Components:** the tabs and sidebar return with the previously selected Parts/Circuits/Examples tab. The Components button also reopens the 3D library if clicked while the 2D view is active.
- Code and Simulate have moved to the right, ahead of the existing Run action and 3D editing tools.
- The redundant "Design" and "Wiring" mode labels were removed, since the actual Select and Wire tools are already available.
- The extra left sidebar "Components" title row with its close X was removed. The sidebar begins immediately with searchable component content (or the Circuits/Examples list), giving more usable height.
- On narrow screens the library tabs remain accessible while the tools can be scrolled horizontally. Tabs reduce to accessible icons at mobile/tablet widths.
- At desktop widths 1600px+, the component library widens to 320px for readable part cards.

## Preserved functionality

- Sidebar toggle and tab selection; Parts, Circuits and Examples are available whenever the library is open, and are accessible again through the single Components button when closed.
- Code opens the existing Arduino sketch editor (enabled when an MCU is present).
- Simulate opens the existing monitor, Run starts the existing circuit simulation.
- Select, Pan, Wire, Undo/Redo, Rotate, Delete, Zoom/Fit, Fullscreen remain functional.
- Existing controller off-board placement and independent electrical pins are unchanged.
- Dark navy controls / dark-gray workbench remain unchanged.

## Verification

- TypeScript: `node node_modules/typescript/bin/tsc -b`
- Regression suite: `for f in tests/*.cjs; do node "$f" || break; done`
- Toolbar collapse and layout tests: `npm run test:toolbar-layout` (including `tests/collapsible-toolbar.cjs`)
- Production build: `npm ci && npm run build` in a correctly installed environment.

Note: A bundled Windows node_modules directory cannot be used on a Linux build
host without installing Linux-native optional Rollup/esbuild dependencies. The
source ZIP intentionally omits node_modules, .git, and built output.
