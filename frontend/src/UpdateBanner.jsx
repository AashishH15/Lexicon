import { ArrowUp } from "@phosphor-icons/react";

function displayVersion(version) {
  const normalized = String(version || "").replace(/^v/i, "");
  return normalized ? `v${normalized}` : "the latest version";
}

function updateDescription(update) {
  return (
    String(update?.body || update?.notes || "").replace(/\s+/g, " ").trim() ||
    `Lexicon ${displayVersion(update?.version)} is ready to install.`
  );
}

export default function UpdateBanner({ update, onInstall }) {
  const description = updateDescription(update);

  return (
    <button
      type="button"
      onClick={onInstall}
      className="lex-no-print inline-flex items-center gap-1.5 rounded-full border border-pale-blue bg-pale-blue px-2.5 py-1 font-sans text-[11px] font-medium text-pale-blue-text transition-colors hover:bg-pale-blue/80"
      title={description}
      aria-label={`Update Lexicon: ${description}`}
    >
      <ArrowUp size={13} weight="bold" />
      Update now
    </button>
  );
}
