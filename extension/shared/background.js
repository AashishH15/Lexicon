// MV3 background (C48.2). Shared by both browser builds: Chrome runs this as
// a classic service worker (with the webextension-polyfill via importScripts),
// Firefox as an MV3 event page (polyfill listed first in background.scripts).
// Either way the polyfill makes `browser` exist, so this file never touches
// `chrome.*` directly.
//
// Deliberately state-free: the browser tears the worker down when idle, so
// nothing long-lived may live here. The popup talks to the backend directly
// (see api.js) and to page content via browser.tabs.sendMessage — C48.6
// routes those through this worker only if a relay ever becomes necessary.

// Chrome runs this as a classic service worker, where importScripts exists;
// Firefox's MV3 event page has no importScripts and loads the polyfill from
// background.scripts already. Guard so the same file works in both.
if (typeof importScripts === "function") {
  importScripts("vendor/browser-polyfill.min.js");
}

browser.runtime.onInstalled.addListener(() => {
  console.log("[Lexicon] installed", browser.runtime.getManifest().version);
});
