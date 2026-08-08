import { useEffect, useRef, useState } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";

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

  const filteredOptions = options.filter((item) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const name = (item.label || item.name || "").toLowerCase();
    const code = (item.code || "").toLowerCase();
    return name.includes(q) || code.includes(q);
  });

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
