"""Crop a proto-embed screenshot down to just the frame.

The embed centres the frame on a black backdrop inside whatever viewport the
capture used, so the frame's y-offset varies per capture. Detect the non-
backdrop rows and cut to exactly the frame box.
"""
import sys
from PIL import Image

def crop(path, out=None):
    im = Image.open(path).convert('RGB')
    px, (W, H) = im.load(), im.size
    bg = px[2, 2]
    rows = [y for y in range(H) if not all(px[x, y] == bg for x in range(0, W, 8))]
    cols = [x for x in range(W) if not all(px[x, y] == bg for y in range(0, H, 8))]
    box = (min(cols), min(rows), max(cols) + 1, max(rows) + 1)
    out = out or path
    im.crop(box).save(out)
    print(f'{path} -> {box[2]-box[0]}x{box[3]-box[1]}')

if __name__ == '__main__':
    for p in sys.argv[1:]:
        crop(p)
