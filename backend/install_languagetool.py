"""Install the official LanguageTool standalone engine for source checkouts.

This helper downloads only the Java engine that Lexicon launches. It does not
install or import any Python LanguageTool wrapper.
"""

from __future__ import annotations

import argparse
import hashlib
import shutil
import sys
import tempfile
import urllib.error
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

LANGUAGETOOL_VERSION = "6.8"
LANGUAGETOOL_ENGINE_DIR = f"LanguageTool-{LANGUAGETOOL_VERSION}"
LANGUAGETOOL_SERVER_JAR = "languagetool-server.jar"
LANGUAGETOOL_URL = (
    "https://repo1.maven.org/maven2/org/languagetool/"
    f"languagetool-standalone/{LANGUAGETOOL_VERSION}/"
    f"languagetool-standalone-{LANGUAGETOOL_VERSION}.zip"
)
LANGUAGETOOL_SHA256 = (
    "f04aecf37e35ef17d44b336da9668a5a3a871edd14bd83a766a7e110b9ebcd21"
)
DOWNLOAD_CHUNK_SIZE = 1024 * 1024


def _default_destination() -> Path:
    return Path(__file__).resolve().parent / "lt"


def _download_archive(url: str, destination: Path) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Lexicon LanguageTool installer"},
    )
    digest = hashlib.sha256()
    with urllib.request.urlopen(request, timeout=120) as response, destination.open(
        "wb"
    ) as archive:
        while chunk := response.read(DOWNLOAD_CHUNK_SIZE):
            archive.write(chunk)
            digest.update(chunk)
    return digest.hexdigest()


def _validate_archive_members(archive: zipfile.ZipFile) -> None:
    expected_prefix = f"{LANGUAGETOOL_ENGINE_DIR}/"
    for member in archive.infolist():
        path = PurePosixPath(member.filename)
        if path.is_absolute() or ".." in path.parts:
            raise RuntimeError(
                f"LanguageTool archive contains an unsafe path: {member.filename}"
            )
        if member.filename and not member.filename.startswith(expected_prefix):
            raise RuntimeError(
                "LanguageTool archive has an unexpected top-level path: "
                f"{member.filename}"
            )


def _extract_archive(archive_path: Path, destination: Path, force: bool) -> Path:
    target = destination / LANGUAGETOOL_ENGINE_DIR
    if (target / LANGUAGETOOL_SERVER_JAR).is_file() and not force:
        return target
    if target.exists() and not force:
        raise RuntimeError(
            f"{target} exists but does not contain "
            f"{LANGUAGETOOL_SERVER_JAR}; remove it or use --force."
        )

    temporary_root = Path(
        tempfile.mkdtemp(prefix=".languagetool-", dir=str(destination))
    )
    try:
        with zipfile.ZipFile(archive_path) as archive:
            _validate_archive_members(archive)
            archive.extractall(temporary_root)

        extracted = temporary_root / LANGUAGETOOL_ENGINE_DIR
        server_jar = extracted / LANGUAGETOOL_SERVER_JAR
        if not server_jar.is_file():
            raise RuntimeError(
                "The LanguageTool archive did not contain "
                f"{LANGUAGETOOL_ENGINE_DIR}/{LANGUAGETOOL_SERVER_JAR}."
            )

        if target.exists():
            shutil.rmtree(target)
        shutil.move(str(extracted), str(target))
        return target
    finally:
        shutil.rmtree(temporary_root, ignore_errors=True)


def install(
    destination: Path,
    *,
    url: str = LANGUAGETOOL_URL,
    expected_sha256: str = LANGUAGETOOL_SHA256,
    force: bool = False,
) -> Path:
    """Download and install LanguageTool, returning its engine directory."""
    destination = destination.expanduser().resolve()
    destination.mkdir(parents=True, exist_ok=True)
    target = destination / LANGUAGETOOL_ENGINE_DIR
    if (target / LANGUAGETOOL_SERVER_JAR).is_file() and not force:
        return target

    archive_path = None
    try:
        with tempfile.NamedTemporaryFile(
            prefix=".languagetool-", suffix=".zip", dir=destination, delete=False
        ) as temporary_archive:
            archive_path = Path(temporary_archive.name)

        print(f"Downloading LanguageTool {LANGUAGETOOL_VERSION}...")
        actual_sha256 = _download_archive(url, archive_path)
        if actual_sha256.lower() != expected_sha256.lower():
            raise RuntimeError(
                "LanguageTool archive checksum did not match. "
                f"Expected {expected_sha256}, got {actual_sha256}."
            )
        return _extract_archive(archive_path, destination, force)
    finally:
        if archive_path is not None:
            archive_path.unlink(missing_ok=True)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Download the official LanguageTool engine for Lexicon."
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=_default_destination(),
        help="Directory that will contain LanguageTool-6.8.",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Replace an existing incomplete or installed engine.",
    )
    parser.add_argument(
        "--url",
        default=LANGUAGETOOL_URL,
        help="LanguageTool standalone ZIP URL.",
    )
    parser.add_argument(
        "--sha256",
        default=LANGUAGETOOL_SHA256,
        help="Expected SHA-256 checksum for the ZIP.",
    )
    args = parser.parse_args()

    try:
        engine_dir = install(
            args.destination,
            url=args.url,
            expected_sha256=args.sha256,
            force=args.force,
        )
    except (OSError, RuntimeError, urllib.error.URLError, zipfile.BadZipFile) as exc:
        print(f"LanguageTool installation failed: {exc}", file=sys.stderr)
        return 1

    print(f"LanguageTool engine ready at {engine_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
