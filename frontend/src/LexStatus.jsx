import { LEX_STATUS, LEX_STATUS_META, lexStatusMessage } from "./lexStatus.js";

export default function LexStatus({
  status,
  message,
  issueCount = 0,
  showLabel = true,
  showCount = true,
  className = "",
}) {
  const meta = LEX_STATUS_META[status] || LEX_STATUS_META.idle;
  const label = message || lexStatusMessage(status, { issueCount });
  const count = status === "issues" && issueCount > 0 ? issueCount : null;
  const accessibleLabel =
    status === LEX_STATUS.ISSUES && count !== null
      ? `Lex found ${count} ${count === 1 ? "issue" : "issues"}.`
      : meta.ariaLabel;

  return (
    <div
      className={`lex-status inline-flex min-w-0 items-center gap-2 ${className}`}
      data-lex-status={status}
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-busy={Boolean(meta.busy)}
      aria-label={accessibleLabel}
      title={label}
    >
      <span
        className={`lex-status-mark flex h-7 w-7 shrink-0 items-center justify-center ${
          meta.busy ? "lex-status-working" : ""
        }`}
        aria-hidden="true"
      >
        <img
          src={meta.icon}
          alt=""
          className="block h-full w-full object-contain"
        />
      </span>
      {showLabel && (
        <span className="truncate font-sans text-xs text-muted">{label}</span>
      )}
      {showCount && count !== null && (
        <span className="shrink-0 rounded-full bg-pale-red px-1.5 py-0.5 font-mono text-[10px] font-semibold text-pale-red-text">
          {count}
        </span>
      )}
    </div>
  );
}
