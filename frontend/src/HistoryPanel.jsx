import { useEffect, useMemo, useRef, useState } from "react";
import {
  X,
  Check,
  Clock,
  ArrowCounterClockwise,
  Copy,
  FloppyDisk,
  LockSimple,
  LockSimpleOpen,
  MagnifyingGlass,
  Trash,
  FileText,
  Info,
  Robot,
} from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";

function formatTimestamp(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  const date = new Date(ts);
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toolLabel(name) {
  if (!name) return "AI Tool";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function snippet(text, max = 120) {
  if (!text) return "";
  const s = text.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export default function HistoryPanel({
  open,
  documentHistory,
  transformHistory,
  autoDraftMode,
  onAutoDraftModeChange,
  onManualSave,
  onRestoreDraft,
  onReapplyTransform,
  onToggleDraftLock,
  onToggleTransformLock,
  onClearDrafts,
  onClearTransforms,
  onClose,
}) {
  const [tab, setTab] = useState("drafts");
  const [query, setQuery] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const copiedTimerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setConfirmClear(false);
    setCopiedId(null);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = null;
    }
  }, [open, tab]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event) => {
      if (event.key === "Escape") {
        if (confirmClear) {
          setConfirmClear(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, confirmClear]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documentHistory;
    return documentHistory.filter((d) => d.text.toLowerCase().includes(q));
  }, [documentHistory, query]);

  const filteredTransforms = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return transformHistory;
    return transformHistory.filter(
      (t) =>
        t.tool.toLowerCase().includes(q) ||
        t.sourceText.toLowerCase().includes(q) ||
        t.resultText.toLowerCase().includes(q)
    );
  }, [transformHistory, query]);

  function handleCopy(text, id) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    if (copiedTimerRef.current) {
      clearTimeout(copiedTimerRef.current);
    }
    copiedTimerRef.current = setTimeout(() => {
      setCopiedId(null);
      copiedTimerRef.current = null;
    }, 1500);
  }

  if (!open) return null;

  const hasDrafts = documentHistory.length > 0;
  const hasTransforms = transformHistory.length > 0;
  const hasAny = hasDrafts || hasTransforms;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onClick={() => {
        if (confirmClear) setConfirmClear(false);
        else onClose();
      }}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-hairline bg-white lex-card-enter"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-title"
      >
        <div className="flex items-center justify-between border-b border-hairline px-5 py-3">
          <p id="history-title" className="font-mono text-[10px] uppercase tracking-widest text-muted">
            History & Recents
          </p>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-transform duration-200 hover:scale-110 hover:text-ink"
            aria-label="Close history"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="flex items-center gap-4 border-b border-hairline px-5 py-2">
          <button
            type="button"
            onClick={() => setTab("drafts")}
            className={
              "font-mono text-[10px] uppercase tracking-wider transition-colors " +
              (tab === "drafts"
                ? "font-semibold text-ink"
                : "text-muted hover:text-ink")
            }
          >
            Draft Snapshots
            {hasDrafts > 0 && (
              <span className="ml-1.5 rounded-full bg-hairline px-1.5 py-0.5 text-[10px] text-muted">
                {documentHistory.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setTab("transforms")}
            className={
              "font-mono text-[10px] uppercase tracking-wider transition-colors " +
              (tab === "transforms"
                ? "font-semibold text-ink"
                : "text-muted hover:text-ink")
            }
          >
            AI Generations
            {hasTransforms > 0 && (
              <span className="ml-1.5 rounded-full bg-hairline px-1.5 py-0.5 text-[10px] text-muted">
                {transformHistory.length}
              </span>
            )}
          </button>
        </div>

        {tab === "drafts" && (
          <div className="flex items-center gap-2 border-b border-hairline px-5 py-2">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
                Auto-save
              </span>
              <Toggle
                checked={autoDraftMode}
                onChange={onAutoDraftModeChange}
                label="Toggle auto-save drafts"
              />
            </div>
            <div className="relative group">
              <Info
                size={14}
                weight="bold"
                className="text-muted cursor-help"
              />
              <div className="pointer-events-none absolute left-0 top-6 z-10 w-56 rounded-lg border border-hairline bg-white px-3 py-2 shadow-lg opacity-0 transition-opacity group-hover:opacity-100">
                <p className="font-sans text-[11px] leading-snug text-ink">
                  <strong>Auto:</strong> saves 3 seconds after you stop typing.
                </p>
                <p className="mt-1 font-sans text-[11px] leading-snug text-ink">
                  <strong>Manual:</strong> only saves when you click &ldquo;Save
                  Draft.&rdquo;
                </p>
                <p className="mt-1 font-sans text-[11px] leading-snug text-muted">
                  A maximum of 20 save points is kept at any time.
                </p>
              </div>
            </div>
            {!autoDraftMode && (
              <button
                type="button"
                onClick={onManualSave}
                className="ml-auto flex items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] text-ink transition-colors hover:bg-hairline/60"
                aria-label="Save current draft"
              >
                <FloppyDisk size={12} weight="bold" />
                Save Draft
              </button>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 border-b border-hairline px-5 py-2.5">
          <div className="relative flex-1">
            <MagnifyingGlass
              size={14}
              weight="bold"
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                tab === "drafts"
                  ? "Search drafts…"
                  : "Search generations…"
              }
              aria-label="Search history"
              className="w-full rounded border border-hairline bg-canvas py-1.5 pl-8 pr-3 font-sans text-xs text-ink outline-none focus:border-muted"
            />
          </div>
          {hasAny && (
            <button
              type="button"
              onClick={() => {
                if (confirmClear) {
                  if (tab === "drafts") onClearDrafts();
                  else onClearTransforms();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                }
              }}
              className={
                "flex items-center gap-1 rounded px-2 py-1.5 font-sans text-xs transition-colors " +
                (confirmClear
                  ? "bg-red-50 text-red-600"
                  : "text-muted hover:text-red-600")
              }
              aria-label="Clear history"
            >
              <Trash size={13} weight="bold" />
              {confirmClear ? "Confirm?" : "Clear"}
            </button>
          )}
        </div>

        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {tab === "drafts" && (
            <>
              {!hasDrafts ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted">
                  <FileText size={28} weight="thin" />
                  <p className="font-sans text-sm">
                    No draft snapshots yet.
                  </p>
                  <p className="font-sans text-xs">
                    {autoDraftMode
                      ? "Drafts are auto-saved 3 seconds after you stop typing."
                      : 'Click "Save Draft" above to save the current document.'}
                  </p>
                </div>
              ) : filteredDocs.length === 0 ? (
                <p className="py-6 text-center font-sans text-sm text-muted">
                  No drafts match your search.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredDocs.map((draft) => (
                    <div
                      key={draft.id}
                      className="rounded-lg border border-hairline bg-canvas p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 font-sans text-xs text-ink">
                            <Clock size={12} weight="bold" className="shrink-0 text-muted" />
                            {formatTimestamp(draft.timestamp)}
                          </p>
                          <p className="mt-0.5 font-sans text-[11px] text-muted">
                            {draft.wordCount} {draft.wordCount === 1 ? "word" : "words"}
                            {" · "}
                            {draft.charCount} {draft.charCount === 1 ? "char" : "chars"}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => onRestoreDraft(draft)}
                            className="flex items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] text-ink transition-colors hover:bg-hairline/60"
                            aria-label="Restore this draft"
                            title="Restore (replaces current document)"
                          >
                            <ArrowCounterClockwise size={12} weight="bold" />
                            Restore
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(draft.text, draft.id)}
                            className={
                              "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                              (copiedId === draft.id
                                ? "border-green-400 bg-green-50 text-green-700"
                                : "border-hairline bg-white text-ink hover:bg-hairline/60")
                            }
                            aria-label="Copy draft text"
                            title="Copy to clipboard"
                          >
                            {copiedId === draft.id ? (
                              <Check size={12} weight="bold" />
                            ) : (
                              <Copy size={12} weight="bold" />
                            )}
                            {copiedId === draft.id ? "Copied" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleDraftLock(draft.id)}
                            className={
                              "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                              (draft.locked
                                ? "border-pale-green-text/20 bg-pale-green text-pale-green-text"
                                : "border-hairline bg-white text-muted hover:text-ink")
                            }
                            aria-label={draft.locked ? "Unlock this draft" : "Lock this draft"}
                            title={draft.locked ? "Locked — survives clear and cap" : "Lock to protect from clear and cap"}
                          >
                            {draft.locked ? <LockSimple size={12} weight="fill" /> : <LockSimpleOpen size={12} weight="bold" />}
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 line-clamp-2 font-sans text-[11px] leading-snug text-muted">
                        {snippet(draft.text, 200)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === "transforms" && (
            <>
              {!hasTransforms ? (
                <div className="flex flex-col items-center gap-2 py-8 text-muted">
                  <Robot size={28} weight="thin" />
                  <p className="font-sans text-sm">
                    No AI generations yet.
                  </p>
                  <p className="font-sans text-xs">
                    Use Rewrite, Tone, or other AI tools and results
                    will appear here.
                  </p>
                </div>
              ) : filteredTransforms.length === 0 ? (
                <p className="py-6 text-center font-sans text-sm text-muted">
                  No generations match your search.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredTransforms.map((entry) => (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-hairline bg-canvas p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <span className="inline-block rounded bg-hairline px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                            {toolLabel(entry.tool)}
                          </span>
                          <p className="mt-1 flex items-center gap-1.5 font-sans text-[11px] text-muted">
                            <Clock size={11} weight="bold" className="shrink-0" />
                            {formatTimestamp(entry.timestamp)}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => onReapplyTransform(entry)}
                            className="flex items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] text-ink transition-colors hover:bg-hairline/60"
                            aria-label="Re-apply to editor"
                            title="Re-apply to editor"
                          >
                            <ArrowCounterClockwise size={12} weight="bold" />
                            Apply
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopy(entry.resultText, entry.id)}
                            className={
                              "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                              (copiedId === entry.id
                                ? "border-green-400 bg-green-50 text-green-700"
                                : "border-hairline bg-white text-ink hover:bg-hairline/60")
                            }
                            aria-label="Copy output"
                            title="Copy to clipboard"
                          >
                            {copiedId === entry.id ? (
                              <Check size={12} weight="bold" />
                            ) : (
                              <Copy size={12} weight="bold" />
                            )}
                            {copiedId === entry.id ? "Copied" : "Copy"}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleTransformLock(entry.id)}
                            className={
                              "flex items-center gap-1 rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                              (entry.locked
                                ? "border-pale-green-text/20 bg-pale-green text-pale-green-text"
                                : "border-hairline bg-white text-muted hover:text-ink")
                            }
                            aria-label={entry.locked ? "Unlock this generation" : "Lock this generation"}
                            title={entry.locked ? "Locked — survives clear and cap" : "Lock to protect from clear and cap"}
                          >
                            {entry.locked ? <LockSimple size={12} weight="fill" /> : <LockSimpleOpen size={12} weight="bold" />}
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Input
                          </p>
                          <p className="mt-0.5 line-clamp-2 font-sans text-[11px] leading-snug text-muted">
                            {snippet(entry.sourceText, 100)}
                          </p>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                            Output
                          </p>
                          <p className="mt-0.5 line-clamp-2 font-sans text-[11px] leading-snug text-ink">
                            {snippet(entry.resultText, 100)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-hairline px-5 py-2.5">
          <p className="font-sans text-[10px] text-muted">
            {tab === "drafts"
              ? `Showing ${filteredDocs.length} of ${documentHistory.length} draft${documentHistory.length === 1 ? "" : "s"}`
              : `Showing ${filteredTransforms.length} of ${transformHistory.length} generation${transformHistory.length === 1 ? "" : "s"}`}
          </p>
        </div>
      </div>
    </div>
  );
}
