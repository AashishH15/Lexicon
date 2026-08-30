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
const dictionaryWordEl = document.getElementById("dictionary-word");
const dictionaryAddButtonEl = document.getElementById("dictionary-add-button");
const dictionaryListEl = document.getElementById("dictionary-list");
const dictionaryEmptyEl = document.getElementById("dictionary-empty");
const dictionaryCountEl = document.getElementById("dictionary-count");
const dictionaryStatusEl = document.getElementById("dictionary-status");
const fieldSelectEl = document.getElementById("field-select");

let fieldText = "";
let selectedText = "";
let selection = null;
let fieldReady = false;
let selectedFieldId = "";
let selectedFrameId = null;
let currentTabId = null;
let currentSite = "";
let settings = {
  paused: false,
  siteDisabled: false,
  userDictionary: [],
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
  selectedText = "";
  selection = null;
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
    selection =
      response.selection &&
      Number.isInteger(response.selection.start) &&
      Number.isInteger(response.selection.end) &&
      response.selection.end > response.selection.start
        ? {
            start: response.selection.start,
            end: response.selection.end,
            text: String(response.selection.text || ""),
          }
        : null;
    selectedText = selection?.text || fieldText;
    fieldReady = true;
    inputEl.value = selectedText;
    inputEl.placeholder = selection
      ? "Selected text preview."
      : "Selected text field preview.";
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

function renderDictionary() {
  const words = Array.isArray(settings.userDictionary)
    ? settings.userDictionary
    : [];
  dictionaryCountEl.textContent = words.length
    ? `${words.length} word${words.length === 1 ? "" : "s"}`
    : "";
  dictionaryListEl.replaceChildren();
  dictionaryEmptyEl.hidden = words.length > 0;
  for (const word of words) {
    const item = document.createElement("li");
    const label = document.createElement("span");
    label.className = "word";
    label.textContent = word;
    item.appendChild(label);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${word} from dictionary`);
    remove.addEventListener("click", () => removeDictionaryWordFromPopup(word, remove));
    item.appendChild(remove);
    dictionaryListEl.appendChild(item);
  }
}

function syncDictionaryFromPopup() {
  browser.runtime
    .sendMessage({ type: "lexicon:sync-dictionary" })
    .then((response) => {
      if (!response?.ok) return;
      settings = {
        ...settings,
        ...response,
        userDictionary: Array.isArray(response.userDictionary)
          ? response.userDictionary
          : settings.userDictionary,
      };
      renderDictionary();
    })
    .catch(() => {});
}

function setDictionaryStatus(message, error = false) {
  dictionaryStatusEl.textContent = message;
  dictionaryStatusEl.classList.toggle("error", error);
}

function applyDictionaryResponse(response) {
  if (!response?.ok) {
    throw new Error(response?.error || "dictionary-update-failed");
  }
  settings = {
    ...settings,
    ...response,
    userDictionary: Array.isArray(response.userDictionary)
      ? response.userDictionary
      : settings.userDictionary,
  };
  renderDictionary();
}

async function addDictionaryWordFromPopup() {
  const word = dictionaryWordEl.value.trim();
  if (!word) return;
  dictionaryAddButtonEl.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({
      type: "lexicon:add-to-dictionary",
      word,
    });
    applyDictionaryResponse(response);
    dictionaryWordEl.value = "";
    setDictionaryStatus(
      response.queued
        ? "Saved locally. It will sync when Lexicon is running."
        : response.added === false
          ? `"${word}" is already in your dictionary.`
          : "",
    );
  } catch (error) {
    setDictionaryStatus(error?.message || "Could not update the dictionary.", true);
  } finally {
    dictionaryAddButtonEl.disabled = false;
    dictionaryWordEl.focus();
  }
}

async function removeDictionaryWordFromPopup(word, button) {
  if (button) button.disabled = true;
  try {
    const response = await browser.runtime.sendMessage({
      type: "lexicon:remove-from-dictionary",
      word,
    });
    applyDictionaryResponse(response);
    setDictionaryStatus(
      response.queued
        ? "Removal saved locally. It will sync when Lexicon is running."
        : "",
    );
  } catch (error) {
    if (button) button.disabled = false;
    setDictionaryStatus(error?.message || "Could not update the dictionary.", true);
  }
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
    settings = {
      paused: false,
      siteDisabled: false,
      userDictionary: [],
    };
  }
  renderSettings();
  renderDictionary();
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
    syncDictionaryFromPopup();
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
  selectedText = "";
  selection = null;
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
      selectedText = "";
      selection = null;
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

function showRewrite(
  text,
  targetFieldId,
  targetFrameId,
  sourceText,
  selectedRange,
) {
  const box = document.createElement("div");
  box.className = "rewrite";
  box.textContent = text;
  resultsEl.appendChild(box);

  const replaceBtn = document.createElement("button");
  replaceBtn.type = "button";
  replaceBtn.textContent = "Replace selection";
  replaceBtn.addEventListener("click", async () => {
    replaceBtn.disabled = true;
    try {
      const response = await sendToContent({
        type: "lexicon:replace-selection",
        text,
        sourceText,
        selectedText: selectedRange?.text || sourceText,
        selection: selectedRange,
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
    const matches = await checkGrammar(
      text,
      "en-US",
      settings.userDictionary || [],
    );
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
  const transformTextValue = (selectedText || fieldText).trim();
  const targetFieldId = selectedFieldId;
  const targetFrameId = selectedFrameId;
  if (!text || !transformTextValue || !targetFieldId || settings.siteDisabled) {
    return;
  }
  setActionsEnabled(false);
  clearResults();
  try {
    const rewritten = await transformText(
      getTransformPrompt(rewriteToolEl.value),
      transformTextValue,
    );
    showRewrite(
      rewritten,
      targetFieldId,
      targetFrameId,
      fieldText,
      selection,
    );
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
dictionaryAddButtonEl.addEventListener("click", addDictionaryWordFromPopup);
dictionaryWordEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    addDictionaryWordFromPopup();
  }
});

if (browser.storage?.onChanged?.addListener) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.lexiconSettings) return;
    loadSettings();
  });
}

renderStatus(monitor.state);
monitor.start();
renderSettings();
loadSettings();
