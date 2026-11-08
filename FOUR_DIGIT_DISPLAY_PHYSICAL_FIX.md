# Four-digit 7-segment 3D model correction

The `Four-Digit 7-Segment` Insert component (`display-4digit`) previously appeared as four tiny vertical patterns on a generic blue PCB, which does not resemble a physical bare multi-digit LED package.

Updated the Three.js mesh to use a black molded 12-pin DIP-style display housing with a dark red tinted lens, four equally spaced digits, seven tapered segments per digit (a–g), and a decimal point at each digit. The bare LED housing no longer uses the generic blue breakout-board model. The side contact rows remain accessible for breadboard wiring. The separate `10-LED Bar Graph` module is unchanged.

**Important simulation limitation:** `display-4digit` remains a **prototype**. The physical 12 terminals can be wired but digit multiplexing/LED activation is **not yet simulated**. The red segments are intentionally unlit when placed; the change does not pretend the display is electrically operating.

## Checks

```
node tests/four-digit-display-realism.cjs
node tests/wiring-contact-realism.cjs
node node_modules/typescript/bin/tsc -b --pretty false
```

Tested: 38 regression suites and TypeScript compilation. Live browser/WebGL display not verified here.
