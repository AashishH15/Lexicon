import { useEffect } from "react";
import { X } from "@phosphor-icons/react";
import { TEMPLATES } from "./templates.js";

export default function TemplateGalleryModal({
  editor,
  onRequestConfirm,
  onClose,
}) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleSelect(template) {
    if (!editor) return;
    const apply = () => {
      editor.commands.setContent(template.html);
      onClose?.();
    };
    if (editor.isEmpty) {
      apply();
    } else if (onRequestConfirm) {
      onRequestConfirm({
        title: "Replace Document?",
        message: `Loading the ${template.name} template will permanently replace your current document. Do you want to continue?`,
        confirmLabel: `Load ${template.name}`,
        variant: "warning",
        onConfirm: apply,
      });
    } else {
      apply();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-xs">
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-gallery-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <div className="flex items-center gap-2">
            <span id="template-gallery-title" className="font-serif text-lg font-medium text-ink">
              Document Templates
            </span>
            <span className="rounded bg-hairline/60 px-2 py-0.5 font-mono text-[11px] font-medium text-muted">
              {TEMPLATES.length} starters
            </span>
          </div>
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
        <div className="lex-scroll grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-y-auto px-6 py-6 sm:grid-cols-2">
          {TEMPLATES.map((template) => {
            const Icon = template.icon;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => handleSelect(template)}
                className="group flex flex-col rounded-xl border border-hairline bg-white p-5 text-left transition-colors hover:border-muted focus-visible:ring-1 focus-visible:ring-ink"
              >
                <div className="flex items-center gap-3">
                  <span className="rounded-lg bg-hairline/60 p-2 text-ink">
                    <Icon size={20} weight="bold" />
                  </span>
                  <span className="font-serif text-base font-medium text-ink">
                    {template.name}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-hairline/40 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
                  {template.description}
                </p>
                <div
                  className="mt-3 flex-1 overflow-hidden rounded-lg border border-hairline bg-canvas px-4 py-3 text-left [&_h1]:font-serif [&_h1]:text-sm [&_h1]:font-medium [&_h1]:text-ink [&_h2]:mt-2 [&_h2]:font-serif [&_h2]:text-xs [&_h2]:font-medium [&_h2]:text-ink [&_p]:mt-1 [&_p]:font-sans [&_p]:text-[11px] [&_p]:leading-snug [&_p]:text-muted [&_blockquote]:border-l [&_blockquote]:border-hairline [&_blockquote]:pl-2 [&_blockquote]:italic [&_blockquote]:text-muted [&_hr]:my-1 [&_hr]:border-hairline"
                  dangerouslySetInnerHTML={{ __html: template.preview }}
                />
                <span className="mt-3 inline-block self-start font-mono text-[10px] uppercase tracking-[0.08em] text-muted transition-colors group-hover:text-ink">
                  Load template &rarr;
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
