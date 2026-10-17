import { useState } from "react";
import {
  Cpu,
  Zap,
  Layers,
  ArrowRight,
  ArrowLeft,
  CircleDot,
  Power,
  Lightbulb,
  BookOpen,
  Brain,
  HelpCircle,
  RotateCcw,
  Check,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

/* ═══════════════════════════════════════════════════════════════════
   Component catalog — add new entries here as you create more pages
   ═══════════════════════════════════════════════════════════════════ */

type ComponentId =
  | "thyristor"
  | "decoder-encoder"
  | "karnaugh-maps"
  | "combinational-logic";
type DetailTab = "guide" | "flashcards" | "quiz";

const componentCatalog: {
  id: ComponentId;
  name: string;
  tagline: string;
  category: string;
  available: boolean;
}[] = [
  {
    id: "thyristor",
    name: "Thyristor",
    tagline: "P-N-P-N bistable power switch — SCR, TRIAC, DIAC & family",
    category: "Semiconductor",
    available: true,
  },
  {
    id: "decoder-encoder",
    name: "Decoder & Encoder",
    tagline: "n-to-2ⁿ decoders, encoders, enable, and multiplexers",
    category: "Digital Logic",
    available: true,
  },
  {
    id: "karnaugh-maps",
    name: "Karnaugh Maps",
    tagline: "Minimize Boolean functions with K-maps (SOP & POS)",
    category: "Digital Logic",
    available: true,
  },
  {
    id: "combinational-logic",
    name: "Combinational Logic",
    tagline: "Analysis & design of circuits with no memory / feedback",
    category: "Digital Logic",
    available: true,
  },
];

/* ═══════════════════════════════════════════════════════════════════
   SVG symbols
   ═══════════════════════════════════════════════════════════════════ */

function ScrSymbol({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 64" width={size} height={size * 1.3} className="text-current">
      <line x1="24" y1="2" x2="24" y2="16" stroke="currentColor" strokeWidth="2" />
      <path d="M12 16 L36 16 L24 40 Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="12" y1="40" x2="36" y2="40" stroke="currentColor" strokeWidth="2.5" />
      <line x1="24" y1="40" x2="24" y2="58" stroke="currentColor" strokeWidth="2" />
      <line x1="24" y1="28" x2="42" y2="28" stroke="currentColor" strokeWidth="2" />
      <line x1="42" y1="28" x2="42" y2="46" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

function ConstructionDiagram() {
  return (
    <svg viewBox="0 0 160 200" className="w-full max-w-[140px] h-auto text-current">
      <rect x="40" y="20" width="80" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="80" y="42" textAnchor="middle" fontSize="13" fill="currentColor">P</text>
      <rect x="40" y="56" width="80" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="80" y="78" textAnchor="middle" fontSize="13" fill="currentColor">N</text>
      <rect x="40" y="92" width="80" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="80" y="114" textAnchor="middle" fontSize="13" fill="currentColor">P</text>
      <rect x="40" y="128" width="80" height="36" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text x="80" y="150" textAnchor="middle" fontSize="13" fill="currentColor">N</text>
      <line x1="80" y1="4" x2="80" y2="20" stroke="currentColor" strokeWidth="1.5" />
      <text x="80" y="0" textAnchor="middle" fontSize="10" fill="currentColor">Anode (A)</text>
      <line x1="80" y1="164" x2="80" y2="180" stroke="currentColor" strokeWidth="1.5" />
      <text x="80" y="192" textAnchor="middle" fontSize="10" fill="currentColor">Cathode (K)</text>
      <line x1="120" y1="110" x2="148" y2="110" stroke="currentColor" strokeWidth="1.5" />
      <text x="152" y="113" fontSize="10" fill="currentColor">Gate (G)</text>
    </svg>
  );
}

function FamilySymbol({ type }: { type: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.6 };
  switch (type) {
    case "scr":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="12" {...common} />
          <path d="M10 12 L30 12 L20 30 Z" {...common} />
          <line x1="10" y1="30" x2="30" y2="30" {...common} strokeWidth={2} />
          <line x1="20" y1="30" x2="20" y2="44" {...common} />
          <line x1="20" y1="21" x2="34" y2="21" {...common} />
        </svg>
      );
    case "ujt":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="8" y1="8" x2="32" y2="8" {...common} />
          <line x1="8" y1="8" x2="8" y2="40" {...common} />
          <line x1="32" y1="8" x2="32" y2="40" {...common} />
          <line x1="20" y1="8" x2="20" y2="2" {...common} />
          <line x1="8" y1="28" x2="20" y2="20" {...common} />
          <circle cx="20" cy="20" r="2" fill="currentColor" />
        </svg>
      );
    case "scs":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="12" {...common} />
          <path d="M10 12 L30 12 L20 30 Z" {...common} />
          <line x1="10" y1="30" x2="30" y2="30" {...common} strokeWidth={2} />
          <line x1="20" y1="30" x2="20" y2="44" {...common} />
          <line x1="20" y1="18" x2="34" y2="12" {...common} />
          <line x1="20" y1="24" x2="34" y2="30" {...common} />
        </svg>
      );
    case "diac":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="14" {...common} />
          <path d="M10 14 L30 14 L20 26 Z" {...common} />
          <path d="M10 34 L30 34 L20 22 Z" {...common} />
          <line x1="20" y1="34" x2="20" y2="46" {...common} />
        </svg>
      );
    case "triac":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="12" {...common} />
          <path d="M10 12 L30 12 L20 24 Z" {...common} />
          <path d="M10 36 L30 36 L20 24 Z" {...common} />
          <line x1="20" y1="36" x2="20" y2="46" {...common} />
          <line x1="20" y1="24" x2="34" y2="30" {...common} />
        </svg>
      );
    case "put":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="12" {...common} />
          <circle cx="20" cy="24" r="12" {...common} />
          <line x1="20" y1="36" x2="20" y2="46" {...common} />
          <line x1="8" y1="24" x2="2" y2="24" {...common} />
          <path d="M14 18 L20 24 L14 30" {...common} />
        </svg>
      );
    case "shockley":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="14" {...common} />
          <path d="M10 14 L30 14 L20 30 Z" {...common} />
          <line x1="10" y1="30" x2="30" y2="30" {...common} strokeWidth={2} />
          <line x1="20" y1="30" x2="20" y2="46" {...common} />
        </svg>
      );
    case "gto":
      return (
        <svg viewBox="0 0 40 48" width="36" height="42">
          <line x1="20" y1="2" x2="20" y2="12" {...common} />
          <path d="M10 12 L30 12 L20 30 Z" {...common} />
          <line x1="10" y1="30" x2="30" y2="30" {...common} strokeWidth={2} />
          <line x1="20" y1="30" x2="20" y2="44" {...common} />
          <line x1="20" y1="21" x2="34" y2="21" {...common} />
          <path d="M30 21 L34 17 M30 21 L34 25" {...common} />
        </svg>
      );
    default:
      return null;
  }
}

/* ── Thyristor content data ──────────────────────────────────────── */

const family = [
  {
    id: "scr",
    letter: "a",
    name: "Silicon Controlled Rectifier (SCR)",
    desc: "A 4-layer (P-N-P-N), 3-terminal (Anode, Cathode, Gate) device used to control AC/DC power. Current flows in only one direction (unidirectional). Turned on by a small gate signal. Developed by Gordon Hall’s team and commercialized by Frank W. “Bill” Gutzwiller in 1957.",
  },
  {
    id: "ujt",
    letter: "b",
    name: "UJT (Unijunction Transistor)",
    desc: "A 3-terminal device with 1 Emitter (E) and 2 Bases (B₁, B₂). Acts as a voltage-controlled switch—mainly used in triggering circuits and relaxation oscillators.",
  },
  {
    id: "scs",
    letter: "c",
    name: "Silicon Controlled Switch (SCS)",
    desc: "Similar to an SCR but has two gate terminals (Anode Gate and Cathode Gate). Can be turned on or off from either gate—greater control flexibility.",
  },
  {
    id: "diac",
    letter: "d",
    name: "DIAC (Diode for Alternating Current)",
    desc: "A 2-terminal, 5-layer bidirectional switch. Conducts in both directions once breakover voltage is reached. Commonly used to trigger TRIACs. Formed by two SCRs in antiparallel.",
  },
  {
    id: "triac",
    letter: "e",
    name: "TRIAC (Triode for Alternating Current)",
    desc: "A 3-terminal bidirectional device—two SCRs in antiparallel with a shared gate. Controls current in both directions; ideal for AC regulation (light dimmers, motor speed control).",
  },
  {
    id: "put",
    letter: "f",
    name: "PUT (Programmable Unijunction Transistor)",
    desc: "A 4-layer thyristor that behaves like a UJT. Unlike a fixed UJT, its trigger voltage is set externally with two resistors on the gate.",
  },
  {
    id: "shockley",
    letter: "g",
    name: "Shockley Diode",
    desc: "A 4-layer (P-N-P-N), 2-terminal unidirectional device with no gate. Turns on automatically when forward voltage exceeds its fixed breakover voltage.",
  },
  {
    id: "gto",
    letter: "h",
    name: "GTO (Gate Turn-Off Switch)",
    desc: "A 4-layer, 3-terminal device. Turned ON with a positive gate pulse and turned OFF with a negative gate pulse. Current flows in one direction only.",
  },
];

const triggers = [
  { num: 1, title: "Gate Triggering", body: "Applying sufficient gate current to trigger the SCR. The most common and controlled method." },
  { num: 2, title: "Forward Voltage Triggering", body: "Raising the forward anode-to-cathode voltage until the SCR breaks over and turns ON." },
  { num: 3, title: "dv/dt Triggering", body: "A rapid change in anode-to-cathode voltage can cause unwanted triggering. Snubber circuits are used to prevent this." },
  { num: 4, title: "Light Triggering", body: "Light triggers a light-activated SCR (LASCR). Useful when galvanic isolation is required." },
];

const modes = [
  {
    title: "1. Reverse Blocking State (OFF)",
    color: "border-rose-500/40 bg-rose-500/5",
    bias: "J1 RB · J2 FB · J3 RB",
    points: [
      "Negative on Anode, positive on Cathode.",
      "Junctions J1 and J3 are reverse-biased → only tiny leakage current.",
      "Acts like an open switch blocking reverse current.",
    ],
  },
  {
    title: "2. Forward Blocking State (OFF, waiting)",
    color: "border-amber-500/40 bg-amber-500/5",
    bias: "J1 FB · J2 RB · J3 FB",
    points: [
      "Positive on Anode, negative on Cathode — gate not pulsed yet.",
      "J1 and J3 forward-biased; middle junction J2 stays reverse-biased (locked door).",
      "No main current flows until a gate pulse arrives.",
    ],
  },
  {
    title: "3. Forward Conducting State (ON)",
    color: "border-emerald-500/40 bg-emerald-500/5",
    bias: "J1 FB · J2 FB · J3 FB",
    points: [
      "A small gate current breaks down middle junction J2.",
      "All three junctions become forward-biased — the door swings open.",
      "High current flows freely; on-state voltage drop ≈ 1 V (Vₖ).",
    ],
  },
];

/* ── Flashcards ──────────────────────────────────────────────────── */

const thyristorFlashcards = [
  {
    front: "What is a thyristor?",
    back: "A solid-state semiconductor with four alternating P-N-P-N layers. It is a bistable switch: fully OFF or fully ON.",
  },
  {
    front: "Name the three terminals of an SCR.",
    back: "Anode (A), Cathode (K), and Gate (G).",
  },
  {
    front: "How does a thyristor differ from a BJT or MOSFET?",
    back: "A thyristor latches ON with a short gate pulse and stays ON without continuous gate current. BJTs/MOSFETs need continuous drive.",
  },
  {
    front: "What are the three modes of SCR operation?",
    back: "1) Reverse Blocking (OFF)\n2) Forward Blocking (OFF, waiting)\n3) Forward Conducting (ON)",
  },
  {
    front: "What is holding (latching) current?",
    back: "The minimum anode–cathode current needed to keep the SCR ON after the gate pulse is removed. Below this, it turns OFF.",
  },
  {
    front: "Natural vs forced commutation?",
    back: "Natural: AC current falls to zero each half-cycle (SCR turns OFF by itself).\nForced: External circuit drives current to zero (needed in DC).",
  },
  {
    front: "List four SCR triggering methods.",
    back: "1) Gate triggering\n2) Forward voltage triggering\n3) dv/dt triggering\n4) Light triggering",
  },
  {
    front: "SCR vs TRIAC — what’s the difference?",
    back: "SCR is unidirectional (one direction). TRIAC is bidirectional (both directions) — like two SCRs in antiparallel with a shared gate.",
  },
  {
    front: "What is a DIAC used for?",
    back: "A 2-terminal bidirectional breakover device, commonly used to trigger TRIACs in AC control circuits (e.g. dimmers).",
  },
  {
    front: "What can turn a GTO OFF that a normal SCR cannot?",
    back: "A negative gate pulse. Standard SCRs only turn OFF by commutation (current → 0).",
  },
];

/* ── Quiz ────────────────────────────────────────────────────────── */

const thyristorQuiz = [
  {
    q: "A thyristor is constructed from how many alternating semiconductor layers?",
    options: ["2 (P-N)", "3 (P-N-P)", "4 (P-N-P-N)", "5 (P-N-P-N-P)"],
    answer: 2,
  },
  {
    q: "Which terminal receives the small pulse that latches an SCR ON?",
    options: ["Anode", "Cathode", "Gate", "Base"],
    answer: 2,
  },
  {
    q: "In Forward Blocking mode, which junction stays reverse-biased?",
    options: ["J1", "J2", "J3", "All of them"],
    answer: 1,
  },
  {
    q: "Once an SCR is ON, it stays ON until…",
    options: [
      "The gate signal is removed",
      "Anode current falls below the holding current",
      "A negative voltage is applied to the gate",
      "Temperature drops below 25 °C",
    ],
    answer: 1,
  },
  {
    q: "Which device is bidirectional and ideal for AC light dimmers?",
    options: ["SCR", "Shockley diode", "TRIAC", "UJT"],
    answer: 2,
  },
  {
    q: "Natural commutation typically occurs in…",
    options: ["DC circuits only", "AC circuits", "Only with GTOs", "Only with light triggering"],
    answer: 1,
  },
  {
    q: "A DIAC is most often used to…",
    options: [
      "Amplify audio signals",
      "Trigger a TRIAC",
      "Regulate DC voltage",
      "Store charge like a capacitor",
    ],
    answer: 1,
  },
  {
    q: "Which thyristor can be turned OFF with a negative gate pulse?",
    options: ["Standard SCR", "Shockley diode", "GTO", "DIAC"],
    answer: 2,
  },
];

/* ═══════════════════════════════════════════════════════════════════
   Flashcards view
   ═══════════════════════════════════════════════════════════════════ */

function FlashcardsView({ cards }: { cards: { front: string; back: string }[] }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const card = cards[index];
  const go = (dir: -1 | 1) => {
    setFlipped(false);
    setIndex((i) => (i + dir + cards.length) % cards.length);
  };

  return (
    <div className="max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--app-muted)]">
          Card {index + 1} of {cards.length}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setFlipped(false);
          }}
          className="inline-flex items-center gap-1.5 text-xs text-[var(--app-muted)] hover:text-[var(--app-text)] transition"
        >
          <RotateCcw size={12} /> Restart
        </button>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="w-full min-h-[220px] rounded-2xl border border-[var(--app-border)] bg-[var(--app-control)] p-6 flex flex-col items-center justify-center text-center transition hover:border-blue-500/40 cursor-pointer"
      >
        <span className="text-[10px] uppercase tracking-wider text-[var(--app-muted)] mb-3">
          {flipped ? "Answer" : "Question"} · click to flip
        </span>
        <p className="text-sm font-medium text-[var(--app-heading)] whitespace-pre-line leading-relaxed">
          {flipped ? card.back : card.front}
        </p>
      </button>

      <div className="flex items-center justify-between mt-4 gap-3">
        <button
          type="button"
          onClick={() => go(-1)}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-sm px-3 py-2 rounded-lg transition"
        >
          <ArrowLeft size={14} /> Prev
        </button>
        <button
          type="button"
          onClick={() => setFlipped((f) => !f)}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg transition"
        >
          Flip
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="flex-1 inline-flex items-center justify-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-sm px-3 py-2 rounded-lg transition"
        >
          Next <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Quiz view
   ═══════════════════════════════════════════════════════════════════ */

function QuizView({
  questions,
}: {
  questions: { q: string; options: string[]; answer: number }[];
}) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => questions.map(() => null)
  );

  const q = questions[current];
  const locked = selected !== null;

  const pick = (i: number) => {
    if (locked) return;
    setSelected(i);
    setAnswers((prev) => {
      const next = [...prev];
      next[current] = i;
      return next;
    });
    if (i === q.answer) setScore((s) => s + 1);
  };

  const next = () => {
    if (current + 1 >= questions.length) {
      setDone(true);
    } else {
      setCurrent((c) => c + 1);
      setSelected(answers[current + 1]);
    }
  };

  const restart = () => {
    setCurrent(0);
    setSelected(null);
    setScore(0);
    setDone(false);
    setAnswers(questions.map(() => null));
  };

  if (done) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="max-w-md mx-auto w-full text-center">
        <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-control)] p-8">
          <div className="w-14 h-14 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center mx-auto mb-4">
            <Brain size={28} />
          </div>
          <h3 className="text-lg font-semibold text-[var(--app-heading)] mb-1">Quiz complete</h3>
          <p className="text-sm text-[var(--app-muted)] mb-4">
            You scored <strong className="text-[var(--app-text)]">{score}</strong> out of{" "}
            {questions.length} ({pct}%)
          </p>
          <div className="h-2 rounded-full bg-[var(--app-border)] overflow-hidden mb-6">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <button
            type="button"
            onClick={restart}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <RotateCcw size={14} /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto w-full">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[var(--app-muted)]">
          Question {current + 1} of {questions.length}
        </p>
        <p className="text-sm text-[var(--app-muted)]">
          Score: {score}
        </p>
      </div>

      <div className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 mb-4">
        <p className="text-sm font-medium text-[var(--app-heading)] leading-relaxed">{q.q}</p>
      </div>

      <div className="space-y-2 mb-4">
        {q.options.map((opt, i) => {
          let style =
            "border-[var(--app-border)] bg-[var(--app-control)] hover:border-blue-500/40";
          if (locked) {
            if (i === q.answer) style = "border-emerald-500/60 bg-emerald-500/10";
            else if (i === selected) style = "border-rose-500/60 bg-rose-500/10";
            else style = "border-[var(--app-border)] bg-[var(--app-control)] opacity-60";
          } else if (selected === i) {
            style = "border-blue-500 bg-blue-500/10";
          }
          return (
            <button
              key={i}
              type="button"
              onClick={() => pick(i)}
              disabled={locked}
              className={`w-full text-left rounded-xl border px-4 py-3 text-sm transition flex items-center gap-3 ${style}`}
            >
              <span className="w-6 h-6 rounded-full border border-current flex items-center justify-center text-xs flex-shrink-0">
                {locked && i === q.answer ? (
                  <Check size={12} className="text-emerald-400" />
                ) : locked && i === selected ? (
                  <X size={12} className="text-rose-400" />
                ) : (
                  String.fromCharCode(65 + i)
                )}
              </span>
              <span className="text-[var(--app-text)]">{opt}</span>
            </button>
          );
        })}
      </div>

      {locked && (
        <button
          type="button"
          onClick={next}
          className="w-full inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition"
        >
          {current + 1 >= questions.length ? "See results" : "Next question"}
          <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Guide content (thyristor)
   ═══════════════════════════════════════════════════════════════════ */

function ThyristorGuide({ onGoPractice }: { onGoPractice: (tab: DetailTab) => void }) {
  const navigate = useNavigate();

  return (
    <>
      <div className="mb-8">
        <p className="text-sm text-[var(--app-muted)] leading-relaxed max-w-3xl">
          A solid-state semiconductor device built from four alternating layers of
          P-type and N-type silicon (P-N-P-N). It acts as a high-speed bistable
          switch—strictly either fully OFF or fully ON.
        </p>
      </div>

      <section className="mb-8 rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5">
        <h2 className="text-sm font-semibold text-[var(--app-heading)] mb-4 flex items-center gap-2">
          <Layers size={16} className="text-blue-400" />
          Basic construction & terminals
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 items-center">
          <div className="flex flex-col items-center gap-2">
            <ConstructionDiagram />
            <span className="text-xs text-[var(--app-muted)]">Basic Construction</span>
          </div>
          <div className="flex flex-col items-center gap-2 text-[var(--app-text)]">
            <ScrSymbol size={64} />
            <span className="text-xs text-[var(--app-muted)]">Schematic Symbol</span>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
              <div className="text-xs font-semibold text-emerald-400">Anode (A)</div>
              <p className="text-xs text-[var(--app-muted)] mt-0.5">Top main terminal — current enters here.</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
              <div className="text-xs font-semibold text-amber-400">Gate (G)</div>
              <p className="text-xs text-[var(--app-muted)] mt-0.5">Trigger terminal — a small pulse latches the device ON.</p>
            </div>
            <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-bg)] p-3">
              <div className="text-xs font-semibold text-rose-400">Cathode (K)</div>
              <p className="text-xs text-[var(--app-muted)] mt-0.5">Bottom main terminal — current leaves here.</p>
            </div>
          </div>
        </div>
        <p className="text-xs text-[var(--app-muted)] mt-5 leading-relaxed">
          Four layers create three junctions (J1, J2, J3). Unlike a BJT or MOSFET
          that needs continuous drive, a thyristor{" "}
          <strong className="text-[var(--app-text)]">latches</strong>: a tiny gate
          pulse turns it ON and it stays ON until the main current falls below the
          holding current.
        </p>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">
          Why the thyristor was invented
        </h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm text-[var(--app-text)] leading-relaxed space-y-3">
          <p>
            Before the mid-1950s, controlling large electrical power required
            bulky, inefficient mechanical relays, contactors, or fragile vacuum
            tubes (mercury-arc rectifiers and thyratrons). Vacuum tubes could
            switch high voltages but generated immense heat, degraded rapidly,
            and needed huge enclosures.
          </p>
          <p>
            Early BJTs also struggled at extreme power levels. Bell Labs and
            General Electric developed the thyristor (commercialized in 1957) as
            a solid-state power switch that could handle hundreds or thousands of
            volts and amperes in a device small enough to hold in your hand.
          </p>
          <p>
            Because it latches, the control circuit only needs a short pulse—not
            continuous drive current—dramatically reducing the energy required by
            the gate circuitry.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">
          Family of thyristors
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {family.map((item) => (
            <div key={item.id} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  <span className="w-7 h-7 rounded-md bg-blue-500/15 text-blue-400 text-xs font-bold flex items-center justify-center">
                    {item.letter}
                  </span>
                  <div className="text-[var(--app-muted)]">
                    <FamilySymbol type={item.id} />
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-[var(--app-heading)]">{item.name}</h3>
                  <p className="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">
          Three modes of SCR operation
        </h2>
        <div className="mb-4 overflow-x-auto rounded-xl border border-[var(--app-border)]">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[var(--app-control)] text-[var(--app-muted)]">
                <th className="px-4 py-2.5 font-medium">Mode</th>
                <th className="px-4 py-2.5 font-medium text-center">J1</th>
                <th className="px-4 py-2.5 font-medium text-center">J2</th>
                <th className="px-4 py-2.5 font-medium text-center">J3</th>
              </tr>
            </thead>
            <tbody className="text-[var(--app-text)]">
              <tr className="border-t border-[var(--app-border)]">
                <td className="px-4 py-2.5">Reverse Blocking</td>
                <td className="px-4 py-2.5 text-center text-rose-400 font-medium">RB</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-medium">FB</td>
                <td className="px-4 py-2.5 text-center text-rose-400 font-medium">RB</td>
              </tr>
              <tr className="border-t border-[var(--app-border)] bg-[var(--app-control)]/40">
                <td className="px-4 py-2.5">Forward Blocking</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-medium">FB</td>
                <td className="px-4 py-2.5 text-center text-rose-400 font-medium">RB</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-medium">FB</td>
              </tr>
              <tr className="border-t border-[var(--app-border)]">
                <td className="px-4 py-2.5">Forward Conducting</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-medium">FB</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-medium">FB</td>
                <td className="px-4 py-2.5 text-center text-emerald-400 font-medium">FB</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          {modes.map((m) => (
            <div key={m.title} className={`rounded-xl border p-4 ${m.color}`}>
              <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                <h3 className="text-sm font-semibold text-[var(--app-heading)]">{m.title}</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/20 text-[var(--app-muted)]">
                  {m.bias}
                </span>
              </div>
              <ul className="space-y-1.5">
                {m.points.map((p) => (
                  <li key={p} className="text-xs text-[var(--app-text)] flex gap-2">
                    <CircleDot size={12} className="mt-0.5 flex-shrink-0 text-[var(--app-muted)]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
          <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-2 flex items-center gap-2">
            <Power size={15} className="text-blue-400" />
            Latching / Holding / Knee current
          </h3>
          <p className="text-xs text-[var(--app-muted)] leading-relaxed">
            The minimum main current required through Anode and Cathode to keep
            the SCR turned ON immediately after the gate trigger is removed. If
            anode current falls below this value, the SCR returns to the blocking
            state.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">
          How to turn an SCR OFF
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">1. Natural commutation</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              Occurs naturally in AC circuits. When the AC current reaches zero,
              SCR current falls below the holding current. The device turns OFF
              and becomes reverse-biased during the next half-cycle.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">2. Forced commutation</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              Used mainly in DC circuits where current does not naturally reach
              zero. An external commutation circuit forces the SCR current to
              zero or applies reverse voltage, turning the device OFF.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">
          Triggering methods
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {triggers.map((t) => (
            <div key={t.num} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4 flex gap-3">
              <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                {t.num}
              </span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-heading)]">{t.title}</h3>
                <p className="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{t.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">
          Characteristic curve (V–I)
        </h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-xs text-[var(--app-muted)] leading-relaxed space-y-2">
          <p>
            <strong className="text-[var(--app-text)]">Reverse region (left):</strong>{" "}
            SCR blocks reverse current until voltage reaches the breakdown
            voltage V<sub>BR</sub>—beyond which the device can be damaged.
          </p>
          <p>
            <strong className="text-[var(--app-text)]">Forward leakage (bottom right):</strong>{" "}
            Device is in Forward Blocking; current is nearly zero while waiting
            for a gate pulse.
          </p>
          <p>
            <strong className="text-[var(--app-text)]">
              “S-curve” jumps (I<sub>g1</sub>, I<sub>g2</sub>, I<sub>g3</sub>):
            </strong>{" "}
            Applying gate current breaks through J2. Higher gate current
            (I<sub>g1</sub> &gt; I<sub>g2</sub> &gt; I<sub>g3</sub>) triggers the
            SCR at lower anode voltages.
          </p>
          <p>
            <strong className="text-[var(--app-text)]">Forward conduction (steep vertical):</strong>{" "}
            Once ON, voltage drops to ≈ 1 V and maximum anode current I<sub>a</sub>{" "}
            flows with minimal resistance.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3 flex items-center gap-2">
          <Lightbulb size={14} />
          Practice problems
        </h2>
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Half-wave controlled rectifier</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              A thyristor half-wave controlled converter has a supply of 240 V at
              50 Hz and a load resistance of 100 Ω. When the firing delay is
              140°, find the average load voltage and current.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Full-wave half-controlled bridge</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              A full-wave half-controlled bridge has a supply of 220 V at 50 Hz.
              Firing angle delay is 90°. Determine average and rms currents, load
              power, and power factor for a resistive load R = 100 Ω.
            </p>
          </div>
        </div>
      </section>

      {/* After reading — practice CTAs */}
      <section className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
        <h2 className="text-sm font-semibold text-[var(--app-heading)] mb-1">
          Reinforce what you learned
        </h2>
        <p className="text-xs text-[var(--app-muted)] mb-4">
          Use flashcards to review key terms, then take the quiz to check understanding.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => onGoPractice("flashcards")}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <BookOpen size={16} />
            Flashcards
          </button>
          <button
            type="button"
            onClick={() => onGoPractice("quiz")}
            className="inline-flex items-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[var(--app-text)] text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            <HelpCircle size={16} />
            Take quiz
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-3 pb-4">
        <button
          type="button"
          onClick={() => navigate("/components")}
          className="inline-flex items-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[var(--app-text)] text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Cpu size={16} />
          Component Library
        </button>
        <button
          type="button"
          onClick={() => navigate("/editor/dc-motor")}
          className="inline-flex items-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[var(--app-text)] text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          Try SCR motor lab
          <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Detail shell — header + tabs + content
   ═══════════════════════════════════════════════════════════════════ */

function ThyristorDetail({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>("guide");

  const tabs: { id: DetailTab; label: string; icon: typeof BookOpen }[] = [
    { id: "guide", label: "Guide", icon: BookOpen },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "quiz", label: "Quiz", icon: HelpCircle },
  ];

  return (
    <div className="max-w-5xl mx-auto w-full">
      {/* Top bar: back + title + tab buttons */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm text-[var(--app-muted)] hover:text-[var(--app-text)] transition flex-shrink-0"
          >
            <ArrowLeft size={16} />
            All
          </button>
          <div className="w-px h-5 bg-[var(--app-border)] flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center flex-shrink-0">
              <Zap size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-muted)] leading-none">
                About · 01
              </p>
              <h1 className="text-base font-semibold text-[var(--app-heading)] truncate">
                Thyristor
              </h1>
            </div>
          </div>
        </div>

        {/* Tab buttons — top right */}
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control)]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${
                tab === t.id
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover)]"
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "guide" && <ThyristorGuide onGoPractice={setTab} />}
      {tab === "flashcards" && <FlashcardsView cards={thyristorFlashcards} />}
      {tab === "quiz" && <QuizView questions={thyristorQuiz} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Catalog landing
   ═══════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════
   Decoder & Encoder
   ═══════════════════════════════════════════════════════════════════ */

const decoderFlashcards = [
  { front: "What is decoding?", back: "Conversion of an n-bit input code to an m-bit output code (n ≤ m ≤ 2ⁿ) so each valid codeword produces a unique output." },
  { front: "How many outputs does an n-input binary decoder have?", back: "2ⁿ outputs. Exactly one output is active (1) for any given input combination." },
  { front: "What does a decoder generate?", back: "All minterms of the n input variables. Each output corresponds to one minterm." },
  { front: "What is the Enable input for?", back: "When Enable = 0, all outputs are forced inactive (0). When Enable = 1, the decoder works normally. Used for expansion and chip select." },
  { front: "Decoder vs Encoder?", back: "Decoder: n inputs → 2ⁿ outputs (one-hot). Encoder: 2ⁿ inputs → n outputs (binary of the active input). They are inverse operations." },
  { front: "2-to-4 decoder equations (active-high)", back: "Y₀ = Ī₁ Ī₀\nY₁ = Ī₁ I₀\nY₂ = I₁ Ī₀\nY₃ = I₁ I₀" },
  { front: "What is a multiplexer (MUX)?", back: "A device that selects one of many data inputs and routes it to a single output, controlled by select lines. 2ⁿ data inputs need n select bits." },
  { front: "How can you implement logic with a decoder?", back: "OR (or NAND for active-low) the decoder outputs that correspond to the minterms of the function (e.g. full-adder sum and carry)." },
];

const decoderQuiz = [
  { q: "A binary decoder with 3 inputs has how many outputs?", options: ["3", "6", "8", "9"], answer: 2 },
  { q: "In a binary decoder, how many outputs are active at once?", options: ["All of them", "Exactly one", "None", "Half of them"], answer: 1 },
  { q: "An encoder performs the ______ of a decoder.", options: ["same function", "inverse operation", "complement only", "delay"], answer: 1 },
  { q: "When Enable = 0 on a decoder with enable…", options: ["One output is still active", "All outputs are inactive (0)", "It acts as an encoder", "Outputs float"], answer: 1 },
  { q: "A 4-to-1 MUX needs how many select lines?", options: ["1", "2", "4", "8"], answer: 1 },
  { q: "Decoder outputs correspond to…", options: ["Maxterms only", "Minterms of the inputs", "Parity bits", "Clock edges"], answer: 1 },
];

function DecoderEncoderGuide({ onGoPractice }: { onGoPractice: (tab: DetailTab) => void }) {
  return (
    <>
      <p className="text-sm text-[var(--app-muted)] leading-relaxed max-w-3xl mb-8">
        Decoders extract information from a binary code; encoders put information into a code.
        Together with multiplexers, they are the core building blocks of digital selection and addressing.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Decoder definition</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-3 text-[var(--app-text)] leading-relaxed">
          <p>
            <strong>Decoding</strong> converts an <em>n</em>-bit input code into an <em>m</em>-bit output code
            with <span className="font-mono text-xs">n ≤ m ≤ 2ⁿ</span>, so each valid codeword produces a unique output.
          </p>
          <p>A <strong>binary decoder</strong> is a black box with <em>n</em> inputs and <strong>2ⁿ</strong> outputs. Exactly one output is 1 for any given input.</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Binary decoder behaviour</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-2 text-[var(--app-text)]">
          <ul className="space-y-2 text-xs text-[var(--app-muted)]">
            <li className="flex gap-2"><CircleDot size={12} className="mt-0.5 flex-shrink-0" /><span>Selects one of 2ⁿ outputs by decoding the binary value on the N inputs.</span></li>
            <li className="flex gap-2"><CircleDot size={12} className="mt-0.5 flex-shrink-0" /><span>Generates <strong className="text-[var(--app-text)]">all minterms</strong> of the N input variables.</span></li>
            <li className="flex gap-2"><CircleDot size={12} className="mt-0.5 flex-shrink-0" /><span>Exactly one output is <em>active</em> for each input combination.</span></li>
          </ul>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">2-to-4 line decoder</h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--app-border)] mb-3">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-[var(--app-control)] text-[var(--app-muted)]">
                <th className="px-3 py-2">I₁</th><th className="px-3 py-2">I₀</th>
                <th className="px-3 py-2 text-center">Y₃</th><th className="px-3 py-2 text-center">Y₂</th>
                <th className="px-3 py-2 text-center">Y₁</th><th className="px-3 py-2 text-center">Y₀</th>
              </tr>
            </thead>
            <tbody className="text-[var(--app-text)]">
              <tr className="border-t border-[var(--app-border)]"><td className="px-3 py-2">0</td><td className="px-3 py-2">0</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center text-emerald-400 font-medium">1</td></tr>
              <tr className="border-t border-[var(--app-border)] bg-[var(--app-control)]/40"><td className="px-3 py-2">0</td><td className="px-3 py-2">1</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center text-emerald-400 font-medium">1</td><td className="px-3 py-2 text-center">0</td></tr>
              <tr className="border-t border-[var(--app-border)]"><td className="px-3 py-2">1</td><td className="px-3 py-2">0</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center text-emerald-400 font-medium">1</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center">0</td></tr>
              <tr className="border-t border-[var(--app-border)] bg-[var(--app-control)]/40"><td className="px-3 py-2">1</td><td className="px-3 py-2">1</td><td className="px-3 py-2 text-center text-emerald-400 font-medium">1</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center">0</td><td className="px-3 py-2 text-center">0</td></tr>
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4 text-xs font-mono text-[var(--app-muted)] space-y-1">
          <div>Y₃ = I₁ · I₀</div>
          <div>Y₂ = I₁ · Ī₀</div>
          <div>Y₁ = Ī₁ · I₀</div>
          <div>Y₀ = Ī₁ · Ī₀</div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Enable & expansion</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-3 text-[var(--app-text)] leading-relaxed">
          <p>
            An <strong>Enable</strong> pin gates the whole decoder. When E = 0, all outputs stay 0 regardless of inputs.
            When E = 1, normal decoding occurs.
          </p>
          <p className="text-xs text-[var(--app-muted)]">
            Two 2-to-4 decoders + one enable polarity can build a 3-to-8 decoder: the MSB drives one chip’s enable
            and the inverted MSB drives the other.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Encoders</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-3 text-[var(--app-text)] leading-relaxed">
          <p>
            An encoder has <strong>2ⁿ inputs</strong> and <strong>n outputs</strong>. It outputs the binary number of
            the active input — the inverse of a decoder.
          </p>
          <p className="text-xs text-[var(--app-muted)]">
            Issues: what if more than one input is active? (priority encoder) What if none are active? (valid flag).
          </p>
          <p className="text-xs font-mono text-[var(--app-muted)]">
            8-to-3 example: Y₂ = I₇+I₆+I₅+I₄ · Y₁ = I₇+I₆+I₃+I₂ · Y₀ = I₇+I₅+I₃+I₁
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Multiplexers (MUX)</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-3 text-[var(--app-text)] leading-relaxed">
          <p>
            A MUX selects one of many data inputs using select lines. A 2-to-1 MUX has select S; a 4-to-1 has S₁S₀.
          </p>
          <p className="text-xs text-[var(--app-muted)]">
            You can implement any Boolean function with a MUX by tying data inputs to 0, 1, or a remaining variable
            according to the truth table rows.
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
        <h2 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Reinforce what you learned</h2>
        <p className="text-xs text-[var(--app-muted)] mb-4">Review terms, then take the quiz.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onGoPractice("flashcards")} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            <BookOpen size={16} /> Flashcards
          </button>
          <button type="button" onClick={() => onGoPractice("quiz")} className="inline-flex items-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[var(--app-text)] text-sm font-medium px-4 py-2 rounded-lg transition">
            <HelpCircle size={16} /> Take quiz
          </button>
        </div>
      </section>
    </>
  );
}

function DecoderEncoderDetail({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>("guide");
  const tabs: { id: DetailTab; label: string; icon: typeof BookOpen }[] = [
    { id: "guide", label: "Guide", icon: BookOpen },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "quiz", label: "Quiz", icon: HelpCircle },
  ];
  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--app-muted)] hover:text-[var(--app-text)] transition flex-shrink-0">
            <ArrowLeft size={16} /> All
          </button>
          <div className="w-px h-5 bg-[var(--app-border)] flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center flex-shrink-0">
              <Cpu size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-muted)] leading-none">About · Digital</p>
              <h1 className="text-base font-semibold text-[var(--app-heading)] truncate">Decoder & Encoder</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control)]">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === t.id ? "bg-blue-600 text-white shadow-sm" : "text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover)]"}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "guide" && <DecoderEncoderGuide onGoPractice={setTab} />}
      {tab === "flashcards" && <FlashcardsView cards={decoderFlashcards} />}
      {tab === "quiz" && <QuizView questions={decoderQuiz} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Karnaugh Maps
   ═══════════════════════════════════════════════════════════════════ */

const kmapFlashcards = [
  { front: "Why use a Karnaugh map?", back: "Algebraic minimization is hard to do systematically and hard to know when you’re done. A K-map minimizes functions of up to ~6 variables visually." },
  { front: "What is a minimum SOP?", back: "Sum-of-products with the fewest terms (gates) and fewest literals (inputs). Each term is a prime implicant. It may not be unique." },
  { front: "How are cells labeled on a K-map?", back: "In Gray code order so adjacent cells differ by only one bit (e.g. BC: 00, 01, 11, 10)." },
  { front: "How do you group 1s?", back: "In rectangles of size 1, 2, 4, 8… (powers of 2). Larger groups eliminate more variables. Groups may wrap around edges/corners." },
  { front: "What is a prime implicant?", back: "An implicant (group of 1s) that cannot be combined further to eliminate another literal." },
  { front: "What is an essential prime implicant?", back: "A prime implicant that is the only one covering some 1. All essential primes must appear in the minimum expression." },
  { front: "How do don’t-cares (X) work?", back: "Treat an X as 1 if it helps make a larger group; otherwise leave it. Don’t-cares never force you to cover them." },
  { front: "How do you get minimum POS from a K-map?", back: "Group the 0s to form a simplified expression for F′, then De Morgan / complement to get the product-of-sums for F." },
];

const kmapQuiz = [
  { q: "K-maps are best for minimizing functions of up to about how many variables?", options: ["2", "4", "6", "12"], answer: 2 },
  { q: "Adjacent cells on a K-map differ in how many bits?", options: ["0", "1", "2", "All"], answer: 1 },
  { q: "Valid group sizes are…", options: ["Any size", "Powers of 2 (1,2,4,8…)", "Only 2 or 4", "Odd numbers only"], answer: 1 },
  { q: "A prime implicant is…", options: ["Any single 1", "A group that cannot be combined further", "Always essential", "Only size 1"], answer: 1 },
  { q: "Don’t-care cells should be…", options: ["Always covered as 1", "Always left as 0", "Covered only if they help", "Ignored forever"], answer: 2 },
  { q: "To get a minimum POS you typically group the…", options: ["1s", "0s", "Don’t-cares only", "Diagonal cells"], answer: 1 },
];

function KarnaughMapsGuide({ onGoPractice }: { onGoPractice: (tab: DetailTab) => void }) {
  return (
    <>
      <p className="text-sm text-[var(--app-muted)] leading-relaxed max-w-3xl mb-8">
        Karnaugh maps turn Boolean minimization into a visual puzzle: place minterms, circle the largest valid groups of 1s, and read off the simplest sum-of-products (or product-of-sums).
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Why K-maps?</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-2 text-[var(--app-text)] leading-relaxed">
          <p>Algebraic simplification is hard to do systematically and you often can’t tell when you’ve reached a minimum.</p>
          <p className="text-xs text-[var(--app-muted)]">K-maps handle up to about 6 variables and map directly onto two-level AND–OR (SOP) or OR–AND (POS) networks.</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Minimum SOP</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-xs space-y-2 text-[var(--app-muted)]">
          <p>• Minimum number of <strong className="text-[var(--app-text)]">terms</strong> → fewer gates</p>
          <p>• Minimum number of <strong className="text-[var(--app-text)]">literals</strong> → fewer inputs per gate</p>
          <p>• Every term is a <strong className="text-[var(--app-text)]">prime implicant</strong> (cannot be combined further)</p>
          <p>• Solution may not be unique — depends on grouping order</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">How to use a K-map</h2>
        <div className="space-y-3">
          {[
            { n: "1", t: "Fill the map", d: "Put 1s (and 0s / X don’t-cares) from the truth table. Cell order uses Gray code so neighbors differ by one bit." },
            { n: "2", t: "Group the 1s", d: "Circle rectangles of size 1, 2, 4, 8… Groups may wrap around edges and corners. Prefer largest groups." },
            { n: "3", t: "Read each group", d: "Variables that change inside a group are eliminated. Variables that stay constant appear in the product term (true or complemented)." },
            { n: "4", t: "Write the SOP", d: "OR all the product terms together. Include every essential prime implicant." },
          ].map((s) => (
            <div key={s.n} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4 flex gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{s.n}</span>
              <div>
                <h3 className="text-sm font-semibold text-[var(--app-heading)]">{s.t}</h3>
                <p className="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{s.d}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Worked example</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-2 text-[var(--app-text)]">
          <p className="font-mono text-xs">F(a,b,c) = Σm(1,3,5)</p>
          <p className="text-xs text-[var(--app-muted)] leading-relaxed">
            Plot 1s at cells 1, 3, 5. Group {"{1,3}"} → a′c and {"{1,5}"} → b′c.
            Result: <strong className="text-[var(--app-text)] font-mono">F = a′c + b′c</strong>
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Key definitions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { t: "Implicant", d: "Any single 1 or any valid group of 1s on the map." },
            { t: "Prime implicant", d: "An implicant that cannot be combined further to drop a literal." },
            { t: "Essential PI", d: "A prime that is the only one covering some 1 — must be included." },
          ].map((x) => (
            <div key={x.t} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
              <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">{x.t}</h3>
              <p className="text-xs text-[var(--app-muted)] leading-relaxed">{x.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
        <h2 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Reinforce what you learned</h2>
        <p className="text-xs text-[var(--app-muted)] mb-4">Drill the rules, then quiz yourself.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onGoPractice("flashcards")} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            <BookOpen size={16} /> Flashcards
          </button>
          <button type="button" onClick={() => onGoPractice("quiz")} className="inline-flex items-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[var(--app-text)] text-sm font-medium px-4 py-2 rounded-lg transition">
            <HelpCircle size={16} /> Take quiz
          </button>
        </div>
      </section>
    </>
  );
}

function KarnaughMapsDetail({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>("guide");
  const tabs: { id: DetailTab; label: string; icon: typeof BookOpen }[] = [
    { id: "guide", label: "Guide", icon: BookOpen },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "quiz", label: "Quiz", icon: HelpCircle },
  ];
  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--app-muted)] hover:text-[var(--app-text)] transition flex-shrink-0">
            <ArrowLeft size={16} /> All
          </button>
          <div className="w-px h-5 bg-[var(--app-border)] flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center flex-shrink-0">
              <Layers size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-muted)] leading-none">About · Digital</p>
              <h1 className="text-base font-semibold text-[var(--app-heading)] truncate">Karnaugh Maps</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control)]">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === t.id ? "bg-blue-600 text-white shadow-sm" : "text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover)]"}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "guide" && <KarnaughMapsGuide onGoPractice={setTab} />}
      {tab === "flashcards" && <FlashcardsView cards={kmapFlashcards} />}
      {tab === "quiz" && <QuizView questions={kmapQuiz} />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Combinational Logic
   ═══════════════════════════════════════════════════════════════════ */

const comboFlashcards = [
  { front: "What is a combinational circuit?", back: "A circuit whose outputs depend only on current inputs — no memory, no feedback loops." },
  { front: "Analysis vs design?", back: "Analysis: given a circuit → find Boolean function / truth table.\nDesign: given a function / truth table → build the circuit." },
  { front: "Two analysis approaches?", back: "1) Boolean expression: label intermediate nets, write gate equations, simplify.\n2) Truth table: apply every input combination and record outputs." },
  { front: "Typical design steps?", back: "1) Count inputs & outputs\n2) Build truth table from the problem\n3) Get simplified Boolean expressions (K-map or algebra)\n4) Draw the gate circuit" },
  { front: "What happens when inputs change?", back: "Outputs may change after a propagation delay through the gates — but there is still no stored state." },
  { front: "Example design: BCD to Excess-3", back: "4 inputs (BCD digit) → 4 outputs (Excess-3 code). Truth table for 0–9, don’t-cares for 10–15, then minimize each output." },
];

const comboQuiz = [
  { q: "Combinational circuits have…", options: ["Feedback and memory", "Outputs that depend only on current inputs", "Only sequential gates", "Always a clock"], answer: 1 },
  { q: "Analysis means…", options: ["Build a circuit from a truth table", "Find the function of a given circuit", "Only simulate delays", "Add memory"], answer: 1 },
  { q: "Design means…", options: ["Find the function of a circuit", "Given a desired function, determine the circuit", "Only draw timing diagrams", "Remove all gates"], answer: 1 },
  { q: "A truth-table analysis requires…", options: ["Only one input combination", "Every input combination", "Only the all-1s row", "No outputs"], answer: 1 },
  { q: "When inputs change in a combinational circuit, outputs…", options: ["Never change", "Change only on clock edge", "May change after gate delay", "Store the old value"], answer: 2 },
];

function CombinationalLogicGuide({ onGoPractice }: { onGoPractice: (tab: DetailTab) => void }) {
  return (
    <>
      <p className="text-sm text-[var(--app-muted)] leading-relaxed max-w-3xl mb-8">
        Combinational logic is the foundation of digital design: outputs are a pure function of inputs — no flip-flops, no loops, no memory.
      </p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Definition</h2>
        <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-5 text-sm space-y-3 text-[var(--app-text)] leading-relaxed">
          <p>
            <strong>Output is a function of input only</strong> — no feedback path from output back to input.
          </p>
          <p className="text-xs text-[var(--app-muted)]">
            When inputs change, outputs may change after a short propagation delay through the gates.
          </p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Analysis vs design</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-2">Analysis</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed mb-2">Given a circuit → discover its function.</p>
            <ul className="text-xs text-[var(--app-muted)] space-y-1">
              <li>• Boolean expression</li>
              <li>• Truth table</li>
            </ul>
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-2">Design</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed mb-2">Given a desired function → build the circuit.</p>
            <ul className="text-xs text-[var(--app-muted)] space-y-1">
              <li>• Start from Boolean / truth table</li>
              <li>• Minimize, then implement with gates</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Analysis procedure</h2>
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Boolean expression approach</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              Label intermediate signals at each gate output, write the equation for every gate, substitute
              backward until you have F in terms of primary inputs, then simplify.
            </p>
          </div>
          <div className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4">
            <h3 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Truth table approach</h3>
            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
              Apply every input combination (000, 001, …), propagate values through the gates, and fill the
              output columns. From the completed table you can write the canonical SOP or use a K-map.
            </p>
          </div>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--app-muted)] mb-3">Design procedure</h2>
        <div className="space-y-2">
          {[
            "From the problem statement, decide how many inputs and outputs you need.",
            "Build a truth table that captures the required behaviour (use don’t-cares where the input never occurs).",
            "Obtain simplified Boolean expressions for each output (K-map or algebra).",
            "Draw the logic diagram with AND, OR, NOT (or NAND/NOR) gates.",
          ].map((step, i) => (
            <div key={i} className="rounded-xl border border-[var(--app-border)] bg-[var(--app-control)] p-4 flex gap-3">
              <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <p className="text-xs text-[var(--app-muted)] leading-relaxed pt-1">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-blue-500/30 bg-blue-500/5 p-5">
        <h2 className="text-sm font-semibold text-[var(--app-heading)] mb-1">Reinforce what you learned</h2>
        <p className="text-xs text-[var(--app-muted)] mb-4">Flashcards then quiz.</p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onGoPractice("flashcards")} className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition">
            <BookOpen size={16} /> Flashcards
          </button>
          <button type="button" onClick={() => onGoPractice("quiz")} className="inline-flex items-center gap-2 border border-[var(--app-border)] hover:bg-[var(--app-hover)] text-[var(--app-text)] text-sm font-medium px-4 py-2 rounded-lg transition">
            <HelpCircle size={16} /> Take quiz
          </button>
        </div>
      </section>
    </>
  );
}

function CombinationalLogicDetail({ onBack }: { onBack: () => void }) {
  const [tab, setTab] = useState<DetailTab>("guide");
  const tabs: { id: DetailTab; label: string; icon: typeof BookOpen }[] = [
    { id: "guide", label: "Guide", icon: BookOpen },
    { id: "flashcards", label: "Flashcards", icon: Layers },
    { id: "quiz", label: "Quiz", icon: HelpCircle },
  ];
  return (
    <div className="max-w-5xl mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-[var(--app-muted)] hover:text-[var(--app-text)] transition flex-shrink-0">
            <ArrowLeft size={16} /> All
          </button>
          <div className="w-px h-5 bg-[var(--app-border)] flex-shrink-0" />
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center flex-shrink-0">
              <Brain size={16} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-[var(--app-muted)] leading-none">About · Digital</p>
              <h1 className="text-base font-semibold text-[var(--app-heading)] truncate">Combinational Logic</h1>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-control)]">
          {tabs.map((t) => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition ${tab === t.id ? "bg-blue-600 text-white shadow-sm" : "text-[var(--app-muted)] hover:text-[var(--app-text)] hover:bg-[var(--app-hover)]"}`}>
              <t.icon size={13} /> {t.label}
            </button>
          ))}
        </div>
      </div>
      {tab === "guide" && <CombinationalLogicGuide onGoPractice={setTab} />}
      {tab === "flashcards" && <FlashcardsView cards={comboFlashcards} />}
      {tab === "quiz" && <QuizView questions={comboQuiz} />}
    </div>
  );
}


function CatalogView({ onSelect }: { onSelect: (id: ComponentId) => void }) {
  return (
    <div className="max-w-4xl mx-auto w-full">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--app-heading)]">About Components</h1>
        <p className="text-sm text-[var(--app-muted)] mt-0.5">
          Learn how each part works — then lock it in with flashcards and a quiz.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {componentCatalog.map((c) => (
          <button
            key={c.id}
            type="button"
            disabled={!c.available}
            onClick={() => c.available && onSelect(c.id)}
            className={`text-left rounded-xl border p-4 flex flex-col transition ${
              c.available
                ? "border-[var(--app-border)] bg-[var(--app-control)] hover:border-blue-500/50 hover:bg-[var(--app-hover)] cursor-pointer"
                : "border-[var(--app-border)] bg-[var(--app-control)] opacity-50 cursor-not-allowed"
            }`}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                {c.id === "thyristor" ? (
                  <Zap size={18} />
                ) : c.id === "karnaugh-maps" ? (
                  <Layers size={18} />
                ) : c.id === "combinational-logic" ? (
                  <Brain size={18} />
                ) : (
                  <Cpu size={18} />
                )}
              </div>
              <div>
                <div className="text-sm font-semibold text-[var(--app-heading)]">{c.name}</div>
                <div className="text-[10px] uppercase tracking-wide text-[var(--app-muted)]">
                  {c.category}
                </div>
              </div>
            </div>
            <p className="text-xs text-[var(--app-muted)] flex-1 leading-relaxed">{c.tagline}</p>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-blue-400">
              {c.available ? (
                <>
                  Open guide
                  <ArrowRight size={12} />
                </>
              ) : (
                <span className="text-[var(--app-muted)]">Coming soon</span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   Page root
   ═══════════════════════════════════════════════════════════════════ */

export function AboutComponentsPage() {
  const [selected, setSelected] = useState<ComponentId | null>(null);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      {selected === "thyristor" ? (
        <ThyristorDetail onBack={() => setSelected(null)} />
      ) : selected === "decoder-encoder" ? (
        <DecoderEncoderDetail onBack={() => setSelected(null)} />
      ) : selected === "karnaugh-maps" ? (
        <KarnaughMapsDetail onBack={() => setSelected(null)} />
      ) : selected === "combinational-logic" ? (
        <CombinationalLogicDetail onBack={() => setSelected(null)} />
      ) : (
        <CatalogView onSelect={setSelected} />
      )}
    </div>
  );
}
