// Popup (C48.2): minimal action set — Proofread via /grammar/check and
// Rewrite via /transform, using the same request shapes as the desktop app.
// The full popup experience (C48.6) builds on this, and the content-script
// message contract replaces direct page access then.

import {
  discoverBackend,
  checkGrammar,
  transformText,
  getBackendBaseUrl,
} from "./api.js";
import { REWRITE_PROMPT } from "./prompts.js";

const statusEl = document.getElementById("status");
const inputEl = document.getElementById("input");
const proofreadBtn = document.getElementById("proofread");
const rewriteBtn = document.getElementById("rewrite");
const resultsEl = document.getElementById("results");

function renderStatus() {
  const baseUrl = getBackendBaseUrl();
  if (baseUrl) {
    statusEl.textContent = "Connected to Lexicon";
    statusEl.classList.remove("offline");
  } else {
    statusEl.textContent = "Open Lexicon to use grammar checking here";
    statusEl.classList.add("offline");
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

function showMatches(matches) {
  for (const match of matches) {
    const card = document.createElement("div");
    card.className = "match";

    const message = document.createElement("p");
    message.className = "message";
    message.textContent = match.message;
    card.appendChild(message);

    if (match.replacements.length > 0) {
      const suggestion = document.createElement("p");
      suggestion.className = "suggestion";
      suggestion.textContent = `Suggestion: ${match.replacements[0]}`;
      card.appendChild(suggestion);
    }

    resultsEl.appendChild(card);
  }
}

function showRewrite(text) {
  const el = document.createElement("div");
  el.className = "rewrite";
  el.textContent = text;
  el.addEventListener("click", () => {
    inputEl.value = text;
    clearResults();
  });
  resultsEl.appendChild(el);

  const hint = document.createElement("p");
  hint.className = "hint";
  hint.textContent = "Click the rewrite to put it back in the text box.";
  resultsEl.appendChild(hint);
}

function showError(message) {
  if (message === "backend_unreachable") {
    showEmpty("Open Lexicon to use grammar checking here.");
  } else {
    showEmpty(`Something went wrong: ${message}`);
  }
}

async function refreshStatus() {
  await discoverBackend();
  renderStatus();
}

async function onProofread() {
  const text = inputEl.value.trim();
  if (!text) return;
  proofreadBtn.disabled = true;
  clearResults();
  try {
    const matches = await checkGrammar(text);
    if (matches.length === 0) {
      showEmpty("No issues found.");
    } else {
      showMatches(matches);
    }
    renderStatus();
  } catch (error) {
    showError(error.message);
  } finally {
    proofreadBtn.disabled = false;
  }
}

async function onRewrite() {
  const text = inputEl.value.trim();
  if (!text) return;
  rewriteBtn.disabled = true;
  clearResults();
  try {
    const rewritten = await transformText(REWRITE_PROMPT, text);
    showRewrite(rewritten);
    renderStatus();
  } catch (error) {
    showError(error.message);
  } finally {
    rewriteBtn.disabled = false;
  }
}

proofreadBtn.addEventListener("click", onProofread);
rewriteBtn.addEventListener("click", onRewrite);

refreshStatus();
