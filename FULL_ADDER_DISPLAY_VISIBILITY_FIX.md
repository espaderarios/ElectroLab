# ElectroLab — Full Adder Seven-Segment Visibility Fix

## Why the display was missing

Projects are stored in browser storage (Zustand persist). Source code changes to a seeded Full Adder do not overwrite saved data. Consequently, reopening the old premade Full Adder continued to show its previous components, without the new seven-segment display. Some prior ZIPs also contained an additional parent folder, preventing patch files from replacing the existing source files when extracted into the project root.

## Fix

- Bump project storage migration to **v9**. When an older saved premade `full-adder` has no seven-segment display, ElectroLab copies the original circuit into a new **Backup — Full Adder (before 7-segment update)** project and installs the updated factory circuit under the original `full-adder` ID.
- If the saved Full Adder already contains a seven-segment part, retain its custom circuit unchanged.
- If an old circuit is still open without the display, a clear banner offers **Restore original circuit**, which creates a backup before restoring.
- Project list descriptions and the diagnostics Truth Table describe the 0–3 decimal digit.
- The Full Adder physical seven-segment model is on the right side of the breadboard, connected to a simplified gate-based decoder.
- Both release ZIPs have their `src/` directory at the archive root, so extraction into `D:\GitHub\ElectroLab` replaces the intended files.

## Verify

Run:

```powershell
npm run test:circuits
npm run test:projects
npm run build
npm run dev
```

After refreshing the page, open **Projects → Full Adder** and look for the 7-segment display near the right edge of the breadboard. Turn power on and toggle A, B, and Cin. The digit should be 0, 1, 2, or 3. Expand the bottom Monitor for the same numerical result and the Truth Table for all eight input combinations.

**Electrical teaching note:** This display demo uses simplified gate/LED loading in the simulator. A real breadboard implementation needs a series current-limiting resistor on every seven-segment LED channel and must stay within the logic IC's output current ratings. The demo should not be replicated physically without those protections.

## Validation

The automated circuit tests validate all eight Full Adder input combinations and confirm expected digits 0–3. The projects migration tests validate backup creation, preservation of other projects, and idempotence. A complete Vite build and live WebGL session require the npm dependencies installed in the user's environment.
