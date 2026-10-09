import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Trophy } from "lucide-react";
import {
  CROSSWORD_COLS,
  CROSSWORD_LEVEL_META,
  CROSSWORD_ROWS,
  buildCrosswordMeta,
  cellsForIndex,
  entriesForLevel,
  type CrosswordEntry,
} from "../games/crossword";

type Props = {
  level: number;
  onBack: () => void;
  onComplete?: (levelId: string) => void;
};

export function CrosswordGame({ level, onBack, onComplete }: Props) {
  const entries = useMemo(() => entriesForLevel(level), [level]);
  const meta = useMemo(() => buildCrosswordMeta(entries), [entries]);
  const levelInfo = CROSSWORD_LEVEL_META.find((m) => m.level === level);

  const [values, setValues] = useState<string[][]>(() =>
    Array.from({ length: CROSSWORD_ROWS }, () => Array(CROSSWORD_COLS).fill("")),
  );
  const [locked, setLocked] = useState<Set<string>>(() => new Set());
  const [completed, setCompleted] = useState<Set<number>>(() => new Set());
  const [activeEntry, setActiveEntry] = useState(0);
  const [selected, setSelected] = useState<{ row: number; col: number } | null>(null);
  const [message, setMessage] = useState("Fill each word. Correct answers lock in place.");
  const [errorEntry, setErrorEntry] = useState<number | null>(null);

  const progress = completed.size;
  const total = entries.length;
  const isPuzzleComplete = total > 0 && progress === total;

  // Reset board when level changes
  useEffect(() => {
    setValues(
      Array.from({ length: CROSSWORD_ROWS }, () => Array(CROSSWORD_COLS).fill("")),
    );
    setLocked(new Set());
    setCompleted(new Set());
    setActiveEntry(0);
    setSelected(null);
    setErrorEntry(null);
    setMessage("Fill each word. Correct answers lock in place.");
  }, [level]);

  const entryWord = useCallback(
    (index: number, board: string[][] = values) =>
      cellsForIndex(entries, index)
        .map((c) => board[c.row][c.col] || "")
        .join(""),
    [values, entries],
  );

  const entryIsComplete = useCallback(
    (index: number, board: string[][] = values) =>
      cellsForIndex(entries, index).every((c) => board[c.row][c.col]),
    [values, entries],
  );

  const nextEditable = useCallback(
    (index: number, fromOffset = -1, lockedSet = locked, completedSet = completed) => {
      const cells = cellsForIndex(entries, index);

      for (let i = fromOffset + 1; i < cells.length; i++) {
        if (!lockedSet.has(`${cells[i].row}:${cells[i].col}`)) {
          return cells[i];
        }
      }

      const ordered = entries
        .map((e, i) => ({ e, i }))
        .sort((a, b) => a.e.number - b.e.number);

      const pos = ordered.findIndex((o) => o.i === index);
      if (pos < 0) return null;

      for (let step = 1; step <= ordered.length; step++) {
        const cand = ordered[(pos + step) % ordered.length];
        if (completedSet.has(cand.i)) continue;

        const cell = cellsForIndex(entries, cand.i).find(
          (c) => !lockedSet.has(`${c.row}:${c.col}`),
        );
        if (cell) {
          setActiveEntry(cand.i);
          return cell;
        }
      }

      return null;
    },
    [locked, completed, entries],
  );

  const selectEntry = useCallback(
    (index: number, preferred?: { row: number; col: number } | null) => {
      setActiveEntry(index);
      const cells = cellsForIndex(entries, index);
      const cell =
        preferred || cells.find((c) => !locked.has(`${c.row}:${c.col}`)) || null;
      setSelected(cell);
      setErrorEntry(null);
      const e = entries[index];
      if (e) {
        setMessage(
          `${e.number} ${e.direction === "across" ? "Across" : "Down"} selected.`,
        );
      }
    },
    [entries, locked],
  );

  const selectCell = (row: number, col: number) => {
    const cell = meta[row]?.[col];
    if (!cell) return;

    const indexes = cell.entryIndexes;
    let index = indexes.includes(activeEntry) ? activeEntry : indexes[0];

    // Toggle across/down on same intersection cell
    if (
      selected &&
      selected.row === row &&
      selected.col === col &&
      indexes.length > 1
    ) {
      index = indexes[(indexes.indexOf(index) + 1) % indexes.length];
    }

    selectEntry(index, { row, col });

    if (locked.has(`${row}:${col}`)) {
      const offset = cellsForIndex(entries, index).findIndex(
        (c) => c.row === row && c.col === col,
      );
      setSelected(nextEditable(index, offset));
    }
  };

  /**
   * Lock an entry and mark it complete using functional setState
   * so Check-all / rapid solves don't lose progress to stale closures.
   */
  const completeEntry = useCallback(
    (index: number) => {
      const e = entries[index];
      if (!e) return false;

      const cells = cellsForIndex(entries, index);

      setLocked((prev) => {
        const next = new Set(prev);
        cells.forEach((c) => next.add(`${c.row}:${c.col}`));
        return next;
      });

      setCompleted((prev) => {
        if (prev.has(index)) return prev;
        const next = new Set(prev).add(index);
        const puzzleFinished = next.size === entries.length;

        // Side effects scheduled after state update path
        void Promise.resolve().then(() => {
          setErrorEntry(null);
          if (puzzleFinished) {
            setMessage("");
            setSelected(null);
            if (levelInfo) onComplete?.(levelInfo.id);
          } else {
            setMessage(
              `${e.number} ${e.direction === "across" ? "Across" : "Down"} is correct and locked.`,
            );
            setSelected(null);
          }
        });

        return next;
      });

      return true;
    },
    [entries, levelInfo, onComplete],
  );

  const validateEntry = useCallback(
    (index: number, board: string[][] = values, completedSet = completed) => {
      if (completedSet.has(index)) return true;

      const e = entries[index];
      if (!e) return false;

      if (!entryIsComplete(index, board)) {
        setMessage(
          `Fill all cells for ${e.number} ${
            e.direction === "across" ? "Across" : "Down"
          } before checking.`,
        );
        return false;
      }

      const correct =
        entryWord(index, board).toUpperCase() === e.answer.toUpperCase();

      if (!correct) {
        setErrorEntry(index);
        setMessage(
          `Not quite — check ${e.number} ${
            e.direction === "across" ? "Across" : "Down"
          }.`,
        );
        return false;
      }

      return completeEntry(index);
    },
    [values, completed, entries, entryIsComplete, entryWord, completeEntry],
  );

  const inputLetter = useCallback(
    (letter: string) => {
      if (!selected) return;

      let cell = selected;

      if (locked.has(`${cell.row}:${cell.col}`)) {
        const offset = cellsForIndex(entries, activeEntry).findIndex(
          (c) => c.row === cell.row && c.col === cell.col,
        );
        const next = nextEditable(activeEntry, offset);
        if (!next) {
          setSelected(null);
          return;
        }
        cell = next;
        setSelected(next);
      }

      const normalizedLetter = letter.toUpperCase();
      const cells = cellsForIndex(entries, activeEntry);
      const nextValues = values.map((row) => [...row]);
      nextValues[cell.row][cell.col] = normalizedLetter;
      setValues(nextValues);

      const offset = cells.findIndex((c) => c.row === cell.row && c.col === cell.col);

      if (offset === cells.length - 1) {
        const word = cells.map((c) => nextValues[c.row][c.col] || "").join("");
        const filled = cells.every((c) => nextValues[c.row][c.col]);

        if (filled && word.toUpperCase() === entries[activeEntry].answer.toUpperCase()) {
          completeEntry(activeEntry);
        } else if (filled) {
          setErrorEntry(activeEntry);
          const e = entries[activeEntry];
          setMessage(
            `Not quite — check ${e.number} ${
              e.direction === "across" ? "Across" : "Down"
            }.`,
          );
          setSelected(cell);
        } else {
          setSelected(nextEditable(activeEntry, offset));
        }
      } else {
        setSelected(nextEditable(activeEntry, offset));
      }
    },
    [selected, locked, entries, activeEntry, values, nextEditable, completeEntry],
  );

  const backspace = useCallback(() => {
    if (!selected) return;

    const cells = cellsForIndex(entries, activeEntry);
    const offset = cells.findIndex(
      (c) => c.row === selected.row && c.col === selected.col,
    );

    for (let i = offset; i >= 0; i--) {
      const c = cells[i];
      if (!locked.has(`${c.row}:${c.col}`)) {
        setValues((prev) => {
          const copy = prev.map((row) => [...row]);
          copy[c.row][c.col] = "";
          return copy;
        });
        setSelected(c);
        break;
      }
    }
  }, [selected, entries, activeEntry, locked]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        inputLetter(event.key);
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        if (!selected) return;
        const cells = cellsForIndex(entries, activeEntry);
        const offset = cells.findIndex(
          (c) => c.row === selected.row && c.col === selected.col,
        );
        const next = cells[offset + 1];
        if (next) {
          if (locked.has(`${next.row}:${next.col}`)) {
            setSelected(nextEditable(activeEntry, offset) || null);
          } else {
            setSelected(next);
          }
        }
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!selected) return;
        const cells = cellsForIndex(entries, activeEntry);
        const offset = cells.findIndex(
          (c) => c.row === selected.row && c.col === selected.col,
        );
        const prev = cells[offset - 1];
        if (prev) {
          if (locked.has(`${prev.row}:${prev.col}`)) {
            setSelected(nextEditable(activeEntry, offset - 2) || null);
          } else {
            setSelected(prev);
          }
        }
      }
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [inputLetter, backspace, selected, entries, activeEntry, locked, nextEditable]);

  const clearUnlocked = () => {
    setValues((prev) =>
      prev.map((row, r) =>
        row.map((value, c) => (locked.has(`${r}:${c}`) ? value : "")),
      ),
    );
    setErrorEntry(null);
    if (!isPuzzleComplete) {
      setMessage("Unlocked letters cleared. Correct words stay locked.");
    }
  };

  const checkAll = () => {
    // Snapshot board; complete each unfinished filled word using functional state
    const board = values;
    entries.forEach((_, index) => {
      if (completed.has(index)) return;
      if (!entryIsComplete(index, board)) return;
      const word = entryWord(index, board);
      if (word.toUpperCase() === entries[index].answer.toUpperCase()) {
        completeEntry(index);
      } else {
        setErrorEntry(index);
        const e = entries[index];
        setMessage(
          `Not quite — check ${e.number} ${
            e.direction === "across" ? "Across" : "Down"
          }.`,
        );
      }
    });
  };

  const across = entries
    .filter((e) => e.direction === "across")
    .sort((a, b) => a.number - b.number);
  const down = entries
    .filter((e) => e.direction === "down")
    .sort((a, b) => a.number - b.number);

  const activeCells = new Set(
    cellsForIndex(entries, activeEntry).map((c) => `${c.row}:${c.col}`),
  );

  if (entries.length === 0) {
    return (
      <div className="flex-1 p-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 mb-4"
        >
          <ArrowLeft size={16} /> Levels
        </button>
        <p className="text-slate-400">No puzzle data for this level.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft size={16} /> Levels
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold">Electronics Crossword</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {levelInfo?.title ?? `Level ${level}`} · {progress}/{total} solved
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={checkAll}
            disabled={isPuzzleComplete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium px-3 py-2 transition"
          >
            <Check size={14} /> Check
          </button>
          <button
            type="button"
            onClick={clearUnlocked}
            disabled={isPuzzleComplete}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed text-sm text-slate-300 px-3 py-2 hover:bg-[#1e293b]/50 transition"
          >
            <RotateCcw size={14} /> Clear
          </button>
        </div>
      </div>

      {!isPuzzleComplete && (
        <p className="text-sm text-slate-400 mb-4">{message}</p>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
        <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-3 sm:p-4 overflow-auto">
          <div
            className="grid gap-px bg-slate-800 mx-auto"
            style={{
              gridTemplateColumns: `repeat(${CROSSWORD_COLS}, minmax(0, 1fr))`,
              width: "min(100%, 560px)",
              aspectRatio: "1 / 1",
            }}
          >
            {meta.map((row, r) =>
              row.map((cell, c) => {
                if (!cell) {
                  return (
                    <div key={`${r}-${c}`} className="bg-[#0a0f1a] min-w-0 min-h-0" />
                  );
                }

                const key = `${r}:${c}`;
                const isSelected = selected?.row === r && selected?.col === c;
                const inWord = activeCells.has(key);
                const isLocked = locked.has(key);
                const isError =
                  errorEntry !== null &&
                  cellsForIndex(entries, errorEntry).some(
                    (x) => x.row === r && x.col === c,
                  );

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => selectCell(r, c)}
                    className={`relative min-w-0 min-h-0 flex items-center justify-center text-[10px] sm:text-xs font-semibold uppercase select-none transition
                      ${isLocked ? "bg-emerald-500/20 text-emerald-300" : "bg-white text-slate-900"}
                      ${isSelected ? "ring-2 ring-blue-500 z-[1]" : ""}
                      ${inWord && !isSelected ? "bg-blue-100" : ""}
                      ${isError && !isLocked ? "bg-rose-200" : ""}
                    `}
                  >
                    {cell.number != null && (
                      <span className="absolute top-0 left-0.5 text-[7px] sm:text-[8px] font-bold text-slate-500 leading-none">
                        {cell.number}
                      </span>
                    )}
                    {values[r][c]}
                  </button>
                );
              }),
            )}
          </div>
        </div>

        <div className="space-y-4">
          <ClueList
            title="Across"
            items={across}
            entries={entries}
            completed={completed}
            activeEntry={activeEntry}
            onSelect={selectEntry}
          />
          <ClueList
            title="Down"
            items={down}
            entries={entries}
            completed={completed}
            activeEntry={activeEntry}
            onSelect={selectEntry}
          />

          {isPuzzleComplete && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-3 text-emerald-300">
              <Trophy size={20} />
              <div>
                <div className="font-semibold text-sm">Puzzle complete!</div>
                <div className="text-xs text-emerald-400/80">
                  All {total} entries locked.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ClueList({
  title,
  items,
  entries,
  completed,
  activeEntry,
  onSelect,
}: {
  title: string;
  items: CrosswordEntry[];
  entries: CrosswordEntry[];
  completed: Set<number>;
  activeEntry: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="rounded-xl border border-[#1e293b] bg-[#111827] p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        {title}
      </div>
      <ul className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-thin">
        {items.map((e) => {
          const index = entries.indexOf(e);
          const done = completed.has(index);
          const active = activeEntry === index;

          return (
            <li key={`${title}-${e.number}`}>
              <button
                type="button"
                onClick={() => onSelect(index)}
                disabled={done}
                className={`w-full text-left rounded-lg px-2 py-1.5 text-sm transition ${
                  active
                    ? "bg-blue-600/20 text-blue-300"
                    : "text-slate-300 hover:bg-[#1e293b]/50"
                } ${done ? "opacity-70 line-through cursor-default" : ""}`}
              >
                <span className="font-semibold text-slate-400 mr-1.5">
                  {e.number}.
                </span>
                {e.clue}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default CrosswordGame;
