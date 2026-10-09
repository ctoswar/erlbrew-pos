#!/usr/bin/env python3
"""Derive the iOS and favicon variants from the shipped app icon.

public/icon-512.png — the gold serif "E" monogram — is the single source of
truth for the app's artwork. iOS wants a 180px apple-touch-icon and browsers
want a 32px favicon; hand-exporting those invites drift, so a tab icon can end
up not matching the launcher. This derives both from the one asset, meaning a
change to the monogram propagates with a single command.

Run through Docker — no local Python/Pillow needed:

    docker run --rm -v "$PWD":/w -w /w python:3-slim sh -c \
      'pip install -q pillow && python scripts/generate-icon-variants.py'

Outputs (picked up by Vite and copied to dist/):
    public/apple-touch-icon.png  180x180  full bleed — iOS applies its own mask
    public/favicon-32.png         32x32   cropped to the mark so it stays legible
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops

PUBLIC = Path(__file__).resolve().parent.parent / "public"
SOURCE = PUBLIC / "icon-512.png"  # largest source; 192 is used as fallback
FAVICON_PAD = 0.06  # breathing room around the mark in the favicon crop
THRESHOLD = 8  # per-channel difference that counts as "not background"


def content_bbox(img: Image.Image) -> tuple[int, int, int, int]:
    """Bounding box of everything that differs from the flat background."""
    bg = Image.new("RGBA", img.size, img.getpixel((0, 0)))
    diff = ImageChops.difference(img.convert("RGBA"), bg).convert("L")
    return diff.point(lambda v: 255 if v > THRESHOLD else 0).getbbox()


def square_crop(img: Image.Image, pad: float) -> Image.Image:
    """Crop to the artwork, padded and squared off, clamped to the canvas."""
    x0, y0, x1, y1 = content_bbox(img)
    side = min(int(max(x1 - x0, y1 - y0) * (1 + 2 * pad)), min(img.size))
    left = min(max((x0 + x1) // 2 - side // 2, 0), img.width - side)
    top = min(max((y0 + y1) // 2 - side // 2, 0), img.height - side)
    return img.crop((left, top, left + side, top + side))


def save(img: Image.Image, name: str) -> None:
    path = PUBLIC / name
    img.save(path, "PNG", optimize=True)
    print(f"wrote {path}  {img.width}x{img.height}  ({path.stat().st_size} bytes)")


def main() -> None:
    src = Image.open(SOURCE).convert("RGBA")
    save(src.resize((180, 180), Image.LANCZOS), "apple-touch-icon.png")
    save(square_crop(src, FAVICON_PAD).resize((32, 32), Image.LANCZOS), "favicon-32.png")


if __name__ == "__main__":
    main()
