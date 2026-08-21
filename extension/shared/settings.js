export const SETTINGS_STORAGE_KEY = "lexiconSettings";

export const DEFAULT_SETTINGS = Object.freeze({
  paused: false,
  disabledSites: [],
});

export function normalizeSite(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";
  try {
    const url = raw.includes("://")
      ? new URL(raw)
      : new URL(`https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return "";
  }
}

export function normalizeSettings(value) {
  const sites = Array.isArray(value?.disabledSites)
    ? value.disabledSites.map(normalizeSite).filter(Boolean)
    : [];
  return {
    paused: Boolean(value?.paused),
    disabledSites: [...new Set(sites)],
  };
}

export function isSiteDisabled(settings, site) {
  const normalizedSite = normalizeSite(site);
  return (
    Boolean(normalizedSite) &&
    normalizeSettings(settings).disabledSites.includes(normalizedSite)
  );
}
