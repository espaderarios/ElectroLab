# ElectroLab — Dark-Gray 3D Workbench

This update changes only the **3D workbench surroundings** to a neutral graphite-gray environment inspired by the supplied circuit simulator reference.

## Visual changes

- 3D background and matching fog: `#282F39`
- Floor: `#303843`, matte finish
- Fine grid: `#46515F`
- Major grid lines: `#5A6877`
- Fallback canvas and editor-stage backgrounds updated to matching dark-gray values

## Unchanged

- Neon-blue navigation, inspector, and other interface controls
- White breadboard, power source, and component materials
- Electrical wire color and rendering rules
- Saved project structure, circuit behavior, and simulation models
- Fast 3D mode and the current input / dragging workflow

## Quick test

```
npm run test:workbench-theme
npm run build
npm run dev
```

Source syntax and all available automated suites were verified locally. A browser/WebGL screenshot and full Vite build need an environment with the application's installed npm dependencies.
