#!/usr/bin/env python3
"""Build web/public/images/og-cover.png — the 1200x630 Open Graph card.

Run from the repository root:

    python3 favicon/make-og-cover.py

Nothing here is drawn from scratch. The card is two supplied assets composited
onto the site's own hero gradient:

  * `og-icon.png`                — a 389x507 screenshot of the mobile hero.
    Portrait and far below the 1200x630 social platforms want, so it is placed
    at native size rather than upscaled; the gradient fills the rest.
  * `web-app-manifest-512x512.png` — the round logo. Its artwork is baked onto
    an opaque white plate, which reads as a white card on purple, so the plate
    is flood-filled away from the edges before compositing.

Re-run this if either source asset changes. The output is committed, so the
site build has no dependency on Pillow.
"""

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'favicon'
OUT = ROOT / 'web' / 'public' / 'images' / 'og-cover.png'

WIDTH, HEIGHT = 1200, 630

# Same stops and angle as --gradient-hero in web/src/app/tokens.css.
GRADIENT_ANGLE = 169.283
GRADIENT_FROM, GRADIENT_TO = (0x4A, 0x1A, 0x73), (0x7B, 0x2F, 0xB0)
GRADIENT_START, GRADIENT_END = 0.05693, 0.94307


def hero_gradient(width: int, height: int) -> Image.Image:
    """The CSS `linear-gradient(169.283deg, …)` rasterised at card size."""
    angle = math.radians(GRADIENT_ANGLE)
    dx, dy = math.sin(angle), -math.cos(angle)
    cx, cy = width / 2, height / 2
    extent = (abs(width * dx) + abs(height * dy)) / 2
    span = GRADIENT_END - GRADIENT_START

    image = Image.new('RGB', (width, height))
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            t = (((x - cx) * dx + (y - cy) * dy) / (2 * extent)) + 0.5
            t = min(1.0, max(0.0, (t - GRADIENT_START) / span))
            pixels[x, y] = tuple(
                round(a + (b - a) * t) for a, b in zip(GRADIENT_FROM, GRADIENT_TO)
            )
    return image


def logo_without_plate() -> Image.Image:
    """The round logo with its white backing plate made transparent.

    Flood-filled inward from all four corners rather than keyed on white: the
    logo's own highlights and the "Fit" wordmark are white too, and they are
    enclosed by dark outlines the fill cannot cross.
    """
    logo = Image.open(SRC / 'web-app-manifest-512x512.png').convert('RGBA')
    flat = Image.new('RGB', logo.size, (255, 255, 255))
    flat.paste(logo, (0, 0), logo)

    key = (255, 0, 255)
    corners = [(0, 0), (flat.width - 1, 0), (0, flat.height - 1),
               (flat.width - 1, flat.height - 1)]
    for corner in corners:
        ImageDraw.floodfill(flat, corner, key, thresh=60)

    alpha = Image.new('L', flat.size, 255)
    flat_px, alpha_px = flat.load(), alpha.load()
    for y in range(flat.height):
        for x in range(flat.width):
            if flat_px[x, y] == key:
                alpha_px[x, y] = 0
                flat_px[x, y] = (255, 255, 255)

    # MinFilter erodes the mask by a pixel, removing the pale halo the fill
    # leaves along the artwork's anti-aliased edge.
    alpha = alpha.filter(ImageFilter.MinFilter(3))
    trimmed = Image.merge('RGBA', (*flat.split(), alpha))
    return trimmed.crop(alpha.getbbox())


def screenshot() -> Image.Image:
    """The hero screenshot, with the sliver of the next section trimmed off."""
    shot = Image.open(SRC / 'og-icon.png').convert('RGB')
    pixels = shot.load()

    def row_mean(y: int) -> float:
        samples = [pixels[x, y] for x in range(0, shot.width, 7)]
        return sum(sum(c) / 3 for c in samples) / len(samples)

    reference = row_mean(int(shot.height * 0.6))
    bottom = shot.height
    while bottom > 1 and abs(row_mean(bottom - 1) - reference) > 35:
        bottom -= 1
    return shot.crop((0, 0, shot.width, bottom))


def main() -> None:
    card = hero_gradient(WIDTH, HEIGHT)

    shot = screenshot()
    shot_x = WIDTH - 56 - shot.width
    shot_y = (HEIGHT - shot.height) // 2
    corners = Image.new('L', shot.size, 0)
    ImageDraw.Draw(corners).rounded_rectangle(
        [0, 0, shot.width - 1, shot.height - 1], radius=18, fill=255
    )

    logo = logo_without_plate()
    logo_width = 430
    logo = logo.resize(
        (logo_width, round(logo.height * logo_width / logo.width)), Image.LANCZOS
    )
    logo_x = (shot_x - logo.width) // 2
    logo_y = (HEIGHT - logo.height) // 2

    card.paste(logo, (logo_x, logo_y), logo)
    card.paste(shot, (shot_x, shot_y), corners)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    card.save(OUT, optimize=True)
    print(f'{OUT.relative_to(ROOT)} — {card.width}x{card.height}, '
          f'{OUT.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
