import { useEffect, useState, type ComponentType } from "react";
import { useLab } from "@/store/lab";
import { nextToggleableTool } from "@/circuit/editor-toolbar-state";
import { LabOverlay } from "./overlay";

declare global {
  interface Window {
    CircuitSimulator?: (...args: any[]) => any;
    navigate?: (...args: any[]) => void;
    go?: (...args: any[]) => void;

    electronAPI?: {
      close?: () => void;
      exitFullscreen?: () => void;
    };
  }
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  const coarse =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(pointer: coarse)").matches;
  const narrow = window.innerWidth < 900;
  const ua = navigator.userAgent || "";
  const uaMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(
      ua,
    );
  // Treat as mobile when UA says so, or coarse pointer on a narrow screen
  return uaMobile || (coarse && narrow);
}

function MobileUnavailableNotice() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background:
          "radial-gradient(ellipse at center, #0f1b2e 0%, #07101e 70%)",
        color: "#e2e8f0",
        textAlign: "center",
      }}
    >
      <div
        style={{
          maxWidth: 420,
          padding: "28px 26px",
          borderRadius: 18,
          background: "rgba(8,15,28,.94)",
          border: "1px solid rgba(255,255,255,.12)",
          boxShadow: "0 24px 60px rgba(0,0,0,.45)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.6,
            textTransform: "uppercase",
            color: "#94a3b8",
            marginBottom: 10,
          }}
        >
          Circuit Lab
        </div>
        <div
          style={{
            fontSize: 22,
            fontWeight: 700,
            lineHeight: 1.25,
            marginBottom: 12,
          }}
        >
          Not available on mobile
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 14,
            lineHeight: 1.55,
            color: "#94a3b8",
          }}
        >
          The circuit simulator needs a larger screen and precise pointer input
          for placing parts, routing wires, and running the bench. Open this
          page on a desktop or laptop to use Circuit Lab.
        </p>
      </div>
    </div>
  );
}

export function CircuitLab({ performanceMode = true }: { performanceMode?: boolean }) {
  const [Canvas, setCanvas] = useState<ComponentType<{ performanceMode: boolean }> | null>(null);
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const update = () => setMobile(isMobileViewport());
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  useEffect(() => {
    if (mobile) return;
    let live = true;
    void import("./lab-canvas").then((m) => {
      if (live) setCanvas(() => m.LabCanvas);
    });
    return () => {
      live = false;
    };
  }, [mobile]);

  useEffect(() => {
    if (mobile) return;
    const onKey = (e: KeyboardEvent) => {
      if (!e.defaultPrevented && (e.key === "Delete" || e.key === "Backspace")) {
        const target = e.target as HTMLElement | null;
        const tag = target?.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" ||
            target?.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return;
        if (useLab.getState().selectedId) {
          e.preventDefault();
          useLab.getState().deleteSelected();
        }
      }
      // Never override Undo/Redo inside inspector inputs or the Arduino code editor.
      const target = e.target as HTMLElement | null;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName || '') ||
        target?.isContentEditable;
      if (!typing && (e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'z' || e.key.toLowerCase() === 'y')) {
        e.preventDefault();
        if (e.shiftKey || e.key.toLowerCase() === 'y') useLab.getState().redo();
        else useLab.getState().undo();
      }
      // Familiar circuit-editor shortcuts; leave all text fields untouched.
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === 'r' && useLab.getState().selectedId) {
          e.preventDefault();
          useLab.getState().rotateSelected();
        } else if (e.key.toLowerCase() === 'w') {
          e.preventDefault();
          useLab.getState().setTool(nextToggleableTool(useLab.getState().tool, 'wire'));
        } else if (e.key.toLowerCase() === 'v') {
          e.preventDefault();
          useLab.getState().setTool(nextToggleableTool(useLab.getState().tool, 'select'));
        }
      }
      if (e.key === "Escape" && !typing) {
        useLab.getState().resetPending();
        if (useLab.getState().tool !== 'none') useLab.getState().setTool('none');
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobile]);

  return (
    <div className="ece-circuit-lab">
      {mobile ? (
        <MobileUnavailableNotice />
      ) : (
        <>
          {Canvas ? (
            <Canvas performanceMode={performanceMode} />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-paper/70">
              Opening the bench…
            </div>
          )}
          <LabOverlay showPalette={false} embedded />
        </>
      )}
    </div>
  );
}