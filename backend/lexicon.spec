"""PyInstaller spec: freeze the Lexicon backend into an onedir bundle
(``dist/lexicon-backend/``) that Tauri ships as a *resource* and launches via
Rust's std::process::Command.

We use onedir (not --onefile) deliberately: the single-file "append payload to
exe" step is blocked in some sandboxed build environments (PermissionError on
_append_data_to_exe), which leaves a bootloader-only exe that can't find its
Python DLL. onedir keeps the launcher exe next to its ``_internal`` folder of
DLLs/modules, which is exactly what Tauri's resource_dir layout expects.

Native gotchas handled:
  * llama-cpp-python ships a compiled C extension; --collect-all pulls it in.
  * language-tool-python pulls a server jar + language profiles; --collect-all
    keeps them. The JRE itself is bundled separately (resources/jre).
"""

import os

block_cipher = None

entry = os.path.join(SPECPATH, "launcher.py")

# The bundled llama.cpp engine is available for the 64-bit and ARM64 builds.
# Windows has no 32-bit edition of Windows 11, and the native llama.cpp
# dependency is not a supported Windows x86 target, so that legacy build keeps
# proofreading available without claiming the optional AI engine is bundled.
include_llama = os.environ.get("LEXICON_INCLUDE_LLAMA", "true").lower() in (
    "1",
    "true",
    "yes",
)

hiddenimports = [
    "uvicorn",
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.websockets",
    "uvicorn.lifespan",
    "huggingface_hub",
    "huggingface_hub._snapshot_download",
    "requests",
    "language_tool_python",
]

if include_llama:
    hiddenimports.append("llama_cpp")

a = Analysis(
    [entry],
    pathex=[SPECPATH],
    binaries=[],
    datas=[],
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        "torch",
        "tensorflow",
        "scipy",
        "matplotlib",
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Collect native libs + data (GGUF loader, LT server jar, profiles) into the
# bundle. Use the standalone collect_all function and merge explicitly into the
# Analysis -- the Analysis.collect_all method is unreliable here (silently
# drops llama_cpp's native .dlls). This PyInstaller version's collect_all
# returns (binaries, datas); errors are surfaced, not swallowed.
from PyInstaller.utils.hooks import collect_all

packages_to_collect = ["language_tool_python"]
if include_llama:
    packages_to_collect.insert(0, "llama_cpp")

for pkg in packages_to_collect:
    results = collect_all(pkg)
    # collect_all returns (datas, binaries, hiddenimports) where datas/binaries
    # are 2-tuples of (src, dest_dir). PyInstaller's TOC needs 3-tuples
    # (dest, src, typecode), so normalize before merging into the Analysis.
    # Skip *.dist-info / *.egg-info directories, which collect_all sometimes
    # lists as data sources and PyInstaller rejects.
    datas, binaries, _hidden = results
    for src, dest_dir in datas:
        if os.path.isdir(src):
            continue
        dest = os.path.join(dest_dir, os.path.basename(src))
        a.datas.append((dest, src, "DATA"))
    for src, dest_dir in binaries:
        if os.path.isdir(src):
            continue
        dest = os.path.join(dest_dir, os.path.basename(src))
        a.binaries.append((dest, src, "BINARY"))

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="lexicon-backend",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=False,
    icon=os.path.join(SPECPATH, "app_icon.ico")
    if os.path.exists(os.path.join(SPECPATH, "app_icon.ico"))
    else None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name="lexicon-backend",
)
