import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { alignWords } from "./wordDiff.js";

function DiffPane({ label, parts, show, markClass }) {
  return (
    <div className="min-w-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
        {label}
      </p>
      <div className="mt-2 font-sans text-sm leading-relaxed text-ink">
        {parts
          .filter((part) => show(part.kind))
          .map((part, index) =>
            part.kind === "kept" ? (
              <span key={index}>{part.text} </span>
            ) : (
              <span key={index} className={markClass}>
                {part.text}{" "}
              </span>
            ),
          )}
      </div>
    </div>
  );
}

export default function DiffPopover({
  tool,
  sourceText,
  resultText,
  onApply,
  onDismiss,
  onClose,
}) {
  const panelRef = useRef(null);
  const parts = alignWords(sourceText, resultText);
  const hasSource = Boolean(sourceText && sourceText.trim());

  useEffect(() => {
    panelRef.current?.focus?.();
  }, []);

  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <div
      data-testid="diff-popover-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={`${tool} suggestion`}
        className="lex-paper-surface max-h-[85vh] w-full max-w-3xl overflow-hidden rounded-xl border border-hairline shadow-lg outline-none"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
          <span className="inline-block rounded bg-pale-blue px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-pale-blue-text">
            {tool}
          </span>
          <button
            type="button"
            aria-label="Close diff view"
            onClick={onClose}
            className="rounded p-1 text-muted transition-colors hover:text-ink"
          >
            <X size={16} weight="bold" />
          </button>
        </div>
        <div className="lex-scroll max-h-[60vh] overflow-y-auto px-5 py-4">
          {hasSource ? (
            <div className="lex-diff-cols">
              <DiffPane
                label="Original"
                parts={parts}
                show={(kind) => kind !== "added"}
                markClass="lex-diff-removed"
              />
              <DiffPane
                label="Suggestion"
                parts={parts}
                show={(kind) => kind !== "removed"}
                markClass="lex-diff-added"
              />
            </div>
          ) : (
            <div className="font-sans text-sm leading-relaxed text-ink">
              {resultText}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-hairline px-5 py-3">
          <button
            type="button"
            onClick={onApply}
            className="flex-1 rounded bg-ink py-2 font-sans text-sm font-medium text-white transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 rounded border border-hairline bg-transparent py-2 font-sans text-sm font-medium text-ink transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
