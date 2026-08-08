import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";

/** Lower score = better match. null = no match. */
function scoreLanguageMatch(item, query) {
  const q = query.trim().toLowerCase();
  if (!q) return 0;

  const label = (item.label || item.name || "").toLowerCase();
  const name = (item.name || "").toLowerCase();
  const code = (item.code || "").toLowerCase();
  const primary = code.split("-")[0];

  // Exact language code (es → Spanish, ta → Tamil)
  if (code === q || primary === q) return 0;
  // Code prefix (es → es-AR, pt → pt-BR)
  if (code.startsWith(q) || primary.startsWith(q)) return 1;
  // Display name / label starts with query
  if (label.startsWith(q) || name.startsWith(q)) return 2;
  // Any word in the label starts with query (e.g. "united" in English (United States))
  if (label.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) return 3;
  // Substring in code (less common)
  if (code.includes(q)) return 4;
  // Substring in label/name — last resort (catches "nese" noise for "es")
  if (label.includes(q) || name.includes(q)) return 5;

  return null;
}

export default function LanguageDropdown({ options, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  const selected = options.find((item) => item.code === value);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    setTimeout(() => searchInputRef.current?.focus(), 50);

    const handleClick = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;

    return options
      .map((item, index) => ({ item, index, score: scoreLanguageMatch(item, q) }))
      .filter((row) => row.score !== null)
      .sort((a, b) => a.score - b.score || a.index - b.index)
      .map((row) => row.item);
  }, [options, search]);

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between rounded-xl border border-hairline bg-canvas px-3.5 py-2.5 font-sans text-sm text-ink outline-none transition-colors hover:border-muted focus:border-ink"
      >
        <span className="truncate">{selected ? (selected.label || selected.name) : "Select language"}</span>
        <CaretDown
          size={14}
          weight="bold"
          className={"text-muted transition-transform duration-200 shrink-0 ml-2 " + (open ? "rotate-180" : "")}
        />
      </button>

      {open && (
        <div className="lex-pop absolute left-0 right-0 top-full z-50 mt-1 flex flex-col overflow-hidden rounded-xl border border-hairline bg-white shadow-xl max-h-60">
          <div className="flex items-center border-b border-hairline bg-hairline/20 px-3 py-2">
            <MagnifyingGlass size={14} className="text-muted shrink-0 mr-2" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search languages..."
              className="w-full bg-transparent font-sans text-xs text-ink outline-none placeholder:text-muted"
            />
          </div>
          <ul className="lex-scroll min-h-0 flex-1 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <li className="px-4 py-2.5 font-sans text-xs text-muted text-center">
                No matching languages
              </li>
            ) : (
              filteredOptions.map((item) => {
                const active = item.code === value;
                return (
                  <li key={item.code}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(item.code);
                        setOpen(false);
                      }}
                      className={
                        "flex w-full items-center justify-between px-3.5 py-2 text-left font-sans text-xs transition-colors " +
                        (active
                          ? "bg-hairline/60 font-semibold text-ink"
                          : "text-ink hover:bg-hairline/40")
                      }
                    >
                      <span>{item.label || item.name}</span>
                      <span className="font-mono text-[10px] text-muted ml-2">{item.code}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
