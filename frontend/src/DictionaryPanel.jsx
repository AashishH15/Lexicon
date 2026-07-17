import { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash, BookBookmark, MagnifyingGlass } from "@phosphor-icons/react";

export default function DictionaryPanel({
  open,
  userDictionary,
  onAddWord,
  onRemoveWord,
  onClose,
}) {
  const [newWord, setNewWord] = useState("");
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setNewWord("");
    setQuery("");
    setNotice("");
    // Focus the add-word input when the panel opens.
    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const visibleWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return userDictionary;
    }
    return userDictionary.filter((w) => w.toLowerCase().includes(q));
  }, [userDictionary, query]);

  if (!open) {
    return null;
  }

  function submitWord() {
    const word = newWord.trim();
    if (!word) {
      return;
    }
    const result = onAddWord(word);
    if (result === "duplicate") {
      setNotice(`"${word}" is already in your dictionary.`);
    } else {
      setNotice("");
    }
    setNewWord("");
    inputRef.current?.focus();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-xl border border-hairline bg-white lex-card-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Your Dictionary
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-transform duration-200 hover:scale-110 hover:text-ink"
            aria-label="Close dictionary"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="flex flex-col gap-3 border-b border-hairline px-5 py-3">
          <p className="font-sans text-xs text-muted">
            Words you add are ignored by proofreading. Add or remove words
            below; changes apply to the next check.
          </p>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newWord}
              onChange={(event) => {
                setNewWord(event.target.value);
                if (notice) {
                  setNotice("");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitWord();
                }
              }}
              placeholder="Add a word…"
              className="min-w-0 flex-1 rounded border border-hairline bg-canvas px-3 py-2 font-sans text-sm text-ink outline-none focus:border-muted"
            />
            <button
              type="button"
              onClick={submitWord}
              aria-label="Add word to dictionary"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-hairline bg-canvas text-muted transition-colors hover:border-muted hover:text-ink"
            >
              <Plus size={16} weight="bold" />
            </button>
          </div>
          {notice && (
            <p className="mt-2 font-sans text-xs text-muted">{notice}</p>
          )}
        </div>

        <div className="lex-scroll max-h-72 overflow-y-auto px-5 py-3">
          {userDictionary.length === 0 ? (
            <p className="font-sans text-sm text-muted">No words added yet.</p>
          ) : (
            <>
              <div className="relative">
                <MagnifyingGlass
                  size={14}
                  weight="bold"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Filter words…"
                  className="w-full rounded border border-hairline bg-canvas py-2 pl-8 pr-3 font-sans text-sm text-ink outline-none focus:border-muted"
                />
              </div>

              <ul className="mt-3 flex flex-col gap-1">
                {visibleWords.length === 0 ? (
                  <li className="font-sans text-sm text-muted">No matches.</li>
                ) : (
                  visibleWords.map((word) => (
                    <li
                      key={word}
                      className="flex items-center justify-between gap-2 rounded border border-hairline bg-canvas px-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <BookBookmark size={14} weight="bold" className="shrink-0 text-muted" />
                        <span className="truncate font-sans text-sm text-ink">{word}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveWord(word)}
                        aria-label={`Remove ${word} from dictionary`}
                        className="shrink-0 rounded p-1 text-muted transition-colors hover:text-red-600"
                      >
                        <Trash size={15} weight="bold" />
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
