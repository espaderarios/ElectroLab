import React, { useState } from "react";
import {
  HelpCircle,
  ChevronDown,
  MousePointer2,
  Cable,
  Zap,
  RotateCcw,
  Monitor,
  AlertTriangle,
  Lightbulb,
  Search,
  Keyboard,
} from "lucide-react";

type HelpItem = {
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
};

const helpItems: HelpItem[] = [
  {
    title: "Getting Started",
    icon: <Lightbulb className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Circuit Lab lets you build and simulate electronic circuits
          interactively.
        </p>

        <ol className="list-decimal ml-5 space-y-2">
          <li>Choose a component from the component palette.</li>
          <li>Place it on the workspace.</li>
          <li>Connect its pins using jumper wires.</li>
          <li>Add a power source and ground where required.</li>
          <li>Run the simulation and observe the results.</li>
        </ol>
      </div>
    ),
  },

  {
    title: "Adding Components",
    icon: <MousePointer2 className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Select a component from the component palette to add it to the
          circuit.
        </p>

        <ul className="list-disc ml-5 space-y-2">
          <li>Resistor — limits current.</li>
          <li>LED — produces light when correctly biased.</li>
          <li>Diode — allows current primarily in one direction.</li>
          <li>Capacitor — stores electrical charge.</li>
          <li>Switch — opens or closes a circuit.</li>
          <li>Transistor — controls current electronically.</li>
          <li>Arduino — provides programmable control.</li>
          <li>LCD/OLED — displays information from a controller.</li>
        </ul>
      </div>
    ),
  },

  {
    title: "Connecting Components",
    icon: <Cable className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Use the wire tool to connect component pins.
        </p>

        <ol className="list-decimal ml-5 space-y-2">
          <li>Select the Wire tool.</li>
          <li>Click a component pin.</li>
          <li>Click the destination pin.</li>
          <li>Make sure both endpoints are attached to actual pins.</li>
        </ol>

        <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
          <p className="font-medium text-white">
            Tip
          </p>
          <p className="text-sm text-slate-400 mt-1">
            A wire that visually touches a component is not necessarily
            electrically connected. Make sure the wire endpoint snaps to the
            component pin.
          </p>
        </div>
      </div>
    ),
  },

  {
    title: "Power and Ground",
    icon: <Zap className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Most circuits require a complete electrical path.
        </p>

        <ul className="list-disc ml-5 space-y-2">
          <li>Connect the positive supply to the circuit.</li>
          <li>Connect the negative side to ground when required.</li>
          <li>Check polarity before powering components.</li>
          <li>A missing ground connection can prevent a circuit from working.</li>
        </ul>

        <p className="text-sm text-slate-400">
          Always check the voltage and polarity requirements of the component
          you are using.
        </p>
      </div>
    ),
  },

  {
    title: "Simulation",
    icon: <Monitor className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Start the simulation after completing your circuit.
        </p>

        <ul className="list-disc ml-5 space-y-2">
          <li>Observe LED brightness and component behavior.</li>
          <li>Monitor current and voltage where available.</li>
          <li>Use the Monitor to inspect connected displays and outputs.</li>
          <li>Stop the simulation before making major circuit changes.</li>
        </ul>
      </div>
    ),
  },

  {
    title: "Undo, Redo and Reset",
    icon: <RotateCcw className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Use the editing controls to safely experiment with your circuit.
        </p>

        <ul className="list-disc ml-5 space-y-2">
          <li>Undo — reverses your last change.</li>
          <li>Redo — restores an undone change.</li>
          <li>Reset — returns the circuit to its initial state.</li>
        </ul>
      </div>
    ),
  },

  {
    title: "Short Circuits and Overcurrent",
    icon: <AlertTriangle className="w-5 h-5" />,
    content: (
      <div className="space-y-3">
        <p>
          Avoid connecting power directly to ground or creating unintended
          low-resistance paths.
        </p>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
          <p className="font-medium text-amber-300">
            Warning
          </p>
          <p className="text-sm text-slate-300 mt-1">
            Excessive current can cause components to overheat or become
            damaged in the simulation.
          </p>
        </div>

        <p>
          If a component behaves unexpectedly, check the wiring, polarity,
          resistance and power connections first.
        </p>
      </div>
    ),
  },

  {
    title: "Keyboard Shortcuts",
    icon: <Keyboard className="w-5 h-5" />,
    content: (
      <div className="space-y-2">
        <div className="flex justify-between border-b border-slate-800 pb-2">
          <span>Undo</span>
          <kbd>Ctrl + Z</kbd>
        </div>

        <div className="flex justify-between border-b border-slate-800 pb-2">
          <span>Redo</span>
          <kbd>Ctrl + Y</kbd>
        </div>

        <div className="flex justify-between border-b border-slate-800 pb-2">
          <span>Delete selected</span>
          <kbd>Delete</kbd>
        </div>

        <div className="flex justify-between">
          <span>Cancel current action</span>
          <kbd>Esc</kbd>
        </div>
      </div>
    ),
  },
];

export default function CircuitLabHelp() {
  const [open, setOpen] = useState<number | null>(0);
  const [search, setSearch] = useState("");

  const filteredItems = helpItems.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-full bg-[#080d16] text-slate-200 p-6">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-blue-600/15 border border-blue-500/20 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-blue-400" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">
                Circuit Lab Help
              </h1>

              <p className="text-sm text-slate-400">
                Learn how to build, connect and simulate circuits.
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search help..."
            className="w-full h-11 rounded-xl border border-slate-800
              bg-slate-900/60 pl-11 pr-4 text-sm text-white
              outline-none focus:border-blue-500/50"
          />
        </div>

        {/* Help cards */}
        <div className="space-y-3">
          {filteredItems.map((item, index) => {
            const isOpen = open === index;

            return (
              <div
                key={item.title}
                className="rounded-xl border border-slate-800
                  bg-slate-900/40 overflow-hidden"
              >
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  className="w-full flex items-center justify-between
                    px-5 py-4 text-left hover:bg-slate-800/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-blue-400">
                      {item.icon}
                    </div>

                    <span className="font-medium text-white">
                      {item.title}
                    </span>
                  </div>

                  <ChevronDown
                    className={`w-5 h-5 text-slate-500 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {isOpen && (
                  <div className="px-5 pb-5 pt-1 text-sm text-slate-300 leading-6 border-t border-slate-800">
                    {item.content}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Empty search */}
        {filteredItems.length === 0 && (
          <div className="text-center py-16 text-slate-500">
            No help topics found.
          </div>
        )}

        {/* Footer */}
        <div className="mt-8 rounded-xl border border-blue-500/20
          bg-blue-500/5 p-5">
          <h3 className="font-semibold text-white mb-1">
            Still having trouble?
          </h3>

          <p className="text-sm text-slate-400">
            Check your component connections, power path, polarity and
            simulation state before troubleshooting individual components.
          </p>
        </div>

      </div>
    </div>
  );
}