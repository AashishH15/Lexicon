// MV3 background service worker (C48.2).
//
// Deliberately state-free: the browser tears the worker down when idle, so
// nothing long-lived may live here. The popup talks to the backend directly
// (see api.js) and to page content via chrome.tabs.sendMessage — C48.6
// routes those through this worker only if a relay ever becomes necessary.

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Lexicon] installed", chrome.runtime.getManifest().version);
});
