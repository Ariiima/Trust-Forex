"""Turn the Figma "Global icons" export into src/design-system/components/Icon.tsx.

    # export the icon pack out of Figma as SVG into a folder, then:
    python3 design/icons/extract.py > /tmp/paths.json
    python3 design/icons/write_icon_tsx.py /tmp/paths.json

Each exported file is one icon *component*, stacking its four style variants
(Stroke / Solid / Duo stroke / Duo color) 40px apart, the first as a 24x24
symbol at (16,16). The names in MAP below are the pack's own, taken from the
`name=` attributes in design/figma-meta - which is what the frames actually
instantiate, so it beats guessing between e.g. cash1 and cash2.
"""
import re, os, json, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from svgpath import bbox
D = "/Users/hamidrezanasrabadi/Downloads/Trust Forex"
MAP = {
 'home':'home','currency-dollar':'currency-dollar1','users':'users','award':'award','check':'check',
 'info':'info','arrow-up':'arrow-up','chevron-right':'chevron-right','alert-circle':'alert-circle',
 'alert-triangle':'alert-triangle','close':'close','report':'report','wallet':'wallet1','scan':'scan',
 'back':'chevron-left','shield':'shield','calendar':'date-range','trending-up':'trending-up',
 'chevron-down':'chevron-down','dots-vertical':'more-vertical','copy':'copy-2','check-circle':'check-circle',
 'clock-hour-5':'clock-hour-5','loader':'loader','loader-2':'loader-2','user-receive':'user-receive',
 'user-check':'user-check','shopping-bag':'shopping-bag3','cash':'cash2','send':'send-1','globe':'globe',
 'user':'user-2','swap-vertical':'swap-verticle','mail':'mail','external':'external-link',
}
PATH = re.compile(r'<path\b[^>]*>')

def band0(f):
    """Paths of the first stacked style variant — a 24x24 symbol at (16,16).

    Two things bite here. Some icons ship that variant as real strokes and
    others as outlined fills (calendar, check-circle), so the render mode has
    to travel with the data. And the fill/stroke test alone is not enough:
    a Solid variant is also a fill, so the bbox has to pin the band."""
    s = open(os.path.join(D, f + '.svg')).read()
    out = []
    for a in PATH.findall(s):
        m = re.search(r'\sd="([^"]+)"', a)
        if not m:
            continue
        bb = bbox(m.group(1))
        if bb and 12 <= bb[0] and 12 <= bb[1] and bb[2] <= 44 and bb[3] <= 44:
            out.append((' '.join(m.group(1).split()), 'stroke=' in a))
    return out

res = {}
for name, f in MAP.items():
    ps = band0(f)
    assert ps, f'no first-variant paths for {name} ({f})'
    res[name] = {'d': [d for d, _ in ps], 'fill': not all(st for _, st in ps)}
json.dump(res, sys.stdout, indent=0)
