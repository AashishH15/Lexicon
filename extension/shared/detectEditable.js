// Editable-field detection and text extraction.
// This file runs as a classic script. It exposes __lexiconEditable.
// Use the focused field first. Fall back to site selectors.
// Normalize newlines to \n so offsets stay aligned.

(function () {
  "use strict";

  const BLOCK_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3",
    "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
    "PRE", "SECTION", "TABLE", "UL",
  ]);

  // Site-specific selectors. Keep them narrow.
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
    // Keep in sync with the content-script matches.
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

  // Map each text node to offsets. A line break has no node.
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

  // Rebuild offsets over normalized text.
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

  // Map matches to DOM ranges. Drop unmappable matches.
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
