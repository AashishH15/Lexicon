import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/plugin-opener", () => ({ openUrl: vi.fn() }));

import {
  deleteModel,
  getAiStatus,
  invalidateAiStatus,
  setAiPreference,
} from "../api.js";

function okJson(data) {
  return { ok: true, status: 200, json: async () => data };
}

let fetchMock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  invalidateAiStatus();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("getAiStatus cache", () => {
  it("serves quick repeat callers from one probe", async () => {
    fetchMock.mockResolvedValue(okJson({ marker: "first" }));
    const first = await getAiStatus();
    const second = await getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("shares one request between concurrent callers", async () => {
    fetchMock.mockResolvedValue(okJson({ marker: "shared" }));
    const [first, second] = await Promise.all([
      getAiStatus(),
      getAiStatus(),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
  });

  it("keeps answers for a minute, then probes again", async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValue(okJson({ marker: "first" }));
    await getAiStatus();
    vi.advanceTimersByTime(30000);
    fetchMock.mockResolvedValue(okJson({ marker: "second" }));
    const cached = await getAiStatus();
    expect(cached.marker).toBe("first");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(31000);
    fetchMock.mockResolvedValue(okJson({ marker: "third" }));
    const fresh = await getAiStatus();
    expect(fresh.marker).toBe("third");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("reads live when force is set", async () => {
    fetchMock.mockResolvedValue(okJson({ marker: "first" }));
    await getAiStatus();
    fetchMock.mockResolvedValue(okJson({ marker: "live" }));
    const live = await getAiStatus({ force: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(live.marker).toBe("live");
  });

  it("does not keep a failed probe", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(getAiStatus()).rejects.toThrow("offline");
    fetchMock.mockResolvedValue(okJson({ marker: "retry" }));
    const retry = await getAiStatus();
    expect(retry.marker).toBe("retry");
  });

  it("drops the cache on demand", async () => {
    fetchMock.mockResolvedValue(okJson({ marker: "first" }));
    await getAiStatus();
    invalidateAiStatus();
    fetchMock.mockResolvedValue(okJson({ marker: "second" }));
    await getAiStatus();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("ai status mutations", () => {
  it("saving prefs clears the cache", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ marker: "first" }));
    await getAiStatus();
    fetchMock.mockResolvedValueOnce(okJson({ saved: true }));
    await setAiPreference("bundled", "quality");
    fetchMock.mockResolvedValueOnce(okJson({ marker: "second" }));
    const fresh = await getAiStatus();
    expect(fresh.marker).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("deleting a model clears the cache", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ marker: "first" }));
    await getAiStatus();
    fetchMock.mockResolvedValueOnce(okJson({ deleted: "0.8b" }));
    await deleteModel("0.8b");
    fetchMock.mockResolvedValueOnce(okJson({ marker: "second" }));
    const fresh = await getAiStatus();
    expect(fresh.marker).toBe("second");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("a failed save keeps the cache", async () => {
    fetchMock.mockResolvedValueOnce(okJson({ marker: "first" }));
    await getAiStatus();
    fetchMock.mockRejectedValue(new Error("offline"));
    await expect(setAiPreference("bundled", "quality")).rejects.toThrow(
      "offline",
    );
    const callsAfterSave = fetchMock.mock.calls.length;
    const cached = await getAiStatus();
    expect(cached.marker).toBe("first");
    expect(fetchMock.mock.calls.length).toBe(callsAfterSave);
  });
});
