# ElectroLab: Charcoal Gray + Navy Blue, GitHub Pages Deep Links

## Design
The gray / graphite studio reference remains the basis for the interface.
Only purple/violet interactive accents (buttons, active tabs, selected cards, focus
outlines, tool tips) were changed to navy and steel blue. Panels, code editor,
workspace, neutral borders and shadows are restored to charcoal gray. The 3D
workbench stays dark gray, and real electrical colors (wires, LEDs, resistors)
are not recolored.

## Pages URL fix
Before: `base: './'` caused a deep link such as `/ElectroLab/editor/half-adder`
to fetch `/ElectroLab/editor/assets/*.js`, which does not exist.

After: production uses `base: '/ElectroLab/'`, so generated JS, CSS and favicon
paths always resolve from `/ElectroLab/`. The GitHub Pages deployment action
copies `dist/index.html` to `dist/404.html` to let React Router open deep links.
The BrowserRouter basename derives from the build base. A separate
repository-root `404.html` + early `index.html` restoration script also protects
branch-based Pages deployments, without changing the GitHub Actions fallback.

### Commands

```sh
npm ci
npm run test:gray-navy-pages
npm run build        # GitHub Pages (absolute /ElectroLab/ assets)
npm run dev
```

Push the updated code to the `main` branch to trigger the Pages workflow.
Ensure repository Settings → Pages → Build and deployment → **GitHub Actions**.
A Pages direct URL may initially have HTTP 404 status because GitHub Pages
serves the SPA via its 404.html fallback; the actual app and assets should load.

For Windows/Tauri, the updated `beforeBuildCommand` runs
`npm run build:desktop`, which retains relative asset paths.

If old CSS/JS paths remain, hard-refresh (Ctrl+Shift+R) and confirm the Pages
deployment is current.
