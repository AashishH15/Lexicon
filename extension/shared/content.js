// Content script: detect fields, draw squiggles, show suggestions.
// Messages: lexicon:get-text, lexicon:highlight, lexicon:clear-highlights,
// lexicon:replace-text.

(function () {
  "use strict";

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
        });
      },
      onDeactivate: () => {
        suggestions.hideMatchTooltip();
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
      return;
    }
    if (token !== reproofreadToken || lastField !== active) return;
    if (res && res.ok === false) {
      clearIssueVisuals();
      suggestions.show(active, [], {
        ...suggestionHandlers(),
        offline: true,
      });
      return;
    }
    const matches = Array.isArray(res?.matches)
      ? res.matches
      : Array.isArray(res)
        ? res
        : [];
    applyHighlight(matches);
  }

  function dismissMatch(match) {
    if (!lastField || !lastMatches || !match) return;
    suggestions.hideMatchTooltip();
    dismissedKeys.add(matchKey(match, lastText));
    const remaining = lastMatches.filter((m) => m !== match);
    redrawMatches(remaining);
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

  function onFocusIn(event) {
    const target =
      editable.editableFromNode(event.target) ||
      editable.detectEditableField(document);
    if (!target) return;
    if (lastField === target) {
      notifyActiveField();
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
