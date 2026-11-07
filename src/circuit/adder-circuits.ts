import { uid } from "@/lib/utils";
import { getActiveBoardPreset, holePosition, setBoardPreset } from "./breadboard";
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
 *
 * Half adder: SUM + CARRY LEDs.
 * Full adder: complete visual demo with a common-cathode 7-segment display
 * that decodes the binary result (Carry, Sum) into decimal 0–3.
 */
function makeAdder(full: boolean): ProjectCircuit {
  const parts: PlacedPart[] = [];
  const wires: Wire[] = [];
  const W = (a: string, b: string, color: WireColor) =>
    wires.push({ id: uid("w"), a, b, color });

  const xor = dip14("xor", full ? 33 : 23, "U1 · 74HC86 XOR");
  const and = dip14("and", full ? 42 : 36, "U2 · 74HC08 AND");
  const or = full ? dip14("or", 51, "U3 · 74HC32 OR") : null;
  const not = full ? dip14("not", 24, "U0 · 74HC04 NOT") : null;
  if (not) parts.push(not);
  parts.push(xor, and);
  if (or) parts.push(or);

  // Every IC is powered on actual physical pins 14 and 7.
  // Standard-830 power rails are broken between holes 25 and 26.
  W("tp5", "tp35", "red");
  W("tn5", "tn35", "black");
  const chipPowerTargets = new Map<string, { vcc: string; gnd: string }>([
    [xor.id, { vcc: full ? 'tp35' : 'tp23', gnd: full ? 'tn35' : 'tn29' }],
    [and.id, { vcc: full ? 'tp42' : 'tp36', gnd: full ? 'tn48' : 'tn42' }],
    ...(or ? [[or.id, { vcc: 'tp50', gnd: 'tn50' }] as [string, { vcc: string; gnd: string }]] : []),
    ...(not ? [[not.id, { vcc: 'tp24', gnd: 'tn30' }] as [string, { vcc: string; gnd: string }]] : []),
  ]);
  for (const chip of parts.filter((part) => ["xor", "and", "or", "not"].includes(part.kind))) {
    const power = chipPowerTargets.get(chip.id) ?? { vcc: 'tp23', gnd: 'tn29' };
    W(chip.pins.p14, power.vcc, "red");
    W(chip.pins.p7, power.gnd, "black");
  }

  const signals = (full
    ? [
        { name: "A", pos: 3, out: 6, pullEnd: 8 },
        { name: "B", pos: 10, out: 13, pullEnd: 15 },
        { name: "Cin", pos: 17, out: 20, pullEnd: 22 },
      ]
    : [
        { name: "A", pos: 3, out: 6, pullEnd: 8 },
        { name: "B", pos: 10, out: 12, pullEnd: 14 },
      ]);

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

  const aNode = full ? "A6" : "A6";
  const bNode = full ? "A13" : "A12";
  const cinNode = full ? "A20" : "A18";

  // First XOR / AND channel receives the same A and B inputs.
  W(aNode, xor.pins.p1, "yellow");
  W(bNode, xor.pins.p2, "green");
  W(aNode, and.pins.p1, "yellow");
  W(bNode, and.pins.p2, "green");

  let sumPin = xor.pins.p3;   // Half adder: A xor B.
  let carryPin = and.pins.p3; // Half adder: A and B.
  if (or) {
    // Full adder: SUM = (A xor B) xor Cin.
    W(xor.pins.p3, xor.pins.p4, "blue");
    W(cinNode, xor.pins.p5, "orange");
    sumPin = xor.pins.p6;

    // COUT = (A and B) or (Cin and (A xor B)).
    W(xor.pins.p3, and.pins.p4, "blue");
    W(cinNode, and.pins.p5, "orange");
    W(and.pins.p3, or.pins.p1, "green");
    W(and.pins.p6, or.pins.p2, "yellow");
    carryPin = or.pins.p3;
  }

  if (!full) {
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
  } else if (not && or) {
    // Inverters for the 2-bit output decoder.
    W(sumPin, not.pins.p1, "blue");
    W(carryPin, not.pins.p3, "green");
    const notSum = not.pins.p2;
    const notCarry = not.pins.p4;

    // Decode the binary result (Carry, Sum) into decimal 0..3 for the 7-segment.
    // a = d = Carry OR ¬Sum
    W(carryPin, or.pins.p4, "green");
    W(notSum, or.pins.p5, "yellow");
    const segAD = or.pins.p6;

    // c = ¬Carry OR Sum
    W(notCarry, or.pins.p9, "white");
    W(sumPin, or.pins.p10, "blue");
    const segC = or.pins.p8;

    // f = ¬Carry AND ¬Sum
    W(notCarry, and.pins.p9, "white");
    W(notSum, and.pins.p10, "yellow");
    const segF = and.pins.p8;

    const display: PlacedPart = {
      id: uid("seven-segment"),
      kind: "seven-segment",
      props: { label: "Result 0–3", sevenSegCommon: "cathode" },
      pins: { e: "F58", d: "F59", com1: "F60", c: "F61", dp: "F62", b: "E62", a: "E61", com2: "E60", f: "E59", g: "E58" },
    };
    parts.push(display);

    // Common-cathode 7-segment decoder. These channels are simplified
    // educational loads in the current simulator's logic IC model.
    W(display.pins.com1, "tn50", "black");
    W(display.pins.com2, "tn50", "black");
    W("tp50", display.pins.b, "red");
    W(segAD, display.pins.a, "green");
    W(segC, display.pins.c, "blue");
    W(segAD, display.pins.d, "green");
    W(notSum, display.pins.e, "yellow");
    W(segF, display.pins.f, "white");
    W(carryPin, display.pins.g, "orange");

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

/**
 * The Full Adder is intentionally given a long virtual 1400-contact breadboard.
 * Mapping is monotonic and preserves each IC's adjacent DIP pin positions:
 *   switches 1..23 / NOT 24..30 / XOR 33..39 / AND 42..48 /
 *   OR 51..57 / seven-segment 58..62.
 * The new extra room separates the decoder and display from the adder gates.
 * Wire endpoints (and therefore electrical logic) remain unchanged in topology.
 */
function spreadFullAdderHole(hole: string): string {
  const match = /^(tp|tn|bp|bn|[A-T])(\d+)$/.exec(hole);
  if (!match) return hole; // Off-board sockets retain their own names.
  const col = Number(match[2]);
  const shift = col <= 23 ? 3 : col <= 30 ? 14 : col <= 39 ? 20 :
    col <= 48 ? 25 : col <= 57 ? 31 : 35;
  return `${match[1]}${col + shift}`;
}

export function circuitFullAdder(): ProjectCircuit {
  // Built-in presets can be generated while another board is open. Keep that
  // board's global rendering geometry untouched after creating this example.
  const previous = getActiveBoardPreset().id;
  try {
    setBoardPreset("standard-830");
    const original = makeAdder(true);
    setBoardPreset("extended-1400");
    const parts = original.parts.map(part => ({
      ...part,
      pins: Object.fromEntries(Object.entries(part.pins).map(([name, hole]) =>
        [name, spreadFullAdderHole(hole)])),
      props: { ...part.props },
    }));
    // On the 1400-point board power rails are split at columns 25, 50 and 75.
    // Bridge every rail section; skipping a split would leave decoder chips off.
    const wires: Wire[] = original.wires
      .filter(w => !(w.a === "tp5" && w.b === "tp35") &&
        !(w.a === "tn5" && w.b === "tn35"))
      .map(w => ({ ...w, a: spreadFullAdderHole(w.a),
        b: spreadFullAdderHole(w.b), bends: undefined, bendAnchors: undefined }));
    for (const prefix of ["tp", "tn"] as const) {
      for (const [a, b] of [[5, 30], [30, 55], [55, 80]]) {
        wires.push({ id: uid("w"), a: `${prefix}${a}`, b: `${prefix}${b}`,
          color: prefix === "tp" ? "red" : "black" });
      }
    }
    return {
      boardId: "extended-1400",
      psuVoltage: original.psuVoltage,
      psuPositive: spreadFullAdderHole(original.psuPositive ?? "tp5"),
      psuNegative: spreadFullAdderHole(original.psuNegative ?? "tn5"),
      parts,
      wires: autoTidyWireBundle(wires, parts, holePosition),
    };
  } finally {
    setBoardPreset(previous);
  }
}
