import { useEffect, useRef, useState } from "react";
import { Cpu, DownloadSimple } from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";
import {
  getAiStatus,
  downloadModel,
  getModelStatus,
  cancelModelDownload,
  deleteModel,
  setAiPreference,
} from "./api.js";

const MODEL_TIERS = [
  { key: "2b", label: "Standard", detail: "Best balance of quality and size. ~1.4 GB." },
  { key: "0.8b", label: "Light", detail: "Smallest and fastest, near-lossless quality. ~0.8 GB." },
];

// Advisory only: bias toward the lighter model on weak hardware. The user's
// choice is the source of truth, never forced.
function adviseModelKey() {
  const ram = navigator.deviceMemory; // GB, coarse, Chromium-only
  if (typeof ram === "number" && ram > 0 && ram < 8) return "0.8b";
  return "2b";
}

function describeActive(status) {
  const pref = status.preference || { backend: "auto", model_key: "2b" };
  if (pref.backend === "ollama") {
    return {
      tone: "ollama",
      text: status.ollama_available
        ? "Using your Ollama server"
        : "Using your Ollama server (not detected — will fall back)",
    };
  }
  if (pref.backend === "bundled") {
    const label = MODEL_TIERS.find((t) => t.key === pref.model_key)?.label;
    if (label && status.models_ready?.[pref.model_key]) {
      return { tone: "bundled", text: `Using local model · ${label}` };
    }
    return { tone: "none", text: "Not configured — download a model or connect Ollama" };
  }
  const autoKey = status.model_key;
  const autoLabel = MODEL_TIERS.find((t) => t.key === autoKey)?.label;
  if (autoLabel && status.models_ready?.[autoKey]) {
    return { tone: "bundled", text: `Using local model · ${autoLabel}` };
  }
  return { tone: "none", text: "Not configured — download a model or connect Ollama" };
}

function ActiveStatus({ status }) {
  const { tone, text } = describeActive(status);
  const dot =
    tone === "ollama"
      ? "bg-pale-blue-text"
      : tone === "bundled"
        ? "bg-pale-green-text"
        : "bg-muted";
  return (
    <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2">
      <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
      <span className="font-sans text-xs text-ink">{text}</span>
    </div>
  );
}

/**
 * Shared AI-model management surface used by both the first-run onboarding
 * modal and the Settings "AI Model" section. Owns all download/delete/cancel
 * state and the Ollama toggle, and persists the user's choice via
 * onPreferenceChange (so it survives restart and drives get_backend()).
 *
 * Props:
 *  - mode: "onboarding" | "settings"
 *  - onPreferenceChange(pref): called when a choice is committed
 *  - renderFooter(api): returns the action buttons (parent-owned chrome)
 */
export default function ModelManager({ mode = "onboarding", onPreferenceChange, renderFooter }) {
  const [status, setStatus] = useState({
    ollama_available: false,
    models_ready: {},
    model_key: "2b",
    active_backend: "bundled",
    preference: { backend: "auto", model_key: "2b" },
  });
  const [probeDone, setProbeDone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [wantBundle, setWantBundle] = useState(mode === "settings");
  const [modelKey, setModelKey] = useState(adviseModelKey());
  const [phase, setPhase] = useState("choose"); // choose | downloading | done | error
  const [progress, setProgress] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const userPickedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (!userPickedRef.current && s.model_key) setModelKey(s.model_key);
      })
      .catch(() => {
        if (!cancelled)
          setStatus({
            ollama_available: false,
            models_ready: {},
            model_key: "2b",
            active_backend: "bundled",
            preference: { backend: "auto", model_key: "2b" },
          });
      })
      .finally(() => {
        if (!cancelled) setProbeDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [mode]);

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
        const st = await getModelStatus(modelKey);
        setProgress({ bytes_done: st.bytes_done, bytes_total: st.bytes_total });
        if (st.state === "ready") {
          stopPolling();
          refreshStatus();
          setPhase("done");
          if (onPreferenceChange) onPreferenceChange({ backend: "bundled", model_key: modelKey });
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

  async function refreshStatus() {
    try {
      const s = await getAiStatus();
      setStatus(s);
    } catch {
      /* best-effort */
    }
  }

  async function handleDownload() {
    if (phase === "downloading") return;
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
      await deleteModel(modelKey);
    } catch {
      /* best-effort */
    }
    refreshStatus();
    setPhase("choose");
    setProgress(null);
  }

  async function handleDelete(key) {
    setDeletingKey(key);
    try {
      await deleteModel(key);
      setStatus((s) => ({
        ...s,
        models_ready: { ...(s.models_ready || {}), [key]: false },
      }));
      refreshStatus();
      setPhase("choose");
      setProgress(null);
    } catch (exc) {
      setError(exc.message || "Delete failed.");
    } finally {
      setDeletingKey(null);
    }
  }

  async function commitOllama(on) {
    if (on) {
      setWantBundle(false);
      if (onPreferenceChange) await onPreferenceChange({ backend: "ollama", model_key: modelKey });
      refreshStatus();
    } else if (onPreferenceChange) {
      await onPreferenceChange({ backend: "bundled", model_key: modelKey });
      refreshStatus();
    }
  }

  const ollamaAvailable = status.ollama_available;

  return (
    <div>
      {mode === "onboarding" && (
        <>
          {/* Hero */}
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
                if (v) commitOllama(false);
              }}
              label="Download the Lexicon model"
            />
          </div>
        </>
      )}

      {/* Active backend readout — gated on probeDone so we don't flash the
          stale default ("Not configured") before the real status arrives. */}
      {probeDone ? (
        <ActiveStatus status={status} />
      ) : (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2">
          <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-muted" />
          <span className="animate-pulse font-mono text-[10px] uppercase tracking-widest text-muted">
            Checking AI status…
          </span>
        </div>
      )}

      {(wantBundle || mode === "settings") && (
        <div className={mode === "settings" ? "grid grid-cols-2 gap-2" : "mt-3 grid grid-cols-2 gap-2"}>
          {MODEL_TIERS.map((tier) => {
            const selected = modelKey === tier.key;
            const ready = status.models_ready?.[tier.key];
            const downloading = phase === "downloading";
            return (
              <div
                key={tier.key}
                role="button"
                tabIndex={downloading ? -1 : 0}
                aria-pressed={selected}
                onClick={() => {
                  if (downloading) return;
                  userPickedRef.current = true;
                  setModelKey(tier.key);
                  // In settings, selecting an installed tier makes it active.
                  if (mode === "settings" && status.models_ready?.[tier.key]) {
                    if (onPreferenceChange)
                      onPreferenceChange({ backend: "bundled", model_key: tier.key });
                    refreshStatus();
                  }
                }}
                onKeyDown={(e) => {
                  if (downloading) return;
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    userPickedRef.current = true;
                    setModelKey(tier.key);
                    if (mode === "settings" && status.models_ready?.[tier.key]) {
                      if (onPreferenceChange)
                        onPreferenceChange({ backend: "bundled", model_key: tier.key });
                      refreshStatus();
                    }
                  }
                }}
                className={
                  "rounded-lg border px-3 py-2 text-left transition-colors " +
                  (selected
                    ? "border-pale-blue-text bg-pale-blue/40"
                    : "border-hairline bg-canvas hover:border-muted") +
                  (downloading ? " cursor-not-allowed opacity-50" : " cursor-pointer")
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
                    <button
                      type="button"
                      disabled={deletingKey === tier.key}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tier.key);
                      }}
                      className={
                        "cursor-pointer rounded border px-2 py-1 font-sans text-[11px] transition-colors " +
                        (deletingKey === tier.key
                          ? "cursor-wait border-hairline text-muted animate-pulse"
                          : "border-hairline text-pale-red-text hover:border-pale-red-text")
                      }
                    >
                      {deletingKey === tier.key ? "Deleting…" : "Delete"}
                    </button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Settings-only action row: the onboarding modal supplies its own
          footer button, but Settings has no footer, so surface the download
          trigger here. */}
      {mode === "settings" && phase !== "downloading" && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="font-sans text-[11px] text-muted">
            {status.models_ready?.[modelKey]
              ? `${MODEL_TIERS.find((t) => t.key === modelKey)?.label} is installed and active.`
              : "No model downloaded yet. AI tools won't run until you download one!"}
          </p>
          {!status.models_ready?.[modelKey] && (
            <button
              type="button"
              onClick={handleDownload}
              className="flex shrink-0 items-center gap-1.5 rounded bg-pale-blue-text px-3 py-2 font-sans text-sm font-medium text-white transition-colors hover:bg-pale-blue-text/90"
            >
              <DownloadSimple size={16} weight="bold" />
              Download &amp; enable
            </button>
          )}
        </div>
      )}

      {/* Download progress */}
      {phase === "downloading" && (
        <div className={mode === "settings" ? "mt-4" : "mt-4"}>
          <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
            <div
              className={
                "h-full rounded-full bg-pale-blue-text transition-all duration-300 " +
                (progress && progress.bytes_total ? "" : "animate-pulse")
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
                  checked={status.preference?.backend === "ollama"}
                  disabled={!probeDone || !ollamaAvailable}
                  onChange={(e) => commitOllama(e.target.checked)}
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

      {renderFooter &&
        renderFooter({
          phase,
          wantBundle,
          modelKey,
          status,
          handleDownload,
        })}
    </div>
  );
}
