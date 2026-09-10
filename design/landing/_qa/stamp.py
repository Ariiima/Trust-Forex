"""Refresh cache keys on every landing page, from leaf imports to HTML.
Each `<asset>?v=` names a file relative to the file it sits in; the key is that file's digest.
Order matters: scale → base → style → each page's stylesheet → each page's HTML."""
from pathlib import Path
import hashlib
import re

ROOT = Path(__file__).resolve().parent.parent


def digest(path):
    return hashlib.sha1(path.read_bytes()).hexdigest()[:8]


def stamp(path):
    text = path.read_text()

    def sub(m):
        dep = (path.parent / m[1]).resolve()
        assert dep.exists(), f'{m[1]} missing (from {path})'
        return f'{m[1]}?v={digest(dep)}'
    # newline='\n': the platform default turned every stamped file CRLF on Windows
    path.write_text(re.sub(r"([\w./-]+\.(?:css|js))\?v=[^'\")\s]+", sub, text), newline='\n')


pages = sorted(p.parent for p in ROOT.glob('*/index.html'))
for f in ['cb8/base.css', 'cb8/style.css']:
    stamp(ROOT / f)
for page in pages:
    if (page / 'page.css').exists(): stamp(page / 'page.css')
for page in pages:
    stamp(page / 'index.html')
print('asset hashes refreshed:', ', '.join(p.name for p in pages))
