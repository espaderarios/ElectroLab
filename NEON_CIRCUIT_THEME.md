# ElectroLab — Neon Circuit Design

## What changed

- **Entrance animation:** the supplied blue PCB reference is the animated backdrop; glowing SVG traces sweep across the board, the centered ElectroLab logo illuminates, and a short loading bar runs before the site fades in.
- **No forced delay:** users can click **Skip intro** or press Escape; animation automatically completes in about 4.5 seconds.
- **Frequency:** shows the first time this tab enters ElectroLab, not on every page change. To replay it, go to **Settings → Appearance → Replay ElectroLab intro**.
- **Accessibility:** respects operating-system `prefers-reduced-motion` and the site's **Settings → Reduce motion** preference.
- **Site palette:** navy `#030919`, deep blue `#071A38`, cobalt `#0D3C80`, electric blue `#0B91FF`, ion cyan `#2BE9FF`, metallic silver `#C3D7EB`.
- **Simulator:** visual surfaces and controls updated for consistent navy/cyan styling; wire color conventions, alerts, circuit definitions and electrical simulation logic are preserved.
- **Light mode:** coordinated ice-blue/metallic palette still available from the sidebar.

## Source files

- `src/components/EntranceAnimation.tsx` — accessible, skippable, auto-dismissed React intro.
- `src/components/EntranceAnimation.css` — animated circuit signals, logo reveal and loading bar.
- `src/assets/pcb-neon-bg.webp` — optimized copy of the user-provided circuit-board image.
- `src/assets/electrolab-logo-transparent.webp` — transparent optimized ElectroLab logo derived from the existing favicon.
- `src/index.css`, `src/styles.css`, `tailwind.config.js` — visual color system.
- `src/pages/SettingsPage.tsx` — Replay button and reduced-motion control.
- `src/App.tsx` — intro lifecycle and theme meta color.

## Verify locally

```powershell
cd D:\GitHub\ElectroLab
npm install
npm run test:circuits
npm run dev
```

The intro is not a video or external dependency. All artwork is packaged in the project, so it also loads offline once the app is installed/built. The Vite production build requires installing the package dependencies locally.
