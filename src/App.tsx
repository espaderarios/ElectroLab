import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Sidebar } from "./components/Sidebar";
import { Dashboard } from "./pages/Dashboard";
import { ComponentLibrary } from "./pages/ComponentLibrary";
import { SimulationResults } from "./pages/SimulationResults";
import { CircuitEditorPage } from "./pages/CircuitEditorPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { SimulationsPage } from "./pages/SimulationsPage";
import { MyComponentsPage } from "./pages/MyComponentsPage";
import { LearnPage } from "./pages/LearnPage";
import { TemplatesPage } from "./pages/TemplatesPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { useProjects } from "./store/projects";
import { LibraryPage } from "./pages/LibraryPage";

export default function App() {
  const location = useLocation();
  const darkMode = useProjects((s) => s.darkMode);
  const isFullScreen =
    location.pathname.startsWith("/editor") ||
    location.pathname.startsWith("/results");

  // Keep the document theme synchronized with the persisted ElectroLab
  // preference. The simulator/editor itself stays visually isolated and dark.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    root.classList.toggle("light", !darkMode);
    root.dataset.theme = darkMode ? "dark" : "light";
    root.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  return (
    <div
      className={`electrolab-app h-screen flex overflow-hidden ${
        isFullScreen
          ? "bg-[#0a0f1a] text-slate-200"
          : "theme-surface bg-[var(--app-bg)] text-[var(--app-text)]"
      }`}
    >
      {!isFullScreen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/simulations" element={<SimulationsPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/components" element={<ComponentLibrary />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/templates" element={<TemplatesPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/editor" element={<CircuitEditorPage />} />
          <Route path="/editor/:projectId" element={<CircuitEditorPage />} />
          <Route path="/results" element={<SimulationResults />} />
          <Route path="/results/:projectId" element={<SimulationResults />} />
          <Route path="/my-components" element={<MyComponentsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}
