#!/usr/bin/env python3
"""Generates procedural sample product/category imagery for the WDIO Gear demo webshop.
Not real product photography -- flat, icon-based placeholder art with per-product color
variety, produced in multiple sizes/formats so the site has real <img> payloads to test
(image-loading, lazy-load, payload-weight scenarios) instead of CSS gradient placeholders.

Usage (from the webshop/ directory):
  node -e "global.window={}; require('./products-data.js'); console.log(JSON.stringify(global.window.__wdioProducts));" > products-data.json
  python3 -m venv /tmp/wdio-img-venv && /tmp/wdio-img-venv/bin/pip install Pillow
  /tmp/wdio-img-venv/bin/python scripts/generate-images.py
  rm products-data.json

Requires Pillow and a TrueType font (defaults to macOS's Arial; point FONT_REG elsewhere on
other platforms). Re-run any time products-data.js changes shape or you want to restyle the art.
"""
import json
import math
import os
import re
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_PRODUCTS = os.path.join(ROOT, "assets", "products")
OUT_CATEGORIES = os.path.join(ROOT, "assets", "categories")
os.makedirs(OUT_PRODUCTS, exist_ok=True)
os.makedirs(OUT_CATEGORIES, exist_ok=True)

FONT_REG = "/System/Library/Fonts/Supplemental/Arial.ttf"

SWATCH = {
    "Charcoal": (58, 58, 58),
    "Sand": (216, 199, 171),
    "Rust Orange": (234, 89, 6),
    "Slate Blue": (90, 107, 140),
    "Off-White": (240, 236, 229),
    "Forest": (63, 90, 68),
}

# category -> (bg_top, bg_bottom) pastel gradient, matched to the site's warm-neutral palette family
CATEGORY_BG = {
    "Keyboards": ((238, 242, 245), (219, 228, 234)),
    "Headphones": ((243, 238, 248), (228, 217, 239)),
    "Backpacks": ((240, 236, 224), (221, 208, 184)),
    "Drinkware": ((238, 246, 242), (216, 236, 225)),
    "Apparel": ((247, 238, 238), (240, 217, 217)),
    "Desk Accessories": ((238, 241, 247), (219, 226, 240)),
    "Stickers & Decor": ((253, 243, 231), (246, 224, 196)),
    "Webcams & Audio": ((238, 244, 244), (217, 232, 232)),
}

LINE = (32, 32, 29)
LINE_SOFT = (74, 74, 70)
CAPTION = (138, 127, 115)

CATEGORY_SLUG = {
    "Keyboards": "keyboards",
    "Headphones": "headphones",
    "Backpacks": "backpacks",
    "Drinkware": "drinkware",
    "Apparel": "apparel",
    "Desk Accessories": "desk-accessories",
    "Webcams & Audio": "webcams-audio",
    # Stickers & Decor intentionally omitted -- Home.dc.html uses the WDIO robot mascot for that tile.
}


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def add_grain(img, amount=10, strength=0.035):
    """Blend in photographic-style luminance noise so the file doesn't compress like flat
    vector art -- real product photography carries sensor grain that keeps JPEG/PNG payloads
    in a realistic size range instead of the near-nothing a flat-color placeholder produces."""
    noise = Image.effect_noise(img.size, amount).convert("L")
    noise_rgb = Image.merge("RGB", (noise, noise, noise))
    return Image.blend(img, noise_rgb, strength).filter(ImageFilter.GaussianBlur(0.4))


def background(size, cat, accent):
    top, bottom = CATEGORY_BG[cat]
    # blend a touch of the product accent into the gradient endpoints for per-product variety
    top = lerp(top, accent, 0.10)
    bottom = lerp(bottom, accent, 0.16)
    img = Image.new("RGB", (size, size))
    px = img.load()
    for y in range(size):
        t = y / max(1, size - 1)
        row = lerp(top, bottom, t)
        for x in range(size):
            px[x, y] = row
    # soft radial spotlight behind the icon
    spot = Image.new("L", (size, size), 0)
    sd = ImageDraw.Draw(spot)
    r = int(size * 0.42)
    cx, cy = size // 2, int(size * 0.46)
    sd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=70)
    spot = spot.filter(ImageFilter.GaussianBlur(size * 0.12))
    white = Image.new("RGB", (size, size), (255, 255, 255))
    img = Image.composite(white, img, spot)
    return img


def draw_keyboard(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    body = [x0, y0 + h * 0.28, x1, y0 + h * 0.82]
    d.rounded_rectangle(body, radius=w * 0.05, outline=LINE, width=max(2, int(s * 0.010)), fill=(255, 255, 255, 0))
    cols, rows = 9, 3
    pad = w * 0.07
    kw = (body[2] - body[0] - pad * 2) / cols
    kh = (body[3] - body[1] - pad * 2) / rows
    for r in range(rows):
        for c in range(cols):
            kx0 = body[0] + pad + c * kw + kw * 0.12
            ky0 = body[1] + pad + r * kh + kh * 0.14
            kx1 = kx0 + kw * 0.76
            ky1 = ky0 + kh * 0.72
            fill = accent if (r + c) % 7 == 0 else (255, 255, 255)
            d.rounded_rectangle([kx0, ky0, kx1, ky1], radius=kw * 0.14, outline=LINE_SOFT, width=max(1, int(s * 0.004)), fill=fill)
    # space bar
    sb_y0 = body[1] + pad + rows * kh + kh * 0.06
    sb_y1 = sb_y0 + kh * 0.6
    d.rounded_rectangle([body[0] + w * 0.28, sb_y0, body[2] - w * 0.28, sb_y1], radius=kw * 0.16, outline=LINE_SOFT, width=max(1, int(s * 0.004)), fill=(255, 255, 255))


def draw_headphones(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    band_bbox = [x0 + w * 0.08, y0 - h * 0.12, x1 - w * 0.08, y0 + h * 0.62]
    d.arc(band_bbox, 200, 340, fill=LINE, width=max(3, int(s * 0.018)))
    r = w * 0.16
    for ex in (x0 + w * 0.14, x1 - w * 0.14):
        cy = y0 + h * 0.56
        d.rounded_rectangle([ex - r * 0.7, cy - r * 1.1, ex + r * 0.7, cy + r * 1.1], radius=r * 0.6, outline=LINE, width=max(2, int(s * 0.012)), fill=accent)
        d.rounded_rectangle([ex - r * 0.35, cy - r * 0.5, ex + r * 0.35, cy + r * 0.5], radius=r * 0.3, outline=None, fill=lerp(accent, (255, 255, 255), 0.5))


def draw_backpack(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    body = [x0 + w * 0.18, y0 + h * 0.10, x1 - w * 0.18, y1 - h * 0.02]
    d.rounded_rectangle(body, radius=w * 0.14, outline=LINE, width=max(2, int(s * 0.012)), fill=(255, 255, 255))
    hb = [x0 + w * 0.40, y0 - h * 0.02, x1 - w * 0.40, y0 + h * 0.14]
    d.arc(hb, 200, 340, fill=LINE, width=max(2, int(s * 0.010)))
    pocket = [body[0] + w * 0.10, body[1] + h * 0.40, body[2] - w * 0.10, body[3] - h * 0.10]
    d.rounded_rectangle(pocket, radius=w * 0.08, outline=LINE_SOFT, width=max(1, int(s * 0.006)), fill=accent)
    d.line([x0 + w * 0.24, body[1], x0 + w * 0.20, y1], fill=LINE_SOFT, width=max(2, int(s * 0.008)))
    d.line([x1 - w * 0.24, body[1], x1 - w * 0.20, y1], fill=LINE_SOFT, width=max(2, int(s * 0.008)))


def draw_mug(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    body = [x0 + w * 0.22, y0 + h * 0.10, x1 - w * 0.22, y1 - h * 0.04]
    d.rounded_rectangle(body, radius=w * 0.05, outline=LINE, width=max(2, int(s * 0.012)), fill=accent)
    lid = [body[0] - w * 0.01, body[1] - h * 0.05, body[2] + w * 0.01, body[1] + h * 0.06]
    d.rounded_rectangle(lid, radius=w * 0.03, outline=LINE, width=max(2, int(s * 0.010)), fill=(255, 255, 255))
    hb = [body[2] - w * 0.09, y0 + h * 0.28, body[2] + w * 0.16, y0 + h * 0.66]
    d.arc(hb, 300, 70, fill=LINE, width=max(3, int(s * 0.016)))


def draw_apparel(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    body = [
        (cx - w * 0.20, y0 + h * 0.10), (cx + w * 0.20, y0 + h * 0.10),
        (cx + w * 0.20, y1 - h * 0.04), (cx - w * 0.20, y1 - h * 0.04),
    ]
    sleeves_l = [(x0 + w * 0.02, y0 + h * 0.20), (cx - w * 0.20, y0 + h * 0.10), (cx - w * 0.18, y0 + h * 0.32), (x0 + w * 0.10, y0 + h * 0.42)]
    sleeves_r = [(x1 - w * 0.02, y0 + h * 0.20), (cx + w * 0.20, y0 + h * 0.10), (cx + w * 0.18, y0 + h * 0.32), (x1 - w * 0.10, y0 + h * 0.42)]
    d.polygon(sleeves_l, outline=LINE, fill=(255, 255, 255))
    d.polygon(sleeves_r, outline=LINE, fill=(255, 255, 255))
    d.polygon(body, outline=LINE, fill=accent)
    d.arc([cx - w * 0.10, y0 + h * 0.04, cx + w * 0.10, y0 + h * 0.20], 20, 160, fill=LINE, width=max(2, int(s * 0.010)))
    d.line([cx, y0 + h * 0.20, cx, y1 - h * 0.10], fill=LINE_SOFT, width=max(1, int(s * 0.004)))


def draw_desk(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    screen = [x0 + w * 0.10, y0 + h * 0.08, x1 - w * 0.10, y0 + h * 0.62]
    d.rounded_rectangle(screen, radius=w * 0.03, outline=LINE, width=max(2, int(s * 0.012)), fill=(255, 255, 255))
    d.rectangle([screen[0] + w * 0.04, screen[1] + h * 0.05, screen[2] - w * 0.04, screen[3] - h * 0.05], fill=accent)
    neck = [(x0 + x1) / 2 - w * 0.02, screen[3], (x0 + x1) / 2 + w * 0.02, screen[3] + h * 0.10]
    d.rectangle(neck, fill=LINE)
    base = [(x0 + x1) / 2 - w * 0.16, screen[3] + h * 0.10, (x0 + x1) / 2 + w * 0.16, screen[3] + h * 0.14]
    d.rounded_rectangle(base, radius=h * 0.02, fill=LINE)
    mat = [x0 + w * 0.04, y1 - h * 0.14, x1 - w * 0.04, y1 - h * 0.02]
    d.rounded_rectangle(mat, radius=w * 0.02, outline=LINE_SOFT, width=max(1, int(s * 0.006)), fill=lerp(accent, (255, 255, 255), 0.6))


def draw_stickers(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2

    def star(cx, cy, r, fill):
        pts = []
        for i in range(10):
            ang = -math.pi / 2 + i * math.pi / 5
            rr = r if i % 2 == 0 else r * 0.42
            pts.append((cx + rr * math.cos(ang), cy + rr * math.sin(ang)))
        d.polygon(pts, outline=LINE, fill=fill)

    star(cx - w * 0.16, cy - h * 0.10, w * 0.14, accent)
    d.ellipse([cx + w * 0.02, cy - h * 0.22, cx + w * 0.30, cy + h * 0.06], outline=LINE, width=max(2, int(s * 0.010)), fill=(255, 255, 255))
    d.rounded_rectangle([cx - w * 0.06, cy + h * 0.08, cx + w * 0.22, cy + h * 0.30], radius=w * 0.04, outline=LINE, width=max(2, int(s * 0.010)), fill=lerp(accent, (255, 255, 255), 0.45))


def draw_webcam(d, box, accent, s):
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, y0 + h * 0.36
    body = [cx - w * 0.20, cy - h * 0.16, cx + w * 0.20, cy + h * 0.16]
    d.rounded_rectangle(body, radius=w * 0.10, outline=LINE, width=max(2, int(s * 0.012)), fill=(255, 255, 255))
    r = w * 0.12
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=LINE, width=max(2, int(s * 0.010)), fill=accent)
    d.ellipse([cx - r * 0.4, cy - r * 0.4, cx + r * 0.4, cy + r * 0.4], fill=lerp(accent, (0, 0, 0), 0.35))
    d.ellipse([cx + w * 0.14, cy - h * 0.14, cx + w * 0.20, cy - h * 0.08], fill=(234, 89, 6))
    clip = [(cx - w * 0.02, body[1]), (cx - w * 0.02, y0 + h * 0.02), (cx + w * 0.10, y0 + h * 0.02)]
    d.line(clip, fill=LINE_SOFT, width=max(2, int(s * 0.008)))


ICON_DRAW = {
    "Keyboards": draw_keyboard,
    "Headphones": draw_headphones,
    "Backpacks": draw_backpack,
    "Drinkware": draw_mug,
    "Apparel": draw_apparel,
    "Desk Accessories": draw_desk,
    "Stickers & Decor": draw_stickers,
    "Webcams & Audio": draw_webcam,
}


def render(cat, name, accent_name, size, caption=True):
    accent = SWATCH.get(accent_name, (200, 150, 100))
    img = background(size, cat, accent)
    d = ImageDraw.Draw(img)
    icon_accent = accent if accent_name not in ("Off-White", "Sand") else lerp(accent, (120, 90, 40), 0.35)
    box = (size * 0.24, size * 0.20, size * 0.76, size * 0.78)
    ICON_DRAW[cat](d, box, icon_accent, size)
    if caption:
        try:
            font = ImageFont.truetype(FONT_REG, int(size * 0.032))
        except Exception:
            font = ImageFont.load_default()
        d.text((size * 0.05, size * 0.90), name, font=font, fill=CAPTION)
    return add_grain(img)


def main():
    with open(os.path.join(ROOT, "products-data.json")) as f:
        products = json.load(f)

    for p in products:
        cat = p["category"]
        accent_name = (p.get("colors") or ["Rust Orange"])[0]
        pid = p["id"]

        # Sized and compressed to land in the same ballpark as a real storefront's payloads,
        # so image-loading / lazy-load / payload-weight tests see realistic network behavior.
        detail = render(cat, p["name"], accent_name, 1200, caption=True)
        detail.save(os.path.join(OUT_PRODUCTS, f"p{pid}-detail.png"), format="PNG", optimize=True)

        card = render(cat, p["name"], accent_name, 800, caption=True)
        card.save(os.path.join(OUT_PRODUCTS, f"p{pid}-card.jpg"), format="JPEG", quality=92, optimize=True, subsampling=0)

        thumb = render(cat, p["name"], accent_name, 240, caption=False)
        thumb.save(os.path.join(OUT_PRODUCTS, f"p{pid}-thumb.webp"), format="WEBP", quality=85)

    for cat, slug in CATEGORY_SLUG.items():
        size = 1200
        h = int(size * 0.75)
        img = Image.new("RGB", (size, h))
        top, bottom = CATEGORY_BG[cat]
        px = img.load()
        for y in range(h):
            t = y / (h - 1)
            row = lerp(top, bottom, t)
            for x in range(size):
                px[x, y] = row
        d = ImageDraw.Draw(img)
        box = (size * 0.26, h * 0.10, size * 0.74, h * 0.86)
        ICON_DRAW[cat](d, box, SWATCH["Rust Orange"], int(size * 0.7))
        img = add_grain(img)
        img.save(os.path.join(OUT_CATEGORIES, f"{slug}.jpg"), format="JPEG", quality=92, optimize=True, subsampling=0)

    print(f"Generated {len(products) * 3} product images and {len(CATEGORY_SLUG)} category images")


if __name__ == "__main__":
    main()
