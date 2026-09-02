// Draw red underlines for grammar matches.

(function () {
  "use strict";

  const LAYER_ID = "lexicon-squiggle-layer";
  const STYLE_ID = "lexicon-squiggle-style";
  const MIRROR_ID = "lexicon-squiggle-mirror";

  const STYLE =
    `#${LAYER_ID}{position:fixed;left:0;top:0;width:100%;height:100%;pointer-events:none;z-index:2147483645;overflow:hidden}` +
    `#${LAYER_ID} .lexicon-squiggle{position:absolute;height:4px;background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='9' height='4'><path d='M0 3 Q 2.25 1 4.5 3 T 9 3' fill='none' stroke='%23e5484d' stroke-width='1.4'/></svg>");background-repeat:repeat-x;background-size:9px 4px}` +
    `#${LAYER_ID} .lexicon-squiggle-flash{animation:lexicon-squiggle-flash 900ms ease-in-out;transform-origin:center}` +
    `#${LAYER_ID} .lexicon-squiggle-flash::before{content:"";position:absolute;left:-2px;top:calc(3px - var(--lexicon-error-height, 16px));width:calc(100% + 4px);height:var(--lexicon-error-height, 16px);box-sizing:border-box;border:1px solid rgba(229,72,77,.56);border-radius:3px;background:rgba(229,72,77,.06);box-shadow:0 0 0 0 rgba(229,72,77,0);pointer-events:none;animation:lexicon-error-box-flash 900ms ease-in-out}` +
    "@keyframes lexicon-squiggle-flash{0%,100%{filter:drop-shadow(0 0 0 rgba(229,72,77,0));transform:scaleY(1)}25%,75%{filter:drop-shadow(0 0 1px rgba(229,72,77,.55));transform:scaleY(1.1)}50%{filter:drop-shadow(0 0 2px rgba(229,72,77,.72));transform:scaleY(1.18)}}" +
    "@keyframes lexicon-error-box-flash{0%,100%{opacity:0;box-shadow:0 0 0 0 rgba(229,72,77,0)}20%,80%{opacity:.58;box-shadow:0 0 0 1px rgba(229,72,77,.14)}50%{opacity:.7;box-shadow:0 0 2px 1px rgba(229,72,77,.18)}}" +
    `@media (prefers-reduced-motion:reduce){#${LAYER_ID} .lexicon-squiggle-flash{animation:none;filter:drop-shadow(0 0 1px rgba(229,72,77,.55))}#${LAYER_ID} .lexicon-squiggle-flash::before{animation:none;opacity:.58;box-shadow:0 0 0 1px rgba(229,72,77,.14)}}` +
    `#${MIRROR_ID},.lexicon-squiggle-mirror{position:absolute;visibility:hidden;white-space:pre-wrap;overflow:hidden;pointer-events:none}`;

  let state = null; // { field, ranges, text, spans?, mirror?, onActivate, onDeactivate }
  let boundField = null;
  let hitRegions = []; // { index, left, top, right, bottom, rect }
  let activeIndex = null;
  let listenersBound = false;

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

  function addSquiggle(layer, rect, matchIndex) {
    const el = document.createElement("div");
    el.className = "lexicon-squiggle";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.bottom - 3}px`;
    el.style.width = `${Math.max(2, rect.width)}px`;
    if (typeof el.style.setProperty === "function") {
      el.style.setProperty(
        "--lexicon-error-height",
        `${Math.max(1, Number(rect.height) || 1)}px`,
      );
    }
    layer.appendChild(el);

    if (typeof matchIndex === "number" && rect.width > 0 && rect.height > 0) {
      hitRegions.push({
        index: matchIndex,
        el,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        rect: {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        },
      });
    }
  }

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

  function buildMirror(field, ranges, text, mirrorId = MIRROR_ID) {
    const computed = getComputedStyle(field);
    const style = mirrorStyle(field, computed);
    const mirror = document.createElement("div");
    mirror.id = mirrorId;
    mirror.className = "lexicon-squiggle-mirror";
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

    const indexed = ranges
      .map((r, index) => ({ ...r, index }))
      .filter((r) => Number.isInteger(r.start) && Number.isInteger(r.end) && r.end > r.start)
      .sort((a, b) => a.start - b.start);

    const spans = [];
    let cursor = 0;
    for (const r of indexed) {
      if (r.start < cursor) continue;
      if (r.start > cursor) {
        mirror.appendChild(document.createTextNode(text.slice(cursor, r.start)));
      }
      const span = document.createElement("span");
      span.textContent = text.slice(r.start, r.end);
      mirror.appendChild(span);
      spans.push({ el: span, index: r.index });
      cursor = r.end;
    }
    if (cursor < text.length) {
      mirror.appendChild(document.createTextNode(text.slice(cursor)));
    }
    return { mirror, spans, style };
  }

  function positionTextarea(layer) {
    const { field, mirror, spans } = state;
    const rect = field.getBoundingClientRect();
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top - field.scrollTop}px`;
    for (const item of spans) {
      const spanRect = item.el.getBoundingClientRect();
      addSquiggle(layer, spanRect, item.index);
    }
  }

  function positionContenteditable(layer) {
    state.ranges.forEach((r, index) => {
      if (!r || !r.startNode || !r.endNode) return;
      const range = document.createRange();
      try {
        range.setStart(r.startNode, r.startOffset);
        range.setEnd(r.endNode, r.endOffset);
      } catch {
        return;
      }
      for (const rect of range.getClientRects()) {
        addSquiggle(layer, rect, index);
      }
    });
  }

  function render() {
    if (!state) return;
    const layer = ensureLayer();
    layer.replaceChildren();
    hitRegions = [];
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

  function findHit(x, y) {
    for (let i = hitRegions.length - 1; i >= 0; i--) {
      const h = hitRegions[i];
      if (x >= h.left && x <= h.right && y >= h.top && y <= h.bottom) {
        return h;
      }
    }
    return null;
  }

  function regionsForState(fieldState) {
    return fieldState === state ? hitRegions : fieldState?.hitRegions || [];
  }

  function cancelStateFlash(fieldState) {
    if (!fieldState) return;
    fieldState.flashToken = (fieldState.flashToken || 0) + 1;
    if (fieldState.flashTimer != null && typeof clearTimeout === "function") {
      clearTimeout(fieldState.flashTimer);
      fieldState.flashTimer = null;
    }
    for (const hit of regionsForState(fieldState)) {
      hit.el?.classList?.remove("lexicon-squiggle-flash");
    }
  }

  function flashStateMatch(fieldState, matchIndex) {
    if (!fieldState || !Number.isInteger(matchIndex)) return false;
    const token = (fieldState.flashToken || 0) + 1;
    fieldState.flashToken = token;
    if (fieldState.flashTimer != null && typeof clearTimeout === "function") {
      clearTimeout(fieldState.flashTimer);
      fieldState.flashTimer = null;
    }

    const apply = () => {
      for (const hit of regionsForState(fieldState)) {
        if (hit.index !== matchIndex || !hit.el?.classList) continue;
        hit.el.classList.remove("lexicon-squiggle-flash");
        void hit.el.offsetWidth;
        hit.el.classList.add("lexicon-squiggle-flash");
      }
    };
    const remove = () => {
      for (const hit of regionsForState(fieldState)) {
        if (hit.index === matchIndex) {
          hit.el?.classList?.remove("lexicon-squiggle-flash");
        }
      }
    };

    apply();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => {
        if (fieldState.flashToken === token) apply();
      });
    }
    if (typeof setTimeout === "function") {
      fieldState.flashTimer = setTimeout(() => {
        if (fieldState.flashToken !== token) return;
        remove();
        fieldState.flashTimer = null;
      }, 1200);
      fieldState.flashTimer?.unref?.();
    }
    return true;
  }

  function activate(hit, pinned) {
    if (!state || !hit) return;
    activeIndex = hit.index;
    if (typeof state.onActivate === "function") {
      state.onActivate(hit.index, hit.rect, { pinned: Boolean(pinned) });
    }
  }

  function onPointerMove(event) {
    if (!state) return;
    const hit = findHit(event.clientX, event.clientY);
    if (hit && activeIndex !== hit.index) activate(hit, false);
  }

  function onPointerDown(event) {
    if (!state) return;
    const hit = findHit(event.clientX, event.clientY);
    if (hit) activate(hit, true);
  }

  function bindHitListeners() {
    if (listenersBound) return;
    document.addEventListener("mousemove", onPointerMove, true);
    document.addEventListener("mousedown", onPointerDown, true);
    listenersBound = true;
  }

  function unbindHitListeners() {
    if (!listenersBound) return;
    document.removeEventListener("mousemove", onPointerMove, true);
    document.removeEventListener("mousedown", onPointerDown, true);
    listenersBound = false;
  }

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

  function applySquiggles(field, ranges, text, options) {
    clearSquiggles();
    if (!field || !ranges || ranges.length === 0 || text == null) return;
    const opts = options || {};
    if (field.tagName === "TEXTAREA") {
      const { mirror, spans } = buildMirror(field, ranges, text);
      state = {
        kind: "textarea",
        field,
        ranges,
        text,
        mirror,
        spans,
        onActivate: opts.onActivate || null,
        onDeactivate: opts.onDeactivate || null,
        flashToken: 0,
        flashTimer: null,
      };
      document.documentElement.appendChild(mirror);
    } else {
      state = {
        kind: "contenteditable",
        field,
        ranges,
        text,
        onActivate: opts.onActivate || null,
        onDeactivate: opts.onDeactivate || null,
        flashToken: 0,
        flashTimer: null,
      };
    }
    bindReposition();
    bindHitListeners();
    render();
  }

  function clearSquiggles() {
    unbindReposition();
    unbindHitListeners();
    if (state && typeof state.onDeactivate === "function") {
      state.onDeactivate();
    }
    cancelStateFlash(state);
    activeIndex = null;
    hitRegions = [];
    const layer = document.getElementById(LAYER_ID);
    if (layer) layer.remove();
    const style = document.getElementById(STYLE_ID);
    if (style) style.remove();
    const mirror = document.getElementById(MIRROR_ID);
    if (mirror) mirror.remove();
    state = null;
  }

  const fieldStates = new Map();
  let fieldMirrorCounter = 0;
  let fieldRafPending = false;
  let fieldListenersBound = false;
  let fieldActiveState = null;

  function addFieldSquiggle(fieldState, layer, rect, matchIndex) {
    const el = document.createElement("div");
    el.className = "lexicon-squiggle";
    el.style.left = `${rect.left}px`;
    el.style.top = `${rect.bottom - 3}px`;
    el.style.width = `${Math.max(2, rect.width)}px`;
    if (typeof el.style.setProperty === "function") {
      el.style.setProperty(
        "--lexicon-error-height",
        `${Math.max(1, Number(rect.height) || 1)}px`,
      );
    }
    layer.appendChild(el);
    if (typeof matchIndex !== "number" || rect.width <= 0 || rect.height <= 0) {
      return;
    }
    fieldState.hitRegions.push({
      index: matchIndex,
      el,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      rect: {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      },
    });
  }

  function positionFieldTextarea(layer, fieldState) {
    const { field, mirror, spans } = fieldState;
    const rect = field.getBoundingClientRect();
    mirror.style.left = `${rect.left}px`;
    mirror.style.top = `${rect.top - field.scrollTop}px`;
    for (const item of spans) {
      const spanRect = item.el.getBoundingClientRect();
      addFieldSquiggle(fieldState, layer, spanRect, item.index);
    }
  }

  function positionFieldContenteditable(layer, fieldState) {
    fieldState.ranges.forEach((range, index) => {
      if (!range || !range.startNode || !range.endNode) return;
      const domRange = document.createRange();
      try {
        domRange.setStart(range.startNode, range.startOffset);
        domRange.setEnd(range.endNode, range.endOffset);
      } catch {
        return;
      }
      for (const rect of domRange.getClientRects()) {
        addFieldSquiggle(fieldState, layer, rect, index);
      }
    });
  }

  function renderFieldSquiggles() {
    if (fieldStates.size === 0) return;
    const layer = ensureLayer();
    layer.replaceChildren();
    for (const fieldState of fieldStates.values()) {
      fieldState.hitRegions = [];
      if (fieldState.kind === "textarea") {
        positionFieldTextarea(layer, fieldState);
      } else {
        positionFieldContenteditable(layer, fieldState);
      }
    }
  }

  function scheduleFieldRender() {
    if (fieldRafPending) return;
    fieldRafPending = true;
    requestAnimationFrame(() => {
      fieldRafPending = false;
      renderFieldSquiggles();
    });
  }

  function findFieldHit(fieldState, x, y) {
    for (let i = fieldState.hitRegions.length - 1; i >= 0; i--) {
      const hit = fieldState.hitRegions[i];
      if (x >= hit.left && x <= hit.right && y >= hit.top && y <= hit.bottom) {
        return hit;
      }
    }
    return null;
  }

  function deactivateFieldSquiggle() {
    if (!fieldActiveState) return;
    if (typeof fieldActiveState.onDeactivate === "function") {
      fieldActiveState.onDeactivate();
    }
    fieldActiveState = null;
  }

  function activateFieldSquiggle(fieldState, hit, pinned) {
    if (!hit) return;
    if (
      fieldActiveState &&
      (fieldActiveState !== fieldState ||
        fieldActiveState.activeIndex !== hit.index)
    ) {
      deactivateFieldSquiggle();
    }
    fieldActiveState = fieldState;
    fieldState.activeIndex = hit.index;
    if (typeof fieldState.onActivate === "function") {
      fieldState.onActivate(hit.index, hit.rect, { pinned: Boolean(pinned) });
    }
  }

  function onFieldPointerMove(event) {
    let selectedState = null;
    let selectedHit = null;
    const states = [...fieldStates.values()];
    for (let i = states.length - 1; i >= 0; i--) {
      const hit = findFieldHit(states[i], event.clientX, event.clientY);
      if (hit) {
        selectedState = states[i];
        selectedHit = hit;
        break;
      }
    }
    if (selectedState) activateFieldSquiggle(selectedState, selectedHit, false);
    else deactivateFieldSquiggle();
  }

  function onFieldPointerDown(event) {
    const states = [...fieldStates.values()];
    for (let i = states.length - 1; i >= 0; i--) {
      const hit = findFieldHit(states[i], event.clientX, event.clientY);
      if (hit) {
        activateFieldSquiggle(states[i], hit, true);
        return;
      }
    }
  }

  function bindFieldListeners(fieldState) {
    if (!fieldListenersBound) {
      window.addEventListener("scroll", scheduleFieldRender, {
        capture: true,
        passive: true,
      });
      window.addEventListener("resize", scheduleFieldRender);
      document.addEventListener("mousemove", onFieldPointerMove, true);
      document.addEventListener("mousedown", onFieldPointerDown, true);
      fieldListenersBound = true;
    }
    if (fieldState.kind === "textarea" && !fieldState.scrollHandler) {
      fieldState.scrollHandler = scheduleFieldRender;
      fieldState.field.addEventListener(
        "scroll",
        fieldState.scrollHandler,
        { passive: true },
      );
    }
  }

  function unbindFieldListeners(fieldState) {
    if (fieldState && fieldState.scrollHandler) {
      fieldState.field.removeEventListener(
        "scroll",
        fieldState.scrollHandler,
      );
      fieldState.scrollHandler = null;
    }
    if (fieldStates.size > 0 || !fieldListenersBound) return;
    window.removeEventListener("scroll", scheduleFieldRender, {
      capture: true,
    });
    window.removeEventListener("resize", scheduleFieldRender);
    document.removeEventListener("mousemove", onFieldPointerMove, true);
    document.removeEventListener("mousedown", onFieldPointerDown, true);
    fieldListenersBound = false;
    deactivateFieldSquiggle();
  }

  function clearFieldSquiggles(field) {
    const fieldState = fieldStates.get(field);
    if (!fieldState) return;
    if (fieldActiveState === fieldState) deactivateFieldSquiggle();
    cancelStateFlash(fieldState);
    if (fieldState.mirror) fieldState.mirror.remove();
    fieldStates.delete(field);
    unbindFieldListeners(fieldState);
    if (fieldStates.size === 0) {
      const layer = document.getElementById(LAYER_ID);
      if (layer) layer.remove();
      const style = document.getElementById(STYLE_ID);
      if (style) style.remove();
      return;
    }
    scheduleFieldRender();
  }

  function scrollStateMatch(fieldState, matchIndex, options = {}) {
    if (!fieldState || !Number.isInteger(matchIndex)) return false;
    const shouldFlash = Boolean(options?.flash);
    const field = fieldState.field;
    const range = fieldState.ranges[matchIndex];
    if (!range) return false;

    if (fieldState.kind === "textarea") {
      const mirrorSpan = fieldState.spans.find(
        (item) => item.index === matchIndex,
      );
      let mirrorMeasured = false;
      if (
        mirrorSpan?.el?.getBoundingClientRect &&
        typeof field.getBoundingClientRect === "function"
      ) {
        const fieldRect = field.getBoundingClientRect();
        const spanRect = mirrorSpan.el.getBoundingClientRect();
        mirrorMeasured = true;
        let delta = 0;
        if (spanRect.top < fieldRect.top) {
          delta = spanRect.top - fieldRect.top - 4;
        } else if (spanRect.bottom > fieldRect.bottom) {
          delta = spanRect.bottom - fieldRect.bottom + 4;
        }
        if (delta && Number.isFinite(field.scrollTop)) {
          field.scrollTop += delta;
        }
      }

      // setSelectionRange is a fallback for browsers that do not expose the
      // hidden mirror's line box while the textarea is internally scrolled.
      if (
        !mirrorMeasured &&
        typeof field.setSelectionRange === "function" &&
        typeof field.value === "string"
      ) {
        const start = Math.max(
          0,
          Math.min(field.value.length, Number(range.start) || 0),
        );
        const end = Math.max(
          start,
          Math.min(field.value.length, Number(range.end) || start),
        );
        try {
          field.setSelectionRange(start, end);
        } catch {
          // Some managed fields reject programmatic selection changes.
        }
      }
      if (fieldStates.has(fieldState.field)) scheduleFieldRender();
      else scheduleRender();
      if (shouldFlash) flashStateMatch(fieldState, matchIndex);
      return true;
    }

    let target = range.startNode;
    if (target && target.nodeType !== 1) target = target.parentElement;
    try {
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView({ block: "center", inline: "nearest" });
      } else if (typeof field.scrollIntoView === "function") {
        field.scrollIntoView({ block: "center", inline: "nearest" });
      } else {
        return false;
      }
    } catch {
      if (typeof target?.scrollIntoView === "function") {
        target.scrollIntoView();
      } else if (typeof field.scrollIntoView === "function") {
        field.scrollIntoView();
      } else {
        return false;
      }
    }
    if (fieldStates.has(fieldState.field)) scheduleFieldRender();
    else scheduleRender();
    if (shouldFlash) flashStateMatch(fieldState, matchIndex);
    return true;
  }

  function scrollToMatch(field, matchIndex, options) {
    const fieldState =
      fieldStates.get(field) || (state && state.field === field ? state : null);
    return scrollStateMatch(fieldState, matchIndex, options);
  }

  function clearAllFieldSquiggles() {
    for (const field of [...fieldStates.keys()]) clearFieldSquiggles(field);
  }

  function applyFieldSquiggles(field, ranges, text, options) {
    clearFieldSquiggles(field);
    if (!field || !ranges || ranges.length === 0 || text == null) return;
    const opts = options || {};
    const fieldState = {
      field,
      kind: field.tagName === "TEXTAREA" ? "textarea" : "contenteditable",
      ranges,
      text,
      mirror: null,
      spans: [],
      hitRegions: [],
      activeIndex: null,
      onActivate: opts.onActivate || null,
      onDeactivate: opts.onDeactivate || null,
      flashToken: 0,
      flashTimer: null,
      scrollHandler: null,
    };
    fieldStates.set(field, fieldState);
    if (fieldState.kind === "textarea") {
      const mirrorId = `${MIRROR_ID}-${fieldMirrorCounter++}`;
      const mirrorData = buildMirror(field, ranges, text, mirrorId);
      fieldState.mirror = mirrorData.mirror;
      fieldState.spans = mirrorData.spans;
      document.documentElement.appendChild(fieldState.mirror);
    }
    bindFieldListeners(fieldState);
    renderFieldSquiggles();
  }

  globalThis.__lexiconSquiggle = {
    applySquiggles,
    clearSquiggles,
    mergeRanges,
    applyFieldSquiggles,
    clearFieldSquiggles,
    clearAllFieldSquiggles,
    scrollToMatch,
  };
})();
