import { forwardRef } from "react";
import { useEffect, useRef, useState } from "react";
import { X, CaretDown, ArrowCounterClockwise, IconBase } from "@phosphor-icons/react";
import LanguageDropdown from "./LanguageDropdown.jsx";
import Toggle from "./Toggle.jsx";
import ModelManager from "./ModelManager.jsx";
import { setAiPreference } from "./api.js";

// GitHub mark (official Phosphor `github-logo` artwork). It isn't bundled in
// @phosphor-icons/react@2.1.10, so we register it locally via Phosphor's
// IconBase + weight→path map — same `size`/`weight`/`color` props as the rest.
const githubWeights = new Map([
  ["thin", <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />],
  ["light", <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />],
  ["regular", <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />],
  ["bold", <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />],
  ["fill", <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />],
  [
    "duotone",
    <>
      <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" opacity="0.2" />
      <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24A40,40,0,0,0,8,136a8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.83a43.81,43.81,0,0,1,.79-33.58,43.88,43.88,0,0,1,32.32,20.06A8,8,0,0,0,119.82,64h32.35a8,8,0,0,0,6.74-3.69,43.87,43.87,0,0,1,32.32-20.06A43.81,43.81,0,0,1,192,73.83a8.09,8.09,0,0,0,1,7.65A41.72,41.72,0,0,1,200,104Z" />
    </>,
  ],
]);

const GithubLogo = forwardRef((props, ref) => (
  <IconBase ref={ref} {...props} weights={githubWeights} />
));

GithubLogo.displayName = "GithubLogo";

const GITHUB_URL = "https://github.com/AashishH15/Lexicon";

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

// Smart defaults for every user-tweakable setting. Centralized here so the
// loaders in App.jsx and the "Reset to Default" action agree on one source.
export const SETTINGS_DEFAULTS = {
  language: "en-US",
  fontSize: 16,
  focusMode: false,
  lineSpacing: 1.6,
};

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const mod = isMac ? "⌘" : "Ctrl";

const SHORTCUTS = [
  { action: "Open command menu", keys: ["type /"] },
  { action: "Trigger Proofread", keys: [mod, "Enter"] },
  { action: "Accept Suggestion", keys: ["Ctrl", "Alt", "A"] },
  { action: "Dismiss Suggestion", keys: ["Ctrl", "Alt", "D"] },
  { action: "Toggle Settings", keys: [mod, ","] },
  { action: "Close Settings", keys: ["Esc"] },
  { action: "Bold", keys: [mod, "B"] },
  { action: "Italic", keys: [mod, "I"] },
  { action: "Underline", keys: [mod, "U"] },
  { action: "Strikethrough", keys: [mod, "Shift", "S"] },
  { action: "Highlight", keys: [mod, "Shift", "H"] },
  { action: "Inline code", keys: [mod, "E"] },
  { action: "Align left", keys: [mod, "Shift", "L"] },
  { action: "Align center", keys: [mod, "Shift", "E"] },
  { action: "Align right", keys: [mod, "Shift", "R"] },
  { action: "Align justify", keys: [mod, "Shift", "J"] },
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
  onResetDefaults,
  onCheckForUpdates,
  updateState,
  onClose,
}) {
  if (!open) {
    return null;
  }

  const scrollRef = useRef(null);
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

  // True when every tweakable setting already matches the smart defaults, so
  // the Reset button can be disabled (nothing to reset).
  const isDefault =
    language === SETTINGS_DEFAULTS.language &&
    fontSize === SETTINGS_DEFAULTS.fontSize &&
    focusMode === SETTINGS_DEFAULTS.focusMode &&
    lineSpacing === SETTINGS_DEFAULTS.lineSpacing;
  const updateBusy = ["checking", "installing"].includes(updateState?.status);
  const updateButtonLabel =
    updateState?.status === "checking"
      ? "Checking…"
      : updateState?.status === "installing"
        ? "Installing…"
        : "Check for updates";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    // Keep the scroll container scrolled to the top when the panel opens.
    el.scrollTop = 0;
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onClick={onClose}
    >
      <div
        className="flex h-[646px] max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-hairline bg-white lex-card-enter"
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
          className="lex-scroll min-h-0 flex-1 overflow-y-auto pl-6 pr-6 py-6"
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

          <div className="mt-6 flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                Focus Mode
              </p>
              <p className="mt-1 font-sans text-xs text-muted">
                Collapses both side panels for a distraction-free writing view.
                Hover a screen-edge rail to peek a panel open; it auto-closes
                when you move away.
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

          {/* AI Model — management surface shared with the onboarding modal.
              Selecting a tier or Ollama here persists the choice server-side
              (survives restart) and drives which backend the editor uses. */}
          <div className="mt-8 border-t border-hairline pt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              AI Model
            </p>
            <p className="mt-1 font-sans text-xs text-muted">
              Runs entirely on your device. Download a local model or use your
              own Ollama server. Your selection is saved and used until changed.
            </p>
            <div className="mt-3">
              <ModelManager
                mode="settings"
                onPreferenceChange={(pref) => {
                  setAiPreference(pref.backend, pref.model_key).catch(() => {});
                }}
                onConfigured={() => window.dispatchEvent(new CustomEvent("lexicon:ai-configured"))}
              />
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

          <div className="mt-8 border-t border-hairline pt-5">
            <button
              type="button"
              onClick={onResetDefaults}
              disabled={isDefault}
              className="flex w-full items-center justify-center gap-2 rounded border border-hairline bg-canvas py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-hairline"
            >
              <ArrowCounterClockwise size={16} weight="bold" />
              Reset to Default
            </button>
            <p className="mt-2 text-center font-sans text-[11px] text-muted">
              Restores language, font size, focus mode, and line spacing.
            </p>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 flex w-full items-center justify-center gap-2 rounded border border-hairline py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted hover:bg-hairline/40"
            >
              <GithubLogo size={16} weight="bold" />
              View source on GitHub
            </a>
          </div>

          <div className="mt-8 border-t border-hairline pt-6">
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
              Updates
            </p>
            <p className="mt-1 font-sans text-xs text-muted">
              Lexicon checks for new releases and lets you install them without
              returning to GitHub.
            </p>
            <button
              type="button"
              onClick={onCheckForUpdates}
              disabled={updateBusy}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded border border-hairline bg-canvas py-2.5 font-sans text-sm font-medium text-ink transition-colors hover:border-muted disabled:cursor-wait disabled:opacity-60 disabled:hover:border-hairline"
            >
              <ArrowCounterClockwise
                size={16}
                weight="bold"
                className={updateBusy ? "animate-spin" : ""}
              />
              {updateButtonLabel}
            </button>
            {updateState?.message && (
              <p
                className={
                  "mt-2 text-center font-sans text-[11px] " +
                  (updateState.status === "error" ? "text-red-600" : "text-muted")
                }
              >
                {updateState.message}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
