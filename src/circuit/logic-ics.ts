import type { LogicGateFamily } from "./types";

/**
 * Physical 14-pin DIP pinouts, viewed from above with the notch at the left.
 * These are physical pin numbers, not abstract 'A / B / Y' aliases.
 * Every chip uses VCC=14 and GND=7.
 *
 * Sources: TI SN74HC02, SN74HC86, CD4077B and standard 74HC04/00/08/32.
 */
export interface LogicGateChannel {
  inputs: readonly number[];
  output: number;
}

const QUAD_STANDARD: readonly LogicGateChannel[] = [
  { inputs: [1, 2], output: 3 },
  { inputs: [4, 5], output: 6 },
  { inputs: [9, 10], output: 8 },
  { inputs: [12, 13], output: 11 },
];

export const LOGIC_IC_PINOUTS: Record<LogicGateFamily, { model: string; gates: readonly LogicGateChannel[] }> = {
  not: {
    model: "74HC04",
    gates: [
      { inputs: [1], output: 2 },
      { inputs: [3], output: 4 },
      { inputs: [5], output: 6 },
      { inputs: [9], output: 8 },
      { inputs: [11], output: 10 },
      { inputs: [13], output: 12 },
    ],
  },
  and: { model: "74HC08", gates: QUAD_STANDARD },
  or: { model: "74HC32", gates: QUAD_STANDARD },
  nand: { model: "74HC00", gates: QUAD_STANDARD },
  xor: { model: "74HC86", gates: QUAD_STANDARD },
  // The 74HC02 outputs are at 1, 4, 10, 13 (not 3, 6, 8, 11).
  nor: {
    model: "74HC02",
    gates: [
      { inputs: [2, 3], output: 1 },
      { inputs: [5, 6], output: 4 },
      { inputs: [8, 9], output: 10 },
      { inputs: [11, 12], output: 13 },
    ],
  },
  // CD4077B / 4077 XNOR pinout differs from the XOR 74HC86.
  xnor: {
    model: "CD4077B",
    gates: [
      { inputs: [1, 2], output: 3 },
      { inputs: [5, 6], output: 4 },
      { inputs: [8, 9], output: 10 },
      { inputs: [12, 13], output: 11 },
    ],
  },
};

export function logicPinLabel(family: LogicGateFamily, pin: number): string {
  if (pin === 7) return "GND";
  if (pin === 14) return "VCC";
  const channel = LOGIC_IC_PINOUTS[family].gates.findIndex(
    (gate) => gate.output === pin || gate.inputs.includes(pin),
  );
  if (channel === -1) return "NC";
  const gate = LOGIC_IC_PINOUTS[family].gates[channel];
  if (gate.output === pin) return `Y${channel + 1} output`;
  const input = gate.inputs.indexOf(pin);
  return `${input === 0 ? "A" : "B"}${channel + 1} input`;
}
