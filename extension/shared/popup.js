// Popup: proofread and rewrite the focused field.

import {
  discoverBackend,
  checkGrammar,
  transformText,
} from "./api.js";
import { getTransformPrompt, TRANSFORM_TOOLS } from "./prompts.js";
import { createBackendStatus } from "./backendStatus.js";

const statusEl = document.getElementById("status");
const inputEl = document.getElementById("input");
const proofreadBtn = document.getElementById("proofread");
const rewriteToolEl = document.getElementById("rewrite-tool");
const rewriteBtn = document.getElementById("rewrite");
const resultsEl = document.getElementById("results");

let fieldText = "";
let fieldReady = false;

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
  setActionsEnabled(
    monitor.state === "connected" && fieldReady && fieldText.trim().length > 0,
  );
}

function renderStatus(state) {
  if (state === "connected") {
    statusEl.textContent = "Connected to Lexicon";
    statusEl.classList.remove("offline");
    refreshField();
  } else if (state === "checking") {
    statusEl.textContent = "Checking for Lexicon…";
    statusEl.classList.remove("offline");
    refreshActions();
  } else {
    statusEl.textContent = "Open Lexicon to use grammar checking here";
    statusEl.classList.add("offline");
    refreshActions();
  }
}

const monitor = createBackendStatus({
  ping: async () => (await discoverBackend()) !== null,
  onChange: renderStatus,
});

async function sendToContent(msg) {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("no-tab");
  return browser.runtime.sendMessage({
    type: "lexicon:content-command",
    tabId: tab.id,
    message: msg,
  });
}

async function refreshField() {
  fieldReady = false;
  fieldText = "";
  inputEl.value = "";
  inputEl.placeholder = "Focus a text field on this page to proofread or rewrite it.";
  try {
    const response = await sendToContent({ type: "lexicon:get-text" });
    if (!response?.ok) return;
    fieldText = response.text;
    fieldReady = true;
    inputEl.value = response.text;
  } catch {
    inputEl.placeholder = "Lexicon can't run on this page.";
  } finally {
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

function showRewrite(text) {
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
      });
      if (!response?.ok) {
        showEmpty("The field changed. Proofread it again, then rewrite.");
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
  } else {
    showEmpty(`Something went wrong: ${message}`);
  }
}

async function onProofread() {
  const text = fieldText.trim();
  if (!text) return;
  setActionsEnabled(false);
  clearResults();
  try {
    const matches = await checkGrammar(text);
    await sendToContent({ type: "lexicon:highlight", matches });
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
  if (!text) return;
  setActionsEnabled(false);
  clearResults();
  try {
    const rewritten = await transformText(
      getTransformPrompt(rewriteToolEl.value),
      text,
    );
    showRewrite(rewritten);
  } catch (error) {
    showError(error.message);
  } finally {
    refreshActions();
  }
}

proofreadBtn.addEventListener("click", onProofread);
rewriteBtn.addEventListener("click", onRewrite);

renderStatus(monitor.state);
monitor.start();
