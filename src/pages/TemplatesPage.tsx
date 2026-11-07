import { useNavigate } from "react-router-dom";
import { LayoutTemplate, Plus } from "lucide-react";
import {
  useProjects,
  circuitLedBlink,
  circuitRcLpf,
  circuitDcMotor,
  circuitBattery,
  type ProjectCircuit,
} from "../store/projects";
import { circuitHalfAdder, circuitFullAdder } from "../circuit/adder-circuits";
import { circuitArduinoLcd, circuitArduinoOled } from "../circuit/display-examples";

const templates = [
  {id: "arduino-lcd-demo", name: "Arduino Uno + LCD 16×2", desc: "Hand-wired 4-bit HD44780 display, 10k contrast pot and 220Ω backlight resistor. Every wire is editable."},
  {id: "arduino-oled-demo", name: "Arduino Uno + I²C OLED", desc: "A4/SDA, A5/SCL, 3.3 V and GND connected with editable jumpers."},
  {
    id: "half-adder",
    name: "Half Adder · 2 inputs",
    desc: "74HC86 XOR + 74HC08 AND, A/B toggle switches, pull-downs and SUM/CARRY LEDs.",
  },
  {
    id: "full-adder",
    name: "Full Adder · 3 inputs",
    desc: "74HC86, 74HC08 and 74HC32 with real DIP-14 pin wiring and cascaded outputs.",
  },
  {
    id: "led-blink",
    name: "LED + Resistor",
    desc: "Classic series LED lab with switch control.",
  },
  {
    id: "rc-lpf",
    name: "RC Filter",
    desc: "Passive low-pass building block.",
  },
  {
    id: "dc-motor",
    name: "Motor Driver (SCR)",
    desc: "Gate-triggered SCR holding a DC motor on.",
  },
  {
    id: "battery",
    name: "9 V Diode / LED Indicator",
    desc: "Series resistor, diode and LED. This is a voltage-indicator demo, not a battery charger.",
  },
  {
    id: "blank",
    name: "Blank Breadboard",
    desc: "Empty board — place any components from the palette.",
  },
];

const TEMPLATE_CIRCUITS: Record<string, () => ProjectCircuit> = {
  "arduino-lcd-demo": circuitArduinoLcd,
  "arduino-oled-demo": circuitArduinoOled,
  "half-adder": circuitHalfAdder,
  "full-adder": circuitFullAdder,
  "led-blink": circuitLedBlink,
  "rc-lpf": circuitRcLpf,
  "dc-motor": circuitDcMotor,
  "battery": circuitBattery,
};

export function TemplatesPage() {
  const navigate = useNavigate();
  const createProject = useProjects((s) => s.createProject);
  const saveCircuit = useProjects((s) => s.saveCircuit);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Templates</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Start from a known circuit pattern or a blank board. In the 3D editor, power the bench on, then select and click an input switch again to toggle it.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div
            key={t.id}
            className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-4 flex flex-col"
          >
            <div className="w-10 h-10 rounded-lg bg-[var(--app-border)] text-[var(--app-text)] flex items-center justify-center mb-3">
              <LayoutTemplate size={18} />
            </div>
            <div className="text-sm font-semibold">{t.name}</div>
            <p className="text-xs text-slate-500 mt-1 flex-1">{t.desc}</p>
            <button
              type="button"
              onClick={() => {
                if (t.id === "blank") {
                  const p = createProject("Blank Breadboard");
                  navigate(`/editor/${p.id}`);
                } else {
                  // All templates create a fresh copy; an edited/deleted seed
                  // project should never break a starter template.
                  const build = TEMPLATE_CIRCUITS[t.id];
                  if (!build) return;
                  const p = createProject(t.name);
                  saveCircuit(p.id, build());
                  navigate(`/editor/${p.id}`);
                }
              }}
              className="mt-4 inline-flex items-center justify-center gap-2 border border-[var(--app-border)] hover:bg-slate-800 text-slate-200 text-sm px-3 py-2 rounded-lg transition"
            >
              <Plus size={14} /> Use template
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
