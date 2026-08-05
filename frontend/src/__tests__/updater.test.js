// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const invokeMock = vi.fn();
const relaunchMock = vi.fn().mockResolvedValue(undefined);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args) => invokeMock(...args),
  Channel: class {
    constructor() {
      this.onmessage = null;
    }
  },
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args) => relaunchMock(...args),
}));

import {
  updaterIsAvailable,
  checkForUpdate,
  installUpdate,
} from "../updater.js";

beforeEach(() => {
  invokeMock.mockReset();
  invokeMock.mockResolvedValue(null);
  relaunchMock.mockClear();
  window.__TAURI_INTERNALS__ = {};
  vi.stubEnv("DEV", false);
  vi.stubEnv("PROD", true);
});

afterEach(() => {
  delete window.__TAURI_INTERNALS__;
  vi.unstubAllEnvs();
});

describe("updaterIsAvailable", () => {
  it("is false without the Tauri runtime", () => {
    delete window.__TAURI_INTERNALS__;
    expect(updaterIsAvailable()).toBe(false);
  });

  it("is false in dev mode even with the Tauri runtime", () => {
    vi.stubEnv("DEV", true);
    expect(updaterIsAvailable()).toBe(false);
  });

  it("is true in production with the Tauri runtime", () => {
    expect(updaterIsAvailable()).toBe(true);
  });
});

describe("checkForUpdate", () => {
  it("returns null outside the Tauri runtime without invoking", async () => {
    delete window.__TAURI_INTERNALS__;
    expect(await checkForUpdate()).toBe(null);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("checks the stable channel by default", async () => {
    invokeMock.mockResolvedValue(null);
    expect(await checkForUpdate()).toBe(null);
    expect(invokeMock).toHaveBeenCalledWith("fetch_update", { beta: false });
  });

  it("checks the beta channel when opted in", async () => {
    invokeMock.mockResolvedValue({ version: "0.9.1-beta.1" });
    const update = await checkForUpdate({ beta: true });
    expect(update).toEqual({ version: "0.9.1-beta.1" });
    expect(invokeMock).toHaveBeenCalledWith("fetch_update", { beta: true });
  });
});

describe("installUpdate", () => {
  it("streams download, preparing, and installing progress then relaunches", async () => {
    const progress = vi.fn();
    invokeMock.mockImplementation(async (cmd, args) => {
      if (cmd === "install_update") {
        const channel = args.onEvent;
        channel.onmessage({ event: "Started", data: { contentLength: 100 } });
        channel.onmessage({ event: "Progress", data: { chunkLength: 40 } });
        channel.onmessage({ event: "Progress", data: { chunkLength: 60 } });
        channel.onmessage({ event: "Preparing" });
        channel.onmessage({ event: "Installing" });
      }
    });

    await installUpdate(null, progress);

    expect(invokeMock).toHaveBeenCalledWith(
      "install_update",
      expect.objectContaining({ onEvent: expect.anything() })
    );
    expect(progress).toHaveBeenCalledWith({
      phase: "downloading",
      downloaded: 0,
      total: 100,
    });
    expect(progress).toHaveBeenCalledWith({
      phase: "downloading",
      downloaded: 40,
      total: 100,
    });
    expect(progress).toHaveBeenCalledWith({
      phase: "downloading",
      downloaded: 100,
      total: 100,
    });
    expect(progress).toHaveBeenCalledWith({
      phase: "preparing",
      downloaded: 100,
      total: 100,
    });
    expect(progress).toHaveBeenCalledWith({
      phase: "installing",
      downloaded: 100,
      total: 100,
    });
    expect(relaunchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces errors from the Rust command", async () => {
    invokeMock.mockRejectedValue(new Error("install failed"));
    await expect(installUpdate(null, vi.fn())).rejects.toThrow(
      "install failed"
    );
    expect(relaunchMock).not.toHaveBeenCalled();
  });
});
