// Squiggle overlay rendering (C48.4).
//
// Classic script (content scripts can't be ES modules); exposes
// globalThis.__lexiconSquiggle. Renders red underlines for grammar matches
// keyed to raw DOM ranges — deliberately NOT reusing the desktop app's
// grammarHighlight.js, which is built against TipTap's ProseMirror schema.
//
// Two positioning paths:
//   - contenteditable (Gmail/Slack/Discord/generic): build a DOM Range per
//     match and draw at range.getClientRects().
//   - textarea: no DOM ranges exist, so a hidden text-mirror (same font and
//     wrapping width) renders the normalized text, matches wrapped in spans,
//     and squiggle positions are read from the span rects.
//
// The overlay is one fixed, pointer-transparent layer. Positions are
// recomputed on scroll/resize (rAF-throttled); the content script clears
// squiggles on input because offsets go stale.

(function () {
  "use strict";

  const LAYER_ID = "lexicon-squiggle-layer";
  const STYLE_ID = "lexicon-squiggle-style";
  const MIRROR_ID = "lexicon-squiggle-mirror";

  const STYLE = `#${LAYER_ID}{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483647;overflow:hidden}` +
    `#${LAYER_ID} .lexicon-squiggle{position:absolute;height:4px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='4'><path d='M0 3 Q 2.25 1 4.5 3 T 9 3' fill='none' stroke='%23e5484d' stroke-width='1.4'/></svg>");background-repeat:repeat-x;background-size:9px 4px}` +
    `#${MIRROR_ID}{position:absolute;visibility:hidden;white-space:pre-wrap;overflow:hidden;pointer-events:none}`;

  let state = null; // { field, ranges, text, spans?, mirror? }
  let boundField = null; // textarea the scroll listener is attached to

  function ensureLayer() {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = STYLE;
      document.documentElement.appendChild(style);
    }
    let layer = document.getElementById(LAYER_ID);
    if (!layer) {
      layer = document.createElement("div");
      layer.id = LAYER_ID;
      document.documentElement.appendChild(layer);
    }
    return layer;
  }

  function addSquiggle(layer, rect) {
    const el = document.createElement("div");
    el.className = "lexicon-squiggle";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.bottom - 3}px`;
    el.style.width = `${Math.max(2, rect.width)}px`;
    layer.appendChild(el);
  }

  // Merges overlapping/adjacent ranges so nested spans never occur in the
  // mirror and overlapping squiggles don't stack.
  function mergeRanges(ranges) {
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const out = [];
    for (const r of sorted) {
      const last = out[out.length - 1];
      if (last && r.start <= last.end) {
        last.end = Math.max(last.end, r.end);
      } else {
        out.push({ start: r.start, end: r.end });
      }
    }
    return out;
  }

function mirrorStyle(field, computed) {
  const fontSize = parseFloat(computed.fontSize) || 12;
  const lineHeight =
    computed.lineHeight === "normal"
      ? `${Math.round(fontSize * 1.2)}px`
      : computed.lineHeight;
  const borderL = parseFloat(computed.borderLeftWidth) || 0;
  const borderR = parseFloat(computed.borderRightWidth) || 0;
  const scrollbar = field.offsetWidth - field.clientWidth - borderL - borderR;
  const contentWidth = field.clientWidth - Math.max(0, scrollbar);
  return {
    fontSize: computed.fontSize,
    fontFamily: computed.fontFamily,
    fontStyle: computed.fontStyle,
    fontWeight: computed.fontWeight,
    letterSpacing: computed.letterSpacing,
    lineHeight,
    // Wrapping must match the textarea exactly (long words can break at word
    // boundaries rather than mid-word) — copy its computed wrap rules.
    whiteSpace: computed.whiteSpace || "pre-wrap",
    overflowWrap: computed.overflowWrap || "break-word",
    wordBreak: computed.wordBreak || "normal",
    paddingTop: computed.paddingTop,
    paddingRight: computed.paddingRight,
    paddingBottom: computed.paddingBottom,
    paddingLeft: computed.paddingLeft,
    borderTopWidth: computed.borderTopWidth,
    borderRightWidth: computed.borderRightWidth,
    borderBottomWidth: computed.borderBottomWidth,
    borderLeftWidth: computed.borderLeftWidth,
    contentWidth,
  };
}

  function buildMirror(field, ranges, text) {
    const computed = getComputedStyle(field);
    const style = mirrorStyle(field, computed);
    const mirror = document.createElement("div");
    mirror.id = MIRROR_ID;
    Object.assign(mirror.style, {
      left: "0px",
      top: "0px",
      width: `${style.contentWidth}px`,
      height: `${field.clientHeight}px`,
      fontSize: style.fontSize,
      fontFamily: style.fontFamily,
      fontStyle: style.fontStyle,
      fontWeight: style.fontWeight,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      paddingTop: style.paddingTop,
      paddingRight: style.paddingRight,
      paddingBottom: style.paddingBottom,
      paddingLeft: style.paddingLeft,
      borderTopWidth: style.borderTopWidth,
      borderRightWidth: style.borderRightWidth,
      borderBottomWidth: style.borderBottomWidth,
      borderLeftWidth: style.borderLeftWidth,
      boxSizing: "content-box",
      whiteSpace: style.whiteSpace,
      overflowWrap: style.overflowWrap,
      wordBreak: style.wordBreak,
    });

    const merged = mergeRanges(ranges);
    const spans = [];
    let cursor = 0;
    for (const r of merged) {
      if (r.start < cursor) continue;
      if (r.start > cursor) {
        mirror.appendChild(document.createTextNode(text.slice(cursor, r.start)));
      }
      const span = document.createElement("span");
      span.textContent = text.slice(r.start, r.end);
      mirror.appendChild(span);
      spans.push(span);
      cursor = r.end;
    }
    if (cursor < text.length) {
      mirror.appendChild(document.createTextNode(text.slice(cursor)));
    }
    return { mirror, spans, style };
  }

  function positionTextarea(layer) {
    const { field, text, ranges, mirror, spans } = state;
    const rect = field.getBoundingClientRect();
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top - field.scrollTop}px`;
    for (const span of spans) {
      const spanRect = span.getBoundingClientRect();
      addSquiggle(layer, spanRect);
    }
  }

  function positionContenteditable(layer) {
    for (const r of state.ranges) {
      const range = document.createRange();
      range.setStart(r.startNode, r.startOffset);
      range.setEnd(r.endNode, r.endOffset);
      for (const rect of range.getClientRects()) {
        addSquiggle(layer, rect);
      }
    }
  }

  function render() {
    if (!state) return;
    const layer = ensureLayer();
    layer.replaceChildren();
    if (state.kind === "textarea") positionTextarea(layer);
    else positionContenteditable(layer);
  }

  let rafPending = false;
  function scheduleRender() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      render();
    });
  }

  // Listeners are added per applySquiggles and removed in clearSquiggles so
  // repeated proofreads never stack them.
  function bindReposition() {
    window.addEventListener("scroll", scheduleRender, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", scheduleRender);
    if (state.field.tagName === "TEXTAREA") {
      boundField = state.field;
      boundField.addEventListener("scroll", scheduleRender, { passive: true });
    }
  }

  function unbindReposition() {
    window.removeEventListener("scroll", scheduleRender, { capture: true });
    window.removeEventListener("resize", scheduleRender);
    if (boundField) {
      boundField.removeEventListener("scroll", scheduleRender);
      boundField = null;
    }
  }

  // field: the editable element; ranges: [{startNode, startOffset, endNode,
  // endOffset}] for contenteditable OR [{start, end}] char ranges for
  // textarea; text: the exact (normalized) text the offsets refer to.
  function applySquiggles(field, ranges, text) {
    clearSquiggles();
    if (!field || !ranges || ranges.length === 0 || text == null) return;
    if (field.tagName === "TEXTAREA") {
      const { mirror, spans } = buildMirror(field, ranges, text);
      state = { kind: "textarea", field, ranges, text, mirror, spans };
      document.documentElement.appendChild(mirror);
    } else {
      state = { kind: "contenteditable", field, ranges, text };
    }
    bindReposition();
    render();
  }

  function clearSquiggles() {
    unbindReposition();
    const layer = document.getElementById(LAYER_ID);
    if (layer) layer.remove();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    const mirror = document.getElementById(MIRROR_ID);
    if (mirror) mirror.remove();
    state = null;
  }

  globalThis.__lexiconSquiggle = {
    applySquiggles,
    clearSquiggles,
    mergeRanges,
  };
})();
