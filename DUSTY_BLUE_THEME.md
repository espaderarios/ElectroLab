> **Historical design note:** This Dusty Blue theme has been superseded by `NEON_CIRCUIT_THEME.md`. The active website now uses electric cyan, deep navy, blue and metallic silver.

# ElectroLab – Dusty Blue Theme

The supplied palette is reproduced in `tailwind.config.js` (`dusty.*`) and `src/index.css` (`--dusty-*`):

| Swatch | Hex | Role |
| --- | --- | --- |
| Midnight blue | `#182434` | Dark background, headings |
| Steel blue | `#6D829B` | Accents and elevated highlights |
| Muted blue | `#8D98AA` | Midtones and borders |
| Mist blue | `#A3AFBC` | Secondary highlight |
| Powder blue | `#B3BDCA` | Secondary text and light outlines |
| Warm stone | `#DCD9D8` | Soft light background |

The interface preserves a dark/light mode toggle. UI blue/cyan/indigo/violet accents are harmonized to the reference. Dark canvas and electronics signal/status colors remain legible and distinct for simulator accuracy.

## Run

```bash
npm ci
npm run dev
npm run build
```

`index.html` was restored to mount the React app; the unrelated original résumé HTML was preserved as `resume-original.html`.
