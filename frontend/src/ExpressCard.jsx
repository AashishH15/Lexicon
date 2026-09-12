import { useEffect, useRef, useState } from "react";
import {
  Briefcase,
  Check,
  Coffee,
  Copy,
  Lightning,
  Scroll,
  Smiley,
  Translate,
  X,
} from "@phosphor-icons/react";
import { EXPRESS_TONES } from "./expressParser.js";
import { EXPRESS_MAX_CHARS } from "./useExpress.js";

// Tone look and hint. Keep hints short. Use plain words.
const TONE_META = {
  auto: { label: "Auto", icon: Translate, hint: "Faithful to the original" },
  professional: { label: "Professional", icon: Briefcase, hint: "Polished for work" },
  casual: { label: "Casual", icon: Coffee, hint: "Relaxed, like a text" },
  friendly: { label: "Friendly", icon: Smiley, hint: "Warm and kind" },
  formal: { label: "Formal", icon: Scroll, hint: "Correct and reserved" },
  concise: { label: "Concise", icon: Lightning, hint: "Short and direct" },
};

// Message copy. Keep each string free of em dashes.
const OVER_LIMIT_NOTE = "Please select a sentence or short paragraph.";
const NEEDS_MODEL_NOTE = "Express in English needs Standard or Quality.";
const LOADING_COPY = "Phrasing in English...";
const COPY_RESET_MS = 1200;

// Card for Express in English. Dock it in the right panel.
// Show tone tabs, the active text, and Replace and Copy actions.
// Use Phosphor icons only. Use theme surfaces only.
export default function ExpressCard({
  detectedLanguage = "Unknown",
  tones = null,
  activeTone = "auto",
  onToneChange,
  status = "idle",
  error = "",
  hasSelection = true,
  isOverLimit = false,
  isModelAllowed = true,
  onReplace,
  onCopy,
  onRun,
  onDismiss,
}) {
  const [input, setInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [pickedTone, setPickedTone] = useState(null);
  const copyTimer = useRef(null);

  // Dismiss on Escape. Clean up the listener on unmount.
  useEffect(() => {
    function handleKey(event) {
      if (event.key === "Escape" && typeof onDismiss === "function") {
        onDismiss();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onDismiss]);

  // Clear the copy timer on unmount.
  useEffect(() => {
    return () => {
      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }
    };
  }, []);

  const displayTone = pickedTone || activeTone;
  const activeText =
    tones && typeof tones === "object" ? tones[displayTone] || "" : "";
  const hasResult = Boolean(activeText);
  const isLoading = status === "warming" || status === "working";
  const isError = status === "error";
  // Keep chips quiet until the user picks a tone or a run is underway.
  const toneChosen = Boolean(pickedTone) || hasResult || isLoading;
  const awaitingTonePick = !toneChosen;
  const showBadge =
    typeof detectedLanguage === "string" &&
    detectedLanguage.trim() !== "" &&
    detectedLanguage !== "Unknown";
  const activeHint =
    !awaitingTonePick && TONE_META[displayTone]
      ? TONE_META[displayTone].hint
      : "";
  const inputOverLimit = !hasSelection && input.length > EXPRESS_MAX_CHARS;
  const showOverLimit = isOverLimit || inputOverLimit;
  const runDisabled =
    isOverLimit ||
    inputOverLimit ||
    !isModelAllowed ||
    isLoading ||
    input.trim() === "";
  const showResultArea = isLoading || hasResult;

  // Copy the active text. Show brief feedback. Never throw.
  async function handleCopy() {
    if (!activeText) {
      return;
    }
    try {
      if (
        typeof navigator !== "undefined" &&
        navigator.clipboard &&
        typeof navigator.clipboard.writeText === "function"
      ) {
        await navigator.clipboard.writeText(activeText);
      }
    } catch (e) {
      // Clipboard blocked. Keep the callback path below.
    }
    if (typeof onCopy === "function") {
      onCopy(activeText);
    }
    setCopied(true);
    if (copyTimer.current) {
      clearTimeout(copyTimer.current);
    }
    copyTimer.current = setTimeout(() => setCopied(false), COPY_RESET_MS);
  }

  // Run from pasted input. Guard the disabled state.
  function handleRun() {
    if (runDisabled) {
      return;
    }
    if (typeof onRun === "function") {
      onRun(input.trim(), displayTone);
    }
  }

  function handleToneClick(tone) {
    setPickedTone(tone);
    if (typeof onToneChange === "function") {
      onToneChange(tone);
    }
  }

  return (
    <section
      aria-label="Express in English"
      className="lex-paper-surface lex-card-enter flex flex-col rounded-xl border border-hairline p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h2 className="font-sans text-sm font-semibold text-ink">
            Express in English
          </h2>
          {showBadge && (
            <span className="inline-block rounded bg-pale-blue px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-pale-blue-text">
              {detectedLanguage} {"->"} English
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss Express card"
          onClick={() => onDismiss && onDismiss()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
        >
          <X size={15} weight="bold" />
        </button>
      </div>

      <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
        Tone
      </p>
      <div
        role="tablist"
        aria-label="Tone choices"
        className="mt-2 grid grid-cols-2 gap-1.5"
      >
        {EXPRESS_TONES.map((tone) => {
          const meta = TONE_META[tone];
          const Icon = meta.icon;
          const selected = toneChosen && tone === displayTone;
          // Span two columns only when the last tab sits alone in a row.
          const isLast =
            EXPRESS_TONES.length % 2 === 1 &&
            tone === EXPRESS_TONES[EXPRESS_TONES.length - 1];
          return (
            <button
              key={tone}
              type="button"
              role="tab"
              aria-selected={selected ? "true" : "false"}
              aria-label={`${meta.label} tone`}
              onClick={() => handleToneClick(tone)}
              className={
                "flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 font-sans text-xs font-medium transition-colors focus-visible:ring-1 focus-visible:ring-ink " +
                (isLast ? "col-span-2 " : "") +
                (selected
                  ? "border-ink bg-ink text-white"
                  : "border-hairline bg-transparent text-muted hover:border-muted hover:text-ink")
              }
            >
              <Icon size={14} weight="bold" />
              <span>{meta.label}</span>
            </button>
          );
        })}
      </div>
      {activeHint ? (
        <p className="mt-2 font-sans text-xs text-muted">{activeHint}</p>
      ) : awaitingTonePick && hasSelection ? (
        <p className="mt-2 font-sans text-xs text-muted">
          Pick a tone to phrase this selection.
        </p>
      ) : awaitingTonePick && !hasSelection ? (
        <p className="mt-2 font-sans text-xs text-muted">
          Paste text below. Pick a tone.
        </p>
      ) : null}

      {!hasSelection && (
        <div className="mt-5">
          <label
            htmlFor="express-input"
            className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
          >
            Paste text
          </label>
          <textarea
            id="express-input"
            aria-label="Text to express in English"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Paste a sentence or short paragraph..."
            rows={3}
            className="mt-1.5 w-full resize-none rounded-lg border border-hairline bg-canvas px-3 py-2.5 font-sans text-sm leading-relaxed text-ink outline-none placeholder:text-muted/70 focus:border-muted"
          />
          <button
            type="button"
            aria-label="Run Express"
            disabled={runDisabled}
            onClick={handleRun}
            className="mt-3 w-full rounded-lg bg-ink py-2.5 font-sans text-sm font-medium text-white transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Run
          </button>
        </div>
      )}

      {showResultArea && (
        <div
          data-testid="express-body"
          className="mt-5 whitespace-pre-wrap rounded-lg border border-hairline bg-canvas px-3.5 py-3 font-sans text-sm leading-relaxed text-ink"
        >
          {isLoading && !hasResult ? (
            <div aria-hidden="true" className="space-y-2.5 py-0.5">
              <div className="h-2.5 w-full rounded lex-shimmer" />
              <div className="h-2.5 w-[88%] rounded lex-shimmer" />
              <div className="h-2.5 w-[70%] rounded lex-shimmer" />
            </div>
          ) : (
            activeText
          )}
        </div>
      )}

      {/* Keep a stable body hook for selection wait / empty tests. */}
      {!showResultArea && (
        <div data-testid="express-body" className="sr-only">
          {hasSelection
            ? "Pick a tone to phrase this selection."
            : "Paste text to express in English."}
        </div>
      )}

      {isLoading && (
        <p className="mt-2.5 font-mono text-[10px] lowercase tracking-[0.04em] text-muted">
          {LOADING_COPY}
        </p>
      )}

      {isError && (
        <p role="alert" className="mt-3 font-sans text-xs leading-relaxed text-pale-red-text">
          {error || "Express could not run. Try again."}
        </p>
      )}

      {!isModelAllowed && (
        <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
          {NEEDS_MODEL_NOTE}
        </p>
      )}

      {showOverLimit && (
        <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
          {OVER_LIMIT_NOTE}
        </p>
      )}

      {hasResult && (
        <div className="mt-4 flex items-center gap-2.5">
          {hasSelection && (
            <button
              type="button"
              aria-label="Replace selection"
              disabled={!activeText || isOverLimit}
              onClick={() => onReplace && onReplace(activeText)}
              className="flex-1 rounded-lg bg-ink py-2.5 font-sans text-sm font-medium text-white transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
            >
              Replace Selection
            </button>
          )}
          <button
            type="button"
            aria-label="Copy result"
            disabled={!activeText}
            onClick={handleCopy}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-hairline bg-transparent py-2.5 font-sans text-sm font-medium text-ink transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-45"
          >
            {copied ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      )}
    </section>
  );
}
