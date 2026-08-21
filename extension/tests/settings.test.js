import test from "node:test";
import assert from "node:assert/strict";

import {
  isSiteDisabled,
  normalizeSettings,
  normalizeSite,
} from "../shared/settings.js";

test("normalizeSite stores host names without protocol or trailing dot", () => {
  assert.equal(normalizeSite("https://Example.com/path"), "example.com");
  assert.equal(normalizeSite("Example.com."), "example.com");
  assert.equal(normalizeSite("chrome://extensions"), "");
  assert.equal(normalizeSite(""), "");
});

test("normalizeSettings removes invalid and duplicate disabled sites", () => {
  assert.deepEqual(
    normalizeSettings({
      paused: 1,
      disabledSites: ["Example.com", "https://example.com/path", "", null],
    }),
    {
      paused: true,
      disabledSites: ["example.com"],
    },
  );
});

test("isSiteDisabled matches the normalized host name", () => {
  const settings = normalizeSettings({
    disabledSites: ["example.com"],
  });
  assert.equal(isSiteDisabled(settings, "https://EXAMPLE.com/form"), true);
  assert.equal(isSiteDisabled(settings, "other.example.com"), false);
});
