import SuggestionCard from "./SuggestionCard.jsx";
import DocStats from "./DocStats.jsx";
import { ArrowLineRight } from "@phosphor-icons/react";

export default function ReviewPanel({
  editor,
  activeTool,
  grammarMatches,
  checking,
  activeErrorId,
  onApply,
  onDismiss,
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
            className="rounded p-1 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
            aria-label="Collapse right panel"
            title="Collapse panel"
          >
            <ArrowLineRight size={14} weight="bold" />
          </button>
        )}
        <div className="flex items-center gap-3">
          {activeTool && count > 0 && (
            <span className="rounded-full bg-pale-green px-2.5 py-px font-mono text-[10px] uppercase tracking-widest text-pale-green-text">
              {count} {count === 1 ? "Suggestion" : "Suggestions"}
            </span>
          )}
          {activeTool && (
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted hover:text-ink"
            >
              Clear
            </button>
          )}
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
            Review Panel
          </p>
        </div>
      </div>

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
