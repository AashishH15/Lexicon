"""Generate Lexicon logo derivatives from media/Lexicon Logos/ masters."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "media" / "Lexicon Logos"
MASTER_ICON = SRC / "icon.png"
MASTER_ICON_SVG = SRC / "Logo-icon.svg"
MASTER_TYPE_SVG = SRC / "Logo-Type.svg"

BRAND_BG = (247, 246, 243)  # --bg-canvas


def load_master() -> Image.Image:
    return Image.open(MASTER_ICON).convert("RGBA")


def resize_icon(img: Image.Image, size: int) -> Image.Image:
    return img.resize((size, size), Image.Resampling.LANCZOS)


def with_background(img: Image.Image, bg: tuple[int, int, int]) -> Image.Image:
    base = Image.new("RGBA", img.size, (*bg, 255))
    base.alpha_composite(img)
    return base.convert("RGB")


def save_png(path: Path, img: Image.Image) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if img.mode == "RGBA":
        img.save(path, format="PNG", optimize=True)
    else:
        img.save(path, format="PNG", optimize=True)


def save_ico(path: Path, img: Image.Image, sizes: list[int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    icons = [resize_icon(img, size) for size in sizes]
    icons[0].save(
        path,
        format="ICO",
        sizes=[(size, size) for size in sizes],
        append_images=icons[1:],
    )


def render_svg_to_png(svg_path: Path, out_path: Path, width: int, height: int) -> bool:
    try:
        import cairosvg
    except ImportError:
        return False

    out_path.parent.mkdir(parents=True, exist_ok=True)
    cairosvg.svg2png(
        url=str(svg_path),
        write_to=str(out_path),
        output_width=width,
        output_height=height,
    )
    return True


def compose_og_banner(icon: Image.Image) -> Image.Image:
    width, height = 1200, 630
    canvas = Image.new("RGB", (width, height), BRAND_BG)

    wordmark = None
    tmp = ROOT / "scripts" / ".tmp-wordmark.png"
    if render_svg_to_png(MASTER_TYPE_SVG, tmp, 900, 225):
        wordmark = Image.open(tmp).convert("RGBA")
        tmp.unlink(missing_ok=True)

    if wordmark is not None:
        bbox = wordmark.getbbox()
        if bbox:
            wordmark = wordmark.crop(bbox)
        max_w = int(width * 0.72)
        max_h = int(height * 0.42)
        scale = min(max_w / wordmark.width, max_h / wordmark.height)
        new_size = (max(1, int(wordmark.width * scale)), max(1, int(wordmark.height * scale)))
        wordmark = wordmark.resize(new_size, Image.Resampling.LANCZOS)
        x = (width - wordmark.width) // 2
        y = (height - wordmark.height) // 2
        canvas.paste(wordmark, (x, y), wordmark)
        return canvas

    mark = resize_icon(icon, 180)
    mark_x = (width - mark.width) // 2
    mark_y = (height - mark.height) // 2 - 24
    canvas.paste(mark, (mark_x, mark_y), mark)

    draw = ImageDraw.Draw(canvas)
    text = "Lexicon"
    font_size = 72
    try:
        from PIL import ImageFont

        font = ImageFont.truetype("arial.ttf", font_size)
    except OSError:
        font = ImageFont.load_default()
    text_bbox = draw.textbbox((0, 0), text, font=font)
    text_w = text_bbox[2] - text_bbox[0]
    text_h = text_bbox[3] - text_bbox[1]
    text_x = (width - text_w) // 2
    text_y = mark_y + mark.height + 28
    draw.text((text_x, text_y), text, fill=(17, 17, 17), font=font)
    return canvas


def copy_svg(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)


def render_logo_type_png(dest: Path, width: int = 640) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        subprocess.run(
            [
                "npx",
                "--yes",
                "@resvg/resvg-js-cli",
                "--fit-width",
                str(width),
                str(MASTER_TYPE_SVG),
                str(dest),
            ],
            check=True,
            cwd=ROOT,
            capture_output=True,
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError) as error:
        raise SystemExit(
            "Failed to render logo-type PNG. Install Node.js and rerun, or run:\n"
            f'  npx @resvg/resvg-js-cli --fit-width {width} "{MASTER_TYPE_SVG}" "{dest}"'
        ) from error


def main() -> None:
    if not MASTER_ICON.exists():
        raise SystemExit(f"Missing master icon: {MASTER_ICON}")

    icon = load_master()

    targets = {
        ROOT / "media" / "lexicon-logo.png": icon,
        ROOT / "media" / "lexicon-logo-windows.png": with_background(icon, BRAND_BG),
        ROOT / "frontend" / "public" / "lexicon-logo.png": icon,
        ROOT / "website" / "assets" / "lexicon-logo.png": icon,
        ROOT / "website" / "assets" / "lexicon-logo-windows.png": with_background(icon, BRAND_BG),
        ROOT / "website" / "assets" / "lexicon-logo-small.png": resize_icon(icon, 56),
        ROOT / "frontend" / "src-tauri" / "icons" / "icon.png": resize_icon(icon, 1024),
        ROOT / "extension" / "shared" / "icons" / "icon-16.png": resize_icon(icon, 16),
        ROOT / "extension" / "shared" / "icons" / "icon-32.png": resize_icon(icon, 32),
        ROOT / "extension" / "shared" / "icons" / "icon-48.png": resize_icon(icon, 48),
        ROOT / "extension" / "shared" / "icons" / "icon-128.png": resize_icon(icon, 128),
    }

    for path, image in targets.items():
        save_png(path, image if image.mode == "RGBA" else image.convert("RGBA"))

    save_ico(
        ROOT / "frontend" / "src-tauri" / "icons" / "icon.ico",
        icon,
        [16, 24, 32, 48, 64, 128, 256],
    )

    save_png(ROOT / "website" / "assets" / "og-banner.png", compose_og_banner(icon))

    copy_svg(MASTER_ICON_SVG, ROOT / "media" / "lexicon-logo-svg.svg")
    copy_svg(MASTER_ICON_SVG, ROOT / "website" / "assets" / "lexicon-logo-svg.svg")
    copy_svg(MASTER_TYPE_SVG, ROOT / "media" / "lexicon-logo-type.svg")
    copy_svg(MASTER_TYPE_SVG, ROOT / "website" / "assets" / "lexicon-logo-type.svg")

    render_logo_type_png(ROOT / "media" / "lexicon-logo-type.png", width=640)
    shutil.copy2(
        ROOT / "media" / "lexicon-logo-type.png",
        ROOT / "website" / "assets" / "lexicon-logo-type.png",
    )

    print("Synced Lexicon logo assets.")


if __name__ == "__main__":
    main()
