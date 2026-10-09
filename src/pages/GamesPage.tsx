import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircuitBoard,
  Gamepad2,
  Grid3X3,
  Lock,
  Play,
} from "lucide-react";
import {
  mountLogicGatesGame,
  unmountLogicGatesGame,
  LOGIC_GATES_LEVELS,
} from "../games/logic-gates-lab";
import { CROSSWORD_LEVEL_META, levelMetaToSelectCards } from "../games/crossword";
import { CrosswordGame } from "../games-lab/CrosswordGames";

/* ---------- Shared types ---------- */

type LevelDef = {
  id: string;
  title: string;
  difficulty: string;
  description: string;
};

/* ---------- Logic Gates simulator host ---------- */

function LogicGatesSimulator({
  levelIndex,
  onBack,
}: {
  levelIndex: number;
  onBack: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    mountLogicGatesGame(host, levelIndex, onBack);
    return () => {
      unmountLogicGatesGame(host);
    };
  }, [levelIndex, onBack]);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div
        ref={hostRef}
        id="logic-gates-react-host"
        className="flex-1 min-h-[560px] w-full"
      />
    </div>
  );
}

/* ---------- Level selection (diamond UI) ---------- */

const CROSSWORD_LEVELS: LevelDef[] = levelMetaToSelectCards();

const LOGIC_LEVELS: LevelDef[] = LOGIC_GATES_LEVELS.map((l) => ({
  id: l.id,
  title: l.title,
  difficulty: l.difficulty,
  description: l.description,
}));

const LEVELS_PER_PAGE = 4;

function loadProgress(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveProgress(key: string, set: Set<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function LevelSelectScreen({
  gameTitle,
  levels,
  progressKey,
  onBack,
  onPlay,
}: {
  gameTitle: string;
  levels: LevelDef[];
  progressKey: string;
  onBack: () => void;
  onPlay: (levelIndex: number) => void;
}) {
  const [cleared, setCleared] = useState<Set<string>>(() => loadProgress(progressKey));
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(0);

  const totalPages = Math.max(1, Math.ceil(levels.length / LEVELS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const start = safePage * LEVELS_PER_PAGE;
  const pageLevels = levels.slice(start, start + LEVELS_PER_PAGE);

  const isUnlocked = (index: number) => {
    if (index === 0) return true;
    const prev = levels[index - 1];
    return !!prev && cleared.has(prev.id);
  };

  useEffect(() => {
    if (selected < start || selected >= start + LEVELS_PER_PAGE) {
      const first = pageLevels.findIndex((_, i) => isUnlocked(start + i));
      if (first >= 0) setSelected(start + first);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safePage]);

  const selectedLevel = levels[selected];
  const canPlay = isUnlocked(selected);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id?: string } | undefined;
      if (detail?.id) {
        setCleared((prev) => {
          const next = new Set(prev).add(detail.id!);
          saveProgress(progressKey, next);
          return next;
        });
      }
    };
    window.addEventListener("zipelectro-level-cleared", handler);
    return () => window.removeEventListener("zipelectro-level-cleared", handler);
  }, [progressKey]);

  return (
    <div className="flex-1 overflow-hidden relative flex flex-col">
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            radial-gradient(ellipse at 50% 20%, rgba(0, 180, 255, 0.08) 0%, transparent 50%),
            linear-gradient(rgba(20, 40, 70, 0.12) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20, 40, 70, 0.12) 1px, transparent 1px)
          `,
          backgroundSize: "100% 100%, 28px 28px, 28px 28px",
        }}
      />

      <div className="relative z-10 flex flex-col items-center justify-center flex-1 px-4 py-8 min-h-0">
        <button
          type="button"
          onClick={onBack}
          className="absolute top-4 left-4 w-10 h-10 rounded-md bg-red-700 hover:bg-red-600 text-white flex items-center justify-center shadow-lg transition"
          title="Back"
        >
          <ArrowLeft size={20} />
        </button>

        <h1 className="text-xl sm:text-2xl font-extrabold tracking-[0.25em] text-white mb-10 text-center drop-shadow-[0_0_20px_rgba(0,200,255,0.35)]">
          LEVEL SELECTION
        </h1>
        <p className="text-xs text-slate-500 -mt-8 mb-8 uppercase tracking-widest">
          {gameTitle}
        </p>

        <div className="flex items-center justify-center gap-3 sm:gap-5 mb-5 w-full max-w-xl px-2">
          {/* Prev page */}
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="shrink-0 w-11 h-11 rounded-full border border-cyan-500/40 bg-[rgba(0,40,70,0.45)] text-cyan-300
              flex items-center justify-center transition
              hover:enabled:border-cyan-300 hover:enabled:bg-cyan-500/15 hover:enabled:shadow-[0_0_14px_rgba(0,180,255,0.35)]
              disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Previous levels"
          >
            <ChevronLeft size={22} />
          </button>

          <div className="flex items-center justify-center gap-5 sm:gap-7 flex-wrap flex-1 min-w-0">
            {pageLevels.map((lvl, i) => {
              const idx = start + i;
              const unlocked = isUnlocked(idx);
              const done = cleared.has(lvl.id);
              const isSelected = selected === idx;

              let border = "border-cyan-400/80 shadow-[0_0_16px_rgba(0,180,255,0.35)]";
              let numColor = "text-white";
              let bg = "bg-[rgba(0,40,70,0.45)]";

              if (!unlocked) {
                border = "border-slate-600/60 shadow-none opacity-75";
                bg = "bg-[rgba(15,25,40,0.6)]";
              } else if (isSelected) {
                border = "border-amber-400 shadow-[0_0_22px_rgba(255,180,0,0.55)]";
                numColor = "text-amber-400";
                bg = "bg-[rgba(80,50,0,0.5)]";
              } else if (done) {
                border = "border-emerald-400 shadow-[0_0_14px_rgba(0,255,102,0.35)]";
                numColor = "text-emerald-400";
              }

              return (
                <button
                  key={lvl.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => unlocked && setSelected(idx)}
                  className="flex flex-col items-center gap-2.5 group disabled:cursor-not-allowed"
                  aria-label={`Level ${idx + 1}`}
                >
                  <span
                    className={`w-[68px] h-[68px] sm:w-[72px] sm:h-[72px] flex items-center justify-center rotate-45 rounded-lg border-[3px] transition ${border} ${bg}
                      ${unlocked && !isSelected ? "group-hover:border-cyan-300 group-hover:scale-105" : ""}
                    `}
                  >
                    <span className={`-rotate-45 font-extrabold text-2xl leading-none ${numColor}`}>
                      {unlocked ? (
                        idx + 1
                      ) : (
                        <Lock size={22} className="text-slate-400" />
                      )}
                    </span>
                  </span>
                  <span
                    className={`block w-7 h-[3px] rounded-full ${
                      isSelected && unlocked
                        ? "bg-amber-400 shadow-[0_0_8px_rgba(255,180,0,0.6)]"
                        : "bg-cyan-500/25"
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Next page */}
          <button
            type="button"
            disabled={safePage >= totalPages - 1}
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            className="shrink-0 w-11 h-11 rounded-full border border-cyan-500/40 bg-[rgba(0,40,70,0.45)] text-cyan-300
              flex items-center justify-center transition
              hover:enabled:border-cyan-300 hover:enabled:bg-cyan-500/15 hover:enabled:shadow-[0_0_14px_rgba(0,180,255,0.35)]
              disabled:opacity-25 disabled:cursor-not-allowed"
            aria-label="Next levels"
          >
            <ChevronRight size={22} />
          </button>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="text-[10px] text-slate-500 tabular-nums tracking-wide">
              {safePage + 1} / {totalPages}
            </span>
            <div className="flex gap-2">
              {Array.from({ length: totalPages }, (_, p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  className={`w-2 h-2 rounded-full border transition ${
                    p === safePage
                      ? "bg-cyan-400 border-cyan-400 shadow-[0_0_8px_rgba(0,180,255,0.7)] scale-110"
                      : "bg-cyan-500/25 border-cyan-500/40 hover:bg-cyan-500/50"
                  }`}
                  aria-label={`Page ${p + 1}`}
                />
              ))}
            </div>
          </div>
        )}

        <div className="text-center max-w-md min-h-[72px] mb-6 px-2">
          {selectedLevel && (
            <>
              <div className="text-[10px] font-bold text-cyan-400 tracking-wider mb-1">
                {selectedLevel.difficulty}
              </div>
              <div className="text-sm font-bold text-white mb-1.5">
                {selectedLevel.title}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                {selectedLevel.description}
              </p>
            </>
          )}
        </div>

        <button
          type="button"
          disabled={!canPlay}
          onClick={() => canPlay && onPlay(selected)}
          className={`absolute bottom-5 right-5 sm:bottom-6 sm:right-6 px-8 py-3 text-sm font-extrabold tracking-widest text-amber-950
            bg-gradient-to-r from-amber-400 to-orange-500 rounded-sm
            shadow-[0_0_18px_rgba(255,160,0,0.45)]
            transition disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale
            hover:enabled:brightness-110 hover:enabled:-translate-y-0.5`}
          style={{
            clipPath:
              "polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)",
          }}
        >
          PLAY
        </button>
      </div>
    </div>
  );
}

/* ---------- Hub ---------- */

type GameId = "hub" | "crossword-levels" | "crossword-play" | "logic-levels" | "logic-play";

const GAMES = [
  {
    id: "crossword" as const,
    title: "Electronics Crossword",
    blurb:
      "Fill the grid with EE terms across ten progressive topics — basics through advanced theory.",
    meta: "10 levels",
    icon: Grid3X3,
    accent: "bg-violet-500/15 text-violet-400",
    view: "crossword-levels" as GameId,
  },
  {
    id: "logic-gates" as const,
    title: "Logic Gates Lab",
    blurb:
      "Build circuits on a 2D breadboard — drag gates, wire pins, watch live signals, and verify truth tables.",
    meta: "32 levels · full simulator",
    icon: CircuitBoard,
    accent: "bg-emerald-500/15 text-emerald-400",
    view: "logic-levels" as GameId,
  },
];

export function GamesPage() {
  const [view, setView] = useState<GameId>("hub");
  const [logicStartIndex, setLogicStartIndex] = useState(0);
  const [crosswordLevel, setCrosswordLevel] = useState(1);

  const markCrosswordCleared = (levelId: string) => {
    const set = loadProgress("zipelectro-crossword-progress");
    set.add(levelId);
    saveProgress("zipelectro-crossword-progress", set);
    window.dispatchEvent(
      new CustomEvent("zipelectro-level-cleared", { detail: { id: levelId } }),
    );
  };

  if (view === "crossword-levels") {
    return (
      <LevelSelectScreen
        gameTitle="Electronics Crossword"
        levels={CROSSWORD_LEVELS}
        progressKey="zipelectro-crossword-progress"
        onBack={() => setView("hub")}
        onPlay={(idx) => {
          const meta = CROSSWORD_LEVEL_META[idx];
          if (!meta) return;
          setCrosswordLevel(meta.level);
          setView("crossword-play");
        }}
      />
    );
  }

  if (view === "crossword-play") {
    return (
      <CrosswordGame
        level={crosswordLevel}
        onBack={() => setView("crossword-levels")}
        onComplete={markCrosswordCleared}
      />
    );
  }

  if (view === "logic-levels") {
    return (
      <LevelSelectScreen
        gameTitle="Logic Gates Lab — 2D Breadboard Simulator"
        levels={LOGIC_LEVELS}
        progressKey="zipelectro-logic-sim-progress"
        onBack={() => setView("hub")}
        onPlay={(idx) => {
          setLogicStartIndex(idx);
          setView("logic-play");
        }}
      />
    );
  }

  if (view === "logic-play") {
    return (
      <LogicGatesSimulator
        levelIndex={logicStartIndex}
        onBack={() => setView("logic-levels")}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-5">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
            <Gamepad2 size={18} />
          </div>
          <h1 className="text-xl font-semibold">Games</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5">
          Learn electronics through puzzles and challenges.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl">
        {GAMES.map((game) => {
          const Icon = game.icon;
          return (
            <div
              key={game.id}
              className="bg-[#111827] border border-[#1e293b] rounded-xl p-5 flex flex-col"
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${game.accent}`}
                >
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100">{game.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{game.meta}</div>
                </div>
              </div>
              <p className="text-sm text-slate-400 mt-3 flex-1">{game.blurb}</p>
              <button
                type="button"
                onClick={() => setView(game.view)}
                className="mt-4 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
              >
                <Play size={14} /> Play
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
