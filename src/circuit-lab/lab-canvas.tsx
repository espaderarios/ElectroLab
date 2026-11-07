import { WORKBENCH_PALETTE } from "./workbench-palette";
import { Canvas, useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import { LabScene } from "./scene";

declare global {
  interface Window {
    __eceLabCamera?: THREE.Camera;
    __eceLabCanvas?: HTMLCanvasElement;
  }
}

/** Request no more than roughly 30 idle frames/s in Fast mode.
 * Pointer/orbit events still invalidate the scene immediately for responsiveness.
 * The interval is cleaned up when switching to detailed mode or leaving the editor.
 */
function FastFrameHeartbeat() {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    const tick = () => { if (!document.hidden) invalidate(); };
    const interval = window.setInterval(tick, 1000 / 30);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [invalidate]);
  return null;
}

export function LabCanvas({ performanceMode = true }: { performanceMode?: boolean }) {
  return (
    <Canvas
      shadows={!performanceMode}
      frameloop={performanceMode ? "demand" : "always"}
      dpr={performanceMode ? 1 : ([1, 1.5] as [number, number])}
      camera={{ position: [6.6, 8.2, 10.3], fov: 42, near: 0.1, far: 100 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "none", background: WORKBENCH_PALETTE.background }}
      onCreated={({ gl, camera }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
        // Expose live camera + canvas for palette drag → board raycasting.
        window.__eceLabCamera = camera;
        window.__eceLabCanvas = gl.domElement;
      }}
      onPointerMissed={() => {
        /* selection cleared in scene floor handler */
      }}
    >
      {performanceMode && <FastFrameHeartbeat />}
      <LabScene performanceMode={performanceMode} />
    </Canvas>
  );
}
