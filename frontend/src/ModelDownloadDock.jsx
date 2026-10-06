import {
  CircleNotch,
  CheckCircle,
  WarningCircle,
  X,
  ArrowSquareOut,
} from "@phosphor-icons/react";

function formatBytes(bytes) {
  if (typeof bytes !== "number" || bytes <= 0) return "0 MB";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(0)} MB`;
}

export default function ModelDownloadDock({
  downloadState,
  onOpenSettings,
  onCancel,
  onDismiss,
}) {
  if (!downloadState) return null;

  const {
    isDownloading,
    tierLabel = "Standard",
    state = "downloading",
    bytesDone = 0,
    bytesTotal = 0,
    progressPct = 0,
    error = null,
    isComplete = false,
  } = downloadState;

  const isVerifying = state === "verifying";
  const isFailed = Boolean(error);
  const isFinished = isComplete || state === "ready";

  function handleCardClick(e) {
    if (e.target.closest("button")) return;
    onOpenSettings?.();
  }

  return (
    <div
      data-testid="model-download-dock"
      onClick={handleCardClick}
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-50 w-84 max-w-[calc(100vw-3rem)] cursor-pointer rounded-xl border border-hairline bg-white/95 p-4 shadow-2xl backdrop-blur-md transition-all duration-200 hover:border-accent/40 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] dark:bg-zinc-900/95"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {isFinished ? (
            <CheckCircle
              size={20}
              weight="fill"
              className="shrink-0 text-emerald-600 dark:text-emerald-400"
            />
          ) : isFailed ? (
            <WarningCircle
              size={20}
              weight="fill"
              className="shrink-0 text-red-600 dark:text-red-400"
            />
          ) : (
            <CircleNotch
              size={20}
              weight="bold"
              className="shrink-0 animate-spin text-accent"
            />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="truncate font-serif text-sm font-semibold text-ink">
                {isFinished
                  ? "Model Ready"
                  : isFailed
                  ? "Download Failed"
                  : isVerifying
                  ? "Verifying Model"
                  : "Downloading Lexicon Model"}
              </span>
              <span className="shrink-0 rounded bg-hairline/70 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                {tierLabel}
              </span>
            </div>
            {isFinished && (
              <p className="mt-0.5 text-xs text-muted">AI tools are enabled.</p>
            )}
            {isFailed && (
              <p className="mt-0.5 truncate text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {!isFinished && !isFailed && (
              <p className="mt-0.5 text-xs text-muted">
                {isVerifying
                  ? "Verifying model file integrity…"
                  : `${formatBytes(bytesDone)} of ${formatBytes(
                      bytesTotal
                    )} (${progressPct}%)`}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {isDownloading && (
            <button
              type="button"
              aria-label="Cancel download"
              onClick={(e) => {
                e.stopPropagation();
                onCancel?.();
              }}
              className="rounded px-2 py-1 font-sans text-xs text-muted transition-colors hover:bg-hairline hover:text-red-600"
            >
              Cancel
            </button>
          )}
          {(isFinished || isFailed) && (
            <button
              type="button"
              aria-label="Dismiss message"
              onClick={(e) => {
                e.stopPropagation();
                onDismiss?.();
              }}
              className="rounded p-1 text-muted transition-colors hover:bg-hairline hover:text-ink"
            >
              <X size={14} weight="bold" />
            </button>
          )}
        </div>
      </div>

      {!isFinished && !isFailed && (
        <div className="mt-3">
          <div
            role="progressbar"
            aria-valuenow={progressPct}
            aria-valuemin="0"
            aria-valuemax="100"
            className="h-1.5 w-full overflow-hidden rounded-full bg-hairline/60"
          >
            <div
              className={`h-full rounded-full bg-accent transition-all duration-300 ease-out ${
                isVerifying ? "animate-pulse" : ""
              }`}
              style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
            />
          </div>
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between text-[11px] text-muted">
        <span className="flex items-center gap-1 hover:text-ink">
          View in Engine Settings
          <ArrowSquareOut size={12} weight="bold" />
        </span>
      </div>
    </div>
  );
}
