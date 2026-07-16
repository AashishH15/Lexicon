import { useEffect, useRef, useState } from "react";
import { X, CaretDown } from "@phosphor-icons/react";
import LanguageDropdown from "./LanguageDropdown.jsx";
import Toggle from "./Toggle.jsx";

export const LANGUAGES = [
  { code: "en-US", label: "English (United States)" },
  { code: "en-GB", label: "English (United Kingdom)" },
  { code: "en-CA", label: "English (Canada)" },
  { code: "en-AU", label: "English (Australia)" },
  { code: "en-NZ", label: "English (New Zealand)" },
  { code: "en-ZA", label: "English (South Africa)" },
];

export const FONT_SIZES = [14, 16, 18];

export const LINE_SPACINGS = [
  { value: 1.6, label: "Standard" },
  { value: 1.8, label: "Comfortable" },
];

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "Cmd" : "Ctrl";

const SHORTCUTS = [
  { action: "Trigger Proofread", keys: [mod, "Enter"] },
  { action: "Accept Suggestion", keys: ["Ctrl", "Alt", "A"] },
  { action: "Dismiss Suggestion", keys: ["Ctrl", "Alt", "D"] },
  { action: "Toggle Settings", keys: [mod, ","] },
  { action: "Close Settings", keys: ["Esc"] },
  { action: "Bold", keys: [mod, "B"] },
  { action: "Italic", keys: [mod, "I"] },
  { action: "Underline", keys: [mod, "U"] },
  { action: "Strikethrough", keys: [mod, "Shift", "S"] },
  { action: "Heading 1", keys: [mod, "Alt", "1"] },
  { action: "Heading 2", keys: [mod, "Alt", "2"] },
  { action: "Heading 3", keys: [mod, "Alt", "3"] },
  { action: "Heading 4", keys: [mod, "Alt", "4"] },
  { action: "Heading 5", keys: [mod, "Alt", "5"] },
  { action: "Heading 6", keys: [mod, "Alt", "6"] },
  { action: "Undo", keys: [mod, "Z"] },
  { action: "Redo", keys: [mod, "Shift", "Z"] },
  { action: "Indent list item", keys: ["Tab"] },
  { action: "Outdent list item", keys: ["Shift", "Tab"] },
];

export default function Settings({
  open,
  language,
  onLanguageChange,
  fontSize,
  onFontSizeChange,
  lineSpacing,
  onLineSpacingChange,
  focusMode,
  onFocusModeChange,
  onClose,
}) {
  if (!open) {
    return null;
  }

  const scrollRef = useRef(null);
  const [overflowing, setOverflowing] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(() => {
    const saved = localStorage.getItem("lexicon:shortcutsOpen");
    return saved === null ? false : saved === "true";
  });

  function toggleShortcuts() {
    setShortcutsOpen((current) => {
      const next = !current;
      localStorage.setItem("lexicon:shortcutsOpen", String(next));
      return next;
    });
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const check = () => setOverflowing(el.scrollHeight > el.clientHeight);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-hairline bg-white lex-card-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            Settings
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-transform duration-200 hover:scale-110 hover:text-ink"
            aria-label="Close settings"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div
          ref={scrollRef}
          className={
            "scrollbar-none flex-1 overflow-y-auto pl-6 pr-6 py-6 " +
            (overflowing ? "lex-fade-scroll" : "")
          }
        >
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Language
            </p>
            <p className="mt-1 font-sans text-xs text-muted">
              Sets the spelling and grammar rules used when proofreading.
            </p>
            <div className="mt-3">
              <LanguageDropdown
                options={LANGUAGES}
                value={language}
                onChange={onLanguageChange}
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Font Size
            </p>
            <p className="mt-1 font-sans text-xs text-muted">
              Scales the text in the editor for comfortable reading.
            </p>
            <div className="relative isolate mt-3 flex overflow-hidden rounded border border-hairline bg-canvas">
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-pale-blue transition-transform duration-200 ease-out"
                style={{
                  width: `${100 / FONT_SIZES.length}%`,
                  transform: `translateX(${FONT_SIZES.indexOf(fontSize) * 100}%)`,
                }}
              />
              {FONT_SIZES.map((size, i) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onFontSizeChange(size)}
                  className={
                    "relative z-10 flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                    (i > 0 ? "border-l border-hairline " : "") +
                    (fontSize === size
                      ? "text-ink"
                      : "bg-transparent text-muted hover:text-ink")
                  }
                >
                  {size}px
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Focus Mode
              </p>
              <p className="mt-1 font-sans text-xs text-muted">
                Fades the interface layout while typing to maximize core writing
                concentration. Disabled automatically whenever a tool is active
                (Proofread, Rewrite, etc.), since both side panels are then in
                use.
              </p>
            </div>
            <div className="pt-0.5">
              <Toggle
                checked={focusMode}
                onChange={onFocusModeChange}
                label="Toggle focus mode"
              />
            </div>
          </div>

          <div className="mt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Line Spacing
            </p>
            <p className="mt-1 font-sans text-xs text-muted">
              Adjust text row height for layout readability.
            </p>
            <div className="relative isolate mt-3 flex overflow-hidden rounded border border-hairline bg-canvas">
              <span
                className="pointer-events-none absolute inset-y-0 left-0 bg-pale-blue transition-transform duration-200 ease-out"
                style={{
                  width: `${100 / LINE_SPACINGS.length}%`,
                  transform: `translateX(${LINE_SPACINGS.findIndex((o) => o.value === lineSpacing) * 100}%)`,
                }}
              />
              {LINE_SPACINGS.map((option, i) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onLineSpacingChange(option.value)}
                  className={
                    "relative z-10 flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                    (i > 0 ? "border-l border-hairline " : "") +
                    (lineSpacing === option.value
                      ? "text-ink"
                      : "bg-transparent text-muted hover:text-ink")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <button
              type="button"
              onClick={toggleShortcuts}
              aria-expanded={shortcutsOpen}
              className="flex w-full items-center justify-between font-mono text-xs uppercase tracking-widest text-muted transition-colors hover:text-ink"
            >
              <span>Keyboard Shortcuts</span>
              <CaretDown
                size={14}
                weight="bold"
                className={"transition-transform duration-300 ease-out " + (shortcutsOpen ? "rotate-180" : "")}
              />
            </button>
            <div
              className={
                "grid transition-all duration-300 ease-out " +
                (shortcutsOpen ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
              }
            >
              <div className="overflow-hidden">
                {SHORTCUTS.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between border-b border-hairline py-2.5 last:border-b-0"
                  >
                    <span className="font-mono text-xs text-ink">{shortcut.action}</span>
                    <span className="flex items-center gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={key} className="flex items-center gap-1">
                          {i > 0 && <span className="text-[10px] text-muted">+</span>}
                          <kbd className="lex-kbd">{key}</kbd>
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
