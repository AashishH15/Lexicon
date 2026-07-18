import SuggestionCard from "./SuggestionCard.jsx";
import DocStats from "./DocStats.jsx";
import { ArrowLineRight } from "@phosphor-icons/react";

export default function ReviewPanel({
  editor,
  activeTool,
  grammarMatches,
  checking,
  activeErrorId,
  aboutToCollapse,
  onApply,
  onDismiss,
  onAcceptAll,
  onDismissAll,
  onAddToDictionary,
  onLocate,
  onCollapse,
  onClear,
}) {
  const count = grammarMatches.length;

  return (
      <div className="flex h-full flex-col px-4 pb-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className={
              "rounded p-1 transition-colors hover:bg-hairline/60 " +
              (aboutToCollapse
                ? "text-amber-500"
                : "text-muted hover:text-ink")
            }
            aria-label="Collapse right panel"
            title="Collapse panel"
          >
            <ArrowLineRight size={14} weight="bold" />
          </button>
        )}
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
          Review
        </p>
      </div>
      {activeTool && (
        <div className="mt-2 flex items-center justify-between gap-3">
          {count > 0 && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onAcceptAll}
                className="rounded-full bg-pale-green px-2.5 py-px font-mono text-[10px] uppercase tracking-widest text-pale-green-text transition-colors hover:bg-pale-green/70"
              >
                Accept all {count} {count === 1 ? "Suggestion" : "Suggestions"}
              </button>
              <button
                type="button"
                onClick={onDismissAll}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
              >
                Dismiss All
              </button>
              <button
                type="button"
                onClick={onClear}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
              >
                Clear
              </button>
            </div>
          )}
        </div>
      )}

      <div className="lex-scroll mt-4 flex-1 overflow-auto pr-1">
        {!activeTool ? (
          <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
            status :: awaiting selection...
          </p>
        ) : checking ? (
          <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
            status :: initializing engine<span className="lex-ellipsis">...</span>
          </p>
        ) : count === 0 ? (
          <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
            status :: no issues found
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {grammarMatches.map((match, i) => (
              <SuggestionCard
                key={match.id}
                match={match}
                index={i}
                active={activeErrorId === match.id}
                onApply={onApply}
                onDismiss={onDismiss}
                onAddToDictionary={onAddToDictionary}
                onLocate={onLocate}
              />
            ))}
          </ul>
        )}
      </div>

      <DocStats editor={editor} />
    </div>
  );
}
