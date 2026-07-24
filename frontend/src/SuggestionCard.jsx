import { useEffect, useRef } from "react";
import { BookBookmark } from "@phosphor-icons/react";

function getCategoryBadgeStyle(category = "") {
  const cat = category.toLowerCase();
  if (cat.includes("spell") || cat.includes("typo")) {
    return "bg-[#FDEBEC] text-[#9F2F2D] border-[#F8C9C8]";
  }
  if (cat.includes("gramm") || cat.includes("punct")) {
    return "bg-[#FBF3DB] text-[#956400] border-[#F8D86B]";
  }
  return "bg-[#E1F3FE] text-[#1F6C9F] border-[#BFE3FB]";
}

export default function SuggestionCard({
  match,
  index,
  active,
  onApply,
  onDismiss,
  onAddToDictionary,
  onLocate,
}) {
  const replacement = match.replacements[0];
  const badgeStyle = getCategoryBadgeStyle(match.category);
  const cardRef = useRef(null);
  useEffect(() => {
    if (!active || !cardRef.current) {
      return;
    }
    const el = cardRef.current;
    const container = el.closest(".lex-scroll");
    if (container) {
      const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
      container.scrollTo({
        top: container.scrollTop + delta - 8,
        behavior: "smooth",
      });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [active]);

  return (
    <li
      ref={cardRef}
      onClick={() => onLocate(match)}
      className={
        "cursor-pointer rounded-xl border bg-white p-6 pb-4 transition-colors duration-200 lex-card-enter " +
        (active
          ? "border-ink ring-1 ring-ink/10 bg-canvas"
          : "border-hairline hover:border-muted")
      }
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span
        className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${badgeStyle}`}
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

      <div className="mt-4 flex items-center gap-3">
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
        <button
          type="button"
          title="Add to Dictionary"
          onClick={(event) => {
            event.stopPropagation();
            onAddToDictionary(match);
          }}
          className="shrink-0 p-2 rounded-md text-[#787774] transition-colors hover:text-[#111111] active:scale-95"
        >
          <BookBookmark size={18} weight="bold" />
        </button>
      </div>
    </li>
  );
}
