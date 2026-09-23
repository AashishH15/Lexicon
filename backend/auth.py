"""Authentication module for the Lexicon loopback daemon.

This module manages ephemeral bearer tokens and token validation.
All comments and docstrings in this file follow ASD-STE100 rules.
"""

import hmac
import os
import secrets
from pathlib import Path

TOKEN_BYTE_LENGTH = 32


def generate_token() -> str:
    """Generate a random 64-character hexadecimal bearer token.

    The function uses secrets.token_hex for cryptographic security.
    """
    return secrets.token_hex(TOKEN_BYTE_LENGTH)


def get_auth_token_path() -> Path:
    """Resolve the platform path for the ephemeral auth token file.

    The path points to the user local application data directory.
    """
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.environ.get("APPDATA")
        if base:
            return Path(base) / "Lexicon" / "auth_token"
        return Path.home() / ".lexicon" / "auth_token"

    if os.uname().sysname == "Darwin":
        return Path.home() / "Library" / "Application Support" / "Lexicon" / "auth_token"

    runtime_dir = os.environ.get("XDG_RUNTIME_DIR")
    if runtime_dir:
        return Path(runtime_dir) / "lexicon" / "auth_token"
    return Path.home() / ".local" / "share" / "lexicon" / "auth_token"


def save_auth_token_file(token: str) -> Path:
    """Write the bearer token to disk with restricted permissions.

    The function creates parent directories if they do not exist.
    It writes the token string with read and write permissions for the owner only.
    """
    path = get_auth_token_path()
    path.parent.mkdir(parents=True, exist_ok=True)

    if os.name != "nt":
        fd = os.open(str(path), os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with open(fd, "w", encoding="utf-8") as file:
            file.write(token)
    else:
        path.write_text(token, encoding="utf-8")

    return path


def cleanup_auth_token_file() -> None:
    """Delete the ephemeral auth token file from disk.

    The daemon calls this function during shutdown.
    """
    try:
        path = get_auth_token_path()
        if path.is_file():
            path.unlink()
    except OSError:
        pass


def validate_token(provided: str | None, expected: str) -> bool:
    """Validate a candidate token against the expected token.

    The function uses constant-time string comparison to prevent timing attacks.
    It returns false if the provided token is empty or does not match.
    """
    if not provided or not expected:
        return False
    return hmac.compare_digest(str(provided).strip(), str(expected).strip())


def get_or_create_token() -> str:
    """Return the active bearer token for this daemon session.

    The function checks the LEXICON_AUTH_TOKEN environment variable first.
    If the variable is unset, the function generates a new token.
    It saves the token to disk and returns the string.
    """
    env_token = os.environ.get("LEXICON_AUTH_TOKEN", "").strip()
    token = env_token if env_token else generate_token()
    save_auth_token_file(token)
    return token
