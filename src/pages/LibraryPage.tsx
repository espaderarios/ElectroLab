import { useMemo, useState } from "react";
import { BookOpen, ExternalLink, FileText, Search, X } from "lucide-react";
import { LIBRARY_BOOKS, type LibraryBook } from "../data/library-books";

const YEARS = ["All Years", "1st Year", "2nd Year", "3rd Year", "4th Year"];

function driveFileId(url: string) {
  const match = url.match(/\/file\/d\/([^/]+)/);
  return match?.[1] ?? null;
}

function drivePreviewUrl(book: LibraryBook) {
  const id = driveFileId(book.driveUrl);
  return id ? `https://drive.google.com/file/d/${id}/preview` : book.driveUrl;
}

function driveThumbnailUrl(book: LibraryBook, size = 220) {
  const id = driveFileId(book.driveUrl);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}

function BookThumbnail({ book }: { book: LibraryBook }) {
  const [failed, setFailed] = useState(false);
  const src = driveThumbnailUrl(book);

  if (!src || failed) {
    return (
      <div className="w-14 h-[4.5rem] shrink-0 rounded-lg bg-gradient-to-br from-blue-600/15 to-slate-800/80 border border-blue-500/20 flex items-center justify-center text-blue-400/90">
        <FileText size={22} strokeWidth={1.6} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className="w-14 h-[4.5rem] shrink-0 rounded-lg object-cover border border-[#1e293b] bg-[#0b1220] shadow-sm"
      onError={() => setFailed(true)}
      loading="lazy"
    />
  );
}

export function LibraryPage() {
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("All Subjects");
  const [year, setYear] = useState("All Years");
  const [selected, setSelected] = useState<LibraryBook | null>(null);

  const folders = useMemo(
    () => ["All Subjects", ...Array.from(new Set(LIBRARY_BOOKS.map((b) => b.folder))).sort()],
    [],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return LIBRARY_BOOKS.filter((book) => {
      if (folder !== "All Subjects" && book.folder !== folder) return false;
      if (year !== "All Years" && !book.yearLevel.includes(year)) return false;
      if (!needle) return true;
      return `${book.title} ${book.folder} ${book.yearLevel.join(" ")}`
        .toLowerCase()
        .includes(needle);
    });
  }, [folder, query, year]);

  const grouped = useMemo(() => {
    const groups = new Map<string, LibraryBook[]>();
    for (const book of filtered) {
      const list = groups.get(book.folder) ?? [];
      list.push(book);
      groups.set(book.folder, list);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const hasFilters = query || folder !== "All Subjects" || year !== "All Years";

  return (
    <div className="flex-1 min-w-0 overflow-y-auto scrollbar-thin bg-[#0a0f1a]">
      <div className="max-w-[1500px] mx-auto p-5 sm:p-6 lg:p-8">
        {/* Header */}
        <header className="mb-7">
          <div className="inline-flex items-center gap-2 text-blue-400 text-sm font-medium mb-2">
            <BookOpen size={16} />
            Academic Library
          </div>
          <h1 className="text-2xl sm:text-[1.65rem] font-semibold tracking-tight">
            Engineering Library
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 max-w-xl">
            Browse your Google Drive PDF collection by subject and year level.
          </p>
        </header>

        <div className="flex gap-6 flex-col lg:flex-row">
          {/* Sidebar */}
          <aside className="w-full lg:w-52 flex-shrink-0">
            <div className="lg:sticky lg:top-6 space-y-1">
              <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase px-3 mb-2">
                Subjects
              </div>
              <div className="space-y-0.5 max-h-[min(55vh,420px)] overflow-y-auto scrollbar-thin pr-1">
                {folders.map((item) => {
                  const count =
                    item === "All Subjects"
                      ? LIBRARY_BOOKS.length
                      : LIBRARY_BOOKS.filter((b) => b.folder === item).length;
                  const active = folder === item;

                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setFolder(item)}
                      className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                        active
                          ? "bg-blue-600/20 text-blue-300"
                          : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                      }`}
                    >
                      <span className="flex-1 truncate">{item}</span>
                      <span
                        className={`text-[11px] tabular-nums ${
                          active ? "text-blue-400/70" : "text-slate-600"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>

          {/* Main */}
          <main className="flex-1 min-w-0">
            {/* Search + year */}
            <div className="flex flex-col sm:flex-row gap-3 mb-5">
              <div className="relative flex-1">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search books, subjects…"
                  className="w-full h-11 pl-10 pr-4 rounded-xl bg-[#0f172a] border border-[#1e293b] text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition"
                />
              </div>
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="h-11 rounded-xl bg-[#0f172a] border border-[#1e293b] px-4 text-sm text-slate-300 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition sm:w-40"
              >
                {YEARS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            {/* Meta row */}
            <div className="flex items-center justify-between gap-3 mb-4 min-h-[1.25rem]">
              <p className="text-xs text-slate-500">
                <span className="text-slate-400 tabular-nums">{filtered.length}</span>
                {filtered.length === 1 ? " book" : " books"}
                {folder !== "All Subjects" && (
                  <span className="text-slate-600"> · {folder}</span>
                )}
              </p>
              {hasFilters && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFolder("All Subjects");
                    setYear("All Years");
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </div>

            {/* Empty / list */}
            {grouped.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#334155] bg-[#0f172a]/40 p-14 text-center">
                <div className="mx-auto w-12 h-12 rounded-xl bg-slate-800/80 flex items-center justify-center mb-4">
                  <FileText className="text-slate-500" size={24} strokeWidth={1.5} />
                </div>
                <p className="text-sm font-medium text-slate-300">No books found</p>
                <p className="text-xs text-slate-600 mt-1.5">
                  Try another subject, year, or search term.
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {grouped.map(([subject, books]) => (
                  <section key={subject}>
                    <div className="flex items-center gap-3 mb-3.5">
                      <h2 className="text-sm font-semibold text-slate-200">{subject}</h2>
                      <span className="text-[11px] text-slate-600 tabular-nums">
                        {books.length}
                      </span>
                      <div className="h-px bg-[#1e293b] flex-1" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
                      {books.map((book) => (
                        <article
                          key={`${book.folder}-${book.title}-${book.driveUrl}`}
                          className="group rounded-xl border border-[#1e293b] bg-[#0f172a] p-4 hover:border-blue-500/35 hover:bg-[#111b2d] transition-all duration-150"
                        >
                          <div className="flex gap-3.5">
                            <BookThumbnail book={book} />
                            <div className="min-w-0 flex-1 pt-0.5">
                              <h3
                                className="text-sm font-medium leading-snug text-slate-100 line-clamp-3"
                                title={book.title}
                              >
                                {book.title.replace(/\.pdf$/i, "")}
                              </h3>
                              <div className="flex flex-wrap gap-1.5 mt-2.5">
                                {book.yearLevel.map((item) => (
                                  <span
                                    key={item}
                                    className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800/90 text-white border border-slate-700/50"
                                  >
                                    {item}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelected(book)}
                              className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-500 active:bg-blue-600 text-white text-xs font-medium transition-colors"
                            >
                              Read PDF
                            </button>
                            <a
                              href={book.driveUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="h-9 w-9 rounded-lg border border-[#334155] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 hover:border-slate-600 transition-colors"
                              title="Open in Google Drive"
                            >
                              <ExternalLink size={14} />
                            </a>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>

      {/* Reader modal */}
      {selected && (
        <div
          className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full h-full max-w-[1400px] max-h-[92vh] bg-[#0b1220] border border-[#263449] rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="h-14 shrink-0 px-4 flex items-center gap-3 border-b border-[#1e293b]">
              <div className="w-8 h-8 rounded-lg bg-blue-600/15 flex items-center justify-center shrink-0">
                <FileText size={15} className="text-blue-400" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-slate-100 truncate">
                  {selected.title.replace(/\.pdf$/i, "")}
                </div>
                <div className="text-[11px] text-slate-500 truncate">
                  {selected.folder} · {selected.yearLevel.join(" · ")}
                </div>
              </div>
              <a
                href={selected.driveUrl}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 px-3 py-2 rounded-lg hover:bg-blue-500/10 transition-colors"
              >
                Open in Drive
                <ExternalLink size={12} />
              </a>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close reader"
              >
                <X size={17} />
              </button>
            </header>
            <div className="flex-1 min-h-0 bg-[#050a12]">
              <iframe
                title={selected.title}
                src={drivePreviewUrl(selected)}
                className="w-full h-full border-0"
                allow="autoplay"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}