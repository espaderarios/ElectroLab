import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Terminal,
  Code2,
  Play,
  Copy,
  Check,
  Calculator,
  FunctionSquare,
  TrendingUp,
  Binary,
  Sigma,
  type LucideIcon,
} from "lucide-react";

/* ---------- Reusable UI pieces (same language as Concepts) ---------- */

function FormulaBox({ formula, note }: { formula: string; note?: string }) {
  return (
    <div className="rounded-xl border border-cyan-500/30 bg-[rgba(0,40,70,0.45)] px-4 py-3 font-mono text-sm text-cyan-100 leading-relaxed whitespace-pre-wrap shadow-[0_0_20px_rgba(0,180,255,0.12)]">
      {formula}
      {note && (
        <div className="mt-2 text-xs text-slate-400 font-sans normal-case tracking-normal">
          {note}
        </div>
      )}
    </div>
  );
}

function RealLifeCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-[rgba(60,40,0,0.35)] p-4">
      <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
        <Lightbulb size={14} /> Real-life connection
      </div>
      <p className="text-sm text-slate-300 leading-relaxed">{text}</p>
    </div>
  );
}

function DiscussionCard({ paragraphs }: { paragraphs: string[] }) {
  return (
    <div className="rounded-xl border border-slate-600/50 bg-[rgba(15,25,45,0.6)] p-5">
      <div className="flex items-center gap-2 text-cyan-300 text-xs font-semibold uppercase tracking-wider mb-3">
        <BookOpen size={14} /> Discussion
      </div>
      <div className="space-y-3">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-sm text-slate-300 leading-relaxed">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({
  code,
  title,
  output,
}: {
  code: string;
  title?: string;
  output?: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-xl border border-slate-700/70 overflow-hidden bg-[#0a1220]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700/60 bg-slate-900/60">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Terminal size={13} />
          <span>{title || "MATLAB"}</span>
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition"
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="px-4 py-3 text-[13px] leading-relaxed text-cyan-100 font-mono overflow-x-auto whitespace-pre">
        {code}
      </pre>
      {output && (
        <div className="border-t border-slate-700/50 px-4 py-2.5 bg-[#071018]">
          <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">
            Command Window
          </div>
          <pre className="text-[13px] font-mono text-emerald-300/90 whitespace-pre-wrap">
            {output}
          </pre>
        </div>
      )}
    </div>
  );
}

/* ---------- Topics data ---------- */

type TopicId =
  | "getting-started"
  | "m-files"
  | "arithmetic"
  | "roots-power"
  | "exp-log"
  | "trig"
  | "plotting"
  | "arrays"
  | "complex"
  | "own-plot";

interface TopicMeta {
  id: TopicId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tags: string[];
  formula?: string;
  formulaNote?: string;
  discussion: string[];
  realLife: string;
  codeBlocks: { title: string; code: string; output?: string }[];
  tips?: string[];
}

const TOPICS: TopicMeta[] = [
  {
    id: "getting-started",
    title: "Getting Started with MATLAB",
    subtitle: "Command Window, Editor & Figure windows",
    icon: Terminal,
    tags: ["Basics", "Workspace"],
    formula: ">> a = 1.2;\n>> b = 2.3;\n>> a^3 + sqrt(b*4) - 4*4.5",
    formulaNote: "Semicolon suppresses output. Omit it to see the result.",
    discussion: [
      "MATLAB is a high-level language designed for numerical computing. It is especially strong at matrix operations, which is why it dominates signal processing, control systems, and communications labs.",
      "You interact with three main windows: the Command Window (live calculator), the Editor (for scripts called M-files), and the Figure window (which appears when you plot).",
      "Treat the Command Window like a scientific calculator that also understands vectors and matrices natively.",
    ],
    realLife:
      "Engineers use MATLAB daily to prototype filters, analyze vibration data, design control loops, and generate figures for reports — the same skills you are practicing in this lab.",
    codeBlocks: [
      {
        title: "Quick calculator mode",
        code: `a = 1.2;
b = 2.3;
c = 4.5;
d = 4;
a^3 + sqrt(b*d) - 4*c`,
        output: `ans =
  -13.2388`,
      },
    ],
    tips: [
      "Always start scripts with clc; clear; close all;",
      "Use ↑ / ↓ arrows in the Command Window to recall previous commands",
    ],
  },
  {
    id: "m-files",
    title: "Creating M-files",
    subtitle: "Scripts, saving & running code",
    icon: Code2,
    tags: ["Scripts", "Editor"],
    discussion: [
      "An M-file is simply a text file with the .m extension that contains MATLAB commands. Writing code in the Editor (instead of the Command Window) lets you save, edit, and re-run experiments easily.",
      "For this laboratory activity you must name your file: YourSurname_signal_lab_#2.m",
      "Press Ctrl+Enter (or click Run) to execute the current section or the whole script.",
    ],
    realLife:
      "In industry, engineers keep libraries of M-files and functions so that signal-processing pipelines can be version-controlled and reused across projects.",
    codeBlocks: [
      {
        title: "Header every script should have",
        code: `clc;          % clear Command Window
clear;        % clear workspace variables
close all;    % close all figure windows

% Your code starts here...`,
      },
    ],
    tips: [
      "File → New → Script (or Home → New → Script)",
      "Save early and often with Ctrl+S",
    ],
  },
  {
    id: "arithmetic",
    title: "Arithmetic Operations",
    subtitle: "Scalars, variables & element-wise ops",
    icon: Calculator,
    tags: ["Operators", "Variables"],
    formula: "A = a + b;\nB = b - a;\nD = a * b;\nE = c / a;\nF = D + E;   % your choice",
    discussion: [
      "MATLAB treats almost everything as a matrix. The ordinary operators +, -, *, / work for scalars and for matrix math. When you want element-by-element operations on vectors, use the dotted versions: .*, ./, .^",
      "Assigning a value with a trailing semicolon keeps the Command Window clean. Removing the semicolon (or typing the variable name alone) displays the result.",
      "In the lab you must create your own variable F that performs any arithmetic operation between D and E.",
    ],
    realLife:
      "Element-wise operators are the reason vectorized MATLAB code runs much faster than explicit for-loops — critical when processing long audio or sensor signals.",
    codeBlocks: [
      {
        title: "Lab Activity – Part B",
        code: `a = 2;
b = 5;
c = 3;

A = a + b;      % 7
B = b - a;      % 3
D = a * b;      % 10
E = c / a;      % 1.5

% Required: any operation between D and E
F = D + E;      % change this to D*E, D/E, etc.`,
        output: `A =
     7
B =
     3
D =
    10
E =
    1.5000
F =
   11.5000`,
      },
      {
        title: "Element-wise vs matrix operators",
        code: `X = [1 3 4];
Y = [4 5 6];

X + Y          % element-wise addition
X .* Y         % element-wise multiply → [4 15 24]
X * Y'         % matrix multiply (dot product) → 43`,
      },
    ],
  },
  {
    id: "roots-power",
    title: "Roots & Powers",
    subtitle: "sqrt, nthroot and exponentiation",
    icon: FunctionSquare,
    tags: ["Math", "Functions"],
    formula: "sqrt(x)\nnthroot(x, n)\nx.^p",
    discussion: [
      "sqrt(x) returns the principal (non-negative) square root. For roots other than 2 use nthroot(x, n).",
      "The power operator .^ is element-wise. Using ^ without the dot performs matrix power, which is different and will error on non-square matrices.",
    ],
    realLife:
      "Root and power operations appear constantly when converting between linear and logarithmic amplitude scales or when computing RMS values of signals.",
    codeBlocks: [
      {
        title: "Part C – Roots & Powers",
        code: `% Square root
sqrt(2)          % ≈ 1.4142
sqrt(b)          % b = 5 → ≈ 2.2361

% nth root
nthroot(2, 3)    % cube root of 2 ≈ 1.2599
nthroot(b, c)    % c-th root of b

% Power (element-wise)
2.^3             % 8
a.^b             % 2^5 = 32`,
        output: `ans =
    1.4142

ans =
    1.2599

ans =
     8`,
      },
    ],
  },
  {
    id: "exp-log",
    title: "Exponential & Logarithms",
    subtitle: "exp, log10, natural log",
    icon: Sigma,
    tags: ["Math", "Signals"],
    formula: "exp(x)     % e^x\nlog10(x)   % log₁₀(x)\nlog(x)     % ln(x)",
    discussion: [
      "exp(x) computes e^x. log(x) is the natural logarithm (ln). log10(x) is the common (base-10) logarithm.",
      "These functions are fundamental when working with exponential growth/decay, decibels, and frequency-domain representations of signals.",
    ],
    realLife:
      "Decibel calculations (20·log10(|X|)) and continuous-time system responses (e^{st}) both rely on these elementary functions.",
    codeBlocks: [
      {
        title: "Part D – Exp & Log",
        code: `exp(2)       % e² ≈ 7.3891
exp(c)       % e³

log10(2)     % ≈ 0.3010
log10(b)

log(2)       % ln(2) ≈ 0.6931
log(c)`,
        output: `ans =
    7.3891

ans =
    0.3010

ans =
    0.6931`,
      },
    ],
  },
  {
    id: "trig",
    title: "Trigonometric Functions",
    subtitle: "Radians vs degrees",
    icon: FunctionSquare,
    tags: ["Trig", "Radians"],
    formula: "sin(π), cos(π), tan(π)\nsind(90), cosd(90)   % degree versions",
    discussion: [
      "By default, sin, cos, tan (and their inverse functions) expect radians. MATLAB also provides degree versions: sind, cosd, tand, asind, acosd, atand.",
      "Mixing the two is one of the most common sources of silent errors in student labs — always check which unit you need.",
    ],
    realLife:
      "Phase angles in Fourier analysis, instantaneous frequency of FM signals, and antenna array factors all use trigonometric functions extensively.",
    codeBlocks: [
      {
        title: "Part E – Trigonometry",
        code: `% Radians
cos(pi)          % -1
sin(pi)          % ≈ 0
tan(pi)          % ≈ 0
acos(0.5)        % ≈ 1.0472 rad (60°)
asin(0.5)
atan(0.5)

% Degrees
cosd(90)         % 0
sind(90)         % 1
tand(90)         % Inf
acosd(0.5)       % 60
asind(0.5)
atand(0.5)`,
        output: `ans =
    -1

ans =
     0

ans =
    60`,
      },
    ],
    tips: ["Remember: pi is already defined in MATLAB as 3.14159…"],
  },
  {
    id: "plotting",
    title: "Plotting Signals",
    subtitle: "plot, title, grid, continuous functions",
    icon: TrendingUp,
    tags: ["Visualization", "plot"],
    formula: "x = 0:0.01:10;\ny = cos(x);\nplot(x, y)\ntitle('y = cos(x)')",
    discussion: [
      "The plot function is the workhorse of MATLAB visualization. For discrete data you pass two vectors of the same length. For continuous-looking curves you generate a finely spaced x vector with the colon operator.",
      "Always label axes and add a title — this is required for professional reports and for the laboratory documentation.",
      "The lab asks you to plot five standard functions (2x, x², eˣ, ln(x), cos(x)) plus one original equation of your own.",
    ],
    realLife:
      "Almost every signal-processing paper or lab report contains MATLAB-generated figures. Clean, labeled plots are how you communicate results to others.",
    codeBlocks: [
      {
        title: "Simple discrete plot",
        code: `x = [0 1 2 3 4 5 6];
y = [1 2 2 4 6 3 5];
plot(x, y)
title('Simple Plot')
xlabel('x')
ylabel('y')
grid on`,
      },
      {
        title: "Continuous functions (Part F)",
        code: `x = 0:0.01:10;

% a. y = 2x
y = 2*x;
figure; plot(x, y); title('y = 2x'); grid on;

% b. y = x²
y = x.^2;
figure; plot(x, y); title('y = x^2'); grid on;

% c. y = e^x
y = exp(x);
figure; plot(x, y); title('y = e^x'); grid on;

% d. y = ln(x)  (start above zero)
x = 0.01:0.01:10;
y = log(x);
figure; plot(x, y); title('y = ln(x)'); grid on;

% e. y = cos(x)
x = 0:0.01:10;
y = cos(x);
figure; plot(x, y); title('y = cos(x)'); grid on;`,
      },
    ],
    tips: [
      "Use .^ for element-wise power on vectors",
      "figure creates a new window so plots do not overwrite each other",
      "grid on makes the plot easier to read",
    ],
  },
  {
    id: "arrays",
    title: "Arrays & Indexing",
    subtitle: "Vectors, colon operator, zeros & ones",
    icon: Binary,
    tags: ["Vectors", "Indexing"],
    formula: "x = 1:6;\nx = 1:2:6;\nY = zeros(100,1);\nY = ones(1,5);",
    discussion: [
      "MATLAB arrays are 1-indexed (the first element is x(1), never x(0)). The colon operator is the most common way to create regularly spaced vectors.",
      "zeros and ones are the standard ways to pre-allocate memory — important for performance when you later fill large arrays inside loops.",
    ],
    realLife:
      "Signal buffers, filter coefficients, and DFT length vectors are all created and manipulated with these basic array operations.",
    codeBlocks: [
      {
        title: "Creating and indexing arrays",
        code: `x = [1 2 3 4 5 6];
x = 1:6;                 % same
x = 1:2:6;               % 1 3 5

x = [1:3 4 6 100:110];   % concatenation
x(3:7)                   % extract subset
length(x)

Y = zeros(100,1);        % column of zeros
Y = ones(1,5);           % row of ones`,
      },
    ],
  },
  {
    id: "complex",
    title: "Complex Numbers",
    subtitle: "i, j, conj, abs, angle, real, imag",
    icon: FunctionSquare,
    tags: ["Complex", "Phasors"],
    formula: "z = 3 + 4i;\nabs(z), angle(z), real(z), imag(z)",
    discussion: [
      "MATLAB treats i and j as the imaginary unit by default (as long as you have not assigned them other values). Complex arithmetic is built-in, which is why frequency-domain work feels natural.",
      "abs(z) gives magnitude, angle(z) gives phase in radians — exactly the polar form used throughout signal processing.",
    ],
    realLife:
      "Every DFT bin, every phasor, and every frequency response H(jω) is a complex number. Mastering these functions is non-negotiable for the rest of the course.",
    codeBlocks: [
      {
        title: "Complex arithmetic",
        code: `z = 3 + 4i;

conj(z)      % 3 - 4i
abs(z)       % 5
angle(z)     % atan2(4,3) ≈ 0.9273 rad
real(z)      % 3
imag(z)      % 4

% Alternative construction
img = sqrt(-1);
z = 3 + 4*img;
exp(pi*img)  % ≈ -1  (Euler)`,
        output: `ans =
   3.0000 - 4.0000i

ans =
     5

ans =
    0.9273`,
      },
    ],
  },
  {
    id: "own-plot",
    title: "Your Own Plot (Required)",
    subtitle: "Create one original figure for the report",
    icon: TrendingUp,
    tags: ["Creative", "Required"],
    discussion: [
      "The laboratory requires you to invent and plot at least one equation that is not in the list above. This is your chance to show you understand how to generate x, compute y, and produce a clean figure.",
      "Good choices include damped sinusoids, polynomials, rectified waves, or simple modulated signals — anything that demonstrates the colon operator, element-wise math, and proper labeling.",
    ],
    realLife:
      "In later labs you will plot real measured signals. The habit of writing clean, self-documenting plotting code starts here.",
    codeBlocks: [
      {
        title: "Example 1 – Damped sine",
        code: `x = -2*pi : 0.01 : 2*pi;
y = sin(x) .* exp(-0.15*x);

figure
plot(x, y, 'b', 'LineWidth', 1.5)
title('My Own Function: Damped Sine Wave')
xlabel('x (radians)')
ylabel('y')
grid on`,
      },
      {
        title: "Example 2 – Cubic polynomial",
        code: `x = 0 : 0.01 : 5;
y = x.^3 - 6*x.^2 + 11*x - 6;

figure
plot(x, y, 'r', 'LineWidth', 1.5)
title('My Own Function: Cubic Polynomial')
xlabel('x')
ylabel('y')
grid on`,
      },
      {
        title: "Example 3 – AM-like envelope",
        code: `t = 0 : 0.001 : 2;
carrier = cos(2*pi*30*t);
message = 1 + 0.7*cos(2*pi*3*t);
y = message .* carrier;

figure
plot(t, y)
title('My Own Function: Amplitude Modulation')
xlabel('t (s)')
ylabel('Amplitude')
grid on`,
      },
    ],
    tips: [
      "Take a screenshot of the figure window for your documentation section",
      "Use a descriptive title so the instructor knows it is your original work",
    ],
  },
];

/* ---------- Main page component ---------- */

type View = "home" | "tutorial1" | TopicId;

export function MatlabTutorialPage() {
  const [view, setView] = useState<View>("home");

  const activeTopic = TOPICS.find((t) => t.id === view);
  const isTopic = view !== "home" && view !== "tutorial1";

  /* ---- Topic detail ---- */
  if (isTopic && activeTopic) {
    const meta = activeTopic;
    const Icon = meta.icon;
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <button
            type="button"
            onClick={() => setView("tutorial1")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 transition"
          >
            <ArrowLeft size={16} /> Back to Tutorial 1
          </button>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
              <Icon size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-100">
                {meta.title}
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">{meta.subtitle}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {meta.tags.map((t) => (
                  <span
                    key={t}
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {meta.formula && (
            <FormulaBox formula={meta.formula} note={meta.formulaNote} />
          )}

          <DiscussionCard paragraphs={meta.discussion} />

          <div className="space-y-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Code examples
            </div>
            {meta.codeBlocks.map((block, i) => (
              <CodeBlock
                key={i}
                title={block.title}
                code={block.code}
                output={block.output}
              />
            ))}
          </div>

          {meta.tips && meta.tips.length > 0 && (
            <div className="rounded-xl border border-emerald-500/25 bg-[rgba(0,40,30,0.35)] p-4">
              <div className="flex items-center gap-2 text-emerald-300 text-xs font-semibold uppercase tracking-wider mb-2">
                <Play size={14} /> Tips
              </div>
              <ul className="space-y-1.5">
                {meta.tips.map((tip, i) => (
                  <li key={i} className="text-sm text-slate-300 flex gap-2">
                    <span className="text-emerald-400/70">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <RealLifeCard text={meta.realLife} />
        </div>
      </div>
    );
  }

  /* ---- Tutorial 1 – topic grid ---- */
  if (view === "tutorial1") {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="mb-6">
          <button
            type="button"
            onClick={() => setView("home")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 transition mb-4"
          >
            <ArrowLeft size={16} /> All tutorials
          </button>

          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Terminal size={18} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-cyan-400/80 font-semibold">
                Tutorial 1
              </div>
              <h1 className="text-xl font-semibold text-slate-100">
                Introduction to MATLAB
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Laboratory Exercise 1 + Laboratory Activity #2 — from creating
            M-files to plotting your own signals. Open any card for discussion,
            ready-to-run code, expected output, and tips.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {TOPICS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setView(t.id)}
                className="text-left group bg-[#111827] border border-[#1e293b] hover:border-cyan-500/40 rounded-xl p-5 flex flex-col transition shadow-sm hover:shadow-[0_0_24px_rgba(0,180,255,0.12)]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500/20 transition">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-cyan-200 transition">
                      {t.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {t.subtitle}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-400 mt-3 line-clamp-2 flex-1">
                  {t.discussion[0].slice(0, 110)}…
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {t.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Lab checklist */}
        <div className="mt-8 rounded-2xl border border-slate-700/70 bg-[#0c1524] p-5">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Lab Report Checklist
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6 text-sm text-slate-300">
            <li className="flex gap-2">
              <span className="text-cyan-400">✓</span> Saved M-file named{" "}
              <code className="text-cyan-200 text-xs">
                YourSurname_signal_lab_#2.m
              </code>
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">✓</span> All arithmetic + your own
              variable F
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">✓</span> Roots, powers, exp, log,
              trig tested
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">✓</span> Five required plots + one
              original plot
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">✓</span> 6–8 screenshots with
              captions
            </li>
            <li className="flex gap-2">
              <span className="text-cyan-400">✓</span> Introduction, Discussion,
              Conclusion written
            </li>
          </ul>
        </div>
      </div>
    );
  }

  /* ---- Home: Tutorial buttons ---- */
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
            <Terminal size={18} />
          </div>
          <h1 className="text-xl font-semibold">MATLAB Tutorials</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
          Guided walkthroughs for the Signal Processing laboratory activities.
          Start with Tutorial 1 to learn the basics of MATLAB.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        {/* Tutorial 1 button */}
        <button
          type="button"
          onClick={() => setView("tutorial1")}
          className="text-left group relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#0c1a2e] to-[#0a1220] p-6 transition hover:border-cyan-400/50 hover:shadow-[0_0_32px_rgba(0,180,255,0.18)]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-cyan-500/10 transition" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-400 mb-3">
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30">
                Tutorial 1
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100 group-hover:text-cyan-100 transition">
              Introduction to MATLAB
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Lab Exercise 1 &amp; Activity #2 — M-files, arithmetic, roots,
              exp/log, trigonometry, plotting, arrays, complex numbers, and your
              own required plot.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-cyan-300/80 group-hover:text-cyan-300 transition">
              <Play size={14} />
              Open tutorial
            </div>
          </div>
        </button>

        {/* Placeholder for future tutorials */}
        <div className="rounded-2xl border border-slate-700/50 bg-[#111827]/60 p-6 flex flex-col justify-center opacity-60">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              Tutorial 2
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-400">Coming soon</h2>
          <p className="text-sm text-slate-500 mt-2">
            More laboratory tutorials will appear here.
          </p>
        </div>
      </div>
    </div>
  );
}

export default MatlabTutorialPage;
