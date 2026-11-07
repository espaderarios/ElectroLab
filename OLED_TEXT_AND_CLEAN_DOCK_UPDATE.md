# ElectroLab — Cleaner bottom panel & sharper display lettering

## Changes implemented

1. Removed the duplicate **Power On / Power Off** buttons from the bottom workbench. The top **Run** control and the right-side **Properties → Simulation** power controls remain functional.
2. Combined the remaining controls (voltage, live current, Fast 3D, quality preset, 3D Drag) into the same compact toolbar as **Monitor**, **Wiring Guide**, **Truth Table**, and **Arduino Code**. No separate power-button row takes space from the 3D viewport.
3. Improved **SSD1306 OLED** on-device text: 1024×512 canvas (8× native pixel resolution), high-contrast unblurred glyphs, adaptive type size that enlarges one- and two-line messages, automatic 16-character width fitting, and clipping to the physical screen. Texture filtering and anisotropy help in perspective views.
4. Increased **16×2 LCD** texture resolution to 1024×256 and adjusted the character rendering to improve legibility.
5. Kept changes visual-only with no changes to the electrical simulation or previously saved circuits.

## How to test

```powershell
npm install
npm run test:clean-dock-screen
npm run test:oled-screen
npm run test:reference-ui
npm run build
npm run dev
```

Open **Arduino Uno + I²C OLED**, turn the simulation on with the top **Run** button, and inspect the OLED at a reasonable camera zoom. The bottom panel now contains no duplicate power-toggle buttons, while the right Properties rail can still turn the simulation off.

Note: browser/WebGL viewing and a full Vite production build require installed npm dependencies; automated checks are not a substitute for that visual verification.
