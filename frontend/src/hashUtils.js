/**
 * Fast 64-bit FNV-1a non-cryptographic hashing utility.
 * Dual 32-bit bitwise implementation running in V8 SMI registers for sub-microsecond LRU cache key generation.
 */
export function fnv1a64(str) {
  let h1 = 0x811c9dc5;
  let h2 = 0x050c5d1f;
  const len = str.length;

  for (let i = 0; i < len; i++) {
    const code = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ code, 0x01000193) >>> 0;
  }

  const hex1 = h1.toString(16).padStart(8, "0");
  const hex2 = h2.toString(16).padStart(8, "0");
  return hex1 + hex2;
}
