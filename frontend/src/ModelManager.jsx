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

const OLLAMA_URL = "http://localhost:11434";
const DEFAULT_LM_STUDIO_URL = "http://localhost:1234";
const _EMBED_ONLY = ["nomic-embed-text", "mxbai-embed-large", "all-minilm"];

function normalizeLmStudioUrl(value) {
  let trimmed = String(value || "").trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/api/v1")) trimmed = trimmed.slice(0, -7);
  else if (trimmed.endsWith("/v1")) trimmed = trimmed.slice(0, -3);
  return trimmed || DEFAULT_LM_STUDIO_URL;
}

async function probeOllamaDirect() {
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!resp.ok) return { available: false, models: [] };
    const data = await resp.json();
    const models = (data.models || [])
      .map((m) => m.name)
      .filter((n) => !_EMBED_ONLY.some((e) => n.includes(e)));
    return { available: true, models };
  } catch {
    return { available: false, models: [] };
  }
}

// Advisory only: bias toward the lighter model on weak hardware. The user's
// choice is the source of truth, never forced.
function adviseModelKey() {
  const ram = navigator.deviceMemory; // GB, coarse, Chromium-only
  if (typeof ram === "number" && ram > 0 && ram < 8) return "0.8b";
  return "2b";
}

function describeActive(status) {
  const pref = status.preference || {
    backend: "auto",
    model_key: "2b",
    ollama_model: "",
    lmstudio_model: "",
    lmstudio_url: "",
  };
  if (pref.backend === "ollama") {
    const modelLabel = pref.ollama_model || "auto-detected";
    return {
      tone: "ollama",
      text: status.ollama_available
        ? `Using Ollama · ${modelLabel}`
        : "Using your Ollama server (not detected — will fall back)",
    };
  }
  if (pref.backend === "lmstudio") {
    const modelLabel = pref.lmstudio_model || "auto-detected";
    return {
      tone: "lmstudio",
      text: status.lmstudio_available
        ? `Using LM Studio · ${modelLabel}`
        : status.lmstudio_auth_required
          ? "LM Studio authentication required · enter an API token"
        : status.lmstudio_server_available
          ? status.lmstudio_models?.length
            ? "LM Studio server found · selected model loads on first use"
            : "LM Studio server found · no chat model is available"
          : "Using your LM Studio server (not detected — will fall back)",
    };
  }
  if (pref.backend === "bundled") {
    const label = MODEL_TIERS.find((t) => t.key === pref.model_key)?.label;
    if (label && status.models_ready?.[pref.model_key]) {
      return { tone: "bundled", text: `Using local model · ${label}` };
    }
    return {
      tone: "none",
      text: "Not configured — download a model or connect a local server",
    };
  }
  if (status.active_backend === "ollama") {
    return { tone: "ollama", text: "Using Ollama · auto-detected model" };
  }
  if (status.active_backend === "lmstudio") {
    return { tone: "lmstudio", text: "Using LM Studio · auto-detected model" };
  }
  const autoKey = status.model_key;
  const autoLabel = MODEL_TIERS.find((t) => t.key === autoKey)?.label;
  if (autoLabel && status.models_ready?.[autoKey]) {
    return { tone: "bundled", text: `Using local model · ${autoLabel}` };
  }
  return {
    tone: "none",
    text: "Not configured — download a model or connect a local server",
  };
}

function ActiveStatus({ status }) {
  const { tone, text } = describeActive(status);
  const dot =
    tone === "ollama"
      ? "bg-pale-blue-text"
      : tone === "lmstudio"
        ? "bg-pale-yellow-text"
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
 * Manage AI models in onboarding and Settings.
 *
 * This component manages model downloads, deletes, cancellations, and local
 * server choices. It saves each choice through onPreferenceChange.
 *
 * Props:
 *  - mode: "onboarding" or "settings"
 *  - onPreferenceChange(pref): called after a choice is saved
 *  - renderFooter(api): returns the action buttons
 */
export default function ModelManager({
  mode = "onboarding",
  onPreferenceChange,
  onConfigured,
  renderFooter,
}) {
  const [status, setStatus] = useState({
    ollama_available: false,
    lmstudio_available: false,
    lmstudio_server_available: false,
    lmstudio_auth_required: false,
    lmstudio_models: [],
    lmstudio_loaded_models: [],
    models_ready: {},
    model_key: "2b",
    active_backend: "bundled",
    preference: {
      backend: "auto",
      model_key: "2b",
      ollama_model: "",
      lmstudio_model: "",
      lmstudio_url: "",
      lmstudio_api_key_configured: false,
    },
  });
  const [probeDone, setProbeDone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(
    () => localStorage.getItem("lexicon:advanced-open") === "true"
  );
  const [wantBundle, setWantBundle] = useState(mode === "settings");
  const [ollamaModels, setOllamaModels] = useState([]);
  const [ollamaProbing, setOllamaProbing] = useState(true);
  const [selectedOllamaModel, setSelectedOllamaModel] = useState("");
  const [lmStudioModels, setLmStudioModels] = useState([]);
  const [lmStudioProbing, setLmStudioProbing] = useState(true);
  const [selectedLmStudioModel, setSelectedLmStudioModel] = useState("");
  const [lmStudioUrl, setLmStudioUrl] = useState(DEFAULT_LM_STUDIO_URL);
  const [lmStudioUrlDraft, setLmStudioUrlDraft] = useState(DEFAULT_LM_STUDIO_URL);
  const [lmStudioApiKeyDraft, setLmStudioApiKeyDraft] = useState("");
  const [lmStudioApiKeyConfigured, setLmStudioApiKeyConfigured] = useState(false);
  const [modelKey, setModelKey] = useState(adviseModelKey());
  const [phase, setPhase] = useState("choose"); // choose | downloading | done | error
  const [progress, setProgress] = useState(null);
  const [deletingKey, setDeletingKey] = useState(null);
  const [error, setError] = useState("");
  const pollRef = useRef(null);
  const userPickedRef = useRef(false);
  const lmStudioApiKeyChangedRef = useRef(false);
  const [openProvider, setOpenProvider] = useState(
    () => localStorage.getItem("lexicon:provider-open") || ""
  );

  function lmStudioApiKeyForSave() {
    return lmStudioApiKeyChangedRef.current ? lmStudioApiKeyDraft : null;
  }

  function toggleProvider(provider) {
    setOpenProvider((current) => {
      const next = current === provider ? "" : provider;
      localStorage.setItem("lexicon:provider-open", next);
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    getAiStatus()
      .then((s) => {
        if (cancelled) return;
        setStatus(s);
        if (s.ollama_models && s.ollama_models.length > 0) {
          setOllamaModels(s.ollama_models);
          if (!selectedOllamaModel) setSelectedOllamaModel(s.ollama_models[0]);
        }
        if (s.lmstudio_models && s.lmstudio_models.length > 0) {
          setLmStudioModels(s.lmstudio_models);
          if (!selectedLmStudioModel) setSelectedLmStudioModel(s.lmstudio_models[0]);
        }
        if (!userPickedRef.current && s.model_key) setModelKey(s.model_key);
        if (s.preference?.ollama_model) setSelectedOllamaModel(s.preference.ollama_model);
        if (s.preference?.lmstudio_model) {
          setSelectedLmStudioModel(s.preference.lmstudio_model);
        }
        const savedLmStudioUrl = normalizeLmStudioUrl(s.preference?.lmstudio_url || "");
        setLmStudioUrl(savedLmStudioUrl);
        setLmStudioUrlDraft(savedLmStudioUrl);
        setLmStudioApiKeyConfigured(
          Boolean(s.preference?.lmstudio_api_key_configured)
        );
        if (!lmStudioApiKeyChangedRef.current) setLmStudioApiKeyDraft("");
      })
      .catch(() => {
        if (!cancelled)
          setStatus({
            ollama_available: false,
            lmstudio_available: false,
            lmstudio_server_available: false,
            lmstudio_auth_required: false,
            lmstudio_models: [],
            lmstudio_loaded_models: [],
            models_ready: {},
            model_key: "2b",
            active_backend: "bundled",
            preference: {
              backend: "auto",
              model_key: "2b",
              ollama_model: "",
              lmstudio_model: "",
              lmstudio_url: "",
              lmstudio_api_key_configured: false,
            },
          });
      })
      .finally(() => {
        if (!cancelled) {
          setProbeDone(true);
          setLmStudioProbing(false);
        }
      });

    probeOllamaDirect().then((result) => {
      if (cancelled) return;
      if (result.models.length > 0) setOllamaModels(result.models);
      setOllamaProbing(false);
      if (result.available) {
        setStatus((prev) => ({ ...prev, ollama_available: true }));
        // Auto-select first model if none chosen yet
        if (!selectedOllamaModel && result.models.length > 0) {
          setSelectedOllamaModel(result.models[0]);
        }
      }
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
          if (onPreferenceChange) {
            onPreferenceChange({
              backend: "bundled",
              model_key: modelKey,
              lmstudio_url: lmStudioUrl,
              lmstudio_api_key: lmStudioApiKeyForSave(),
            });
          }
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
      if (s.ollama_models) setOllamaModels(s.ollama_models);
      if (s.lmstudio_models) setLmStudioModels(s.lmstudio_models);
      setLmStudioApiKeyConfigured(
        Boolean(s.preference?.lmstudio_api_key_configured)
      );
      if (s.preference?.lmstudio_url) {
        const savedLmStudioUrl = normalizeLmStudioUrl(s.preference.lmstudio_url);
        setLmStudioUrl(savedLmStudioUrl);
        setLmStudioUrlDraft(savedLmStudioUrl);
      }
      // Let the parent know a usable backend now exists (e.g. App can
      // un-grey the AI tools immediately, without waiting for modal close).
      const ready =
        s.preference?.backend === "ollama"
          ? s.ollama_available
          : s.preference?.backend === "lmstudio"
            ? s.lmstudio_available
            : Boolean(s.models_ready?.[s.preference?.model_key || s.model_key]);
      if (ready && onConfigured) onConfigured();
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
      const res = await downloadModel(modelKey);
      if (res && res.state === "cancelled") {
        stopPolling();
        setPhase("choose");
        return;
      }
      const st = await getModelStatus(modelKey);
      setProgress({ bytes_done: st.bytes_done, bytes_total: st.bytes_total });
      stopPolling();
      refreshStatus();
      if (st.state === "ready") {
        setPhase("done");
      } else if (st.state === "cancelled") {
        setPhase("choose");
      } else {
        setPhase("error");
        setError(st.error || "Download did not complete.");
      }
    } catch (exc) {
      stopPolling();
      if (exc.message && exc.message.toLowerCase().includes("cancelled")) {
        setPhase("choose");
      } else {
        setPhase("error");
        setError(exc.message || "Download failed.");
      }
    }
  }

  async function handleCancel() {
    stopPolling();
    try {
      await cancelModelDownload();
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

  async function checkLmStudio() {
    const nextUrl = normalizeLmStudioUrl(lmStudioUrlDraft);
    const nextModel = selectedLmStudioModel.trim();
    setLmStudioUrl(nextUrl);
    setLmStudioUrlDraft(nextUrl);
    setSelectedLmStudioModel(nextModel);
    setLmStudioProbing(true);
    setStatus((s) => ({
      ...s,
      lmstudio_available: false,
      lmstudio_server_available: false,
      lmstudio_auth_required: false,
      lmstudio_models: [],
      preference: {
        ...s.preference,
        lmstudio_model: nextModel,
        lmstudio_url: nextUrl,
      },
    }));
    try {
      if (onPreferenceChange) {
        await onPreferenceChange({
          backend: status.preference?.backend || "auto",
          model_key: modelKey,
          ollama_model: selectedOllamaModel,
          lmstudio_model: nextModel,
          lmstudio_url: nextUrl,
          lmstudio_api_key: lmStudioApiKeyForSave(),
        });
      }
      await refreshStatus();
    } catch {
      // The status message shows that the server is not available.
    } finally {
      setLmStudioProbing(false);
    }
  }

  async function commitOllama(on) {
    if (on) {
      setWantBundle(false);
      // Optimistically update local state so the checkbox reflects the
      // click immediately, before the backend round-trip completes.
      setStatus((s) => ({
        ...s,
        preference: {
          ...s.preference,
          backend: "ollama",
          ollama_model: selectedOllamaModel,
        },
      }));
      if (onPreferenceChange) {
        await onPreferenceChange({
          backend: "ollama",
          model_key: modelKey,
          ollama_model: selectedOllamaModel,
          lmstudio_model: selectedLmStudioModel,
          lmstudio_url: lmStudioUrl,
          lmstudio_api_key: lmStudioApiKeyForSave(),
        });
      }
    } else {
      setStatus((s) => ({
        ...s,
        preference: { ...s.preference, backend: "bundled", ollama_model: "" },
      }));
      if (onPreferenceChange) {
        await onPreferenceChange({
          backend: "bundled",
          model_key: modelKey,
          ollama_model: "",
          lmstudio_model: selectedLmStudioModel,
          lmstudio_url: lmStudioUrl,
          lmstudio_api_key: lmStudioApiKeyForSave(),
        });
      }
    }
  }

  async function commitLmStudio(on) {
    if (on) {
      setWantBundle(false);
      setStatus((s) => ({
        ...s,
        preference: {
          ...s.preference,
          backend: "lmstudio",
          lmstudio_model: selectedLmStudioModel,
        },
      }));
      if (onPreferenceChange) {
        await onPreferenceChange({
          backend: "lmstudio",
          model_key: modelKey,
          ollama_model: selectedOllamaModel,
          lmstudio_model: selectedLmStudioModel,
          lmstudio_url: lmStudioUrl,
          lmstudio_api_key: lmStudioApiKeyForSave(),
        });
      }
    } else {
      setStatus((s) => ({
        ...s,
        preference: { ...s.preference, backend: "bundled", lmstudio_model: "" },
      }));
      if (onPreferenceChange) {
        await onPreferenceChange({
          backend: "bundled",
          model_key: modelKey,
          ollama_model: selectedOllamaModel,
          lmstudio_model: "",
          lmstudio_url: lmStudioUrl,
          lmstudio_api_key: lmStudioApiKeyForSave(),
        });
      }
    }
  }

  const ollamaAvailable = status.ollama_available || ollamaModels.length > 0;
  const lmStudioAvailable = status.lmstudio_available;
  const lmStudioServerAvailable = status.lmstudio_server_available;
  const lmStudioAuthRequired = status.lmstudio_auth_required;
  const lmStudioLoadedModels = status.lmstudio_loaded_models || [];
  const lmStudioModelLabel = selectedLmStudioModel || "auto-select";
  const lmStudioSelectedModelLoaded =
    Boolean(selectedLmStudioModel) && lmStudioLoadedModels.includes(selectedLmStudioModel);
  const ollamaStatusText = ollamaProbing
    ? "Checking for Ollama…"
    : ollamaAvailable
      ? `Detected and ready · ${selectedOllamaModel || "auto-select"}`
      : "No Ollama server was detected on this machine.";
  const lmStudioStatusText = lmStudioProbing
    ? "Checking for LM Studio…"
    : lmStudioAuthRequired
      ? "Authentication required · configure an API token"
      : lmStudioAvailable
        ? lmStudioSelectedModelLoaded
          ? `Detected and ready · ${lmStudioModelLabel}`
          : `Detected · ${lmStudioModelLabel} will load on first use`
        : lmStudioServerAvailable
          ? lmStudioModels.length > 0
            ? `${lmStudioModels.length} models found · ready for JIT loading`
            : "Server detected, but no chat models were found"
          : "No LM Studio server was detected";

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
                downloaded local model on supported builds or a server you
                configure. The downloaded model stays on your computer; a
                remote Ollama or LM Studio server receives the text and prompt
                sent to it. No account or Lexicon cloud service is required.
                The model downloads once and lives in your app-data folder.
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
        <div className="mt-3 grid grid-cols-2 gap-2">
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
                      onPreferenceChange({
                        backend: "bundled",
                        model_key: tier.key,
                        lmstudio_url: lmStudioUrl,
                        lmstudio_api_key: lmStudioApiKeyForSave(),
                      });
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
                        onPreferenceChange({
                          backend: "bundled",
                          model_key: tier.key,
                          lmstudio_url: lmStudioUrl,
                          lmstudio_api_key: lmStudioApiKeyForSave(),
                        });
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

      {/* Advanced: connect a server. */}
      <div className="mt-6 border-t border-hairline pt-4">
        <button
          type="button"
          onClick={() => {
            setShowAdvanced((v) => {
              localStorage.setItem("lexicon:advanced-open", String(!v));
              return !v;
            });
          }}
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
            <div className="space-y-2">
              <div className="rounded-lg border border-hairline bg-canvas">
                <div className="flex items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Use my Ollama server"
                    checked={status.preference?.backend === "ollama"}
                    disabled={!probeDone || !ollamaAvailable}
                    onChange={(e) => commitOllama(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-pale-blue-text"
                  />
                  <button
                    type="button"
                    onClick={() => toggleProvider("ollama")}
                    aria-expanded={openProvider === "ollama"}
                    aria-controls="ollama-provider-details"
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block font-sans text-sm font-medium text-ink">
                      Use my Ollama server
                    </span>
                    <span className="mt-0.5 block truncate font-sans text-xs text-muted">
                      {ollamaStatusText}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleProvider("ollama")}
                    aria-label={`${openProvider === "ollama" ? "Hide" : "Configure"} Ollama`}
                    className="flex shrink-0 items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] font-medium text-muted transition-colors hover:border-muted hover:text-ink"
                  >
                    <span aria-hidden="true">{openProvider === "ollama" ? "▾" : "▸"}</span>
                    <span>{openProvider === "ollama" ? "Hide" : "Configure"}</span>
                  </button>
                </div>
                {openProvider === "ollama" && (
                  <div
                    id="ollama-provider-details"
                    className="border-t border-hairline/60 px-4 py-3"
                  >
                    {ollamaAvailable && ollamaModels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {ollamaModels.map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              setSelectedOllamaModel(name);
                              setStatus((s) => ({
                                ...s,
                                preference: { ...s.preference, ollama_model: name },
                              }));
                              if (
                                status.preference?.backend === "ollama" &&
                                onPreferenceChange
                              ) {
                                onPreferenceChange({
                                  backend: "ollama",
                                  model_key: modelKey,
                                  ollama_model: name,
                                  lmstudio_model: selectedLmStudioModel,
                                  lmstudio_url: lmStudioUrl,
                                });
                              }
                            }}
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                              selectedOllamaModel === name
                                ? "border-pale-blue-text bg-pale-blue/20 text-ink"
                                : "border-hairline bg-white text-muted hover:border-muted hover:text-ink"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                    {!ollamaAvailable && (
                      <p className="font-sans text-[11px] text-muted">
                        Start Ollama to discover its available chat models.
                      </p>
                    )}
                    {ollamaAvailable && ollamaModels.length === 0 && (
                      <p className="font-sans text-[11px] text-muted">
                        Ollama is ready. It will select a chat model automatically.
                      </p>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-hairline bg-canvas">
                <div className="flex items-start gap-3 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label="Use my LM Studio server"
                    checked={status.preference?.backend === "lmstudio"}
                    disabled={!probeDone || !lmStudioAvailable}
                    onChange={(e) => commitLmStudio(e.target.checked)}
                    className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-pale-yellow-text"
                  />
                  <button
                    type="button"
                    onClick={() => toggleProvider("lmstudio")}
                    aria-expanded={openProvider === "lmstudio"}
                    aria-controls="lmstudio-provider-details"
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="block font-sans text-sm font-medium text-ink">
                      Use my LM Studio server
                    </span>
                    <span className="mt-0.5 block truncate font-sans text-xs text-muted">
                      {lmStudioStatusText}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleProvider("lmstudio")}
                    aria-label={`${openProvider === "lmstudio" ? "Hide" : "Configure"} LM Studio`}
                    className="flex shrink-0 items-center gap-1 rounded border border-hairline bg-white px-2 py-1 font-sans text-[11px] font-medium text-muted transition-colors hover:border-muted hover:text-ink"
                  >
                    <span aria-hidden="true">
                      {openProvider === "lmstudio" ? "▾" : "▸"}
                    </span>
                    <span>{openProvider === "lmstudio" ? "Hide" : "Configure"}</span>
                  </button>
                </div>
                {openProvider === "lmstudio" && (
                  <div
                    id="lmstudio-provider-details"
                    className="border-t border-hairline/60 px-4 pb-3 pt-3"
                  >
                    {lmStudioModels.length > 0 && !lmStudioSelectedModelLoaded && (
                      <p className="mb-2 font-sans text-[11px] text-muted">
                        LM Studio will load the selected model automatically on
                        first use.
                      </p>
                    )}
                    {lmStudioModels.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {lmStudioModels.map((name) => (
                          <button
                            key={name}
                            type="button"
                            title={
                              status.lmstudio_loaded_models?.includes(name)
                                ? "Loaded in LM Studio"
                                : "Available on device; LM Studio will load it on first use"
                            }
                            onClick={() => {
                              setSelectedLmStudioModel(name);
                              setStatus((s) => ({
                                ...s,
                                preference: { ...s.preference, lmstudio_model: name },
                              }));
                              if (
                                status.preference?.backend === "lmstudio" &&
                                onPreferenceChange
                              ) {
                                onPreferenceChange({
                                  backend: "lmstudio",
                                  model_key: modelKey,
                                  ollama_model: selectedOllamaModel,
                                  lmstudio_model: name,
                                  lmstudio_url: lmStudioUrl,
                                  lmstudio_api_key: lmStudioApiKeyForSave(),
                                });
                              }
                            }}
                            className={`inline-flex items-center rounded-md border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                              selectedLmStudioModel === name
                                ? "border-pale-yellow-text bg-pale-yellow/40 text-ink"
                                : "border-hairline bg-white text-muted hover:border-muted hover:text-ink"
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 border-t border-hairline/60 pt-3">
                      <label
                        htmlFor="lmstudio-server-url"
                        className="font-mono text-[10px] uppercase tracking-widest text-muted"
                      >
                        Server URL
                      </label>
                      <div className="mt-1.5 flex items-center gap-2">
                        <input
                          id="lmstudio-server-url"
                          type="url"
                          value={lmStudioUrlDraft}
                          onChange={(event) => setLmStudioUrlDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              checkLmStudio();
                            }
                          }}
                          placeholder={DEFAULT_LM_STUDIO_URL}
                          className="min-w-0 flex-1 rounded border border-hairline bg-white px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-pale-yellow-text"
                        />
                        <button
                          type="button"
                          onClick={checkLmStudio}
                          disabled={!probeDone || lmStudioProbing}
                          className="shrink-0 rounded border border-hairline bg-white px-2.5 py-1.5 font-sans text-[11px] font-medium text-ink transition-colors hover:border-muted disabled:cursor-wait disabled:opacity-50"
                        >
                          {lmStudioProbing ? "Checking…" : "Check"}
                        </button>
                      </div>
                      <p className="mt-1 font-sans text-[10px] text-muted">
                        Use the address shown in LM Studio. The default is {DEFAULT_LM_STUDIO_URL}.
                      </p>
                      <div className="mt-3">
                        <label
                          htmlFor="lmstudio-preferred-model"
                          className="font-mono text-[10px] uppercase tracking-widest text-muted"
                        >
                          Preferred model name
                        </label>
                        <input
                          id="lmstudio-preferred-model"
                          type="text"
                          value={selectedLmStudioModel}
                          onChange={(event) => setSelectedLmStudioModel(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              checkLmStudio();
                            }
                          }}
                          placeholder="Optional — use the first loaded model"
                          spellCheck="false"
                          className="mt-1.5 w-full rounded border border-hairline bg-white px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-pale-yellow-text"
                        />
                        <p className="mt-1 font-sans text-[10px] text-muted">
                          Use the exact model identifier shown by LM Studio. Leave it
                          blank to use the first loaded model.
                        </p>
                      </div>
                      <div className="mt-3">
                        <label
                          htmlFor="lmstudio-api-key"
                          className="font-mono text-[10px] uppercase tracking-widest text-muted"
                        >
                          API token{" "}
                          <span className="normal-case tracking-normal">(optional)</span>
                        </label>
                        <div className="mt-1.5 flex items-center gap-2">
                          <input
                            id="lmstudio-api-key"
                            type="password"
                            value={lmStudioApiKeyDraft}
                            onChange={(event) => {
                              lmStudioApiKeyChangedRef.current = true;
                              setLmStudioApiKeyDraft(event.target.value);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                checkLmStudio();
                              }
                            }}
                            placeholder={
                              lmStudioApiKeyConfigured
                                ? "Saved token — leave blank to keep it"
                                : "Paste the token from Manage Tokens"
                            }
                            autoComplete="off"
                            spellCheck="false"
                            className="min-w-0 flex-1 rounded border border-hairline bg-white px-2 py-1.5 font-mono text-[11px] text-ink outline-none focus:border-pale-yellow-text"
                          />
                          {lmStudioApiKeyConfigured && (
                            <button
                              type="button"
                              onClick={() => {
                                lmStudioApiKeyChangedRef.current = true;
                                setLmStudioApiKeyDraft("");
                              }}
                              className="shrink-0 rounded border border-hairline bg-white px-2.5 py-1.5 font-sans text-[11px] font-medium text-muted transition-colors hover:border-muted hover:text-ink"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <p className="mt-1 font-sans text-[10px] text-muted">
                          Required only when LM Studio has Require Authentication enabled
                          in Server Settings.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
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
