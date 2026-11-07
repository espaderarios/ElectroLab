# ElectroLab — Project browser and 3D editor UI fixes

## Projects

- **Quick-start** cards for the premade Half Adder and Full Adder appear at the top of the Projects page. Both circuits use the existing working logic-gate IC and breadboard simulation implementation.
- Replaced cramped project table with responsive cards. **Click anywhere on the card** to open it in the 3D editor; no small Open button is required.
- Rename, results, and delete remain accessible through distinct action buttons and do not accidentally open the project.
- Searches and status filters still work.
- **Saved-data migration:** version `5` of the existing `electrolab-projects-v4` persisted store automatically adds missing half/full-adder seed records when upgrading from version 4. Existing user projects, edits, activity, simulation runs, and preference settings are preserved. Migration runs once; a deliberate later deletion will stay deleted. The migration test is in `tests/projects-upgrade.cjs`.

## 3D editor interface

- Wider, readable palette sidebar and clearer toolbar with horizontal overflow on smaller desktops.
- Component inspector uses a solid high-contrast background instead of a see-through panel, improved input/label contrast, and starts at the top when a different component is selected.
- Component inspector can be closed and reopened to reveal the circuit board.
- Removed large, always-visible Select mode tutorial overlay. Placement instructions are now compact and expandable only when actively placing/connecting parts.
- Simulation controls and popups have clearer spacing and more legible backgrounds.
- Repaired reversed Zoom In / Zoom Out actions.
- Initial/Reset camera framing adapts to selected breadboard dimensions and viewport dimensions, rather than opening cropped and magnified.
- Back button now returns to the Projects screen.
- Replaced the nonfunctional Share button with an **Export** JSON project action. Project JSON can be imported through existing import workflow.
- The More Components action now opens the component library.

## Tests / installation

From the project root:

```powershell
npm install
npm run test:circuits
npm run test:projects
npm run dev
```

The tests verified the half-adder/full-adder truth tables, physical IC pin connections, existing circuit presets, and the v4-to-v5 project migration. TypeScript/TSX syntax and CSS parsing were checked. The complete Vite build/browser rendering could not be tested in the sandbox because dependency installation was unavailable.

If deploying over an existing copy, replace the project source with this version, run `npm install`, and rebuild/redeploy. You do **not** need to clear browser storage to see the new adder projects. For the old cached JavaScript bundle, hard-refresh after deployment (Ctrl+F5).
