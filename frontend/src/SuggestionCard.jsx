const categoryStyles = {
  Grammar: "bg-pale-blue text-pale-blue-text",
  Spelling: "bg-pale-yellow text-pale-yellow-text",
  Punctuation: "bg-pale-yellow text-pale-yellow-text",
};

export default function SuggestionCard({
  match,
  index,
  onApply,
  onDismiss,
  onLocate,
}) {
  const replacement = match.replacements[0];
  const tag = categoryStyles[match.category] || categoryStyles.Grammar;

  return (
    <li
      onClick={() => onLocate(match)}
      className="cursor-pointer rounded-xl border border-hairline bg-white p-6 pb-4 transition-colors duration-200 hover:border-muted lex-card-enter"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span
        className={`inline-block rounded px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${tag}`}
      >
        {match.category} Suggestion
      </span>

      <p className="mt-3 font-sans text-sm italic text-muted">{match.message}</p>

      <div className="mt-3 rounded-lg border border-hairline bg-canvas px-5 py-3.5">
        <p className="font-sans text-sm leading-loose">
          <span className="rounded bg-pale-red px-1 text-pale-red-text line-through">
            {match.original}
          </span>
          {replacement && (
            <>
              <span className="mx-1 text-muted">&rarr;</span>
              <span className="rounded bg-pale-green px-1 text-pale-green-text">
                {replacement}
              </span>
            </>
          )}
        </p>
      </div>

      <div className="mt-4 flex gap-2">
        {replacement && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onApply(match, replacement);
            }}
            className="flex-1 rounded bg-ink py-2 font-sans text-sm font-medium text-white transition-transform duration-150 active:scale-[0.98]"
          >
            Accept
          </button>
        )}
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onDismiss(match);
          }}
          className="flex-1 rounded border border-hairline bg-transparent py-2 font-sans text-sm font-medium text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          Dismiss
        </button>
      </div>
    </li>
  );
}
