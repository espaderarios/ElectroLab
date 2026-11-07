import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { EntranceAnimation } from "./components/EntranceAnimation";
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
import { BuiltInFlashcardsPage } from "./pages/BuiltIn-Flashcards";
import { GamesPage } from "./pages/GamesPage";
import { ConceptsPage } from "./pages/ConceptsPage";
import { SchematicPage } from "./pages/SchematicPage";
import { AboutComponentsPage } from "./pages/AboutComponentsPage";
import MatlabTutorialPage from "./pages/MatlabTutorialPage";
import PythonTutorialPage from "./pages/PythonTutorialPage";


export default function App() {
  const [showIntro, setShowIntro] = useState(() => {
    try {
      // Show on first entry of a browser tab, but not on every navigation.
      return sessionStorage.getItem("electrolab-intro-v2") !== "shown";
    } catch { return true; }
  });
  const location = useLocation();
  const darkMode = useProjects((s) => s.darkMode);
  const isFullScreen =
    location.pathname.startsWith("/editor") ||
    location.pathname.startsWith("/results") ||
    location.pathname.startsWith("/map");

  // Keep the document theme synchronized with the persisted ElectroLab
  // preference. The simulator/editor itself stays visually isolated and dark.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("dark", darkMode);
    root.classList.toggle("light", !darkMode);
    root.dataset.theme = darkMode ? "dark" : "light";
    root.style.colorScheme = darkMode ? "dark" : "light";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", darkMode ? "#050f22" : "#edf5fc");
  }, [darkMode]);

  useEffect(() => {
    const replay = () => setShowIntro(true);
    window.addEventListener("electrolab:replay-intro", replay);
    return () => window.removeEventListener("electrolab:replay-intro", replay);
  }, []);

  const finishIntro = useCallback(() => {
    try { sessionStorage.setItem("electrolab-intro-v2", "shown"); } catch { /* private-mode storage */ }
    setShowIntro(false);
  }, []);

  return (
    <>
    <div
      className={`electrolab-app h-screen flex overflow-hidden ${
        isFullScreen
          ? "electrolab-workspace bg-[#030b1b] text-slate-200"
          : "themed-workspace theme-surface bg-[var(--app-bg)] text-[var(--app-text)]"
      }`}
    >
      {!isFullScreen && <Sidebar />}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/simulations" element={<SimulationsPage />} />
          <Route path="/schematic" element={<SchematicPage />} />
          <Route path="/library" element={<LibraryPage />} />
          <Route path="/components" element={<ComponentLibrary />} />
          <Route path="/about-components" element={<AboutComponentsPage />} />
          <Route path="/learn" element={<LearnPage />} />
          <Route path="/concepts" element={<ConceptsPage />} />
          <Route path="/matlab" element={<MatlabTutorialPage />} />
          <Route path="/python" element={<PythonTutorialPage />} />
          <Route path="/builtin-flashcards" element={<BuiltInFlashcardsPage />} />
          <Route path="/games" element={<GamesPage />} />
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
    {showIntro && <EntranceAnimation onComplete={finishIntro} />}
    </>
  );
}
