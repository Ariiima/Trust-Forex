#!/usr/bin/env python3
"""Splice cb8's nav into every sibling page that carries a `<!--NAV <Page>-->` marker, marking that page current.
The nav is written once, in cb8/index.html; Results, Referral and About take it from there so the four
pages can never drift apart. Re-run after editing cb8's nav."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
cb8 = (ROOT / 'cb8/index.html').read_text()
nav = re.search(r'<header class="nav" id="nav">.*?</header>', cb8, re.S)[0]
# the cashback page's own link is the hash + current marker; on a sibling it is a plain link back
nav = nav.replace('<a href="#hero" aria-current="page">Cashback</a>', '<a href="../cb8/">Cashback</a>')
for page in ROOT.glob('*/index.html'):
    text = page.read_text()
    m = re.search(r'<!--NAV (\w+)-->|<header class="nav" id="nav">.*?</header><!--/NAV (\w+)-->', text, re.S)
    if not m or page.parent.name == 'cb8': continue
    cur = m[1] or m[2]
    here = nav.replace(f'href="../{page.parent.name}/">{cur}</a>', f'href="#hero" aria-current="page">{cur}</a>')
    page.write_text(text[:m.start()] + here + f'<!--/NAV {cur}-->' + text[m.end():])
    print(page.parent.name, 'current:', cur, '(link found)' if 'aria-current' in here else '(no nav entry)')
