// MV3 background (C48.2/C48.4). Runs as a MODULE in both browsers — Chrome
// as a module service worker, Firefox as a module event page (background.scripts
// + "type": "module") — so this file can import the shared ESM api.js and the
// webextension-polyfill (which is what makes `browser` exist in Chrome).
//
// State-free by design: the worker is torn down when idle, so all state
// lives inside the message exchange. The popup talks to the backend directly
// (see api.js); this worker only orchestrates the proofread shortcut
// (Alt+Shift+L): ask the content script for the focused field's text, check
// it against the backend, and tell the content script to draw squiggles.

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
      // No content script on this page (not an allowlisted site) or the
      // script isn't ready — nothing to proofread, stay quiet.
      return;
    }
    if (!response?.ok) return;

    await discoverBackend();
    if (!getBackendBaseUrl()) return; // desktop app not running (C48.5)

    const matches = await checkGrammar(response.text);
    await browser.tabs.sendMessage(tab.id, {
      type: "lexicon:highlight",
      matches,
    });
  } catch (error) {
    console.error("[Lexicon] proofread failed", error);
  }
});
