/**
 * MCP over Streamable HTTP, served from this process at POST /api/mcp.
 *
 * An AI agent points at https://app.trustforex.net/api/mcp with an API key minted
 * from Settings → API Keys and gets the whole dashboard. It authenticates with
 * the same bearer key the admin API takes, so the scope rules in
 * admin-routes.mjs apply here untouched.
 *
 * Two tools, not sixty. `admin_endpoints` hands over the route table and the
 * campaign doc schema; `admin_call` issues one request against it. Sixty typed
 * tools would be sixty schemas drifting out of sync with a route table that
 * already exists — this way route 61 is reachable the day it is added.
 *
 * `admin_call` re-enters handleAdmin() in-process with a synthetic req/res
 * rather than fetching this same server over HTTP: no round trip, no port or
 * TLS to know about, and auth/scope/validation all run exactly once, in the
 * place they already live.
 *
 * The transport is the lazy half of the spec: the server answers each POST
 * with a single JSON object, which Streamable HTTP allows as the alternative
 * to an SSE stream. No sessions, no GET stream, no resumability.
 * `node server/mcp.mjs` self-checks.
 */
import { Readable } from 'node:stream';
import { handleAdmin, routeList, adminStore } from './admin-routes.mjs';

/** Plans, states and trigger names the campaign editor writes. Kept beside the doc it documents. */
const PLANS = 'standard | silver | gold | diamond';
const USER_TYPES = [
  'No Subscriber', 'Active Subscriber', 'Expired Subscriber',
  'No Broker', 'Pending Broker', 'Active Broker',
  'No Referral', 'Pending Referral', 'Active Referral',
];
const TRIGGERS = [
  'After Start Robot', 'After Subscription Started', 'After Subscription Expired',
  'Remaining Subscription', 'After Pending Broker', 'No Cashback Received',
  'After Pending Referral', 'Last Referral Joined', 'After Active Referral',
  'Last Active Referral',
];

/* What each write route wants in its body, and which GETs take query
   parameters. Keyed by the readable path the route table renders to, so the
   self-check catches a note that outlived its route and a route that shipped
   without one. */
const BODY_NOTES = {
  'POST /logout': 'no body — ends a cookie session, a no-op for a key',
  'GET /session': 'who you are calling as. A key shows as "key:<name>"',
  'GET /users': `ONE ROW PER (user, broker) LINK, not per user — someone with accounts
      at two brokers appears twice. For a headcount use /users/counts or /analytics,
      never this array's length`,
  'GET /users/counts': 'the census: { all, active, pending, rejected }. all = active + pending + rejected',
  'PATCH /users/:id': 'status: active | pending | rejected',
  'POST /users/:id/decision': 'decision: approved | waiting | rejected, brokerId',
  'POST /brokers': 'name (required), status: public|private|stopped, shareRate 0..1 (default 0.3), color',
  'PUT /brokers/order': 'order: [{ id, status }] in display order',
  'GET /brokers/totals': `NOT a broker count. This is the rebate bar for the CURRENT cycle:
      brokers = how many brokers have a pending draft, totalRebate = the gross typed on
      those drafts. All three are 0 whenever nothing is drafted, however many brokers exist`,
  'GET /brokers/:id/preview': `the Mini App's broker card. Its \`status\` is a DISPLAY COPY and
      can disagree with the broker's real status from GET /brokers — the real one is
      what the app obeys`,
  'PUT /brokers/:id/preview': `the whole preview doc — GET it first, change fields, PUT it back.
      Writing \`status\` here changes nothing user-facing; broker visibility is
      PUT /brokers/order`,
  'PUT /brokers/:id/flow-messages/:id': 'message (string). Placeholders {name} {broker}',
  'POST /brokers/:id/rebate-drafts': 'userId, lastWeekRebate (number >= 0)',
  'POST /brokers/:id/rebate-drafts/publish': 'no body — publishes this broker\'s drafts',
  'POST /rebate-drafts/publish-all': 'cycleId, name, range — MONEY, needs scope "money"',
  'POST /withdrawals/:id/mark-sent': 'no body — MONEY, needs scope "money"',
  'POST /withdrawals/:id/reject': 'reason (required) — MONEY, refunds the frozen balance',
  'POST /payments/:id/confirm': 'no body — MONEY, settles an open order by hand',
  'POST /unmatched/:id/attribute': 'orderId — MONEY, books a parked transfer onto an order',
  'POST /unmatched/:id/ignore': 'no body — marks an unrelated deposit seen',
  'GET /gateways': 'the deposit wallets and confirmation depths. Readable at any scope',
  'PUT /gateways': 'the whole gateways doc — GET it first. MONEY (deposit addresses)',
  'GET /unmatched': `{ transfers, openOrders } — transfers the watcher refused to guess at,
      and the orders they could belong to`,
  'GET /alerts': 'the four queues needing a human: reviews, withdrawals, unmatched, campaignBrokers',
  'PUT /settings': 'tz: an IANA zone, e.g. "Asia/Tehran"',
  'POST /review-queue/:id/decision': 'decision: approved | waiting | rejected',
  'GET /extra-grants': 'grants already handed out. Readable at any scope',
  'GET /extra-grants/eligible': '?before=YYYY-MM-DDTHH:mm (wall clock); empty = everyone active',
  'POST /extra-grants': `purchasedBefore (wall clock), extraDays (int >= 1), message, notify (bool)
      — MONEY, hands out paid days`,
  'POST /events': 'title (required), plus whatever the events rail renders',
  'PUT /events/:id': 'the whole event',
  'POST /referral-campaigns': 'name (required), planShare, cashbackShare, endDate',
  'PUT /referral-campaigns/:id': 'name (required) + the whole campaign',
  'PATCH /referral-campaigns/:id': 'status: active | paused | ended',
  'POST /campaign-lists': 'name (required)',
  'POST /campaigns': 'see "Campaign doc" below',
  'PUT /campaigns/:id': 'see "Campaign doc" below — send the WHOLE doc, it replaces',
  'PUT /campaigns/:id/lists': 'lists: [campaignListId]',
  'PATCH /campaigns/:id': 'status: active | paused | ended',
  'PUT /message-templates/:id': 'body (non-empty string)',
  'POST /signals': 'id, period, range, total, sl, tp1..tp4 (ints >= 0), status: draft | published',
  'POST /api-keys': 'cookie session only — a key cannot mint a key',
  'GET /series/:id': '?grain=daily|cycle|weekly|monthly|quarterly&dims=a,b&from=&to=',
};

/** `^\/brokers\/([\w-]+)\/rebates$` -> `/brokers/:id/rebates` */
const readablePath = (source) => source
  .replace(/^\^/, '').replace(/\$$/, '')
  .replace(/\\\//g, '/')
  .replace(/\(\[\\w-\]\+\)/g, ':id');

/** The route table as markdown, with each route's body note beside it. */
export function endpointDoc() {
  const lines = routeList().map(([method, source]) => {
    const key = `${method} ${readablePath(source)}`;
    const note = BODY_NOTES[key];
    return note ? `- \`${key}\` — ${note}` : `- \`${key}\``;
  });
  return `# Trust Forex admin API

Every path below is relative to \`/api/admin\`. Call one with the \`admin_call\`
tool: \`{ "method": "GET", "path": "/users" }\`.

Ids: \`users.id\` is the internal key (\`tg<telegram id>\` for accounts the Mini
App created); \`userNo\` is the short number operators read. Money is USD,
timestamps are epoch milliseconds, crypto amounts are decimal strings.

Routes marked MONEY need an API key with scope \`money\`; a \`write\` key gets
403 on them. Only the mutating verb is gated — \`GET /gateways\` and
\`GET /extra-grants\` read fine at any scope. A \`read\` key is GET-only. No key
can touch \`/api-keys\`.

## Counting things

Three endpoints look like counts and are not, so check here before reporting a
number:

- **\`GET /users\` is one row per (user, broker) link.** Its length is not the
  user count. \`GET /users/counts\` and \`GET /analytics\` give the census.
- **\`GET /brokers/totals\`.\`brokers\` counts brokers with a *pending rebate
  draft*, not brokers.** \`GET /brokers\` is the broker list.
- **Campaign \`messageSent\` / \`openRate\` / \`codeSent\` are counted live** from
  the send tables, and are \`null\` — not 0 — when nothing has happened yet.

## Endpoints

${lines.join('\n')}

## Campaign doc

\`POST /campaigns\` and \`PUT /campaigns/:id\` store the whole body as the
campaign. PUT replaces — read the campaign from \`GET /campaigns\` first,
change the fields you want, and send it all back. A campaign fires once per
occurrence of its trigger per user.

Only \`name\` is required. A campaign matches a user when the audience, the
state matrix and the timing trigger all hold.

**Identity** — \`name\`, \`status\`: active | paused | ended (default active).

**Audience** — \`allUsers\` (bool, default true). When false, narrow with
\`referralLists\` and \`brokerLists\`: each a single comma-separated string of
*display names* ("Summer Push, Winter"), OR within a list, AND across the two.

**State matrix** — \`userTypes\`: array from ${USER_TYPES.map((t) => `"${t}"`).join(', ')}.
Nothing ticked on an axis means that axis is not filtered. \`audiencePlans\`:
array of ${PLANS} — narrows the subscriber branches only.

**Trigger** — \`triggerType\`: one of ${TRIGGERS.map((t) => `"${t}"`).join(', ')}.
\`triggerN\` (number, default 7) and \`triggerUnit\` (second/minute/hour/day/week/month)
are the offset after the anchor event. "Remaining Subscription" is the one
trigger that counts backwards, firing that long *before* expiry.

**Limits** — \`limitType\`: "Send Limit" caps messages per user, "Usage Limit"
caps code redemptions per user. \`sendLimit\` / \`usageLimit\`: "one" | "two" | "three".

**Offer** — \`discountValue\` (percent; 0 = no offer, mints no code),
\`applicablePlans\` (array of ${PLANS}), \`codeType\`: "unique" mints a
single-user code, "public" reuses \`publicCode\` (required, else the send goes
out with a blank code). \`includeCode\` / \`showCode\` put it in the message.
\`expiryN\` + \`expiryUnit\` expire the code.

**Message** — \`message\` (Telegram HTML), \`messageImage\` (data URL).

**In-app card** — \`cardImage\` (data URL), \`cardTitle\`, \`cardDesc\`,
\`cardCta\`, and \`locations\`: array of "subscription" | "referral" |
"cashback". The Mini App's promo carousel renders one slide per active
campaign whose locations include that screen.

**Lists** — \`lists\`: campaign-list ids, saved alongside the doc on PUT.
`;
}

/* ---------------------------------------------------------------------
 * Calling the admin API without leaving the process
 * ------------------------------------------------------------------- */

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Run one admin request through handleAdmin() with a synthetic req/res.
 * `auth` is the caller's own Authorization header, so the key's scope decides
 * what lands exactly as it would over the wire.
 */
export function callAdmin(auth, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body === undefined || body === null ? null : Buffer.from(JSON.stringify(body));
    const req = Readable.from(payload ? [payload] : []);
    req.method = method;
    req.headers = { authorization: auth ?? '', 'content-type': 'application/json' };
    if (payload) req.headers['content-length'] = String(payload.length);
    req.socket = { remoteAddress: '127.0.0.1' };

    let status = 500;
    const res = {
      headersSent: false,
      writeHead(code) { status = code; res.headersSent = true; return res; },
      end(chunk) { resolve({ status, body: String(chunk ?? '') }); },
    };

    const url = new URL(`/api/admin${path}`, 'http://localhost');
    handleAdmin(req, res, url).then((handled) => {
      if (!handled) resolve({ status: 404, body: '{"error":"not_found"}' });
    }, reject);
  });
}

const TOOLS = [
  {
    name: 'admin_endpoints',
    description: 'The Trust Forex admin API: every endpoint, what each write '
      + 'wants in its body, and the full campaign doc schema. Read this before '
      + 'the first admin_call of a session.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'admin_call',
    description: 'Call one Trust Forex admin endpoint. Paths are relative to '
      + '/api/admin — see admin_endpoints. Returns the JSON the API returned, '
      + 'with its HTTP status.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: [...METHODS] },
        path: {
          type: 'string',
          description: 'Path under /api/admin, query string included. e.g. "/users", "/series/subscription?grain=weekly"',
        },
        body: { type: 'object', description: 'JSON body for POST / PUT / PATCH.' },
      },
      required: ['method', 'path'],
    },
  },
];

const text = (s) => ({ content: [{ type: 'text', text: s }] });
const failed = (s) => ({ content: [{ type: 'text', text: s }], isError: true });

async function callTool(auth, name, args = {}) {
  if (name === 'admin_endpoints') return text(endpointDoc());
  if (name !== 'admin_call') return failed(`unknown tool: ${name}`);

  const method = String(args.method ?? '').toUpperCase();
  const path = String(args.path ?? '');
  if (!METHODS.has(method)) return failed(`method must be one of ${[...METHODS].join(', ')}`);
  if (!path.startsWith('/')) return failed('path must start with "/" and is relative to /api/admin');

  const out = await callAdmin(auth, method, path, args.body);
  // The status carries real meaning here — 403 is a scope refusal, not a bug.
  return out.status < 400
    ? text(out.body)
    : failed(`HTTP ${out.status} ${out.body}`);
}

/* ---------------------------------------------------------------------
 * JSON-RPC
 * ------------------------------------------------------------------- */

const PROTOCOL = '2025-06-18';

/** One JSON-RPC message in, one response out — or null for a notification. */
export async function handleRpc(auth, msg) {
  const reply = (result) => ({ jsonrpc: '2.0', id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id, error: { code, message } });

  switch (msg.method) {
    case 'initialize':
      return reply({
        /* Echo the client's version: this server implements only the core that
           every version since 2024-11-05 shares, so there is nothing to
           negotiate. ponytail: a version table when that stops being true. */
        protocolVersion: msg.params?.protocolVersion ?? PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: 'trust-forex-admin', version: '1.0.0' },
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: TOOLS });
    case 'tools/call':
      try {
        return reply(await callTool(auth, msg.params?.name, msg.params?.arguments));
      } catch (err) {
        return reply(failed(String(err?.message ?? err)));
      }
    default:
      // Notifications carry no id and want no response at all.
      if (msg.id === undefined || msg.id === null) return null;
      return fail(-32601, `method not found: ${msg.method}`);
  }
}

/**
 * Handle POST /api/mcp. Returns false when the request is not ours, so
 * index.mjs can fall through.
 *
 * Under /api/ because that is the prefix nginx already proxies to this
 * process — a bare /mcp would need a vhost edit on every box this runs on.
 */
export async function handleMcp(req, res, url) {
  if (url.pathname !== '/api/mcp') return false;

  const json = (code, body) => {
    const s = JSON.stringify(body);
    res.writeHead(code, {
      'content-type': 'application/json',
      'content-length': Buffer.byteLength(s),
      'cache-control': 'no-store',
    });
    res.end(s);
  };

  // No SSE stream and no session to delete — the spec's answer to both is 405.
  if (req.method !== 'POST') {
    res.writeHead(405, { allow: 'POST' });
    res.end();
    return true;
  }

  const auth = req.headers.authorization ?? '';
  const session = adminStore.sessionFor(req);
  if (!session?.viaKey) {
    /* Three different failures, three different names. "api_key_required" for
       all of them sent a caller hunting for a scope bug when the header had
       simply not arrived. */
    const error = !auth ? 'no_authorization_header'
      : !/^Bearer\s+tfk_[\w-]+$/.test(auth) ? 'malformed_authorization_header'
        : 'unknown_or_revoked_api_key';
    /* Deliberately NO `WWW-Authenticate: Bearer`. An MCP client reads that as
       "this resource speaks OAuth", starts discovery, finds no
       /.well-known/oauth-protected-resource here — and from then on stops
       sending the static key it was configured with, so every later call 401s
       even though the key is fine. Advertising a scheme we do not implement
       cost exactly that. Static bearer keys only. */
    res.writeHead(401, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error }));
    return true;
  }

  let msg;
  try {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > 4 * 1024 * 1024) { req.destroy(); return true; }
      chunks.push(c);
    }
    msg = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return json(400, { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }), true;
  }

  // A batch is an array; the spec allows one, and mapping over it is the whole job.
  if (Array.isArray(msg)) {
    const out = (await Promise.all(msg.map((m) => handleRpc(auth, m)))).filter(Boolean);
    if (!out.length) { res.writeHead(202); res.end(); return true; }
    return json(200, out), true;
  }

  const out = await handleRpc(auth, msg);
  if (!out) { res.writeHead(202); res.end(); return true; }
  return json(200, out), true;
}

/* ---------------------------------------------------------------------
 * Self-check: node server/mcp.mjs
 * ------------------------------------------------------------------- */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const assert = (cond, msg) => { if (!cond) throw new Error(msg); };
  const routes = routeList().map(([m, s]) => `${m} ${readablePath(s)}`);

  // Notes and routes must not drift apart in either direction.
  for (const key of Object.keys(BODY_NOTES)) {
    assert(routes.includes(key), `BODY_NOTES has "${key}", which is not a route any more`);
  }
  for (const key of routes) {
    if (!/^(POST|PUT|PATCH) /.test(key)) continue;
    assert(BODY_NOTES[key], `route "${key}" takes a body but has no BODY_NOTES entry`);
  }

  const doc = endpointDoc();
  for (const key of routes) assert(doc.includes(`\`${key}\``), `"${key}" missing from the doc`);
  assert(doc.includes('Campaign doc'), 'campaign schema missing');

  // The JSON-RPC surface.
  const init = await handleRpc('', { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } });
  assert(init.result.protocolVersion === '2025-03-26', 'protocol version not echoed');
  assert(init.result.capabilities.tools, 'tools capability missing');

  const list = await handleRpc('', { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  assert(list.result.tools.length === 2, 'expected exactly two tools');

  assert(await handleRpc('', { jsonrpc: '2.0', method: 'notifications/initialized' }) === null,
    'a notification must get no response');
  assert((await handleRpc('', { jsonrpc: '2.0', id: 3, method: 'nope' })).error.code === -32601,
    'unknown method must be -32601');

  const docCall = await handleRpc('', { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'admin_endpoints' } });
  assert(docCall.result.content[0].text.includes('/campaigns'), 'endpoint tool returned nothing useful');

  // Bad input is refused before it reaches the admin API.
  const badPath = await handleRpc('', { jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'admin_call', arguments: { method: 'GET', path: 'users' } } });
  assert(badPath.result.isError, 'a path without a leading slash must be refused');
  const badMethod = await handleRpc('', { jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'admin_call', arguments: { method: 'TRACE', path: '/users' } } });
  assert(badMethod.result.isError, 'an unsupported method must be refused');

  // And a call with no key gets the admin API's own 401, through the real dispatcher.
  const noKey = await handleRpc('', { jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'admin_call', arguments: { method: 'GET', path: '/users' } } });
  assert(noKey.result.isError && noKey.result.content[0].text.startsWith('HTTP 401'),
    'an unauthenticated admin_call must come back 401');

  /* The 401 itself. Naming the three failures apart is what turns "it stopped
     working" into one glance, and the absent WWW-Authenticate is load-bearing:
     with it, a compliant MCP client abandons its static key for an OAuth flow
     this server does not have. */
  const probe = async (authorization) => {
    const req = Readable.from([Buffer.from('{"jsonrpc":"2.0","id":1,"method":"tools/list"}')]);
    req.method = 'POST';
    req.headers = authorization === null ? {} : { authorization };
    let status = 0; let headers = {}; let body = '';
    const res = {
      headersSent: false,
      writeHead(code, h) { status = code; headers = h ?? {}; return res; },
      end(chunk) { body = String(chunk ?? ''); },
    };
    await handleMcp(req, res, new URL('/api/mcp', 'http://localhost'));
    return { status, headers, error: JSON.parse(body || '{}').error };
  };

  const noHeader = await probe(null);
  assert(noHeader.status === 401 && noHeader.error === 'no_authorization_header', 'missing header must say so');
  assert(!('www-authenticate' in noHeader.headers),
    'never advertise Bearer: MCP clients read it as OAuth and drop their static key');
  assert((await probe('Basic abc')).error === 'malformed_authorization_header', 'garbage header must say so');
  assert((await probe('Bearer tfk_doesNotExist')).error === 'unknown_or_revoked_api_key',
    'a well-formed unknown key must be named as such, not as a missing header');

  console.log(`mcp.mjs ok — ${routes.length} routes, ${Object.keys(BODY_NOTES).length} documented`);
}
