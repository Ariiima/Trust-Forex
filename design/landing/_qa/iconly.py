#!/usr/bin/env python3
"""Iconly's animated icons for the Cashback page, through their MCP server (needs the Pro key in ICONLY_KEY).

    ICONLY_KEY=iconly_sk_… python3 design/landing/_qa/iconly.py search "dollar receive"
    ICONLY_KEY=iconly_sk_… python3 design/landing/_qa/iconly.py favorites      # what he starred in the Iconly app
    ICONLY_KEY=iconly_sk_… python3 design/landing/_qa/iconly.py pull user=3995 dollar-receive=4609x1.4

`pull` writes cb8/ico/<slug>.json, compact.

The slots on Results, Referral and the blog (pulled 2026-09-09): target=1106 tick-square=261 time-circle=3077
activity=2674 graph=2625 show=1133 document=1338 shield-done=1052 global=4165 send=4402 info-circle=238
tick-circle=231 danger=269 close-circle=268 web-page=2375 link=2757 wallet-check=2349 clock-close=3082. activity and graph are Iconly's "ai" icons with sparkle
particles: after pulling, keep only layer ind 1-5 of activity (arrowhead + polyline) and the layers named
Layer 1 / Layer 3 / Elastic Control Layer of graph — the rest are the sparkles (off-brand, BRAND.md). `x1.4` widens every stroke — Iconly animates only its
Light weight, so the founder's Bold picks are the Light file with thicker strokes. The four in
cb8 today: analytics=2383 dollar-receive=4609x1.4 user=3988 coins=631 (CASHBACK-NEXT §15), and from 2026-09-09
the step numbers number-1-circle=3671 number-2-circle=3679 number-3-circle=3687 number-4-circle=3695 plus the two
account-setup rows search-list=2840 add-user=3894 — the first variant of each in the web grid's order, which
search_animations reproduces (the grid labels those two "LIGHT", the API names them Search list / Add user)."""
import json, os, sys, urllib.request
from pathlib import Path

URL = 'https://mcp.iconly.pro/mcp'
OUT = Path(__file__).resolve().parent.parent / 'cb8' / 'ico'
HEADERS = {'Authorization': 'Bearer ' + os.environ['ICONLY_KEY'], 'User-Agent': 'Mozilla/5.0',
           'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'}


def post(body, sid=None):
    h = dict(HEADERS, **({'Mcp-Session-Id': sid} if sid else {}))
    r = urllib.request.urlopen(urllib.request.Request(URL, json.dumps(body).encode(), h), timeout=60)
    raw, sid = r.read().decode(), r.headers.get('Mcp-Session-Id', sid)
    data = [l[5:] for l in raw.splitlines() if l.startswith('data:')]   # the server answers as an event stream
    return (json.loads(data[-1]) if data else None), sid


def call(tool, args):
    _, sid = post({'jsonrpc': '2.0', 'id': 1, 'method': 'initialize', 'params': {'protocolVersion': '2025-03-26', 'capabilities': {}, 'clientInfo': {'name': 'tf', 'version': '1'}}})
    post({'jsonrpc': '2.0', 'method': 'notifications/initialized'}, sid)
    res, _ = post({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/call', 'params': {'name': tool, 'arguments': args}}, sid)
    if 'error' in res: raise SystemExit(res['error'])
    return json.loads(res['result']['content'][0]['text'])


def widen(node, k):
    if isinstance(node, dict):
        if node.get('ty') == 'st' and 'w' in node:
            w = node['w']
            if w.get('a'):
                for kf in w['k']:
                    if 's' in kf: kf['s'] = [v * k for v in kf['s']]
            else: w['k'] *= k
        for v in node.values(): widen(v, k)
    elif isinstance(node, list):
        for v in node: widen(v, k)


if __name__ == '__main__':
    cmd, *rest = sys.argv[1:] or ['help']
    if cmd == 'search':
        for x in call('search_animations', {'q': ' '.join(rest), 'page_size': 40})['animations']:
            print(x['id'], repr(x['name']), x['style']['name'], x['category']['name'], x['gif_url'])
    elif cmd == 'favorites':   # the MCP has no favourites filter; the web API takes the same key as a bearer
        req = urllib.request.Request('https://prod.iconly.pro/api/v1/animations?is_favorite=1&page_size=100',
                                     headers={'Authorization': 'Bearer ' + os.environ['ICONLY_KEY'], 'User-Agent': 'Mozilla/5.0'})
        for x in json.load(urllib.request.urlopen(req, timeout=60))['data']['animations']:
            print(x['id'], repr(x['name']), x['style']['name'], x['category']['name'], x['gif_url'])
    elif cmd == 'pull':
        for arg in rest:
            slug, spec = arg.split('='); id, _, mult = spec.partition('x')
            d = call('fetch_animation_lottie', {'id': int(id)}); c = d['content']
            assert c.get('layers'), d
            if mult: widen(c, float(mult))
            body = json.dumps(c, separators=(',', ':'))
            (OUT / f'{slug}.json').write_text(body)
            print(slug, id, d['name'], len(body) // 1024, 'KB', 'frames', c['op'])
    else:
        print(__doc__)
