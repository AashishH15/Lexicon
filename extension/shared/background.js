// Background service: proofread shortcut and grammar checks.

import "./vendor/browser-polyfill.min.js";
import { checkGrammar, discoverBackend, getBackendBaseUrl } from "./api.js";

browser.runtime.onInstalled.addListener(() => {
  console.log("[Lexicon] installed", browser.runtime.getManifest().version);
});

// Track the frame that owns the focused editor.
const activeFrameByTab = new Map();

async function sendToActiveFrame(tabId, message) {
  const frameId = activeFrameByTab.get(tabId);
  let response;
  if (Number.isInteger(frameId)) {
    try {
      response = await browser.tabs.sendMessage(tabId, message, { frameId });
      if (response?.ok === true) return response;
    } catch {
      activeFrameByTab.delete(tabId);
    }
  }
  // Fall back to the top frame if the stored frame is stale.
  if (frameId !== 0) {
    try {
      const topResponse = await browser.tabs.sendMessage(tabId, message, {
        frameId: 0,
      });
      if (topResponse?.ok === true || response == null) return topResponse;
      response = topResponse;
    } catch {
      // No content script on this page.
    }
  }
  return response;
}

if (browser.tabs.onRemoved) {
  browser.tabs.onRemoved.addListener((tabId) => {
    activeFrameByTab.delete(tabId);
  });
}

async function proofreadTab(tabId) {
  let response;
  try {
    response = await sendToActiveFrame(tabId, {
      type: "lexicon:get-text",
    });
  } catch {
    return;
  }
  if (!response?.ok) return;

  await discoverBackend();
  if (!getBackendBaseUrl()) return;

  const matches = await checkGrammar(response.text);
  await sendToActiveFrame(tabId, {
    type: "lexicon:highlight",
    matches,
  });
}

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "lexicon-proofread") return;
  try {
    const [tab] = await browser.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (!tab?.id) return;
    await proofreadTab(tab.id);
  } catch (error) {
    console.error("[Lexicon] proofread failed", error);
  }
});

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === "lexicon:active-field") {
    const tabId = sender?.tab?.id;
    if (Number.isInteger(tabId) && Number.isInteger(sender.frameId)) {
      activeFrameByTab.set(tabId, sender.frameId);
    }
    return { ok: true };
  }

  if (msg?.type === "lexicon:content-command") {
    const tabId = Number(msg.tabId);
    if (!Number.isInteger(tabId) || !msg.message) {
      return { ok: false, error: "invalid-content-command" };
    }
    return sendToActiveFrame(tabId, msg.message);
  }

  if (msg?.type !== "lexicon:check-text") return undefined;
  return (async () => {
    if (typeof msg.text !== "string" || !msg.text.trim()) {
      return { ok: true, matches: [] };
    }
    await discoverBackend();
    if (!getBackendBaseUrl()) {
      return { ok: false, error: "backend_unreachable", matches: [] };
    }
    try {
      const matches = await checkGrammar(msg.text);
      return { ok: true, matches };
    } catch (error) {
      return {
        ok: false,
        error: error?.message || "check_failed",
        matches: [],
      };
    }
  })();
});
