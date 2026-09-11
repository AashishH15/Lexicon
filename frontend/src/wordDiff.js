// Word-level alignment for rewrite diffs. Tokenizes words apart from
// punctuation so small edits align instead of swallowing sentences.

function tokenize(text) {
  const tokens = [];
  for (const chunk of String(text ?? "").split(/\s+/)) {
    if (!chunk) {
      continue;
    }
    const match = chunk.match(/^([^A-Za-z0-9'’]*)(.*?)([^A-Za-z0-9'’]*)$/);
    if (!match || !match[2]) {
      tokens.push(chunk);
      continue;
    }
    if (match[1]) {
      tokens.push(match[1]);
    }
    tokens.push(match[2]);
    if (match[3]) {
      tokens.push(match[3]);
    }
  }
  return tokens;
}

function renderTokens(tokens) {
  return tokens
    .join(" ")
    .replace(/\s+([.,!?;:'"…)\]}])/g, "$1")
    .replace(/([([{“‘])\s+/g, "$1");
}

function isPunctOnly(text) {
  return text.length > 0 && /^[^\w]+$/.test(text);
}

// Longest common subsequence over tokens. Card-sized texts only.
function lcsOps(left, right) {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let i = rows - 2; i >= 0; i -= 1) {
    for (let j = cols - 2; j >= 0; j -= 1) {
      grid[i][j] =
        left[i] === right[j]
          ? grid[i + 1][j + 1] + 1
          : Math.max(grid[i + 1][j], grid[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      ops.push({ kind: "kept", token: left[i] });
      i += 1;
      j += 1;
    } else if (grid[i + 1][j] >= grid[i][j + 1]) {
      ops.push({ kind: "removed", token: left[i] });
      i += 1;
    } else {
      ops.push({ kind: "added", token: right[j] });
      j += 1;
    }
  }
  while (i < left.length) {
    ops.push({ kind: "removed", token: left[i] });
    i += 1;
  }
  while (j < right.length) {
    ops.push({ kind: "added", token: right[j] });
    j += 1;
  }
  return ops;
}

export function alignWords(source, result) {
  const ops = lcsOps(tokenize(source), tokenize(result));
  const groups = [];
  for (const op of ops) {
    const last = groups[groups.length - 1];
    if (last && last.kind === op.kind) {
      last.tokens.push(op.token);
    } else {
      groups.push({ kind: op.kind, tokens: [op.token] });
    }
  }
  const parts = groups.map((group) => ({
    kind: group.kind,
    text: renderTokens(group.tokens),
  }));
  // Stray punctuation belongs with its neighbor, not alone in a chip.
  const merged = [];
  for (const part of parts) {
    const prev = merged[merged.length - 1];
    if (isPunctOnly(part.text) && prev) {
      prev.text = renderTokens([prev.text, part.text]);
    } else {
      merged.push({ ...part });
    }
  }
  return merged.filter((part) => part.text.length > 0);
}
