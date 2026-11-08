# ElectroLab — Insert tab component library (Word-inspired UI)

The Electronics **component palette is no longer a permanent left sidebar**. The 3D workbench occupies the full center width, with the existing right Properties inspector and bottom monitoring dock preserved.

## How to insert a component

1. Choose **Insert** on the top ribbon.
2. Select **All parts**, a quick kind such as **Passive**, **Semiconductors**, **Logic ICs**, **Microcontrollers**, **Controllers**, **Sensors** or **Output Devices**, or **More kinds** for the full list.
3. A floating **Insert components by kind** gallery appears under the ribbon. Choose from *all* catalog kinds using its categorized chips, or type a name, part number, or pin into Search. Favorites and Recent are also available.
4. **Click** a part to select its placement tool and close the gallery, then click its breadboard holes; or **drag** the part from the gallery directly onto the 3D workbench. The gallery closes after a successful drop.
5. For microcontrollers, drag the board to the off-board workbench and wire its actual header sockets to the breadboard, as in the previous controller fix.

**Circuits** and **Examples** are also within Insert, where they open a floating gallery rather than a left drawer. Breadboard size is an always-visible control at the end of the Insert ribbon. Home → Parts library is a shortcut into Insert.

**Wiring tools are in Wiring**, including Solid/Jumper style, color, and animation. The W shortcut or **Wire** button automatically selects Wiring instead of opening the old parts panel. The gallery closes when leaving Insert, pressing Escape, collapsing the ribbon or entering Focus Workbench.

## UI details

- All existing catalog items come from the same `PALETTE` and expansion catalogs. No new fake components were introduced.
- The ribbon still scrolls horizontally on smaller viewports; the floating gallery becomes narrower and uses a 3- or 2-column grid depending on screen width.
- No static left-side component container is rendered. The floating gallery overlays the workspace temporarily instead of shrinking the 3D canvas.
- The right-side Properties inspector still opens when selecting a 3D part.

## Validation

- TypeScript: `node node_modules/typescript/bin/tsc -b --pretty false` — passed using dependencies from the user-provided ZIP.
- Regression suites: 35/35 passed, including the new `insert-component-gallery.cjs` suite. Old tests that asserted the previous sidebar was present were updated to assert the new ribbon behavior.
- The production Vite bundle could not be generated in the container because the supplied dependencies included Windows native Rollup packages, but not the required `@rollup/rollup-linux-x64-gnu` binary. Use `npm ci` then `npm run build` on a machine with package registry access before deployment.
- Live GPU/browser visual behavior still requires verification in a local browser.
