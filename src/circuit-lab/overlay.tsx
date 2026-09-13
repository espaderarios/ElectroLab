import { useEffect, useState } from "react";

import {
  ArrowLeft,
  Cable,
  Cpu,
  Gauge,
  Lightbulb,
  MousePointer2,
  RotateCcw,
  Trash2,
  Undo2,
  Zap,
  Minus,
  Play,
  ToggleLeft,
  CircleDot,
  Magnet,
  Volume2,
  CircuitBoard,
  Monitor,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

import {
  BOARD_PRESETS,
  holePosition,
  nearestHole,
  type BoardPresetId,
} from "@/circuit/breadboard";

import {
  dividerPreset,
  firstLightPreset,
  helloWorldPreset,
} from "@/circuit/presets";

import {
  RESISTOR_VALUES,
  CAPACITOR_VALUES,
  MOTOR_MODELS,
  type ToolId,
  type WireColor,
  type MotorModelId,
} from "@/circuit/types";

import { Button } from "@/components/ui/button";

import { useLab } from "@/store/lab";

import * as THREE from "three";

const TOOLS: {
  id: ToolId;
  label: string;
  hint: string;
  icon: any;
}[] = [
  {
    id: "select",
    label: "Select",
    hint: "Select and inspect",
    icon: MousePointer2,
  },

  {
    id: "wire",
    label: "Wire",
    hint: "Connect two holes",
    icon: Cable,
  },
  
  {
    id: "resistor",
    label: "Resistor",
    hint: "Non-polar component",
    icon: Minus,
  },

  {
    id: "led",
    label: "LED",
    hint: "A = + / K = −",
    icon: Lightbulb,
  },

  {
    id: "diode",
    label: "Diode",
    hint: "A = + / K = −",
    icon: Zap,
  },

  {
    id: "switch",
    label: "Switch",
    hint: "Place switch",
    icon: ToggleLeft,
  },

  {
    id: "button",
    label: "Push button",
    hint: "Click it to open or close",
    icon: CircleDot,
  },

  {
    id: "capacitor",
    label: "Capacitor",
    hint: "Place capacitor",
    icon: Gauge,
  },

  {
    id: "inductor",
    label: "Inductor",
    hint: "DC winding resistance model",
    icon: Magnet,
  },

  {
    id: "buzzer",
    label: "Buzzer",
    hint: "Powered piezo indicator",
    icon: Volume2,
  },

  {
    id: "speaker",
    label: "Speaker",
    hint: "Dynamic speaker (2-pin)",
    icon: Volume2,
  },

  {
    id: "transistor",
    label: "Transistor",
    hint: "BJT — choose package/model",
    icon: Cpu,
  },

  {
    id: "thyristor",
    label: "Thyristor (SCR)",
    hint: "SCR — anode, gate, cathode",
    icon: Zap,
  },

  {
    id: "triac",
    label: "TRIAC",
    hint: "Bidirectional — MT1, gate, MT2",
    icon: Zap,
  },

  {
    id: "diac",
    label: "DIAC",
    hint: "Trigger diode for TRIAC gates",
    icon: Zap,
  },

  {
    id: "motor",
    label: "DC Motor",
    hint: "3V / 5V / 6V / 9V / 12V hobby motor",
    icon: Gauge,
  },

  {
    id: "pot",
    label: "Potentiometer",
    hint: "Place potentiometer",
    icon: Gauge,
  },

  {
    id: "relay",
    label: "Relay",
    hint: "Four pins: coil, coil, COM, NO",
    icon: CircuitBoard,
  },

  {
    id: "lcd",
    label: "LCD",
    hint: "Place LCD",
    icon: Cpu,
  },

  {
    id: "oled",
    label: "OLED",
    hint: "128×64 I2C OLED (SSD1306)",
    icon: Cpu,
  },

  {
    id: "mcu",
    label: "Microcontroller",
    hint: "Place MCU",
    icon: Cpu,
  },

  {
    id: "probe",
    label: "Voltmeter",
    hint: "Measure voltage",
    icon: Gauge,
  },
];

const COLORS: WireColor[] = [
  "red",
  "black",
  "blue",
  "orange",
  "green",
  "yellow",
  "white",
];

const PIN_ORDER: Partial<Record<ToolId, string[]>> = {
  wire: ["end A", "end B"],
  resistor: ["A", "B"],
  led: ["anode +", "cathode ???"],
  diode: ["anode +", "cathode ???"],
  switch: ["A", "B"],
  button: ["A", "B"],
  capacitor: ["A", "B"],
  inductor: ["A", "B"],
  buzzer: ["+", "−"],
  speaker: ["+", "−"],
  transistor: ["E", "B", "C"],
  thyristor: ["K · cathode", "A · anode", "G · gate"],
  triac: ["MT1", "G · gate", "MT2"],
  diac: ["A", "B"],
  motor: ["+", "−"],
  pot: ["end A", "wiper", "end B"],
  relay: ["coil +", "coil −", "COM", "NO"],
  lcd: ["VDD +", "VSS −"],
  oled: ["VCC", "GND", "SDA", "SCL"],
  mcu: ["VCC +", "GND −"],
};

function formatCurrent(value: number) {
  const abs = Math.abs(value);

  if (abs < 0.001) {
    return `${(value * 1000000).toFixed(1)} uA`;
  }

  return `${(value * 1000).toFixed(2)} mA`;
}

function formatVoltage(value: number) {
  return `${value.toFixed(2)} V`;
}


const RESISTOR_TOLERANCE_OPTIONS = [
  { value: 1, label: "±1%", band: "brown" },
  { value: 2, label: "±2%", band: "red" },
  { value: 5, label: "±5%", band: "gold" },
  { value: 10, label: "±10%", band: "silver" },
] as const;

const RESISTOR_POWER_OPTIONS = [0.125, 0.25, 0.5, 1, 2] as const;

const RESISTOR_DIGIT_COLORS: Record<number, string> = {
  0: "#111827", 1: "#7c3f00", 2: "#ef4444", 3: "#f97316",
  4: "#eab308", 5: "#22c55e", 6: "#3b82f6", 7: "#8b5cf6",
  8: "#64748b", 9: "#f8fafc",
};

const RESISTOR_MULTIPLIER_COLORS: Record<number, string> = {
  [-2]: "#c0c0c0", [-1]: "#c0c0c0", 0: "#111827", 1: "#7c3f00",
  2: "#ef4444", 3: "#f97316", 4: "#eab308", 5: "#22c55e",
  6: "#3b82f6", 7: "#8b5cf6", 8: "#64748b", 9: "#f8fafc",
};

function resistorBands(value: number, tolerance = 5) {
  const n = Math.max(1, Math.round(value));
  const exponent = Math.max(0, Math.min(9, Math.floor(Math.log10(n)) - 1));
  const base = Math.round(n / Math.pow(10, exponent));
  const digits = String(base).padStart(2, "0").slice(-2).split("").map(Number);
  const toleranceBand = tolerance === 1 ? "#7c3f00" : tolerance === 2 ? "#ef4444" : tolerance === 10 ? "#c0c0c0" : "#d4af37";
  return [
    RESISTOR_DIGIT_COLORS[digits[0]],
    RESISTOR_DIGIT_COLORS[digits[1]],
    RESISTOR_MULTIPLIER_COLORS[exponent] ?? "#111827",
    toleranceBand,
  ];
}

function formatResistance(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value % 1_000_000 ? 2 : 0)} MΩ`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value % 1_000 ? 2 : 0)} kΩ`;
  return `${value} Ω`;
}

function formatCapacitance(value: number) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 1e-3) return `${(value * 1e3).toFixed(2)} mF`;
  if (value >= 1e-6) return `${(value * 1e6).toFixed(value * 1e6 % 1 ? 2 : 0)} µF`;
  if (value >= 1e-9) return `${(value * 1e9).toFixed(value * 1e9 % 1 ? 2 : 0)} nF`;
  if (value >= 1e-12) return `${(value * 1e12).toFixed(value * 1e12 % 1 ? 2 : 0)} pF`;
  return `${value} F`;
}

const COMPONENT_RATINGS: Record<string, {
  voltage?: string;
  current?: string;
  resistance?: string;
  power?: string;
  note?: string;
}> = {
  led: { voltage: "1.8–3.3 V typical", current: "20 mA max typical", note: "Forward voltage depends on LED color." },
  diode: { voltage: "50 V typical model", current: "1 A typical model", note: "Simulation uses a simplified diode model." },
  switch: { voltage: "12 V DC typical", current: "1 A typical", note: "Mechanical switch model." },
  button: { voltage: "12 V DC typical", current: "50 mA typical", note: "Momentary push-button model." },
  capacitor: { voltage: "16 V default", note: "Voltage rating is an electrical component rating; the simulation capacitance is editable." },
  inductor: { voltage: "12 V typical", resistance: "DC winding resistance model", note: "Transient inductance is simplified in the current simulator." },
  buzzer: { voltage: "3–5 V", current: "30 mA typical", note: "Powered piezo indicator." },
  speaker: { voltage: "5 V typical", current: "100 mA typical", note: "Dynamic speaker model." },
  relay: { voltage: "5 V coil", current: "70 mA typical", note: "Coil + COM/NO relay model." },
  pot: { voltage: "50 V max typical", power: "0.25 W typical", note: "Resistance is editable." },
  transistor: { voltage: "Depends on selected model", current: "Depends on selected model", note: "Package/model controls pinout and displayed rating." },
  thyristor: {
    voltage: "Depends on selected model",
    current: "IL ≈ 6 mA latch · IH ≈ 2 mA hold",
    note: "Gate pulse turns the SCR on only if anode current reaches latching current (IL). It then stays on after the gate is released while current ≥ holding current (IH). An LED or motor can remain powered after a momentary button press; drop below IH or remove power to turn off.",
  },
  triac: {
    voltage: "Depends on selected model",
    current: "IL ≈ 15 mA latch · IH ≈ 5 mA hold",
    note: "Bidirectional. Same latching/holding rules as an SCR: gate pulse latches it; current above IH keeps the load on after the gate is released.",
  },
  diac: {
    voltage: "32–40 V breakover",
    current: "Trigger pulse",
    note: "Breaks over at ±VBO and dumps a pulse into a TRIAC gate. Pair with a TRIAC for dimmer circuits.",
  },
  motor: {
    voltage: "3 / 5 / 6 / 9 / 12 V models",
    current: "Depends on rating (~100–400 mA)",
    note: "Pick a voltage rating in the inspector. Lower-voltage motors draw more current; speed scales with V / Vrated.",
  },
  lcd: { voltage: "5 V", current: "~20 mA typical", note: "HD44780-style 16×2 display." },
  oled: { voltage: "3.3–5 V", current: "~20 mA typical", note: "SSD1306-style I²C display." },
  mcu: { voltage: "5 V (Uno) / 3.3 V (ESP32)", current: "Depends on board/load", note: "Supply is provided through the simulator power rails." },
};

/** Project a screen point onto the breadboard plane (y = board height). */
function screenToBoardPoint(
  clientX: number,
  clientY: number,
): { x: number; z: number } | null {
  const canvas = document.querySelector(
    ".ece-circuit-lab canvas",
  ) as HTMLCanvasElement | null;
  if (!canvas) return null;

  const rect = canvas.getBoundingClientRect();
  const ndcX = ((clientX - rect.left) / rect.width) * 2 - 1;
  const ndcY = -((clientY - rect.top) / rect.height) * 2 + 1;

  // Match the default camera from LabCanvas / CameraRig.
  const camera = new THREE.PerspectiveCamera(
    42,
    rect.width / Math.max(rect.height, 1),
    0.1,
    60,
  );
  camera.position.set(3.8, 4.4, 5.6);
  camera.lookAt(0, 0.2, 0);
  camera.updateMatrixWorld();

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.34);
  const hit = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(plane, hit)) return null;
  return { x: hit.x, z: hit.z };
}

export function LabOverlay({ showPalette = true }: { showPalette?: boolean }) {
  const [monitorOpen, setMonitorOpen] = useState(false);

  const tool = useLab((s) => s.tool);

  const setTool = useLab((s) => s.setTool);
  const boardId = useLab((s) => s.boardId);
  const setBoard = useLab((s) => s.setBoard);
  const placePartAt = useLab((s) => s.placePartAt);

  const wireColor = useLab((s) => s.wireColor);

  const setWireColor = useLab(
    (s) => s.setWireColor
  );

  const resistorValue = useLab(
    (s) => s.resistorValue
  );

  const setResistorValue = useLab(
    (s) => s.setResistorValue
  );

  const ledColor = useLab(
    (s) => s.ledColor
  );

  const setLedColor = useLab(
    (s) => s.setLedColor
  );

  const powerOn = useLab(
    (s) => s.powerOn
  );

  const togglePower = useLab(
    (s) => s.togglePower
  );

  const voltage = useLab(
    (s) => s.psuVoltage
  );

  const setVoltage = useLab(
    (s) => s.setVoltage
  );

  const sim = useLab(
    (s) => s.sim
  );

  const pending = useLab(
    (s) => s.pendingHoles
  );

  const probeHole = useLab(
    (s) => s.probeHole
  );

  const selectedId = useLab(
    (s) => s.selectedId
  );

  const parts = useLab(
    (s) => s.parts
  );

  const wires = useLab(
    (s) => s.wires
  );

  const psuPositive = useLab(
    (s) => s.psuPositive
  );

  const psuNegative = useLab(
    (s) => s.psuNegative
  );

  const setSelectedResistance = useLab(
    (s) => s.setSelectedResistance
  );
  const setSelectedProp = useLab((s) => s.setSelectedProp);

  const setSelectedLedColor = useLab(
    (s) => s.setSelectedLedColor
  );

  const setSelectedLabel = useLab(
    (s) => s.setSelectedLabel
  );

  const setSelectedCode = useLab(
    (s) => s.setSelectedCode
  );
  const transistorModel = useLab((s) => s.transistorModel);
  const setTransistorModel = useLab((s) => s.setTransistorModel);
  const setSelectedTransistorModel = useLab(
    (s) => s.setSelectedTransistorModel,
  );
  const thyristorModel = useLab((s) => s.thyristorModel);
  const motorModel = useLab((s) => s.motorModel);
  const setThyristorModel = useLab((s) => s.setThyristorModel);
  const setSelectedThyristorModel = useLab(
    (s) => s.setSelectedThyristorModel,
  );
  const triacModel = useLab((s) => s.triacModel);
  const setTriacModel = useLab((s) => s.setTriacModel);
  const setSelectedTriacModel = useLab((s) => s.setSelectedTriacModel);
  const diacModel = useLab((s) => s.diacModel);
  const setDiacModel = useLab((s) => s.setDiacModel);
  const setSelectedDiacModel = useLab((s) => s.setSelectedDiacModel);
  const setSelectedMotorModel = useLab((s) => s.setSelectedMotorModel);
  const setMcuCode = useLab((s) => s.setMcuCode);

  const capacitorValue = useLab((s) => s.capacitorValue);
  const setCapacitorValue = useLab((s) => s.setCapacitorValue);

  const setSelectedCapacitance = useLab(
    (s) => s.setSelectedCapacitance
  );
  const selectedPart = useLab((s) =>
    s.parts.find((p) => p.id === s.selectedId)
  );

  const loadPreset = useLab(
    (s) => s.loadPreset
  );

  const clearBoard = useLab(
    (s) => s.clearBoard
  );

  const undo = useLab(
    (s) => s.undo
  );

  const deleteSelected = useLab(
    (s) => s.deleteSelected
  );

  const selected = selectedId
    ? parts.find(
        (part) => part.id === selectedId
      ) ?? null
    : null;

  const selectedWire = selectedId
  ? wires.find((wire) => wire.id === selectedId) ?? null
  : null;

  const selectedWireColor =
    selectedWire?.color ?? wireColor;

  const selectedCapacitance =
    selectedPart?.kind === "capacitor"
      ? Number(
          selectedPart.props.capacitance ??
            capacitorValue
        )
      : capacitorValue;

  const selectedResistance =
    selectedPart && (selectedPart.kind === "resistor" || selectedPart.kind === "pot")
      ? Number(selectedPart.props.resistance ?? resistorValue)
      : resistorValue;

  const probeVoltage = probeHole
    ? sim.voltages[probeHole] ?? 0
    : null;
  const probeCurrent = probeHole
    ? sim.nodeCurrents?.[probeHole] ?? 0
    : null;

  // Keep the probe card clear of the right-side panels:
  // - component/wire inspector (300px + gap) when something is selected and monitor is closed
  // - output monitor when it is open
  // - otherwise sit on the right edge
  const rightInspectorOpen =
    Boolean(selected || selectedWire) && !monitorOpen;
  const probePanelRight =
    monitorOpen || rightInspectorOpen ? 370 : 16;
  const instructionsRight =
    monitorOpen || rightInspectorOpen ? 370 : 16;

  const pinOrder = PIN_ORDER[tool] ?? [];

  // Global drop target: drag a component from the palette onto the 3D board.
  useEffect(() => {
    const onDragOver = (e: DragEvent) => {
      if (
        e.dataTransfer?.types.includes(
          "application/x-ece-tool",
        )
      ) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const onDrop = (e: DragEvent) => {
      const toolId = e.dataTransfer?.getData(
        "application/x-ece-tool",
      ) as ToolId | undefined;
      if (!toolId) return;
      e.preventDefault();

      const point = screenToBoardPoint(
        e.clientX,
        e.clientY,
      );
      if (!point) return;

      const hole = nearestHole(
        { x: point.x, y: 0.34, z: point.z },
        0.35,
      );
      if (!hole) return;

      placePartAt(toolId, hole);
    };

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener(
        "dragover",
        onDragOver,
      );
      window.removeEventListener("drop", onDrop);
    };
  }, [placePartAt]);

  // Close the monitor with Escape so it never gets in the way of the canvas.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMonitorOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      {/* TOP BAR */}

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          right: 16,
          zIndex: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          pointerEvents: "none",
        }}
      >

        {/* SIMULATION STATUS */}

        <div
          style={{
            pointerEvents: "auto",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: 8,
            borderRadius: 14,
            background:
              "rgba(8,15,28,.92)",
            border:
              "1px solid rgba(255,255,255,.12)",
          }}
        >
          <button
            type="button"
            onClick={() => setMonitorOpen((open) => !open)}
            aria-pressed={monitorOpen}
            title="Open output monitor"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid rgba(96,165,250,.22)",
              borderRadius: 9,
              padding: "9px 11px",
              cursor: "pointer",
              fontWeight: 700,
              color: monitorOpen ? "#bfdbfe" : "#cbd5e1",
              background: monitorOpen
                ? "rgba(37,99,235,.22)"
                : "rgba(255,255,255,.05)",
            }}
          >
            <Monitor size={15} />
            Monitor
          </button>

          <button
            type="button"
            onClick={togglePower}
            style={{
              border: 0,
              borderRadius: 9,
              padding: "9px 14px",
              cursor: "pointer",
              fontWeight: 700,
              color: "white",
              background: powerOn
                ? "#16a34a"
                : "#334155",
            }}
          >
            <Play
              size={14}
              style={{
                display: "inline",
                marginRight: 6,
              }}
            />

            {powerOn
              ? "POWER ON"
              : "POWER OFF"}
          </button>

          <label
            title="Bench power supply voltage"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 8px",
              borderRadius: 8,
              background: "rgba(255,255,255,.06)",
              color: "#cbd5e1",
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            V
            <input
              type="number"
              min={0}
              max={24}
              step={0.1}
              value={voltage}
              onChange={(e) =>
                setVoltage(Number(e.target.value) || 0)
              }
              style={{
                width: 52,
                padding: "4px 6px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,.14)",
                background: "#0f172a",
                color: "#f8fafc",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
              }}
            />
          </label>

          <div
            style={{
              padding: "7px 10px",
              borderRadius: 8,
              background:
                "rgba(255,255,255,.06)",
              color: "#cbd5e1",
              fontFamily:
                "ui-monospace, monospace",
              fontSize: 12,
            }}
          >
            I = {formatCurrent(
              sim.supplyCurrent
            )}
          </div>
        </div>
      </div>

      {showPalette && (
        <>
      {/* LEFT COMPONENT PANEL */}

      <aside
        style={{
          position: "absolute",
          top: 85,
          left: 16,
          bottom: 16,
          width: 270,
          zIndex: 90,
          overflowY: "auto",
          padding: 14,
          borderRadius: 18,
          background:
            "rgba(8,15,28,.94)",
          border:
            "1px solid rgba(255,255,255,.12)",
          color: "white",
          boxShadow:
            "0 20px 50px rgba(0,0,0,.35)",
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 1.5,
            textTransform: "uppercase",
            opacity: 0.55,
          }}
        >
          Components
        </div>

        <div
          style={{
            marginTop: 6,
            marginBottom: 12,
            fontSize: 12,
            color: "#94a3b8",
            lineHeight: 1.5,
          }}
        >
          Click a part then click holes, or drag a component onto the board to place it.
        </div>

        <div style={{ marginBottom: 10, padding: 9, borderRadius: 10, background: "rgba(37,99,235,.08)", border: "1px solid rgba(96,165,250,.14)" }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", color: "#64748b" }}>Board</div>
          <div style={{ marginTop: 3, fontSize: 12, fontWeight: 700, color: "#e2e8f0" }}>{BOARD_PRESETS.find((p) => p.id === boardId)?.label ?? "Standard 830"}</div>
          <div style={{ marginTop: 2, fontSize: 10, color: "#64748b" }}>{BOARD_PRESETS.find((p) => p.id === boardId)?.description ?? ""}</div>
        </div>
        {/* BREADBOARD SIZE / TYPE */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop:
              "1px solid rgba(255,255,255,.1)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              opacity: 0.55,
            }}
          >
            Breadboard
          </div>
          <div
            style={{
              marginTop: 6,
              marginBottom: 8,
              padding: "8px 10px",
              borderRadius: 8,
              background: "rgba(245, 158, 11, 0.08)",
              border: "1px solid rgba(245, 158, 11, 0.18)",
              fontSize: 11,
              color: "#fbbf24",
              lineHeight: 1.4,
            }}
          >
            ⚠ Changing the breadboard will clear all components and wires.
          </div>
          <select
            value={boardId}
            onChange={(e) =>
              setBoard(
                e.target.value as BoardPresetId,
              )
            }
            style={{
              width: "100%",
              padding: "9px 10px",
              borderRadius: 10,
              border:
                "1px solid rgba(255,255,255,.12)",
              background: "rgba(255,255,255,.06)",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {BOARD_PRESETS.map((p) => (
              <option
                key={p.id}
                value={p.id}
                style={{ color: "#0f172a" }}
              >
                {p.label}
              </option>
            ))}
          </select>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            {
              BOARD_PRESETS.find(
                (p) => p.id === boardId,
              )?.description
            }
          </div>
        </div>


        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: 7,
          }}
        >
          {TOOLS.map((item) => {
            const Icon = item.icon;

            const active =
              tool === item.id;

            const placeable =
              item.id !== "select" &&
              item.id !== "probe" &&
              item.id !== "delete";

            return (
              <button
                key={item.id}
                type="button"
                title={
                  placeable
                    ? `${item.hint} — drag onto the board to place`
                    : item.hint
                }
                draggable={placeable}
                onDragStart={(e) => {
                  if (!placeable) return;
                  e.dataTransfer.setData(
                    "application/x-ece-tool",
                    item.id,
                  );
                  e.dataTransfer.effectAllowed = "copy";
                  setTool(item.id);
                }}
                onClick={() => {
                  // Select tool toggles on/off like the top-nav pointer button
                  if (item.id === "select" && tool === "select") {
                    setTool("none");
                    useLab.getState().select(null);
                    return;
                  }
                  setTool(item.id);
                }}
                style={{
                  minHeight: 55,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: 9,
                  borderRadius: 11,
                  border: active
                    ? "1px solid #5eead4"
                    : "1px solid rgba(255,255,255,.08)",
                  background: active
                    ? "#164e63"
                    : "rgba(255,255,255,.05)",
                  color: "white",
                  cursor: placeable
                    ? "grab"
                    : "pointer",
                  textAlign: "left",
                }}
              >
                <Icon size={17} />

                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* SOURCES */}
        <div style={{ marginTop: 14, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#64748b" }}>Sources</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 7, marginTop: 8 }}>
            {[
              { id: "psu-positive" as ToolId, label: "VDC +", icon: Zap, tone: "rgba(239,68,68,.12)" },
              { id: "psu-negative" as ToolId, label: "GND", icon: Gauge, tone: "rgba(255,255,255,.05)" },
            ].map((item) => { const Icon = item.icon; const active = tool === item.id; return <button key={item.id} type="button" onClick={() => setTool(item.id)} style={{ minHeight: 54, borderRadius: 10, border: active ? "1px solid #60a5fa" : "1px solid rgba(255,255,255,.08)", background: active ? "rgba(37,99,235,.18)" : item.tone, color: "#e2e8f0", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}><Icon size={15} /><span style={{ fontSize: 9, fontWeight: 700 }}>{item.label}</span></button>; })}
            <button type="button" disabled title="AC source is not modeled by the current simulator" style={{ minHeight: 54, borderRadius: 10, border: "1px solid rgba(255,255,255,.06)", background: "rgba(255,255,255,.025)", color: "#475569", cursor: "not-allowed", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}><span style={{ fontSize: 15 }}>∿</span><span style={{ fontSize: 9, fontWeight: 700 }}>VAC</span></button>
          </div>
        </div>

        {/* POWER */}

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop:
              "1px solid rgba(255,255,255,.1)",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: 1.5,
              opacity: 0.55,
            }}
          >
            Power Supply
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "1fr 1fr",
              gap: 7,
              marginTop: 9,
            }}
          >
            <button
              type="button"
              onClick={() =>
                setTool("psu-positive")
              }
              style={{
                padding: 9,
                borderRadius: 9,
                border:
                  "1px solid rgba(239,68,68,.4)",
                background:
                  tool === "psu-positive"
                    ? "rgba(239,68,68,.3)"
                    : "rgba(239,68,68,.08)",
                color: "#fecaca",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Positive
            </button>

            <button
              type="button"
              onClick={() =>
                setTool("psu-negative")
              }
              style={{
                padding: 9,
                borderRadius: 9,
                border:
                  "1px solid rgba(255,255,255,.2)",
                background:
                  tool === "psu-negative"
                    ? "rgba(255,255,255,.15)"
                    : "rgba(255,255,255,.05)",
                color: "#e2e8f0",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Ground
            </button>
          </div>

          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              color: "#94a3b8",
              lineHeight: 1.6,
            }}
          >
            + {psuPositive ?? "not connected"}
            <br />
            - {psuNegative ?? "not connected"}
          </div>

          <label
            style={{
              display: "block",
              marginTop: 12,
              fontSize: 11,
              color: "#cbd5e1",
            }}
          >
            Supply voltage (0–24 V)

            <input
              type="number"
              min="0"
              max="24"
              step="0.1"
              value={voltage}
              onChange={(e) =>
                setVoltage(
                  Number(e.target.value) || 0
                )
              }
              style={{
                width: "100%",
                marginTop: 6,
                padding: 8,
                borderRadius: 8,
                border:
                  "1px solid rgba(255,255,255,.12)",
                background: "#111827",
                color: "white",
              }}
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 6,
              marginTop: 8,
            }}
          >
            {[3.3, 5, 9, 12].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVoltage(v)}
                style={{
                  padding: "7px 4px",
                  borderRadius: 8,
                  border:
                    Math.abs(voltage - v) < 0.05
                      ? "1px solid rgba(56,189,248,.55)"
                      : "1px solid rgba(255,255,255,.1)",
                  background:
                    Math.abs(voltage - v) < 0.05
                      ? "rgba(14,165,233,.2)"
                      : "rgba(255,255,255,.04)",
                  color: "#e2e8f0",
                  cursor: "pointer",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {v} V
              </button>
            ))}
          </div>
        </div>

        {/* WIRE SETTINGS */}

        {tool === "wire" && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop:
                "1px solid rgba(255,255,255,.1)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                opacity: 0.55,
              }}
            >
              Wire color
            </div>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 7,
                marginTop: 9,
              }}
            >
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => useLab.getState().setWireColor(color)}
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: "50%",
                    border:
                      wireColor === color
                        ? "3px solid white"
                        : "2px solid transparent",
                    background:
                      color === "white"
                        ? "#e5e7eb"
                        : color,
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* RESISTOR SETTINGS */}

        {(tool === "resistor" || tool === "pot") && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop:
                "1px solid rgba(255,255,255,.1)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                opacity: 0.55,
              }}
            >
              {tool === "pot" ? "Potentiometer value" : "Resistor value"}
            </div>

            <select
              value={resistorValue}
              onChange={(e) =>
                setResistorValue(
                  Number(e.target.value)
                )
              }
              style={{
                width: "100%",
                marginTop: 8,
                padding: 9,
                borderRadius: 8,
                background: "#111827",
                color: "white",
                border:
                  "1px solid rgba(255,255,255,.12)",
              }}
            >
              {RESISTOR_VALUES.map(
                (value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {value >= 1000
                      ? `${value / 1000} k??`
                      : `${value} ??`}
                  </option>
                )
              )}
            </select>
          </div>
        )}

        {tool === "capacitor" ? (
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {CAPACITOR_VALUES.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => {
                  setCapacitorValue(item.value);

                  if (selectedPart?.kind === "capacitor") {
                    setSelectedCapacitance(item.value);
                  }
                }}
                className={cn(
                  "h-8 rounded-[8px] px-2 font-mono text-xs",
                  selectedCapacitance === item.value
                    ? "bg-accent text-accent-fg"
                    : "bg-white/10 text-paper",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        ) : null}

        {/* LED SETTINGS */}

        {tool === "led" && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop:
                "1px solid rgba(255,255,255,.1)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                opacity: 0.55,
              }}
            >
              LED color
            </div>

            <select
              value={ledColor}
              onChange={(e) =>
                setLedColor(
                  e.target.value as any
                )
              }
              style={{
                width: "100%",
                marginTop: 8,
                padding: 9,
                borderRadius: 8,
                background: "#111827",
                color: "white",
                border:
                  "1px solid rgba(255,255,255,.12)",
              }}
            >
              <option value="red">
                Red
              </option>

              <option value="green">
                Green
              </option>

              <option value="yellow">
                Yellow
              </option>

              <option value="blue">
                Blue
              </option>
            </select>
          </div>
        )}

        {/* SELECTED COMPONENT */}

        {(selected || selectedWire) && (
          <div
            style={{
              marginTop: 18,
              paddingTop: 14,
              borderTop:
                "1px solid rgba(255,255,255,.1)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                opacity: 0.55,
              }}
            >
              Selected
            </div>

            <div
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 10,
                background:
                  "rgba(255,255,255,.05)",
              }}
            >
        <strong>
          {selectedWire ? "Jumper Wire" : selected?.kind}
        </strong>

              <div
                style={{
                  marginTop: 5,
                  fontSize: 10,
                  color: "#94a3b8",
                }}
              >
                ID: {selectedWire ? selectedWire.id : selected?.id}
              </div>
            </div>

{selectedWire && (
  <div
    style={{
      marginTop: 12,
      padding: 10,
      borderRadius: 10,
      background: "rgba(255,255,255,.04)",
    }}
  >
    <div
      style={{
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: 1.2,
        opacity: 0.55,
      }}
    >
      Wire color
    </div>

    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 10,
      }}
    >
      {COLORS.map((color) => (
        <button
          key={color}
          type="button"
          title={color}
          onClick={() => setWireColor(color)}
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            border:
              selectedWire.color === color
                ? "3px solid white"
                : "2px solid rgba(255,255,255,.15)",
            background:
              color === "white"
                ? "#e5e7eb"
                : color,
            boxShadow:
              selectedWire.color === color
                ? "0 0 0 2px rgba(94,234,212,.35)"
                : "none",
            cursor: "pointer",
          }}
        />
      ))}
    </div>
  </div>
)}
            <label
              style={{
                display: "block",
                marginTop: 9,
                fontSize: 11,
              }}
            >
              Label

              <input
                type="text"
                value={
                  selected!.props.label ?? ""
                }
                placeholder="R1 / LED1 / SW1"
                onChange={(e) =>
                  setSelectedLabel(
                    e.target.value
                  )
                }
                style={{
                  width: "100%",
                  marginTop: 5,
                  padding: 8,
                  borderRadius: 8,
                  background: "#111827",
                  color: "white",
                  border:
                    "1px solid rgba(255,255,255,.12)",
                }}
              />
            </label>

            {(selected!.kind === "resistor" || selected!.kind === "pot") && (
              <input
                type="number"
                value={
                  selected!.props
                    .resistance ?? 1000
                }
                onChange={(e) =>
                  setSelectedResistance(
                    Number(e.target.value)
                  )
                }
                style={{
                  width: "100%",
                  marginTop: 7,
                  padding: 8,
                  borderRadius: 8,
                  background: "#111827",
                  color: "white",
                  border:
                    "1px solid rgba(255,255,255,.12)",
                }}
              />
            )}
            {selected!.kind === "capacitor" && (
            <label
              style={{
                display: "block",
                marginTop: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: "uppercase",
                  opacity: 0.55,
                  marginBottom: 6,
                }}
              >
                Capacitance
              </div>

              <select
                value={String(
                  selected!.props.capacitance ??
                    capacitorValue
                )}
                onChange={(e) => {
                  const value = Number(e.target.value);

                  if (!Number.isFinite(value)) {
                    return;
                  }

                  setSelectedCapacitance(value);
                  setCapacitorValue(value);
                }}
                style={{
                  width: "100%",
                  padding: "9px 10px",
                  borderRadius: 9,
                  border:
                    "1px solid rgba(255,255,255,.12)",
                  background: "#111827",
                  color: "white",
                  fontSize: 12,
                  outline: "none",
                }}
              >
                {CAPACITOR_VALUES.map((item) => (
                  <option
                    key={item.value}
                    value={String(item.value)}
                  >
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
          )}
            {selected!.kind === "led" && (
              <select
                value={
                  selected!.props
                    .ledColor ?? "red"
                }
                onChange={(e) =>
                  setSelectedLedColor(
                    e.target.value as any
                  )
                }
                style={{
                  width: "100%",
                  marginTop: 7,
                  padding: 8,
                  borderRadius: 8,
                  background: "#111827",
                  color: "white",
                }}
              >
                <option value="red">
                  Red
                </option>

                <option value="green">
                  Green
                </option>

                <option value="yellow">
                  Yellow
                </option>

                <option value="blue">
                  Blue
                </option>
              </select>
            )}

          </div>
        )}

        
            {(selected?.kind === "transistor" || tool === "transistor") && (
              <label
                style={{
                  display: "block",
                  marginTop: 10,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    opacity: 0.55,
                    marginBottom: 6,
                  }}
                >
                  Transistor model
                </div>
                <select
                  value={
                    selected?.kind === "transistor"
                      ? selected.props.transistorModel ?? transistorModel
                      : transistorModel
                  }
                  onChange={(e) => {
                    const value = e.target.value as typeof transistorModel;
                    if (selected?.kind === "transistor") {
                      setSelectedTransistorModel(value);
                    } else {
                      setTransistorModel(value);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#111827",
                    color: "white",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="2n3904">2N3904 — TO-92 NPN</option>
                  <option value="2n3906">2N3906 — TO-92 PNP</option>
                  <option value="bc547">BC547 — TO-92 NPN</option>
                  <option value="bc557">BC557 — TO-92 PNP</option>
                  <option value="2n2222">2N2222 — TO-18 metal NPN</option>
                  <option value="tip31">TIP31 — TO-220 NPN</option>
                  <option value="tip32">TIP32 — TO-220 PNP</option>
                  <option value="2n3055">2N3055 — TO-3 power NPN</option>
                </select>
              </label>
            )}

            {(selected?.kind === "thyristor" || tool === "thyristor") && (
              <label style={{ display: "block", marginTop: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    opacity: 0.55,
                    marginBottom: 6,
                  }}
                >
                  Thyristor model
                </div>
                <select
                  value={
                    selected?.kind === "thyristor"
                      ? selected.props.thyristorModel ?? thyristorModel
                      : thyristorModel
                  }
                  onChange={(e) => {
                    const value = e.target.value as typeof thyristorModel;
                    if (selected?.kind === "thyristor") {
                      setSelectedThyristorModel(value);
                    } else {
                      setThyristorModel(value);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#111827",
                    color: "white",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="2n5060">2N5060 — TO-92 sensitive gate</option>
                  <option value="tic106">TIC106 — TO-220 4 A</option>
                  <option value="bt151">BT151 — TO-220 12 A</option>
                  <option value="c106">C106 — TO-220 4 A</option>
                  <option value="2n6508">2N6508 — TO-220 25 A</option>
                  <option value="tyn612">TYN612 — TO-220 12 A</option>
                </select>
              </label>
            )}

            {(selected?.kind === "triac" || tool === "triac") && (
              <label style={{ display: "block", marginTop: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    opacity: 0.55,
                    marginBottom: 6,
                  }}
                >
                  TRIAC model
                </div>
                <select
                  value={
                    selected?.kind === "triac"
                      ? selected.props.triacModel ?? triacModel
                      : triacModel
                  }
                  onChange={(e) => {
                    const value = e.target.value as typeof triacModel;
                    if (selected?.kind === "triac") {
                      setSelectedTriacModel(value);
                    } else {
                      setTriacModel(value);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#111827",
                    color: "white",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="bt136">BT136 — TO-220 4 A</option>
                  <option value="bt139">BT139 — TO-220 16 A</option>
                  <option value="tic226">TIC226 — TO-220 8 A</option>
                  <option value="mac97a">MAC97A — TO-92 sensitive</option>
                  <option value="bta16">BTA16 — TO-220 16 A isolated</option>
                </select>
              </label>
            )}

            {(selected?.kind === "diac" || tool === "diac") && (
              <label style={{ display: "block", marginTop: 10 }}>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.2,
                    textTransform: "uppercase",
                    opacity: 0.55,
                    marginBottom: 6,
                  }}
                >
                  DIAC model
                </div>
                <select
                  value={
                    selected?.kind === "diac"
                      ? selected.props.diacModel ?? diacModel
                      : diacModel
                  }
                  onChange={(e) => {
                    const value = e.target.value as typeof diacModel;
                    if (selected?.kind === "diac") {
                      setSelectedDiacModel(value);
                    } else {
                      setDiacModel(value);
                    }
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 10px",
                    borderRadius: 9,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#111827",
                    color: "white",
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  <option value="db3">DB3 — ~32 V breakover</option>
                  <option value="db4">DB4 — ~40 V breakover</option>
                  <option value="ht32">HT32 — ~32 V breakover</option>
                </select>
              </label>
            )}

        {/* BOARD CONTROLS */}

        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop:
              "1px solid rgba(255,255,255,.1)",
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: 7,
          }}
        >
          <button
            type="button"
            onClick={undo}
            style={{
              padding: 9,
              borderRadius: 8,
              border:
                "1px solid rgba(255,255,255,.1)",
              background:
                "rgba(255,255,255,.05)",
              color: "white",
              cursor: "pointer",
            }}
          >
            <Undo2
              size={14}
              style={{
                display: "inline",
                marginRight: 5,
              }}
            />
            Undo
          </button>

          <button
            type="button"
            onClick={deleteSelected}
            style={{
              padding: 9,
              borderRadius: 8,
              border:
                "1px solid rgba(239,68,68,.25)",
              background:
                "rgba(239,68,68,.08)",
              color: "#fecaca",
              cursor: "pointer",
            }}
          >
            <Trash2
              size={14}
              style={{
                display: "inline",
                marginRight: 5,
              }}
            />
            Delete
          </button>

          <button
            type="button"
            onClick={clearBoard}
            style={{
              gridColumn: "1 / -1",
              padding: 10,
              borderRadius: 8,
              border:
                "1px solid rgba(255,255,255,.1)",
              background:
                "rgba(255,255,255,.05)",
              color: "white",
              cursor: "pointer",
            }}
          >
            <RotateCcw
              size={14}
              style={{
                display: "inline",
                marginRight: 5,
              }}
            />
            Clear Breadboard
          </button>
        </div>
      </aside>
        </>
      )}

      {/* RIGHT INSPECTOR: functional component properties */}
{(selected || selectedWire) && !monitorOpen && (
  <aside
    aria-label={selectedWire ? "Wire inspector" : "Component inspector"}
    style={{
      position: "absolute",
      top: 85,
      right: 16,
      bottom: 16,
      width: 300,
      zIndex: 88,
      overflowY: "auto",
      padding: 14,
      borderRadius: 18,
      background: "rgba(8,15,28,.97)",
      border: "1px solid rgba(96,165,250,.16)",
      color: "white",
      boxShadow: "0 24px 60px rgba(0,0,0,.42)",
    }}
  >

    {/* =========================
        WIRE INSPECTOR
       ========================= */}
    {selectedWire ? (
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Wire
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 16,
                fontWeight: 750,
              }}
            >
              Jumper Wire
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 10,
                color: "#64748b",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              ID: {selectedWire.id}
            </div>
          </div>
        </div>

        {/* IDENTITY */}
        <div
          style={{
            marginTop: 15,
            paddingTop: 13,
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Identity
          </div>

          <div
            style={{
              marginTop: 9,
              padding: 10,
              borderRadius: 9,
              background: "rgba(255,255,255,.04)",
            }}
          >
            <div
              style={{
                fontSize: 9,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Wire ID
            </div>

            <div
              style={{
                marginTop: 4,
                color: "#e2e8f0",
                fontFamily: "ui-monospace, monospace",
                fontSize: 12,
                wordBreak: "break-all",
              }}
            >
              {selectedWire.id}
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 7,
            }}
          >
            <div
              style={{
                padding: 9,
                borderRadius: 9,
                background: "rgba(255,255,255,.04)",
              }}
            >
              <div style={{ fontSize: 8, color: "#64748b" }}>
                FROM
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {selectedWire.a}
              </div>
            </div>

            <div
              style={{
                padding: 9,
                borderRadius: 9,
                background: "rgba(255,255,255,.04)",
              }}
            >
              <div style={{ fontSize: 8, color: "#64748b" }}>
                TO
              </div>

              <div
                style={{
                  marginTop: 3,
                  fontSize: 11,
                  fontFamily: "ui-monospace, monospace",
                }}
              >
                {selectedWire.b}
              </div>
            </div>
          </div>
        </div>

        {/* APPEARANCE */}
        <div
          style={{
            marginTop: 15,
            paddingTop: 13,
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Appearance
          </div>

          <div
            style={{
              marginTop: 9,
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                title={color}
                onClick={() => setWireColor(color)}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  border:
                    selectedWire.color === color
                      ? "3px solid white"
                      : "2px solid rgba(255,255,255,.15)",
                  background:
                    color === "white"
                      ? "#e5e7eb"
                      : color,
                  cursor: "pointer",
                }}
              />
            ))}
          </div>
        </div>
      </>
    ) : (

      /* =========================
         COMPONENT INSPECTOR
         ========================= */
      <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#64748b",
              }}
            >
              Component
            </div>

            <div
              style={{
                marginTop: 3,
                fontSize: 16,
                fontWeight: 750,
              }}
            >
              {selected!.props.label ?? selected!.kind}
            </div>

            <div
              style={{
                marginTop: 2,
                fontSize: 10,
                color: "#64748b",
              }}
            >
              {selected!.kind} · {selected!.id}
            </div>
          </div>

          {sim.burned?.[selected!.id] && (
            <span
              style={{
                padding: "5px 7px",
                borderRadius: 7,
                background: "rgba(239,68,68,.15)",
                border: "1px solid rgba(239,68,68,.28)",
                color: "#fca5a5",
                fontSize: 9,
                fontWeight: 800,
                letterSpacing: 1,
              }}
            >
              OVERLOAD
            </span>
          )}
        </div>

        {/* IDENTITY */}
        <div
          style={{
            marginTop: 15,
            paddingTop: 13,
            borderTop: "1px solid rgba(255,255,255,.08)",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 1.3,
              textTransform: "uppercase",
              color: "#94a3b8",
            }}
          >
            Identity
          </div>

          <label
            style={{
              display: "block",
              marginTop: 9,
              fontSize: 10,
              color: "#64748b",
              textTransform: "uppercase",
              letterSpacing: 1.1,
            }}
          >
            Label

            <input
              type="text"
              value={selected!.props.label ?? ""}
              placeholder="R1 / LED1 / C1"
              onChange={(e) =>
                setSelectedLabel(e.target.value)
              }
              style={{
                width: "100%",
                marginTop: 5,
                padding: "9px 10px",
                borderRadius: 9,
                border:
                  "1px solid rgba(255,255,255,.12)",
                background: "#111827",
                color: "white",
                outline: "none",
              }}
            />
          </label>
        </div>

          {selected!.kind === "resistor" && (() => {
            const r = Math.max(1, Number(selected!.props.resistance ?? 1000));
            const tolerance = Number(selected!.props.tolerance ?? 5);
            const powerRating = Number(selected!.props.powerRating ?? 0.25);
            const voltageRating = Number(selected!.props.voltageRating ?? 200);
            const current = Math.abs(sim.currents?.[selected!.id] ?? 0);
            const dissipation = current * current * r;
            return (
              <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Resistor</div>
                <label style={{ display: "block", marginTop: 9, fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.1 }}>
                  Resistance
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", gap: 7, marginTop: 5 }}>
                    <input type="number" min="1" step="1" value={r} onChange={(e) => setSelectedResistance(Math.max(1, Number(e.target.value) || 1))} style={{ width: "100%", padding: "9px 10px", borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "#111827", color: "white", fontFamily: "ui-monospace, monospace" }} />
                    <span style={{ display: "grid", placeItems: "center", borderRadius: 9, background: "rgba(255,255,255,.04)", color: "#94a3b8", fontFamily: "ui-monospace, monospace" }}>Ω</span>
                  </div>
                </label>
                <div style={{ marginTop: 12, fontSize: 10, color: "#64748b", textTransform: "uppercase", letterSpacing: 1.1 }}>Color code · 4 band</div>
                <div style={{ marginTop: 6, height: 54, borderRadius: 11, background: "#d8bd8b", border: "1px solid rgba(255,255,255,.13)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 104, height: 24, borderRadius: 12, background: "#d9bd8a", boxShadow: "inset 0 1px 3px rgba(0,0,0,.18)" }} />
                  <div style={{ position: "absolute", display: "flex", gap: 10 }}>
                    {resistorBands(r, tolerance).map((color, index) => <span key={index} style={{ width: 7, height: 34, borderRadius: 2, background: color, boxShadow: "0 1px 2px rgba(0,0,0,.35)" }} />)}
                  </div>
                </div>
                <div style={{ marginTop: 7, fontSize: 11, color: "#e2e8f0", fontFamily: "ui-monospace, monospace" }}>
                  {formatResistance(r)} · ±{tolerance}%
                </div>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <label style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
                    Tolerance
                    <select value={tolerance} onChange={(e) => setSelectedProp("tolerance", Number(e.target.value))} style={{ width: "100%", marginTop: 5, padding: "8px 8px", borderRadius: 8, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}>
                      {RESISTOR_TOLERANCE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
                    Power rating
                    <select value={powerRating} onChange={(e) => setSelectedProp("powerRating", Number(e.target.value))} style={{ width: "100%", marginTop: 5, padding: "8px 8px", borderRadius: 8, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}>
                      {RESISTOR_POWER_OPTIONS.map((item) => <option key={item} value={item}>{item} W</option>)}
                    </select>
                  </label>
                </div>
                <label style={{ display: "block", marginTop: 9, fontSize: 9, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
                  Voltage rating
                  <select value={voltageRating} onChange={(e) => setSelectedProp("voltageRating", Number(e.target.value))} style={{ width: "100%", marginTop: 5, padding: "8px 8px", borderRadius: 8, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}>
                    {[25, 50, 100, 200, 250, 350].map((v) => <option key={v} value={v}>{v} V</option>)}
                  </select>
                </label>
                <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <div style={{ padding: 9, borderRadius: 9, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>LIVE CURRENT</div><div style={{ marginTop: 3, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{formatCurrent(current)}</div></div>
                  <div style={{ padding: 9, borderRadius: 9, background: dissipation > powerRating ? "rgba(239,68,68,.12)" : "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>DISSIPATION</div><div style={{ marginTop: 3, fontSize: 11, fontFamily: "ui-monospace, monospace" }}>{dissipation.toFixed(3)} W</div></div>
                </div>
              </div>
            );
          })()}

          {selected!.kind === "pot" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Potentiometer</div>
              <label style={{ display: "block", marginTop: 9, fontSize: 10, color: "#64748b" }}>Total resistance
                <div style={{ display: "grid", gridTemplateColumns: "1fr 44px", gap: 7, marginTop: 5 }}><input type="number" min="1" value={selectedResistance} onChange={(e) => setSelectedResistance(Math.max(1, Number(e.target.value) || 1))} style={{ width: "100%", padding: "9px 10px", borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }} /><span style={{ display: "grid", placeItems: "center", color: "#94a3b8" }}>Ω</span></div>
              </label>
              <div style={{ marginTop: 7, fontSize: 10, color: "#64748b" }}>Pins: A · Wiper · B</div>
            </div>
          )}

          {selected!.kind === "capacitor" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Capacitor</div>
              <label style={{ display: "block", marginTop: 9, fontSize: 10, color: "#64748b" }}>Capacitance
                <select value={String(selected!.props.capacitance ?? capacitorValue)} onChange={(e) => { const v = Number(e.target.value); setSelectedCapacitance(v); setCapacitorValue(v); }} style={{ width: "100%", marginTop: 5, padding: "9px 10px", borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}>{CAPACITOR_VALUES.map((item) => <option key={item.value} value={String(item.value)}>{item.label}</option>)}</select>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginTop: 9 }}>
                <label style={{ fontSize: 9, color: "#64748b" }}>TYPE<select value={selected!.props.capacitorType ?? "ceramic"} onChange={(e) => setSelectedProp("capacitorType", e.target.value)} style={{ width: "100%", marginTop: 5, padding: 8, borderRadius: 8, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}><option value="ceramic">Ceramic</option><option value="electrolytic">Electrolytic</option><option value="film">Film</option><option value="tantalum">Tantalum</option></select></label>
                <label style={{ fontSize: 9, color: "#64748b" }}>VOLTAGE<select value={selected!.props.voltageRating ?? 16} onChange={(e) => setSelectedProp("voltageRating", Number(e.target.value))} style={{ width: "100%", marginTop: 5, padding: 8, borderRadius: 8, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}>{[6.3, 10, 16, 25, 35, 50, 100].map((v) => <option key={v} value={v}>{v} V</option>)}</select></label>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b" }}>V = {formatVoltage(selectedPart ? Math.abs((sim.voltages[selectedPart.pins.A] ?? 0) - (sim.voltages[selectedPart.pins.B] ?? 0)) : 0)}</div>
            </div>
          )}

          {selected!.kind === "led" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>LED</div>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>{["red", "green", "yellow", "blue"].map((c) => { const hex = ({red:"#ef4444",green:"#22c55e",yellow:"#facc15",blue:"#38bdf8"} as Record<string,string>)[c]; const active = (selected!.props.ledColor ?? "red") === c; return <button key={c} type="button" onClick={() => setSelectedLedColor(c as any)} title={c} style={{ height: 34, borderRadius: 8, border: active ? `2px solid ${hex}` : "1px solid rgba(255,255,255,.1)", background: "#111827", cursor: "pointer", display: "grid", placeItems: "center" }}><span style={{ width: 14, height: 14, borderRadius: "50%", background: hex, boxShadow: `0 0 9px ${hex}77` }} /></button> })}</div>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                <div style={{ padding: 9, borderRadius: 8, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>FORWARD V</div><div style={{ marginTop: 3, fontFamily: "ui-monospace,monospace" }}>{formatVoltage(({red:1.9,green:2.2,yellow:2.1,blue:3.0} as Record<string,number>)[selected!.props.ledColor ?? "red"] ?? 1.9)}</div></div>
                <div style={{ padding: 9, borderRadius: 8, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>MAX CURRENT</div><div style={{ marginTop: 3, fontFamily: "ui-monospace,monospace" }}>20 mA</div></div>
              </div>
            </div>
          )}

          {selected!.kind === "diode" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Diode</div>
              <label style={{ display: "block", marginTop: 9, fontSize: 9, color: "#64748b" }}>MODEL TYPE<select value={selected!.props.diodeType ?? "silicon"} onChange={(e) => setSelectedProp("diodeType", e.target.value)} style={{ width: "100%", marginTop: 5, padding: 8, borderRadius: 8, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}><option value="silicon">Silicon · ~0.7 V</option><option value="schottky">Schottky · ~0.3 V</option><option value="zener">Zener · breakdown model</option></select></label>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}><div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>ANODE</div><div style={{ marginTop: 2 }}>A · +</div></div><div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>CATHODE</div><div style={{ marginTop: 2 }}>K · −</div></div></div>
            </div>
          )}

          {selected!.kind === "transistor" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Transistor</div>
              <select value={selected!.props.transistorModel ?? transistorModel} onChange={(e) => setSelectedTransistorModel(e.target.value as typeof transistorModel)} style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}><option value="2n3904">2N3904 · TO-92 · NPN</option><option value="2n3906">2N3906 · TO-92 · PNP</option><option value="bc547">BC547 · TO-92 · NPN</option><option value="bc557">BC557 · TO-92 · PNP</option><option value="2n2222">2N2222 · TO-18 · NPN</option><option value="tip31">TIP31 · TO-220 · NPN</option><option value="tip32">TIP32 · TO-220 · PNP</option><option value="2n3055">2N3055 · TO-3 · NPN</option></select>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>{[["B","Base"],["E","Emitter"],["C","Collector"]].map(([pin,label]) => <div key={pin} style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>{label}</div><div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>{pin}</div></div>)}</div>
            </div>
          )}

          {selected!.kind === "thyristor" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Thyristor (SCR)</div>
              <select
                value={selected!.props.thyristorModel ?? thyristorModel}
                onChange={(e) => setSelectedThyristorModel(e.target.value as typeof thyristorModel)}
                style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <option value="2n5060">2N5060 · TO-92 · sensitive gate</option>
                <option value="tic106">TIC106 · TO-220 · 4 A</option>
                <option value="bt151">BT151 · TO-220 · 12 A</option>
                <option value="c106">C106 · TO-220 · 4 A</option>
                <option value="2n6508">2N6508 · TO-220 · 25 A</option>
                <option value="tyn612">TYN612 · TO-220 · 12 A</option>
              </select>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {[["K", "Cathode"], ["A", "Anode"], ["G", "Gate"]].map(([pin, label]) => (
                  <div key={pin} style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                    <div style={{ fontSize: 8, color: "#64748b" }}>{label}</div>
                    <div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>{pin}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.45 }}>
                Gate trigger (V<sub>GK</sub> ≥ 0.7 V) while anode is forward. Latches if I<sub>A</sub> ≥ I<sub>L</sub> (~6 mA); stays on after gate release while I<sub>A</sub> ≥ I<sub>H</sub> (~2 mA).
              </div>
            </div>
          )}


          {selected!.kind === "motor" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>DC Motor</div>
              <select
                value={selected!.props.motorModel ?? motorModel}
                onChange={(e) => setSelectedMotorModel(e.target.value as MotorModelId)}
                style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}
              >
                {(Object.keys(MOTOR_MODELS) as MotorModelId[]).map((id) => {
                  const m = MOTOR_MODELS[id];
                  return (
                    <option key={id} value={id}>
                      {m.label} · {m.ratedVoltage}V · {m.resistance}Ω · {(m.inductance * 1000).toFixed(1)}mH
                    </option>
                  );
                })}
              </select>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                  <div style={{ fontSize: 8, color: "#64748b" }}>RATED V</div>
                  <div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>
                    {(MOTOR_MODELS[(selected!.props.motorModel ?? motorModel) as MotorModelId] ?? MOTOR_MODELS["5v"]).ratedVoltage} V
                  </div>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                  <div style={{ fontSize: 8, color: "#64748b" }}>MODEL R</div>
                  <div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>
                    {(MOTOR_MODELS[(selected!.props.motorModel ?? motorModel) as MotorModelId] ?? MOTOR_MODELS["5v"]).resistance} Ω
                  </div>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                  <div style={{ fontSize: 8, color: "#64748b" }}>INDUCTANCE L</div>
                  <div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>
                    {(((MOTOR_MODELS[(selected!.props.motorModel ?? motorModel) as MotorModelId] ?? MOTOR_MODELS["5v"]).inductance) * 1000).toFixed(1)} mH
                  </div>
                </div>
                <div style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                  <div style={{ fontSize: 8, color: "#64748b" }}>τ = L/R</div>
                  <div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>
                    {((((MOTOR_MODELS[(selected!.props.motorModel ?? motorModel) as MotorModelId] ?? MOTOR_MODELS["5v"]).inductance) / (MOTOR_MODELS[(selected!.props.motorModel ?? motorModel) as MotorModelId] ?? MOTOR_MODELS["5v"]).resistance) * 1000).toFixed(2)} ms
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.45 }}>
                Speed ≈ |V| / V<sub>rated</sub>. Current ramps with τ = L/R<sub>a</sub> (first-order).
              </div>
            </div>
          )}

          {selected!.kind === "triac" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>TRIAC</div>
              <select
                value={selected!.props.triacModel ?? triacModel}
                onChange={(e) => setSelectedTriacModel(e.target.value as typeof triacModel)}
                style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <option value="bt136">BT136 · TO-220 · 4 A</option>
                <option value="bt139">BT139 · TO-220 · 16 A</option>
                <option value="tic226">TIC226 · TO-220 · 8 A</option>
                <option value="mac97a">MAC97A · TO-92 · sensitive</option>
                <option value="bta16">BTA16 · TO-220 · 16 A isolated</option>
              </select>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
                {[["MT1", "Main 1"], ["G", "Gate"], ["MT2", "Main 2"]].map(([pin, label]) => (
                  <div key={pin} style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,.04)" }}>
                    <div style={{ fontSize: 8, color: "#64748b" }}>{label}</div>
                    <div style={{ marginTop: 2, fontFamily: "ui-monospace,monospace" }}>{pin}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.45 }}>
                Bidirectional. Gate pulse latches if I ≥ I<sub>L</sub> (~15 mA); stays on after gate release while I ≥ I<sub>H</sub> (~5 mA).
              </div>
            </div>
          )}

          {selected!.kind === "diac" && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>DIAC</div>
              <select
                value={selected!.props.diacModel ?? diacModel}
                onChange={(e) => setSelectedDiacModel(e.target.value as typeof diacModel)}
                style={{ width: "100%", marginTop: 8, padding: 9, borderRadius: 9, background: "#111827", color: "white", border: "1px solid rgba(255,255,255,.12)" }}
              >
                <option value="db3">DB3 · ~32 V breakover</option>
                <option value="db4">DB4 · ~40 V breakover</option>
                <option value="ht32">HT32 · ~32 V breakover</option>
              </select>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.45 }}>
                Breaks over at ±V<sub>BO</sub> and conducts briefly — classic TRIAC gate trigger in dimmer circuits.
              </div>
            </div>
          )}

          {selected!.kind !== "resistor" && selected!.kind !== "pot" && selected!.kind !== "capacitor" && selected!.kind !== "led" && selected!.kind !== "diode" && selected!.kind !== "transistor" && selected!.kind !== "thyristor" && selected!.kind !== "triac" && selected!.kind !== "diac" && COMPONENT_RATINGS[selected!.kind] && (
            <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Electrical rating</div>
              <div style={{ marginTop: 9, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                {COMPONENT_RATINGS[selected!.kind].voltage && <div style={{ padding: 9, borderRadius: 9, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>VOLTAGE</div><div style={{ marginTop: 3, fontSize: 11 }}>{COMPONENT_RATINGS[selected!.kind].voltage}</div></div>}
                {COMPONENT_RATINGS[selected!.kind].current && <div style={{ padding: 9, borderRadius: 9, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>CURRENT</div><div style={{ marginTop: 3, fontSize: 11 }}>{COMPONENT_RATINGS[selected!.kind].current}</div></div>}
                {COMPONENT_RATINGS[selected!.kind].power && <div style={{ padding: 9, borderRadius: 9, background: "rgba(255,255,255,.04)" }}><div style={{ fontSize: 8, color: "#64748b" }}>POWER</div><div style={{ marginTop: 3, fontSize: 11 }}>{COMPONENT_RATINGS[selected!.kind].power}</div></div>}
              </div>
              <div style={{ marginTop: 8, fontSize: 10, color: "#64748b", lineHeight: 1.45 }}>{COMPONENT_RATINGS[selected!.kind].note}</div>
            </div>
          )}

          <div style={{ marginTop: 15, paddingTop: 13, borderTop: "1px solid rgba(255,255,255,.08)" }}>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.3, textTransform: "uppercase", color: "#94a3b8" }}>Connections</div>
            <div style={{ marginTop: 8, display: "grid", gap: 5 }}>
              {Object.entries(selected!.pins).map(([pin, hole]) => <div key={pin} style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 8px", borderRadius: 7, background: "rgba(255,255,255,.035)", fontSize: 10 }}><span style={{ color: "#cbd5e1", fontWeight: 650 }}>{pin}</span><span style={{ color: "#64748b", fontFamily: "ui-monospace,monospace" }}>{hole}</span></div>)}
            </div>
          </div>
          </>
           )}
        </aside>
      )}

      {/* OUTPUT MONITOR — hidden until requested */}
      {monitorOpen && (
        <>
          <div
            aria-hidden="true"
            onClick={() => setMonitorOpen(false)}
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 84,
              background: "rgba(2,6,23,.18)",
              backdropFilter: "blur(1px)",
            }}
          />

          <aside
            aria-label="Output monitor"
            style={{
              position: "absolute",
              top: 85,
              right: 16,
              bottom: 16,
              width: "min(360px, calc(100vw - 32px))",
              zIndex: 90,
              overflowY: "auto",
              padding: 14,
              borderRadius: 18,
              background: "rgba(8,15,28,.97)",
              border: "1px solid rgba(96,165,250,.18)",
              color: "white",
              boxShadow: "0 24px 70px rgba(0,0,0,.48)",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 10,
                borderBottom: "1px solid rgba(255,255,255,.08)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: 1.5,
                    textTransform: "uppercase",
                    color: "#64748b",
                  }}
                >
                  Circuit monitor
                </div>
                <div style={{ marginTop: 3, fontSize: 15, fontWeight: 700 }}>
                  Outputs & Arduino
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMonitorOpen(false)}
                aria-label="Close monitor"
                title="Close monitor"
                style={{
                  width: 32,
                  height: 32,
                  display: "grid",
                  placeItems: "center",
                  borderRadius: 9,
                  border: "1px solid rgba(255,255,255,.1)",
                  background: "rgba(255,255,255,.05)",
                  color: "#cbd5e1",
                  cursor: "pointer",
                }}
              >
                <X size={16} />
              </button>
            </div>
        {/* LCD OUTPUT */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            LCD output
          </div>
          <div
            style={{
              marginTop: 8,
              padding: "14px 16px",
              borderRadius: 12,
              background: sim.lcdPowered ? "#0b3d2e" : "#020617",
              border: "1px solid rgba(52, 211, 153, 0.25)",
              boxShadow: sim.lcdPowered
                ? "inset 0 0 24px rgba(16, 185, 129, 0.15)"
                : "none",
              minHeight: 72,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily:
                  "IBM Plex Mono, ui-monospace, monospace",
                fontSize: 15,
                letterSpacing: "0.14em",
                lineHeight: 1.55,
                color: sim.lcdPowered ? "#a7f3d0" : "#334155",
                whiteSpace: "pre",
                textShadow: sim.lcdPowered
                  ? "0 0 8px rgba(52, 211, 153, 0.35)"
                  : "none",
              }}
            >
              {(() => {
                const raw = (sim.lcdText || "").replace(/\r/g, "");
                const lines = raw.split("\n");
                const l1 = (lines[0] ?? "").padEnd(16, " ").slice(0, 16);
                const l2 = (lines[1] ?? "").padEnd(16, " ").slice(0, 16);
                return `${l1}\n${l2}`;
              })()}
            </pre>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            {sim.lcdPowered
              ? "Live characters from the HD44780 driven by your sketch."
              : "Power the supply and wire the LCD (auto-wired when you place MCU + LCD)."}
          </div>
        </div>

        {/* OLED OUTPUT */}
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            OLED output
          </div>
          <div
            style={{
              marginTop: 8,
              padding: "12px 14px",
              borderRadius: 12,
              background: sim.oledPowered ? "#020617" : "#010409",
              border: "1px solid rgba(14, 165, 233, 0.3)",
              boxShadow: sim.oledPowered
                ? "inset 0 0 20px rgba(14, 165, 233, 0.12)"
                : "none",
              minHeight: 96,
            }}
          >
            <pre
              style={{
                margin: 0,
                fontFamily: "IBM Plex Mono, ui-monospace, monospace",
                fontSize: 12,
                letterSpacing: "0.06em",
                lineHeight: 1.35,
                color: sim.oledPowered ? "#7dd3fc" : "#1e293b",
                whiteSpace: "pre",
                textShadow: sim.oledPowered
                  ? "0 0 6px rgba(56, 189, 248, 0.4)"
                  : "none",
              }}
            >
              {(() => {
                const raw = (sim.oledText || "").replace(/\r/g, "");
                const lines = raw.split("\n").slice(0, 8);
                while (lines.length < 4) lines.push("");
                return lines
                  .map((l) => (l || " ").padEnd(21, " ").slice(0, 21))
                  .join("\n");
              })()}
            </pre>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              color: "#64748b",
              lineHeight: 1.4,
            }}
          >
            {sim.oledPowered
              ? "SSD1306 text buffer from display.print / println in your sketch."
              : "Place OLED + MCU (auto-wires VCC/GND/SDA/SCL). Use Adafruit_SSD1306-style calls."}
          </div>
        </div>

        {/* ARDUINO SKETCH EDITOR */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              opacity: 0.55,
            }}
          >
            Arduino sketch
          </div>
          {(() => {
            const mcu =
              selected?.kind === "mcu"
                ? selected
                : parts.find((p) => p.kind === "mcu") ?? null;
            if (!mcu) {
              return (
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    borderRadius: 10,
                    background: "rgba(255,255,255,.04)",
                    fontSize: 12,
                    color: "#94a3b8",
                    lineHeight: 1.5,
                  }}
                >
                  Place a microcontroller on the board to edit its sketch here.
                </div>
              );
            }
            return (
              <>
                <div
                  style={{
                    marginTop: 6,
                    marginBottom: 6,
                    fontSize: 11,
                    color: "#94a3b8",
                  }}
                >
                  Editing:{" "}
                  <strong style={{ color: "#e2e8f0" }}>
                    {mcu.props.label ?? mcu.id}
                  </strong>
                  {!sim.mcuPowered && (
                    <span style={{ color: "#f59e0b" }}> · not powered</span>
                  )}
                </div>
                <textarea
                  value={mcu.props.code ?? ""}
                  onChange={(e) => {
                    setMcuCode(mcu.id, e.target.value);
                  }}
                  spellCheck={false}
                  style={{
                    flex: 1,
                    width: "100%",
                    minHeight: 220,
                    boxSizing: "border-box",
                    padding: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,.12)",
                    background: "#0b1220",
                    color: "#e2e8f0",
                    fontFamily:
                      "IBM Plex Mono, ui-monospace, monospace",
                    fontSize: 12,
                    lineHeight: 1.45,
                    resize: "vertical",
                    outline: "none",
                  }}
                />
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#64748b",
                    lineHeight: 1.4,
                  }}
                >
                  Output of{" "}
                  <code style={{ color: "#94a3b8" }}>lcd.print(...)</code>{" "}
                  appears on the LCD above and on the 3D module.
                </div>
              </>
            );
          })()}
        </div>
          </aside>
        </>
      )}

      {/* INSTRUCTIONS */}

      <div
        style={{
          position: "absolute",
          bottom: 18,
          right: instructionsRight,
          zIndex: 90,
          maxWidth: 280,
          padding: 13,
          borderRadius: 14,
          background:
            "rgba(8,15,28,.92)",
          border:
            "1px solid rgba(255,255,255,.12)",
          color: "white",
          fontSize: 11,
          lineHeight: 1.55,
          transition: "right 0.18s ease",
        }}
      >
        <strong>
          {pending.length
            ? `Pins ${pending.length}/${pinOrder.length}: ${pending.join(", ")}`
            : tool === "wire"
            ? "Wire mode"
            : tool === "select"
            ? "Select mode"
            : `${tool} mode`}
        </strong>

        <div
          style={{
            marginTop: 4,
            color: "#94a3b8",
          }}
        >
          {pending.length
            ? `Next pin: ${pinOrder[pending.length] ?? "complete the placement"}.`
            : pinOrder.length
              ? `Pin order: ${pinOrder.join(" ??? ")}.`
              : "Choose a component, then click the breadboard holes where its pins should connect."}
        </div>
      </div>

      {/* VOLTMETER */}

      {probeVoltage !== null && (
        <div
          style={{
            position: "absolute",
            top: 85,
            right: probePanelRight,
            zIndex: 95,
            padding: 14,
            borderRadius: 14,
            background:
              "rgba(8,15,28,.95)",
            border:
              "1px solid rgba(234,179,8,.35)",
            color: "white",
            transition: "right 0.18s ease",
          }}
        >
          <div
            style={{
              fontSize: 10,
              opacity: 0.55,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Probe
          </div>

          <div
            style={{
              marginTop: 4,
              fontSize: 22,
              fontFamily:
                "ui-monospace, monospace",
              color: "#fde68a",
            }}
          >
            {formatVoltage(
              probeVoltage
            )}
          </div>

          <div
            style={{
              marginTop: 6,
              fontSize: 18,
              fontFamily:
                "ui-monospace, monospace",
              color: "#7dd3fc",
            }}
          >
            {formatCurrent(
              probeCurrent ?? 0
            )}
          </div>

          <div
            style={{
              marginTop: 3,
              fontSize: 10,
              color: "#94a3b8",
            }}
          >
            Probe: {probeHole}
          </div>
          <div
            style={{
              marginTop: 2,
              fontSize: 9,
              color: "#64748b",
              lineHeight: 1.35,
            }}
          >
            V at hole · |I| on this net
          </div>
        </div>
      )}

      {/* SIMULATION WARNINGS */}

            {/* SIMULATION WARNINGS */}
      {sim.warnings.length > 0 && (
        <div
          style={{
            position: "absolute",
            right: 18,
            bottom: 18,
            zIndex: 91,
            maxWidth: 330,
            transform: "translateY(-90px)",
            padding: 12,
            borderRadius: 12,
            background: "rgba(127,29,29,.92)",
            border: "1px solid rgba(248,113,113,.35)",
            color: "#fee2e2",
            fontSize: 11,
          }}
        >
          <strong>Circuit warning</strong>

          {sim.warnings.map((warning, index) => (
            <div
              key={index}
              style={{
                marginTop: 4,
              }}
            >
              {warning}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
 