# Full Adder Visual Demonstration Update

This update upgrades the premade **Full Adder** into a more complete educational demo.

## What changed
- Added a **7-segment display** to the premade Full Adder circuit.
- The display shows the decimal result **0, 1, 2, or 3** based on the binary output `(Carry, Sum)`.
- Added a **74HC04 inverter** stage to help decode the output for the display.
- Reused spare gates from the existing **74HC08** and **74HC32** chips to build the display decoder.
- Updated the monitor/truth-table text so the Full Adder explains the visual demo better.
- Updated project/template descriptions to mention the 7-segment display.
- Updated the circuit regression test so the Full Adder is checked for the correct displayed digit.

## Full Adder visual behavior
- Inputs: **A, B, Cin**
- Outputs:
  - **Sum**
  - **Carry**
  - **7-segment digit = binary result shown as decimal**

Examples:
- 0 + 0 + 0 → `00` → **0**
- 1 + 0 + 0 → `01` → **1**
- 1 + 1 + 0 → `10` → **2**
- 1 + 1 + 1 → `11` → **3**

## Verification
- `npm run test:circuits` passes in this updated package.
