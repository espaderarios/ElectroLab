import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { useProjects } from "../store/projects";
import type { PlacedPart } from "../circuit/types";
import { CircuitBoard } from "lucide-react";
import { ReactNode } from "react";

type LibPart = {
  key: string;
  name: string;
  desc: string;
  type: string;
  tool: string;
  symbol: ReactNode;
  instances: number;
  projects: number;
};

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


const KIND_INFO: Record<string, { name: string; type: string; symbol: ReactNode }> = {
  resistor: { name: "Resistor", type: "Passive", symbol: <ResistorSymbol /> },
  capacitor: { name: "Capacitor", type: "Passive", symbol: <CapacitorSymbol /> },
  inductor: { name: "Inductor", type: "Passive", symbol: <InductorSymbol /> },
  diode: { name: "Diode", type: "Semiconductor", symbol: <DiodeSymbol /> },
  led: { name: "LED", type: "Semiconductor", symbol: <LedSymbol /> },
  transistor: { name: "Transistor", type: "Semiconductor", symbol: <TransistorSymbol /> },
  thyristor: { name: "Thyristor (SCR)", type: "Semiconductor", symbol: <ThyristorSymbol /> },
  triac: { name: "TRIAC", type: "Semiconductor", symbol: <TriacSymbol /> },
  diac: { name: "DIAC", type: "Semiconductor", symbol: <DiacSymbol /> },
  switch: { name: "Switch", type: "Electromechanical", symbol: <SwitchSymbol /> },
  button: { name: "Push button", type: "Electromechanical", symbol: <PushButtonSymbol /> },
  relay: { name: "Relay", type: "Electromechanical", symbol: <RelaySymbol /> },
  motor: { name: "DC Motor", type: "Electromechanical", symbol: <MotorSymbol /> },
  pot: { name: "Potentiometer", type: "Passive", symbol: <PotentiometerSymbol /> },
  buzzer: { name: "Buzzer", type: "Sources", symbol: <BuzzerSymbol /> },
  speaker: { name: "Speaker", type: "Sources", symbol: <SpeakerSymbol /> },
  mcu: { name: "MCU", type: "Integrated Circuits", symbol: <McuSymbol /> },
  lcd: { name: "LCD 16×2", type: "Integrated Circuits", symbol: <LcdSymbol /> },
  oled: { name: "OLED", type: "Integrated Circuits", symbol: <OledSymbol /> },
};

const FALLBACK_INFO = { name: "Unknown component", type: "Other", symbol: "?" };

function variantDescription(kind: string, props: PlacedPart["props"]) {
  const parts: string[] = [];
  if (props.resistance != null) parts.push(`${props.resistance}Ω`);
  if (props.capacitance != null) parts.push(`${props.capacitance} F`);
  if (props.ledColor) parts.push(String(props.ledColor));
  if (props.diodeType) parts.push(String(props.diodeType));
  if (props.transistorModel) parts.push(String(props.transistorModel).toUpperCase());
  if (props.thyristorModel) parts.push(String(props.thyristorModel).toUpperCase());
  if (props.triacModel) parts.push(String(props.triacModel).toUpperCase());
  if (props.diacModel) parts.push(String(props.diacModel).toUpperCase());
  if (props.mcuModel) parts.push(String(props.mcuModel));
  if (props.capacitorType) parts.push(String(props.capacitorType));
  if (props.label && !parts.includes(String(props.label))) parts.push(String(props.label));
  return parts.length ? parts.join(" · ") : `${kind} used in project`;
}

function getVariantKey(part: PlacedPart) {
  const p = part.props || {};
  const relevant = [
    p.resistance, p.capacitance, p.ledColor, p.diodeType, p.transistorModel,
    p.thyristorModel, p.triacModel, p.diacModel, p.mcuModel, p.capacitorType,
    p.label,
  ];
  return `${part.kind}|${relevant.map((v) => String(v ?? "")).join("|")}`;
}

const CATEGORIES = [
  "All",
  "Passive",
  "Semiconductor",
  "Integrated Circuits",
  "Electromechanical",
  "Sources",
  "Other",
] as const;

export function  MyComponentsPage() {
  const navigate = useNavigate();
  const projects = useProjects((s) => s.projects);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  // Build the library from the actual circuits saved in every project.
  // Nothing is added to the page unless a placed part exists in a project.
  const list = useMemo<LibPart[]>(() => {
    const variants = new Map<string, { part: PlacedPart; instances: number; projectIds: Set<string> }>();

    for (const project of projects) {
      for (const part of project.circuit?.parts ?? []) {
        const key = getVariantKey(part);
        const current = variants.get(key);
        if (current) {
          current.instances += 1;
          current.projectIds.add(project.id);
        } else {
          variants.set(key, {
            part,
            instances: 1,
            projectIds: new Set([project.id]),
          });
        }
      }
    }

    return Array.from(variants.values()).map(({ part, instances, projectIds }) => {
      const info = KIND_INFO[part.kind] ?? FALLBACK_INFO;
      return {
        key: getVariantKey(part),
        name: info.name,
        desc: variantDescription(part.kind, part.props || {}),
        type: info.type,
        tool: part.kind,
        symbol: info.symbol,
        instances,
        projects: projectIds.size,
      };
    });
  }, [projects]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return list.filter((c) => {
      if (category !== "All" && c.type !== category) return false;
      if (!needle) return true;
      return [c.name, c.desc, c.type, c.tool].some((v) =>
        v.toLowerCase().includes(needle),
      );
    });
  }, [list, q, category]);

  const counts = useMemo(() => {
    const map: Record<string, number> = { All: list.length };
    for (const c of list) map[c.type] = (map[c.type] || 0) + 1;
    return map;
  }, [list]);

  const totalInstances = useMemo(
    () => list.reduce((sum, c) => sum + c.instances, 0),
    [list],
  );

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">My Components</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Components currently used across your saved projects.
          </p>
        </div>
         <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => navigate("/editor/new")}
          className="flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          <Plus size={16} /> Open editor
        </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search components used in your projects..."
            className="w-full bg-[#111827] border border-[#1e293b] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex gap-6 flex-col lg:flex-row">
        <div className="w-full lg:w-48 flex-shrink-0 space-y-4">
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase mb-2">Category</div>
            {CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`w-full flex items-center gap-2 text-sm py-1.5 px-2 rounded-lg text-left ${
                  category === c ? "bg-blue-600/20 text-blue-300" : "text-slate-300 hover:bg-slate-800/60"
                }`}
              >
                <span className="flex-1">{c === "Semiconductor" ? "Semiconductors" : c}</span>
                <span className="text-xs text-slate-500">{counts[c] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-3">
            <span>{filtered.length} component variants · {totalInstances} total placements</span>
            <span>{projects.length} project{projects.length === 1 ? "" : "s"} scanned</span>
          </div>

          {filtered.length === 0 ? (
            <div className="bg-[#111827] border border-dashed border-[#1e293b] rounded-xl p-10 text-center">
              <div className="text-sm font-medium text-slate-300">No project components found</div>
              <div className="text-xs text-slate-500 mt-1">
                Add components to a project in the circuit editor and they will appear here automatically.
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((c) => (
                <div
                  key={c.key}
                  className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 hover:border-blue-500/40 transition group"
                >
                  <div className="h-20 bg-sky-900 rounded-lg mb-3 flex items-center justify-center text-xl font-mono text-slate-50 group-hover:text-slate-200 transition">
                    {c.symbol}
                  </div>
                  <div className="text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{c.desc}</div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs text-emerald-400 font-medium">
                      ● {c.instances} used · {c.projects} project{c.projects === 1 ? "" : "s"}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(`/editor/new?tool=${c.tool}`)}
                      className="text-xs text-blue-400 hover:underline whitespace-nowrap"
                    >
                      Use in editor
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
