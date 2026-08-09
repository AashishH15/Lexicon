// Content script.
// It detects editable fields, extracts text, draws squiggles, and runs the
// suggestion UI (count badge + panel with apply buttons).
// The background and the popup use these messages:
//   lexicon:get-text          -> { ok, text, kind }
//   lexicon:highlight         -> { ok, count }
//   lexicon:clear-highlights  -> { ok }
//   lexicon:replace-text      -> { ok }
// On focus, and after the user stops typing, it asks the background to
// proofread. A green badge means no issues; a black badge shows the count.
// This file runs as a classic script.

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
  // Same idea as the desktop app: advisory issues with no fix are dismissed
  // by signature so they stay gone across idle re-checks.
  const dismissedKeys = new Set();

  function matchKey(match, text) {
    const original =
      (text &&
      Number.isInteger(match.offset) &&
      Number.isInteger(match.length)
        ? text.slice(match.offset, match.offset + match.length)
        : match.original) || "";
    // Include offset so identical advisory issues can be dismissed one-by-one.
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

  // Gmail often applies DOM writes a tick after our replace; keep the
  // suppress window open briefly so those mutations do not re-proofread.
  function beginProgrammaticChange() {
    programmaticChange = true;
    if (programmaticClearTimer) {
      clearTimeout(programmaticClearTimer);
      programmaticClearTimer = null;
    }
  }

  function endProgrammaticChange() {
    if (programmaticClearTimer) clearTimeout(programmaticClearTimer);
    programmaticClearTimer = setTimeout(() => {
      programmaticClearTimer = null;
      programmaticChange = false;
    }, 50);
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
    // Gmail undo often skips `input`. Discord's Slate already fires `input`,
    // and a MutationObserver after our edits can fight its document model.
    const host = String(location.hostname || "");
    const watchMutations =
      field.isContentEditable && !host.endsWith("discord.com");
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

  // Keep the field session. Clear squiggles while a new check is pending.
  function clearIssueVisuals() {
    lastMatches = null;
    squiggle.clearSquiggles();
  }

  function onFieldInput() {
    if (programmaticChange) return;
    const field = lastField;
    if (!field) return;
    const { text } = editable.extractEditableText(field);
    // Gmail can emit many mutations for one undo; only reschedule when text changes.
    if (text === scheduledForText && reproofreadTimer) return;
    scheduledForText = text;
    clearIssueVisuals();
    // Drop stale green/black immediately so undo never leaves a lie on screen.
    suggestions.show(field, [], {
      ...suggestionHandlers(),
      checking: true,
    });
    scheduleReproofread(field);
  }

  function onFieldBeforeInput(event) {
    const type = event && event.inputType;
    if (type !== "historyUndo" && type !== "historyRedo") return;
    // DOM updates after beforeinput; re-check on the next task.
    setTimeout(onFieldInput, 0);
  }

  function onFieldKeydown(event) {
    if (!(event.ctrlKey || event.metaKey)) return;
    const key = String(event.key || "").toLowerCase();
    if (key !== "z" && key !== "y") return;
    setTimeout(onFieldInput, 0);
  }

  function onFieldMutation() {
    if (programmaticChange || !lastField) return;
    const { text } = editable.extractEditableText(lastField);
    if (text === lastText) return;
    onFieldInput();
  }

  function adoptField(field) {
    const { kind, text, segments } = editable.extractEditableText(field);
    lastField = field;
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    attachInputWatch(field);
  }

  function rememberField(field, kind, text, segments) {
    cancelReproofread();
    lastField = field;
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    attachInputWatch(field);
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

  // Always show the badge. Empty matches => green "clean" state.
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
      (field && document.contains(field) && field) ||
      editable.detectEditableField(document);
    if (!active || !document.contains(active)) {
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

    let matches;
    try {
      matches = await browser.runtime.sendMessage({
        type: "lexicon:check-text",
        text,
      });
    } catch {
      return;
    }
    if (token !== reproofreadToken || lastField !== active) return;
    applyHighlight(Array.isArray(matches) ? matches : []);
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
    let delta = 0;
    cancelReproofread();
    suggestions.hideMatchTooltip();
    beginProgrammaticChange();
    try {
      if (replacement) {
        let applied = false;
        if (lastKind !== "textarea" && lastSegments) {
          const mapped = editable.matchRanges([match], lastSegments);
          if (mapped.length > 0) {
            applied = editable.replaceRangeViaInsertText(
              lastField,
              mapped[0],
              replacement,
            );
          }
        }
        if (!applied) {
          const next =
            lastText.slice(0, match.offset) +
            replacement +
            lastText.slice(match.offset + match.length);
          editable.replaceEditableText(lastField, lastKind, next);
        }
        delta = replacement.length - match.length;
      }
    } finally {
      endProgrammaticChange();
    }
    const remaining = shiftRemaining(lastMatches, match, delta);
    // Let Slate finish reconciling before we re-read the DOM / redraw.
    setTimeout(() => {
      if (!lastField) return;
      const extracted = editable.extractEditableText(lastField);
      lastKind = extracted.kind;
      lastText = extracted.text;
      lastSegments = extracted.segments;
      attachInputWatch(lastField);
      redrawMatches(remaining);
    }, 0);
  }

  function isWatchedEditable(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "TEXTAREA") return true;
    if (el.isContentEditable) return true;
    return false;
  }

  // Auto-start a session when the user focuses an editable on this page.
  function onFocusIn(event) {
    const target = event.target;
    if (!isWatchedEditable(target)) return;
    if (lastField === target) return;
    adoptField(target);
    scheduleReproofread(target);
  }

  document.addEventListener("focusin", onFocusIn, true);

  // If a field is already focused when the script loads, start watching it.
  const initial = editable.detectEditableField(document);
  if (initial) {
    adoptField(initial);
    scheduleReproofread(initial);
  }

  browser.runtime.onMessage.addListener(async (msg) => {
    try {
      switch (msg?.type) {
        case "lexicon:get-text": {
          const field = editable.detectEditableField(document);
          if (!field) return { ok: false, error: "no-editable-field" };
          const { kind, text, segments } = editable.extractEditableText(field);
          rememberField(field, kind, text, segments);
          return { ok: true, text, kind };
        }

        case "lexicon:highlight": {
          if (!lastField) {
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
          cancelReproofread();
          beginProgrammaticChange();
          try {
            editable.replaceEditableText(lastField, lastKind, msg.text);
            adoptField(lastField);
          } finally {
            endProgrammaticChange();
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
