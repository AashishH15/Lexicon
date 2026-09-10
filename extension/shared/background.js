// Background service: proofread, grammar, and AI tool requests.

import "./vendor/browser-polyfill.min.js";
import {
  addDictionaryWord,
  checkGrammar,
  discoverBackend,
  getBackendBaseUrl,
  getDictionary,
  getAiStatus,
  getAiStatusLite,
  removeDictionaryWord,
  transformText,
} from "./api.js";
import {
  EXPRESS_TOOL,
  getExpressPrompt,
  getTransformPrompt,
  TRANSFORM_TOOLS,
} from "./prompts.js";
import {
  EXPRESS_MAX_CHARS,
  parseExpressJson,
  resolveExpressGate,
} from "./expressParser.js";
import {
  dedupeDeepMatches,
  deepEditsToMatches,
  getDeepProofreadPrompt,
  parseDeepEdits,
  splitDeepChunks,
  validateDeepEdits,
} from "./deepProofread.js";
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  isSiteDisabled,
  normalizeDictionary,
  normalizeDictionaryOperations,
  normalizeDictionaryRevision,
  normalizeDictionaryWord,
  normalizeSettings,
  normalizeSite,
  queueDictionaryOperation,
} from "./settings.js";

browser.runtime.onInstalled.addListener(() => {
  console.log("[Lexicon] installed", browser.runtime.getManifest().version);
  synchronizeDictionary({ force: true }).catch(() => {});
});

if (browser.runtime.onStartup?.addListener) {
  browser.runtime.onStartup.addListener(() => {
    synchronizeDictionary({ force: true }).catch(() => {});
  });
}

// Track the frame that owns the focused editor.
const activeFrameByTab = new Map();
const frameIdsByTab = new Map();

function rememberFrame(tabId, frameId, active = false) {
  if (!Number.isInteger(tabId) || !Number.isInteger(frameId)) return;
  let frameIds = frameIdsByTab.get(tabId);
  if (!frameIds) {
    frameIds = new Set();
    frameIdsByTab.set(tabId, frameIds);
  }
  frameIds.add(frameId);
  if (active) activeFrameByTab.set(tabId, frameId);
}

function forgetFrame(tabId, frameId) {
  const frameIds = frameIdsByTab.get(tabId);
  if (!frameIds) return;
  frameIds.delete(frameId);
  if (frameIds.size === 0) frameIdsByTab.delete(tabId);
  if (activeFrameByTab.get(tabId) === frameId) {
    activeFrameByTab.delete(tabId);
  }
}

async function sendToFrame(tabId, frameId, message) {
  rememberFrame(tabId, frameId);
  try {
    return await browser.tabs.sendMessage(tabId, message, { frameId });
  } catch {
    forgetFrame(tabId, frameId);
    return undefined;
  }
}

async function readSettings() {
  try {
    const stored = await browser.storage.local.get(SETTINGS_STORAGE_KEY);
    return normalizeSettings(stored?.[SETTINGS_STORAGE_KEY] ?? DEFAULT_SETTINGS);
  } catch {
    return normalizeSettings(DEFAULT_SETTINGS);
  }
}

function settingsForSite(settings, site) {
  const normalizedSite = normalizeSite(site);
  return {
    ...settings,
    site: normalizedSite,
    siteDisabled: isSiteDisabled(settings, normalizedSite),
  };
}

function senderSite(sender) {
  return normalizeSite(sender?.url) || normalizeSite(sender?.tab?.url);
}

async function getSettingsForSite(site) {
  return settingsForSite(await readSettings(), site);
}

async function saveSettings(settings, tabId) {
  const normalized = normalizeSettings(settings);
  await browser.storage.local.set({
    [SETTINGS_STORAGE_KEY]: normalized,
  });
  let tabs = [];
  try {
    tabs = Number.isInteger(tabId)
      ? [{ id: tabId }]
      : await browser.tabs.query({});
  } catch {
    tabs = [];
  }
  await Promise.all(
    tabs
      .filter((tab) => Number.isInteger(tab.id))
      .map(async (tab) => {
        const site = normalizeSite(tab.url);
        const messageSettings = site
          ? {
              ...normalized,
              siteDisabled: isSiteDisabled(normalized, site),
            }
          : normalized;
        const frameIds = new Set([0, ...(frameIdsByTab.get(tab.id) || [])]);
        await Promise.all(
          [...frameIds].map((frameId) =>
            sendToFrame(tab.id, frameId, {
              type: "lexicon:settings-changed",
              settings: messageSettings,
            }),
          ),
        );
      }),
  );
  return normalized;
}

const DICTIONARY_SYNC_COOLDOWN_MS = 3000;
let dictionaryLastSyncAt = 0;
let dictionarySyncPromise = null;

function validateDictionarySnapshot(snapshot) {
  if (
    !snapshot ||
    !Array.isArray(snapshot.words) ||
    !Number.isSafeInteger(Number(snapshot.revision)) ||
    Number(snapshot.revision) < 0
  ) {
    throw new Error("Invalid dictionary response");
  }
  return {
    words: normalizeDictionary(snapshot.words),
    revision: normalizeDictionaryRevision(snapshot.revision),
  };
}

function scheduleDictionaryTask(task) {
  const previous = dictionarySyncPromise || Promise.resolve();
  const next = previous.then(task, task);
  dictionarySyncPromise = next;
  next.then(
    () => {
      if (dictionarySyncPromise === next) dictionarySyncPromise = null;
    },
    () => {
      if (dictionarySyncPromise === next) dictionarySyncPromise = null;
    },
  );
  return next;
}

async function synchronizeDictionaryCore(settings) {
  await discoverBackend();
  if (!getBackendBaseUrl()) {
    return { settings, synced: false, lastResult: null };
  }

  let snapshot = validateDictionarySnapshot(await getDictionary());
  let current = normalizeSettings(settings);
  if (
    current.dictionaryMigrated &&
    snapshot.revision < current.dictionaryRevision
  ) {
    throw new Error("Stale dictionary response");
  }
  if (!current.dictionaryMigrated) {
    // Merge the old browser-local cache through idempotent delta adds before
    // the canonical revision becomes authoritative.
    for (const word of current.userDictionary) {
      snapshot = validateDictionarySnapshot(await addDictionaryWord(word));
    }
    current = {
      ...current,
      dictionaryRevision: snapshot.revision,
      dictionaryMigrated: true,
    };
    await saveSettings(current);
  }

  let lastResult = null;
  let pending = normalizeDictionaryOperations(current.pendingDictionaryOps);
  while (pending.length > 0) {
    const operation = pending[0];
    lastResult =
      operation.op === "add"
        ? await addDictionaryWord(operation.word)
        : await removeDictionaryWord(operation.word);
    snapshot = validateDictionarySnapshot(lastResult);
    if (snapshot.revision < current.dictionaryRevision) {
      throw new Error("Stale dictionary response");
    }
    pending = pending.slice(1);
    current = await saveSettings({
      ...current,
      userDictionary: snapshot.words,
      dictionaryRevision: snapshot.revision,
      pendingDictionaryOps: pending,
    });
  }

  current = await saveSettings({
    ...current,
    userDictionary: snapshot.words,
    dictionaryRevision: snapshot.revision,
    pendingDictionaryOps: pending,
  });
  return { settings: current, synced: true, lastResult };
}

function synchronizeDictionary({ force = false } = {}) {
  if (dictionarySyncPromise) return dictionarySyncPromise;
  if (
    !force &&
    dictionaryLastSyncAt > 0 &&
    Date.now() - dictionaryLastSyncAt < DICTIONARY_SYNC_COOLDOWN_MS
  ) {
    return readSettings();
  }

  return scheduleDictionaryTask(async () => {
    const cached = await readSettings();
    try {
      const result = await synchronizeDictionaryCore(cached);
      if (result.synced) dictionaryLastSyncAt = Date.now();
      return result.settings;
    } catch {
      // The cache and pending deltas remain available until the sidecar can
      // be reached again.
      return cached;
    }
  });
}

async function mutateDictionary(op, value) {
  const word = normalizeDictionaryWord(value);
  if (!word) return { ok: false, error: "invalid-dictionary-word" };

  return scheduleDictionaryTask(async () => {
    let settings = await readSettings();
    const currentWords = normalizeDictionary(settings.userDictionary);
    const key = word.toLowerCase();
    const existing = currentWords.find((item) => item.toLowerCase() === key);
    const operationWord = existing || word;
    const nextWords =
      op === "add"
        ? existing
          ? currentWords
          : [...currentWords, word]
        : currentWords.filter((item) => item.toLowerCase() !== key);

    settings = await saveSettings({
      ...settings,
      userDictionary: nextWords,
      pendingDictionaryOps: queueDictionaryOperation(
        settings.pendingDictionaryOps,
        op,
        operationWord,
      ),
    });

    let result;
    try {
      result = await synchronizeDictionaryCore(settings);
      if (result.synced) dictionaryLastSyncAt = Date.now();
    } catch {
      result = { settings, synced: false, lastResult: null };
    }

    const finalSettings = result.settings;
    const response = {
      ok: true,
      queued: !result.synced || finalSettings.pendingDictionaryOps.length > 0,
      word: result.lastResult?.word || existing || word,
      words: finalSettings.userDictionary,
      userDictionary: finalSettings.userDictionary,
      dictionaryRevision: finalSettings.dictionaryRevision,
      pendingDictionaryOps: finalSettings.pendingDictionaryOps,
    };
    if (op === "add") {
      response.added = result.lastResult
        ? Boolean(result.lastResult.added || !existing)
        : !existing;
    } else {
      response.removed = result.lastResult
        ? Boolean(result.lastResult.removed || existing)
        : Boolean(existing);
    }
    return response;
  });
}

async function sendToActiveFrame(tabId, message) {
  const frameId = activeFrameByTab.get(tabId);
  let response;
  if (Number.isInteger(frameId)) {
    response = await sendToFrame(tabId, frameId, message);
    if (response?.ok === true) return response;
  }
  // Fall back to the top frame if the stored frame is stale.
  if (frameId !== 0) {
    const topResponse = await sendToFrame(tabId, 0, message);
    if (topResponse?.ok === true || response == null) return topResponse;
    response = topResponse;
  }
  return response;
}

async function listFieldsInFrames(tabId) {
  const frameIds = new Set([0, ...(frameIdsByTab.get(tabId) || [])]);
  const results = await Promise.all(
    [...frameIds].map(async (frameId) => ({
      frameId,
      response: await sendToFrame(tabId, frameId, {
        type: "lexicon:list-fields",
      }),
    })),
  );
  const withFields = results.find(
    ({ response }) =>
      response?.ok === true &&
      Array.isArray(response.fields) &&
      response.fields.length > 0,
  );
  if (withFields) {
    return { ...withFields.response, frameId: withFields.frameId };
  }
  const empty = results.find(({ response }) => response?.ok === true);
  if (empty) {
    return { ...empty.response, frameId: empty.frameId };
  }
  return { ok: false, error: "no-content-script", fields: [] };
}

function aiStatusIsConfigured(status) {
  const preference = status?.preference || {};
  if (preference.backend === "ollama") {
    return Boolean(status?.ollama_available);
  }
  if (preference.backend === "lmstudio") {
    return Boolean(status?.lmstudio_available);
  }
  return Boolean(
    status?.models_ready?.[preference.model_key || status?.model_key],
  );
}

// Proofreading language shared with the desktop app through the
// backend preference. Cached briefly so per-keystroke checks stay
// cheap. Falls back to en-US on older backends and outages.
const LANGUAGE_CACHE_TTL_MS = 60000;
let cachedLanguage = null; // { value, at } | null

export function resetExtensionLanguageCache() {
  cachedLanguage = null;
}

function rememberLanguage(status) {
  const tag = status?.preference?.proofreading_language;
  const value =
    typeof tag === "string" && tag.trim() ? tag.trim() : "en-US";
  cachedLanguage = { value, at: Date.now() };
  return value;
}

async function extensionLanguage() {
  if (
    cachedLanguage &&
    Date.now() - cachedLanguage.at < LANGUAGE_CACHE_TTL_MS
  ) {
    return cachedLanguage.value;
  }
  try {
    await discoverBackend();
    if (!getBackendBaseUrl()) {
      return cachedLanguage?.value || "en-US";
    }
    return rememberLanguage(await getAiStatusFast());
  } catch {
    return cachedLanguage?.value || "en-US";
  }
}

// Fast AI status for hot paths. Falls back to the full status on
// older backends without the lite endpoint.
async function getAiStatusFast() {
  try {
    return await getAiStatusLite();
  } catch {
    return getAiStatus();
  }
}

// Short engine readout for the popup header. Mirrors
// formatEngineTierLabel in frontend/src/lexStatus.js. Empty string
// means hide the readout.
function engineTierLabel(status) {
  try {
    if (!status || typeof status !== "object" || Array.isArray(status)) {
      return "";
    }
    if (!aiStatusIsConfigured(status)) {
      return "";
    }
    const preference =
      status.preference && typeof status.preference === "object"
        ? status.preference
        : {};
    const backend = preference.backend || "auto";
    const active = status.active_backend || "";
    if (backend === "ollama" || active === "ollama") {
      return "Ollama";
    }
    if (backend === "lmstudio" || active === "lmstudio") {
      return "LM Studio";
    }
    const key = preference.model_key || status.model_key || "2b";
    const tiers = { "0.8b": "Light", "2b": "Standard", quality: "Quality" };
    const label = tiers[key] || "Standard";
    const device = preference.device || "";
    return device ? `${label} · ${String(device).toUpperCase()}` : label;
  } catch {
    return "";
  }
}

if (browser.tabs.onRemoved) {
  browser.tabs.onRemoved.addListener((tabId) => {
    activeFrameByTab.delete(tabId);
    frameIdsByTab.delete(tabId);
  });
}

async function proofreadTab(tabId) {
  let tab;
  try {
    tab = await browser.tabs.get(tabId);
  } catch {
    return;
  }
  const settings = settingsForSite(
    await synchronizeDictionary({ force: true }),
    tab?.url,
  );
  if (settings.paused || settings.siteDisabled) return;

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

  const matches = await checkGrammar(
    response.text,
    await extensionLanguage(),
    settings.userDictionary,
  );
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
  if (msg?.type === "lexicon:get-ai-status") {
    return (async () => {
      await discoverBackend();
      if (!getBackendBaseUrl()) {
        return { ok: false, error: "backend_unreachable", configured: false };
      }
      try {
        const status = await getAiStatusFast();
        return {
          ok: true,
          configured: aiStatusIsConfigured(status),
          express: resolveExpressGate(status),
          engine: engineTierLabel(status),
          language: rememberLanguage(status),
        };
      } catch (error) {
        return {
          ok: false,
          error: error?.message || "ai-status-unavailable",
        };
      }
    })();
  }

  if (msg?.type === "lexicon:sync-dictionary") {
    return synchronizeDictionary({ force: true }).then((settings) => ({
      ok: true,
      ...settings,
      userDictionary: settings.userDictionary,
    }));
  }

  if (msg?.type === "lexicon:get-settings") {
    rememberFrame(sender?.tab?.id, sender?.frameId);
    return synchronizeDictionary().then((settings) =>
      settingsForSite(settings, msg.site || senderSite(sender)),
    );
  }

  if (msg?.type === "lexicon:frame-ready") {
    rememberFrame(sender?.tab?.id, sender?.frameId);
    return { ok: true };
  }

  if (msg?.type === "lexicon:frame-fields") {
    const tabId = sender?.tab?.id;
    const frameId = sender?.frameId;
    rememberFrame(tabId, frameId);
    if (msg.hasFields && Number.isInteger(tabId) && Number.isInteger(frameId)) {
      activeFrameByTab.set(tabId, frameId);
    } else if (
      Number.isInteger(tabId) &&
      activeFrameByTab.get(tabId) === frameId
    ) {
      activeFrameByTab.delete(tabId);
    }
    return { ok: true };
  }

  if (msg?.type === "lexicon:set-paused") {
    return (async () => {
      try {
        const settings = await readSettings();
        const saved = await saveSettings(
          { ...settings, paused: Boolean(msg.paused) },
          Number.isInteger(msg.tabId) ? msg.tabId : undefined,
        );
        return settingsForSite(saved, msg.site || senderSite(sender));
      } catch (error) {
        return { ok: false, error: error?.message || "settings-save-failed" };
      }
    })();
  }

  if (msg?.type === "lexicon:set-site-disabled") {
    return (async () => {
      const site = normalizeSite(msg.site || senderSite(sender));
      if (!site) return { ok: false, error: "invalid-site" };
      try {
        const settings = await readSettings();
        const disabledSites = new Set(settings.disabledSites);
        if (msg.disabled) disabledSites.add(site);
        else disabledSites.delete(site);
        const saved = await saveSettings(
          { ...settings, disabledSites: [...disabledSites] },
          Number.isInteger(msg.tabId) ? msg.tabId : undefined,
        );
        return settingsForSite(saved, site);
      } catch (error) {
        return { ok: false, error: error?.message || "settings-save-failed" };
      }
    })();
  }

  if (msg?.type === "lexicon:set-deep-auto-run") {
    return (async () => {
      try {
        const settings = await readSettings();
        const saved = await saveSettings(
          { ...settings, deepAutoRun: Boolean(msg.enabled) },
          Number.isInteger(msg.tabId) ? msg.tabId : undefined,
        );
        return settingsForSite(saved, msg.site || senderSite(sender));
      } catch (error) {
        return { ok: false, error: error?.message || "settings-save-failed" };
      }
    })();
  }

  if (msg?.type === "lexicon:active-field") {
    const tabId = sender?.tab?.id;
    if (Number.isInteger(tabId) && Number.isInteger(sender.frameId)) {
      rememberFrame(tabId, sender.frameId, true);
    }
    return { ok: true };
  }

  if (msg?.type === "lexicon:add-to-dictionary") {
    return mutateDictionary("add", msg.word);
  }

  if (msg?.type === "lexicon:remove-from-dictionary") {
    return mutateDictionary("remove", msg.word);
  }

  if (msg?.type === "lexicon:content-command") {
    const tabId = Number(msg.tabId);
    if (!Number.isInteger(tabId) || !msg.message) {
      return { ok: false, error: "invalid-content-command" };
    }
    if (msg.message.type === "lexicon:list-fields") {
      return listFieldsInFrames(tabId);
    }
    if (Number.isInteger(msg.frameId)) {
      return sendToFrame(tabId, msg.frameId, msg.message);
    }
    return sendToActiveFrame(tabId, msg.message);
  }

  if (msg?.type === "lexicon:transform-text") {
    return (async () => {
      rememberFrame(sender?.tab?.id, sender?.frameId);
      const settings = await getSettingsForSite(senderSite(sender));
      if (settings.siteDisabled) {
        return { ok: false, error: "site-disabled" };
      }
      if (
        typeof msg.text !== "string" ||
        !msg.text.trim() ||
        !TRANSFORM_TOOLS.includes(msg.tool)
      ) {
        return { ok: false, error: "invalid-transform-request" };
      }
      // Express answers in JSON with five tones. Check the length first
      // with no network, then the tier, then run one model call.
      if (msg.tool === EXPRESS_TOOL) {
        if (msg.text.length > EXPRESS_MAX_CHARS) {
          return {
            ok: false,
            error: "Please select a sentence or short paragraph.",
          };
        }
        await discoverBackend();
        if (!getBackendBaseUrl()) {
          return { ok: false, error: "backend_unreachable" };
        }
        // A failed probe must not strand a ready model. Run and let
        // the transform report real errors instead.
        const gate = await getAiStatusFast().then(resolveExpressGate, () => "run");
        if (gate !== "run") {
          return {
            ok: false,
            error:
              gate === "light"
                ? "Express in English needs Standard or Quality."
                : "Set up a model in Lexicon to use Express in English.",
          };
        }
        try {
          const parsed = parseExpressJson(
            await transformText(getExpressPrompt(), msg.text),
          );
          return {
            ok: true,
            express: true,
            detectedLanguage: parsed.detectedLanguage,
            tones: parsed.tones,
          };
        } catch (error) {
          return {
            ok: false,
            error: error?.message || "transform_failed",
          };
        }
      }
      await discoverBackend();
      if (!getBackendBaseUrl()) {
        return { ok: false, error: "backend_unreachable" };
      }
      try {
        const text = await transformText(
          getTransformPrompt(msg.tool, await extensionLanguage()),
          msg.text,
        );
        return { ok: true, text };
      } catch (error) {
        return {
          ok: false,
          error: error?.message || "transform_failed",
        };
      }
    })();
  }

  if (msg?.type === "lexicon:deep-proofread") {
    return (async () => {
      rememberFrame(sender?.tab?.id, sender?.frameId);
      const settings = settingsForSite(
        await synchronizeDictionary(),
        senderSite(sender),
      );
      if (settings.siteDisabled) {
        return { ok: false, error: "site-disabled", matches: [] };
      }
      if (settings.paused) {
        return { ok: false, error: "proofreading-paused", matches: [] };
      }
      const text = String(msg.text || "");
      if (!text.trim()) {
        return { ok: true, matches: [] };
      }
      await discoverBackend();
      if (!getBackendBaseUrl()) {
        return { ok: false, error: "backend_unreachable", matches: [] };
      }
      let status;
      try {
        status = await getAiStatusFast();
      } catch {
        return { ok: false, error: "ai-status-unavailable", matches: [] };
      }
      if (!aiStatusIsConfigured(status)) {
        return { ok: false, error: "ai-not-configured", matches: [] };
      }
      const modelKey =
        status?.preference?.model_key || status?.model_key || "2b";
      const prompt = getDeepProofreadPrompt(modelKey, rememberLanguage(status));
      const chunks = splitDeepChunks(text);
      if (chunks.length === 0) {
        return { ok: true, matches: [] };
      }
      const baseline = Array.isArray(msg.baseline) ? msg.baseline : [];
      const matches = [];
      let nextId = 0;
      try {
        for (const chunk of chunks) {
          const raw = await transformText(prompt, chunk.text);
          let items;
          try {
            items = parseDeepEdits(raw);
          } catch {
            return {
              ok: false,
              error: "deep-proofread-unusable",
              matches: [],
            };
          }
          const { edits } = validateDeepEdits(chunk.text, items);
          const converted = deepEditsToMatches({
            edits,
            chunkStart: chunk.start,
            startId: nextId,
          });
          matches.push(...converted.matches);
          nextId = converted.nextId;
        }
      } catch (error) {
        return {
          ok: false,
          error: error?.message || "transform_failed",
          matches: [],
        };
      }
      return { ok: true, matches: dedupeDeepMatches(matches, baseline) };
    })();
  }

  if (msg?.type !== "lexicon:check-text") return undefined;
  return (async () => {
    rememberFrame(sender?.tab?.id, sender?.frameId);
    const settings = settingsForSite(
      await synchronizeDictionary(),
      senderSite(sender),
    );
    if (settings.siteDisabled) {
      return { ok: false, error: "site-disabled", matches: [] };
    }
    if (settings.paused) {
      return { ok: false, error: "proofreading-paused", matches: [] };
    }
    if (typeof msg.text !== "string" || !msg.text.trim()) {
      return { ok: true, matches: [] };
    }
    await discoverBackend();
    if (!getBackendBaseUrl()) {
      return { ok: false, error: "backend_unreachable", matches: [] };
    }
    try {
      const matches = await checkGrammar(
        msg.text,
        msg.language || (await extensionLanguage()),
        settings.userDictionary,
      );
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
