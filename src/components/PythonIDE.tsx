import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play,
  RotateCcw,
  Terminal,
  Code2,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

/* ---------- Pyodide singleton ---------- */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideReady: Promise<any> | null = null;

function loadPyodideSingleton() {
  if (pyodideReady) return pyodideReady;
  pyodideReady = (async () => {
    if (!(window as unknown as { loadPyodide?: unknown }).loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js";
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Failed to load Pyodide"));
        document.head.appendChild(s);
      });
    }
    return await (window as unknown as { loadPyodide: (o: object) => Promise<unknown> }).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.26.2/full/",
    });
  })();
  return pyodideReady;
}

export interface TestCase {
  input: string;
  expected: string;
}

interface Props {
  starter?: string;
  testCases?: TestCase[];
  height?: number;
}

type TermLine = {
  kind: "out" | "err" | "in" | "sys" | "ok" | "fail" | "prompt";
  text: string;
};

function now() {
  return new Date().toLocaleTimeString([], {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function PythonIDE({ starter = "", testCases = [], height }: Props) {
  const [code, setCode] = useState(starter);
  const [stdin, setStdin] = useState("");
  const [showInput, setShowInput] = useState(true);
  const [term, setTerm] = useState<TermLine[]>([
    { kind: "sys", text: `${now()}  Python 3 ready · Run or Ctrl+Enter · input() asks you while running` },
  ]);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lastResult, setLastResult] = useState<"pass" | "fail" | null>(null);
  const [waitingInput, setWaitingInput] = useState(false);
  const [liveLine, setLiveLine] = useState("");

  const termEnd = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const liveInputRef = useRef<HTMLInputElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pyRef = useRef<any>(null);

  // Pre-queued lines (from Input panel) consumed first
  const queueRef = useRef<string[]>([]);

  useEffect(() => {
    termEnd.current?.scrollIntoView({ behavior: "smooth" });
  }, [term]);

  useEffect(() => {
    setCode(starter);
  }, [starter]);

  useEffect(() => {
    if (waitingInput) {
      setTimeout(() => liveInputRef.current?.focus(), 30);
    }
  }, [waitingInput]);

  const push = useCallback((kind: TermLine["kind"], text: string) => {
    setTerm((t) => [...t, { kind, text }]);
  }, []);

  const clearTerm = () => {
    setTerm([{ kind: "sys", text: `${now()}  Console cleared.` }]);
    setLastResult(null);
  };

  /** Sync gutter scroll with editor */
  const onEditorScroll = () => {
    if (editorRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = editorRef.current.scrollTop;
    }
  };

  const lineCount = Math.max(code.split("\n").length, 1);
  const gutterLines = Array.from({ length: lineCount }, (_, i) => i + 1);

  const splitVisual = (s: string, kind: "out" | "err") => {
    const parts = s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    parts.forEach((ln, i) => {
      if (i < parts.length - 1 || ln !== "") push(kind, ln);
    });
  };

  /**
   * input() while running:
   * 1) Use lines from Input queue first
   * 2) Else window.prompt (sync) — only reliable way in browser without SharedArrayBuffer
   *    Prompt text + answer are echoed into the terminal so it still feels like a console.
   */
  const installInteractiveInput = async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    py: any
  ) => {
    py.setStdout({
      batched: (s: string) => {
        if (s) splitVisual(s, "out");
      },
    });
    py.setStderr({
      batched: (s: string) => {
        if (s) splitVisual(s, "err");
      },
    });

    const jsInput = (promptText: string): string => {
      const p = promptText ?? "";

      if (queueRef.current.length > 0) {
        const line = queueRef.current.shift()!;
        if (p) push("prompt", p.replace(/\n$/, ""));
        push("in", line);
        return line;
      }

      if (p) push("prompt", p.replace(/\n$/, ""));
      setWaitingInput(true);
      const answer = window.prompt(p || "Program is waiting for input:") ?? "";
      setWaitingInput(false);
      push("in", answer);
      return answer;
    };

    py.globals.set("_js_input", jsInput);

    await py.runPythonAsync(`
def _interactive_input(prompt=""):
    return _js_input(str(prompt) if prompt is not None else "")

__builtins__.input = _interactive_input
`);
  };

  const runCode = async () => {
    if (running) return;
    setRunning(true);
    setLastResult(null);
    push("sys", `${now()}  ──── Run ────`);

    const raw = stdin.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = raw.split("\n");
    if (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
    queueRef.current = lines[0] === "" && lines.length === 1 ? [] : [...lines];

    try {
      if (!pyRef.current) {
        setLoading(true);
        push("sys", "Loading Python runtime (first time)…");
        pyRef.current = await loadPyodideSingleton();
        setLoading(false);
        push("sys", "Runtime ready.");
      }
      const py = pyRef.current;

      await installInteractiveInput(py);

      if (queueRef.current.length) {
        push("sys", `stdin queue: ${queueRef.current.length} line(s), then interactive`);
      }

      await py.runPythonAsync(code);
      push("sys", `${now()}  ──── Done ────`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      msg
        .split("\n")
        .filter(Boolean)
        .slice(-8)
        .forEach((ln) => push("err", ln));
      push("sys", `${now()}  ──── Error ────`);
    } finally {
      setRunning(false);
      setLoading(false);
      setWaitingInput(false);
      queueRef.current = [];
    }
  };

  const runTests = async () => {
    if (!testCases.length) {
      push("sys", "No sample tests for this problem.");
      return;
    }
    setRunning(true);
    setLastResult(null);
    push("sys", `${now()}  ──── ${testCases.length} sample test(s) ────`);

    try {
      if (!pyRef.current) {
        setLoading(true);
        push("sys", "Loading Python runtime…");
        pyRef.current = await loadPyodideSingleton();
        setLoading(false);
      }
      const py = pyRef.current;
      let allPass = true;

      const normalize = (s: string) =>
        s.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().replace(/[’′]/g, "'");

      for (let i = 0; i < testCases.length; i++) {
        const tc = testCases[i];
        push("sys", `▸ Test ${i + 1}`);

        const inputLines = tc.input.replace(/\r\n/g, "\n").split("\n");
        if (inputLines.length && inputLines[inputLines.length - 1] === "") inputLines.pop();
        inputLines.forEach((ln) => push("in", ln));

        queueRef.current = [...inputLines];
        let captured = "";

        py.setStdout({
          batched: (s: string) => {
            captured += s;
            if (s) splitVisual(s, "out");
          },
        });
        py.setStderr({
          batched: (s: string) => {
            if (s) splitVisual(s, "err");
          },
        });

        py.globals.set("_js_input", (promptText: string) => {
          if (queueRef.current.length > 0) {
            const line = queueRef.current.shift()!;
            if (promptText) push("prompt", String(promptText).replace(/\n$/, ""));
            return line;
          }
          throw new Error("EOFError: no more test input");
        });
        await py.runPythonAsync(`
def _interactive_input(prompt=""):
    return _js_input(str(prompt) if prompt is not None else "")
__builtins__.input = _interactive_input
`);

        try {
          await py.runPythonAsync(code);
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          msg.split("\n").slice(-4).forEach((ln) => ln && push("err", ln));
          allPass = false;
          push("fail", `✗ Test ${i + 1} errored`);
          continue;
        }

        if (normalize(captured) === normalize(tc.expected)) {
          push("ok", `✓ Test ${i + 1} passed`);
        } else {
          allPass = false;
          push("fail", `✗ Test ${i + 1} failed`);
          push("sys", "Expected:");
          tc.expected.split("\n").forEach((ln) => push("prompt", ln));
        }
      }

      setLastResult(allPass ? "pass" : "fail");
      push(
        "sys",
        allPass ? `${now()}  ──── All passed ────` : `${now()}  ──── Some failed ────`
      );
    } catch (e: unknown) {
      push("err", e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
      setLoading(false);
      queueRef.current = [];
    }
  };

  const onKeyDownEditor = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      runCode();
    }
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = editorRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const next = code.slice(0, start) + "    " + code.slice(end);
      setCode(next);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 4;
      });
    }
  };

  const onLiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = liveLine;
    setLiveLine("");
    if (!v) return;
    setStdin((prev) => {
      const base = prev.replace(/\s+$/, "");
      return base ? base + "\n" + v : v;
    });
    push("sys", `queued stdin: ${v}`);
  };

  return (
    <div
      className="overflow-hidden bg-[#0a1220] flex flex-col h-full"
      style={height ? { height } : { height: "100%" }}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700/60 bg-slate-900/80 shrink-0">
        <div className="flex items-center gap-1.5 text-xs text-slate-400 mr-auto">
          <Code2 size={13} className="text-emerald-400/80" />
          <span className="font-medium text-slate-200">main.py</span>
          <span className="text-slate-600">· Python 3</span>
        </div>

        {lastResult === "pass" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">
            <CheckCircle2 size={12} /> Passed
          </span>
        )}
        {lastResult === "fail" && (
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
            <XCircle size={12} /> Failed
          </span>
        )}

        <button
          type="button"
          onClick={clearTerm}
          disabled={running}
          className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800 disabled:opacity-40"
        >
          <RotateCcw size={12} /> Clear
        </button>

        {testCases.length > 0 && (
          <button
            type="button"
            onClick={runTests}
            disabled={running || loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-violet-600/25 text-violet-300 border border-violet-500/40 hover:bg-violet-600/35 disabled:opacity-40"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
            Run Tests
          </button>
        )}

        <button
          type="button"
          onClick={runCode}
          disabled={running || loading}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/40 disabled:opacity-40"
        >
          {running || loading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
          {loading ? "Loading…" : running ? "Running…" : "Run"}
        </button>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Editor + line numbers */}
        <div className="flex-1 flex min-w-0 border-r border-slate-700/50">
          <div
            ref={gutterRef}
            className="shrink-0 w-11 overflow-hidden select-none bg-[#0b121c] border-r border-slate-800/80"
            aria-hidden
          >
            <div className="pt-3 pb-3">
              {gutterLines.map((n) => (
                <div
                  key={n}
                  className="h-[21px] text-[12px] leading-[21px] font-mono text-slate-600 text-right pr-2"
                >
                  {n}
                </div>
              ))}
            </div>
          </div>

          <textarea
            ref={editorRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={onKeyDownEditor}
            onScroll={onEditorScroll}
            spellCheck={false}
            className="flex-1 w-full h-full resize-none bg-[#0d1520] text-[12px] leading-[21px] text-cyan-50 font-mono pt-3 pb-3 pl-2 pr-3 outline-none"
            placeholder="# Write your Python 3 code here…"
            style={{ tabSize: 4 }}
          />
        </div>

        {/* Terminal */}
        <div className="w-[44%] min-w-[220px] flex flex-col bg-[#070d14]">
          <div className="border-b border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setShowInput((v) => !v)}
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200"
            >
              {showInput ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span className="font-medium">Input queue</span>
              <span className="text-slate-600 ml-1">(optional — used first, then interactive)</span>
            </button>
            {showInput && (
              <textarea
                value={stdin}
                onChange={(e) => setStdin(e.target.value)}
                spellCheck={false}
                rows={3}
                placeholder={"50 180\nor one value per line"}
                className="w-full resize-none bg-[#0a1018] text-[12.5px] leading-relaxed text-amber-100/90 font-mono px-3 py-2 outline-none border-t border-slate-800/60 placeholder:text-slate-600"
              />
            )}
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-500 border-b border-slate-800 shrink-0">
            <Terminal size={11} />
            <span>Terminal</span>
            {waitingInput && (
              <span className="ml-2 text-amber-400 animate-pulse">waiting for input…</span>
            )}
            <span className="ml-auto text-slate-600">{term.length}</span>
          </div>

          <div className="flex-1 overflow-y-auto font-mono text-[12px] leading-[1.55]">
            {term.map((l, i) => (
              <div
                key={i}
                className={`flex ${l.kind === "sys" ? "bg-slate-900/35" : ""}`}
              >
                <span className="shrink-0 w-8 text-right pr-2 py-0.5 text-[10px] text-slate-700 select-none border-r border-slate-800/40">
                  {i + 1}
                </span>
                <span
                  className={`flex-1 px-2 py-0.5 whitespace-pre-wrap break-words ${
                    l.kind === "in"
                      ? "text-cyan-300"
                      : l.kind === "out"
                      ? "text-emerald-300/90"
                      : l.kind === "err"
                      ? "text-rose-400"
                      : l.kind === "ok"
                      ? "text-emerald-400 font-medium"
                      : l.kind === "fail"
                      ? "text-rose-400 font-medium"
                      : l.kind === "prompt"
                      ? "text-amber-200/90"
                      : "text-slate-500"
                  }`}
                >
                  {l.kind === "in" && <span className="text-slate-600 select-none">‹ </span>}
                  {l.kind === "out" && <span className="text-slate-700 select-none">│ </span>}
                  {l.text}
                </span>
              </div>
            ))}
            <div ref={termEnd} />
          </div>

          <form
            onSubmit={onLiveSubmit}
            className={`border-t flex items-center gap-2 px-2 py-1.5 shrink-0 ${
              waitingInput
                ? "border-amber-500/40 bg-amber-950/30"
                : "border-slate-800 bg-[#050a10]"
            }`}
          >
            <span
              className={`font-mono text-sm ${
                waitingInput ? "text-amber-400 animate-pulse" : "text-slate-600"
              }`}
            >
              ›
            </span>
            <input
              ref={liveInputRef}
              value={liveLine}
              onChange={(e) => setLiveLine(e.target.value)}
              className="flex-1 bg-transparent outline-none font-mono text-[12.5px] text-slate-200 placeholder:text-slate-600"
              placeholder={
                waitingInput
                  ? "A dialog opened for input — answer it to continue"
                  : "Queue stdin (Enter) · or leave empty and answer dialogs while running"
              }
              autoComplete="off"
              spellCheck={false}
            />
          </form>
        </div>
      </div>
    </div>
  );
}

export default PythonIDE;
