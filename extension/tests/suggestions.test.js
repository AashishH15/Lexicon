// Tests for suggestion overlay helpers.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "suggestions.js"),
  "utf-8",
);

function loadSuggestions(windowStub) {
  const sandbox = {
    document: {
      documentElement: { appendChild() {} },
      createElement() {
        return {
          style: {},
          attachShadow() {
            return {
              appendChild() {},
            };
          },
        };
      },
    },
    window: windowStub,
    globalThis: {},
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__lexiconSuggestions;
}

test("fieldInViewport is true when the field intersects the window", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 200,
      left: 50,
      right: 400,
    }),
  };
  assert.equal(api.fieldInViewport(field), true);
});

test("fieldInViewport is false when the field is fully below the window", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: 900,
      bottom: 1100,
      left: 50,
      right: 400,
    }),
  };
  assert.equal(api.fieldInViewport(field), false);
});

test("fieldInViewport is false when the field is fully above the window", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: -200,
      bottom: -40,
      left: 50,
      right: 400,
    }),
  };
  assert.equal(api.fieldInViewport(field), false);
});

test("badgePosition clamps to the visible part of a tall field", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const field = {
    getBoundingClientRect: () => ({
      top: 100,
      bottom: 2000,
      left: 50,
      right: 500,
    }),
  };
  const pos = api.badgePosition(field);
  assert.ok(pos.top <= 800 - 8);
  assert.ok(pos.top >= 100);
  assert.ok(pos.left <= 1000 - 8 - 26 || pos.left <= 500);
});

test("panelPosition opens above the badge and right-aligns to it", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const badge = { left: 700, top: 500 };
  const panel = api.panelPosition(badge, 200);
  assert.equal(panel.left, 700 + 26 - 320);
  assert.equal(panel.top, 500 - 8 - 200);
});

test("panelPosition flips below the badge when there is no room above", () => {
  const api = loadSuggestions({ innerWidth: 1000, innerHeight: 800 });
  const badge = { left: 700, top: 40 };
  const panel = api.panelPosition(badge, 200);
  assert.equal(panel.top, 40 + 26 + 8);
});
