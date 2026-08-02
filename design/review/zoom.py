"""Crop the same region out of a Figma frame and a build shot, side by side.

    python3 design/review/zoom.py <ref-name> <build.png> <x> <y> <w> <h> [scale] [out.png]

Coordinates are in BUILD space (i.e. the frame with its 76px of iOS + Telegram
chrome already removed), which is the space every measurement in this repo uses.
The reference is shifted down by CHROME to match. Output is design-left,
build-right with a divider, magnified so single-pixel differences are visible.
"""
import sys
from PIL import Image

CHROME = 76

ref_name, build, x, y, w, h = sys.argv[1:7]
x, y, w, h = int(x), int(y), int(w), int(h)
scale = int(sys.argv[7]) if len(sys.argv) > 7 else 3
out = sys.argv[8] if len(sys.argv) > 8 else '/tmp/fig/zoom.png'

ref = Image.open(f'design/review/ref/{ref_name}.png').convert('RGB')
bld = Image.open(build).convert('RGB')

a = ref.crop((x, y + CHROME, x + w, y + CHROME + h))
b = bld.crop((x, y, x + w, y + h))
a = a.resize((w * scale, h * scale), Image.NEAREST)
b = b.resize((w * scale, h * scale), Image.NEAREST)

GAP = 12
canvas = Image.new('RGB', (a.width + GAP + b.width, a.height), (255, 0, 255))
canvas.paste(a, (0, 0))
canvas.paste(b, (a.width + GAP, 0))
canvas.save(out)
print(f'{out}  design | build   region {w}x{h} at ({x},{y}) x{scale}')
