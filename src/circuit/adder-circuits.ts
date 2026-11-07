import { uid } from "@/lib/utils";
import { holePosition } from "./breadboard";
import { autoTidyWireBundle } from "./tidy-wires";
import type { ProjectCircuit } from "@/store/projects";
import type { LogicGateFamily, PlacedPart, Wire, WireColor } from "./types";
import { LOGIC_IC_PINOUTS } from "./logic-ics";

/** Physical DIP-14 footprint: pins 1–7 on F, 8–14 reversed on E. */
function dip14(kind: LogicGateFamily, start: number, label: string): PlacedPart {
  const pins: Record<string, string> = {};
  for (let i = 1; i <= 7; i++) pins[`p${i}`] = `F${start + i - 1}`;
  for (let i = 8; i <= 14; i++) pins[`p${i}`] = `E${start + 14 - i}`;
  const first = LOGIC_IC_PINOUTS[kind].gates[0];
  pins.vcc = pins.p14;
  pins.gnd = pins.p7;
  pins.a = pins[`p${first.inputs[0]}`];
  if (first.inputs[1]) pins.b = pins[`p${first.inputs[1]}`];
  pins.y = pins[`p${first.output}`];
  return { id: uid(kind), kind, pins, props: { gateFamily: kind, label } };
}

/**
 * Standard 830-point board, built with real 14-pin DIP logic chips.
 * The input switches close from +5 V to the signal. 10 kΩ pull-downs
 * ensure genuinely LOW inputs when the switch is open (no floating CMOS).
 * Each output has its own 680 Ω current-limit resistor and LED.
 */
function makeAdder(full: boolean): ProjectCircuit {
  const parts: PlacedPart[] = [];
  const wires: Wire[] = [];
  const W = (a: string, b: string, color: WireColor) =>
    wires.push({ id: uid("w"), a, b, color });

  const xor = dip14("xor", 23, "U1 · 74HC86 XOR");
  const and = dip14("and", 36, "U2 · 74HC08 AND");
  const or = full ? dip14("or", 49, "U3 · 74HC32 OR") : null;
  parts.push(xor, and);
  if (or) parts.push(or);

  // Every IC is powered on actual physical pins 14 and 7.
  // Standard-830 power rails are broken between holes 25 and 26.
  W("tp5", "tp35", "red");
  W("tn5", "tn35", "black");
  for (const chip of parts) {
    W(chip.pins.p14, `tp${chip === xor ? 23 : chip === and ? 36 : 49}`, "red");
    W(chip.pins.p7, `tn${chip === xor ? 24 : chip === and ? 40 : 48}`, "black");
  }

  const signals = [
    { name: "A", pos: 3, out: 6, pullEnd: 8 },
    { name: "B", pos: 10, out: 12, pullEnd: 14 },
    { name: "Cin", pos: 16, out: 18, pullEnd: 20 },
  ].slice(0, full ? 3 : 2);

  for (const signal of signals) {
    parts.push({
      id: uid("sw"),
      kind: "switch",
      pins: { a: `C${signal.pos}`, b: `C${signal.out}` },
      props: { switchType: "spst", closed: false, label: `${signal.name} input` },
    });
    parts.push({
      id: uid("r"),
      kind: "resistor",
      pins: { a: `E${signal.out}`, b: `E${signal.pullEnd}` },
      props: { resistance: 10000, label: `${signal.name} · 10k pull-down` },
    });
    W(`tp${signal.pos}`, `A${signal.pos}`, "red");
    W(`E${signal.pullEnd}`, `tn${signal.pullEnd}`, "black");
  }

  // First XOR / AND channel receives the same A and B inputs.
  W("A6", xor.pins.p1, "yellow");
  W("A12", xor.pins.p2, "green");
  W("A6", and.pins.p1, "yellow");
  W("A12", and.pins.p2, "green");

  let sumPin = xor.pins.p3;   // Half adder: A xor B.
  let carryPin = and.pins.p3; // Half adder: A and B.
  if (or) {
    // Full adder: SUM = (A xor B) xor Cin.
    W(xor.pins.p3, xor.pins.p4, "blue");
    W("A18", xor.pins.p5, "orange");
    sumPin = xor.pins.p6;

    // COUT = (A and B) or (Cin and (A xor B)).
    W(xor.pins.p3, and.pins.p4, "blue");
    W("A18", and.pins.p5, "orange");
    W(and.pins.p3, or.pins.p1, "green");
    W(and.pins.p6, or.pins.p2, "yellow");
    carryPin = or.pins.p3;
  }

  const outputs = [
    { name: "SUM", from: sumPin, input: 44, ledA: 47, ledK: 48, color: "green" as const },
    { name: "CARRY", from: carryPin, input: 56, ledA: 59, ledK: 60, color: "red" as const },
  ];
  for (const output of outputs) {
    parts.push({
      id: uid("r"), kind: "resistor",
      pins: { a: `C${output.input}`, b: `C${output.ledA}` },
      props: { resistance: 680, label: `${output.name} · 680Ω` },
    });
    parts.push({
      id: uid("led"), kind: "led",
      pins: { a: `E${output.ledA}`, k: `E${output.ledK}` },
      props: { ledColor: output.color, label: output.name },
    });
    W(output.from, `A${output.input}`, output.color);
    W(`E${output.ledK}`, `tn${Math.min(output.ledK, 49)}`, "black");
  }

  return {
    boardId: "standard-830",
    psuVoltage: 5,
    psuPositive: "tp5",
    psuNegative: "tn5",
    parts,
    wires: autoTidyWireBundle(wires, parts, holePosition),
  };
}

export function circuitHalfAdder(): ProjectCircuit {
  return makeAdder(false);
}

export function circuitFullAdder(): ProjectCircuit {
  return makeAdder(true);
}
