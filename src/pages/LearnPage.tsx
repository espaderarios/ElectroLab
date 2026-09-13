import { useNavigate } from "react-router-dom";
import { BookOpen, Play } from "lucide-react";

const lessons = [
  {
    id: "led-blink",
    title: "LED Blink Basics",
    level: "Beginner",
    minutes: 10,
    summary: "Wire an LED with a series resistor and control it with a switch.",
  },
  {
    id: "rc-lpf",
    title: "RC Low-Pass Filter",
    level: "Beginner",
    minutes: 15,
    summary: "See how R and C form a simple frequency-dependent divider.",
  },
  {
    id: "dc-motor",
    title: "DC Motor + SCR Latch",
    level: "Intermediate",
    minutes: 25,
    summary:
      "Trigger an SCR with a gate pulse and keep a motor running via holding current.",
  },
  {
    id: "battery",
    title: "Voltage Limits & Warnings",
    level: "Intermediate",
    minutes: 20,
    summary: "Explore supply ratings and what the simulator flags as warnings.",
  },
];

export function LearnPage() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Learn</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Guided labs that open in the 3D breadboard editor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lessons.map((lesson) => (
          <div
            key={lesson.id}
            className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 flex flex-col"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center">
                <BookOpen size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">
                  {lesson.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {lesson.level} · ~{lesson.minutes} min
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-400 mt-3 flex-1">{lesson.summary}</p>
            <button
              type="button"
              onClick={() => navigate(`/editor/${lesson.id}`)}
              className="mt-4 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
            >
              <Play size={14} /> Open lab
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
