import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  getAllHoles,
  holePosition,
  nearestHole,
} from "@/circuit/breadboard";
import { buildPreviewPart, previewMovedPart, useLab } from "@/store/lab";
import type { HoleId, PlacedPart, SimResult, ToolId } from "@/circuit/types";
import {
  BreadboardBody,
  JumperWire,
  PartSwitch,
  PowerSupply,
} from "./parts-3d";

declare global {
  interface Window {
    __ecePotDragging?: boolean;
    __ecePartDragging?: boolean;
    __eceLabCamera?: THREE.Camera;
    __eceLabCanvas?: HTMLCanvasElement;
  }
}

/** Project screen coords onto the board plane using the live lab camera. */
function screenToBoardPoint(
  clientX: number,
  clientY: number,
): { x: number; z: number } | null {
  const canvas =
    window.__eceLabCanvas ||
    (document.querySelector(
      ".ece-circuit-lab canvas",
    ) as HTMLCanvasElement | null);
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  if (
    clientX < rect.left ||
    clientX > rect.right ||
    clientY < rect.top ||
    clientY > rect.bottom
  ) {
    return null;
  }

  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

  let camera = window.__eceLabCamera;
  if (!camera) {
    const fallback = new THREE.PerspectiveCamera(
      42,
      rect.width / Math.max(rect.height, 1),
      0.1,
      60,
    );
    fallback.position.set(3.8, 4.4, 5.6);
    fallback.lookAt(0, 0.2, 0);
    fallback.updateMatrixWorld();
    camera = fallback;
  } else {
    camera.updateMatrixWorld();
  }

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.34);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return { x: hit.x, z: hit.z };
}

function holeUnderPointer(clientX: number, clientY: number): HoleId | null {
  const point = screenToBoardPoint(clientX, clientY);
  if (!point) return null;
  return nearestHole({ x: point.x, y: 0.34, z: point.z }, 0.55);
}

/** Stable "first" pin used as the footprint anchor when moving. */
function firstPinHole(part: PlacedPart): HoleId | null {
  const entries = Object.entries(part.pins).filter(
    ([, h]) => h && /^[A-T]\d+$/.test(h),
  ) as [string, HoleId][];
  if (entries.length === 0) return null;
  entries.sort((a, b) => {
    const ca = Number(a[1].slice(1));
    const cb = Number(b[1].slice(1));
    if (ca !== cb) return ca - cb;
    return a[1].localeCompare(b[1]);
  });
  return entries[0][1];
}

const PLACEABLE_TOOLS = new Set<ToolId>([
  "resistor",
  "capacitor",
  "inductor",
  "diode",
  "led",
  "transistor",
  "thyristor",
  "triac",
  "diac",
  "switch",
  "button",
  "relay",
  "pot",
  "buzzer",
  "speaker",
  "motor",
  "lcd",
  "oled",
  "mcu",
]);

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
      !window.__ecePotDragging && !window.__ecePartDragging;
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

/** Live 3D mesh of the component being placed or moved (follows hover hole). */
function PlacementGhost() {
  const partDragEnabled = useLab((s) => s.partDragEnabled);
  const tool = useLab((s) => s.tool);
  const hover = useLab((s) => s.hoverHole);
  const resistorValue = useLab((s) => s.resistorValue);
  const capacitorValue = useLab((s) => s.capacitorValue);
  const ledColor = useLab((s) => s.ledColor);
  const transistorModel = useLab((s) => s.transistorModel);
  const thyristorModel = useLab((s) => s.thyristorModel);
  const triacModel = useLab((s) => s.triacModel);
  const diacModel = useLab((s) => s.diacModel);
  const motorModel = useLab((s) => s.motorModel);
  const movingSelected = useLab((s) => s.movingSelected);
  const selectedId = useLab((s) => s.selectedId);
  const parts = useLab((s) => s.parts);
  const sim = useLab((s) => s.sim);

  const preview = useMemo(() => {
    if (!partDragEnabled) return null;
    if (movingSelected && selectedId) {
      const part = parts.find((p) => p.id === selectedId);
      if (!part) return null;
      const anchor = hover ?? firstPinHole(part);
      if (!anchor) return null;
      return previewMovedPart(part, anchor);
    }

    if (!hover) return null;
    if (!PLACEABLE_TOOLS.has(tool)) return null;

    return buildPreviewPart(tool, hover, {
      resistorValue,
      capacitorValue,
      ledColor,
      transistorModel,
      thyristorModel,
      triacModel,
      diacModel,
      motorModel,
    });
  }, [
    tool,
    hover,
    resistorValue,
    capacitorValue,
    ledColor,
    transistorModel,
    thyristorModel,
    triacModel,
    diacModel,
    motorModel,
    movingSelected,
    selectedId,
    parts,
  ]);

  if (!preview) return null;

  return (
    <group>
      {/* Soft lift so the ghost reads as floating above the board */}
      <group position={[0, 0.04, 0]}>
        <PartSwitch part={preview} selected sim={sim} />
      </group>
      {/* Pin markers for every node of the ghost footprint */}
      {Object.values(preview.pins).map((holeId) => {
        const [x, y, z] = holePosition(holeId);
        return (
          <mesh key={holeId} position={[x, y + 0.06, z]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.05, 0.085, 18]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Hold this long (ms) on a part to enter move mode. */
const LONG_PRESS_MS = 450;
/** Finger/cursor may jitter this many px during long-press without canceling. */
const LONG_PRESS_SLOP_PX = 10;

/**
 * Wraps a placed part so it can be moved when the select tool is active.
 *
 * - Short click → select
 * - Long-press (~0.45s) → enter move mode (ghost); drag to a hole and release,
 *   or release and click a hole
 * - Drag after long-press also works in one continuous gesture
 */
function MovablePart({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const tool = useLab((s) => s.tool);
  const select = useLab((s) => s.select);
  const setHover = useLab((s) => s.setHover);
  const partDragEnabled = useLab((s) => s.partDragEnabled);

  const dragRef = useRef<{
    active: boolean;
    armed: boolean;
    startX: number;
    startY: number;
    partId: string;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  useEffect(() => {
    if (!partDragEnabled) {
      if (dragRef.current?.timer) clearTimeout(dragRef.current.timer);
      dragRef.current = null;
      window.__ecePartDragging = false;
      return;
    }

    const clearTimer = () => {
      const d = dragRef.current;
      if (d?.timer) {
        clearTimeout(d.timer);
        d.timer = null;
      }
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;

      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);

      if (!d.armed && dist > LONG_PRESS_SLOP_PX) {
        clearTimer();
        return;
      }

      if (d.armed) {
        window.__ecePartDragging = true;
        setHover(holeUnderPointer(e.clientX, e.clientY));
      }
    };

    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      clearTimer();
      d.active = false;
      window.__ecePartDragging = false;

      if (d.armed) {
        const hole =
          holeUnderPointer(e.clientX, e.clientY) ??
          useLab.getState().hoverHole;
        if (hole) {
          useLab.getState().select(d.partId);
          useLab.getState().moveSelectedTo(hole);
          setHover(null);
        }
      }

      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [setHover, partDragEnabled]);

  // Drag off → original zip behavior (click to select only).
  if (!partDragEnabled) {
    return <PartSwitch part={part} selected={selected} sim={sim} />;
  }


return (
  <group
    onPointerDown={(e) => {
      if (e.button !== 0) return;
      if (tool !== "select" && tool !== "none") return;
        e.stopPropagation();

        select(part.id);

        if (dragRef.current?.timer) {
          clearTimeout(dragRef.current.timer);
        }

        const partId = part.id;
        dragRef.current = {
          active: true,
          armed: false,
          startX: e.clientX,
          startY: e.clientY,
          partId,
          timer: setTimeout(() => {
            const d = dragRef.current;
            if (!d?.active || d.partId !== partId) return;
            if (!useLab.getState().partDragEnabled) return;
            d.armed = true;
            const lab = useLab.getState();
            lab.select(partId);
            lab.setMovingSelected(true);
            window.__ecePartDragging = true;
            const live = lab.parts.find((p) => p.id === partId);
            const seed = live ? firstPinHole(live) : null;
            if (seed) lab.setHover(seed);
          }, LONG_PRESS_MS),
        };
      }}
    >
      <PartSwitch part={part} selected={selected} sim={sim} />
    </group>
  );
}

export function LabScene() {
  const parts = useLab((s) => s.parts);
  const wires = useLab((s) => s.wires);
  const selectedId = useLab((s) => s.selectedId);
  const sim = useLab((s) => s.sim);
  const select = useLab((s) => s.select);
  const movingSelected = useLab((s) => s.movingSelected);

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
        onPointerDown={() => {
          if (window.__ecePartDragging) return;
          select(null);
          useLab.getState().setMovingSelected(false);
        }}
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
      {parts.map((p) =>
        // Hide the original while it is being moved so only the ghost shows.
        movingSelected && p.id === selectedId ? null : (
          <MovablePart
            key={p.id}
            part={p}
            selected={selectedId === p.id}
            sim={sim}
          />
        ),
      )}
      <PlacementGhost />
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


