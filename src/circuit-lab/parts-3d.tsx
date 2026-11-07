import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Html as DreiHtml } from "@react-three/drei";

import { useFrame } from "@react-three/fiber";

import * as THREE from "three";

import React from "react";

import {
  getAllHoles,
  holePosition,
  BOARD,
} from "@/circuit/breadboard";

import {
  LED_HEX,
  WIRE_HEX,
  type HoleId,
  type PlacedPart,
  type SimResult,
  type Wire,
} from "@/circuit/types";

import { useLab } from "@/store/lab";
import { LOGIC_IC_PINOUTS } from "@/circuit/logic-ics";
import { displayPinLabel } from "@/circuit/display-guides";
import { mcuBoardOrigin, mcuPinLocal, mcuTerminalId, terminalPosition } from "@/circuit/mcu-headers";
import { wireRoute3DPoints, type RoutedWire } from "@/circuit/wire-routing";
import * as simulationModule from "@/circuit/simulate";
import { BreadboardSilkscreen, PrintedMark } from "./realistic-details";
import { ArduinoPcbFinish } from "./pcb-finish";

/**
 * Floating 3D component annotations are contextual, not part of the physical
 * model. The context is scoped to each individual component in PartSwitch, so
 * an idle breadboard has no cloud of labels or DOM overlays. Silkscreen drawn
 * onto meshes and LCD/OLED canvas textures are unaffected.
 */
const PartLabelHoverContext = React.createContext<boolean | null>(null);

function Html(props: React.ComponentProps<typeof DreiHtml>) {
  const hovered = React.useContext(PartLabelHoverContext);
  if (hovered === false) return null;
  return <DreiHtml {...props} />;
}

/**
 * 3D hover events are not guaranteed to fire an exit when a pointer jumps
 * from a canvas to a toolbar or another HTML overlay. Keep pin tooltips
 * transient by clearing them at the DOM canvas boundary (and on window blur).
 * No permanent labels are mounted until the user hovers or picks a pin.
 */
function useTransientPinHover() {
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);

  useEffect(() => {
    if (hoveredPin === null) return;
    const clear = () => {
      setHoveredPin(null);
      useLab.getState().setHover(null);
    };
    const clearOutsideCanvas = (event: PointerEvent) => {
      const canvas = document.querySelector<HTMLCanvasElement>(".ece-circuit-lab canvas");
      if (!canvas || !canvas.contains(event.target as Node)) clear();
    };
    const clearWhenHidden = () => { if (document.hidden) clear(); };
    window.addEventListener("pointermove", clearOutsideCanvas, { passive: true });
    window.addEventListener("pointerdown", clearOutsideCanvas, { passive: true });
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clearWhenHidden);
    return () => {
      window.removeEventListener("pointermove", clearOutsideCanvas);
      window.removeEventListener("pointerdown", clearOutsideCanvas);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clearWhenHidden);
    };
  }, [hoveredPin]);

  return { hoveredPin, setHoveredPin };
}

function runSimulation(
  state: ReturnType<typeof useLab.getState>,
): SimResult {
  const exports = simulationModule as unknown as Record<string, unknown>;
  const simulator =
    exports.runSimulation ??
    exports.simulateCircuit ??
    exports.simulate ??
    exports.default;

  return typeof simulator === "function"
    ? (simulator as (value: typeof state) => SimResult)(state)
    : state.sim;
}

declare global {
  interface Window {
    __ecePotDragging?: boolean;
  }
}

if (typeof window !== "undefined") {
  window.__ecePotDragging = false;
}

let potDraggingGlobal = false;

export function setPotDraggingGlobal(
  value: boolean,
) {
  potDraggingGlobal = value;
}

export function isPotDraggingGlobal() {
  return potDraggingGlobal;
}


const CAPACITOR_VALUES = [
  { value: 0.000001, label: "1 µF" },
  { value: 0.0000022, label: "2.2 µF" },
  { value: 0.0000047, label: "4.7 µF" },
  { value: 0.00001, label: "10 µF" },
  { value: 0.000022, label: "22 µF" },
  { value: 0.000047, label: "47 µF" },
  { value: 0.0001, label: "100 µF" },
  { value: 0.00022, label: "220 µF" },
  { value: 0.00047, label: "470 µF" },
  { value: 0.001, label: "1000 µF" },
];

const FULL_RAIL_Z = [
  -5.47,
  -5.23,
  -2.47,
  -2.23,
   2.23,
   2.47,
   5.23,
   5.47,
];

function vec(id: HoleId) {
  const [x, y, z] = holePosition(id);
  return new THREE.Vector3(x, y, z);
}

function lightenColor(hex: string, amount = 0.3) {
  const value = hex.replace("#", "");

  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);

  const mix = (channel: number) =>
    Math.round(channel + (255 - channel) * amount);

  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
/**
 * Breadboard-style solid-core jumper:
 * vertical stubs out of each hole, then a low flat Manhattan run
 * strictly above the board top (no Catmull undershoot into the plastic).
 */
function TubeWire({
  a,
  b,
  color,
  lift = 1,
  radius = 0.019,
  style = "flat",
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  color: string;
  lift?: number;
  radius?: number;
  style?: "flat" | "arc";
}) {
  const geom = useMemo(() => {
    const boardY = BOARD.height;
    // Endpoints always sit on top of the board surface (or above if already higher).
    const start = a.clone();
    start.y = Math.max(a.y, boardY + 0.02);
    const end = b.clone();
    end.y = Math.max(b.y, boardY + 0.02);

    const hash =
      Math.abs(
        start.x * 12.9898 +
          start.z * 78.233 +
          end.x * 37.719 +
          end.z * 9.131,
      ) % 1;
    const stagger = (hash - 0.5) * 0.05;

    if (style === "arc") {
      const upA = start.clone();
      upA.y = Math.max(start.y, boardY) + 0.12;
      const upB = end.clone();
      upB.y = Math.max(end.y, boardY) + 0.12;
      const dist = start.distanceTo(end);
      const mid = upA.clone().lerp(upB, 0.5);
      mid.y += 0.2 + dist * 0.1 * lift;
      mid.x += stagger;
      const curve = new THREE.CatmullRomCurve3([start, upA, mid, upB, end]);
      curve.curveType = "centripetal";
      return new THREE.TubeGeometry(curve, 28, radius, 8, false);
    }

    // Flat run height — always clearly above the plastic top.
    const y = boardY + 0.07 + 0.01 * Math.min(lift, 2) + Math.abs(stagger) * 0.2;

    const sx = start.x + stagger * 0.25;
    const sz = start.z + stagger * 0.25;
    const ex = end.x + stagger * 0.25;
    const ez = end.z + stagger * 0.25;

    // Explicit polyline so the tube never dips into the board.
    const p0 = start.clone();
    const p1 = new THREE.Vector3(sx, y, sz);
    const dx = Math.abs(ex - sx);
    const dz = Math.abs(ez - sz);
    const points: THREE.Vector3[] = [p0, p1];
    if (dx >= dz) {
      if (Math.abs(ex - sx) > 0.02) {
        points.push(new THREE.Vector3(ex, y, sz));
      }
      if (Math.abs(ez - sz) > 0.02) {
        points.push(new THREE.Vector3(ex, y, ez));
      }
    } else {
      if (Math.abs(ez - sz) > 0.02) {
        points.push(new THREE.Vector3(sx, y, ez));
      }
      if (Math.abs(ex - sx) > 0.02) {
        points.push(new THREE.Vector3(ex, y, ez));
      }
    }
    // Last horizontal point at dest column/row, then drop into the hole.
    const lastHoriz = points[points.length - 1];
    if (
      Math.abs(lastHoriz.x - ex) > 0.001 ||
      Math.abs(lastHoriz.z - ez) > 0.001
    ) {
      points.push(new THREE.Vector3(ex, y, ez));
    }
    points.push(end.clone());

    // Build a path of straight segments (no curve overshoot).
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 0; i < points.length - 1; i++) {
      path.add(new THREE.LineCurve3(points[i], points[i + 1]));
    }

    const dist = start.distanceTo(end);
    const segs = Math.max(12, Math.min(64, Math.floor(dist * 48) + points.length * 4));
    return new THREE.TubeGeometry(path, segs, radius, 6, false);
  }, [a.x, a.y, a.z, b.x, b.y, b.z, lift, radius, style]);

  useEffect(() => () => geom.dispose(), [geom]);

  return (
<mesh geometry={geom} castShadow receiveShadow>
  <meshPhysicalMaterial
    color={color}
    roughness={0.58}
    metalness={0.02}
    clearcoat={0.18}
    clearcoatRoughness={0.55}
  />
</mesh>
  );
}


/** Rising smoke + heat haze when a part is overloaded / shorted. */
function SmokePuffs({
  position,
  active,
}: {
  position: THREE.Vector3;
  active: boolean;
}) {
  const count = 14;
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        phase: i / count,
        x: ((i * 17) % 7) * 0.025 - 0.075,
        z: ((i * 13) % 7) * 0.025 - 0.075,
        speed: 0.18 + (i % 5) * 0.04,
        drift: 0.04 + (i % 4) * 0.015,
      })),
    [],
  );
  const strength = useRef(0);

  useFrame(({ clock }, delta) => {
    const m = mesh.current;
    if (!m) return;
    strength.current = THREE.MathUtils.damp(
      strength.current,
      active ? 1 : 0,
      3.2,
      delta,
    );
    if (strength.current < 0.02) {
      m.visible = false;
      return;
    }
    m.visible = true;
    const t = clock.getElapsedTime();
    for (let i = 0; i < count; i++) {
      const s = seeds[i];
      const u = (t * s.speed + s.phase) % 1;
      const rise = u * 0.85;
      const spread = u * 1.4;
      dummy.position.set(
        position.x + s.x + Math.sin(t * 1.6 + i) * s.drift * spread,
        position.y + 0.08 + rise,
        position.z + s.z + Math.cos(t * 1.4 + i) * s.drift * spread,
      );
      const scale =
        (0.07 + u * 0.16) * strength.current * (1 - u * 0.35);
      dummy.scale.setScalar(Math.max(0.001, scale));
      dummy.updateMatrix();
      m.setMatrixAt(i, dummy.matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    if (mat.current) {
      // Darker smoke, more opaque near the base of the plume
      mat.current.opacity = 0.55 * strength.current;
    }
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, count]}
      frustumCulled={false}
      renderOrder={20}
    >
      <sphereGeometry args={[1, 10, 10]} />
      <meshBasicMaterial
        ref={mat}
        color="#4b5563"
        transparent
        depthWrite={false}
        opacity={0.5}
        toneMapped={false}
      />
    </instancedMesh>
  );
}

/** Render one stable, uncluttered wire route (3D geometry only). */
function useRoutedWirePoints(route: RoutedWire, a: THREE.Vector3, b: THREE.Vector3) {
  return useMemo(() => wireRoute3DPoints(route, BOARD.height)
    .map((p) => new THREE.Vector3(p.x, p.y, p.z)), [route, a.x, a.z, b.x, b.z]);
}

function RoutedWireTube({
  points,
  color,
  selected,
  jumper,
  dimmed = false,
}: {
  points: THREE.Vector3[];
  color: string;
  selected: boolean;
  jumper: boolean;
  dimmed?: boolean;
}) {
  const geometry = useMemo(() => {
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < points.length; i++) {
      if (points[i].distanceToSquared(points[i - 1]) > 0.000001) {
        path.add(new THREE.LineCurve3(points[i - 1], points[i]));
      }
    }
    const segments = Math.max(12, points.length * 5);
    const radius = jumper ? 0.028 : 0.024;
    return {
      core: new THREE.TubeGeometry(path, segments, radius, 8, false),
      halo: selected ? new THREE.TubeGeometry(path, segments, radius + 0.016, 8, false) : null,
    };
  }, [points, jumper, selected]);
  useEffect(() => () => {
    geometry.core.dispose();
    geometry.halo?.dispose();
  }, [geometry]);

  return (
    <group>
      {selected && geometry.halo && (
        <mesh geometry={geometry.halo} raycast={() => null}>
          <meshBasicMaterial color="#67e8f9" transparent opacity={0.22} depthWrite={false} />
        </mesh>
      )}
      <mesh geometry={geometry.core} castShadow={false}>
        <meshPhysicalMaterial
          color={color}
          metalness={0.06}
          roughness={0.32}
          clearcoat={0.8}
          clearcoatRoughness={0.25}
          emissive={selected ? "#0e7490" : "#000000"}
          emissiveIntensity={selected ? 0.3 : 0}
          transparent={dimmed}
          opacity={dimmed ? 0.13 : 1}
          depthWrite={!dimmed}
        />
      </mesh>
    </group>
  );
}

function CurrentFlow({
  a,
  b,
  active,
  color,
  strength = 1,
  routedPoints,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  active: boolean;
  color: string;
  strength?: number;
  routedPoints?: THREE.Vector3[];
}) {
  const particles = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const flow = useRef(0);
  const particleCount = 8;

  // Match TubeWire flat Manhattan path so particles ride on the wire.
  const fallbackPath = useMemo(() => {
    const boardY = BOARD.height;
    const start = a.clone();
    start.y = Math.max(a.y, boardY + 0.02);
    const end = b.clone();
    end.y = Math.max(b.y, boardY + 0.02);
    const y = boardY + 0.075;
    const sx = start.x;
    const sz = start.z;
    const ex = end.x;
    const ez = end.z;
    const pts: THREE.Vector3[] = [
      start.clone(),
      new THREE.Vector3(sx, y, sz),
    ];
    const dx = Math.abs(ex - sx);
    const dz = Math.abs(ez - sz);
    if (dx >= dz) {
      if (dx > 0.02) pts.push(new THREE.Vector3(ex, y, sz));
      if (dz > 0.02) pts.push(new THREE.Vector3(ex, y, ez));
    } else {
      if (dz > 0.02) pts.push(new THREE.Vector3(sx, y, ez));
      if (dx > 0.02) pts.push(new THREE.Vector3(ex, y, ez));
    }
    const last = pts[pts.length - 1];
    if (Math.abs(last.x - ex) > 0.001 || Math.abs(last.z - ez) > 0.001) {
      pts.push(new THREE.Vector3(ex, y, ez));
    }
    pts.push(end.clone());
    return pts;
  }, [a.x, a.y, a.z, b.x, b.y, b.z]);

  const pathPoints = routedPoints ?? fallbackPath;
  const samplePath = (t: number, out: THREE.Vector3) => {
    const pts = pathPoints;
    if (pts.length < 2) {
      out.copy(a);
      return;
    }
    // Arc-length-ish uniform by segment count
    const segs = pts.length - 1;
    const f = Math.min(0.999, Math.max(0, t)) * segs;
    const i = Math.min(segs - 1, Math.floor(f));
    const u = f - i;
    out.lerpVectors(pts[i], pts[i + 1], u);
  };

  useFrame(({ clock }, delta) => {
    const mesh = particles.current;
    if (!mesh) return;

    flow.current = THREE.MathUtils.damp(
      flow.current,
      active ? strength : 0,
      9,
      delta,
    );

    if (flow.current < 0.015) {
      mesh.visible = false;
      return;
    }

    mesh.visible = true;
    const time = clock.getElapsedTime() * (0.55 + flow.current * 1.2);

    for (let index = 0; index < particleCount; index += 1) {
      const t = (time + index / particleCount) % 1;
      const edgeFade = Math.sin(Math.PI * t);
      const pulse = 0.85 + Math.sin(time * 6 + index) * 0.15;
      const size = (0.35 + flow.current * 0.55) * pulse * edgeFade;

      samplePath(t, point);
      dummy.position.copy(point);
      dummy.scale.setScalar(Math.max(0.001, size));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (material.current) {
      material.current.opacity = 0.4 + flow.current * 0.55;
    }
  });

  return (
    <instancedMesh
      ref={particles}
      args={[undefined, undefined, particleCount]}
      frustumCulled={false}
    >
      <sphereGeometry args={[0.02, 8, 8]} />
      <meshBasicMaterial
        ref={material}
        color={color}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </instancedMesh>
  );
}


/** Metal ferrule and polymer shoulder at each real jumper endpoint. These sit
 * at the connection coordinate, so moving the Arduino cannot detach a plug. */
function WireEndConnector({ position, color, jumper }: {
  position: THREE.Vector3; color: string; jumper: boolean;
}) {
  return <group position={[position.x, position.y, position.z]} raycast={() => null}>
    <mesh position={[0, 0.013, 0]} castShadow={false}>
      <cylinderGeometry args={[0.015, 0.012, 0.064, 10]} />
      <meshStandardMaterial color="#c9b492" metalness={0.94} roughness={0.26} />
    </mesh>
    {jumper && <mesh position={[0, 0.078, 0]} castShadow={false}>
      <cylinderGeometry args={[0.043, 0.038, 0.091, 10]} />
      <meshPhysicalMaterial color={color} metalness={0.02} roughness={0.42} clearcoat={0.4} clearcoatRoughness={0.35} />
    </mesh>}
  </group>;
}

export function JumperWire({
  wire,
  route,
  selected,
  dimmed = false,
}: {
  wire: Wire;
  route: RoutedWire;
  selected: boolean;
  dimmed?: boolean;
}) {
  const tool = useLab((s) => s.tool);
  const [hovered, setHovered] = useState(false);
  const parts = useLab((s) => s.parts);
  const a = useMemo(() => new THREE.Vector3(...terminalPosition(wire.a, parts)), [wire.a, parts]);
  const b = useMemo(() => new THREE.Vector3(...terminalPosition(wire.b, parts)), [wire.b, parts]);
  const points = useRoutedWirePoints(route, a, b);
  const powerOn = useLab((s) => s.powerOn);
  const showWireFlow = useLab((s) => s.showWireFlow);
  const localCurrent = useLab((s) =>
    Math.max(Math.abs(s.sim.nodeCurrents?.[wire.a] ?? 0), Math.abs(s.sim.nodeCurrents?.[wire.b] ?? 0)),
  );
  const flowing = !route.blocked && showWireFlow && powerOn && localCurrent > 0.00001;
  const flowStrength = THREE.MathUtils.clamp(localCurrent / 0.015, 0.18, 1);
  const highlighted = selected || (hovered && (tool === "select" || tool === "delete"));
  const original = WIRE_HEX[wire.color];
  // Black wires need a slate reflection to remain visible on dark boards.
  const visibleColor = route.blocked ? "#ef4444" : wire.color === "black" ? "#374151" : original;

  return (
    <group
      onPointerOver={(e) => {
        if (tool !== "select" && tool !== "delete") return;
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => {
        setHovered(false);
      }}
      onClick={(e) => {
        if (tool !== "select" && tool !== "delete") return;
        e.stopPropagation();
        useLab.getState().select(wire.id);
      }}
    >
      <RoutedWireTube
        points={points}
        color={highlighted ? lightenColor(visibleColor, 0.45) : visibleColor}
        selected={highlighted}
        jumper={route.style === "jumper"}
        dimmed={dimmed && !highlighted}
      />
      {/* Actual wire-end contacts rather than color tubes ending abruptly. */}
      {!dimmed && !route.blocked && <>
        <WireEndConnector position={a} color={visibleColor} jumper={route.style === "jumper"} />
        <WireEndConnector position={b} color={visibleColor} jumper={route.style === "jumper"} />
      </>}
      {flowing && !dimmed && (
        <CurrentFlow
          a={a}
          b={b}
          routedPoints={points}
          active={flowing}
          color={wire.color === "black" ? "#a5f3fc" : "#fff7ed"}
          strength={flowStrength}
        />
      )}
    </group>
  );
}

/**
 * Universal component lead: vertical out of the breadboard hole, then bends into the body.
 * Used by every part that still calls <Lead /> — same visual language as resistors.
 */
function Lead({
  from,
  to,
  color = "#c4c8ce",
  radius = 0.012,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color?: string;
  radius?: number;
}) {
  const boardY = BOARD.height;
  const pinTop = new THREE.Vector3(from.x, boardY + 0.01, from.z);
  const bend = new THREE.Vector3(from.x, boardY + 0.045, from.z);
  const verticalTop = new THREE.Vector3(
    from.x,
    Math.max(to.y - 0.015, boardY + 0.12),
    from.z,
  );
  const toward = new THREE.Vector3(to.x - from.x, 0, to.z - from.z);
  const horizLen = toward.length();
  const entry =
    horizLen > 0.001
      ? new THREE.Vector3(
          from.x + (toward.x / horizLen) * Math.min(horizLen * 0.9, horizLen),
          to.y,
          from.z + (toward.z / horizLen) * Math.min(horizLen * 0.9, horizLen),
        )
      : verticalTop.clone().setY(to.y);

  const curve = new THREE.CatmullRomCurve3([pinTop, bend, verticalTop, entry]);
  curve.curveType = "centripetal";
  curve.tension = 0.18;

  return (
    <group>
      <mesh castShadow receiveShadow>
        <tubeGeometry args={[curve, 20, radius, 8, false]} />
        <meshStandardMaterial color={color} metalness={0.88} roughness={0.2} />
      </mesh>
      <mesh position={[from.x, boardY + 0.035, from.z]}>
        <cylinderGeometry args={[radius * 1.08, radius * 1.2, 0.06, 10]} />
        <meshStandardMaterial color={color} metalness={0.9} roughness={0.16} />
      </mesh>
    </group>
  );
}

const RESISTOR_BAND_COLORS: Record<number, string> = {
  0: "#171717", // black
  1: "#7c3f00", // brown
  2: "#b91c1c", // red
  3: "#c2410c", // orange
  4: "#eab308", // yellow
  5: "#16a34a", // green
  6: "#2563eb", // blue
  7: "#7c3aed", // violet
  8: "#64748b", // gray
  9: "#f8fafc", // white
};

const RESISTOR_MULTIPLIER_COLORS: Record<number, string> = {
  [-2]: "#c0c0c0", // silver
  [-1]: "#d4af37", // gold
  0: "#171717",
  1: "#7c3f00",
  2: "#b91c1c",
  3: "#c2410c",
  4: "#eab308",
  5: "#16a34a",
  6: "#2563eb",
  7: "#7c3aed",
  8: "#64748b",
  9: "#f8fafc",
};

function getResistorBands(
  resistance: number,
): [string, string, string, string] {
  const value = Math.max(
    1,
    Number(resistance) || 1000,
  );

  let exponent =
    Math.floor(Math.log10(value)) - 1;

  let significant = Math.round(
    value / Math.pow(10, exponent),
  );

  if (significant >= 100) {
    significant = Math.round(
      significant / 10,
    );
    exponent += 1;
  }

  exponent = Math.max(
    -2,
    Math.min(9, exponent),
  );

  significant = Math.max(
    10,
    Math.min(99, significant),
  );

  const tens =
    Math.floor(significant / 10);

  const ones =
    significant % 10;

  return [
    RESISTOR_BAND_COLORS[tens],
    RESISTOR_BAND_COLORS[ones],
    RESISTOR_MULTIPLIER_COLORS[exponent],
    "#d4af37", // ±5% gold
  ];
}

function LedAura({
  position,
  color,
  active,
  brightness,
}: {
  position: THREE.Vector3;
  color: string;
  active: boolean;
  brightness: number;
}) {
  const halo = useRef<THREE.Mesh>(null);
  const haloMaterial = useRef<THREE.MeshBasicMaterial>(null);
  const light = useRef<THREE.PointLight>(null);
  const energy = useRef(0);

  useFrame((_, delta) => {
    energy.current = THREE.MathUtils.damp(
      energy.current,
      active ? Math.max(0.05, brightness) : 0,
      12,
      delta,
    );

    const glow = energy.current;

    if (halo.current) {
      const scale = 0.42 + glow * 0.38;
      halo.current.scale.setScalar(scale);
    }

    if (haloMaterial.current) {
      haloMaterial.current.opacity = glow * 0.10;
    }

    if (light.current) {
      light.current.intensity = glow * 1.35;
    }
  });

  return (
    <group position={position}>
      <pointLight
        ref={light}
        color={color}
        intensity={0}
        distance={1.15}
        decay={2}
        castShadow={false}
      />

      <mesh ref={halo}>
        <sphereGeometry args={[0.13, 20, 16]} />
        <meshBasicMaterial
          ref={haloMaterial}
          color={color}
          transparent
          opacity={0}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function PinLabel({
  position,
  label,
  polarity,
  description,
}: {
  position: THREE.Vector3;
  label: string;
  polarity?: "+" | "-";
  description?: string;
}) {
  return (
    <Html
      position={[
        position.x,
        position.y + 0.22,
        position.z,
      ]}
      center
      distanceFactor={5}
      occlude={false}
      style={{
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "4px 7px",
          borderRadius: "7px",
          background:
            polarity === "+"
              ? "rgba(127, 29, 29, .96)"
              : polarity === "-"
                ? "rgba(15, 23, 42, .96)"
                : "rgba(15, 23, 42, .94)",
          border:
            polarity === "+"
              ? "1px solid rgba(248,113,113,.8)"
              : polarity === "-"
                ? "1px solid rgba(148,163,184,.65)"
                : "1px solid rgba(255,255,255,.18)",
          color:
            polarity === "+"
              ? "#fecaca"
              : polarity === "-"
                ? "#e2e8f0"
                : "#f8fafc",
          fontFamily:
            "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: "9px",
          fontWeight: 800,
          whiteSpace: "nowrap",
          boxShadow:
            "0 4px 14px rgba(0,0,0,.45)",
        }}
      >
        {polarity ? (
          <span
            style={{
              fontSize: "13px",
              fontWeight: 900,
            }}
          >
            {polarity}
          </span>
        ) : null}

        <span>{label}</span>

        {description ? (
          <span
            style={{
              opacity: 0.65,
              fontWeight: 600,
            }}
          >
            {description}
          </span>
        ) : null}
      </div>
    </Html>
  );
}

export function ResistorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // ---------------------------------------------------------
  // PIN POSITIONS
  // ---------------------------------------------------------

  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const isBurned = Boolean(sim.burned?.[part.id]);

  // Direction from pin 1 -> pin 2.
  const dir = b.clone().sub(a);
  dir.y = 0;

  const pinDistance = dir.length();

  if (pinDistance < 0.001) {
    return null;
  }

  dir.normalize();

  // ---------------------------------------------------------
  // RESISTOR DIMENSIONS
  // ---------------------------------------------------------

  // Fixed proportions resembling a typical 1/4 W axial resistor.
  const bodyLength = 0.38;
  const bodyRadius = 0.058;

  // Height above the breadboard.
  const bodyY = BOARD.height + 0.15;

  // Center of the resistor body.
  const body = a.clone().lerp(b, 0.5);
  body.y = bodyY;

  // ---------------------------------------------------------
  // BODY ROTATION
  // ---------------------------------------------------------

  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir,
  );

  // ---------------------------------------------------------
  // BODY END POINTS
  // ---------------------------------------------------------

  const halfBody = bodyLength / 2;

  const bodyA = body.clone().add(
    dir.clone().multiplyScalar(-halfBody),
  );

  const bodyB = body.clone().add(
    dir.clone().multiplyScalar(halfBody),
  );

  // ---------------------------------------------------------
  // LEAD GEOMETRY
  // ---------------------------------------------------------

  const leadRadius = 0.0105;

  function makeBentLead(
    pin: THREE.Vector3,
    bodyEnd: THREE.Vector3,
  ) {
    const verticalTop = new THREE.Vector3(
      pin.x,
      bodyY,
      pin.z,
    );

    const horizontalEnd = bodyEnd.clone();

    const bendPoint = new THREE.Vector3(
      pin.x,
      BOARD.height + 0.032,
      pin.z,
    );

    const curve = new THREE.CatmullRomCurve3([
      pin.clone(),
      bendPoint.clone(),
      verticalTop.clone(),
      horizontalEnd.clone(),
    ]);

    curve.curveType = "centripetal";
    curve.tension = 0.16;

    return curve;
  }

  const leadCurveA = makeBentLead(a, bodyA);
  const leadCurveB = makeBentLead(b, bodyB);

  // ---------------------------------------------------------
  // RESISTOR COLOR BANDS
  // ---------------------------------------------------------

  const bands = getResistorBands(
    Number(part.props.resistance ?? 1000),
  );

  const bandSpacing = Math.min(
    0.042,
    bodyLength * 0.17,
  );

  const bandStart =
    -((bands.length - 1) * bandSpacing) / 2;

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {/* ------------------------------------------------------
          METAL LEAD — PIN 1
      ------------------------------------------------------ */}

      <mesh castShadow receiveShadow>
        <tubeGeometry
          args={[leadCurveA, 24, leadRadius, 10, false]}
        />

        <meshStandardMaterial
          color="#a8adb2"
          metalness={0.94}
          roughness={0.3}
        />
      </mesh>

      {/* ------------------------------------------------------
          METAL LEAD — PIN 2
      ------------------------------------------------------ */}

      <mesh castShadow receiveShadow>
        <tubeGeometry
          args={[leadCurveB, 24, leadRadius, 10, false]}
        />

        <meshStandardMaterial
          color="#a8adb2"
          metalness={0.94}
          roughness={0.3}
        />
      </mesh>

      {/* ------------------------------------------------------
          RESISTOR BODY
      ------------------------------------------------------ */}

      <group position={body} quaternion={quat}>
        {/* Beige epoxy body */}
        <mesh castShadow receiveShadow>
          <capsuleGeometry
            args={[bodyRadius * 0.78, bodyLength * 0.72, 6, 20]}
          />

          <meshPhysicalMaterial
            color={selected ? "#f4d58d" : "#d4bc95"}
            roughness={0.58}
            metalness={0}
            clearcoat={0.18}
            clearcoatRoughness={0.62}
          />
        </mesh>

        {/* Metal end caps */}
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[0, side * bodyLength * 0.43, 0]}
            castShadow
          >
            <cylinderGeometry
              args={[
                bodyRadius * 0.74,
                bodyRadius * 0.74,
                bodyLength * 0.13,
                20,
              ]}
            />

            <meshStandardMaterial
              color="#9ba1a6"
              metalness={0.92}
              roughness={0.3}
            />
          </mesh>
        ))}

        {/* Color bands — slightly larger than the epoxy body */}
        {bands.map((bandColor, index) => (
          <mesh
            key={`${bandColor}-${index}`}
            position={[0, bandStart + index * bandSpacing, 0]}
            castShadow
          >
            <cylinderGeometry
              args={[
                bodyRadius * 0.84,
                bodyRadius * 0.84,
                bodyLength * 0.08,
                20,
              ]}
            />

            <meshStandardMaterial
              color={bandColor}
              roughness={0.5}
              metalness={0}
            />
          </mesh>
        ))}

        {/* Discrete axial values: color bands remain the canonical code; this
            subtle ink mark is legible when zoomed in, without a floating UI. */}
        <PrintedMark text={formatResistance(Number(part.props.resistance ?? 1000))}
          position={[0, 0, 0.061]}
          rotation={[0, 0, Math.PI / 2]}
          width={0.255} height={0.045} color="#3e3327" opacity={0.83} />
      </group>

      {/* ------------------------------------------------------
          BURN-OUT SMOKE
      ------------------------------------------------------ */}

      <SmokePuffs
        position={a
          .clone()
          .lerp(b, 0.5)
          .setY(BOARD.height + 0.18)}
        active={isBurned}
      />
    </group>
  );
}

export function LedMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const a = vec(part.pins.a);
  const k = vec(part.pins.k);

  const mid = a.clone().lerp(k, 0.5);
  const baseY = BOARD.height + 0.13;
  const body = new THREE.Vector3(mid.x, baseY + 0.16, mid.z);

  const bendY = BOARD.height + 0.055;
  const color = LED_HEX[part.props.ledColor ?? "red"] ?? "#ef4444";

  const state = sim.leds[part.id];
  const brightness = state?.brightness ?? 0;
  const isOn = Boolean(state?.on);
  const isBurned =
    Boolean(state?.overcurrent) || Boolean(sim.burned?.[part.id]);

  const lensColor = isBurned ? "#241f1c" : color;
  const glowColor = isBurned ? "#ea580c" : color;

  const lensMaterial = useRef<THREE.MeshPhysicalMaterial>(null);
  const dieMaterial = useRef<THREE.MeshStandardMaterial>(null);
  const lensEnergy = useRef(0);

  useFrame(({ clock }, delta) => {
    lensEnergy.current = THREE.MathUtils.damp(
      lensEnergy.current,
      isOn ? Math.max(0.06, brightness) : 0,
      12,
      delta,
    );

    const energy = lensEnergy.current;
    const flicker =
      0.985 + Math.sin(clock.getElapsedTime() * 18) * 0.015;

    if (lensMaterial.current) {
      lensMaterial.current.emissiveIntensity =
        0.025 + energy * 2.35 * flicker;
    }

    if (dieMaterial.current) {
      dieMaterial.current.emissiveIntensity =
        0.08 + energy * 4.2 * flicker;
    }
  });

  // Real 5 mm LED proportions, scaled to the scene.
  const flangeRadius = 0.124;
  const bodyRadius = 0.106;
  const bodyHeight = 0.198;
  const domeRadius = 0.106;
  const leadRadius = 0.012;

  function Lead({
    from,
    metal = "#b9bec4",
  }: {
    from: THREE.Vector3;
    metal?: string;
  }) {
    const bend = new THREE.Vector3(from.x, bendY, from.z);
    const toBody = new THREE.Vector3(body.x, bendY, body.z);

    const verticalHeight = Math.max(0.008, bendY - from.y);
    const horizontal = bend.distanceTo(toBody);
    const horizontalMid = bend.clone().lerp(toBody, 0.5);

    const direction = new THREE.Vector3().subVectors(toBody, bend);
    const yaw = Math.atan2(direction.x, direction.z);

    return (
      <group>
        <mesh
          position={[from.x, from.y + verticalHeight / 2, from.z]}
          castShadow
        >
          <cylinderGeometry
            args={[leadRadius, leadRadius, verticalHeight, 10]}
          />
          <meshStandardMaterial
            color={metal}
            metalness={0.95}
            roughness={0.24}
          />
        </mesh>

        {horizontal > 0.004 && (
          <mesh
            position={[horizontalMid.x, bendY, horizontalMid.z]}
            rotation={[Math.PI / 2, 0, -yaw]}
            castShadow
          >
            <cylinderGeometry
              args={[leadRadius, leadRadius, horizontal, 10]}
            />
            <meshStandardMaterial
              color={metal}
              metalness={0.95}
              roughness={0.24}
            />
          </mesh>
        )}

        <mesh
          position={[
            body.x * 0.2 + from.x * 0.8,
            (bendY + baseY) / 2,
            body.z * 0.2 + from.z * 0.8,
          ]}
          castShadow
        >
          <cylinderGeometry
            args={[
              leadRadius * 0.94,
              leadRadius * 0.94,
              Math.max(0.008, baseY - bendY + 0.018),
              10,
            ]}
          />
          <meshStandardMaterial
            color={metal}
            metalness={0.95}
            roughness={0.24}
          />
        </mesh>
      </group>
    );
  }

  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <Lead from={a} metal="#c3c7cc" />
      <Lead from={k} metal="#a7adb4" />

      {/* Molded epoxy package */}
      <mesh
        position={[body.x, baseY + bodyHeight * 0.5, body.z]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[bodyRadius, bodyRadius, bodyHeight, 28]}
        />
        <meshStandardMaterial
          color={isBurned ? "#2a2320" : lightenColor(color, 0.68)}
          roughness={0.16}
          metalness={0.0}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Flange at the base */}
      <mesh
        position={[body.x, baseY + 0.008, body.z]}
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[flangeRadius, flangeRadius * 1.03, 0.018, 28]}
        />
        <meshStandardMaterial
          color={isBurned ? "#2a2320" : "#eceef1"}
          roughness={0.3}
          metalness={0.02}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* Colored diffusing dome */}
      <mesh
        position={[
          body.x,
          baseY + bodyHeight - domeRadius * 0.18,
          body.z,
        ]}
        castShadow
      >
        <sphereGeometry
          args={[
            domeRadius,
            36,
            24,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          ]}
        />
        <meshPhysicalMaterial
          ref={lensMaterial}
          color={lensColor}
          emissive={isBurned ? "#ea580c" : color}
          emissiveIntensity={0.025}
          roughness={0.09}
          metalness={0}
          transparent
          opacity={0.7}
          depthWrite
          clearcoat={0.96}
          clearcoatRoughness={0.08}
          ior={1.48}
        />
      </mesh>

      {/* Internal reflector cup */}
      <mesh position={[body.x, baseY + 0.060, body.z]}>
        <cylinderGeometry
          args={[0.050, 0.030, 0.032, 24, 1, true]}
        />
        <meshStandardMaterial
          color="#dfe4e8"
          metalness={0.82}
          roughness={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Tiny gold bond wire from the LED die to the lead frame. */}
      <mesh raycast={() => null}>
        <tubeGeometry args={[new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(body.x - 0.011, baseY + 0.0854, body.z),
          new THREE.Vector3(body.x + 0.012, baseY + 0.137, body.z + 0.005),
          new THREE.Vector3(body.x + 0.040, baseY + 0.078, body.z),
        ), 10, 0.002, 5, false]} />
        <meshStandardMaterial color="#d8b45c" metalness={0.93} roughness={0.22} />
      </mesh>
      {/* Molded cathode flat / polarity notch in the lens rim. */}
      <mesh position={[body.x + (k.x > a.x ? 0.115 : -0.115), baseY + 0.01, body.z]}
        castShadow>
        <boxGeometry args={[0.008, 0.018, 0.055]} />
        <meshStandardMaterial color={isBurned ? '#302924' : lightenColor(color, 0.55)} roughness={0.32} />
      </mesh>

      {/* Emitting die */}
      <mesh position={[body.x, baseY + 0.085, body.z]}>
        <boxGeometry args={[0.017, 0.016, 0.017]} />
        <meshStandardMaterial
          ref={dieMaterial}
          color="#fff8e1"
          emissive={isBurned ? "#ea580c" : color}
          emissiveIntensity={0.08}
          roughness={0.18}
          metalness={0.05}
        />
      </mesh>

      <LedAura
        position={new THREE.Vector3(
          body.x,
          baseY + bodyHeight * 0.62,
          body.z,
        )}
        color={glowColor}
        active={isOn || isBurned}
        brightness={isBurned ? 0.85 : brightness}
      />

      <SmokePuffs
        position={new THREE.Vector3(body.x, body.y + 0.05, body.z)}
        active={isBurned}
      />

      {part.props.label && (
        <Html
          position={[body.x, body.y + 0.19, body.z]}
          center
          distanceFactor={5}
        >
          <div
            style={{
              color: "#f8fafc",
              fontSize: "10px",
              fontWeight: 900,
              textShadow: "0 2px 6px #000",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {part.props.label}
          </div>
        </Html>
      )}
    </group>
  );
}

export function DiodeMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
 

  // =========================================================
  // PIN POSITIONS
  // =========================================================

  const a = vec(part.pins.a);
  const k = vec(part.pins.k);

  // Direction from ANODE -> CATHODE
  const dir = k.clone().sub(a);
  dir.y = 0;

  const pinDistance = dir.length();

  if (pinDistance < 0.001) {
    return null;
  }

  dir.normalize();

  // =========================================================
  // SIMULATION
  // =========================================================

  const conducting =
    Boolean(sim.diodes[part.id]?.on);

  // =========================================================
  // BODY POSITION
  // =========================================================

  const body = a.clone().lerp(k, 0.5);

  body.y = BOARD.height + 0.14;

  // =========================================================
  // BODY DIMENSIONS
  // =========================================================

  const bodyRadius = 0.052;
  const bodyLength = Math.min(
    0.38,
    Math.max(0.22, pinDistance * 0.48),
  );

  const halfBody = bodyLength / 2;

  // =========================================================
  // CATHODE SILVER STRIP
  // =========================================================

  // The strip is deliberately thick and slightly larger
  // than the black body.

  const cathodeStripWidth = 0.065;

  const cathodeStripRadius =
    bodyRadius * 1.10;

  // Position it close to the cathode end.
  const cathodeStripPosition =
    halfBody - 0.075;

  // =========================================================
  // ANODE SILVER COLLAR
  // =========================================================

  const anodeCollarWidth = 0.035;

  const anodeCollarRadius =
    bodyRadius * 1.035;

  // =========================================================
  // ROTATION
  // =========================================================

  // CylinderGeometry points along local Y.
  // Rotate local Y to follow ANODE -> CATHODE.

  const quat =
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir,
    );

  // =========================================================
  // BODY END POSITIONS
  // =========================================================

  const anodeEnd =
    body.clone().add(
      dir
        .clone()
        .multiplyScalar(-halfBody),
    );

  const cathodeEnd =
    body.clone().add(
      dir
        .clone()
        .multiplyScalar(halfBody),
    );

  // =========================================================
  // LEADS
  // =========================================================

  const leadRadius = 0.012;

  const leadBendY =
    BOARD.height + 0.035;

  const leadTopY =
    body.y;

  function createLeadCurve(
    pin: THREE.Vector3,
    bodyEnd: THREE.Vector3,
  ) {
    return new THREE.CatmullRomCurve3(
      [
        pin.clone(),

        new THREE.Vector3(
          pin.x,
          leadBendY,
          pin.z,
        ),

        new THREE.Vector3(
          pin.x,
          leadTopY - 0.035,
          pin.z,
        ),

        bodyEnd.clone(),
      ],
      false,
      "centripetal",
      0.2,
    );
  }

  const anodeLead =
    createLeadCurve(
      a,
      anodeEnd,
    );

  const cathodeLead =
    createLeadCurve(
      k,
      cathodeEnd,
    );

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab
          .getState()
          .select(part.id);
      }}
    >

      {/* =====================================================
          ANODE LEAD
      ===================================================== */}

      <mesh castShadow>
        <tubeGeometry
          args={[
            anodeLead,
            24,
            leadRadius,
            10,
            false,
          ]}
        />

        <meshStandardMaterial
          color="#8b8f94"
          metalness={0.8}
          roughness={0.22}
        />
      </mesh>


      {/* =====================================================
          CATHODE LEAD
      ===================================================== */}

      <mesh castShadow>
        <tubeGeometry
          args={[
            cathodeLead,
            24,
            leadRadius,
            10,
            false,
          ]}
        />

        <meshStandardMaterial
          color="#8b8f94"
          metalness={0.8}
          roughness={0.22}
        />
      </mesh>


      {/* =====================================================
          DIODE
      ===================================================== */}

      <group
        position={body}
        quaternion={quat}
        scale={
          selected
            ? [1.08, 1.08, 1.08]
            : [1, 1, 1]
        }
      >

        {/* ===================================================
            MAIN BLACK BODY
        =================================================== */}

        <mesh
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              bodyRadius,
              bodyRadius,
              bodyLength,
              32,
              1,
            ]}
          />

        <meshStandardMaterial
          color={selected ? "#2f2f2f" : "#151515"}
          roughness={0.48}
          metalness={0.02}
        />
        </mesh>


        {/* ===================================================
            ANODE SILVER COLLAR
        =================================================== */}

        <mesh
          position={[
            0,
            -halfBody +
              anodeCollarWidth / 2,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              anodeCollarRadius,
              anodeCollarRadius,
              anodeCollarWidth,
              32,
              1,
            ]}
          />

          <meshStandardMaterial
            color="#bfc3c7"
            metalness={0.65}
            roughness={0.25}
            emissive="#222222"
            emissiveIntensity={0.15}
          />
        </mesh>


        {/* ===================================================
            CATHODE WHITE STRIP
        =================================================== */}

        <mesh
          position={[
            0,
            cathodeStripPosition,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry
            args={[
              cathodeStripRadius,
              cathodeStripRadius,
              cathodeStripWidth,
              32,
              1,
            ]}
          />

          <meshStandardMaterial
            color="#ffffff"
            metalness={0}
            roughness={0.35}
            emissive="#ffffff"
            emissiveIntensity={0.15}
          />
        </mesh>


        {/* ===================================================
            WHITE STRIP HIGHLIGHT
        =================================================== */}

        <mesh
          position={[
            0,
            cathodeStripPosition +
              cathodeStripWidth / 2 -
              0.006,
            0,
          ]}
          castShadow
        >
          <cylinderGeometry
            args={[
              cathodeStripRadius * 1.015,
              cathodeStripRadius * 1.015,
              0.012,
              32,
              1,
            ]}
          />

          <meshStandardMaterial
            color="#ffffff"
            metalness={0}
            roughness={0.25}
            emissive="#ffffff"
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* ===================================================
            BLACK CATHODE END
        =================================================== */}

        <mesh
          position={[
            0,
            halfBody - 0.006,
            0,
          ]}
          castShadow
          receiveShadow
        >
<cylinderGeometry
  args={[
    bodyRadius * 1.02,
    bodyRadius * 1.02,
    0.028,
    24,
  ]}
/>
<meshStandardMaterial
  color="#d8dadd"
  roughness={0.35}
  metalness={0.05}
/>
        </mesh>


        {/* ===================================================
            CONDUCTION GLOW
        =================================================== */}

        {conducting && (
          <pointLight
            position={[
              0,
              0,
              0,
            ]}
            color="#fbbf24"
            intensity={0.20}
            distance={0.60}
          />
        )}

      </group>


      {/* =====================================================
          HOVER POLARITY LABELS
      ===================================================== */}



      {/* =====================================================
          COMPONENT NAME
      ===================================================== */}

      {part.props.label && (
        <Html
          position={[
            body.x,
            body.y + 0.20,
            body.z,
          ]}
          center
          distanceFactor={5}
        >
          <div
            style={{
              color: "white",
              fontSize: 10,
              fontWeight: 800,
              textShadow:
                "0 2px 5px #000",
              pointerEvents:
                "none",
              whiteSpace:
                "nowrap",
            }}
          >
            {part.props.label}
          </div>
        </Html>
      )}

    </group>
  );
}

function SwitchLever({
  closed,
  selected,
}: {
  closed: boolean;
  selected: boolean;
}) {
  const lever = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!lever.current) return;

    lever.current.rotation.x = THREE.MathUtils.damp(
      lever.current.rotation.x,
      closed ? -0.08 : 0.10,
      14,
      delta,
    );
  });

  return (
    <group ref={lever}>

      {/* BLUE ACTUATOR BASE */}
      <mesh
        position={[0, 0.19, 0]}
        castShadow
      >
        <boxGeometry
          args={[0.115, 0.075, 0.12]}
        />

        <meshStandardMaterial
          color={
            selected
              ? "#60a5fa"
              : "#2563eb"
          }
          roughness={0.25}
          metalness={0.02}
        />
      </mesh>

      {/* BLUE BUTTON */}
      <mesh
        position={[0, 0.255, 0]}
        castShadow
      >
        <boxGeometry
          args={[0.075, 0.085, 0.075]}
        />

        <meshStandardMaterial
          color={
            closed
              ? "#2563eb"
              : "#1d4ed8"
          }
          roughness={0.22}
          metalness={0.02}
        />
      </mesh>

      {/* Textured thumb grip prevents the lever from looking like an unmarked cube. */}
      {[-0.023, 0, 0.023].map((x) => (
        <mesh key={`grip-${x}`} position={[x, 0.305, 0]} castShadow>
          <boxGeometry args={[0.008, 0.006, 0.055]} />
          <meshStandardMaterial color="#93c5fd" roughness={0.43} />
        </mesh>
      ))}

      {/* TOP OF BUTTON */}
      <mesh
        position={[0, 0.302, 0]}
        castShadow
      >
        <boxGeometry
          args={[0.06, 0.025, 0.06]}
        />

        <meshStandardMaterial
          color="#3b82f6"
          roughness={0.2}
        />
      </mesh>

    </group>
  );
}

function MultiSwitchMesh({
  part,
  selected,
}: {
  part: PlacedPart;
  selected: boolean;
}) {
  const type = part.props.switchType ?? (
    part.pins.com1 ? "dpdt" :
    part.pins.a1 ? "dpst" :
    part.pins.com ? "spdt" : "spst"
  );
  const position = part.props.switchPosition ?? (part.props.closed ? "no" : "open");
  const pinEntries = Object.entries(part.pins);
  const pinPoints = pinEntries.map(([, pin]) => vec(pin));
  const body = pinPoints.reduce((sum, point) => sum.add(point), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(pinPoints.length, 1));
  body.y = BOARD.height + 0.2;
  const pairCount = type === "dpst" || type === "dpdt" ? 2 : 1;
  const isThrow = type === "spdt" || type === "dpdt";
  const width = pairCount === 2 ? 0.46 : 0.30;
  const height = isThrow ? 0.18 : 0.14;

  const toggle = () => {
    const lab = useLab.getState();
    if (lab.tool === "delete") {
      lab.select(part.id);
      lab.deleteSelected();
      return;
    }
    if (lab.tool === "select" && lab.selectedId !== part.id) {
      lab.select(part.id);
      return;
    }
    lab.toggleSwitch(part.id);
    lab.select(part.id);
  };

  return (
    <group onClick={(e) => { e.stopPropagation(); toggle(); }}>
      {pinEntries.map(([name, pin]) => {
        const point = vec(pin);
        return (
          <group key={name}>
            <BentBoardLead pin={point} body={body} color="#c0c5cc" />
            <BoardPinMarker
              position={point}
              label={name.toUpperCase()}
              color="#94a3b8"
              labelColor="#e2e8f0"
            />
          </group>
        );
      })}
      <group position={[body.x, body.y, body.z]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, height, 0.28]} />
          <meshStandardMaterial
            color={selected ? "#334155" : "#1f2937"}
            roughness={0.32}
            metalness={0.15}
          />
        </mesh>
        <mesh position={[0, height / 2 + 0.045, 0]} castShadow>
          <boxGeometry args={[width * 0.82, 0.06, 0.19]} />
          <meshStandardMaterial color={selected ? "#93c5fd" : "#64748b"} roughness={0.28} />
        </mesh>
        {Array.from({ length: pairCount }, (_, index) => {
          const x = pairCount === 1 ? 0 : (index === 0 ? -0.12 : 0.12);
          const active = position !== "open" && (position === "no" || type === "dpst");
          return (
            <group key={index} position={[x, height / 2 + 0.10, 0]}>
              <mesh rotation={[0, 0, active ? -0.18 : 0.24]} position={[0, 0.02, 0]} castShadow>
                <boxGeometry args={[0.16, 0.025, 0.025]} />
                <meshStandardMaterial color={active ? "#2563eb" : "#94a3b8"} metalness={0.5} />
              </mesh>
              <mesh position={[0, 0.055, 0]} castShadow>
                <cylinderGeometry args={[0.045, 0.05, 0.06, 12]} />
                <meshStandardMaterial color={active ? "#3b82f6" : "#cbd5e1"} roughness={0.25} />
              </mesh>
            </group>
          );
        })}
      </group>
      {part.props.label && (
        <Html position={[body.x, body.y + 0.34, body.z]} center distanceFactor={5}>
          <div style={{ color: "#fff", fontSize: 10, fontWeight: 800, textShadow: "0 2px 5px #000", pointerEvents: "none", whiteSpace: "nowrap" }}>
            {part.props.label}
          </div>
        </Html>
      )}
    </group>
  );
}


export function SwitchMesh({
  part,
  selected,
}: {
  part: PlacedPart;
  selected: boolean;
}) {
  const switchType = part.props.switchType ?? (
    part.pins.com1 ? "dpdt" :
    part.pins.a1 ? "dpst" :
    part.pins.com ? "spdt" : "spst"
  );
  if (switchType !== "spst") {
    return <MultiSwitchMesh part={part} selected={selected} />;
  }
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);

  // =========================================================
  // CENTER
  // =========================================================

  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.2;

  // =========================================================
  // ORIENTATION
  // =========================================================

  const orientation = useMemo(() => {
    const direction = b.clone().sub(a);

    direction.y = 0;

    if (direction.lengthSq() < 0.0001) {
      return new THREE.Quaternion();
    }

    direction.normalize();

    return new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(1, 0, 0),
      direction,
    );
  }, [a.x, a.z, b.x, b.z]);


  const closed = Boolean(part.props.closed);


  // =========================================================
  // 6 PHYSICAL PINS
  //
  // 3 pins on one side
  // 3 pins on the other side
  //
  //       ●   ●   ●
  //
  //       SWITCH
  //
  //       ●   ●   ●
  // =========================================================

  const pinX = 0.105;
  const pinZ = 0.075;
  // Short decorative legs under the housing — do not dig into the board
  const pinPositions = [
    [-pinX, -0.055, -pinZ],
    [0,     -0.055, -pinZ],
    [pinX,  -0.055, -pinZ],
    [-pinX, -0.055, pinZ],
    [0,     -0.055, pinZ],
    [pinX,  -0.055, pinZ],
  ];


  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        const lab = useLab.getState();
        if (lab.tool === "delete") {
          lab.select(part.id);
          lab.deleteSelected();
          return;
        }
        if (lab.tool === "select" && lab.selectedId !== part.id) {
          lab.select(part.id);
          return;
        }
        // Toggle only when already selected (select tool) or interacting with other tools
        lab.toggleSwitch(part.id);
        lab.select(part.id);
      }}
    >
      {/* Real electrical pins — vertical into breadboard holes */}
      <BentBoardLead pin={a} body={body} color="#c0c5cc" />
      <BentBoardLead pin={b} body={body} color="#c0c5cc" />
      <BoardPinMarker position={a} label="A" color="#94a3b8" labelColor="#e2e8f0" />
      <BoardPinMarker position={b} label="B" color="#94a3b8" labelColor="#e2e8f0" />

      {/* =====================================================
          SWITCH BODY
      ===================================================== */}

      <group
        position={body}
        quaternion={orientation}
      >

        {/* ===================================================
            SIX METAL PINS
        =================================================== */}

        {pinPositions.map(
          ([x, y, z], index) => (
            <mesh
              key={`switch-pin-${index}`}
              position={[x, y, z]}
              castShadow
            >
              <cylinderGeometry
                args={[
                  0.011,
                  0.012,
                  0.07,
                  10,
                ]}
              />

              <meshStandardMaterial
                color="#8b9299"
                metalness={0.9}
                roughness={0.2}
              />
            </mesh>
          ),
        )}


        {/* ===================================================
            BLACK LOWER BODY
        =================================================== */}

        <mesh
          position={[
            0,
            0,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              0.34,
              0.13,
              0.24,
            ]}
          />

          <meshStandardMaterial
            color={
              selected
                ? "#374151"
                : "#111111"
            }
            roughness={0.32}
            metalness={0.08}
          />
        </mesh>


        {/* ===================================================
            WHITE UPPER HOUSING
        =================================================== */}

        <mesh
          position={[
            0,
            0.085,
            0,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              0.36,
              0.075,
              0.26,
            ]}
          />

          <meshStandardMaterial
            color={
              selected
                ? "#ffffff"
                : "#e5e7eb"
            }
            roughness={0.38}
            metalness={0.02}
          />
        </mesh>


        {/* ===================================================
            WHITE TOP SURFACE
        =================================================== */}

        <mesh
          position={[
            0,
            0.135,
            0,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              0.31,
              0.035,
              0.21,
            ]}
          />

          <meshStandardMaterial
            color="#f8fafc"
            roughness={0.3}
            metalness={0.01}
          />
        </mesh>


        {/* Mold parting line and fasteners on the switch enclosure. */}
        {[-0.125, 0.125].map((x) => (
          <group key={`switch-screw-${x}`} position={[x, 0.154, -0.088]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.016, 0.016, 0.008, 12]} />
              <meshStandardMaterial color="#aeb7c3" metalness={0.82} roughness={0.34} />
            </mesh>
            <mesh position={[0, 0.005, 0]}>
              <boxGeometry args={[0.016, 0.002, 0.003]} />
              <meshBasicMaterial color="#303843" />
            </mesh>
          </group>
        ))}
        <PrintedMark text="OFF       ON" position={[0, 0.157, 0.095]}
          rotation={[-Math.PI / 2, 0, 0]} width={0.23} height={0.037}
          color="#46505e" opacity={0.72} />
        {/* ===================================================
            BLUE ACTUATOR
        =================================================== */}

        <SwitchLever
          closed={closed}
          selected={selected}
        />

      </group>


      {/* =====================================================
          ELECTRICAL CONNECTION LEADS
      ===================================================== */}

      <Lead
        from={a}
        to={body.clone().add(
          new THREE.Vector3(
            -0.105,
            0,
            0,
          ).applyQuaternion(
            orientation,
          ),
        )}
      />

      <Lead
        from={b}
        to={body.clone().add(
          new THREE.Vector3(
             0.105,
            0,
            0,
          ).applyQuaternion(
            orientation,
          ),
        )}
      />


      {/* =====================================================
          COMPONENT LABEL
      ===================================================== */}

      {part.props.label && (
        <Html
          position={[
            body.x,
            body.y + 0.36,
            body.z,
          ]}
          center
          distanceFactor={5}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: "10px",
              fontWeight: 800,
              textShadow:
                "0 2px 5px #000",
              pointerEvents:
                "none",
              whiteSpace:
                "nowrap",
            }}
          >
            {part.props.label}
          </div>
        </Html>
      )}

    </group>
  );
}

const CAPACITOR_MATERIALS = {
  ceramic: {
    color: "#d8b269",
    roughness: 0.66,
    metalness: 0.0,
  },
  film: {
    color: "#1f7a45",
    roughness: 0.42,
    metalness: 0.0,
  },
  electrolytic: {
    color: "#16233a",
    roughness: 0.34,
    metalness: 0.08,
  },
  tantalum: {
    color: "#c26a3c",
    roughness: 0.48,
    metalness: 0.03,
  },
};

export function CapacitorMesh({
  part,
  selected,
}: {
  part: PlacedPart;
  selected: boolean;
}) {

  // =========================================================
  // PIN POSITIONS
  // =========================================================

  const a = vec(part.pins.a);
  const b = vec(part.pins.b);

  const direction = b.clone().sub(a);
  direction.y = 0;

  const pinDistance = direction.length();

  if (pinDistance < 0.001) {
    return null;
  }

  direction.normalize();

  // =========================================================
  // CAPACITANCE VALUE
  // =========================================================

  const rawValue =
    part.props.capacitance ??
    "100nF";

  const capacitance =
    typeof rawValue === "number"
      ? rawValue
      : parseCapacitance(String(rawValue));

  // =========================================================
  // CAPACITOR TYPE
  // =========================================================
  //
  // If capacitorType was explicitly selected, use it.
  // Otherwise automatically determine the appearance
  // from the capacitance value.
  //

  const explicitType = String(
    part.props.capacitorType ?? "",
  ).toLowerCase();

  const capacitorType =
    explicitType === "ceramic" ||
    explicitType === "film" ||
    explicitType === "electrolytic" ||
    explicitType === "tantalum"
      ? explicitType
      : getCapacitorVisualType(capacitance);

  // =========================================================
  // BODY POSITION
  // =========================================================

  const body = a.clone().lerp(b, 0.5);

  const upright = capacitorType === 'electrolytic' || capacitorType === 'tantalum';
  const bodyY = BOARD.height + (upright ? 0.185 : 0.15);

  body.y = bodyY;

  // =========================================================
  // ROTATION
  // =========================================================

  const orientation =
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction,
    );

  // =========================================================
  // DIMENSIONS
  // =========================================================

  let radius = 0.075;
  let bodyLength = 0.20;

  switch (capacitorType) {
    case "ceramic":
      radius = 0.065;
      bodyLength = 0.115;
      break;

    case "film":
      radius = 0.085;
      bodyLength = 0.22;
      break;

    case "electrolytic":
      radius = 0.085;
      bodyLength = 0.27;
      break;

    case "tantalum":
      radius = 0.08;
      bodyLength = 0.18;
      break;
  }

  const halfLength =
    bodyLength / 2;

  // =========================================================
  // BODY ENDS
  // =========================================================

  const bodyEndA =
    body
      .clone()
      .add(
        direction
          .clone()
          .multiplyScalar(-halfLength),
      );

  const bodyEndB =
    body
      .clone()
      .add(
        direction
          .clone()
          .multiplyScalar(halfLength),
      );

  // =========================================================
  // LEADS
  // =========================================================

  const leadRadius = 0.012;

  // Electrolytics and tantalums are radial, upright packages. Their
  // two leads fold beneath the base instead of emerging from the can ends.
  const radialLeadTarget = (side: -1 | 1) => body.clone()
    .add(direction.clone().multiplyScalar(side * 0.042))
    .setY(bodyY - (capacitorType === 'tantalum' ? radius * 0.63 : bodyLength / 2));
  const radialLead = (pin: THREE.Vector3, target: THREE.Vector3) =>
    new THREE.CatmullRomCurve3([
      pin.clone(),
      new THREE.Vector3(pin.x, BOARD.height + 0.055, pin.z),
      new THREE.Vector3(target.x, BOARD.height + 0.075, target.z),
      target,
    ], false, 'centripetal', 0.2);
  const leadA = upright
    ? radialLead(a, radialLeadTarget(-1))
    : createCapacitorLead(a, bodyEndA, bodyY);
  const leadB = upright
    ? radialLead(b, radialLeadTarget(1))
    : createCapacitorLead(b, bodyEndB, bodyY);

// =========================================================
// MATERIAL
// =========================================================

const capacitorMaterial =
  CAPACITOR_MATERIALS[
    capacitorType as keyof typeof CAPACITOR_MATERIALS
  ];

const bodyColor = selected
  ? "#93c5fd"
  : capacitorMaterial.color;

const bodyRoughness = selected
  ? 0.35
  : capacitorMaterial.roughness;

const bodyMetalness = selected
  ? 0.03
  : capacitorMaterial.metalness;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab
          .getState()
          .select(part.id);
      }}
    >

      {/* =====================================================
          LEAD 1
      ===================================================== */}

      <mesh castShadow>
        <tubeGeometry
          args={[
            leadA,
            20,
            leadRadius,
            10,
            false,
          ]}
        />

        <meshStandardMaterial
          color="#8b9096"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      {/* =====================================================
          LEAD 2
      ===================================================== */}

      <mesh castShadow>
        <tubeGeometry
          args={[
            leadB,
            20,
            leadRadius,
            10,
            false,
          ]}
        />

        <meshStandardMaterial
          color="#8b9096"
          metalness={0.9}
          roughness={0.2}
        />
      </mesh>

      {/* =====================================================
          CAPACITOR
      ===================================================== */}

      <group
        position={body}
        quaternion={upright ? new THREE.Quaternion() : orientation}
        scale={
          selected
            ? [1.08, 1.08, 1.08]
            : [1, 1, 1]
        }
      >

        {/* ===================================================
            CERAMIC
        =================================================== */}

        {capacitorType === "ceramic" && (
          <group>

            <mesh
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[
                  radius,
                  radius,
                  bodyLength,
                  24,
                ]}
              />

              <meshStandardMaterial
                color={bodyColor}
                roughness={bodyRoughness}
                metalness={bodyMetalness}
              />
            </mesh>

            {/* TOP CERAMIC CAP */}

            <mesh
              position={[
                0,
                halfLength + 0.006,
                0,
              ]}
            >
              <cylinderGeometry
                args={[
                  radius * 0.88,
                  radius * 0.88,
                  0.012,
                  24,
                ]}
              />

              <meshStandardMaterial
                color={bodyColor}
                roughness={bodyRoughness}
                metalness={bodyMetalness}
              />
            </mesh>

          </group>
        )}

        {/* ===================================================
            FILM
        =================================================== */}

        {capacitorType === "film" && (
          <group>

            <mesh
              castShadow
              receiveShadow
            >
              <boxGeometry
                args={[
                  radius * 1.9,
                  bodyLength,
                  radius * 1.5,
                ]}
              />

              <meshStandardMaterial
                color={bodyColor}
                roughness={bodyRoughness}
                metalness={bodyMetalness}
              />
            </mesh>

            {/* TOP FACE */}

            <mesh
              position={[
                0,
                halfLength + 0.005,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  radius * 1.55,
                  0.01,
                  radius * 1.2,
                ]}
              />

              <meshStandardMaterial
                color="#4ade80"
                roughness={0.25}
              />
            </mesh>

          </group>
        )}

        {/* ===================================================
            ELECTROLYTIC
        =================================================== */}

        {capacitorType === "electrolytic" && (
          <group>

            {/* MAIN CYLINDER */}

            <mesh
              castShadow
              receiveShadow
            >
              <cylinderGeometry
                args={[
                  radius,
                  radius,
                  bodyLength,
                  32,
                ]}
              />

              <meshStandardMaterial
                color={bodyColor}
                roughness={bodyRoughness}
                metalness={bodyMetalness}
              />
            </mesh>

            {/* TOP SILVER CAP */}

            <mesh
              position={[
                0,
                halfLength + 0.009,
                0,
              ]}
            >
              <cylinderGeometry
                args={[
                  radius * 0.94,
                  radius * 0.94,
                  0.018,
                  32,
                ]}
              />

              <meshPhysicalMaterial color="#aeb7c1" metalness={0.78} roughness={0.28} clearcoat={0.22} />
            </mesh>

            {/* Vinyl negative stripe follows the curved aluminum sleeve.
                White polarity markings are printed directly on the model. */}
            <mesh>
              <cylinderGeometry args={[radius + 0.0015, radius + 0.0015, bodyLength * 0.89, 32, 1, true, 1.20, 0.76]} />
              <meshPhysicalMaterial color="#dce5ec" roughness={0.74} metalness={0.02} side={THREE.DoubleSide} />
            </mesh>
            <PrintedMark text="− − −" position={[radius + 0.011, 0, 0]}
              rotation={[0, -Math.PI / 2, Math.PI / 2]}
              width={bodyLength * 0.68} height={0.035}
              color="#304050" opacity={0.88} />
            {/* End crimp and cross-scored safety vent */}
            {[-Math.PI / 4, Math.PI / 4].map((angle) => (
              <mesh key={`safety-vent-${angle}`} position={[0, halfLength + 0.02, 0]} rotation={[0, angle, 0]}>
                <boxGeometry args={[radius * 1.15, 0.004, 0.009]} />
                <meshStandardMaterial color="#64748b" metalness={0.72} roughness={0.36} />
              </mesh>
            ))}

          </group>
        )}

        {/* ===================================================
            TANTALUM
        =================================================== */}

        {capacitorType === "tantalum" && (
          <group>

            <mesh
              castShadow
              receiveShadow
              scale={[
                1,
                1,
                0.85,
              ]}
            >
              <sphereGeometry
                args={[
                  radius,
                  24,
                  16,
                ]}
              />

              <meshStandardMaterial
                color={bodyColor}
                roughness={bodyRoughness}
                metalness={bodyMetalness}
              />
            </mesh>

            {/* POSITIVE MARK */}

            <mesh
              position={[
                0,
                radius * 0.78,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  0.035,
                  0.008,
                  0.035,
                ]}
              />

              <meshStandardMaterial
                color={bodyColor}
              />
            </mesh>

          </group>
        )}

        {/* Permanent manufacturer's value / voltage marks are on the part,
            unlike the old floating inspector-style labels. */}
        <PrintedMark
          text={formatCapacitance(capacitance)}
          secondary={capacitorType === 'electrolytic' ? `${part.props.voltageRating ?? 16}V` : capacitorType === 'film' ? `${part.props.voltageRating ?? 63}V` : undefined}
          position={[0, 0, capacitorType === 'film' ? radius * 0.8 : radius + 0.012]}
          rotation={[0, 0, Math.PI / 2]}
          width={Math.max(0.13, bodyLength * 0.79)} height={radius * 1.1}
          color={capacitorType === 'ceramic' ? '#4b3524' : '#edf5fb'} opacity={0.88}
        />
        {capacitorType === 'tantalum' && (
          <PrintedMark text="+" position={[0, 0, radius + 0.016]}
            width={0.052} height={0.055} color="#fff3df" opacity={0.95} />
        )}
      </group>

      {/* =====================================================
          VALUE LABEL
      ===================================================== */}

    

      {/* =====================================================
          PIN LABELS
      ===================================================== */}


      {/* =====================================================
          COMPONENT LABEL
      ===================================================== */}

      {part.props.label && (
        <Html
          position={[
            body.x,
            body.y + 0.34,
            body.z,
          ]}
          center
          distanceFactor={5}
        >
          <div
            style={{
              color: "#f8fafc",
              fontSize: "10px",
              fontWeight: 900,
              textShadow:
                "0 2px 6px #000",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            {part.props.label}
          </div>
        </Html>
      )}

    </group>
  );
}

function parseCapacitance(
  value: string,
): number {
  const v = value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const match = v.match(
    /^([\d.]+)(pf|nf|uf|µf|mf|f)?$/,
  );

  if (!match) {
    return 100e-9;
  }

  const number = Number(match[1]);
  const unit = match[2] ?? "f";

  switch (unit) {
    case "pf":
      return number * 1e-12;

    case "nf":
      return number * 1e-9;

    case "uf":
    case "µf":
      return number * 1e-6;

    case "mf":
      return number * 1e-3;

    case "f":
    default:
      return number;
  }
}

function getCapacitorVisualType(
  capacitance: number,
): "ceramic" | "film" | "electrolytic" {
  // Very small capacitors
  if (capacitance < 1e-9) {
    return "ceramic";
  }

  // 1 nF – 100 nF
  if (capacitance < 100e-9) {
    return "ceramic";
  }

  // 100 nF – 1 µF
  if (capacitance < 1e-6) {
    return "film";
  }

  // 1 µF and above
  return "electrolytic";
}

function formatCapacitance(
  value: number,
): string {
  if (value >= 1) {
    return `${value} F`;
  }

  if (value >= 1e-3) {
    return `${(value * 1e3).toFixed(2)} mF`;
  }

  if (value >= 1e-6) {
    return `${(value * 1e6).toFixed(2)} µF`;
  }

  if (value >= 1e-9) {
    return `${(value * 1e9).toFixed(2)} nF`;
  }

  return `${(value * 1e12).toFixed(2)} pF`;
}

function createCapacitorLead(
  pin: THREE.Vector3,
  bodyEnd: THREE.Vector3,
  bodyY: number,
) {
  const bendY =
    BOARD.height + 0.035;

  const points = [
    pin.clone(),

    new THREE.Vector3(
      pin.x,
      bendY,
      pin.z,
    ),

    new THREE.Vector3(
      pin.x,
      bodyY - 0.035,
      pin.z,
    ),

    bodyEnd.clone(),
  ];

  return new THREE.CatmullRomCurve3(
    points,
    false,
    "centripetal",
    0.2,
  );
}


class ToroidCurve extends THREE.Curve<THREE.Vector3> {
  constructor(
    private readonly turns: number,
    private readonly majorRadius: number,
    private readonly coreRadius: number,
    private readonly wireRadius: number,
  ) {
    super();
  }

  getPoint(
    t: number,
    target = new THREE.Vector3(),
  ) {
    const phi = t * Math.PI * 2;
    const theta = t * this.turns * Math.PI * 2;

    // Keep the copper winding just outside the ferrite core.
    const windingRadius =
      this.coreRadius + this.wireRadius * 1.05;

    const radial =
      this.majorRadius +
      windingRadius * Math.cos(theta);

    target.set(
      radial * Math.cos(phi),
      radial * Math.sin(phi),
      windingRadius * Math.sin(theta),
    );

    return target;
  }
}


function createToroidWindingCurve(
  turns: number,
  majorRadius: number,
  coreRadius: number,
  wireRadius: number,
) {
  return new ToroidCurve(
    turns,
    majorRadius,
    coreRadius,
    wireRadius,
  );
}


function ToroidWinding({
  turns,
  majorRadius,
  coreRadius,
  wireRadius,
  materialRef,
}: {
  turns: number;
  majorRadius: number;
  coreRadius: number;
  wireRadius: number;
  materialRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const curve = useMemo(
    () =>
      createToroidWindingCurve(
        turns,
        majorRadius,
        coreRadius,
        wireRadius,
      ),
    [
      turns,
      majorRadius,
      coreRadius,
      wireRadius,
    ],
  );

  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        curve,
        turns * 32,
        wireRadius,
        12,
        false,
      ),
    [
      curve,
      turns,
      wireRadius,
    ],
  );

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        ref={materialRef as React.Ref<THREE.MeshStandardMaterial>}
        color="#a85f45"
        emissive="#c2410c"
        emissiveIntensity={0}
        metalness={0.88}
        roughness={0.20}
      />
    </mesh>
  );
}


export function InductorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim?: SimResult;
}) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const current = Math.abs(
    (sim?.inductors?.[part.id] as { current?: number } | undefined)
      ?.current ?? 0,
  );
  const active = current > 0.0005;
  const windingMat = useRef<THREE.MeshStandardMaterial>(null);
  const coreMat = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pulse = active ? 0.55 + Math.sin(t * (6 + Math.min(current * 40, 12))) * 0.45 : 0;
    const energy = pulse * Math.min(1, current * 8 + 0.25);
    if (windingMat.current) {
      windingMat.current.emissiveIntensity = active ? 0.35 + energy * 1.1 : 0;
      windingMat.current.color.set(active ? "#d97757" : "#a85f45");
    }
    if (coreMat.current) {
      coreMat.current.emissiveIntensity = active ? 0.15 + energy * 0.35 : 0;
    }
  });


  /*
   * =========================================================
   * COMPONENT POSITION
   * =========================================================
   */

  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.50;


  /*
   * Direction between PCB pins.
   *
   * We only use this to rotate the component around the
   * vertical axis.
   */
  const direction = b.clone().sub(a);

  direction.y = 0;

  if (direction.lengthSq() < 0.000001) {
    direction.set(1, 0, 0);
  }

  direction.normalize();


  const angle = Math.atan2(
    direction.z,
    direction.x,
  );


  /*
   * =========================================================
   * CORE SIZE
   * =========================================================
   *
   * These proportions are intentionally much closer to the
   * reference image.
   */

  const majorRadius = 0.155;

  const coreRadius = 0.062;


  /*
   * Copper wire thickness.
   */
  const wireRadius = 0.011;


  /*
   * Dense winding like the reference.
   */
  const turns = 30;


  /*
   * =========================================================
   * LEADS
   * =========================================================
   *
   * The leads leave the LOWER portion of the toroid.
   */

  const leadSpacing = 0.070;

  const leadLength = 0.18;


  /*
   * Bottom of the toroid.
   */
  const bottomY =
    -(majorRadius + coreRadius * 0.55);


  /*
   * Local copper exit positions.
   */
  const leftExit = new THREE.Vector3(
    -leadSpacing,
    bottomY,
    0,
  );

  const rightExit = new THREE.Vector3(
    leadSpacing,
    bottomY,
    0,
  );


  /*
   * Bottom of the copper neck.
   */
  const leftLeadEnd =
    leftExit.clone();

  leftLeadEnd.y -= leadLength;


  const rightLeadEnd =
    rightExit.clone();

  rightLeadEnd.y -= leadLength;


  /*
   * Rotate a local point around the vertical axis.
   */
  const rotateLocal = (
    point: THREE.Vector3,
  ) => {
    point.applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      angle,
    );

    return body.clone().add(point);
  };


  const leftLeadWorld =
    rotateLocal(
      leftLeadEnd.clone(),
    );

  const rightLeadWorld =
    rotateLocal(
      rightLeadEnd.clone(),
    );


  /*
   * =========================================================
   * COMPONENT
   * =========================================================
   */

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab
          .getState()
          .select(part.id);
      }}
    >

      {/* =====================================================
          METAL PCB LEADS
         ===================================================== */}

      <Lead
        from={a}
        to={leftLeadWorld}
      />

      <Lead
        from={b}
        to={rightLeadWorld}
      />


      {/* =====================================================
          VERTICAL TOROID BODY
         ===================================================== */}

      <group
        position={body}
        rotation={[
          0,
          angle,
          0,
        ]}
      >

        {/* ===================================================
            FERRITE CORE

            IMPORTANT:
            NO Math.PI / 2 rotation here.

            THREE.TorusGeometry is already in the XY plane.

            XY = vertical
            Z  = depth

            Therefore the toroid stands like a tire.
           =================================================== */}

        <mesh>
          <torusGeometry
            args={[
              majorRadius,
              coreRadius,
              32,
              72,
            ]}
          />

          <meshStandardMaterial
            ref={coreMat}
            color={
              selected
                ? "#7a7f84"
                : "#a99b7c"
            }
            emissive="#f59e0b"
            emissiveIntensity={0}
            roughness={0.62}
            metalness={0.08}
          />
        </mesh>


        {/* ===================================================
            COPPER WINDING
           =================================================== */}

        <ToroidWinding
          turns={turns}
          majorRadius={majorRadius}
          coreRadius={coreRadius}
          wireRadius={wireRadius}
          materialRef={windingMat}
        />


        {/* ===================================================
            LEFT COPPER NECK
           =================================================== */}

        <mesh
          position={[
            -leadSpacing,
            bottomY -
              leadLength / 2,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              wireRadius,
              wireRadius,
              leadLength,
              12,
            ]}
          />

          <meshStandardMaterial
            color="#a85f45"
            metalness={0.88}
            roughness={0.20}
          />
        </mesh>


        {/* ===================================================
            RIGHT COPPER NECK
           =================================================== */}

        <mesh
          position={[
            leadSpacing,
            bottomY -
              leadLength / 2,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              wireRadius,
              wireRadius,
              leadLength,
              12,
            ]}
          />

          <meshStandardMaterial
            color="#a85f45"
            metalness={0.88}
            roughness={0.20}
          />
        </mesh>


        {/* ===================================================
            LEFT COPPER COLLAR
           =================================================== */}

        <mesh
          position={[
            -leadSpacing,
            bottomY -
              leadLength +
              0.025,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              wireRadius * 1.45,
              wireRadius * 1.45,
              0.035,
              12,
            ]}
          />

          <meshStandardMaterial
            color="#b66a4e"
            metalness={0.82}
            roughness={0.22}
          />
        </mesh>


        {/* ===================================================
            RIGHT COPPER COLLAR
           =================================================== */}

        <mesh
          position={[
            leadSpacing,
            bottomY -
              leadLength +
              0.025,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              wireRadius * 1.45,
              wireRadius * 1.45,
              0.035,
              12,
            ]}
          />

          <meshStandardMaterial
            color="#b66a4e"
            metalness={0.82}
            roughness={0.22}
          />
        </mesh>


        {/* ===================================================
            COPPER TRANSITION PIECES
           =================================================== */}

        <mesh
          position={[
            -leadSpacing,
            bottomY,
            0,
          ]}
        >
          <sphereGeometry
            args={[
              wireRadius * 1.18,
              12,
              8,
            ]}
          />

          <meshStandardMaterial
            color="#a85f45"
            metalness={0.88}
            roughness={0.20}
          />
        </mesh>


        <mesh
          position={[
            leadSpacing,
            bottomY,
            0,
          ]}
        >
          <sphereGeometry
            args={[
              wireRadius * 1.18,
              12,
              8,
            ]}
          />

          <meshStandardMaterial
            color="#a85f45"
            metalness={0.88}
            roughness={0.20}
          />
        </mesh>

      </group>
    </group>
  );
}

export function ButtonMesh({ part, selected }: { part: PlacedPart; selected: boolean }) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.18;
  const cap = useRef<THREE.Mesh>(null);
  const closed = Boolean(part.props.closed);
  const capColor: Record<string, string> = {
    'tactile-black': '#242a34', 'tactile-white': '#e5e7eb',
    'tactile-blue': '#276bb5', 'tactile-red': '#be2930',
    'tactile-low-profile': '#aab2bd',
  };
  const style = part.props.switchStyle ?? 'tactile-black';

  useFrame((_, delta) => {
    if (!cap.current) return;
    // Recoil: spring back up when released
    cap.current.position.y = THREE.MathUtils.damp(
      cap.current.position.y,
      closed ? 0.055 : 0.11,
      closed ? 28 : 18,
      delta,
    );
  });

  const press = (pressed: boolean) => {
    useLab.getState().setButtonPressed(part.id, pressed);
  };

  /** Select / delete vs physical press: delete tool removes, select tool selects, interact presses. */
  const handlePointerDown = (e: { stopPropagation: () => void; pointerId?: number; target?: EventTarget | null }) => {
    e.stopPropagation();
    const lab = useLab.getState();
    if (lab.tool === "delete") {
      lab.select(part.id);
      lab.deleteSelected();
      return;
    }
    if (lab.tool === "select" && lab.selectedId !== part.id) {
      lab.select(part.id);
      return;
    }
    // Already selected in select mode, or any other tool → press for simulation
    try {
      (e.target as HTMLElement)?.setPointerCapture?.(e.pointerId as number);
    } catch {
      /* ignore */
    }
    press(true);
  };

  return (
    <group
      onPointerDown={handlePointerDown}
      onPointerUp={(e) => {
        e.stopPropagation();
        press(false);
      }}
      onPointerLeave={() => {
        if (closed) press(false);
      }}
      onPointerCancel={() => press(false)}
      onClick={(e) => {
        e.stopPropagation();
        const lab = useLab.getState();
        if (lab.tool === "select") lab.select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} color="#c0c5cc" />
      <BentBoardLead pin={b} body={body} color="#c0c5cc" />
      <BoardPinMarker position={a} label="1" color="#94a3b8" labelColor="#e2e8f0" />
      <BoardPinMarker position={b} label="2" color="#94a3b8" labelColor="#e2e8f0" />
      <group position={body}>
        {/* Dark injection-molded base and stamped steel retaining plate. */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.26, 0.085, 0.26]} />
          <meshPhysicalMaterial color={selected ? "#475569" : "#1b2028"} metalness={0.08} roughness={0.74} clearcoat={0.12} />
        </mesh>
        <mesh position={[0, 0.051, 0]} castShadow>
          <boxGeometry args={[0.255, 0.018, 0.253]} />
          <meshStandardMaterial color="#a7b0ba" roughness={0.33} metalness={0.82} />
        </mesh>
        <mesh position={[0, 0.065, 0]} castShadow>
          <cylinderGeometry args={[0.098,0.098,0.022,24]} />
          <meshStandardMaterial color="#141b24" metalness={0.1} roughness={0.72} />
        </mesh>
        {/* Stamped retaining plate corners / fixing tabs */}
        {[-1,1].flatMap((x)=>[-1,1].map((z)=>(
          <mesh key={`${x}-${z}`} position={[x * 0.104, 0.065, z * 0.104]}>
            <sphereGeometry args={[0.012,8,8]} />
            <meshStandardMaterial color="#596677" metalness={0.7} roughness={0.34} />
          </mesh>
        )))}
        <mesh ref={cap} position={[0, 0.11, 0]} castShadow>
          <cylinderGeometry args={[0.067, 0.073, 0.058, 24]} />
          <meshPhysicalMaterial color={capColor[style] ?? capColor['tactile-black']}
            roughness={0.41} metalness={0.04} clearcoat={0.26} clearcoatRoughness={0.38} />
        </mesh>
      </group>
    </group>
  );
}

export function BuzzerMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const body = a.clone().lerp(b, 0.5);
  body.y += 0.13;
  const membrane = useRef<THREE.Mesh>(null);
  const state = sim.buzzers[part.id];
  const isBurned =
    Boolean(state?.overcurrent) ||
    Boolean(sim.burned?.[part.id]);
  const audioRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  // Web Audio beep while the buzzer is driven
  useEffect(() => {
    const on = Boolean(state?.on);
    const loudness = state?.loudness ?? (on ? 0.6 : 0);

    if (on) {
      if (!audioRef.current) {
        try {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AC();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.value = 880;
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          audioRef.current = { ctx, osc, gain };
        } catch {
          audioRef.current = null;
        }
      }
      const audio = audioRef.current;
      if (audio) {
        if (audio.ctx.state === "suspended") {
          void audio.ctx.resume();
        }
        audio.gain.gain.setTargetAtTime(
          0.04 + loudness * 0.08,
          audio.ctx.currentTime,
          0.03,
        );
      }
    } else if (audioRef.current) {
      const audio = audioRef.current;
      audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.05);
    }

    return () => {
      // keep oscillator alive across toggles; hard-stop on unmount only
    };
  }, [state?.on, state?.loudness]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.osc.stop();
        void audio.ctx.close();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!membrane.current) return;
    const loudness = state?.on ? state.loudness ?? 0.5 : 0;
    const vibration = loudness
      ? Math.sin(clock.getElapsedTime() * 42) * (0.012 + loudness * 0.018)
      : 0;
    membrane.current.position.y = THREE.MathUtils.damp(
      membrane.current.position.y,
      0.075 + vibration,
      38,
      delta,
    );
  });

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} />
      <BentBoardLead pin={b} body={body} />
      <group position={body}>
        <mesh castShadow>
          <cylinderGeometry args={[0.12, 0.1, 0.12, 22]} />
          <meshStandardMaterial color={selected ? "#475569" : "#151b25"} roughness={0.34} />
        </mesh>
        <mesh ref={membrane} position={[0, 0.075, 0]}>
          <cylinderGeometry args={[0.086, 0.086, 0.012, 20]} />
          <meshStandardMaterial
            color={state?.on ? "#38bdf8" : "#334155"}
            emissive={state?.on ? "#075985" : "#000000"}
            emissiveIntensity={state?.on ? 0.8 : 0}
            roughness={0.22}
          />
        </mesh>
        <mesh position={[0, 0.085, 0]}>
          <cylinderGeometry args={[0.026, 0.026, 0.016, 16]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
      </group>
      <SmokePuffs position={body} active={isBurned} />
    </group>
  );
}

function RelayArm({ active }: { active: boolean }) {
  const arm = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!arm.current) return;

    arm.current.rotation.z = THREE.MathUtils.damp(
      arm.current.rotation.z,
      active ? 0 : 0.46,
      16,
      delta,
    );
  });

  return (
    <group
      ref={arm}
      position={[-0.16, 0.19, 0.02]}
    >
      {/* Metal switching arm */}
      <mesh position={[0.16, 0, 0]}>
        <boxGeometry args={[0.34, 0.028, 0.045]} />
        <meshStandardMaterial
          color="#cbd5e1"
          metalness={0.9}
          roughness={0.18}
        />
      </mesh>

      {/* Contact tip */}
      <mesh position={[0.31, -0.015, 0]}>
        <sphereGeometry args={[0.035, 12, 8]} />
        <meshStandardMaterial
          color="#f1f5f9"
          metalness={0.95}
          roughness={0.12}
        />
      </mesh>
    </group>
  );
}


export function RelayMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const pins = Object.values(part.pins).map(vec);

  const body = pins
    .reduce(
      (sum, pin) => sum.add(pin),
      new THREE.Vector3(),
    )
    .multiplyScalar(1 / pins.length);

  /*
   * Raise the relay above the breadboard.
   */
  body.y += 0.25;

  const active = Boolean(
    sim.relays[part.id]?.on,
  );

  const housingColor = selected
    ? "#26384d"
    : "#111827";

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab.getState().select(part.id);
      }}
    >
      {/* ===================================================== */}
      {/* PCB PINS / LEADS                                     */}
      {/* ===================================================== */}

      {pins.map((pin, index) => {
        const pinEnd = new THREE.Vector3(
          pin.x,
          body.y - 0.20,
          pin.z,
        );

        return (
          <group key={`relay-pin-${index}`}>
            <Lead
              from={pin}
              to={pinEnd}
            />

            {/* exposed metal pin */}
            <mesh
              position={[
                pin.x,
                body.y - 0.225,
                pin.z,
              ]}
              castShadow
            >
              <boxGeometry
                args={[0.035, 0.13, 0.035]}
              />

              <meshStandardMaterial
                color="#d4a84f"
                metalness={0.92}
                roughness={0.22}
              />
            </mesh>
          </group>
        );
      })}


      {/* ===================================================== */}
      {/* RELAY BODY                                           */}
      {/* ===================================================== */}

      <group position={body}>

        {/* Lower black mounting base */}
        <mesh
          position={[0, -0.19, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[0.68, 0.08, 0.52]}
          />

          <meshStandardMaterial
            color="#080c12"
            roughness={0.34}
            metalness={0.18}
          />
        </mesh>


        {/* Slightly wider lower lip */}
        <mesh
          position={[0, -0.135, 0]}
          castShadow
        >
          <boxGeometry
            args={[0.72, 0.055, 0.55]}
          />

          <meshStandardMaterial
            color="#0b1118"
            roughness={0.38}
            metalness={0.12}
          />
        </mesh>


        {/* Main relay housing */}
        <mesh
          position={[0, 0.035, 0]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[0.64, 0.37, 0.50]}
          />

          <meshStandardMaterial
            color={housingColor}
            transparent
            opacity={0.94}
            roughness={0.27}
            metalness={0.08}
          />
        </mesh>


        {/* ================================================= */}
        {/* TOP CAP                                            */}
        {/* ================================================= */}

        <mesh
          position={[0, 0.245, 0]}
          castShadow
        >
          <boxGeometry
            args={[0.60, 0.075, 0.47]}
          />

          <meshStandardMaterial
            color={selected ? "#334155" : "#151c25"}
            roughness={0.30}
            metalness={0.10}
          />
        </mesh>


        {/* Top recessed panel */}
        <mesh
          position={[0, 0.286, 0]}
        >
          <boxGeometry
            args={[0.46, 0.012, 0.31]}
          />

          <meshStandardMaterial
            color="#0b1017"
            roughness={0.42}
            metalness={0.08}
          />
        </mesh>


        {/* ================================================= */}
        {/* INTERNAL RELAY AREA                                */}
        {/* ================================================= */}

        <mesh
          position={[-0.13, 0.075, 0.18]}
        >
          <cylinderGeometry
            args={[0.075, 0.075, 0.025, 20]}
          />

          <meshStandardMaterial
            color={active ? "#d97706" : "#3f2a12"}
            metalness={0.65}
            roughness={0.22}
            emissive={
              active
                ? "#92400e"
                : "#000000"
            }
            emissiveIntensity={
              active ? 0.8 : 0
            }
          />
        </mesh>


        {/* Coil center */}
        <mesh
          position={[-0.13, 0.105, 0.18]}
        >
          <cylinderGeometry
            args={[0.052, 0.052, 0.035, 20]}
          />

          <meshStandardMaterial
            color="#b45309"
            metalness={0.75}
            roughness={0.24}
            emissive={
              active
                ? "#f59e0b"
                : "#000000"
            }
            emissiveIntensity={
              active ? 0.7 : 0
            }
          />
        </mesh>


        {/* Switching mechanism */}
        <group
          position={[0, 0, 0]}
          scale={0.9}
        >
          <RelayArm active={active} />
        </group>


        {/* Fixed contact */}
        <mesh
          position={[0.18, 0.19, 0.02]}
        >
          <sphereGeometry
            args={[0.032, 12, 8]}
          />

          <meshStandardMaterial
            color="#d1d5db"
            metalness={0.95}
            roughness={0.12}
          />
        </mesh>


        {/* ================================================= */}
        {/* STATUS INDICATOR                                    */}
        {/* ================================================= */}

        <mesh
          position={[0.235, 0.285, 0.19]}
        >
          <cylinderGeometry
            args={[0.025, 0.025, 0.018, 16]}
          />

          <meshStandardMaterial
            color={
              active
                ? "#4ade80"
                : "#1f2937"
            }
            emissive={
              active
                ? "#22c55e"
                : "#000000"
            }
            emissiveIntensity={
              active ? 2.2 : 0
            }
            metalness={0.2}
            roughness={0.25}
          />
        </mesh>


        {/* ================================================= */}
        {/* TOP RELAY MARKING                                  */}
        {/* ================================================= */}

        <mesh
          position={[0, 0.294, -0.015]}
        >
          <boxGeometry
            args={[0.30, 0.008, 0.055]}
          />

          <meshStandardMaterial
            color="#cbd5e1"
            roughness={0.6}
            metalness={0.05}
          />
        </mesh>

        <mesh
          position={[0, 0.294, 0.075]}
        >
          <boxGeometry
            args={[0.22, 0.008, 0.035]}
          />

          <meshStandardMaterial
            color="#94a3b8"
            roughness={0.6}
            metalness={0.05}
          />
        </mesh>

      </group>
    </group>
  );
}

 

const POT_MIN_RESISTANCE = 220;
const POT_MAX_RESISTANCE = 10000;

const POT_MIN_ANGLE = -Math.PI * 0.75;
const POT_MAX_ANGLE = Math.PI * 0.75;

function resistanceToPotAngle(resistance: number) {
  const r = THREE.MathUtils.clamp(
    Number(resistance) || POT_MIN_RESISTANCE,
    POT_MIN_RESISTANCE,
    POT_MAX_RESISTANCE,
  );

  const t =
    (r - POT_MIN_RESISTANCE) /
    (POT_MAX_RESISTANCE - POT_MIN_RESISTANCE);

  return THREE.MathUtils.lerp(
    POT_MAX_ANGLE,
    POT_MIN_ANGLE,
    t,
  );
}

function potAngleToResistance(angle: number) {
  const normalized = THREE.MathUtils.clamp(
    (angle - POT_MIN_ANGLE) /
      (POT_MAX_ANGLE - POT_MIN_ANGLE),
    0,
    1,
  );

  const resistance = THREE.MathUtils.lerp(
    POT_MAX_RESISTANCE,
    POT_MIN_RESISTANCE,
    normalized,
  );

  return Math.round(resistance / 10) * 10;
}

function formatResistance(value: number) {
  if (value >= 1000) {
    const k = value / 1000;

    return `${Number.isInteger(k) ? k : k.toFixed(1)}kΩ`;
  }

  return `${Math.round(value)}Ω`;
}

export function PotMesh({
  part,
  selected,
}: {
  part: PlacedPart;
  selected: boolean;
}) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const w = vec(part.pins.w);

  const center = a.clone().lerp(b, 0.5);
  center.y = BOARD.height + 0.30;


  const [isDragging, setIsDragging] = useState(false);

  /*
   * ============================================================
   * POTENTIOMETER VALUE
   * ============================================================
   */

  const resistance = THREE.MathUtils.clamp(
    Number(part.props.resistance ?? 1000),
    POT_MIN_RESISTANCE,
    POT_MAX_RESISTANCE,
  );

  /*
   * ============================================================
   * INTERACTION STATE
   * ============================================================
   */

  const shaft = useRef<THREE.Group>(null);

  const dragging = useRef(false);

  const dragStartX = useRef(0);

  const dragStartResistance = useRef(resistance);

  const setPotCameraLock = (locked: boolean) => {
    window.__ecePotDragging = locked;
  };

  /*
   * ============================================================
   * CURRENT POT POSITION
   * ============================================================
   */

  const targetAngle = resistanceToPotAngle(resistance);

  /*
   * ============================================================
   * SMOOTH SHAFT MOVEMENT
   * ============================================================
   */

  useFrame((_, delta) => {
    if (!shaft.current) return;
    // Shaft runs along +Z; spin around Z so the knob turns visibly
    shaft.current.rotation.z = THREE.MathUtils.damp(
      shaft.current.rotation.z,
      targetAngle,
      isDragging ? 28 : 14,
      delta,
    );
  });

  /*
   * ============================================================
   * POINTER DRAG SYSTEM
   * ============================================================
   *
   * Horizontal mouse movement controls the potentiometer.
   *
   * Drag RIGHT  -> resistance increases
   * Drag LEFT   -> resistance decreases
   *
   * This behaves like turning a real rotary control while
   * remaining easy to use inside the 3D circuit lab.
   * ============================================================
   */
  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      if (!dragging.current) return;

      const deltaX =
        event.clientX - dragStartX.current;

      /*
      * Sensitivity.
      *
      * 1 pixel = roughly 25Ω.
      */
      const sensitivity = 25;

      const newResistance = THREE.MathUtils.clamp(
        dragStartResistance.current +
          deltaX * sensitivity,
        POT_MIN_RESISTANCE,
        POT_MAX_RESISTANCE,
      );

      const rounded =
        Math.round(newResistance / 10) * 10;

      // Live update without undo history spam (history commits on pointer up)
      const state = useLab.getState();
      if (!state.selectedId) {
        state.select(part.id);
      }
      const parts = state.parts.map((p) =>
        p.id === part.id || p.id === state.selectedId
          ? p.kind === "pot" || p.kind === "resistor"
            ? { ...p, props: { ...p.props, resistance: rounded } }
            : p
          : p,
      );
      const next = { ...state, parts };
      useLab.setState({
        parts,
        sim: runSimulation(next),
      });
    };

    const handlePointerUp = () => {
      if (!dragging.current) return;

      dragging.current = false;

      setIsDragging(false);

      setPotCameraLock(false);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";

      // Single undo step for the finished drag
      const state = useLab.getState();
      const p = state.parts.find((x) => x.id === part.id);
      if (p && p.kind === "pot") {
        const r = Number(p.props.resistance ?? 1000);
        state.setSelectedResistance(r);
      }
    };

    const handlePointerCancel = () => {
      dragging.current = false;

      setIsDragging(false);

      setPotCameraLock(false);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener(
      "pointermove",
      handlePointerMove,
    );

    window.addEventListener(
      "pointerup",
      handlePointerUp,
    );

    window.addEventListener(
      "pointercancel",
      handlePointerCancel,
    );

    return () => {
      window.removeEventListener(
        "pointermove",
        handlePointerMove,
      );

      window.removeEventListener(
        "pointerup",
        handlePointerUp,
      );

      window.removeEventListener(
        "pointercancel",
        handlePointerCancel,
      );

      setPotCameraLock(false);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, []);

  /*
   * ============================================================
   * START DRAGGING
   * ============================================================
   */

  const beginPotDrag = (
    e: any,
  ) => {
    e.stopPropagation();

    // Shaft has its own pointer handler (stops scene bubbling): handle
    // delete/select here too, otherwise this part is impossible to delete.
    const lab = useLab.getState();
    if (lab.tool === "delete") {
      lab.select(part.id);
      return;
    }
    if (lab.tool !== "select") return;
    if (lab.selectedId !== part.id) {
      lab.select(part.id);
      return;
    }
    dragging.current = true;

    dragStartX.current =
      e.clientX ??
      e.nativeEvent?.clientX ??
      0;

    dragStartResistance.current =
      Number(
        part.props.resistance ??
          POT_MIN_RESISTANCE,
      );

    setIsDragging(true);

    // Lock OrbitControls while the potentiometer is being adjusted.
    setPotCameraLock(true);

    document.body.style.cursor =
      "ew-resize";

    document.body.style.userSelect =
      "none";

    useLab.getState().select(part.id);
  };

  /*
   * ============================================================
   * POTENTIOMETER ORIENTATION
   * ============================================================
   */

  const bodyZ = center.z;

  const bodyColor = selected
    ? "#35465a"
    : "#252b30";

  /*
   * ============================================================
   * LEAD CONNECTION POSITIONS
   * ============================================================
   */

  const leadAEnd = new THREE.Vector3(
    a.x,
    center.y - 0.13,
    bodyZ + 0.11,
  );

  const leadWEnd = new THREE.Vector3(
    w.x,
    center.y - 0.13,
    bodyZ + 0.11,
  );

  const leadBEnd = new THREE.Vector3(
    b.x,
    center.y - 0.13,
    bodyZ + 0.11,
  );

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab.getState().select(part.id);
      }}
    >

      {/* ======================================================
          ELECTRICAL LEADS
         ====================================================== */}

      <Lead
        from={a}
        to={leadAEnd}
      />

      <Lead
        from={w}
        to={leadWEnd}
      />

      <Lead
        from={b}
        to={leadBEnd}
      />

      {/* ======================================================
          REAR MOUNTING PLATE
         ====================================================== */}

      <group
        position={[
          center.x,
          center.y - 0.06,
          bodyZ + 0.105,
        ]}
      >

        <mesh>
          <boxGeometry
            args={[
              0.45,
              0.25,
              0.035,
            ]}
          />

          <meshStandardMaterial
            color="#a45a32"
            roughness={0.68}
            metalness={0.18}
          />
        </mesh>

        {/* Center support */}

        <mesh
          position={[
            0,
            0.055,
            -0.025,
          ]}
        >
          <cylinderGeometry
            args={[
              0.12,
              0.12,
              0.045,
              32,
            ]}
          />

          <meshStandardMaterial
            color="#a45a32"
            roughness={0.68}
            metalness={0.18}
          />
        </mesh>

        {/* Bottom mounting tab */}

        <mesh
          position={[
            0,
            -0.16,
            0,
          ]}
        >
          <boxGeometry
            args={[
              0.16,
              0.085,
              0.045,
            ]}
          />

          <meshStandardMaterial
            color="#914b29"
            roughness={0.72}
            metalness={0.15}
          />
        </mesh>

        {/* Mounting hole */}

        <mesh
          position={[
            0,
            -0.165,
            -0.025,
          ]}
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.025,
              0.025,
              0.012,
              20,
            ]}
          />

          <meshStandardMaterial
            color="#34383b"
            roughness={0.5}
            metalness={0.7}
          />
        </mesh>
      </group>

      {/* ======================================================
          MAIN POTENTIOMETER BODY
         ====================================================== */}

      <mesh
        position={[
          center.x,
          center.y,
          bodyZ + 0.045,
        ]}
        rotation={[
          Math.PI / 2,
          0,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.125,
            0.125,
            0.105,
            40,
          ]}
        />

        <meshStandardMaterial
          color="#23282d"
          roughness={0.58}
          metalness={0.18}
        />
      </mesh>

      {/* ======================================================
          BODY FRONT RIM
         ====================================================== */}

      <mesh
        position={[
          center.x,
          center.y,
          bodyZ - 0.015,
        ]}
        rotation={[
          Math.PI / 2,
          0,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.115,
            0.115,
            0.022,
            40,
          ]}
        />

        <meshStandardMaterial
          color="#454b50"
          roughness={0.32}
          metalness={0.75}
        />
      </mesh>

      {/* ======================================================
          FRONT METAL BUSHING
         ====================================================== */}

      <mesh
        position={[
          center.x,
          center.y,
          bodyZ - 0.055,
        ]}
        rotation={[
          Math.PI / 2,
          0,
          0,
        ]}
      >
        <cylinderGeometry
          args={[
            0.078,
            0.078,
            0.045,
            36,
          ]}
        />

        <meshStandardMaterial
          color="#9ba1a6"
          roughness={0.34}
          metalness={0.82}
        />
      </mesh>

      {/* ======================================================
          THREADED BUSHING
         ====================================================== */}

      <group
        position={[
          center.x,
          center.y,
          bodyZ - 0.095,
        ]}
      >

        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.062,
              0.062,
              0.12,
              32,
            ]}
          />

          <meshStandardMaterial
            color="#b9bec2"
            roughness={0.24}
            metalness={0.94}
          />
        </mesh>

        {/* Threads */}

        {Array.from({
          length: 7,
        }).map((_, i) => (
          <mesh
            key={`pot-thread-${i}`}
            position={[
              0,
              0,
              -0.052 + i * 0.017,
            ]}
            rotation={[
              Math.PI / 2,
              0,
              0,
            ]}
          >
            <torusGeometry
              args={[
                0.063,
                0.0065,
                8,
                32,
              ]}
            />

            <meshStandardMaterial
              color="#969da2"
              roughness={0.22}
              metalness={0.95}
            />
          </mesh>
        ))}

        {/* Washer */}

        <mesh
          position={[
            0,
            0,
            -0.068,
          ]}
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.083,
              0.083,
              0.025,
              40,
            ]}
          />

          <meshStandardMaterial
            color="#c5cacf"
            roughness={0.2}
            metalness={0.95}
          />
        </mesh>
      </group>

      {/* ======================================================
          INTERACTIVE ROTARY SHAFT
         ====================================================== */}

      <group
        ref={shaft}
        position={[
          center.x,
          center.y,
          bodyZ - 0.205,
        ]}
        onPointerDown={beginPotDrag}
        onPointerOver={(e) => {
          e.stopPropagation();

          if (!dragging.current) {
            document.body.style.cursor =
              "grab";
          }
        }}
        onPointerOut={() => {
          if (!dragging.current) {
            document.body.style.cursor =
              "";
          }
        }}
      >

        {/* Main shaft */}

        <mesh
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.035,
              0.035,
              0.30,
              24,
          ]}
          />

          <meshStandardMaterial
            color="#9aa1a6"
            roughness={0.36}
            metalness={0.82}
          />
        </mesh>

        {/* Knurling */}

        {Array.from({
          length: 16,
        }).map((_, i) => {
          const angle =
            (i / 16) *
            Math.PI *
            2;

          const x =
            Math.cos(angle) *
            0.037;

          const y =
            Math.sin(angle) *
            0.037;

          return (
            <mesh
              key={`shaft-knurl-${i}`}
              position={[
                x,
                y,
                0,
              ]}
              rotation={[
                0,
                0,
                angle,
              ]}
            >
              <boxGeometry
                args={[
                  0.006,
                  0.009,
                  0.27,
                ]}
              />

              <meshStandardMaterial
                color="#858c91"
                roughness={0.24}
                metalness={0.95}
              />
            </mesh>
          );
        })}

        {/* Shaft flat */}

        <mesh
          position={[
            0,
            0,
            -0.155,
          ]}
        >
          <boxGeometry
            args={[
              0.047,
              0.012,
              0.12,
            ]}
          />

          <meshStandardMaterial
            color="#777e83"
            roughness={0.24}
            metalness={0.92}
          />
        </mesh>

        {/* Shaft end */}

        <mesh
          position={[
            0,
            0,
            -0.155,
          ]}
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.036,
              0.036,
              0.018,
              24,
            ]}
          />

          <meshStandardMaterial
            color="#c0c5c9"
            roughness={0.2}
            metalness={0.96}
          />
        </mesh>
      </group>

      {/* ======================================================
          THREE TERMINALS
         ====================================================== */}

{[a, w, b].map((pin, index) => {
  const isLeft = index === 0;
  const isRight = index === 2;
  const isOutside = isLeft || isRight;

  return (
    <group
      key={`pot-terminal-${index}`}
      position={[
        pin.x,
        center.y - 0.16,
        pin.z,
      ]}
    >
      {/* Metal terminal */}
      <mesh
        rotation={[
          0,
          0,
          isOutside
            ? isLeft
              ? Math.PI / 2
              : -Math.PI / 2
            : 0,
        ]}
      >
        <boxGeometry args={[0.018, 0.075, 0.018]} />
        <meshStandardMaterial
          color="#8c9296"
          metalness={0.9}
          roughness={0.3}
        />
      </mesh>

      {/* Terminal end */}
      <mesh
        position={[
          isLeft ? 0.035 : isRight ? -0.035 : 0,
          -0.045,
          0,
        ]}
      >
        <cylinderGeometry args={[0.025, 0.025, 0.018, 20]} />
        <meshStandardMaterial
          color="#b6bcc0"
          metalness={0.92}
          roughness={0.25}
        />
      </mesh>
    </group>
  );
})}


      {/* ======================================================
          SELECTION RING
         ====================================================== */}

      {selected && (
        <mesh
          position={[
            center.x,
            center.y,
            bodyZ - 0.045,
          ]}
          rotation={[
            Math.PI / 2,
            0,
            0,
          ]}
        >
          <torusGeometry
            args={[
              0.132,
              0.009,
              8,
              48,
            ]}
          />

          <meshStandardMaterial
            color="#ffd166"
            emissive="#ffd166"
            emissiveIntensity={
              isDragging
                ? 0.9
                : 0.45
            }
          />
        </mesh>
      )}

      {/* ======================================================
          VALUE DISPLAY
         ====================================================== */}

      {selected && (
        <group
          position={[
            center.x,
            center.y + 0.17,
            bodyZ - 0.03,
          ]}
        >
          <mesh>
            <planeGeometry
              args={[
                0.18,
                0.055,
              ]}
            />

            <meshBasicMaterial
              transparent
              opacity={0.88}
            />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Arduino-style / DIP MCU module seated on the breadboard pins.
 * Body is centered on the pin centroid and raised above the board.
 */
/**
 * Arduino Uno–style board (visual only).
 * Sits beside / above the breadboard with jumper leads to mapped holes
 * rather than pretending DIP pins go into the board.
 */
export function McuMesh({
  part,
  selected,
  powered,
  burned,
  voltage,
  electricalState,
}: {
  part: PlacedPart;
  selected: boolean;
  powered: boolean;
  burned: boolean;
  voltage: number;
  electricalState?: string;
}) {
 

  // ============================================================
  // ARDUINO UNO R3 SMD / CH340
  // ============================================================

  const { hoveredPin, setHoveredPin } = useTransientPinHover();
  const tool = useLab((s) => s.tool);
  const selectedWireEndpoint = useLab((s) => s.pendingHoles[0] ?? null);
  useEffect(() => { setHoveredPin(null); }, [tool, setHoveredPin]);
  const W = 2.72;
  const D = 2.12;
  const T = 0.075;

  const origin = new THREE.Vector3(...mcuBoardOrigin(part));

  // Uno R3 boards use blue solder mask, not the generic green PCB tint.
  const pcb = selected ? "#146bba" : "#12669d";
  const pcbDark = selected ? "#104778" : "#08456f";

  const black = "#111418";
  const dark = "#20252a";
  const metal = "#aeb5bb";
  const silver = "#d1d5d9";
  const gold = "#c79a43";

  const mcuSmokePosition = new THREE.Vector3(
    0,
    0.18,
    0,
  );

  // ============================================================
  // ACTUAL UNO PIN ORDER
  // ============================================================

  const DIGITAL = [
    "d0",
    "d1",
    "d2",
    "d3",
    "d4",
    "d5",
    "d6",
    "d7",
    "d8",
    "d9",
    "d10",
    "d11",
    "d12",
    "d13",
  ];

  const ANALOG = [
    "a0",
    "a1",
    "a2",
    "a3",
    "a4",
    "a5",
  ];

  const POWER = [
    "ioref",
    "reset",
    "3v3",
    "vcc",
    "gnd",
    "gnd2",
    "vin",
  ];

  // ============================================================
  // PIN INFORMATION
  // ============================================================

  const PIN_INFO: Record<
    string,
    {
      title: string;
      function: string;
      connection?: string;
    }
  > = {
    d0: {
      title: "D0",
      function: "Digital I/O · RX",
    },
    d1: {
      title: "D1",
      function: "Digital I/O · TX",
    },
    d2: {
      title: "D2",
      function: "Digital I/O",
    },
    d3: {
      title: "D3",
      function: "Digital I/O · PWM",
    },
    d4: {
      title: "D4",
      function: "Digital I/O",
    },
    d5: {
      title: "D5",
      function: "Digital I/O · PWM",
    },
    d6: {
      title: "D6",
      function: "Digital I/O · PWM",
    },
    d7: {
      title: "D7",
      function: "Digital I/O",
    },
    d8: {
      title: "D8",
      function: "Digital I/O",
    },
    d9: {
      title: "D9",
      function: "Digital I/O · PWM",
    },
    d10: {
      title: "D10",
      function: "Digital I/O · PWM · SS",
    },
    d11: {
      title: "D11",
      function: "Digital I/O · PWM · MOSI",
    },
    d12: {
      title: "D12",
      function: "Digital I/O · MISO",
    },
    d13: {
      title: "D13",
      function: "Digital I/O · SCK",
    },

    a0: {
      title: "A0",
      function: "Analog Input",
    },
    a1: {
      title: "A1",
      function: "Analog Input",
    },
    a2: {
      title: "A2",
      function: "Analog Input",
    },
    a3: {
      title: "A3",
      function: "Analog Input",
    },
    a4: {
      title: "A4",
      function: "Analog Input · SDA",
    },
    a5: {
      title: "A5",
      function: "Analog Input · SCL",
    },

    ioref: {
      title: "IOREF",
      function: "I/O Reference",
    },
    reset: {
      title: "RESET",
      function: "Microcontroller Reset",
    },
    "3v3": {
      title: "3.3V",
      function: "3.3 Volt Output",
    },
    vcc: {
      title: "5V",
      function: "5 Volt Output",
    },
    gnd: {
      title: "GND",
      function: "Ground",
    },
    gnd2: {
      title: "GND",
      function: "Ground",
    },
    vin: {
      title: "VIN",
      function: "External Voltage Input",
    },
  };

  // ============================================================
  // EXACT BOARD PIN COORDINATES
  //
  // These coordinates are used for:
  // 1. Header contacts
  // 2. Wire origins
  // 3. Hover labels
  //
  // Therefore the visible pin and the electrical pin never
  // visually drift apart.
  // ============================================================

  const pinLocal = (name: string) => {
    const p = mcuPinLocal(name) ?? [0, 0, 0];
    return new THREE.Vector3(p[0], p[1], p[2]);
  };

  // ============================================================
  // PCB TRACE DECORATION
  // ============================================================

  const Trace = ({
    x,
    z,
    width,
    depth,
    rotation = 0,
  }: {
    x: number;
    z: number;
    width: number;
    depth: number;
    rotation?: number;
  }) => (
    <mesh
      position={[
        x,
        T / 2 + 0.003,
        z,
      ]}
      rotation={[
        0,
        rotation,
        0,
      ]}
    >
      <boxGeometry
        args={[
          width,
          0.004,
          depth,
        ]}
      />
      <meshStandardMaterial
        color={selected ? "#1167a5" : "#0b6b41"}
        roughness={0.52}
        metalness={0.02}
      />
    </mesh>
  );

  // ============================================================
  // HEADER PIN
  // ============================================================

  const HeaderPin = ({
    name,
  }: {
    name: string;
  }) => {
    const p = pinLocal(name);
    const info = PIN_INFO[name];


    return (
      <group
        position={[p.x,p.y,p.z]}
        onPointerOver={(e) => {e.stopPropagation(); setHoveredPin(name);useLab.getState().setHover(part.pins[name] ?? null);}}
        onPointerOut={(e) => {e.stopPropagation(); setHoveredPin(null);useLab.getState().setHover(null);}}
        onPointerDown={(e) => {
          const state = useLab.getState();
          if (state.tool === 'wire' || state.tool === 'probe') {
            e.stopPropagation();
            state.clickHole(part.pins[name] ?? mcuTerminalId(part.id, name));
          }
        }}
        onClick={(e) => { e.stopPropagation(); if(useLab.getState().tool === 'select') useLab.getState().select(part.id); }}
      >
        {/* Slightly enlarged, invisible pick surface; sockets remain the same physical size. */}
        <mesh position={[0, 0.075, 0]}>
          <boxGeometry args={[0.104, 0.17, 0.14]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
        {/* Female header body */}
        <mesh castShadow position={[0, 0.04, 0]}>
          <boxGeometry
            args={[
              0.086,
              0.18,
              0.086,
            ]}
          />
          <meshPhysicalMaterial color="#101318" roughness={0.74} metalness={0.02} clearcoat={0.06} />
        </mesh>

        {/* Gold contact */}
        <mesh
          position={[
            0,
            0.079,
            0,
          ]}
        >
          <cylinderGeometry
            args={[
              0.022,
              0.022,
              0.055,
              10,
            ]}
          />
          <meshStandardMaterial
            color={gold}
            metalness={0.9}
            roughness={0.18}
          />
        </mesh>

        {/* Small exposed metal ring */}
        <mesh
          position={[
            0,
            0.125,
            0,
          ]}
          rotation={[
            -Math.PI / 2,
            0,
            0,
          ]}
        >
          <ringGeometry
            args={[
              0.018,
              0.03,
              12,
            ]}
          />
          <meshStandardMaterial
            color={hoveredPin === name || (tool === 'wire' && selectedWireEndpoint === part.pins[name]) ? '#22d3ee' : gold}
            emissive={hoveredPin === name || (tool === 'wire' && selectedWireEndpoint === part.pins[name]) ? '#0284c7' : '#000000'}
            emissiveIntensity={hoveredPin === name || (tool === 'wire' && selectedWireEndpoint === part.pins[name]) ? 0.45 : 0}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>

        {/* Hover labels identify the actual electrical pin assigned to this part. */}
        {hoveredPin === name && <DreiHtml position={[0,0.25,0]} center distanceFactor={6.5} style={{pointerEvents:'none',padding:'5px 8px',borderRadius:6,background:'rgba(7,20,38,.95)',color:'#e0f2fe',border:'1px solid #22d3ee',fontSize:10,whiteSpace:'nowrap',textAlign:'center',fontFamily:'ui-monospace,monospace',fontWeight:700}}>
          {displayPinLabel('mcu',name)}
          {tool === 'wire' && <div style={{fontSize:9,color:'#67e8f9'}}>{selectedWireEndpoint === part.pins[name] ? 'Start pin selected · choose destination' : 'Click socket to connect a wire'}</div>}
        </DreiHtml>}
       
      </group>
    );
  };

  // ============================================================
  // HEADER STRIP
  // ============================================================

  const HeaderStrip = ({
    names,
    z,
  }: {
    names: string[];
    z: number;
  }) => {
    const first = pinLocal(names[0]);
    const last = pinLocal(
      names[names.length - 1],
    );

    const centerX =
      (first.x + last.x) / 2;

    const length =
      Math.abs(last.x - first.x) +
      0.14;

    return (
      <group>
        {/* Continuous black plastic rail */}
        <mesh
          position={[
            centerX,
            T / 2 + 0.035,
            z,
          ]}
          castShadow
        >
          <boxGeometry
            args={[
              length,
              0.105,
              0.135,
            ]}
          />
          <meshStandardMaterial
            color={black}
            roughness={0.36}
          />
        </mesh>

        {names.map((name) => (
          <HeaderPin
            key={name}
            name={name}
          />
        ))}
      </group>
    );
  };

  // ============================================================
  // BOARD
  // ============================================================


  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        useLab
          .getState()
          .select(part.id);
      }}
    >
      {/* ========================================================
          UNO BOARD
      ======================================================== */}

      <group position={origin}>

        {/* ------------------------------------------------------
            PCB BODY
        ------------------------------------------------------ */}

        <mesh
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[
              W,
              T,
              D,
            ]}
          />
          <meshStandardMaterial
            color={pcb}
            roughness={0.57}
            metalness={0.06}
          />
        </mesh>

        {/* Printed copper-under-mask routes and crisp industrial silkscreen.
            Decorative, not electrically conductive or raycastable. */}
        <ArduinoPcbFinish width={W} depth={D} thickness={T} />

        {/* PCB lower edge */}
        <mesh
          position={[
            0,
            -T / 2 - 0.005,
            0,
          ]}
        >
          <boxGeometry
            args={[
              W + 0.02,
              0.012,
              D + 0.02,
            ]}
          />
          <meshStandardMaterial
            color={pcbDark}
            roughness={0.48}
          />
        </mesh>

        {/* ------------------------------------------------------
            MOUNTING HOLES
        ------------------------------------------------------ */}

        {[
          [-W * 0.425, -D * 0.405],
          [W * 0.425, -D * 0.405],
          [-W * 0.425, D * 0.385],
          [W * 0.385, D * 0.385],
        ].map(([x, z], i) => (
          <group key={i}>
            <mesh
              position={[
                x,
                T / 2 + 0.005,
                z,
              ]}
              rotation={[
                -Math.PI / 2,
                0,
                0,
              ]}
            >
              <cylinderGeometry
                args={[
                  0.067,
                  0.067,
                  0.012,
                  20,
                ]}
              />
              <meshStandardMaterial
                color="#d6d3c8"
                metalness={0.45}
                roughness={0.4}
              />
            </mesh>

            <mesh
              position={[
                x,
                T / 2 + 0.012,
                z,
              ]}
              rotation={[
                -Math.PI / 2,
                0,
                0,
              ]}
            >
              <cylinderGeometry
                args={[
                  0.037,
                  0.037,
                  0.014,
                  20,
                ]}
              />
              <meshStandardMaterial
                color="#101820"
                roughness={0.38}
              />
            </mesh>
          </group>
        ))}

        {/* ------------------------------------------------------
            DECORATIVE COPPER TRACES
        ------------------------------------------------------ */}

        <Trace
          x={-0.88}
          z={-0.24}
          width={0.55}
          depth={0.018}
        />

        <Trace
          x={-0.65}
          z={-0.04}
          width={0.4}
          depth={0.018}
          rotation={Math.PI / 2}
        />

        <Trace
          x={0.43}
          z={0.38}
          width={0.7}
          depth={0.014}
        />

        <Trace
          x={0.78}
          z={0.17}
          width={0.36}
          depth={0.014}
          rotation={Math.PI / 2}
        />

        <Trace
          x={-0.15}
          z={0.68}
          width={0.5}
          depth={0.012}
        />

        {/* ------------------------------------------------------
            DIGITAL HEADER
        ------------------------------------------------------ */}

        <HeaderStrip
          names={DIGITAL}
          z={-D / 2 + 0.11}
        />

        {/* ------------------------------------------------------
            POWER HEADER
        ------------------------------------------------------ */}

        <HeaderStrip
          names={POWER}
          z={D / 2 - 0.11}
        />

        {/* ------------------------------------------------------
            ANALOG HEADER
        ------------------------------------------------------ */}

        <HeaderStrip
          names={ANALOG}
          z={D / 2 - 0.285}
        />

        {/* ======================================================
            USB-B CONNECTOR
        ====================================================== */}

        <group
          position={[
            -W / 2 - 0.03,
            0.04,
            -0.37,
          ]}
        >
          {/* metal shell */}
          <mesh castShadow>
            <boxGeometry
              args={[
                0.37,
                0.235,
                0.54,
              ]}
            />
            <meshStandardMaterial
              color="#8f959b"
              metalness={0.78}
              roughness={0.34}
            />
          </mesh>

          {/* front face */}
          <mesh
            position={[
              -0.195,
              0,
              0,
            ]}
          >
            <boxGeometry
              args={[
                0.025,
                0.165,
                0.39,
              ]}
            />
            <meshStandardMaterial
              color="#737980"
              metalness={0.7}
              roughness={0.28}
            />
          </mesh>

          {/* black socket */}
          <mesh
            position={[
              -0.211,
              0,
              0,
            ]}
          >
            <boxGeometry
              args={[
                0.012,
                0.105,
                0.29,
              ]}
            />
            <meshStandardMaterial
              color="#0b0d0f"
              roughness={0.3}
            />
          </mesh>

          {/* USB contacts */}
          {[-0.09, -0.03, 0.03, 0.09].map(
            (z, i) => (
              <mesh
                key={i}
                position={[
                  -0.22,
                  0.01,
                  z,
                ]}
              >
                <boxGeometry
                  args={[
                    0.012,
                    0.04,
                    0.018,
                  ]}
                />
                <meshStandardMaterial
                  color={gold}
                  metalness={0.9}
                  roughness={0.16}
                />
              </mesh>
            ),
          )}
        </group>

        {/* ======================================================
            DC BARREL JACK
        ====================================================== */}

        <group
          position={[
            -W / 2 + 0.29,
            0.07,
            0.68,
          ]}
        >
          <mesh
            castShadow
            rotation={[
              0,
              0,
              Math.PI / 2,
            ]}
          >
            <cylinderGeometry
              args={[
                0.135,
                0.135,
                0.34,
                20,
              ]}
            />
            <meshStandardMaterial
              color="#17191b"
              roughness={0.28}
            />
          </mesh>

          <mesh
            position={[
              -0.18,
              0,
              0,
            ]}
            rotation={[
              0,
              0,
              Math.PI / 2,
            ]}
          >
            <cylinderGeometry
              args={[
                0.068,
                0.068,
                0.13,
                18,
              ]}
            />
            <meshStandardMaterial
              color="#626970"
              metalness={0.78}
              roughness={0.2}
            />
          </mesh>

          <mesh
            position={[
              -0.25,
              0,
              0,
            ]}
            rotation={[
              0,
              0,
              Math.PI / 2,
            ]}
          >
            <cylinderGeometry
              args={[
                0.034,
                0.034,
                0.035,
                14,
              ]}
            />
            <meshStandardMaterial
              color="#151719"
              roughness={0.28}
            />
          </mesh>
        </group>

        {/* ======================================================
            RESET SWITCH (interactive — active-low MCU reset)
        ====================================================== */}

        <group
          position={[
            -0.46,
            T / 2 + 0.035,
            -0.61,
          ]}
          onPointerDown={(e) => {
            e.stopPropagation();
            const lab = useLab.getState();
            if (lab.tool === "delete") { lab.select(part.id); return; }
            if (lab.tool !== "select" || lab.selectedId !== part.id) {
              if (lab.tool === "select") lab.select(part.id);
              return;
            }
            lab.setMcuResetPressed(part.id, true);
          }}
          onPointerUp={(e) => {
            e.stopPropagation();
            useLab.getState().setMcuResetPressed(part.id, false);
          }}
          onPointerLeave={() => {
            if (part.props.resetPressed) {
              useLab.getState().setMcuResetPressed(part.id, false);
            }
          }}
          onPointerCancel={() => {
            useLab.getState().setMcuResetPressed(part.id, false);
          }}
        >
          <mesh castShadow>
            <boxGeometry
              args={[
                0.19,
                0.055,
                0.19,
              ]}
            />
            <meshStandardMaterial
              color="#25282b"
              roughness={0.35}
            />
          </mesh>

          <mesh
            position={[
              0,
              part.props.resetPressed ? 0.03 : 0.05,
              0,
            ]}
          >
            <cylinderGeometry
              args={[
                0.054,
                0.054,
                0.055,
                18,
              ]}
            />
            <meshStandardMaterial
              color={part.props.resetPressed ? "#94a3b8" : "#d1d5db"}
              metalness={0.35}
              roughness={0.3}
            />
          </mesh>
          <Html
            position={[0, 0.12, 0]}
            center
            distanceFactor={7}
            style={{
              pointerEvents: "none",
              color: "#cbd5e1",
              fontFamily: "IBM Plex Mono, monospace",
              fontSize: "6px",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            RESET
          </Html>
        </group>

        {/* ======================================================
            USER TACTILE BUTTONS (active-low → D7 / D8 by default)
            Hold to pull the mapped pin LOW for digitalRead / fallingEdge.
        ====================================================== */}

        {(
          [
            { key: "d7", label: "D7", x: 0.55 },
            { key: "d8", label: "D8", x: 0.78 },
          ] as const
        ).map(({ key, label, x }) => {
          const held = Boolean(
            (part.props.pinButtons as Record<string, boolean> | undefined)?.[key],
          );
          return (
            <group
              key={key}
              position={[x, T / 2 + 0.035, -0.61]}
              onPointerDown={(e) => {
                e.stopPropagation();
                const lab = useLab.getState();
                if (lab.tool === "delete") { lab.select(part.id); return; }
                if (lab.tool !== "select" || lab.selectedId !== part.id) {
                  if (lab.tool === "select") lab.select(part.id);
                  return;
                }
                lab.setMcuPinButtonPressed(part.id, key, true);
              }}
              onPointerUp={(e) => {
                e.stopPropagation();
                useLab.getState().setMcuPinButtonPressed(part.id, key, false);
              }}
              onPointerLeave={() => {
                if (held) {
                  useLab.getState().setMcuPinButtonPressed(part.id, key, false);
                }
              }}
              onPointerCancel={() => {
                useLab.getState().setMcuPinButtonPressed(part.id, key, false);
              }}
            >
              <mesh castShadow>
                <boxGeometry args={[0.16, 0.05, 0.16]} />
                <meshStandardMaterial color="#1e293b" roughness={0.4} />
              </mesh>
              <mesh position={[0, held ? 0.028 : 0.045, 0]}>
                <cylinderGeometry args={[0.045, 0.045, 0.045, 14]} />
                <meshStandardMaterial
                  color={held ? "#f59e0b" : "#e2e8f0"}
                  metalness={0.25}
                  roughness={0.35}
                />
              </mesh>
              <Html
                position={[0, 0.11, 0]}
                center
                distanceFactor={7}
                style={{
                  pointerEvents: "none",
                  color: "#94a3b8",
                  fontFamily: "IBM Plex Mono, monospace",
                  fontSize: "6px",
                  userSelect: "none",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Html>
            </group>
          );
        })}

        {/* ======================================================
            ATMEGA328P SMD
        ====================================================== */}

        <group
          position={[
            0.03,
            T / 2 + 0.045,
            0.03,
          ]}
        >
          {/* main IC */}
          <mesh castShadow>
            <boxGeometry
              args={[
                0.73,
                0.075,
                0.43,
              ]}
            />
            <meshStandardMaterial
              color="#14171a"
              roughness={0.27}
              metalness={0.05}
            />
          </mesh>

          {/* top marking */}
          <Html
            position={[
              0,
              0.052,
              0,
            ]}
            center
            distanceFactor={6}
            style={{
              pointerEvents: "none",
              color: "#9ca3af",
              fontFamily:
                "IBM Plex Mono, monospace",
              fontSize: "5px",
              letterSpacing: "0.03em",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            ATMEGA328P
          </Html>

          {/* SMD legs */}
          {Array.from({
            length: 14,
          }).map((_, i) => {
            const z =
              -0.27 + i * 0.041;

            return (
              <React.Fragment key={i}>
                <mesh
                  position={[
                    -0.39,
                    0,
                    z,
                  ]}
                >
                  <boxGeometry
                    args={[
                      0.075,
                      0.018,
                      0.024,
                    ]}
                  />
                  <meshStandardMaterial
                    color={metal}
                    metalness={0.82}
                    roughness={0.2}
                  />
                </mesh>

                <mesh
                  position={[
                    0.39,
                    0,
                    z,
                  ]}
                >
                  <boxGeometry
                    args={[
                      0.075,
                      0.018,
                      0.024,
                    ]}
                  />
                  <meshStandardMaterial
                    color={metal}
                    metalness={0.82}
                    roughness={0.2}
                  />
                </mesh>
              </React.Fragment>
            );
          })}

          {/* pin-1 marker */}
          <mesh
            position={[
              -0.29,
              0.041,
              -0.145,
            ]}
          >
            <sphereGeometry
              args={[
                0.018,
                10,
                10,
              ]}
            />
            <meshStandardMaterial
              color="#9ca3af"
              roughness={0.3}
            />
          </mesh>
        </group>

        {/* ======================================================
            CH340
        ====================================================== */}

        <group
          position={[
            -0.77,
            T / 2 + 0.035,
            -0.35,
          ]}
        >
          <mesh castShadow>
            <boxGeometry
              args={[
                0.35,
                0.055,
                0.28,
              ]}
            />
            <meshStandardMaterial
              color="#121619"
              roughness={0.28}
            />
          </mesh>

          {Array.from({
            length: 8,
          }).map((_, i) => (
            <React.Fragment key={i}>
              <mesh
                position={[
                  -0.205,
                  -0.005,
                  -0.105 +
                    i * 0.03,
                ]}
              >
                <boxGeometry
                  args={[
                    0.055,
                    0.018,
                    0.018,
                  ]}
                />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>

              <mesh
                position={[
                  0.205,
                  -0.005,
                  -0.105 +
                    i * 0.03,
                ]}
              >
                <boxGeometry
                  args={[
                    0.055,
                    0.018,
                    0.018,
                  ]}
                />
                <meshStandardMaterial
                  color={metal}
                  metalness={0.8}
                  roughness={0.2}
                />
              </mesh>
            </React.Fragment>
          ))}

          <Html
            position={[
              0,
              0.046,
              0,
            ]}
            center
            distanceFactor={6}
            style={{
              pointerEvents: "none",
              color: "#737b83",
              fontFamily:
                "IBM Plex Mono, monospace",
              fontSize: "5px",
              userSelect: "none",
            }}
          >
            CH340
          </Html>
        </group>

        {/* ======================================================
            16 MHz CERAMIC RESONATOR
        ====================================================== */}

        <group
          position={[
            -0.18,
            T / 2 + 0.04,
            -0.15,
          ]}
        >
          <mesh castShadow>
            <boxGeometry
              args={[
                0.23,
                0.065,
                0.12,
              ]}
            />
            <meshStandardMaterial
              color="#d7d9da"
              metalness={0.72}
              roughness={0.18}
            />
          </mesh>

          <mesh
            position={[
              0,
              0.035,
              0,
            ]}
          >
            <boxGeometry
              args={[
                0.15,
                0.012,
                0.065,
              ]}
            />
            <meshStandardMaterial
              color="#8b9298"
              metalness={0.6}
              roughness={0.22}
            />
          </mesh>

          <Html
            position={[
              0,
              0.065,
              0,
            ]}
            center
            distanceFactor={6}
            style={{
              pointerEvents: "none",
              color: "#7c858d",
              fontFamily:
                "IBM Plex Mono, monospace",
              fontSize: "4px",
              userSelect: "none",
            }}
          >
            16MHz
          </Html>
        </group>

        {/* ======================================================
            VOLTAGE REGULATOR
        ====================================================== */}

        <group
          position={[
            -0.52,
            T / 2 + 0.045,
            0.52,
          ]}
        >
          <mesh castShadow>
            <boxGeometry
              args={[
                0.23,
                0.09,
                0.30,
              ]}
            />
            <meshStandardMaterial
              color="#252a2f"
              roughness={0.35}
            />
          </mesh>

          <mesh
            position={[
              0,
              0.055,
              0,
            ]}
          >
            <boxGeometry
              args={[
                0.18,
                0.018,
                0.22,
              ]}
            />
            <meshStandardMaterial
              color="#6b737a"
              metalness={0.55}
              roughness={0.28}
            />
          </mesh>
        </group>

        {/* ======================================================
            ELECTROLYTIC CAPACITORS
        ====================================================== */}

        {[
          [-0.25, 0.47],
          [-0.04, 0.49],
        ].map(([x, z], i) => (
          <group
            key={i}
            position={[
              x,
              T / 2 + 0.075,
              z,
            ]}
          >
            <mesh castShadow>
              <cylinderGeometry
                args={[
                  0.06,
                  0.06,
                  0.13,
                  16,
                ]}
              />
              <meshStandardMaterial
                color="#18385b"
                roughness={0.34}
              />
            </mesh>

            <mesh
              position={[
                0,
                0.067,
                0,
              ]}
            >
              <cylinderGeometry
                args={[
                  0.052,
                  0.052,
                  0.008,
                  16,
                ]}
              />
              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.25}
                roughness={0.34}
              />
            </mesh>

            <mesh
              position={[
                0.018,
                0.071,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  0.008,
                  0.012,
                  0.07,
                ]}
              />
              <meshStandardMaterial
                color="#e5e7eb"
                roughness={0.3}
              />
            </mesh>
          </group>
        ))}

        {/* ======================================================
            SMALL SMD COMPONENTS
        ====================================================== */}

        {[
          [-0.88, 0.12, 0.15, 0.05],
          [-0.61, 0.18, 0.15, 0.05],
          [-0.35, 0.27, 0.13, 0.045],
          [0.48, -0.44, 0.14, 0.045],
          [0.65, -0.44, 0.12, 0.045],
          [0.80, -0.30, 0.13, 0.045],
          [0.81, 0.16, 0.12, 0.045],
          [-0.73, 0.72, 0.12, 0.045],
        ].map(
          ([x, z, sx, sz], i) => (
            <mesh
              key={i}
              position={[
                x,
                T / 2 + 0.035,
                z,
              ]}
              castShadow
            >
              <boxGeometry
                args={[
                  sx,
                  0.028,
                  sz,
                ]}
              />
              <meshStandardMaterial
                color={
                  i % 3 === 0
                    ? "#d4d4d8"
                    : "#b8bcc1"
                }
                metalness={0.65}
                roughness={0.25}
              />
            </mesh>
          ),
        )}

        {/* ======================================================
            ICSP HEADER
        ====================================================== */}

        <group
          position={[
            0.90,
            T / 2 + 0.04,
            0.42,
          ]}
        >
          <mesh castShadow>
            <boxGeometry
              args={[
                0.32,
                0.105,
                0.25,
              ]}
            />
            <meshStandardMaterial
              color={black}
              roughness={0.36}
            />
          </mesh>

          {Array.from({
            length: 6,
          }).map((_, i) => {
            const x =
              i % 2 === 0
                ? -0.09
                : 0.09;

            const z =
              -0.07 +
              Math.floor(i / 2) *
                0.07;

            return (
              <mesh
                key={i}
                position={[
                  x,
                  0.06,
                  z,
                ]}
              >
                <cylinderGeometry
                  args={[
                    0.025,
                    0.025,
                    0.055,
                    10,
                  ]}
                />
                <meshStandardMaterial
                  color={gold}
                  metalness={0.9}
                  roughness={0.17}
                />
              </mesh>
            );
          })}
        </group>

        {/* ======================================================
            STATUS LEDs
        ====================================================== */}

        {(
          [
            [
              0.98,
              -0.61,
              powered
                ? "#22c55e"
                : "#14532d",
              "ON",
            ],
            [
              0.98,
              -0.41,
              powered
                ? "#facc15"
                : "#713f12",
              "L",
            ],
            [
              0.98,
              -0.21,
              "#dc2626",
              "TX",
            ],
            [
              0.98,
              -0.01,
              "#dc2626",
              "RX",
            ],
          ] as const
        ).map(
          ([x, z, color, label]) => (
            <group
              key={label}
              position={[
                x,
                T / 2 + 0.04,
                z,
              ]}
            >
              <mesh castShadow>
                <boxGeometry
                  args={[
                    0.075,
                    0.045,
                    0.06,
                  ]}
                />
                <meshStandardMaterial
                  color={color}
                  emissive={
                    powered &&
                    (label === "ON" ||
                      label === "L")
                      ? color
                      : "#000000"
                  }
                  emissiveIntensity={
                    powered &&
                    (label === "ON" ||
                      label === "L")
                      ? 1.5
                      : 0
                  }
                  roughness={0.25}
                />
              </mesh>

              <Html
                position={[
                  0.065,
                  0.015,
                  0,
                ]}
                center
                distanceFactor={6}
                style={{
                  pointerEvents: "none",
                  color:
                    "rgba(226,232,240,.65)",
                  fontFamily:
                    "IBM Plex Mono, monospace",
                  fontSize: "5px",
                  userSelect: "none",
                }}
              >
                {label}
              </Html>
            </group>
          ),
        )}

        {/* ======================================================
            SILKSCREEN
        ====================================================== */}

        <Html
          position={[
            0.18,
            T / 2 + 0.018,
            0.73,
          ]}
          center
          distanceFactor={6}
          style={{
            pointerEvents: "none",
            color:
              "rgba(235,250,240,.94)",
            fontFamily:
              "IBM Plex Mono, monospace",
            fontSize: "10px",
            fontWeight: 800,
            letterSpacing: "0.08em",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          ARDUINO UNO
        </Html>

        <Html
          position={[
            0.18,
            T / 2 + 0.018,
            0.62,
          ]}
          center
          distanceFactor={6}
          style={{
            pointerEvents: "none",
            color:
              "rgba(220,252,231,.58)",
            fontFamily:
              "IBM Plex Mono, monospace",
            fontSize: "5px",
            letterSpacing: "0.05em",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          R3 · SMD
        </Html>

        <Html
          position={[
            -0.07,
            T / 2 + 0.018,
            -D / 2 + 0.23,
          ]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color:
              "rgba(220,252,231,.58)",
            fontFamily:
              "IBM Plex Mono, monospace",
            fontSize: "6px",
            letterSpacing: "0.04em",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          DIGITAL PWM
        </Html>

        <Html
          position={[
            0.12,
            T / 2 + 0.018,
            D / 2 - 0.39,
          ]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color:
              "rgba(220,252,231,.58)",
            fontFamily:
              "IBM Plex Mono, monospace",
            fontSize: "6px",
            letterSpacing: "0.04em",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          POWER · ANALOG IN
        </Html>

        <Html
          position={[
            -0.94,
            T / 2 + 0.018,
            0.16,
          ]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color:
              "rgba(220,252,231,.46)",
            fontFamily:
              "IBM Plex Mono, monospace",
            fontSize: "4px",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          CH340 USB SERIAL
        </Html>
      </group>

      <SmokePuffs
        position={mcuSmokePosition}
        active={burned}
      />

      {electricalState && electricalState !== "normal" && (
        <Html
          position={[0, 0.28, -D * 0.5]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color: burned ? "#fca5a5" : "#fbbf24",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "8px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,.9)",
          }}
        >
          {electricalState.toUpperCase()} · {voltage.toFixed(2)} V
        </Html>
      )}
    </group>
  );
}

/**
 * 16×2 character LCD module. Screen text is drawn with an Html overlay
 * when the display is powered; otherwise a dark bezel is shown.
 */
export function LcdMesh({
  part,
  selected,
  powered,
  text,
  burned,
  voltage,
  electricalState,
}: {
  part: PlacedPart;
  selected: boolean;
  powered: boolean;
  text: string;
  burned: boolean;
  voltage: number;
  electricalState?: string;
}) {
  const { hoveredPin, setHoveredPin } = useTransientPinHover();
  const pinEntries = Object.entries(part.pins);
  const pinVecs = pinEntries.map(([, id]) => vec(id));

  const body = pinVecs
    .reduce((sum, p) => sum.add(p), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(pinVecs.length, 1));
  body.y = BOARD.height + 0.22;

  const lcdSmokePosition = body.clone().add(
    new THREE.Vector3(0, 0.18, 0),
  );

  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of pinVecs) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  // Standard 16×2 module is wider than its pin row.
  const width = Math.max(1.55, maxX - minX + 0.35);
  const depth = Math.max(0.72, maxZ - minZ + 0.35);

  const housing = selected ? "#1e293b" : "#0f172a";
  const bezel = "#020617";
  const glass = powered ? "#0b3d2e" : "#020617";

  // Split text into up to two 16-char rows for a classic HD44780 look.
  // Prefer explicit newlines when the sketch used println / \n.
  const raw = (text ?? "").replace(/\r/g, "");
  let line1: string;
  let line2: string;
  if (raw.includes("\n")) {
    const parts = raw.split("\n");
    line1 = (parts[0] ?? "").slice(0, 16).padEnd(16, " ");
    line2 = (parts[1] ?? "").slice(0, 16).padEnd(16, " ");
  } else {
    line1 = raw.slice(0, 16).padEnd(16, " ");
    line2 = raw.slice(16, 32).padEnd(16, " ");
  }

  // Draw characters onto a canvas so they sit ON the glass (not floating Html).
  const screenMap = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    // High-resolution canvas keeps LCD lettering legible in angled 3D views.
    ctx.scale(4, 4);
    ctx.fillStyle = powered ? "#0a3328" : "#020617";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (powered) {
      // Soft character-cell grid
      ctx.strokeStyle = "rgba(16, 185, 129, 0.12)";
      ctx.lineWidth = 1;
      for (let c = 0; c <= 16; c++) {
        const x = 8 + c * 15;
        ctx.beginPath();
        ctx.moveTo(x, 6);
        ctx.lineTo(x, 58);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(8, 32);
      ctx.lineTo(248, 32);
      ctx.stroke();

      ctx.fillStyle = "#a7f3d0";
      ctx.font = "700 20px 'IBM Plex Mono', ui-monospace, monospace";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(52, 211, 153, 0.25)";
      ctx.shadowBlur = 1;
      ctx.fillText(line1, 10, 18);
      ctx.fillText(line2, 10, 46);
      ctx.shadowBlur = 0;
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 16;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    tex.needsUpdate = true;
    return tex;
  }, [line1, line2, powered]);

  useEffect(() => {
    return () => {
      screenMap?.dispose();
    };
  }, [screenMap]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pinVecs.map((pin, index) => {
        const pinEnd = new THREE.Vector3(pin.x, body.y - 0.12, pin.z);
        return (
          <group key={`lcd-pin-${index}`} onPointerOver={(e)=>{e.stopPropagation();setHoveredPin(pinEntries[index][0]);}} onPointerOut={(e)=>{e.stopPropagation();setHoveredPin(null);}}>
            <Lead from={pin} to={pinEnd} />
            {hoveredPin === pinEntries[index][0] && <DreiHtml position={[pin.x,body.y+0.19,pin.z]} center distanceFactor={6} style={{pointerEvents:'none',padding:'4px 7px',borderRadius:6,background:'rgba(7,20,38,.94)',border:'1px solid #22d3ee',color:'#e0f2fe',fontSize:10,whiteSpace:'nowrap'}}>{displayPinLabel('lcd',pinEntries[index][0])}<div style={{color:'#67e8f9',fontSize:9}}>Hole {pinEntries[index][1]}</div></DreiHtml>}
            <mesh position={[pin.x, body.y - 0.14, pin.z]} castShadow>
              <boxGeometry args={[0.03, 0.1, 0.03]} />
              <meshStandardMaterial
                color="#c9a227"
                metalness={0.9}
                roughness={0.25}
              />
            </mesh>
          </group>
        );
      })}

      <group position={body}>
        {/* Module housing */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, 0.12, depth]} />
          <meshStandardMaterial color={housing} roughness={0.45} />
        </mesh>

        {/* Dark bezel */}
        <mesh position={[0, 0.065, 0]}>
          <boxGeometry args={[width * 0.92, 0.02, depth * 0.72]} />
          <meshStandardMaterial color={bezel} roughness={0.55} />
        </mesh>

        {/* Glass / active area — text is painted onto this surface */}
        <mesh position={[0, 0.078, 0]}>
          <boxGeometry args={[width * 0.84, 0.015, depth * 0.58]} />
          <meshStandardMaterial
            color={screenMap ? "#ffffff" : glass}
            map={screenMap ?? undefined}
            emissive={powered ? "#064e3b" : "#000000"}
            emissiveMap={screenMap ?? undefined}
            emissiveIntensity={powered ? 0.85 : 0}
            roughness={0.25}
            metalness={0.02}
          />
        </mesh>

        {/* The shared PartSwitch hover context controls this annotation. */}
        <Html
          position={[0, 0.02, depth * 0.42]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color: "#94a3b8",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "9px",
            letterSpacing: "0.06em",
            userSelect: "none",
          }}
        >
          {part.props.label ?? "LCD 16x2"}
        </Html>
      </group>

      <SmokePuffs
        position={lcdSmokePosition}
        active={burned}
      />

      {electricalState && electricalState !== "normal" && (
        <Html
          position={[body.x, body.y + 0.38, body.z]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color: burned ? "#fca5a5" : "#fbbf24",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "8px",
            fontWeight: 700,
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,.9)",
          }}
        >
          {electricalState.toUpperCase()} · {voltage.toFixed(2)} V
        </Html>
      )}
    </group>
  );
}


/**
 * 0.96" SSD1306-style OLED module (I2C: VCC GND SDA SCL).
 */
export function OledMesh({
  part,
  selected,
  powered,
  text,
}: {
  part: PlacedPart;
  selected: boolean;
  powered: boolean;
  text: string;
}) {
  const { hoveredPin, setHoveredPin } = useTransientPinHover();
  const pinEntries = Object.entries(part.pins);
  const pinVecs = pinEntries.map(([, id]) => vec(id));
  const body = pinVecs
    .reduce((sum, p) => sum.add(p), new THREE.Vector3())
    .multiplyScalar(1 / Math.max(pinVecs.length, 1));
  body.y = BOARD.height + 0.2;

  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of pinVecs) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  const width = Math.max(1.05, maxX - minX + 0.25);
  const depth = Math.max(0.85, maxZ - minZ + 0.3);

  // The SSD1306's characters belong to a 128×64-pixel display surface.
  // A floating <Html> overlay stays the same CSS size as the camera zooms and
  // spills beyond the very small 3D screen. A texture has real world-space
  // bounds and remains inside the glass from every camera perspective.
  const screenMap = useMemo(() => {
    if (typeof document === "undefined") return null;
    // Render at 8x native SSD1306 resolution (1024x512): small lettering
    // stays sharp after WebGL downsamples the display onto its 3D glass.
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = "#000c17";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (powered) {
      ctx.save();
      // Logical drawing coordinates (512 x 256), twice the CSS-independent
      // pixel density of the previous texture. Never draw outside the glass.
      ctx.scale(2, 2);
      ctx.beginPath();
      ctx.rect(12, 12, 488, 232);
      ctx.clip();
      const lines = (text || "").replace(/\r/g, "").split("\n").slice(0, 8)
        .map((line) => line.slice(0, 16));
      const count = Math.max(1, lines.length);
      // Short titles (e.g. ElectroLab / I2C OLED) use much larger text;
      // an eight-line sketch still fits the full 128x64 character grid.
      const lineHeight = Math.min(68, Math.floor(224 / count));
      let fontSize = Math.min(count <= 2 ? 59 : 48, Math.floor(lineHeight * 0.83));
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#b7f8ff";
      // Strong unblurred glyphs render more legibly at shallow camera angles.
      // Keep all 16 columns in bounds even for a fully populated line.
      do {
        ctx.font = `700 ${fontSize}px ui-monospace, 'IBM Plex Mono', Consolas, monospace`;
        if (lines.every((line) => ctx.measureText(line).width <= 464)) break;
        fontSize -= 1;
      } while (fontSize > 15);
      const usedHeight = count * lineHeight;
      const firstBaseline = (256 - usedHeight) / 2 + lineHeight / 2;
      lines.forEach((line, row) => {
        ctx.fillText(line, 22, firstBaseline + row * lineHeight, 464);
      });
      ctx.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 16;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }, [powered, text]);
  useEffect(() => () => screenMap?.dispose(), [screenMap]);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pinVecs.map((pin, index) => {
        const pinEnd = new THREE.Vector3(pin.x, body.y - 0.1, pin.z);
        return (
          <group key={`oled-pin-${index}`} onPointerOver={(e)=>{e.stopPropagation();setHoveredPin(pinEntries[index][0]);}} onPointerOut={(e)=>{e.stopPropagation();setHoveredPin(null);}}>
            <Lead from={pin} to={pinEnd} />
            {hoveredPin === pinEntries[index][0] && <DreiHtml position={[pin.x,body.y+0.18,pin.z]} center distanceFactor={6} style={{pointerEvents:'none',padding:'4px 7px',borderRadius:6,background:'rgba(7,20,38,.94)',border:'1px solid #22d3ee',color:'#e0f2fe',fontSize:10,whiteSpace:'nowrap'}}>{displayPinLabel('oled',pinEntries[index][0])}<div style={{color:'#67e8f9',fontSize:9}}>Hole {pinEntries[index][1]}</div></DreiHtml>}
            <mesh position={[pin.x, body.y - 0.12, pin.z]} castShadow>
              <boxGeometry args={[0.03, 0.09, 0.03]} />
              <meshStandardMaterial color="#c9a227" metalness={0.9} roughness={0.25} />
            </mesh>
          </group>
        );
      })}

      <group position={body}>
        {/* PCB */}
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, 0.06, depth]} />
          <meshStandardMaterial
            color={selected ? "#1e293b" : "#0f172a"}
            roughness={0.45}
          />
        </mesh>
        {/* Bezel */}
        <mesh position={[0, 0.04, -0.02]}>
          <boxGeometry args={[width * 0.88, 0.03, depth * 0.7]} />
          <meshStandardMaterial color="#020617" roughness={0.5} />
        </mesh>
        {/* Glass */}
        <mesh position={[0, 0.055, -0.02]}>
          <boxGeometry args={[width * 0.78, 0.012, depth * 0.55]} />
          <meshStandardMaterial
            color={powered ? "#020617" : "#010409"}
            emissive={powered ? "#0ea5e9" : "#000000"}
            emissiveIntensity={powered ? 0.15 : 0}
            roughness={0.15}
            metalness={0.2}
          />
        </mesh>
        {/* Crisp text rendered as actual SSD1306 pixels, not an HTML overlay. */}
        {screenMap && (
          <mesh position={[0, 0.0625, -0.02]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[width * 0.76, depth * 0.53]} />
            <meshBasicMaterial map={screenMap} toneMapped={false} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        )}
        {/* PCB silkscreen is also a 3D mark, not a free-floating label. */}
        <PrintedMark
          text={part.props.label?.slice(0, 12) ?? "OLED 128x64"}
          position={[0, 0.032, depth * 0.41]}
          rotation={[-Math.PI / 2, 0, 0]}
          width={Math.min(width * 0.76, 0.84)}
          height={0.075}
          color="#a6b9cc"
        />
      </group>
    </group>
  );
}

const TRANSISTOR_META: Record<
  string,
  {
    package: "to92" | "to18" | "to220" | "to3";
    polarity: "npn" | "pnp";
    title: string;
  }
> = {
  "2n3904": { package: "to92", polarity: "npn", title: "2N3904" },
  "2n3906": { package: "to92", polarity: "pnp", title: "2N3906" },
  bc547: { package: "to92", polarity: "npn", title: "BC547" },
  bc557: { package: "to92", polarity: "pnp", title: "BC557" },
  "2n2222": { package: "to18", polarity: "npn", title: "2N2222" },
  tip31: { package: "to220", polarity: "npn", title: "TIP31" },
  tip32: { package: "to220", polarity: "pnp", title: "TIP32" },
  "2n3055": { package: "to3", polarity: "npn", title: "2N3055" },
};

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */


/**
 * Resistor-style lead into a breadboard hole (alias of Lead).
 * pin = hole position, body = package attachment point.
 */
function BentBoardLead({
  pin,
  body,
  color = "#b9c0c8",
  radius = 0.012,
}: {
  pin: THREE.Vector3;
  body: THREE.Vector3;
  color?: string;
  radius?: number;
}) {
  return <Lead from={pin} to={body} color={color} radius={radius} />;
}

function BoardPinMarker({
  position,
  label,
  color = "#e2e8f0",
  labelColor,
}: {
  position: THREE.Vector3;
  label?: string;
  color?: string;
  labelColor?: string;
}) {
  if (!label) return null;
  return (
    <Html
      position={[position.x, BOARD.height + 0.15, position.z]}
      center
      distanceFactor={5.2}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.03em",
        color: labelColor ?? color,
        textShadow: "0 1px 4px rgba(0,0,0,.95)",
        background: "rgba(15,23,42,.85)",
        border: `1px solid ${color}`,
        borderRadius: "4px",
        padding: "1px 5px",
      }}
    >
      {label}
    </Html>
  );
}

function TransistorPinLabel({
  position,
  label,
  color,
}: {
  position: THREE.Vector3;
  label: string;
  color: string;
}) {
  return (
    <Html
      position={[
        position.x,
        position.y + 0.055,
        position.z + 0.055,
      ]}
      center
      distanceFactor={5.5}
      style={{
        pointerEvents: "none",
        userSelect: "none",
        whiteSpace: "nowrap",
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: "8px",
        fontWeight: 700,
        letterSpacing: "0.04em",
        color,
        textShadow: "0 1px 3px rgba(0,0,0,.95)",
      }}
    >
      {label}
    </Html>
  );
}

/** @deprecated Use Lead / BentBoardLead — kept as alias for older call sites. */
function TransistorLead({
  from,
  to,
  color = "#b7bec7",
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color?: string;
}) {
  return <Lead from={from} to={to} color={color} />;
}

/* -------------------------------------------------------------------------- */
/* TO-92                                                                      */
/* -------------------------------------------------------------------------- */

/** Perforated stamped mounting tab; holes are real voids in the metal, not black painted circles. */
function PunchedMetalTab({
  width,
  height,
  depth,
  holeRadius,
  holeY = 0,
  position,
  color = '#adb5bd',
}: {
  width: number;
  height: number;
  depth: number;
  holeRadius: number;
  holeY?: number;
  position: [number, number, number];
  color?: string;
}) {
  const profile = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2, -height / 2);
    shape.lineTo(width / 2, -height / 2);
    shape.lineTo(width / 2, height / 2);
    shape.lineTo(-width / 2, height / 2);
    shape.closePath();
    const aperture = new THREE.Path();
    aperture.absarc(0, holeY, holeRadius, 0, Math.PI * 2, true);
    shape.holes.push(aperture);
    return shape;
  }, [width, height, holeRadius, holeY]);
  return (
    <mesh position={position} castShadow receiveShadow>
      <extrudeGeometry args={[profile, { depth, bevelEnabled: false, curveSegments: 24 }]} />
      <meshPhysicalMaterial color={color} metalness={0.91} roughness={0.25} clearcoat={0.16} clearcoatRoughness={0.28} />
    </mesh>
  );
}

function TO92Body({
  selected,
  title,
}: {
  selected: boolean;
  title: string;
}) {
  const plastic = selected ? "#374151" : "#111827";
  const edge = selected ? "#4b5563" : "#1f2937";

  /*
   * A real TO-92 is essentially a small flattened molded "D" body.
   * This uses an extruded shape rather than the old rectangular box.
   */
  const shape = new THREE.Shape();

  shape.moveTo(-0.075, -0.075);
  shape.lineTo(0.075, -0.075);
  shape.lineTo(0.075, 0.035);

  shape.quadraticCurveTo(
    0.075,
    0.075,
    0.035,
    0.085,
  );

  shape.lineTo(-0.035, 0.085);

  shape.quadraticCurveTo(
    -0.075,
    0.075,
    -0.075,
    0.035,
  );

  shape.closePath();

  return (
    <group>
      {/* Main molded plastic body */}
      <mesh
        castShadow
        position={[0, 0.01, -0.04]}
      >
        <extrudeGeometry
          args={[
            shape,
            {
              depth: 0.075,
              bevelEnabled: true,
              bevelSegments: 2,
              bevelSize: 0.008,
              bevelThickness: 0.008,
              curveSegments: 4,
            },
          ]}
        />
        <meshPhysicalMaterial
          color={plastic}
          roughness={0.68}
          metalness={0.02}
          clearcoat={0.11}
          clearcoatRoughness={0.82}
        />
      </mesh>

      {/* Flat face highlight */}
      <mesh
        position={[0, 0.002, 0.041]}
      >
        <planeGeometry args={[0.12, 0.13]} />
        <meshStandardMaterial
          color={edge}
          roughness={0.56}
          metalness={0}
        />
      </mesh>

      {/* Tiny molded notch/detail near the face */}
      <mesh position={[0, 0.078, 0.02]}>
        <boxGeometry args={[0.075, 0.006, 0.018]} />
        <meshStandardMaterial
          color="#0b1220"
          roughness={0.6}
        />
      </mesh>

      {/* Realistic printed part number */}
      <PrintedMark text={title} position={[0, 0.018, 0.048]}
        width={0.125} height={0.052} color="#aeb6c0" opacity={0.82} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* TO-18                                                                      */
/* -------------------------------------------------------------------------- */

function TO18Body({
  selected,
  title,
}: {
  selected: boolean;
  title: string;
}) {
  const metal = selected ? "#d6d9dc" : "#aeb4ba";

  return (
    <group>
      {/* Main metal can */}
      <mesh castShadow>
        <cylinderGeometry args={[0.087, 0.087, 0.13, 32]} />
        <meshPhysicalMaterial
          color={metal}
          metalness={0.92}
          roughness={0.24}
          clearcoat={0.2}
          clearcoatRoughness={0.31}
        />
      </mesh>

      {/* Slightly raised top */}
      <mesh position={[0, 0.068, 0]}>
        <cylinderGeometry args={[0.073, 0.078, 0.018, 32]} />
        <meshStandardMaterial
          color="#c4c8cc"
          metalness={0.92}
          roughness={0.19}
        />
      </mesh>

      {/* Bottom flange */}
      <mesh position={[0, -0.066, 0]}>
        <cylinderGeometry args={[0.098, 0.098, 0.014, 32]} />
        <meshStandardMaterial
          color="#8e969e"
          metalness={0.9}
          roughness={0.28}
        />
      </mesh>

      {/* Can locating tab */}
      <mesh position={[0.083, -0.015, 0]}>
        <boxGeometry args={[0.018, 0.065, 0.022]} />
        <meshStandardMaterial
          color="#858d95"
          metalness={0.85}
          roughness={0.28}
        />
      </mesh>

      {/* Part marking */}
      <PrintedMark text={title} position={[0, 0.082, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={0.125} height={0.05} color="#414b54" opacity={0.88} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* TO-220                                                                     */
/* -------------------------------------------------------------------------- */

function TO220Body({
  selected,
  title,
}: {
  selected: boolean;
  title: string;
}) {
  const plastic = selected ? "#263449" : "#101827";

  return (
    <group>
      {/* Main molded body */}
      <mesh
        castShadow
        position={[0, 0.015, 0]}
      >
        <boxGeometry args={[0.205, 0.205, 0.065]} />
        <meshStandardMaterial
          color={plastic}
          roughness={0.42}
          metalness={0.03}
        />
      </mesh>

      {/* Rounded-ish shoulders */}
      <mesh
        castShadow
        position={[0, 0.105, 0]}
      >
        <boxGeometry args={[0.205, 0.025, 0.067]} />
        <meshStandardMaterial
          color={plastic}
          roughness={0.4}
        />
      </mesh>

      {/* Exposed metal mounting tab */}
      <PunchedMetalTab width={0.202} height={0.105} depth={0.022}
        holeRadius={0.026} holeY={0.03}
        position={[0, 0.128, -0.016]} color="#aeb5bc" />

      {/* Mounting hole */}
      <mesh position={[0, 0.158, 0.009]}>

        <ringGeometry args={[0.025, 0.037, 20]} />
        <meshStandardMaterial
          color="#5f6872"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* Molded face inset */}
      <mesh position={[0, 0.015, 0.034]}>
        <boxGeometry args={[0.17, 0.15, 0.004]} />
        <meshStandardMaterial
          color="#182235"
          roughness={0.52}
        />
      </mesh>

      {/* Part marking */}
      <PrintedMark text={title} position={[0, 0.02, 0.039]}
        width={0.16} height={0.06} color="#d0d7e0" opacity={0.8} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* TO-3                                                                       */
/* -------------------------------------------------------------------------- */

function TO3Body({
  selected,
  title,
}: {
  selected: boolean;
  title: string;
}) {
  const metal = selected ? "#d9dde1" : "#b5bbc1";

  return (
    <group>
      {/* Main TO-3 metal can */}
      <mesh castShadow>
        <cylinderGeometry args={[0.158, 0.158, 0.085, 40]} />
        <meshStandardMaterial
          color={metal}
          metalness={0.93}
          roughness={0.2}
        />
      </mesh>

      {/* Raised center */}
      <mesh position={[0, 0.052, 0]}>
        <cylinderGeometry args={[0.135, 0.145, 0.018, 40]} />
        <meshStandardMaterial
          color="#c5cacf"
          metalness={0.94}
          roughness={0.18}
        />
      </mesh>

      {/* Bottom flange */}
      <mesh position={[0, -0.048, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.016, 40]} />
        <meshStandardMaterial
          color="#9299a1"
          metalness={0.9}
          roughness={0.25}
        />
      </mesh>

      {/* Mounting ears */}
      {[-1, 1].map((side) => (
        <group key={side}>
          <PunchedMetalTab width={0.098} height={0.082} depth={0.105}
            holeRadius={0.022} position={[side * 0.224, 0, -0.0525]} color={metal} />

          {/* Actual mounting hole */}
          <mesh position={[side * 0.224, 0, 0.054]}>

            <ringGeometry args={[0.022, 0.032, 20]} />
            <meshStandardMaterial
              color="#69727b"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>

        </group>
      ))}

      {/* Part marking */}
      <PrintedMark text={title} position={[0, 0.063, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={0.19} height={0.07} color="#414b54" opacity={0.86} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Main component                                                             */
/* -------------------------------------------------------------------------- */

export function TransistorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
 

  const e = vec(part.pins.e);
  const b = vec(part.pins.b);
  const c = vec(part.pins.c);

  const body = e
    .clone()
    .add(b)
    .add(c)
    .multiplyScalar(1 / 3);

  body.y = BOARD.height + 0.2;

  const model =
    part.props.transistorModel ?? "2n3904";

  const meta =
    TRANSISTOR_META[model] ??
    TRANSISTOR_META["2n3904"];

  const on = Boolean(
    sim.transistors?.[part.id]?.conducting,
  );

  const pkg = meta.package;

  /*
   * Package-specific lead colors.
   *
   * Gold/brass is intentionally subtle. Real transistor leads vary from
   * tinned silver to nickel/gold depending on manufacturer.
   */
  const leadColor =
    pkg === "to18" || pkg === "to3"
      ? "#b8a36a"
      : "#b9c0c8";

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Physical leads                                                     */}
      {/* ------------------------------------------------------------------ */}

      <BentBoardLead pin={e} body={body} color={leadColor} />
      <BentBoardLead pin={b} body={body} color={leadColor} />
      <BentBoardLead pin={c} body={body} color={leadColor} />

      {/* ------------------------------------------------------------------ */}
      {/* Actual package                                                     */}
      {/* ------------------------------------------------------------------ */}

      <group position={body}>
        {pkg === "to92" && (
          <TO92Body
            selected={selected}
            title={meta.title}
          />
        )}

        {pkg === "to18" && (
          <TO18Body
            selected={selected}
            title={meta.title}
          />
        )}

        {pkg === "to220" && (
          <TO220Body
            selected={selected}
            title={meta.title}
          />
        )}

        {pkg === "to3" && (
          <TO3Body
            selected={selected}
            title={meta.title}
          />
        )}

        {/* -------------------------------------------------------------- */}
        {/* Simulation status indicator                                    */}
        {/* -------------------------------------------------------------- */}

        <mesh
          position={[0.09, 0.12, 0.065]}
        >
          <sphereGeometry args={[0.018, 12, 12]} />

          <meshStandardMaterial
            color={
              on
                ? "#22c55e"
                : "#334155"
            }
            emissive={
              on
                ? "#16a34a"
                : "#000000"
            }
            emissiveIntensity={
              on ? 1.35 : 0
            }
            roughness={0.28}
          />
        </mesh>

        {/* Tiny glow shell when conducting */}
        {on && (
          <mesh
            position={[0.09, 0.12, 0.065]}
          >
            <sphereGeometry args={[0.027, 12, 12]} />
            <meshBasicMaterial
              color="#22c55e"
              transparent
              opacity={0.12}
            />
          </mesh>
        )}

        {/* Package/model identification */}
        <Html
          position={[0, 0.2, 0]}
          center
          distanceFactor={6.5}
          style={{
            pointerEvents: "none",
            color: "#e2e8f0",
            fontFamily:
              "IBM Plex Mono, monospace",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            userSelect: "none",
            whiteSpace: "nowrap",
            textShadow:
              "0 1px 4px rgba(0,0,0,.9)",
          }}
        >
          {meta.title} ·{" "}
          {meta.polarity.toUpperCase()}
        </Html>
      </group>

      {/* ------------------------------------------------------------------ */}
      {/* Pin identification overlay                                        */}
      {/* ------------------------------------------------------------------ */}


      {/* ------------------------------------------------------------------ */}
      {/* Hover information panel                                            */}
      {/* ------------------------------------------------------------------ */}
    </group>
  );
}

const THYRISTOR_META: Record<
  string,
  { title: string; package: "to92" | "to220"; note: string }
> = {
  "2n5060": { title: "2N5060", package: "to92", note: "Sensitive-gate SCR" },
  tic106: { title: "TIC106", package: "to220", note: "4 A SCR" },
  bt151: { title: "BT151", package: "to220", note: "12 A SCR" },
  c106: { title: "C106", package: "to220", note: "4 A SCR" },
  "2n6508": { title: "2N6508", package: "to220", note: "25 A SCR" },
  tyn612: { title: "TYN612", package: "to220", note: "12 A SCR" },
};

const TRIAC_META: Record<
  string,
  { title: string; package: "to92" | "to220"; note: string }
> = {
  bt136: { title: "BT136", package: "to220", note: "4 A TRIAC" },
  bt139: { title: "BT139", package: "to220", note: "16 A TRIAC" },
  tic226: { title: "TIC226", package: "to220", note: "8 A TRIAC" },
  mac97a: { title: "MAC97A", package: "to92", note: "Sensitive TRIAC" },
  bta16: { title: "BTA16", package: "to220", note: "16 A isolated" },
};

const DIAC_META: Record<string, { title: string; vbo: number; note: string }> = {
  db3: { title: "DB3", vbo: 32, note: "~32 V breakover" },
  db4: { title: "DB4", vbo: 40, note: "~40 V breakover" },
  ht32: { title: "HT32", vbo: 32, note: "~32 V breakover" },
};

/**
 * Thyristor / SCR — three-terminal package.
 * Pin order on breadboard matches real TO-220 datasheet (K, A, G).
 * Reuses transistor lead geometry; body is TO-92 or TO-220 style.
 */
export function ThyristorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {

  const a = vec(part.pins.a);
  const g = vec(part.pins.g);
  const k = vec(part.pins.k);

  const body = a
    .clone()
    .add(g)
    .add(k)
    .multiplyScalar(1 / 3);
  body.y = BOARD.height + 0.2;

  const model = part.props.thyristorModel ?? "2n5060";
  const meta = THYRISTOR_META[model] ?? THYRISTOR_META["2n5060"];
  const on = Boolean(sim.thyristors?.[part.id]?.conducting);
  const leadColor = "#b9c0c8";

  // Pin colors: Anode (A), Gate (G), Cathode (K)
  const colA = "#f87171";
  const colG = "#fbbf24";
  const colK = "#60a5fa";

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BoardPinMarker position={a} label="A" color={colA} labelColor="#fecaca" />
      <BoardPinMarker position={g} label="G" color={colG} labelColor="#fde68a" />
      <BoardPinMarker position={k} label="K" color={colK} labelColor="#bfdbfe" />

      <BentBoardLead pin={a} body={body} color={colA} />
      <BentBoardLead pin={g} body={body} color={colG} />
      <BentBoardLead pin={k} body={body} color={colK} />

      <group position={body}>
        {meta.package === "to92" ? (
          <TO92Body selected={selected} title={meta.title} />
        ) : (
          <TO220Body selected={selected} title={meta.title} />
        )}

        {/* Status LED — amber when latched */}
        <mesh position={[0.09, 0.12, 0.065]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial
            color={on ? "#f59e0b" : "#334155"}
            emissive={on ? "#d97706" : "#000000"}
            emissiveIntensity={on ? 1.4 : 0}
            roughness={0.28}
          />
        </mesh>
        {on && (
          <mesh position={[0.09, 0.12, 0.065]}>
            <sphereGeometry args={[0.027, 12, 12]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.14} />
          </mesh>
        )}

        <Html
          position={[0, 0.2, 0]}
          center
          distanceFactor={6.5}
          style={{
            pointerEvents: "none",
            color: "#e2e8f0",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            userSelect: "none",
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,.9)",
          }}
        >
          {meta.title} · SCR
        </Html>
      </group>
    </group>
  );
}

/** TRIAC — bidirectional thyristor (MT1, G, MT2). */
export function TriacMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {

  const mt1 = vec(part.pins.mt1);
  const g = vec(part.pins.g);
  const mt2 = vec(part.pins.mt2);
  const body = mt1.clone().add(g).add(mt2).multiplyScalar(1 / 3);
  body.y = BOARD.height + 0.2;
  const model = part.props.triacModel ?? "bt136";
  const meta = TRIAC_META[model] ?? TRIAC_META.bt136;
  const on = Boolean(sim.triacs?.[part.id]?.conducting);
  const leadColor = "#b9c0c8";

  const colMt1 = "#60a5fa";
  const colG = "#fbbf24";
  const colMt2 = "#f87171";

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BoardPinMarker position={mt1} label="MT1" color={colMt1} labelColor="#bfdbfe" />
      <BoardPinMarker position={g} label="G" color={colG} labelColor="#fde68a" />
      <BoardPinMarker position={mt2} label="MT2" color={colMt2} labelColor="#fecaca" />

      <BentBoardLead pin={mt1} body={body} color={colMt1} />
      <BentBoardLead pin={g} body={body} color={colG} />
      <BentBoardLead pin={mt2} body={body} color={colMt2} />
      <group position={body}>
        {meta.package === "to92" ? (
          <TO92Body selected={selected} title={meta.title} />
        ) : (
          <TO220Body selected={selected} title={meta.title} />
        )}
        <mesh position={[0.09, 0.12, 0.065]}>
          <sphereGeometry args={[0.018, 12, 12]} />
          <meshStandardMaterial
            color={on ? "#a78bfa" : "#334155"}
            emissive={on ? "#7c3aed" : "#000000"}
            emissiveIntensity={on ? 1.4 : 0}
            roughness={0.28}
          />
        </mesh>
        {on && (
          <mesh position={[0.09, 0.12, 0.065]}>
            <sphereGeometry args={[0.027, 12, 12]} />
            <meshBasicMaterial color="#a78bfa" transparent opacity={0.14} />
          </mesh>
        )}
        <Html
          position={[0, 0.2, 0]}
          center
          distanceFactor={6.5}
          style={{
            pointerEvents: "none",
            color: "#e2e8f0",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "9px",
            fontWeight: 500,
            letterSpacing: "0.04em",
            userSelect: "none",
            whiteSpace: "nowrap",
            textShadow: "0 1px 4px rgba(0,0,0,.9)",
          }}
        >
          {meta.title} · TRIAC
        </Html>
      </group>
    </group>
  );
}

/** DIAC — bidirectional trigger diode (2-pin axial-style). */
export function DiacMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {

  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.18;
  const model = part.props.diacModel ?? "db3";
  const meta = DIAC_META[model] ?? DIAC_META.db3;
  const on = Boolean(sim.diacs?.[part.id]?.conducting);

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} />
      <BentBoardLead pin={b} body={body} />
      <mesh position={body}>
        <cylinderGeometry args={[0.05, 0.05, 0.14, 12]} />
        <meshStandardMaterial
          color={selected ? "#334155" : "#1e293b"}
          roughness={0.45}
          metalness={0.15}
        />
      </mesh>
      {/* Band marks (symmetrical) */}
      <mesh position={[body.x, body.y + 0.035, body.z]}>
        <cylinderGeometry args={[0.052, 0.052, 0.02, 12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      <mesh position={[body.x, body.y - 0.035, body.z]}>
        <cylinderGeometry args={[0.052, 0.052, 0.02, 12]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      {on && (
        <mesh position={body}>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#22d3ee" transparent opacity={0.2} />
        </mesh>
      )}
      <Html
        position={[body.x, body.y + 0.18, body.z]}
        center
        distanceFactor={6.5}
        style={{
          pointerEvents: "none",
          color: "#e2e8f0",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "9px",
          fontWeight: 500,
          whiteSpace: "nowrap",
          textShadow: "0 1px 4px rgba(0,0,0,.9)",
        }}
      >
        {meta.title} · DIAC
      </Html>

    </group>
  );
}

/** Small DC hobby motor — cylindrical body, spinning shaft when powered. */
export function MotorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {

  const shaftRef = useRef<THREE.Group>(null);
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const body = a.clone().lerp(b, 0.5);
  // A brushed hobby motor is physically larger than a resistor or a TO-92:
  // keep its metal can well clear of the board and reserve that space in the
  // placement/collision geometry as well.
  const motorRadius = part.props.motorModel === '12v' ? 0.19 : 0.17;
  const motorLength = part.props.motorModel === '12v' ? 0.44 : 0.40;
  body.y = BOARD.height + motorRadius + 0.035;
  const state = sim.motors?.[part.id];
  const on = Boolean(state?.on);
  const speed = state?.speed ?? 0;
  const direction = state?.direction ?? 0;

  useFrame((_, dt) => {
    if (!shaftRef.current || !on || speed < 0.02) return;
    // Shaft lies along +X (cylinder rotated 90° about Z), so spin about X.
    const spin = (direction || 1) * Math.max(speed, 0.15) * dt * 28;
    shaftRef.current.rotation.x += spin;
  });

  // Terminal colors: A = +, B = − (conventional hobby motor marking)
  const colPos = "#f87171";
  const colNeg = "#94a3b8";

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
      onPointerOver={(ev) => {
        ev.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(ev) => {
        ev.stopPropagation();
        document.body.style.cursor = "default";
      }}
    >
      <BoardPinMarker position={a} label="+" color={colPos} labelColor="#fecaca" />
      <BoardPinMarker position={b} label="−" color={colNeg} labelColor="#e2e8f0" />

      <BentBoardLead pin={a} body={body} color={colPos} />
      <BentBoardLead pin={b} body={body} color={colNeg} />

      {/* Motor can */}
      <mesh position={body} rotation={[0, 0, Math.PI / 2]} castShadow receiveShadow>
        <cylinderGeometry args={[motorRadius, motorRadius, motorLength, 32]} />
        <meshPhysicalMaterial
          color={selected ? "#b8c6d6" : "#9ca8b6"}
          metalness={0.82}
          roughness={0.28}
          clearcoat={0.24}
          clearcoatRoughness={0.32}
        />
      </mesh>
      <PrintedMark text={`DC ${part.props.motorModel ?? '5v'}`.toUpperCase()}
        secondary="BRUSHED MOTOR" position={[body.x, body.y + motorRadius + 0.008, body.z]}
        rotation={[-Math.PI / 2, 0, 0]} width={motorLength * 0.69} height={motorRadius * 0.84}
        color="#25303e" opacity={0.82} />
      {/* Stamped steel ribs and ventilated end bell: detail meshes are visual only. */}
      {[-0.173, -0.118, 0.118, 0.173].map((x)=>(
        <mesh key={`motor-rib-${x}`} position={[body.x + x, body.y, body.z]} rotation={[0,Math.PI/2,0]} raycast={() => null}>
          <torusGeometry args={[motorRadius + 0.002, 0.003, 5, 32]} />
          <meshStandardMaterial color="#66717f" metalness={0.86} roughness={0.3} />
        </mesh>
      ))}
      {[-0.085, 0, 0.085].map((z)=>(
        <mesh key={`motor-vent-${z}`} position={[body.x - motorLength / 2 + 0.012, body.y + motorRadius * 0.57, body.z + z]} rotation={[0,0,Math.PI/2]}>
          <boxGeometry args={[0.012, 0.008, 0.026]} />
          <meshStandardMaterial color="#28313d" metalness={0.24} roughness={0.71} />
        </mesh>
      ))}
      {/* End caps */}
      <mesh position={[body.x - motorLength / 2, body.y, body.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[motorRadius + 0.003, motorRadius + 0.003, 0.023, 32]} />
        <meshPhysicalMaterial color="#59616d" metalness={0.65} roughness={0.38} clearcoat={0.18} />
      </mesh>
      <mesh position={[body.x + motorLength / 2, body.y, body.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[motorRadius + 0.003, motorRadius + 0.003, 0.023, 32]} />
        <meshPhysicalMaterial color="#59616d" metalness={0.65} roughness={0.38} clearcoat={0.18} />
      </mesh>

      {[-0.09, 0.09].map((z)=>(
        <mesh key={`terminal-${z}`} position={[body.x - motorLength / 2 - 0.011, body.y + 0.035, body.z + z]} rotation={[0,0,Math.PI/2]}>
          <cylinderGeometry args={[0.016,0.016,0.009,12]} />
          <meshStandardMaterial color={z < 0 ? '#c25b47' : '#c9b16c'} metalness={0.75} roughness={0.25} />
        </mesh>
      ))}
      {/* Shaft bearing collar */}
      <mesh position={[body.x + motorLength / 2 + 0.016, body.y, body.z]} rotation={[0,0,Math.PI/2]} castShadow>
        <cylinderGeometry args={[0.039,0.044,0.018,24]} />
        <meshStandardMaterial color="#adb9c4" metalness={0.91} roughness={0.22} />
      </mesh>
      {/* Shaft + larger 4-blade propeller */}
      <group ref={shaftRef} position={[body.x + motorLength / 2 + 0.11, body.y, body.z]}>
        {/* Shaft extension */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.014, 0.014, 0.16, 10]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
        </mesh>
        {/* Hub */}
        <mesh position={[0.06, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.045, 0.045, 0.04, 12]} />
          <meshStandardMaterial
            color={on ? "#fbbf24" : "#475569"}
            metalness={0.5}
            roughness={0.35}
            emissive={on ? "#d97706" : "#000000"}
            emissiveIntensity={on ? 0.45 : 0}
          />
        </mesh>
        {/* Four fan blades */}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={`blade-${i}`}
            position={[0.06, 0, 0]}
            rotation={[i * (Math.PI / 2), 0, 0]}
          >
            <mesh position={[0, 0.16, 0]}>
              <boxGeometry args={[0.03, 0.28, 0.08]} />
              <meshStandardMaterial
                color={on ? "#f59e0b" : "#64748b"}
                metalness={0.25}
                roughness={0.45}
                emissive={on ? "#b45309" : "#000000"}
                emissiveIntensity={on ? 0.35 : 0}
              />
            </mesh>
          </mesh>
        ))}
      </group>

      {on && (
        <mesh position={[body.x + motorLength / 2 + 0.11, body.y, body.z]}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.07} />
        </mesh>
      )}


    </group>
  );
}

export function SpeakerMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.14;
  const state = sim.speakers?.[part.id];
  const on = Boolean(state?.on);
  const cone = useRef<THREE.Mesh>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    gain: GainNode;
  } | null>(null);

  useEffect(() => {
    if (on) {
      if (!audioRef.current) {
        try {
          const AC =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext })
              .webkitAudioContext;
          const ctx = new AC();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = 440;
          gain.gain.value = 0;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          audioRef.current = { ctx, osc, gain };
        } catch {
          audioRef.current = null;
        }
      }
      const audio = audioRef.current;
      if (audio) {
        if (audio.ctx.state === "suspended") void audio.ctx.resume();
        const loud = state?.loudness ?? 0.5;
        audio.gain.gain.setTargetAtTime(
          0.03 + loud * 0.07,
          audio.ctx.currentTime,
          0.04,
        );
      }
    } else if (audioRef.current) {
      const audio = audioRef.current;
      audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.06);
    }
  }, [on, state?.loudness]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (!audio) return;
      try {
        audio.osc.stop();
        void audio.ctx.close();
      } catch {
        /* ignore */
      }
      audioRef.current = null;
    };
  }, []);

  useFrame(({ clock }, delta) => {
    if (!cone.current) return;
    const loud = on ? state?.loudness ?? 0.5 : 0;
    const vib = loud
      ? Math.sin(clock.getElapsedTime() * 28) * (0.01 + loud * 0.015)
      : 0;
    cone.current.position.y = THREE.MathUtils.damp(
      cone.current.position.y,
      0.04 + vib,
      30,
      delta,
    );
  });

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} />
      <BentBoardLead pin={b} body={body} />
      <group position={body}>
        {/* Frame */}
        <mesh castShadow>
          <cylinderGeometry args={[0.16, 0.17, 0.08, 24]} />
          <meshStandardMaterial
            color={selected ? "#475569" : "#1e293b"}
            roughness={0.4}
          />
        </mesh>
        {/* Magnet back */}
        <mesh position={[0, -0.06, 0]} castShadow>
          <cylinderGeometry args={[0.09, 0.1, 0.08, 20]} />
          <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.35} />
        </mesh>
        {/* Cone */}
        <mesh ref={cone} position={[0, 0.04, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.14, 0.06, 24]} />
          <meshStandardMaterial
            color={on ? "#e2e8f0" : "#94a3b8"}
            roughness={0.55}
          />
        </mesh>
        {/* Dust cap */}
        <mesh position={[0, 0.07, 0]}>
          <sphereGeometry args={[0.035, 12, 12]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.45} />
        </mesh>
        <Html
          position={[0, 0.18, 0]}
          center
          distanceFactor={6.5}
          style={{
            pointerEvents: "none",
            color: "#e2e8f0",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "9px",
            userSelect: "none",
            whiteSpace: "nowrap",
          }}
        >
          SPEAKER
        </Html>
      </group>
    </group>
  );
}

function LogicGateMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const packagePins = Array.from({ length: 14 }, (_, index) => part.pins[`p${index + 1}`])
    .filter(Boolean)
    .map(vec);
  if (packagePins.length !== 14) return null;
  // Pins 1-7 run down one side of the package and pins 8-14 return
  // on the other side. The body is centered along the pin-number axis
  // and halfway between the two pin rows, as on a real DIP package.
  const center = packagePins[0].clone().add(packagePins[6]).multiplyScalar(0.5);
  center.z = (packagePins[0].z + packagePins[13].z) / 2;
  center.y = BOARD.height + 0.15;
  const family = LOGIC_IC_PINOUTS[part.kind as keyof typeof LOGIC_IC_PINOUTS]?.model
    ?? part.props.gateFamily ?? part.kind.toUpperCase();
  const state = sim.logicGates?.[part.id];
  const color = state?.powered ? (state.output ? "#22c55e" : "#334155") : "#1e293b";
  const pinMaterial = <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />;
  const bodyEdge = 0.24;
  return (
    <group onClick={(e) => {
      e.stopPropagation();
      useLab.getState().select(part.id);
    }}>
      {packagePins.map((pin, index) => (
        <group key={`pin-${index}`}>
          <mesh position={[pin.x, BOARD.height + 0.01, pin.z]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 6]} />
            {pinMaterial}
          </mesh>
          <mesh
            position={[
              pin.x,
              BOARD.height + 0.09,
              (pin.z + center.z + (pin.z < center.z ? -bodyEdge : bodyEdge)) / 2,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.014, 0.014, Math.max(0.04, Math.abs(pin.z - center.z) - bodyEdge + 0.08), 6]} />
            {pinMaterial}
          </mesh>
        </group>
      ))}
      <group position={[center.x, center.y, center.z]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.42, 0.3, 0.48]} />
          <meshPhysicalMaterial
            color={selected ? "#1b335b" : color}
            emissive={state?.output ? "#14532d" : "#000000"}
            emissiveIntensity={state?.output ? 0.28 : 0}
            roughness={0.72}
            metalness={0.03}
            clearcoat={0.12}
            clearcoatRoughness={0.86}
          />
        </mesh>
        {/* top label patch */}
        <mesh position={[0, 0.152, 0]} castShadow>
          <boxGeometry args={[0.82, 0.01, 0.24]} />
          <meshStandardMaterial color="#d6d8dc" roughness={0.72} />
        </mesh>
        {/* pin-1 dimple */}
        <mesh position={[-0.56, 0.151, -0.14]}>
          <sphereGeometry args={[0.022, 10, 10]} />
          <meshStandardMaterial color="#06080d" roughness={0.88} />
        </mesh>
      </group>
      <lineSegments position={[center.x, center.y, center.z]}>
        <edgesGeometry args={[new THREE.BoxGeometry(1.42, 0.3, 0.48)]} />
        <lineBasicMaterial color={selected ? "#60a5fa" : "#475569"} />
      </lineSegments>
      <mesh position={[center.x - 0.48, center.y + 0.155, center.z]}>
        <torusGeometry args={[0.08, 0.025, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#0a0f18" roughness={0.85} />
      </mesh>
      <Html
        position={[center.x, center.y + 0.13, center.z]}
        center
        distanceFactor={7}
        style={{
          pointerEvents: "none",
          color: "#e2e8f0",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "8px",
          fontWeight: 700,
          whiteSpace: "nowrap",
        }}
      >
        <div style={{ textAlign: "center", lineHeight: 1.35 }}>
          <div>{family}</div>
          <div style={{ fontSize: "6px", color: "#fecaca" }}>14 VCC</div>
          <div style={{ fontSize: "6px", color: "#bfdbfe" }}>7 GND</div>
        </div>
      </Html>
    </group>
  );
}


/** Generic two-pin axial body between holes a and b. */
function TwoPinBody({
  aId,
  bId,
  selected,
  bodyColor,
  accentColor,
  label,
  bodyRadius = 0.07,
  bodyScale = 0.55,
}: {
  aId?: string;
  bId?: string;
  selected: boolean;
  bodyColor: string;
  accentColor?: string;
  label?: string;
  bodyRadius?: number;
  bodyScale?: number;
}) {
  if (!aId || !bId) return null;
  const a = vec(aId as any);
  const b = vec(bId as any);
  const dir = b.clone().sub(a);
  dir.y = 0;
  const pinDistance = dir.length();
  if (pinDistance < 0.001) return null;
  dir.normalize();
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.14;
  const bodyLength = Math.min(0.48, Math.max(0.22, pinDistance * bodyScale));
  const half = bodyLength / 2;
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir,
  );
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
      }}
    >
      <BentBoardLead pin={a} body={body} />
      <BentBoardLead pin={b} body={body} />
      <group position={body} quaternion={quat}>
        <mesh>
          <cylinderGeometry args={[bodyRadius, bodyRadius, bodyLength, 16]} />
          <meshStandardMaterial
            color={selected ? "#60a5fa" : bodyColor}
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>
        {accentColor && (
          <mesh position={[0, half * 0.55, 0]}>
            <cylinderGeometry args={[bodyRadius * 1.05, bodyRadius * 1.05, 0.04, 12]} />
            <meshStandardMaterial color={accentColor} metalness={0.6} roughness={0.3} />
          </mesh>
        )}
        {label && (
          <Html position={[0, 0, bodyRadius + 0.02]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 9, color: "#e2e8f0", fontWeight: 700 }}>
            {label}
          </Html>
        )}
      </group>
    </group>
  );
}

export function MosfetMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const g = part.pins.g ? vec(part.pins.g) : null;
  const d = part.pins.d ? vec(part.pins.d) : null;
  const s = part.pins.s ? vec(part.pins.s) : null;
  if (!g || !d || !s) return null;
  const body = g.clone().add(d).add(s).multiplyScalar(1 / 3);
  body.y = BOARD.height + 0.2;
  const on = Boolean(sim.mosfets?.[part.id]?.conducting);
  const model = String(part.props.mosfetModel || "2n7000");
  const to220 = /irf|540|9540/i.test(model);
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={g} body={body} color="#94a3b8" />
      <BentBoardLead pin={d} body={body} color="#94a3b8" />
      <BentBoardLead pin={s} body={body} color="#94a3b8" />
      <group position={body}>
        {to220 ? (
          <>
            <mesh position={[0, 0.06, 0]}>
              <boxGeometry args={[0.22, 0.14, 0.1]} />
              <meshStandardMaterial color={selected ? "#3b82f6" : "#1e293b"} roughness={0.4} metalness={0.2} />
            </mesh>
            <mesh position={[0, 0.14, -0.01]}>
              <boxGeometry args={[0.2, 0.02, 0.12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.25} />
            </mesh>
          </>
        ) : (
          <mesh>
            <cylinderGeometry args={[0.09, 0.1, 0.2, 16]} />
            <meshStandardMaterial color={selected ? "#3b82f6" : "#334155"} roughness={0.45} />
          </mesh>
        )}
        <mesh position={[0.08, 0.12, 0.06]}>
          <sphereGeometry args={[0.016, 10, 10]} />
          <meshStandardMaterial
            color={on ? "#22c55e" : "#334155"}
            emissive={on ? "#16a34a" : "#000000"}
            emissiveIntensity={on ? 1.2 : 0}
          />
        </mesh>
        <Html position={[0, 0.18, 0]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 8, color: "#94a3b8", fontWeight: 700 }}>
          MOS
        </Html>
      </group>
    </group>
  );
}

export function ZenerMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const a = part.pins.a ? vec(part.pins.a) : null;
  const k = part.pins.k ? vec(part.pins.k) : null;
  if (!a || !k) return null;
  const dir = k.clone().sub(a);
  dir.y = 0;
  if (dir.length() < 0.001) return null;
  dir.normalize();
  const body = a.clone().lerp(k, 0.5);
  body.y = BOARD.height + 0.14;
  const bodyLength = 0.32;
  const half = bodyLength / 2;
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const br = Boolean(sim.zeners?.[part.id]?.breakdown);
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} />
      <BentBoardLead pin={k} body={body} />
      <group position={body} quaternion={quat}>
        <mesh>
          <cylinderGeometry args={[0.07, 0.07, bodyLength, 16]} />
          <meshStandardMaterial color={selected ? "#60a5fa" : "#0f172a"} roughness={0.35} />
        </mesh>
        {/* Zener cathode band + angled mark */}
        <mesh position={[0, half - 0.05, 0]}>
          <cylinderGeometry args={[0.078, 0.078, 0.05, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
        </mesh>
        <mesh position={[0, half - 0.02, 0.06]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[0.04, 0.01, 0.03]} />
          <meshStandardMaterial color="#f8fafc" />
        </mesh>
        <mesh position={[0, 0.02, 0.08]}>
          <sphereGeometry args={[0.014, 10, 10]} />
          <meshStandardMaterial
            color={br ? "#f59e0b" : "#334155"}
            emissive={br ? "#d97706" : "#000"}
            emissiveIntensity={br ? 1.1 : 0}
          />
        </mesh>
      </group>
    </group>
  );
}

export function LdrMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // GL5528-style: ~5mm round epoxy disc, radial leads, visible zigzag CdS track
  const a = part.pins.a ? vec(part.pins.a) : null;
  const b = part.pins.b ? vec(part.pins.b) : null;
  if (!a || !b) return null;
  const dir = b.clone().sub(a);
  dir.y = 0;
  if (dir.length() < 0.001) return null;
  dir.normalize();
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.12;
  const light = sim.ldrs?.[part.id]?.lightLevel ?? part.props.lightLevel ?? 0.5;
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} color="#b9c0c8" />
      <BentBoardLead pin={b} body={body} color="#b9c0c8" />
      <group position={body}>
        {/* Epoxy disc (Φ≈5mm → ~0.2 world units) */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.04, 24]} />
          <meshStandardMaterial color={selected ? "#60a5fa" : "#f5f0e6"} roughness={0.45} />
        </mesh>
        {/* Inner ceramic / CdS area */}
        <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.075, 0.075, 0.008, 20]} />
          <meshStandardMaterial
            color="#c4a574"
            emissive="#fbbf24"
            emissiveIntensity={0.15 + light * 0.55}
            roughness={0.5}
          />
        </mesh>
        {/* Zigzag track suggestion */}
        <mesh position={[0, 0.028, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.04, 0.006, 6, 16]} />
          <meshStandardMaterial color="#5c4033" roughness={0.6} />
        </mesh>
        <Html position={[0, 0.1, 0]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 8, color: "#a16207", fontWeight: 700 }}>
          LDR
        </Html>
      </group>
    </group>
  );
}

export function ThermistorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // NTC glass-bead / epoxy droplet on two thin axial leads
  const a = part.pins.a ? vec(part.pins.a) : null;
  const b = part.pins.b ? vec(part.pins.b) : null;
  if (!a || !b) return null;
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.12;
  const t = sim.thermistors?.[part.id]?.temperatureC ?? part.props.temperatureC ?? 25;
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} color="#b9c0c8" radius={0.01} />
      <BentBoardLead pin={b} body={body} color="#b9c0c8" radius={0.01} />
      <group position={body}>
        <mesh scale={[1, 0.75, 1]}>
          <sphereGeometry args={[0.055, 16, 16]} />
          <meshStandardMaterial
            color={selected ? "#60a5fa" : "#44403c"}
            roughness={0.25}
            metalness={0.05}
            transparent
            opacity={0.85}
          />
        </mesh>
        <mesh position={[0, 0, 0]} scale={[0.7, 0.5, 0.7]}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color="#1c1917" roughness={0.4} />
        </mesh>
        <Html position={[0, 0.1, 0]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 8, color: "#fb923c", fontWeight: 700 }}>
          NTC {Math.round(t)}°
        </Html>
      </group>
    </group>
  );
}

export function FuseMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // Cartridge fuse: glass cylinder, metal end-caps, visible element wire
  const a = part.pins.a ? vec(part.pins.a) : null;
  const b = part.pins.b ? vec(part.pins.b) : null;
  if (!a || !b) return null;
  const dir = b.clone().sub(a);
  dir.y = 0;
  if (dir.length() < 0.001) return null;
  dir.normalize();
  const body = a.clone().lerp(b, 0.5);
  body.y = BOARD.height + 0.14;
  const bodyLength = Math.min(0.42, Math.max(0.28, dir.length() * 0.55));
  const half = bodyLength / 2;
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  const blown = Boolean(sim.fuses?.[part.id]?.blown || part.props.fuseBlown);
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <BentBoardLead pin={a} body={body} color="#cbd5e1" />
      <BentBoardLead pin={b} body={body} color="#cbd5e1" />
      <group position={body} quaternion={quat}>
        {/* Glass tube */}
        <mesh>
          <cylinderGeometry args={[0.055, 0.055, bodyLength * 0.72, 16]} />
          <meshStandardMaterial
            color={blown ? "#7f1d1d" : selected ? "#bfdbfe" : "#e2e8f0"}
            transparent
            opacity={0.55}
            roughness={0.1}
            metalness={0.05}
          />
        </mesh>
        {/* End caps */}
        <mesh position={[0, half * 0.78, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.05, 12]} />
          <meshStandardMaterial color="#a8a29e" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0, -half * 0.78, 0]}>
          <cylinderGeometry args={[0.06, 0.06, 0.05, 12]} />
          <meshStandardMaterial color="#a8a29e" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Fuse element */}
        <mesh>
          <cylinderGeometry args={[0.006, 0.006, bodyLength * 0.55, 6]} />
          <meshStandardMaterial color={blown ? "#450a0a" : "#78716c"} />
        </mesh>
        <Html position={[0, 0.1, 0]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 8, color: blown ? "#f87171" : "#94a3b8", fontWeight: 700 }}>
          {blown ? "BLOWN" : "FUSE"}
        </Html>
      </group>
    </group>
  );
}

export function RgbLedMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // 5mm 4-pin common-cathode RGB: clear dome, flange base, four leads (K typically longest)
  const pins = ["r", "g", "b", "k"].map((p) => (part.pins[p] ? vec(part.pins[p]!) : null));
  const present = pins.filter(Boolean) as THREE.Vector3[];
  if (present.length < 2) return null;
  const body = present.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / present.length);
  body.y = BOARD.height + 0.14;
  const st = sim.rgbLeds?.[part.id];
  const br = st?.brightnessR ?? 0;
  const bg = st?.brightnessG ?? 0;
  const bb = st?.brightnessB ?? 0;
  const mix = new THREE.Color(
    Math.max(br, 0.05),
    Math.max(bg, 0.05),
    Math.max(bb, 0.05),
  );
  const lit = br + bg + bb > 0.05;
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pins.map((p, i) =>
        p ? (
          <BentBoardLead
            key={i}
            pin={p}
            body={body}
            color={["#f87171", "#4ade80", "#60a5fa", "#94a3b8"][i]}
            radius={i === 3 ? 0.014 : 0.011}
          />
        ) : null,
      )}
      <group position={body}>
        {/* Clear dome */}
        <mesh position={[0, 0.04, 0]}>
          <sphereGeometry args={[0.085, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial
            color={lit ? mix : selected ? "#93c5fd" : "#e2e8f0"}
            emissive={lit ? mix : "#000000"}
            emissiveIntensity={lit ? 1.5 : 0}
            transparent
            opacity={lit ? 0.85 : 0.55}
            roughness={0.15}
          />
        </mesh>
        {/* Flange / base */}
        <mesh position={[0, -0.01, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.025, 16]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.04, 0]}>
          <cylinderGeometry args={[0.04, 0.045, 0.05, 10]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
        <Html position={[0, 0.14, 0]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 8, color: "#e2e8f0", fontWeight: 700 }}>
          RGB
        </Html>
      </group>
    </group>
  );
}

/**
 * 5161AS/5161BS-style 0.56-inch single-digit 7-segment LED package.
 * Seven molded light-pipes plus an independently illuminated decimal point.
 * Physical ten-pin DIP mapping is maintained by circuit/seven-segment.ts.
 */
const SEGMENT_BAR_GEOMETRY = (() => {
  const outline = new THREE.Shape();
  outline.moveTo(-0.24, 0);
  outline.lineTo(-0.19, 0.041);
  outline.lineTo(0.19, 0.041);
  outline.lineTo(0.24, 0);
  outline.lineTo(0.19, -0.041);
  outline.lineTo(-0.19, -0.041);
  outline.closePath();
  return new THREE.ShapeGeometry(outline);
})();

const SEGMENT_BAR_LOCS: ReadonlyArray<{name: string; x: number; z: number; vertical?: boolean}> = [
  { name: "a", x: 0, z: -0.45 },
  { name: "b", x: 0.27, z: -0.24, vertical: true },
  { name: "c", x: 0.27, z: 0.24, vertical: true },
  { name: "d", x: 0, z: 0.45 },
  { name: "e", x: -0.27, z: 0.24, vertical: true },
  { name: "f", x: -0.27, z: -0.24, vertical: true },
  { name: "g", x: 0, z: 0 },
];

export function SevenSegmentMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // Older saved files used a 9-pin row. Continue to render them; new
  // placements use ten physical pins straddling the breadboard trench.
  const physicalOrder = ["e", "d", "com1", "c", "dp", "b", "a", "com2", "f", "g"];
  const physicalPins = physicalOrder
    .map((name) => ({ name, hole: part.pins[name] }))
    .filter((pin): pin is { name: string; hole: string } => Boolean(pin.hole));
  const anchors = Object.values(part.pins).filter(Boolean).map(vec);
  if (anchors.length < 2) return null;
  const minX = Math.min(...anchors.map((p) => p.x));
  const maxX = Math.max(...anchors.map((p) => p.x));
  const body = new THREE.Vector3(
    (minX + maxX) / 2,
    BOARD.height + 0.22,
    physicalPins.length === 10
      ? (vec(part.pins.e).z + vec(part.pins.g).z) / 2
      : anchors.reduce((sum, p) => sum + p.z, 0) / anchors.length,
  );

  const lit = sim.sevenSegments?.[part.id]?.segments ?? Array(8).fill(false);
  const on = (name: string) => Boolean(lit[name === "dp" ? 7 : "abcdefg".indexOf(name)]);

  return (
    <group onClick={(event) => {
      event.stopPropagation();
      useLab.getState().select(part.id);
    }}>
      {/* Physical lead frames seat into ten independent breadboard holes. */}
      {physicalPins.length === 10 ? physicalPins.map(({ name, hole }) => {
        const pin = vec(hole);
        return (
          <group key={`pin-${name}`}>
            <mesh position={[pin.x, BOARD.height + 0.063, pin.z]} castShadow>
              <boxGeometry args={[0.035, 0.18, 0.03]} />
              <meshStandardMaterial color="#b8c0c9" metalness={0.83} roughness={0.26} />
            </mesh>
          </group>
        );
      }) : anchors.map((pin, index) => (
        <BentBoardLead key={index} pin={pin} body={body} color="#b8c0c9" radius={0.011} />
      ))}
      <group position={body}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[1.06, 0.22, 1.42]} />
          <meshPhysicalMaterial color={selected ? "#223454" : "#181a1f"} roughness={0.52} metalness={0.04} clearcoat={0.3} clearcoatRoughness={0.56} />
        </mesh>
        {/* Dark front glass, slightly inset from the molded package rim. */}
        <mesh position={[0, 0.113, 0]}>
          <boxGeometry args={[0.92, 0.008, 1.27]} />
          <meshPhysicalMaterial color="#1b0808" roughness={0.28} metalness={0.08} clearcoat={0.65} clearcoatRoughness={0.25} />
        </mesh>
        {/* Thin raised glass-retaining rim, with soft specular edge highlights. */}
        {[-0.48, 0.48].map((x) => <mesh key={`bezel-x-${x}`} position={[x, 0.125, 0]} raycast={() => null}>
          <boxGeometry args={[0.018, 0.012, 1.29]} />
          <meshPhysicalMaterial color="#43464b" metalness={0.2} roughness={0.27} clearcoat={0.8} />
        </mesh>)}
        {[-0.65, 0.65].map((z) => <mesh key={`bezel-z-${z}`} position={[0, 0.125, z]} raycast={() => null}>
          <boxGeometry args={[0.96, 0.012, 0.018]} />
          <meshPhysicalMaterial color="#43464b" metalness={0.2} roughness={0.27} clearcoat={0.8} />
        </mesh>)}
        {/* The seven light-pipes are sloped at the ends, not rectangular labels. */}
        {SEGMENT_BAR_LOCS.map((segment) => {
          const active = on(segment.name);
          return (
            <group key={segment.name} position={[segment.x, 0.122, segment.z]} rotation={[0, segment.vertical ? Math.PI / 2 : 0, 0]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} geometry={SEGMENT_BAR_GEOMETRY}>
                <meshStandardMaterial
                  color={active ? "#ff4c35" : "#492121"}
                  emissive={active ? "#fa280c" : "#150404"}
                  emissiveIntensity={active ? 2.2 : 0.02}
                  roughness={0.28}
                  side={THREE.DoubleSide}
                />
              </mesh>
            </group>
          );
        })}
        {/* DP is the eighth individually driven LED, bottom right. */}
        <mesh position={[0.4, 0.125, 0.49]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.055, 24]} />
          <meshStandardMaterial
            color={Boolean(lit[7]) ? "#ff4c35" : "#492121"}
            emissive={Boolean(lit[7]) ? "#fa280c" : "#150404"}
            emissiveIntensity={Boolean(lit[7]) ? 2.2 : 0.02}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}

/**
 * Generic DIP-8 package straddling the breadboard centre channel. Pins are
 * given in package order (1…8): pins 1-4 on the near row, 5-8 returning on
 * the far row, exactly like the DIP-14 logic ICs.
 */
function Dip8Package({
  part,
  pinOrder,
  selected,
  label,
  sublabel,
  led,
}: {
  part: PlacedPart;
  pinOrder: string[];
  selected: boolean;
  label: string;
  sublabel?: string;
  led?: { on: boolean; color: string };
}) {
  const pins = pinOrder.map((p) => (part.pins[p] ? vec(part.pins[p]!) : null));
  if (pins.some((p) => !p)) return null;
  const pkg = pins as THREE.Vector3[];
  const center = pkg[0].clone().add(pkg[3]).multiplyScalar(0.5);
  center.z = (pkg[0].z + pkg[7].z) / 2;
  center.y = BOARD.height + 0.15;
  const along = pkg[3].clone().sub(pkg[0]);
  const length = Math.max(0.5, along.length() + 0.3);
  const angle = Math.atan2(-along.z, along.x);
  const across = Math.max(0.3, Math.abs(pkg[0].z - pkg[7].z) - 0.12);
  const bodyEdge = across / 2;
  const pinMaterial = <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.25} />;
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pkg.map((pin, index) => (
        <group key={`pin-${index}`}>
          <mesh position={[pin.x, BOARD.height + 0.01, pin.z]}>
            <cylinderGeometry args={[0.014, 0.014, 0.32, 6]} />
            {pinMaterial}
          </mesh>
          <mesh
            position={[
              pin.x,
              BOARD.height + 0.09,
              (pin.z + center.z + (pin.z < center.z ? -bodyEdge : bodyEdge)) / 2,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <cylinderGeometry args={[0.014, 0.014, Math.max(0.04, Math.abs(pin.z - center.z) - bodyEdge + 0.08), 6]} />
            {pinMaterial}
          </mesh>
        </group>
      ))}
      <group position={center} rotation={[0, angle, 0]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[length, 0.3, across]} />
          <meshPhysicalMaterial color={selected ? "#17345f" : "#0c1220"} roughness={0.74} metalness={0.03} clearcoat={0.12} clearcoatRoughness={0.88} />
        </mesh>
        <mesh position={[0, 0.152, 0]}>
          <boxGeometry args={[Math.max(0.18, length * 0.56), 0.01, Math.max(0.12, across * 0.45)]} />
          <meshStandardMaterial color="#d6d8dc" roughness={0.72} />
        </mesh>
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(length, 0.3, across)]} />
          <lineBasicMaterial color={selected ? "#60a5fa" : "#475569"} />
        </lineSegments>
        {/* Pin-1 notch */}
        <mesh position={[-length / 2 + 0.08, 0.155, 0]}>
          <torusGeometry args={[0.06, 0.02, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#020617" roughness={0.88} />
        </mesh>
        <mesh position={[-length / 2 + 0.12, 0.151, -across / 2 + 0.08]}>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshStandardMaterial color="#0a0f18" roughness={0.9} />
        </mesh>
        {led && (
          <mesh position={[length / 2 - 0.1, 0.16, across / 2 - 0.08]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial
              color={led.on ? led.color : "#334155"}
              emissive={led.on ? led.color : "#000"}
              emissiveIntensity={led.on ? 1.4 : 0}
            />
          </mesh>
        )}
      </group>
      <Html
        position={[center.x, center.y + 0.16, center.z]}
        center
        distanceFactor={7}
        style={{
          pointerEvents: "none",
          color: "#e2e8f0",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "8px",
          fontWeight: 700,
          whiteSpace: "nowrap",
          textAlign: "center",
          lineHeight: 1.35,
        }}
      >
        <div>{label}</div>
        {sublabel && <div style={{ fontSize: "6px", color: "#94a3b8" }}>{sublabel}</div>}
      </Html>
    </group>
  );
}

export function Timer555Mesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // NE555 DIP-8: 1 GND, 2 TRIG, 3 OUT, 4 RESET, 5 CONT, 6 THRES, 7 DISCH, 8 VCC
  const st = sim.timer555s?.[part.id];
  const sub = st?.powered
    ? `OUT ${st.output ? "HIGH" : "LOW"}${st.mode === "astable" && st.frequencyHz ? ` · ${st.frequencyHz < 10 ? st.frequencyHz.toFixed(2) : st.frequencyHz.toFixed(0)} Hz` : ""}`
    : "8 VCC · 1 GND";
  return (
    <Dip8Package
      part={part}
      pinOrder={["gnd", "trig", "out", "reset", "cont", "thres", "disch", "vcc"]}
      selected={selected}
      label="NE555"
      sublabel={sub}
      led={{ on: Boolean(st?.powered && st.output), color: "#22c55e" }}
    />
  );
}

export function OpampMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // 741-style single op-amp DIP-8: 2 IN−, 3 IN+, 4 V−, 6 OUT, 7 V+
  const st = sim.opamps?.[part.id];
  const sub = st?.powered ? `OUT ${st.output.toFixed(2)} V` : "7 V+ · 4 V−";
  return (
    <Dip8Package
      part={part}
      pinOrder={["nc1", "inn", "inp", "vee", "nc5", "out", "vcc", "nc8"]}
      selected={selected}
      label="OP-AMP"
      sublabel={sub}
      led={{ on: Boolean(st?.powered), color: "#22c55e" }}
    />
  );
}

export function ServoMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // TowerPro SG90-ish: ~22.8 × 12.2 × 28.5 mm blue body, mounting ears, top spline + single horn
  const vcc = part.pins.vcc ? vec(part.pins.vcc) : null;
  const gnd = part.pins.gnd ? vec(part.pins.gnd) : null;
  const sig = part.pins.sig ? vec(part.pins.sig) : null;
  const pins = [vcc, gnd, sig].filter(Boolean) as THREE.Vector3[];
  if (pins.length < 2) return null;
  const body = pins.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / pins.length);
  body.y = BOARD.height + 0.18;
  const powered = Boolean(sim.servos?.[part.id]?.powered);
  const angle = ((sim.servos?.[part.id]?.angle ?? part.props.servoAngle ?? 90) * Math.PI) / 180;
  const blue = selected ? "#3b82f6" : "#1d4ed8";
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pins.map((p, i) => (
        <BentBoardLead key={i} pin={p} body={body} color={["#ef4444", "#292524", "#fbbf24"][i] || "#94a3b8"} />
      ))}
      <group position={body}>
        {/* Main case */}
        <mesh>
          <boxGeometry args={[0.46, 0.24, 0.24]} />
          <meshStandardMaterial color={blue} roughness={0.4} />
        </mesh>
        {/* Mounting ears */}
        <mesh position={[-0.28, 0.02, 0]}>
          <boxGeometry args={[0.1, 0.04, 0.2]} />
          <meshStandardMaterial color={blue} roughness={0.4} />
        </mesh>
        <mesh position={[0.28, 0.02, 0]}>
          <boxGeometry args={[0.1, 0.04, 0.2]} />
          <meshStandardMaterial color={blue} roughness={0.4} />
        </mesh>
        {/* Top gearbox bulge */}
        <mesh position={[0.08, 0.14, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.08, 20]} />
          <meshStandardMaterial color="#1e3a8a" roughness={0.35} />
        </mesh>
        {/* Output shaft */}
        <mesh position={[0.08, 0.2, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
          <meshStandardMaterial color="#e2e8f0" metalness={0.4} />
        </mesh>
        {/* Single-arm horn */}
        <group position={[0.08, 0.23, 0]} rotation={[0, angle - Math.PI / 2, 0]}>
          <mesh position={[0.09, 0, 0]}>
            <boxGeometry args={[0.18, 0.02, 0.05]} />
            <meshStandardMaterial color="#f1f5f9" />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.035, 0.035, 0.025, 12]} />
            <meshStandardMaterial color="#cbd5e1" />
          </mesh>
        </group>
        <mesh position={[-0.16, 0.1, 0.1]}>
          <sphereGeometry args={[0.014, 8, 8]} />
          <meshStandardMaterial color={powered ? "#22c55e" : "#334155"} emissive={powered ? "#16a34a" : "#000"} emissiveIntensity={powered ? 1 : 0} />
        </mesh>
        <Html position={[0, 0.28, 0]} center distanceFactor={5.5} style={{ pointerEvents: "none", fontSize: 8, color: "#e2e8f0", fontWeight: 700 }}>
          SG90
        </Html>
      </group>
    </group>
  );
}

export function OptocouplerMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // PC817-style 4-pin DIP (~6.5×4.6×3.5 mm body)
  const pins = ["la", "lk", "c", "e"]
    .map((p) => (part.pins[p] ? vec(part.pins[p]!) : null))
    .filter(Boolean) as THREE.Vector3[];
  if (pins.length < 2) return null;
  const body = pins.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / pins.length);
  body.y = BOARD.height + 0.14;
  const ledOn = Boolean(sim.optocouplers?.[part.id]?.ledOn);
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pins.map((p, i) => (
        <BentBoardLead key={i} pin={p} body={body} color="#b9c0c8" radius={0.01} />
      ))}
      <group position={body}>
        <mesh>
          <boxGeometry args={[0.32, 0.09, 0.22]} />
          <meshStandardMaterial color={selected ? "#2563eb" : "#0f172a"} roughness={0.4} />
        </mesh>
        {/* Pin-1 notch */}
        <mesh position={[-0.13, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.025, 0.1, 10]} />
          <meshStandardMaterial color="#020617" />
        </mesh>
        <mesh position={[-0.08, 0.06, 0]}>
          <sphereGeometry args={[0.02, 10, 10]} />
          <meshStandardMaterial
            color={ledOn ? "#f87171" : "#334155"}
            emissive={ledOn ? "#ef4444" : "#000"}
            emissiveIntensity={ledOn ? 1.2 : 0}
          />
        </mesh>
        <Html position={[0, 0.12, 0]} center distanceFactor={5.5} style={{ pointerEvents: "none", fontSize: 8, color: "#94a3b8", fontWeight: 700 }}>
          PC817
        </Html>
      </group>
    </group>
  );
}

export function RegulatorMesh({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  // LM7805 TO-220: black molded body + vertical metal heatsink tab with mounting hole; pins IN GND OUT
  const inn = part.pins.in ? vec(part.pins.in) : null;
  const gnd = part.pins.gnd ? vec(part.pins.gnd) : null;
  const out = part.pins.out ? vec(part.pins.out) : null;
  const pins = [inn, gnd, out].filter(Boolean) as THREE.Vector3[];
  if (pins.length < 2) return null;
  const body = pins.reduce((acc, v) => acc.add(v.clone()), new THREE.Vector3()).multiplyScalar(1 / pins.length);
  body.y = BOARD.height + 0.18;
  const powered = Boolean(sim.regulators?.[part.id]?.powered);
  const vout = sim.regulators?.[part.id]?.vout ?? 0;
  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      {pins.map((p, i) => (
        <BentBoardLead key={i} pin={p} body={body} color="#b9c0c8" />
      ))}
      <group position={body}>
        {/* Plastic body */}
        <mesh position={[0, 0.06, 0.02]}>
          <boxGeometry args={[0.28, 0.14, 0.12]} />
          <meshStandardMaterial color={selected ? "#3b82f6" : "#0f172a"} roughness={0.4} />
        </mesh>
        {/* Metal tab standing up behind body */}
        <mesh position={[0, 0.16, -0.02]}>
          <boxGeometry args={[0.28, 0.22, 0.025]} />
          <meshStandardMaterial color="#9ca3af" metalness={0.85} roughness={0.22} />
        </mesh>
        {/* Mounting hole in tab */}
        <mesh position={[0, 0.22, -0.02]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.03, 12]} />
          <meshStandardMaterial color="#1e293b" />
        </mesh>
        <mesh position={[0.1, 0.04, 0.08]}>
          <sphereGeometry args={[0.012, 8, 8]} />
          <meshStandardMaterial
            color={powered ? "#22c55e" : "#334155"}
            emissive={powered ? "#16a34a" : "#000"}
            emissiveIntensity={powered ? 1.1 : 0}
          />
        </mesh>
        <Html position={[0, 0.3, 0]} center distanceFactor={5.5} style={{ pointerEvents: "none", fontSize: 8, color: "#e2e8f0", fontWeight: 700 }}>
          {vout > 0 ? `7805 ${vout.toFixed(1)}V` : "7805"}
        </Html>
      </group>
    </group>
  );
}


function PartSwitchContent({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  switch (part.kind) {
    case "resistor":
      return <ResistorMesh part={part} selected={selected} sim={sim} />;
    case "diode":
      return <DiodeMesh part={part} selected={selected} sim={sim} />;
    case "led":
      return <LedMesh part={part} selected={selected} sim={sim} />;
    case "switch":
      return <SwitchMesh part={part} selected={selected} />;
    case "button":
      return <ButtonMesh part={part} selected={selected} />;
    case "capacitor":
      return <CapacitorMesh part={part} selected={selected} />;
    case "inductor":
      return <InductorMesh part={part} selected={selected} sim={sim} />;
    case "transistor":
      return (
        <TransistorMesh part={part} selected={selected} sim={sim} />
      );
    case "mosfet":
      return <MosfetMesh part={part} selected={selected} sim={sim} />;
    case "zener":
      return <ZenerMesh part={part} selected={selected} sim={sim} />;
    case "ldr":
      return <LdrMesh part={part} selected={selected} sim={sim} />;
    case "thermistor":
      return <ThermistorMesh part={part} selected={selected} sim={sim} />;
    case "fuse":
      return <FuseMesh part={part} selected={selected} sim={sim} />;
    case "rgb-led":
      return <RgbLedMesh part={part} selected={selected} sim={sim} />;
    case "servo":
      return <ServoMesh part={part} selected={selected} sim={sim} />;
    case "seven-segment":
      return <SevenSegmentMesh part={part} selected={selected} sim={sim} />;
    case "timer555":
      return <Timer555Mesh part={part} selected={selected} sim={sim} />;
    case "opamp":
      return <OpampMesh part={part} selected={selected} sim={sim} />;
    case "optocoupler":
      return <OptocouplerMesh part={part} selected={selected} sim={sim} />;
    case "regulator":
      return <RegulatorMesh part={part} selected={selected} sim={sim} />;
    case "thyristor":
      return (
        <ThyristorMesh part={part} selected={selected} sim={sim} />
      );
    case "triac":
      return (
        <TriacMesh part={part} selected={selected} sim={sim} />
      );
    case "diac":
      return (
        <DiacMesh part={part} selected={selected} sim={sim} />
      );
    case "motor":
      return (
        <MotorMesh part={part} selected={selected} sim={sim} />
      );
    case "speaker":
      return (
        <SpeakerMesh part={part} selected={selected} sim={sim} />
      );
    case "buzzer":
      return <BuzzerMesh part={part} selected={selected} sim={sim} />;
    case "relay":
      return <RelayMesh part={part} selected={selected} sim={sim} />;
    case "mcu":
      return (
        <McuMesh
          part={part}
          selected={selected}
          powered={Boolean(sim.mcus?.[part.id]?.powered)}
          burned={Boolean(sim.burned?.[part.id])}
          voltage={sim.mcus?.[part.id]?.supplyVoltage ?? 0}
          electricalState={sim.mcus?.[part.id]?.electricalState}
        />
      );
    case "lcd":
      return (
        <LcdMesh
          part={part}
          selected={selected}
          powered={Boolean(sim.lcds?.[part.id]?.powered)}
          text={sim.lcds?.[part.id]?.text ?? ""}
          burned={Boolean(sim.burned?.[part.id])}
          voltage={sim.lcds?.[part.id]?.supplyVoltage ?? 0}
          electricalState={sim.lcds?.[part.id]?.electricalState}
        />
      );
    case "oled":
      return (
        <OledMesh
          part={part}
          selected={selected}
          powered={Boolean(sim.oledPowered)}
          text={sim.oledText ?? ""}
        />
      );
    case "not":
    case "and":
    case "or":
    case "nand":
    case "nor":
    case "xor":
    case "xnor":
      return <LogicGateMesh part={part} selected={selected} sim={sim} />;
    case "pot":
      return <PotMesh part={part} selected={selected} />;
    default: {
      // Fallback so unknown/new parts still appear on the board
      const pinVals = Object.values(part.pins).filter(Boolean) as string[];
      if (pinVals.length === 0) return null;
      const pts = pinVals.map((id) => vec(id as any));
      const body = pts.reduce((a, p) => a.add(p.clone()), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      body.y = BOARD.height + 0.16;
      return (
        <group
          onClick={(ev) => {
            ev.stopPropagation();
            useLab.getState().select(part.id);
          }}
        >
          {pts.map((p, i) => (
            <BentBoardLead key={i} pin={p} body={body} />
          ))}
          <mesh position={body}>
            <boxGeometry args={[0.28, 0.12, 0.2]} />
            <meshStandardMaterial color={selected ? "#3b82f6" : "#334155"} roughness={0.45} />
          </mesh>
          <Html position={[body.x, body.y + 0.12, body.z]} center distanceFactor={6} style={{ pointerEvents: "none", fontSize: 8, color: "#e2e8f0", fontWeight: 700 }}>
            {part.kind}
          </Html>
        </group>
      );
    }
  }
}

/** Exposes floating annotation labels only while the pointer is over a part. */
export function PartSwitch({
  part,
  selected,
  sim,
}: {
  part: PlacedPart;
  selected: boolean;
  sim: SimResult;
}) {
  const [hovered, setHovered] = useState(false);
  const tool = useLab((s) => s.tool);

  useEffect(() => { setHovered(false); }, [tool]);
  useEffect(() => {
    if (!hovered) return;
    const dismiss = () => setHovered(false);
    const dismissOutside = (event: PointerEvent) => {
      const canvas = document.querySelector<HTMLCanvasElement>(".ece-circuit-lab canvas");
      if (!canvas || !canvas.contains(event.target as Node)) dismiss();
    };
    window.addEventListener("pointermove", dismissOutside, { passive: true });
    window.addEventListener("blur", dismiss);
    return () => {
      window.removeEventListener("pointermove", dismissOutside);
      window.removeEventListener("blur", dismiss);
    };
  }, [hovered]);

  return (
    <PartLabelHoverContext.Provider value={hovered}>
      <group
        onPointerOver={() => setHovered(true)}
        onPointerMove={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <PartSwitchContent part={part} selected={selected} sim={sim} />
      </group>
    </PartLabelHoverContext.Provider>
  );
}

function PowerStatusLight({
  powered,
  strength,
}: {
  powered: boolean;
  strength: number;
}) {
  const material = useRef<THREE.MeshStandardMaterial>(null);
  const lens = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const pulse = powered ? 0.82 + Math.sin(clock.getElapsedTime() * 3.6) * 0.18 : 0;
    const energy = pulse * (0.28 + strength * 0.72);
    if (material.current) material.current.emissiveIntensity = energy * 2.4;
    if (lens.current) lens.current.scale.setScalar(0.92 + energy * 0.12);
  });

  return (
    <mesh ref={lens} position={[0.7, 0.84, 0.42]}>
      <sphereGeometry args={[0.045, 12, 12]} />
      <meshStandardMaterial
        ref={material}
        color={powered ? "#4ade80" : "#334155"}
        emissive={powered ? "#22c55e" : "#000000"}
        emissiveIntensity={0}
        roughness={0.2}
      />
    </mesh>
  );
}

export function PowerSupply() {
  const voltage = useLab((s) => s.psuVoltage);
  const powerOn = useLab((s) => s.powerOn);
  const pos = useLab((s) => s.psuPositive);
  const neg = useLab((s) => s.psuNegative);
  const boardId = useLab((s) => s.boardId);
  const current = useLab((s) => Math.abs(s.sim.supplyCurrent));
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 96;
    const ctx = c.getContext("2d")!;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return { c, ctx, t };
  }, []);

  useEffect(() => {
    const { c, ctx, t } = tex;
    ctx.fillStyle = "#140404";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = powerOn ? "#ef4444" : "#4a1515";
    ctx.font = "700 56px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    ctx.fillText(powerOn ? voltage.toFixed(1) : "- -", 128, 64);
    t.needsUpdate = true;
  }, [voltage, powerOn, tex]);

  // Sit fully outside the left edge of whatever board is active
  // (board is centered at x=0, width = BOARD.width).
  const bodyW = 1.35;
  const gap = 0.55;
  const psuX = useMemo(
    () => -(BOARD.width / 2) - bodyW / 2 - gap,
    // boardId forces recompute when preset changes (BOARD is mutated in place)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [boardId, BOARD.width],
  );
  // Jacks on the right face of the PSU, facing the board
  const jackRed = useMemo(
    () => new THREE.Vector3(psuX + bodyW / 2 + 0.02, 0.52, -0.35),
    [psuX],
  );
  const jackBlk = useMemo(
    () => new THREE.Vector3(psuX + bodyW / 2 + 0.02, 0.52, 0.25),
    [psuX],
  );
  const destPos = pos ? vec(pos) : jackRed.clone();
  const destNeg = neg ? vec(neg) : jackBlk.clone();
  const flowing = powerOn && current > 0.00001;
  const flowStrength = THREE.MathUtils.clamp(current / 0.015, 0.18, 1);

  return (
    <>
      <group position={[psuX, 0, 0]}>
        {/* Main steel enclosure */}
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
          <boxGeometry args={[bodyW, 1.24, 1.7]} />
          <meshPhysicalMaterial color="#d7dbe0" roughness={0.52} metalness={0.28} clearcoat={0.16} clearcoatRoughness={0.48} />
        </mesh>
        {/* Dark front control panel */}
        <mesh position={[bodyW / 2 + 0.008, 0.62, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[1.42, 1.05, 0.03]} />
          <meshStandardMaterial color="#202733" roughness={0.62} metalness={0.08} />
        </mesh>
        {/* Top vent strip */}
        {[-0.38,-0.27,-0.16,-0.05,0.06,0.17,0.28].map((z)=> (
          <mesh key={`vent-${z}`} position={[0, 1.245, z]}>
            <boxGeometry args={[0.72, 0.012, 0.055]} />
            <meshStandardMaterial color="#76808d" metalness={0.38} roughness={0.5} />
          </mesh>
        ))}
        {/* Rubber feet */}
        {[-0.44,0.44].flatMap((x)=>[-0.58,0.58].map((z,i)=>(
          <mesh key={`${x}-${z}-${i}`} position={[x, 0.03, z]}>
            <cylinderGeometry args={[0.06,0.06,0.05,16]} />
            <meshStandardMaterial color="#1b1f27" roughness={0.92} />
          </mesh>
        )))}
        {/* Display bezel */}
        <mesh position={[bodyW / 2 + 0.02, 0.86, -0.18]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <boxGeometry args={[0.98, 0.42, 0.06]} />
          <meshStandardMaterial color="#0b0f16" roughness={0.42} metalness={0.12} />
        </mesh>
        {/* Display faces the board (+X) */}
        <mesh position={[bodyW / 2 + 0.053, 0.86, -0.18]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.88, 0.30]} />
          <meshStandardMaterial
            map={tex.t}
            emissive="#481010"
            emissiveIntensity={powerOn ? 0.5 : 0.08}
          />
        </mesh>
        {/* Voltage knob */}
        <group position={[bodyW / 2 + 0.03, 0.47, 0.56]} rotation={[0, Math.PI/2, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.14,0.14,0.09,24]} />
            <meshStandardMaterial color="#10151d" roughness={0.36} metalness={0.14} />
          </mesh>
          <mesh position={[0.046,0.07,0]} rotation={[0,0,0.55]}>
            <boxGeometry args={[0.018,0.035,0.11]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.72} roughness={0.22} />
          </mesh>
        </group>
        {/* Binding posts */}
        <group position={[bodyW / 2, 0.49, -0.35]}>
          <mesh>
            <cylinderGeometry args={[0.085,0.085,0.05,18]} />
            <meshStandardMaterial color="#7f1d1d" metalness={0.22} roughness={0.48} />
          </mesh>
          <mesh position={[0.04,0,0]} rotation={[0,0,Math.PI/2]}>
            <cylinderGeometry args={[0.036,0.036,0.08,18]} />
            <meshStandardMaterial color="#d14a41" metalness={0.18} roughness={0.32} />
          </mesh>
        </group>
        <group position={[bodyW / 2, 0.49, 0.25]}>
          <mesh>
            <cylinderGeometry args={[0.085,0.085,0.05,18]} />
            <meshStandardMaterial color="#0f1720" metalness={0.22} roughness={0.5} />
          </mesh>
          <mesh position={[0.04,0,0]} rotation={[0,0,Math.PI/2]}>
            <cylinderGeometry args={[0.036,0.036,0.08,18]} />
            <meshStandardMaterial color="#111827" metalness={0.2} roughness={0.28} />
          </mesh>
        </group>
        {/* Panel legends */}
        <Html position={[bodyW / 2 + 0.07, 1.1, 0.53]} transform distanceFactor={9} style={{pointerEvents:'none', color:'#cbd5e1', fontSize:'8px', fontFamily:'IBM Plex Mono, monospace', fontWeight:700, whiteSpace:'nowrap'}}>VAR DC</Html>
        <Html position={[bodyW / 2 + 0.07, 0.71, -0.35]} transform distanceFactor={9} style={{pointerEvents:'none', color:'#fca5a5', fontSize:'7px', fontFamily:'IBM Plex Mono, monospace', fontWeight:700, whiteSpace:'nowrap'}}>+</Html>
        <Html position={[bodyW / 2 + 0.07, 0.71, 0.25]} transform distanceFactor={9} style={{pointerEvents:'none', color:'#cbd5e1', fontSize:'7px', fontFamily:'IBM Plex Mono, monospace', fontWeight:700, whiteSpace:'nowrap'}}>−</Html>
        <PowerStatusLight powered={powerOn} strength={flowStrength} />
      </group>
      <TubeWire a={jackRed} b={destPos} color="#c2413b" lift={1.1} radius={0.028} style="arc" />
      <TubeWire a={jackBlk} b={destNeg} color="#1a1d23" lift={1.1} radius={0.028} style="arc" />
      <CurrentFlow a={jackRed} b={destPos} active={flowing} color="#fff1f2" strength={flowStrength} />
      <CurrentFlow a={jackBlk} b={destNeg} active={flowing} color="#dbeafe" strength={flowStrength} />
    </>
  );
}

export function BreadboardBody() {
  const wellRef = useRef<THREE.InstancedMesh>(null);
  const rimRef = useRef<THREE.InstancedMesh>(null);
  const contactRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clickHole = useLab((s) => s.clickHole);
  const setHover = useLab((s) => s.setHover);

  const boardId = useLab((s) => s.boardId);
  const holes = useMemo(() => getAllHoles(), [boardId]);
  useLayoutEffect(() => {
    if (!wellRef.current || !rimRef.current || !contactRef.current) return;

    // Terminal strip top ≈ BOARD.height + 0.07 — wells recess into it
    const stripTop = BOARD.height + 0.08;
    const wellDepth = 0.055;

    holes.forEach((id, i) => {
      const [x, , z] = holePosition(id);

      // Dark cylindrical cavity (mostly below the strip surface)
      dummy.position.set(x, stripTop - wellDepth / 2 + 0.003, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wellRef.current!.setMatrixAt(i, dummy.matrix);

      // Thin metal rim flush with the strip top
      dummy.position.set(x, stripTop + 0.0015, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      rimRef.current!.setMatrixAt(i, dummy.matrix);

      // Two narrow metallic leaves just below the molded plastic opening.
      // The actual hole remains a selectable volume, not a raised peg.
      dummy.position.set(x, stripTop - 0.009, z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.updateMatrix();
      contactRef.current!.setMatrixAt(i, dummy.matrix);
    });

    wellRef.current.instanceMatrix.needsUpdate = true;
    wellRef.current.count = holes.length;
    rimRef.current.instanceMatrix.needsUpdate = true;
    rimRef.current.count = holes.length;
    contactRef.current.instanceMatrix.needsUpdate = true;
    contactRef.current.count = holes.length;
  }, [dummy, holes]);

  const w = BOARD.width;
  const d = BOARD.depth;
  const railLen = Math.max(0.4, w - 0.3);
  // Width of each raised terminal block along the row direction. The
  // A standard board has five terminal rows on each side. E/F are three
  // 2.54 mm pitches apart, matching a DIP package's 7.62 mm row spacing.
  const terminalDepth = BOARD.presetId === "full-1660" ? 3.15 : 1.4;
  const terminalCenters =
    BOARD.presetId === "full-1660"
      ? [-4.23, -1.43, 1.43, 4.23]
      : [-0.8, 0.8];
  const railCenters =
    BOARD.presetId === "full-1660"
      ? [-5.35, -5.05, -2.35, -2.05, 2.05, 2.35, 5.05, 5.35]
      : [-2.2, -1.9, 1.9, 2.2];

  return (
    <group key={boardId}>
      <mesh position={[0, BOARD.y, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, BOARD.height, d]} />
        <meshPhysicalMaterial
          color="#f1ede4"
          roughness={0.7}
          metalness={0.02}
          clearcoat={0.08}
          clearcoatRoughness={0.76}
        />
      </mesh>
      <mesh position={[0, BOARD.height + 0.003, 0]} receiveShadow>
        <boxGeometry args={[w - 0.03, 0.006, d - 0.03]} />
        <meshPhysicalMaterial color="#faf7f1" roughness={0.52} metalness={0} clearcoat={0.18} clearcoatRoughness={0.65} />
      </mesh>
      {/* subtle side lip */}
      <mesh position={[0, BOARD.y + 0.005, 0]} receiveShadow>
        <boxGeometry args={[w - 0.14, BOARD.height + 0.01, d - 0.14]} />
        <meshStandardMaterial color="#e0dbd1" roughness={0.88} />
      </mesh>
      {/* Raised terminal strips and recessed channels, matching a real solderless board. */}
      {terminalCenters.map((z) => (
        <mesh key={`terminal-strip-${z}`} position={[0, BOARD.height + 0.035, z]} receiveShadow>
          <boxGeometry args={[Math.max(0.4, w - 0.22), 0.07, terminalDepth]} />
          <meshStandardMaterial
            color="#e6e1d6"
            roughness={0.86}
            metalness={0}
          />
        </mesh>
      ))}
      {BOARD.hasRails &&
        railCenters.map((z, index) => (
          <mesh key={`rail-channel-${z}`} position={[0, BOARD.height + 0.025, z]} receiveShadow>
            <boxGeometry args={[railLen, 0.05, 0.19]} />
            <meshPhysicalMaterial
              color="#ebe8e1"
              roughness={0.82}
              metalness={0.015}
              clearcoat={0.1}
            />
          </mesh>
        ))}
      {BOARD.hasRails &&
        (BOARD.presetId === "full-1660" ? (
          <group>
            {FULL_RAIL_Z.map((z, i) => (
              <group key={`full-rail-${i}`}>
                <mesh position={[0, BOARD.height + 0.005, z]}>
                  <boxGeometry args={[railLen, 0.012, 0.06]} />
                  <meshPhysicalMaterial
                    color={i % 2 === 0 ? "#c2413b" : "#1d4ed8"}
                    roughness={0.34}
                    metalness={0.06}
                    clearcoat={0.22}
                  />
                </mesh>
                <Html
                  position={[-w / 2 + 0.35, BOARD.height + 0.13, z]}
                  center
                  distanceFactor={8}
                  style={{
                    pointerEvents: "none",
                    color: i % 2 === 0 ? "#fecaca" : "#bfdbfe",
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: "7px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {i % 2 === 0 ? "+VCC" : "GND"}
                </Html>
              </group>
            ))}
          </group>
        ) : (
          <>
            {[
              { z: -2.2, label: "+VCC", railColor: "#c2413b", textColor: "#fecaca" },
              { z: -1.9, label: "GND", railColor: "#1d4ed8", textColor: "#bfdbfe" },
              { z: 1.9, label: "GND", railColor: "#1d4ed8", textColor: "#bfdbfe" },
              { z: 2.2, label: "+VCC", railColor: "#c2413b", textColor: "#fecaca" },
            ].map(({ z, label, railColor, textColor }) => (
              <group key={`standard-rail-${z}`}>
                <mesh position={[0, BOARD.height + 0.07, Number(z)]}>
                  <boxGeometry args={[railLen, 0.012, 0.06]} />
                  <meshPhysicalMaterial color={railColor} roughness={0.34} metalness={0.06} clearcoat={0.22} />
                </mesh>
                <Html
                  position={[-w / 2 + 0.35, BOARD.height + 0.15, Number(z)]}
                  center
                  distanceFactor={8}
                  style={{
                    pointerEvents: "none",
                    color: textColor,
                    fontFamily: "IBM Plex Mono, monospace",
                    fontSize: "7px",
                    fontWeight: 800,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Html>
              </group>
            ))}
          </>
        ))}
      {/* Center trench(es) between terminal strips */}
      {BOARD.presetId === "full-1660" ? (
        <>
          <mesh position={[0, 0.22, -2.83]}>
            <boxGeometry args={[Math.max(0.5, w - 0.15), 0.08, 0.42]} />
            <meshStandardMaterial color="#e7e2d8" />
          </mesh>
          <mesh position={[0, 0.22, 2.83]}>
            <boxGeometry args={[Math.max(0.5, w - 0.15), 0.08, 0.42]} />
            <meshStandardMaterial color="#e7e2d8" />
          </mesh>
        </>
      ) : (
        <mesh position={[0, BOARD.height + 0.01, 0]}>
          <boxGeometry args={[Math.max(0.5, w - 0.15), 0.05, 0.28]} />
          <meshPhysicalMaterial color="#d9d4ca" roughness={0.86} metalness={0.01} clearcoat={0.04} />
        </mesh>
      )}
      {/* Faint printed divider guides */}
      <mesh position={[0, BOARD.height + 0.006, BOARD.presetId === "full-1660" ? -2.83 : 0]}>
        <boxGeometry args={[Math.max(0.5, w - 0.22), 0.002, 0.012]} />
        <meshBasicMaterial color="#b6b0a5" transparent opacity={0.42} />
      </mesh>
      {BOARD.presetId === "full-1660" && (
        <mesh position={[0, BOARD.height + 0.006, 2.83]}>
          <boxGeometry args={[Math.max(0.5, w - 0.22), 0.002, 0.012]} />
          <meshBasicMaterial color="#b6b0a5" transparent opacity={0.42} />
        </mesh>
      )}
      <BreadboardSilkscreen boardId={boardId} />
      {/* Recessed contact wells — actual holes, not raised black pegs */}
      <instancedMesh
        key={`wells-${boardId}-${holes.length}`}
        ref={wellRef}
        args={[undefined, undefined, holes.length]}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0 || e.instanceId == null) return;
          const lab = useLab.getState();
          if (lab.paletteDragging) return;
          clickHole(holes[e.instanceId]);
        }}
        onPointerMove={(e) => {
          if (e.instanceId == null) return;
          if (useLab.getState().paletteDragging) return;
          setHover(holes[e.instanceId]);
        }}
        onPointerOut={() => {
          if (useLab.getState().paletteDragging) return;
          setHover(null);
        }}
      >
        {/* Tapered cavity: slightly wider at the top opening */}
        <cylinderGeometry args={[0.03, 0.024, 0.055, 12]} />
        <meshStandardMaterial color="#0c0f14" roughness={0.9} metalness={0.05} />
      </instancedMesh>
      {/* Contact rim around each hole opening */}
      <instancedMesh
        key={`rims-${boardId}-${holes.length}`}
        ref={rimRef}
        args={[undefined, undefined, holes.length]}
        raycast={() => {}}
      >
        <ringGeometry args={[0.028, 0.038, 16]} />
        <meshStandardMaterial color="#5f6265" roughness={0.82} metalness={0.08} />
      </instancedMesh>
      {/* Socket springs are set below the black cavities. One instanced draw
          call for the entire board; still interactive via the well mesh. */}
      <instancedMesh
        key={`contacts-${boardId}-${holes.length}`}
        ref={contactRef}
        args={[undefined, undefined, holes.length]}
        raycast={() => null}
      >
        <ringGeometry args={[0.014, 0.019, 10]} />
        <meshStandardMaterial color="#b7a88b" roughness={0.35} metalness={0.88} side={THREE.DoubleSide} />
      </instancedMesh>
      {/* Small end caps make the long board read as a manufactured assembly. */}
      <mesh position={[-w / 2 + 0.08, BOARD.y + 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.14, BOARD.height + 0.03, d - 0.18]} />
        <meshStandardMaterial color="#e7e2d8" roughness={0.85} />
      </mesh>
      <mesh position={[w / 2 - 0.08, BOARD.y + 0.015, 0]} receiveShadow>
        <boxGeometry args={[0.14, BOARD.height + 0.03, d - 0.18]} />
        <meshStandardMaterial color="#e7e2d8" roughness={0.85} />
      </mesh>
    </group>
  );
}
