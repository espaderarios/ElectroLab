import * as THREE from 'three';
import { useMemo } from 'react';
import { BOARD, holePosition } from '@/circuit/breadboard';
import type { PlacedPart } from '@/circuit/types';
import { useLab } from '@/store/lab';

/** Detailed physical meshes that share the simulator's native electrical pins.
 * The wires still connect to real breadboard holes and the saved circuit uses
 * the normal switch kind; these are not decoration-only models.
 */
function terminal(part: PlacedPart, pin: string): THREE.Vector3 | null {
  const hole = part.pins[pin];
  if (!hole) return null;
  return new THREE.Vector3(...holePosition(hole));
}

function MetalLead({ start, end }: { start: THREE.Vector3; end: THREE.Vector3 }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3([
    start,
    new THREE.Vector3(start.x, Math.max(start.y, BOARD.height) + 0.07, start.z),
    new THREE.Vector3(end.x, end.y - 0.03, end.z),
    end,
  ]), [start.x, start.y, start.z, end.x, end.y, end.z]);
  return <mesh castShadow raycast={() => null}>
    <tubeGeometry args={[curve, 16, 0.010, 6, false]}/>
    <meshStandardMaterial color="#aab9c8" metalness={0.88} roughness={0.24}/>
  </mesh>;
}

function switchInteraction(part: PlacedPart) {
  const lab = useLab.getState();
  if (lab.tool === 'delete') {
    lab.select(part.id);
    lab.deleteSelected();
    return;
  }
  if (lab.tool === 'select' && lab.selectedId !== part.id) {
    lab.select(part.id);
    return;
  }
  lab.toggleSwitch(part.id);
  lab.select(part.id);
}

/** Normally-open magnetic reed capsule. Manually click to close contacts. */
export function ReedSwitchMesh({ part, selected }: { part: PlacedPart; selected: boolean }) {
  const a = terminal(part, 'a');
  const b = terminal(part, 'b');
  if (!a || !b) return null;
  const center = a.clone().lerp(b, 0.5);
  center.y = BOARD.height + 0.19;
  const direction = b.clone().sub(a).setY(0);
  if (direction.lengthSq() < 1e-6) return null;
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
  const closed = Boolean(part.props.closed);
  const half = 0.205;
  const endA = center.clone().add(new THREE.Vector3(-half, 0, 0).applyQuaternion(orientation));
  const endB = center.clone().add(new THREE.Vector3(half, 0, 0).applyQuaternion(orientation));
  return <group onClick={(event) => { event.stopPropagation(); switchInteraction(part); }}>
    <MetalLead start={a} end={endA}/>
    <MetalLead start={b} end={endB}/>
    <group position={center} quaternion={orientation}>
      {/* Crimped nickel end electrodes and hermetic glass tube. */}
      {[-1, 1].map(sign => <mesh key={sign} rotation={[0, 0, Math.PI / 2]} position={[sign * 0.188, 0, 0]} castShadow>
        <cylinderGeometry args={[0.027, 0.027, 0.055, 14]}/>
        <meshStandardMaterial color="#a7b1bc" metalness={0.85} roughness={0.2}/>
      </mesh>)}
      <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.048, 0.048, 0.36, 20, 1, true]}/>
        <meshPhysicalMaterial color={selected ? '#d1e9fb' : '#bbd2dc'} transparent opacity={0.30}
          depthWrite={false} roughness={0.06} metalness={0} side={THREE.DoubleSide}/>
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.042, 0.042, 0.34, 16, 1, true]}/>
        <meshBasicMaterial color="#eaf3ff" transparent opacity={0.09} depthWrite={false} side={THREE.DoubleSide}/>
      </mesh>
      {/* The real conductive reeds visibly meet when the switch is closed. */}
      <mesh position={[closed ? -0.003 : -0.035, 0.009, 0.006]} rotation={[0, 0, closed ? -0.015 : -0.08]}>
        <boxGeometry args={[0.21, 0.010, 0.024]}/>
        <meshStandardMaterial color="#b2b8a6" metalness={0.88} roughness={0.26}/>
      </mesh>
      <mesh position={[closed ? 0.003 : 0.035, -0.009, -0.006]} rotation={[0, 0, closed ? 0.015 : 0.08]}>
        <boxGeometry args={[0.21, 0.010, 0.024]}/>
        <meshStandardMaterial color="#b2b8a6" metalness={0.88} roughness={0.26}/>
      </mesh>
      {/* Two internal contact tips. */}
      <mesh position={[-0.005, 0, 0]}>
        <sphereGeometry args={[0.012, 10, 8]}/>
        <meshStandardMaterial color="#d6dbe3" metalness={0.92} roughness={0.18}/>
      </mesh>
    </group>
  </group>;
}

/** Small three-terminal mechanical slide switch, changeover SPDT. */
export function SlideSwitchMesh({ part, selected }: { part: PlacedPart; selected: boolean }) {
  const names = ['no', 'com', 'nc'] as const;
  const pins = names.map(name => terminal(part, name));
  if (pins.some(pin => !pin)) return null;
  const points = pins as THREE.Vector3[];
  const center = points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3);
  center.y = BOARD.height + 0.13;
  const direction = points[2].clone().sub(points[0]).setY(0);
  if (direction.lengthSq() < 1e-6) return null;
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), direction.normalize());
  const position = part.props.switchPosition ?? 'no';
  const sliderX = position === 'nc' ? 0.13 : position === 'open' ? 0 : -0.13;
  return <group onClick={(event) => { event.stopPropagation(); switchInteraction(part); }}>
    {points.map((pin, i) => <MetalLead key={names[i]} start={pin} end={center.clone().add(new THREE.Vector3((i-1)*0.2, -0.015, 0).applyQuaternion(orientation))}/>)}
    <group position={center} quaternion={orientation}>
      {/* Metal mounting plate, black phenolic body, rounded corner caps. */}
      <mesh position={[0, -0.022, 0]} castShadow>
        <boxGeometry args={[0.64, 0.08, 0.30]}/>
        <meshStandardMaterial color="#798592" metalness={0.65} roughness={0.26}/>
      </mesh>
      <mesh position={[0, 0.035, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.16, 0.27]}/>
        <meshPhysicalMaterial color={selected ? '#283d55' : '#151b25'} roughness={0.35} metalness={0.1}/>
      </mesh>
      {/* Sunken slider slot / black inset. */}
      <mesh position={[0, 0.123, 0]}>
        <boxGeometry args={[0.43, 0.008, 0.12]}/>
        <meshStandardMaterial color="#040609" roughness={0.78}/>
      </mesh>
      <mesh position={[sliderX, 0.154, 0]} castShadow>
        <boxGeometry args={[0.155, 0.09, 0.16]}/>
        <meshStandardMaterial color="#d2d9df" roughness={0.42} metalness={0.04}/>
      </mesh>
      <mesh position={[sliderX, 0.207, 0]} castShadow>
        <boxGeometry args={[0.10, 0.02, 0.12]}/>
        <meshStandardMaterial color="#9ca7b1" roughness={0.5}/>
      </mesh>
      {[-0.265, 0.265].map(x => <mesh key={x} position={[x, 0.122, 0]} rotation={[-Math.PI/2, 0, 0]}>
        <cylinderGeometry args={[0.016, 0.016, 0.01, 12]}/>
        <meshStandardMaterial color="#adb5c2" metalness={0.82} roughness={0.23}/>
      </mesh>)}
    </group>
  </group>;
}
