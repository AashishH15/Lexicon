// Suggestion badge and panel UI.

(function () {
  "use strict";

  const BADGE_SIZE = 26;
  const PANEL_WIDTH = 320;
  const PANEL_MAX_HEIGHT = 360;
  const PANEL_GAP = 8;
  const TOOLTIP_WIDTH = 288;
  const AI_TRIGGER_WIDTH = 76;
  const AI_TRIGGER_GAP = 5;
  const HOVER_BRIDGE = 4;
  const TOOLTIP_HIDE_DELAY_MS = 200;
  const TONE_TOOLS = [
    "Friendly",
    "Professional",
    "Academic",
    "Formal",
    "Casual",
    "Playful",
    "Empathetic",
    "Persuasive",
    "Humorous",
  ];

  const STYLE =
    `.badge{position:fixed;width:${BADGE_SIZE}px;height:${BADGE_SIZE}px;` +
    "border-radius:50%;background:#111111;color:#ffffff;font:600 12px/1 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);user-select:none;z-index:2}" +
    ".badge.clean{background:#346538}" +
    ".badge.offline{background:#71706c}" +
    `.badge-group{position:fixed;width:${BADGE_SIZE}px;height:${BADGE_SIZE}px;z-index:2}` +
    `.badge-group::before,.badge-group::after{content:"";position:absolute;top:0;height:${BADGE_SIZE}px;` +
    `width:${AI_TRIGGER_GAP + HOVER_BRIDGE}px;pointer-events:auto}` +
    `.badge-group::before{left:-${AI_TRIGGER_GAP + HOVER_BRIDGE}px}` +
    `.badge-group::after{right:-${AI_TRIGGER_GAP + HOVER_BRIDGE}px}` +
    `.badge-group .ai-trigger{position:absolute;right:${BADGE_SIZE + AI_TRIGGER_GAP}px;top:0;width:${AI_TRIGGER_WIDTH}px;` +
    "height:26px;border:1px solid #d8d7d3;border-radius:13px;background:#ffffff;color:#1f6c9f;" +
    "display:flex;align-items:center;justify-content:center;gap:5px;font:600 11px/1 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;" +
    "box-shadow:0 2px 8px rgba(0,0,0,0.18);cursor:pointer;opacity:0;pointer-events:none;" +
    "transform:translateX(4px);transition:opacity .12s ease,transform .12s ease;white-space:nowrap}" +
    ".badge-group:hover .ai-trigger,.badge-group:focus-within .ai-trigger{opacity:1;pointer-events:auto;transform:translateX(0)}" +
    ".badge-group .ai-trigger:hover{background:#edf3fa}" +
    ".badge-group .magic-icon{display:inline-flex;width:15px;height:15px;align-items:center;justify-content:center}" +
    ".badge-group .magic-icon svg{display:block;width:15px;height:15px;fill:currentColor}" +
    ".badge .check-icon{display:inline-flex;width:15px;height:15px;align-items:center;justify-content:center}" +
    ".badge .check-icon svg{display:block;width:15px;height:15px;fill:currentColor}" +
    `.panel{position:fixed;width:${PANEL_WIDTH}px;max-height:${PANEL_MAX_HEIGHT}px;` +
    "display:flex;flex-direction:column;background:#f7f6f3;border:1px solid #d8d7d3;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.18);" +
    "font:13px/1.45 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;color:#111111;overflow:hidden;z-index:3}" +
    `.panel[hidden]{display:none}` +
    ".panel .head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #eaeaea;font-weight:600}" +
    ".panel .close{border:none;background:none;color:#5f5e5b;font:inherit;cursor:pointer;padding:0 2px}" +
    ".panel .close-icon{display:inline-flex;width:14px;height:14px;align-items:center;justify-content:center}" +
    ".panel .close-icon svg{display:block;width:14px;height:14px;fill:currentColor}" +
    ".panel .list{overflow-y:auto;padding:6px}" +
    ".panel .empty{margin:0;padding:10px 9px;color:#5f5e5b}" +
    ".panel .row{display:flex;align-items:flex-start;gap:8px;padding:7px 9px;margin-bottom:6px;border-left:3px solid #956400;border-radius:0 6px 6px 0;background:#fbf3db}" +
    ".panel .row .text{flex:1;min-width:0}" +
    ".panel .row .message{margin:0 0 2px}" +
    ".panel .row .suggestion{margin:0;color:#5f5e5b;font-size:12px}" +
    ".panel .actions{flex:none;display:flex;flex-direction:column;gap:4px}" +
    ".panel .apply{border:1px solid #1f6c9f;border-radius:6px;background:#1f6c9f;color:#ffffff;font:inherit;font-weight:600;padding:4px 10px;cursor:pointer}" +
    ".panel .apply:hover{filter:brightness(1.08)}" +
    ".panel .dismiss{border:1px solid #d8d7d3;border-radius:6px;background:transparent;color:#111111;font:inherit;font-weight:500;padding:4px 10px;cursor:pointer}" +
    ".panel .dismiss:hover{background:#ebeae6}" +
    ".panel .dictionary{border:1px solid #d8d7d3;border-radius:6px;background:transparent;color:#5f5e5b;font:inherit;font-weight:500;padding:4px 10px;cursor:pointer;white-space:nowrap}" +
    ".panel .dictionary:hover{background:#ebeae6;color:#111111}" +
    ".panel .ai{border-top:1px solid #eaeaea;padding:8px;background:#efeee9}" +
    ".panel .ai-title{margin:0 0 5px;font-size:11px;font-weight:600;color:#5f5e5b}" +
    ".panel .ai-controls{display:flex;gap:5px}" +
    ".panel .ai select{min-width:0;flex:1;padding:5px 6px;border:1px solid #d8d7d3;border-radius:5px;background:#ffffff;color:#111111;font:12px/1.3 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif}" +
    ".panel .ai-run,.panel .ai-replace{border:1px solid #1f6c9f;border-radius:5px;background:#1f6c9f;color:#ffffff;font:600 12px/1.3 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;padding:5px 8px;cursor:pointer}" +
    ".panel .ai-run:disabled,.panel .ai-replace:disabled{opacity:.55;cursor:default}" +
    ".panel .ai-result{margin-top:6px;padding:6px;border-radius:5px;background:#ffffff;color:#111111;font-size:12px;white-space:pre-wrap;word-break:break-word;max-height:100px;overflow-y:auto}" +
    ".panel .list,.panel .ai-result{scrollbar-width:thin;scrollbar-color:#b9b7b0 transparent}" +
    ".panel .list::-webkit-scrollbar,.panel .ai-result::-webkit-scrollbar{width:6px;height:6px}" +
    ".panel .list::-webkit-scrollbar-track,.panel .ai-result::-webkit-scrollbar-track{background:transparent}" +
    ".panel .list::-webkit-scrollbar-thumb,.panel .ai-result::-webkit-scrollbar-thumb{background:#b9b7b0;border-radius:6px}" +
    ".panel .list::-webkit-scrollbar-thumb:hover,.panel .ai-result::-webkit-scrollbar-thumb:hover{background:#9f9d96}" +
    ".panel .ai-error{margin:6px 0 0;color:#9f2f2d;font-size:11px}" +
    `.tooltip{position:fixed;width:${TOOLTIP_WIDTH}px;box-sizing:border-box;padding:12px;` +
    "background:#ffffff;border:1px solid #eaeaea;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.04);" +
    "font:14px/1.45 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;color:#111111;z-index:4}" +
    `.tooltip[hidden]{display:none}` +
    ".tooltip .message{margin:0}" +
    ".tooltip .chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
    ".tooltip .chip{border:1px solid #eaeaea;border-radius:4px;background:#edf3ec;color:#346538;" +
    "font:12px/1.3 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;padding:4px 8px;cursor:pointer}" +
    ".tooltip .chip:hover{transform:scale(1.05)}" +
    ".tooltip .actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}" +
    ".tooltip .dismiss,.tooltip .dictionary{border:1px solid #eaeaea;border-radius:4px;background:transparent;color:#111111;" +
    "font:12px/1.3 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;padding:4px 8px;cursor:pointer}" +
    ".tooltip .dismiss:hover,.tooltip .dictionary:hover{background:#f3f2ef}" +
    ".tooltip .none{margin:8px 0 0;font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
    "text-transform:uppercase;letter-spacing:0.08em;color:#5f5e5b}";

  let state = null; // { field, matches, onApply, host, root, badgeEl, panelEl, tooltipEl, panelOpen, ... }
  let tooltipPinned = false;
  let tooltipOutsideBound = false;
  let tooltipHideTimer = null;
  let fieldTooltipHideTimer = null;

  function cancelTooltipHideTimer() {
    if (tooltipHideTimer) {
      clearTimeout(tooltipHideTimer);
      tooltipHideTimer = null;
    }
  }

  function cancelFieldTooltipHideTimer() {
    if (fieldTooltipHideTimer) {
      clearTimeout(fieldTooltipHideTimer);
      fieldTooltipHideTimer = null;
    }
  }

  function scheduleHideMatchTooltip() {
    if (tooltipPinned) return;
    cancelTooltipHideTimer();
    tooltipHideTimer = setTimeout(() => {
      tooltipHideTimer = null;
      hideMatchTooltip();
    }, TOOLTIP_HIDE_DELAY_MS);
  }

  function scheduleHideFieldMatchTooltip(field) {
    const target = field ? fieldStates.get(field) : fieldTooltipState;
    if (!target || target.tooltipPinned) return;
    cancelFieldTooltipHideTimer();
    fieldTooltipHideTimer = setTimeout(() => {
      fieldTooltipHideTimer = null;
      fieldHideMatchTooltip(target);
    }, TOOLTIP_HIDE_DELAY_MS);
  }

  function bindTooltipHoverHandlers(tip, { isPinned, scheduleHide, cancelHide }) {
    tip.onmouseenter = () => {
      cancelHide();
    };
    tip.onmouseleave = () => {
      if (!isPinned()) scheduleHide();
    };
  }

  function onTooltipOutside(event) {
    if (!state || !tooltipPinned || !state.tooltipEl || state.tooltipEl.hidden) {
      return;
    }
    const path = typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(state.tooltipEl) || path.includes(state.badgeEl)) return;
    if (path.includes(state.host)) {
      const tip = state.tooltipEl;
      if (tip.contains(event.target)) return;
    }
    for (const node of path) {
      if (node === state.tooltipEl) return;
    }
    hideMatchTooltip();
  }

  function bindTooltipOutside() {
    if (tooltipOutsideBound) return;
    document.addEventListener("mousedown", onTooltipOutside, true);
    tooltipOutsideBound = true;
  }

  function unbindTooltipOutside() {
    if (!tooltipOutsideBound) return;
    document.removeEventListener("mousedown", onTooltipOutside, true);
    tooltipOutsideBound = false;
  }

  function ensureHost() {
    if (state) return { host: state.host, root: state.root };
    const host = document.createElement("div");
    host.style.position = "relative";
    host.style.zIndex = "2147483646";
    const root = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    root.appendChild(style);
    document.documentElement.appendChild(host);
    return { host, root };
  }

  function fieldInViewport(field) {
    const rect = field.getBoundingClientRect();
    return (
      rect.bottom > 0 &&
      rect.top < window.innerHeight &&
      rect.right > 0 &&
      rect.left < window.innerWidth
    );
  }

  function badgePosition(field) {
    const rect = field.getBoundingClientRect();
    const visibleRight = Math.min(rect.right, window.innerWidth - 8);
    const visibleBottom = Math.min(rect.bottom, window.innerHeight - 8);
    const visibleTop = Math.max(rect.top, 8);
    return {
      left: Math.max(8, visibleRight - BADGE_SIZE),
      top: Math.max(visibleTop, visibleBottom - BADGE_SIZE),
    };
  }

  // Place the panel next to the badge. Prefer above the badge.
  function panelPosition(badge, panelHeight, fieldRect) {
    const height = Math.min(
      panelHeight || PANEL_MAX_HEIGHT,
      PANEL_MAX_HEIGHT,
    );
    let left = badge.left + BADGE_SIZE - PANEL_WIDTH;
    left = Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH - 8));

    let top = badge.top - PANEL_GAP - height;
    let bottom = window.innerHeight - badge.top + PANEL_GAP;
    if (top < 8) {
      top = badge.top + BADGE_SIZE + PANEL_GAP;
      bottom = null;
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, window.innerHeight - 8 - height);
      }
    }

    // For short fields, move the panel so it does not cover the text.
    if (fieldRect && fieldRect.height < PANEL_MAX_HEIGHT) {
      const overlapsField =
        top < fieldRect.bottom && top + height > fieldRect.top;
      if (overlapsField) {
        const aboveField = fieldRect.top - PANEL_GAP - height;
        if (aboveField >= 8) {
          top = aboveField;
          bottom = window.innerHeight - fieldRect.top + PANEL_GAP;
        } else {
          const rightOfField = fieldRect.right + PANEL_GAP;
          const leftOfField = fieldRect.left - PANEL_GAP - PANEL_WIDTH;
          if (rightOfField + PANEL_WIDTH <= window.innerWidth - 8) {
            left = rightOfField;
            bottom = null;
          } else if (leftOfField >= 8) {
            left = leftOfField;
            bottom = null;
          }
        }
      }
    }
    return { left, top, bottom };
  }

  function tooltipPosition(anchorRect) {
    let left = anchorRect.left;
    left = Math.max(8, Math.min(left, window.innerWidth - TOOLTIP_WIDTH - 8));
    let top = anchorRect.bottom + 6;
    if (top + 120 > window.innerHeight - 8) {
      top = Math.max(8, anchorRect.top - 6 - 80);
    }
    return { left, top };
  }

  function position() {
    if (!state) return;
    if (!fieldInViewport(state.field)) {
      state.badgeEl.style.display = "none";
      state.panelEl.hidden = true;
      hideMatchTooltip();
      return;
    }
    state.badgeEl.style.display = "flex";
    const badge = badgePosition(state.field);
    state.badgeEl.style.left = `${badge.left}px`;
    state.badgeEl.style.top = `${badge.top}px`;
    if (state.panelOpen) {
      state.panelEl.style.maxHeight = `${Math.max(
        80,
        Math.min(PANEL_MAX_HEIGHT, window.innerHeight - 16),
      )}px`;
      state.panelEl.hidden = false;
      const panel = panelPosition(
        badge,
        state.panelEl.offsetHeight,
        state.field.getBoundingClientRect(),
      );
      state.panelEl.style.left = `${panel.left}px`;
      if (Number.isFinite(panel.bottom)) {
        state.panelEl.style.top = "auto";
        state.panelEl.style.bottom = `${panel.bottom}px`;
      } else {
        state.panelEl.style.bottom = "auto";
        state.panelEl.style.top = `${panel.top}px`;
      }
    }
  }

  function bindReposition() {
    window.addEventListener("scroll", position, { capture: true, passive: true });
    window.addEventListener("resize", position, { passive: true });
  }

  function unbindReposition() {
    window.removeEventListener("scroll", position, { capture: true });
    window.removeEventListener("resize", position);
  }

  function updateBadge() {
    if (state.checking) {
      state.badgeEl.classList.remove("clean", "offline");
      state.badgeEl.textContent = "…";
      state.badgeEl.title = "Checking…";
      return;
    }
    if (state.offline) {
      state.badgeEl.classList.remove("clean");
      state.badgeEl.classList.add("offline");
      state.badgeEl.textContent = "!";
      state.badgeEl.title = "Lexicon isn't running — open Lexicon to check";
      return;
    }
    state.badgeEl.classList.remove("offline");
    const count = state.matches.length;
    const clean = count === 0;
    state.badgeEl.classList.toggle("clean", clean);
    if (clean) state.badgeEl.replaceChildren(checkIcon());
    else state.badgeEl.textContent = String(count);
    state.badgeEl.title = clean
      ? "No issues found — click to review, hover for Tone"
      : "Lexicon issues — click to review, hover for Tone";
  }

  function renderPanel() {
    const panel = state.panelEl;
    panel.replaceChildren();

    const head = document.createElement("div");
    head.className = "head";
    const title = document.createElement("span");
    title.textContent = state.checking
      ? "Checking…"
      : state.offline
        ? "Lexicon isn't running"
        : state.matches.length === 0
          ? "No issues found"
          : `${state.matches.length} ` +
            `${state.matches.length === 1 ? "issue" : "issues"} found`;
    const close = document.createElement("button");
    close.className = "close";
    close.appendChild(closeIcon());
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => {
      state.panelOpen = false;
      state.panelEl.hidden = true;
    });
    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    const list = document.createElement("div");
    list.className = "list";
    if (state.checking) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Checking…";
      list.appendChild(empty);
    } else if (state.offline) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Open Lexicon to use grammar checking here.";
      list.appendChild(empty);
    } else if (state.matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No issues found.";
      list.appendChild(empty);
    } else {
      for (let i = 0; i < state.matches.length; i++) {
        const match = state.matches[i];
        const row = document.createElement("div");
        row.className = "row";

        const text = document.createElement("div");
        text.className = "text";
        const message = document.createElement("p");
        message.className = "message";
        message.textContent = match.message;
        const suggestion = document.createElement("p");
        suggestion.className = "suggestion";
        suggestion.textContent = match.replacements[0]
          ? `Suggestion: ${match.replacements[0]}`
          : "No automatic fix — you can dismiss this.";
        text.appendChild(message);
        text.appendChild(suggestion);

        row.appendChild(text);
        const actions = document.createElement("div");
        actions.className = "actions";
        if (match.replacements[0]) {
          const apply = document.createElement("button");
          apply.className = "apply";
          apply.textContent = "Apply";
          apply.addEventListener("click", () => state.onApply(i));
          actions.appendChild(apply);
        }
        const dismiss = document.createElement("button");
        dismiss.className = "dismiss";
        dismiss.textContent = "Dismiss";
        dismiss.addEventListener("click", () => {
          if (typeof state.onDismiss === "function") state.onDismiss(i);
        });
        actions.appendChild(dismiss);
        const dictionary = document.createElement("button");
        dictionary.className = "dictionary";
        dictionary.type = "button";
        dictionary.textContent = "Add to Dictionary";
        dictionary.addEventListener("click", async () => {
          dictionary.disabled = true;
          const result = await Promise.resolve(
            state.onAddToDictionary(match),
          ).catch(() => false);
          if (result === false) dictionary.disabled = false;
        });
        actions.appendChild(dictionary);
        row.appendChild(actions);
        list.appendChild(row);
      }
    }
    panel.appendChild(list);
  }

  function openPanel() {
    hideMatchTooltip();
    state.panelOpen = true;
    state.panelEl.hidden = false;
    position();
  }

  function togglePanel() {
    if (state.panelOpen) {
      state.panelOpen = false;
      state.panelEl.hidden = true;
    } else {
      openPanel();
    }
  }

  function hideMatchTooltip() {
    cancelTooltipHideTimer();
    tooltipPinned = false;
    unbindTooltipOutside();
    if (!state || !state.tooltipEl) return;
    state.tooltipEl.hidden = true;
    state.tooltipEl.replaceChildren();
    state.tooltipMatch = null;
  }

  function showMatchTooltip(match, rect, options) {
    if (!state || !match || !rect) return;
    const opts = options || {};
    const pinned = Boolean(opts.pinned);
    if (
      state.tooltipMatch === match &&
      !state.tooltipEl.hidden &&
      tooltipPinned &&
      !pinned
    ) {
      return;
    }
    cancelTooltipHideTimer();
    tooltipPinned = pinned;
    state.tooltipMatch = match;

    const tip = state.tooltipEl;
    tip.replaceChildren();
    tip.hidden = false;

    const message = document.createElement("p");
    message.className = "message";
    message.textContent = match.message || "Issue found.";
    tip.appendChild(message);

    const replacements = (match.replacements || []).slice(0, 4);
    if (replacements.length > 0) {
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const replacement of replacements) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = replacement;
        chip.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          hideMatchTooltip();
          if (typeof opts.onApply === "function") opts.onApply(replacement);
          else if (typeof state.onApplyReplacement === "function") {
            state.onApplyReplacement(match, replacement);
          }
        });
        chips.appendChild(chip);
      }
      tip.appendChild(chips);
    } else {
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "No automatic fix available";
      tip.appendChild(none);
    }

    const tipActions = document.createElement("div");
    tipActions.className = "actions";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "dismiss";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideMatchTooltip();
      if (typeof opts.onDismiss === "function") opts.onDismiss();
      else if (typeof state.onDismissMatch === "function") {
        state.onDismissMatch(match);
      }
    });
    tipActions.appendChild(dismiss);
    if (typeof opts.onAddToDictionary === "function") {
      const dictionary = document.createElement("button");
      dictionary.type = "button";
      dictionary.className = "dictionary";
      dictionary.textContent = "Add to Dictionary";
      dictionary.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dictionary.disabled = true;
        const result = await Promise.resolve(
          opts.onAddToDictionary(match),
        ).catch(() => false);
        if (result === false) dictionary.disabled = false;
        else hideMatchTooltip();
      });
      tipActions.appendChild(dictionary);
    }
    tip.appendChild(tipActions);

    bindTooltipHoverHandlers(tip, {
      isPinned: () => tooltipPinned,
      scheduleHide: scheduleHideMatchTooltip,
      cancelHide: cancelTooltipHideTimer,
    });

    const pos = tooltipPosition(rect);
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;

    if (pinned) bindTooltipOutside();
    else unbindTooltipOutside();
  }

  function show(field, matches, options) {
    const opts = options || {};
    const keepOpen = Boolean(state && state.field === field && state.panelOpen);
    hide();
    const { host, root } = ensureHost();
    state = {
      field,
      matches: matches || [],
      checking: Boolean(opts.checking),
      offline: Boolean(opts.offline),
      onApply: opts.onApply || (() => {}),
      onDismiss: opts.onDismiss || (() => {}),
      onApplyReplacement: opts.onApplyReplacement || null,
      onDismissMatch: opts.onDismissMatch || null,
      onAddToDictionary: opts.onAddToDictionary || (() => false),
      host,
      root,
      panelOpen: keepOpen,
      tooltipMatch: null,
    };

    const badge = document.createElement("div");
    badge.className = "badge";
    badge.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      togglePanel();
    });
    root.appendChild(badge);
    state.badgeEl = badge;

    const panel = document.createElement("div");
    panel.className = "panel";
    panel.hidden = !keepOpen;
    root.appendChild(panel);
    state.panelEl = panel;

    const tooltip = document.createElement("div");
    tooltip.className = "tooltip";
    tooltip.hidden = true;
    root.appendChild(tooltip);
    state.tooltipEl = tooltip;

    updateBadge();
    renderPanel();
    bindReposition();
    position();
  }

  function update(matches) {
    if (!state) return;
    state.matches = matches || [];
    state.checking = false;
    hideMatchTooltip();
    updateBadge();
    renderPanel();
    position();
  }

  function setChecking() {
    if (!state) return;
    state.checking = true;
    state.matches = [];
    hideMatchTooltip();
    updateBadge();
    renderPanel();
    position();
  }

  function hide() {
    unbindReposition();
    hideMatchTooltip();
    unbindTooltipOutside();
    if (state) {
      state.host.remove();
      state = null;
    }
  }

  const fieldStates = new Map();
  let fieldHost = null;
  let fieldRoot = null;
  let fieldRepositionBound = false;
  let fieldTooltipState = null;
  let fieldTooltipOutsideBound = false;

  function ensureFieldHost() {
    if (fieldHost) return;
    fieldHost = document.createElement("div");
    fieldHost.style.position = "relative";
    fieldHost.style.zIndex = "2147483646";
    fieldRoot = fieldHost.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = STYLE;
    fieldRoot.appendChild(style);
    document.documentElement.appendChild(fieldHost);
  }

  function fieldPosition(state) {
    if (!state) return;
    if (!fieldInViewport(state.field)) {
      state.badgeGroupEl.style.display = "none";
      state.badgeEl.style.display = "none";
      state.panelEl.hidden = true;
      state.aiPanelEl.hidden = true;
      if (fieldTooltipState === state) fieldHideMatchTooltip(state);
      return;
    }
    state.badgeGroupEl.style.display = "block";
    state.badgeEl.style.display = "flex";
    const badge = badgePosition(state.field);
    state.badgeGroupEl.style.left = `${badge.left}px`;
    state.badgeGroupEl.style.top = `${badge.top}px`;
    state.badgeEl.style.left = `${badge.left}px`;
    state.badgeEl.style.top = `${badge.top}px`;
    const triggerOnLeft =
      badge.left - AI_TRIGGER_WIDTH - AI_TRIGGER_GAP >= 8;
    state.aiTriggerEl.style.left = triggerOnLeft
      ? `-${AI_TRIGGER_WIDTH + AI_TRIGGER_GAP}px`
      : `${BADGE_SIZE + AI_TRIGGER_GAP}px`;
    state.aiTriggerEl.style.right = "auto";
    const fieldRect = state.field.getBoundingClientRect();
    if (state.panelOpen) {
      fieldPositionPanel(state.panelEl, badge, fieldRect);
    } else {
      state.panelEl.hidden = true;
    }
    if (state.aiPanelOpen) {
      fieldPositionPanel(state.aiPanelEl, badge, fieldRect);
    } else {
      state.aiPanelEl.hidden = true;
    }
  }

  function fieldPositionPanel(panel, badge, fieldRect) {
    panel.style.maxHeight = `${Math.max(
      80,
      Math.min(PANEL_MAX_HEIGHT, window.innerHeight - 16),
    )}px`;
    panel.hidden = false;
    const position = panelPosition(badge, panel.offsetHeight, fieldRect);
    panel.style.left = `${position.left}px`;
    if (Number.isFinite(position.bottom)) {
      panel.style.top = "auto";
      panel.style.bottom = `${position.bottom}px`;
    } else {
      panel.style.bottom = "auto";
      panel.style.top = `${position.top}px`;
    }
  }

  function positionFields() {
    for (const state of fieldStates.values()) fieldPosition(state);
  }

  function bindFieldReposition(state) {
    if (!fieldRepositionBound) {
      window.addEventListener("scroll", positionFields, {
        capture: true,
        passive: true,
      });
      window.addEventListener("resize", positionFields);
      fieldRepositionBound = true;
    }
    if (state.field.tagName === "TEXTAREA" && !state.scrollHandler) {
      state.scrollHandler = positionFields;
      state.field.addEventListener("scroll", state.scrollHandler, {
        passive: true,
      });
    }
  }

  function unbindFieldReposition(state) {
    if (state && state.scrollHandler) {
      state.field.removeEventListener("scroll", state.scrollHandler);
      state.scrollHandler = null;
    }
    if (fieldStates.size > 0 || !fieldRepositionBound) return;
    window.removeEventListener("scroll", positionFields, { capture: true });
    window.removeEventListener("resize", positionFields);
    fieldRepositionBound = false;
  }

  function fieldUpdateBadge(state) {
    if (state.checking) {
      state.badgeEl.classList.remove("clean", "offline");
      state.badgeEl.textContent = "…";
      state.badgeEl.title = "Checking…";
      return;
    }
    if (state.offline) {
      state.badgeEl.classList.remove("clean");
      state.badgeEl.classList.add("offline");
      state.badgeEl.textContent = "!";
      state.badgeEl.title = "Lexicon isn't running — open Lexicon to check";
      return;
    }
    state.badgeEl.classList.remove("offline");
    const count = state.matches.length;
    const clean = count === 0;
    state.badgeEl.classList.toggle("clean", clean);
    if (clean) state.badgeEl.replaceChildren(checkIcon());
    else state.badgeEl.textContent = String(count);
    state.badgeEl.title = clean
      ? "No issues found — click to review, hover for Tone"
      : "Lexicon issues — click to review, hover for Tone";
  }

  function fieldRenderPanel(state) {
    const panel = state.panelEl;
    panel.replaceChildren();

    const head = document.createElement("div");
    head.className = "head";
    const title = document.createElement("span");
    title.textContent = state.checking
      ? "Checking…"
      : state.offline
        ? "Lexicon isn't running"
        : state.matches.length === 0
          ? "No issues found"
          : `${state.matches.length} ` +
            `${state.matches.length === 1 ? "issue" : "issues"} found`;
    const close = document.createElement("button");
    close.className = "close";
    close.appendChild(closeIcon());
    close.setAttribute("aria-label", "Close");
    close.addEventListener("click", () => {
      state.panelOpen = false;
      state.panelEl.hidden = true;
    });
    head.appendChild(title);
    head.appendChild(close);
    panel.appendChild(head);

    const list = document.createElement("div");
    list.className = "list";
    if (state.checking) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Checking…";
      list.appendChild(empty);
    } else if (state.offline) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Open Lexicon to use grammar checking here.";
      list.appendChild(empty);
    } else if (state.matches.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "No issues found.";
      list.appendChild(empty);
    } else {
      for (let i = 0; i < state.matches.length; i++) {
        const match = state.matches[i];
        const row = document.createElement("div");
        row.className = "row";

        const text = document.createElement("div");
        text.className = "text";
        const message = document.createElement("p");
        message.className = "message";
        message.textContent = match.message;
        const suggestion = document.createElement("p");
        suggestion.className = "suggestion";
        suggestion.textContent = match.replacements[0]
          ? `Suggestion: ${match.replacements[0]}`
          : "No automatic fix — you can dismiss this.";
        text.appendChild(message);
        text.appendChild(suggestion);
        row.appendChild(text);

        const actions = document.createElement("div");
        actions.className = "actions";
        if (match.replacements[0]) {
          const apply = document.createElement("button");
          apply.className = "apply";
          apply.textContent = "Apply";
          apply.addEventListener("click", () => state.onApply(i));
          actions.appendChild(apply);
        }
        const dismiss = document.createElement("button");
        dismiss.className = "dismiss";
        dismiss.textContent = "Dismiss";
        dismiss.addEventListener("click", () => state.onDismiss(i));
        actions.appendChild(dismiss);
        const dictionary = document.createElement("button");
        dictionary.className = "dictionary";
        dictionary.type = "button";
        dictionary.textContent = "Add to Dictionary";
        dictionary.addEventListener("click", async () => {
          dictionary.disabled = true;
          const result = await Promise.resolve(
            state.onAddToDictionary(match),
          ).catch(() => false);
          if (result === false) dictionary.disabled = false;
        });
        actions.appendChild(dictionary);
        row.appendChild(actions);
        list.appendChild(row);
      }
    }
    panel.appendChild(list);
  }

  function phosphorIcon(className, path) {
    const icon = document.createElement("span");
    icon.className = className;
    icon.setAttribute("aria-hidden", "true");
    icon.innerHTML = `<svg viewBox="0 0 256 256" focusable="false"><path d="${path}"></path></svg>`;
    return icon;
  }

  function checkIcon() {
    return phosphorIcon(
      "check-icon",
      "M232.49,80.49l-128,128a12,12,0,0,1-17,0l-56-56a12,12,0,1,1,17-17L96,183,215.51,63.51a12,12,0,0,1,17,17Z",
    );
  }

  function closeIcon() {
    return phosphorIcon(
      "close-icon",
      "M208.49,191.51a12,12,0,0,1-17,17L128,145,64.49,208.49a12,12,0,0,1-17-17L111,128,47.51,64.49a12,12,0,0,1,17-17L128,111l63.51-63.52a12,12,0,0,1,17,17L145,128Z",
    );
  }

  function magicWandIcon() {
    return phosphorIcon(
      "magic-icon",
      "M252,152a12,12,0,0,1-12,12H228v12a12,12,0,0,1-24,0V164H192a12,12,0,0,1,0-24h12V128a12,12,0,0,1,24,0v12h12A12,12,0,0,1,252,152ZM56,76H68V88a12,12,0,0,0,24,0V76h12a12,12,0,1,0,0-24H92V40a12,12,0,0,0-24,0V52H56a12,12,0,0,0,0,24ZM184,188h-4v-4a12,12,0,0,0-24,0v4h-4a12,12,0,0,0,0,24h4v4a12,12,0,0,0,24,0v-4h4a12,12,0,0,0,0-24ZM222.14,82.83,82.82,222.14a20,20,0,0,1-28.28,0L33.85,201.46a20,20,0,0,1,0-28.29L173.17,33.86a20,20,0,0,1,28.28,0l20.69,20.68A20,20,0,0,1,222.14,82.83ZM159,112,144,97,53.65,187.31l15,15Zm43.31-43.31-15-15L161,80l15,15Z",
    );
  }

  function fieldRenderAiPanel(state) {
    if (!state.aiPanelEl || typeof state.onTransform !== "function") return;
    const panel = state.aiPanelEl;
    panel.replaceChildren();

    const head = document.createElement("div");
    head.className = "head";
    const heading = document.createElement("span");
    heading.textContent = "Tone";
    head.appendChild(heading);
    const close = document.createElement("button");
    close.className = "close";
    close.type = "button";
    close.appendChild(closeIcon());
    close.setAttribute("aria-label", "Close Tone");
    close.addEventListener("click", () => {
      state.aiPanelOpen = false;
      panel.hidden = true;
    });
    head.appendChild(close);
    panel.appendChild(head);

    const ai = document.createElement("div");
    ai.className = "ai";

    const controls = document.createElement("div");
    controls.className = "ai-controls";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "AI tool");
    for (const tool of TONE_TOOLS) {
      const option = document.createElement("option");
      option.value = tool;
      option.textContent = tool;
      select.appendChild(option);
    }
    select.value = TONE_TOOLS.includes(state.aiTool)
      ? state.aiTool
      : "Friendly";
    select.addEventListener("change", () => {
      state.aiTool = select.value;
    });
    controls.appendChild(select);

    const run = document.createElement("button");
    run.className = "ai-run";
    run.type = "button";
    run.textContent = state.aiBusy ? "Working…" : "Run";
    run.disabled = Boolean(state.aiBusy || state.checking || state.offline);
    run.addEventListener("click", () => {
      const tool = select.value;
      state.aiTool = tool;
      state.aiBusy = true;
      state.aiError = "";
      fieldRenderAiPanel(state);
      fieldPosition(state);
      Promise.resolve()
        .then(() => state.onTransform(tool))
        .then((result) => {
          if (!result || result.ok === false) {
            state.aiError = result?.error || "AI tool failed.";
            state.aiResult = null;
            return;
          }
          const text = typeof result === "string" ? result : result.text;
          if (typeof text !== "string" || !text.trim()) {
            state.aiError = "AI tool returned no text.";
            state.aiResult = null;
            return;
          }
          state.aiResult = {
            text,
            sourceText: result.sourceText || "",
          };
        })
        .catch((error) => {
          state.aiError = error?.message || "AI tool failed.";
          state.aiResult = null;
        })
        .finally(() => {
          state.aiBusy = false;
          fieldRenderAiPanel(state);
          fieldPosition(state);
        });
    });
    controls.appendChild(run);
    ai.appendChild(controls);

    if (state.aiResult) {
      const result = document.createElement("div");
      result.className = "ai-result";
      result.textContent = state.aiResult.text;
      ai.appendChild(result);

      const replace = document.createElement("button");
      replace.className = "ai-replace";
      replace.type = "button";
      replace.textContent = "Replace field";
      replace.disabled = Boolean(state.aiBusy);
      replace.addEventListener("click", () => {
        const pending = state.aiResult;
        if (!pending) return;
        state.aiBusy = true;
        state.aiError = "";
        fieldRenderAiPanel(state);
        fieldPosition(state);
        Promise.resolve()
          .then(() =>
            state.onApplyTransform(pending.text, pending.sourceText),
          )
          .then((response) => {
            if (response === false || response?.ok === false) {
              state.aiError = response?.error || "The field changed.";
            } else {
              state.aiResult = null;
            }
          })
          .catch((error) => {
            state.aiError = error?.message || "The field could not be updated.";
          })
          .finally(() => {
            state.aiBusy = false;
            fieldRenderAiPanel(state);
            fieldPosition(state);
          });
      });
      ai.appendChild(replace);
    }

    if (state.aiError) {
      const error = document.createElement("p");
      error.className = "ai-error";
      error.textContent = state.aiError;
      ai.appendChild(error);
    }
    panel.appendChild(ai);
  }

  function fieldHideOtherPanels(selected) {
    for (const state of fieldStates.values()) {
      if (state === selected) continue;
      state.panelOpen = false;
      state.panelEl.hidden = true;
      state.aiPanelOpen = false;
      state.aiPanelEl.hidden = true;
    }
  }

  function fieldOpenPanel(state) {
    fieldHideOtherPanels(state);
    fieldHideMatchTooltip();
    state.aiPanelOpen = false;
    state.aiPanelEl.hidden = true;
    state.panelOpen = true;
    state.panelEl.hidden = false;
    fieldPosition(state);
  }

  function fieldOpenAiPanel(state) {
    fieldHideOtherPanels(state);
    fieldHideMatchTooltip();
    state.panelOpen = false;
    state.panelEl.hidden = true;
    state.aiPanelOpen = true;
    state.aiPanelEl.hidden = false;
    fieldRenderAiPanel(state);
    fieldPosition(state);
  }

  function fieldTogglePanel(state) {
    if (state.panelOpen) {
      state.panelOpen = false;
      state.panelEl.hidden = true;
    } else {
      fieldOpenPanel(state);
    }
  }

  function fieldToggleAiPanel(state) {
    if (state.aiPanelOpen) {
      state.aiPanelOpen = false;
      state.aiPanelEl.hidden = true;
    } else {
      fieldOpenAiPanel(state);
    }
  }

  function fieldOnTooltipOutside(event) {
    const state = fieldTooltipState;
    if (!state || !state.tooltipEl || state.tooltipEl.hidden) return;
    const path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    if (path.includes(state.tooltipEl) || path.includes(state.badgeEl)) return;
    if (path.includes(fieldHost)) {
      fieldHideMatchTooltip(state);
      return;
    }
    fieldHideMatchTooltip(state);
  }

  function fieldBindTooltipOutside() {
    if (fieldTooltipOutsideBound) return;
    document.addEventListener("mousedown", fieldOnTooltipOutside, true);
    fieldTooltipOutsideBound = true;
  }

  function fieldUnbindTooltipOutside() {
    if (!fieldTooltipOutsideBound) return;
    document.removeEventListener("mousedown", fieldOnTooltipOutside, true);
    fieldTooltipOutsideBound = false;
  }

  function fieldHideMatchTooltip(state) {
    const target = state || fieldTooltipState;
    if (!target) return;
    cancelFieldTooltipHideTimer();
    if (fieldTooltipState === target) fieldTooltipState = null;
    target.tooltipPinned = false;
    target.tooltipEl.hidden = true;
    target.tooltipEl.replaceChildren();
    target.tooltipMatch = null;
    if (!fieldTooltipState) fieldUnbindTooltipOutside();
  }

  function fieldShowMatchTooltip(field, match, rect, options) {
    const state = fieldStates.get(field);
    if (!state || !match || !rect) return;
    const opts = options || {};
    if (fieldTooltipState && fieldTooltipState !== state) {
      fieldHideMatchTooltip(fieldTooltipState);
    }
    const pinned = Boolean(opts.pinned);
    cancelFieldTooltipHideTimer();
    state.tooltipPinned = pinned;
    state.tooltipMatch = match;
    fieldTooltipState = state;

    const tip = state.tooltipEl;
    tip.replaceChildren();
    tip.hidden = false;

    const message = document.createElement("p");
    message.className = "message";
    message.textContent = match.message || "Issue found.";
    tip.appendChild(message);

    const replacements = (match.replacements || []).slice(0, 4);
    if (replacements.length > 0) {
      const chips = document.createElement("div");
      chips.className = "chips";
      for (const replacement of replacements) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip";
        chip.textContent = replacement;
        chip.addEventListener("click", (event) => {
          event.preventDefault();
          event.stopPropagation();
          fieldHideMatchTooltip(state);
          if (typeof opts.onApply === "function") opts.onApply(replacement);
          else if (typeof state.onApplyReplacement === "function") {
            state.onApplyReplacement(match, replacement);
          }
        });
        chips.appendChild(chip);
      }
      tip.appendChild(chips);
    } else {
      const none = document.createElement("p");
      none.className = "none";
      none.textContent = "No automatic fix available";
      tip.appendChild(none);
    }

    const tipActions = document.createElement("div");
    tipActions.className = "actions";
    const dismiss = document.createElement("button");
    dismiss.type = "button";
    dismiss.className = "dismiss";
    dismiss.textContent = "Dismiss";
    dismiss.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      fieldHideMatchTooltip(state);
      if (typeof opts.onDismiss === "function") opts.onDismiss();
      else if (typeof state.onDismissMatch === "function") {
        state.onDismissMatch(match);
      }
    });
    tipActions.appendChild(dismiss);
    if (typeof opts.onAddToDictionary === "function") {
      const dictionary = document.createElement("button");
      dictionary.type = "button";
      dictionary.className = "dictionary";
      dictionary.textContent = "Add to Dictionary";
      dictionary.addEventListener("click", async (event) => {
        event.preventDefault();
        event.stopPropagation();
        dictionary.disabled = true;
        const result = await Promise.resolve(
          opts.onAddToDictionary(match),
        ).catch(() => false);
        if (result === false) dictionary.disabled = false;
        else fieldHideMatchTooltip(state);
      });
      tipActions.appendChild(dictionary);
    }
    tip.appendChild(tipActions);

    bindTooltipHoverHandlers(tip, {
      isPinned: () => Boolean(state.tooltipPinned),
      scheduleHide: () => scheduleHideFieldMatchTooltip(field),
      cancelHide: cancelFieldTooltipHideTimer,
    });
    const pos = tooltipPosition(rect);
    tip.style.left = `${pos.left}px`;
    tip.style.top = `${pos.top}px`;
    if (pinned) fieldBindTooltipOutside();
    else fieldUnbindTooltipOutside();
  }

  function fieldShow(field, matches, options) {
    if (!field) return null;
    const opts = options || {};
    let state = fieldStates.get(field);
    const keepOpen = Boolean(state && state.panelOpen);
    const keepAiOpen = Boolean(state && state.aiPanelOpen);
    if (!state) {
      ensureFieldHost();
      state = {
        field,
        matches: matches || [],
        checking: Boolean(opts.checking),
        offline: Boolean(opts.offline),
        onApply: opts.onApply || (() => {}),
        onDismiss: opts.onDismiss || (() => {}),
        onApplyReplacement: opts.onApplyReplacement || null,
        onDismissMatch: opts.onDismissMatch || null,
        onAddToDictionary: opts.onAddToDictionary || (() => false),
        onTransform: opts.onTransform || null,
        onApplyTransform: opts.onApplyTransform || null,
        aiTool: "Friendly",
        aiBusy: false,
        aiResult: null,
        aiError: "",
        host: fieldHost,
        panelOpen: false,
        aiPanelOpen: false,
        tooltipMatch: null,
        scrollHandler: null,
      };
      fieldStates.set(field, state);

      const badgeGroup = document.createElement("div");
      badgeGroup.className = "badge-group";
      fieldRoot.appendChild(badgeGroup);
      state.badgeGroupEl = badgeGroup;

      const badge = document.createElement("div");
      badge.className = "badge";
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        fieldTogglePanel(state);
      });
      badgeGroup.appendChild(badge);
      state.badgeEl = badge;

      const aiTrigger = document.createElement("button");
      aiTrigger.className = "ai-trigger";
      aiTrigger.type = "button";
      aiTrigger.setAttribute("aria-label", "Open Tone actions");
      aiTrigger.appendChild(magicWandIcon());
      const toneLabel = document.createElement("span");
      toneLabel.textContent = "Tone";
      aiTrigger.appendChild(toneLabel);
      aiTrigger.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        fieldToggleAiPanel(state);
      });
      badgeGroup.appendChild(aiTrigger);
      state.aiTriggerEl = aiTrigger;

      const panel = document.createElement("div");
      panel.className = "panel";
      panel.hidden = true;
      fieldRoot.appendChild(panel);
      state.panelEl = panel;

      const aiPanel = document.createElement("div");
      aiPanel.className = "panel ai-panel";
      aiPanel.hidden = true;
      fieldRoot.appendChild(aiPanel);
      state.aiPanelEl = aiPanel;

      const tooltip = document.createElement("div");
      tooltip.className = "tooltip";
      tooltip.hidden = true;
      fieldRoot.appendChild(tooltip);
      state.tooltipEl = tooltip;
    } else {
      state.matches = matches || [];
      state.checking = Boolean(opts.checking);
      state.offline = Boolean(opts.offline);
      if (opts.onApply) state.onApply = opts.onApply;
      if (opts.onDismiss) state.onDismiss = opts.onDismiss;
      if (opts.onApplyReplacement) {
        state.onApplyReplacement = opts.onApplyReplacement;
      }
      if (opts.onDismissMatch) state.onDismissMatch = opts.onDismissMatch;
      if (opts.onAddToDictionary) {
        state.onAddToDictionary = opts.onAddToDictionary;
      }
      if (opts.onTransform) state.onTransform = opts.onTransform;
      if (opts.onApplyTransform) {
        state.onApplyTransform = opts.onApplyTransform;
      }
      state.panelOpen = keepOpen;
      state.aiPanelOpen = keepAiOpen;
    }
    fieldUpdateBadge(state);
    fieldRenderPanel(state);
    fieldRenderAiPanel(state);
    bindFieldReposition(state);
    fieldPosition(state);
    return state;
  }

  function fieldUpdate(field, matches, options) {
    const state = fieldStates.get(field);
    if (!state) return fieldShow(field, matches, options);
    const opts = options || {};
    state.matches = matches || [];
    state.checking = false;
    state.offline = Boolean(opts.offline);
    if (opts.onTransform) state.onTransform = opts.onTransform;
    if (opts.onApplyTransform) state.onApplyTransform = opts.onApplyTransform;
    fieldHideMatchTooltip(state);
    fieldUpdateBadge(state);
    fieldRenderPanel(state);
    fieldRenderAiPanel(state);
    fieldPosition(state);
    return state;
  }

  function fieldSetChecking(field) {
    const state = fieldStates.get(field);
    if (!state) return fieldShow(field, [], { checking: true });
    state.checking = true;
    state.offline = false;
    state.matches = [];
    fieldHideMatchTooltip(state);
    fieldUpdateBadge(state);
    fieldRenderPanel(state);
    fieldRenderAiPanel(state);
    fieldPosition(state);
    return state;
  }

  function fieldRemove(field) {
    const state = fieldStates.get(field);
    if (!state) return;
    fieldHideMatchTooltip(state);
    state.badgeGroupEl.remove();
    state.panelEl.remove();
    state.aiPanelEl.remove();
    state.tooltipEl.remove();
    fieldStates.delete(field);
    unbindFieldReposition(state);
    if (fieldStates.size === 0) {
      fieldUnbindTooltipOutside();
      if (fieldHost) fieldHost.remove();
      fieldHost = null;
      fieldRoot = null;
    }
  }

  function fieldHide(field) {
    if (field) {
      fieldRemove(field);
      return;
    }
    for (const current of [...fieldStates.keys()]) fieldRemove(current);
  }

  function isSuggestionUiFocus(event) {
    if (!fieldHost) return false;
    if (event && event.target === fieldHost) return true;
    const path =
      event && typeof event.composedPath === "function"
        ? event.composedPath()
        : [];
    return path.includes(fieldHost);
  }

  globalThis.__lexiconSuggestions = {
    show,
    update,
    setChecking,
    hide,
    showMatchTooltip,
    hideMatchTooltip,
    scheduleHideMatchTooltip,
    fieldInViewport,
    badgePosition,
    panelPosition,
    state: () => state,
    showField: fieldShow,
    updateField: fieldUpdate,
    setCheckingField: fieldSetChecking,
    hideField: fieldHide,
    showFieldMatchTooltip: fieldShowMatchTooltip,
    hideFieldMatchTooltip: fieldHideMatchTooltip,
    scheduleHideFieldMatchTooltip,
    fieldState: (field) => fieldStates.get(field) || null,
    fieldStates: () => [...fieldStates.values()],
    isSuggestionUiFocus,
  };
})();
