import { useEffect, useRef, useState } from "react";
import { X } from "@phosphor-icons/react";
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
  { action: "Close Settings", keys: ["Esc"] },
  { action: "Toggle Settings", keys: ["Ctrl", ","] },
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
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/20 px-4 pt-24"
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
            "scrollbar-none flex-1 overflow-y-auto px-6 py-6 pr-2 " +
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
            <div className="mt-3 flex overflow-hidden rounded border border-hairline">
              {FONT_SIZES.map((size, i) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onFontSizeChange(size)}
                  className={
                    "flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                    (i > 0 ? "border-l border-hairline " : "") +
                    (fontSize === size
                      ? "bg-pale-blue text-ink"
                      : "bg-canvas text-muted hover:text-ink")
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
                concentration.
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
            <div className="mt-3 flex overflow-hidden rounded border border-hairline">
              {LINE_SPACINGS.map((option, i) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => onLineSpacingChange(option.value)}
                  className={
                    "flex flex-1 items-center justify-center py-2 font-mono text-xs uppercase leading-none tracking-widest transition-colors " +
                    (i > 0 ? "border-l border-hairline " : "") +
                    (lineSpacing === option.value
                      ? "bg-pale-blue text-ink"
                      : "bg-canvas text-muted hover:text-ink")
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6">
            <p className="font-mono text-xs uppercase tracking-widest text-muted">
              Keyboard Shortcuts
            </p>
            <div className="mt-3">
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
  );
}
