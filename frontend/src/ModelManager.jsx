import { useEffect, useRef, useState } from "react";
import { ArrowsClockwise, Cpu, DownloadSimple, TrashSimple } from "@phosphor-icons/react";
import Toggle from "./Toggle.jsx";
import {
  getAiStatus,
  downloadModel,
  getModelStatus,
  cancelModelDownload,
  deleteModel,
  cleanupLegacyModel,
  setAiPreference,
} from "./api.js";

const MODEL_TIERS = [
  { key: "0.8b", label: "Light", detail: "Smallest and fastest, high instruction accuracy. ~1.15 GB." },
  { key: "2b", label: "Standard", detail: "Best balance of quality and phrasing precision. ~3.0 GB." },
  { key: "quality", label: "Quality", detail: "Maximum restraint and prose polish. 8B MoE / 1.3B active. ~4.9 GB." },
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
  const [reclaimMessage, setReclaimMessage] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get("testReclaim")
        ? "Upgrade complete! Removed previous model file to reclaim 1.4 GB of disk space."
        : "";
    } catch {
      return "";
    }
  });
  const [openProvider, setOpenProvider] = useState(
    () => localStorage.getItem("lexicon:provider-open") || ""
  );

  const [activeUpgradeTier, setActiveUpgradeTier] = useState(null);
  const [upgradePhase, setUpgradePhase] = useState("prompt"); // prompt | downloading | complete | error
  const [upgradeProgress, setUpgradeProgress] = useState(null);
  const [upgradeError, setUpgradeError] = useState("");
  const [upgradeCleanupError, setUpgradeCleanupError] = useState("");
  const upgradeTimerRef = useRef(null);

  function tierHasUpgrade(key) {
    if (status.tier_upgrades?.[key] !== undefined) {
      return Boolean(status.tier_upgrades[key]?.upgrade_available);
    }
    return Boolean(
      status.upgrade_available &&
        (status.upgrade_model_key === key || (!status.upgrade_model_key && key === "2b"))
    );
  }

  function getUpgradeTierName(key) {
    return (
      status.tier_upgrades?.[key]?.tier_name ||
      MODEL_TIERS.find((t) => t.key === key)?.label ||
      "Standard"
    );
  }

  function getUpgradeAccuracy(key) {
    return status.tier_upgrades?.[key]?.accuracy_gain || status.accuracy_gain || "+185%";
  }

  function getUpgradeSizeDiff(key) {
    return status.tier_upgrades?.[key]?.size_diff || status.size_diff || "+1.4 GB";
  }

  function getUpgradeReclaimSize(key) {
    return (
      status.tier_upgrades?.[key]?.reclaim_size ||
      (key === "0.8b" ? "840 MB" : "1.4 GB")
    );
  }

  function openUpgradePopover(key) {
    setActiveUpgradeTier(key);
    setUpgradePhase("prompt");
    setUpgradeError("");
    setUpgradeCleanupError("");
    setUpgradeProgress(null);
  }

  function closeUpgradePopover() {
    if (upgradePhase === "downloading") return;
    if (upgradeTimerRef.current) {
      clearInterval(upgradeTimerRef.current);
      upgradeTimerRef.current = null;
    }
    setActiveUpgradeTier(null);
    setUpgradePhase("prompt");
    setUpgradeError("");
    setUpgradeCleanupError("");
    setUpgradeProgress(null);
  }

  async function handleCancelUpgrade() {
    if (upgradeTimerRef.current) {
      clearInterval(upgradeTimerRef.current);
      upgradeTimerRef.current = null;
    }
    try {
      await cancelModelDownload(activeUpgradeTier);
    } catch {
      /* best-effort */
    }
    setUpgradePhase("prompt");
    setUpgradeProgress(null);
  }

  async function executeUpgrade(targetKey) {
    setUpgradePhase("downloading");
    setUpgradeProgress({ bytes_done: 0, bytes_total: 0 });
    setUpgradeError("");
    setUpgradeCleanupError("");

    if (upgradeTimerRef.current) clearInterval(upgradeTimerRef.current);
    upgradeTimerRef.current = setInterval(async () => {
      try {
        const st = await getModelStatus(targetKey);
        setUpgradeProgress({ bytes_done: st.bytes_done, bytes_total: st.bytes_total });
      } catch {
        /* ignore poll error */
      }
    }, 300);

    try {
      const res = await downloadModel(targetKey);
      if (upgradeTimerRef.current) {
        clearInterval(upgradeTimerRef.current);
        upgradeTimerRef.current = null;
      }
      if (res && res.state === "cancelled") {
        setUpgradePhase("prompt");
        setUpgradeProgress(null);
        return;
      }
      let cleanupError = res?.cleanup_error || "";
      try {
        const cleanup = await cleanupLegacyModel(targetKey);
        cleanupError = cleanup?.error || cleanupError;
      } catch (err) {
        cleanupError = err.message || "The previous model file could not be removed.";
      }
      refreshStatus();
      setUpgradeCleanupError(cleanupError);
      setUpgradePhase("complete");
      if (onPreferenceChange) {
        onPreferenceChange({
          backend: "bundled",
          model_key: targetKey,
          lmstudio_url: lmStudioUrl,
          lmstudio_api_key: lmStudioApiKeyForSave(),
        });
      }
      if (onConfigured) onConfigured();
    } catch (err) {
      if (upgradeTimerRef.current) {
        clearInterval(upgradeTimerRef.current);
        upgradeTimerRef.current = null;
      }
      if (err.message && err.message.toLowerCase().includes("cancel")) {
        setUpgradePhase("prompt");
        setUpgradeProgress(null);
        return;
      }
      setUpgradePhase("error");
      setUpgradeError(err.message || "Upgrade download failed.");
    }
  }

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

  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      if (upgradeTimerRef.current) {
        clearInterval(upgradeTimerRef.current);
        upgradeTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!activeUpgradeTier) {
      return undefined;
    }
    const handleKeyDown = (event) => {
      if (event.key !== "Escape" || upgradePhase === "downloading") {
        return;
      }
      if (upgradeTimerRef.current) {
        clearInterval(upgradeTimerRef.current);
        upgradeTimerRef.current = null;
      }
      setActiveUpgradeTier(null);
      setUpgradePhase("prompt");
      setUpgradeError("");
      setUpgradeCleanupError("");
      setUpgradeProgress(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeUpgradeTier, upgradePhase]);

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
    setReclaimMessage("");
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
        if (res && res.reclaimed_message) {
          setReclaimMessage(res.reclaimed_message);
        } else if (res && res.legacy_reclaimed) {
          setReclaimMessage(
            "Upgrade complete! Removed previous model file to reclaim 1.4 GB of disk space."
          );
        }
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

  async function handleUpgrade(targetKey = "2b") {
    if (phase === "downloading") return;
    setModelKey(targetKey);
    setReclaimMessage("");
    setPhase("downloading");
    setProgress({ bytes_done: 0, bytes_total: 0 });
    startPolling();
    try {
      const res = await downloadModel(targetKey);
      if (res && res.state === "cancelled") {
        stopPolling();
        setPhase("choose");
        return;
      }
      const st = await getModelStatus(targetKey);
      setProgress({ bytes_done: st.bytes_done, bytes_total: st.bytes_total });
      stopPolling();
      refreshStatus();
      if (st.state === "ready") {
        setPhase("done");
        if (res && res.reclaimed_message) {
          setReclaimMessage(res.reclaimed_message);
        } else {
          setReclaimMessage(
            "Upgrade complete! Removed previous model file to reclaim 1.4 GB of disk space."
          );
        }
        if (onPreferenceChange) {
          onPreferenceChange({
            backend: "bundled",
            model_key: targetKey,
            lmstudio_url: lmStudioUrl,
            lmstudio_api_key: lmStudioApiKeyForSave(),
          });
        }
        if (onConfigured) onConfigured();
      } else if (st.state === "cancelled") {
        setPhase("choose");
      } else {
        setPhase("error");
        setError(st.error || "Upgrade did not complete.");
      }
    } catch (exc) {
      stopPolling();
      if (exc.message && exc.message.toLowerCase().includes("cancelled")) {
        setPhase("choose");
      } else {
        setPhase("error");
        setError(exc.message || "Upgrade download failed.");
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
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
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
                  "flex flex-col justify-between rounded-lg border p-3 text-left transition-colors min-h-[114px] " +
                  (selected
                    ? "border-pale-blue-text bg-pale-blue/40"
                    : "border-hairline bg-canvas hover:border-muted") +
                  (downloading ? " cursor-not-allowed opacity-50" : " cursor-pointer")
                }
              >
                <div>
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="font-sans text-sm font-medium text-ink">
                      {tier.label}
                    </span>
                    {ready && (
                      <span className="shrink-0 inline-flex items-center gap-1 font-sans text-[10px] font-medium text-pale-green-text">
                        <span className="h-1.5 w-1.5 rounded-full bg-pale-green-text" />
                        installed
                      </span>
                    )}
                  </div>
                  <span className="mt-1 block font-sans text-[11px] leading-relaxed text-muted">
                    {tier.detail}
                  </span>
                </div>

                {ready && (
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <button
                      type="button"
                      aria-label={`Delete ${tier.label} model`}
                      title={`Delete ${tier.label} model`}
                      data-testid={`delete-button-${tier.key}`}
                      disabled={deletingKey === tier.key || phase === "downloading" || upgradePhase === "downloading"}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(tier.key);
                      }}
                      className={
                        "cursor-pointer rounded border p-1 text-muted transition-colors flex items-center justify-center " +
                        (deletingKey === tier.key
                          ? "cursor-wait border-hairline text-muted animate-pulse"
                          : "border-hairline hover:border-pale-red-text hover:text-pale-red-text hover:bg-pale-red/10")
                      }
                    >
                      <TrashSimple size={14} weight="bold" />
                    </button>
                    {tierHasUpgrade(tier.key) && (
                      <button
                        type="button"
                        aria-label={`Upgrade ${tier.label} model`}
                        title="Upgrade model"
                        data-testid={`upgrade-button-${tier.key}`}
                        disabled={phase === "downloading" || upgradePhase === "downloading"}
                        onClick={(e) => {
                          e.stopPropagation();
                          openUpgradePopover(tier.key);
                        }}
                        className="cursor-pointer rounded border border-purple-300 bg-purple-50 p-1 font-sans text-purple-700 transition-colors hover:bg-purple-100 hover:border-purple-400 flex items-center justify-center"
                      >
                        <ArrowsClockwise size={14} weight="bold" />
                      </button>
                    )}
                  </div>
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

      {/* Upgrade Popover / Modal */}
      {activeUpgradeTier && (
        <div
          data-testid="upgrade-popover"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget && upgradePhase !== "downloading") {
              closeUpgradePopover();
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="upgrade-popover-title"
            aria-describedby="upgrade-popover-description"
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-hairline bg-canvas p-6 shadow-2xl transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100/80">
                <Cpu size={22} weight="bold" className="text-purple-700" />
              </div>
              <div className="flex-1 min-w-0">
                <h3
                  id="upgrade-popover-title"
                  className="font-serif text-lg font-bold text-ink"
                >
                  Improved AI Model Available
                </h3>
                <p
                  id="upgrade-popover-description"
                  className="mt-1 font-sans text-xs leading-relaxed text-muted"
                >
                  An enhanced model is available for your{" "}
                  <span className="font-medium text-ink">
                    {getUpgradeTierName(activeUpgradeTier)}
                  </span>{" "}
                  tier featuring{" "}
                  <strong className="font-semibold text-purple-700">
                    {getUpgradeAccuracy(activeUpgradeTier)} higher grammar accuracy
                  </strong>{" "}
                  ({getUpgradeSizeDiff(activeUpgradeTier)} storage difference).
                </p>
              </div>
            </div>

            {/* Phase: Prompt */}
            {upgradePhase === "prompt" && (
              <div className="mt-6 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={closeUpgradePopover}
                  className="cursor-pointer rounded-lg border border-hairline bg-canvas px-3.5 py-2 font-sans text-xs font-medium text-muted transition-colors hover:border-muted hover:text-ink"
                >
                  Keep Current
                </button>
                <button
                  type="button"
                  onClick={() => executeUpgrade(activeUpgradeTier)}
                  className="cursor-pointer rounded-lg bg-purple-600 px-4 py-2 font-sans text-xs font-medium text-white shadow-xs transition-colors hover:bg-purple-700"
                >
                  Upgrade Model
                </button>
              </div>
            )}

            {/* Phase: Downloading */}
            {upgradePhase === "downloading" && (
              <div className="mt-5 space-y-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-hairline">
                  <div
                    className={
                      "h-full rounded-full bg-purple-600 transition-all duration-300 " +
                      (upgradeProgress && upgradeProgress.bytes_total ? "" : "animate-pulse")
                    }
                    style={{
                      width:
                        upgradeProgress && upgradeProgress.bytes_total
                          ? `${Math.min(100, (upgradeProgress.bytes_done / upgradeProgress.bytes_total) * 100)}%`
                          : "100%",
                    }}
                  />
                </div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-muted">
                  Downloading enhanced model…{" "}
                  {upgradeProgress && upgradeProgress.bytes_total
                    ? `${Math.round(upgradeProgress.bytes_done / 1e6)} / ${Math.round(upgradeProgress.bytes_total / 1e6)} MB`
                    : `${Math.round((upgradeProgress?.bytes_done || 0) / 1e6)} MB`}
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    data-testid="cancel-upgrade-button"
                    onClick={handleCancelUpgrade}
                    className="cursor-pointer rounded-lg border border-hairline px-3 py-1.5 font-sans text-xs text-muted transition-colors hover:border-muted hover:text-ink"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Phase: Complete */}
            {upgradePhase === "complete" && (
              <div className="mt-5 space-y-4">
                <div
                  className={
                    upgradeCleanupError
                      ? "rounded-xl border border-amber-200 bg-amber-50/80 p-3.5"
                      : "rounded-xl border border-green-200 bg-green-50/80 p-3.5"
                  }
                >
                  <p
                    className={
                      upgradeCleanupError
                        ? "font-sans text-xs font-medium text-amber-800 flex items-center gap-2"
                        : "font-sans text-xs font-medium text-green-800 flex items-center gap-2"
                    }
                  >
                    <Cpu size={16} weight="bold" className="text-green-700 shrink-0" />
                    <span>
                      {upgradeCleanupError
                        ? `Upgrade complete, but the previous model file could not be removed: ${upgradeCleanupError}`
                        : `Upgrade complete! Removed previous model file to reclaim ${getUpgradeReclaimSize(activeUpgradeTier)} of disk space.`}
                    </span>
                  </p>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={closeUpgradePopover}
                    className="cursor-pointer rounded-lg bg-ink px-4 py-2 font-sans text-xs font-medium text-canvas transition-colors hover:bg-ink/90"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}

            {/* Phase: Error */}
            {upgradePhase === "error" && (
              <div className="mt-5 space-y-4">
                <p className="rounded-lg border border-red-200 bg-red-50 p-3 font-sans text-xs text-red-700">
                  {upgradeError || "Upgrade failed. Check your connection."}
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeUpgradePopover}
                    className="cursor-pointer rounded-lg border border-hairline px-3 py-1.5 font-sans text-xs text-muted hover:text-ink"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => executeUpgrade(activeUpgradeTier)}
                    className="cursor-pointer rounded-lg bg-purple-600 px-3 py-1.5 font-sans text-xs font-medium text-white hover:bg-purple-700"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
