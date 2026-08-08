// Tests for the popup backend monitor.
// Run: node --test extension/tests/

import test from "node:test";
import assert from "node:assert/strict";

import { createBackendStatus } from "../shared/backendStatus.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test("reports connected when the ping succeeds", async () => {
  const seen = [];
  const monitor = createBackendStatus({
    ping: async () => true,
    onChange: (state) => seen.push(state),
  });
  monitor.start();
  await sleep(20);
  assert.deepEqual(seen, ["connected"]);
  assert.equal(monitor.state, "connected");
});

test("reports offline and keeps polling until connected", async () => {
  let reachable = false;
  const seen = [];
  const monitor = createBackendStatus({
    ping: async () => reachable,
    intervalMs: 5,
    onChange: (state) => seen.push(state),
  });
  monitor.start();
  await sleep(15);
  assert.equal(monitor.state, "offline");
  reachable = true;
  await sleep(15);
  assert.equal(monitor.state, "connected");
  assert.deepEqual(seen, ["offline", "connected"]);
});

test("does not repeat the same state", async () => {
  const seen = [];
  const monitor = createBackendStatus({
    ping: async () => true,
    onChange: (state) => seen.push(state),
  });
  monitor.start();
  monitor.start();
  await sleep(20);
  assert.deepEqual(seen, ["connected"]);
});

test("stop ends polling", async () => {
  const seen = [];
  const monitor = createBackendStatus({
    ping: async () => false,
    intervalMs: 5,
    onChange: (state) => seen.push(state),
  });
  monitor.start();
  await sleep(10);
  monitor.stop();
  await sleep(30);
  assert.deepEqual(seen, ["offline"]);
  assert.equal(monitor.state, "offline");
});
