// Content script: detect fields, draw squiggles, show suggestions.
// Messages: lexicon:list-fields, lexicon:select-field, lexicon:get-text,
// lexicon:highlight, lexicon:clear-highlights, lexicon:replace-text,
// lexicon:transform-text, lexicon:add-to-dictionary.

(function () {
  "use strict";

  const editable = globalThis.__lexiconEditable;
  const squiggle = globalThis.__lexiconSquiggle;
  const suggestions = globalThis.__lexiconSuggestions;
  const REPROOFREAD_MS = 700;
  const FIELD_SCAN_MS = 120;
  const MAX_CONCURRENT_CHECKS = 3;
  const fieldStates = new Map();
  const observedFields = new Set();
  const checkQueue = [];
  let activeField = null;
  let fieldScanTimer = null;
  let activeChecks = 0;
  let intersectionObserver = null;
  let settingsReady = false;
  let proofreadingPaused = false;
  let siteDisabled = false;
  let userDictionary = new Set();
  let nextFieldId = 1;
  let frameHasFields = null;

  function fieldIsAttached(field) {
    return Boolean(
      field &&
        (field.isConnected === true ||
          (document.contains && document.contains(field))),
    );
  }

  function currentSite() {
    return String(location.hostname || "").toLowerCase().replace(/\.$/, "");
  }

  function isSiteDisabledBySettings(nextSettings) {
    if (typeof nextSettings?.siteDisabled === "boolean") {
      return nextSettings.siteDisabled;
    }
    const disabledSites = Array.isArray(nextSettings?.disabledSites)
      ? nextSettings.disabledSites
      : [];
    const site = currentSite();
    return site ? disabledSites.includes(site) : siteDisabled;
  }

  function isSiteEnabled() {
    return settingsReady && !siteDisabled;
  }

  function isProofreadingEnabled() {
    return isSiteEnabled() && !proofreadingPaused;
  }

  function applySettings(nextSettings) {
    const wasEnabled = isProofreadingEnabled();
    const nextDictionary = new Set(
      (Array.isArray(nextSettings?.userDictionary)
        ? nextSettings.userDictionary
        : []
      )
        .map((word) => String(word ?? "").trim().toLowerCase())
        .filter(Boolean),
    );
    const dictionaryChanged =
      nextDictionary.size !== userDictionary.size ||
      [...nextDictionary].some((word) => !userDictionary.has(word));
    settingsReady = true;
    proofreadingPaused = Boolean(nextSettings?.paused);
    siteDisabled = isSiteDisabledBySettings(nextSettings);
    userDictionary = nextDictionary;
    const enabled = isProofreadingEnabled();
    if (!enabled) {
      checkQueue.length = 0;
      for (const state of fieldStates.values()) suspendState(state);
    } else if (!wasEnabled) {
      scanEditableFields(true);
    }
    if (enabled && dictionaryChanged) {
      for (const state of fieldStates.values()) {
        if (state.visible && state.matches) {
          redrawMatches(state, state.matches);
        }
        if (state.visible && state.text && state.text.trim()) {
          scheduleFieldCheck(state);
        }
      }
    }
  }

  function fieldIsInViewport(field) {
    return (
      fieldIsAttached(field) &&
      editable.isVisible(field) &&
      suggestions.fieldInViewport(field)
    );
  }

  function notifyActiveField() {
    browser.runtime
      .sendMessage({ type: "lexicon:active-field" })
      .catch(() => {});
  }

  function notifyFrameFields(hasFields) {
    const value = Boolean(hasFields);
    if (frameHasFields === value) return;
    frameHasFields = value;
    browser.runtime
      .sendMessage({ type: "lexicon:frame-fields", hasFields: value })
      .catch(() => {});
  }

  function matchKey(match, text) {
    const original =
      (text &&
      Number.isInteger(match.offset) &&
      Number.isInteger(match.length)
        ? text.slice(match.offset, match.offset + match.length)
        : match.original) || "";
    const offset = Number.isInteger(match.offset) ? match.offset : "";
    return `${match.message || ""}::${original}::${offset}`;
  }

  function validMatches(matches) {
    return (matches ?? []).filter(
      (match) =>
        match &&
        Number.isInteger(match.offset) &&
        Number.isInteger(match.length) &&
        match.length > 0,
    );
  }

  function filterDismissed(matches, state) {
    return (matches || []).filter(
      (match) => {
        const word =
          Number.isInteger(match.offset) && Number.isInteger(match.length)
            ? String(state.text || "")
                .slice(match.offset, match.offset + match.length)
                .trim()
                .toLowerCase()
            : "";
        return (
          !state.dismissedKeys.has(matchKey(match, state.text)) &&
          !userDictionary.has(word)
        );
      },
    );
  }

  function getOrCreateState(field) {
    let state = fieldStates.get(field);
    if (state) return state;
    state = {
      field,
      fieldId: `field-${nextFieldId++}`,
      kind: null,
      text: null,
      segments: null,
      matches: null,
      checkedText: null,
      checking: false,
      offline: false,
      visible: false,
      checkTimer: null,
      checkToken: 0,
      requestToken: 0,
      queuedCheck: null,
      programmaticChange: false,
      programmaticClearTimer: null,
      inputHandlers: null,
      mutationObserver: null,
      dismissedKeys: new Set(),
    };
    fieldStates.set(field, state);
    return state;
  }

  function fieldAttribute(field, name) {
    return String(field?.getAttribute?.(name) || "").trim();
  }

  function fieldDisplayName(field, index) {
    const ariaLabel = fieldAttribute(field, "aria-label");
    if (ariaLabel) return ariaLabel;
    const labels = field?.labels;
    const labelText = labels?.[0]?.textContent?.trim();
    if (labelText) return labelText.replace(/\s+/g, " ");
    const placeholder = fieldAttribute(field, "placeholder");
    if (placeholder) return placeholder;
    const name = fieldAttribute(field, "name");
    if (name) return name;
    return `Text field ${index + 1}`;
  }

  function visibleFieldDetails() {
    const detected = editable.detectEditableFields
      ? editable.detectEditableFields(document, { visibleOnly: true })
      : [editable.detectEditableField(document)].filter(Boolean);
    const candidates = [...detected];
    for (const state of fieldStates.values()) {
      if (fieldIsInViewport(state.field)) candidates.push(state.field);
    }
    const fields = [];
    const seen = new Set();
    for (const field of candidates) {
      if (
        seen.has(field) ||
        !fieldIsAttached(field) ||
        !editable.isVisible(field) ||
        !suggestions.fieldInViewport(field)
      ) {
        continue;
      }
      seen.add(field);
      const state = getOrCreateState(field);
      const text = editable.extractEditableText(field).text;
      const preview = text.trim().replace(/\s+/g, " ").slice(0, 72);
      fields.push({
        id: state.fieldId,
        label: fieldDisplayName(field, fields.length),
        preview,
        active: activeField === field,
      });
    }
    return fields;
  }

  function refreshStateText(state) {
    const extracted = editable.extractEditableText(state.field);
    const changed = state.text !== extracted.text;
    state.kind = extracted.kind;
    state.text = extracted.text;
    state.segments = extracted.segments;
    if (changed) {
      state.matches = null;
      state.checkedText = null;
      state.offline = false;
    }
    return changed;
  }

  function invalidateCheck(state) {
    if (state.checkTimer) {
      clearTimeout(state.checkTimer);
      state.checkTimer = null;
    }
    state.checkToken += 1;
    state.requestToken += 1;
    state.queuedCheck = null;
  }

  function beginProgrammaticChange(state) {
    state.programmaticChange = true;
    if (state.programmaticClearTimer) {
      clearTimeout(state.programmaticClearTimer);
      state.programmaticClearTimer = null;
    }
  }

  function endProgrammaticChange(state, holdMs) {
    if (state.programmaticClearTimer) {
      clearTimeout(state.programmaticClearTimer);
    }
    const ms = Number.isFinite(holdMs) ? holdMs : 50;
    state.programmaticClearTimer = setTimeout(() => {
      state.programmaticClearTimer = null;
      state.programmaticChange = false;
    }, ms);
  }

  function detachInputWatch(state) {
    const handlers = state.inputHandlers;
    if (handlers) {
      state.field.removeEventListener("input", handlers.onInput);
      state.field.removeEventListener("beforeinput", handlers.onBeforeInput);
      state.field.removeEventListener("keydown", handlers.onKeydown);
      state.inputHandlers = null;
    }
    if (state.mutationObserver) {
      state.mutationObserver.disconnect();
      state.mutationObserver = null;
    }
  }

  function attachInputWatch(state) {
    if (state.inputHandlers) return;
    const handlers = {
      onInput: () => onFieldInput(state),
      onBeforeInput: (event) => onFieldBeforeInput(state, event),
      onKeydown: (event) => onFieldKeydown(state, event),
    };
    state.inputHandlers = handlers;
    state.field.addEventListener("input", handlers.onInput);
    state.field.addEventListener("beforeinput", handlers.onBeforeInput);
    state.field.addEventListener("keydown", handlers.onKeydown);

    const host = String(location.hostname || "");
    if (state.field.isContentEditable && host === "mail.google.com") {
      state.mutationObserver = new MutationObserver(() =>
        onFieldMutation(state),
      );
      state.mutationObserver.observe(state.field, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  function hideStateVisuals(state) {
    squiggle.clearFieldSquiggles(state.field);
    suggestions.hideField(state.field);
  }

  function removeState(state) {
    invalidateCheck(state);
    detachInputWatch(state);
    hideStateVisuals(state);
    if (state.programmaticClearTimer) {
      clearTimeout(state.programmaticClearTimer);
      state.programmaticClearTimer = null;
    }
    fieldStates.delete(state.field);
    if (activeField === state.field) activeField = null;
  }

  function suspendState(state) {
    if (!state || !state.visible) return;
    state.visible = false;
    state.checking = false;
    invalidateCheck(state);
    detachInputWatch(state);
    hideStateVisuals(state);
  }

  function showChecking(state) {
    state.checking = true;
    state.offline = false;
    state.matches = [];
    squiggle.clearFieldSquiggles(state.field);
    suggestions.showField(state.field, [], {
      ...suggestionHandlers(state),
      checking: true,
    });
  }

  function showOffline(state) {
    if (!state.visible || !fieldIsAttached(state.field)) return;
    state.checking = false;
    state.offline = true;
    state.matches = [];
    state.checkedText = state.text;
    squiggle.clearFieldSquiggles(state.field);
    suggestions.showField(state.field, [], {
      ...suggestionHandlers(state),
      offline: true,
    });
  }

  function rangesForMatches(state, matches) {
    if (state.kind === "textarea") {
      return matches.map((match) => ({
        start: match.offset,
        end: match.offset + match.length,
      }));
    }
    return editable.matchRanges(matches, state.segments);
  }

  function applyHighlight(state, matches) {
    if (!state.visible || !fieldIsAttached(state.field)) return 0;
    const cleaned = filterDismissed(validMatches(matches), state);
    state.matches = cleaned;
    state.checking = false;
    state.offline = false;
    state.checkedText = state.text;
    if (cleaned.length === 0) {
      squiggle.clearFieldSquiggles(state.field);
      suggestions.showField(state.field, [], suggestionHandlers(state));
      return 0;
    }
    const ranges = rangesForMatches(state, cleaned);
    squiggle.applyFieldSquiggles(
      state.field,
      ranges,
      state.text,
      squiggleHandlers(state),
    );
    suggestions.showField(state.field, cleaned, suggestionHandlers(state));
    return ranges.length;
  }

  function redrawMatches(state, matches) {
    if (!state.visible || !fieldIsAttached(state.field)) return;
    refreshStateText(state);
    state.matches = filterDismissed(matches, state);
    state.checkedText = state.text;
    applyHighlight(state, state.matches);
  }

  function shiftRemaining(matches, applied, delta) {
    const next = [];
    for (const match of matches) {
      if (match === applied) continue;
      if (match.offset + match.length <= applied.offset) {
        next.push(match);
      } else if (match.offset >= applied.offset + applied.length) {
        next.push({ ...match, offset: match.offset + delta });
      }
    }
    return next;
  }

  function suggestionHandlers(state) {
    return {
      onApply: (index) => {
        const match = state.matches && state.matches[index];
        if (match) applyMatch(state, match);
      },
      onDismiss: (index) => {
        const match = state.matches && state.matches[index];
        if (match) dismissMatch(state, match);
      },
      onApplyReplacement: (match, replacement) => {
        applyMatch(state, match, replacement);
      },
      onDismissMatch: (match) => {
        dismissMatch(state, match);
      },
      onAddToDictionary: (match) => addMatchToDictionary(state, match),
      onTransform: (tool) => transformField(state, tool),
      onApplyTransform: (text, sourceText) =>
        applyTransform(state, text, sourceText),
    };
  }

  async function transformField(state, tool) {
    if (!state.visible || !fieldIsAttached(state.field)) {
      return { ok: false, error: "The field is no longer visible." };
    }
    const current = editable.extractEditableText(state.field);
    if (current.text !== state.text) {
      refreshStateText(state);
      onFieldInput(state);
      return { ok: false, error: "The field changed. Try again." };
    }
    if (!state.text.trim()) {
      return { ok: false, error: "The field is empty." };
    }
    const response = await browser.runtime.sendMessage({
      type: "lexicon:transform-text",
      tool,
      text: state.text,
    });
    if (!response?.ok) {
      return {
        ok: false,
        error: response?.error || "AI tool failed.",
      };
    }
    return {
      ok: true,
      text: response.text,
      sourceText: state.text,
    };
  }

  function applyTransform(state, text, sourceText) {
    if (!state.visible || !fieldIsAttached(state.field)) {
      return { ok: false, error: "The field is no longer visible." };
    }
    const current = editable.extractEditableText(state.field);
    if (current.text !== sourceText) {
      return { ok: false, error: "The field changed. Try again." };
    }
    const expected = editable.normalizeText(text);
    invalidateCheck(state);
    beginProgrammaticChange(state);
    let replaced = false;
    try {
      replaced =
        editable.replaceEditableText(state.field, state.kind, expected) &&
        editable.extractEditableText(state.field).text === expected;
      refreshStateText(state);
    } finally {
      endProgrammaticChange(state);
    }
    if (!replaced) {
      return { ok: false, error: "The field rejected the replacement." };
    }
    state.matches = null;
    state.checkedText = null;
    state.offline = false;
    state.dismissedKeys.clear();
    if (state.text.trim()) scheduleFieldCheck(state);
    else hideStateVisuals(state);
    return { ok: true };
  }

  function squiggleHandlers(state) {
    return {
      onActivate: (index, rect, meta) => {
        const match = state.matches && state.matches[index];
        if (!match) return;
        suggestions.showFieldMatchTooltip(state.field, match, rect, {
          pinned: Boolean(meta && meta.pinned),
          onApply: (replacement) => applyMatch(state, match, replacement),
          onDismiss: () => dismissMatch(state, match),
          onAddToDictionary: () => addMatchToDictionary(state, match),
        });
      },
      onDeactivate: () => {
        suggestions.scheduleHideFieldMatchTooltip(state.field);
      },
    };
  }

  function dismissMatch(state, match) {
    if (!state.matches || !match) return;
    suggestions.hideFieldMatchTooltip();
    state.dismissedKeys.add(matchKey(match, state.text));
    const remaining = state.matches.filter((item) => item !== match);
    redrawMatches(state, remaining);
  }

  async function addMatchToDictionary(state, match) {
    if (
      !state.visible ||
      !state.matches ||
      !match ||
      !fieldIsAttached(state.field)
    ) {
      return false;
    }
    const current = editable.extractEditableText(state.field);
    if (current.text !== state.text) {
      refreshStateText(state);
      onFieldInput(state);
      return false;
    }
    const word = state.text
      .slice(match.offset, match.offset + match.length)
      .trim();
    if (!word) return false;

    let response;
    try {
      response = await browser.runtime.sendMessage({
        type: "lexicon:add-to-dictionary",
        word,
      });
    } catch {
      return false;
    }
    if (!response?.ok) return false;
    if (
      !state.visible ||
      fieldStates.get(state.field) !== state ||
      !fieldIsAttached(state.field)
    ) {
      return false;
    }
    const after = editable.extractEditableText(state.field);
    if (after.text !== state.text) {
      refreshStateText(state);
      onFieldInput(state);
      return false;
    }

    const dictionaryWord = String(response.word || word).trim().toLowerCase();
    if (!dictionaryWord) return false;
    userDictionary.add(dictionaryWord);
    suggestions.hideFieldMatchTooltip();

    const remaining = [];
    for (const item of state.matches) {
      const itemWord = state.text
        .slice(item.offset, item.offset + item.length)
        .trim()
        .toLowerCase();
      if (itemWord === dictionaryWord) {
        state.dismissedKeys.add(matchKey(item, state.text));
      } else {
        remaining.push(item);
      }
    }
    redrawMatches(state, remaining);
    return true;
  }

  function applyMatch(state, match, chosenReplacement) {
    if (
      !state.visible ||
      !state.matches ||
      !match ||
      fieldStates.get(state.field) !== state
    ) {
      return;
    }
    const replacement =
      chosenReplacement != null
        ? chosenReplacement
        : match.replacements && match.replacements[0];
    if (!replacement) return;

    const current = editable.extractEditableText(state.field);
    if (current.text !== state.text) {
      onFieldInput(state);
      return;
    }
    const expected =
      state.text.slice(0, match.offset) +
      replacement +
      state.text.slice(match.offset + match.length);
    let applied = false;
    invalidateCheck(state);
    suggestions.hideFieldMatchTooltip();
    beginProgrammaticChange(state);
    try {
      const wholeBlockEditor =
        editable.isNotionEditor(state.field) ||
        editable.isYoutubeEditor(state.field);
      if (state.kind === "textarea" || wholeBlockEditor) {
        applied =
          editable.replaceEditableText(state.field, state.kind, expected) &&
          editable.extractEditableText(state.field).text === expected;
      } else if (state.segments) {
        const mapped = editable.matchRanges([match], state.segments);
        if (mapped.length > 0) {
          const replaced = editable.replaceRangeViaInsertText(
            state.field,
            mapped[0],
            replacement,
          );
          if (replaced) {
            applied =
              editable.extractEditableText(state.field).text === expected;
          }
          if (!applied && !editable.isFrameworkEditor(state.field)) {
            if (
              editable.replaceRangeDirect(
                state.field,
                mapped[0],
                replacement,
              ) &&
              editable.replaceContentDirect(state.field, state.kind, expected)
            ) {
              applied =
                editable.extractEditableText(state.field).text === expected;
            }
          }
        }
        if (!applied && !editable.isFrameworkEditor(state.field)) {
          if (editable.replaceEditableText(state.field, state.kind, expected)) {
            applied =
              editable.extractEditableText(state.field).text === expected;
          }
        }
      }
    } finally {
      endProgrammaticChange(state, 150);
    }

    const delta = applied ? replacement.length - match.length : 0;
    const remaining = applied
      ? shiftRemaining(state.matches, match, delta)
      : state.matches.slice();
    setTimeout(() => {
      if (!fieldIsAttached(state.field)) {
        removeState(state);
        return;
      }
      refreshStateText(state);
      if (applied && remaining.length > 0) {
        redrawMatches(state, remaining);
      } else if (applied) {
        applyHighlight(state, []);
      }
      if (state.text.trim()) {
        scheduleFieldCheck(state, false);
      } else {
        state.matches = null;
        hideStateVisuals(state);
      }
    }, 0);
  }

  async function runFieldCheck(state, token, text, requestToken) {
    if (
      token !== state.checkToken ||
      requestToken !== state.requestToken ||
      !isProofreadingEnabled() ||
      !state.visible ||
      !fieldIsAttached(state.field)
    ) {
      return;
    }
    const current = editable.extractEditableText(state.field);
    if (current.text !== text) {
      refreshStateText(state);
      scheduleFieldCheck(state);
      return;
    }
    if (!text.trim()) {
      state.matches = null;
      state.checkedText = text;
      state.checking = false;
      hideStateVisuals(state);
      return;
    }

    let response;
    try {
      response = await browser.runtime.sendMessage({
        type: "lexicon:check-text",
        text,
      });
    } catch {
      if (requestToken === state.requestToken) showOffline(state);
      return;
    }
    if (
      requestToken !== state.requestToken ||
      !isProofreadingEnabled() ||
      !state.visible ||
      !fieldIsAttached(state.field)
    ) {
      return;
    }
    const after = editable.extractEditableText(state.field);
    if (after.text !== text) {
      refreshStateText(state);
      scheduleFieldCheck(state);
      return;
    }
    if (response && response.ok === false) {
      if (
        response.error === "proofreading-paused" ||
        response.error === "site-disabled"
      ) {
        return;
      }
      showOffline(state);
      return;
    }
    if (response && response.ok === true && Array.isArray(response.matches)) {
      applyHighlight(state, response.matches);
      return;
    }
    if (Array.isArray(response)) {
      applyHighlight(state, response);
      return;
    }
    showOffline(state);
  }

  function enqueueFieldCheck(state, token, text, requestToken) {
    if (
      token !== state.checkToken ||
      requestToken !== state.requestToken ||
      !state.visible
    ) {
      return;
    }
    const job = { state, token, text, requestToken };
    state.queuedCheck = job;
    if (state.field === activeField) checkQueue.unshift(job);
    else checkQueue.push(job);
    pumpCheckQueue();
  }

  function pumpCheckQueue() {
    while (activeChecks < MAX_CONCURRENT_CHECKS && checkQueue.length > 0) {
      const job = checkQueue.shift();
      const { state } = job;
      if (
        state.queuedCheck !== job ||
        job.token !== state.checkToken ||
        job.requestToken !== state.requestToken ||
        !state.visible
      ) {
        continue;
      }
      state.queuedCheck = null;
      activeChecks += 1;
      runFieldCheck(state, job.token, job.text, job.requestToken)
        .catch(() => {})
        .finally(() => {
          activeChecks -= 1;
          pumpCheckQueue();
        });
    }
  }

  function scheduleFieldCheck(state, showIndicator = true) {
    if (
      !isProofreadingEnabled() ||
      !state.visible ||
      !state.text ||
      !state.text.trim()
    ) {
      return;
    }
    invalidateCheck(state);
    const token = state.checkToken;
    const requestToken = state.requestToken;
    const text = state.text;
    if (showIndicator) showChecking(state);
    state.checkTimer = setTimeout(() => {
      state.checkTimer = null;
      enqueueFieldCheck(state, token, text, requestToken);
    }, REPROOFREAD_MS);
  }

  function onFieldInput(state) {
    if (
      state.programmaticChange ||
      !isProofreadingEnabled() ||
      !state.visible
    ) {
      return;
    }
    refreshStateText(state);
    if (!state.text.trim()) {
      invalidateCheck(state);
      state.matches = null;
      state.checkedText = state.text;
      state.checking = false;
      state.offline = false;
      hideStateVisuals(state);
      return;
    }
    scheduleFieldCheck(state);
  }

  function onFieldBeforeInput(state, event) {
    const type = event && event.inputType;
    if (type !== "historyUndo" && type !== "historyRedo") return;
    setTimeout(() => onFieldInput(state), 0);
  }

  function onFieldKeydown(state, event) {
    const key = String(event.key || "").toLowerCase();
    const history =
      (event.ctrlKey || event.metaKey) && (key === "z" || key === "y");
    const deletion = key === "backspace" || key === "delete";
    if (!history && !deletion) return;
    setTimeout(() => onFieldInput(state), 0);
  }

  function onFieldMutation(state) {
    if (state.programmaticChange || !state.visible) return;
    const { text } = editable.extractEditableText(state.field);
    if (text !== state.text) onFieldInput(state);
  }

  function registerVisibleField(field) {
    if (!isProofreadingEnabled() || !fieldIsInViewport(field)) return null;
    const state = getOrCreateState(field);
    state.visible = true;
    attachInputWatch(state);
    const changed = refreshStateText(state);
    if (!state.text.trim()) {
      state.matches = null;
      state.checking = false;
      state.offline = false;
      hideStateVisuals(state);
      return state;
    }
    const needsCheck =
      changed ||
      state.matches === null ||
      state.checkedText !== state.text ||
      state.offline;
    if (needsCheck) {
      if (!state.checking) scheduleFieldCheck(state);
    } else if (state.matches) {
      applyHighlight(state, state.matches);
    }
    return state;
  }

  function observeCandidate(field) {
    if (observedFields.has(field)) return;
    observedFields.add(field);
    if (intersectionObserver) {
      intersectionObserver.observe(field);
    } else if (fieldIsInViewport(field)) {
      registerVisibleField(field);
    }
  }

  function unobserveCandidate(field) {
    if (!observedFields.has(field)) return;
    if (intersectionObserver) intersectionObserver.unobserve(field);
    observedFields.delete(field);
    const state = fieldStates.get(field);
    if (state) removeState(state);
  }

  function onFieldIntersection(entries) {
    for (const entry of entries) {
      const field = entry.target;
      if (!observedFields.has(field)) continue;
      if (
        isProofreadingEnabled() &&
        entry.isIntersecting &&
        fieldIsInViewport(field)
      ) {
        registerVisibleField(field);
      } else {
        const state = fieldStates.get(field);
        if (state) suspendState(state);
      }
    }
  }

  function scanEditableFields(forceVisible = false) {
    fieldScanTimer = null;
    if (!settingsReady || !isProofreadingEnabled()) {
      for (const state of fieldStates.values()) suspendState(state);
      return;
    }
    const detected = editable.detectEditableFields
      ? editable.detectEditableFields(document, { visibleOnly: false })
      : [editable.detectEditableField(document)].filter(Boolean);
    const candidates = new Set(detected.filter(fieldIsAttached));
    notifyFrameFields(candidates.size > 0);
    for (const field of candidates) observeCandidate(field);
    for (const field of [...observedFields]) {
      if (!candidates.has(field)) unobserveCandidate(field);
    }
    if (forceVisible) {
      for (const field of candidates) {
        if (fieldIsInViewport(field)) registerVisibleField(field);
      }
    }
    if (!intersectionObserver) {
      for (const field of candidates) {
        if (fieldIsInViewport(field)) registerVisibleField(field);
        else {
          const state = fieldStates.get(field);
          if (state) suspendState(state);
        }
      }
    }
  }

  function queueFieldScan() {
    if (fieldScanTimer) return;
    fieldScanTimer = setTimeout(scanEditableFields, FIELD_SCAN_MS);
  }

  function setActiveField(field, notify = true) {
    if (!field || !fieldIsAttached(field)) return null;
    observeCandidate(field);
    const state =
      (fieldIsInViewport(field) && registerVisibleField(field)) ||
      getOrCreateState(field);
    activeField = field;
    if (notify) notifyActiveField();
    return state;
  }

  function stateForFieldId(fieldId) {
    const id = String(fieldId || "");
    if (!id) return null;
    for (const state of fieldStates.values()) {
      if (state.fieldId === id && fieldIsAttached(state.field)) return state;
    }
    return null;
  }

  function resolveActiveField(fieldId) {
    if (fieldId != null && String(fieldId)) {
      const requested = stateForFieldId(fieldId);
      return requested ? setActiveField(requested.field, false) : null;
    }
    if (fieldIsAttached(activeField)) {
      return setActiveField(activeField, false);
    }
    const detected = editable.detectEditableField(document);
    if (!detected) return null;
    return setActiveField(detected, false);
  }

  function rememberField(field, kind, text, segments) {
    const state = setActiveField(field);
    if (!state) return null;
    const changed = state.text !== text;
    state.kind = kind;
    state.text = text;
    state.segments = segments;
    if (changed) {
      invalidateCheck(state);
      state.matches = null;
      state.checkedText = null;
      state.offline = false;
      hideStateVisuals(state);
    }
    return state;
  }

  function onFocusIn(event) {
    if (suggestions.isSuggestionUiFocus(event)) return;
    const target = editable.editableFromNode(event.target);
    if (!target) return;
    const state = setActiveField(target);
    if (!state || !state.text || !state.text.trim()) return;
    if (
      state.matches === null ||
      state.checkedText !== state.text ||
      state.offline
    ) {
      scheduleFieldCheck(state);
    }
  }

  function onMessage(msg) {
    try {
      switch (msg?.type) {
        case "lexicon:settings-changed": {
          applySettings(msg.settings || {});
          return { ok: true };
        }
        case "lexicon:list-fields": {
          if (siteDisabled) {
            return { ok: false, error: "site-disabled", fields: [] };
          }
          const fields = visibleFieldDetails();
          const active = fields.find((field) => field.active);
          return {
            ok: true,
            fields,
            activeId: active?.id || null,
          };
        }
        case "lexicon:select-field": {
          if (siteDisabled) {
            return { ok: false, error: "site-disabled" };
          }
          const state = stateForFieldId(msg.fieldId);
          if (!state || !fieldIsInViewport(state.field)) {
            return { ok: false, error: "field-not-visible" };
          }
          const selected = setActiveField(state.field);
          if (!selected) return { ok: false, error: "field-not-available" };
          refreshStateText(selected);
          return {
            ok: true,
            fieldId: selected.fieldId,
            text: selected.text,
            kind: selected.kind,
          };
        }
        case "lexicon:get-text": {
          if (siteDisabled) return { ok: false, error: "site-disabled" };
          const state = resolveActiveField(msg.fieldId);
          if (!state) return { ok: false, error: "no-editable-field" };
          refreshStateText(state);
          rememberField(state.field, state.kind, state.text, state.segments);
          return { ok: true, text: state.text, kind: state.kind };
        }
        case "lexicon:highlight": {
          if (siteDisabled) {
            return { ok: false, error: "site-disabled" };
          }
          if (proofreadingPaused) {
            return { ok: false, error: "proofreading-paused" };
          }
          const state = resolveActiveField(msg.fieldId);
          if (!state) return { ok: false, error: "no-editable-field" };
          refreshStateText(state);
          invalidateCheck(state);
          if (!state.text.trim()) {
            hideStateVisuals(state);
            return { ok: true, count: 0 };
          }
          return { ok: true, count: applyHighlight(state, msg.matches) };
        }
        case "lexicon:clear-highlights": {
          const state = resolveActiveField(msg.fieldId);
          if (!state) return { ok: true };
          invalidateCheck(state);
          state.matches = null;
          state.checkedText = null;
          hideStateVisuals(state);
          return { ok: true };
        }
        case "lexicon:replace-text": {
          if (siteDisabled) return { ok: false, error: "site-disabled" };
          const state = resolveActiveField(msg.fieldId);
          if (!state || typeof msg.text !== "string") {
            return { ok: false, error: "no-field" };
          }
          const expected = editable.normalizeText(msg.text);
          invalidateCheck(state);
          beginProgrammaticChange(state);
          let replaced = false;
          try {
            replaced =
              editable.replaceEditableText(state.field, state.kind, expected) &&
              editable.extractEditableText(state.field).text === expected;
            refreshStateText(state);
          } finally {
            endProgrammaticChange(state);
          }
          if (!replaced) {
            return { ok: false, error: "editor-rejected-replacement" };
          }
          if (state.text.trim()) scheduleFieldCheck(state);
          else hideStateVisuals(state);
          return { ok: true };
        }
        default:
          return { ok: false, error: "unknown-message" };
      }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
  }

  globalThis.__lexiconMultiContentLoaded = true;
  document.addEventListener("focusin", onFocusIn, true);
  if (typeof IntersectionObserver === "function") {
    intersectionObserver = new IntersectionObserver(onFieldIntersection, {
      root: null,
      threshold: 0,
    });
  } else {
    window.addEventListener("scroll", queueFieldScan, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", queueFieldScan);
  }
  if (typeof MutationObserver === "function") {
    const observer = new MutationObserver(queueFieldScan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
  }
  browser.runtime.onMessage.addListener(onMessage);
  async function loadSettings() {
    try {
      const response = await browser.runtime.sendMessage({
        type: "lexicon:get-settings",
      });
      applySettings(response || {});
    } catch {
      applySettings({ paused: false, disabledSites: [] });
    }
  }
  browser.runtime
    .sendMessage({ type: "lexicon:frame-ready" })
    .catch(() => {});
  loadSettings();
})();

(function () {
  "use strict";

  if (globalThis.__lexiconMultiContentLoaded) return;

  const editable = globalThis.__lexiconEditable;
  const squiggle = globalThis.__lexiconSquiggle;
  const suggestions = globalThis.__lexiconSuggestions;

  const REPROOFREAD_MS = 700;

  let lastField = null;
  let lastText = null;
  let lastSegments = null;
  let lastKind = null;
  let lastMatches = null;
  let programmaticChange = false;
  let reproofreadTimer = null;
  let reproofreadToken = 0;
  let inputWatchField = null;
  let mutationObserver = null;
  let programmaticClearTimer = null;
  let scheduledForText = null;
  // Dismissed issues stay dismissed across idle re-checks.
  const dismissedKeys = new Set();

  function fieldIsAttached(field) {
    return Boolean(
      field &&
        (field.isConnected === true ||
          (document.contains && document.contains(field))),
    );
  }

  function notifyActiveField() {
    browser.runtime
      .sendMessage({ type: "lexicon:active-field" })
      .catch(() => {});
  }

  function fieldOwnsFocus(field) {
    if (!field) return false;
    if (typeof document.hasFocus === "function" && !document.hasFocus()) {
      return false;
    }
    const active = editable.deepActiveElement(document);
    if (!active) return false;
    return (
      active === field ||
      Boolean(field.contains && field.contains(active)) ||
      editable.editableFromNode(active) === field
    );
  }

  function matchKey(match, text) {
    const original =
      (text &&
      Number.isInteger(match.offset) &&
      Number.isInteger(match.length)
        ? text.slice(match.offset, match.offset + match.length)
        : match.original) || "";
    const offset = Number.isInteger(match.offset) ? match.offset : "";
    return `${match.message || ""}::${original}::${offset}`;
  }

  function filterDismissed(matches, text) {
    return (matches || []).filter(
      (m) => !dismissedKeys.has(matchKey(m, text)),
    );
  }

  function cancelReproofread() {
    if (reproofreadTimer) {
      clearTimeout(reproofreadTimer);
      reproofreadTimer = null;
    }
  }

  // Ignore site input events for a short time after we edit the field.
  function beginProgrammaticChange() {
    programmaticChange = true;
    if (programmaticClearTimer) {
      clearTimeout(programmaticClearTimer);
      programmaticClearTimer = null;
    }
  }

  function endProgrammaticChange(holdMs) {
    if (programmaticClearTimer) clearTimeout(programmaticClearTimer);
    const ms = Number.isFinite(holdMs) ? holdMs : 50;
    programmaticClearTimer = setTimeout(() => {
      programmaticClearTimer = null;
      programmaticChange = false;
    }, ms);
  }

  function detachInputWatch() {
    if (inputWatchField) {
      inputWatchField.removeEventListener("input", onFieldInput);
      inputWatchField.removeEventListener("beforeinput", onFieldBeforeInput);
      inputWatchField.removeEventListener("keydown", onFieldKeydown);
      inputWatchField = null;
    }
    if (mutationObserver) {
      mutationObserver.disconnect();
      mutationObserver = null;
    }
  }

  function attachInputWatch(field) {
    if (inputWatchField === field) return;
    detachInputWatch();
    inputWatchField = field;
    field.addEventListener("input", onFieldInput);
    field.addEventListener("beforeinput", onFieldBeforeInput);
    field.addEventListener("keydown", onFieldKeydown);
    // Watch DOM mutations only on Gmail.
    const host = String(location.hostname || "");
    const watchMutations =
      field.isContentEditable && host === "mail.google.com";
    if (watchMutations) {
      mutationObserver = new MutationObserver(onFieldMutation);
      mutationObserver.observe(field, {
        characterData: true,
        childList: true,
        subtree: true,
      });
    }
  }

  function forgetField() {
    cancelReproofread();
    detachInputWatch();
    lastField = null;
    lastText = null;
    lastSegments = null;
    lastKind = null;
    lastMatches = null;
    squiggle.clearSquiggles();
    suggestions.hide();
  }

  function clearIssueVisuals() {
    lastMatches = null;
    squiggle.clearSquiggles();
  }

  function showOffline(field) {
    if (!field || !fieldIsAttached(field)) return;
    clearIssueVisuals();
    suggestions.show(field, [], {
      ...suggestionHandlers(),
      offline: true,
    });
  }

  function onFieldInput() {
    if (programmaticChange) return;
    const field = lastField;
    if (!field) return;
    const { text } = editable.extractEditableText(field);
    if (text === scheduledForText && reproofreadTimer) return;
    scheduledForText = text;
    clearIssueVisuals();
    suggestions.show(field, [], {
      ...suggestionHandlers(),
      checking: true,
    });
    scheduleReproofread(field);
  }

  function onFieldBeforeInput(event) {
    const type = event && event.inputType;
    if (type !== "historyUndo" && type !== "historyRedo") return;
    setTimeout(onFieldInput, 0);
  }

  function onFieldKeydown(event) {
    const key = String(event.key || "").toLowerCase();
    const history =
      (event.ctrlKey || event.metaKey) && (key === "z" || key === "y");
    const deletion = key === "backspace" || key === "delete";
    if (!history && !deletion) return;
    setTimeout(onFieldInput, 0);
  }

  function onFieldMutation() {
    if (programmaticChange || !lastField) return;
    const { text } = editable.extractEditableText(lastField);
    if (text === lastText) return;
    onFieldInput();
  }

  function adoptField(field, notify = true) {
    const { kind, text, segments } = editable.extractEditableText(field);
    lastField = field;
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    attachInputWatch(field);
    if (notify) notifyActiveField();
  }

  function rememberField(field, kind, text, segments) {
    cancelReproofread();
    lastField = field;
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    attachInputWatch(field);
    notifyActiveField();
  }

  function validMatches(matches) {
    return (matches ?? []).filter(
      (m) =>
        m &&
        Number.isInteger(m.offset) &&
        Number.isInteger(m.length) &&
        m.length > 0,
    );
  }

  function shiftRemaining(matches, applied, delta) {
    const next = [];
    for (const match of matches) {
      if (match === applied) continue;
      if (match.offset + match.length <= applied.offset) {
        next.push(match);
      } else if (match.offset >= applied.offset + applied.length) {
        next.push({ ...match, offset: match.offset + delta });
      }
    }
    return next;
  }

  function rangesForMatches(matches, kind, segments) {
    if (kind === "textarea") {
      return matches.map((m) => ({
        start: m.offset,
        end: m.offset + m.length,
      }));
    }
    return editable.matchRanges(matches, segments);
  }

  function suggestionHandlers() {
    return {
      onApply: (index) => {
        if (!lastMatches) return;
        applyMatch(lastMatches[index]);
      },
      onDismiss: (index) => {
        if (!lastMatches) return;
        dismissMatch(lastMatches[index]);
      },
      onApplyReplacement: (match, replacement) => {
        applyMatch(match, replacement);
      },
      onDismissMatch: (match) => {
        dismissMatch(match);
      },
      onAddToDictionary: (match) => addMatchToDictionary(match),
    };
  }

  function squiggleHandlers() {
    return {
      onActivate: (index, rect, meta) => {
        if (!lastMatches || !lastMatches[index]) return;
        const match = lastMatches[index];
        suggestions.showMatchTooltip(match, rect, {
          pinned: Boolean(meta && meta.pinned),
          onApply: (replacement) => applyMatch(match, replacement),
          onDismiss: () => dismissMatch(match),
          onAddToDictionary: () => addMatchToDictionary(match),
        });
      },
      onDeactivate: () => {
        suggestions.scheduleHideMatchTooltip();
      },
    };
  }

  function applyHighlight(matches) {
    if (!lastField) return 0;
    const cleaned = filterDismissed(validMatches(matches), lastText);
    lastMatches = cleaned;
    scheduledForText = lastText;
    if (cleaned.length === 0) {
      squiggle.clearSquiggles();
      suggestions.show(lastField, [], suggestionHandlers());
      return 0;
    }
    const ranges = rangesForMatches(cleaned, lastKind, lastSegments);
    squiggle.applySquiggles(lastField, ranges, lastText, squiggleHandlers());
    suggestions.show(lastField, cleaned, suggestionHandlers());
    return ranges.length;
  }

  function redrawMatches(matches) {
    if (!lastField) return;
    const { kind, text, segments } = editable.extractEditableText(lastField);
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    const remaining = filterDismissed(matches, text);
    lastMatches = remaining;
    scheduledForText = text;
    if (remaining.length === 0) {
      squiggle.clearSquiggles();
      suggestions.show(lastField, [], suggestionHandlers());
      return;
    }
    const ranges = rangesForMatches(remaining, kind, segments);
    squiggle.applySquiggles(lastField, ranges, lastText, squiggleHandlers());
    suggestions.show(lastField, remaining, suggestionHandlers());
  }

  function scheduleReproofread(field) {
    cancelReproofread();
    const token = ++reproofreadToken;
    reproofreadTimer = setTimeout(() => {
      reproofreadTimer = null;
      reproofreadField(field, token);
    }, REPROOFREAD_MS);
  }

  async function reproofreadField(field, token) {
    if (token !== reproofreadToken) return;
    const active =
      (fieldIsAttached(field) && field) ||
      editable.detectEditableField(document);
    if (!active || !fieldIsAttached(active)) {
      forgetField();
      return;
    }
    const { kind, text, segments } = editable.extractEditableText(active);
    lastField = active;
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    attachInputWatch(active);

    if (!text.trim()) {
      squiggle.clearSquiggles();
      suggestions.hide();
      lastMatches = null;
      return;
    }

    let res;
    try {
      res = await browser.runtime.sendMessage({
        type: "lexicon:check-text",
        text,
      });
    } catch {
      if (token === reproofreadToken && lastField === active) {
        showOffline(active);
      }
      return;
    }
    if (token !== reproofreadToken || lastField !== active) return;
    if (res && res.ok === false) {
      showOffline(active);
      return;
    }
    if (res && res.ok === true && Array.isArray(res.matches)) {
      applyHighlight(res.matches);
      return;
    }
    // Accept an array from an older extension build. Treat a missing or
    // invalid response as an offline state.
    if (Array.isArray(res)) {
      applyHighlight(res);
      return;
    }
    showOffline(active);
  }

  function dismissMatch(match) {
    if (!lastField || !lastMatches || !match) return;
    suggestions.hideMatchTooltip();
    dismissedKeys.add(matchKey(match, lastText));
    const remaining = lastMatches.filter((m) => m !== match);
    redrawMatches(remaining);
  }

  async function addMatchToDictionary(match) {
    if (!lastField || !lastMatches || !match) return false;
    const field = lastField;
    const text = lastText;
    const matches = lastMatches;
    const current = editable.extractEditableText(field);
    if (current.text !== text) {
      adoptField(field);
      onFieldInput();
      return false;
    }
    const word = text
      .slice(match.offset, match.offset + match.length)
      .trim();
    if (!word) return false;

    let response;
    try {
      response = await browser.runtime.sendMessage({
        type: "lexicon:add-to-dictionary",
        word,
      });
    } catch {
      return false;
    }
    if (!response?.ok) return false;
    if (
      lastField !== field ||
      lastText !== text ||
      lastMatches !== matches ||
      !fieldIsAttached(field)
    ) {
      return false;
    }
    const after = editable.extractEditableText(field);
    if (after.text !== text) {
      adoptField(field);
      onFieldInput();
      return false;
    }

    const dictionaryWord = String(response.word || word).trim().toLowerCase();
    if (!dictionaryWord) return false;
    suggestions.hideMatchTooltip();
    const remaining = [];
    for (const item of matches) {
      const itemWord = text
        .slice(item.offset, item.offset + item.length)
        .trim()
        .toLowerCase();
      if (itemWord === dictionaryWord) {
        dismissedKeys.add(matchKey(item, text));
      } else {
        remaining.push(item);
      }
    }
    redrawMatches(remaining);
    return true;
  }

  function applyMatch(match, chosenReplacement) {
    if (!lastField || !lastMatches || !match) return;
    const replacement =
      chosenReplacement != null
        ? chosenReplacement
        : match.replacements && match.replacements[0];
    if (!replacement) return;

    const expected =
      lastText.slice(0, match.offset) +
      replacement +
      lastText.slice(match.offset + match.length);
    let applied = false;
    cancelReproofread();
    suggestions.hideMatchTooltip();
    beginProgrammaticChange();
    try {
      const wholeBlockEditor =
        editable.isNotionEditor(lastField) ||
        editable.isYoutubeEditor(lastField);
      if (lastKind === "textarea" || wholeBlockEditor) {
        applied =
          editable.replaceEditableText(lastField, lastKind, expected) &&
          editable.extractEditableText(lastField).text === expected;
      } else if (lastSegments) {
        const mapped = editable.matchRanges([match], lastSegments);
        if (mapped.length > 0) {
          const replaced = editable.replaceRangeViaInsertText(
            lastField,
            mapped[0],
            replacement,
          );
          if (replaced) {
            const { text: afterText } = editable.extractEditableText(lastField);
            applied = afterText === expected;
          }
          // Direct DOM rewrite is safe only for plain contenteditables.
          if (!applied && !editable.isFrameworkEditor(lastField)) {
            if (
              editable.replaceRangeDirect(lastField, mapped[0], replacement) &&
              editable.replaceContentDirect(lastField, lastKind, expected)
            ) {
              const { text: afterText } = editable.extractEditableText(
                lastField,
              );
              applied = afterText === expected;
            }
          }
        }
        if (!applied && !editable.isFrameworkEditor(lastField)) {
          if (editable.replaceEditableText(lastField, lastKind, expected)) {
            const { text: afterText } = editable.extractEditableText(lastField);
            applied = afterText === expected;
          }
        }
      }
    } finally {
      endProgrammaticChange(150);
    }

    const delta = applied ? replacement.length - match.length : 0;
    const remaining = applied
      ? shiftRemaining(lastMatches, match, delta)
      : lastMatches.slice();

    setTimeout(() => {
      const active =
        (fieldIsAttached(lastField) && lastField) ||
        editable.detectEditableField(document);
      if (!active || !fieldIsAttached(active)) return;
      if (active !== lastField) adoptField(active);
      const extracted = editable.extractEditableText(active);
      lastField = active;
      lastKind = extracted.kind;
      lastText = extracted.text;
      lastSegments = extracted.segments;
      attachInputWatch(active);
      if (applied && remaining.length > 0 && extracted.text === expected) {
        redrawMatches(remaining);
      }
      scheduleReproofread(active);
    }, 0);
  }

  function isWatchedEditable(el) {
    return editable.isEditableElement(el);
  }

  function isSuggestionUiFocus(event) {
    const current = suggestions.state && suggestions.state();
    const host = current && current.host;
    if (!host) return false;
    if (event && event.target === host) return true;
    const path =
      event && typeof event.composedPath === "function"
        ? event.composedPath()
        : [];
    return path.includes(host);
  }

  function onFocusIn(event) {
    if (isSuggestionUiFocus(event)) return;
    const target =
      editable.editableFromNode(event.target) ||
      editable.detectEditableField(document);
    if (!target) return;
    if (lastField === target) {
      notifyActiveField();
      scheduleReproofread(target);
      return;
    }
    adoptField(target);
    scheduleReproofread(target);
  }

  document.addEventListener("focusin", onFocusIn, true);

  const initial = editable.detectEditableField(document);
  if (initial) {
    adoptField(initial, fieldOwnsFocus(initial));
    scheduleReproofread(initial);
  }

  browser.runtime.onMessage.addListener(async (msg) => {
    try {
      switch (msg?.type) {
        case "lexicon:get-text": {
          // Prefer the last focused field; the popup can steal focus.
          const field =
            (fieldIsAttached(lastField) && lastField) ||
            editable.detectEditableField(document);
          if (!field) return { ok: false, error: "no-editable-field" };
          const { kind, text, segments } = editable.extractEditableText(field);
          rememberField(field, kind, text, segments);
          return { ok: true, text, kind };
        }

        case "lexicon:highlight": {
          if (!fieldIsAttached(lastField)) {
            const field = editable.detectEditableField(document);
            if (!field) return { ok: false, error: "no-editable-field" };
            adoptField(field);
          }
          return { ok: true, count: applyHighlight(msg.matches) };
        }

        case "lexicon:clear-highlights": {
          forgetField();
          return { ok: true };
        }

        case "lexicon:replace-text": {
          if (!lastField || typeof msg.text !== "string") {
            return { ok: false, error: "no-field" };
          }
          const expected = editable.normalizeText(msg.text);
          cancelReproofread();
          beginProgrammaticChange();
          let replaced = false;
          try {
            replaced =
              editable.replaceEditableText(lastField, lastKind, expected) &&
              editable.extractEditableText(lastField).text === expected;
            adoptField(lastField);
          } finally {
            endProgrammaticChange();
          }
          if (!replaced) {
            return { ok: false, error: "editor-rejected-replacement" };
          }
          scheduleReproofread(lastField);
          return { ok: true };
        }
      }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
    return { ok: false, error: "unknown-message" };
  });
})();
