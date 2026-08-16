import SuggestionCard from "./SuggestionCard.jsx";
import DocStats from "./DocStats.jsx";
import { useEffect, useRef, useState } from "react";
import { ArrowLineRight, CheckCircle, Info, Warning, Lightbulb, CircleNotch } from "@phosphor-icons/react";

import { openExternalUrl } from "./api.js";

const BLOOM_MESSAGES = [
  "No issues detected. Your draft is clear.",
  "Every sentence reads cleanly.",
  "Nothing needs attention here.",
];

function formatBackendDiagnostic(error) {
  const rawError = typeof error === "string" ? error : error?.message || String(error || "");
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const platform = typeof navigator !== "undefined" ? navigator.platform || "" : "";
  const isMac = /Mac|iPod|iPhone|iPad/i.test(platform) || /Macintosh/i.test(ua);

  let hint = "";
  let gatekeeperCmd = "";
  let learnUrl = "";

  if (rawError.includes("Failed to fetch") || rawError.includes("NetworkError")) {
    hint = "The local engine is offline or still starting up. Lexicon will automatically re-connect once ready.";
  } else if (
    /can't find java|no java install|javaerror|grammar_engine_unavailable/i.test(
      rawError,
    )
  ) {
    hint =
      "The bundled Java runtime was not found on PATH. Reinstall Lexicon, or confirm the installer included the JRE under resources/jre.";
  } else if (
    rawError.includes("Permission denied") ||
    rawError.includes("Access is denied") ||
    rawError.includes("os error 5") ||
    rawError.includes("os error 13")
  ) {
    if (isMac) {
      let appPath = "/Applications/Lexicon.app";
      let sidecarPath = "/Applications/Lexicon.app/Contents/Resources/lexicon-backend/lexicon-backend";

      const pathMatch = rawError.match(/"([^"]+lexicon-backend[^"]*)"/i) || rawError.match(/"([^"]+\.app[^"]*)"/i);
      if (pathMatch) {
        const fullPath = pathMatch[1];
        const appMatch = fullPath.match(/^(.*\.app)/i);
        if (appMatch) {
          appPath = appMatch[1];
          sidecarPath = fullPath;
        }
      }

      hint = "macOS Gatekeeper or file permissions restricted the engine binary from spawning.";
      gatekeeperCmd = `xattr -cr "${appPath}" && chmod +x "${sidecarPath}"`;
      learnUrl = "https://github.com/AashishH15/Lexicon#macos";
    } else {
      hint = "The operating system restricted the backend process from launching. Restarting Lexicon usually resolves this.";
    }
  } else if (rawError.includes("No such file") || rawError.includes("os error 2")) {
    hint = "Some engine files were not found. Reinstalling Lexicon will resolve this.";
  }

  return { rawError, hint, gatekeeperCmd, learnUrl };
}

export default function ReviewPanel({
  editor,
  activeTool,
  grammarMatches,
  checking,
  backendOffline,
  backendError,
  onRetry,
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
  onAiRewrite,
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
  const announceRef = useRef(null);
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

  // Auto-scroll review panel to the active card when an error is clicked
  // in the editor, matching the card→editor scroll behavior.
  useEffect(() => {
    if (activeErrorId == null) return;
    const card = document.querySelector(`[data-match-id="${activeErrorId}"]`);
    if (card) {
      const container = card.closest(".lex-scroll");
      if (container) {
        const delta = card.getBoundingClientRect().top - container.getBoundingClientRect().top;
        container.scrollTo({
          top: container.scrollTop + delta - 8,
          behavior: "smooth",
        });
      }
    }
  }, [activeErrorId]);

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
          backendOffline ? (
            <div className="flex w-full flex-col gap-2 rounded-xl bg-pale-yellow-bg px-4 py-3 text-amber-900 border border-pale-yellow">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Warning size={18} weight="fill" className="shrink-0 text-amber-600" />
                  <span className="font-sans text-sm font-medium truncate">
                    Grammar engine unreachable. Reconnecting...
                  </span>
                </div>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    disabled={checking}
                    className="shrink-0 flex items-center gap-1.5 rounded-lg bg-amber-200/90 px-2.5 py-1 font-sans text-xs font-semibold text-amber-950 hover:bg-amber-300 disabled:opacity-60 transition-colors shadow-xs"
                  >
                    {checking ? (
                      <>
                        <CircleNotch size={14} className="animate-spin text-amber-800" />
                        <span>Retrying...</span>
                      </>
                    ) : (
                      <span>Retry Engine</span>
                    )}
                  </button>
                )}
              </div>
              {backendError && (() => {
                const { rawError, hint, gatekeeperCmd, learnUrl } = formatBackendDiagnostic(backendError);
                return (
                  <details className="mt-1 text-xs text-amber-950/80 cursor-pointer">
                    <summary className="font-mono text-[11px] select-none text-amber-800 hover:text-amber-950 font-medium">
                      Show error details
                    </summary>
                    <div className="mt-1.5 rounded bg-amber-100/70 p-2.5 font-mono text-[11px] leading-relaxed text-amber-900 border border-amber-200/60 select-text">
                      <div className="font-semibold text-amber-950 break-words">Error: {rawError}</div>
                      {hint && (
                        <div className="mt-1.5 border-t border-amber-200/60 pt-1.5 font-sans text-xs text-amber-900/90 whitespace-pre-wrap">
                          {hint}
                        </div>
                      )}
                      {gatekeeperCmd && (
                        <>
                          <div className="mt-2 rounded bg-amber-900/10 p-2 font-mono text-[10px] text-amber-950 break-all select-all border border-amber-900/15">
                            {gatekeeperCmd}
                          </div>
                          <div className="mt-1 text-[10px] text-amber-900/80 font-sans italic">
                            (If running from Downloads, replace /Applications/Lexicon.app with ~/Downloads/Lexicon.app)
                          </div>
                        </>
                      )}
                      {learnUrl && (
                        <div className="mt-2 text-[11px]">
                          <a
                            href={learnUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.preventDefault();
                              openExternalUrl(learnUrl);
                            }}
                            className="inline-flex items-center gap-1 font-sans font-medium text-amber-950 underline hover:text-amber-700 transition-colors"
                          >
                            Learn why this macOS command is safe on GitHub ↗
                          </a>
                        </div>
                      )}
                    </div>
                  </details>
                );
              })()}
            </div>
          ) : checking ? (
            <div className="lex-paper-surface rounded-xl border border-hairline p-6 pb-4 lex-card-enter">
              <div className="h-3 w-full rounded lex-shimmer" />
              <div className="mt-3 h-3 w-[90%] rounded lex-shimmer" />
              <div className="mt-3 h-3 w-[75%] rounded lex-shimmer" />
              <div className="mt-3 h-3 w-[40%] rounded lex-shimmer" />
              <p className="mt-4 font-mono text-[10px] lowercase tracking-[0.04em] text-muted">
                status :: scanning draft...
              </p>
            </div>
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
                <div ref={announceRef} aria-live="polite" aria-atomic="true" className="sr-only">
                  {checking ? "Proofreading in progress" : `${count} ${count === 1 ? "issue" : "issues"} found`}
                </div>
                <button
                  type="button"
                  aria-label={`Accept all ${count} suggestions`}
                  onClick={() => {
                    if (folding) return;
                    setFolding(true);
                    setTimeout(() => { setFolding(false); onAcceptAll(); }, count * 45 + 350);
                  }}
                  className="rounded-full bg-pale-green px-2.5 py-px font-mono text-[10px] uppercase tracking-widest text-pale-green-text transition-colors hover:bg-pale-green/70 focus-visible:ring-1 focus-visible:ring-ink"
                >
                  Accept all {count} {count === 1 ? "Suggestion" : "Suggestions"}
                </button>
                <button
                  type="button"
                  aria-label="Dismiss all suggestions"
                  onClick={() => {
                    if (folding) return;
                    setFolding(true);
                    setTimeout(() => { setFolding(false); onDismissAll(); }, count * 45 + 350);
                  }}
                  className="rounded-full px-2.5 py-px font-mono text-[10px] uppercase tracking-widest text-ink transition-colors hover:bg-pale-red hover:text-pale-red-text focus-visible:ring-1 focus-visible:ring-ink"
                >
                  Dismiss All
                </button>
                <button
                  type="button"
                  aria-label="Clear review"
                  onClick={onClear}
                  className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink transition-colors hover:opacity-70 focus-visible:ring-1 focus-visible:ring-ink"
                >
                  Clear
                </button>
              </div>
              <div className="relative group inline-block my-2">
                <button
                  type="button"
                  aria-label="Toggle legend"
                  className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink focus-visible:ring-1 focus-visible:ring-ink"
                >
                  <Info size={12} weight="bold" />
                  <span>Legend</span>
                </button>
                <div className="lex-paper-surface pointer-events-none absolute left-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-hairline p-2.5 shadow-lg opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
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
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-[#6B21A8]" />
                      <span className="font-medium text-ink">Prose Style</span>
                      <span className="ml-auto text-[10px] text-muted font-mono uppercase tracking-[0.08em]">LAVENDER</span>
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
                    onAiRewrite={onAiRewrite}
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
  if (running) {
    const showProgress = progress && progress.total > 1;
    const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    const statusText = status === "warming" ? "warming up Lex..." : "generating draft...";
    return (
      <>
        {results && results.length > 0 && (
          <ul className="flex flex-col gap-3">
            {results.map((card, i) => (
              <TransformCard key={`${card.part}-${i}`} card={card} index={i} onApply={onApply} onDismiss={onDismiss} />
            ))}
          </ul>
        )}
        <div className="lex-paper-surface mt-3 rounded-xl border border-hairline p-6 pb-4 lex-card-enter">
          <div className="h-3 w-full rounded lex-shimmer" />
          <div className="mt-3 h-3 w-[90%] rounded lex-shimmer" />
          <div className="mt-3 h-3 w-[75%] rounded lex-shimmer" />
          <div className="mt-3 h-3 w-[40%] rounded lex-shimmer" />
          <div className="mt-4 flex items-center gap-3">
            <div className="h-9 flex-1 rounded-md lex-shimmer" />
            <div className="h-9 flex-1 rounded-md lex-shimmer" />
          </div>
          {showProgress && (
            <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-hairline">
              <div
                className="h-full bg-ink transition-all duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {showProgress && (
            <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
              This is a large section — generating it in {progress.total} parts may take a minute or two.
            </p>
          )}
          <p className="mt-4 font-mono text-[10px] lowercase tracking-[0.04em] text-muted">
            status :: {statusText}
          </p>
        </div>
      </>
    );
  }

  if (status === "error") {
    const isContextOverflow =
      Boolean(error) &&
      /context\s*window|exceed(s|ed|ing)?|too long|n_ctx/i.test(error);

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
        {isContextOverflow && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2.5">
            <Lightbulb size={14} weight="bold" className="mt-0.5 shrink-0 text-pale-yellow-text" />
            <p className="font-sans text-xs leading-relaxed text-muted">
              Tip: very large or unbroken blocks of text can exceed the model&rsquo;s context window. Try selecting a section to transform, or add paragraph breaks so Lexicon can process it in parts.
            </p>
          </div>
        )}
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
            aria-label="Toggle legend"
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors hover:text-ink focus-visible:ring-1 focus-visible:ring-ink"
          >
            <Info size={12} weight="bold" />
            <span>Legend</span>
          </button>
          <div className="lex-paper-surface pointer-events-none absolute left-0 top-full mt-1.5 z-30 w-52 rounded-xl border border-hairline p-2.5 shadow-lg opacity-0 transition-opacity duration-150 group-hover:pointer-events-auto group-hover:opacity-100">
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
      className="lex-paper-surface rounded-xl border border-hairline p-6 pb-4 lex-card-enter"
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
          aria-label="Apply transform result"
          onClick={() => onApply(card)}
          className="flex-1 rounded bg-ink py-2 font-sans text-sm font-medium text-white transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
        >
          Apply
        </button>
        <button
          type="button"
          aria-label="Dismiss transform result"
          onClick={onDismiss}
          className="flex-1 rounded border border-hairline bg-transparent py-2 font-sans text-sm font-medium text-ink transition-transform duration-150 focus-visible:ring-1 focus-visible:ring-ink active:scale-[0.98]"
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
