import { useCallback, useRef, useState } from "react";
import { cancelTransform, transformText } from "./api.js";

function newRequestId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }
  return `transform-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export default function useTransform() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const warmedRef = useRef(false);
  const abortRef = useRef(null);
  const requestIdRef = useRef(null);
  const runIdRef = useRef(0);

  const cancelActiveRequest = useCallback(() => {
    const requestId = requestIdRef.current;
    requestIdRef.current = null;
    if (requestId) {
      cancelTransform(requestId).catch(() => {});
    }
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const run = useCallback(
    async ({ prompt, text, modelKey, backend }) => {
      cancelActiveRequest();
      const runId = ++runIdRef.current;
      const requestId = newRequestId();
      setError("");
      // First call of the session: flag the lazy model load as "warming".
      const warming = !warmedRef.current;
      setStatus(warming ? "warming" : "working");
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      requestIdRef.current = requestId;
      try {
        const res = await transformText({
          prompt,
          text,
          modelKey,
          backend,
          requestId,
          signal: ctrl.signal,
        });
        if (runIdRef.current !== runId) return null;
        if (typeof res?.text !== "string" || !res.text.trim()) {
          throw new Error("The model returned no final text.");
        }
        warmedRef.current = true;
        setStatus("idle");
        return res.text;
      } catch (exc) {
        if (runIdRef.current !== runId) return null;
        if (exc.name === "AbortError") return null;
        setError(exc.message || "Transform failed.");
        setStatus("error");
        return null;
      } finally {
        if (requestIdRef.current === requestId) {
          requestIdRef.current = null;
          abortRef.current = null;
        }
      }
    },
    [cancelActiveRequest],
  );

  const cancel = useCallback(() => {
    runIdRef.current += 1;
    cancelActiveRequest();
    setStatus("idle");
  }, [cancelActiveRequest]);

  return {
    status,
    error,
    run,
    cancel,
    abort: cancel,
    isWarming: status === "warming",
  };
}
