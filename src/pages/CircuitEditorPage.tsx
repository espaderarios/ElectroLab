import { type GraphicsQuality, isGraphicsQuality } from '@/circuit-lab/graphics-quality';
import { PhysicalBreadboard2D, PHYSICAL_2D_DROP_EVENT, PHYSICAL_2D_DRAG_EVENT, PHYSICAL_2D_DRAG_END_EVENT } from '@/circuit-lab/breadboard-2d';
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Play,
  Search,
  Plus,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Move,
  MousePointer2,
  Trash2,
  RotateCw,
  HelpCircle,
  Download,
  Hand,
  Cable,
  Maximize2,
  Focus,
  Star,
  Clock3,
  Check,
  RotateCcw,
  ChevronDown,
  Keyboard,
  Cpu,
  CircuitBoard,
  BookOpen,
  LayoutGrid,
  Settings2,
  Monitor,
  Info,
  CheckCircle2,
  Code2,
  Activity,
  ChevronUp,
  SlidersHorizontal,
  PanelTopClose,
  PanelTopOpen,
  Zap,
} from 'lucide-react'

import HelpModal from '../components/HelpModal'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, Component, type ReactNode } from 'react'
import { useLab } from '../store/lab'
import { nextToggleableTool, type ToggleableTool } from '../circuit/editor-toolbar-state'
import { freshPremadeCircuit, useProjects } from '../store/projects'
import { WIRE_HEX, type ToolId, type WireColor, type WireStyle, type TransistorModelId, type MotorModelId } from '../circuit/types'
import { Button } from '@/components/ui/button';
import { EXPANSION_COMPONENTS, EXPANSION_CATEGORIES } from '@/circuit/expansion-catalog';
import {
  BOARD_PRESETS,
  holeStrip,
  nearestHole,
  type BoardPresetId,
} from '../circuit/breadboard'
import type { HoleId } from '../circuit/types'
import * as THREE from 'three'
import { isControllerTool, constrainBenchPoint, type BenchPoint } from '@/circuit/offboard-controllers'

import { StudioProperties } from '../circuit-lab/studio-properties'
import { WorkbenchUtilities } from '../circuit-lab/workbench-utilities'
import type { WorkbenchPanelTab } from '../circuit-lab/workbench-dock'

const CircuitLab = lazy(() =>
  import('../circuit-lab/index').then((m) => ({ default: m.CircuitLab })),
)
const DraggedPart3D = lazy(() =>
  import('../circuit-lab/drag-preview-3d').then((m) => ({ default: m.DraggedPart3D })),
)



class LabErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error) {
    console.warn('[CircuitLab] failed to load:', error.message)
  }

  render() {
    if (this.state.hasError) return this.props.fallback
    return this.props.children
  }
}

const ResistorSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="24">
    <path
      d="M2 12H9L12 5L16 19L20 5L24 19L28 5L32 19L35 12H46"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const CapacitorSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="24">
    <path
      d="M2 12H18M30 12H46M18 4V20M30 4V20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const InductorSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="24">
    <path
      d="M2 12H7C7 4 13 4 13 12C13 4 19 4 19 12C19 4 25 4 25 12C25 4 31 4 31 12H46"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
  </svg>
);

const DiodeSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="24">
    <path
      d="M2 12H16L28 4V20L16 12M28 4V20M28 12H46"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

const LedSymbol = () => (
  <svg viewBox="0 0 48 32" width="34" height="26">
    <path
      d="M2 16H15L27 8V24L15 16M27 8V24M27 16H46"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M18 7L23 2M26 7L31 2"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const TransistorSymbol = () => (
  <svg viewBox="0 0 48 36" width="34" height="27">
    <path
      d="M15 5V31M15 18H27M27 18L41 8M27 18L41 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path
      d="M36 8L41 8L39 13"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />
  </svg>
);

/** Classic SCR / thyristor schematic symbol (anode top, cathode bottom, gate side). */
const ThyristorSymbol = () => (
  <svg viewBox="0 0 48 36" width="34" height="27">
    <path
      d="M24 4V10M24 26V32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* diode triangle */}
    <path d="M14 10L34 10L24 24Z" fill="currentColor" opacity="0.85" />
    {/* cathode bar */}
    <path
      d="M14 26H34"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    {/* gate lead */}
    <path
      d="M24 18H38"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/** TRIAC schematic: two SCR triangles back-to-back with gate. */
const TriacSymbol = () => (
  <svg viewBox="0 0 48 36" width="34" height="27">
    <path
      d="M24 3V9M24 27V33"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M14 9L34 9L24 18Z" fill="currentColor" opacity="0.9" />
    <path d="M14 27L34 27L24 18Z" fill="currentColor" opacity="0.55" />
    <path
      d="M24 18H38"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

/** DIAC schematic: bidirectional breakover diode. */
const DiacSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="20">
    <path
      d="M6 12H14M34 12H42"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <path d="M14 5L24 12L14 19Z" fill="currentColor" opacity="0.9" />
    <path d="M34 5L24 12L34 19Z" fill="currentColor" opacity="0.55" />
  </svg>
);

/** Simple DC motor symbol (circle + shaft). */
const MotorSymbol = () => (
  <svg viewBox="0 0 48 36" width="34" height="27">
    <circle
      cx="20"
      cy="18"
      r="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <text
      x="20"
      y="22"
      textAnchor="middle"
      fontSize="12"
      fill="currentColor"
      fontFamily="sans-serif"
    >
      M
    </text>
    <path
      d="M31 18H42"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const SwitchSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="24">
    <circle cx="7" cy="16" r="2.5" fill="currentColor" />
    <circle cx="41" cy="16" r="2.5" fill="currentColor" />
    <path
      d="M9 16L35 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const PushButtonSymbol = () => (
  <svg viewBox="0 0 48 24" width="34" height="24">
    <circle cx="7" cy="17" r="2.5" fill="currentColor" />
    <circle cx="41" cy="17" r="2.5" fill="currentColor" />
    <path
      d="M9 17H16L21 8H31L39 17"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const RelaySymbol = () => (
  <svg viewBox="0 0 48 28" width="34" height="24">
    <path
      d="M2 14H12M36 14H46"
      stroke="currentColor"
      strokeWidth="2"
    />
    <rect
      x="12"
      y="5"
      width="24"
      height="18"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M17 19C17 11 31 11 31 19"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const PotentiometerSymbol = () => (
  <svg viewBox="0 0 48 28" width="34" height="24">
    <path
      d="M2 14H10M38 14H46"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M10 14L14 7L18 21L22 7L26 21L30 7L34 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <path
      d="M24 2V9M20 6L24 2L28 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
    />
  </svg>
);

const VoltmeterSymbol = () => (
  <svg viewBox="0 0 48 32" width="34" height="26">
    <path
      d="M2 16H11M37 16H46"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <circle
      cx="24"
      cy="16"
      r="11"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />
    <text
      x="24"
      y="21"
      textAnchor="middle"
      fontSize="13"
      fontWeight="600"
      fill="currentColor"
    >
      V
    </text>
  </svg>
);

const BuzzerSymbol = () => (
  <svg viewBox="0 0 48 32" width="34" height="26">
    <path
      d="M2 16H10M38 16H46"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M10 10V22L22 26V6L10 10Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    <path
      d="M28 11C33 13 33 19 28 21"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />

    <path
      d="M32 7C40 11 40 21 32 25"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const SpeakerSymbol = () => (
  <svg viewBox="0 0 48 32" width="34" height="26">
    <path
      d="M2 16H10"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M10 11V21H16L25 27V5L16 11H10Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    />

    <path
      d="M30 10C35 13 35 19 30 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />

    <path
      d="M34 6C42 11 42 21 34 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

const LcdSymbol = () => (
  <svg viewBox="0 0 48 32" width="34" height="26">
    <rect
      x="5"
      y="5"
      width="38"
      height="22"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />

    <rect
      x="10"
      y="10"
      width="28"
      height="12"
      rx="1"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />

    <path
      d="M13 14H16M19 14H22M25 14H28M31 14H34"
      stroke="currentColor"
      strokeWidth="1.5"
    />

    <path
      d="M13 18H18M21 18H25M28 18H34"
      stroke="currentColor"
      strokeWidth="1.5"
    />
  </svg>
);

const OledSymbol = () => (
  <svg viewBox="0 0 48 32" width="34" height="26">
    <rect
      x="5"
      y="4"
      width="38"
      height="24"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />

    <rect
      x="10"
      y="8"
      width="28"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
    />

    <path
      d="M13 12H18M21 12H26M29 12H35M13 17H16M19 17H24M27 17H35"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const McuSymbol = () => (
  <svg viewBox="0 0 48 36" width="34" height="27">
    <rect
      x="12"
      y="7"
      width="24"
      height="22"
      rx="2"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    />

    <path
      d="
        M12 11H6
        M12 16H6
        M12 21H6
        M12 26H6
        M36 11H42
        M36 16H42
        M36 21H42
        M36 26H42
      "
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
    />

    <text
      x="24"
      y="21"
      textAnchor="middle"
      fontSize="7"
      fontWeight="600"
      fill="currentColor"
    >
      MCU
    </text>
  </svg>
);

const GateSymbol = ({ label }: { label: string }) => (
  <svg viewBox="0 0 48 36" width="34" height="27">
    <rect x="9" y="5" width="30" height="26" rx="3" fill="none" stroke="currentColor" strokeWidth="2" />
    <path d="M3 13H9M3 23H9M39 18H45M24 5V2M24 31V34" stroke="currentColor" strokeWidth="1.5" />
    <text x="24" y="21" textAnchor="middle" fontSize="7" fontWeight="700" fill="currentColor">{label}</text>
  </svg>
)

const SCH_STROKE = '#1d4ed8'
const SCH_LABEL = '#1e3a8a'

/** Classic schematic symbols (Multisim-style) for 2D view. */
function SchResistor({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}>
      <path
        d="M-28 0 H-16 l4-10 8 20 8-20 8 20 8-20 4 10 H28"
        fill="none"
        stroke={SCH_STROKE}
        strokeWidth="2"
      />
    </g>
  )
}

function SchCapacitor({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}>
      <line x1="-28" y1="0" x2="-4" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-4" y1="-12" x2="-4" y2="12" stroke={SCH_STROKE} strokeWidth="2.5" />
      <line x1="4" y1="-12" x2="4" y2="12" stroke={SCH_STROKE} strokeWidth="2.5" />
      <line x1="4" y1="0" x2="28" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
    </g>
  )
}

function SchDiode({ x, y, rot = 0 }: { x: number; y: number; rot?: number }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rot})`}>
      <line x1="-28" y1="0" x2="-8" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <path d="M-8 -10 L8 0 L-8 10 Z" fill="none" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="8" y1="-10" x2="8" y2="10" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="8" y1="0" x2="28" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
    </g>
  )
}

function SchLed({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="-28" y1="0" x2="-8" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <path
        d="M-8 -10 L8 0 L-8 10 Z"
        fill={on ? 'rgba(248,113,113,0.35)' : 'none'}
        stroke={SCH_STROKE}
        strokeWidth="2"
      />
      <line x1="8" y1="-10" x2="8" y2="10" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="8" y1="0" x2="28" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <path d="M12 -14 L18 -20 M14 -12 L22 -16" fill="none" stroke={SCH_STROKE} strokeWidth="1.5" />
    </g>
  )
}

function SchNpn({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx="0" cy="0" r="16" fill="none" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-28" y1="0" x2="-8" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-8" y1="-10" x2="-8" y2="10" stroke={SCH_STROKE} strokeWidth="2.5" />
      <line x1="-8" y1="-6" x2="10" y2="-14" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-8" y1="6" x2="10" y2="14" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="10" y1="-14" x2="10" y2="-28" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="10" y1="14" x2="10" y2="28" stroke={SCH_STROKE} strokeWidth="2" />
      {/* arrow on emitter */}
      <path d="M4 10 L10 14 L6 16" fill="none" stroke={SCH_STROKE} strokeWidth="1.5" />
    </g>
  )
}

function SchPnp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle cx="0" cy="0" r="16" fill="none" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-28" y1="0" x2="-8" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-8" y1="-10" x2="-8" y2="10" stroke={SCH_STROKE} strokeWidth="2.5" />
      <line x1="-8" y1="-6" x2="10" y2="-14" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-8" y1="6" x2="10" y2="14" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="10" y1="-14" x2="10" y2="-28" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="10" y1="14" x2="10" y2="28" stroke={SCH_STROKE} strokeWidth="2" />
      <path d="M10 14 L4 10 L8 8" fill="none" stroke={SCH_STROKE} strokeWidth="1.5" />
    </g>
  )
}

function SchSwitch({ x, y, closed }: { x: number; y: number; closed?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="-24" y1="0" x2="-8" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <circle cx="-8" cy="0" r="3" fill="#fff" stroke={SCH_STROKE} strokeWidth="1.5" />
      <line
        x1="-8"
        y1="0"
        x2="12"
        y2={closed ? 0 : -12}
        stroke={SCH_STROKE}
        strokeWidth="2"
      />
      <circle cx="14" cy="0" r="3" fill="#fff" stroke={SCH_STROKE} strokeWidth="1.5" />
      <line x1="14" y1="0" x2="28" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
    </g>
  )
}

function SchBuzzer({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="-20" y1="-10" x2="-20" y2="10" stroke={SCH_STROKE} strokeWidth="2" />
      <path
        d="M-20 -10 Q0 -18 12 0 Q0 18 -20 10"
        fill={on ? 'rgba(250,204,21,0.25)' : 'none'}
        stroke={SCH_STROKE}
        strokeWidth="2"
      />
    </g>
  )
}

function SchMotor({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <circle
        cx="0"
        cy="0"
        r="16"
        fill={on ? 'rgba(251,191,36,0.25)' : 'none'}
        stroke={SCH_STROKE}
        strokeWidth="2"
      />
      <text x="0" y="4" textAnchor="middle" fill={SCH_STROKE} fontSize="12" fontWeight="700">
        M
      </text>
      <line x1="-28" y1="0" x2="-16" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="16" y1="0" x2="28" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
    </g>
  )
}

function SchScr({ x, y, on }: { x: number; y: number; on?: boolean }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-28" x2="0" y2="-8" stroke={SCH_STROKE} strokeWidth="2" />
      <path
        d="M-10 -8 L10 -8 L0 8 Z"
        fill={on ? 'rgba(34,197,94,0.25)' : 'none'}
        stroke={SCH_STROKE}
        strokeWidth="2"
      />
      <line x1="-12" y1="8" x2="12" y2="8" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="0" y1="8" x2="0" y2="28" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="0" y1="0" x2="22" y2="8" stroke={SCH_STROKE} strokeWidth="2" />
    </g>
  )
}

function SchVcc({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="16" x2="0" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-10" y1="0" x2="10" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <text x="0" y="-8" textAnchor="middle" fill="#b91c1c" fontSize="11" fontWeight="700">
        {label}
      </text>
    </g>
  )
}

function SchGnd({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <line x1="0" y1="-12" x2="0" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-12" y1="0" x2="12" y2="0" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-8" y1="5" x2="8" y2="5" stroke={SCH_STROKE} strokeWidth="2" />
      <line x1="-4" y1="10" x2="4" y2="10" stroke={SCH_STROKE} strokeWidth="2" />
      <text x="0" y="24" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="700">
        GND
      </text>
    </g>
  )
}

/**
 * Multisim-style schematic 2D view.
 * Parts are laid out left→right; nets are drawn between pins that share a breadboard strip / wire.
 */
function SchematicFallback() {
  const parts = useLab((s) => s.parts)
  const wires = useLab((s) => s.wires)
  const sim = useLab((s) => s.sim)
  const select = useLab((s) => s.select)
  const selectedId = useLab((s) => s.selectedId)
  const powerOn = useLab((s) => s.powerOn)
  const psuVoltage = useLab((s) => s.psuVoltage)
  const psuPositive = useLab((s) => s.psuPositive)
  const psuNegative = useLab((s) => s.psuNegative)
  const partDragEnabled = useLab((state) => state.partDragEnabled)
  const setPartDragEnabled = useLab((state) => state.setPartDragEnabled)

  // ---- electrical nets (strip + explicit wires) ----
  type UF = { parent: Map<string, string> }
  const uf: UF = { parent: new Map() }
  const find = (a: string): string => {
    const p = uf.parent.get(a)
    if (!p || p === a) {
      uf.parent.set(a, a)
      return a
    }
    const r = find(p)
    uf.parent.set(a, r)
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) uf.parent.set(ra, rb)
  }

  for (const w of wires) {
    try {
      union(holeStrip(w.a as any), holeStrip(w.b as any))
    } catch {
      union(w.a, w.b)
    }
  }
  for (const part of parts) {
    for (const h of Object.values(part.pins)) {
      if (!h) continue
      try {
        find(holeStrip(h as any))
      } catch {
        find(h)
      }
    }
  }

  const netOf = (hole: string) => {
    try {
      return find(holeStrip(hole as any))
    } catch {
      return find(hole)
    }
  }

  // ---- layout: one column per part ----
  const gapX = 110
  const originX = 80
  const midY = 200
  const layout = parts.map((part, i) => ({
    part,
    x: originX + i * gapX,
    y: midY,
  }))

  // Pin anchors on each symbol (schematic terminal positions)
  const anchors = (kind: string, x: number, y: number): Record<string, { x: number; y: number }> => {
    switch (kind) {
      case 'resistor':
      case 'inductor':
        return { a: { x: x - 28, y }, b: { x: x + 28, y } }
      case 'capacitor':
        return { a: { x: x - 28, y }, b: { x: x + 28, y } }
      case 'diode':
      case 'led':
        return { a: { x: x - 28, y }, k: { x: x + 28, y } }
      case 'button':
      case 'switch':
        return { a: { x: x - 24, y }, b: { x: x + 28, y } }
      case 'buzzer':
      case 'speaker':
        return { a: { x: x - 20, y: y - 8 }, b: { x: x - 20, y: y + 8 } }
      case 'motor':
        return { a: { x: x - 28, y }, b: { x: x + 28, y } }
      case 'not':
        return {
          a: { x: x - 28, y: y - 10 },
          y: { x: x + 28, y },
          vcc: { x, y: y - 28 },
          gnd: { x, y: y + 28 },
          b: { x: x - 28, y: y + 10 },
        }
      case 'and':
      case 'or':
      case 'nand':
      case 'nor':
      case 'xor':
      case 'xnor':
        return {
          a: { x: x - 28, y: y - 10 },
          b: { x: x - 28, y: y + 10 },
          y: { x: x + 28, y },
          vcc: { x, y: y - 28 },
          gnd: { x, y: y + 28 },
        }
      case 'transistor':
        return {
          b: { x: x - 28, y },
          c: { x: x + 10, y: y - 28 },
          e: { x: x + 10, y: y + 28 },
        }
      case 'thyristor':
        return {
          a: { x, y: y - 28 },
          k: { x, y: y + 28 },
          g: { x: x + 22, y: y + 8 },
        }
      case 'triac':
        return {
          mt1: { x: x - 20, y: y + 20 },
          mt2: { x: x + 20, y: y - 20 },
          g: { x: x + 24, y: y + 8 },
        }
      default:
        return { a: { x: x - 20, y }, b: { x: x + 20, y } }
    }
  }

  // Map hole → screen terminal for every part pin
  const holeToPts: { hole: string; x: number; y: number; net: string }[] = []
  for (const item of layout) {
    const pins = anchors(item.part.kind, item.x, item.y)
    for (const [name, hole] of Object.entries(item.part.pins)) {
      if (!hole || !pins[name]) continue
      const pt = pins[name]
      holeToPts.push({ hole, x: pt.x, y: pt.y, net: netOf(hole) })
    }
  }

  // Supply terminals
  const vccY = 48
  const gndY = 360
  if (psuPositive) {
    holeToPts.push({
      hole: psuPositive,
      x: 40,
      y: vccY + 16,
      net: netOf(psuPositive),
    })
  }
  if (psuNegative) {
    holeToPts.push({
      hole: psuNegative,
      x: 40,
      y: gndY - 12,
      net: netOf(psuNegative),
    })
  }

  // Group by net → polyline connecting all terminals on that net
  const nets = new Map<string, { x: number; y: number }[]>()
  for (const p of holeToPts) {
    const list = nets.get(p.net) || []
    list.push({ x: p.x, y: p.y })
    nets.set(p.net, list)
  }

  const width = Math.max(720, originX + parts.length * gapX + 80)
  const height = 420

  return (
    <div className="absolute inset-0 overflow-auto bg-[#f8fafc]">
      <svg width={width} height={height} className="block mx-auto my-2">
        {/* dotted schematic paper */}
        <defs>
          <pattern id="sch-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#cbd5e1" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="#f8fafc" />
        <rect width={width} height={height} fill="url(#sch-grid)" />

        <text x="16" y="22" fill="#64748b" fontSize="11">
          Schematic view · click a symbol to select on the breadboard
        </text>

        {/* Net wires (orthogonal-ish: hub at average, then stubs) */}
        {[...nets.entries()].map(([net, pts]) => {
          if (pts.length < 2) return null
          const hx = pts.reduce((s, p) => s + p.x, 0) / pts.length
          const hy = pts.reduce((s, p) => s + p.y, 0) / pts.length
          return (
            <g key={net}>
              {pts.map((p, i) => (
                <path
                  key={i}
                  d={`M ${p.x} ${p.y} L ${p.x} ${hy} L ${hx} ${hy}`}
                  fill="none"
                  stroke={SCH_STROKE}
                  strokeWidth="1.75"
                />
              ))}
              <circle cx={hx} cy={hy} r="2.2" fill={SCH_STROKE} />
            </g>
          )
        })}

        {/* VCC / GND symbols */}
        {psuPositive && (
          <SchVcc
            x={40}
            y={vccY}
            label={powerOn ? `${psuVoltage.toFixed(1)}V` : 'VCC'}
          />
        )}
        {psuNegative && <SchGnd x={40} y={gndY} />}

        {/* Component symbols */}
        {layout.map(({ part, x, y }) => {
          const selected = selectedId === part.id
          const ledOn = Boolean(sim.leds?.[part.id]?.on)
          const motorOn = Boolean(sim.motors?.[part.id]?.on)
          const buzzOn = Boolean(sim.speakers?.[part.id]?.on)
          const scrOn = Boolean(sim.thyristors?.[part.id]?.conducting)
          const closed = Boolean(part.props.closed)
          const label =
            part.props.label ||
            (part.kind === 'resistor' && part.props.resistance
              ? `${part.props.resistance >= 1000 ? `${part.props.resistance / 1000}k` : part.props.resistance}`
              : part.kind === 'capacitor' && part.props.capacitance
                ? `${(part.props.capacitance * 1e6).toPrecision(3)}u`
                : part.kind.toUpperCase())

          let body: ReactNode = (
            <SchResistor x={x} y={y} />
          )
          if (part.kind === 'capacitor') body = <SchCapacitor x={x} y={y} />
          else if (part.kind === 'diode') body = <SchDiode x={x} y={y} />
          else if (part.kind === 'led') body = <SchLed x={x} y={y} on={ledOn} />
          else if (part.kind === 'transistor') {
            const model = String(part.props.transistorModel || '')
            body = /3906|557|pnp|tip32|bc558/i.test(model) ? (
              <SchPnp x={x} y={y} />
            ) : (
              <SchNpn x={x} y={y} />
            )
          } else if (part.kind === 'switch' || part.kind === 'button')
            body = <SchSwitch x={x} y={y} closed={closed} />
          else if (part.kind === 'buzzer' || part.kind === 'speaker')
            body = <SchBuzzer x={x} y={y} on={buzzOn} />
          else if (part.kind === 'motor') body = <SchMotor x={x} y={y} on={motorOn} />
          else if (part.kind === 'thyristor' || part.kind === 'triac' || part.kind === 'diac')
            body = <SchScr x={x} y={y} on={scrOn} />
          else if (['not', 'and', 'or', 'nand', 'nor', 'xor', 'xnor'].includes(part.kind))
            body = <GateSymbol label={part.kind.toUpperCase()} />
          else if (part.kind === 'resistor' || part.kind === 'inductor')
            body = <SchResistor x={x} y={y} />

          return (
            <g
              key={part.id}
              style={{ cursor: 'pointer' }}
              onClick={() => select(part.id)}
            >
              {selected && (
                <rect
                  x={x - 36}
                  y={y - 40}
                  width="72"
                  height="80"
                  rx="6"
                  fill="rgba(59,130,246,0.08)"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                />
              )}
              {body}
              <text
                x={x}
                y={y + 44}
                textAnchor="middle"
                fill={SCH_LABEL}
                fontSize="11"
                fontFamily="ui-sans-serif, system-ui"
              >
                {String(label).slice(0, 16)}
              </text>
            </g>
          )
        })}

        {parts.length === 0 && (
          <text x={width / 2} y={height / 2} textAnchor="middle" fill="#94a3b8" fontSize="14">
            Empty schematic — place parts in 3D Lab first
          </text>
        )}
      </svg>
    </div>
  )
}

type PaletteItem = {
  id: string
  label: string
  symbol: ReactNode
  tool: ToolId
  keywords?: string
  preset?: { ledColor?: 'red' | 'green' | 'yellow' | 'blue'; transistorModel?: TransistorModelId; motorModel?: MotorModelId }
}
type PaletteSection = { title: string; items: PaletteItem[] }

const PALETTE: PaletteSection[] = [
  {
    title: 'Microcontrollers',
    items: [
      { id: 'mcu', label: 'Arduino Uno', symbol: <McuSymbol />, tool: 'mcu', keywords: 'Arduino Uno R3 ATmega328P microcontroller' },
      ...EXPANSION_COMPONENTS.filter(spec => spec.category === 'Microcontrollers').map(spec => ({
        id: spec.id, label: spec.name, tool: spec.id,
        symbol: 'µC', keywords: `${spec.description} ${spec.pins.join(' ')}`,
      })),
    ],
  },
  {
    title: 'Output Devices',
    items: [
      { id: 'seven-segment', label: '7-Segment', symbol: '8.', tool: 'seven-segment' },
      { id: 'lcd', label: 'LCD 16×2', symbol: <LcdSymbol />, tool: 'lcd', keywords: 'HD44780 character display' },
      { id: 'oled', label: 'OLED', symbol: <OledSymbol />, tool: 'oled', keywords: 'SSD1306 I2C 128x64' },
    ],
  },
  {
    title: 'Sources',
    items: [
      { id: 'vdc', label: 'VDC', symbol: '⎓', tool: 'psu-positive' },
      { id: 'gnd', label: 'GND', symbol: '⏚', tool: 'psu-negative' },
    ],
  },
  {
    title: 'Passive',
    items: [
      { id: 'res', label: 'Resistor', symbol: <ResistorSymbol />, tool: 'resistor' },
      { id: 'cap', label: 'Ceramic capacitor', symbol: <CapacitorSymbol />, tool: 'capacitor', keywords: 'ceramic disc capacitor' },
      { id: 'cap-electrolytic', label: 'Electrolytic 100µF', symbol: '100µ', tool: 'capacitor-electrolytic', keywords: 'polarized radial aluminum 25V capacitor' },
      { id: 'cap-film', label: 'Film 100nF', symbol: '100n', tool: 'capacitor-film', keywords: 'polyester capacitor 63V' },
      { id: 'cap-tantalum', label: 'Tantalum 10µF', symbol: '10µ', tool: 'capacitor-tantalum', keywords: 'polarized tantalum bead capacitor' },
      { id: 'ind', label: 'Inductor', symbol: <InductorSymbol />, tool: 'inductor' },
      { id: 'ldr', label: 'LDR', symbol: 'LDR', tool: 'ldr' },
      { id: 'thermistor', label: 'Thermistor', symbol: 'NTC', tool: 'thermistor' },
      { id: 'fuse', label: 'Fuse', symbol: 'F', tool: 'fuse' },
      { id: 'fuse-glass', label: 'Glass fuse 500mA', symbol: 'F500', tool: 'fuse-glass', keywords: 'cartridge glass tube 0.5A fuse' },
    ],
  },
  {
    title: 'Semiconductors',
    items: [
      { id: 'diode', label: 'Silicon diode', symbol: <DiodeSymbol />, tool: 'diode' },
      { id: 'diode-schottky', label: '1N5819 Schottky', symbol: <DiodeSymbol />, tool: 'diode-schottky', keywords: 'fast low voltage drop 0.3V rectifier diode' },
      { id: 'zener', label: 'Zener', symbol: 'Z', tool: 'zener' },
      { id: 'led', label: 'LED (red)', symbol: <LedSymbol />, tool: 'led', preset: { ledColor: 'red' }, keywords: 'light emitting diode' },
      { id: 'led-green', label: 'LED (green)', symbol: <LedSymbol />, tool: 'led', preset: { ledColor: 'green' } },
      { id: 'led-yellow', label: 'LED (yellow)', symbol: <LedSymbol />, tool: 'led', preset: { ledColor: 'yellow' } },
      { id: 'led-blue', label: 'LED (blue)', symbol: <LedSymbol />, tool: 'led', preset: { ledColor: 'blue' } },
      { id: 'rgb-led', label: 'RGB LED', symbol: 'RGB', tool: 'rgb-led' },
      { id: 'transistor', label: '2N3904 NPN', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: '2n3904' }, keywords: 'BJT transistor' },
      { id: '2n3906', label: '2N3906 PNP', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: '2n3906' } },
      { id: 'bc547', label: 'BC547 NPN', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: 'bc547' } },
      { id: 'tip31', label: 'TIP31 NPN', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: 'tip31' } },
      { id: 'bc557', label: 'BC557 PNP', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: 'bc557' } },
      { id: 'tip32', label: 'TIP32 PNP', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: 'tip32' } },
      { id: '2n2222', label: '2N2222 NPN', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: '2n2222' } },
      { id: '2n3055', label: '2N3055 NPN', symbol: <TransistorSymbol />, tool: 'transistor', preset: { transistorModel: '2n3055' } },
      { id: 'mosfet', label: 'MOSFET', symbol: 'MOS', tool: 'mosfet' },
      { id: 'thyristor', label: 'Thyristor (SCR)', symbol: <ThyristorSymbol />, tool: 'thyristor' },
      { id: 'triac', label: 'TRIAC', symbol: <TriacSymbol />, tool: 'triac' },
      { id: 'diac', label: 'DIAC', symbol: <DiacSymbol />, tool: 'diac' },
    ],
  },
  {
    title: 'Switching',
    items: [
      { id: 'switch', label: 'SPST switch', symbol: <SwitchSymbol />, tool: 'switch' },
      { id: 'switch-spdt', label: 'SPDT switch', symbol: <SwitchSymbol />, tool: 'switch-spdt' },
      { id: 'switch-slide', label: 'Slide switch SPDT', symbol: '⇆', tool: 'switch-slide', keywords: 'three pin mechanical miniature slide switch' },
      { id: 'switch-reed', label: 'Magnetic reed', symbol: 'REED', tool: 'switch-reed', keywords: 'glass normally open reed switch magnetic sensor' },
      { id: 'switch-dpst', label: 'DPST switch', symbol: <SwitchSymbol />, tool: 'switch-dpst' },
      { id: 'switch-dpdt', label: 'DPDT switch', symbol: <SwitchSymbol />, tool: 'switch-dpdt' },
      { id: 'button', label: 'Push button', symbol: <PushButtonSymbol />, tool: 'button' },
      { id: 'button-blue', label: 'Blue tactile', symbol: <PushButtonSymbol />, tool: 'button-blue', keywords: 'tact switch blue cap momentary' },
      { id: 'button-white', label: 'White tactile', symbol: <PushButtonSymbol />, tool: 'button-white', keywords: 'tact switch white cap momentary' },
      { id: 'relay', label: 'Relay', symbol: <RelaySymbol />, tool: 'relay' },
      { id: 'pot', label: 'Potentiometer', symbol: <PotentiometerSymbol />, tool: 'pot' },
    ],
  },
  {
    title: 'Audio',
    items: [
      { id: 'buzzer', label: 'Buzzer', symbol: <BuzzerSymbol />, tool: 'buzzer' },
      { id: 'speaker', label: 'Speaker', symbol: <SpeakerSymbol />, tool: 'speaker' },
    ],
  },
  {
    title: 'Actuators',
    items: [
      { id: 'motor', label: 'DC Motor 5V', symbol: <MotorSymbol />, tool: 'motor', preset: { motorModel: '5v' } },
      { id: 'motor-3v', label: 'DC Motor 3V', symbol: <MotorSymbol />, tool: 'motor', preset: { motorModel: '3v' } },
      { id: 'motor-9v', label: 'DC Motor 9V', symbol: <MotorSymbol />, tool: 'motor', preset: { motorModel: '9v' } },
      { id: 'motor-12v', label: 'DC Motor 12V', symbol: <MotorSymbol />, tool: 'motor', preset: { motorModel: '12v' } },
      { id: 'servo', label: 'Servo', symbol: 'SV', tool: 'servo' },
    ],
  },
  {
    title: 'Analog & Timing',
    items: [
      { id: 'opamp', label: 'Op-Amp', symbol: 'OA', tool: 'opamp' },
      { id: 'timer555', label: '555 Timer', symbol: '555', tool: 'timer555', keywords: 'NE555 astable monostable' },
      { id: 'optocoupler', label: 'Optocoupler', symbol: 'OC', tool: 'optocoupler' },
      { id: 'regulator', label: 'Regulator', symbol: '78xx', tool: 'regulator', keywords: '7805 7812 linear voltage regulator' },
    ],
  },
  {
    title: 'Logic ICs',
    items: [
      { id: 'not', label: 'NOT IC', symbol: <GateSymbol label="NOT" />, tool: 'not', keywords: '74HC04 hex inverter' },
      { id: 'and', label: 'AND IC', symbol: <GateSymbol label="AND" />, tool: 'and', keywords: '74HC08 quad' },
      { id: 'or', label: 'OR IC', symbol: <GateSymbol label="OR" />, tool: 'or', keywords: '74HC32 quad' },
      { id: 'nand', label: 'NAND IC', symbol: <GateSymbol label="NAND" />, tool: 'nand', keywords: '74HC00 quad' },
      { id: 'nor', label: 'NOR IC', symbol: <GateSymbol label="NOR" />, tool: 'nor', keywords: '74HC02 quad' },
      { id: 'xor', label: 'XOR IC', symbol: <GateSymbol label="XOR" />, tool: 'xor', keywords: '74HC86 quad exclusive or' },
      { id: 'xnor', label: 'XNOR IC', symbol: <GateSymbol label="XNOR" />, tool: 'xnor', keywords: 'CD4077B quad exclusive nor' },
    ],
  },
  // Expansion catalog: one shared definition also drives the library,
  // placement pins, saved model ID and 3D mesh.
  ...EXPANSION_CATEGORIES.map(title => ({
    title,
    items: EXPANSION_COMPONENTS.filter(spec => spec.category === title).map(spec => ({
      id: spec.id, label: spec.name, tool: spec.id,
      symbol: spec.shape === 'dip' ? 'IC' : spec.shape === 'instrument' ? 'V' : spec.shape === 'microcontroller' ? 'µC' :
        spec.shape === 'sensor' ? 'S' : spec.shape === 'motor' ? 'M' : spec.shape === 'screen' ? 'LED' : 'PCB',
      keywords: `${spec.description} ${spec.pins.join(' ')}`,
    })),
  })),
  {
    title: 'Tools',
    items: [
      { id: 'probe', label: 'Voltmeter', symbol: 'V', tool: 'probe' },
    ],
  }
]

// Ribbon buttons show the six most-used kinds; More Kinds contains only
// the remaining categories from the same catalog (no hand-maintained duplicates).
const RIBBON_INSERT_KINDS = [
  'Passive', 'Semiconductors', 'Logic ICs',
  'Microcontrollers', 'Sensors', 'Output Devices',
] as const
const MORE_INSERT_KINDS = PALETTE.filter(
  section => !new Set<string>(RIBBON_INSERT_KINDS).has(section.title),
)

type EditorToolButtonProps = { label: string; icon: ReactNode; onClick: () => void; shortcut?: string; active?: boolean; danger?: boolean; disabled?: boolean }
function EditorToolButton({label,icon,onClick,shortcut,active=false,danger=false,disabled=false}: EditorToolButtonProps) {
  return <button type="button" className={`editor-toolbar-action ${active ? 'active' : ''} ${danger ? 'danger' : ''}`} disabled={disabled} aria-pressed={active} aria-label={label} title={`${label}${shortcut ? ` (${shortcut})` : ''}${active && ['Select', 'Pan', 'Wire'].includes(label) ? ' · click again to exit' : ''}`} onClick={onClick}>
    {icon}<span className="hidden xl:inline">{label}</span>
  </button>
}

export function CircuitEditorPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [use3D, setUse3D] = useState(true)
  // Fast rendering is on by default. Users can switch to detailed shadows from the dock.
  const [performanceMode, setPerformanceMode] = useState(() => {
    try {
      const quality = window.localStorage.getItem('electrolab-graphics-quality-v1');
      if (isGraphicsQuality(quality)) return quality === 'low';
      return window.localStorage.getItem('electrolab-3d-fast-mode-v1') !== 'false';
    }
    catch { return true }
  })
  useEffect(() => {
    try { window.localStorage.setItem('electrolab-3d-fast-mode-v1', String(performanceMode)) } catch { /* private browsing */ }
  }, [performanceMode])
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>(() => {
    try {
      const stored = window.localStorage.getItem('electrolab-graphics-quality-v1');
      return isGraphicsQuality(stored) ? stored : (window.localStorage.getItem('electrolab-3d-fast-mode-v1') === 'false' ? 'high' : 'low');
    } catch { return 'low'; }
  });
  const changeGraphicsQuality = (quality: GraphicsQuality) => {
    setGraphicsQuality(quality);
    setPerformanceMode(quality === 'low');
  };
  useEffect(() => {
    try { window.localStorage.setItem('electrolab-graphics-quality-v1', graphicsQuality); } catch { /* private browsing */ }
  }, [graphicsQuality]);
  const [helpOpen, setHelpOpen] = useState(false)
  const boardPreset = useLab((state) => state.boardId)
  const setBoard = useLab((state) => state.setBoard)
  const loadCircuit = useLab((state) => state.loadCircuit)
  const getCircuitSnapshot = useLab((state) => state.getCircuitSnapshot)
  const parts = useLab((state) => state.parts)
  const wires = useLab((state) => state.wires)
  const selectedWireId = useLab((state) => state.selectedId)
  const focusConnections = useLab((state) => state.focusConnections)
  const selectedWire = wires.find(w => w.id === selectedWireId)
  const psuVoltage = useLab((state) => state.psuVoltage)
  const psuPositive = useLab((state) => state.psuPositive)
  const psuNegative = useLab((state) => state.psuNegative)

  const projects = useProjects((s) => s.projects)
  const getProject = useProjects((s) => s.getProject)
  const createProject = useProjects((s) => s.createProject)
  const saveCircuit = useProjects((s) => s.saveCircuit)
  const setActiveProjectId = useProjects((s) => s.setActiveProjectId)
  const touchProject = useProjects((s) => s.touchProject)

  const partDragEnabled = useLab((state) => state.partDragEnabled)
  const setPartDragEnabled = useLab((state) => state.setPartDragEnabled)

  const activeIdRef = useRef<string | null>(null)
  const skipSaveRef = useRef(false)

  // Each project is its own file: load that circuit when the route changes.
  useEffect(() => {
    let id = projectId || null
    if (!id || id === 'new') {
      const p = createProject(id === 'new' ? 'Untitled Project' : undefined)
      navigate(`/editor/${p.id}`, { replace: true })
      return
    }

    const project = getProject(id)
    if (!project) {
      const p = createProject('Untitled Project')
      navigate(`/editor/${p.id}`, { replace: true })
      return
    }

    const prev = activeIdRef.current
    if (prev && prev !== id) {
      try {
        saveCircuit(prev, getCircuitSnapshot())
      } catch {
        /* ignore */
      }
    }

    skipSaveRef.current = true
    loadCircuit(project.circuit)
    // Open Arduino demos with their actual board selected so the docked
    // Properties panel immediately shows its editable headers and pins.
    const firstArduino = project.circuit.parts.find(part => part.kind === 'mcu')
    if (firstArduino) useLab.getState().select(firstArduino.id)
    activeIdRef.current = id
    setActiveProjectId(id)
    touchProject(id)
    const t = window.setTimeout(() => {
      skipSaveRef.current = false
    }, 400)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Auto-save into this project's stored circuit only
  useEffect(() => {
    const id = activeIdRef.current
    if (!id || skipSaveRef.current) return
    const timer = window.setTimeout(() => {
      saveCircuit(id, getCircuitSnapshot())
    }, 500)
    return () => window.clearTimeout(timer)
  }, [parts, wires, psuVoltage, psuPositive, psuNegative, boardPreset, saveCircuit, getCircuitSnapshot])

  useEffect(() => {
    return () => {
      const id = activeIdRef.current
      if (id) {
        try {
          saveCircuit(id, useLab.getState().getCircuitSnapshot())
        } catch {
          /* ignore */
        }
      }
    }
  }, [saveCircuit])

  const handleBoardPresetChange = (id: BoardPresetId) => {
    setBoard(id)
  }
  const [moveMode, setMoveMode] = useState(false)
  const [search, setSearch] = useState('')
  const [sidebarTab, setSidebarTab] = useState<'parts' | 'circuits' | 'examples'>('parts')
  const workspaceRef = useRef<HTMLDivElement | null>(null)
  const insertGalleryRef = useRef<HTMLElement | null>(null)
  const insertGalleryBodyRef = useRef<HTMLDivElement | null>(null)
  // The component library now lives inside Insert as a floating gallery, never
  // as a left sidebar. The 3D viewport keeps its full width at all times.
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreKindsOpen, setMoreKindsOpen] = useState(false)
  const [moreKindsLeft, setMoreKindsLeft] = useState(12)
  const moreKindsButtonRef = useRef<HTMLButtonElement | null>(null)
  const moreKindsMenuRef = useRef<HTMLDivElement | null>(null)
  const [ribbonTab, setRibbonTab] = useState<'home' | 'insert' | 'wiring' | 'simulation' | 'view'>('home')
  const [ribbonCollapsed, setRibbonCollapsed] = useState(() => {
    try { return window.localStorage.getItem('electrolab-ribbon-collapsed-v1') === 'true' }
    catch { return false }
  })
  const [focusMode, setFocusMode] = useState(false)
  // The ribbon scrolls horizontally, so the dropdown is mounted directly
  // under the toolbar (not inside its overflow-hidden command strip).
  useEffect(() => {
    if (!moreKindsOpen) return
    const dismissOutside = (event: PointerEvent) => {
      if (moreKindsButtonRef.current?.contains(event.target as Node) ||
          moreKindsMenuRef.current?.contains(event.target as Node)) return
      setMoreKindsOpen(false)
    }
    const dismissEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setMoreKindsOpen(false)
      moreKindsButtonRef.current?.focus()
    }
    const dismissOnResize = () => setMoreKindsOpen(false)
    window.addEventListener('pointerdown', dismissOutside)
    window.addEventListener('keydown', dismissEscape)
    window.addEventListener('resize', dismissOnResize)
    return () => {
      window.removeEventListener('pointerdown', dismissOutside)
      window.removeEventListener('keydown', dismissEscape)
      window.removeEventListener('resize', dismissOnResize)
    }
  }, [moreKindsOpen])
  useEffect(() => {
    if (!paletteOpen) return
    const onOutside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!insertGalleryRef.current?.contains(target) && !(target as Element).closest?.('.editor-ribbon-panel')) setPaletteOpen(false)
    }
    window.addEventListener('pointerdown', onOutside)
    return () => window.removeEventListener('pointerdown', onOutside)
  }, [paletteOpen])
  const focusLayoutRef = useRef({ library: false, inspector: false, ribbon: false })
  useEffect(() => {
    try { window.localStorage.setItem('electrolab-ribbon-collapsed-v1', String(ribbonCollapsed)) }
    catch { /* storage unavailable */ }
  }, [ribbonCollapsed])
  // Component Library links can preselect a part. The query parameter is
  // consumed here before /editor/new redirects to its generated project ID.
  useEffect(() => {
    const tool = new URLSearchParams(window.location.search).get('tool');
    if (tool && PALETTE.some(group => group.items.some(item => item.tool === tool))) {
      setUse3D(true);
      setSidebarTab('parts');
      setPaletteOpen(false);
      setRibbonTab('insert');
      useLab.getState().setTool(tool as ToolId);
    }
  }, [projectId]);
  const [openArduinoCodeRequest, setOpenArduinoCodeRequest] = useState(0)
  const [openMonitorRequest, setOpenMonitorRequest] = useState(0)
  const [propertiesOpen, setPropertiesOpen] = useState(false)
  const [utilitiesOpen, setUtilitiesOpen] = useState(false)
  const [utilityTab, setUtilityTab] = useState<WorkbenchPanelTab>('monitor')
  const exitFocusMode = () => {
    if (!focusMode) return
    setPaletteOpen(focusLayoutRef.current.library)
    setPropertiesOpen(focusLayoutRef.current.inspector)
    setRibbonCollapsed(focusLayoutRef.current.ribbon)
    setFocusMode(false)
  }
  const showLibrary = (tab: 'parts' | 'circuits' | 'examples' = 'parts', kind?: string) => {
    setMoreKindsOpen(false)
    exitFocusMode()
    setRibbonTab('insert')
    setRibbonCollapsed(false)
    setSidebarTab(tab)
    if (tab === 'parts' && kind !== undefined) {
      if (kind !== category) setSearch('')
      setCategory(kind)
    }
    setPaletteOpen(true)
  }
  const toggleMoreKinds = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (moreKindsOpen) {
      setMoreKindsOpen(false)
      return
    }
    const button = event.currentTarget.getBoundingClientRect()
    const toolbar = event.currentTarget.closest('.editor-topbar')?.getBoundingClientRect()
    if (toolbar) {
      const menuWidth = 260
      setMoreKindsLeft(Math.max(10, Math.min(button.left - toolbar.left, toolbar.width - menuWidth - 10)))
    }
    setPaletteOpen(false)
    setMoreKindsOpen(true)
  }
  const toggleInsertGallery = (tab: 'parts' | 'circuits' | 'examples', kind?: string) => {
    if (paletteOpen && ribbonTab === 'insert' && sidebarTab === tab && (tab !== 'parts' || kind === undefined || kind === category)) {
      setPaletteOpen(false)
    } else {
      showLibrary(tab, kind)
    }
  }
  const toggleFocusMode = () => {
    if (focusMode) exitFocusMode()
    else {
      focusLayoutRef.current = { library: paletteOpen, inspector: propertiesOpen, ribbon: ribbonCollapsed }
      setPaletteOpen(false)
      setPropertiesOpen(false)
      setUtilitiesOpen(false)
      setRibbonCollapsed(true)
      setFocusMode(true)
    }
  }
  const togglePropertiesPanel = () => {
    exitFocusMode();
    if (!propertiesOpen) setUtilitiesOpen(false);
    setPropertiesOpen(!propertiesOpen);
  };
  // Each right-edge icon opens its own utility content. Clicking the currently
  // open icon collapses the pane, returning the space to the circuit canvas.
  const toggleUtilityPanel = (tab: WorkbenchPanelTab) => {
    exitFocusMode();
    if (utilitiesOpen && utilityTab === tab) {
      setUtilitiesOpen(false);
      return;
    }
    setPropertiesOpen(false);
    setUtilityTab(tab);
    useLab.getState().setGuideTarget(null);
    setUtilitiesOpen(true);
  };
  const openUtilitiesPanel = () => {
    exitFocusMode();
    setPropertiesOpen(false);
    setUtilitiesOpen(true);
  };
  const [category, setCategory] = useState('All')
  useEffect(() => {
    if (ribbonTab !== 'insert' || ribbonCollapsed || focusMode) setMoreKindsOpen(false)
  }, [ribbonTab, ribbonCollapsed, focusMode])
  // Return to the beginning when a ribbon kind changes so the search field
  // is always visible; ordinary wheel/trackpad scrolling moves everything.
  useEffect(() => {
    if (paletteOpen) insertGalleryBodyRef.current?.scrollTo({ top: 0 })
  }, [category, sidebarTab, paletteOpen])
  const [showTips, setShowTips] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const [showEditorSettings, setShowEditorSettings] = useState(false)
  const settingsMenuRef = useRef<HTMLDivElement | null>(null)
  const moreMenuRef = useRef<HTMLDivElement | null>(null)
  const [recentIds, setRecentIds] = useState<string[]>([])
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const raw = window.localStorage.getItem('electrolab:favorite-components')
      const value = raw ? JSON.parse(raw) : []
      return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : []
    } catch { return [] }
  })

  useEffect(() => {
    try { window.localStorage.setItem('electrolab:favorite-components', JSON.stringify(favorites)) } catch { /* ignore storage restrictions */ }
  }, [favorites])

  useEffect(() => {
    if (!showMore) return
    const outside = (event: PointerEvent) => {if (!moreMenuRef.current?.contains(event.target as Node)) setShowMore(false)}
    window.addEventListener('pointerdown', outside)
    return () => window.removeEventListener('pointerdown', outside)
  }, [showMore])

  useEffect(() => {
    if (!showEditorSettings) return;
    const outside = (event: PointerEvent) => {
      if (!settingsMenuRef.current?.contains(event.target as Node)) setShowEditorSettings(false);
    };
    window.addEventListener('pointerdown', outside);
    return () => window.removeEventListener('pointerdown', outside);
  }, [showEditorSettings]);

  /** Floating component while the user drags from the palette onto the board. */
  const [dragPreview, setDragPreview] = useState<{
    tool: ToolId
    label: string
    x: number
    y: number
    onBoard: boolean
    moved: boolean
    snappedHole: HoleId | null
    benchPoint: BenchPoint | null
  } | null>(null)
  const dragActiveRef = useRef(false)
  const dragToolRef = useRef<ToolId | null>(null)
  const dragMovedRef = useRef(false)
  const suppressPaletteClickRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0 })

  const activeTool = useLab((state) => state.tool)
  const pendingWireStart = useLab((state) => state.pendingHoles[0] ?? null)
  const wireStyle = useLab((state) => state.wireStyle)
  const wireColor = useLab((state) => state.wireColor)
  const showWireFlow = useLab((state) => state.showWireFlow)
  const placePartAt = useLab((state) => state.placePartAt)
  const setHover = useLab((state) => state.setHover)

  // Wiring controls live in the Wiring tab, never in the Insert gallery.
  // This includes the W shortcut and wire tools launched from elsewhere.
  useEffect(() => {
    if (activeTool === 'wire') {
      setRibbonTab('wiring')
      setPaletteOpen(false)
      setRibbonCollapsed(false)
    }
  }, [activeTool, use3D])

  const cameraCommand = (type: string, active?: boolean) => {
    window.dispatchEvent(
      new CustomEvent('ece-lab-camera', { detail: { type, active } }),
    )
  }

  const toggleMoveMode = () => {
    const next = !moveMode
    setMoveMode(next)
    cameraCommand('move-mode', next)
    // Pan is exclusive with component selection and wire placement. Turning
    // it off leaves a neutral cursor rather than a second active button.
    useLab.getState().setTool('none')
  }

  const applyPalettePreset = (item: PaletteItem) => {
    if (item.preset?.ledColor) useLab.getState().setLedColor(item.preset.ledColor)
    if (item.preset?.transistorModel) useLab.getState().setTransistorModel(item.preset.transistorModel)
    if (item.preset?.motorModel) useLab.getState().setMotorModel(item.preset.motorModel)
  }

  const selectTool = (tool: ToolId | null, item?: PaletteItem) => {
    if (!tool) return
    if (item) {
      applyPalettePreset(item)
      setRecentIds((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 8))
    }
    setMoveMode(false)
    cameraCommand('move-mode', false)
    useLab.getState().setTool(tool)
  }

  const toggleToolbarTool = (tool: ToggleableTool) => {
    const next = nextToggleableTool(useLab.getState().tool, tool, moveMode)
    if (next === 'wire') {
      setRibbonTab('wiring')
      setPaletteOpen(false)
      setRibbonCollapsed(false)
    }
    selectTool(next)
  }

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id])
  }

  /**
   * Project cursor onto the breadboard plane using the live 3D camera when
   * available (so orbiting the view does not break drop targeting).
   */
  const screenToBoardPoint = (clientX: number, clientY: number) => {
    const w = window as Window & {
      __eceLabCanvas?: HTMLCanvasElement
      __eceLabCamera?: THREE.Camera
    }
    const canvas =
      w.__eceLabCanvas ||
      (document.querySelector(
        '.ece-circuit-lab canvas',
      ) as HTMLCanvasElement | null)
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return null
    }

    const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1
    const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1

    let camera = w.__eceLabCamera
    if (!camera) {
      const fallback = new THREE.PerspectiveCamera(
        42,
        rect.width / Math.max(rect.height, 1),
        0.1,
        60,
      )
      fallback.position.set(3.8, 4.4, 5.6)
      fallback.lookAt(0, 0.2, 0)
      fallback.updateMatrixWorld()
      camera = fallback
    } else {
      camera.updateMatrixWorld()
    }

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.34)
    const hit = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(plane, hit)) return null
    return { x: hit.x, z: hit.z }
  }

  const resolveDropHole = (clientX: number, clientY: number): HoleId | null => {
    // Do not fall back to a stale hover when the user releases outside the board.
    const point = screenToBoardPoint(clientX, clientY)
    return point
      ? nearestHole({ x: point.x, y: 0.34, z: point.z }, 0.55)
      : null
  }

  const beginPaletteDrag = (
    event: React.PointerEvent,
    tool: ToolId,
    label: string,
    item: PaletteItem,
  ) => {
    if (event.button !== 0) return
    // Don't preventDefault on pointerdown — allows click-to-select when
    // the pointer never moves far enough to count as a drag.
    event.stopPropagation()
    // A fresh press must never inherit suppression from a previous drag.
    suppressPaletteClickRef.current = false
    applyPalettePreset(item)
    setRecentIds((prev) => [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 8))

    // Wire, probe and power-port tools are not physical parts: use click-to-connect.
    if (['wire', 'probe', 'psu-positive', 'psu-negative'].includes(tool)) {
      selectTool(tool)
      return
    }

    if (!useLab.getState().partDragEnabled) {
      setMoveMode(false)
      cameraCommand('move-mode', false)
      useLab.getState().setTool(tool)
      return
    }
    
    dragActiveRef.current = true
    dragMovedRef.current = false
    suppressPaletteClickRef.current = false
    dragStartRef.current = { x: event.clientX, y: event.clientY }
    dragToolRef.current = tool
    setMoveMode(false)
    cameraCommand('move-mode', false)
    useLab.getState().setTool(tool)
    useLab.getState().setPaletteDragging(true)
    setHover(null)
    useLab.getState().setHoverBenchPoint(null)
    setDragPreview({
      tool,
      label,
      x: event.clientX,
      y: event.clientY,
      onBoard: false,
      moved: false,
      snappedHole: null,
      benchPoint: null,
    })

    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch {
      /* ignore */
    }
  }

  const updatePaletteDrag = (event: React.PointerEvent | PointerEvent) => {
    if (!dragActiveRef.current) return

    const dx = event.clientX - dragStartRef.current.x
    const dy = event.clientY - dragStartRef.current.y
    if (Math.hypot(dx, dy) > 6) {
      dragMovedRef.current = true
    }

    const in2D = !use3D && (() => {
      const target = document.querySelector('.physical-2d-canvas');
      const r = target?.getBoundingClientRect();
      return Boolean(r && event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom);
    })();
    if (in2D) {
      window.dispatchEvent(new CustomEvent(PHYSICAL_2D_DRAG_EVENT, {detail:{tool:dragToolRef.current,clientX:event.clientX,clientY:event.clientY}}))
      setDragPreview(prev => prev ? { ...prev, x:event.clientX, y:event.clientY, onBoard:true, moved:dragMovedRef.current, snappedHole:null, benchPoint:null } : prev);
      return;
    }
    const point = screenToBoardPoint(event.clientX, event.clientY)
    const hole = point
      ? nearestHole({ x: point.x, y: 0.34, z: point.z }, 0.55)
      : null
    // Controllers remain beside the board, even when the mouse is over its
    // center; normal components continue snapping to exact breadboard holes.
    const controller=isControllerTool(dragToolRef.current ?? 'none')
    const benchPoint=point && controller ? constrainBenchPoint(point,dragToolRef.current==='mcu'?undefined:dragToolRef.current ?? undefined) : null
    setDragPreview((prev) => prev ? {
      ...prev,
      x: event.clientX,
      y: event.clientY,
      onBoard: Boolean(controller ? benchPoint : hole),
      moved: dragMovedRef.current,
      snappedHole: hole,
      benchPoint,
    } : prev)
    setHover(controller ? null : hole)
    useLab.getState().setHoverBenchPoint(benchPoint)
  }

  const endPaletteDrag = (event: React.PointerEvent | PointerEvent) => {
    if (!dragActiveRef.current) return
    dragActiveRef.current = false

    const tool = dragToolRef.current
    const didDrag = dragMovedRef.current
    // A synthetic click can fire on the palette button after pointerup even
    // though the part was already dropped. Do not reselect the placement tool.
    suppressPaletteClickRef.current = didDrag
    dragToolRef.current = null
    dragMovedRef.current = false

    // The physical 2D editor uses the SAME placePartAt/store action but needs
    // its own SVG viewBox coordinates instead of the 3D camera raycaster.
    if (!use3D) {
      window.dispatchEvent(new Event(PHYSICAL_2D_DRAG_END_EVENT))
      setDragPreview(null)
      setHover(null)
      useLab.getState().setHoverBenchPoint(null)
      if (didDrag && tool) {
        window.dispatchEvent(new CustomEvent(PHYSICAL_2D_DROP_EVENT, { detail: { tool, clientX:event.clientX, clientY:event.clientY } }))
        setPaletteOpen(false)
      }
      window.setTimeout(() => useLab.getState().setPaletteDragging(false), didDrag ? 500 : 50)
      return
    }
    // Capture hover before clearing so drop still works if raycast is flaky.
    const controller=tool ? isControllerTool(tool):false
    const point=controller && didDrag ? screenToBoardPoint(event.clientX,event.clientY):null
    const benchPoint=point && tool ? constrainBenchPoint(point,tool==='mcu'?undefined:tool):null
    const hole = !controller && didDrag ? resolveDropHole(event.clientX, event.clientY) : null

    setDragPreview(null)
    setHover(null)
    useLab.getState().setHoverBenchPoint(null)

    // Pure click on the palette: only select the tool (then click a hole).
    if (!didDrag || !tool || (!hole && !benchPoint)) {
      // Keep paletteDragging briefly so a synthetic hole-click on release is ignored.
      window.setTimeout(() => {
        useLab.getState().setPaletteDragging(false)
      }, 50)
      return
    }

    placePartAt(tool, hole ?? 'F12', undefined, benchPoint ?? undefined)
    setPaletteOpen(false)
    // Block clickHole from placing a second copy of the same drop.
    window.setTimeout(() => {
      useLab.getState().setPaletteDragging(false)
    }, 500)
  }

  useEffect(() => {
    if (!dragPreview) return

    const onMove = (e: PointerEvent) => updatePaletteDrag(e)
    const onUp = (e: PointerEvent) => endPaletteDrag(e)
    const onCancel = () => {
      dragActiveRef.current = false
      dragToolRef.current = null
      dragMovedRef.current = false
      window.dispatchEvent(new Event(PHYSICAL_2D_DRAG_END_EVENT))
      setDragPreview(null)
      setHover(null)
      useLab.getState().setHoverBenchPoint(null)
      useLab.getState().setPaletteDragging(false)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragPreview?.tool])

  const filteredPalette = useMemo(() => {
    const query = search.trim().toLowerCase()
    return PALETTE.map((section) => ({
      ...section,
      items: section.items.filter((item) =>
        (category === 'All' || category === section.title ||
         (category === 'Favorites' && favorites.includes(item.id)) ||
         (category === 'Recent' && recentIds.includes(item.id))) &&
        (!query || `${item.label} ${item.keywords ?? ''} ${section.title}`.toLowerCase().includes(query)),
      ),
    })).filter((section) => section.items.length > 0)
  }, [search, category, favorites, recentIds])
  const paletteCount = PALETTE.reduce((total, section) => total + section.items.length, 0)
  const selectedItem = useLab((state) => state.selectedId)
  const powerOn = useLab((state) => state.powerOn)
  const lastSelectedForInspectorRef = useRef<string | null>(null)
  useEffect(() => {
    if (selectedItem && selectedItem !== lastSelectedForInspectorRef.current && !focusMode) {
      setUtilitiesOpen(false)
      setPropertiesOpen(true)
    }
    lastSelectedForInspectorRef.current = selectedItem
  }, [selectedItem, focusMode])
  const canUndo = useLab((state) => state.history.length > 0)
  const canRedo = useLab((state) => state.future.length > 0)

  const title = useMemo(() => {
    if (!projectId || projectId === 'new') return 'Untitled Project'
    return (
      projects.find((p) => p.id === projectId)?.name ||
      projectId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    )
  }, [projectId, projects])

  const handleRunSimulation = () => {
    const id = projectId || activeIdRef.current
    try { if (id) saveCircuit(id, getCircuitSnapshot()) } catch { /* local persistence can fail */ }
    const lab = useLab.getState()
    lab.runNow()
    const after = useLab.getState()
    const sim = after.sim
    const current = Math.abs(sim.supplyCurrent || 0)
    let status: 'Pass' | 'Warning' | 'Failed' = 'Pass'
    let notes: string | undefined
    if (sim.error || sim.shortCircuit || sim.sourceConflict) { status = 'Failed'; notes = sim.error || sim.warnings?.[0] || 'Power fault detected' }
    else if ((sim.warnings?.length ?? 0) > 0 || Object.keys(sim.burned ?? {}).length > 0) {status = 'Warning'; notes = sim.warnings?.[0] || 'Component stress warning'}
    else if (!after.psuPositive || !after.psuNegative) {status = 'Warning'; notes = 'Power supply clips not connected'}
    else if (after.parts.length > 0 && current < 1e-9) {status = 'Warning'; notes = 'No measurable current — check wiring and switches'}
    if (id) useProjects.getState().recordSimRun({projectId:id, projectName:useProjects.getState().projects.find(p => p.id === id)?.name || id,status,notes})
    navigate('/results/' + (id || 'dc-motor'))
  }

  const restorePremade = () => {
    const id = projectId || activeIdRef.current
    if (!id) return
    // Never silently replace edits or mix another project into this demo.
    if (!freshPremadeCircuit(id)) return
    if (!window.confirm('Restore the original premade circuit? A backup of your current circuit will be created first.')) return
    const existing = useProjects.getState().getProject(id)
    const currentSnapshot = getCircuitSnapshot()
    const backup = useProjects.getState().createProject(`Backup — ${existing?.name ?? 'Circuit'}`)
    useProjects.getState().saveCircuit(backup.id, currentSnapshot)
    const starter = freshPremadeCircuit(id)
    if (!starter) return
    // Suppress autosave while replacing the live Zustand lab state.
    skipSaveRef.current = true
    loadCircuit(starter)
    useProjects.getState().saveCircuit(id, starter)
    useProjects.getState().setActiveProjectId(id)
    activeIdRef.current = id
    window.setTimeout(() => { skipSaveRef.current = false }, 600)
    setShowMore(false)
  }

  const canRestorePremade = ['arduino-lcd-demo', 'arduino-oled-demo', 'arduino-seven-segment-demo', 'half-adder', 'full-adder', 'four-bit-adder'].includes(projectId ?? '')

  const isDisplayDemoMissingParts = projectId === 'arduino-lcd-demo'
    ? !parts.some((p) => p.kind === 'mcu') || !parts.some((p) => p.kind === 'lcd')
    : projectId === 'arduino-oled-demo'
      ? !parts.some((p) => p.kind === 'mcu') || !parts.some((p) => p.kind === 'oled')
      : projectId === 'full-adder'
        ? !parts.some((p) => p.kind === 'seven-segment')
        : false

  const exportCurrentProject = () => {
    const id = projectId || activeIdRef.current
    if (!id) return
    try { saveCircuit(id, getCircuitSnapshot()) } catch { /* continue with current snapshot */ }
    const project = useProjects.getState().getProject(id)
    const data = project && useProjects.getState().exportProject(project.id)
    if (!project || !data) return
    const url = URL.createObjectURL(new Blob([data], {type:'application/json'}))
    const link = document.createElement('a')
    link.href = url
    link.download = `${project.name.replace(/[^a-z0-9-_]+/gi, '_')}.json`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (e.ctrlKey && e.key === 'F1') {e.preventDefault();setRibbonCollapsed(v => !v);return}
      if (['INPUT','TEXTAREA','SELECT'].includes(target?.tagName || '') || target?.isContentEditable || e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      if (key === 'p') {e.preventDefault(); toggleMoveMode()}
      if (key === 'v' || key === 'w') {
        // The 3D canvas handles the actual V/W tool shortcuts; synchronize
        // pan camera state so the tool always behaves as its button indicates.
        if (moveMode) {setMoveMode(false); cameraCommand('move-mode', false)}
      }
      if (key === 'f') {e.preventDefault(); cameraCommand('reset-view')}
      if (key === 'g' && use3D) {e.preventDefault(); cameraCommand('focus-circuit')}
      if (e.key === '?') {e.preventDefault(); setShowShortcuts((v) => !v)}
      if (e.key === 'Escape') {setPaletteOpen(false);setShowMore(false);setShowEditorSettings(false);setShowShortcuts(false); if (moveMode) {setMoveMode(false);cameraCommand('move-mode',false)}}
    }
    window.addEventListener('keydown',onKey)
    return () => window.removeEventListener('keydown',onKey)
  // Only add listener when mode changes; key callbacks read current store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [use3D, moveMode])

  const premadeProjects = projects.filter(p => ['half-adder','full-adder','four-bit-adder','arduino-lcd-demo','arduino-oled-demo','arduino-seven-segment-demo'].includes(p.id));
  const openPremade = (id: string) => {
    const destination = useProjects.getState().getProject(id);
    if (destination) navigate(`/editor/${id}`);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) { void document.exitFullscreen(); return; }
    if (workspaceRef.current?.requestFullscreen) void workspaceRef.current.requestFullscreen().catch(() => {});
  };

  return (
    <div ref={workspaceRef} className="editor-workspace editor-reference-ui flex-1 flex flex-col overflow-hidden h-full bg-[#061529]">
      <header className="editor-topbar flex-shrink-0 z-20" aria-label="Circuit editor toolbar">
        <div className="editor-toolbar-main flex items-center gap-3 px-3 lg:px-5 py-2">
          <button type="button" onClick={() => navigate('/projects')} aria-label="Return to projects" title="Back to Projects" className="editor-icon-btn editor-back-btn"><ChevronLeft size={18}/></button>
          <div className="min-w-0 flex-1 editor-document-title">
            <div className="editor-project-name truncate" title={title}>{title}</div>
            <div className="editor-project-meta"><CheckCircle2 size={12}/> Auto-save on · {parts.length} parts · {wires.length} wires</div>
          </div>
          <div className="editor-view-switch" role="group" aria-label="Editor view">
            <button type="button" aria-pressed={use3D} className={use3D ? 'active' : ''} onClick={() => setUse3D(true)}>3D</button>
            <button type="button" aria-pressed={!use3D} className={!use3D ? 'active' : ''} onClick={() => setUse3D(false)}>2D</button>
          </div>
          {parts.some(part => part.kind === 'mcu') && <button type="button" className="editor-arduino-code-shortcut" title="Open Arduino sketch editor" aria-label="Open Arduino Code editor" onClick={() => setOpenArduinoCodeRequest(request => request + 1)}><Code2 size={17}/><span>Arduino Code</span></button>}
          <button type="button" className="editor-main-action" onClick={handleRunSimulation} title="Run and view the simulation report"><Play size={17}/> <span className="hidden sm:inline">Run &amp; Results</span><span className="sm:hidden">Run</span></button>
          <div className="editor-more-wrap" ref={moreMenuRef}>
            <button type="button" className="editor-icon-btn editor-more-trigger" aria-label="More project actions" title="More actions" aria-expanded={showMore} onClick={() => setShowMore(v=>!v)}><ChevronDown size={18}/></button>
            {showMore && <div className="editor-more-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => {useLab.getState().autoTidyWires();setShowMore(false)}}><Cable size={15}/> Auto Tidy wires (undoable)</button>
              {selectedWire && <>
                <button type="button" role="menuitem" onClick={() => {useLab.getState().setSelectedWireRouteLocked(!selectedWire.routeLocked);setShowMore(false)}}><Check size={15}/> {selectedWire.routeLocked ? 'Unlock selected wire route' : 'Lock selected wire route'}</button>
                <button type="button" role="menuitem" onClick={() => {useLab.getState().nudgeSelectedWireLane('z', -0.15);setShowMore(false)}}><Cable size={15}/> Shift selected wire toward top rail</button>
                <button type="button" role="menuitem" onClick={() => {useLab.getState().nudgeSelectedWireLane('z', 0.15);setShowMore(false)}}><Cable size={15}/> Shift selected wire toward bottom rail</button>
                <button type="button" role="menuitem" onClick={() => {useLab.getState().nudgeSelectedWireLane('x', -0.15);setShowMore(false)}}><Cable size={15}/> Shift selected wire left</button>
                <button type="button" role="menuitem" onClick={() => {useLab.getState().nudgeSelectedWireLane('x', 0.15);setShowMore(false)}}><Cable size={15}/> Shift selected wire right</button>
              </>}
              <button type="button" role="menuitem" onClick={() => {exportCurrentProject();setShowMore(false)}}><Download size={15}/> Export project JSON</button>
              {canRestorePremade && <button type="button" role="menuitem" onClick={restorePremade}><RotateCcw size={15}/> Restore original demo (backs up edits)</button>}
              <button type="button" role="menuitem" onClick={() => {setShowShortcuts(true);setShowMore(false)}}><Keyboard size={15}/> Keyboard shortcuts</button>
              <button type="button" role="menuitem" onClick={() => {setHelpOpen(true);setShowMore(false)}}><HelpCircle size={15}/> Simulator help</button>
              <button type="button" className="destructive" role="menuitem" onClick={() => {setShowMore(false); if(window.confirm('Clear all parts and wires on this breadboard? This action cannot be undone.')) useLab.getState().clearBoard();}}><Trash2 size={15}/> Clear breadboard</button>
            </div>}
          </div>
          <div className="editor-more-wrap" ref={settingsMenuRef}>
            <button type="button" className="editor-icon-btn editor-header-action" title="Editor settings" aria-label="Editor settings" aria-expanded={showEditorSettings} onClick={() => setShowEditorSettings(v=>!v)}><Settings2 size={19}/></button>
            {showEditorSettings && <div className="editor-more-menu editor-settings-menu" role="group" aria-label="Editor settings">
              <div className="editor-settings-heading">Workbench settings</div>
              <button type="button" onClick={() => setPartDragEnabled(!partDragEnabled)} aria-pressed={partDragEnabled}><Move size={15}/>{partDragEnabled ? 'Component dragging: On' : 'Component dragging: Off'}</button>
              <button type="button" onClick={() => useLab.getState().setShowWireFlow(!showWireFlow)} aria-pressed={showWireFlow}><Cable size={15}/>{showWireFlow ? 'Wire flow animation: On' : 'Wire flow animation: Off'}</button>
              <button type="button" onClick={() => useLab.getState().setFocusConnections(!focusConnections)} aria-pressed={focusConnections}><Focus size={15}/>{focusConnections ? 'Focus connections: On' : 'Focus connections: Off'}</button>
              <button type="button" onClick={() => {cameraCommand('focus-circuit');setShowEditorSettings(false)}}><Focus size={15}/> Focus placed components</button>
              <button type="button" onClick={() => {cameraCommand('reset-view');setShowEditorSettings(false)}}><Maximize2 size={15}/> Fit entire breadboard</button>
              <button type="button" onClick={() => {setShowShortcuts(true);setShowEditorSettings(false)}}><Keyboard size={15}/> Keyboard shortcuts</button>
            </div>}
          </div>
          <button type="button" className="editor-icon-btn editor-header-action" title="Simulator help" aria-label="Simulator help" onClick={() => setHelpOpen(true)}><HelpCircle size={19}/></button>
        </div>
        {/* Familiar document-editor navigation: title bar, tabs, contextual ribbon. */}
        <div className="editor-ribbon-tabs" role="tablist" aria-label="3D simulator ribbon tabs">
          {([
            ['home', 'Home'], ['insert', 'Insert'], ['wiring', 'Wiring'],
            ['simulation', 'Simulation'], ['view', 'View'],
          ] as const).map(([key, name]) => <button key={key} type="button" role="tab" id={`editor-ribbon-tab-${key}`} aria-controls="editor-ribbon-panel" aria-selected={ribbonTab === key} className={`editor-ribbon-tab ${ribbonTab === key ? 'active' : ''}`} onClick={() => {exitFocusMode();setRibbonTab(key);setRibbonCollapsed(false);setPaletteOpen(false)}}>{name}</button>)}
          <span className="editor-ribbon-tab-spacer"/>
          <button type="button" className={`editor-ribbon-chrome ${focusMode ? 'active' : ''}`} aria-pressed={focusMode} onClick={toggleFocusMode} title="Focus on the workbench — hide panels and ribbon"><Maximize2 size={16}/><span>Focus workbench</span></button>
          <button type="button" className="editor-ribbon-chrome" onClick={() => {setRibbonCollapsed(v => !v);setPaletteOpen(false)}} aria-expanded={!ribbonCollapsed} aria-controls="editor-ribbon-panel" aria-label={ribbonCollapsed ? 'Expand ribbon' : 'Collapse ribbon'} title="Show or hide ribbon (Ctrl+F1)">{ribbonCollapsed ? <PanelTopOpen size={17}/> : <PanelTopClose size={17}/>}<span>{ribbonCollapsed ? 'Show ribbon' : 'Hide ribbon'}</span></button>
        </div>
        {!ribbonCollapsed && <div id="editor-ribbon-panel" className="editor-ribbon-panel" role="tabpanel" aria-labelledby={`editor-ribbon-tab-${ribbonTab}`}>
          {ribbonTab === 'home' && <>
            <div className="editor-ribbon-group" role="group" aria-label="Build tools"><div className="editor-ribbon-group-actions">
              <button type="button" className="editor-ribbon-primary" onClick={() => showLibrary('parts')}><CircuitBoard size={21}/><span>Parts library</span></button>
              <EditorToolButton label="Select" shortcut="V" icon={<MousePointer2 size={19}/>}  active={activeTool === 'select' && !moveMode} onClick={() => toggleToolbarTool('select')}/>
              <EditorToolButton label="Wire" shortcut="W" icon={<Cable size={19}/>}  active={activeTool === 'wire'} onClick={() => toggleToolbarTool('wire')}/>
              <EditorToolButton label="Pan" shortcut="P" icon={<Hand size={19}/>}  active={moveMode} onClick={toggleMoveMode}/>
            </div><span className="editor-ribbon-group-label">Build &amp; edit</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Arrange parts"><div className="editor-ribbon-group-actions">
              <EditorToolButton label="Rotate" shortcut="R" icon={<RotateCw size={18}/>} disabled={ !selectedItem || !parts.some(p=>p.id===selectedItem)} onClick={() => useLab.getState().rotateSelected()}/>
              <EditorToolButton label="Delete" shortcut="Del" icon={<Trash2 size={19}/>} danger disabled={ !selectedItem} onClick={() => useLab.getState().deleteSelected()}/>
              <EditorToolButton label="Tidy wires" icon={<Focus size={18}/>} disabled={ !wires.length} onClick={() => useLab.getState().autoTidyWires()}/>
            </div><span className="editor-ribbon-group-label">Arrange</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="History"><div className="editor-ribbon-group-actions">
              <EditorToolButton label="Undo" shortcut="Ctrl+Z" icon={<Undo2 size={19}/>} disabled={ !canUndo} onClick={() => useLab.getState().undo()}/>
              <EditorToolButton label="Redo" shortcut="Ctrl+Y" icon={<Redo2 size={19}/>} disabled={ !canRedo} onClick={() => useLab.getState().redo()}/>
            </div><span className="editor-ribbon-group-label">History</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Quick simulation"><div className="editor-ribbon-group-actions">
              <button type="button" className="editor-ribbon-run" onClick={() => {const lab=useLab.getState();if(!lab.powerOn)lab.togglePower();lab.runNow();setOpenMonitorRequest(request=>request+1)}}><Play size={20}/><span>Run</span></button>
              <button type="button" className="editor-ribbon-command" onClick={() => setOpenMonitorRequest(request=>request+1)}><Activity size={19}/><span>Monitor</span></button>
              <button type="button" className="editor-ribbon-command" disabled={!parts.some(p=>p.kind==='mcu')} onClick={() => setOpenArduinoCodeRequest(request=>request+1)}><Code2 size={19}/><span>Code</span></button>
            </div><span className="editor-ribbon-group-label">Simulation</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Canvas framing"><div className="editor-ribbon-group-actions">
              <EditorToolButton label="Fit board" shortcut="F" icon={<Maximize2 size={19}/>}  onClick={() => cameraCommand('reset-view')}/>
              <EditorToolButton label="Focus parts" shortcut="G" icon={<Focus size={19}/>}  onClick={() => cameraCommand('focus-circuit')}/>
            </div><span className="editor-ribbon-group-label">Viewport</span></div>
          </>}
          {ribbonTab === 'insert' && <>
            <div className="editor-ribbon-group" role="group" aria-label="Insert component kinds"><div className="editor-ribbon-group-actions">
              <button type="button" className={`editor-ribbon-primary ${paletteOpen && sidebarTab === 'parts' && category === 'All' ? 'active' : ''}`} aria-expanded={paletteOpen && sidebarTab === 'parts' && category === 'All'} aria-controls="editor-insert-gallery" onClick={() => toggleInsertGallery('parts', 'All')}><CircuitBoard size={21}/><span>All parts ({paletteCount})</span></button>
              {RIBBON_INSERT_KINDS.map(kind => <button type="button" key={kind} className={`editor-ribbon-command editor-insert-kind-button ${paletteOpen && sidebarTab === 'parts' && category === kind ? 'active' : ''}`} aria-expanded={paletteOpen && sidebarTab === 'parts' && category === kind} aria-controls="editor-insert-gallery" onClick={() => toggleInsertGallery('parts', kind)}>{kind === 'Microcontrollers' ? <Cpu size={19}/> : kind === 'Semiconductors' ? <Zap size={19}/> : kind === 'Passive' ? <CircuitBoard size={19}/> : kind === 'Sensors' ? <Activity size={19}/> : kind === 'Output Devices' ? <Monitor size={19}/> : <LayoutGrid size={19}/>}<span>{kind}</span></button>)}
              <button ref={moreKindsButtonRef} type="button" className={`editor-ribbon-command editor-more-kinds-trigger ${moreKindsOpen || (paletteOpen && sidebarTab === 'parts' && MORE_INSERT_KINDS.some(section => section.title === category)) ? 'active' : ''}`} onClick={toggleMoreKinds} aria-haspopup="true" aria-expanded={moreKindsOpen} aria-controls="editor-more-kinds-menu" aria-label="Browse more component kinds"><LayoutGrid size={19}/><span>More kinds <ChevronDown size={12} className="inline-block"/></span></button>
            </div><span className="editor-ribbon-group-label">Components by kind · click to browse or drag</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Saved circuits and examples"><div className="editor-ribbon-group-actions">
              <button type="button" className={`editor-ribbon-command ${paletteOpen && sidebarTab === 'circuits' ? 'active' : ''}`} aria-controls="editor-insert-gallery" aria-expanded={paletteOpen && sidebarTab === 'circuits'} onClick={() => toggleInsertGallery('circuits')}><BookOpen size={19}/><span>Circuits</span></button>
              <button type="button" className={`editor-ribbon-command ${paletteOpen && sidebarTab === 'examples' ? 'active' : ''}`} aria-controls="editor-insert-gallery" aria-expanded={paletteOpen && sidebarTab === 'examples'} onClick={() => toggleInsertGallery('examples')}><LayoutGrid size={19}/><span>Examples</span></button>
            </div><span className="editor-ribbon-group-label">Projects</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Breadboard size"><div className="editor-ribbon-group-actions editor-insert-board-choice">
              <CircuitBoard size={20}/>
              <select aria-label="Breadboard size" value={boardPreset} onChange={(e) => handleBoardPresetChange(e.target.value as BoardPresetId)}>
                {BOARD_PRESETS.map(board => <option key={board.id} value={board.id}>{board.label} · {board.cols} columns</option>)}
              </select>
            </div><span className="editor-ribbon-group-label">Breadboard</span></div>
          </>}
          {ribbonTab === 'wiring' && <>
            <div className="editor-ribbon-group" role="group" aria-label="Wiring commands"><div className="editor-ribbon-group-actions">
              {/* Choosing Solid or Jumper below enters Wire mode. W remains a shortcut. */}
              <EditorToolButton label="Select" shortcut="V" icon={<MousePointer2 size={19}/>}  active={activeTool==='select'&&!moveMode} onClick={() => toggleToolbarTool('select')}/>
              <EditorToolButton label="Auto tidy" icon={<Focus size={18}/>} disabled={!wires.length} onClick={() => useLab.getState().autoTidyWires()}/>
            </div><span className="editor-ribbon-group-label">Connections</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Wire style"><div className="editor-ribbon-group-actions">
              {(['solid','jumper'] as WireStyle[]).map(style => <button key={style} type="button" className={`editor-ribbon-command ${activeTool==='wire' && wireStyle===style?'active':''}`} aria-pressed={activeTool==='wire' && wireStyle===style} onClick={() => {
                const lab = useLab.getState();
                lab.setWireStyle(style);
                lab.dismissPlacementError();
                // A style is itself a wire tool. Don't cancel an already-picked
                // endpoint when changing style midway through a connection.
                if (lab.tool !== 'wire') selectTool('wire');
              }} ><Cable size={18}/><span>{style==='solid'?'Solid':'Jumper'}</span></button>)}
            </div><span className="editor-ribbon-group-label">Wire style</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Wire colors"><div className="editor-ribbon-color-picker">
              {(['red','black','blue','orange','green','yellow','white'] as WireColor[]).map(color => <button key={color} type="button" className={`editor-ribbon-color ${wireColor===color?'active':''}`} style={{'--wire-color': WIRE_HEX[color]} as React.CSSProperties} title={`${color} wire`} aria-label={`${color} wire`} aria-pressed={wireColor===color} onClick={() => useLab.getState().setWireColor(color)}><span/></button>)}
            </div><span className="editor-ribbon-group-label">Color</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Wire flow"><div className="editor-ribbon-group-actions">
              <button type="button" className={`editor-ribbon-command ${showWireFlow?'active':''}`} aria-pressed={showWireFlow} onClick={() => useLab.getState().setShowWireFlow(!showWireFlow)}><Activity size={19}/><span>Animate flow</span></button>
            </div><span className="editor-ribbon-group-label">Visuals</span></div>
          </>}
          {ribbonTab === 'simulation' && <>
            <div className="editor-ribbon-group" role="group" aria-label="Simulation power"><div className="editor-ribbon-group-actions">
              <button type="button" className="editor-ribbon-run" onClick={() => {const lab=useLab.getState();if(!lab.powerOn)lab.togglePower();lab.runNow();setOpenMonitorRequest(request=>request+1)}}><Play size={21}/><span>Run</span></button>
              <button type="button" className={`editor-ribbon-command ${powerOn?'active':''}`} aria-pressed={powerOn} onClick={() => useLab.getState().togglePower()}><Zap size={19}/><span>{powerOn?'Stop power':'Power on'}</span></button>
              <button type="button" className="editor-ribbon-command" onClick={handleRunSimulation}><Activity size={19}/><span>Results</span></button>
            </div><span className="editor-ribbon-group-label">Run &amp; test</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Simulation panels"><div className="editor-ribbon-group-actions">
              <button type="button" className="editor-ribbon-command" onClick={() => setOpenMonitorRequest(request=>request+1)}><Monitor size={19}/><span>Monitor</span></button>
              <button type="button" className="editor-ribbon-command" disabled={!parts.some(p=>p.kind==='mcu')} onClick={() => setOpenArduinoCodeRequest(request=>request+1)}><Code2 size={19}/><span>Arduino code</span></button>
            </div><span className="editor-ribbon-group-label">Instruments</span></div>
          </>}
          {ribbonTab === 'view' && <>
            <div className="editor-ribbon-group" role="group" aria-label="3D or 2D view"><div className="editor-ribbon-group-actions">
              <button type="button" className={`editor-ribbon-command ${use3D?'active':''}`} aria-pressed={use3D} onClick={() => setUse3D(true)}><Cpu size={19}/><span>3D view</span></button>
              <button type="button" className={`editor-ribbon-command ${!use3D?'active':''}`} aria-pressed={!use3D} onClick={() => setUse3D(false)}><CircuitBoard size={19}/><span>2D view</span></button>
            </div><span className="editor-ribbon-group-label">View mode</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Camera"><div className="editor-ribbon-group-actions">
              <EditorToolButton label="Zoom in" icon={<ZoomIn size={19}/>} onClick={() => cameraCommand('zoom-in')} />
              <EditorToolButton label="Zoom out" icon={<ZoomOut size={19}/>} onClick={() => cameraCommand('zoom-out')} />
              <EditorToolButton label="Fit board" shortcut="F" icon={<Maximize2 size={19}/>} onClick={() => cameraCommand('reset-view')} />
              <EditorToolButton label="Focus parts" shortcut="G" icon={<Focus size={19}/>} onClick={() => cameraCommand('focus-circuit')} />
              <EditorToolButton label="Fullscreen" icon={<Monitor size={19}/>} onClick={toggleFullscreen}/>
            </div><span className="editor-ribbon-group-label">Camera &amp; zoom</span></div>
            <div className="editor-ribbon-group" role="group" aria-label="Workspace panels"><div className="editor-ribbon-group-actions">
              <button type="button" className={`editor-ribbon-command ${propertiesOpen?'active':''}`} aria-pressed={propertiesOpen} onClick={togglePropertiesPanel}><SlidersHorizontal size={19}/><span>Properties</span></button>
              <button type="button" className={`editor-ribbon-command ${focusMode?'active':''}`} aria-pressed={focusMode} onClick={toggleFocusMode}><Maximize2 size={19}/><span>Focus mode</span></button>
            </div><span className="editor-ribbon-group-label">Panels</span></div>
          </>}
        </div>}
        {moreKindsOpen && ribbonTab === 'insert' && !ribbonCollapsed && !focusMode &&
          <div id="editor-more-kinds-menu" ref={moreKindsMenuRef} className="editor-more-kinds-menu" style={{ left: moreKindsLeft }} role="group" aria-label="More component kinds">
            <div className="editor-more-kinds-title">Other component kinds</div>
            {MORE_INSERT_KINDS.map(section =>
              <button type="button" key={section.title} className={`editor-more-kinds-item ${category === section.title ? 'active' : ''}`} onClick={() => showLibrary('parts', section.title)}>
                <span>{section.title}</span><span className="editor-more-kinds-count">{section.items.length}</span>
              </button>
            )}
          </div>}
        {paletteOpen && ribbonTab === 'insert' && !ribbonCollapsed && !focusMode && <section id="editor-insert-gallery" ref={insertGalleryRef} className="editor-insert-gallery flex flex-col" aria-label="Insert components" role="dialog" aria-modal="false">
          <div ref={insertGalleryBodyRef} className="editor-insert-gallery-body" aria-label="Scrollable Insert gallery">
          {(sidebarTab !== 'parts' || category === 'All') && <div className="editor-insert-gallery-head"><div><strong>{sidebarTab === 'parts' ? 'Insert components by kind' : sidebarTab === 'circuits' ? 'Circuit components' : 'Example circuits'}</strong><span>{sidebarTab === 'parts' ? `${paletteCount} components · ${PALETTE.length} kinds` : 'Select an item to open it'}</span></div><button type="button" aria-label="Close Insert gallery" title="Close Insert gallery" onClick={() => setPaletteOpen(false)}><PanelTopClose size={18}/></button></div>}
          {(sidebarTab !== 'parts' || category === 'All') && <div className="editor-insert-gallery-tabs" role="tablist" aria-label="Insert content"><button type="button" role="tab" aria-selected={sidebarTab==='parts'} className={sidebarTab==='parts'?'active':''} onClick={() => showLibrary('parts')}><CircuitBoard size={15}/> Parts</button><button type="button" role="tab" aria-selected={sidebarTab==='circuits'} className={sidebarTab==='circuits'?'active':''} onClick={() => showLibrary('circuits')}><BookOpen size={15}/> Circuits</button><button type="button" role="tab" aria-selected={sidebarTab==='examples'} className={sidebarTab==='examples'?'active':''} onClick={() => showLibrary('examples')}><LayoutGrid size={15}/> Examples</button></div>}
          {sidebarTab === 'parts' && <>
          <div className="editor-palette-heading">
            {category === 'All' && <div className="flex justify-between items-center mb-2">
              <div className="font-semibold text-xs text-[#e3f4ff]">Components <span className="ml-1 text-[10px] font-normal text-slate-400">{paletteCount}</span></div>
              <button type="button" className="editor-quiet-link" onClick={() => setShowTips((v) => !v)} aria-expanded={showTips} title="Component placement help">{showTips ? 'Hide tips' : 'Tips'}</button>
            </div>}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={category === 'All' ? 'Find a part, model, or pin…' : `Search ${category.toLowerCase()}…`} aria-label={`Search ${category === 'All' ? 'components' : category}`} className={`editor-palette-search ${category === 'All' ? '' : 'editor-insert-kind-search'}`}/>
              {category !== 'All' && <button type="button" className="editor-insert-search-close" title="Close gallery (Esc)" aria-label="Close Insert gallery" onClick={() => setPaletteOpen(false)}><PanelTopClose size={16}/></button>}
            </div>
            {category === 'All' && showTips && <p className="editor-tip-banner">{partDragEnabled ? 'Drag parts onto the breadboard; Arduino, Nano, Mega, ESP32 and Pico sit beside it. Choose Wire (W), then click a header socket and breadboard hole.' : 'Choose a part and click each hole for its leads. Re-enable 3D drag above for one-step placement.'}</p>}
            {category === 'All' && <div className="editor-palette-filters" role="group" aria-label="Component filters">
              {(['All','Favorites','Recent'] as const).map((filter) => <button key={filter} type="button" className={category === filter ? 'active' : ''} onClick={() => setCategory(filter)}>{filter === 'Favorites' && <Star size={12}/>} {filter === 'Recent' && <Clock3 size={12}/>} {filter}</button>)}
            </div>}
            {category === 'All' && <div className="editor-insert-kind-list" role="group" aria-label="Component kinds">
              {PALETTE.map(section => <button type="button" key={section.title} className={category === section.title ? 'active' : ''} aria-pressed={category === section.title} onClick={() => setCategory(section.title)}>{section.title}<span>{section.items.length}</span></button>)}
            </div>}
          </div>
          <div className="editor-palette-scroll flex-1 min-h-0 overflow-y-auto">
            {filteredPalette.length === 0 && <div className="text-center py-12 px-3 text-xs text-slate-400">No matching components. {category !== 'All' && <button className="editor-quiet-link block mx-auto mt-2" type="button" onClick={() => {setCategory('All');setSearch('')}}>Show all components</button>}</div>}
            {filteredPalette.map((section) => <section key={section.title} className="editor-palette-section">
              {(['All','Favorites','Recent'].includes(category)) && <div className="editor-palette-section-title"><span>{section.title}</span><span>{section.items.length}</span></div>}
              <div className="editor-parts-grid">
                {section.items.map((item) => <div key={item.id} className={`editor-part-tile ${activeTool === item.tool && (item.preset?.ledColor ? useLab.getState().ledColor === item.preset.ledColor : item.preset?.transistorModel ? useLab.getState().transistorModel === item.preset.transistorModel : item.preset?.motorModel ? useLab.getState().motorModel === item.preset.motorModel : true) ? 'active' : ''}`}>
                  <button type="button" className="editor-part-main" onPointerDown={(event) => beginPaletteDrag(event, item.tool, item.label, item)} onClick={() => { if (suppressPaletteClickRef.current) {suppressPaletteClickRef.current = false;return}; if (!dragActiveRef.current) {selectTool(item.tool, item);setPaletteOpen(false)} }} title={`Drag ${item.label} onto the board or click to select`}>
                    <span className="editor-part-symbol" aria-hidden="true">{item.symbol}</span><span className="editor-part-label">{item.label}</span>
                  </button>
                  <button type="button" className={`editor-favorite ${favorites.includes(item.id) ? 'active' : ''}`} onClick={() => toggleFavorite(item.id)} title={favorites.includes(item.id) ? `Remove ${item.label} from favorites` : `Favorite ${item.label}`} aria-label={`${favorites.includes(item.id) ? 'Unfavorite' : 'Favorite'} ${item.label}`}><Star size={12} fill={favorites.includes(item.id) ? 'currentColor' : 'none'}/></button>
                </div>)}
              </div>
            </section>)}
          </div>
          </>}
          {sidebarTab === 'circuits' && <div className="editor-palette-scroll editor-sidebar-list flex-1 min-h-0 overflow-y-auto" aria-label="Components in the current project">
            <div className="editor-sidebar-section-heading"><strong>Current circuit</strong><span>{parts.length} parts · {wires.length} wires</span></div>
            <p>Select a part to inspect, move, rotate or remove it. All changes are saved in this project.</p>
            {parts.length===0 && <div className="editor-sidebar-empty"><CircuitBoard size={23}/><strong>No components yet</strong><span>Open the Parts tab to build a circuit.</span></div>}
            {parts.map((part,i) => <button type="button" key={part.id} className={`editor-circuit-item ${part.id===selectedItem?'active':''}`} onClick={() => {useLab.getState().setTool('select');useLab.getState().select(part.id);}}><span className="editor-circuit-item-icon"><Cpu size={17}/></span><span><strong>{part.props.label || part.kind.toUpperCase()}</strong><small>{part.kind} · #{i+1}</small></span><ChevronLeft size={15} className="editor-item-chevron"/></button>)}
            <div className="editor-sidebar-note"><Info size={16}/> Power and measurement controls are below the breadboard.</div>
          </div>}
          {sidebarTab === 'examples' && <div className="editor-palette-scroll editor-sidebar-list flex-1 min-h-0 overflow-y-auto" aria-label="Premade circuit examples">
            <div className="editor-sidebar-section-heading"><strong>Premade examples</strong><span>{premadeProjects.length} available</span></div>
            <p>Open a complete, editable lab. Your current project remains saved.</p>
            {premadeProjects.map(project => <button type="button" key={project.id} className={`editor-example-item ${projectId===project.id?'active':''}`} onClick={() => openPremade(project.id)}><CircuitBoard size={20}/><span><strong>{project.name}</strong><small>{project.description || 'Editable 3D breadboard project'}</small></span><ChevronLeft size={15} className="editor-item-chevron"/></button>)}
            <div className="editor-sidebar-note"><Info size={16}/> Premade examples are independent projects. Restore their factory wiring from More actions if needed.</div>
          </div>}
          </div>
        </section>}
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0 editor-body-layout">


        <div className="editor-main-stack flex-1 min-w-0 min-h-0 flex flex-col">
        <main className="editor-board-stage flex-1 relative min-w-0 min-h-0 bg-[#282f39]">
          {use3D && activeTool === 'wire' && <div className="absolute left-1/2 top-3 -translate-x-1/2 z-20 pointer-events-none max-w-[88%] rounded-lg border border-cyan-500/40 bg-[#0b1a2b]/95 px-3 py-2 text-xs font-medium text-slate-100 shadow-lg" role="status" aria-live="polite">
            <span className="text-cyan-300">Wiring</span> · {pendingWireStart ? <>From <strong>{pendingWireStart}</strong> — click another hole or a visible module socket (Esc to cancel)</> : 'Click a breadboard hole or a component socket to start a wire'}
          </div>}
          {use3D && !paletteOpen && !focusMode && parts.length===0 && <button type="button" className="editor-insert-hint" onClick={() => showLibrary('parts','All')}><Plus size={15}/> Insert → browse parts by kind</button>}
          {isDisplayDemoMissingParts && <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 max-w-[94%] rounded-xl bg-[#13243b] border border-amber-400/40 shadow-xl px-4 py-3 flex flex-wrap items-center justify-center gap-3 text-sm text-slate-100">
            <span>{projectId === 'full-adder' ? 'This saved Full Adder does not include the new 7-segment display.' : 'This saved demo is missing its Arduino or display.'}</span>
            <button type="button" className="rounded-lg bg-cyan-500/20 border border-cyan-300/40 text-cyan-100 px-3 py-1.5 hover:bg-cyan-500/30" onClick={restorePremade}>Restore original circuit</button>
          </div>}
          {use3D ? (
            <LabErrorBoundary fallback={<SchematicFallback />}>
              <Suspense
                fallback={
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                    <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                    <div className="text-sm text-slate-400">Opening the bench…</div>
                    <button
                      onClick={() => setUse3D(false)}
                      className="text-xs text-blue-400 hover:underline mt-2"
                    >
                      Switch to 2D breadboard
                    </button>
                  </div>
                }
              >
                <div className="absolute inset-0">
                  <CircuitLab performanceMode={performanceMode} quality={graphicsQuality} />
                </div>
              </Suspense>
            </LabErrorBoundary>
          ) : (
            <div className="absolute inset-0 overflow-hidden">
              <PhysicalBreadboard2D panMode={moveMode} />
            </div>
          )}
        </main>
        </div>
        <div className="editor-right-side-system">
          <StudioProperties open={propertiesOpen} onToggle={togglePropertiesPanel}/>
          <WorkbenchUtilities open={utilitiesOpen} tab={utilityTab} onTabChange={setUtilityTab} onClose={()=>setUtilitiesOpen(false)} onOpen={openUtilitiesPanel} projectId={projectId} openArduinoCodeRequest={openArduinoCodeRequest} openMonitorRequest={openMonitorRequest} is3D={use3D} partDragEnabled={partDragEnabled} setPartDragEnabled={setPartDragEnabled} performanceMode={performanceMode} setPerformanceMode={(enabled)=>changeGraphicsQuality(enabled?'low':'high')} graphicsQuality={graphicsQuality} onGraphicsQualityChange={changeGraphicsQuality} onStartWiring={()=>{setRibbonTab('wiring');setRibbonCollapsed(false);setPaletteOpen(false);}}/>
          <nav className="editor-right-side-launchers" aria-label="Properties and workbench tools">
            <button type="button" aria-label="Toggle Properties sidebar" title="Properties" aria-expanded={propertiesOpen} className={propertiesOpen?'active':''} onClick={togglePropertiesPanel}><SlidersHorizontal size={20}/><span>Properties</span></button>
            <div className="editor-utility-launcher-group" role="group" aria-label="Circuit utility panels">
              {([
                { tab: 'monitor', label: 'Monitor', Icon: Monitor },
                { tab: 'guide', label: 'Wiring Guide', Icon: Cable },
                { tab: 'truth', label: 'Truth Table', Icon: LayoutGrid },
                { tab: 'code', label: 'Arduino Code', Icon: Code2 },
              ] as const).map(({ tab, label, Icon }) => (
                <button
                  type="button"
                  key={tab}
                  className={`editor-utility-launcher ${utilitiesOpen && utilityTab === tab ? 'active' : ''}`}
                  aria-label={`Open ${label} panel`}
                  aria-controls="editor-utilities-panel"
                  aria-expanded={utilitiesOpen && utilityTab === tab}
                  data-tooltip={label}
                  onClick={() => toggleUtilityPanel(tab)}
                ><Icon size={20}/></button>
              ))}
            </div>
          </nav>
        </div>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
      {showShortcuts && <div className="editor-shortcuts-backdrop" onMouseDown={() => setShowShortcuts(false)}>
        <section className="editor-shortcuts-dialog" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onMouseDown={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4"><h2 className="font-semibold text-white">Keyboard shortcuts</h2><button type="button" className="editor-icon-btn" onClick={() => setShowShortcuts(false)} aria-label="Close shortcuts">×</button></div>
          <div className="grid grid-cols-2 gap-y-3 text-sm text-slate-300">{[['V','Select'],['W','Wire'],['P','Pan / orbit mode'],['R','Rotate selected'],['Delete','Delete selected'],['F','Fit entire breadboard'],['G','Focus components'],['Ctrl + Z','Undo'],['Ctrl + Shift + Z','Redo'],['Esc','Cancel action'],['?','Shortcuts']].map(([key,action])=><div key={key} className="col-span-2 flex items-center justify-between gap-3"><span>{action}</span><kbd className="editor-kbd">{key}</kbd></div>)}</div>
        </section>
      </div>}

      {/* The actual PartSwitch 3D geometry follows the pointer. On the board,
          the same geometry is rendered by PlacementGhost, snapped to the holes. */}
      {use3D && dragPreview?.moved && !dragPreview.onBoard && (
        <div
          className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2"
          style={{ left: dragPreview.x, top: dragPreview.y }}
          aria-hidden="true"
        >
          <Suspense fallback={null}>
            <DraggedPart3D tool={dragPreview.tool} />
          </Suspense>
        </div>
      )}
      {dragPreview?.moved && dragPreview.onBoard && (dragPreview.snappedHole || dragPreview.benchPoint) && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 -translate-x-1/2 z-[60] rounded-xl border border-cyan-400/30 bg-[#06172b]/90 px-4 py-2 text-xs text-cyan-100 shadow-lg backdrop-blur-md" role="status">
          <span className="text-cyan-300 font-semibold">{dragPreview.benchPoint ? 'Workbench (off-board)' : dragPreview.snappedHole}</span> · Release to place {dragPreview.label}
        </div>
      )}
    </div>
  )
}
