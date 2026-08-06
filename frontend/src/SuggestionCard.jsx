import { useEffect, useRef, useState } from "react";
import { BookBookmark, CircleNotch, MagicWand } from "@phosphor-icons/react";

function getCategoryBadgeStyle(category = "") {
  const cat = category.toLowerCase();
  if (cat.includes("spell") || cat.includes("typo")) {
    return "bg-[#FDEBEC] text-[#9F2F2D] border-[#F8C9C8]";
  }
  if (cat.includes("gramm") || cat.includes("punct")) {
    return "bg-[#FBF3DB] text-[#956400] border-[#F8D86B]";
  }
  if (cat.includes("prose")) {
    return "bg-[#F3E8FF] text-[#6B21A8] border-[#E9D5FF]";
  }
  return "bg-[#E1F3FE] text-[#1F6C9F] border-[#BFE3FB]";
}

export default function SuggestionCard({
  match,
  index,
  active,
  folding,
  foldDelay,
  onApply,
  onDismiss,
  onAddToDictionary,
  onLocate,
  onAiRewrite,
}) {
  const replacement = match.replacements[0];
  const badgeStyle = getCategoryBadgeStyle(match.category);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const cardRef = useRef(null);
  useEffect(() => { setEntered(true); }, []);

  const isPassive =
    match.category === "Prose Style" &&
    match.message?.toLowerCase().includes("passive") &&
    match.sentence &&
    onAiRewrite;

  async function handleAiRewrite() {
    setAiLoading(true);
    const result = await onAiRewrite(match.sentence);
    setAiLoading(false);
    if (result) setAiResult(result);
  }

  const handleClick = () => {
    onLocate(match);
    if (cardRef.current) {
      const el = cardRef.current;
      const container = el.closest(".lex-scroll");
      if (container) {
        const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTo({
          top: container.scrollTop + delta - 8,
          behavior: "smooth",
        });
      }
    }
  };

  return (
    <li
      ref={cardRef}
      onClick={handleClick}
      data-match-id={match.id}
      className={
        "cursor-pointer rounded-xl border bg-white p-6 pb-4 transition-colors duration-200 " +
        (exiting ? "lex-card-slide-out" : folding ? "lex-card-fold overflow-hidden" : entered ? "" : "lex-card-enter") +
        " " +
        (active
          ? "border-ink ring-1 ring-ink/10 bg-canvas"
          : "border-hairline hover:border-muted")
      }
      style={{ animationDelay: exiting ? "0ms" : folding ? `${foldDelay}ms` : `${index * 80}ms` }}
    >
      <span
        className={`inline-block rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] ${badgeStyle}`}
      >
        {match.category === "Prose Style" ? "Prose Style" : `${match.category} Suggestion`}
      </span>

      <p className="mt-3 font-sans text-sm italic text-muted">{match.message}</p>

      <div className="mt-3 rounded-lg border border-hairline bg-canvas px-5 py-3.5">
        <p className="font-sans text-sm leading-loose">
          <span className="rounded bg-pale-red px-1 text-pale-red-text line-through">
            {match.original}
          </span>
          {aiResult && (
            <>
              <span className="mx-1 text-muted">&rarr;</span>
              <span className="rounded bg-pale-green px-1 text-pale-green-text">
                {aiResult}
              </span>
            </>
          )}
          {!aiResult && replacement && (
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
        {aiResult ? (
          <button
            type="button"
            aria-label="Accept AI rewrite"
            onClick={(event) => {
              event.stopPropagation();
              setExiting(true);
              setTimeout(() => onApply(match, aiResult), 280);
            }}
            className="flex-1 rounded bg-ink py-2 font-sans text-sm font-medium text-white transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
          >
            Accept
          </button>
        ) : replacement && !isPassive ? (
          <button
            type="button"
            aria-label="Accept replacement"
            onClick={(event) => {
              event.stopPropagation();
              setExiting(true);
              setTimeout(() => onApply(match, replacement), 280);
            }}
            className="flex-1 rounded bg-ink py-2 font-sans text-sm font-medium text-white transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
          >
            Accept
          </button>
        ) : null}
        {isPassive && !aiResult && (
          <button
            type="button"
            aria-label="Rewrite in active voice with AI"
            disabled={aiLoading}
            onClick={(event) => {
              event.stopPropagation();
              handleAiRewrite();
            }}
            className="flex-1 rounded border border-hairline bg-canvas py-2 font-sans text-xs font-medium text-ink transition-colors hover:bg-hairline/60 active:scale-[0.98] disabled:opacity-50"
          >
            {aiLoading ? (
              <span className="inline-flex items-center justify-center gap-1.5 text-muted">
                <CircleNotch size={13} weight="bold" className="animate-spin text-ink" />
                Rewriting&hellip;
              </span>
            ) : (
              <span className="inline-flex items-center justify-center gap-1.5">
                <MagicWand size={13} weight="bold" className="text-muted" />
                Active Voice
              </span>
            )}
          </button>
        )}
        <button
          type="button"
          aria-label="Dismiss suggestion"
          onClick={(event) => {
            event.stopPropagation();
            setExiting(true);
            setTimeout(() => onDismiss(match), 280);
          }}
          className="flex-1 rounded border border-hairline bg-transparent py-2 font-sans text-sm font-medium text-ink transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
        >
          Dismiss
        </button>
        {!match.category?.toLowerCase().includes("prose") && (
          <button
            type="button"
            aria-label="Add to dictionary"
            title="Add to Dictionary"
            onClick={(event) => {
              event.stopPropagation();
              onAddToDictionary(match);
            }}
            className="shrink-0 p-2 rounded-md text-muted transition-colors hover:text-ink focus-visible:ring-1 focus-visible:ring-ink active:scale-95"
          >
            <BookBookmark size={18} weight="bold" />
          </button>
        )}
      </div>
    </li>
  );
}