import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Play,
  Share2,
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
} from 'lucide-react'
import HelpModal from '../components/HelpModal'
import { Suspense, lazy, useEffect, useMemo, useRef, useState, Component, type ReactNode } from 'react'
import { useLab } from '../store/lab'
import { useProjects } from '../store/projects'
import type { ToolId } from '../circuit/types'
import { Button } from '@/components/ui/button';
import {
  BOARD_PRESETS,
  holeStrip,
  type BoardPresetId,
} from '../circuit/breadboard'

const CircuitLab = lazy(() =>
  import('../circuit-lab/index').then((m) => ({ default: m.CircuitLab })),
)
const Schematic2D = lazy(() =>
  import('../circuit-lab/schematic-2d').then((m) => ({ default: m.Schematic2D })),
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

const PALETTE: Array<{
  title: string
  items: Array<{
    id: string
    label: string
    symbol: ReactNode
    tool: ToolId | null
  }>
}> = [
  {
    title: 'Sources',
    items: [
      { id: 'vdc', label: 'VDC', symbol: '⎓', tool: 'psu-positive' },
      { id: 'vac', label: 'VAC', symbol: '~', tool: null },
      { id: 'gnd', label: 'GND', symbol: '⏚', tool: 'psu-negative' },
    ],
  },
  {
    title: 'Passive',
    items: [
      { id: 'res', label: 'Resistor', symbol: <ResistorSymbol />, tool: 'resistor' },
      { id: 'cap', label: 'Capacitor', symbol: <CapacitorSymbol />, tool: 'capacitor' },
      { id: 'ind', label: 'Inductor', symbol: <InductorSymbol />, tool: 'inductor' },
    ],
  },
  {
    title: 'Semiconductors',
    items: [
      { id: 'diode', label: 'Diode', symbol: <DiodeSymbol />, tool: 'diode' },
      { id: 'led', label: 'LED', symbol: <LedSymbol />, tool: 'led' },
      { id: 'transistor', label: 'Transistor', symbol: <TransistorSymbol />, tool: 'transistor' },
      { id: 'thyristor', label: 'Thyristor (SCR)', symbol: <ThyristorSymbol />, tool: 'thyristor' },
      { id: 'triac', label: 'TRIAC', symbol: <TriacSymbol />, tool: 'triac' },
      { id: 'diac', label: 'DIAC', symbol: <DiacSymbol />, tool: 'diac' },
    ],
  },
  {
    title: 'Switching',
    items: [
      { id: 'switch', label: 'Switch', symbol: <SwitchSymbol />, tool: 'switch' },
      { id: 'button', label: 'Push button', symbol: <PushButtonSymbol />, tool: 'button' },
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
      { id: 'motor', label: 'DC Motor', symbol: <MotorSymbol />, tool: 'motor' },
    ],
  },
  {
    title: 'Displays & Controllers',
    items: [
      { id: 'lcd', label: 'LCD 16×2', symbol: <LcdSymbol />, tool: 'lcd' },
      { id: 'oled', label: 'OLED', symbol: <OledSymbol />, tool: 'oled' },
      { id: 'mcu', label: 'Arduino / MCU', symbol: <McuSymbol />, tool: 'mcu' },
    ],
  },
  {
    title: 'Tools',
    items: [
      { id: 'wire', label: 'Wire', symbol: '↗', tool: 'wire' },
      { id: 'probe', label: 'Voltmeter', symbol: 'V', tool: 'probe' },
    ],
  }
]

export function CircuitEditorPage() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [use3D, setUse3D] = useState(true)
  const [helpOpen, setHelpOpen] = useState(false)
  const boardPreset = useLab((state) => state.boardId)
  const setBoard = useLab((state) => state.setBoard)
  const loadCircuit = useLab((state) => state.loadCircuit)
  const getCircuitSnapshot = useLab((state) => state.getCircuitSnapshot)
  const parts = useLab((state) => state.parts)
  const wires = useLab((state) => state.wires)
  const psuVoltage = useLab((state) => state.psuVoltage)

  const projects = useProjects((s) => s.projects)
  const getProject = useProjects((s) => s.getProject)
  const createProject = useProjects((s) => s.createProject)
  const saveCircuit = useProjects((s) => s.saveCircuit)
  const setActiveProjectId = useProjects((s) => s.setActiveProjectId)
  const touchProject = useProjects((s) => s.touchProject)

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
  }, [parts, wires, psuVoltage, boardPreset, saveCircuit, getCircuitSnapshot])

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

  const activeTool = useLab((state) => state.tool)

  const cameraCommand = (type: string, active?: boolean) => {
    window.dispatchEvent(
      new CustomEvent('ece-lab-camera', { detail: { type, active } }),
    )
  }

  const toggleMoveMode = () => {
    setMoveMode((current) => {
      const next = !current
      cameraCommand('move-mode', next)

      if (next) {
        useLab.getState().setTool('select')
      }

      return next
    })
  }

  const selectTool = (tool: ToolId | null) => {
    if (!tool) return

    setMoveMode(false)
    cameraCommand('move-mode', false)
    useLab.getState().setTool(tool)
  }

  const filteredPalette = useMemo(() => {
    const query = search.trim().toLowerCase()

    if (!query) return PALETTE

    return PALETTE
      .map((section) => ({
        ...section,
        items: section.items.filter((item) =>
          item.label.toLowerCase().includes(query),
        ),
      }))
      .filter((section) => section.items.length > 0)
  }, [search])

  const title = useMemo(() => {
    if (!projectId || projectId === 'new') return 'Untitled Project'
    return (
      projects.find((p) => p.id === projectId)?.name ||
      projectId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    )
  }, [projectId, projects])

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full bg-[#0a0f1a]">
      <div className="h-12 border-b border-[#1e293b] flex items-center px-3 gap-2 bg-[#0f172a] flex-shrink-0 z-20">
        <button
          onClick={() => navigate('/')}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 transition"
          title="Back to Dashboard"
        >
          <ChevronLeft size={20} />
        </button>

        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-white truncate">{title}</span>
          <span className="hidden sm:inline text-xs text-slate-500">• All changes saved</span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              const lab = useLab.getState()
              // Toggle: select on → off (none); off / other tool → select on
              if (lab.tool === 'select') {
                lab.setTool('none')
                lab.select(null)
              } else {
                lab.setTool('select')
              }
              setMoveMode(false)
              cameraCommand('move-mode', false)
            }}
            className={`hidden lg:inline-flex p-2 rounded-lg border transition ${
              activeTool === 'select' && !moveMode
                ? 'border-blue-500/40 bg-blue-600/15 text-blue-400'
                : 'border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400'
            }`}
            title={
              activeTool === 'select'
                ? 'Select mode ON — click again to turn off'
                : 'Select components'
            }
          >
            <MousePointer2 size={16} />
          </button>

          <button
            onClick={() => {
              const lab = useLab.getState()

              // Toggle: delete on → off (none); off / other tool → delete on
              if (lab.tool === 'delete') {
                lab.setTool('none')
                lab.select(null)
              } else {
                lab.setTool('delete')
              }

              setMoveMode(false)
              cameraCommand('move-mode', false)
            }}
            className={`hidden lg:inline-flex p-2 rounded-lg border transition ${
              activeTool === 'delete'
                ? 'border-red-500/40 bg-red-600/15 text-red-400'
                : 'border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400'
            }`}
            title={
              activeTool === 'delete'
                ? 'Delete mode ON — click again to turn off'
                : 'Delete components'
            }
          >
            <Trash2 size={16} />
          </button>

          <button
            onClick={() => useLab.getState().rotateSelected()}
            className="hidden lg:inline-flex p-2 rounded-lg border border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400 transition"
            title="Rotate selected component 180° (pins swap / reverse on the board)"
          >
            <RotateCw size={16} />
          </button>

          <button
            onClick={toggleMoveMode}
            className={`hidden lg:inline-flex p-2 rounded-lg border transition ${
              moveMode
                ? 'border-blue-500/40 bg-blue-600/15 text-blue-400'
                : 'border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400'
            }`}
            title={moveMode ? 'Exit move mode' : 'Move / pan the board'}
            aria-pressed={moveMode}
          >
            <Move size={16} />
          </button>

          <button
            onClick={() => useLab.getState().undo()}
            className="hidden lg:inline-flex p-2 rounded-lg border border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400 transition"
            title="Undo"
          >
            <Undo2 size={16} />
          </button>

          <button
            onClick={() => useLab.getState().redo()}
            className="hidden lg:inline-flex p-2 rounded-lg border border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400 transition"
            title="Redo"
          >
            <Redo2 size={16} />
          </button>

          <button
            onClick={() => cameraCommand('zoom-in')}
            className="hidden lg:inline-flex p-2 rounded-lg border border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400 transition"
            title="Zoom Out"
          >
            <ZoomOut size={16} />
          </button>

          <button
            onClick={() => cameraCommand('zoom-out')}
            className="hidden lg:inline-flex p-2 rounded-lg border border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-slate-400 transition"
            title="Zoom In"
          >
            <ZoomIn size={16} />
          </button>

          <button
            onClick={() => cameraCommand('reset-view')}
            className="hidden xl:inline-flex px-2 py-2 rounded-lg border border-transparent hover:border-[#1e293b] hover:bg-slate-800 text-[11px] text-slate-500 transition"
            title="Reset camera view"
          >
            Reset
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setUse3D((v) => !v)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-[#1e293b] text-slate-400 hover:bg-slate-800 hidden sm:block"
          >
            {use3D ? '2D View' : '3D Lab'}
          </button>

          <button
            onClick={() => {
              const id = projectId || activeIdRef.current
              // Persist board, force power + nodal solve
              try {
                if (id) saveCircuit(id, getCircuitSnapshot())
              } catch {
                /* ignore */
              }
              useLab.getState().runNow()
              const lab = useLab.getState()
              const sim = lab.sim
              const I = Math.abs(sim.supplyCurrent || 0)
              let status: 'Pass' | 'Warning' | 'Failed' = 'Pass'
              let notes: string | undefined
              if (sim.error || sim.shortCircuit) {
                status = 'Failed'
                notes = sim.error || 'Short circuit detected'
              } else if ((sim.warnings && sim.warnings.length > 0) || (sim.burned && Object.keys(sim.burned).length > 0)) {
                status = 'Warning'
                notes = (sim.warnings && sim.warnings[0]) || 'Component stress warning'
              } else if (!lab.psuPositive || !lab.psuNegative) {
                status = 'Warning'
                notes = 'Power supply clips not connected'
              } else if (lab.parts.length > 0 && I < 1e-9) {
                status = 'Warning'
                notes = 'No measurable supply current — check path / press buttons'
              }
              if (id) {
                useProjects.getState().recordSimRun({
                  projectId: id,
                  projectName:
                    useProjects.getState().projects.find((p) => p.id === id)?.name ||
                    id,
                  status,
                  notes,
                })
              }
              navigate('/results/' + (id || 'dc-motor'))
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3.5 py-1.5 rounded-lg transition"
          >
            <Play size={16} /> Run Simulation
          </button>

          <button
            onClick={() => setHelpOpen(true)}
            className="flex items-center gap-2 border border-[#1e293b] hover:bg-slate-800 text-sm px-3 py-1.5 rounded-lg text-slate-300 transition"
            title="Help"
          >
            <HelpCircle size={16} /> Help
          </button>

          <button
            className="flex items-center gap-2 border border-[#1e293b] hover:bg-slate-800 text-sm px-3 py-1.5 rounded-lg text-slate-300 transition"
            title="Share project"
          >
            <Share2 size={16} /> Share
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <aside className="w-52 border-r border-[#1e293b] bg-[#0f172a] flex flex-col flex-shrink-0">
          <div className="p-3 border-b border-[#1e293b]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500"
              />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search components"
                className="w-full bg-[#0a0f1a] border border-[#1e293b] rounded-md pl-8 pr-7 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-200 placeholder:text-slate-600"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  title="Clear search"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-3">

          {/* Breadboards */}
          <div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1.5">
              Breadboards
            </div>

            <div className="space-y-1">
              {BOARD_PRESETS.map((board) => {
                const active = boardPreset === board.id

                return (
                  <button
                    key={board.id}
                    type="button"
                    onClick={() => handleBoardPresetChange(board.id)}
                    className={`w-full flex items-center gap-2 p-2 rounded-md text-left transition border ${
                      active
                        ? 'bg-cyan-900/60 border-cyan-400 text-white'
                        : 'hover:bg-slate-800/80 text-slate-400 hover:text-slate-200 border-transparent hover:border-[#1e293b]'
                    }`}
                    title={board.description}
                  >
                    <div className="w-9 h-9 shrink-0 rounded-md bg-[#0a0f1a] border border-[#1e293b] flex items-center justify-center">
                      <div className="w-6 h-4 rounded-sm border border-slate-500 relative">
                        <div className="absolute inset-x-1 top-1 h-px bg-red-500/70" />
                        <div className="absolute inset-x-1 bottom-1 h-px bg-blue-500/70" />
                      </div>
                    </div>

                    <div className="min-w-0">
                      <div className="text-[11px] font-medium truncate">
                        {board.label}
                      </div>

                      <div className="text-[9px] text-slate-500 truncate">
                        {board.cols} columns
                        {board.hasRails ? ' · Power rails' : ' · No rails'}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
            {filteredPalette.length === 0 ? (
              <div className="px-2 py-8 text-center text-xs text-slate-600">
                No components found.
              </div>
            ) : (
              filteredPalette.map((section) => (
                <div key={section.title}>
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide px-1 mb-1.5">
                    {section.title}
                  </div>

                  <div className="grid grid-cols-3 gap-1">
                    {section.items.map((item) => {
                      const active = item.tool !== null && activeTool === item.tool && !moveMode
                      const disabled = item.tool === null

                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={disabled}
                          onClick={() => selectTool(item.tool)}
                          draggable={!disabled}
                          onDragStart={(event) => {
                            if (!item.tool) {
                              event.preventDefault()
                              return
                            }

                            event.dataTransfer.setData(
                              'application/x-ece-tool',
                              item.tool,
                            )
                            event.dataTransfer.effectAllowed = 'copy'
                            selectTool(item.tool)
                          }}
                          className={`group flex flex-col items-center gap-1 p-1.5 rounded-md text-[10px] transition border ${
                            active
                              ? 'bg-blue-600/15 border-blue-500/40 text-blue-300'
                              : disabled
                                ? 'border-transparent text-slate-700 opacity-60 cursor-not-allowed'
                                : 'border-transparent hover:bg-slate-800/80 hover:border-[#1e293b] text-slate-400 hover:text-slate-200 cursor-pointer'
                          }`}
                          title={
                            disabled
                              ? `${item.label} is not available yet`
                              : `Select ${item.label}`
                          }
                        >
                          <div
                            className={`w-9 h-9 rounded-md bg-[#0a0f1a] border flex items-center justify-center text-xs font-mono ${
                              active
                                ? 'border-blue-500/50 text-blue-300'
                                : 'border-[#1e293b] text-slate-300 group-hover:border-slate-600'
                            }`}
                          >
                            {item.symbol}
                          </div>
                          <span className="truncate w-full text-center">
                            {item.label}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="border-t border-[#1e293b] mt-3" />
                </div>
              ))
            )}
          </div>

          <div className="p-2 border-t border-[#1e293b]">
            <button
              type="button"
              className="w-full flex items-center justify-center gap-1.5 text-xs text-blue-400 py-2 hover:bg-slate-800/60 rounded-md transition"
              title="More components"
            >
              <Plus size={14} /> More Components
            </button>
          </div>
        </aside>

        <main className="flex-1 relative min-w-0 bg-[#07101e]">
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
                      Switch to 2D schematic
                    </button>
                  </div>
                }
              >
                <div className="absolute inset-0">
                  <CircuitLab />
                </div>
              </Suspense>
            </LabErrorBoundary>
          ) : (
            <Suspense
              fallback={
                <div className="absolute inset-0 flex items-center justify-center text-slate-400 text-sm">
                  Loading schematic…
                </div>
              }
            >
              <Schematic2D />
            </Suspense>
          )}
        </main>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
