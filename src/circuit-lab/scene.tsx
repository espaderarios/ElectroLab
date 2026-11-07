import { WORKBENCH_PALETTE } from "./workbench-palette";
import { GRAPHICS_QUALITY, type GraphicsQuality } from "./graphics-quality";
import { StudioEnvironment } from "./studio-environment";
import { ContactShadows, Grid, OrbitControls, Html } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  BOARD,
  getAllHoles,
  holePosition,
  holeStrip,
  nearestHole,
} from "@/circuit/breadboard";
import { buildPreviewPart, previewMovedPart, useLab, introducesWireObstruction } from "@/store/lab";
import type { HoleId, PlacedPart, SimResult, ToolId, Wire } from "@/circuit/types";
import { terminalPosition, mcuHeaderPosition } from "@/circuit/mcu-headers";
import { planWireRoutes, wireRoute3DPoints, type RoutedWire } from "@/circuit/wire-routing";
import { netConnected } from "@/circuit/display-guides";
import { placementIsBlocked, partObstacle, collectPartObstacles, rectsOverlap } from "@/circuit/placement-obstacles";
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
    fallback.position.set(6.6, 8.2, 10.3);
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
  if (part.kind === "mcu") return part.props.headerAnchor ?? "F22";
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
  "switch-spst",
  "switch-spdt",
  "switch-dpst",
  "switch-dpdt",
  "button",
  "relay",
  "pot",
  "buzzer",
  "speaker",
  "motor",
  "lcd",
  "oled",
  "mcu",
  "not",
  "and",
  "or",
  "nand",
  "nor",
  "xor",
  "xnor",
  "mosfet",
  "zener",
  "ldr",
  "thermistor",
  "fuse",
  "rgb-led",
  "servo",
  "seven-segment",
  "timer555",
  "opamp",
  "optocoupler",
  "regulator",
]);

function PulseMarker({
  position,
  color,
  phase = 0,
  radius = 0.085,
  selected = false,
}: {
  position: [number, number, number];
  color: string;
  phase?: number;
  radius?: number;
  selected?: boolean;
}) {
  const ring = useRef<THREE.Mesh>(null);
  const disc = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.MeshBasicMaterial>(null);
  const discMat = useRef<THREE.MeshBasicMaterial>(null);

  useFrame(({ clock }) => {
    const pulse = (Math.sin(clock.getElapsedTime() * 4.2 + phase) + 1) / 2;
    if (ring.current) ring.current.scale.setScalar(0.92 + pulse * 0.2);
    if (material.current) material.current.opacity = 0.65 + pulse * 0.3;
    if (discMat.current) discMat.current.opacity = selected ? 0.28 + pulse * 0.12 : 0.12 + pulse * 0.08;
  });

  return (
    <group position={position}>
      {/* Soft filled disc so the hole is obviously marked */}
      <mesh ref={disc} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.72, 28]} />
        <meshBasicMaterial
          ref={discMat}
          color={color}
          transparent
          opacity={selected ? 0.32 : 0.14}
          depthWrite={false}
        />
      </mesh>
      {/* Outer ring */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.55, radius, 28]} />
        <meshBasicMaterial
          ref={material}
          color={color}
          transparent
          opacity={0.75}
          depthWrite={false}
        />
      </mesh>
      {selected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
          <ringGeometry args={[radius * 0.95, radius * 1.18, 28]} />
          <meshBasicMaterial color={color} transparent opacity={0.45} depthWrite={false} />
        </mesh>
      )}
    </group>
  );
}

function HoverMarker() {
  const hover = useLab((s) => s.hoverHole);
  const pending = useLab((s) => s.pendingHoles);
  const probe = useLab((s) => s.probeHole);
  const parts = useLab((s) => s.parts);
  // Unique holes; selected/probe takes priority for styling
  const seen = new Set<string>();
  const items: { id: string; kind: "hover" | "pending" | "selected" }[] = [];
  for (const id of pending) {
    if (id && !seen.has(id)) {
      seen.add(id);
      items.push({ id, kind: "pending" });
    }
  }
  if (probe && !seen.has(probe)) {
    seen.add(probe);
    items.push({ id: probe, kind: "selected" });
  }
  if (hover && !seen.has(hover)) {
    items.push({ id: hover, kind: "hover" });
  }
  return (
    <>
      {items.map((item, i) => {
        const [x, ty, z] = terminalPosition(item.id,parts);
        if (![x,ty,z].every(Number.isFinite)) return null;
        // Position the hover ring at the visible Arduino header socket.
        const y = ty + 0.055;
        const color =
          item.kind === "pending"
            ? "#14b8a6"
            : item.kind === "selected"
              ? "#fbbf24"
              : "#38bdf8";
        return (
          <PulseMarker
            key={`${item.id}-${item.kind}`}
            position={[x, y, z]}
            color={color}
            phase={i * 1.8}
            radius={item.kind === "selected" ? 0.1 : 0.085}
            selected={item.kind === "selected"}
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
  const wireStyle = useLab((s) => s.wireStyle);
  const wires = useLab((s) => s.wires);
  const parts = useLab((s) => s.parts);
  if (tool !== "wire" || pending.length !== 1 || !hover || pending[0] === hover) return null;
  const preview: Wire = { id: "__wire_preview__", a: pending[0], b: hover, color, style: wireStyle };
  const route = planWireRoutes([...wires, preview], (id) => terminalPosition(id, parts), parts).slice(-1)[0];
  if (!route) return null;
  return <WirePreviewMesh route={route} color={color} />;
}

function WirePreviewMesh({ route, color }: { route: RoutedWire; color: string }) {
  const geometry = useMemo(() => {
    const points = wireRoute3DPoints(route, BOARD.height).map((p) => new THREE.Vector3(p.x, p.y, p.z));
    const path = new THREE.CurvePath<THREE.Vector3>();
    for (let i = 1; i < points.length; i++) {
      if (points[i].distanceTo(points[i - 1]) > 0.001) path.add(new THREE.LineCurve3(points[i - 1], points[i]));
    }
    return new THREE.TubeGeometry(path, Math.max(18, points.length * 6), 0.025, 6, false);
  }, [route]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const hex = color === "black" ? "#64748b" : color === "white" ? "#e8eef8" :
    color === "blue" ? "#3b82f6" : color === "red" ? "#ef4444" :
    color === "yellow" ? "#facc15" : color === "green" ? "#34d399" : "#fb923c";
  return <mesh geometry={geometry} raycast={() => null}>
    <meshBasicMaterial color={route.blocked ? "#ef4444" : hex} transparent opacity={0.78} depthWrite={false} />
  </mesh>;
}


/** Thin cyan preview linking a suggested pair. Guide mode never edits wires. */
function SuggestedWirePreview() {
  const target = useLab((state) => state.guideTarget);
  const wires = useLab((state) => state.wires);
  const parts = useLab((state) => state.parts);
  const boardId = useLab((state) => state.boardId);
  const route = useMemo(() => {
    if (!target || netConnected(target.a, target.b, wires)) return null;
    const candidate: Wire = {id:'__suggestion_only__', a:target.a, b:target.b, color:'yellow', style:'jumper'};
    const routes = planWireRoutes([...wires, candidate], (id) => terminalPosition(id, parts), parts);
    return routes[routes.length - 1] ?? null;
  }, [target, wires, parts, boardId]);
  if (!target) return null;
  const a = terminalPosition(target.a, parts), b = terminalPosition(target.b, parts);
  return <group>
    {route && !route.blocked && <WirePreviewMesh route={route} color="yellow" />}
    <PulseMarker position={a} color="#22d3ee" phase={0} radius={0.115} selected />
    <PulseMarker position={b} color="#facc15" phase={2} radius={0.115} selected />
    <Html position={[a[0], a[1] + 0.2, a[2]]} center distanceFactor={7} style={{pointerEvents:'none', padding:'3px 5px', fontSize:'10px', fontWeight:700, color:'#67e8f9', background:'rgba(8,15,30,.86)', borderRadius:5}}>FROM · {target.a}</Html>
    <Html position={[b[0], b[1] + 0.2, b[2]]} center distanceFactor={7} style={{pointerEvents:'none', padding:'3px 5px', fontSize:'10px', fontWeight:700, color:'#fde047', background:'rgba(8,15,30,.86)', borderRadius:5}}>TO · {target.b}</Html>
  </group>;
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
  const { camera, size } = useThree();
  const boardId = useLab((s) => s.boardId);
  const controlsRef = useRef<any>(null);

  // Bottom dock and sidebar resize the canvas. Do not reset orbit/zoom on
  // those layout changes; only an explicit Fit/Focus command may reframe it.
  const lastFittedBoard = useRef<string | null>(null);
  const fitRegion = useCallback((minX: number, maxX: number, minZ: number, maxZ: number) => {
    const perspective = camera as THREE.PerspectiveCamera;
    const aspect = Math.max(0.8, size.width / Math.max(size.height, 1));
    const direction = new THREE.Vector3(0.2, 0.79, 0.61).normalize();
    const target = new THREE.Vector3((minX+maxX)/2, 0.18, (minZ+maxZ)/2);
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), direction).normalize();
    const up = new THREE.Vector3().crossVectors(direction, right).normalize();
    const halfFovTan = Math.tan(THREE.MathUtils.degToRad(perspective.fov || 42) / 2);
    const corners = [
      [minX, minZ], [minX, maxZ], [maxX, minZ], [maxX, maxZ],
    ];
    let cameraDistance = 3;
    for (const [x, z] of corners) {
      const relative = new THREE.Vector3(x, BOARD.height, z).sub(target);
      const horizontal = Math.abs(relative.dot(right));
      const vertical = Math.abs(relative.dot(up));
      const foreground = relative.dot(direction);
      cameraDistance = Math.max(cameraDistance,
        foreground + horizontal / (halfFovTan * aspect * 0.88),
        foreground + vertical / (halfFovTan * 0.85));
    }
    cameraDistance = Math.max(4.8, cameraDistance);
    camera.position.copy(target).addScaledVector(direction, cameraDistance);
    camera.lookAt(target);
    perspective.updateProjectionMatrix();
    const controls = controlsRef.current;
    if (controls) {
      controls.target.copy(target);
      controls.update();
      controls.saveState();
    }
  }, [camera, size.width, size.height]);

  const fitBoard = useCallback(() => {
    fitRegion(-BOARD.width/2-0.85, BOARD.width/2+0.35,
      -BOARD.depth/2-0.22, BOARD.depth/2+0.22);
  }, [fitRegion]);

  const focusCircuit = useCallback(() => {
    const { parts } = useLab.getState();
    const holes = parts.flatMap(part => Object.values(part.pins));
    if (!holes.length) { fitBoard(); return; }
    const coords = holes.map(hole => terminalPosition(hole, parts)).filter(p => p.every(Number.isFinite));
    if (!coords.length) {fitBoard();return;}
    const minX = Math.min(...coords.map(v => v[0]));
    const maxX = Math.max(...coords.map(v => v[0]));
    const minZ = Math.min(...coords.map(v => v[2]));
    const maxZ = Math.max(...coords.map(v => v[2]));
    // A usable bench view, not a macro shot of a single resistor.
    const spanX = Math.max(8.7, maxX-minX+1.7);
    const spanZ = Math.max(4.25, maxZ-minZ+1.35);
    const midX = (minX+maxX)/2;
    const midZ = (minZ+maxZ)/2;
    fitRegion(midX-spanX/2, midX+spanX/2, midZ-spanZ/2, midZ+spanZ/2);
  }, [fitRegion, fitBoard]);

  useEffect(() => {
    if (lastFittedBoard.current === boardId || !size.width || !size.height) return;
    lastFittedBoard.current = boardId;
    focusCircuit();
  }, [focusCircuit, boardId, size.width, size.height]);

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
        fitBoard();
      } else if (detail.type === "focus-circuit") {
        focusCircuit();
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
  }, [fitBoard, focusCircuit]);

  useFrame(() => {
    if (!controlsRef.current) return;
    controlsRef.current.enabled =
      !window.__ecePotDragging && !window.__ecePartDragging &&
      !useLab.getState().paletteDragging;
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
      maxDistance={45}
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
  const wires = useLab((s) => s.wires);
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
    partDragEnabled,
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

  const invalidPlacement = useMemo(() => {
    if (!preview) return false;
    if (placementIsBlocked(preview, parts, movingSelected ? selectedId ?? undefined : undefined)) return true;

    // Match the actual drop's wire-clearance validation so the ghost cannot
    // appear safe in cyan only to fail with a routing warning on release.
    const proposedParts = movingSelected && selectedId
      ? parts.map((part) => part.id === selectedId ? { ...preview, id: part.id } : part)
      : [...parts, preview];
    return introducesWireObstruction(wires, parts, wires, proposedParts);
  }, [preview, parts, wires, movingSelected, selectedId]);

  const footprint = useMemo(() => preview ? partObstacle(preview) : null, [preview]);
  const collisions = useMemo(() => {
    if (!footprint) return [];
    return collectPartObstacles(parts, movingSelected ? selectedId ?? undefined : undefined)
      .filter((other) => rectsOverlap(footprint, other));
  }, [footprint, parts, movingSelected, selectedId]);
  const markerColor = invalidPlacement ? "#fb7185" : "#22d3ee";

  const ghostGroup = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    // Ghost is a render-only model: disable all child mesh raycasts so a
    // preview can never eat the click intended for a breadboard hole.
    ghostGroup.current?.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.InstancedMesh) {
        child.raycast = () => undefined;
      }
    });
  }, [preview]);

  if (!preview) return null;

  return (
    <group ref={ghostGroup}>
      {/* True solid-object footprint, computed by the SAME predicate used for drop. */}
      {footprint && (
        <group position={[(footprint.minX + footprint.maxX) / 2, BOARD.height + 0.09, (footprint.minZ + footprint.maxZ) / 2]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <planeGeometry args={[footprint.maxX - footprint.minX, footprint.maxZ - footprint.minZ]} />
            <meshBasicMaterial color={markerColor} transparent opacity={0.13} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
          <lineSegments raycast={() => null}>
            <edgesGeometry args={[new THREE.BoxGeometry(footprint.maxX - footprint.minX, 0.02, footprint.maxZ - footprint.minZ)]} />
            <lineBasicMaterial color={markerColor} transparent opacity={0.97} depthTest={false} />
          </lineSegments>
          {invalidPlacement && (
            <Html center position={[0, 0.48, 0]} distanceFactor={9}
              style={{pointerEvents: "none", whiteSpace: "nowrap", userSelect: "none"}}>
              <div style={{padding: "5px 9px", fontSize: 10, fontWeight: 800, borderRadius: 7,
                color: "#fecdd3", background: "rgba(3,9,25,.94)",
                border: "1px solid #fb7185", boxShadow: "0 0 20px #fb718544"}}>
                BLOCKED · MOVE PART
              </div>
            </Html>
          )}
        </group>
      )}
      {collisions.map((other) => (
        <lineSegments key={`collision-${other.id}`}
          position={[(other.minX + other.maxX) / 2, BOARD.height + 0.07, (other.minZ + other.maxZ) / 2]}
          raycast={() => null}>
          <edgesGeometry args={[new THREE.BoxGeometry(other.maxX - other.minX, 0.025, other.maxZ - other.minZ)]} />
          <lineBasicMaterial color="#f43f5e" transparent opacity={0.95} depthTest={false} />
        </lineSegments>
      ))}
      {/* Soft lift so the ghost reads as floating above the board */}
      <group position={[0, 0.04, 0]}>
        <PartSwitch part={preview} selected sim={sim} />
      </group>
      {/* Pin markers for every node of the ghost footprint */}
      {Object.entries(preview.pins).map(([pinName, holeId]) => {
        const [x, y, z] = (preview.kind === 'mcu'
          ? mcuHeaderPosition(preview, pinName)
          : holePosition(holeId)) ?? [NaN, NaN, NaN];
        if (![x,y,z].every(Number.isFinite)) return null;
        return (
          <mesh
            key={`preview-pin-${pinName}-${holeId}`}
            position={[x, y + 0.06, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.05, 0.085, 18]} />
            <meshBasicMaterial color={invalidPlacement ? "#ef4444" : "#38bdf8"} transparent opacity={0.88} depthWrite={false} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Normal click selects; dragging beyond this distance starts a real 3D move. */
const DRAG_THRESHOLD_PX = 7;

/**
 * Selection and movement share the exact physical part model.
 * Holding the mouse is no longer required: click selects, drag moves.
 * Pin location under the grabbed point is preserved to avoid jumps.
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
  const movingSelected = useLab((s) => s.movingSelected);

  const dragRef = useRef<{
    active: boolean;
    moving: boolean;
    startX: number;
    startY: number;
    partId: string;
    // Displacement of the clicked surface point from the first pin.
    offsetX: number;
    offsetZ: number;
  } | null>(null);

  useEffect(() => {
    if (!partDragEnabled) {
      dragRef.current = null;
      window.__ecePartDragging = false;
      return;
    }

    const getAnchor = (x: number, y: number, d: NonNullable<typeof dragRef.current>) => {
      const point = screenToBoardPoint(x, y);
      if (!point) return null;
      return nearestHole({
        x: point.x - d.offsetX,
        y: BOARD.height,
        z: point.z - d.offsetZ,
      }, 0.37);
    };

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d?.active) return;
      const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
      if (!d.moving && dist >= DRAG_THRESHOLD_PX) {
        d.moving = true;
        const lab = useLab.getState();
        lab.select(d.partId);
        lab.setMovingSelected(true);
      }
      if (d.moving) setHover(getAnchor(e.clientX, e.clientY, d));
    };

    const finish = (e: PointerEvent, canceled = false) => {
      const d = dragRef.current;
      if (!d?.active) return;
      d.active = false;
      dragRef.current = null;
      window.__ecePartDragging = false;
      if (d.moving) {
        const hole = canceled ? null : getAnchor(e.clientX, e.clientY, d);
        if (hole) {
          const lab = useLab.getState();
          lab.select(d.partId);
          lab.moveSelectedTo(hole);
        }
        useLab.getState().setMovingSelected(false);
        setHover(null);
      }
    };

    const onUp = (e: PointerEvent) => finish(e);
    const onCancel = (e: PointerEvent) => finish(e, true);
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragRef.current) {
        dragRef.current = null;
        window.__ecePartDragging = false;
        useLab.getState().setMovingSelected(false);
        setHover(null);
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onEscape);
      if (dragRef.current) window.__ecePartDragging = false;
    };
  }, [setHover, partDragEnabled]);

  return (
    <group
      visible={!(movingSelected && selected)}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        if (tool === 'delete') {
          e.stopPropagation();
          useLab.getState().select(part.id);
          return;
        }
        if (tool !== 'select') return;
        e.stopPropagation();
        select(part.id);
        if (!partDragEnabled) return;

        const anchor = firstPinHole(part);
        const point = screenToBoardPoint(e.clientX, e.clientY);
        const pinWorld = anchor ? holePosition(anchor) : null;
        dragRef.current = {
          active: true,
          moving: false,
          startX: e.clientX,
          startY: e.clientY,
          partId: part.id,
          offsetX: point && pinWorld ? point.x - pinWorld[0] : 0,
          offsetZ: point && pinWorld ? point.z - pinWorld[2] : 0,
        };
        // Do not rotate the whole breadboard while the component is grabbed.
        window.__ecePartDragging = true;
      }}
    >
      <PartSwitch part={part} selected={selected} sim={sim} />
    </group>
  );
}

export function LabScene({ performanceMode = true, quality = "low" }: { performanceMode?: boolean; quality?: GraphicsQuality }) {
  const graphics = GRAPHICS_QUALITY[quality];
  const parts = useLab((s) => s.parts);
  const wires = useLab((s) => s.wires);
  const selectedId = useLab((s) => s.selectedId);
  const focusConnections = useLab((s) => s.focusConnections);
  const sim = useLab((s) => s.sim);
  const select = useLab((s) => s.select);
  const movingSelected = useLab((s) => s.movingSelected);
  const tickAccumulator = useRef(0);
  const boardId = useLab((s) => s.boardId);
  const routes = useMemo(() => new Map(planWireRoutes(wires, (id) => terminalPosition(id, parts), parts).map((route) => [route.id, route])), [wires, parts, boardId]);

  // Run MCU ticks at 10 Hz in Fast 3D, or 20 Hz in Detail 3D.
  // This avoids unnecessarily solving the entire circuit every rendered frame.
  // Run the MCU at a stable virtual 20 Hz instead of tying sketch execution
  // to the renderer's 60–144 FPS rate. This is the foundation for millis(),
  // button debounce, PWM and timer-like peripherals.
  useFrame((_, delta) => {
    tickAccumulator.current += delta * 1000;
    if (tickAccumulator.current < (performanceMode ? 100 : 50)) return;
    const elapsed = tickAccumulator.current;
    tickAccumulator.current = 0;
    useLab.getState().tickSimulation(Math.min(elapsed, 100));
  });

  return (
    <>
      <color attach="background" args={[WORKBENCH_PALETTE.background]} />
      <fog attach="fog" args={[WORKBENCH_PALETTE.background, 14, 36]} />
      <StudioEnvironment quality={quality} />
      <hemisphereLight args={["#d8e7f4", "#293442", performanceMode ? 0.68 : 0.76]} />
      <ambientLight intensity={performanceMode ? 0.34 : 0.28} />
      <directionalLight
        position={[6, 10, 4]}
        intensity={graphics.lightIntensity}
        castShadow={!performanceMode}
        shadow-mapSize-width={graphics.shadowResolution}
        shadow-mapSize-height={graphics.shadowResolution}
        shadow-bias={-0.00008}
        shadow-normalBias={0.025}
        shadow-camera-far={24}
        shadow-camera-left={-Math.max(8, BOARD.width / 2 + 2)}
        shadow-camera-right={Math.max(8, BOARD.width / 2 + 2)}
        shadow-camera-top={Math.max(8, BOARD.depth / 2 + 2)}
        shadow-camera-bottom={-Math.max(8, BOARD.depth / 2 + 2)}
      />
      <directionalLight position={[-4, 6, -3]} intensity={0.5} color="#b9ceee" />
      <directionalLight position={[-3, 7, 7]} intensity={0.32} color="#e0f2fe" />
      <pointLight position={[1, 7, -6]} color="#f2d9c9" intensity={0.28} distance={26} decay={2} />

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
        <meshStandardMaterial color={WORKBENCH_PALETTE.floor} roughness={0.78} metalness={0.12} />
      </mesh>
      <Grid
        position={[0, 0.001, 0]}
        args={[40, 40]}
        cellSize={0.5}
        cellThickness={0.6}
        cellColor={WORKBENCH_PALETTE.gridCell}
        sectionSize={2}
        sectionThickness={1.1}
        sectionColor={WORKBENCH_PALETTE.gridSection}
        fadeDistance={26}
        fadeStrength={1.4}
        infiniteGrid
      />

      <BreadboardBody />
      <PowerSupply />
      <PowerClipMarkers />
      {wires.map((w) => (
        <JumperWire
          key={w.id}
          wire={w}
          route={routes.get(w.id)!}
          selected={selectedId === w.id}
          dimmed={focusConnections && Boolean(selectedId) && selectedId !== w.id && (() => {
            const part = parts.find(p => p.id === selectedId);
            if (!part) return true;
            const pins = new Set(Object.values(part.pins).map(holeStrip));
            return !pins.has(holeStrip(w.a)) && !pins.has(holeStrip(w.b));
          })()}
        />
      ))}
      {parts.map((p) => (
        // Keep MovablePart MOUNTED during drag: its window pointer listeners
        // must survive until pointerup. It hides its mesh using visible=false.
        <MovablePart
          key={p.id}
          part={p}
          selected={selectedId === p.id}
          sim={sim}
        />
      ))}
      <PlacementGhost />
      <HoverMarker />
      <PreviewWire />
      <SuggestedWirePreview />
      {!performanceMode && <ContactShadows position={[0, 0, 0]} opacity={graphics.contactOpacity} scale={18} blur={quality === "ultra" ? 2.6 : 2.2} far={3} resolution={graphics.contactShadowResolution} frames={1} />}
      <CameraRig />
      <group visible={false}>
        {getAllHoles().slice(0, 1).map((id) => (
          <mesh key={id} />
        ))}
      </group>
    </>
  );
}
