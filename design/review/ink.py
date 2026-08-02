"""Measure the ink of a text run in a Figma frame and a build shot.

    python3 design/review/ink.py <ref-name> <build.png> <x> <y> <w> <h> [label]

Coordinates are BUILD space (chrome already removed); the reference is shifted
by CHROME to match. Reports the ink bounding box and the tallest run of rows
that carry ink, which is what actually reveals a font-size mismatch — a 14px
and a 12px caption differ by ~2px of cap height, far too little to eyeball but
unambiguous in a row profile.
"""
import sys
import numpy as np
from PIL import Image

CHROME = 76

ref_name, build, x, y, w, h = sys.argv[1:7]
x, y, w, h = int(x), int(y), int(w), int(h)
label = sys.argv[7] if len(sys.argv) > 7 else ''


def measure(img, box, name):
    crop = np.array(img.crop(box).convert('RGB')).astype(int)
    # Background = the most common colour in the crop; ink = anything far from it.
    cols, counts = np.unique(crop.reshape(-1, 3), axis=0, return_counts=True)
    bg = cols[counts.argmax()]
    d = np.abs(crop - bg).sum(axis=2)
    mask = d > 60
    if not mask.any():
        print(f'  {name:7} no ink (bg {tuple(bg)})')
        return
    ys, xs = np.where(mask)
    rows = mask.sum(axis=1)
    lit = np.where(rows > 0)[0]
    print(f'  {name:7} bg{tuple(bg)}  ink x[{xs.min()}..{xs.max()}] y[{lit.min()}..{lit.max()}]'
          f'  cap-height {lit.max() - lit.min() + 1}px  width {xs.max() - xs.min() + 1}px  mass {int(mask.sum())}')


print(f'{label or "region"}  ({w}x{h} at {x},{y})')
measure(Image.open(f'design/review/ref/{ref_name}.png'), (x, y + CHROME, x + w, y + CHROME + h), 'design')
measure(Image.open(build), (x, y, x + w, y + h), 'build')
