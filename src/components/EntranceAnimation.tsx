import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Zap } from "lucide-react";
import boardBackground from "../assets/pcb-neon-bg.webp";
import logo from "../assets/electrolab-logo-transparent.webp";
import "./EntranceAnimation.css";

const TRACES = [
  { d: "M -80 100 H 170 L 260 190 H 565 L 680 305", delay: "-.4s", length: "3.1s" },
  { d: "M -75 248 H 176 L 298 124 H 492 L 640 272", delay: "-1.4s", length: "3.7s" },
  { d: "M 96 950 V 662 L 280 480 H 524 L 648 356", delay: "-2.6s", length: "3.4s" },
  { d: "M 350 980 V 780 H 425 L 670 535", delay: "-1.7s", length: "2.8s" },
  { d: "M 1680 95 H 1402 L 1250 248 H 1050 L 936 362", delay: "-2.2s", length: "3.2s" },
  { d: "M 1680 306 H 1420 L 1244 484 H 1012", delay: "-.7s", length: "3.9s" },
  { d: "M 1562 980 V 780 L 1368 585 H 1080 L 963 466", delay: "-1.9s", length: "3.5s" },
  { d: "M 1250 980 V 744 L 1117 610 H 943", delay: "-3s", length: "3.3s" },
  { d: "M 770 -80 V 156 L 658 268", delay: "-1.2s", length: "3.6s" },
  { d: "M 970 -80 V 160 L 1028 218", delay: "-2.6s", length: "4.1s" },
] as const;

function prefersLessMotion(): boolean {
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    const preferences = JSON.parse(localStorage.getItem("electrolab-prefs") || "{}");
    return preferences.reducedMotion === true;
  } catch {
    return false;
  }
}

/**
 * Short, skippable intro shown once per tab session (or replayed via Settings).
 * The board graphic comes from the user's reference; the moving circuit signals
 * and centered logo are real CSS/SVG animations, not a video dependency.
 */
export function EntranceAnimation({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const skipButton = useRef<HTMLButtonElement>(null);
  const completed = useRef(false);
  const finishRef = useRef(onComplete);
  finishRef.current = onComplete;

  const complete = useCallback(() => {
    if (completed.current) return;
    completed.current = true;
    finishRef.current();
  }, []);

  const skipIntro = useCallback(() => {
    setLeaving(true);
    window.setTimeout(complete, 480);
  }, [complete]);

  useEffect(() => {
    if (prefersLessMotion()) {
      complete();
      return;
    }
    skipButton.current?.focus({ preventScroll: true });
    const beginExit = window.setTimeout(() => setLeaving(true), 3850);
    const finalExit = window.setTimeout(complete, 4460);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" || event.key === "Enter") {
        if (event.key === "Escape" || document.activeElement === skipButton.current) {
          event.preventDefault();
          skipIntro();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(beginExit);
      window.clearTimeout(finalExit);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [complete, skipIntro]);

  return (
    <div
      className={`el-intro${leaving ? " el-intro--leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="ElectroLab opening animation"
    >
      <div
        className="el-intro__board"
        style={{ backgroundImage: `url("${boardBackground}")` }}
        aria-hidden="true"
      />
      <div className="el-intro__veil" aria-hidden="true" />
      <svg
        className="el-intro__signals"
        viewBox="0 0 1600 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="el-intro-signal" x1="0" x2="1">
            <stop offset="0%" stopColor="#0a62c7" stopOpacity="0" />
            <stop offset="36%" stopColor="#2ad7ff" stopOpacity=".95" />
            <stop offset="52%" stopColor="#ebffff" stopOpacity="1" />
            <stop offset="68%" stopColor="#2ad7ff" stopOpacity=".95" />
            <stop offset="100%" stopColor="#0b7bde" stopOpacity="0" />
          </linearGradient>
        </defs>
        {TRACES.map((trace, index) => (
          <path
            key={index}
            d={trace.d}
            fill="none"
            className="el-intro__signal"
            stroke="url(#el-intro-signal)"
            strokeWidth={index % 3 === 0 ? 4 : 3}
            strokeLinecap="round"
            style={{ animationDelay: trace.delay, animationDuration: trace.length }}
          />
        ))}
      </svg>
      <div className="el-intro__halo" aria-hidden="true" />
      <div className="el-intro__center">
        <div className="el-intro__microtext">
          <Zap size={13} aria-hidden="true" />
          POWERING UP THE FUTURE
        </div>
        <div className="el-intro__chip">
          <div className="el-intro__chip-gloss" aria-hidden="true" />
          <img className="el-intro__logo" src={logo} alt="ElectroLab" />
        </div>
        <p className="el-intro__tagline">DESIGN <span>•</span> SIMULATE <span>•</span> INNOVATE</p>
        <div className="el-intro__progress" aria-hidden="true">
          <span className="el-intro__progress-bar" />
        </div>
        <p className="el-intro__status">INITIALIZING ENGINEERING WORKSPACE</p>
      </div>
      <button
        ref={skipButton}
        type="button"
        onClick={skipIntro}
        className="el-intro__skip"
        aria-label="Skip introduction and open ElectroLab"
      >
        Skip intro <ArrowRight size={15} aria-hidden="true" />
      </button>
      <div className="el-intro__corner el-intro__corner--tl" aria-hidden="true" />
      <div className="el-intro__corner el-intro__corner--tr" aria-hidden="true" />
      <div className="el-intro__corner el-intro__corner--bl" aria-hidden="true" />
      <div className="el-intro__corner el-intro__corner--br" aria-hidden="true" />
    </div>
  );
}
