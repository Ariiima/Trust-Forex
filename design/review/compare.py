"""Compare a build screenshot against a Figma frame render.

The frame includes iOS status bar (32px) + Telegram header (44px) which the app
deliberately does not draw, so the build is offset by CHROME px. Reports a
per-row difference profile so drift is easy to localise.
"""
import sys
from PIL import Image, ImageChops

CHROME = 76

def load(p):
    return Image.open(p).convert('RGB')

def main(ref_p, build_p, out_p, chrome=CHROME):
    ref, build = load(ref_p), load(build_p)
    ref = ref.crop((0, chrome, ref.width, ref.height))          # drop chrome
    h = min(ref.height, build.height)
    ref, build = ref.crop((0,0,360,h)), build.crop((0,0,360,h))
    diff = ImageChops.difference(ref, build)
    px = list(diff.getdata())
    mean = sum(sum(p) for p in px)/(len(px)*3)
    bad = sum(1 for p in px if max(p) > 24)
    print(f'  compared {360}x{h}  mean={mean:.2f}  pixels>24: {bad} ({100*bad/len(px):.1f}%)')
    # worst rows
    rows = []
    for y in range(h):
        row = [diff.getpixel((x,y)) for x in range(0,360,4)]
        rows.append((sum(max(p) for p in row)/len(row), y))
    rows.sort(reverse=True)
    worst = [f'y={y}({v:.0f})' for v,y in rows[:8] if v > 8]
    if worst: print('  worst rows:', ', '.join(worst))
    diff.point(lambda v: min(255, v*4)).save(out_p)

if __name__ == '__main__':
    main(*sys.argv[1:4], int(sys.argv[4]) if len(sys.argv)>4 else CHROME)
