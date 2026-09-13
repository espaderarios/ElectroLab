import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  Zap,
  Library,
  Cpu,
  GraduationCap,
  LayoutTemplate,
  FileBarChart,
  Settings,
  Moon,
  Sun,
} from "lucide-react";
import { useProjects } from "../store/projects";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/simulations", label: "Simulations", icon: Zap },
  { to: "/library", label: "Library", icon: Library },
  { to: "/components", label: "Components", icon: Cpu },
  { to: "/my-components", label: "My Components", icon: Cpu },
  { to: "/learn", label: "Learn", icon: GraduationCap },
  { to: "/templates", label: "Templates", icon: LayoutTemplate },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: Settings },
];

function ToggleRow({ label, checked, onChange }: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="mt-2 w-full flex items-center justify-between gap-3 rounded-lg border border-[var(--app-border)] bg-[var(--app-control)] px-3 py-2 text-xs font-medium text-[var(--app-text)] hover:bg-[var(--app-hover)] transition-colors"
    >
      <span>{label}</span>

      <span
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-blue-900" : "bg-[var(--app-border)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </span>
    </button>
  );
}

export function Sidebar() {
  const darkMode = useProjects((s) => s.darkMode);
  const toggleDarkMode = useProjects((s) => s.toggleDarkMode);
  const setDarkMode = useProjects((s) => s.setDarkMode);

  return (
    <aside className="w-56 flex-shrink-0 bg-[var(--app-sidebar)] border-r border-[var(--app-border)] flex flex-col h-full transition-colors duration-200">
      <div className="px-4 py-5 flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-lg shadow-blue-600/30">
        <img
          src="/favicon.png"
          alt="ElectroLab"
          className="w-full h-full object-cover"
        />
      </div>
        <span className="font-semibold text-lg tracking-tight text-[var(--app-heading)]">
          ElectroLab
        </span>
      </div>

      <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto scrollbar-thin">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              `w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-500 dark:text-blue-400"
                  : "text-[var(--app-muted)] hover:bg-[var(--app-hover)] hover:text-[var(--app-text)]"
              }`
            }
          >
            <item.icon className="w-4.5 h-4.5" size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-[var(--app-border)]">
        <NavLink
          to="/settings"
          className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-[var(--app-hover)] cursor-pointer transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center text-xs font-bold text-blue-500 dark:text-blue-300">
            EE
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate text-[var(--app-text)]">
              Electro Engineer
            </div>
            <div className="text-xs text-[var(--app-muted)]">Student</div>
          </div>
        </NavLink>

          <ToggleRow label="Dark mode" checked={darkMode} onChange={setDarkMode} />

      </div>
    </aside>
  );
}
