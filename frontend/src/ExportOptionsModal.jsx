import { useEffect, useState, useRef } from "react";
import { X, Printer, DownloadSimple, PaintBrush, MagicWand, CircleNotch, Stop } from "@phosphor-icons/react";
import {
  EXPORT_THEMES,
  getThemeById,
  applyPrintTheme,
  buildExportHtml,
} from "./exportThemes.js";
import { downloadBlob } from "./download.js";
import { transformText } from "./api.js";

const AI_PRESET_PROMPTS = [
  { label: "Navy Headings", prompt: "Make headings dark navy blue with a subtle bottom border." },
  { label: "Double Spaced", prompt: "Set double line spacing for paragraphs with half-inch first-line indents." },
  { label: "Legal Brief", prompt: "Format as a legal brief with justified text, 1.5 line spacing, and prominent section headers." },
  { label: "Callout Cards", prompt: "Style blockquotes as soft amber callout boxes with left accent borders." },
];

export default function ExportOptionsModal({ editor, mode, onClose }) {
  const [themeId, setThemeId] = useState("");
  const [customCss, setCustomCss] = useState("");
  const [busy, setBusy] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState("");
  const [generationTime, setGenerationTime] = useState(0);
  const abortRef = useRef(null);

  useEffect(() => {
    let interval;
    if (aiGenerating) {
      setGenerationTime(0);
      interval = setInterval(() => {
        setGenerationTime((t) => t + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [aiGenerating]);

  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") {
        if (aiGenerating) {
          handleCancelAiGenerateCss();
        } else {
          onClose?.();
        }
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, aiGenerating]);

  const handleCancelAiGenerateCss = () => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setAiGenerating(false);
    setAiError("Style generation cancelled.");
  };

  const getAiStatusText = (seconds) => {
    if (seconds < 3) return "Parsing style instructions...";
    if (seconds < 7) return "Drafting custom CSS rules...";
    if (seconds < 12) return "Refining typography & layout...";
    return `Finalizing document styles (${seconds}s)...`;
  };

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

  async function handleAiGenerateCss(userPromptOverride) {
    const targetPrompt = userPromptOverride || aiPrompt;
    if (!targetPrompt.trim() || aiGenerating) return;
    setAiGenerating(true);
    setAiError("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const systemInstruction =
        "You are Lex, a document styling engine. Generate ONLY clean, valid CSS rules for rich text documents inside a .ProseMirror container based on the user's styling request. Target selectors such as .ProseMirror, .ProseMirror h1, .ProseMirror h2, .ProseMirror h3, .ProseMirror p, .ProseMirror blockquote, .ProseMirror table, .ProseMirror pre. Output ONLY raw CSS lines. Do NOT include markdown code blocks, explanation text, or triple backticks.";

      const res = await transformText({
        prompt: systemInstruction,
        text: targetPrompt.trim(),
        signal: controller.signal,
      });

      let generated = (res?.text || "").trim();
      // Clean up markdown block quotes if returned by LLM
      generated = generated
        .replace(/^```css\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/g, "")
        .trim();

      if (generated) {
        setCustomCss((prev) => (prev ? `${prev}\n\n/* Lex Style: ${targetPrompt} */\n${generated}` : generated));
        if (!userPromptOverride) setAiPrompt("");
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      setAiError(err?.message || "Could not generate CSS. Ensure Lex's engine is running or type custom CSS below.");
    } finally {
      abortRef.current = null;
      setAiGenerating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="lex-scroll flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div>
            <h2 className="font-serif text-lg font-medium text-ink">
              {isPdf ? "Export PDF" : "Export HTML"}
            </h2>
            <p className="font-sans text-xs text-muted">
              Choose a design preset or enter custom styling rules.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded p-1 text-muted transition-colors hover:bg-hairline/60 hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Print Theme
          </p>

          <div className="mt-2.5 flex flex-col gap-2">
            {EXPORT_THEMES.map((t) => {
              const active = themeId === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeId(t.id)}
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

          {/* Lex Style Assistant */}
          <div className="mt-5 rounded-xl border border-hairline bg-hairline/20 p-3.5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-ink">
                <PaintBrush size={13} weight="bold" className="text-ink" />
                Ask Lex to Style Your Document
              </span>
              <span className="font-sans text-[10px] text-muted">Offline Engine</span>
            </div>
            <p className="mt-1 font-sans text-xs text-muted">
              Describe how you want your document formatted:
            </p>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAiGenerateCss();
                  }
                }}
                placeholder="e.g. Dark navy headings with 1.5 line spacing..."
                className="flex-1 rounded-lg border border-hairline bg-white px-3 py-1.5 font-sans text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink"
              />
              {aiGenerating ? (
                <button
                  type="button"
                  onClick={handleCancelAiGenerateCss}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-900 px-3 py-1.5 font-sans text-xs font-medium text-white transition-colors hover:bg-amber-950"
                >
                  <Stop size={14} weight="bold" />
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => handleAiGenerateCss()}
                  disabled={!aiPrompt.trim()}
                  className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 font-sans text-xs font-medium text-white transition-colors hover:bg-ink/90 disabled:opacity-40"
                >
                  <MagicWand size={14} weight="bold" />
                  Style
                </button>
              )}
            </div>

            {/* Live Generation Progress Indicator */}
            {aiGenerating && (
              <div className="mt-2.5 rounded-lg border border-hairline bg-white/90 p-2.5 shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="flex items-center justify-between font-mono text-[11px] text-ink">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CircleNotch size={13} weight="bold" className="animate-spin text-ink" />
                    {getAiStatusText(generationTime)}
                  </span>
                  <span className="font-mono text-[10px] text-muted">{generationTime}s</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-hairline/40 lex-progress-slide-bar" />
              </div>
            )}

            {/* Quick Presets Chips - Single 4-Column Grid Row */}
            <div className="mt-2.5 grid grid-cols-4 gap-1.5">
              {AI_PRESET_PROMPTS.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => {
                    setAiPrompt(chip.prompt);
                    setAiError("");
                  }}
                  disabled={aiGenerating}
                  className="truncate rounded-lg border border-hairline bg-white px-2 py-1.5 text-center font-sans text-[11px] font-medium text-ink transition-colors hover:border-ink hover:bg-hairline/40 disabled:opacity-40"
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {aiError && (
              <p className="mt-2 font-sans text-[11px] text-amber-800">
                {aiError}
              </p>
            )}
          </div>

          <p className="mt-4 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-muted">
            Custom CSS <span className="normal-case">(optional)</span>
          </p>
          <textarea
            value={customCss}
            onChange={(event) => setCustomCss(event.target.value)}
            rows={3}
            spellCheck={false}
            placeholder={
              aiGenerating
                ? "/* Lex is drafting custom CSS rules... */"
                : "/* e.g. .ProseMirror p { color: #333; } */"
            }
            className={`mt-1.5 w-full resize-y rounded-xl border border-hairline bg-white px-3.5 py-2.5 font-mono text-xs text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-ink ${
              aiGenerating ? "animate-pulse border-hairline/80 bg-hairline/10" : ""
            }`}
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
