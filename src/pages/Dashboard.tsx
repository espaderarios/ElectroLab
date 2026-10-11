import { useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Activity,
  CheckCircle2,
  Cpu,
  Plus,
  FolderOpen,
  Download,
  Play,
} from "lucide-react";
import {
  formatRelativeTime,
  useProjects,
  type ProjectStatus,
} from "../store/projects";

function StatCard({
  label,
  value,
  change,
  icon: Icon,
  color,
  onClick,
}: {
  label: string;
  value: string;
  change?: string;
  icon: any;
  color: string;
  onClick?: () => void;
}) {
  const colorMap: Record<string, string> = {
    blue: "text-blue-400 bg-blue-500/10",
    green: "text-emerald-400 bg-emerald-500/10",
    purple: "text-violet-400 bg-violet-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="dashboard-stat-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-[var(--app-muted)] font-medium uppercase tracking-wide">
            {label}
          </div>
          <div className="mt-1 text-2xl font-bold">{value}</div>
          {change && (
            <div className="mt-1 text-xs text-emerald-400">↑ {change} this month</div>
          )}
        </div>
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorMap[color]}`}
        >
          <Icon size={20} />
        </div>
      </div>
    </button>
  );
}

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Pass: "bg-emerald-500/15 text-emerald-400",
  Warning: "bg-amber-500/15 text-amber-400",
  Failed: "bg-red-500/15 text-red-400",
  Draft: "bg-slate-500/15 text-slate-300",
};

export function Dashboard() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const projects = useProjects((s) => s.projects);
  const activity = useProjects((s) => s.activity);
  const simRuns = useProjects((s) => s.simRuns);
  const createProject = useProjects((s) => s.createProject);
  const importCircuit = useProjects((s) => s.importCircuit);

  const recent = useMemo(
    () =>
      [...projects].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 4),
    [projects],
  );

  const feed = useMemo(
    () => [...activity].sort((a, b) => b.time - a.time).slice(0, 4),
    [activity],
  );

  const weekRuns = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400_000;
    const runs = simRuns.filter((r) => r.time >= weekAgo);
    const total = runs.length || simRuns.length;
    const source = runs.length ? runs : simRuns;
    const pass = source.filter((r) => r.status === "Pass").length;
    const warn = source.filter((r) => r.status === "Warning").length;
    const fail = source.filter((r) => r.status === "Failed").length;
    const n = Math.max(source.length, 1);
    return {
      total: total || source.length,
      pass,
      warn,
      fail,
      passPct: Math.round((pass / n) * 100),
      warnPct: Math.round((warn / n) * 100),
      failPct: Math.round((fail / n) * 100),
      successRate: Math.round((pass / n) * 100),
    };
  }, [simRuns]);

  const componentCount = 19;

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const project = importCircuit(text, file.name.replace(/\.json$/i, ""));
    if (!project) {
      window.alert("Could not import that file. Expect a JSON circuit export.");
      return;
    }
    navigate(`/editor/${project.id}`);
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin bg-[var(--app-bg)]">
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onImportFile(f);
          e.target.value = "";
        }}
      />

      <div className="dashboard-shell">
        <div className="dashboard-hero">
          <div className="relative z-10">
            <div className="dashboard-eyebrow">
              <span className="dashboard-eyebrow-dot" />
              Engineering workspace
            </div>
            <h1 className="dashboard-title">Welcome back, Engineer</h1>
            <p className="dashboard-subtitle">Design. Simulate. Innovate.</p>
          </div>
          <div className="dashboard-hero-orb dashboard-hero-orb-one" />
          <div className="dashboard-hero-orb dashboard-hero-orb-two" />
          <button
            type="button"
            onClick={() => {
              const p = createProject();
              navigate(`/editor/${p.id}`);
            }}
            className="dashboard-primary-action relative z-10"
          >
            <Plus size={17} /> New Project
          </button>
        </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-7">
        <StatCard
          label="Projects"
          value={String(projects.length)}
          change="12%"
          icon={FolderKanban}
          color="blue"
          onClick={() => navigate("/projects")}
        />
        <StatCard
          label="Simulations Run"
          value={String(simRuns.length)}
          change="18%"
          icon={Activity}
          color="cyan"
          onClick={() => navigate("/simulations")}
        />
        <StatCard
          label="Success Rate"
          value={`${weekRuns.successRate}%`}
          change="6%"
          icon={CheckCircle2}
          color="green"
          onClick={() => navigate("/reports")}
        />
        <StatCard
          label="Components"
          value={componentCount.toLocaleString()}
          icon={Cpu}
          color="purple"
          onClick={() => navigate("/library")}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-kicker">Workspace</p>
              <h2 className="dashboard-panel-title">Recent Projects</h2>
            </div>
            <button
              type="button"
              className="dashboard-link"
              onClick={() => navigate("/projects")}
            >
              View all
            </button>
          </div>
          <div className="space-y-1">
            {recent.map((p) => (
              <div
                key={p.id}
                onClick={() => navigate(`/editor/${p.id}`)}
                className="dashboard-list-row"
              >
                <div>
                  <div className="text-sm font-medium text-[var(--app-text)]">{p.name}</div>
                  <div className="text-xs text-[var(--app-muted)]">
                    Edited {formatRelativeTime(p.updatedAt)}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status]}`}
                >
                  {p.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-kicker">Performance</p>
              <h2 className="dashboard-panel-title">Simulation Summary</h2>
            </div>
            <span className="dashboard-period">This week</span>
          </div>
          <div className="flex items-center justify-center py-3">
            <div className="relative w-36 h-36">
              <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--app-border)"
                  strokeWidth="3"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="3"
                  strokeDasharray={`${weekRuns.passPct} 100`}
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="3"
                  strokeDasharray={`${weekRuns.warnPct} 100`}
                  strokeDashoffset={-weekRuns.passPct}
                  strokeLinecap="round"
                />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="3"
                  strokeDasharray={`${weekRuns.failPct} 100`}
                  strokeDashoffset={-(weekRuns.passPct + weekRuns.warnPct)}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold">
                  {weekRuns.total}
                </span>
                <span className="text-xs text-[var(--app-muted)]">Total Runs</span>
              </div>
            </div>
          </div>
          <div className="space-y-1.5 text-xs mt-1">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Passed{" "}
              {weekRuns.pass} ({weekRuns.passPct}%)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Warnings{" "}
              {weekRuns.warn} ({weekRuns.warnPct}%)
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500" /> Failed{" "}
              {weekRuns.fail} ({weekRuns.failPct}%)
            </div>
          </div>
          <button
            type="button"
            className="dashboard-link mt-3"
            onClick={() => navigate("/simulations")}
          >
            Open simulations
          </button>
        </div>

        <div className="dashboard-panel">
          <div className="dashboard-panel-heading">
            <div>
              <p className="dashboard-panel-kicker">Live updates</p>
              <h2 className="dashboard-panel-title">Activity Feed</h2>
            </div>
            <button
              type="button"
              className="dashboard-link"
              onClick={() => navigate("/simulations")}
            >
              View all activity
            </button>
          </div>
          <div className="space-y-3">
            {feed.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => navigate(`/editor/${a.projectId}`)}
                className="flex gap-3 w-full text-left hover:bg-slate-800/40 rounded-lg p-1 -m-1"
              >
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    a.ok
                      ? "bg-emerald-500/20 text-emerald-400"
                      : "bg-amber-500/20 text-amber-400"
                  }`}
                >
                  {a.ok ? <CheckCircle2 size={12} /> : <span className="text-xs">!</span>}
                </div>
                <div>
                  <div className="text-sm font-medium text-[var(--app-text)]">{a.title}</div>
                  <div className="text-xs text-[var(--app-muted)]">
                    {a.desc} · {formatRelativeTime(a.time)}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="dashboard-panel mt-4">
        <div className="dashboard-panel-heading">
          <div>
            <p className="dashboard-panel-kicker">Shortcuts</p>
            <h2 className="dashboard-panel-title">Quick Actions</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            {
              label: "New Project",
              icon: Plus,
              action: () => {
                const p = createProject();
                navigate(`/editor/${p.id}`);
              },
            },
            {
              label: "Open Project",
              icon: FolderOpen,
              action: () => navigate("/projects"),
            },
            {
              label: "Import Circuit",
              icon: Download,
              action: () => fileRef.current?.click(),
            },
            {
              label: "Run Simulation",
              icon: Play,
              action: () => {
                const latest = recent[0];
                if (latest) navigate(`/editor/${latest.id}`);
                else {
                  const p = createProject();
                  navigate(`/editor/${p.id}`);
                }
              },
            },
          ].map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.action}
              className="dashboard-action"
            >
              <a.icon size={16} className="text-[var(--app-muted)]" />
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
    </div>
  );
}
