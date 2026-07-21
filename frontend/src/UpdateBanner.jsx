import { ArrowUp, CircleNotch } from "@phosphor-icons/react";

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

export default function UpdateBanner({ status, progress, update, onClick }) {
  const description = updateDescription(update);
  const versionTag = displayVersion(update?.version);

  if (status === "installing") {
    const total = progress?.total || 0;
    const downloaded = progress?.downloaded || 0;
    const phase = progress?.phase || "downloading";
    const percent =
      total > 0 ? Math.min(100, Math.round((downloaded / total) * 100)) : null;

    let label = "Downloading update…";
    if (phase === "preparing") {
      label = "Preparing update…";
    } else if (phase === "installing") {
      label = "Installing & restarting…";
    } else if (percent !== null) {
      label = `Downloading ${percent}%`;
    }

    return (
      <div
        className="lex-no-print inline-flex items-center gap-2 rounded-full border border-pale-blue bg-pale-blue px-3 py-1 font-sans text-[11px] font-medium text-pale-blue-text shadow-sm"
        title="Installing update"
      >
        <CircleNotch size={13} weight="bold" className="animate-spin text-pale-blue-text" />
        <span>{label}</span>
        {phase === "downloading" && percent !== null && (
          <div className="h-1.5 w-12 overflow-hidden rounded-full bg-pale-blue-text/20">
            <div
              className="h-full bg-pale-blue-text transition-all duration-200"
              style={{ width: `${percent}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="lex-no-print inline-flex items-center gap-1.5 rounded-full border border-pale-blue bg-pale-blue px-2.5 py-1 font-sans text-[11px] font-medium text-pale-blue-text transition-colors hover:bg-pale-blue/80 shadow-sm"
      title={description}
      aria-label={`Update Lexicon: ${description}`}
    >
      <ArrowUp size={13} weight="bold" />
      {versionTag ? `${versionTag} available` : "Update available"}
    </button>
  );
}
