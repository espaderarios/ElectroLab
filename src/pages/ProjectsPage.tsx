import { useMemo, useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Trash2, Play, FolderOpen, Pencil, Check, X } from "lucide-react";
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
      .filter((p) => (filter === "all" ? true : p.status === filter))
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.description || "").toLowerCase().includes(needle),
      )
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [projects, q, filter]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const startRename = (id: string, currentName: string) => {
    setEditingId(id);
    setDraftName(currentName);
  };

  const commitRename = () => {
    if (!editingId) return;
    const next = draftName.trim();
    if (next) {
      renameProject(editingId, next);
    }
    setEditingId(null);
    setDraftName("");
  };

  const cancelRename = () => {
    setEditingId(null);
    setDraftName("");
  };

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-white">Projects</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Open, create, rename, or remove breadboard lab projects.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const p = createProject();
            navigate(`/editor/${p.id}`);
          }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search projects..."
            className="w-full bg-[#111827] border border-[#1e293b] rounded-lg pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="bg-[#111827] border border-[#1e293b] rounded-lg px-3 py-2 text-sm text-slate-300"
        >
          <option value="all">All statuses</option>
          <option value="Pass">Pass</option>
          <option value="Warning">Warning</option>
          <option value="Failed">Failed</option>
          <option value="Draft">Draft</option>
        </select>
      </div>

      <div className="bg-[#111827] border border-[#1e293b] rounded-xl overflow-hidden">
        {list.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">
            No projects match. Create a new one to get started.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-[#1e293b]">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {list.map((p) => {
                const isEditing = editingId === p.id;

                return (
                  <tr
                    key={p.id}
                    className="border-b border-[#1e293b]/40 hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex items-center gap-2 max-w-md">
                          <input
                            ref={inputRef}
                            value={draftName}
                            onChange={(e) => setDraftName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                commitRename();
                              }
                              if (e.key === "Escape") {
                                e.preventDefault();
                                cancelRename();
                              }
                            }}
                            onBlur={commitRename}
                            className="flex-1 bg-[#0a0f1a] border border-blue-500/50 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            aria-label="Project name"
                          />
                          <button
                            type="button"
                            title="Save name"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={commitRename}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-emerald-400"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            type="button"
                            title="Cancel"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={cancelRename}
                            className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <div className="group flex items-start gap-2">
                          <div className="min-w-0">
                            <div className="font-medium text-slate-100">
                              {p.name}
                            </div>
                            {p.description && (
                              <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                                {p.description}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            title="Rename project"
                            onClick={() => startRename(p.id, p.name)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-opacity shrink-0 mt-0.5"
                          >
                            <Pencil size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {formatRelativeTime(p.updatedAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          title="Rename"
                          onClick={() => startRename(p.id, p.name)}
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-300"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          title="Open in editor"
                          onClick={() => navigate(`/editor/${p.id}`)}
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-300"
                        >
                          <FolderOpen size={16} />
                        </button>
                        <button
                          type="button"
                          title="Run / results"
                          onClick={() => navigate(`/results/${p.id}`)}
                          className="p-2 rounded-lg hover:bg-slate-700 text-slate-300"
                        >
                          <Play size={16} />
                        </button>
                        <button
                          type="button"
                          title="Delete project"
                          onClick={() => {
                            if (
                              window.confirm(`Delete project “${p.name}”?`)
                            ) {
                              deleteProject(p.id);
                            }
                          }}
                          className="p-2 rounded-lg hover:bg-red-500/20 text-red-400"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}