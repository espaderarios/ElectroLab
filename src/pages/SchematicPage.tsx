import { useEffect, useState } from "react";
import { ArrowLeft, FilePlus2, FolderOpen, Trash2 } from "lucide-react";
import { Schematic2D, type SchematicFile } from "../circuit-lab/schematic-2d";

export function SchematicPage() {
  const [projects, setProjects] = useState<Array<SchematicFile & { savedAt: number }>>([]);
  const [selected, setSelected] = useState<(SchematicFile & { savedAt: number }) | null>(null);

  const loadProjects = () => {
    try {
      const raw = localStorage.getItem("electrolab:schematic:recent");
      const parsed = raw ? JSON.parse(raw) : [];
      setProjects(Array.isArray(parsed) ? parsed : []);
    } catch {
      setProjects([]);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  if (selected) {
    return (
      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#0b1220]">
        <div className="flex h-10 shrink-0 items-center border-b border-slate-700 bg-[#080e19] px-3">
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              loadProjects();
            }}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            <ArrowLeft size={14} /> Back to schematic projects
          </button>
          <span className="ml-3 truncate text-xs text-slate-500">{selected.name}</span>
        </div>
        <div className="relative min-h-0 flex-1">
          <Schematic2D initialFile={selected} />
        </div>
      </main>
    );
  }

  const createNew = () => {
    setSelected({
      format: "electrolab-schematic",
      version: 1,
      name: "Untitled Schematic",
      psuVoltage: 5,
      symbols: [],
      wires: [],
      junctions: [],
      savedAt: Date.now(),
    });
  };

  const removeProject = (name: string) => {
    const next = projects.filter((project) => project.name !== name);
    localStorage.setItem("electrolab:schematic:recent", JSON.stringify(next));
    setProjects(next);
  };

  return (
    <main className="flex-1 overflow-y-auto bg-[#0b1220] p-6 text-slate-200">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-100">2D Schematic Projects</h1>
            <p className="mt-1 text-sm text-slate-500">Choose a saved schematic to open in the editor.</p>
          </div>
          <button
            type="button"
            onClick={createNew}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-500"
          >
            <FilePlus2 size={16} /> New schematic
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-800 bg-[#111827]">
          {projects.length === 0 ? (
            <div className="p-12 text-center">
              <FolderOpen className="mx-auto mb-3 text-slate-600" size={34} />
              <h2 className="text-sm font-medium text-slate-300">No saved schematics yet</h2>
              <p className="mt-1 text-xs text-slate-500">Create a new schematic and save it to make it available here.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {projects.map((project) => (
                <div key={`${project.name}-${project.savedAt}`} className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-slate-800/40">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-100">{project.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {project.symbols.length} components · {project.wires.length} wires · Last edited {new Date(project.savedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelected(project)}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-blue-500"
                    >
                      <FolderOpen size={14} /> Open
                    </button>
                    <button
                      type="button"
                      title="Remove saved schematic"
                      onClick={() => removeProject(project.name)}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/15 hover:text-red-300"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
