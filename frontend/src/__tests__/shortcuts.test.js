import { describe, expect, it } from "vitest";
import {
  SHORTCUT_DEFINITIONS,
  SHORTCUT_IDS,
  findShortcutConflict,
  formatShortcut,
  getDefaultShortcutBindings,
  loadShortcutBindings,
  saveShortcutBindings,
  shortcutFromKeyboardEvent,
  shortcutBindingsHaveConflicts,
  shortcutMatchesEvent,
  validateShortcut,
  validateShortcutForDefinition,
} from "../shortcuts.js";

function makeStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

function makeKeyEvent(overrides = {}) {
  return {
    key: "Enter",
    code: "Enter",
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    ...overrides,
  };
}

describe("custom keyboard shortcuts", () => {
  it("matches the default shortcuts on Windows and macOS modifier keys", () => {
    const defaults = getDefaultShortcutBindings();
    const proofread = defaults[SHORTCUT_IDS.TRIGGER_PROOFREAD];

    expect(
      shortcutMatchesEvent(
        proofread,
        makeKeyEvent({ ctrlKey: true }),
      ),
    ).toBe(true);
    expect(
      shortcutMatchesEvent(
        proofread,
        makeKeyEvent({ metaKey: true }),
      ),
    ).toBe(true);
    expect(
      shortcutMatchesEvent(
        proofread,
        makeKeyEvent({ ctrlKey: true, shiftKey: true }),
      ),
    ).toBe(false);
  });

  it("normalizes a recorded platform modifier to Mod", () => {
    expect(
      shortcutFromKeyboardEvent(
        makeKeyEvent({
          key: "a",
          code: "KeyA",
          ctrlKey: true,
          altKey: true,
        }),
      ),
    ).toEqual(["Mod", "Alt", "A"]);
  });

  it("makes editor commands editable while keeping text triggers fixed", () => {
    const definitions = new Map(
      SHORTCUT_DEFINITIONS.map((definition) => [definition.id, definition]),
    );
    const defaults = getDefaultShortcutBindings();

    expect(defaults[SHORTCUT_IDS.BOLD]).toEqual(["Mod", "B"]);
    expect(defaults[SHORTCUT_IDS.CLOSE_SETTINGS]).toEqual(["Esc"]);
    expect(
      definitions.get(SHORTCUT_IDS.OPEN_COMMAND_MENU).customizable,
    ).toBe(false);
    expect(
      definitions.get(SHORTCUT_IDS.INLINE_MATH).customizable,
    ).toBe(false);
    expect(
      definitions.get(SHORTCUT_IDS.BOLD).customizable,
    ).toBe(true);
    expect(
      definitions.get(SHORTCUT_IDS.TRIGGER_PROOFREAD).scope,
    ).toBe("app");
    expect(definitions.get(SHORTCUT_IDS.BOLD).scope).toBe("editor");
    expect(
      SHORTCUT_DEFINITIONS.filter((definition) => !definition.customizable),
    ).toHaveLength(3);
    expect(
      validateShortcutForDefinition(
        definitions.get(SHORTCUT_IDS.CLOSE_SETTINGS),
        ["Esc"],
      ).valid,
    ).toBe(true);
    expect(
      validateShortcutForDefinition(
        definitions.get(SHORTCUT_IDS.INDENT_LIST_ITEM),
        ["Tab"],
      ).valid,
    ).toBe(true);
    expect(
      validateShortcutForDefinition(
        definitions.get(SHORTCUT_IDS.CLOSE_SETTINGS),
        ["A"],
      ).valid,
    ).toBe(false);
  });

  it("requires a modifier and blocks reserved browser shortcuts", () => {
    expect(validateShortcut(["A"]).valid).toBe(false);
    expect(validateShortcut(["Mod", "W"]).error).toContain("reserved");
    expect(validateShortcut(["Mod", "Shift", "P"]).valid).toBe(true);
  });

  it("rejects conflicts between editable commands", () => {
    const defaults = getDefaultShortcutBindings();
    const conflict = findShortcutConflict(
      defaults,
      SHORTCUT_IDS.TRIGGER_PROOFREAD,
      defaults[SHORTCUT_IDS.TOGGLE_SETTINGS],
    );
    expect(conflict?.id).toBe(SHORTCUT_IDS.TOGGLE_SETTINGS);
    expect(
      findShortcutConflict(
        defaults,
        SHORTCUT_IDS.TRIGGER_PROOFREAD,
        defaults[SHORTCUT_IDS.TRIGGER_PROOFREAD],
      ),
    ).toBe(null);
  });

  it("rejects duplicate bindings across Lexicon and editor commands", () => {
    const defaults = getDefaultShortcutBindings();
    const duplicate = {
      ...defaults,
      [SHORTCUT_IDS.BOLD]: [...defaults[SHORTCUT_IDS.ITALIC]],
    };
    const storage = makeStorage();
    storage.setItem(
      "lexicon:shortcuts",
      JSON.stringify(duplicate),
    );

    expect(shortcutBindingsHaveConflicts(defaults)).toBe(false);
    expect(shortcutBindingsHaveConflicts(duplicate)).toBe(true);
    expect(
      findShortcutConflict(
        defaults,
        SHORTCUT_IDS.BOLD,
        ["Ctrl", "I"],
      )?.id,
    ).toBe(SHORTCUT_IDS.ITALIC);
    expect(loadShortcutBindings(storage)).toEqual(defaults);
    expect(saveShortcutBindings(duplicate, storage)).toBe(false);
  });

  it("persists valid bindings and falls back for invalid stored values", () => {
    const storage = makeStorage();
    const defaults = getDefaultShortcutBindings();
    const customized = {
      ...defaults,
      [SHORTCUT_IDS.TRIGGER_PROOFREAD]: ["Mod", "Shift", "P"],
    };

    saveShortcutBindings(customized, storage);
    expect(loadShortcutBindings(storage)[SHORTCUT_IDS.TRIGGER_PROOFREAD]).toEqual([
      "Mod",
      "Shift",
      "P",
    ]);

    storage.setItem(
      "lexicon:shortcuts",
      JSON.stringify({
        ...customized,
        [SHORTCUT_IDS.TRIGGER_PROOFREAD]: ["A"],
      }),
    );
    expect(loadShortcutBindings(storage)[SHORTCUT_IDS.TRIGGER_PROOFREAD]).toEqual(
      defaults[SHORTCUT_IDS.TRIGGER_PROOFREAD],
    );
  });

  it("formats the same binding for platform-specific UI", () => {
    const shortcut = ["Mod", "Enter"];
    expect(formatShortcut(shortcut, { mac: false })).toBe("Ctrl + Enter");
    expect(formatShortcut(shortcut, { mac: true, compact: true })).toBe(
      "⌘ + ↵",
    );
  });
});
