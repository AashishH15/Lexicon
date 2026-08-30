import test from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "..", "shared", "lexStatus.js"),
  "utf-8",
);

function loadStatus() {
  const sandbox = { globalThis: {} };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox.__lexiconLexStatus;
}

test("status resolver follows the shared precedence order", () => {
  const status = loadStatus();
  const { LEX_STATUS } = status;

  assert.equal(
    status.resolveLexStatus({
      error: "transform failed",
      offline: true,
      disabled: true,
      checking: true,
      matches: [{ message: "issue" }],
    }),
    LEX_STATUS.ERROR,
  );
  assert.equal(
    status.resolveLexStatus({ offline: true, disabled: true }),
    LEX_STATUS.NO_CONNECTION,
  );
  assert.equal(
    status.resolveLexStatus({ disabled: true, checking: true }),
    LEX_STATUS.DISABLED,
  );
});

test("status metadata points to every shipped personality icon", () => {
  const status = loadStatus();
  const names = Object.values(status.LEX_STATUS).map(
    (state) => status.metaFor(state).icon,
  );
  assert.deepEqual(names.sort(), [
    "lex-all-clear.svg",
    "lex-checking.svg",
    "lex-disabled.svg",
    "lex-error.svg",
    "lex-idle.svg",
    "lex-issues.svg",
    "lex-no-connection.svg",
  ]);
  assert.equal(
    status.messageFor(status.LEX_STATUS.CHECKING, { selected: true }),
    "I’m working on your selection…",
  );
});
