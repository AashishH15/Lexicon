// MV3 background. It runs as a module in both browsers.
// It handles the proofread shortcut and idle re-proofread checks from
// the content script.

import "./vendor/browser-polyfill.min.js";
import { checkGrammar, discoverBackend, getBackendBaseUrl } from "./api.js";

browser.runtime.onInstalled.addListener(() => {
  console.log("[Lexicon] installed", browser.runtime.getManifest().version);
});

async function proofreadTab(tabId) {
  let response;
  try {
    response = await browser.tabs.sendMessage(tabId, {
      type: "lexicon:get-text",
    });
  } catch {
    // No content script on this page. Stay quiet.
    return;
  }
  if (!response?.ok) return;

  await discoverBackend();
  if (!getBackendBaseUrl()) return; // The desktop app is not running.

  const matches = await checkGrammar(response.text);
  await browser.tabs.sendMessage(tabId, {
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

// Content script asks for a grammar check after the user stops typing.
browser.runtime.onMessage.addListener((msg) => {
  if (msg?.type !== "lexicon:check-text") return undefined;
  return (async () => {
    if (typeof msg.text !== "string" || !msg.text.trim()) return [];
    await discoverBackend();
    if (!getBackendBaseUrl()) return [];
    return checkGrammar(msg.text);
  })();
});
