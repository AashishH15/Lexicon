import { X, DownloadSimple, ArrowRight } from "@phosphor-icons/react";
import ModelManager from "./ModelManager.jsx";

export default function AiSetupModal({ onClose }) {
  function finish() {
    localStorage.setItem("lexicon:aiSetupDone", "true");
    onClose?.();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] h-auto w-full max-w-md flex-col overflow-hidden rounded-2xl border border-hairline bg-paper shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <p className="font-sans text-sm font-semibold text-ink">Set up Lexicon AI</p>
          <button
            type="button"
            onClick={finish}
            className="rounded p-1 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
            title="Skip for now"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <ModelManager mode="onboarding" renderFooter={renderFooter} />
        </div>
      </div>
    </div>
  );

  function renderFooter({ phase, wantBundle, useOllama, modelKey, status, handleDownload }) {
    return (
      <div className="mt-6 flex items-center justify-end gap-2 border-t border-hairline pt-4">
        <button
          type="button"
          onClick={finish}
          className="rounded px-3 py-2 font-sans text-sm text-muted transition-colors hover:text-ink"
        >
          Skip for now
        </button>
        {phase === "done" ? (
          <button
            type="button"
            onClick={finish}
            className="flex items-center gap-1.5 rounded bg-pale-blue-text px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-pale-blue-text/90"
          >
            Continue <ArrowRight size={16} weight="bold" />
          </button>
        ) : wantBundle ? (
          phase === "downloading" ? (
            <button
              type="button"
              disabled
              className="flex cursor-not-allowed items-center gap-1.5 rounded bg-pale-blue-text/60 px-4 py-2 font-sans text-sm font-medium text-white/80"
            >
              <DownloadSimple size={16} weight="bold" /> Downloading…
            </button>
          ) : status.models_ready?.[modelKey] ? (
            <button
              type="button"
              onClick={finish}
              className="flex items-center gap-1.5 rounded bg-pale-blue-text px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-pale-blue-text/90"
            >
              Continue <ArrowRight size={16} weight="bold" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-1.5 rounded bg-pale-blue-text px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-pale-blue-text/90"
            >
              <DownloadSimple size={16} weight="bold" /> Download & enable
            </button>
          )
        ) : useOllama ? (
          <button
            type="button"
            onClick={finish}
            className="flex items-center gap-1.5 rounded bg-pale-blue-text px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-pale-blue-text/90"
          >
            Continue <ArrowRight size={16} weight="bold" />
          </button>
        ) : (
          <button
            type="button"
            onClick={finish}
            className="rounded border border-hairline bg-canvas px-4 py-2 font-sans text-sm font-medium text-ink transition-colors hover:border-muted"
          >
            Continue
          </button>
        )}
      </div>
    );
  }
}
