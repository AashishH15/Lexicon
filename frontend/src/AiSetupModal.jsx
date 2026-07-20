import { useEffect, useRef, useState } from "react";
import { X, DownloadSimple, ArrowRight, Cpu } from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";
import { getAiStatus, downloadModel, getModelStatus } from "./api.js";

const AI_SETUP_KEY = "lexicon:aiSetupDone";
// Model tiers offered in the bundle opt-in. 2B is the quality default; 0.8B
// is the lighter/faster fallback for weaker hardware. (A 4B "Pro" tier is
// deferred until the backend can report GPU capability — see discussion.)
const MODEL_TIERS = [
  { key: "2b", label: "Standard", detail: "Best balance of quality and size. ~1.4 GB." },
  { key: "0.8b", label: "Light", detail: "Smallest and fastest, near-lossless quality. ~0.8 GB." },
];
// Advisory only: bias toward the lighter model when the browser reports
// constrained RAM. The user's choice is the source of truth, never forced.
function adviseModelKey() {
  const ram = navigator.deviceMemory; // GB, coarse, Chromium-only
  if (typeof ram === "number" && ram > 0 && ram < 8) return "0.8b";
  return "2b";
}

export default function AiSetupModal({ onClose }) {
  const [status, setStatus] = useState({
    ollama_available: false,
    models_ready: {},
    model_key: "2b",
    active_backend: "bundled",
  });
  const [probeDone, setProbeDone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [wantBundle, setWantBundle] = useState(false); // opt-in, OFF by default
  const [useOllama, setUseOllama] = useState(false);
  // Pre-select the advisory tier, but let the probe's default override it once
  // we know the backend's preferred key.
  const [modelKey, setModelKey] = useState(adviseModelKey());
  const [phase, setPhase] = useState("choose"); // choose | downloading | done | error
  const [progress, setProgress] = useState(null); // {bytes_done, bytes_total}
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  // Becomes true the first time the user clicks a tier card, so a late probe
  // response can't override their selection (see mount effect below).
  const userPickedRef = useRef(false);

  // Probe backend state once on mount. Render immediately with a safe default
  // (no Ollama assumed) so the modal appears at once; fill in the real status
  // when the backend responds, rather than showing nothing until then.
  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((s) => {
        if (!cancelled) {
          setStatus(s);
          // Apply the backend's preferred default ONLY until the user makes
          // an explicit choice. Otherwise a late probe response can silently
          // reset a selected "Light" tier back to "Standard" mid-download.
          if (s.model_key && !userPickedRef.current) setModelKey(s.model_key);
        }
      })
      .catch(() => {
        if (!cancelled)
          setStatus({ ollama_available: false, models_ready: {}, model_key: "2b", active_backend: "bundled" });
      })
      .finally(() => {
        if (!cancelled) setProbeDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        // Poll the *selected* key so switching tiers can't make the bar
        // flicker between different models' sizes.
        const st = await getModelStatus(modelKey);
        setProgress({ bytes_done: st.bytes_done, bytes_total: st.bytes_total });
        if (st.state === "ready") {
          stopPolling();
          refreshStatus();
          setPhase("done");
        } else if (st.state === "error") {
          stopPolling();
          setPhase("error");
          setError(st.error || "Download failed.");
        } else if (st.state === "cancelled") {
          stopPolling();
          setPhase("choose");
        }
      } catch {
        // ignore transient poll errors; next tick retries
      }
    }, 500);
  }

  // Re-read backend status (per-key readiness) so the "installed" tags and
  // the ability to switch/delete stay in sync after a download or delete.
  async function refreshStatus() {
    try {
      const s = await getAiStatus();
      setStatus(s);
    } catch {
      /* best-effort */
    }
  }

  async function handleDownload() {
    if (phase === "downloading") return; // ignore double-clicks / re-entry
    setPhase("downloading");
    setProgress({ bytes_done: 0, bytes_total: 0 });
    startPolling();
    try {
      await downloadModel(modelKey);
      const st = await getModelStatus(modelKey);
      setProgress({ bytes_done: st.bytes_done, bytes_total: st.bytes_total });
      stopPolling();
      refreshStatus();
      setPhase(st.state === "ready" ? "done" : "error");
      if (st.state !== "ready") setError(st.error || "Download did not complete.");
    } catch (exc) {
      stopPolling();
      setPhase("error");
      setError(exc.message || "Download failed.");
    }
  }

  async function handleCancel() {
    stopPolling();
    try {
      await cancelModelDownload();
      // Remove the partial file so the user is free to pick another tier.
      await deleteModel(modelKey);
    } catch {
      /* best-effort */
    }
    refreshStatus();
    setPhase("choose");
    setProgress(null);
  }

  async function handleDelete(key) {
    try {
      await deleteModel(key);
      refreshStatus();
    } catch (exc) {
      setError(exc.message || "Delete failed.");
    }
  }

  function finish() {
    localStorage.setItem(AI_SETUP_KEY, "true");
    stopPolling();
    onClose();
  }

  const ollamaAvailable = status?.ollama_available;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/20 px-4"
      onClick={finish}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-hairline bg-white lex-card-enter"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-hairline px-6 py-4">
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
            AI Setup
          </p>
          <button
            type="button"
            onClick={finish}
            className="text-muted transition-transform duration-200 hover:scale-110 hover:text-ink"
            aria-label="Skip for now"
            title="Skip for now"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="lex-scroll min-h-0 flex-1 overflow-y-auto px-6 py-6">
          {/* Hero: the Lexicon bundle */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-pale-blue/40">
              <Cpu size={18} weight="bold" className="text-pale-blue-text" />
            </div>
            <div>
              <p className="font-sans text-base font-semibold text-ink">
                Run AI on your own machine
              </p>
              <p className="mt-1 font-sans text-xs leading-relaxed text-muted">
                Lexicon can rewrite, tighten, and retune your writing with a
                small local model. Nothing leaves your computer — no account,
                no cloud. The model downloads once and lives in your app-data
                folder.
              </p>
            </div>
          </div>

          {/* Opt-in toggle (OFF by default) */}
          <div className="mt-6 flex items-center justify-between gap-4 rounded-lg border border-hairline bg-canvas px-4 py-3">
            <div>
              <p className="font-sans text-sm font-medium text-ink">
                Download the Lexicon model
              </p>
              <p className="mt-0.5 font-sans text-xs text-muted">
                Enables Rewrite, Tone, and Structure tools. Off until you turn
                it on.
              </p>
            </div>
            <Toggle
              checked={wantBundle}
              onChange={(v) => {
                setWantBundle(v);
                if (v) setUseOllama(false);
              }}
              label="Download the Lexicon model"
            />
          </div>

          {/* Model-size selector — only shown once the bundle is opted into.
              Advisory RAM pre-selection picks Light on weak machines, but the
              user's choice wins. 4B "Pro" tier is deferred (needs backend GPU
              reporting). Clicking a card selects it; the footer "Download &
              enable" starts the download. While downloading, the other card is
              locked until Cancel removes the partial file. An installed tier
              shows an "installed" tag and a Delete action. */}
          {wantBundle && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              {MODEL_TIERS.map((tier) => {
                const selected = modelKey === tier.key;
                const ready = status.models_ready?.[tier.key];
                const downloading = phase === "downloading";
                return (
                  <button
                    type="button"
                    key={tier.key}
                    disabled={downloading}
                    onClick={() => {
                      userPickedRef.current = true;
                      setModelKey(tier.key);
                    }}
                    className={
                      "rounded-lg border px-3 py-2 text-left transition-colors " +
                      (selected
                        ? "border-pale-blue-text bg-pale-blue/40"
                        : "border-hairline bg-canvas hover:border-muted") +
                      (downloading ? " cursor-not-allowed opacity-50" : "")
                    }
                  >
                    <span className="flex items-center justify-between">
                      <span className="font-sans text-sm font-medium text-ink">
                        {tier.label}
                      </span>
                      {ready && (
                        <span className="font-mono text-[9px] uppercase tracking-widest text-pale-green-text">
                          installed
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-sans text-[11px] text-muted">
                      {tier.detail}
                    </span>
                    {ready && (
                      <span className="mt-2 inline-block">
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(tier.key);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.stopPropagation();
                              handleDelete(tier.key);
                            }
                          }}
                          className="cursor-pointer rounded border border-hairline px-2 py-1 font-sans text-[11px] text-pale-red-text transition-colors hover:border-pale-red-text"
                        >
                          Delete
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Download progress (only while downloading) */}
          {phase === "downloading" && (
            <div className="mt-4">
              <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
                <div
                  className={
                    "h-full rounded-full bg-pale-blue-text transition-all duration-300 " +
                    (progress && progress.bytes_total
                      ? ""
                      : "animate-pulse")
                  }
                  style={{
                    width:
                      progress && progress.bytes_total
                        ? `${Math.min(100, (progress.bytes_done / progress.bytes_total) * 100)}%`
                        : "100%",
                  }}
                />
              </div>
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted">
                Downloading model…{" "}
                {progress && progress.bytes_total
                  ? `${Math.round(progress.bytes_done / 1e6)} / ${Math.round(progress.bytes_total / 1e6)} MB`
                  : `${Math.round((progress?.bytes_done || 0) / 1e6)} MB`}
              </p>
              <button
                type="button"
                onClick={handleCancel}
                className="mt-2 rounded border border-hairline px-2 py-1 font-sans text-[11px] text-muted transition-colors hover:border-muted hover:text-ink"
              >
                Cancel
              </button>
            </div>
          )}

          {phase === "error" && (
            <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-sans text-xs text-red-700">
              {error}
            </p>
          )}

          {phase === "done" && (
            <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 font-sans text-xs text-green-700">
              Model ready. AI tools are now enabled.
            </p>
          )}

          {/* Advanced: bring your own Ollama */}
          <div className="mt-6 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              aria-expanded={showAdvanced}
              className="font-mono text-[10px] uppercase tracking-widest text-muted transition-colors hover:text-ink"
            >
              {showAdvanced ? "▾ Advanced" : "▸ Advanced"}
            </button>
            <div
              className={
                "grid transition-all duration-300 ease-out " +
                (showAdvanced ? "mt-3 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")
              }
            >
              <div className="overflow-hidden">
                <div className="rounded-lg border border-hairline bg-canvas px-4 py-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={useOllama}
                      disabled={!probeDone || !ollamaAvailable}
                      onChange={(e) => {
                        setUseOllama(e.target.checked);
                        if (e.target.checked) setWantBundle(false);
                      }}
                      className="h-4 w-4 shrink-0 cursor-pointer accent-pale-blue-text"
                    />
                    <span>
                      <span className="font-sans text-sm font-medium text-ink">
                        Use my Ollama server
                      </span>
                      <span className="mt-0.5 block font-sans text-xs text-muted">
                        {ollamaAvailable
                          ? "Detected and ready. AI tools will use your existing Ollama models."
                          : "No Ollama server was detected on this machine."}
                      </span>
                    </span>
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2 border-t border-hairline px-6 py-4">
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
      </div>
    </div>
  );
}
