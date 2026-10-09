/**
 * Logic Circuit Challenge — 2D breadboard & system analyzer lab
 * TypeScript module for Vite / React integration.
 * DOM-heavy ported simulator — internal handlers use loose typing.
 */
// @ts-nocheck
export type LogicView = "EXPLORE" | "LEVEL_SELECT" | "GAME";

export type GateTypeId = "AND" | "OR" | "NOT" | "NAND" | "NOR" | "XOR" | "NXOR";

export type LogicNode = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  outputState: boolean;
  inputPins: number[];
  outputPins: number[];
};

export type LogicConnection = {
  id: string;
  fromNodeId: string;
  fromPin: number;
  /** Which side of the source node the wire leaves (INPUT switches expose both). */
  fromSide?: 'left' | 'right';
  toNodeId: string;
  toPin: number;
};

export type TruthCase = {
  inputStates: Record<string, boolean>;
  expectedOutput: Record<string, boolean>;
};

export type LogicLevel = {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  availableGates: string[];
  inputs: { id: string; label: string; defaultState: boolean }[];
  outputs: { id: string; label: string }[];
  truthTable: TruthCase[];
};

type AppState = {
  currentView: LogicView;
  currentLevelIndex: number;
  selectedLevelIndex: number;
  levelPage: number;
  levelsPerPage: number;
  levelProgress: Record<string, boolean>;
  nodes: LogicNode[];
  connections: LogicConnection[];
  isDragging: boolean;
  draggedNode: LogicNode | null;
  wiringStart: { nodeId: string; pinIdx: number; isOutput: boolean; side?: 'left' | 'right' } | null;
  clockState: boolean;
  busHexValue: string;
  _reactOnBack: (() => void) | null;
};


// ============================================================================
// LOGIC CIRCUIT CHALLENGE - HARDWARE BREADBOARD & SYSTEM ANALYZER LAB
// ============================================================================

// Global Application State
const appState: AppState = {
  currentView: "LEVEL_SELECT",
  currentLevelIndex: 0,
  selectedLevelIndex: 0,
  levelPage: 0,
  levelsPerPage: 4,
  levelProgress: {},
  nodes: [],
  connections: [],
  isDragging: false,
  draggedNode: null,
  wiringStart: null,
  clockState: true,
  busHexValue: "0x00",
  _reactOnBack: null,
};

// Level Blueprint Definitions
function buildTruthTable(inputIds, evaluate) {
  const truthTable = [];
  const combinations = 2 ** inputIds.length;

  for (let mask = 0; mask < combinations; mask++) {
    const values = inputIds.map((_, index) => Boolean(mask & (1 << index)));
    const inputStates = Object.fromEntries(inputIds.map((id, index) => [id, values[index]]));
    truthTable.push({ inputStates, expectedOutput: { out_1: evaluate(...values) } });
  }

  return truthTable;
}

export const LOGIC_GATES_LEVELS: LogicLevel[] = [
  {
    id: 'lg_01',
    title: 'LEVEL 1',
    difficulty: 'Beginner',
    description: 'Load Input A with 0x01, invert signal through a NOT gate, and store in Target LED.',
    availableGates: ['NOT', 'AND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Input A [0x01]', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Target LED' }],
    truthTable: [
      { inputStates: { in_1: false }, expectedOutput: { out_1: true } },
      { inputStates: { in_1: true },  expectedOutput: { out_1: false } }
    ]
  },
  {
    id: 'lg_02',
    title: 'LEVEL 2',
    difficulty: 'Intermediate',
    description: 'Ensure output activates ONLY when both Input A and Input B are HIGH.',
    availableGates: ['AND', 'OR', 'NOT', 'NAND', 'XOR'],
    inputs: [
      { id: 'in_1', label: 'Switch A', defaultState: false },
      { id: 'in_2', label: 'Switch B', defaultState: false }
    ],
    outputs: [{ id: 'out_1', label: 'Main Bus OUT' }],
    truthTable: [
      { inputStates: { in_1: false, in_2: false }, expectedOutput: { out_1: false } },
      { inputStates: { in_1: true,  in_2: false }, expectedOutput: { out_1: false } },
      { inputStates: { in_1: false, in_2: true  }, expectedOutput: { out_1: false } },
      { inputStates: { in_1: true,  in_2: true  }, expectedOutput: { out_1: true } }
    ]
  },
  {
    id: 'lg_03',
    title: 'LEVEL 3',
    difficulty: 'Beginner',
    description: 'Activate the output when either switch is HIGH.',
    availableGates: ['OR', 'AND', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Switch A', defaultState: false }, { id: 'in_2', label: 'Switch B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Main Bus OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => a || b)
  },
  {
    id: 'lg_04',
    title: 'LEVEL 4',
    difficulty: 'Intermediate',
    description: 'Keep the output HIGH unless both switches are HIGH.',
    availableGates: ['NAND', 'AND', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Switch A', defaultState: false }, { id: 'in_2', label: 'Switch B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Safety OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !(a && b))
  },
  {
    id: 'lg_05',
    title: 'LEVEL 5',
    difficulty: 'Intermediate',
    description: 'Activate the output only while both switches are LOW.',
    availableGates: ['NOR', 'OR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Switch A', defaultState: false }, { id: 'in_2', label: 'Switch B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Quiet OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !(a || b))
  },
  {
    id: 'lg_06',
    title: 'LEVEL 6',
    difficulty: 'Intermediate',
    description: 'Activate the output when exactly one switch is HIGH.',
    availableGates: ['XOR', 'OR', 'AND', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Switch A', defaultState: false }, { id: 'in_2', label: 'Switch B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Difference OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => a !== b)
  },
  {
    id: 'lg_07',
    title: 'LEVEL 7',
    difficulty: 'Intermediate',
    description: 'Invert the result of an AND operation before sending it to the output.',
    availableGates: ['AND', 'NOT', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Input A', defaultState: false }, { id: 'in_2', label: 'Input B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Inverted OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !(a && b))
  },
  {
    id: 'lg_08',
    title: 'LEVEL 8',
    difficulty: 'Intermediate',
    description: 'Invert the result of an OR operation before sending it to the output.',
    availableGates: ['OR', 'NOT', 'NOR'],
    inputs: [{ id: 'in_1', label: 'Input A', defaultState: false }, { id: 'in_2', label: 'Input B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Inverted OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !(a || b))
  },
  {
    id: 'lg_09',
    title: 'LEVEL 9',
    difficulty: 'Advanced',
    description: 'Activate the output only when all three switches are HIGH.',
    availableGates: ['AND', 'OR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Switch A', defaultState: false }, { id: 'in_2', label: 'Switch B', defaultState: false }, { id: 'in_3', label: 'Switch C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Three-Way OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => a && b && c)
  },
  {
    id: 'lg_10',
    title: 'LEVEL 10',
    difficulty: 'Advanced',
    description: 'Activate the output when any one of three switches is HIGH.',
    availableGates: ['OR', 'AND', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Switch A', defaultState: false }, { id: 'in_2', label: 'Switch B', defaultState: false }, { id: 'in_3', label: 'Switch C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Any-Input OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => a || b || c)
  },
  {
    id: 'lg_11',
    title: 'LEVEL 11',
    difficulty: 'Advanced',
    description: 'Activate the output when an odd number of the three inputs is HIGH.',
    availableGates: ['XOR', 'AND', 'OR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Bit A', defaultState: false }, { id: 'in_2', label: 'Bit B', defaultState: false }, { id: 'in_3', label: 'Bit C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Parity OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => [a, b, c].filter(Boolean).length % 2 === 1)
  },
  {
    id: 'lg_12',
    title: 'LEVEL 12',
    difficulty: 'Advanced',
    description: 'Activate the output only when A is HIGH and B is LOW.',
    availableGates: ['AND', 'NOT', 'OR', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Enable A', defaultState: false }, { id: 'in_2', label: 'Block B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Qualified OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => a && !b)
  },
  {
    id: 'lg_13',
    title: 'LEVEL 13',
    difficulty: 'Advanced',
    description: 'Activate the output when both inputs have the same state.',
    availableGates: ['XOR', 'NOT', 'AND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Input A', defaultState: false }, { id: 'in_2', label: 'Input B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Match OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !(a !== b))
  },
  {
    id: 'lg_14',
    title: 'LEVEL 14',
    difficulty: 'Advanced',
    description: 'Activate the output only when B is HIGH and A is LOW.',
    availableGates: ['AND', 'NOT', 'OR', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Block A', defaultState: false }, { id: 'in_2', label: 'Enable B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Reverse OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !a && b)
  },
  {
    id: 'lg_15',
    title: 'LEVEL 15',
    difficulty: 'Advanced',
    description: 'Activate the output when A is HIGH or B is LOW.',
    availableGates: ['OR', 'NOT', 'AND', 'NOR'],
    inputs: [{ id: 'in_1', label: 'Signal A', defaultState: false }, { id: 'in_2', label: 'Signal B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Condition OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => a || !b)
  },
  {
    id: 'lg_16',
    title: 'LEVEL 16',
    difficulty: 'Advanced',
    description: 'Activate the output only when all three inputs are LOW.',
    availableGates: ['NOR', 'OR', 'NOT', 'AND'],
    inputs: [{ id: 'in_1', label: 'Input A', defaultState: false }, { id: 'in_2', label: 'Input B', defaultState: false }, { id: 'in_3', label: 'Input C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'All-Clear OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => !(a || b || c))
  },
  {
    id: 'lg_17',
    title: 'LEVEL 17',
    difficulty: 'Expert',
    description: 'Activate the output when A is HIGH, or when both B and C are HIGH.',
    availableGates: ['AND', 'OR', 'NOT', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Priority A', defaultState: false }, { id: 'in_2', label: 'Pair B', defaultState: false }, { id: 'in_3', label: 'Pair C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Priority OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => a || (b && c))
  },
  {
    id: 'lg_18',
    title: 'LEVEL 18',
    difficulty: 'Expert',
    description: 'Activate the output when C is HIGH and either A or B is HIGH.',
    availableGates: ['AND', 'OR', 'NOT', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Request A', defaultState: false }, { id: 'in_2', label: 'Request B', defaultState: false }, { id: 'in_3', label: 'Enable C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Enabled OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => (a || b) && c)
  },
  {
    id: 'lg_19',
    title: 'LEVEL 19',
    difficulty: 'Expert',
    description: 'Activate the output when at least two of the three inputs are HIGH.',
    availableGates: ['AND', 'OR', 'XOR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Vote A', defaultState: false }, { id: 'in_2', label: 'Vote B', defaultState: false }, { id: 'in_3', label: 'Vote C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Majority OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => (a && b) || (a && c) || (b && c))
  },
  {
    id: 'lg_20',
    title: 'LEVEL 20',
    difficulty: 'Expert',
    description: 'Activate the output when exactly two of the three inputs are HIGH.',
    availableGates: ['AND', 'OR', 'XOR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Bit A', defaultState: false }, { id: 'in_2', label: 'Bit B', defaultState: false }, { id: 'in_3', label: 'Bit C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Two-Bit OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => [a, b, c].filter(Boolean).length === 2)
  },
  {
    id: 'lg_21',
    title: 'LEVEL 21',
    difficulty: 'Expert',
    description: 'Activate the output when exactly one of the three inputs is HIGH.',
    availableGates: ['AND', 'OR', 'XOR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'Channel A', defaultState: false }, { id: 'in_2', label: 'Channel B', defaultState: false }, { id: 'in_3', label: 'Channel C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'One-Hot OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => [a, b, c].filter(Boolean).length === 1)
  },
  {
    id: 'lg_22',
    title: 'LEVEL 22',
    difficulty: 'Expert',
    description: 'Activate the output when zero or two inputs are HIGH.',
    availableGates: ['XOR', 'NOT', 'AND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Bit A', defaultState: false }, { id: 'in_2', label: 'Bit B', defaultState: false }, { id: 'in_3', label: 'Bit C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Even OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => [a, b, c].filter(Boolean).length % 2 === 0)
  },
  {
    id: 'lg_23',
    title: 'LEVEL 23',
    difficulty: 'Expert',
    description: 'Activate the output unless A is HIGH while B is LOW.',
    availableGates: ['OR', 'NOT', 'AND', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Signal A', defaultState: false }, { id: 'in_2', label: 'Enable B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Guard OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => !a || b)
  },
  {
    id: 'lg_24',
    title: 'LEVEL 24',
    difficulty: 'Expert',
    description: 'Activate the output when both inputs are LOW or both are HIGH.',
    availableGates: ['XOR', 'NOT', 'AND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Compare A', defaultState: false }, { id: 'in_2', label: 'Compare B', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Equal OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2'], (a, b) => a === b)
  },
  {
    id: 'lg_25',
    title: 'LEVEL 25',
    difficulty: 'Expert',
    description: 'Keep the output HIGH unless all three inputs are HIGH.',
    availableGates: ['AND', 'NOT', 'NAND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Input A', defaultState: false }, { id: 'in_2', label: 'Input B', defaultState: false }, { id: 'in_3', label: 'Input C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'NAND OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => !(a && b && c))
  },
  {
    id: 'lg_26',
    title: 'LEVEL 26',
    difficulty: 'Expert',
    description: 'When select A is HIGH, pass signal B; otherwise pass signal C.',
    availableGates: ['AND', 'OR', 'NOT', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Select A', defaultState: false }, { id: 'in_2', label: 'Signal B', defaultState: false }, { id: 'in_3', label: 'Signal C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Mux OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => (a && b) || (!a && c))
  },
  {
    id: 'lg_27',
    title: 'LEVEL 27',
    difficulty: 'Expert',
    description: 'Activate the alarm when A or B is HIGH, provided inhibit C is LOW.',
    availableGates: ['OR', 'AND', 'NOT', 'NOR'],
    inputs: [{ id: 'in_1', label: 'Alarm A', defaultState: false }, { id: 'in_2', label: 'Alarm B', defaultState: false }, { id: 'in_3', label: 'Inhibit C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Alarm OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => (a || b) && !c)
  },
  {
    id: 'lg_28',
    title: 'LEVEL 28',
    difficulty: 'Expert',
    description: 'Activate the output when the three inputs are not all equal.',
    availableGates: ['XOR', 'AND', 'OR', 'NOT'],
    inputs: [{ id: 'in_1', label: 'State A', defaultState: false }, { id: 'in_2', label: 'State B', defaultState: false }, { id: 'in_3', label: 'State C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Difference OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => !(a === b && b === c))
  },
  {
    id: 'lg_29',
    title: 'LEVEL 29',
    difficulty: 'Expert',
    description: 'Activate the output when at least two of the three inputs match.',
    availableGates: ['XOR', 'NOT', 'AND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Compare A', defaultState: false }, { id: 'in_2', label: 'Compare B', defaultState: false }, { id: 'in_3', label: 'Compare C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Match OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => a === b || a === c || b === c)
  },
  {
    id: 'lg_30',
    title: 'LEVEL 30S',
    difficulty: 'Expert',
    description: 'Activate the output when all inputs agree and are HIGH.',
    availableGates: ['AND', 'OR', 'NOT', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Line A', defaultState: false }, { id: 'in_2', label: 'Line B', defaultState: false }, { id: 'in_3', label: 'Line C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Consensus OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => a && b && c)
  },
  {
    id: 'lg_31',
    title: 'LEVEL 31',
    difficulty: 'Expert',
    description: 'Activate the output when A is HIGH, or when B and C are both HIGH.',
    availableGates: ['OR', 'AND', 'NOT', 'NAND'],
    inputs: [{ id: 'in_1', label: 'Priority A', defaultState: false }, { id: 'in_2', label: 'Backup B', defaultState: false }, { id: 'in_3', label: 'Backup C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Override OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => a || (b && c))
  },
  {
    id: 'lg_32',
    title: 'LEVEL 32',
    difficulty: 'Expert',
    description: 'Activate the output when an odd number of input lines are HIGH.',
    availableGates: ['XOR', 'NOT', 'AND', 'OR'],
    inputs: [{ id: 'in_1', label: 'Line A', defaultState: false }, { id: 'in_2', label: 'Line B', defaultState: false }, { id: 'in_3', label: 'Line C', defaultState: false }],
    outputs: [{ id: 'out_1', label: 'Parity OUT' }],
    truthTable: buildTruthTable(['in_1', 'in_2', 'in_3'], (a, b, c) => [a, b, c].filter(Boolean).length % 2 === 1)
  }
];

/** Only wired inputs participate — unused pins are ignored (so 2-wire use still works on 3-pin gates). */
const wired = (vals) => vals.filter((v) => v !== null && v !== undefined);

const GATE_TYPES = {
  AND: {
    id: 'AND',
    inputs: 3,
    fn: (...vals) => {
      const u = wired(vals);
      return u.length > 0 && u.every(Boolean);
    },
    symbol: '&',
  },
  OR: {
    id: 'OR',
    inputs: 3,
    fn: (...vals) => {
      const u = wired(vals);
      return u.some(Boolean);
    },
    symbol: '≥1',
  },
  NOT: {
    id: 'NOT',
    inputs: 1,
    fn: (a) => !(a ?? false), // unwired input counts as LOW
    symbol: '1',
  },
  NAND: {
    id: 'NAND',
    inputs: 3,
    fn: (...vals) => {
      const u = wired(vals);
      return !(u.length > 0 && u.every(Boolean));
    },
    symbol: '&̄',
  },
  NOR: {
    id: 'NOR',
    inputs: 3,
    fn: (...vals) => {
      const u = wired(vals);
      return !u.some(Boolean);
    },
    symbol: '≥1̄',
  },
  XOR: {
    id: 'XOR',
    inputs: 3,
    fn: (...vals) => {
      const u = wired(vals);
      return u.filter(Boolean).length % 2 === 1;
    },
    symbol: '=1',
  },
  NXOR: {
    id: 'NXOR',
    inputs: 3,
    fn: (...vals) => {
      const u = wired(vals);
      return u.filter(Boolean).length % 2 === 0;
    },
    symbol: '=0',
  },
};

const ALL_GATE_TYPES: string[] = ['AND', 'NAND', 'NOR', 'NOT', 'NXOR', 'OR', 'XOR'];

/**
 * Inline SVG gate symbols (same shapes as React LogicGateIcon components).
 * The lab is vanilla DOM, so we inject HTML strings — not React components.
 * Color uses currentColor; parent CSS sets color to neon green.
 */
const GATE_SVG_PATHS: Record<string, string> = {
  AND: `<path d="M48 24 H91 C116 24 138 39 138 60 C138 81 116 96 91 96 H48 Z"/>`,
  OR: `<path d="M48 24 C65 27 76 35 88 41 C101 48 116 54 138 60 C116 66 101 72 88 79 C76 85 65 93 48 96 C58 82 63 72 63 60 C63 48 58 38 48 24 Z"/>`,
  NOT: `<path d="M48 27 L48 93 L128 60 Z"/><circle cx="132" cy="60" r="5" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/>`,
  NAND: `<path d="M48 24 H87 C110 24 128 39 128 60 C128 81 110 96 87 96 H48 Z"/><circle cx="134" cy="60" r="6" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/>`,
  NOR: `<path d="M48 24 C64 27 76 35 88 41 C101 48 112 54 128 60 C112 66 101 72 88 79 C76 85 64 93 48 96 C58 82 63 72 63 60 C63 48 58 38 48 24 Z"/><circle cx="134" cy="60" r="6" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/>`,
  XOR: `<path d="M39 24 C50 38 55 48 55 60 C55 72 50 82 39 96" fill="none"/><path d="M48 24 C64 27 76 35 88 41 C101 48 116 54 138 60 C116 66 101 72 88 79 C76 85 64 93 48 96 C58 82 63 72 63 60 C63 48 58 38 48 24 Z"/>`,
  // Lab id is NXOR; React icon component is XNOR — same shape
  NXOR: `<path d="M39 24 C50 38 55 48 55 60 C55 72 50 82 39 96" fill="none"/><path d="M48 24 C64 27 76 35 88 41 C101 48 112 54 128 60 C112 66 101 72 88 79 C76 85 64 93 48 96 C58 82 63 72 63 60 C63 48 58 38 48 24 Z"/><circle cx="134" cy="60" r="6" fill="currentColor" fill-opacity="0.15" stroke="currentColor"/>`,
};

function gateSymbolImage(gateType: string): string {
  const body = GATE_SVG_PATHS[gateType];
  if (!body) {
    return GATE_TYPES[gateType]?.symbol ?? gateType;
  }

  // Compact viewBox matching LogicGateIcon (180x120), pins omitted in chip UI
  return `<svg class="lg-gate-image" viewBox="30 18 120 84" width="48" height="30" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="${gateType} gate">
    <g stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" fill="currentColor" fill-opacity="0.12">
      ${body}
    </g>
  </svg>`;
}

LOGIC_GATES_LEVELS.forEach((level) => {
  level.availableGates = [...ALL_GATE_TYPES];
});

// Main Entry Point
export function injectLogicGatesStyles(): void {
  const styleId = 'logic-gates-hardware-styles';
  if (document.getElementById(styleId)) return;

  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = `
    @keyframes lgFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes lgPopIn { 0% { transform: scale(0.85); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

    .lg-fade-in { animation: lgFadeIn 0.25s ease-out forwards; }
    .lg-pop-in { animation: lgPopIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }

    .lg-workspace {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 640px;
      background: #0f1115;
      color: #d0d7e2;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #2a313d;
      position: relative;
      font-size: 11px;
      user-select: none;
    }

    /* Hero & Menu Screens */
    .lg-hero-screen {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      padding: 40px;
      position: relative;
      background: radial-gradient(circle at center, #181c23 0%, #0f1115 100%);
    }
    .lg-circuit-bg-glow {
      position: absolute;
      width: 280px;
      height: 280px;
      background: #00ff66;
      filter: blur(140px);
      opacity: 0.15;
      border-radius: 50%;
      pointer-events: none;
    }
    .lg-hero-content { z-index: 1; max-width: 520px; }
    .lg-hero-title { font-size: 28px; font-weight: 800; margin: 14px 0; color: #ffffff; letter-spacing: 1px; }
    .lg-hero-subtitle { font-size: 13px; color: #6e7c91; line-height: 1.5; margin-bottom: 24px; }
    .lg-btn-hero {
      padding: 12px 28px;
      font-size: 13px;
      background: #00ff66;
      color: #000000;
      border-radius: 4px;
      border: none;
      font-weight: bold;
      cursor: pointer;
      transition: box-shadow 0.2s, transform 0.1s;
    }
    .lg-btn-hero:hover { box-shadow: 0 0 12px rgba(0,255,102,0.4); transform: translateY(-1px); }

    /* ---- LEVEL SELECTION (diamond UI) ---- */
    .lg-level-select-screen {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 24px 20px 28px;
      box-sizing: border-box;
      background:
        radial-gradient(ellipse at 50% 30%, rgba(0, 180, 255, 0.08) 0%, transparent 55%),
        linear-gradient(180deg, #0a0e14 0%, #0f1520 50%, #0a0e14 100%);
      background-image:
        radial-gradient(ellipse at 50% 20%, rgba(0, 180, 255, 0.07) 0%, transparent 50%),
        linear-gradient(rgba(20, 40, 70, 0.15) 1px, transparent 1px),
        linear-gradient(90deg, rgba(20, 40, 70, 0.15) 1px, transparent 1px);
      background-size: 100% 100%, 28px 28px, 28px 28px;
      overflow: hidden;
    }
    .lg-back-btn {
      position: absolute;
      top: 16px;
      left: 16px;
      width: 40px;
      height: 40px;
      border: none;
      border-radius: 6px;
      background: #c62828;
      color: #fff;
      font-size: 20px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.4);
      transition: background 0.15s, transform 0.1s;
    }
    .lg-back-btn:hover { background: #e53935; transform: scale(1.05); }
    .lg-level-select-title {
      margin: 0 0 36px;
      font-size: 22px;
      font-weight: 800;
      letter-spacing: 4px;
      color: #ffffff;
      text-shadow: 0 0 20px rgba(0, 200, 255, 0.35);
      text-align: center;
    }
    .lg-diamond-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 28px;
      flex-wrap: wrap;
      margin-bottom: 18px;
    }
    .lg-diamond {
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      outline: none;
    }
    .lg-diamond:disabled { cursor: not-allowed; }
    .lg-diamond-shape {
      width: 72px;
      height: 72px;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: rotate(45deg);
      border: 3px solid #00b8ff;
      border-radius: 8px;
      background: rgba(0, 40, 70, 0.45);
      box-shadow: 0 0 16px rgba(0, 180, 255, 0.35), inset 0 0 12px rgba(0, 180, 255, 0.12);
      transition: border-color 0.2s, box-shadow 0.2s, background 0.2s, transform 0.15s;
    }
    .lg-diamond-shape > * {
      transform: rotate(-45deg);
      font-size: 28px;
      font-weight: 800;
      color: #ffffff;
      line-height: 1;
    }
    .lg-diamond.selected .lg-diamond-shape {
      border-color: #ffb300;
      background: rgba(80, 50, 0, 0.5);
      box-shadow: 0 0 22px rgba(255, 180, 0, 0.55), inset 0 0 14px rgba(255, 180, 0, 0.2);
    }
    .lg-diamond.selected .lg-diamond-num { color: #ffb300; text-shadow: 0 0 10px rgba(255, 180, 0, 0.7); }
    .lg-diamond.available .lg-diamond-shape:hover {
      border-color: #40d0ff;
      box-shadow: 0 0 20px rgba(0, 200, 255, 0.5);
      transform: rotate(45deg) scale(1.06);
    }
    .lg-diamond.cleared .lg-diamond-shape {
      border-color: #00ff66;
      box-shadow: 0 0 14px rgba(0, 255, 102, 0.35);
    }
    .lg-diamond.cleared .lg-diamond-num { color: #00ff66; }
    .lg-diamond.locked .lg-diamond-shape {
      border-color: #3a5a7a;
      background: rgba(15, 25, 40, 0.6);
      box-shadow: none;
      opacity: 0.75;
    }
    .lg-diamond.locked .lg-diamond-lock {
      font-size: 22px;
      filter: grayscale(0.3);
      opacity: 0.9;
    }
    .lg-diamond-underline {
      display: block;
      width: 28px;
      height: 3px;
      border-radius: 2px;
      background: #ffb300;
      box-shadow: 0 0 8px rgba(255, 180, 0, 0.6);
    }
    .lg-diamond-underline.muted {
      background: rgba(0, 180, 255, 0.25);
      box-shadow: none;
    }
    .lg-page-dots {
      display: flex;
      gap: 8px;
      justify-content: center;
      margin-bottom: 22px;
    }
    .lg-page-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: rgba(0, 180, 255, 0.25);
      border: 1px solid rgba(0, 180, 255, 0.4);
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }
    .lg-page-dot.active {
      background: #00b8ff;
      box-shadow: 0 0 8px rgba(0, 180, 255, 0.7);
      transform: scale(1.15);
    }
    .lg-page-dot:hover { background: rgba(0, 180, 255, 0.5); }
    .lg-level-preview {
      text-align: center;
      max-width: 420px;
      margin-bottom: 20px;
      min-height: 72px;
    }
    .lg-preview-diff {
      font-size: 10px;
      font-weight: bold;
      color: #00b8ff;
      letter-spacing: 1px;
      margin-bottom: 4px;
    }
    .lg-preview-title {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 6px;
    }
    .lg-preview-desc {
      margin: 0;
      font-size: 11px;
      color: #7a8a9e;
      line-height: 1.45;
    }
    .lg-play-btn {
      position: absolute;
      bottom: 22px;
      right: 22px;
      padding: 12px 36px 12px 28px;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: 2px;
      color: #1a1000;
      background: linear-gradient(90deg, #ffb300 0%, #ff8c00 100%);
      border: none;
      border-radius: 4px 20px 20px 4px;
      cursor: pointer;
      box-shadow: 0 0 18px rgba(255, 160, 0, 0.45), 0 4px 12px rgba(0,0,0,0.35);
      clip-path: polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%);
      transition: transform 0.12s, box-shadow 0.15s, filter 0.15s;
    }
    .lg-play-btn:hover:not(.disabled) {
      transform: translateY(-2px) scale(1.03);
      box-shadow: 0 0 24px rgba(255, 180, 0, 0.65), 0 6px 16px rgba(0,0,0,0.4);
      filter: brightness(1.08);
    }
    .lg-play-btn.disabled,
    .lg-play-btn:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      box-shadow: none;
      filter: grayscale(0.4);
    }

    /* legacy menu leftovers (kept for compatibility) */
    .lg-menu-screen { padding: 20px; display: flex; flex-direction: column; gap: 20px; height: 100%; min-height: 0; box-sizing: border-box; }
    .lg-menu-navbar { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #2a313d; padding-bottom: 10px; }
    .lg-levels-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; flex: 1 1 auto; min-height: 0; overflow-y: auto; align-content: start; padding: 2px 8px 12px 0; }
    .lg-level-card {
      background: #181c23;
      border: 1px solid #2a313d;
      border-radius: 6px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .lg-level-card:hover { border-color: #00ff66; }
    .lg-card-header { display: flex; justify-content: space-between; align-items: center; }
    .lg-difficulty-tag { font-size: 10px; color: #00ff66; font-weight: bold; }
    .lg-status-pill.success { font-size: 10px; color: #00ff66; font-weight: bold; }
    .lg-card-title { margin: 0; font-size: 14px; color: #fff; }
    .lg-card-desc { margin: 0; font-size: 11px; color: #6e7c91; flex: 1; }
    .lg-how-to-play {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 18px;
      align-items: center;
      padding: 10px 12px;
      background: #12151b;
      border: 1px solid #2a313d;
      border-radius: 4px;
      color: #a0acba;
      font-size: 10px;
    }
    .lg-how-to-play strong { color: #00ff66; font-size: 9px; }
    .lg-how-to-play-compact { display: grid; gap: 4px; padding: 7px; margin-bottom: 10px; font-size: 9px; }

    /* Workbench UI Layout */
    .lg-navbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; background: #181c23; border-bottom: 1px solid #2a313d; }
    .lg-title-group { display: flex; align-items: center; gap: 10px; }
    .lg-title-group h2 { font-size: 12px; font-weight: bold; color: #fff; letter-spacing: 0.5px; }
    .lg-controls { display: flex; gap: 6px; }
    .lg-workbench { display: grid; grid-template-columns: 200px 1fr 280px; flex: 1; overflow: hidden; }

    /* Left Sidebar */
    .lg-sidebar { background: #181c23; border-right: 1px solid #2a313d; padding: 10px; display: flex; flex-direction: column; justify-content: space-between; overflow-y: auto; }
    .lg-sidebar-title { color: #fff; font-size: 11px; font-weight: bold; text-transform: uppercase; border-bottom: 1px solid #2a313d; padding-bottom: 4px; margin-bottom: 8px; }
    .lg-help-text { font-size: 9px; color: #6e7c91; margin-bottom: 8px; }
    .lg-category-label { font-size: 9px; font-weight: bold; color: #fff; margin-bottom: 6px; }
    .lg-toolbox-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
    .lg-ic-chip-item {
      background: #232933;
      border: 1px solid #364152;
      border-radius: 4px;
      padding: 6px 2px;
      text-align: center;
      cursor: grab;
    }
    .lg-ic-chip-item:hover { border-color: #00ff66; }
    .lg-ic-symbol { display: flex; align-items: center; justify-content: center; min-height: 30px; color: #00ff66; }
    .lg-gate-image { display: block; width: 48px; height: 30px; color: #00ff66; }
    .lg-ic-name { font-size: 8px; color: #d0d7e2; }
    .lg-level-info { flex: 0 0 auto; padding-top: 18px; }
    .lg-level-info p { margin: 8px 0 12px; color: #d0d7e2; font-size: 13px; line-height: 1.45; }

    /* Center Breadboard Canvas */
    .lg-canvas-viewport {
      position: relative;
      background-color: #171c24;
      background-image: radial-gradient(#2d3645 1.5px, transparent 1.5px);
      background-size: 14px 14px;
      overflow: hidden;
    }
    .lg-bus-pipe-overlay {
      position: absolute;
      top: 50%;
      left: 10%;
      right: 10%;
      height: 12px;
      background: rgba(0, 255, 102, 0.15);
      border: 1px solid rgba(0, 255, 102, 0.4);
      border-radius: 6px;
      pointer-events: none;
      transform: translateY(-50%);
    }
    .lg-bus-value-tag {
      position: absolute;
      right: 10px;
      top: -10px;
      background: #0d1217;
      border: 1px solid #00ff66;
      color: #00ff66;
      font-weight: bold;
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      box-shadow: 0 0 8px rgba(0,255,102,0.3);
    }
    .lg-svg-wire-layer { position: absolute; width: 100%; height: 100%; pointer-events: none; }
    .lg-wire { stroke: #3c4759; stroke-width: 2.5; fill: none; transition: stroke 0.15s; }
    .lg-wire.active { stroke: #00ff66; }

    /* Nodes / Hardware Chips */
    .lg-node-layer { position: absolute; width: 100%; height: 100%; }
    .lg-ic-node {
      position: absolute;
      width: 110px;
      background: #1d222b;
      border: 1px solid #3c4759;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      cursor: move;
    }
    .lg-ic-node.state-high { border-color: #00ff66; box-shadow: 0 0 10px rgba(0,255,102,0.2); }
    .lg-ic-node.lg-node-input { border-color: #3a7abd; }
    .lg-ic-node.lg-node-input.state-high { border-color: #00ff66; }
    .lg-ic-header {
      background: #12151b;
      padding: 4px 6px;
      font-size: 9px;
      font-weight: bold;
      color: #8c9ba8;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #2a313d;
    }
    .lg-val-badge { color: #00ff66; font-size: 8px; }
    .lg-ic-body { display: flex; justify-content: space-between; align-items: center; padding: 8px 4px; min-height: 56px; }
    .lg-ic-center-core { display: flex; align-items: center; justify-content: center; width: 52px; min-height: 42px; color: #00ff66; font-family: monospace; }
    .lg-ic-center-core .lg-gate-image { width: 44px; height: 28px; }
    .lg-ic-pins-left, .lg-ic-pins-right {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 11px;
      justify-content: center;
    }
    .lg-pin {
      width: 10px;
      height: 10px;
      border-radius: 2px;
      background: #48566b;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.12s, box-shadow 0.12s, transform 0.12s;
    }
    .lg-pin:hover { background: #00ff66; box-shadow: 0 0 6px rgba(0,255,102,0.6); }
    .lg-pin-output { background: #3a5a7a; }
    .lg-pin-input { background: #48566b; }
    .lg-pin.wiring-source {
      background: #ffb300 !important;
      box-shadow: 0 0 10px rgba(255, 180, 0, 0.85);
      transform: scale(1.35);
    }
    .lg-pin.wiring-target-hint {
      outline: 1px dashed rgba(0, 255, 102, 0.5);
    }
    .lg-workspace.wiring-mode,
    .lg-workspace.wiring-mode .lg-canvas-viewport {
      cursor: crosshair;
    }
    .lg-workspace.wiring-mode .lg-pin-input,
    .lg-workspace.wiring-mode .lg-pin {
      cursor: pointer;
    }

    /* Right Analyzer Panel */
    .lg-analyzer-panel { background: #181c23; border-left: 1px solid #2a313d; padding: 10px; display: flex; flex-direction: column; gap: 10px; }
    .lg-clock-box { display: flex; justify-content: space-between; align-items: center; background: #12151b; padding: 6px; border: 1px solid #2a313d; border-radius: 4px; }
    .lg-state-badge { background: rgba(0,255,102,0.15); color: #00ff66; border: 1px solid #00ff66; padding: 1px 5px; border-radius: 2px; font-weight: bold; font-size: 9px; }
    .lg-status-table { background: #12151b; border: 1px solid #2a313d; border-radius: 4px; padding: 6px; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-family: monospace; }
    .lg-status-row { color: #6e7c91; font-size: 10px; }
    .lg-status-row span { color: #00ff66; font-weight: bold; }

    .lg-timing-container { background: #12151b; border: 1px solid #2a313d; border-radius: 4px; padding: 6px; flex: 1; display: flex; flex-direction: column; }
    .lg-analyzer-steps { display: flex; justify-content: space-between; padding-left: 45px; color: #6e7c91; font-size: 8px; margin-bottom: 2px; }
    .lg-wave-row { display: flex; align-items: center; height: 20px; border-bottom: 1px solid #1a2029; }
    .lg-wave-label { width: 45px; font-size: 8px; color: #6e7c91; }
    .lg-wave-canvas { flex: 1; height: 100%; }

    /* Buttons & Badges */
    .lg-badge { background: rgba(0,255,102,0.15); color: #00ff66; border: 1px solid #00ff66; font-size: 9px; font-weight: bold; padding: 2px 6px; border-radius: 3px; }
    .lg-btn { background: #252d3a; border: 1px solid #3c485c; color: #d0d7e2; padding: 5px 12px; border-radius: 3px; font-size: 10px; font-weight: bold; cursor: pointer; }
    .lg-btn:hover { background: #323d4e; border-color: #00ff66; }
    .lg-btn-primary { background: #00ff66; color: #000; border-color: #00ff66; }
    .lg-btn-primary:hover { background: #00cc52; }
    .lg-btn-secondary { background: #1a2029; color: #a0acba; }
    .lg-btn-full { width: 100%; }
    .lg-btn-sm { padding: 3px 8px; font-size: 9px; }
    .status-tag { margin-top: 6px; padding: 4px; font-size: 10px; border-radius: 3px; text-align: center; font-weight: bold; }
    .status-tag.pending { background: #12151b; color: #6e7c91; border: 1px solid #2a313d; }
    .status-tag.success { background: rgba(0,255,102,0.2); color: #00ff66; border: 1px solid #00ff66; }
  `;
  document.head.appendChild(style);
}

export function mountLogicGatesLab(containerId: string): void {
  injectLogicGatesStyles();
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = `<div id="lg-app-root" class="lg-workspace"></div>`;
  renderCurrentView();
}

/**
 * Mount only the 2D breadboard GAME view for a given level.
 * Used by React GamesPage after diamond level selection.
 * @param {string|HTMLElement} containerOrId
 * @param {number} levelIndex
 * @param {() => void} [onBack]
 */
export function mountLogicGatesGame(
  containerOrId: string | HTMLElement,
  levelIndex: number,
  onBack?: () => void,
): void {
  injectLogicGatesStyles();
  const container =
    typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;
  if (!container) return;

  try {
    const raw = localStorage.getItem('zipelectro-logic-sim-progress');
    if (raw) {
      const ids = JSON.parse(raw);
      if (Array.isArray(ids)) {
        ids.forEach((id) => {
          appState.levelProgress[id] = true;
        });
      }
    }
  } catch (_) {}

  appState.currentLevelIndex = Math.max(0, Math.min(levelIndex, LOGIC_GATES_LEVELS.length - 1));
  appState.selectedLevelIndex = appState.currentLevelIndex;
  appState.currentView = 'GAME';
  appState.nodes = [];
  appState.connections = [];
  appState._reactOnBack = typeof onBack === 'function' ? onBack : null;

  container.innerHTML = `<div id="lg-app-root" class="lg-workspace" style="height:100%;min-height:560px;"></div>`;
  renderCurrentView();
}

export function unmountLogicGatesGame(containerOrId: string | HTMLElement): void {
  const container =
    typeof containerOrId === 'string'
      ? document.getElementById(containerOrId)
      : containerOrId;
  if (container) container.innerHTML = '';
  appState._reactOnBack = null;
  appState.nodes = [];
  appState.connections = [];
}

// Router Controller
function renderCurrentView() {
  const root = document.getElementById('lg-app-root');
  if (!root) return;

  root.className = 'lg-workspace lg-fade-in';

  switch (appState.currentView) {
    case 'EXPLORE':
      renderExploreScreen(root);
      break;
    case 'LEVEL_SELECT':
      renderLevelSelectScreen(root);
      break;
    case 'GAME':
      renderGameCanvasScreen(root);
      break;
  }
}

// 1. EXPLORE SCREEN
function renderExploreScreen(container) {
  container.innerHTML = `
    <div class="lg-hero-screen">
      <div class="lg-circuit-bg-glow"></div>
      <div class="lg-hero-content">
        <span class="lg-badge">HARDWARE CIRCUIT SIMULATOR</span>
        <h1 class="lg-hero-title">LOGIC CIRCUIT CHALLENGE</h1>
        <p class="lg-hero-subtitle">Construct digital logic circuits, perform bus wiring on breadboard canvases, and inspect signals with live timing analyzers.</p>
        <button class="lg-btn lg-btn-hero" onclick="navigateTo('LEVEL_SELECT')">
          <span>ENTER LAB WORKBENCH</span>
        </button>
      </div>
    </div>
  `;
}

// 2. LEVEL SELECT SCREEN (diamond / neon UI)
function isLevelUnlocked(index) {
  if (index === 0) return true;
  const prev = LOGIC_GATES_LEVELS[index - 1];
  return !!(prev && appState.levelProgress[prev.id]);
}

function selectLevel(index) {
  if (!isLevelUnlocked(index)) return;
  appState.selectedLevelIndex = index;
  renderCurrentView();
}

function changeLevelPage(delta) {
  const totalPages = Math.ceil(LOGIC_GATES_LEVELS.length / appState.levelsPerPage);
  appState.levelPage = Math.max(0, Math.min(totalPages - 1, appState.levelPage + delta));
  renderCurrentView();
}

function playSelectedLevel() {
  const idx = appState.selectedLevelIndex;
  if (!isLevelUnlocked(idx)) return;
  startLevel(idx);
}

function renderLevelSelectScreen(container) {
  const perPage = appState.levelsPerPage;
  const totalPages = Math.ceil(LOGIC_GATES_LEVELS.length / perPage);
  const page = Math.min(appState.levelPage, totalPages - 1);
  appState.levelPage = page;
  const start = page * perPage;
  const pageLevels = LOGIC_GATES_LEVELS.slice(start, start + perPage);

  // Ensure selected index is on current page or snap to first unlocked on page
  if (appState.selectedLevelIndex < start || appState.selectedLevelIndex >= start + perPage) {
    const firstUnlocked = pageLevels.findIndex((_, i) => isLevelUnlocked(start + i));
    if (firstUnlocked >= 0) appState.selectedLevelIndex = start + firstUnlocked;
  }

  const diamondsHtml = pageLevels.map((lvl, i) => {
    const idx = start + i;
    const unlocked = isLevelUnlocked(idx);
    const completed = !!appState.levelProgress[lvl.id];
    const selected = appState.selectedLevelIndex === idx;
    let cls = 'lg-diamond';
    if (!unlocked) cls += ' locked';
    else if (selected) cls += ' selected';
    else if (completed) cls += ' cleared';
    else cls += ' available';

    const inner = unlocked
      ? `<span class="lg-diamond-num">${idx + 1}</span>`
      : `<span class="lg-diamond-lock">🔒</span>`;

    return `
      <button type="button" class="${cls}" onclick="selectLevel(${idx})" ${unlocked ? '' : 'disabled'} aria-label="Level ${idx + 1}">
        <span class="lg-diamond-shape">${inner}</span>
        ${selected && unlocked ? '<span class="lg-diamond-underline"></span>' : '<span class="lg-diamond-underline muted"></span>'}
      </button>
    `;
  }).join('');

  const dotsHtml = Array.from({ length: totalPages }, (_, p) =>
    `<span class="lg-page-dot ${p === page ? 'active' : ''}" onclick="appState.levelPage=${p};renderCurrentView()"></span>`
  ).join('');

  const selectedLvl = LOGIC_GATES_LEVELS[appState.selectedLevelIndex];
  const canPlay = isLevelUnlocked(appState.selectedLevelIndex);

  container.innerHTML = `
    <div class="lg-level-select-screen">
      <button type="button" class="lg-back-btn" onclick="navigateTo('EXPLORE')" title="Back">←</button>
      <h1 class="lg-level-select-title">LEVEL SELECTION</h1>

      <div class="lg-diamond-row">
        ${diamondsHtml}
      </div>

      <div class="lg-page-dots">${dotsHtml}</div>

      <div class="lg-level-preview">
        <div class="lg-preview-diff">${selectedLvl ? selectedLvl.difficulty : ''}</div>
        <div class="lg-preview-title">${selectedLvl ? selectedLvl.title : ''}</div>
        <p class="lg-preview-desc">${selectedLvl ? selectedLvl.description : ''}</p>
      </div>

      <button type="button" class="lg-play-btn ${canPlay ? '' : 'disabled'}" onclick="playSelectedLevel()" ${canPlay ? '' : 'disabled'}>
        PLAY
      </button>
    </div>
  `;
}

function backFromGame() {
  if (typeof appState._reactOnBack === 'function') {
    appState._reactOnBack();
    return;
  }
  navigateTo('LEVEL_SELECT');
}

// 3. GAME CANVAS SCREEN (2D breadboard simulator)
function renderGameCanvasScreen(container) {
  container.innerHTML = `
    <!-- Top System Titlebar -->
    <div class="lg-navbar">
      <div class="lg-title-group">
        <button class="lg-btn lg-btn-secondary lg-btn-sm" onclick="backFromGame()">← LEVELS</button>
        <h2 id="lg-level-title">LOGIC CIRCUIT CHALLENGE</h2>
      </div>
      <div class="lg-controls">
        <button class="lg-btn lg-btn-secondary" onclick="resetCircuitCanvas()">RESET</button>
        <button class="lg-btn lg-btn-primary" onclick="verifyLogicSolution()">RUN &amp; VERIFY</button>
      </div>
    </div>

    <!-- Main Workbench Area -->
    <div class="lg-workbench">
      
      <!-- Left Drawer: Components & Logic ICs -->
      <aside class="lg-sidebar">
        <div class="lg-sidebar-section">
          <div class="lg-sidebar-title">COMPONENTS</div>
          <div class="lg-help-text">Drag a gate into the center board.</div>
          <div class="lg-how-to-play lg-how-to-play-compact">
            <strong>BUILD THE PATH</strong>
            <span>1. Drag a gate onto the board</span>
            <span>2. Click output pin, then click target pin</span>
            <span>3. Run VERIFY</span>
          </div>
          
          <div class="lg-category-label">LOGIC GATES</div>
          <div class="lg-toolbox-grid" id="lg-toolbox-gates"></div>

          <div class="lg-category-label" style="margin-top:10px;">CPU &amp; INPUTS</div>
          <div class="lg-toolbox-grid" id="lg-toolbox-inputs"></div>
        </div>

        <div class="lg-level-info">
          <div class="lg-category-label">OBJECTIVE</div>
          <p id="lg-level-desc">Loading...</p>
          <div id="lg-completion-status" class="status-tag pending">STATUS: PENDING</div>
        </div>
      </aside>

      <!-- Center Canvas: Dotted Breadboard Viewport -->
      <main class="lg-canvas-viewport" id="lg-viewport">
        <!-- Main Glowing Bus Tube Background -->
        <div class="lg-bus-pipe-overlay">
          <div class="lg-bus-value-tag" id="lg-bus-val">[0x00]</div>
        </div>

        <!-- SVG Signal Wire Connector Layer -->
        <svg class="lg-svg-wire-layer" id="lg-wire-layer">
          <defs>
            <filter id="wire-glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>
        </svg>

        <!-- Node / IC Layer -->
        <div class="lg-node-layer" id="lg-node-layer"></div>
      </main>

      <!-- Right Drawer: System Analyzer & Waveforms -->
      <aside class="lg-analyzer-panel">
        <div class="lg-sidebar-title">SYSTEM ANALYZER &amp; STATUS</div>

        <div style="font-size:10px; color:#6e7c91; font-weight:bold; margin-top:4px;">CLOCK CONTROLS</div>
        <div class="lg-clock-box">
          <div>
            <div style="font-size:8px; color:#6e7c91;">FREQ</div>
            <div style="font-weight:bold; font-size:11px;">1Hz</div>
          </div>
          <div>
            <div style="font-size:8px; color:#6e7c91;">STATE</div>
            <div class="lg-state-badge" id="lg-clock-indicator">HIGH</div>
          </div>
          <button class="lg-btn lg-btn-sm" id="lg-clock-step-btn" onclick="toggleClockStep()">STEP 👆</button>
        </div>

        <div style="font-size:10px; color:#6e7c91; font-weight:bold;">STATUS (Live Values)</div>
        <div class="lg-status-table">
          <div class="lg-status-row">BUS: <span id="stat-bus">[0x00]</span></div>
          <div class="lg-status-row">Reg A: <span id="stat-rega">[0x01]</span></div>
          <div class="lg-status-row">Reg B: <span id="stat-regb">[0x00]</span></div>
          <div class="lg-status-row">OUT: <span id="stat-out">[0x00]</span></div>
        </div>

        <!-- Logic Timing Analyzer Canvas -->
        <div class="lg-timing-container">
          <div style="font-size:10px; font-weight:bold; color:#fff; margin-bottom:4px;">LOGIC ANALYZER (Timing Diagram)</div>
          <div class="lg-analyzer-steps"><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>

          <div class="lg-wave-row">
            <span class="lg-wave-label">CLOCK</span>
            <canvas class="lg-wave-canvas" id="clk-canvas"></canvas>
          </div>
          <div class="lg-wave-row">
            <span class="lg-wave-label">BUS</span>
            <canvas class="lg-wave-canvas" id="bus-canvas"></canvas>
          </div>
          <div class="lg-wave-row">
            <span class="lg-wave-label">IN_A</span>
            <canvas class="lg-wave-canvas" id="ina-canvas"></canvas>
          </div>
          <div class="lg-wave-row">
            <span class="lg-wave-label">OUT</span>
            <canvas class="lg-wave-canvas" id="out-canvas"></canvas>
          </div>
        </div>
      </aside>

    </div>
  `;

  loadLogicGatesLevel(appState.currentLevelIndex);
}

// Navigation Helper
function navigateTo(view) {
  appState.currentView = view;
  renderCurrentView();
}

function startLevel(index) {
  if (!isLevelUnlocked(index)) return;
  appState.currentLevelIndex = index;
  appState.selectedLevelIndex = index;
  navigateTo('GAME');
}

// Level Canvas Initialization
function loadLogicGatesLevel(levelIdx) {
  const level = LOGIC_GATES_LEVELS[levelIdx];
  if (!level) return;

  appState.nodes = [];
  appState.connections = [];
  appState.wiringStart = null;
  const root = document.getElementById('lg-app-root');
  if (root) root.classList.remove('wiring-mode');
  const nodeLayer = document.getElementById('lg-node-layer');
  if (nodeLayer) nodeLayer.innerHTML = '';

  document.getElementById('lg-level-title').textContent = level.title;
  document.getElementById('lg-level-desc').textContent = level.description;
  const statusEl = document.getElementById('lg-completion-status');
  if (statusEl) {
    statusEl.textContent = 'STATUS: PENDING';
    statusEl.className = 'status-tag pending';
  }

  // Render Gate Toolbox
  const gateToolbox = document.getElementById('lg-toolbox-gates');
  if (gateToolbox) {
    gateToolbox.innerHTML = '';
    level.availableGates.forEach(gateType => {
      const item = document.createElement('div');
      item.className = 'lg-ic-chip-item';
      item.setAttribute('draggable', 'true');
      item.innerHTML = `<div class="lg-ic-symbol">${gateSymbolImage(gateType)}</div><div class="lg-ic-name">${gateType}</div>`;

      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('gateType', gateType);
      });
      gateToolbox.appendChild(item);
    });
  }

  // Render Inputs/Clock Toolbox
  const inputToolbox = document.getElementById('lg-toolbox-inputs');
  if (inputToolbox) {
    inputToolbox.innerHTML = `
      <div class="lg-ic-chip-item"><div class="lg-ic-symbol">CLK</div><div class="lg-ic-name">Clock IC</div></div>
      <div class="lg-ic-chip-item"><div class="lg-ic-symbol">HEX</div><div class="lg-ic-name">Manual Val</div></div>
    `;
  }

  // Fan-out pin counts: higher levels need multiple taps from one switch/gate
  const SWITCH_INPUTS = 2;  // left-side receive pins (switch-to-switch, gate→switch)
  const SWITCH_FANOUT = 3;  // right-side output terminals
  const GATE_FANOUT = 3;    // output terminals on the right of each logic gate

  // Spawn Level Inputs (switches): left = inputs (receive), right = outputs (fan-out)
  level.inputs.forEach((inSpec, idx) => {
    createNodeOnCanvas({
      id: inSpec.id,
      type: 'INPUT',
      label: inSpec.label,
      x: 40,
      y: 50 + idx * 120,
      outputState: inSpec.defaultState,
      inputPins: Array.from({ length: SWITCH_INPUTS }, (_, i) => i),
      outputPins: Array.from({ length: SWITCH_FANOUT }, (_, i) => i),
    });
  });

  // Spawn Level Outputs
  const viewport = document.getElementById('lg-viewport');
  const outputX = Math.max(300, (viewport ? viewport.clientWidth : 600) - 120);
  level.outputs.forEach((outSpec, idx) => {
    createNodeOnCanvas({
      id: outSpec.id,
      type: 'OUTPUT',
      label: outSpec.label,
      x: outputX,
      y: 50 + idx * 120,
      outputState: false,
      inputPins: [0],
      outputPins: [],
    });
  });

  viewport.ondragover = (e) => e.preventDefault();
  viewport.ondrop = (e) => {
    e.preventDefault();
    const gateType = e.dataTransfer.getData('gateType');
    if (!gateType || !GATE_TYPES[gateType]) return;

    const rect = viewport.getBoundingClientRect();
    const x = e.clientX - rect.left - 45;
    const y = e.clientY - rect.top - 30;

    const numInputs = GATE_TYPES[gateType].inputs;
    createNodeOnCanvas({
      id: `gate_${Date.now()}`,
      type: gateType,
      label: GATE_TYPES[gateType].id,
      x: Math.max(10, x),
      y: Math.max(10, y),
      outputState: false,
      inputPins: Array.from({ length: numInputs }, (_, i) => i),
      // Multiple right-side outputs so one gate can feed several destinations
      outputPins: Array.from({ length: GATE_FANOUT }, (_, i) => i),
    });
  };

  // Click empty board to cancel an in-progress wire
  viewport.addEventListener('click', (e) => {
    if (e.target === viewport || e.target.id === 'lg-wire-layer' || e.target.classList?.contains('lg-bus-pipe-overlay')) {
      if (appState.wiringStart) clearWiringStart();
    }
  });

  evaluateCircuit();
}

function createNodeOnCanvas(spec) {
  appState.nodes.push(spec);
  renderNodeDOM(spec);
}

function renderNodeDOM(node) {
  const layer = document.getElementById('lg-node-layer');
  if (!layer) return;

  const nodeEl = document.createElement('div');
  nodeEl.className = `lg-ic-node lg-node-${node.type.toLowerCase()} lg-pop-in`;
  nodeEl.id = `node-${node.id}`;
  nodeEl.style.left = `${node.x}px`;
  nodeEl.style.top = `${node.y}px`;

  const symbol = GATE_TYPES[node.type] ? gateSymbolImage(node.type) : node.label;

  // All nodes: inputs on left, outputs on right.
  // INPUT switches accept wires on the left (driven by another node) and fan-out on the right.
  const leftPinsHtml = node.inputPins
    .map(
      (pinIdx) =>
        `<div class="lg-pin lg-pin-input" data-node="${node.id}" data-pin="${pinIdx}" title="Input ${pinIdx}"></div>`,
    )
    .join('');
  const rightPinsHtml = node.outputPins
    .map(
      (pinIdx) =>
        `<div class="lg-pin lg-pin-output" data-node="${node.id}" data-pin="${pinIdx}" data-side="right" title="Output ${pinIdx}"></div>`,
    )
    .join('');

  nodeEl.innerHTML = `
    <div class="lg-ic-header">
      <span>${node.label}</span>
      <span class="lg-val-badge" id="val-${node.id}">${node.outputState ? 'HIGH' : 'LOW'}</span>
    </div>
    <div class="lg-ic-body">
      <div class="lg-ic-pins-left">${leftPinsHtml}</div>
      <div class="lg-ic-center-core">${symbol}</div>
      <div class="lg-ic-pins-right">${rightPinsHtml}</div>
    </div>
  `;

  if (node.type === 'INPUT') {
    nodeEl.classList.add('clickable');
    nodeEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('lg-pin')) return;
      // If another node is driving this switch, ignore manual toggle
      const driven = appState.connections.some((c) => c.toNodeId === node.id);
      if (driven) return;
      node.outputState = !node.outputState;
      evaluateCircuit();
    });
  }

  // Dragging Implementation
  nodeEl.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('lg-pin')) return;
    if (appState.wiringStart) clearWiringStart();
    appState.isDragging = true;
    appState.draggedNode = node;
    const viewport = document.getElementById('lg-viewport');
    const rect = viewport.getBoundingClientRect();
    let shiftX = e.clientX - rect.left - node.x;
    let shiftY = e.clientY - rect.top - node.y;

    function onMouseMove(e) {
      if (appState.isDragging) {
        node.x = e.clientX - rect.left - shiftX;
        node.y = e.clientY - rect.top - shiftY;
        nodeEl.style.left = `${node.x}px`;
        nodeEl.style.top = `${node.y}px`;
        renderWires();
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', () => {
      appState.isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
    }, { once: true });
  });

  // Click-to-connect: 1st click on output pin starts, 2nd click on any other node finishes
  nodeEl.querySelectorAll('.lg-pin').forEach((pinEl) => {
    pinEl.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();

      const pinIdx = parseInt(pinEl.dataset.pin, 10);
      const isOutput = pinEl.classList.contains('lg-pin-output');
      const side = pinEl.dataset.side === 'left' ? 'left' : 'right';

      // --- No active wire: start from an output pin ---
      if (!appState.wiringStart) {
        if (!isOutput) return; // must start from an output
        appState.wiringStart = {
          nodeId: node.id,
          pinIdx,
          isOutput: true,
          side,
        };
        updateWiringUI();
        return;
      }

      // --- Active wire: second click ---
      const fromId = appState.wiringStart.nodeId;

      // Click same source pin again → cancel
      if (
        fromId === node.id &&
        appState.wiringStart.pinIdx === pinIdx &&
        isOutput
      ) {
        clearWiringStart();
        return;
      }

      // Same node (other pin) → cancel self-wire
      if (fromId === node.id) {
        clearWiringStart();
        return;
      }

      // Resolve target pin: prefer real input pins
      let toPin = pinIdx;
      const isInputPin = pinEl.classList.contains('lg-pin-input');
      if (!isInputPin && node.inputPins && node.inputPins.length > 0) {
        const used = new Set(
          appState.connections.filter((c) => c.toNodeId === node.id).map((c) => c.toPin),
        );
        const free = node.inputPins.find((p) => !used.has(p));
        toPin = free !== undefined ? free : node.inputPins[0];
      } else if (!isInputPin && (!node.inputPins || node.inputPins.length === 0)) {
        toPin = 0;
      }

      addWireConnection(
        fromId,
        appState.wiringStart.pinIdx,
        node.id,
        toPin,
        appState.wiringStart.side || 'right',
      );
      clearWiringStart();
    });
  });

  layer.appendChild(nodeEl);
}

/** Highlight source pin + crosshair mode while placing a wire. */
function updateWiringUI() {
  document.querySelectorAll('.lg-pin.wiring-source').forEach((el) => {
    el.classList.remove('wiring-source');
  });
  const root = document.getElementById('lg-app-root');
  if (!appState.wiringStart) {
    if (root) root.classList.remove('wiring-mode');
    return;
  }
  if (root) root.classList.add('wiring-mode');
  const sel = `.lg-pin-output[data-node="${appState.wiringStart.nodeId}"][data-pin="${appState.wiringStart.pinIdx}"]`;
  document.querySelectorAll(sel).forEach((el) => el.classList.add('wiring-source'));
}

function clearWiringStart() {
  appState.wiringStart = null;
  updateWiringUI();
}

function addWireConnection(fromId, fromPin, toId, toPin, fromSide = 'right') {
  if (fromId === toId) return;

  // One wire per input pin — replace any existing connection to this pin
  appState.connections = appState.connections.filter(
    (c) => !(c.toNodeId === toId && c.toPin === toPin),
  );
  appState.connections.push({
    id: `wire_${Date.now()}`,
    fromNodeId: fromId,
    fromPin,
    fromSide,
    toNodeId: toId,
    toPin,
  });
  renderWires();
  evaluateCircuit();
}

function renderWires() {
  const svgLayer = document.getElementById('lg-wire-layer');
  if (!svgLayer) return;

  // Clear existing paths, keep defs
  const defs = svgLayer.querySelector('defs');
  svgLayer.innerHTML = '';
  if (defs) svgLayer.appendChild(defs);

  const NODE_W = 110;

  appState.connections.forEach((conn) => {
    const fromNode = appState.nodes.find((n) => n.id === conn.fromNodeId);
    const toNode = appState.nodes.find((n) => n.id === conn.toNodeId);
    if (!fromNode || !toNode) return;

    // Header ~22px + body padding; pins stack with ~15px pitch
    const pinY = (node, pinIdx) => node.y + 36 + pinIdx * 15;

    const fromLeft = conn.fromSide === 'left';
    const x1 = fromLeft ? fromNode.x : fromNode.x + NODE_W;
    const y1 = pinY(fromNode, conn.fromPin);
    const x2 = toNode.x;
    const y2 = pinY(toNode, conn.toPin);

    // Bezier control points bend outward from the exit side
    const span = Math.abs(x2 - x1);
    const dx = Math.max(36, span * 0.45);
    const c1x = fromLeft ? x1 - dx : x1 + dx;
    const c2x = x2 - dx;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${x1} ${y1} C ${c1x} ${y1}, ${c2x} ${y2}, ${x2} ${y2}`);
    path.setAttribute('class', `lg-wire ${fromNode.outputState ? 'active' : ''}`);
    path.setAttribute('filter', fromNode.outputState ? 'url(#wire-glow)' : 'none');
    svgLayer.appendChild(path);
  });
}

/**
 * @param {{ lockedInputIds?: Set<string> }} [opts]
 * lockedInputIds: INPUT nodes whose outputState must not be overwritten
 * (used during truth-table verification so test vectors stick).
 */
function evaluateCircuit(opts = {}) {
  const lockedInputIds = opts.lockedInputIds || null;
  let changed = true;
  let iterations = 0;

  while (changed && iterations < 50) {
    changed = false;
    iterations++;

    appState.nodes.forEach((node) => {
      // Resolve values arriving on this node's input pins
      const inputValues = (node.inputPins || []).map((_, index) => {
        const conn = appState.connections.find(
          (c) => c.toNodeId === node.id && c.toPin === index,
        );
        if (!conn) return null; // no wire
        const src = appState.nodes.find((n) => n.id === conn.fromNodeId);
        return src ? src.outputState : false;
      });

      let newState = node.outputState;

      if (node.type === 'INPUT') {
        // During verification, level switches keep the forced test-vector value
        if (lockedInputIds && lockedInputIds.has(node.id)) {
          // leave outputState as set by the test case
        } else {
          // Driven by another node if any input pin has a wire; otherwise keep manual toggle
          const driven = inputValues.find((v) => v !== null);
          if (driven !== undefined && driven !== null) {
            newState = driven;
          }
        }
      } else if (node.type === 'OUTPUT') {
        newState = inputValues[0] === null ? false : !!inputValues[0];
      } else if (GATE_TYPES[node.type]) {
        // Pass null for unwired pins so multi-input gates ignore them
        newState = GATE_TYPES[node.type].fn(...inputValues);
      }

      if (node.outputState !== newState) {
        node.outputState = newState;
        changed = true;
      }
    });
  }

  // Update Node DOM Badges
  appState.nodes.forEach(node => {
    const badge = document.getElementById(`val-${node.id}`);
    const nodeEl = document.getElementById(`node-${node.id}`);
    if (badge) badge.textContent = node.outputState ? 'HIGH' : 'LOW';
    if (nodeEl) nodeEl.classList.toggle('state-high', node.outputState);
  });

  // Calculate System Bus Hex Display
  const targetOut = appState.nodes.find(n => n.type === 'OUTPUT');
  const busValHex = targetOut && targetOut.outputState ? '0x2A' : '0x00';
  appState.busHexValue = busValHex;

  const busTag = document.getElementById('lg-bus-val');
  if (busTag) busTag.textContent = `[${busValHex}]`;

  const statBus = document.getElementById('stat-bus');
  const statOut = document.getElementById('stat-out');
  if (statBus) statBus.textContent = `[${busValHex}]`;
  if (statOut) statOut.textContent = `[${busValHex}]`;

  renderWires();
  renderAnalyzerWaveforms();
}

function toggleClockStep() {
  appState.clockState = !appState.clockState;
  const indicator = document.getElementById('lg-clock-indicator');
  if (indicator) {
    indicator.textContent = appState.clockState ? 'HIGH' : 'LOW';
    indicator.style.borderColor = appState.clockState ? '#00ff66' : '#6e7c91';
    indicator.style.color = appState.clockState ? '#00ff66' : '#6e7c91';
  }
  renderAnalyzerWaveforms();
}

// Logic Analyzer Waveform Renderers
function drawSquareWave(canvasId, values) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth);
  const h = (canvas.height = canvas.clientHeight);

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = '#00ff66';
  ctx.lineWidth = 1.5;
  ctx.beginPath();

  const step = w / values.length;
  values.forEach((v, i) => {
    const x = i * step;
    const y = v ? 3 : h - 4;
    if (i === 0) ctx.moveTo(x, y);
    else {
      ctx.lineTo(x, v ? h - 4 : 3);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(x + step, y);
  });
  ctx.stroke();
}

function drawBusWave(canvasId, hexLabels) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = (canvas.width = canvas.clientWidth);
  const h = (canvas.height = canvas.clientHeight);

  ctx.clearRect(0, 0, w, h);
  const step = w / hexLabels.length;

  hexLabels.forEach((label, i) => {
    const x = i * step;
    ctx.fillStyle = '#1c2430';
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x + 2, h / 2);
    ctx.lineTo(x + 5, 2);
    ctx.lineTo(x + step - 5, 2);
    ctx.lineTo(x + step - 2, h / 2);
    ctx.lineTo(x + step - 5, h - 2);
    ctx.lineTo(x + 5, h - 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#00ff66';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + step / 2, h / 2 + 3);
  });
}

function renderAnalyzerWaveforms() {
  const inA = appState.nodes.find(n => n.id === 'in_1');
  const out1 = appState.nodes.find(n => n.type === 'OUTPUT');

  const clkWave = appState.clockState ? [1, 0, 1, 0, 1, 0] : [0, 1, 0, 1, 0, 1];
  const inVal = inA && inA.outputState ? 1 : 0;
  const outVal = out1 && out1.outputState ? 1 : 0;

  drawSquareWave('clk-canvas', clkWave);
  drawBusWave('bus-canvas', [appState.busHexValue, appState.busHexValue, appState.busHexValue, appState.busHexValue]);
  drawSquareWave('ina-canvas', [inVal, inVal, inVal, inVal]);
  drawSquareWave('out-canvas', [outVal, outVal, outVal, outVal]);
}

function verifyLogicSolution() {
  const level = LOGIC_GATES_LEVELS[appState.currentLevelIndex];
  if (!level) return;

  let isComplete = true;
  let failedCase = null;
  const lockedInputIds = new Set(level.inputs.map((inp) => inp.id));

  for (const testCase of level.truthTable) {
    // Force every level switch to the truth-table vector
    Object.keys(testCase.inputStates).forEach((inId) => {
      const node = appState.nodes.find((n) => n.id === inId);
      if (node) node.outputState = testCase.inputStates[inId];
    });

    // Propagate through gates/outputs without overwriting the forced switches
    evaluateCircuit({ lockedInputIds });

    let caseOk = true;
    Object.keys(testCase.expectedOutput).forEach((outId) => {
      const node = appState.nodes.find((n) => n.id === outId);
      if (!node || node.outputState !== testCase.expectedOutput[outId]) {
        caseOk = false;
      }
    });

    if (!caseOk) {
      isComplete = false;
      if (!failedCase) failedCase = testCase;
    }
  }

  const statusEl = document.getElementById('lg-completion-status');
  if (isComplete) {
    appState.levelProgress[level.id] = true;
    try {
      const ids = Object.keys(appState.levelProgress).filter((k) => appState.levelProgress[k]);
      localStorage.setItem('zipelectro-logic-sim-progress', JSON.stringify(ids));
    } catch (_) {}
    try {
      window.dispatchEvent(
        new CustomEvent('zipelectro-level-cleared', { detail: { id: level.id } }),
      );
    } catch (_) {}
    if (statusEl) {
      statusEl.textContent = '✓ CIRCUIT VERIFIED!';
      statusEl.className = 'status-tag success lg-pop-in';
    }
  } else if (statusEl) {
    // Show which input combination failed so the player can see why
    let detail = '❌ VERIFICATION FAILED';
    if (failedCase) {
      const ins = Object.entries(failedCase.inputStates)
        .map(([id, v]) => `${id.replace('in_', '')}=${v ? '1' : '0'}`)
        .join(' ');
      const exp = Object.values(failedCase.expectedOutput)[0] ? 'HIGH' : 'LOW';
      detail = `❌ FAIL when ${ins} (need OUT ${exp})`;
    }
    statusEl.textContent = detail;
    statusEl.className = 'status-tag pending';
  }
}

function resetCircuitCanvas() {
  loadLogicGatesLevel(appState.currentLevelIndex);
}

function logicGatesLabView() {
  injectLogicGatesStyles();
  // Always land on the diamond level-selection screen first
  appState.currentView = 'LEVEL_SELECT';
  // Defer render until the HTML is in the DOM
  setTimeout(() => {
    if (document.getElementById('lg-app-root')) renderCurrentView();
  }, 0);
  return `
    <section class="explore-game-page" style="width:100%;padding:0;">
      <div id="logic-gates-root">
        <div id="lg-app-root" class="lg-workspace lg-fade-in"></div>
      </div>
    </section>
  `;
}

function startLogicGatesLab() {
  if (typeof window.go === 'function') {
    window.go('explore-logic-gates');
  }
}

function exitLogicGatesLab() {
  if (typeof window.go === 'function') {
    window.go('explore');
  }
}


/** Bind inline onclick handlers used by the injected DOM HTML. */
function bindWindowHandlers(): void {
  const w = window as unknown as Record<string, unknown>;
  w.selectLevel = selectLevel;
  w.playSelectedLevel = playSelectedLevel;
  w.changeLevelPage = changeLevelPage;
  w.navigateTo = navigateTo;
  w.startLevel = startLevel;
  w.resetCircuitCanvas = resetCircuitCanvas;
  w.verifyLogicSolution = verifyLogicSolution;
  w.toggleClockStep = toggleClockStep;
  w.exitLogicGatesLab = exitLogicGatesLab;
  w.backFromGame = backFromGame;
  w.mountLogicGatesGame = mountLogicGatesGame;
  w.unmountLogicGatesGame = unmountLogicGatesGame;
  w.LOGIC_GATES_LEVELS = LOGIC_GATES_LEVELS;
  w.ExploreGames = {
    ...(typeof w.ExploreGames === "object" && w.ExploreGames ? (w.ExploreGames as object) : {}),
    logicGatesLabView,
    startLogicGatesLab,
    exitLogicGatesLab,
    mountLogicGatesLab,
    mountLogicGatesGame,
    unmountLogicGatesGame,
    renderCurrentView,
    navigateTo,
    startLevel,
    selectLevel,
    playSelectedLevel,
    changeLevelPage,
    resetCircuitCanvas,
    verifyLogicSolution,
    loadLogicGatesLevel,
    toggleClockStep,
    backFromGame,
    LOGIC_GATES_LEVELS,
  };
}

bindWindowHandlers();

export {
  startLevel,
  navigateTo,
  verifyLogicSolution,
  resetCircuitCanvas,
  loadLogicGatesLevel,
  renderCurrentView,
  backFromGame,
};
