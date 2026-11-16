// UI zoom (percent) applied to the whole app via CSS zoom on <html>, like the
// browser/VS Code zoom. Pure helpers live here so they can be unit tested.

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 300;
export const ZOOM_STEP = 10;
export const ZOOM_DEFAULT = 100;

export const uiZoomKey = "lexicon:uiZoom";

export function clampZoom(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return ZOOM_DEFAULT;
  const snapped = Math.round(n / ZOOM_STEP) * ZOOM_STEP;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, snapped));
}

export function loadUiZoom() {
  try {
    const saved = localStorage.getItem(uiZoomKey);
    return saved === null ? ZOOM_DEFAULT : clampZoom(saved);
  } catch {
    return ZOOM_DEFAULT;
  }
}

export function applyUiZoom(percent, root = document.documentElement) {
  root.style.zoom = percent === ZOOM_DEFAULT ? "" : String(percent / 100);
}

// Maps a keydown to a zoom action: "in", "out", "reset" or null.
export function zoomShortcutAction(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null;
  if (event.key === "+" || event.key === "=") return "in";
  if (event.key === "-" || event.key === "_") return "out";
  if (event.key === "0") return "reset";
  return null;
}

// Ctrl/Cmd + wheel: scrolling up zooms in, down zooms out.
export function zoomWheelAction(event) {
  if (!(event.ctrlKey || event.metaKey) || !event.deltaY) return null;
  return event.deltaY < 0 ? "in" : "out";
}
