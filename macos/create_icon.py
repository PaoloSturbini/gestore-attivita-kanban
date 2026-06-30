#!/usr/bin/env python3
import math
import os
import struct
import subprocess
import zlib

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
ASSET_DIR = os.path.join(ROOT, "macos", "Assets")
ICONSET = os.path.join(ASSET_DIR, "AppIcon.iconset")
PNG_1024 = os.path.join(ASSET_DIR, "AppIcon1024.png")
ICNS = os.path.join(ASSET_DIR, "AppIcon.icns")


def blend(dst, src):
    sr, sg, sb, sa = src
    if sa == 255:
        return (sr, sg, sb, 255)
    dr, dg, db, da = dst
    a = sa / 255
    return (
        round(sr * a + dr * (1 - a)),
        round(sg * a + dg * (1 - a)),
        round(sb * a + db * (1 - a)),
        255,
    )


def rounded_rect(img, width, height, x, y, w, h, r, color):
    x0, y0, x1, y1 = x, y, x + w, y + h
    for py in range(max(0, y0), min(height, y1)):
        for px in range(max(0, x0), min(width, x1)):
            dx = max(x0 + r - px, 0, px - (x1 - r - 1))
            dy = max(y0 + r - py, 0, py - (y1 - r - 1))
            if dx * dx + dy * dy <= r * r:
                idx = py * width + px
                img[idx] = blend(img[idx], color)


def shadow(img, width, height, x, y, w, h, r, spread, alpha):
    for offset in range(spread, 0, -1):
        a = int(alpha * (offset / spread) ** 2)
        rounded_rect(img, width, height, x - offset, y - offset + 18, w + offset * 2, h + offset * 2, r + offset, (25, 33, 48, a))


def write_png(path, width, height, pixels):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            raw.extend(pixels[y * width + x])

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as handle:
        handle.write(png)


def make_icon():
    size = 1024
    pixels = [(0, 0, 0, 0)] * (size * size)

    shadow(pixels, size, size, 92, 92, 840, 840, 190, 42, 70)
    rounded_rect(pixels, size, size, 92, 92, 840, 840, 190, (82, 183, 243, 255))
    rounded_rect(pixels, size, size, 126, 126, 772, 772, 158, (255, 255, 255, 38))

    colors = [
        ((240, 249, 235, 255), (86, 131, 62, 255)),
        ((237, 248, 243, 255), (65, 143, 102, 255)),
        ((241, 239, 250, 255), (102, 86, 221, 255)),
    ]
    col_w = 214
    gap = 34
    start_x = 176
    top = 210
    col_h = 604

    for i, (bg, accent) in enumerate(colors):
        x = start_x + i * (col_w + gap)
        shadow(pixels, size, size, x, top, col_w, col_h, 44, 16, 28)
        rounded_rect(pixels, size, size, x, top, col_w, col_h, 44, bg)
        rounded_rect(pixels, size, size, x + 28, top + 28, 130, 44, 18, accent)

        for j in range(4):
            card_y = top + 104 + j * 108
            if i == 2 and j > 1:
                continue
            rounded_rect(pixels, size, size, x + 24, card_y, col_w - 48, 76, 18, (255, 255, 255, 245))
            rounded_rect(pixels, size, size, x + 44, card_y + 21, 82 + j * 8, 10, 5, (67, 74, 88, 165))
            rounded_rect(pixels, size, size, x + 44, card_y + 46, 122 - j * 10, 8, 4, (82, 183, 243, 135))

    rounded_rect(pixels, size, size, 407, 820, 210, 36, 18, (255, 255, 255, 80))
    write_png(PNG_1024, size, size, pixels)


def build_iconset():
    os.makedirs(ICONSET, exist_ok=True)
    sizes = [
        (16, "icon_16x16.png"),
        (32, "icon_16x16@2x.png"),
        (32, "icon_32x32.png"),
        (64, "icon_32x32@2x.png"),
        (128, "icon_128x128.png"),
        (256, "icon_128x128@2x.png"),
        (256, "icon_256x256.png"),
        (512, "icon_256x256@2x.png"),
        (512, "icon_512x512.png"),
        (1024, "icon_512x512@2x.png"),
    ]
    for pixels, name in sizes:
        destination = os.path.join(ICONSET, name)
        subprocess.run(["sips", "-z", str(pixels), str(pixels), PNG_1024, "--out", destination], check=True, stdout=subprocess.DEVNULL)
    subprocess.run(["iconutil", "-c", "icns", ICONSET, "-o", ICNS], check=True)


if __name__ == "__main__":
    os.makedirs(ASSET_DIR, exist_ok=True)
    make_icon()
    build_iconset()
    print(ICNS)
