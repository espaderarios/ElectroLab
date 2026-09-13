import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, Search } from "lucide-react";
import {
  formatRelativeTime,
  useProjects,
  type ProjectStatus,
} from "../store/projects";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Pass: "bg-emerald-500/15 text-emerald-400",
  Warning: "bg-amber-500/15 text-amber-400",
  Failed: "bg-red-500/15 text-red-400",
  Draft: "bg-slate-500/15 text-slate-300",
};

export function SimulationsPage() {
  const navigate = useNavigate();
  const simRuns = useProjects((s) => s.simRuns);
  const [q, setQ] = useState("");

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...simRuns]
      .filter(
        (r) =>
          !needle ||
          r.projectName.toLowerCase().includes(needle) ||
          (r.notes || "").toLowerCase().includes(needle),
      )
      .sort((a, b) => b.time - a.time);
  }, [simRuns, q]);

  const passed = simRuns.filter((r) => r.status === "Pass").length;
  const warnings = simRuns.filter((r) => r.status === "Warning").length;
  const failed = simRuns.filter((r) => r.status === "Failed").length;

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Simulations</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          History of lab runs across your projects.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase">Passed</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{passed}</div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase">Warnings</div>
          <div className="text-2xl font-bold text-amber-400 mt-1">{warnings}</div>
        </div>
        <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
          <div className="text-xs text-slate-500 uppercase">Failed</div>
          <div className="text-2xl font-bold text-red-400 mt-1">{failed}</div>
        </div>
      </div>

      <div className="relative mb-4 max-w-md">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search simulation history..."
          className="w-full bg-[#111827] border border-[#1e293b] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl divide-y divide-[#1e293b]">
        {list.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No simulation runs yet. Open a project and use Run Simulation.
          </div>
        ) : (
          list.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => navigate(`/results/${r.projectId}`)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-800/50 transition"
            >
              <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400">
                <Play size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-100 truncate">
                  {r.projectName}
                </div>
                <div className="text-xs text-slate-500">
                  {r.notes || `Status: ${r.status}`} ·{" "}
                  {formatRelativeTime(r.time)}
                </div>
              </div>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[r.status]}`}
              >
                {r.status}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
