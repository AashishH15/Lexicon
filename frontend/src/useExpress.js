import { useCallback, useState } from "react";
import useTransform from "./useTransform.js";
import { getExpressPrompt } from "./prompts.js";
import { EXPRESS_TONES, parseExpressJson } from "./expressParser.js";

// Default tone. Use it on first load.
export const EXPRESS_DEFAULT_TONE = "professional";

// Message for the Light tier. Light cannot do the JSON task well.
export const EXPRESS_NEEDS_MODEL_MESSAGE =
  "Express in English needs Standard or Quality.";

// Check the model tier. Block Light only. Allow auto and external servers.
export function isExpressModelAllowed(modelKey) {
  return modelKey !== "0.8b";
}

// Thin hook for Express in English. Wrap the shared transform.
// Keep result and tone here. Use transform for status and cancel.
// Do not add a second AbortController here.
export default function useExpress() {
  const transform = useTransform();
  const [result, setResult] = useState(null);
  const [activeTone, setActiveToneState] = useState(EXPRESS_DEFAULT_TONE);
  const [notice, setNotice] = useState("");

  // Set the active tone. Ignore unknown tone names.
  const setActiveTone = useCallback((tone) => {
    if (!EXPRESS_TONES.includes(tone)) {
      return;
    }
    setActiveToneState(tone);
  }, []);

  // Clear the result and the notice. Keep the tone choice.
  const clear = useCallback(() => {
    setResult(null);
    setNotice("");
  }, []);

  // Run one express request. Return the parsed result or null.
  const runExpress = useCallback(
    async (text, options = {}) => {
      const { modelKey, backend } = options || {};
      if (!isExpressModelAllowed(modelKey)) {
        setResult(null);
        setNotice(EXPRESS_NEEDS_MODEL_MESSAGE);
        return null;
      }
      setNotice("");
      const input = typeof text === "string" ? text : "";
      if (!input.trim()) {
        return null;
      }
      setResult(null);
      const raw = await transform.run({
        prompt: getExpressPrompt(text),
        text,
        modelKey,
        backend,
      });
      if (raw == null) {
        return null;
      }
      const parsed = parseExpressJson(raw);
      setResult(parsed);
      return parsed;
    },
    [transform.run],
  );

  const activeText =
    result && result.tones ? result.tones[activeTone] || "" : "";

  return {
    result,
    activeTone,
    setActiveTone,
    activeText,
    status: transform.status,
    error: notice || transform.error,
    notice,
    needsUpgrade: Boolean(notice),
    runExpress,
    clear,
    cancel: transform.cancel,
    abort: transform.abort,
    isWarming: transform.isWarming,
  };
}
