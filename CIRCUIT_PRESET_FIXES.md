# ElectroLab 3D circuit simulator — adder examples and fixes

## Open the adder circuits

1. Run `npm install` in the ElectroLab project folder (the one with `package.json`).
2. Run `npm run dev`, open the browser URL, and go to **Templates**.
3. Select **Half Adder · 2 inputs** or **Full Adder · 3 inputs**. Every template (including the original motor, RC and LED examples) creates a new, editable project so your saved work is not overwritten.
4. In the 3D editor, turn on the **5 V** bench power supply. Click a switch once to select it, then click it again to toggle it. A and B are the first two switches; the full adder has a third **Cin** switch.
5. Green **SUM** LED and red **CARRY** LED show each logic output. All input switches are initially open (logic 0). To return them to 0, toggle the switch off.

## Actual component layout

| Example | Components | Logic |
|---|---|---|
| Half adder | 1 × 74HC86 quad XOR, 1 × 74HC08 quad AND, 2 × SPST input switches, 2 × 10 kΩ input pull-downs, 2 × 680 Ω output resistors, 2 × LEDs | SUM = A XOR B; CARRY = A AND B |
| Full adder | The same two chips plus 1 × 74HC32 quad OR, 3 × SPST input switches, 3 × 10 kΩ pull-downs, 2 × 680 Ω output resistors, 2 × LEDs | SUM = A XOR B XOR Cin; CARRY = (A AND B) OR (Cin AND (A XOR B)) |

Each logic chip is a physical DIP-14 footprint straddling the breadboard channel, with **pin 14 connected to +5 V** and **pin 7 connected to GND**. The examples bridge both halves of the standard breadboard's divided power rails, so chip supply connections on columns 26–50 work correctly.

## Corrected IC pinouts

The UI inspector and simulator now use a shared per-chip physical pinout table in `src/circuit/logic-ics.ts`.

- **74HC02 NOR:** output pins 1, 4, 10, 13 (the earlier general quad-gate mapping was wrong).
- **CD4077B XNOR:** output pins 3, 4, 10, 11 (the earlier general quad-gate mapping was wrong).
- **74HC04 NOT:** 1→2, 3→4, 5→6, 9→8, 11→10, 13→12.
- **74HC00 NAND, 74HC08 AND, 74HC32 OR, 74HC86 XOR:** 1,2→3; 4,5→6; 9,10→8; 12,13→11.

The simulator also reevaluates combinational gates until their output signals stabilize, rather than evaluating only one pass. This is necessary for the cascaded full-adder topology. The 3D body labels and inspector now identify IC models accurately, including when the power is off.

## Other fixes and checks

- `First Light` used to have no LED/resistor. It now includes a powered 330 Ω / LED circuit that draws approximately 9 mA at 5 V.
- Removed redundant wire drawings in seeded motor, RC, diode/LED and LED/button examples.
- Renamed the former *Battery Charger Circuit* seed to *9 V Diode and LED Indicator*, because the design contained no rechargeable cell or proper charger control circuit.
- Initial built-in project statuses are `Draft` until the user performs a simulation. Previously, example statuses claimed a successful run in advance. Previously saved browser projects are intentionally not forcibly changed.
- No hard shorts were found during checks of the six seeded project circuits or three lab presets; the button-controlled LED and SCR motor examples were tested with buttons closed.
- NOR and XNOR truth table tests, 4 half-adder truth-table cases, and 8 full-adder cases passed.
- All source TS/TSX files were parsed successfully. A complete Vite production build was **not** verified in the packaging environment because npm dependencies could not be fetched.

## Run automated regression tests

```powershell
cd D:\GitHub\ElectroLab
npm install
npm run test:circuits
npm run dev
# Optional production build after dependency installation:
npm run build
```

## Notes

This is an educational, idealized combinational/DC circuit simulation, not a transistor-level timing, fan-out or manufacturer-SPICE model. The input pull-downs make the intended 0/1 states unambiguous. Custom logic feedback loops or electrical contention may require a more detailed model.

Pinout references: Texas Instruments [SN74HC02](https://www.ti.com/product/SN74HC02), [SN74HC86](https://www.ti.com/product/SN74HC86) and [CD4077B](https://www.ti.com/product/CD4077B) data sheets.
