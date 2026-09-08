import { DEEP_PROOFREAD_TOOL } from "./deepProofread.js";

export const LEX_STATUS = Object.freeze({
  IDLE: "idle",
  CHECKING: "checking",
  DISABLED: "disabled",
  NO_CONNECTION: "no-connection",
  ISSUES: "issues",
  ALL_CLEAR: "all-clear",
  ERROR: "error",
});

export const LEX_STATUS_META = Object.freeze({
  [LEX_STATUS.IDLE]: {
    icon: "/lex-idle.svg",
    label: "Lex is ready.",
    ariaLabel: "Lex is ready.",
  },
  [LEX_STATUS.CHECKING]: {
    icon: "/lex-checking.svg",
    label: "I’m checking…",
    ariaLabel: "Lex is checking.",
    busy: true,
  },
  [LEX_STATUS.DISABLED]: {
    icon: "/lex-disabled.svg",
    label: "I’m paused.",
    ariaLabel: "Lex is paused or not configured.",
  },
  [LEX_STATUS.NO_CONNECTION]: {
    icon: "/lex-no-connection.svg",
    label: "I can’t reach the local engine.",
    ariaLabel: "Lex cannot reach the local engine.",
  },
  [LEX_STATUS.ISSUES]: {
    icon: "/lex-issues.svg",
    label: "I found issues.",
    ariaLabel: "Lex found proofreading issues.",
  },
  [LEX_STATUS.ALL_CLEAR]: {
    icon: "/lex-all-clear.svg",
    label: "All clear.",
    ariaLabel: "Lex found no proofreading issues.",
  },
  [LEX_STATUS.ERROR]: {
    icon: "/lex-error.svg",
    label: "Something went wrong.",
    ariaLabel: "A Lex operation failed.",
  },
});

function isConnectionError(error) {
  const message = String(error || "").trim();
  return (
    message === "backend_unreachable" ||
    /^(failed to fetch|networkerror|load failed)$/i.test(message)
  );
}

// Tier names for the header readout. Keep them aligned with MODEL_TIERS
// in ModelManager.jsx, which owns the full tier catalog.
const ENGINE_TIER_LABELS = {
  "0.8b": "Light",
  "2b": "Standard",
  quality: "Quality",
};

// Short engine label for the header. Empty string means hide the readout.
// Mirror describeActive: saved backend wins, auto follows the live backend.
export function formatEngineTierLabel({
  configured = false,
  backend = "auto",
  modelKey = "2b",
  activeBackend = "",
  device = "",
} = {}) {
  if (!configured) {
    return "";
  }
  if (backend === "ollama" || (backend === "auto" && activeBackend === "ollama")) {
    return "Ollama";
  }
  if (
    backend === "lmstudio" ||
    (backend === "auto" && activeBackend === "lmstudio")
  ) {
    return "LM Studio";
  }
  const label = ENGINE_TIER_LABELS[modelKey] || "Standard";
  return device ? `${label} · ${String(device).toUpperCase()}` : label;
}

export function resolveLexStatus({
  activeTool = "",
  checking = false,
  grammarMatches = [],
  backendOffline = false,
  backendError = "",
  transformRunning = false,
  transformStatus = "idle",
  transformError = "",
  aiConfigured = true,
  hasContent = true,
  deepMatches = [],
  deepRunning = false,
  deepError = "",
} = {}) {
  const deepActive = activeTool === DEEP_PROOFREAD_TOOL;
  const deepFailed = deepActive && Boolean(deepError);
  if (deepFailed && isConnectionError(deepError)) {
    return LEX_STATUS.NO_CONNECTION;
  }
  if (deepFailed) {
    return LEX_STATUS.ERROR;
  }
  const transformFailed =
    activeTool !== "" &&
    activeTool !== "Proofread" &&
    transformStatus === "error" &&
    Boolean(transformError);
  const aiToolActive = Boolean(activeTool && activeTool !== "Proofread");
  if (transformFailed && isConnectionError(transformError)) {
    return LEX_STATUS.NO_CONNECTION;
  }
  if (transformFailed) {
    return LEX_STATUS.ERROR;
  }
  if (backendOffline || backendError) {
    return LEX_STATUS.NO_CONNECTION;
  }
  if (!aiConfigured && aiToolActive) {
    return LEX_STATUS.DISABLED;
  }
  if (
    checking ||
    transformRunning ||
    deepRunning ||
    transformStatus === "warming" ||
    transformStatus === "working"
  ) {
    return LEX_STATUS.CHECKING;
  }
  if (activeTool === "Proofread" && hasContent && grammarMatches.length > 0) {
    return LEX_STATUS.ISSUES;
  }
  if (activeTool === "Proofread" && hasContent) {
    return LEX_STATUS.ALL_CLEAR;
  }
  if (deepActive && hasContent && deepMatches.length > 0) {
    return LEX_STATUS.ISSUES;
  }
  if (deepActive && hasContent) {
    return LEX_STATUS.ALL_CLEAR;
  }
  return LEX_STATUS.IDLE;
}

export function lexStatusMessage(
  status,
  { activeTool = "", issueCount = 0, aiConfigured = true } = {},
) {
  switch (status) {
    case LEX_STATUS.CHECKING:
      return activeTool &&
        activeTool !== "Proofread" &&
        activeTool !== DEEP_PROOFREAD_TOOL
        ? "I’m working on your selection…"
        : "I’m checking your draft…";
    case LEX_STATUS.ISSUES:
      return `I found ${issueCount} ${
        issueCount === 1 ? "issue" : "issues"
      }.`;
    case LEX_STATUS.DISABLED:
      return aiConfigured ? "I’m paused." : "Set up AI to let me help.";
    case LEX_STATUS.NO_CONNECTION:
      return "I can’t reach the local engine.";
    case LEX_STATUS.ALL_CLEAR:
      return "All clear.";
    case LEX_STATUS.ERROR:
      return "Something went wrong.";
    default:
      return "Lex is ready.";
  }
}
