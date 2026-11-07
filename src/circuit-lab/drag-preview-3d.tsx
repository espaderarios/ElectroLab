import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { BOARD, holePosition } from '@/circuit/breadboard'
import { mcuBoardOrigin } from '@/circuit/mcu-headers'
import type { ToolId } from '@/circuit/types'
import { buildPreviewPart, useLab } from '@/store/lab'
import { PartSwitch } from './parts-3d'

/**
 * The palette uses the very same 3D mesh as the workbench, not a schematic icon.
 * This small WebGL view exists only during a drag outside the workbench. Once
 * the pointer is over the board, scene.tsx renders the actual snapped model.
 */
export function DraggedPart3D({ tool }: { tool: ToolId }) {
  const resistorValue = useLab((s) => s.resistorValue)
  const capacitorValue = useLab((s) => s.capacitorValue)
  const ledColor = useLab((s) => s.ledColor)
  const transistorModel = useLab((s) => s.transistorModel)
  const thyristorModel = useLab((s) => s.thyristorModel)
  const triacModel = useLab((s) => s.triacModel)
  const diacModel = useLab((s) => s.diacModel)
  const motorModel = useLab((s) => s.motorModel)
  const sim = useLab((s) => s.sim)

  const part = useMemo(() => buildPreviewPart(tool, 'E10', {
    resistorValue, capacitorValue, ledColor, transistorModel,
    thyristorModel, triacModel, diacModel, motorModel,
  }), [tool, resistorValue, capacitorValue, ledColor, transistorModel,
    thyristorModel, triacModel, diacModel, motorModel])

  const framing = useMemo(() => {
    if (!part) return { x: 0, z: 0, zoom: 52 }
    if (part.kind === 'mcu') {
      const [x,,z]=mcuBoardOrigin(part)
      return {x,z,zoom:42}
    }
    const points = Object.values(part.pins)
      .filter((hole) => hole && /^[A-T]\d+$/.test(hole))
      .map((hole) => holePosition(hole))
    if (!points.length) return { x: 0, z: 0, zoom: 52 }
    const xs = points.map(([x]) => x)
    const zs = points.map(([, , z]) => z)
    const span = Math.max(...xs) - Math.min(...xs)
    const longPart = ['mcu', 'lcd', 'oled', 'motor', 'servo'].includes(part.kind)
    // Orthographic previews make small resistors readable and big MCU boards fit.
    return {
      x: (Math.min(...xs) + Math.max(...xs)) / 2,
      z: (Math.min(...zs) + Math.max(...zs)) / 2,
      zoom: Math.min(95, Math.max(30, 105 / Math.max(1, span + (longPart ? 1.6 : 0.3)))),
    }
  }, [part])

  if (!part) return null

  return (
    <div className="h-[126px] w-[155px] overflow-hidden" style={{ filter: 'drop-shadow(0 9px 9px rgba(0,0,0,.55))' }}>
      <Canvas
        orthographic
        camera={{ position: [5, 7, 9], zoom: framing.zoom, near: 0.1, far: 100 }}
        dpr={[1, 1.5]}
        frameloop="demand"
        gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
        style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
      >
        <ambientLight intensity={1.5} />
        <hemisphereLight intensity={0.9} color="#eaf7ff" groundColor="#173152" />
        <directionalLight position={[4, 8, 5]} intensity={1.8} />
        {/* Move the actual world-space mesh to the preview camera's origin. */}
        <group position={[-framing.x, -BOARD.height - 0.12, -framing.z]}>
          <PartSwitch part={part} selected={false} sim={sim} />
        </group>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]}>
          <circleGeometry args={[1.25, 36]} />
          <meshBasicMaterial color="#25d9ff" transparent opacity={0.08} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </Canvas>
    </div>
  )
}
