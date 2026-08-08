// MV3 background. It runs as a module in both browsers.
// It handles the proofread shortcut: get the text, check it, draw squiggles.

import "./vendor/browser-polyfill.min.js";
import { checkGrammar, discoverBackend, getBackendBaseUrl } from "./api.js";

browser.runtime.onInstalled.addListener(() => {
  console.log("[Lexicon] installed", browser.runtime.getManifest().version);
});

browser.commands.onCommand.addListener(async (command) => {
  if (command !== "lexicon-proofread") return;
  try {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;

    let response;
    try {
      response = await browser.tabs.sendMessage(tab.id, {
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
    await browser.tabs.sendMessage(tab.id, {
      type: "lexicon:highlight",
      matches,
    });
  } catch (error) {
    console.error("[Lexicon] proofread failed", error);
  }
});
