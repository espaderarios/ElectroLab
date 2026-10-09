import { useMemo, useState } from "react";
import { Book, ChevronLeft, ChevronRight, Eye, Layers, RotateCcw, Search, X } from "lucide-react";
import { BUILTIN_FLASHCARDS } from "@/flashcards/builtin-flashcards";

type Deck = (typeof BUILTIN_FLASHCARDS)[number];
type CardPair = [string, string];

type Mode = "list" | "study" | "view";

function normalizeCards(cards: Deck["cards"]): CardPair[] {
  return cards.map((c) => {
    if (Array.isArray(c) && c.length >= 2) {
      return [String(c[0]), String(c[1])] as CardPair;
    }
    return [String(c), ""] as CardPair;
  });
}

export function BuiltInFlashcardsPage() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("list");
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return BUILTIN_FLASHCARDS;
    return BUILTIN_FLASHCARDS.filter((deck) =>
      `${deck.title} ${deck.subject} ${deck.description}`
        .toLowerCase()
        .includes(needle),
    );
  }, [query]);

  const cards = activeDeck ? normalizeCards(activeDeck.cards) : [];

  function openStudy(deck: Deck) {
    setActiveDeck(deck);
    setCardIndex(0);
    setFlipped(false);
    setMode("study");
  }

  function openView(deck: Deck) {
    setActiveDeck(deck);
    setMode("view");
  }

  function backToList() {
    setMode("list");
    setActiveDeck(null);
    setCardIndex(0);
    setFlipped(false);
  }

  function nextCard() {
    if (!cards.length) return;
    setFlipped(false);
    setCardIndex((i) => (i + 1) % cards.length);
  }

  function prevCard() {
    if (!cards.length) return;
    setFlipped(false);
    setCardIndex((i) => (i - 1 + cards.length) % cards.length);
  }

  if (mode === "study" && activeDeck) {
    const [front, back] = cards[cardIndex] ?? ["", ""];
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold truncate">{activeDeck.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {activeDeck.subject} · Card {cardIndex + 1} of {cards.length}
            </p>
          </div>
        </div>

        <div className="max-w-xl mx-auto">
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full min-h-[220px] rounded-2xl border border-[#1e293b] bg-[#111827] p-8 text-left shadow-lg hover:border-blue-500/40 transition flex flex-col justify-center"
          >
            <div className="text-xs uppercase tracking-wide text-slate-500 mb-3">
              {flipped ? "Answer" : "Question"} · click to flip
            </div>
            <p className="text-lg font-medium text-slate-100 leading-relaxed">
              {flipped ? back : front}
            </p>
          </button>

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={prevCard}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e293b] text-sm text-slate-300 hover:bg-[#1e293b]/50 transition"
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <button
              type="button"
              onClick={() => setFlipped(false)}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[#1e293b] text-sm text-slate-400 hover:bg-[#1e293b]/50 transition"
              title="Reset flip"
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={nextCard}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition"
            >
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "view" && activeDeck) {
    return (
      <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
        <div className="mb-5 flex items-center gap-3">
          <button
            type="button"
            onClick={backToList}
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition"
          >
            <ChevronLeft size={16} /> Back
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold truncate">{activeDeck.title}</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {activeDeck.subject} · {cards.length} {cards.length === 1 ? "card" : "cards"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openStudy(activeDeck)}
            className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
          >
            <Layers size={14} /> Study
          </button>
        </div>

        <div className="space-y-2 max-w-3xl">
          {cards.map(([q, a], i) => (
            <div
              key={i}
              className="rounded-xl border border-[#1e293b] bg-[#111827] p-4"
            >
              <div className="text-xs text-slate-500 mb-1">Card {i + 1}</div>
              <div className="text-sm font-medium text-slate-100">{q}</div>
              <div className="text-sm text-slate-400 mt-1.5 border-t border-[#1e293b] pt-1.5">
                {a}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold">Built-in Flashcards</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Study decks for research, management, technopreneurship, and more.
        </p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search
          size={14}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search decks…"
          className="w-full rounded-lg border border-[#1e293b] bg-[var(--app-border)] pl-8 pr-8 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#1e293b] p-10 text-center text-sm text-slate-500">
          No decks match “{query}”.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((deck) => {
            const count = deck.cards.length;
            return (
              <div
                key={deck.id}
                className="bg-[#111827] border border-[#1e293b] rounded-xl p-4 flex flex-col"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/15 text-blue-400 flex items-center justify-center shrink-0">
                    <Book size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="inline-flex items-center rounded-md bg-blue-500/10 text-blue-400 text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 mb-1">
                      Built-in
                    </div>
                    <div className="text-sm font-semibold text-slate-100 truncate">
                      {deck.title}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {deck.subject}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-slate-400 mt-3 flex-1 line-clamp-3">
                  {deck.description}
                </p>

                <div className="text-xs text-slate-500 mt-3">
                  {count} {count === 1 ? "card" : "cards"}
                </div>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openStudy(deck)}
                    className="flex-1 inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                  >
                    <Layers size={14} /> Study
                  </button>
                  <button
                    type="button"
                    onClick={() => openView(deck)}
                    className="inline-flex items-center justify-center gap-2 border border-[#1e293b] hover:bg-[#1e293b]/50 text-slate-300 text-sm font-medium px-3 py-2 rounded-lg transition"
                  >
                    <Eye size={14} /> View
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
