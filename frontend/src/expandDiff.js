// Sentence-level diff for Expand results. Marks result sentences that
// do not appear in the source so additions read apart from rewrites.

function normalizeSentence(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/^["“”'‘\s]+|["“”'‘\s]+$/g, "")
    .trim();
}

export function splitResultSentences(text) {
  const source = String(text ?? "");
  const parts = [];
  const pattern = /[^.!?…]+(?:[.!?…]+["”']?|$)/g;
  let match = pattern.exec(source);
  while (match) {
    const chunk = match[0].trim();
    if (chunk) {
      parts.push(chunk);
    }
    match = pattern.exec(source);
  }
  return parts;
}

function tokenSet(value) {
  return new Set(normalizeSentence(value).split(" ").filter(Boolean));
}

// Overlap coefficient between two token sets. Paraphrases that keep
// half the words count as kept; genuinely new sentences do not.
function overlapScore(left, right) {
  if (left.size === 0 || right.size === 0) {
    return 0;
  }
  let shared = 0;
  for (const token of left) {
    if (right.has(token)) {
      shared += 1;
    }
  }
  return shared / Math.min(left.size, right.size);
}

const SIMILARITY_KEEP = 0.5;

export function markAddedSentences(source, result) {
  const base = splitResultSentences(source).map(tokenSet);
  return splitResultSentences(result).map((text) => {
    const key = tokenSet(text);
    if (key.size === 0 || base.length === 0) {
      return { text, added: false };
    }
    const kept = base.some(
      (tokens) => overlapScore(tokens, key) >= SIMILARITY_KEEP,
    );
    return { text, added: !kept };
  });
}
