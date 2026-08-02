"""Minimal but command-aware SVG path point extractor — enough to get a bbox.
Counting raw numbers does not work here: x and y share the 16..40 range, so a
number-frequency heuristic misclassifies which style variant a path belongs to
(that is how a solid 'wallet2' got shipped)."""
import re
TOK = re.compile(r'[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?')
ARGS = {'M':2,'L':2,'H':1,'V':1,'C':6,'S':4,'Q':4,'T':2,'A':7,'Z':0}

def points(d):
    toks = TOK.findall(d)
    i = 0; cur = (0.0, 0.0); start = (0.0, 0.0); cmd = None; pts = []
    while i < len(toks):
        t = toks[i]
        if t.isalpha():
            cmd = t; i += 1
            if cmd.upper() == 'Z':
                cur = start; continue
        elif cmd is None:
            i += 1; continue
        u = cmd.upper(); rel = cmd.islower(); n = ARGS[u]
        if i + n > len(toks): break
        a = [float(v) for v in toks[i:i + n]]; i += n
        if u == 'H':   nxt = (cur[0] + a[0] if rel else a[0], cur[1])
        elif u == 'V': nxt = (cur[0], cur[1] + a[0] if rel else a[0])
        else:
            xs = a[-2], a[-1]
            nxt = (cur[0] + xs[0], cur[1] + xs[1]) if rel else xs
            # control points too — they bound the curve generously enough
            for k in range(0, n - 2, 2):
                if u == 'A' and k < 5: continue
                px, py = a[k], a[k + 1]
                pts.append((cur[0] + px, cur[1] + py) if rel else (px, py))
        pts.append(nxt); cur = nxt
        if u == 'M': start = nxt
        if u == 'M': cmd = 'l' if rel else 'L'   # subsequent pairs are implicit lineto
    return pts

def bbox(d):
    p = points(d)
    if not p: return None
    xs = [q[0] for q in p]; ys = [q[1] for q in p]
    return min(xs), min(ys), max(xs), max(ys)
