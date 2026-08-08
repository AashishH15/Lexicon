// Editable-text detection and extraction (C48.4).
//
// Loaded as a CLASSIC script inside the content script (content scripts can't
// be ES modules), so this file exposes a namespace on globalThis instead of
// using import/export. Pure helpers are unit-tested in extension/tests via
// node:vm; the DOM parts are exercised manually (see C48.7).
//
// Strategy (v1 allowlist): prefer the FOCUSED field — that covers plain
// <textarea>/contenteditable fields on any allowlisted site and most real
// usage. Fall back to site-specific selectors for the C48.4 allowlist
// (Gmail compose, web Slack, Discord). Google Docs and Notion are
// deliberately deferred out of the v1 allowlist: both are ProseMirror-based
// editors that rebuild the DOM from their own model, which makes range
// mapping unreliable here.
//
// Newline normalization: textarea values on Windows can report \r\n while
// DOM indexes and the backend's offsets use \n. Everything extracted here is
// normalized to \n and the offset segments are rebuilt accordingly, so
// squiggles stay aligned across OS platforms.

(function () {
  "use strict";

  const BLOCK_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3",
    "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
    "PRE", "SECTION", "TABLE", "UL",
  ]);

  // Site-specific editable selectors, in detection order. Kept deliberately
  // narrow; each entry is verified per-site before being trusted (C48.7).
  const SITE_SELECTORS = {
    "mail.google.com": [
      "div[aria-label='Message Body'][contenteditable='true']",
      ".Am.Al.editable",
    ],
    "*.slack.com": [
      "div[role='textbox'][contenteditable='true']",
      "div.ql-editor",
    ],
    "discord.com": [
      "div[role='textbox'][contenteditable='true']",
      "textarea[aria-label^='Message']",
    ],
  };

  function siteForHost(host) {
    if (host === "mail.google.com") return "mail.google.com";
    // Keep in lockstep with the content-script matches in both manifests:
    // detection must never claim hosts the extension isn't injected into.
    if (host === "discord.com") return "discord.com";
    if (host === "slack.com" || host.endsWith(".slack.com")) return "*.slack.com";
    return null;
  }

  function selectorsForHost(host) {
    const site = siteForHost(host);
    return site ? SITE_SELECTORS[site] : [];
  }

  function isVisible(el) {
    return el.getClientRects().length > 0;
  }

  function detectEditableField(doc) {
    const active = doc.activeElement;
    if (active && active !== doc.body) {
      if (active.tagName === "TEXTAREA") return active;
      if (active.isContentEditable) return active;
    }
    for (const selector of selectorsForHost(doc.location.hostname)) {
      const el = doc.querySelector(selector);
      if (el && isVisible(el)) return el;
    }
    return null;
  }

  function normalizeText(text) {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  // Walks a contenteditable root, producing:
  //   text     — the full text, line breaks as \n
  //   segments — [{ node, start, end }] per text node, plus
  //              [{ node: null, start, end }] for synthetic \n at <br> /
  //              block boundaries (they have no DOM to range into)
  function textSegments(root) {
    const segments = [];
    let text = "";

    function pushBreak() {
      if (text.endsWith("\n")) return;
      segments.push({ node: null, start: text.length, end: text.length + 1 });
      text += "\n";
    }

    function walk(node, atBlockStart) {
      for (const child of node.childNodes) {
        if (child.nodeType === 3) {
          if (!child.data) continue;
          segments.push({
            node: child,
            start: text.length,
            end: text.length + child.data.length,
          });
          text += child.data;
        } else if (child.nodeType === 1) {
          if (child.tagName === "BR") {
            pushBreak();
            continue;
          }
          if (child.getAttribute("contenteditable") === "false") continue;
          const block = BLOCK_TAGS.has(child.tagName);
          if (block && text.length > 0 && !text.endsWith("\n")) pushBreak();
          walk(child);
        }
      }
    }

    walk(root, true);
    return { text, segments };
  }

  // Rebuilds text + segments over normalized (\n-only) text so offsets stay
  // exact when the raw DOM text contains \r\n or \r.
  function normalizeSegments(text, segments) {
    let out = "";
    const outSegments = [];
    for (const seg of segments) {
      const raw = text.slice(seg.start, seg.end);
      const norm = normalizeText(raw);
      if (norm.length === 0) continue;
      outSegments.push({
        node: seg.node,
        start: out.length,
        end: out.length + norm.length,
      });
      out += norm;
    }
    return { text: out, segments: outSegments };
  }

  function extractEditableText(field) {
    if (field.tagName === "TEXTAREA") {
      return { kind: "textarea", text: normalizeText(field.value), segments: null };
    }
    const { text, segments } = textSegments(field);
    return { kind: "contenteditable", ...normalizeSegments(text, segments) };
  }

  // Maps backend matches [{offset, length}] onto extraction segments, giving
  // [{startNode, startOffset, endNode, endOffset}] for range construction.
  // Matches that land entirely on synthetic line breaks are dropped; matches
  // crossing a break are bridged across it.
  function matchRanges(matches, segments) {
    const out = [];
    for (const match of matches) {
      if (
        !match ||
        !Number.isInteger(match.offset) ||
        match.offset < 0 ||
        !Number.isInteger(match.length) ||
        match.length <= 0
      ) {
        continue;
      }
      const start = match.offset;
      const end = match.offset + match.length;
      let i = 0;
      while (i < segments.length && segments[i].end <= start) i++;
      if (i >= segments.length || segments[i].start >= end) continue;
      let j = segments.length - 1;
      while (j > i && segments[j].start >= end) j--;
      while (i <= j && !segments[i].node) i++;
      while (j >= i && !segments[j].node) j--;
      if (i > j) continue;
      out.push({
        startNode: segments[i].node,
        startOffset: Math.max(0, start - segments[i].start),
        endNode: segments[j].node,
        endOffset: Math.min(end, segments[j].end) - segments[j].start,
      });
    }
    return out;
  }

  globalThis.__lexiconEditable = {
    BLOCK_TAGS,
    SITE_SELECTORS,
    siteForHost,
    selectorsForHost,
    isVisible,
    detectEditableField,
    normalizeText,
    textSegments,
    normalizeSegments,
    extractEditableText,
    matchRanges,
  };
})();
