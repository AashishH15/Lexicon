"""Derive a Chrome extension ID from a manifest.json `key` field.

Chrome extension IDs are the first 128 bits of the SHA-256 digest of the
public key's SPKI DER bytes, each 4-bit nibble rendered as a letter a-p
(see https://developer.chrome.com/docs/extensions/reference/manifest/key).

C48.1 pins this ID in backend/main.py so the local API accepts calls only
from Lexicon's own extension. Re-run after publishing to the Web Store: if
the store build's ID differs from the dev ID (it is derived from the key
shipped in the submitted zip, so it usually matches), add the store ID to
backend/main.py's EXTENSION_ORIGINS or set LEXICON_EXTENSION_ORIGINS.

Lives in extension/tools/ rather than extension/chrome/ on purpose: Chrome
refuses to load unpacked extensions from folders containing files or
directories that start with "_" (e.g. __pycache__), so the chrome build
folder must only ever contain extension assets.

Usage:
    python extension_id.py            # ID for extension/chrome/manifest.json
    python extension_id.py <key>      # ID for a given base64-encoded key
"""

import base64
import hashlib
import json
import sys
from pathlib import Path

ALPHABET = "abcdefghijklmnop"


def extension_id_from_key(spki_b64: str) -> str:
    """Compute the extension ID Chrome derives from a manifest `key`."""
    if not spki_b64:
        raise ValueError("empty key")
    der = base64.b64decode(spki_b64, validate=True)
    if not der:
        raise ValueError("key decodes to no bytes")
    digest = hashlib.sha256(der).digest()
    return "".join(
        ALPHABET[(byte >> 4) & 0xF] + ALPHABET[byte & 0xF] for byte in digest[:16]
    )


def manifest_key(manifest_path: Path) -> str:
    """Read the `key` field from a Chrome manifest.json."""
    return json.loads(manifest_path.read_text(encoding="utf-8"))["key"]


def main(argv: list[str]) -> int:
    if argv:
        print(extension_id_from_key(argv[0]))
        return 0
    here = Path(__file__).resolve().parent
    print(extension_id_from_key(manifest_key(here.parent / "chrome" / "manifest.json")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
