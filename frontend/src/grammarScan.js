export const GRAMMAR_SCAN_VERSION = "context-window-v1";
export const DEFAULT_CONTEXT_PARAGRAPHS = 1;
export const DEFAULT_MAX_CONTEXT_CHARS = 2048;

function toNonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback;
}

function abortError() {
  const error = new Error("The grammar scan was aborted.");
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw abortError();
  }
}

function matchKey(match) {
  return JSON.stringify([
    match.offset,
    match.length,
    match.rule?.id || "",
    match.message || "",
  ]);
}

function deduplicateMatches(matches) {
  const seen = new Set();
  return matches
    .filter((match) => {
      const key = matchKey(match);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    })
    .sort((left, right) => left.offset - right.offset || left.length - right.length);
}

export function splitGrammarCores(text) {
  const source = String(text ?? "");
  const parts = source.split("\n");
  let offset = 0;

  return parts.map((part, index) => {
    const core = {
      index,
      start: offset,
      end: offset + part.length,
      text: part,
    };
    offset += part.length + 1;
    return core;
  });
}

function contextCoreAt(nonEmptyCores, targetOrdinal, distance) {
  if (distance < 1 || distance > targetOrdinal + 1) {
    return null;
  }
  return nonEmptyCores[targetOrdinal - distance] || null;
}

function followingContextCore(nonEmptyCores, targetOrdinal, distance) {
  return nonEmptyCores[targetOrdinal + distance] || null;
}

export function buildGrammarWindows(
  text,
  {
    contextParagraphs = DEFAULT_CONTEXT_PARAGRAPHS,
    maxContextChars = DEFAULT_MAX_CONTEXT_CHARS,
  } = {},
) {
  const source = String(text ?? "");
  const cores = splitGrammarCores(source);
  const nonEmptyCores = cores.filter((core) => core.end > core.start);
  const paragraphCount = toNonNegativeInteger(contextParagraphs);
  const contextLimit = toNonNegativeInteger(maxContextChars);

  return nonEmptyCores.map((core, targetOrdinal) => {
    const previous = contextCoreAt(
      nonEmptyCores,
      targetOrdinal,
      paragraphCount,
    );
    const next = followingContextCore(
      nonEmptyCores,
      targetOrdinal,
      paragraphCount,
    );
    const requestStart = previous
      ? Math.max(previous.start, core.start - contextLimit)
      : core.start;
    const requestEnd = next
      ? Math.min(next.end, core.end + contextLimit)
      : core.end;

    return {
      coreIndex: core.index,
      coreStart: core.start,
      coreEnd: core.end,
      coreOffset: core.start - requestStart,
      coreLength: core.end - core.start,
      requestStart,
      requestEnd,
      requestText: source.slice(requestStart, requestEnd),
    };
  });
}

export function filterWindowMatches(text, window, matches) {
  const source = String(text ?? "");
  const requestText = window?.requestText || "";
  const requestStart = toNonNegativeInteger(window?.requestStart);
  const coreStart = toNonNegativeInteger(window?.coreStart);
  const coreEnd = toNonNegativeInteger(window?.coreEnd, coreStart);
  const accepted = [];

  if (!Array.isArray(matches)) {
    return accepted;
  }

  for (const match of matches) {
    const offset = Number(match?.offset);
    const length = Number(match?.length);
    if (
      !Number.isSafeInteger(offset) ||
      !Number.isSafeInteger(length) ||
      offset < 0 ||
      length <= 0 ||
      offset + length > requestText.length
    ) {
      continue;
    }

    const globalStart = requestStart + offset;
    const globalEnd = globalStart + length;
    if (
      globalStart < coreStart ||
      globalEnd > coreEnd ||
      globalEnd > source.length ||
      source.slice(globalStart, globalEnd).includes("\n")
    ) {
      continue;
    }

    accepted.push({
      ...match,
      offset: globalStart,
      length,
    });
  }

  return deduplicateMatches(accepted);
}

function rebaseMatches(matches, requestStart) {
  return matches.map((match) => ({
    ...match,
    offset: match.offset + requestStart,
  }));
}

export async function scanGrammarWindows({
  text,
  language = "en-US",
  ignore = [],
  cache = null,
  checkGrammar,
  signal,
  contextParagraphs = DEFAULT_CONTEXT_PARAGRAPHS,
  maxContextChars = DEFAULT_MAX_CONTEXT_CHARS,
}) {
  if (typeof checkGrammar !== "function") {
    throw new TypeError("scanGrammarWindows requires a checkGrammar function.");
  }

  const source = String(text ?? "");
  const windows = buildGrammarWindows(source, {
    contextParagraphs,
    maxContextChars,
  });
  const matches = [];
  // Scan cost record. Read the clock only. Change no check logic.
  const perWindow = [];
  let requestCount = 0;
  let requestMs = 0;
  const scanStartedAt = performance.now();

  for (const window of windows) {
    throwIfAborted(signal);
    const windowStartedAt = performance.now();
    const fingerprint = {
      requestText: window.requestText,
      coreOffset: window.coreOffset,
      coreLength: window.coreLength,
      language,
      userDictionary: ignore,
      scanVersion: GRAMMAR_SCAN_VERSION,
      scanMode: "window",
    };
    const key = cache?.computeKey(fingerprint);
    let relativeMatches = key ? cache?.get(key) : null;
    const cacheHit = relativeMatches != null;

    if (relativeMatches == null) {
      const freshMatches = await checkGrammar(
        window.requestText,
        language,
        ignore,
        signal,
      );
      throwIfAborted(signal);
      const globalMatches = filterWindowMatches(
        source,
        window,
        freshMatches,
      );
      relativeMatches = globalMatches.map((match) => ({
        ...match,
        offset: match.offset - window.requestStart,
      }));
      if (key) {
        cache.set(key, relativeMatches);
      }
      requestCount += 1;
    }

    // Time to serve one window. Miss time holds the request wait.
    const windowMs = performance.now() - windowStartedAt;
    if (!cacheHit) {
      requestMs += windowMs;
    }
    perWindow.push({
      coreIndex: window.coreIndex,
      coreChars: window.coreLength,
      requestChars: window.requestText.length,
      cacheHit,
      ms: windowMs,
    });

    matches.push(...rebaseMatches(relativeMatches, window.requestStart));
  }

  const finalMatches = deduplicateMatches(matches);
  const cacheHits = perWindow.filter((entry) => entry.cacheHit).length;

  return {
    windows,
    matches: finalMatches,
    stats: {
      windowCount: windows.length,
      requestCount,
      cacheHits,
      cacheMisses: windows.length - cacheHits,
      totalMs: performance.now() - scanStartedAt,
      requestMs,
      matchCount: finalMatches.length,
      perWindow,
    },
  };
}

export function createLatestWinsCoordinator() {
  let generation = 0;
  let activeController = null;
  let disposed = false;

  function start() {
    if (disposed) {
      return null;
    }
    activeController?.abort();
    const controller = new AbortController();
    const runGeneration = ++generation;
    activeController = controller;

    return {
      generation: runGeneration,
      signal: controller.signal,
      isCurrent() {
        return (
          !disposed &&
          generation === runGeneration &&
          !controller.signal.aborted
        );
      },
    };
  }

  function invalidate() {
    generation += 1;
    activeController?.abort();
    activeController = null;
  }

  function dispose() {
    disposed = true;
    invalidate();
  }

  return {
    start,
    invalidate,
    dispose,
  };
}
