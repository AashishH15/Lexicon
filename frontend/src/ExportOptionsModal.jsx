import { useEffect, useState } from "react";
import { X, Printer, DownloadSimple } from "@phosphor-icons/react";
import {
  EXPORT_THEMES,
  getThemeById,
  applyPrintTheme,
  buildExportHtml,
} from "./exportThemes.js";
import { downloadBlob } from "./download.js";

export default function ExportOptionsModal({ editor, mode, onClose }) {
  const [themeId, setThemeId] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const isPdf = mode === "pdf";
  const theme = getThemeById(themeId);
  const css = [theme?.css, customCss].filter(Boolean).join("\n");

  async function handleExport() {
    if (!editor || busy) return;
    setBusy(true);
    try {
      if (isPdf) {
        if (css) {
          applyPrintTheme(css);
        } else {
          window.print();
        }
      } else {
        const html = await buildExportHtml(editor.getHTML(), css);
        downloadBlob(html, "document.html", "text/html");
      }
      onClose?.();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <span className="font-serif text-lg font-medium text-ink">
            {isPdf ? "Export PDF" : "Export HTML"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
            title="Close"
            aria-label="Close dialog"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Print Theme
          </p>
          <div className="mt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setThemeId("")}
              className={
                "rounded-xl border px-4 py-2.5 text-left transition-colors " +
                (themeId === ""
                  ? "border-ink bg-white ring-1 ring-ink"
                  : "border-hairline bg-white hover:border-muted")
              }
            >
              <span className="block font-sans text-sm font-medium text-ink">
                None (app default)
              </span>
              <span className="block font-sans text-xs text-muted">
                The editor&rsquo;s built-in print styling, no theme overrides.
              </span>
            </button>
            {EXPORT_THEMES.map((t) => {
              const active = themeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
                  aria-pressed={active}
                  className={
                    "rounded-xl border px-4 py-2.5 text-left transition-colors " +
                    (active
                      ? "border-ink bg-white ring-1 ring-ink"
                      : "border-hairline bg-white hover:border-muted")
                  }
                >
                  <span className="block font-sans text-sm font-medium text-ink">
                    {t.name}
                  </span>
                  <span className="block font-sans text-xs leading-relaxed text-muted">
                    {t.description}
                  </span>
                </button>
              );
            })}
          </div>

          {isPdf && (
            <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
              <span className="block font-semibold text-amber-950 mb-0.5">
                💡 Tip for Selectable PDF Text:
              </span>
              <span className="block text-amber-900/90">
                In the print window, choose <strong>&ldquo;Save as PDF&rdquo;</strong> (or the <strong>PDF ▾</strong> menu on Mac). This ensures your exported document has 100% highlightable, vector-sharp text.
              </span>
            </div>
          )}

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Custom CSS <span className="normal-case">(optional)</span>
          </p>
          <textarea
            value={customCss}
            onChange={(event) => setCustomCss(event.target.value)}
            rows={3}
            spellCheck={false}
            placeholder="/* e.g. .ProseMirror p { color: #333; } */"
            className="mt-1.5 w-full resize-y rounded-xl border border-hairline bg-white px-3.5 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink"
          />
          <p className="mt-1 font-sans text-[11px] leading-relaxed text-muted">
            Injected on top of the selected theme for this export only. Applies
            to
            {isPdf ? " printed output" : " the exported HTML file"}.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-hairline px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="font-sans text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={busy}
            className="flex items-center gap-2 rounded-lg bg-ink px-4 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-50"
          >
            {isPdf ? (
              <Printer size={16} weight="bold" />
            ) : (
              <DownloadSimple size={16} weight="bold" />
            )}
            {isPdf
              ? busy
                ? "Printing…"
                : "Print / Save as PDF"
              : busy
                ? "Building…"
                : "Download HTML"}
          </button>
        </div>
      </div>
    </div>
  );
}
