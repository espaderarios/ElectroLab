import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  ChevronRight,
  Play,
  Pause,
  RotateCcw,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import {
  CONCEPTS,
  ConceptId,
  ConceptMeta,
} from "../concepts/conceptstopic";

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
          <p key={i} className="text-sm text-slate-300 leading-relaxed">{p}</p>
        ))}
      </div>
    </div>
  );
}

function DemoShell({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-4">
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

/* ---- Fourier Series ---- */
function FourierSeriesDemo(_p: { concept: ConceptMeta }) {
  const [harmonics, setHarmonics] = useState(5);
  const [playing, setPlaying] = useState(true);
  const [phase, setPhase] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw = useCallback((t: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(30,60,100,0.35)";
    for (let y = 0; y < H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 * Math.PI + t;
      const sq = Math.sign(Math.sin(tt)) * (mid * 0.7);
      if (x === 0) ctx.moveTo(x, mid - sq); else ctx.lineTo(x, mid - sq);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    ctx.shadowColor = "rgba(34,211,238,0.6)";
    ctx.shadowBlur = 8;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 * Math.PI + t;
      let y = 0;
      for (let k = 1; k <= harmonics; k += 2) y += (4 / (k * Math.PI)) * Math.sin(k * tt);
      const py = mid - y * mid * 0.7;
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px ui-monospace, monospace";
    ctx.fillText(`N = ${harmonics} odd harmonics`, 12, 22);
  }, [harmonics]);

  useEffect(() => {
    let last = performance.now(), raf = 0;
    const loop = (now: number) => {
      if (playing) setPhase((p) => p + ((now - last) / 1000) * 1.2);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  useEffect(() => { draw(phase); }, [phase, draw]);

  return (
    <DemoShell hint="Dashed = ideal square wave. Cyan = partial Fourier sum. More harmonics → sharper edges (Gibbs remains).">
      <canvas ref={canvasRef} width={640} height={220} className="w-full rounded-xl border border-slate-700/60 bg-[#0a1220]" />
      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Harmonics
          <input type="range" min={1} max={31} step={2} value={harmonics} onChange={(e) => setHarmonics(Number(e.target.value))} className="w-36 accent-cyan-400" />
          <span className="font-mono text-cyan-300 w-6">{harmonics}</span>
        </label>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 text-sm">
          {playing ? <Pause size={14} /> : <Play size={14} />} {playing ? "Pause" : "Play"}
        </button>
        <button type="button" onClick={() => setPhase(0)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/40 text-slate-300 border border-slate-600 text-sm">
          <RotateCcw size={14} /> Reset
        </button>
      </div>
    </DemoShell>
  );
}

/* ---- Amplitude / Phase ---- */
function SpectrumDemo(_p: { concept: ConceptMeta }) {
  const [amps, setAmps] = useState([0.8, 0.5, 0.35]);
  const [phases, setPhases] = useState([0, 1.0, 1.57]);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0, last = performance.now();
    const loop = (now: number) => {
      setT((p) => p + (now - last) / 1000);
      last = now;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 6 * Math.PI + t * 2;
      let y = 0;
      const freqs = [1, 3, 5];
      for (let i = 0; i < 3; i++) y += amps[i] * Math.cos(freqs[i] * tt + phases[i]);
      const py = mid - y * (mid * 0.55);
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
    const barX = W - 140;
    [1, 3, 5].forEach((f, i) => {
      const bx = barX + i * 40;
      const h = amps[i] * 70;
      ctx.fillStyle = `hsla(${180 + i * 40}, 80%, 55%, 0.85)`;
      ctx.fillRect(bx, mid + 20 - h, 22, h);
      ctx.fillStyle = "#94a3b8";
      ctx.font = "10px monospace";
      ctx.fillText(`${f}ω`, bx + 2, mid + 36);
    });
  }, [amps, phases, t]);

  return (
    <DemoShell hint="Green waveform = sum of three tones. Bars = amplitude spectrum. Phase shifts reshape the wave without changing frequencies.">
      <canvas ref={canvasRef} width={640} height={200} className="w-full rounded-xl border border-slate-700/60" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-lg bg-slate-800/50 border border-slate-700 p-3 space-y-2">
            <div className="text-xs text-slate-400">Component {i + 1} ({2 * i + 1}ω)</div>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              Amp
              <input type="range" min={0} max={1} step={0.05} value={amps[i]} onChange={(e) => { const n = [...amps]; n[i] = Number(e.target.value); setAmps(n); }} className="flex-1 accent-emerald-400" />
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              Phase
              <input type="range" min={0} max={6.28} step={0.1} value={phases[i]} onChange={(e) => { const n = [...phases]; n[i] = Number(e.target.value); setPhases(n); }} className="flex-1 accent-violet-400" />
            </label>
          </div>
        ))}
      </div>
    </DemoShell>
  );
}

/* ---- Convolution ---- */
function ConvolutionDemo(_p: { concept: ConceptMeta }) {
  const [n, setN] = useState(0);
  const [playing, setPlaying] = useState(true);
  const maxN = 18;
  const x = useMemo(() => {
    const arr = new Array(12).fill(0);
    for (let i = 0; i < 8; i++) arr[i] = Math.pow(0.75, i);
    return arr;
  }, []);
  const h = useMemo(() => [0.2, 0.5, 0.8, 1, 0.8, 0.5, 0.2], []);
  const yAt = useCallback((nn: number) => {
    let sum = 0;
    for (let k = 0; k < x.length; k++) {
      const hi = nn - k;
      if (hi >= 0 && hi < h.length) sum += x[k] * h[hi];
    }
    return sum;
  }, [x, h]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setN((p) => (p >= maxN ? 0 : p + 1)), 380);
    return () => clearInterval(id);
  }, [playing]);

  const bar = (val: number, max = 1.2, color: string) => (
    <div className="w-3 rounded-t-sm transition-all duration-200" style={{ height: Math.max(4, (Math.abs(val) / max) * 56), background: color, opacity: val === 0 ? 0.15 : 1 }} />
  );

  return (
    <DemoShell hint="Flip–slide–multiply–add. Green = products; their sum is y[n]. This is an FIR filter.">
      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="text-xs text-slate-400 mb-1.5 font-medium">x[k]</div>
          <div className="flex items-end gap-1 h-16">
            {x.map((v, i) => (
              <div key={i} className="flex flex-col items-center gap-0.5">
                {bar(v, 1.1, "#38bdf8")}
                <span className="text-[9px] text-slate-600">{i}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1.5 font-medium">h[n−k] — n = {n}</div>
          <div className="flex items-end gap-1 h-16">
            {Array.from({ length: 20 }).map((_, k) => {
              const hi = n - k;
              const val = hi >= 0 && hi < h.length ? h[hi] : 0;
              return (
                <div key={k} className="flex flex-col items-center gap-0.5">
                  {bar(val, 1.1, "#a78bfa")}
                  <span className="text-[9px] text-slate-600">{k}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1.5 font-medium">Product → y[{n}] = {yAt(n).toFixed(3)}</div>
          <div className="flex items-end gap-1 h-16">
            {Array.from({ length: 20 }).map((_, k) => {
              const hi = n - k;
              const hv = hi >= 0 && hi < h.length ? h[hi] : 0;
              const xv = k < x.length ? x[k] : 0;
              return <div key={k} className="flex flex-col items-center gap-0.5">{bar(xv * hv, 0.9, "#34d399")}</div>;
            })}
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/25 text-violet-300 border border-violet-500/40 text-sm">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <button type="button" onClick={() => setN(0)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700/40 text-slate-300 border border-slate-600 text-sm">
          <RotateCcw size={14} />
        </button>
      </div>
    </DemoShell>
  );
}

/* ---- Rect-Sinc ---- */
function RectSincDemo(_p: { concept: ConceptMeta }) {
  const [tau, setTau] = useState(2.5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, midY = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    const leftW = W * 0.42;
    ctx.strokeStyle = "rgba(30,60,100,0.4)";
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(leftW, midY); ctx.stroke();
    const half = (tau / 8) * (leftW * 0.6);
    const cx = leftW / 2;
    ctx.fillStyle = "rgba(56,189,248,0.35)";
    ctx.fillRect(cx - half, midY - 50, half * 2, 50);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - half, midY - 50, half * 2, 50);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`τ = ${tau.toFixed(1)}`, cx - 18, midY + 24);
    ctx.fillText("x(t)", 10, 20);
    const rightX0 = leftW + 20;
    const rightW = W - rightX0 - 10;
    ctx.strokeStyle = "rgba(30,60,100,0.4)";
    ctx.beginPath(); ctx.moveTo(rightX0, midY); ctx.lineTo(W - 10, midY); ctx.stroke();
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i < rightW; i++) {
      const omega = ((i / rightW) * 2 - 1) * 12;
      const arg = (omega * tau) / 2;
      const sinc = arg === 0 ? 1 : Math.sin(arg) / arg;
      const py = midY - tau * sinc * 12;
      if (i === 0) ctx.moveTo(rightX0 + i, py); else ctx.lineTo(rightX0 + i, py);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("X(ω) = τ sinc(ωτ/2π)", rightX0, 20);
  }, [tau]);
  return (
    <DemoShell hint="Wider pulse → narrower main lobe (time–frequency duality).">
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Pulse width τ
        <input type="range" min={0.6} max={6} step={0.1} value={tau} onChange={(e) => setTau(Number(e.target.value))} className="w-48 accent-violet-400" />
        <span className="font-mono text-violet-300">{tau.toFixed(1)}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Bandlimited ---- */
function BandlimitedDemo(_p: { concept: ConceptMeta }) {
  const [B, setB] = useState(3);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.04); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "rgba(52,211,153,0.25)";
    const halfBW = (B / 8) * (W * 0.35);
    const cx = W * 0.22;
    ctx.fillRect(cx - halfBW, mid - 40, halfBW * 2, 40);
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - halfBW, mid - 40, halfBW * 2, 40);
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText(`B = ${B}`, cx - 20, mid + 20);
    ctx.fillText("X(ω)", 12, 18);
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 2;
    ctx.beginPath();
    const x0 = W * 0.48;
    for (let i = 0; i < W - x0 - 10; i++) {
      const tt = (i / (W - x0)) * 8 + t;
      let y = 0;
      for (let k = 1; k <= B; k++) y += Math.cos(k * tt) / (k * k);
      const py = mid - y * 18;
      if (i === 0) ctx.moveTo(x0 + i, py); else ctx.lineTo(x0 + i, py);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.fillText("x(t)", x0, 18);
  }, [B, t]);
  return (
    <DemoShell hint="Higher B → sharper time features. True time-limited signals cannot be bandlimited.">
      <canvas ref={canvasRef} width={640} height={160} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Bandwidth B
        <input type="range" min={1} max={8} step={1} value={B} onChange={(e) => setB(Number(e.target.value))} className="w-40 accent-emerald-400" />
        <span className="font-mono text-emerald-300">{B}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Even/Odd ---- */
function EvenOddDemo(_p: { concept: ConceptMeta }) {
  const [mode, setMode] = useState<"even" | "odd">("even");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, midY = H / 2, midX = W / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.beginPath(); ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.moveTo(midX, 0); ctx.lineTo(midX, H); ctx.stroke();
    ctx.strokeStyle = mode === "even" ? "#38bdf8" : "#f472b6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      const t = (i / W) * 6 - 3;
      const y = mode === "even" ? Math.exp(-t * t * 0.8) : t * Math.exp(-t * t * 0.9);
      const py = midY - y * 55;
      if (i === 0) ctx.moveTo(i, py); else ctx.lineTo(i, py);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "13px sans-serif";
    ctx.fillText(mode === "even" ? "Even: x(t)=x(−t) → real cosine FT" : "Odd: x(t)=−x(−t) → imaginary sine FT", 16, 24);
  }, [mode]);
  return (
    <DemoShell>
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("even")} className={`px-4 py-1.5 rounded-lg text-sm border ${mode === "even" ? "bg-cyan-600/30 border-cyan-400 text-cyan-200" : "bg-slate-800 border-slate-600 text-slate-400"}`}>Even</button>
        <button type="button" onClick={() => setMode("odd")} className={`px-4 py-1.5 rounded-lg text-sm border ${mode === "odd" ? "bg-pink-600/30 border-pink-400 text-pink-200" : "bg-slate-800 border-slate-600 text-slate-400"}`}>Odd</button>
      </div>
    </DemoShell>
  );
}

/* ---- Time shift ---- */
function TimeShiftDemo(_p: { concept: ConceptMeta }) {
  const [delay, setDelay] = useState(0.4);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.03); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(30,60,100,0.3)";
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
    const wave = (tt: number) => Math.exp(-Math.pow((tt % 6) - 3, 2)) * Math.sin(tt * 3);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 6 + t;
      const py = mid - wave(tt) * 50;
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.strokeStyle = "#f472b6";
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 6 + t - delay * 2;
      const py = mid - wave(tt) * 50;
      if (x === 0) ctx.moveTo(x, py); else ctx.lineTo(x, py);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = "#38bdf8";
    ctx.font = "12px sans-serif";
    ctx.fillText("x(t)", 12, 20);
    ctx.fillStyle = "#f472b6";
    ctx.fillText(`x(t−t₀)  t₀=${delay.toFixed(2)}`, 12, 38);
  }, [delay, t]);
  return (
    <DemoShell hint="Blue = original. Pink = delayed. Same magnitude spectrum; phase becomes −ω t₀.">
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Delay t₀
        <input type="range" min={0} max={1.5} step={0.05} value={delay} onChange={(e) => setDelay(Number(e.target.value))} className="w-48 accent-pink-400" />
        <span className="font-mono text-pink-300">{delay.toFixed(2)}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Freq shift / AM ---- */
function FreqShiftDemo(_p: { concept: ConceptMeta }) {
  const [fc, setFc] = useState(4);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.025); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(56,189,248,0.45)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 + t * 0.3;
      const msg = 0.6 * Math.sin(2 * Math.PI * 0.7 * tt);
      if (x === 0) ctx.moveTo(x, mid - msg * 40); else ctx.lineTo(x, mid - msg * 40);
    }
    ctx.stroke();
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 + t * 0.3;
      const msg = 1 + 0.6 * Math.sin(2 * Math.PI * 0.7 * tt);
      const y = msg * Math.sin(2 * Math.PI * fc * tt);
      if (x === 0) ctx.moveTo(x, mid - y * 28); else ctx.lineTo(x, mid - y * 28);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("message (faint) × carrier → AM", 12, 18);
  }, [fc, t]);
  return (
    <DemoShell hint="Faint blue = baseband. Purple = amplitude-modulated carrier. Spectrum copies appear at ±fc.">
      <canvas ref={canvasRef} width={640} height={200} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Carrier
        <input type="range" min={1.5} max={8} step={0.5} value={fc} onChange={(e) => setFc(Number(e.target.value))} className="w-40 accent-violet-400" />
        <span className="font-mono text-violet-300">{fc.toFixed(1)}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Time scale ---- */
function TimeScaleDemo(_p: { concept: ConceptMeta }) {
  const [a, setA] = useState(1);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.02); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148,163,184,0.4)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 8 - 4 + t * 0.5;
      const y = Math.exp(-tt * tt * 0.5) * Math.cos(tt * 4);
      if (x === 0) ctx.moveTo(x, mid - y * 55); else ctx.lineTo(x, mid - y * 55);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 8 - 4 + t * 0.5;
      const y = Math.exp(-(a * tt) * (a * tt) * 0.5) * Math.cos(a * tt * 4);
      if (x === 0) ctx.moveTo(x, mid - y * 55); else ctx.lineTo(x, mid - y * 55);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`a = ${a.toFixed(2)} (a>1 compresses time)`, 12, 20);
  }, [a, t]);
  return (
    <DemoShell hint="Gray = original. Cyan = x(at). Time compression expands the spectrum.">
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Scale a
        <input type="range" min={0.4} max={2.5} step={0.1} value={a} onChange={(e) => setA(Number(e.target.value))} className="w-48 accent-cyan-400" />
        <span className="font-mono text-cyan-300">{a.toFixed(1)}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Sampling ---- */
function SamplingDemo(_p: { concept: ConceptMeta }) {
  const [fs, setFs] = useState(8);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const f0 = 1.2;
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.02); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(56,189,248,0.5)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 + t * 0.4;
      const y = Math.sin(2 * Math.PI * f0 * tt);
      if (x === 0) ctx.moveTo(x, mid - y * 55); else ctx.lineTo(x, mid - y * 55);
    }
    ctx.stroke();
    const nSamples = Math.floor(fs * 2);
    ctx.fillStyle = "#f59e0b";
    for (let i = 0; i <= nSamples; i++) {
      const x = (i / nSamples) * W;
      const tt = (i / nSamples) * 4 + t * 0.4;
      const y = Math.sin(2 * Math.PI * f0 * tt);
      const py = mid - y * 55;
      ctx.beginPath(); ctx.moveTo(x, mid); ctx.lineTo(x, py);
      ctx.strokeStyle = "rgba(245,158,11,0.35)"; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, py, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`f₀=${f0}  fₛ=${fs}  Nyquist=${2 * f0}`, 12, 20);
  }, [fs, t]);
  return (
    <DemoShell hint="Blue continuous sine, orange sample stems. When fₛ > 2f₀ the samples uniquely determine the wave.">
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Sample rate fₛ
        <input type="range" min={2} max={16} step={1} value={fs} onChange={(e) => setFs(Number(e.target.value))} className="w-40 accent-amber-400" />
        <span className="font-mono text-amber-300">{fs}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Aliasing ---- */
function AliasingDemo(_p: { concept: ConceptMeta }) {
  const [f, setF] = useState(3.5);
  const fs = 4;
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.025); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 3 + t * 0.3;
      const y = Math.sin(2 * Math.PI * f * tt);
      if (x === 0) ctx.moveTo(x, mid - y * 50); else ctx.lineTo(x, mid - y * 50);
    }
    ctx.stroke();
    const n = 24;
    const aliasF = Math.abs(f - Math.round(f / fs) * fs);
    ctx.fillStyle = "#f59e0b";
    for (let i = 0; i <= n; i++) {
      const x = (i / n) * W;
      const tt = (i / n) * 3 + t * 0.3;
      const y = Math.sin(2 * Math.PI * f * tt);
      ctx.beginPath(); ctx.arc(x, mid - y * 50, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#f472b6";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 3 + t * 0.3;
      const y = Math.sin(2 * Math.PI * aliasF * tt);
      if (x === 0) ctx.moveTo(x, mid - y * 50); else ctx.lineTo(x, mid - y * 50);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText(`True f=${f.toFixed(1)}  fₛ=${fs}  apparent≈${aliasF.toFixed(2)}`, 12, 20);
  }, [f, t]);
  return (
    <DemoShell hint="Gray = true high-freq. Orange dots = samples at fₛ=4. Pink = false lower frequency the samples suggest.">
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        True frequency
        <input type="range" min={0.5} max={7} step={0.1} value={f} onChange={(e) => setF(Number(e.target.value))} className="w-40 accent-pink-400" />
        <span className="font-mono text-pink-300">{f.toFixed(1)}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Impulse / Step ---- */
function ImpulseStepDemo(_p: { concept: ConceptMeta }) {
  const [mode, setMode] = useState<"impulse" | "step">("impulse");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2, t0 = W * 0.25;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.beginPath(); ctx.moveTo(0, mid); ctx.lineTo(W, mid); ctx.stroke();
    if (mode === "impulse") {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(t0, mid); ctx.lineTo(t0, mid - 70); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(t0 - 6, mid - 60); ctx.lineTo(t0, mid - 70); ctx.lineTo(t0 + 6, mid - 60); ctx.stroke();
      ctx.fillStyle = "#22d3ee";
      ctx.font = "13px sans-serif";
      ctx.fillText("δ(t)", t0 + 10, mid - 55);
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = t0; x < W; x++) {
        const tt = (x - t0) / 80;
        const y = Math.exp(-tt);
        if (x === t0) ctx.moveTo(x, mid - y * 60); else ctx.lineTo(x, mid - y * 60);
      }
      ctx.stroke();
      ctx.fillStyle = "#a78bfa";
      ctx.fillText("h(t)=e^{−t}u(t)", t0 + 80, mid - 40);
    } else {
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(0, mid + 30); ctx.lineTo(t0, mid + 30); ctx.lineTo(t0, mid - 40); ctx.lineTo(W, mid - 40); ctx.stroke();
      ctx.fillStyle = "#22d3ee";
      ctx.fillText("u(t)", t0 + 10, mid - 50);
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = t0; x < W; x++) {
        const tt = (x - t0) / 80;
        const y = 1 - Math.exp(-tt);
        if (x === t0) ctx.moveTo(x, mid - y * 50); else ctx.lineTo(x, mid - y * 50);
      }
      ctx.stroke();
      ctx.fillStyle = "#a78bfa";
      ctx.fillText("step response = ∫h", t0 + 100, mid + 10);
    }
  }, [mode]);
  return (
    <DemoShell hint="Impulse response h(t) fully characterizes an LTI system. Step response = running integral of h.">
      <canvas ref={canvasRef} width={640} height={180} className="w-full rounded-xl border border-slate-700/60" />
      <div className="flex gap-2">
        <button type="button" onClick={() => setMode("impulse")} className={`px-4 py-1.5 rounded-lg text-sm border ${mode === "impulse" ? "bg-cyan-600/30 border-cyan-400 text-cyan-200" : "bg-slate-800 border-slate-600 text-slate-400"}`}>Impulse δ(t)</button>
        <button type="button" onClick={() => setMode("step")} className={`px-4 py-1.5 rounded-lg text-sm border ${mode === "step" ? "bg-violet-600/30 border-violet-400 text-violet-200" : "bg-slate-800 border-slate-600 text-slate-400"}`}>Step u(t)</button>
      </div>
    </DemoShell>
  );
}

/* ---- Freq response ---- */
function FreqResponseDemo(_p: { concept: ConceptMeta }) {
  const [f, setF] = useState(1);
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gain = 1 / Math.sqrt(1 + Math.pow(f / 2, 4));
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.03); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    const midL = H / 2;
    ctx.strokeStyle = "rgba(56,189,248,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < W * 0.55; x++) {
      const tt = (x / (W * 0.55)) * 4 + t;
      const y = Math.sin(2 * Math.PI * f * tt * 0.5);
      if (x === 0) ctx.moveTo(x, midL - y * 40); else ctx.lineTo(x, midL - y * 40);
    }
    ctx.stroke();
    ctx.strokeStyle = "#34d399";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W * 0.55; x++) {
      const tt = (x / (W * 0.55)) * 4 + t;
      const y = gain * Math.sin(2 * Math.PI * f * tt * 0.5);
      if (x === 0) ctx.moveTo(x, midL - y * 40); else ctx.lineTo(x, midL - y * 40);
    }
    ctx.stroke();
    const x0 = W * 0.6, plotW = W * 0.35;
    ctx.strokeStyle = "rgba(100,116,139,0.4)";
    ctx.beginPath(); ctx.moveTo(x0, H - 30); ctx.lineTo(x0 + plotW, H - 30); ctx.moveTo(x0, 20); ctx.lineTo(x0, H - 30); ctx.stroke();
    ctx.strokeStyle = "#a78bfa";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < plotW; i++) {
      const freq = 0.2 + (i / plotW) * 8;
      const g = 1 / Math.sqrt(1 + Math.pow(freq / 2, 4));
      const py = H - 30 - g * (H - 60);
      if (i === 0) ctx.moveTo(x0 + i, py); else ctx.lineTo(x0 + i, py);
    }
    ctx.stroke();
    const mx = x0 + ((f - 0.2) / 8) * plotW;
    const mg = 1 / Math.sqrt(1 + Math.pow(f / 2, 4));
    const my = H - 30 - mg * (H - 60);
    ctx.fillStyle = "#f59e0b";
    ctx.beginPath(); ctx.arc(mx, my, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText("in", 8, 16);
    ctx.fillStyle = "#34d399";
    ctx.fillText("out", 30, 16);
    ctx.fillStyle = "#a78bfa";
    ctx.fillText("|H(jω)|", x0, 16);
  }, [f, t, gain]);
  return (
    <DemoShell hint="Blue = input. Green = filtered output. Purple = magnitude response; orange dot = current f.">
      <canvas ref={canvasRef} width={640} height={200} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Frequency
        <input type="range" min={0.3} max={6} step={0.1} value={f} onChange={(e) => setF(Number(e.target.value))} className="w-40 accent-emerald-400" />
        <span className="font-mono text-emerald-300">{f.toFixed(1)} · gain {gain.toFixed(2)}</span>
      </label>
    </DemoShell>
  );
}

/* ---- Correlation ---- */
function CorrelationDemo(_p: { concept: ConceptMeta }) {
  const [lag, setLag] = useState(0);
  const [playing, setPlaying] = useState(true);
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setLag((p) => (p >= 20 ? -10 : p + 1)), 200);
    return () => clearInterval(id);
  }, [playing]);
  const a = [0, 0, 0.3, 0.8, 1, 0.8, 0.3, 0, 0, 0, 0, 0];
  const b = [0, 0, 0, 0.3, 0.8, 1, 0.8, 0.3, 0, 0, 0, 0];
  let corr = 0;
  for (let i = 0; i < a.length; i++) {
    const j = i + lag;
    if (j >= 0 && j < b.length) corr += a[i] * b[j];
  }
  const bar = (v: number, color: string) => (
    <div className="w-4 rounded-t-sm" style={{ height: Math.max(3, Math.abs(v) * 50), background: color, opacity: v === 0 ? 0.2 : 1 }} />
  );
  return (
    <DemoShell hint="Slide one signal across the other. Correlation peaks at best alignment — principle of a matched filter.">
      <div className="space-y-3">
        <div>
          <div className="text-xs text-slate-400 mb-1">x</div>
          <div className="flex items-end gap-1 h-14">{a.map((v, i) => <div key={i}>{bar(v, "#38bdf8")}</div>)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-1">y shifted by lag={lag}</div>
          <div className="flex items-end gap-1 h-14" style={{ marginLeft: Math.max(0, lag) * 20 }}>
            {b.map((v, i) => <div key={i}>{bar(v, "#a78bfa")}</div>)}
          </div>
        </div>
        <div className="text-sm text-emerald-300 font-mono">Rₓᵧ ≈ {corr.toFixed(3)}</div>
      </div>
      <div className="flex gap-3 items-center">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Lag
          <input type="range" min={-10} max={20} value={lag} onChange={(e) => setLag(Number(e.target.value))} className="w-40 accent-violet-400" />
        </label>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600/25 text-violet-300 border border-violet-500/40 text-sm">
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </DemoShell>
  );
}

/* ---- Parseval ---- */
function ParsevalDemo(_p: { concept: ConceptMeta }) {
  const [amps, setAmps] = useState([0.9, 0.5, 0.3]);
  const energy = amps.reduce((s, a) => s + a * a, 0) * 0.5;
  return (
    <DemoShell hint="Energy from time amplitudes equals energy from frequency amplitudes (Parseval). Both totals stay equal.">
      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="text-xs text-slate-400 mb-2">Time amplitudes</div>
          {amps.map((a, i) => (
            <label key={i} className="flex items-center gap-2 text-xs text-slate-300 mb-2">
              A{i + 1}
              <input type="range" min={0} max={1} step={0.05} value={a} onChange={(e) => { const n = [...amps]; n[i] = Number(e.target.value); setAmps(n); }} className="flex-1 accent-cyan-400" />
              <span className="font-mono w-8 text-cyan-300">{a.toFixed(2)}</span>
            </label>
          ))}
          <div className="mt-3 text-sm text-cyan-300 font-mono">Σ|x|² ≈ {energy.toFixed(3)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400 mb-2">|X|² bars</div>
          <div className="flex items-end gap-3 h-24">
            {amps.map((a, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <div className="w-8 rounded-t bg-violet-500/80 transition-all" style={{ height: a * a * 80 }} />
                <span className="text-[10px] text-slate-500">{i + 1}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 text-sm text-violet-300 font-mono">Σ|X|² ≈ {energy.toFixed(3)}</div>
        </div>
      </div>
    </DemoShell>
  );
}

/* ---- z-plane ---- */
function ZTransformDemo(_p: { concept: ConceptMeta }) {
  const [theta, setTheta] = useState(0.8);
  const [r, setR] = useState(0.7);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, cx = W / 2, cy = H / 2;
    const R = Math.min(W, H) * 0.35;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(100,116,139,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - R - 10, cy); ctx.lineTo(cx + R + 10, cy); ctx.moveTo(cx, cy - R - 10); ctx.lineTo(cx, cy + R + 10); ctx.stroke();
    const drawPole = (px: number, py: number) => {
      ctx.strokeStyle = "#f472b6";
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px - 6, py - 6); ctx.lineTo(px + 6, py + 6); ctx.moveTo(px + 6, py - 6); ctx.lineTo(px - 6, py + 6); ctx.stroke();
    };
    drawPole(cx + r * R * Math.cos(theta), cy - r * R * Math.sin(theta));
    drawPole(cx + r * R * Math.cos(theta), cy + r * R * Math.sin(theta));
    ctx.strokeStyle = "#22d3ee";
    ctx.beginPath(); ctx.arc(cx, cy, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("Unit circle |z|=1 (DTFT)", 12, 20);
    ctx.fillStyle = "#f472b6";
    ctx.fillText(`Poles r=${r.toFixed(2)} ∠±${theta.toFixed(2)}`, 12, 38);
    ctx.fillStyle = r < 1 ? "#34d399" : "#f87171";
    ctx.fillText(r < 1 ? "Stable (inside)" : "Unstable (outside)", 12, H - 14);
  }, [theta, r]);
  return (
    <DemoShell hint="Pink × = poles. Cyan ○ = zero. DTFT = H(z) on the unit circle. Poles inside → stable (causal).">
      <canvas ref={canvasRef} width={400} height={280} className="w-full max-w-md mx-auto rounded-xl border border-slate-700/60" />
      <div className="flex flex-wrap gap-4 justify-center">
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Angle
          <input type="range" min={0.1} max={3} step={0.1} value={theta} onChange={(e) => setTheta(Number(e.target.value))} className="w-28 accent-pink-400" />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          Radius r
          <input type="range" min={0.2} max={1.3} step={0.05} value={r} onChange={(e) => setR(Number(e.target.value))} className="w-28 accent-pink-400" />
        </label>
      </div>
    </DemoShell>
  );
}

/* ---- Diff / Int ---- */
function DiffIntDemo(_p: { concept: ConceptMeta }) {
  const [t, setT] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => { setT((p) => p + 0.03); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 * Math.PI + t;
      if (x === 0) ctx.moveTo(x, mid - Math.sin(tt) * 40); else ctx.lineTo(x, mid - Math.sin(tt) * 40);
    }
    ctx.stroke();
    ctx.strokeStyle = "#f472b6";
    ctx.beginPath();
    for (let x = 0; x < W; x++) {
      const tt = (x / W) * 4 * Math.PI + t;
      if (x === 0) ctx.moveTo(x, mid - Math.cos(tt) * 40); else ctx.lineTo(x, mid - Math.cos(tt) * 40);
    }
    ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.font = "12px sans-serif";
    ctx.fillText("sin", 12, 20);
    ctx.fillStyle = "#f472b6";
    ctx.fillText("d/dt → cos  (× jω)", 12, 38);
  }, [t]);
  return (
    <DemoShell hint="Blue = sine. Pink = derivative (cosine). Differentiation multiplies spectrum by jω.">
      <canvas ref={canvasRef} width={640} height={160} className="w-full rounded-xl border border-slate-700/60" />
    </DemoShell>
  );
}

/* ---- FT duality pulse ---- */
function FourierTransformDemo(_p: { concept: ConceptMeta }) {
  const [width, setWidth] = useState(1.2);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height, mid = H / 2;
    ctx.fillStyle = "#0a1220";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = 0; x < W * 0.45; x++) {
      const t = (x / (W * 0.45)) * 6 - 3;
      const y = Math.exp(-t * t * width);
      if (x === 0) ctx.moveTo(x, mid - y * 60); else ctx.lineTo(x, mid - y * 60);
    }
    ctx.stroke();
    ctx.fillStyle = "#94a3b8";
    ctx.font = "11px sans-serif";
    ctx.fillText("x(t)", 8, 18);
    ctx.strokeStyle = "#a78bfa";
    const x0 = W * 0.55;
    ctx.beginPath();
    for (let i = 0; i < W * 0.4; i++) {
      const w = (i / (W * 0.4)) * 8 - 4;
      const y = Math.exp(-w * w / (4 * width)) / Math.sqrt(width);
      if (i === 0) ctx.moveTo(x0 + i, mid - y * 50); else ctx.lineTo(x0 + i, mid - y * 50);
    }
    ctx.stroke();
    ctx.fillText("X(ω)", x0, 18);
  }, [width]);
  return (
    <DemoShell hint="Left = time pulse. Right = FT. Narrower in time → broader in frequency.">
      <canvas ref={canvasRef} width={640} height={160} className="w-full rounded-xl border border-slate-700/60" />
      <label className="flex items-center gap-3 text-sm text-slate-300">
        Time concentration
        <input type="range" min={0.3} max={3} step={0.1} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="w-40 accent-violet-400" />
      </label>
    </DemoShell>
  );
}

const DEMO: Record<ConceptId, React.FC<{ concept: ConceptMeta }>> = {
  "fourier-series": FourierSeriesDemo,
  "amplitude-phase": SpectrumDemo,
  convolution: ConvolutionDemo,
  "rect-pulse-ft": RectSincDemo,
  bandlimited: BandlimitedDemo,
  "even-odd": EvenOddDemo,
  "fourier-transform": FourierTransformDemo,
  "time-shifting": TimeShiftDemo,
  "frequency-shifting": FreqShiftDemo,
  "time-scaling": TimeScaleDemo,
  "differentiation-integration": DiffIntDemo,
  parseval: ParsevalDemo,
  "energy-power-spectrum": ParsevalDemo,
  "impulse-step": ImpulseStepDemo,
  sampling: SamplingDemo,
  aliasing: AliasingDemo,
  "frequency-response": FreqResponseDemo,
  "transfer-function": ZTransformDemo,
  modulation: FreqShiftDemo,
  correlation: CorrelationDemo,
  "discrete-time-ft": SamplingDemo,
  dtft: ZTransformDemo,
  "z-transform": ZTransformDemo,
};

export function ConceptsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const topicFromQuery = searchParams.get("topic");
  const topicFromState = (location.state as { topicId?: string } | null)?.topicId ?? null;

  const initialId = (() => {
    const raw = topicFromQuery || topicFromState;
    if (!raw) return null;
    return CONCEPTS.some((c) => c.id === raw) ? (raw as ConceptId) : null;
  })();

  const [active, setActive] = useState<ConceptId | null>(initialId);

  // Open the topic when arriving from the corridor (or any deep link)
  useEffect(() => {
    const raw = searchParams.get("topic") || (location.state as { topicId?: string } | null)?.topicId;
    if (!raw) return;
    if (!CONCEPTS.some((c) => c.id === raw)) return;
    setActive(raw as ConceptId);
  }, [searchParams, location.state]);

  const selectConcept = (id: ConceptId | null) => {
    setActive(id);
    if (id) {
      setSearchParams({ topic: id }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const meta = CONCEPTS.find((c) => c.id === active);
  const Demo = active ? DEMO[active] : null;

  if (active && meta && Demo) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="max-w-4xl mx-auto p-6 space-y-6">
          <button type="button" onClick={() => selectConcept(null)} className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-cyan-300 transition">
            <ArrowLeft size={16} /> All concepts
          </button>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center shrink-0">
              <meta.icon size={22} />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-100">{meta.title}</h1>
              <p className="text-sm text-slate-400 mt-0.5">{meta.subtitle}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {meta.tags.map((t) => (
                  <span key={t} className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">{t}</span>
                ))}
              </div>
            </div>
          </div>
          <FormulaBox formula={meta.formula} note={meta.formulaNote} />
          <DiscussionCard paragraphs={meta.discussion} />
          <div className="rounded-2xl border border-slate-700/70 bg-[#0c1524] p-5">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Interactive demo</div>
            <Demo concept={meta} />
          </div>
          <RealLifeCard text={meta.realLife} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-6">
        <div className="flex items-center gap-2.5 mb-1">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
            <BookOpen size={18} />
          </div>
          <h1 className="text-xl font-semibold">Concepts Lab</h1>
        </div>
        <p className="text-sm text-slate-500 mt-0.5 max-w-2xl">
          Unique interactive animation for every topic — Fourier, LTI, sampling, modulation, z-plane, and more. Each card has formula, theory discussion, live visual, and real-world context.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CONCEPTS.map((c) => {
          const Icon = c.icon;
          return (
            <button key={c.id} type="button" onClick={() => selectConcept(c.id)} className="text-left group bg-[#111827] border border-[#1e293b] hover:border-cyan-500/40 rounded-xl p-5 flex flex-col transition shadow-sm hover:shadow-[0_0_24px_rgba(0,180,255,0.12)]">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center group-hover:bg-cyan-500/20 transition">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-slate-100 group-hover:text-cyan-200 transition">{c.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.subtitle}</div>
                </div>
                <ChevronRight size={16} className="text-slate-600 group-hover:text-cyan-400 transition shrink-0 mt-1" />
              </div>
              <p className="text-xs text-slate-400 mt-3 line-clamp-2 flex-1">{c.realLife.slice(0, 110)}…</p>
              <div className="flex flex-wrap gap-1 mt-3">
                {c.tags.slice(0, 3).map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-500">{t}</span>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ConceptsPage;
