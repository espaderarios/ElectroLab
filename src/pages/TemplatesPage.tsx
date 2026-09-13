import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Plus } from "lucide-react";
import { useProjects } from "../store/projects";

const templates = [
  {
    id: "led-blink",
    name: "LED + Resistor",
    desc: "Classic series LED lab with switch control.",
  },
  {
    id: "rc-lpf",
    name: "RC Filter",
    desc: "Passive low-pass building block.",
  },
  {
    id: "dc-motor",
    name: "Motor Driver (SCR)",
    desc: "Gate-triggered SCR holding a DC motor on.",
  },
  {
    id: "blank",
    name: "Blank Breadboard",
    desc: "Empty board — place any components from the palette.",
  },
];

export function TemplatesPage() {
  const navigate = useNavigate();
  const createProject = useProjects((s) => s.createProject);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Templates</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Start from a known circuit pattern or a blank board.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 flex flex-col"
          >
            <div className="w-10 h-10 rounded-lg bg-violet-500/15 text-violet-400 flex items-center justify-center mb-3">
              <LayoutTemplate size={18} />
            </div>
            <div className="text-sm font-semibold">{t.name}</div>
            <p className="text-xs text-slate-500 mt-1 flex-1">{t.desc}</p>
            <button
              type="button"
              onClick={() => {
                if (t.id === "blank") {
                  const p = createProject("Blank Breadboard");
                  navigate(`/editor/${p.id}`);
                } else {
                  navigate(`/editor/${t.id}`);
                }
              }}
              className="mt-4 inline-flex items-center justify-center gap-2 border border-[#1e293b] hover:bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg transition"
            >
              <Plus size={14} /> Use template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
