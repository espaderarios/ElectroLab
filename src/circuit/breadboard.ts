import {
  PITCH,
  ROWS,
  type HoleId,
  type RailKind,
  type RowLetter,
} from "./types";

/** Built-in breadboard size / style presets. */
export type BoardPresetId =
  | "mini-170"
  | "half-400"
  | "standard-830"
  | "full-1660"
  | "mb-102";

export interface BoardPreset {
  id: BoardPresetId;
  label: string;
  description: string;
  /** Number of terminal-strip columns. */
  cols: number;
  /** Number of holes in each power rail. */
  railHoles: number;
  /** Include top/bottom power rails. */
  hasRails: boolean;
  /** How many rail holes are electrically continuous before a break. */
  railSegment: number;
}

export const BOARD_PRESETS: BoardPreset[] = [
  {
    id: "mini-170",
    label: "Mini 170",
    description: "17 columns · 170 tie-points",
    cols: 17,
    railHoles: 0,
    hasRails: false,
    railSegment: 0,
  },
  {
    id: "half-400",
    label: "Half-size 400",
    description: "30 columns · 400 tie-points",
    cols: 30,
    railHoles: 25,
    hasRails: true,
    railSegment: 25,
  },
  {
    id: "standard-830",
    label: "Standard 830",
    description: "63 columns · 830 tie-points",
    cols: 63,
    railHoles: 50,
    hasRails: true,
    railSegment: 25,
  },
  {
    id: "mb-102",
    label: "MB-102",
    description: "63 columns · 830 tie-points (continuous rails)",
    cols: 63,
    railHoles: 50,
    hasRails: true,
    railSegment: 50,
  },
  {
    id: "full-1660",
    label: "Full / double 1660",
    description: "Two 830-point boards · 8 power rails · 1660 tie-points",
    cols: 63,
    railHoles: 50,
    hasRails: true,
    railSegment: 25,
  },
];

export function getBoardPreset(id: BoardPresetId): BoardPreset {
  return BOARD_PRESETS.find((p) => p.id === id) ?? BOARD_PRESETS[2];
}

let activePreset: BoardPreset = getBoardPreset("standard-830");

/** Mutable board dimensions — updated when the user switches presets. */
export const BOARD = {
  width: activePreset.cols * PITCH + 0.7,
  depth: activePreset.id === "full-1660" ? 12.0 : 5.7,
  height: 0.34,
  y: 0.17,
  cols: activePreset.cols,
  railHoles: activePreset.railHoles,
  hasRails: activePreset.hasRails,
  railSegment: activePreset.railSegment,
  presetId: activePreset.id as BoardPresetId,
};

/** Standard 4-rail Z positions (match visual rail strips in parts-3d). */
const STANDARD_RAIL_Z: Record<"tp" | "tn" | "bp" | "bn", number> = {
  tp: -2.5,
  tn: -2.2,
  bp: 2.2,
  bn: 2.5,
};

/**
 * Full-1660 8-rail Z positions — aligned with FULL_RAIL_Z in parts-3d.tsx.
 * Outer top → inner top → inner bottom → outer bottom, alternating +/−.
 */
const FULL_RAIL_Z_MAP: Record<
  "otp" | "otn" | "itp" | "itn" | "ibp" | "ibn" | "obp" | "obn",
  number
> = {
  otp: -5.47,
  otn: -5.23,
  itp: -2.47,
  itn: -2.23,
  ibp: 2.23,
  ibn: 2.47,
  obp: 5.23,
  obn: 5.47,
};

const ROW_Z: Record<RowLetter, number> = {
  A: -1.78,
  B: -1.58,
  C: -1.38,
  D: -1.18,
  E: -1.0,
  F: 1.0,
  G: 1.18,
  H: 1.38,
  I: 1.58,
  J: 1.78,
};

const FULL_ROW_Z: Record<string, number> = {
  A: -4.63,
  B: -4.43,
  C: -4.23,
  D: -4.03,
  E: -3.83,

  F: -1.83,
  G: -1.63,
  H: -1.43,
  I: -1.23,
  J: -1.03,

  K: 1.03,
  L: 1.23,
  M: 1.43,
  N: 1.63,
  O: 1.83,

  P: 3.83,
  Q: 4.03,
  R: 4.23,
  S: 4.43,
  T: 4.63,
};

/** Terminal rows for the full-1660 double board. */
const FULL_ROWS = [
  "A", "B", "C", "D", "E",
  "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O",
  "P", "Q", "R", "S", "T",
] as const;

/** Rail prefixes used by the active board. */
export function activeRailPrefixes(): string[] {
  if (!BOARD.hasRails) return [];
  if (BOARD.presetId === "full-1660") {
    return ["otp", "otn", "itp", "itn", "ibp", "ibn", "obp", "obn"];
  }
  return ["tp", "tn", "bp", "bn"];
}

function rebuildBoardMetrics() {
  BOARD.width = activePreset.cols * PITCH + 0.7;
  BOARD.depth = activePreset.id === "full-1660" ? 12.0 : 5.7;
  BOARD.height = 0.34;
  BOARD.y = 0.17;
  BOARD.cols = activePreset.cols;
  BOARD.railHoles = activePreset.railHoles;
  BOARD.hasRails = activePreset.hasRails;
  BOARD.railSegment = activePreset.railSegment;
  BOARD.presetId = activePreset.id;
}

export function getActiveBoardPreset(): BoardPreset {
  return activePreset;
}

/** Switch the active breadboard geometry. Clears cached hole list. */
export function setBoardPreset(id: BoardPresetId) {
  activePreset = getBoardPreset(id);
  rebuildBoardMetrics();
  cachedHoles = null;
}

export function colX(col: number) {
  return (col - (BOARD.cols + 1) / 2) * PITCH;
}

function railColX(col: number) {
  return (col - (BOARD.railHoles + 1) / 2) * PITCH;
}

/** Parse a rail hole id into kind + column (supports 2- and 3-letter prefixes). */
function parseRailId(
  id: string,
): { kind: string; col: number } | null {
  // 3-letter prefixes first (otp, otn, itp, …)
  const m3 = id.match(/^(otp|otn|itp|itn|ibp|ibn|obp|obn)(\d+)$/);
  if (m3) return { kind: m3[1], col: Number(m3[2]) };
  const m2 = id.match(/^(tp|tn|bp|bn)(\d+)$/);
  if (m2) return { kind: m2[1], col: Number(m2[2]) };
  return null;
}

export function allHoles(): HoleId[] {
  const holes: HoleId[] = [];

  // Terminal strips
  const terminalRows =
    BOARD.presetId === "full-1660" ? FULL_ROWS : ROWS;

  for (let c = 1; c <= BOARD.cols; c++) {
    for (const row of terminalRows) {
      holes.push(`${row}${c}`);
    }
  }

  // Power rails
  if (BOARD.hasRails) {
    const prefixes = activeRailPrefixes();
    for (let c = 1; c <= BOARD.railHoles; c++) {
      for (const p of prefixes) {
        holes.push(`${p}${c}`);
      }
    }
  }

  return holes;
}

let cachedHoles: HoleId[] | null = null;

/** Live hole list for the active board (recomputed after preset changes). */
export function getAllHoles(): HoleId[] {
  if (!cachedHoles) cachedHoles = allHoles();
  return cachedHoles;
}

/** @deprecated Prefer getAllHoles() so board switches stay live. */
export const ALL_HOLES = allHoles();

export function holeStrip(id: HoleId): string {
  const rail = parseRailId(id);
  if (rail) {
    const seg = Math.max(1, BOARD.railSegment);
    const segmentIndex = Math.floor((rail.col - 1) / seg);
    return `${rail.kind}S${segmentIndex}`;
  }

  const row = id[0];
  const col = Number(id.slice(1));

  // First 830-point section
  if ("ABCDE".includes(row)) return `T${col}`;
  if ("FGHIJ".includes(row)) return `B${col}`;

  // Second 830-point section of the 1660 board
  if ("KLMNO".includes(row)) return `T2${col}`;
  if ("PQRST".includes(row)) return `B2${col}`;

  return `T${col}`;
}

export function holePosition(id: HoleId): [number, number, number] {
  const y = BOARD.height + 0.01;

  const rail = parseRailId(id);
  if (rail) {
    let z: number | undefined;
    if (BOARD.presetId === "full-1660") {
      z = FULL_RAIL_Z_MAP[rail.kind as keyof typeof FULL_RAIL_Z_MAP];
    } else {
      z = STANDARD_RAIL_Z[rail.kind as keyof typeof STANDARD_RAIL_Z];
    }
    if (z === undefined) {
      // Fallback so a mismatched id never returns NaN
      z = 0;
    }
    return [railColX(rail.col), y, z];
  }

  const row = id[0];
  const col = Number(id.slice(1));

  if (activePreset.id === "full-1660") {
    const z = FULL_ROW_Z[row] ?? 0;
    return [colX(col), y, z];
  }

  return [colX(col), y, ROW_Z[row as RowLetter] ?? 0];
}

export function isHoleId(value: string): value is HoleId {
  return getAllHoles().includes(value);
}

export function nearestHole(
  point: { x: number; y: number; z: number },
  maxDist = 0.14,
): HoleId | null {
  let best: HoleId | null = null;
  let bestD = maxDist;
  for (const id of getAllHoles()) {
    const [x, , z] = holePosition(id);
    const d = Math.hypot(point.x - x, point.z - z);
    if (d < bestD) {
      bestD = d;
      best = id;
    }
  }
  return best;
}

export function pinLabel(kind: string, name: string) {
  return `${kind}.${name}`;
}

/** Parse a terminal-strip hole like "E12" → { row, col }. */
export function parseTerminalHole(
  id: HoleId,
): { row: string; col: number } | null {
  if (!/^[A-T]\d+$/.test(id)) return null;

  return {
    row: id[0],
    col: Number(id.slice(1)),
  };
}

/**
 * Build a hole id in the same half of the board, offset by columns.
 * Clamps to valid column range.
 */
export function offsetHole(
  id: HoleId,
  colDelta: number,
  row?: string,
): HoleId | null {
  const parsed = parseTerminalHole(id);
  if (!parsed) return null;
  const col = Math.min(
    BOARD.cols,
    Math.max(1, parsed.col + colDelta),
  );
  const r = row ?? parsed.row;
  return `${r}${col}`;
}

/** Default positive / negative rail holes for the active board. */
export function defaultRailHoles(): { pos: HoleId; neg: HoleId } {
  if (!BOARD.hasRails) {
    return { pos: "A1", neg: "J1" };
  }
  if (BOARD.presetId === "full-1660") {
    return { pos: "otp1", neg: "otn1" };
  }
  return { pos: "tp1", neg: "tn1" };
}
