"""Generate FlowMaster PWA icons: a clean water-droplet mark on brand blue.
Produces standard + maskable icons and a favicon. Run: python3 make_icons.py
"""
from PIL import Image, ImageDraw
import math, os

BLUE = (15, 98, 184)        # --brand-600
BLUE_DK = (10, 71, 135)     # deeper blue for gradient base
WHITE = (255, 255, 255)

def droplet_points(cx, cy, r, n=240):
    """Parametric teardrop: round bottom, pointed top."""
    pts = []
    for i in range(n + 1):
        t = math.pi * 2 * i / n
        # base circle
        x = math.sin(t)
        y = -math.cos(t)
        # pull the top into a point
        pinch = (1 - math.cos(t)) / 2  # 0 at bottom, 1 at top
        y *= (1 + 0.55 * pinch)
        x *= (1 - 0.35 * pinch)
        pts.append((cx + x * r, cy + y * r * 0.78 - r * 0.18))
    return pts

def make(size, pad_ratio=0.0, fname="icon.png", bg=True):
    scale = 4
    S = size * scale
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pad = int(S * pad_ratio)
    box = S - 2 * pad
    radius = int(box * 0.22)
    if bg:
        # vertical-ish brand gradient
        for y in range(box):
            f = y / max(1, box - 1)
            r = int(BLUE[0] * (1 - f) + BLUE_DK[0] * f)
            g = int(BLUE[1] * (1 - f) + BLUE_DK[1] * f)
            b = int(BLUE[2] * (1 - f) + BLUE_DK[2] * f)
            d.line([(pad, pad + y), (pad + box, pad + y)], fill=(r, g, b, 255))
        # rounded mask
        mask = Image.new("L", (S, S), 0)
        ImageDraw.Draw(mask).rounded_rectangle(
            [pad, pad, pad + box, pad + box], radius=radius, fill=255)
        bgimg = img.copy()
        img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
        img.paste(bgimg, (0, 0), mask)
        d = ImageDraw.Draw(img)
    # droplet
    cx, cy = S / 2, S / 2 + box * 0.04
    r = box * 0.30
    d.polygon(droplet_points(cx, cy, r), fill=WHITE)
    # highlight cut to read as water
    hl = droplet_points(cx + r * 0.16, cy + r * 0.10, r * 0.52)
    d.polygon(hl, fill=(210, 230, 250, 255))
    img = img.resize((size, size), Image.LANCZOS)
    img.save(fname)

here = os.path.dirname(os.path.abspath(__file__))
make(192, 0.0,  os.path.join(here, "icon-192.png"))
make(512, 0.0,  os.path.join(here, "icon-512.png"))
make(512, 0.16, os.path.join(here, "icon-maskable-512.png"))  # safe zone padding
make(32,  0.0,  os.path.join(here, "favicon-32.png"))
make(180, 0.0,  os.path.join(here, "apple-touch-icon.png"))
print("icons generated")
