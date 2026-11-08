# Insert ribbon: streamlined component gallery (November 2026)

The Insert gallery now has **two intentional layouts**:

- **All Parts:** Displays the full gallery heading, Parts / Circuits / Examples tabs, component count, search, All / Favorites / Recent filters, and the component-kind chips, followed by the grouped component cards. These are all in **one scroll container**, including search and chips: they scroll up and out of sight as you browse downward, freeing the full popover height for components. There is no fixed or sticky filter area and no nested category scrollbar.
- **Specific kind (e.g. Passive, Semiconductors):** Shows only the search bar and that kind's component cards, without the duplicate heading, tabs, filters, category chips, or repeated category section title. A small close icon is located inside the search row; Escape, clicking outside, or clicking the selected ribbon kind also closes the gallery.

Changing to a different kind resets the gallery scroll position to the search field and clears an old search query when the kind actually changes. Click **All parts** in the ribbon to browse all kinds again. Existing drag-to-place, favorite toggling, circuit/exemplar galleries, and offboard wiring were not changed.

## Validation

- TypeScript (`node node_modules/typescript/bin/tsc -b`): passed with existing dependencies.
- Regression suites, including `tests/insert-gallery-compact-scroll.cjs`: run with `node tests/<filename>.cjs`.
- Browser/WebGL visual testing and production bundling require native dependencies for the build platform. On a developer computer, run `npm ci && npm run build`.
