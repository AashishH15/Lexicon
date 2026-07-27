import React from "react";
import { Warning, ArrowCounterClockwise, X } from "@phosphor-icons/react";

export default function ConfirmModal({
  isOpen,
  title = "Are you sure?",
  message,
  confirmLabel = "Continue",
  cancelLabel = "Cancel",
  variant = "warning",
  onConfirm,
  onClose,
}) {
  if (!isOpen) return null;

  const iconMap = {
    warning: <Warning size={20} weight="bold" className="text-amber-600" />,
    danger: <Warning size={20} weight="bold" className="text-red-600" />,
    primary: <ArrowCounterClockwise size={20} weight="bold" className="text-pale-blue-text" />,
  };

  const buttonVariantMap = {
    warning: "bg-ink hover:bg-ink/90 text-white shadow-xs",
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-xs",
    primary: "bg-ink hover:bg-ink/90 text-white shadow-xs",
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 backdrop-blur-md px-4 transition-all duration-200"
      style={{ backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-xl border border-hairline bg-white p-5 shadow-2xl lex-card-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-hairline bg-canvas">
              {iconMap[variant] || iconMap.warning}
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-ink">{title}</h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted transition-transform duration-200 hover:scale-110 hover:text-ink"
            aria-label="Close dialog"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
          {message}
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-hairline bg-canvas px-3.5 py-1.5 font-sans text-xs font-medium text-muted transition-colors hover:bg-hairline/50 hover:text-ink"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm?.();
              onClose();
            }}
            className={`rounded-lg px-4 py-1.5 font-sans text-xs font-medium transition-colors ${buttonVariantMap[variant] || buttonVariantMap.warning}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
