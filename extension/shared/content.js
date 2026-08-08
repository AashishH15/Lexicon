// Content script.
// It detects editable fields, extracts text, and draws squiggles.
// The background uses these messages:
//   lexicon:get-text          -> { ok, text, kind }
//   lexicon:highlight         -> { ok, count }
//   lexicon:clear-highlights  -> { ok }
// This file runs as a classic script.

(function () {
  "use strict";

  const editable = globalThis.__lexiconEditable;
  const squiggle = globalThis.__lexiconSquiggle;

  // The field and text the backend checked. Input invalidates them.
  let lastField = null;
  let lastText = null;
  let lastSegments = null;
  let lastKind = null;

  function forgetField() {
    lastField = null;
    lastText = null;
    lastSegments = null;
    lastKind = null;
    squiggle.clearSquiggles();
  }

  function rememberField(field, kind, text, segments) {
    forgetField();
    lastField = field;
    lastKind = kind;
    lastText = text;
    lastSegments = segments;
    field.addEventListener("input", forgetField, { once: true });
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
          const matches = validMatches(msg.matches);
          if (!lastField || matches.length === 0) {
            if (matches.length === 0 && lastField) forgetField();
            return { ok: true, count: 0 };
          }
          let ranges;
          if (lastKind === "textarea") {
            ranges = matches.map((m) => ({
              start: m.offset,
              end: m.offset + m.length,
            }));
          } else {
            ranges = editable.matchRanges(matches, lastSegments);
          }
          squiggle.applySquiggles(lastField, ranges, lastText);
          return { ok: true, count: ranges.length };
        }

        case "lexicon:clear-highlights": {
          forgetField();
          return { ok: true };
        }
      }
    } catch (error) {
      return { ok: false, error: String((error && error.message) || error) };
    }
    return { ok: false, error: "unknown-message" };
  });
})();
