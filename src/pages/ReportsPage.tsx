import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Download, FileBarChart } from "lucide-react";
import { formatRelativeTime, useProjects } from "../store/projects";

export function ReportsPage() {
  const navigate = useNavigate();
  const projects = useProjects((s) => s.projects);
  const simRuns = useProjects((s) => s.simRuns);
  const exportProject = useProjects((s) => s.exportProject);

  const summary = useMemo(() => {
    const total = simRuns.length;
    const pass = simRuns.filter((r) => r.status === "Pass").length;
    const warn = simRuns.filter((r) => r.status === "Warning").length;
    const fail = simRuns.filter((r) => r.status === "Failed").length;
    const rate = total ? Math.round((pass / total) * 100) : 0;
    return { total, pass, warn, fail, rate };
  }, [simRuns]);

  const downloadReport = () => {
    const body = {
      generatedAt: new Date().toISOString(),
      projects: projects.length,
      simulations: summary,
      recentRuns: simRuns.slice(0, 20).map((r) => ({
        project: r.projectName,
        status: r.status,
        when: new Date(r.time).toISOString(),
        notes: r.notes,
      })),
    };
    const blob = new Blob([JSON.stringify(body, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `electrolab-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold">Reports</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Summary of projects and simulation outcomes.
          </p>
        </div>
        <button
          type="button"
          onClick={downloadReport}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Download size={16} /> Download report
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "Projects", value: projects.length },
          { label: "Total runs", value: summary.total },
          { label: "Success rate", value: `${summary.rate}%` },
          {
            label: "Warnings / fails",
            value: `${summary.warn} / ${summary.fail}`,
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-[#111827] border border-[#1e293b] rounded-xl p-4"
          >
            <div className="text-xs text-slate-500 uppercase">{s.label}</div>
            <div className="text-2xl font-bold mt-1">{s.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <FileBarChart size={16} className="text-slate-400" />
          <h2 className="text-sm font-semibold">Projects</h2>
        </div>
        <div className="space-y-2">
          {projects.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-800/50"
            >
              <button
                type="button"
                className="flex-1 text-left"
                onClick={() => navigate(`/editor/${p.id}`)}
              >
                <div className="text-sm text-slate-200">{p.name}</div>
                <div className="text-xs text-slate-500">
                  {p.status} · updated {formatRelativeTime(p.updatedAt)}
                </div>
              </button>
              <button
                type="button"
                className="text-xs text-blue-400 hover:underline"
                onClick={() => {
                  const data = exportProject(p.id);
                  if (!data) return;
                  const blob = new Blob([data], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${p.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                Export
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
