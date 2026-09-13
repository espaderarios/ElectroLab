import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { LabScene } from "./scene";

export function LabCanvas() {
  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ position: [3.8, 4.4, 5.6], fov: 42, near: 0.1, far: 60 }}
      gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", touchAction: "none", background: "#0a1018" }}
      onCreated={({ gl }) => {
        gl.shadowMap.type = THREE.PCFSoftShadowMap;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.12;
      }}
      onPointerMissed={() => {
        /* selection cleared in scene floor handler */
      }}
    >
      <LabScene />
    </Canvas>
  );
}
