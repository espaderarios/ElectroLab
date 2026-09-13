import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { getAllHoles, holePosition } from "@/circuit/breadboard";
import { useLab } from "@/store/lab";
import {
  BreadboardBody,
  JumperWire,
  PartSwitch,
  PowerSupply,
} from "./parts-3d";

function PulseMarker({
  position,
  color,
  phase = 0,
  radius = 0.07,
}: {
  position: [number, number, number];
  color: string;
  phase?: number;
  radius?: number;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.getElapsedTime() * 5 + phase) + 1) / 2;
    if (ring.current) ring.current.scale.setScalar(0.9 + pulse * 0.22);
    if (material.current) material.current.opacity = 0.58 + pulse * 0.36;
  });

  return (
    <mesh ref={ring} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius * 0.64, radius, 20]} />
      <meshBasicMaterial ref={material} color={color} transparent depthWrite={false} />
    </mesh>
  );
}

function HoverMarker() {
  const hover = useLab((s) => s.hoverHole);
  const pending = useLab((s) => s.pendingHoles);
  const probe = useLab((s) => s.probeHole);
  const items = [hover, ...pending, probe].filter(Boolean) as string[];
  return (
    <>
      {items.map((id, i) => {
        const [x, y, z] = holePosition(id);
        const color = pending.includes(id) ? "#0f766e" : id === probe ? "#eab308" : "#38bdf8";
        return (
          <PulseMarker
            key={id + i}
            position={[x, y + 0.03, z]}
            color={color}
            phase={i * 1.8}
          />
        );
      })}
    </>
  );
}

function PreviewWire() {
  const pending = useLab((s) => s.pendingHoles);
  const hover = useLab((s) => s.hoverHole);
  const tool = useLab((s) => s.tool);
  const color = useLab((s) => s.wireColor);
  if (tool !== "wire" || pending.length !== 1 || !hover || pending[0] === hover) return null;
  const a = holePosition(pending[0]);
  const b = holePosition(hover);
  const dist = Math.hypot(a[0] - b[0], a[2] - b[2]);
  const mid = new THREE.Vector3((a[0] + b[0]) / 2, a[1] + 0.2 + dist * 0.2, (a[2] + b[2]) / 2);
  const curve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(...a),
    mid,
    new THREE.Vector3(...b),
  );
  const geom = new THREE.TubeGeometry(curve, 16, 0.022, 6, false);
  return (
    <mesh geometry={geom}>
      <meshBasicMaterial color={color === "black" ? "#111" : "#c2413b"} transparent opacity={0.45} />
    </mesh>
  );
}


function PowerClipMarkers() {
  const pos = useLab((s) => s.psuPositive);
  const neg = useLab((s) => s.psuNegative);
  return (
    <>
      {pos ? <ClipMarker id={pos} color="#ef4444" /> : null}
      {neg ? <ClipMarker id={neg} color="#e5e7eb" /> : null}
    </>
  );
}

function ClipMarker({ id, color }: { id: string; color: string }) {
  const [x, y, z] = holePosition(id);
  return (
    <PulseMarker position={[x, y + 0.08, z]} color={color} phase={1.2} radius={0.095} />
  );
}

function CameraRig() {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

  useMemo(() => {
    camera.position.set(3.8, 4.4, 5.6);
  }, [camera]);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const onCommand = (event: Event) => {
      const detail = (event as CustomEvent).detail as
        | { type?: string; active?: boolean }
        | undefined;
      if (!detail) return;

      if (detail.type === "zoom-in") {
        controls.dollyIn(1.2);
        controls.update();
      } else if (detail.type === "zoom-out") {
        controls.dollyOut(1.2);
        controls.update();
      } else if (detail.type === "reset-view") {
        controls.reset();
      } else if (detail.type === "move-mode") {
        controls.mouseButtons.LEFT = detail.active
          ? THREE.MOUSE.PAN
          : THREE.MOUSE.ROTATE;
        controls.touches.ONE = detail.active
          ? THREE.TOUCH.PAN
          : THREE.TOUCH.ROTATE;
      }
    };

    window.addEventListener("ece-lab-camera", onCommand);
    return () => window.removeEventListener("ece-lab-camera", onCommand);
  }, []);

  useFrame(() => {
    if (!controlsRef.current) return;

    controlsRef.current.enabled =
      !window.__ecePotDragging;
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enablePan
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2.15}
      minDistance={3.2}
      maxDistance={16}
      target={[0, 0.2, 0]}
    />
  );
}

export function LabScene() {
  const parts = useLab((s) => s.parts);
  const wires = useLab((s) => s.wires);
  const selectedId = useLab((s) => s.selectedId);
  const sim = useLab((s) => s.sim);
  const select = useLab((s) => s.select);

  return (
    <>
      <color attach="background" args={["#0a1018"]} />
      <fog attach="fog" args={["#0a1018", 12, 28]} />
      <hemisphereLight args={["#9db4d0", "#1a1f28", 0.55]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={1.35}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-far={24}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
      />
      <directionalLight position={[-4, 6, -3]} intensity={0.25} />

      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
        onPointerDown={() => select(null)}
      >
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color="#0c121c" />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor="#1a2436"
        sectionSize={2}
        sectionThickness={1.1}
        sectionColor="#243044"
        fadeDistance={22}
        fadeStrength={1.4}
        infiniteGrid
      />

      <BreadboardBody />
      <PowerSupply />
      <PowerClipMarkers />
      {wires.map((w) => (
        <JumperWire key={w.id} wire={w} selected={selectedId === w.id} />
      ))}
      {parts.map((p) => (
        <PartSwitch key={p.id} part={p} selected={selectedId === p.id} sim={sim} />
      ))}
      <HoverMarker />
      <PreviewWire />
      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={18} blur={2.2} far={3} />
      <CameraRig />
      <group visible={false}>
        {getAllHoles().slice(0, 1).map((id) => (
          <mesh key={id} />
        ))}
      </group>
    </>
  );
}
