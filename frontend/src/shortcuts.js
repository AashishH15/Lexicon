export const SHORTCUTS_STORAGE_KEY = "lexicon:shortcuts";

export const SHORTCUT_IDS = Object.freeze({
  OPEN_COMMAND_MENU: "open-command-menu",
  TRIGGER_PROOFREAD: "trigger-proofread",
  ACCEPT_SUGGESTION: "accept-suggestion",
  DISMISS_SUGGESTION: "dismiss-suggestion",
  TOGGLE_SETTINGS: "toggle-settings",
  CLOSE_SETTINGS: "close-settings",
  INLINE_MATH: "inline-math",
  BLOCK_MATH: "block-math",
  BOLD: "bold",
  ITALIC: "italic",
  UNDERLINE: "underline",
  STRIKETHROUGH: "strikethrough",
  HIGHLIGHT: "highlight",
  INLINE_CODE: "inline-code",
  ALIGN_LEFT: "align-left",
  ALIGN_CENTER: "align-center",
  ALIGN_RIGHT: "align-right",
  ALIGN_JUSTIFY: "align-justify",
  HEADING_1: "heading-1",
  HEADING_2: "heading-2",
  HEADING_3: "heading-3",
  HEADING_4: "heading-4",
  HEADING_5: "heading-5",
  HEADING_6: "heading-6",
  UNDO: "undo",
  REDO: "redo",
  INDENT_LIST_ITEM: "indent-list-item",
  OUTDENT_LIST_ITEM: "outdent-list-item",
});

export const SHORTCUT_DEFINITIONS = Object.freeze([
  {
    id: SHORTCUT_IDS.OPEN_COMMAND_MENU,
    action: "Open command menu",
    displayKeys: ["type /"],
    customizable: false,
    keywords: ["slash", "commands"],
  },
  {
    id: SHORTCUT_IDS.TRIGGER_PROOFREAD,
    action: "Trigger Proofread",
    defaultShortcut: ["Mod", "Enter"],
    customizable: true,
    keywords: ["scan", "check", "grammar"],
  },
  {
    id: SHORTCUT_IDS.ACCEPT_SUGGESTION,
    action: "Accept Suggestion",
    defaultShortcut: ["Mod", "Alt", "A"],
    customizable: true,
    keywords: ["apply", "replace", "correction"],
  },
  {
    id: SHORTCUT_IDS.DISMISS_SUGGESTION,
    action: "Dismiss Suggestion",
    defaultShortcut: ["Mod", "Alt", "D"],
    customizable: true,
    keywords: ["reject", "ignore", "remove"],
  },
  {
    id: SHORTCUT_IDS.TOGGLE_SETTINGS,
    action: "Toggle Settings",
    defaultShortcut: ["Mod", ","],
    customizable: true,
    keywords: ["preferences", "configuration"],
  },
  {
    id: SHORTCUT_IDS.CLOSE_SETTINGS,
    action: "Close Settings",
    defaultShortcut: ["Esc"],
    customizable: false,
    keywords: ["dismiss", "exit"],
  },
  {
    id: SHORTCUT_IDS.INLINE_MATH,
    action: "Inline math",
    displayKeys: ["type $your latex$"],
    customizable: false,
    keywords: ["equation", "latex"],
  },
  {
    id: SHORTCUT_IDS.BLOCK_MATH,
    action: "Block math",
    displayKeys: ["type $$$your latex$$$"],
    customizable: false,
    keywords: ["equation", "latex"],
  },
  {
    id: SHORTCUT_IDS.BOLD,
    action: "Bold",
    defaultShortcut: ["Mod", "B"],
    customizable: false,
    keywords: ["format", "strong"],
  },
  {
    id: SHORTCUT_IDS.ITALIC,
    action: "Italic",
    defaultShortcut: ["Mod", "I"],
    customizable: false,
    keywords: ["format", "emphasis"],
  },
  {
    id: SHORTCUT_IDS.UNDERLINE,
    action: "Underline",
    defaultShortcut: ["Mod", "U"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.STRIKETHROUGH,
    action: "Strikethrough",
    defaultShortcut: ["Mod", "Shift", "S"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.HIGHLIGHT,
    action: "Highlight",
    defaultShortcut: ["Mod", "Shift", "H"],
    customizable: false,
    keywords: ["format", "mark"],
  },
  {
    id: SHORTCUT_IDS.INLINE_CODE,
    action: "Inline code",
    defaultShortcut: ["Mod", "E"],
    customizable: false,
    keywords: ["format", "code"],
  },
  {
    id: SHORTCUT_IDS.ALIGN_LEFT,
    action: "Align left",
    defaultShortcut: ["Mod", "Shift", "L"],
    customizable: false,
    keywords: ["paragraph", "alignment"],
  },
  {
    id: SHORTCUT_IDS.ALIGN_CENTER,
    action: "Align center",
    defaultShortcut: ["Mod", "Shift", "E"],
    customizable: false,
    keywords: ["paragraph", "alignment"],
  },
  {
    id: SHORTCUT_IDS.ALIGN_RIGHT,
    action: "Align right",
    defaultShortcut: ["Mod", "Shift", "R"],
    customizable: false,
    keywords: ["paragraph", "alignment"],
  },
  {
    id: SHORTCUT_IDS.ALIGN_JUSTIFY,
    action: "Align justify",
    defaultShortcut: ["Mod", "Shift", "J"],
    customizable: false,
    keywords: ["paragraph", "alignment"],
  },
  {
    id: SHORTCUT_IDS.HEADING_1,
    action: "Heading 1",
    defaultShortcut: ["Mod", "Alt", "1"],
    customizable: false,
    keywords: ["title", "format"],
  },
  {
    id: SHORTCUT_IDS.HEADING_2,
    action: "Heading 2",
    defaultShortcut: ["Mod", "Alt", "2"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.HEADING_3,
    action: "Heading 3",
    defaultShortcut: ["Mod", "Alt", "3"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.HEADING_4,
    action: "Heading 4",
    defaultShortcut: ["Mod", "Alt", "4"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.HEADING_5,
    action: "Heading 5",
    defaultShortcut: ["Mod", "Alt", "5"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.HEADING_6,
    action: "Heading 6",
    defaultShortcut: ["Mod", "Alt", "6"],
    customizable: false,
    keywords: ["format"],
  },
  {
    id: SHORTCUT_IDS.UNDO,
    action: "Undo",
    defaultShortcut: ["Mod", "Z"],
    customizable: false,
    keywords: ["history", "edit"],
  },
  {
    id: SHORTCUT_IDS.REDO,
    action: "Redo",
    defaultShortcut: ["Mod", "Shift", "Z"],
    customizable: false,
    keywords: ["history", "edit"],
  },
  {
    id: SHORTCUT_IDS.INDENT_LIST_ITEM,
    action: "Indent list item",
    defaultShortcut: ["Tab"],
    customizable: false,
    keywords: ["list", "nest"],
  },
  {
    id: SHORTCUT_IDS.OUTDENT_LIST_ITEM,
    action: "Outdent list item",
    defaultShortcut: ["Shift", "Tab"],
    customizable: false,
    keywords: ["list", "nest"],
  },
]);

const CUSTOMIZABLE_DEFINITIONS = SHORTCUT_DEFINITIONS.filter(
  (definition) => definition.customizable,
);

const MODIFIER_ORDER = ["Mod", "Alt", "Shift"];
const MODIFIER_SET = new Set(MODIFIER_ORDER);

const KEY_ALIASES = Object.freeze({
  " ": "Space",
  Spacebar: "Space",
  Esc: "Esc",
  Escape: "Esc",
  Return: "Enter",
  Del: "Delete",
  Left: "ArrowLeft",
  Right: "ArrowRight",
  Up: "ArrowUp",
  Down: "ArrowDown",
});

const RESERVED_SHORTCUTS = [
  ["Mod", "A"],
  ["Mod", "B"],
  ["Mod", "C"],
  ["Mod", "E"],
  ["Mod", "F"],
  ["Mod", "I"],
  ["Mod", "L"],
  ["Mod", "N"],
  ["Mod", "O"],
  ["Mod", "P"],
  ["Mod", "R"],
  ["Mod", "S"],
  ["Mod", "T"],
  ["Mod", "U"],
  ["Mod", "V"],
  ["Mod", "W"],
  ["Mod", "X"],
  ["Mod", "Z"],
  ["Mod", "Shift", "Z"],
  ["Alt", "F4"],
];

function isStorageLike(value) {
  return (
    value &&
    typeof value.getItem === "function" &&
    typeof value.setItem === "function"
  );
}

function getDefaultStorage() {
  return typeof localStorage !== "undefined" ? localStorage : null;
}

function normalizeToken(token) {
  if (typeof token !== "string") return "";
  const trimmed = token.trim();
  if (!trimmed) return "";
  if (
    trimmed === "Ctrl" ||
    trimmed === "Control" ||
    trimmed === "Meta" ||
    trimmed === "Cmd" ||
    trimmed === "Command"
  ) {
    return "Mod";
  }
  if (trimmed === "Option") return "Alt";
  if (trimmed === "Shift") return "Shift";
  if (trimmed.length === 1) return trimmed.toUpperCase();
  return KEY_ALIASES[trimmed] || trimmed;
}

export function normalizeShortcut(shortcut) {
  if (!Array.isArray(shortcut)) return null;
  const tokens = shortcut.map(normalizeToken).filter(Boolean);
  const modifiers = MODIFIER_ORDER.filter((modifier) =>
    tokens.includes(modifier),
  );
  const keys = tokens.filter((token) => !MODIFIER_SET.has(token));
  if (keys.length !== 1) return null;
  return [...modifiers, keys[0]];
}

export function validateShortcut(shortcut, { requireModifier = true } = {}) {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) {
    return {
      valid: false,
      shortcut: null,
      error: "Use one non-modifier key, optionally with modifiers.",
    };
  }

  if (
    requireModifier &&
    !normalized.some((token) => MODIFIER_SET.has(token))
  ) {
    return {
      valid: false,
      shortcut: normalized,
      error: "Add Ctrl/⌘, Alt, or Shift so typing stays unaffected.",
    };
  }

  if (
    RESERVED_SHORTCUTS.some((reserved) =>
      shortcutsEqual(reserved, normalized),
    )
  ) {
    return {
      valid: false,
      shortcut: normalized,
      error: "That shortcut is reserved by the browser or operating system.",
    };
  }

  return { valid: true, shortcut: normalized, error: "" };
}

export function shortcutFromKeyboardEvent(event) {
  if (!event || isModifierKey(event.key)) return null;
  const key = normalizeEventKey(event);
  if (!key || isModifierKey(key)) return null;
  const modifiers = [];
  if (event.ctrlKey || event.metaKey) modifiers.push("Mod");
  if (event.altKey) modifiers.push("Alt");
  if (event.shiftKey) modifiers.push("Shift");
  return normalizeShortcut([...modifiers, key]);
}

export function normalizeEventKey(event) {
  if (!event) return "";
  const rawKey = event.key || event.code || "";
  if (rawKey === "Unidentified" && event.code) {
    return normalizeCode(event.code);
  }
  if (/^Key[A-Z]$/.test(event.code || "") && rawKey.length > 1) {
    return event.code.slice(3);
  }
  if (/^Digit[0-9]$/.test(event.code || "") && rawKey.length > 1) {
    return event.code.slice(5);
  }
  return normalizeToken(rawKey);
}

function normalizeCode(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^Numpad[0-9]$/.test(code)) return code.slice(6);
  return normalizeToken(code);
}

export function isModifierKey(key) {
  return [
    "Control",
    "Ctrl",
    "Meta",
    "Command",
    "Cmd",
    "Alt",
    "Option",
    "Shift",
  ].includes(key);
}

export function shortcutMatchesEvent(shortcut, event) {
  if (!event || event.repeat) return false;
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return false;
  const expectedKey = normalized[normalized.length - 1];
  if (normalizeEventKey(event) !== expectedKey) return false;
  const hasMod = normalized.includes("Mod");
  const hasAlt = normalized.includes("Alt");
  const hasShift = normalized.includes("Shift");
  return (
    hasMod === Boolean(event.ctrlKey || event.metaKey) &&
    hasAlt === Boolean(event.altKey) &&
    hasShift === Boolean(event.shiftKey)
  );
}

export function getDefaultShortcutBindings() {
  return Object.fromEntries(
    CUSTOMIZABLE_DEFINITIONS.map((definition) => [
      definition.id,
      [...definition.defaultShortcut],
    ]),
  );
}

export function shortcutBindingsAreDefault(bindings) {
  const defaults = getDefaultShortcutBindings();
  const normalized = getNormalizedBindings(bindings);
  return CUSTOMIZABLE_DEFINITIONS.every((definition) =>
    shortcutsEqual(normalized[definition.id], defaults[definition.id]),
  );
}

export function loadShortcutBindings(storage = getDefaultStorage()) {
  const defaults = getDefaultShortcutBindings();
  if (!isStorageLike(storage)) return defaults;

  let parsed;
  try {
    parsed = JSON.parse(storage.getItem(SHORTCUTS_STORAGE_KEY) || "null");
  } catch {
    return defaults;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return defaults;
  }

  const bindings = {};
  const used = new Set();
  for (const definition of CUSTOMIZABLE_DEFINITIONS) {
    const result = validateShortcut(parsed[definition.id]);
    const candidate = result.valid ? result.shortcut : null;
    const fallback = defaults[definition.id];
    const selected =
      candidate && !used.has(shortcutKey(candidate)) ? candidate : fallback;
    bindings[definition.id] = [...selected];
    used.add(shortcutKey(selected));
  }
  return bindings;
}

export function saveShortcutBindings(
  bindings,
  storage = getDefaultStorage(),
) {
  if (!isStorageLike(storage)) return;
  try {
    storage.setItem(
      SHORTCUTS_STORAGE_KEY,
      JSON.stringify(getNormalizedBindings(bindings)),
    );
  } catch {
    // Keep the in-memory setting if storage is unavailable.
  }
}

export function getNormalizedBindings(bindings = {}) {
  const defaults = getDefaultShortcutBindings();
  return Object.fromEntries(
    CUSTOMIZABLE_DEFINITIONS.map((definition) => {
      const result = validateShortcut(bindings[definition.id]);
      const candidate = result.valid ? result.shortcut : null;
      return [definition.id, [...(candidate || defaults[definition.id])]];
    }),
  );
}

export function findShortcutConflict(bindings, actionId, shortcut) {
  const normalized = normalizeShortcut(shortcut);
  if (!normalized) return null;
  const normalizedBindings = getNormalizedBindings(bindings);
  const conflict = CUSTOMIZABLE_DEFINITIONS.find(
    (definition) =>
      definition.id !== actionId &&
      shortcutsEqual(normalizedBindings[definition.id], normalized),
  );
  return conflict || null;
}

export function formatShortcutTokens(
  shortcut,
  { mac = isMacPlatform(), compact = false } = {},
) {
  return (shortcut || []).map((token) => {
    if (token === "Mod") return mac ? "⌘" : "Ctrl";
    if (token === "Alt") return mac ? "⌥" : "Alt";
    if (token === "Shift") return "Shift";
    if (token === "Enter") return compact ? "↵" : "Enter";
    return token;
  });
}

export function formatShortcut(shortcut, options) {
  return formatShortcutTokens(shortcut, options).join(" + ");
}

export function isMacPlatform(platform) {
  const value =
    platform ??
    (typeof navigator !== "undefined" ? navigator.platform : "");
  return /Mac|iPod|iPhone|iPad/.test(value);
}

export function shortcutsEqual(left, right) {
  const a = normalizeShortcut(left);
  const b = normalizeShortcut(right);
  return Boolean(
    a && b && a.length === b.length && a.every((v, i) => v === b[i]),
  );
}

function shortcutKey(shortcut) {
  return normalizeShortcut(shortcut)?.join("+") || "";
}
