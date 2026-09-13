import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { Html } from "@react-three/drei";

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
  radius = 0.022,
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
    <mesh geometry={geom} castShadow>
      <meshStandardMaterial color={color} roughness={0.42} metalness={0.08} />
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

function CurrentFlow({
  a,
  b,
  active,
  color,
  strength = 1,
}: {
  a: THREE.Vector3;
  b: THREE.Vector3;
  active: boolean;
  color: string;
  strength?: number;
}) {
  const particles = useRef<THREE.InstancedMesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const point = useMemo(() => new THREE.Vector3(), []);
  const flow = useRef(0);
  const particleCount = 8;

  // Match TubeWire flat Manhattan path so particles ride on the wire.
  const pathPoints = useMemo(() => {
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


export function JumperWire({
  wire,
  selected,
}: {
  wire: Wire;
  selected: boolean;
}) {
  const a = useMemo(
    () => vec(wire.a),
    [wire.a],
  );

  const b = useMemo(
    () => vec(wire.b),
    [wire.b],
  );

  const powerOn = useLab(
    (s) => s.powerOn,
  );

  const current = useLab(
    (s) =>
      Math.abs(
        s.sim.supplyCurrent,
      ),
  );

  const flowing =
    powerOn &&
    current > 0.00001;

  // Around 15 mA reads as a full-strength educational "current flow"
  // animation; tiny leakage currents are still visible, just slower.
  const flowStrength = THREE.MathUtils.clamp(current / 0.015, 0.18, 1);

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab
          .getState()
          .select(wire.id);
      }}
    >
      <TubeWire
        a={a}
        b={b}
        color={
          selected
            ? lightenColor(WIRE_HEX[wire.color], 0.35)
            : WIRE_HEX[wire.color]
        }
      />

      <CurrentFlow
        a={a}
        b={b}
        active={flowing}
        color={
          wire.color === "black"
            ? "#ffffff"
            : "#fff7ed"
        }
        strength={flowStrength}
      />
    </group>
  );
}

function Lead({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { pos, quat, len } = useMemo(() => {
    const dir = to.clone().sub(from);
    const len = dir.length();
    const pos = from.clone().lerp(to, 0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      dir.clone().normalize(),
    );
    return { pos, quat, len };
  }, [from.x, from.y, from.z, to.x, to.y, to.z]);
  return (
    <mesh position={pos} quaternion={quat}>
      <cylinderGeometry args={[0.012, 0.012, len, 8]} />
      <meshStandardMaterial color="#c4c8ce" metalness={0.7} roughness={0.25} />
    </mesh>
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

  useFrame(({ clock }, delta) => {
    energy.current = THREE.MathUtils.damp(
      energy.current,
      active ? brightness : 0,
      10,
      delta,
    );

    const shimmer = 0.94 + Math.sin(clock.getElapsedTime() * 6.4) * 0.06;
    const glow = energy.current * shimmer;

    if (halo.current) {
      const scale = 0.75 + glow * 0.85;
      halo.current.scale.setScalar(scale);
    }
    if (haloMaterial.current) {
      haloMaterial.current.opacity = glow * 0.18;
    }
    if (light.current) {
      light.current.intensity = glow * 8;
    }
  });

  return (
    <group position={position}>
      <pointLight ref={light} color={color} distance={2.5} decay={2} />
      <mesh ref={halo}>
        <sphereGeometry args={[0.22, 18, 18]} />
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
  // The resistor lies horizontally across the breadboard.
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

  // Size relative to the distance between the two breadboard
  // holes instead of using a completely fixed resistor size.
  const bodyLength = Math.min(
    0.34,
    Math.max(0.18, pinDistance * 0.52),
  );

  const bodyRadius = 0.052;

  // Height of the resistor above the breadboard.
  const bodyY = BOARD.height + 0.16;

  // Center of resistor body.
  const body = a.clone().lerp(b, 0.5);
  body.y = bodyY;

  // ---------------------------------------------------------
  // BODY ROTATION
  // ---------------------------------------------------------
  //
  // CapsuleGeometry is aligned along LOCAL Y.
  // Rotate local Y so it follows pin 1 -> pin 2.
  //

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
  //
  // Each lead looks like:
  //
  //             resistor
  //       ╭────────────────╮
  // ──────╯                ╰──────
  //       │                    │
  //       │                    │
  //       ●                    ●
  //
  // The vertical section goes into the breadboard hole.
  //

  const leadRadius = 0.012;
  const leadHeight = bodyY - BOARD.height;

  function makeBentLead(
    pin: THREE.Vector3,
    bodyEnd: THREE.Vector3,
  ) {
    // Point directly underneath the resistor body end.
    const verticalTop = new THREE.Vector3(
      pin.x,
      bodyY,
      pin.z,
    );

    // Slightly inside the body before the lead enters it.
    const horizontalEnd = bodyEnd.clone();

    // Make a smooth 90-degree bend.
    const bendPoint = new THREE.Vector3(
      pin.x,
      BOARD.height + 0.035,
      pin.z,
    );

    const curve = new THREE.CatmullRomCurve3([
      pin.clone(),
      bendPoint.clone(),
      verticalTop.clone(),
      horizontalEnd.clone(),
    ]);

    curve.curveType = "centripetal";
    curve.tension = 0.15;

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

  // Keep the bands centered around the body.
  const bandSpacing = Math.min(
    0.055,
    bodyLength * 0.18,
  );

  const bandStart =
    -((bands.length - 1) * bandSpacing) / 2;

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <group
      onClick={(e) => {
        e.stopPropagation();

        useLab.getState().select(part.id);
      }}
    >
      {/* =====================================================
          METAL LEAD — PIN 1
      ===================================================== */}

      <mesh
        castShadow
        receiveShadow
      >
        <tubeGeometry
          args={[
            leadCurveA,
            16,
            leadRadius,
            8,
            false,
          ]}
        />

        <meshStandardMaterial
          color="#666666"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* =====================================================
          METAL LEAD — PIN 2
      ===================================================== */}

      <mesh
        castShadow
        receiveShadow
      >
        <tubeGeometry
          args={[
            leadCurveB,
            16,
            leadRadius,
            8,
            false,
          ]}
        />

        <meshStandardMaterial
          color="#666666"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* =====================================================
          RESISTOR BODY
      ===================================================== */}

      <group
        position={body}
        quaternion={quat}
      >
        <mesh
          castShadow
          receiveShadow
        >
          <capsuleGeometry
            args={[
              bodyRadius,
              bodyLength,
              8,
              16,
            ]}
          />

          <meshStandardMaterial
            color={
              selected
                ? "#f4d58d"
                : "#d6b47c"
            }
            roughness={0.48}
            metalness={0}
          />
        </mesh>

        {/* =================================================
            COLOR BANDS
        ================================================= */}

        {bands.map((c, i) => (
          <mesh
            key={`${c}-${i}`}
            position={[
              0,
              bandStart + i * bandSpacing,
              0,
            ]}
            castShadow
          >
            <cylinderGeometry
              args={[
                bodyRadius + 0.003,
                bodyRadius + 0.003,
                0.019,
                16,
              ]}
            />

            <meshStandardMaterial
              color={c}
              roughness={0.35}
              metalness={0}
            />
          </mesh>
        ))}

        {/* =================================================
            SMALL END CAPS
        ================================================= */}

        <mesh
          position={[
            0,
            -bodyLength / 2,
            0,
          ]}
          castShadow
        >
          <sphereGeometry
            args={[
              bodyRadius * 0.96,
              16,
              12,
            ]}
          />

          <meshStandardMaterial
            color={
              selected
                ? "#f4d58d"
                : "#d6b47c"
            }
            roughness={0.48}
          />
        </mesh>

        <mesh
          position={[
            0,
            bodyLength / 2,
            0,
          ]}
          castShadow
        >
          <sphereGeometry
            args={[
              bodyRadius * 0.96,
              16,
              12,
            ]}
          />

          <meshStandardMaterial
            color={
              selected
                ? "#f4d58d"
                : "#d6b47c"
            }
            roughness={0.48}
          />
        </mesh>
      </group>

      {/* =====================================================
          PIN LABELS
      ===================================================== */}
      <SmokePuffs
        position={a.clone().lerp(b, 0.5).setY(BOARD.height + 0.2)}
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


  // ---------------------------------------------------------
  // PINS
  // ---------------------------------------------------------

  const a = vec(part.pins.a);
  const k = vec(part.pins.k);

  // Center of the LED between the two breadboard holes.
  const body = a.clone().lerp(k, 0.5);

  // LED stands vertically above the breadboard.
  const baseY = BOARD.height + 0.045;
  const bodyY = BOARD.height + 0.145;

  body.y = bodyY;

  // ---------------------------------------------------------
  // LED COLOR
  // ---------------------------------------------------------

  const color =
    LED_HEX[
      part.props.ledColor ?? "red"
    ] ?? "#ef4444";

  // ---------------------------------------------------------
  // SIMULATION STATE
  // ---------------------------------------------------------

  const state = sim.leds[part.id];

  const brightness =
    state?.brightness ?? 0;

  const isOn =
    Boolean(state?.on);

  const isBurned =
    Boolean(state?.overcurrent) ||
    Boolean(sim.burned?.[part.id]);

  const displayColor = isBurned ? "#1c1917" : color;
  const glowColor = isBurned ? "#ea580c" : color;

  // ---------------------------------------------------------
  // MATERIALS
  // ---------------------------------------------------------

  const lensMaterial =
    useRef<THREE.MeshStandardMaterial>(null);

  const dieMaterial =
    useRef<THREE.MeshStandardMaterial>(null);

  const lensEnergy =
    useRef(0);

  // ---------------------------------------------------------
  // LED LIGHT ANIMATION
  // ---------------------------------------------------------

  useFrame(({ clock }, delta) => {
    lensEnergy.current =
      THREE.MathUtils.damp(
        lensEnergy.current,
        isOn ? brightness : 0,
        10,
        delta,
      );

    const energy =
      lensEnergy.current;

    if (lensMaterial.current) {
      const shimmer =
        0.97 +
        Math.sin(
          clock.getElapsedTime() * 6,
        ) * 0.03;

      lensMaterial.current.emissiveIntensity =
        0.08 +
        energy * 3.8 * shimmer;
    }

    if (dieMaterial.current) {
      dieMaterial.current.emissiveIntensity =
        0.15 +
        energy * 5;
    }
  });

  // ---------------------------------------------------------
  // DIMENSIONS
  // ---------------------------------------------------------

  const baseRadius = 0.063;
  const baseHeight = 0.045;

  const domeRadius = 0.078;
  const domeHeight = 0.105;

  const leadRadius = 0.009;

  // ---------------------------------------------------------
  // LEAD HEIGHT
  // ---------------------------------------------------------

  const leadTopY =
    BOARD.height + 0.075;

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

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

      <mesh
        position={[
          a.x,
          (a.y + leadTopY) / 2,
          a.z,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            leadRadius,
            leadRadius,
            Math.max(
              0.01,
              leadTopY - a.y,
            ),
            10,
          ]}
        />

        <meshStandardMaterial
          color="#b8bcc2"
          metalness={0.9}
          roughness={0.22}
        />
      </mesh>

      {/* =====================================================
          CATHODE LEAD
      ===================================================== */}

      <mesh
        position={[
          k.x,
          (k.y + leadTopY) / 2,
          k.z,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            leadRadius,
            leadRadius,
            Math.max(
              0.01,
              leadTopY - k.y,
            ),
            10,
          ]}
        />

        <meshStandardMaterial
          color="#aeb3b8"
          metalness={0.9}
          roughness={0.22}
        />
      </mesh>

      {/* =====================================================
          LED BASE / COLLAR
      ===================================================== */}

      <mesh
        position={[
          body.x,
          baseY,
          body.z,
        ]}
        scale={
          selected
            ? [1.1, 1.1, 1.1]
            : [1, 1, 1]
        }
        castShadow
        receiveShadow
      >
        <cylinderGeometry
          args={[
            baseRadius,
            baseRadius * 1.05,
            baseHeight,
            24,
          ]}
        />

        <meshStandardMaterial
          color="#e5e7eb"
          metalness={0.2}
          roughness={0.3}
        />
      </mesh>

      {/* =====================================================
          LED COLLAR
      ===================================================== */}

      <mesh
        position={[
          body.x,
          baseY + 0.025,
          body.z,
        ]}
        castShadow
      >
        <cylinderGeometry
          args={[
            0.053,
            0.058,
            0.032,
            24,
          ]}
        />

        <meshStandardMaterial
          color="#f1f5f9"
          metalness={0.12}
          roughness={0.28}
        />
      </mesh>

      {/* =====================================================
          COLORED LED DOME
      ===================================================== */}

      <mesh
        position={[
          body.x,
          baseY +
            baseHeight * 0.55 +
            domeHeight * 0.47,
          body.z,
        ]}
        scale={
          selected
            ? [1.08, 1.08, 1.08]
            : [1, 1, 1]
        }
        castShadow
      >
        <sphereGeometry
          args={[
            domeRadius,
            32,
            24,
            0,
            Math.PI * 2,
            0,
            Math.PI / 2,
          ]}
        />

        <meshStandardMaterial
          ref={lensMaterial}
          color={displayColor}
          emissive={isBurned ? "#ea580c" : color}
          emissiveIntensity={0.08}
          roughness={0.18}
          metalness={0}
          transparent
          opacity={0.78}
          depthWrite={true}
        />
      </mesh>

      {/* =====================================================
          INNER LED DIE
      ===================================================== */}

      <mesh
        position={[
          body.x,
          baseY + 0.075,
          body.z,
        ]}
      >
        <boxGeometry
          args={[
            0.018,
            0.024,
            0.018,
          ]}
        />

        <meshStandardMaterial
          ref={dieMaterial}
          color="#fff7d6"
          emissive={isBurned ? "#ea580c" : color}
          emissiveIntensity={0.15}
          metalness={0.1}
          roughness={0.2}
        />
      </mesh>

      {/* =====================================================
          INTERNAL REFLECTOR
      ===================================================== */}

      <mesh
        position={[
          body.x,
          baseY + 0.058,
          body.z,
        ]}
      >
        <cylinderGeometry
          args={[
            0.034,
            0.023,
            0.012,
            20,
          ]}
        />

        <meshStandardMaterial
          color="#f8fafc"
          metalness={0.8}
          roughness={0.18}
        />
      </mesh>

      {/* =====================================================
          LED GLOW
      ===================================================== */}

      <LedAura
        position={body}
        color={glowColor}
        active={isOn || isBurned}
        brightness={isBurned ? 1 : brightness}
      />

      <SmokePuffs
        position={new THREE.Vector3(body.x, body.y + 0.05, body.z)}
        active={isBurned}
      />

      {/* =====================================================
          HOVER LABELS
      ===================================================== */}


      {/* =====================================================
          COMPONENT NAME
      ===================================================== */}

      <Html
        position={[
          body.x,
          body.y + 0.24,
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
          {part.props.label || "LED"}
        </div>
      </Html>
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

  const bodyLength = Math.min(
    0.50,
    Math.max(
      0.28,
      pinDistance * 0.60,
    ),
  );

  const bodyRadius = 0.075;

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
            color={
              selected
                ? "#242424"
                : "#050505"
            }
            metalness={0.35}
            roughness={0.28}
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
              bodyRadius * 1.005,
              bodyRadius * 1.005,
              0.018,
              32,
              1,
            ]}
          />

          {/* THIS MUST BE BLACK */}

          <meshStandardMaterial
            color="#020202"
            metalness={0.35}
            roughness={0.28}
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


export function SwitchMesh({
  part,
  selected,
}: {
  part: PlacedPart;
  selected: boolean;
}) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);

  // =========================================================
  // CENTER
  // =========================================================

  const body = a.clone().lerp(b, 0.5);

  body.y = BOARD.height + 0.10;


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

  const pinPositions = [
    // FRONT / TOP ROW
    [-pinX, -0.12, -pinZ],
    [0,     -0.12, -pinZ],
    [pinX,  -0.12, -pinZ],

    // BACK / BOTTOM ROW
    [-pinX, -0.12, pinZ],
    [0,     -0.12, pinZ],
    [pinX,  -0.12, pinZ],
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
                  0.012,
                  0.012,
                  0.14,
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

  const bodyY =
    BOARD.height + 0.15;

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

  const leadA =
    createCapacitorLead(
      a,
      bodyEndA,
      bodyY,
    );

  const leadB =
    createCapacitorLead(
      b,
      bodyEndB,
      bodyY,
    );

  // =========================================================
  // COLORS
  // =========================================================

  let bodyColor = "#d6a84f";

  if (capacitorType === "ceramic") {
    bodyColor = "#d9a441";
  }

  if (capacitorType === "film") {
    bodyColor = "#16803c";
  }

  if (capacitorType === "electrolytic") {
    bodyColor = "#111827";
  }

  if (capacitorType === "tantalum") {
    bodyColor = "#d97745";
  }

  if (selected) {
    bodyColor = "#f8fafc";
  }

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
        quaternion={orientation}
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
                metalness={0.05}
                roughness={0.34}
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
                color="#f4c76a"
                roughness={0.3}
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
                metalness={0.05}
                roughness={0.3}
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
                metalness={0.12}
                roughness={0.28}
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

              <meshStandardMaterial
                color="#cbd5e1"
                metalness={0.85}
                roughness={0.22}
              />
            </mesh>

            {/* NEGATIVE STRIPE */}

            <mesh
              position={[
                radius * 0.73,
                0,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  0.018,
                  bodyLength * 0.72,
                  radius * 0.10,
                ]}
              />

              <meshStandardMaterial
                color="#f8fafc"
                metalness={0.1}
                roughness={0.3}
              />
            </mesh>

            {/* NEGATIVE MARK */}

            <mesh
              position={[
                radius * 0.73,
                halfLength + 0.019,
                0,
              ]}
            >
              <boxGeometry
                args={[
                  0.028,
                  0.008,
                  0.045,
                ]}
              />

              <meshStandardMaterial
                color="#111827"
              />
            </mesh>

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
                roughness={0.3}
                metalness={0.05}
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
                color="#f8fafc"
              />
            </mesh>

          </group>
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
    const theta =
      t * this.turns * Math.PI * 2;

    const phi =
      t * Math.PI * 2;

    const windingRadius =
      this.coreRadius +
      this.wireRadius +
      0.006;

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
}: {
  turns: number;
  majorRadius: number;
  coreRadius: number;
  wireRadius: number;
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
        color="#a85f45"
        metalness={0.88}
        roughness={0.20}
      />
    </mesh>
  );
}


export function InductorMesh({
  part,
  selected,
}: {
  part: PlacedPart;
  selected: boolean;
}) {
  const a = vec(part.pins.a);
  const b = vec(part.pins.b);


  /*
   * =========================================================
   * COMPONENT POSITION
   * =========================================================
   */

  const body = a.clone().lerp(b, 0.5);

  body.y += 0.19;


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
  const turns = 18;


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
            color={
              selected
                ? "#7a7f84"
                : "#a99b7c"
            }
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
  body.y += 0.1;
  const cap = useRef<THREE.Mesh>(null);
  const closed = Boolean(part.props.closed);

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
      <Lead from={a} to={body} />
      <Lead from={b} to={body} />
      <group position={body}>
        <mesh castShadow>
          <boxGeometry args={[0.24, 0.1, 0.24]} />
          <meshStandardMaterial color={selected ? "#475569" : "#202938"} roughness={0.36} />
        </mesh>
        <mesh ref={cap} position={[0, 0.105, 0]} castShadow>
          <cylinderGeometry args={[0.068, 0.075, 0.06, 16]} />
          <meshStandardMaterial
            color={closed ? "#ef4444" : "#cbd5e1"}
            emissive={closed ? "#7f1d1d" : "#000000"}
            emissiveIntensity={closed ? 0.5 : 0}
            roughness={0.24}
          />
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
      <Lead from={a} to={body} />
      <Lead from={b} to={body} />
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
  center.y += 0.10;


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

    shaft.current.rotation.z = THREE.MathUtils.damp(
      shaft.current.rotation.z,
      targetAngle,
      12,
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

      /*
      * Update the selected component itself.
      */
      const state = useLab.getState();

      if (state.setSelectedResistance) {
        state.setSelectedResistance(rounded);
      }

      /*
      * Keep the default potentiometer value synchronized.
      */
      if (state.setResistorValue) {
        state.setResistorValue(rounded);
      }
    };

    const handlePointerUp = () => {
      if (!dragging.current) return;

      dragging.current = false;

      setIsDragging(false);

      setPotCameraLock(false);

      document.body.style.cursor = "";
      document.body.style.userSelect = "";
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
              0.31,
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
          color={bodyColor}
          roughness={0.48}
          metalness={0.38}
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
          color="#b8bec3"
          roughness={0.25}
          metalness={0.9}
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
            color="#aeb5ba"
            roughness={0.23}
            metalness={0.96}
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

        {[a, w, b].map(
          (pin, index) => (
            <group
              key={`pot-terminal-${index}`}
              position={[
                pin.x,
                center.y - 0.16,
                pin.z,
              ]}
            >

            <mesh>
              <boxGeometry
                args={[
                  0.018,
                  0.075,
                  0.018,
                ]}
              />

              <meshStandardMaterial
                color="#8c9296"
                roughness={0.3}
                metalness={0.9}
              />
            </mesh>

            <mesh
              position={[
                0,
                -0.045,
                0,
              ]}
            >
              <cylinderGeometry
                args={[
                  0.025,
                  0.025,
                  0.018,
                  20,
                ]}
              />

              <meshStandardMaterial
                color="#b6bcc0"
                roughness={0.25}
                metalness={0.92}
              />
            </mesh>
          </group>
        ),
      )}

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

  const W = 2.72;
  const D = 2.12;
  const T = 0.075;

  const pinEntries = Object.entries(part.pins);
  const pinVecs = pinEntries.map(([, id]) => vec(id));

  const anchor =
    pinVecs.length > 0
      ? pinVecs
          .reduce(
            (sum, p) => sum.add(p),
            new THREE.Vector3(),
          )
          .multiplyScalar(1 / pinVecs.length)
      : new THREE.Vector3();

  const origin = new THREE.Vector3(
    anchor.x + 0.15,
    BOARD.height + T / 2 + 0.035,
    Math.min(anchor.z - 1.75, -3.55),
  );

  const pcb = selected ? "#1167a5" : "#087f49";
  const pcbDark = selected ? "#0d527f" : "#056338";

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
      connection: "LCD D7",
    },
    d3: {
      title: "D3",
      function: "Digital I/O · PWM",
      connection: "LCD D6",
    },
    d4: {
      title: "D4",
      function: "Digital I/O",
      connection: "LCD D5",
    },
    d5: {
      title: "D5",
      function: "Digital I/O · PWM",
      connection: "LCD D4",
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
      connection: "LCD E",
    },
    d12: {
      title: "D12",
      function: "Digital I/O · MISO",
      connection: "LCD RS",
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
      connection: "LCD VCC",
    },
    gnd: {
      title: "GND",
      function: "Ground",
      connection: "LCD GND",
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
    const digitalIndex = DIGITAL.indexOf(name);

    if (digitalIndex >= 0) {
      return new THREE.Vector3(
        -0.685 + digitalIndex * 0.105,
        T / 2 + 0.085,
        -D / 2 + 0.115,
      );
    }

    const analogIndex = ANALOG.indexOf(name);

    if (analogIndex >= 0) {
      return new THREE.Vector3(
        0.02 + analogIndex * 0.105,
        T / 2 + 0.085,
        D / 2 - 0.115,
      );
    }

    const powerIndex = POWER.indexOf(name);

    if (powerIndex >= 0) {
      return new THREE.Vector3(
        -0.73 + powerIndex * 0.105,
        T / 2 + 0.085,
        D / 2 - 0.115,
      );
    }

    return new THREE.Vector3(
      0,
      T / 2 + 0.085,
      0,
    );
  };

  const worldPin = (name: string) =>
    origin.clone().add(pinLocal(name));

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
        color="#b68a36"
        metalness={0.65}
        roughness={0.3}
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
        position={[
          p.x,
          p.y,
          p.z,
        ]}
      >
        {/* Female header body */}
        <mesh castShadow>
          <boxGeometry
            args={[
              0.082,
              0.12,
              0.082,
            ]}
          />
          <meshStandardMaterial
            roughness={0.3}
          />
        </mesh>

        {/* Gold contact */}
        <mesh
          position={[
            0,
            0.065,
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
            color={gold}
            metalness={0.85}
            roughness={0.2}
          />
        </mesh>

        {/* Hover information */}
       
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
  // LCD JUMPER CONNECTIONS
  // ============================================================

  const jumperNames = [
    "vcc",
    "gnd",
    "d2",
    "d3",
    "d4",
    "d5",
    "d11",
    "d12",
  ];

  const jumperColors: Record<
    string,
    string
  > = {
    vcc: "#dc2626",
    gnd: "#111827",
    d2: "#16a34a",
    d3: "#16a34a",
    d4: "#16a34a",
    d5: "#16a34a",
    d11: "#2563eb",
    d12: "#2563eb",
  };

  const jumpers = jumperNames
    .map((name) => {
      const holeId = part.pins[name];

      if (!holeId) return null;

      const hole = vec(holeId);

      const from = worldPin(name).add(
        new THREE.Vector3(
          0,
          0.025,
          0,
        ),
      );

      const to =
        new THREE.Vector3(
          hole.x,
          BOARD.height + 0.09,
          hole.z,
        );

      return {
        key: name,
        from,
        to,
        color:
          jumperColors[name] ??
          "#94a3b8",
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    from: THREE.Vector3;
    to: THREE.Vector3;
    color: string;
  }>;

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
          LCD / BREADBOARD JUMPERS
      ======================================================== */}

      {jumpers.map((j) => (
        <TubeWire
          key={j.key}
          a={j.from}
          b={j.to}
          color={j.color}
          lift={0.9}
          radius={0.016}
          style="flat"
        />
      ))}

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
            roughness={0.42}
            metalness={0.04}
          />
        </mesh>

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
              color="#aeb3b8"
              metalness={0.82}
              roughness={0.22}
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
            RESET SWITCH
        ====================================================== */}

        <group
          position={[
            -0.46,
            T / 2 + 0.035,
            -0.61,
          ]}
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
              0.05,
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
              color="#d1d5db"
              metalness={0.35}
              roughness={0.3}
            />
          </mesh>
        </group>

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
  const raw = (text ?? "").replace(/\r/g, "");
  const line1 = raw.slice(0, 16).padEnd(16, " ");
  const line2 = raw.slice(16, 32).padEnd(16, " ");

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
          <group key={`lcd-pin-${index}`}>
            <Lead from={pin} to={pinEnd} />
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

        {/* Glass / active area */}
        <mesh position={[0, 0.078, 0]}>
          <boxGeometry args={[width * 0.84, 0.015, depth * 0.58]} />
          <meshStandardMaterial
            color={glass}
            emissive={powered ? "#064e3b" : "#000000"}
            emissiveIntensity={powered ? 0.55 : 0}
            roughness={0.2}
            metalness={0.05}
          />
        </mesh>

        {/* Character text when powered */}
        {powered && (
          <Html
            position={[0, 0.1, 0]}
            center
            distanceFactor={5.5}
            style={{
              pointerEvents: "none",
              color: "#a7f3d0",
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.12em",
              lineHeight: 1.35,
              textAlign: "left",
              whiteSpace: "pre",
              textShadow: "0 0 6px rgba(52, 211, 153, 0.45)",
              userSelect: "none",
              background: "transparent",
            }}
          >
            <div>
              <div>{line1}</div>
              <div>{line2}</div>
            </div>
          </Html>
        )}

        {/* Small label on the edge */}
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

  const lines = (text || "").replace(/\r/g, "").split("\n").slice(0, 8);
  while (lines.length < 4) lines.push("");

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
          <group key={`oled-pin-${index}`}>
            <Lead from={pin} to={pinEnd} />
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
        {powered && (
          <Html
            position={[0, 0.08, -0.02]}
            center
            distanceFactor={5.2}
            style={{
              pointerEvents: "none",
              color: "#7dd3fc",
              fontFamily: "IBM Plex Mono, ui-monospace, monospace",
              fontSize: "10px",
              fontWeight: 600,
              letterSpacing: "0.04em",
              lineHeight: 1.25,
              textAlign: "left",
              whiteSpace: "pre",
              textShadow: "0 0 6px rgba(14, 165, 233, 0.55)",
              userSelect: "none",
            }}
          >
            <div>
              {lines.map((line, i) => (
                <div key={i}>{(line || " ").padEnd(16, " ").slice(0, 21)}</div>
              ))}
            </div>
          </Html>
        )}
        <Html
          position={[0, 0.01, depth * 0.4]}
          center
          distanceFactor={7}
          style={{
            pointerEvents: "none",
            color: "#94a3b8",
            fontFamily: "IBM Plex Mono, monospace",
            fontSize: "9px",
            letterSpacing: "0.05em",
            userSelect: "none",
          }}
        >
          {part.props.label ?? "OLED 128×64"}
        </Html>
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

/**
 * Thin metallic transistor lead.
 *
 * The final section is deliberately slightly thicker near the package,
 * matching the way real component leads enter the molded/metal body.
 */
function TransistorLead({
  from,
  to,
  color = "#b7bec7",
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  color?: string;
}) {
  const direction = to.clone().sub(from);
  const length = direction.length();

  const midpoint = from.clone().add(to).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion();

  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize(),
  );

  return (
    <mesh
      castShadow
      position={midpoint}
      quaternion={quaternion}
    >
      <cylinderGeometry args={[0.012, 0.014, length, 8]} />
      <meshStandardMaterial
        color={color}
        metalness={0.82}
        roughness={0.24}
      />
    </mesh>
  );
}

/* -------------------------------------------------------------------------- */
/* TO-92                                                                      */
/* -------------------------------------------------------------------------- */

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
        rotation={[Math.PI / 2, 0, 0]}
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
        <meshStandardMaterial
          color={plastic}
          roughness={0.48}
          metalness={0.02}
        />
      </mesh>

      {/* Flat face highlight */}
      <mesh
        position={[0, 0.002, 0.041]}
        rotation={[Math.PI / 2, 0, 0]}
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
      <Html
        position={[0, 0.01, 0.082]}
        center
        distanceFactor={6}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          fontFamily: "Arial, sans-serif",
          fontSize: "5px",
          fontWeight: 700,
          letterSpacing: "0.02em",
          color: "#cbd5e1",
          opacity: 0.82,
        }}
      >
        {title}
      </Html>
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
        <meshStandardMaterial
          color={metal}
          metalness={0.9}
          roughness={0.22}
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
      <Html
        position={[0, 0.012, 0.09]}
        center
        distanceFactor={6}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          fontFamily: "IBM Plex Mono, monospace",
          fontSize: "5px",
          fontWeight: 700,
          color: "#374151",
          transform: "rotate(-90deg)",
        }}
      >
        {title}
      </Html>
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
      <mesh
        castShadow
        position={[0, 0.128, -0.004]}
      >
        <boxGeometry args={[0.202, 0.105, 0.022]} />
        <meshStandardMaterial
          color="#aeb5bc"
          metalness={0.92}
          roughness={0.23}
        />
      </mesh>

      {/* Mounting hole */}
      <mesh
        position={[0, 0.158, -0.017]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0.025, 0.037, 20]} />
        <meshStandardMaterial
          color="#5f6872"
          metalness={0.85}
          roughness={0.25}
        />
      </mesh>

      {/* Dark center of mounting hole */}
      <mesh
        position={[0, 0.158, -0.018]}
        rotation={[Math.PI / 2, 0, 0]}
      >
        <circleGeometry args={[0.024, 20]} />
        <meshStandardMaterial
          color="#111827"
          roughness={0.7}
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
      <Html
        position={[0, 0.02, 0.039]}
        center
        distanceFactor={6}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          fontFamily: "Arial, sans-serif",
          fontSize: "5px",
          fontWeight: 700,
          color: "#cbd5e1",
          opacity: 0.85,
        }}
      >
        {title}
      </Html>
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
          <mesh
            castShadow
            position={[side * 0.175, 0, 0]}
          >
            <boxGeometry args={[0.075, 0.075, 0.105]} />
            <meshStandardMaterial
              color={metal}
              metalness={0.92}
              roughness={0.22}
            />
          </mesh>

          {/* Actual mounting hole */}
          <mesh
            position={[side * 0.176, 0, 0.054]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.019, 0.029, 20]} />
            <meshStandardMaterial
              color="#69727b"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>

          <mesh
            position={[side * 0.176, 0, 0.055]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <circleGeometry args={[0.018, 20]} />
            <meshStandardMaterial
              color="#111827"
              roughness={0.65}
            />
          </mesh>
        </group>
      ))}

      {/* Part marking */}
      <Html
        position={[0, 0.06, 0.01]}
        center
        distanceFactor={6}
        style={{
          pointerEvents: "none",
          userSelect: "none",
          whiteSpace: "nowrap",
          fontFamily: "Arial, sans-serif",
          fontSize: "5px",
          fontWeight: 700,
          color: "#374151",
          opacity: 0.78,
        }}
      >
        {title}
      </Html>
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

  body.y = BOARD.height + 0.16;

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

      <TransistorLead
        from={e}
        to={body}
        color={leadColor}
      />

      <TransistorLead
        from={b}
        to={body}
        color={leadColor}
      />

      <TransistorLead
        from={c}
        to={body}
        color={leadColor}
      />

      {/* Slightly thicker lead collars where the pins enter the package */}
      <mesh position={e.clone().lerp(body, 0.86)}>
        <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
        <meshStandardMaterial
          color={leadColor}
          metalness={0.82}
          roughness={0.25}
        />
      </mesh>

      <mesh position={b.clone().lerp(body, 0.86)}>
        <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
        <meshStandardMaterial
          color={leadColor}
          metalness={0.82}
          roughness={0.25}
        />
      </mesh>

      <mesh position={c.clone().lerp(body, 0.86)}>
        <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
        <meshStandardMaterial
          color={leadColor}
          metalness={0.82}
          roughness={0.25}
        />
      </mesh>

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
  body.y = BOARD.height + 0.16;

  const model = part.props.thyristorModel ?? "2n5060";
  const meta = THYRISTOR_META[model] ?? THYRISTOR_META["2n5060"];
  const on = Boolean(sim.thyristors?.[part.id]?.conducting);
  const leadColor = "#b9c0c8";

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <TransistorLead from={a} to={body} color={leadColor} />
      <TransistorLead from={g} to={body} color={leadColor} />
      <TransistorLead from={k} to={body} color={leadColor} />

      <mesh position={a.clone().lerp(body, 0.86)}>
        <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
        <meshStandardMaterial color={leadColor} metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={g.clone().lerp(body, 0.86)}>
        <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
        <meshStandardMaterial color={leadColor} metalness={0.82} roughness={0.25} />
      </mesh>
      <mesh position={k.clone().lerp(body, 0.86)}>
        <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
        <meshStandardMaterial color={leadColor} metalness={0.82} roughness={0.25} />
      </mesh>

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
  body.y = BOARD.height + 0.16;
  const model = part.props.triacModel ?? "bt136";
  const meta = TRIAC_META[model] ?? TRIAC_META.bt136;
  const on = Boolean(sim.triacs?.[part.id]?.conducting);
  const leadColor = "#b9c0c8";

  return (
    <group
      onClick={(ev) => {
        ev.stopPropagation();
        useLab.getState().select(part.id);
      }}
    >
      <TransistorLead from={mt1} to={body} color={leadColor} />
      <TransistorLead from={g} to={body} color={leadColor} />
      <TransistorLead from={mt2} to={body} color={leadColor} />
      {[mt1, g, mt2].map((p, i) => (
        <mesh key={i} position={p.clone().lerp(body, 0.86)}>
          <cylinderGeometry args={[0.016, 0.018, 0.035, 8]} />
          <meshStandardMaterial color={leadColor} metalness={0.82} roughness={0.25} />
        </mesh>
      ))}
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
  body.y = BOARD.height + 0.12;
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
      <Lead from={a} to={body} />
      <Lead from={b} to={body} />
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
  body.y = BOARD.height + 0.18;
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
      <Lead from={a} to={body} />
      <Lead from={b} to={body} />

      {/* Motor can */}
      <mesh position={body} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.09, 0.09, 0.22, 20]} />
        <meshStandardMaterial
          color={selected ? "#475569" : "#334155"}
          metalness={0.55}
          roughness={0.35}
        />
      </mesh>
      {/* End caps */}
      <mesh position={[body.x - 0.11, body.y, body.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.092, 0.092, 0.02, 20]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.45} />
      </mesh>
      <mesh position={[body.x + 0.11, body.y, body.z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.092, 0.092, 0.02, 20]} />
        <meshStandardMaterial color="#1e293b" metalness={0.4} roughness={0.45} />
      </mesh>

      {/* Shaft + larger 4-blade propeller */}
      <group ref={shaftRef} position={[body.x + 0.2, body.y, body.z]}>
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
        <mesh position={[body.x + 0.2, body.y, body.z]}>
          <sphereGeometry args={[0.28, 12, 12]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.07} />
        </mesh>
      )}

      <Html
        position={[body.x, body.y + 0.36, body.z]}
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
        Motor
      </Html>
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
      <Lead from={a} to={body} />
      <Lead from={b} to={body} />
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

export function PartSwitch({
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
      return <InductorMesh part={part} selected={selected} />;
    case "transistor":
      return (
        <TransistorMesh part={part} selected={selected} sim={sim} />
      );
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
    case "pot":
      return <PotMesh part={part} selected={selected} />;
    default:
      return null;
  }
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
        <mesh position={[0, 0.62, 0]} castShadow>
          <boxGeometry args={[bodyW, 1.24, 1.7]} />
          <meshStandardMaterial color="#eef1f5" roughness={0.35} />
        </mesh>
        {/* Display faces the board (+X) */}
        <mesh position={[bodyW / 2 + 0.01, 0.85, -0.15]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.9, 0.34]} />
          <meshStandardMaterial
            map={tex.t}
            emissive="#3f0a0a"
            emissiveIntensity={powerOn ? 0.4 : 0.05}
          />
        </mesh>
        <mesh position={[bodyW / 2, 0.52, -0.35]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color="#c2413b" />
        </mesh>
        <mesh position={[bodyW / 2, 0.52, 0.25]}>
          <cylinderGeometry args={[0.07, 0.07, 0.08, 16]} />
          <meshStandardMaterial color="#1a1d23" />
        </mesh>
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
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const clickHole = useLab((s) => s.clickHole);

  const boardId = useLab((s) => s.boardId);
  const holes = useMemo(() => getAllHoles(), [boardId]);
  useLayoutEffect(() => {
    if (!meshRef.current) return;

    holes.forEach((id, i) => {
      const [x, y, z] = holePosition(id);

      dummy.position.set(x, y - 0.01, z);
      dummy.rotation.x = Math.PI / 2;
      dummy.updateMatrix();

      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.count = holes.length;
  }, [dummy, holes]);

  const w = BOARD.width;
  const d = BOARD.depth;
  const railLen = Math.max(0.4, w - 0.3);

  return (
    <group key={boardId}>
      <mesh position={[0, BOARD.y, 0]} receiveShadow castShadow>
        <boxGeometry args={[w, BOARD.height, d]} />
        <meshStandardMaterial color="#f4f1ea" roughness={0.7} />
      </mesh>
      {BOARD.hasRails &&
        (BOARD.presetId === "full-1660" ? (
          <group>
            {FULL_RAIL_Z.map((z, i) => (
              <mesh
                key={`full-rail-${i}`}
                position={[0, BOARD.height + 0.005, z]}
              >
                <boxGeometry args={[railLen, 0.012, 0.06]} />
                <meshStandardMaterial
                  color={i % 2 === 0 ? "#c2413b" : "#1d4ed8"}
                />
              </mesh>
            ))}
          </group>
        ) : (
          <>
            <mesh position={[0, BOARD.height + 0.005, -2.5]}>
              <boxGeometry args={[railLen, 0.012, 0.06]} />
              <meshStandardMaterial color="#c2413b" />
            </mesh>
            <mesh position={[0, BOARD.height + 0.005, -2.2]}>
              <boxGeometry args={[railLen, 0.012, 0.06]} />
              <meshStandardMaterial color="#1d4ed8" />
            </mesh>
            <mesh position={[0, BOARD.height + 0.005, 2.2]}>
              <boxGeometry args={[railLen, 0.012, 0.06]} />
              <meshStandardMaterial color="#1d4ed8" />
            </mesh>
            <mesh position={[0, BOARD.height + 0.005, 2.5]}>
              <boxGeometry args={[railLen, 0.012, 0.06]} />
              <meshStandardMaterial color="#c2413b" />
            </mesh>
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
        <mesh position={[0, 0.22, 0]}>
          <boxGeometry args={[Math.max(0.5, w - 0.15), 0.08, 0.42]} />
          <meshStandardMaterial color="#e7e2d8" />
        </mesh>
      )}
      <instancedMesh
        key={`${boardId}-${holes.length}`}
        ref={meshRef}
        args={[undefined, undefined, holes.length]}
        onPointerDown={(e) => {
          e.stopPropagation();
          if (e.button !== 0 || e.instanceId == null) return;
          clickHole(holes[e.instanceId]);
        }}
      >
        <cylinderGeometry args={[0.036, 0.036, 0.1, 10]} />
        <meshStandardMaterial color="#1c2430" roughness={0.55} />
      </instancedMesh>
    </group>
  );
}
