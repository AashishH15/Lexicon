import SuggestionCard from "./SuggestionCard.jsx";
import DocStats from "./DocStats.jsx";
import { useEffect, useRef, useState } from "react";
import { ArrowLineRight, CheckCircle, CircleNotch, Info, Warning, Lightbulb } from "@phosphor-icons/react";

const BLOOM_MESSAGES = [
  "No issues detected. Your draft is clear.",
  "Every sentence reads cleanly.",
  "Nothing needs attention here.",
];

export default function ReviewPanel({
  editor,
  activeTool,
  grammarMatches,
  checking,
  userResolvedAll,
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
  transformResults,
  transformProgress,
  transformRunning,
  transformStatus,
  transformError,
  onApplyTransform,
  onDismissTransform,
}) {
  const count = grammarMatches.length;
  const [showBloom, setShowBloom] = useState(false);
  const [folding, setFolding] = useState(false);
  const bloomMessageRef = useRef("");
  const prevCheckingRef = useRef(checking);

  // Show bloom when a proofread pass completes with zero issues
  useEffect(() => {
    const justCompleted = prevCheckingRef.current && !checking;
    prevCheckingRef.current = checking;
    if (justCompleted && count === 0 && activeTool === "Proofread" && editor?.getText().trim().length > 0) {
      if (!bloomMessageRef.current) {
        bloomMessageRef.current = BLOOM_MESSAGES[Math.floor(Math.random() * BLOOM_MESSAGES.length)];
      }
      setShowBloom(true);
    }
  }, [checking, count, activeTool, editor]);

  // Dismiss bloom when the user edits text
  useEffect(() => {
    if (!editor || !showBloom) return;
    const handler = () => {
      setShowBloom(false);
      bloomMessageRef.current = "";
    };
    editor.on("update", handler);
    return () => editor.off("update", handler);
  }, [editor, showBloom]);

  // Dismiss bloom when new issues appear
  useEffect(() => {
    if (count > 0) {
      setShowBloom(false);
      bloomMessageRef.current = "";
    }
  }, [count]);

  return (
    <div className="flex h-full flex-col px-4 pb-6 pt-4">
      <div className="flex items-center justify-between gap-3">
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            className={
              "rounded p-1 transition-colors hover:bg-hairline/60 " +
              (aboutToCollapse ? "text-amber-500" : "text-muted hover:text-ink")
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

      <div className="lex-scroll mt-4 flex-1 overflow-auto pr-1">
        {!activeTool ? (
          <>
            <p className="text-sm leading-relaxed text-muted">
              Click <span className="font-semibold text-ink">Proofread</span> to
              scan the draft, or run any tool from Actions — its suggestion
              appears here to review.
            </p>
            <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted mt-3">
              status :: awaiting selection...
            </p>
          </>
        ) : activeTool === "Proofread" ? (
          checking ? (
            <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
              status :: initializing engine<span className="lex-ellipsis">...</span>
            </p>
          ) : count === 0 ? (
            showBloom ? (
              <div className="lex-bloom flex w-full items-center gap-2 rounded-xl bg-[#EDF3EC] px-4 py-3 text-[#346538] border border-[#D3E2D0]">
                <CheckCircle size={18} weight="fill" />
                <span className="font-sans text-sm">{bloomMessageRef.current}</span>
              </div>
            ) : (
              <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
                status :: {userResolvedAll ? "no issues remaining" : "no issues found"}
              </p>
            )
          ) : (
            <>
              <div className="mb-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (folding) return;
                    setFolding(true);
                    setTimeout(() => { setFolding(false); onAcceptAll(); }, count * 45 + 350);
                  }}
                  className="rounded-full bg-pale-green px-2.5 py-px font-mono text-[10px] uppercase tracking-widest text-pale-green-text transition-colors hover:bg-pale-green/70"
                >
                  Accept all {count} {count === 1 ? "Suggestion" : "Suggestions"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (folding) return;
                    setFolding(true);
                    setTimeout(() => { setFolding(false); onDismissAll(); }, count * 45 + 350);
                  }}
                  className="rounded-full px-2.5 py-px font-mono text-[10px] uppercase tracking-widest text-muted transition-colors hover:bg-pale-red hover:text-pale-red-text"
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
              <div className="relative group inline-block my-2">
                <button
                  type="button"
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
                >
                  <Info size={12} weight="bold" />
                  <span>Legend</span>
                </button>
                <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-hairline bg-white p-2.5 shadow-lg opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
                  <div className="flex flex-col gap-1.5 font-sans text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#9F2F2D]" />
                      <span className="font-medium text-ink">Spelling</span>
                      <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">RED</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#956400]" />
                      <span className="font-medium text-ink">Grammar & Punctuation</span>
                      <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">YELLOW</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#1F6C9F]" />
                      <span className="font-medium text-ink">Style & AI Tone</span>
                      <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">BLUE</span>
                    </div>
                  </div>
                </div>
              </div>
              <ul className="flex flex-col gap-3">
                {grammarMatches.map((match, i) => (
                  <SuggestionCard
                    key={match.id}
                    match={match}
                    index={i}
                    active={activeErrorId === match.id}
                    folding={folding}
                    foldDelay={i * 45}
                    onApply={onApply}
                    onDismiss={onDismiss}
                    onAddToDictionary={onAddToDictionary}
                    onLocate={onLocate}
                  />
                ))}
              </ul>
            </>
          )
        ) : (
          <TransformView
            tool={activeTool}
            status={transformStatus}
            error={transformError}
            results={transformResults}
            progress={transformProgress}
            running={transformRunning}
            onApply={onApplyTransform}
            onDismiss={onDismissTransform}
          />
        )}
      </div>

      <DocStats editor={editor} />
    </div>
  );
}

function TransformView({ tool, status, error, results, progress, running, onApply, onDismiss }) {
  if (running && progress) {
    const showBar = progress.total > 1; // a single chunk needs no progress bar
    const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <>
        {results && results.length > 0 && (
          <ul className="flex flex-col gap-3">
            {results.map((card, i) => (
              <TransformCard key={`${card.part}-${i}`} card={card} index={i} onApply={onApply} onDismiss={onDismiss} />
            ))}
          </ul>
        )}
        <div className="mt-3 rounded-xl border border-hairline bg-white p-6 pb-4 lex-card-enter">
          <div className="flex items-start gap-2.5">
            <CircleNotch size={16} weight="bold" className="mt-0.5 animate-spin text-muted" />
            <div>
              <p className="font-sans text-sm text-ink">
                {status === "warming" ? "Warming up the local model…" : "Working…"}
              </p>
              <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted mt-1">
                status :: transforming part {progress.current} of {progress.total}
                <span className="lex-ellipsis">...</span>
              </p>
            </div>
          </div>
          {showBar && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-[#EAEAEA]">
              <div
                className="h-full bg-ink transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {progress.total > 1 && (
            <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
              This is a large section — generating it in {progress.total} parts may take a minute or two.
            </p>
          )}
          <p className="mt-3 font-mono text-[10px] lowercase tracking-[0.04em] text-muted">
            status :: click the tool again in Actions to cancel
          </p>
        </div>
      </>
    );
  }

  if (status === "error") {
    return (
      <div className="rounded-xl border border-pale-red bg-pale-red/40 px-4 py-4 lex-card-enter">
        <div className="flex items-start gap-2.5">
          <Warning size={16} weight="bold" className="mt-0.5 text-pale-red-text" />
          <div>
            <p className="font-sans text-sm font-medium text-pale-red-text">
              {tool} couldn&rsquo;t run
            </p>
            <p className="font-sans text-xs leading-relaxed text-muted mt-1">
              {error || "The local model returned an error. Try again, or check your AI setup."}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2.5">
          <Lightbulb size={14} weight="bold" className="mt-0.5 shrink-0 text-pale-yellow-text" />
          <p className="font-sans text-xs leading-relaxed text-muted">
            Tip: very large or unbroken blocks of text can exceed the model&rsquo;s context window. Try selecting a section to transform, or add paragraph breaks so Lexicon can process it in parts.
          </p>
        </div>
      </div>
    );
  }

  // One card per chunk (or a single entry for selection/small-doc runs).
  if (results && results.length > 0) {
    return (
      <>
        <div className="relative group inline-block mb-3">
          <button
            type="button"
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink"
          >
            <Info size={12} weight="bold" />
            <span>Legend</span>
          </button>
          <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-hairline bg-white p-2.5 shadow-lg opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
            <div className="flex flex-col gap-1.5 font-sans text-xs">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#9F2F2D]" />
                <span className="font-medium text-ink">Spelling</span>
                <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">RED</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#956400]" />
                <span className="font-medium text-ink">Grammar & Punctuation</span>
                <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">YELLOW</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-[#1F6C9F]" />
                <span className="font-medium text-ink">Style & AI Tone</span>
                <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">BLUE</span>
              </div>
            </div>
          </div>
        </div>
        <ul className="flex flex-col gap-3">
          {results.map((card, i) => (
            <TransformCard key={`${card.part}-${i}`} card={card} index={i} onApply={onApply} onDismiss={onDismiss} />
          ))}
        </ul>
      </>
    );
  }

  // Idle: tool selected, awaiting first run / result.
  return (
    <p className="font-mono text-xs lowercase tracking-[0.04em] text-muted">
      status :: awaiting transform<span className="lex-ellipsis">...</span>
    </p>
  );
}

function TransformCard({ card, index, onApply, onDismiss }) {
  return (
    <li
      className="rounded-xl border border-hairline bg-white p-6 pb-4 lex-card-enter"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <span className="inline-block rounded bg-pale-blue px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-pale-blue-text">
        {card.tool}
        {card.total > 1 ? ` — Part ${card.part} of ${card.total}` : " Result"}
      </span>
      <div className="mt-3 whitespace-pre-wrap font-sans text-sm leading-loose text-ink">
        {card.text}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => onApply(card)}
          className="flex-1 rounded bg-ink py-2 font-sans text-sm font-medium text-white transition-transform duration-150 active:scale-[0.98]"
        >
          Apply
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="flex-1 rounded border border-hairline bg-transparent py-2 font-sans text-sm font-medium text-ink transition-transform duration-150 active:scale-[0.98]"
        >
          Dismiss
        </button>
      </div>
      <p className="mt-3 font-mono text-[10px] lowercase tracking-[0.04em] text-muted">
        status :: review the suggestion, then apply to replace this section
      </p>
    </li>
  );
}
