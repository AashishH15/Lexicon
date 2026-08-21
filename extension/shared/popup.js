// Popup: proofread and rewrite a selected field.

import {
  discoverBackend,
  checkGrammar,
  transformText,
} from "./api.js";
import { getTransformPrompt, TRANSFORM_TOOLS } from "./prompts.js";
import { createBackendStatus } from "./backendStatus.js";
import { normalizeSite } from "./settings.js";

const statusEl = document.getElementById("status");
const inputEl = document.getElementById("input");
const proofreadBtn = document.getElementById("proofread");
const rewriteToolEl = document.getElementById("rewrite-tool");
const rewriteBtn = document.getElementById("rewrite");
const resultsEl = document.getElementById("results");
const pauseProofreadingEl = document.getElementById("pause-proofreading");
const disableSiteEl = document.getElementById("disable-site");
const siteNameEl = document.getElementById("site-name");
const settingsStatusEl = document.getElementById("settings-status");
const fieldSelectEl = document.getElementById("field-select");

let fieldText = "";
let fieldReady = false;
let selectedFieldId = "";
let selectedFrameId = null;
let currentTabId = null;
let currentSite = "";
let settings = {
  paused: false,
  siteDisabled: false,
};

for (const tool of TRANSFORM_TOOLS) {
  const option = document.createElement("option");
  option.value = tool;
  option.textContent = tool;
  rewriteToolEl.appendChild(option);
}

rewriteToolEl.addEventListener("change", () => {
  rewriteBtn.textContent = rewriteToolEl.value;
});

function setActionsEnabled(enabled) {
  proofreadBtn.disabled = !enabled;
  rewriteBtn.disabled = !enabled;
}

function refreshActions() {
  const connected = monitor.state === "connected";
  const ready = fieldReady && fieldText.trim().length > 0;
  proofreadBtn.disabled =
    !connected || !ready || settings.paused || settings.siteDisabled;
  rewriteBtn.disabled = !connected || !ready || settings.siteDisabled;
}

function setFieldOptions(fields, selectedId = "") {
  fieldSelectEl.replaceChildren();
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = fields.length
    ? "Choose a visible text field…"
    : "No visible text fields found";
  fieldSelectEl.appendChild(placeholder);
  for (const field of fields) {
    const option = document.createElement("option");
    option.value = field.id;
    option.textContent = field.preview
      ? `${field.label} — ${field.preview}`
      : field.label;
    fieldSelectEl.appendChild(option);
  }
  fieldSelectEl.value = fields.some((field) => field.id === selectedId)
    ? selectedId
    : "";
}

function clearFieldTarget(message) {
  selectedFieldId = "";
  selectedFrameId = null;
  fieldReady = false;
  fieldText = "";
  fieldSelectEl.value = "";
  inputEl.value = "";
  inputEl.placeholder = message;
  refreshActions();
}

async function selectField(fieldId) {
  if (!fieldId || settings.siteDisabled) {
    clearFieldTarget(
      settings.siteDisabled
        ? "Lexicon is disabled on this site."
        : "Choose a visible text field above to use Tone.",
    );
    return false;
  }
  try {
    const response = await sendToContent({
      type: "lexicon:select-field",
      fieldId,
    }, selectedFrameId);
    if (!response?.ok) {
      clearFieldTarget(
        response?.error === "site-disabled"
          ? "Lexicon is disabled on this site."
          : "Choose a visible text field above to use Tone.",
      );
      return false;
    }
    selectedFieldId = response.fieldId || fieldId;
    fieldText = String(response.text || "");
    fieldReady = true;
    inputEl.value = fieldText;
    inputEl.placeholder = "Selected text field preview.";
    refreshActions();
    return true;
  } catch {
    clearFieldTarget("Lexicon can't run on this page.");
    return false;
  }
}

function renderSettings() {
  pauseProofreadingEl.checked = Boolean(settings.paused);
  disableSiteEl.checked = Boolean(settings.siteDisabled);
  disableSiteEl.disabled = !currentSite;
  siteNameEl.textContent = currentSite || "this site";
  rewriteToolEl.disabled = Boolean(settings.siteDisabled);
  fieldSelectEl.disabled = Boolean(settings.siteDisabled);
  if (settings.siteDisabled) {
    settingsStatusEl.textContent = "Lexicon is disabled on this site.";
  } else if (settings.paused) {
    settingsStatusEl.textContent = "Proofreading is paused. Rewrite remains available.";
  } else if (!currentSite) {
    settingsStatusEl.textContent = "This page cannot be disabled from the extension.";
  } else {
    settingsStatusEl.textContent = "";
  }
  refreshActions();
}

async function getCurrentTab() {
  const [tab] = await browser.tabs.query({
    active: true,
    currentWindow: true,
  });
  currentTabId = Number.isInteger(tab?.id) ? tab.id : null;
  currentSite = normalizeSite(tab?.url || "");
  return tab;
}

async function loadSettings() {
  try {
    await getCurrentTab();
    const response = await browser.runtime.sendMessage({
      type: "lexicon:get-settings",
      site: currentSite,
    });
    if (response?.ok === false) throw new Error(response.error);
    settings = {
      ...settings,
      ...response,
      siteDisabled: Boolean(response?.siteDisabled),
    };
  } catch {
    settings = { paused: false, siteDisabled: false };
  }
  renderSettings();
  if (settings.siteDisabled) {
    setFieldOptions([]);
    clearFieldTarget("Lexicon is disabled on this site.");
    clearResults();
  } else {
    refreshField();
  }
}

async function updatePause(event) {
  const previous = settings.paused;
  pauseProofreadingEl.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({
      type: "lexicon:set-paused",
      paused: event.target.checked,
      site: currentSite,
    });
    if (response?.ok === false) throw new Error(response.error);
    settings = {
      ...settings,
      ...response,
      paused: Boolean(response.paused),
    };
  } catch {
    settings.paused = previous;
    pauseProofreadingEl.checked = previous;
    settingsStatusEl.textContent = "Could not update the proofreading setting.";
  } finally {
    pauseProofreadingEl.disabled = false;
    renderSettings();
  }
}

async function updateSiteDisabled(event) {
  if (!currentSite) return;
  const previous = settings.siteDisabled;
  disableSiteEl.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({
      type: "lexicon:set-site-disabled",
      site: currentSite,
      disabled: event.target.checked,
    });
    if (response?.ok === false) throw new Error(response.error);
    settings = {
      ...settings,
      ...response,
      siteDisabled: Boolean(response.siteDisabled),
    };
  } catch {
    settings.siteDisabled = previous;
    disableSiteEl.checked = previous;
    settingsStatusEl.textContent = "Could not update the site setting.";
  } finally {
    disableSiteEl.disabled = !currentSite;
    renderSettings();
    if (settings.siteDisabled) {
      setFieldOptions([]);
      clearFieldTarget("Lexicon is disabled on this site.");
      clearResults();
    } else {
      refreshField();
    }
  }
}

function renderStatus(state) {
  if (state === "connected") {
    statusEl.textContent = "Connected to Lexicon";
    statusEl.classList.remove("offline");
  } else if (state === "checking") {
    statusEl.textContent = "Checking for Lexicon…";
    statusEl.classList.remove("offline");
  } else {
    statusEl.textContent = "Open Lexicon to use grammar checking here";
    statusEl.classList.add("offline");
  }
  refreshField();
}

const monitor = createBackendStatus({
  ping: async () => (await discoverBackend()) !== null,
  onChange: renderStatus,
});

async function sendToContent(msg, frameId = null) {
  const tab = await getCurrentTab();
  if (!tab?.id) throw new Error("no-tab");
  const request = {
    type: "lexicon:content-command",
    tabId: tab.id,
    message: msg,
  };
  if (Number.isInteger(frameId)) request.frameId = frameId;
  return browser.runtime.sendMessage(request);
}

async function refreshField() {
  const previousFieldId = selectedFieldId;
  fieldReady = false;
  fieldText = "";
  inputEl.value = "";
  if (settings.siteDisabled) {
    setFieldOptions([]);
    clearFieldTarget("Lexicon is disabled on this site.");
    return;
  }
  fieldSelectEl.disabled = false;
  inputEl.placeholder = "Choose a visible text field above to use Tone.";
  try {
    const response = await sendToContent({ type: "lexicon:list-fields" });
    if (!response?.ok) {
      setFieldOptions([]);
      clearFieldTarget(
        response?.error === "site-disabled"
          ? "Lexicon is disabled on this site."
          : "Lexicon can't find a text field on this page.",
      );
      return;
    }
    const fields = Array.isArray(response.fields) ? response.fields : [];
    selectedFrameId = Number.isInteger(response.frameId)
      ? response.frameId
      : null;
    const fieldIds = new Set(fields.map((field) => field.id));
    setFieldOptions(fields);
    const preferredId =
      (fieldIds.has(response.activeId) && response.activeId) ||
      (fieldIds.has(previousFieldId) && previousFieldId) ||
      (fields.length === 1 && fields[0].id) ||
      "";
    if (!preferredId) {
      selectedFieldId = "";
      inputEl.placeholder = fields.length
        ? "Choose a visible text field above to use Tone."
        : "No visible text fields found on this page.";
      refreshActions();
      return;
    }
    fieldSelectEl.value = preferredId;
    await selectField(preferredId);
  } catch {
    setFieldOptions([]);
    clearFieldTarget("Lexicon can't run on this page.");
  }
  if (!fieldReady) {
    refreshActions();
  }
}

function clearResults() {
  resultsEl.replaceChildren();
}

function showEmpty(message) {
  const el = document.createElement("p");
  el.className = "empty";
  el.textContent = message;
  resultsEl.appendChild(el);
}

function showRewrite(text, targetFieldId, targetFrameId) {
  const box = document.createElement("div");
  box.className = "rewrite";
  box.textContent = text;
  resultsEl.appendChild(box);

  const replaceBtn = document.createElement("button");
  replaceBtn.type = "button";
  replaceBtn.textContent = "Replace in field";
  replaceBtn.addEventListener("click", async () => {
    replaceBtn.disabled = true;
    try {
      const response = await sendToContent({
        type: "lexicon:replace-text",
        text,
        fieldId: targetFieldId,
      }, targetFrameId);
      if (!response?.ok) {
        if (response?.error === "site-disabled") {
          showError(response.error);
        } else {
          showEmpty("The field changed. Proofread it again, then rewrite.");
        }
        return;
      }
      clearResults();
      showEmpty("Replaced in the field.");
      refreshField();
    } catch (error) {
      showError(error.message);
    } finally {
      replaceBtn.disabled = false;
    }
  });
  resultsEl.appendChild(replaceBtn);
}

function showError(message) {
  if (message === "backend_unreachable") {
    showEmpty("Open Lexicon to use grammar checking here.");
  } else if (message === "proofreading-paused") {
    showEmpty("Proofreading is paused in the extension settings.");
  } else if (message === "site-disabled") {
    showEmpty("Lexicon is disabled on this site.");
  } else {
    showEmpty(`Something went wrong: ${message}`);
  }
}

async function onProofread() {
  const text = fieldText.trim();
  const targetFieldId = selectedFieldId;
  const targetFrameId = selectedFrameId;
  if (!text || !targetFieldId || settings.paused || settings.siteDisabled) {
    return;
  }
  setActionsEnabled(false);
  clearResults();
  try {
    const matches = await checkGrammar(text);
    const response = await sendToContent({
      type: "lexicon:highlight",
      matches,
      fieldId: targetFieldId,
    }, targetFrameId);
    if (response?.ok === false) {
      showError(response.error);
      return;
    }
    if (matches.length === 0) {
      showEmpty("No issues found.");
    } else if (matches.length === 1) {
      showEmpty("1 issue marked in the field. Open the badge to review.");
    } else {
      showEmpty(
        `${matches.length} issues marked in the field. Open the badge to review.`,
      );
    }
  } catch (error) {
    showError(error.message);
  } finally {
    refreshActions();
  }
}

async function onRewrite() {
  const text = fieldText.trim();
  const targetFieldId = selectedFieldId;
  const targetFrameId = selectedFrameId;
  if (!text || !targetFieldId || settings.siteDisabled) return;
  setActionsEnabled(false);
  clearResults();
  try {
    const rewritten = await transformText(
      getTransformPrompt(rewriteToolEl.value),
      text,
    );
    showRewrite(rewritten, targetFieldId, targetFrameId);
  } catch (error) {
    showError(error.message);
  } finally {
    refreshActions();
  }
}

proofreadBtn.addEventListener("click", onProofread);
rewriteBtn.addEventListener("click", onRewrite);
fieldSelectEl.addEventListener("change", () => {
  selectField(fieldSelectEl.value);
});
pauseProofreadingEl.addEventListener("change", updatePause);
disableSiteEl.addEventListener("change", updateSiteDisabled);

renderStatus(monitor.state);
monitor.start();
renderSettings();
loadSettings();
