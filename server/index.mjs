// Trust Forex API. Plain node:http — the surface is small enough that a
// framework would be more code than the routes.
//
// Implemented so far: the once-only preview flags (referral/cashback intro
// pages). The order/gateway routes from design/CONTRACT.md still need writing;
// they share this dispatcher and the same auth helper.
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { openDb } from './db.mjs';

const PORT = Number(process.env.TF_PORT ?? 8787);
const DEV = process.env.TF_DEV === '1';
const BOT_TOKEN = process.env.TF_BOT_TOKEN ?? '';

const store = openDb();

/**
 * Validate a Telegram Mini App initData string and return its user id.
 * Spec: sort "k=v" pairs (minus `hash`) by key, join with \n, HMAC-SHA256 with
 * key = HMAC-SHA256("WebAppData", botToken), compare to `hash`.
 * Returns null when absent/invalid — callers decide whether that's fatal.
 */
function userIdFrom(req) {
  const raw = (req.headers.authorization ?? '').replace(/^tma\s+/i, '');
  if (!raw) return DEV ? 0 : null; // dev: a single anonymous user

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  params.delete('hash');
  if (!hash || !BOT_TOKEN) return DEV ? 0 : null;

  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const sig = createHmac('sha256', secret).update(check).digest('hex');
  if (sig !== hash) return DEV ? 0 : null;

  try {
    return JSON.parse(params.get('user') ?? '{}').id ?? null;
  } catch {
    return null;
  }
}

const send = (res, code, body) => {
  const json = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
  });
  res.end(json);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const userId = userIdFrom(req);
  if (userId === null) return send(res, 401, { error: 'unauthorized' });

  // GET /api/me/flags -> { flags: [...] }
  if (req.method === 'GET' && url.pathname === '/api/me/flags') {
    return send(res, 200, { flags: store.getFlags(userId) });
  }

  // POST /api/me/flags/:flag -> { flags: [...] }
  const m = url.pathname.match(/^\/api\/me\/flags\/([a-z0-9_]+)$/);
  if (req.method === 'POST' && m) {
    store.setFlag(userId, m[1]);
    return send(res, 200, { flags: store.getFlags(userId) });
  }

  send(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`[trust-forex] api on :${PORT}${DEV ? ' (TF_DEV — auth bypassed)' : ''}`);
});
