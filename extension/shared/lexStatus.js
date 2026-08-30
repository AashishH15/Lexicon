// Shared Lex status contract for the content script and popup.

(function (global) {
  "use strict";

  const LEX_STATUS = Object.freeze({
    IDLE: "idle",
    CHECKING: "checking",
    DISABLED: "disabled",
    NO_CONNECTION: "no-connection",
    ISSUES: "issues",
    ALL_CLEAR: "all-clear",
    ERROR: "error",
  });

  const META = Object.freeze({
    [LEX_STATUS.IDLE]: {
      icon: "lex-idle.svg",
      label: "Lex is ready.",
      ariaLabel: "Lex is ready.",
    },
    [LEX_STATUS.CHECKING]: {
      icon: "lex-checking.svg",
      label: "I’m checking…",
      ariaLabel: "Lex is checking.",
      busy: true,
    },
    [LEX_STATUS.DISABLED]: {
      icon: "lex-disabled.svg",
      label: "I’m paused.",
      ariaLabel: "Lex is paused or not configured.",
    },
    [LEX_STATUS.NO_CONNECTION]: {
      icon: "lex-no-connection.svg",
      label: "I can’t reach the local engine.",
      ariaLabel: "Lex cannot reach the local engine.",
    },
    [LEX_STATUS.ISSUES]: {
      icon: "lex-issues.svg",
      label: "I found issues.",
      ariaLabel: "Lex found proofreading issues.",
    },
    [LEX_STATUS.ALL_CLEAR]: {
      icon: "lex-all-clear.svg",
      label: "All clear.",
      ariaLabel: "Lex found no proofreading issues.",
    },
    [LEX_STATUS.ERROR]: {
      icon: "lex-error.svg",
      label: "Something went wrong.",
      ariaLabel: "A Lex operation failed.",
    },
  });

  function metaFor(status) {
    return META[status] || META[LEX_STATUS.IDLE];
  }

  function resolveLexStatus({
    checking = false,
    matches = [],
    offline = false,
    noConnection = false,
    disabled = false,
    notConfigured = false,
    aiBusy = false,
    error = "",
    operationError = false,
  } = {}) {
    if (operationError || error) return LEX_STATUS.ERROR;
    if (offline || noConnection) return LEX_STATUS.NO_CONNECTION;
    if (disabled || notConfigured) return LEX_STATUS.DISABLED;
    if (checking || aiBusy) return LEX_STATUS.CHECKING;
    if (Array.isArray(matches) && matches.length > 0) {
      return LEX_STATUS.ISSUES;
    }
    if (Array.isArray(matches)) return LEX_STATUS.ALL_CLEAR;
    return LEX_STATUS.IDLE;
  }

  function messageFor(
    status,
    { issueCount = 0, aiBusy = false, selected = false } = {},
  ) {
    switch (status) {
      case LEX_STATUS.CHECKING:
        return aiBusy || selected
          ? "I’m working on your selection…"
          : "I’m checking…";
      case LEX_STATUS.ISSUES:
        return `I found ${issueCount} ${
          issueCount === 1 ? "issue" : "issues"
        }.`;
      case LEX_STATUS.DISABLED:
        return "I’m paused.";
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

  function iconUrl(status) {
    const filename = metaFor(status).icon;
    try {
      const runtime = global.browser?.runtime;
      if (runtime && typeof runtime.getURL === "function") {
        return runtime.getURL(`icons/${filename}`);
      }
    } catch {
      // The fallback is useful in tests and during local script inspection.
    }
    return `icons/${filename}`;
  }

  global.__lexiconLexStatus = Object.freeze({
    LEX_STATUS,
    META,
    metaFor,
    resolveLexStatus,
    messageFor,
    iconUrl,
  });
})(globalThis);
