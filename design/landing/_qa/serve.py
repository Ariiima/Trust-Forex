#!/usr/bin/env python3
"""Preview the landing pages with caching off.

    python3 _qa/serve.py [port]      # default 5311, the port every QA script expects

`python3 -m http.server` answers with nothing but Last-Modified, so a browser is free to cache the
HTML heuristically and keep serving it. The stylesheets and scripts carry `?v=` hashes and would
refresh — but only if the page asking for them is the new one, and a cached page asks for the old
hashes. The whole page goes stale together and an edit looks like it did nothing (2026-09-12).

Same server, one extra header: nothing is stored, so a reload is always the file on disk.
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


class NoStore(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def log_message(self, fmt, *args):        # one line per request is enough; no date prefix
        sys.stderr.write('%s\n' % (fmt % args))


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5311
    # ASCII only: this console is cp1252 and an arrow here kills the server before it starts
    print(f'landing preview on http://localhost:{port}/   (no-store, Ctrl+C to stop)')
    ThreadingHTTPServer(('127.0.0.1', port), partial(NoStore, directory=str(ROOT))).serve_forever()
