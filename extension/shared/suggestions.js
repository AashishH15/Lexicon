// Suggestion badge and panel UI.

(function () {
  "use strict";

  const BADGE_SIZE = 26;
  const PANEL_WIDTH = 320;
  const PANEL_MAX_HEIGHT = 360;
  const PANEL_GAP = 8;
  const TOOLTIP_WIDTH = 288;

  const STYLE =
    `.badge{position:fixed;width:${BADGE_SIZE}px;height:${BADGE_SIZE}px;` +
    "border-radius:50%;background:#111111;color:#ffffff;font:600 12px/1 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;" +
    "display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.25);user-select:none;z-index:2}" +
    ".badge.clean{background:#346538}" +
    `.panel{position:fixed;width:${PANEL_WIDTH}px;max-height:${PANEL_MAX_HEIGHT}px;` +
    "display:flex;flex-direction:column;background:#f7f6f3;border:1px solid #d8d7d3;border-radius:8px;box-shadow:0 6px 24px rgba(0,0,0,0.18);" +
    "font:13px/1.45 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;color:#111111;overflow:hidden;z-index:3}" +
    `.panel[hidden]{display:none}` +
    ".panel .head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid #eaeaea;font-weight:600}" +
    ".panel .close{border:none;background:none;color:#5f5e5b;font:inherit;cursor:pointer;padding:0 2px}" +
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
    ".tooltip .dismiss{border:1px solid #eaeaea;border-radius:4px;background:transparent;color:#111111;" +
    "font:12px/1.3 -apple-system,BlinkMacSystemFont,\"Segoe UI\",Helvetica,Arial,sans-serif;padding:4px 8px;cursor:pointer}" +
    ".tooltip .dismiss:hover{background:#f3f2ef}" +
    ".tooltip .none{margin:8px 0 0;font:10px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;" +
    "text-transform:uppercase;letter-spacing:0.08em;color:#5f5e5b}";

  let state = null; // { field, matches, onApply, host, root, badgeEl, panelEl, tooltipEl, panelOpen, ... }
  let tooltipPinned = false;
  let tooltipOutsideBound = false;

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
      state.badgeEl.classList.remove("clean");
      state.badgeEl.textContent = "…";
      state.badgeEl.title = "Checking…";
      return;
    }
    const count = state.matches.length;
    const clean = count === 0;
    state.badgeEl.classList.toggle("clean", clean);
    state.badgeEl.textContent = clean ? "✓" : String(count);
    state.badgeEl.title = clean ? "No issues found" : "Lexicon issues";
  }

  function renderPanel() {
    const panel = state.panelEl;
    panel.replaceChildren();

    const head = document.createElement("div");
    head.className = "head";
    const title = document.createElement("span");
    title.textContent = state.checking
      ? "Checking…"
      : state.matches.length === 0
        ? "No issues found"
        : `${state.matches.length} ` +
          `${state.matches.length === 1 ? "issue" : "issues"} found`;
    const close = document.createElement("button");
    close.className = "close";
    close.textContent = "✕";
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
    tip.appendChild(tipActions);

    tip.onmouseleave = () => {
      if (!tooltipPinned) hideMatchTooltip();
    };

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
      onApply: opts.onApply || (() => {}),
      onDismiss: opts.onDismiss || (() => {}),
      onApplyReplacement: opts.onApplyReplacement || null,
      onDismissMatch: opts.onDismissMatch || null,
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

  globalThis.__lexiconSuggestions = {
    show,
    update,
    setChecking,
    hide,
    showMatchTooltip,
    hideMatchTooltip,
    fieldInViewport,
    badgePosition,
    panelPosition,
  };
})();
