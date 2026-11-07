import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Search, Trash2, Play, Pencil, Check, X,
  ArrowUpRight, CircuitBoard, Cpu, Zap, Clock3, FolderOpen,
} from "lucide-react";
import { formatRelativeTime, useProjects, type ProjectRecord, type ProjectStatus } from "../store/projects";

const STATUS_STYLE: Record<ProjectStatus, string> = {
  Pass: "bg-emerald-400/10 border-emerald-400/20 text-emerald-300",
  Warning: "bg-amber-400/10 border-amber-400/20 text-amber-300",
  Failed: "bg-red-400/10 border-red-400/20 text-red-300",
  Draft: "bg-sky-400/10 border-sky-400/20 text-sky-200",
};

const QUICK_START_PRESETS = [
  { id: "half-adder", name: "Half Adder", subtitle: "2 inputs · XOR + AND", icon: CircuitBoard },
  { id: "full-adder", name: "Full Adder", subtitle: "3 inputs · XOR + AND + OR", icon: Cpu },
  { id: "arduino-lcd-demo", name: "Arduino + LCD", subtitle: "16×2 HD44780 · 4-bit wiring + contrast", icon: CircuitBoard },
  { id: "arduino-oled-demo", name: "Arduino + OLED", subtitle: "128×64 SSD1306 · SDA/SCL + 3.3 V", icon: Cpu },
];

/** The main project surface remains one click target; secondary controls never open it. */
export function ProjectsPage() {
  const navigate = useNavigate();
  const projects = useProjects((s) => s.projects);
  const createProject = useProjects((s) => s.createProject);
  const deleteProject = useProjects((s) => s.deleteProject);
  const renameProject = useProjects((s) => s.renameProject);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | ProjectStatus>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return [...projects]
      .filter((p) => filter === "all" || p.status === filter)
      .filter((p) => !needle || [p.name, p.description ?? ""].some((value) => value.toLowerCase().includes(needle)))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects, q, filter]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (project: ProjectRecord) => {
    setEditingId(project.id);
    setDraftName(project.name);
  };
  const commitRename = () => {
    if (!editingId) return;
    const name = draftName.trim();
    if (name) renameProject(editingId, name);
    setEditingId(null);
    setDraftName("");
  };
  const cancelRename = () => {
    setEditingId(null);
    setDraftName("");
  };
  const openProject = (id: string) => navigate(`/editor/${id}`);

  return (
    <div className="projects-workspace flex-1 overflow-y-auto scrollbar-thin px-5 py-7 md:px-8 lg:px-10">
      <div className="mx-auto max-w-[1480px] space-y-7">
        <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.18em] uppercase text-cyan-300/80 mb-2">Your electronics workspace</p>
            <h1 className="text-2xl md:text-[28px] font-bold tracking-tight text-[var(--app-text)]">Projects</h1>
            <p className="mt-1.5 text-sm text-[var(--app-muted)]">Select a circuit to open its 3D breadboard and start experimenting.</p>
          </div>
          <button
            type="button"
            onClick={() => openProject(createProject().id)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#087deb] hover:bg-[#189bff] text-white font-semibold text-sm transition-colors shadow-[0_8px_22px_rgba(0,123,235,.22)] shrink-0"
          >
            <Plus size={18} /> New Project
          </button>
        </header>

        <section aria-label="Premade logic circuits">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-[var(--app-text)] flex items-center gap-2"><Zap className="text-cyan-400" size={17} /> Quick-start circuits</h2>
            <span className="text-xs text-[var(--app-muted)]">Ready-wired 3D breadboards</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {QUICK_START_PRESETS.map((preset) => {
              const project = projects.find((p) => p.id === preset.id);
              if (!project) return null;
              const Icon = preset.icon;
              return (
                <button
                  type="button"
                  key={preset.id}
                  onClick={() => openProject(project.id)}
                  className="group text-left flex items-center gap-4 rounded-2xl border border-[#1e5782]/65 bg-gradient-to-r from-[#082342] via-[#09294c] to-[#071a32] px-5 py-5 hover:border-cyan-400/65 hover:shadow-[0_12px_36px_rgba(0,180,240,.11)] transition-all focus-visible:outline-2 focus-visible:outline-cyan-400"
                >
                  <span className="w-12 h-12 grid place-items-center rounded-xl border border-cyan-400/25 bg-cyan-400/10 text-cyan-300 shrink-0"><Icon size={23} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[10px] uppercase font-bold tracking-[.15em] text-cyan-300/80">Premade circuit</span>
                    <span className="block text-base font-bold text-white mt-0.5">{preset.name}</span>
                    <span className="block text-xs text-[#9ab9d6] mt-1">{preset.subtitle}</span>
                  </span>
                  <ArrowUpRight size={19} className="text-cyan-300/70 group-hover:text-cyan-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
                </button>
              );
            })}
          </div>
        </section>

        <section aria-label="All projects">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-semibold text-[var(--app-text)]">All projects <span className="text-sm font-medium text-[var(--app-muted)]">({list.length})</span></h2>
              <p className="text-xs text-[var(--app-muted)] mt-1">Click anywhere on a project card to open it.</p>
            </div>
            <div className="flex gap-2 flex-col sm:flex-row sm:items-center">
              <div className="relative sm:w-64 lg:w-72">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                <input
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search circuits..."
                  aria-label="Search projects"
                  className="w-full rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] pl-10 pr-4 py-2.5 text-sm text-[var(--app-text)] focus:outline-none focus:border-cyan-400/50"
                />
              </div>
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
                aria-label="Filter projects by status"
                className="rounded-xl border border-[var(--app-border)] bg-[var(--app-surface)] px-3 py-2.5 text-sm text-[var(--app-text)] min-w-36"
              >
                <option value="all">All statuses</option>
                <option value="Pass">Pass</option>
                <option value="Warning">Warning</option>
                <option value="Failed">Failed</option>
                <option value="Draft">Draft</option>
              </select>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="text-center rounded-2xl border border-dashed border-[var(--app-border)] bg-[var(--app-surface)]/60 px-6 py-12">
              <FolderOpen size={28} className="text-cyan-300/60 mx-auto mb-3" />
              <h3 className="font-semibold">No matching projects</h3>
              <p className="text-sm text-[var(--app-muted)] mt-1">Try a different search or status filter.</p>
              <button type="button" onClick={() => { setQ(""); setFilter("all"); }} className="text-sm mt-4 text-cyan-300 hover:text-cyan-100">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {list.map((project) => {
                const editing = editingId === project.id;
                const preset = ["half-adder", "full-adder", "arduino-lcd-demo", "arduino-oled-demo"].includes(project.id);
                return (
                  <article key={project.id} className="group relative min-h-[206px] flex flex-col rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] hover:border-cyan-400/55 hover:shadow-[0_14px_34px_rgba(0,125,220,.14)] transition-all overflow-hidden">
                    {!editing && (
                      <button
                        type="button"
                        onClick={() => openProject(project.id)}
                        className="absolute inset-0 z-0 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-cyan-300 rounded-2xl"
                        aria-label={`Open ${project.name} in the 3D circuit editor`}
                        title={`Open ${project.name}`}
                      />
                    )}
                    <div className="relative pointer-events-none z-[1] px-5 pt-5 flex-1">
                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#073e62] text-cyan-300 flex items-center justify-center border border-cyan-400/15">
                          {preset ? <Cpu size={20} /> : <CircuitBoard size={20} />}
                        </div>
                        <span className={`text-[11px] font-semibold border px-2.5 py-1 rounded-full ${STATUS_STYLE[project.status]}`}>{project.status}</span>
                      </div>
                      {editing ? (
                        <div className="pointer-events-auto flex gap-2 items-center">
                          <input
                            ref={inputRef}
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); commitRename(); }
                              if (e.key === "Escape") { e.preventDefault(); cancelRename(); }
                            }}
                            onBlur={commitRename}
                            className="w-full min-w-0 rounded-lg border border-cyan-400/60 bg-[var(--app-bg)] px-2.5 py-2 text-sm text-[var(--app-text)]"
                            aria-label="Rename project"
                          />
                          <button type="button" title="Save name" onMouseDown={(e) => e.preventDefault()} onClick={commitRename} className="text-emerald-300 p-1"><Check size={18}/></button>
                          <button type="button" title="Cancel rename" onMouseDown={(e) => e.preventDefault()} onClick={cancelRename} className="text-[var(--app-muted)] p-1"><X size={18}/></button>
                        </div>
                      ) : (
                        <h3 className="text-base font-semibold leading-snug text-[var(--app-text)] group-hover:text-cyan-300 transition-colors line-clamp-2">{project.name}</h3>
                      )}
                      <p className="mt-1.5 text-xs text-[var(--app-muted)] leading-relaxed line-clamp-2">{project.description || "Electronic breadboard project"}</p>
                    </div>
                    <footer className="relative z-[1] pointer-events-none flex gap-3 justify-between items-center mt-5 px-5 py-3 border-t border-[var(--app-border)]/70 bg-[var(--app-bg)]/20">
                      <span className="flex gap-1.5 items-center text-[11px] text-[var(--app-muted)]"><Clock3 size={12} /> {formatRelativeTime(project.updatedAt)}</span>
                      <div className="pointer-events-auto flex items-center gap-1">
                        <button type="button" title={`Rename ${project.name}`} aria-label={`Rename ${project.name}`} onClick={() => startRename(project)} className="rounded-lg p-2 text-[var(--app-muted)] hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors"><Pencil size={16} /></button>
                        <button type="button" title={`View simulation results for ${project.name}`} aria-label={`View results for ${project.name}`} onClick={() => navigate(`/results/${project.id}`)} className="rounded-lg p-2 text-[var(--app-muted)] hover:text-cyan-300 hover:bg-cyan-400/10 transition-colors"><Play size={16} /></button>
                        <button type="button" title={`Delete ${project.name}`} aria-label={`Delete ${project.name}`} onClick={() => { if (window.confirm(`Delete project “${project.name}”?`)) deleteProject(project.id); }} className="rounded-lg p-2 text-[var(--app-muted)] hover:text-red-300 hover:bg-red-400/10 transition-colors"><Trash2 size={16} /></button>
                      </div>
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
