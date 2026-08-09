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

  // Rebuild a contenteditable as uniform block elements.
  // Match the existing block tag (p on Slack, div on Gmail).
  // Never use this on Slate (Discord) — it desyncs the React model from the DOM.
  function replaceContentBlocks(field, text) {
    const doc = field.ownerDocument;
    const first = field.firstElementChild;
    const blockTag = first && first.tagName === "P" ? "P" : "DIV";
    const blocks = [];
    for (const line of normalizeText(text).split("\n")) {
      const block = doc.createElement(blockTag);
      if (line === "") {
        block.appendChild(doc.createElement("BR"));
      } else {
        block.textContent = line;
      }
      blocks.push(block);
    }
    field.replaceChildren(...blocks);
  }

  function isSlateEditor(field) {
    if (!field || field.nodeType !== 1) return false;
    if (field.getAttribute("data-slate-editor") === "true") return true;
    return Boolean(field.closest && field.closest('[data-slate-editor="true"]'));
  }

  // Slate (Discord) listens to beforeinput. Dispatch it with targetRanges, then
  // execCommand only if the editor did not already handle the event.
  function dispatchInsertText(field, range, text) {
    const doc = field.ownerDocument;
    const view = doc && doc.defaultView;
    if (!doc || !view) return false;
    try {
      field.focus();
      const sel = (view.getSelection && view.getSelection()) || doc.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);

      const evInit = {
        bubbles: true,
        cancelable: true,
        inputType: "insertText",
        data: text,
      };
      if (typeof view.StaticRange === "function") {
        evInit.targetRanges = [
          new view.StaticRange({
            startContainer: range.startContainer,
            startOffset: range.startOffset,
            endContainer: range.endContainer,
            endOffset: range.endOffset,
          }),
        ];
      }
      const InputEventCtor = view.InputEvent || globalThis.InputEvent;
      if (typeof InputEventCtor === "function") {
        const beforeEvt = new InputEventCtor("beforeinput", evInit);
        field.dispatchEvent(beforeEvt);
        // Firefox Slate prevents default and applies itself — skip execCommand
        // or the replacement is inserted twice.
        if (beforeEvt.defaultPrevented) return true;
      }
      if (typeof doc.execCommand === "function") {
        return doc.execCommand("insertText", false, text);
      }
    } catch {
      return false;
    }
    return false;
  }

  function replaceViaInsertText(field, text) {
    const doc = field.ownerDocument;
    if (!doc) return false;
    try {
      const range = doc.createRange();
      range.selectNodeContents(field);
      return dispatchInsertText(field, range, normalizeText(text));
    } catch {
      return false;
    }
  }

  // Replace one mapped DOM range with text via beforeinput + insertText.
  function replaceRangeViaInsertText(field, mapped, text) {
    if (!mapped || !mapped.startNode) return false;
    const doc = field.ownerDocument;
    try {
      const range = doc.createRange();
      range.setStart(mapped.startNode, mapped.startOffset);
      range.setEnd(mapped.endNode, mapped.endOffset);
      return dispatchInsertText(field, range, text);
    } catch {
      return false;
    }
  }

  // Set a textarea's value without tripping React's value tracking.
  function setTextareaValue(field, value) {
    const view = field.ownerDocument && field.ownerDocument.defaultView;
    const proto =
      view &&
      view.HTMLTextAreaElement &&
      view.HTMLTextAreaElement.prototype;
    const setter =
      proto && Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) {
      setter.call(field, value);
    } else {
      field.value = value;
    }
  }

  // Replace the field content. Fire input so the site sees the change.
  function replaceEditableText(field, kind, text) {
    if (kind === "textarea") {
      setTextareaValue(field, normalizeText(text));
      const view = field.ownerDocument && field.ownerDocument.defaultView;
      const EventCtor = (view && view.Event) || globalThis.Event;
      field.dispatchEvent(new EventCtor("input", { bubbles: true }));
      return;
    }
    if (replaceViaInsertText(field, text)) return;
    // Slate owns its DOM. Rewriting children leaves React state updated but
    // the visible editor stuck (can't caret/backspace until refresh).
    if (isSlateEditor(field)) return;
    replaceContentBlocks(field, text);
    const view = field.ownerDocument && field.ownerDocument.defaultView;
    const EventCtor = (view && view.Event) || globalThis.Event;
    field.dispatchEvent(new EventCtor("input", { bubbles: true }));
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
    isSlateEditor,
    replaceEditableText,
    replaceRangeViaInsertText,
    matchRanges,
  };
})();
