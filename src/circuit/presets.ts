import { uid } from "@/lib/utils";
import type { PlacedPart, Wire, WireColor } from "./types";
import { circuitArduinoLcd } from "./display-examples";

export interface LabPreset {
  id: string;
  title: string;
  blurb: string;
  steps: string[];
  psuPositive: string;
  psuNegative: string;
  parts: PlacedPart[];
  wires: Wire[];
}

function W(a: string, b: string, color: WireColor): Wire {
  return { id: uid("w"), a, b, color };
}

export function helloWorldPreset(): LabPreset {
  // Keep the older learning-lab entry aligned with the clean editable 3D
  // template. This avoids showing the obsolete 7-wire LCD placeholder.
  const circuit = circuitArduinoLcd();
  return {
    id: 'hello-world',
    title: 'Hello, World! — Arduino + LCD',
    blurb: 'Actual 4-bit HD44780 jumper wiring, 10k contrast and a series backlight resistor.',
    steps: [
      'All connections are real editable wires, not baked into component models.',
      'Turn on the 5 V bench supply. The Arduino will drive LCD RS/E/D4–D7.',
      'Open Wiring guide to highlight each connection; it does not add wires.',
      'Try unplugging one wire to see which signal or power connection is missing.',
    ],
    psuPositive: circuit.psuPositive ?? 'tp5',
    psuNegative: circuit.psuNegative ?? 'tn5',
    parts: circuit.parts,
    wires: circuit.wires,
  };
}

export function firstLightPreset(): LabPreset {
  const resistorId = uid("r");
  const ledId = uid("led");
  return {
    id: "first-light",
    title: "First Light",
    blurb: "A complete, powered LED and series current-limiting resistor circuit.",
    steps: [
      "The 330 Ω resistor and red LED are already wired in series.",
      "Turn on the 5 V supply. The LED should draw approximately 9 mA.",
      "Try reversing the LED leads — diodes conduct in only one direction.",
      "Probe the resistor and LED terminals to observe the voltage drops.",
    ],
    psuPositive: "tp1",
    psuNegative: "tn1",
    parts: [
      { id: resistorId, kind: "resistor", pins: { a: "E5", b: "E9" }, props: { resistance: 330, label: "330 Ω" } },
      { id: ledId, kind: "led", pins: { a: "E9", k: "E10" }, props: { ledColor: "red", label: "LED" } },
    ],
    wires: [W("tp5", "A5", "red"), W("A10", "tn10", "black")],
  };
}

export function dividerPreset(): LabPreset {
  const r1 = uid("r");
  const r2 = uid("r");
  return {
    id: "divider",
    title: "Voltage Divider",
    blurb: "Two equal resistors split 5 V into 2.5 V at the midpoint.",
    steps: [
      "Power on the supply.",
      "Select the probe tool and tap the midpoint hole (A10).",
      "You should read about 2.5 V versus ground.",
      "Swap one resistor for 10 kΩ and watch the ratio change.",
    ],
    psuPositive: "tp1",
    psuNegative: "tn1",
    parts: [
      { id: r1, kind: "resistor", pins: { a: "A5", b: "A10" }, props: { resistance: 1000 } },
      { id: r2, kind: "resistor", pins: { a: "A10", b: "A15" }, props: { resistance: 1000 } },
    ],
    wires: [
      W("tp5", "A5", "red"),
      W("A15", "tn15", "black"),
    ],
  };
}

export const LAB_PRESETS = [helloWorldPreset, firstLightPreset, dividerPreset];
