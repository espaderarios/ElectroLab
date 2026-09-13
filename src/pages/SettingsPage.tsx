import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  User,
  Palette,
  FlaskConical,
  Keyboard,
  Database,
  Moon,
  Sun,
  ChevronRight,
  RotateCcw,
  Info,
} from "lucide-react";
import { useProjects } from "../store/projects";
import { useLab } from "../store/lab";
import { BOARD_PRESETS, type BoardPresetId } from "../circuit/breadboard";

const PROFILE_KEY = "electrolab-profile";
const PREFS_KEY = "electrolab-prefs";

type Role = "Student" | "Instructor" | "Hobbyist" | "Engineer";

interface Profile {
  name: string;
  role: Role;
}

interface Prefs {
  confirmDelete: boolean;
  autoSaveLab: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  reducedMotion: boolean;
}

const DEFAULT_PROFILE: Profile = {
  name: "Electro Engineer",
  role: "Student",
};

const DEFAULT_PREFS: Prefs = {
  confirmDelete: true,
  autoSaveLab: true,
  showGrid: true,
  snapToGrid: true,
  reducedMotion: false,
};

function loadProfile(): Profile {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw) return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PROFILE };
}

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_PREFS };
}

function Toggle({
  on,
  onChange,
  label,
  description,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex items-start justify-between gap-4 w-full text-left py-2.5 group"
    >
      <div className="min-w-0">
        <div className="text-sm text-slate-200 group-hover:text-white transition-colors">
          {label}
        </div>
        {description && (
          <div className="text-xs text-slate-500 mt-0.5 leading-relaxed">
            {description}
          </div>
        )}
      </div>
      <span
        className={`relative shrink-0 w-10 h-[22px] rounded-full transition-colors ${
          on ? "bg-blue-600" : "bg-slate-700"
        }`}
        aria-hidden
      >
        <span
          className={`absolute top-[3px] left-[3px] w-4 h-4 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-[18px]" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#1e293b] bg-[#0f172a] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#1e293b]/80">
        <div className="w-7 h-7 rounded-lg bg-blue-600/15 flex items-center justify-center">
          <Icon size={14} className="text-blue-400" />
        </div>
        <h2 className="text-sm font-semibold text-slate-100">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-400">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <p className="text-[11px] text-slate-600 mt-1.5">{hint}</p>}
    </label>
  );
}

const inputClass =
  "w-full h-10 bg-[#0a0f1a] border border-[#1e293b] rounded-lg px-3 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition";

export function SettingsPage() {
  const darkMode = useProjects((s) => s.darkMode);
  const toggleDarkMode = useProjects((s) => s.toggleDarkMode);
  const setDarkMode = useProjects((s) => s.setDarkMode);

  const psuVoltage = useLab((s) => s.psuVoltage);
  const setVoltage = useLab((s) => s.setVoltage);
  const boardId = useLab((s) => s.boardId);
  const setBoard = useLab((s) => s.setBoard);

  const [profile, setProfile] = useState<Profile>(loadProfile);
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const [savedFlash, setSavedFlash] = useState(false);

  // Keep document theme in sync (same as App / original settings)
  useEffect(() => {
    setDarkMode(darkMode);
  }, [darkMode, setDarkMode]);

  useEffect(() => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  }, [profile]);

  useEffect(() => {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const updatePref = <K extends keyof Prefs>(key: K, value: Prefs[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  };

  const flashSaved = () => {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1600);
  };

  const resetLabDefaults = () => {
    setVoltage(5);
    // setBoard already confirms + clears the board — only call if different
    if (boardId !== "standard-830") {
      setBoard("standard-830");
    }
    flashSaved();
  };

  const resetPrefs = () => {
    setPrefs({ ...DEFAULT_PREFS });
    flashSaved();
  };

  return (
    <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin bg-[#0a0f1a]">
      <div className="max-w-2xl mx-auto p-5 sm:p-6 lg:p-8">
        <header className="mb-7 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              Settings
            </h1>
            <p className="text-sm text-slate-500 mt-1.5">
              Profile, appearance, lab defaults, and preferences.
            </p>
          </div>
          {savedFlash && (
            <span className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full shrink-0">
              Saved
            </span>
          )}
        </header>

        <div className="space-y-5">
          {/* Profile */}
          <Section icon={User} title="Profile">
            <Field label="Display name">
              <input
                value={profile.name}
                onChange={(e) =>
                  setProfile((p) => ({ ...p, name: e.target.value }))
                }
                placeholder="Your name"
                className={inputClass}
              />
            </Field>
            <Field
              label="Role"
              hint="Shown in the sidebar and used for default tooling hints."
            >
              <select
                value={profile.role}
                onChange={(e) =>
                  setProfile((p) => ({
                    ...p,
                    role: e.target.value as Role,
                  }))
                }
                className={inputClass}
              >
                <option value="Student">Student</option>
                <option value="Instructor">Instructor</option>
                <option value="Hobbyist">Hobbyist</option>
                <option value="Engineer">Engineer</option>
              </select>
            </Field>
          </Section>

          {/* Appearance */}
          <Section icon={Palette} title="Appearance">
            <button
              type="button"
              onClick={() => toggleDarkMode()}
              className="flex items-center justify-between w-full rounded-lg border border-[#1e293b] bg-[#0a0f1a] px-3.5 py-3 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
                  {darkMode ? (
                    <Moon size={16} className="text-slate-300" />
                  ) : (
                    <Sun size={16} className="text-amber-400" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm text-slate-200">Dark mode</div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {darkMode
                      ? "Currently using dark theme"
                      : "Currently using light theme"}
                  </div>
                </div>
              </div>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  darkMode
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-slate-600/40 text-slate-300"
                }`}
              >
                {darkMode ? "On" : "Off"}
              </span>
            </button>

            <Toggle
              on={prefs.reducedMotion}
              onChange={(v) => updatePref("reducedMotion", v)}
              label="Reduce motion"
              description="Minimize animations and transitions."
            />
          </Section>

          {/* Lab defaults */}
          <Section icon={FlaskConical} title="Lab defaults">
            <Field
              label="Supply voltage (V)"
              hint="Live lab PSU voltage. Changing this updates the active board simulation."
            >
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0}
                  max={24}
                  step={0.1}
                  value={psuVoltage}
                  onChange={(e) => setVoltage(Number(e.target.value) || 0)}
                  className={`${inputClass} flex-1`}
                />
                <div className="flex gap-1.5">
                  {[3.3, 5, 12].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setVoltage(v)}
                      className={`h-10 px-2.5 rounded-lg text-xs font-medium border transition-colors ${
                        psuVoltage === v
                          ? "bg-blue-600/20 border-blue-500/40 text-blue-300"
                          : "border-[#1e293b] text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      }`}
                    >
                      {v}V
                    </button>
                  ))}
                </div>
              </div>
            </Field>

            <Field
              label="Breadboard"
              hint="Changing board size clears components and wires (you will be asked to confirm)."
            >
              <select
                value={boardId}
                onChange={(e) => setBoard(e.target.value as BoardPresetId)}
                className={inputClass}
              >
                {BOARD_PRESETS.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="pt-1 border-t border-[#1e293b]/80 space-y-1">
              <Toggle
                on={prefs.showGrid}
                onChange={(v) => updatePref("showGrid", v)}
                label="Show grid"
                description="Prefer showing the workbench grid (wire into canvas when ready)."
              />
              <Toggle
                on={prefs.snapToGrid}
                onChange={(v) => updatePref("snapToGrid", v)}
                label="Snap to grid"
                description="Align components to the grid when placing."
              />
              <Toggle
                on={prefs.autoSaveLab}
                onChange={(v) => updatePref("autoSaveLab", v)}
                label="Auto-save lab"
                description="Periodically save the active circuit into the project."
              />
            </div>

            <button
              type="button"
              onClick={resetLabDefaults}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-300 transition-colors"
            >
              <RotateCcw size={12} />
              Reset to 5 V · standard-830
            </button>
          </Section>

          {/* Workspace */}
          <Section icon={Database} title="Workspace">
            <Toggle
              on={prefs.confirmDelete}
              onChange={(v) => updatePref("confirmDelete", v)}
              label="Confirm before delete"
              description="Ask before removing projects, components, or wires."
            />
            <button
              type="button"
              onClick={resetPrefs}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-300 transition-colors"
            >
              <RotateCcw size={12} />
              Reset preferences
            </button>
          </Section>

          {/* Shortcuts */}
          <Section icon={Keyboard} title="Keyboard shortcuts">
            <ul className="space-y-2.5 text-sm">
              {[
                ["Esc", "Close PDF reader / modal"],
                ["O", "Open current PDF in Drive (reader)"],
                ["/", "Focus search (where available)"],
              ].map(([key, desc]) => (
                <li
                  key={key}
                  className="flex items-center justify-between gap-3 text-slate-400"
                >
                  <span className="text-slate-500">{desc}</span>
                  <kbd className="min-w-[1.75rem] text-center text-[11px] font-medium text-slate-300 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">
                    {key}
                  </kbd>
                </li>
              ))}
            </ul>
          </Section>

          {/* About */}
          <Section icon={Info} title="About">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">App</span>
              <span className="text-slate-200">ElectroLab</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">Profile</span>
              <span className="text-slate-200 truncate max-w-[60%]">
                {profile.name} · {profile.role}
              </span>
            </div>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              onClick={(e) => e.preventDefault()}
            >
              Documentation
              <ChevronRight size={12} />
            </a>
          </Section>
        </div>
      </div>
    </div>
  );
}