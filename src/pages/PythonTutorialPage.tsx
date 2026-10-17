import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Lightbulb,
  Terminal,
  Play,
  Copy,
  Check,
  Code2,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { PythonIDE } from "../components/PythonIDE"; // place PythonIDE.tsx in src/components/

/* ---------- Shared UI (same language as Concepts / MATLAB) ---------- */

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
}: {
  code: string;
  title?: string;
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
          <Code2 size={13} />
          <span>{title || "Python 3"}</span>
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
    </div>
  );
}

/* ---------- Problem data (Datathon) ---------- */

interface TestCase {
  input: string;
  expected: string;
}

type ProblemId =
  | "rules"
  | "weight-height"
  | "triangle-type"
  | "resistor-color"
  | "date-format"
  | "palindrome"
  | "zigzag"
  | "lcp"
  | "letter-combos"
  | "reverse-int"
  | "volume";

interface ProblemMeta {
  id: ProblemId;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  tags: string[];
  difficulty: "Easy" | "Medium" | "Hard";
  statement: string[];
  constraints?: string[];
  formula?: string;
  formulaNote?: string;
  discussion: string[];
  realLife: string;
  starter?: string;
  testCases: TestCase[];
  notes?: string[];
}

const PROBLEMS: ProblemMeta[] = [
  {
    id: "rules",
    title: "Competition Rules",
    subtitle: "Read before you code",
    icon: AlertTriangle,
    tags: ["Rules", "Required"],
    difficulty: "Easy",
    statement: [
      "Languages allowed: C++, Java, and Python 3 only.",
      "Use only native / built-in packages unless the problem says otherwise. Submissions are treated as executable — no extra libraries.",
      "Duration: 2 hours.",
      "One laptop per team at a time (spare only if main crashes).",
      "Internet is for submission only. Browsing is strictly prohibited.",
      "Submit answers only through the provided Google Form per question.",
      "Claims of ambiguity are allowed for running errors; valid claims get a clarification to all teams.",
      "Any action that jeopardizes the competition (including unauthorized modification of materials) → disqualification. Judges’ decision is final.",
    ],
    discussion: [
      "This tutorial follows the same constraints: Python 3, built-in modules only, and correctness judged by output matching the specification — not by coding style.",
      "If your program produces the exact required output for the given inputs, it is accepted, regardless of how you structured the code.",
    ],
    realLife:
      "Contest environments deliberately limit libraries so everyone competes on algorithmic skill, not framework knowledge.",
    testCases: [],
    notes: [
      "No internet packages (no requests, numpy, etc.)",
      "Output must match examples exactly (spacing, wording, rounding)",
    ],
  },
  {
    id: "weight-height",
    title: "Weight & Height Conversion",
    subtitle: "kg/cm → lb and ft'in\"",
    icon: Code2,
    tags: ["I/O", "Math", "Easy"],
    difficulty: "Easy",
    statement: [
      "Prompt the user to input weight and height in kilograms and centimeters (space-separated integers).",
      "Display the weight in pounds (rounded to nearest whole number) and the height in feet and inches (rounded to nearest whole number).",
    ],
    constraints: ["Inputs are integers separated by a space."],
    formula: "1 kg ≈ 2.20462 lb\n1 inch = 2.54 cm\nfeet = total_inches // 12\ninches = total_inches % 12",
    discussion: [
      "Read two integers. Convert kg → lb with the standard factor and round. Convert cm → total inches, then split into feet and remaining inches.",
      "Output format must match the sample exactly, including the apostrophe and quotes around inches.",
    ],
    realLife: "Unit conversion appears in health apps, shipping calculators, and engineering datasheets.",
    starter: `# Read weight (kg) and height (cm) from one line
# Print weight in lb and height as ft'in"
# Example input:  50 180
# Example output: Weight: 110 lb
#                 Height: 5'11"

`,
    testCases: [
      {
        input: "50 180",
        expected: "Weight: 110 lb\nHeight: 5'11\"",
      },
    ],
  },
  {
    id: "triangle-type",
    title: "Triangle Type",
    subtitle: "right / acute / obtuse by sides",
    icon: Code2,
    tags: ["Geometry", "Function"],
    difficulty: "Easy",
    statement: [
      "Write a function triangleType that accepts three side lengths and returns the type according to interior angles:",
      "• right  — a² + b² = c² (c longest)",
      "• obtuse — a² + b² < c²",
      "• acute  — a² + b² > c²",
    ],
    formula: "Sort sides so c is longest.\nif a²+b² == c² → right\nif a²+b² <  c² → obtuse\nif a²+b² >  c² → acute",
    discussion: [
      "Always identify the longest side first. Compare the sum of squares of the two shorter sides against the square of the longest.",
      "Equality must be exact for integers; for floating sides you would use a small epsilon, but samples here are integers.",
    ],
    realLife: "Structural engineering and computer graphics both classify triangles this way when checking mesh quality or load paths.",
    starter: `# Write triangleType(a, b, c) -> "right triangle" | "obtuse triangle" | "acute triangle"
# Then read three sides and print the result

`,
    testCases: [
      { input: "3 4 5", expected: "right triangle" },
      { input: "5 5 9", expected: "obtuse triangle" },
    ],
  },
  {
    id: "resistor-color",
    title: "Resistor Color Code",
    subtitle: "First two bands → two-digit value",
    icon: Code2,
    tags: ["Dict", "ECE", "Easy"],
    difficulty: "Easy",
    statement: [
      "Input color names (case-insensitive). Output the two-digit number formed by the first two colors only.",
      "brown-green → 15, brown-green-violet → still 15 (ignore extra bands).",
      "If fewer than two colors, or either of the first two is invalid → error message.",
    ],
    formula: "Black=0 Brown=1 Red=2 Orange=3 Yellow=4\nGreen=5 Blue=6 Violet=7 Grey=8 White=9",
    discussion: [
      "Use a dictionary for the color → digit map. Split the input on hyphens or spaces, take the first two tokens, look them up, and concatenate.",
      "Case-insensitive: normalize with .lower() before lookup.",
    ],
    realLife: "Every electronics technician reads resistor values from color bands — this is the exact skill used at the workbench.",
    starter: `# Map first two color bands to a two-digit number
# Invalid / less than 2 colors -> "Invalid Input"

`,
    testCases: [
      { input: "brown-green", expected: "15" },
      { input: "brown-green-violet", expected: "15" },
      { input: "red", expected: "Invalid Input" },
    ],
  },
  {
    id: "date-format",
    title: "Date Format Conversion",
    subtitle: "mm/dd/yyyy → Month DD, YYYY",
    icon: Code2,
    tags: ["Strings", "Validation"],
    difficulty: "Easy",
    statement: [
      "Accept a date in mm/dd/yyyy format and output it as MMMM DD, YYYY.",
      "Invalid dates (e.g. month 13, day 32) must print an error message.",
    ],
    discussion: [
      "Split on '/'. Validate month 1–12 and day against the month’s length (account for leap years if you want full correctness; basic range checks often suffice for samples).",
      "Map month number to English name with a list or dict.",
    ],
    realLife: "Locale-aware date formatting is required in logs, invoices, and user interfaces worldwide.",
    starter: `# Input: mm/dd/yyyy
# Output: Month DD, YYYY   or  Invalid Input

`,
    testCases: [
      { input: "10/29/2022", expected: "October 29, 2022" },
      { input: "10/32/2022", expected: "Invalid Input" },
    ],
  },
  {
    id: "palindrome",
    title: "Palindrome Number",
    subtitle: "No string conversion allowed",
    icon: Code2,
    tags: ["Math", "Medium"],
    difficulty: "Medium",
    statement: [
      "Given an integer x, return True if x is a palindrome (reads the same forward and backward).",
      "Minus points (or rejection) if you convert the integer to a string.",
    ],
    formula: "Reverse the digits mathematically:\nrev = 0\nwhile n: rev = rev*10 + n%10; n //= 10\nreturn rev == original",
    discussion: [
      "Extract digits with % 10 and // 10 to build the reversed number. Compare with the original. Negative numbers are usually not considered palindromes.",
      "This forces you to practice pure arithmetic instead of relying on string tricks.",
    ],
    realLife: "Digit-level arithmetic appears in checksum algorithms, serial-number validation, and interview questions.",
    starter: `# Return True if integer is palindrome — do NOT convert to string

`,
    testCases: [
      { input: "121", expected: "True" },
      { input: "123", expected: "False" },
      { input: "-121", expected: "False" },
    ],
  },
  {
    id: "zigzag",
    title: "Zigzag Conversion",
    subtitle: "PAYPALISHIRING → PAHNAPLSIIGYIR",
    icon: Code2,
    tags: ["Strings", "Medium"],
    difficulty: "Medium",
    statement: [
      'Write convert(s, numRows) that writes the string in a zigzag pattern on numRows rows and then reads line by line.',
      'Example: s = "PAYPALISHIRING", numRows = 3 → "PAHNAPLSIIGYIR"',
    ],
    constraints: [
      "1 <= s.length <= 1000",
      "s consists of English letters, ',' and '.'",
      "1 <= numRows <= 1000",
    ],
    discussion: [
      "Simulate the rows with a list of strings. Move an index up and down (direction flag) as you place each character. Finally join the rows.",
      "Edge cases: numRows == 1 → return s unchanged.",
    ],
    realLife: "Zigzag / diagonal traversal patterns appear in matrix algorithms and some encoding schemes.",
    starter: `# def convert(s, numRows) -> zigzag string read row by row

`,
    testCases: [
      {
        input: "PAYPALISHIRING\n3",
        expected: "PAHNAPLSIIGYIR",
      },
    ],
  },
  {
    id: "lcp",
    title: "Longest Common Prefix",
    subtitle: "Among an array of strings",
    icon: Code2,
    tags: ["Strings", "Easy"],
    difficulty: "Easy",
    statement: [
      "Find the longest common prefix string amongst an array of strings. If none, return an empty string.",
    ],
    constraints: [
      "1 <= strs.length <= 200",
      "0 <= strs[i].length <= 200",
      "lowercase English letters only",
    ],
    discussion: [
      "Vertical scanning: compare character by character across all strings until a mismatch or end of a string.",
      "Horizontal scanning (reduce prefix pairwise) also works and is easy to implement.",
    ],
    realLife: "Autocomplete, file-system path compression, and DNA sequence alignment all use common-prefix logic.",
    starter: `# Longest common prefix among a list of strings (or "")

`,
    testCases: [
      { input: '["flower","flow","flight"]', expected: "fl" },
      { input: '["dog","racecar","car"]', expected: "" },
    ],
  },
  {
    id: "letter-combos",
    title: "Letter Combinations of a Phone Number",
    subtitle: "Digits 2-9 → keypad letters",
    icon: Code2,
    tags: ["Backtracking", "Medium"],
    difficulty: "Medium",
    statement: [
      "Given a string of digits from 2-9, return all possible letter combinations the number could represent (old phone keypad). Return in any order.",
      "Digit 1 maps to nothing.",
    ],
    formula: "2:abc 3:def 4:ghi 5:jkl\n6:mno 7:pqrs 8:tuv 9:wxyz",
    discussion: [
      "Classic backtracking / BFS. Map each digit to its letters, then build combinations by appending one letter at a time.",
      "Empty input → empty list.",
    ],
    realLife: "T9 predictive text on old phones worked exactly this way; the same idea powers some search-suggestion engines.",
    starter: `# Phone keypad letter combinations for digits 2-9

`,
    testCases: [
      { input: "23", expected: "['ad', 'ae', 'af', 'bd', 'be', 'bf', 'cd', 'ce', 'cf']" },
    ],
    notes: ["Order of combinations may vary; any order is accepted."],
  },
  {
    id: "reverse-int",
    title: "Reverse Integer",
    subtitle: "32-bit signed range check",
    icon: Code2,
    tags: ["Math", "Medium"],
    difficulty: "Medium",
    statement: [
      "Given a signed 32-bit integer x, return x with its digits reversed. If the reversed value is outside the 32-bit signed range [−2³¹, 2³¹−1], return 0.",
    ],
    formula: "INT_MIN = -2**31\nINT_MAX =  2**31 - 1",
    discussion: [
      "Reverse digit by digit. Before multiplying by 10, check whether the next step would overflow. Alternatively reverse then clamp.",
      "In Python integers are unbounded, so you must enforce the 32-bit limit yourself.",
    ],
    realLife: "Overflow-aware arithmetic is critical in embedded systems and when interfacing with languages that have fixed-width ints.",
    starter: `# Reverse digits of a 32-bit signed int; return 0 on overflow

`,
    testCases: [
      { input: "123", expected: "321" },
      { input: "-123", expected: "-321" },
      { input: "1534236469", expected: "0" },
    ],
  },
  {
    id: "volume",
    title: "Volume from Mass & Density",
    subtitle: "density = mass / volume",
    icon: Code2,
    tags: ["Physics", "Easy"],
    difficulty: "Easy",
    statement: [
      "Accept mass (grams) and density (g/cm³). Output the volume using density = mass / volume. Format to two decimal places.",
    ],
    formula: "volume = mass / density",
    discussion: [
      "Simple rearrangement of the density formula. Guard against division by zero if density is 0.",
      "Print with exactly two decimal places (f-string or format).",
    ],
    realLife: "Material selection, quality control, and lab measurements all rely on mass–density–volume relationships.",
    starter: `# volume = mass / density, print with 2 decimal places

`,
    testCases: [
      { input: "100\n2.5", expected: "40.00" },
    ],
  },
];

/* ---------- Main page ---------- */

type View = "home" | "tutorial1" | ProblemId;

export function PythonTutorialPage() {
  const [view, setView] = useState<View>("home");
  const active = PROBLEMS.find((p) => p.id === view);
  const isProblem = view !== "home" && view !== "tutorial1";

  /* Problem detail — split: instructions left, IDE right */
  if (isProblem && active) {
    const Icon = active.icon;
    const showIde = active.id !== "rules";

    return (
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Top bar */}
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b border-slate-800 bg-[#0a1220]">
          <button
            type="button"
            onClick={() => setView("tutorial1")}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 transition"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div className="h-4 w-px bg-slate-700" />
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
            <Icon size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-slate-100 truncate">{active.title}</h1>
              <span
                className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border shrink-0 ${
                  active.difficulty === "Easy"
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                    : active.difficulty === "Medium"
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/30"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/30"
                }`}
              >
                {active.difficulty}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 truncate">{active.subtitle}</p>
          </div>
          <div className="hidden sm:flex flex-wrap gap-1">
            {active.tags.slice(0, 3).map((t) => (
              <span
                key={t}
                className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-800 text-slate-500 border border-slate-700"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Split body */}
        <div className={`flex-1 flex min-h-0 ${showIde ? "" : ""}`}>
          {/* LEFT — instructions (scrollable) */}
          <div
            className={`overflow-y-auto scrollbar-thin p-4 space-y-4 ${
              showIde ? "w-full lg:w-[42%] lg:border-r border-slate-800" : "w-full max-w-3xl mx-auto"
            }`}
          >
            <div className="rounded-xl border border-slate-600/50 bg-[rgba(15,25,45,0.6)] p-4 space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300 mb-1">
                Problem statement
              </div>
              {active.statement.map((s, i) => (
                <p key={i} className="text-sm text-slate-300 leading-relaxed">
                  {s}
                </p>
              ))}
              {active.constraints && (
                <ul className="mt-2 space-y-1">
                  {active.constraints.map((c, i) => (
                    <li key={i} className="text-xs text-slate-400 flex gap-2">
                      <span className="text-slate-600">•</span>
                      {c}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {active.formula && (
              <FormulaBox formula={active.formula} note={active.formulaNote} />
            )}

            <DiscussionCard paragraphs={active.discussion} />

            {active.notes && active.notes.length > 0 && (
              <div className="rounded-xl border border-amber-500/20 bg-[rgba(60,40,0,0.25)] p-4">
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold uppercase tracking-wider mb-2">
                  <AlertTriangle size={14} /> Notes
                </div>
                <ul className="space-y-1">
                  {active.notes.map((n, i) => (
                    <li key={i} className="text-sm text-slate-300 flex gap-2">
                      <span className="text-amber-500/70">•</span>
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <RealLifeCard text={active.realLife} />
          </div>

          {/* RIGHT — IDE (fills remaining space) */}
          {showIde && (
            <div className="hidden lg:flex flex-col flex-1 min-w-0 bg-[#070d14]">
              <PythonIDE
                starter={active.starter || "# Write your solution here\n"}
                testCases={active.testCases}
              />
            </div>
          )}
        </div>

        {/* Mobile: IDE below instructions */}
        {showIde && (
          <div className="lg:hidden border-t border-slate-800 p-3 bg-[#070d14]">
            <p className="text-[11px] text-slate-500 mb-2">
              Editor + terminal — rotate or use a wider screen for side-by-side.
            </p>
            <PythonIDE
              starter={active.starter || "# Write your solution here\n"}
              testCases={active.testCases}
              height={380}
            />
          </div>
        )}
      </div>
    );
  }

  /* Tutorial 1 grid */
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
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <Terminal size={18} />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider text-emerald-400/80 font-semibold">
                Tutorial 1
              </div>
              <h1 className="text-xl font-semibold text-slate-100">
                Python 3 — Datathon Problems
              </h1>
            </div>
          </div>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Built-in modules only. Judged by output correctness — any solution that matches
            the expected output is accepted. Interactive terminal included for each problem.
          </p>
        </div>

        {/* Rules banner */}
        <div className="mb-6 rounded-xl border border-amber-500/25 bg-[rgba(60,40,0,0.3)] p-4 flex gap-3">
          <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-300">
            <strong className="text-amber-300">Competition rules apply:</strong> Python 3 only,
            native packages, 2-hour format, one laptop, internet for submission only. Open the
            Rules card first.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {PROBLEMS.map((p) => {
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setView(p.id)}
                className="text-left group bg-[#111827] border border-[#1e293b] hover:border-emerald-500/40 rounded-xl p-5 flex flex-col transition shadow-sm hover:shadow-[0_0_24px_rgba(16,185,129,0.12)]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:bg-emerald-500/20 transition">
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-emerald-200 transition">
                      {p.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">{p.subtitle}</div>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${
                      p.difficulty === "Easy"
                        ? "text-emerald-400/80 border-emerald-500/20"
                        : p.difficulty === "Medium"
                        ? "text-amber-400/80 border-amber-500/20"
                        : "text-rose-400/80 border-rose-500/20"
                    }`}
                  >
                    {p.difficulty}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-3 line-clamp-2 flex-1">
                  {p.statement[0].slice(0, 100)}…
                </p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {p.tags.slice(0, 3).map((tag) => (
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
      </div>
    );
  }

  /* Home */
  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-8">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <Terminal size={18} />
          </div>
          <h1 className="text-xl font-semibold">Python Tutorials</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
          Interactive Python 3 practice aligned with Datathon rules — output-based judging,
          built-in modules only, terminal checker included.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 max-w-3xl">
        <button
          type="button"
          onClick={() => setView("tutorial1")}
          className="text-left group relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-[#0c1f18] to-[#0a1220] p-6 transition hover:border-emerald-400/50 hover:shadow-[0_0_32px_rgba(16,185,129,0.18)]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:bg-emerald-500/10 transition" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-emerald-400 mb-3">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30">
                Tutorial 1
              </span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100 group-hover:text-emerald-100 transition">
              Datathon Problem Set
            </h2>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Weight/height, triangle type, resistor colors, date format, palindrome, zigzag,
              LCP, phone keypad, reverse integer, volume — with interactive terminal.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm text-emerald-300/80 group-hover:text-emerald-300 transition">
              <Play size={14} />
              Open tutorial
            </div>
          </div>
        </button>

        <div className="rounded-2xl border border-slate-700/50 bg-[#111827]/60 p-6 flex flex-col justify-center opacity-60">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700">
              Tutorial 2
            </span>
          </div>
          <h2 className="text-lg font-semibold text-slate-400">Coming soon</h2>
          <p className="text-sm text-slate-500 mt-2">More Python labs will appear here.</p>
        </div>
      </div>
    </div>
  );
}

export default PythonTutorialPage;
