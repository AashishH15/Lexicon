import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockInvoke } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

import {
  getAuthToken,
  request,
  setCachedAuthToken,
} from "../api.js";

describe("Frontend Auth & Bearer Token Management", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    setCachedAuthToken(null);
    mockInvoke.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete globalThis.window;
    setCachedAuthToken("test-token");
  });

  it("retrieves token via Tauri IPC when running inside Tauri", async () => {
    globalThis.window = { __TAURI_INTERNALS__: {} };
    mockInvoke.mockResolvedValueOnce("tauri-secret-token");

    const token = await getAuthToken();
    expect(token).toBe("tauri-secret-token");
    expect(mockInvoke).toHaveBeenCalledWith("get_auth_token");
  });

  it("retrieves token via HTTP handshake when running outside Tauri", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, token: "handshake-secret-token" }),
    });

    const token = await getAuthToken();
    expect(token).toBe("handshake-secret-token");
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/auth/handshake"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("attaches Authorization Bearer header to protected endpoint requests", async () => {
    setCachedAuthToken("active-bearer-token");
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    await request("/grammar/check", {
      method: "POST",
      body: JSON.stringify({ text: "Hello" }),
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/grammar/check");
    expect(options.headers["Authorization"]).toBe("Bearer active-bearer-token");
  });

  it("retries request on 401 by refreshing the auth token", async () => {
    setCachedAuthToken("expired-token");

    // First call to endpoint returns 401
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Token expired" }),
    });
    // Handshake returns fresh token
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, token: "refreshed-token" }),
    });
    // Retry call succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, recovered: true }),
    });

    const response = await request("/grammar/check", {
      method: "POST",
      body: JSON.stringify({ text: "Retry test" }),
    });

    expect(response.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Call 1: with expired-token
    expect(fetchMock.mock.calls[0][1].headers["Authorization"]).toBe("Bearer expired-token");
    // Call 2: handshake
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/handshake");
    // Call 3: retry with refreshed-token
    expect(fetchMock.mock.calls[2][1].headers["Authorization"]).toBe("Bearer refreshed-token");
  });
});
