// Detect editable fields and extract/replace text.
// Prefer the focused field. Fall back to known selectors when needed.

(function () {
  "use strict";

  const BLOCK_TAGS = new Set([
    "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DIV", "DL", "DT",
    "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM", "H1", "H2", "H3",
    "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV", "OL", "P",
    "PRE", "SECTION", "TABLE", "UL",
  ]);

  // Site selectors used when focus is not on an editor.
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

  const GENERIC_SELECTORS = [
    "textarea",
    "div[role='textbox'][contenteditable='true']",
    "[contenteditable='true']",
    "div.public-DraftEditor-content[contenteditable='true']",
    "[data-lexical-editor='true'][contenteditable='true']",
    "div.ql-editor[contenteditable='true']",
  ];

  function siteForHost(host) {
    if (host === "mail.google.com") return "mail.google.com";
    if (host === "discord.com") return "discord.com";
    if (host === "slack.com" || host.endsWith(".slack.com")) return "*.slack.com";
    return null;
  }

  function selectorsForHost(host) {
    const site = siteForHost(host);
    const siteSelectors = site ? SITE_SELECTORS[site] || [] : [];
    return [...siteSelectors, ...GENERIC_SELECTORS];
  }

  function isVisible(el) {
    return Boolean(el && el.getClientRects && el.getClientRects().length > 0);
  }

  function isEditableElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.tagName === "TEXTAREA") return true;
    const attribute = el.getAttribute("contenteditable");
    if (attribute !== null && attribute.toLowerCase() !== "false") return true;
    // Use the editable root, not a focused child.
    return Boolean(
      el.isContentEditable &&
        (!el.parentElement || !el.parentElement.isContentEditable),
    );
  }

  // Follow focus into open shadow roots.
  function deepActiveElement(doc) {
    let el = doc.activeElement;
    while (el && el.shadowRoot && el.shadowRoot.activeElement) {
      el = el.shadowRoot.activeElement;
    }
    return el;
  }

  // Walk up from the focused node to the editable root.
  function editableFromNode(node) {
    let el = node;
    if (el && el.nodeType === 3) el = el.parentElement;
    while (el && el.nodeType === 1) {
      if (isEditableElement(el)) return el;
      if (el.shadowRoot) {
        const nested = findEditableDescendant(el);
        if (nested) return nested;
      }
      el = el.parentElement || (el.getRootNode && el.getRootNode().host) || null;
    }
    return null;
  }

  function findEditableDescendant(root) {
    if (!root || root.nodeType !== 1) return null;
    const stack = [root];
    while (stack.length) {
      const el = stack.pop();
      if (!el || el.nodeType !== 1) continue;
      if (el.tagName === "TEXTAREA" && isVisible(el)) return el;
      if (isEditableElement(el) && isVisible(el)) return el;
      if (el.shadowRoot) {
        for (const child of el.shadowRoot.children) stack.push(child);
      }
      for (const child of el.children) stack.push(child);
    }
    return null;
  }

  function queryFirstVisible(root, selectors) {
    for (const selector of selectors) {
      let list;
      try {
        list = root.querySelectorAll(selector);
      } catch {
        continue;
      }
      for (const el of list) {
        if (!isEditableElement(el)) continue;
        if (isVisible(el)) return el;
      }
    }
    return null;
  }

  function detectEditableField(doc) {
    const active = deepActiveElement(doc);
    if (active && active !== doc.body) {
      const fromActive = editableFromNode(active);
      if (fromActive) return fromActive;
      const nested = findEditableDescendant(active);
      if (nested) return nested;
    }
    const host = doc.location && doc.location.hostname;
    return queryFirstVisible(doc, selectorsForHost(host || ""));
  }

  function normalizeText(text) {
    return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  }

  // Map text nodes to character offsets. Line breaks have no node.
  function textSegments(root) {
    const segments = [];
    let text = "";

    function pushBreak() {
      if (text.endsWith("\n")) return;
      segments.push({ node: null, start: text.length, end: text.length + 1 });
      text += "\n";
    }

    function walk(node) {
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

    walk(root);
    return { text, segments };
  }

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

  // Rebuild contenteditable children as block elements.
  // Do not use this on framework editors.
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

  function isDraftEditor(field) {
    if (!field || field.nodeType !== 1) return false;
    if (field.classList && field.classList.contains("public-DraftEditor-content")) {
      return true;
    }
    return Boolean(
      field.closest && field.closest(".public-DraftEditor-content"),
    );
  }

  function isLexicalEditor(field) {
    if (!field || field.nodeType !== 1) return false;
    if (field.getAttribute("data-lexical-editor") === "true") return true;
    return Boolean(
      field.closest && field.closest('[data-lexical-editor="true"]'),
    );
  }

  function isProseMirrorEditor(field) {
    if (!field || field.nodeType !== 1) return false;
    if (field.classList && field.classList.contains("ProseMirror")) {
      return true;
    }
    return Boolean(field.closest && field.closest(".ProseMirror"));
  }

  function isNotionEditor(field) {
    if (!field || field.nodeType !== 1) return false;
    if (
      field.getAttribute("data-content-editable-leaf") === "true" &&
      field.isContentEditable
    ) {
      return true;
    }
    return Boolean(
      field.closest &&
        field.closest('[data-content-editable-leaf="true"]') === field,
    );
  }

  function isYoutubeEditor(field) {
    if (!field || field.nodeType !== 1 || !field.isContentEditable) {
      return false;
    }
    return (
      field.id === "contenteditable-root" ||
      field.id === "contenteditable-textarea"
    );
  }

  // Detect React-owned nodes so we do not rebuild their DOM.
  function hasReactFiber(field) {
    if (!field || field.nodeType !== 1) return false;
    return Object.keys(field).some((key) => key.startsWith("__react"));
  }

  // Editors that own their own model. Do not rewrite their children.
  function isFrameworkEditor(field) {
    return (
      isSlateEditor(field) ||
      isDraftEditor(field) ||
      isLexicalEditor(field) ||
      isProseMirrorEditor(field) ||
      isNotionEditor(field) ||
      isYoutubeEditor(field) ||
      hasReactFiber(field)
    );
  }

  function selectRange(field, range) {
    const doc = field.ownerDocument;
    const view = doc && doc.defaultView;
    if (!doc || !view) return false;
    try {
      field.focus();
      const sel = (view.getSelection && view.getSelection()) || doc.getSelection();
      if (!sel) return false;
      sel.removeAllRanges();
      sel.addRange(range);
      return true;
    } catch {
      return false;
    }
  }

  // Some editors need a beforeinput event before insertText.
  function dispatchInsertText(field, range, text) {
    const doc = field.ownerDocument;
    const view = doc && doc.defaultView;
    if (!doc || !view || !selectRange(field, range)) return false;
    try {
      const needsBeforeInput =
        isSlateEditor(field) ||
        isNotionEditor(field) ||
        isYoutubeEditor(field);
      if (needsBeforeInput) {
        const evInit = {
          bubbles: true,
          cancelable: true,
          inputType: "insertText",
          data: text,
          composed: true,
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
          if (beforeEvt.defaultPrevented) return true;
        }
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

  // Replace a mapped range by editing the DOM directly.
  function replaceRangeDirect(field, mapped, text) {
    if (!mapped || !mapped.startNode) return false;
    const doc = field.ownerDocument;
    try {
      const range = doc.createRange();
      range.setStart(mapped.startNode, mapped.startOffset);
      range.setEnd(mapped.endNode, mapped.endOffset);
      range.deleteContents();
      range.insertNode(doc.createTextNode(text));
      const view = doc && doc.defaultView;
      const EventCtor = (view && view.Event) || globalThis.Event;
      field.dispatchEvent(new EventCtor("input", { bubbles: true }));
      return true;
    } catch {
      return false;
    }
  }

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

  // Replace field text and fire an input event.
  function replaceEditableText(field, kind, text) {
    if (kind === "textarea") {
      setTextareaValue(field, normalizeText(text));
      const view = field.ownerDocument && field.ownerDocument.defaultView;
      const EventCtor = (view && view.Event) || globalThis.Event;
      field.dispatchEvent(new EventCtor("input", { bubbles: true }));
      return true;
    }
    if (replaceViaInsertText(field, text)) return true;
    if (isFrameworkEditor(field)) return false;
    replaceContentBlocks(field, text);
    const view = field.ownerDocument && field.ownerDocument.defaultView;
    const EventCtor = (view && view.Event) || globalThis.Event;
    field.dispatchEvent(new EventCtor("input", { bubbles: true }));
    return true;
  }

  // Rebuild field text without execCommand.
  function replaceContentDirect(field, kind, text) {
    if (kind === "textarea") {
      setTextareaValue(field, normalizeText(text));
    } else {
      if (isFrameworkEditor(field)) return false;
      replaceContentBlocks(field, text);
    }
    const view = field.ownerDocument && field.ownerDocument.defaultView;
    const EventCtor = (view && view.Event) || globalThis.Event;
    field.dispatchEvent(new EventCtor("input", { bubbles: true }));
    return true;
  }

  // Map matches to DOM ranges. Drop matches that cannot be mapped.
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
    GENERIC_SELECTORS,
    siteForHost,
    selectorsForHost,
    isVisible,
    isEditableElement,
    deepActiveElement,
    editableFromNode,
    detectEditableField,
    normalizeText,
    textSegments,
    normalizeSegments,
    extractEditableText,
    isSlateEditor,
    isDraftEditor,
    isLexicalEditor,
    isNotionEditor,
    isFrameworkEditor,
    isYoutubeEditor,
    replaceEditableText,
    replaceRangeViaInsertText,
    replaceRangeDirect,
    replaceContentDirect,
    matchRanges,
  };
})();
