import sys
from PIL import Image, ImageChops
ref = Image.open('design/review/ref/earn-history.png').convert('RGB').crop((0,76,360,852))
bld = Image.open(sys.argv[1] if len(sys.argv)>1 else '/tmp/fig/build-hist.png').convert('RGB')
TOP = 141  # sheet top inside the 776 crop
r = ref.crop((0,TOP,360,776)); b = bld.crop((0,TOP,360,776))
d = ImageChops.difference(r,b)
px = list(d.getdata())
mean = sum(sum(p) for p in px)/(len(px)*3)
bad = sum(1 for p in px if max(p) > 24)
print(f'  SHEET ONLY 360x{776-TOP}  mean={mean:.3f}  pixels>24: {bad} ({100*bad/len(px):.2f}%)')
rows=[]
for y in range(d.height):
    row=[d.getpixel((x,y)) for x in range(360)]
    rows.append((sum(max(p) for p in row)/360, y+TOP))
rows.sort(reverse=True)
print('  worst rows:', ', '.join(f'y={y}({v:.0f})' for v,y in rows[:14] if v>4))
cols=[]
for x in range(360):
    col=[d.getpixel((x,y)) for y in range(d.height)]
    cols.append((sum(max(p) for p in col)/d.height, x))
cols.sort(reverse=True)
print('  worst cols:', ', '.join(f'x={x}({v:.0f})' for v,x in cols[:14] if v>4))
d.point(lambda v: min(255, v*4)).save('/tmp/fig/diff-sheet.png')
