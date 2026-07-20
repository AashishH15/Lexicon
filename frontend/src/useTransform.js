import { useCallback, useRef, useState } from "react";
import { transformText } from "./api.js";

export default function useTransform() {
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const warmedRef = useRef(false);
  const abortRef = useRef(null);

  const run = useCallback(
    async ({ prompt, text, modelKey, backend }) => {
      setError("");
      // First call of the session: flag the lazy model load as "warming".
      const warming = !warmedRef.current;
      setStatus(warming ? "warming" : "working");
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const res = await transformText({
          prompt,
          text,
          modelKey,
          backend,
          signal: ctrl.signal,
        });
        warmedRef.current = true;
        setStatus("idle");
        return res.text;
      } catch (exc) {
        if (exc.name === "AbortError") return null;
        setError(exc.message || "Transform failed.");
        setStatus("error");
        return null;
      }
  },
    [],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setStatus("idle");
  }, []);

  return { status, error, run, cancel, isWarming: status === "warming" };
}
