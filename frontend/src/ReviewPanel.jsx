import SuggestionCard from "./SuggestionCard.jsx";

export default function ReviewPanel({
  activeTool,
  grammarMatches,
  onApply,
  onDismiss,
  onLocate,
  onClear,
}) {
  const count = grammarMatches.length;

  return (
    <div className="flex h-full flex-col p-6">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted">
          Review Panel
        </p>
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
        </div>
      </div>

      <div className="lex-scroll mt-4 flex-1 overflow-auto pr-1">
        {!activeTool ? (
          <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
            status :: awaiting selection...
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
                onApply={onApply}
                onDismiss={onDismiss}
                onLocate={onLocate}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
