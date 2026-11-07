/**
 * Low-cost, procedural manufacturing details for the 3D laboratory.
 * Lettering is drawn directly onto the actual 3D part (not HTML overlays),
 * so it has consistent perspective, occlusion, and shadows.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { BOARD, holePosition, getBoardPreset, type BoardPresetId } from '@/circuit/breadboard';

export function formatResistance(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'R';
  if (value >= 1e6) return `${+(value / 1e6).toPrecision(3)}MΩ`;
  if (value >= 1e3) return `${+(value / 1e3).toPrecision(3)}kΩ`;
  if (value < 1 && value > 0) return `${+(value * 1e3).toPrecision(3)}mΩ`;
  return `${+value.toPrecision(3)}Ω`;
}

export function formatCapacitance(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'C';
  if (value >= 1e-3) return `${+(value * 1e3).toPrecision(3)}mF`;
  if (value >= 1e-6) return `${+(value * 1e6).toPrecision(3)}µF`;
  if (value >= 1e-9) return `${+(value * 1e9).toPrecision(3)}nF`;
  return `${+(value * 1e12).toPrecision(3)}pF`;
}

export function PrintedMark({
  text,
  secondary,
  position,
  rotation,
  width = 0.2,
  height = 0.08,
  color = '#e2e8f0',
  opacity = 0.88,
}: {
  text: string;
  secondary?: string;
  position: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  color?: string;
  opacity?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const context = canvas.getContext('2d');
    if (!context) return null;
    context.clearRect(0, 0, 512, 256);
    context.fillStyle = color;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '700 118px Arial, sans-serif';
    context.fillText(text, 256, secondary ? 95 : 137, 470);
    if (secondary) {
      context.font = '600 79px Arial, sans-serif';
      context.fillText(secondary, 256, 205, 470);
    }
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 4;
    return result;
  }, [text, secondary, color]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <mesh position={position} rotation={rotation} renderOrder={5} raycast={() => null}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} color="#ffffff" transparent opacity={opacity} depthWrite={false}
        side={THREE.DoubleSide} polygonOffset polygonOffsetFactor={-2} toneMapped={false} />
    </mesh>
  );
}

/**
 * A single transparent texture containing molded-board numbers, row letters,
 * polarity icons, manufacturer marks and pitch references. One draw call per
 * board instead of hundreds of HTML labels.
 */
export function BreadboardSilkscreen({ boardId }: { boardId: BoardPresetId }) {
  const texture = useMemo(() => {
    const preset = getBoardPreset(boardId);
    const width = 3072;
    const height = boardId === 'full-1660' ? 2048 : 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const px = (x: number) => (x / BOARD.width + 0.5) * width;
    const py = (z: number) => (z / BOARD.depth + 0.5) * height;
    const scale = Math.min(width / BOARD.width, height / BOARD.depth);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(58,65,73,.78)';
    ctx.font = `700 ${Math.max(10, Math.round(scale * 0.085))}px Arial, sans-serif`;

    const strips = boardId === 'full-1660'
      ? [['A', 'B', 'C', 'D', 'E'], ['F', 'G', 'H', 'I', 'J'], ['K', 'L', 'M', 'N', 'O'], ['P', 'Q', 'R', 'S', 'T']]
      : [['A', 'B', 'C', 'D', 'E'], ['F', 'G', 'H', 'I', 'J']];

    const firstColX = holePosition('A1')[0];
    const lastColX = holePosition(`A${preset.cols}`)[0];
    for (const rows of strips) {
      const zFirst = holePosition(`${rows[0]}1`)[2];
      const zLast = holePosition(`${rows[rows.length - 1]}1`)[2];
      const numberZ = zFirst - 0.22;
      // Column numbers printed every five sockets (including both ends).
      for (let col = 1; col <= preset.cols; col++) {
        if (col !== 1 && col !== preset.cols && col % 5 !== 0) continue;
        ctx.fillText(String(col), px(holePosition(`${rows[0]}${col}`)[0]), py(numberZ));
      }
      for (const row of rows) {
        const z = holePosition(`${row}1`)[2];
        ctx.fillText(row, px(firstColX - 0.29), py(z));
        ctx.fillText(row, px(lastColX + 0.29), py(z));
      }
      // Fine molded guide line along the strip edge.
      ctx.strokeStyle = 'rgba(99,106,113,.14)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px(firstColX - 0.12), py(zLast + 0.19));
      ctx.lineTo(px(lastColX + 0.12), py(zLast + 0.19));
      ctx.stroke();
    }
    // Top/bottom rail polarity printed on the cream-colored housing.
    if (preset.hasRails) {
      const railPairs = boardId === 'full-1660'
        ? [['otp', 'otn'], ['itp', 'itn'], ['ibp', 'ibn'], ['obp', 'obn']]
        : [['tp', 'tn'], ['bp', 'bn']];
      ctx.font = `700 ${Math.max(13, Math.round(scale * 0.13))}px Arial, sans-serif`;
      for (const [positive, negative] of railPairs) {
        const zPlus = holePosition(`${positive}1`)[2];
        const zMinus = holePosition(`${negative}1`)[2];
        const railLeft = holePosition(`${positive}1`)[0];
        const railRight = holePosition(`${positive}${preset.railHoles}`)[0];
        ctx.fillStyle = '#b91c1c';
        ctx.fillText('+', px(railLeft - 0.22), py(zPlus));
        ctx.fillText('+', px(railRight + 0.22), py(zPlus));
        ctx.fillStyle = '#1d4ed8';
        ctx.fillText('−', px(railLeft - 0.22), py(zMinus));
        ctx.fillText('−', px(railRight + 0.22), py(zMinus));
      }
    }
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    result.anisotropy = 8;
    return result;
  }, [boardId]);

  useEffect(() => () => texture?.dispose(), [texture]);
  if (!texture) return null;
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, BOARD.height + 0.084, 0]} raycast={() => null}>
        <planeGeometry args={[BOARD.width, BOARD.depth]} />
        <meshBasicMaterial map={texture} transparent depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <PrintedMark text="ELECTROLAB"
        secondary={boardId === 'full-1660' ? 'DUAL 830 • 1660 CONTACTS' : '2.54mm PROTO BOARD'}
        position={[0, BOARD.height + 0.043, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        width={boardId === 'full-1660' ? 2.05 : 1.2}
        height={boardId === 'full-1660' ? 0.24 : 0.18}
        color="#516c7a" opacity={0.8} />
    </group>
  );
}
