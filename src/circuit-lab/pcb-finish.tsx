/** High-detail, non-interactive printed finish for the Arduino circuit board.
 * Generated locally to avoid multi-megabyte meshes and missing external textures.
 * This is a visual approximation, not an electrical trace/netlist or exact Uno PCB layout.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export function ArduinoPcbFinish({ width, depth, thickness }: {
  width: number; depth: number; thickness: number;
}) {
  const surface = useRef<THREE.Mesh>(null);
  const worldPoint = useMemo(() => new THREE.Vector3(), []);
  // Automatic detail scaling: a tiny label texture should not consume a draw call
  // when its board is only a few pixels wide. Geometry and clickable sockets remain.
  useFrame(({ camera }) => {
    const mesh = surface.current;
    if (!mesh) return;
    mesh.getWorldPosition(worldPoint);
    mesh.visible = camera.position.distanceToSquared(worldPoint) < 26 * 26;
  });
  const map = useMemo(() => {
    const size = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // All artwork is transparent; the physical blue solder mask comes from the PCB mesh.
    ctx.clearRect(0, 0, size, size);
    let seed = 183721;
    const rand = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    // Curved, fine copper under-mask routing; deliberately low contrast.
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 115; i++) {
      const x = 78 + rand() * 852;
      const y = 105 + rand() * 805;
      const horizontal = rand() > 0.5;
      const len = 16 + rand() * 110;
      const kink = 7 + rand() * 24;
      ctx.lineWidth = 0.75 + rand() * 1.3;
      ctx.strokeStyle = i % 7 === 0 ? 'rgba(138,190,231,.3)' : 'rgba(64,154,211,.27)';
      ctx.beginPath(); ctx.moveTo(x, y);
      if (horizontal) { ctx.lineTo(x + len * 0.6, y); ctx.lineTo(x + len * 0.6 + kink, y + kink); }
      else { ctx.lineTo(x, y + len * 0.6); ctx.lineTo(x + kink, y + len * 0.6 + kink); }
      ctx.stroke();
      // Via plating; these tiny rings are visually plausible but not physical holes.
      ctx.beginPath(); ctx.arc(x, y, 2 + rand() * 1.3, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(191,159,91,.5)'; ctx.lineWidth = 1.2; ctx.stroke();
    }
    // Solder-mask documentation markings: fine, applied to the board rather than floating.
    ctx.strokeStyle = 'rgba(222,243,255,.28)'; ctx.lineWidth = 2;
    ctx.strokeRect(105, 152, 790, 720);
    ctx.font = 'bold 40px Arial, sans-serif'; ctx.fillStyle = 'rgba(234,246,255,.9)';
    ctx.fillText('UNO', 478, 565);
    ctx.font = 'bold 18px Arial, sans-serif'; ctx.fillStyle = 'rgba(224,240,252,.72)';
    ctx.fillText('DIGITAL (PWM~)', 370, 133);
    ctx.fillText('POWER', 160, 884);
    ctx.fillText('ANALOG IN', 658, 884);
    ctx.font = '14px Arial, sans-serif'; ctx.fillStyle = 'rgba(215,238,250,.52)';
    ctx.fillText('ELECTROLAB · INTERACTIVE PCB', 384, 632);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8;
    return texture;
  }, []);
  useEffect(() => () => map?.dispose(), [map]);
  if (!map) return null;
  return <mesh ref={surface} position={[0, thickness / 2 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
    <planeGeometry args={[width - 0.04, depth - 0.04]} />
    <meshBasicMaterial map={map} transparent opacity={0.88} depthWrite={false} polygonOffset polygonOffsetFactor={-2} />
  </mesh>;
}
