import { useMemo } from "react";
import { X, ArrowUp } from "@phosphor-icons/react";
import { marked } from "marked";

function displayVersion(version) {
  const normalized = String(version || "").replace(/^v/i, "");
  return normalized ? `v${normalized}` : "";
}

export default function UpdateModal({ update, onClose, onInstall }) {
  const versionStr = displayVersion(update?.version);
  const notes = update?.body || update?.notes || "No release details provided.";

  const htmlContent = useMemo(() => {
    if (!notes) return "";
    try {
      return marked.parse(notes, { gfm: true, breaks: true });
    } catch {
      return notes;
    }
  }, [notes]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] h-auto w-full max-w-md flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl">
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <p className="font-sans text-sm font-semibold text-ink">
            Update available {versionStr ? `(${versionStr})` : ""}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
            aria-label="Close"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5 font-sans text-sm text-ink leading-relaxed">
          <p className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted font-semibold">
            Release Notes
          </p>
          <div
            className="lex-release-notes rounded-lg bg-hairline/30 p-3 font-sans text-xs text-ink/90 border border-hairline/50 overflow-x-auto space-y-2 [&_h1]:font-bold [&_h1]:text-sm [&_h1]:mt-2 [&_h1]:mb-1 [&_h2]:font-bold [&_h2]:text-xs [&_h2]:mt-2 [&_h2]:mb-1 [&_h3]:font-semibold [&_h3]:text-xs [&_h3]:mt-2 [&_h3]:mb-1 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_p]:my-1 [&_code]:bg-hairline/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:font-mono [&_code]:text-[11px] [&_pre]:bg-hairline/60 [&_pre]:p-2 [&_pre]:rounded [&_pre]:overflow-x-auto"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded px-3 py-2 font-sans text-sm text-muted transition-colors hover:text-ink"
          >
            Remind me later
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onInstall();
            }}
            className="flex items-center gap-1.5 rounded bg-pale-blue-text px-4 py-2 font-sans text-sm font-medium text-white shadow-sm transition-colors hover:bg-pale-blue-text/90"
          >
            <ArrowUp size={16} weight="bold" /> Update & restart
          </button>
        </div>
      </div>
    </div>
  );
}
