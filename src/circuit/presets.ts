import { uid } from "@/lib/utils";
import type { PlacedPart, Wire, WireColor } from "./types";

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
  const mcuId = uid("mcu");
  const lcdId = uid("lcd");
  const ledId = uid("led");
  const r1 = uid("r");
  const r2 = uid("r");
  const c1 = uid("c");
  const sw = uid("sw");

  const parts: PlacedPart[] = [
    {
      id: mcuId,
      kind: "mcu",
      pins: {
        p1: "E10",
        p2: "E11",
        p3: "E12",
        p4: "E13",
        p5: "E14",
        p6: "E15",
        p7: "E16",
        p8: "E17",
        p9: "F17",
        p10: "F16",
        p11: "F15",
        p12: "F14",
        p13: "F13",
        p14: "F12",
        p15: "F11",
        vcc: "F10",
        gnd: "E17",
      },
      props: { label: "MCU" },
    },
    {
      id: lcdId,
      kind: "lcd",
      pins: {
        vss: "J18",
        vdd: "J19",
        v0: "J20",
        rs: "J21",
        e: "J22",
        d4: "J23",
      },
      props: { label: "LCD 16x2" },
    },
    {
      id: r1,
      kind: "resistor",
      pins: { a: "A3", b: "A8" },
      props: { resistance: 220 },
    },
    {
      id: r2,
      kind: "resistor",
      pins: { a: "I19", b: "I22" },
      props: { resistance: 10000 },
    },
    {
      id: ledId,
      kind: "led",
      pins: { a: "E8", k: "F8" },
      props: { ledColor: "red" },
    },
    {
      id: c1,
      kind: "capacitor",
      pins: { a: "A12", b: "A14" },
      props: {},
    },
    {
      id: sw,
      kind: "switch",
      pins: { a: "D24", b: "D26" },
      props: { closed: true },
    },
  ];

  const wires: Wire[] = [
    W("tp2", "tp16", "red"),
    W("tn2", "tn16", "black"),
    W("bp2", "bp16", "red"),
    W("bn2", "bn16", "black"),
    W("tn4", "bn4", "black"),
    W("tp6", "bp6", "red"),
    W("tp5", "A3", "red"),
    W("F8", "bn8", "black"),
    W("F10", "H10", "red"),
    W("H10", "bp10", "red"),
    W("E17", "G17", "black"),
    W("G17", "bn17", "black"),
    W("J18", "bn18", "black"),
    W("J19", "bp19", "red"),
    W("F14", "I21", "blue"),
    W("I21", "J21", "blue"),
    W("F13", "I22", "blue"),
    W("bp20", "I19", "orange"),
    W("tn20", "J20", "black"),
  ];

  return {
    id: "hello-world",
    title: "Hello, World!",
    blurb: "A powered MCU driving a 16??2 LCD on a solderless breadboard.",
    steps: [
      "The red probe is on the + rail, black on the ??? rail.",
      "Power the bench supply ??? the LCD backlight should come up.",
      "If VCC and GND reach the MCU, it writes Hello, World! to the display.",
      "Try probing holes with the meter to see rail voltages.",
    ],
    psuPositive: "tp1",
    psuNegative: "tn1",
    parts,
    wires,
  };
}

export function firstLightPreset(): LabPreset {
  return {
    id: "first-light",
    title: "First Light",
    blurb: "Build a series LED circuit with a current-limiting resistor.",
    steps: [
      "Place a 220 ?? resistor from the + rail into a column.",
      "Place a red LED from that column to the ??? rail (anode toward the resistor).",
      "Turn the supply on. The LED should glow around 12???15 mA.",
      "If it is dark, flip the LED ??? diodes only conduct one way.",
    ],
    psuPositive: "tp1",
    psuNegative: "tn1",
    parts: [],
    wires: [W("tp2", "tp16", "red"), W("tn2", "tn16", "black")],
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
      "Swap one resistor for 10 k?? and watch the ratio change.",
    ],
    psuPositive: "tp1",
    psuNegative: "tn1",
    parts: [
      { id: r1, kind: "resistor", pins: { a: "A5", b: "A10" }, props: { resistance: 1000 } },
      { id: r2, kind: "resistor", pins: { a: "A10", b: "A15" }, props: { resistance: 1000 } },
    ],
    wires: [
      W("tp2", "tp16", "red"),
      W("tn2", "tn16", "black"),
      W("tp5", "A5", "red"),
      W("A15", "tn15", "black"),
    ],
  };
}

export const LAB_PRESETS = [helloWorldPreset, firstLightPreset, dividerPreset];
