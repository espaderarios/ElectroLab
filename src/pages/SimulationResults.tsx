import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ChevronLeft,
  Download,
  Share2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react'
import { useProjects } from '../store/projects'
import { useLab } from '../store/lab'

function formatCurrent(amps: number): string {
  const a = Math.abs(amps)
  if (a < 1e-9) return '0 A'
  if (a < 1e-6) return `${(amps * 1e9).toFixed(2)} nA`
  if (a < 1e-3) return `${(amps * 1e6).toFixed(2)} µA`
  if (a < 1) return `${(amps * 1e3).toFixed(2)} mA`
  return `${amps.toFixed(3)} A`
}

function formatVolts(v: number): string {
  if (!Number.isFinite(v)) return '—'
  return `${v.toFixed(3)} V`
}

export function SimulationResults() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const projects = useProjects((s) => s.projects)
  const project = projects.find((p) => p.id === projectId)
  const title =
    project?.name ||
    (projectId
      ? projectId.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      : 'Simulation Results')

  const sim = useLab((s) => s.sim)
  const powerOn = useLab((s) => s.powerOn)
  const psuVoltage = useLab((s) => s.psuVoltage)
  const psuPositive = useLab((s) => s.psuPositive)
  const psuNegative = useLab((s) => s.psuNegative)
  const parts = useLab((s) => s.parts)
  const wires = useLab((s) => s.wires)

  const [tab, setTab] = useState<
    'waveforms' | 'measurements' | 'warnings' | 'checks' | 'logs'
  >('measurements')

  const I = Math.abs(sim.supplyCurrent || 0)
  const status: 'Pass' | 'Warning' | 'Failed' = useMemo(() => {
    if (sim.error || sim.shortCircuit) return 'Failed'
    if ((sim.warnings && sim.warnings.length > 0) || (sim.burned && Object.keys(sim.burned).length))
      return 'Warning'
    if (!psuPositive || !psuNegative) return 'Warning'
    if (parts.length > 0 && I < 1e-9) return 'Warning'
    return project?.status === 'Failed'
      ? 'Failed'
      : project?.status === 'Warning'
        ? 'Warning'
        : 'Pass'
  }, [sim, psuPositive, psuNegative, parts.length, I, project?.status])

  const ledRows = Object.entries(sim.leds || {}).map(([id, st]) => {
    const part = parts.find((p) => p.id === id)
    return {
      id,
      label: part?.props.label || part?.kind || id,
      on: st.on,
      current: st.current,
      brightness: st.brightness,
    }
  })

  const motorRows = Object.entries(sim.motors || {}).map(([id, st]) => {
    const part = parts.find((p) => p.id === id)
    return {
      id,
      label: part?.props.label || 'Motor',
      on: Boolean(st.on),
      current: st.current,
      voltage: st.voltage,
    }
  })

  const scrRows = Object.entries(sim.thyristors || {}).map(([id, st]) => {
    const part = parts.find((p) => p.id === id)
    return {
      id,
      label: part?.props.label || 'SCR',
      conducting: Boolean(st.conducting),
      current: st.iak,
    }
  })

  const probeHole = useLab((s) => s.probeHole)
  const probeV =
    probeHole && sim.voltages ? sim.voltages[probeHole as keyof typeof sim.voltages] : undefined

  // Simple synthetic waveform from supply current / voltage for the chart
  const wavePath = useMemo(() => {
    const pts: string[] = []
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const x = 40 + t * 540
      // flat DC once powered; small noise
      const level = powerOn ? 120 - (psuVoltage / 15) * 80 : 120
      const y = level + Math.sin(t * Math.PI * 8) * (powerOn && I > 0 ? 4 : 0)
      pts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`)
    }
    return pts.join(' ')
  }, [powerOn, psuVoltage, I])

  const iPath = useMemo(() => {
    const pts: string[] = []
    const scale = I > 0 ? Math.min(60, Math.log10(I * 1e6 + 1) * 12) : 0
    for (let i = 0; i <= 40; i++) {
      const t = i / 40
      const x = 40 + t * 540
      const y = 180 - scale + Math.sin(t * Math.PI * 6) * (I > 0 ? 3 : 0)
      pts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`)
    }
    return pts.join(' ')
  }, [I])

  const reportJson = useMemo(
    () =>
      JSON.stringify(
        {
          projectId: projectId || 'unknown',
          title,
          status,
          powerOn,
          psuVoltage,
          psuPositive,
          psuNegative,
          supplyCurrentA: sim.supplyCurrent,
          parts: parts.length,
          wires: wires.length,
          warnings: sim.warnings || [],
          shortCircuit: Boolean(sim.shortCircuit),
          error: sim.error || null,
          leds: sim.leds,
          motors: sim.motors,
          thyristors: sim.thyristors,
          generatedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    [
      projectId,
      title,
      status,
      powerOn,
      psuVoltage,
      psuPositive,
      psuNegative,
      sim,
      parts.length,
      wires.length,
    ],
  )

  const downloadReport = () => {
    const blob = new Blob([reportJson], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${projectId || 'simulation'}-report.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const shareReport = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: `ElectroLab – ${title}`,
          text: `Simulation ${status} · I = ${formatCurrent(I)}`,
          url: window.location.href,
        })
      } else {
        await navigator.clipboard.writeText(window.location.href)
        window.alert('Link copied to clipboard')
      }
    } catch {
      /* cancelled */
    }
  }

  const StatusIcon =
    status === 'Failed' ? XCircle : status === 'Warning' ? AlertTriangle : CheckCircle2
  const statusColor =
    status === 'Failed'
      ? 'text-red-400'
      : status === 'Warning'
        ? 'text-amber-400'
        : 'text-emerald-400'
  const bannerBg =
    status === 'Failed'
      ? 'bg-red-500/10 border-red-500/30'
      : status === 'Warning'
        ? 'bg-amber-500/10 border-amber-500/30'
        : 'bg-emerald-500/10 border-emerald-500/30'

  const tabs = [
    { id: 'waveforms' as const, label: 'Waveforms' },
    { id: 'measurements' as const, label: 'Measurements' },
    { id: 'warnings' as const, label: 'Warnings' },
    { id: 'checks' as const, label: 'Circuit Checks' },
    { id: 'logs' as const, label: 'Logs' },
  ]

  return (
    <div className="flex-1 flex flex-col overflow-hidden h-full">
      <div className="h-12 border-b border-[#1e293b] flex items-center px-4 gap-3 bg-[#0f172a] flex-shrink-0">
        <button
          type="button"
          onClick={() => navigate('/editor/' + (projectId || 'dc-motor'))}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium">Simulation Results – {title}</span>
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => {
            useLab.getState().runNow()
          }}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[#1e293b] text-slate-300 hover:bg-slate-800"
        >
          Re-run
        </button>
        <button
          type="button"
          onClick={downloadReport}
          className="flex items-center gap-2 border border-[#1e293b] hover:bg-slate-800 text-sm px-3 py-1.5 rounded-lg text-slate-300"
        >
          <Download size={16} /> Download Report
        </button>
        <button
          type="button"
          onClick={() => void shareReport()}
          className="flex items-center gap-2 border border-[#1e293b] hover:bg-slate-800 text-sm px-3 py-1.5 rounded-lg text-slate-300"
        >
          <Share2 size={16} /> Share
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className={`${bannerBg} border rounded-xl p-4 mb-5 flex flex-wrap items-start sm:items-center gap-4`}>
          <div className="w-10 h-10 rounded-full bg-black/20 flex items-center justify-center flex-shrink-0">
            <StatusIcon className={statusColor} size={24} />
          </div>
          <div className="flex-1">
            <div className={`text-lg font-semibold ${statusColor}`}>
              Simulation {status === 'Pass' ? 'Passed' : status}
            </div>
            <div className="text-sm text-slate-400">
              {status === 'Pass'
                ? 'Circuit solved with power applied.'
                : status === 'Failed'
                  ? sim.error || 'Short circuit or solver error.'
                  : 'Completed with warnings — review measurements.'}
            </div>
          </div>
          <div className="flex gap-6 text-sm flex-wrap">
            <div>
              <div className="text-xs text-slate-500">Supply</div>
              <div className="font-medium">{powerOn ? formatVolts(psuVoltage) : 'OFF'}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Supply current</div>
              <div className="font-medium">{formatCurrent(I)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Parts / wires</div>
              <div className="font-medium">
                {parts.length} / {wires.length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Status</div>
              <div className={`font-medium ${statusColor}`}>{status}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-[#111827] border border-[#1e293b] rounded-xl p-4">
            <div className="flex items-center gap-4 mb-3 flex-wrap">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`text-sm pb-1 ${
                    tab === t.id
                      ? 'font-medium text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'waveforms' && (
              <div className="h-64 bg-slate-900/50 rounded-lg relative overflow-hidden">
                <svg className="w-full h-full" viewBox="0 0 600 240" preserveAspectRatio="none">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <line
                      key={i}
                      x1="40"
                      y1={30 + i * 45}
                      x2="580"
                      y2={30 + i * 45}
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                  ))}
                  <path d={wavePath} fill="none" stroke="#22c55e" strokeWidth="2" />
                  <path d={iPath} fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity={0.9} />
                </svg>
                <div className="absolute top-2 right-3 flex gap-3 text-xs">
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-emerald-500 inline-block" /> V supply
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-3 h-0.5 bg-blue-500 inline-block" /> I supply
                  </span>
                </div>
              </div>
            )}

            {tab === 'measurements' && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Metric label="V supply" value={powerOn ? formatVolts(psuVoltage) : 'OFF'} />
                  <Metric label="I supply" value={formatCurrent(I)} />
                  <Metric
                    label="+ clip"
                    value={psuPositive || 'not set'}
                  />
                  <Metric
                    label="− clip"
                    value={psuNegative || 'not set'}
                  />
                  <Metric
                    label="Probe"
                    value={
                      probeHole
                        ? `${probeHole}: ${probeV != null ? formatVolts(probeV) : '—'}`
                        : 'none'
                    }
                  />
                </div>
                {ledRows.length > 0 && (
                  <Table
                    title="LEDs"
                    rows={ledRows.map((r) => [
                      r.label,
                      r.on ? 'ON' : 'off',
                      formatCurrent(r.current || 0),
                      `${Math.round((r.brightness || 0) * 100)}%`,
                    ])}
                    cols={['Name', 'State', 'I', 'Bright']}
                  />
                )}
                {motorRows.length > 0 && (
                  <Table
                    title="Motors"
                    rows={motorRows.map((r) => [
                      r.label,
                      r.on ? 'SPINNING' : 'stopped',
                      formatCurrent(r.current || 0),
                      formatVolts(r.voltage || 0),
                    ])}
                    cols={['Name', 'State', 'I', 'V']}
                  />
                )}
                {scrRows.length > 0 && (
                  <Table
                    title="Thyristors"
                    rows={scrRows.map((r) => [
                      r.label,
                      r.conducting ? 'LATCHED' : 'off',
                      formatCurrent(r.current || 0),
                    ])}
                    cols={['Name', 'State', 'I']}
                  />
                )}
                {ledRows.length + motorRows.length + scrRows.length === 0 && (
                  <p className="text-slate-500 text-sm">
                    No active device measurements — place parts and run again.
                  </p>
                )}
              </div>
            )}

            {tab === 'warnings' && (
              <ul className="text-sm space-y-2">
                {(sim.warnings || []).length === 0 && !sim.shortCircuit && !sim.error ? (
                  <li className="text-slate-500">No warnings.</li>
                ) : (
                  <>
                    {sim.error && (
                      <li className="text-red-400">Error: {sim.error}</li>
                    )}
                    {sim.shortCircuit && (
                      <li className="text-red-400">Short circuit detected.</li>
                    )}
                    {(sim.warnings || []).map((w, i) => (
                      <li key={i} className="text-amber-400">
                        {w}
                      </li>
                    ))}
                  </>
                )}
              </ul>
            )}

            {tab === 'checks' && (
              <ul className="text-sm space-y-2 text-slate-300">
                <Check ok={Boolean(psuPositive && psuNegative)} label="PSU clips connected" />
                <Check ok={powerOn} label="Power is ON" />
                <Check ok={parts.length > 0} label="At least one component placed" />
                <Check ok={wires.length > 0} label="Wires present" />
                <Check ok={!sim.shortCircuit} label="No short circuit" />
                <Check ok={!sim.error} label="Solver completed" />
              </ul>
            )}

            {tab === 'logs' && (
              <pre className="text-xs text-slate-400 bg-black/30 rounded-lg p-3 overflow-auto max-h-72">
                {reportJson}
              </pre>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
              <div className="text-sm font-medium mb-3">Quick stats</div>
              <div className="space-y-2 text-sm">
                <Row k="Project" v={title} />
                <Row k="Board parts" v={String(parts.length)} />
                <Row k="Wires" v={String(wires.length)} />
                <Row k="Supply I" v={formatCurrent(I)} />
                <Row k="Power" v={powerOn ? 'ON' : 'OFF'} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/editor/' + (projectId || 'dc-motor'))}
              className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium"
            >
              Back to editor
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900/50 rounded-lg p-3">
      <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="font-medium text-slate-100 mt-0.5 break-all">{value}</div>
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-200 text-right">{v}</span>
    </div>
  )
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok ? (
        <CheckCircle2 size={16} className="text-emerald-400" />
      ) : (
        <AlertTriangle size={16} className="text-amber-400" />
      )}
      {label}
    </li>
  )
}

function Table({
  title,
  cols,
  rows,
}: {
  title: string
  cols: string[]
  rows: string[][]
}) {
  return (
    <div>
      <div className="text-xs font-medium text-slate-400 mb-1">{title}</div>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-slate-500">
            {cols.map((c) => (
              <th key={c} className="py-1 pr-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-[#1e293b] text-slate-200">
              {r.map((cell, j) => (
                <td key={j} className="py-1.5 pr-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
