import { useCallback, useState } from "react";
import useTransform from "./useTransform.js";
import { getExpressPrompt, EXPRESS_TONE_TEMPERATURES } from "./prompts.js";
import { EXPRESS_TONES, parseExpressJson } from "./expressParser.js";

// Default tone. Auto translates with no picked tone.
export const EXPRESS_DEFAULT_TONE = "auto";

// Tool name. Use it in the toolbar and the review panel.
export const EXPRESS_TOOL_NAME = "Express in English";

// Max input length. Call sites enforce this cap.
export const EXPRESS_MAX_CHARS = 600;

// Message for the Light tier. Light cannot do the JSON task well.
export const EXPRESS_NEEDS_MODEL_MESSAGE =
  "Express in English needs Standard or Quality.";

// Check the model tier. Block Light only. Allow auto and external servers.
export function isExpressModelAllowed(modelKey) {
  return modelKey !== "0.8b";
}

// Pick the entry mode. Return run, paste, over-limit, or blocked.
// Block Light first. Send no request for paste, over-limit, or blocked.
export function resolveExpressEntry({ text, isModelAllowed } = {}) {
  if (!isModelAllowed) {
    return "blocked";
  }
  const input = typeof text === "string" ? text : "";
  if (!input.trim()) {
    return "paste";
  }
  if (input.length > EXPRESS_MAX_CHARS) {
    return "over-limit";
  }
  return "run";
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
      const { modelKey, backend, tone } = options || {};
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
      const selectedTone = tone || activeTone || EXPRESS_DEFAULT_TONE;
      // The picked tone sets temperature to balance format safety and style.
      const temperature =
        EXPRESS_TONE_TEMPERATURES[selectedTone] ??
        EXPRESS_TONE_TEMPERATURES[EXPRESS_DEFAULT_TONE];
      const raw = await transform.run({
        prompt: getExpressPrompt(text),
        text,
        modelKey,
        backend,
        temperature,
      });
      if (raw == null) {
        return null;
      }
      const parsed = parseExpressJson(raw);
      setResult(parsed);
      return parsed;
    },
    [transform.run, activeTone],
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
