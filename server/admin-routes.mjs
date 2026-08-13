/**
 * Admin HTTP surface. One flat route table; the dispatcher does a single pass
 * with a precompiled regex per entry, so adding routes costs nothing per
 * request beyond one `test`.
 *
 * Everything under /api/admin except login requires a valid session cookie.
 * There is no dev bypass — this endpoint exposes every user, payment and
 * payout in the system.
 */
import { GRAINS, openAdminDb, renderTemplate } from './admin.mjs';
import { sendMessage, appButton } from './telegram.mjs';

const MAX_BODY = 4 * 1024 * 1024; // in-app card images arrive as data URLs

const store = openAdminDb();

const send = (res, code, body, headers = {}) => {
  const json = JSON.stringify(body);
  res.writeHead(code, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(json),
    // Admin data is live and per-session; a cached response is a wrong response.
    'cache-control': 'no-store',
    ...headers,
  });
  res.end(json);
};

const ok = (res, body) => send(res, 200, body ?? { ok: true });
const bad = (res, error = 'bad_request') => send(res, 400, { error });
const missing = (res) => send(res, 404, { error: 'not_found' });

/** Collect a JSON body, refusing anything over the cap before buffering it all. */
function readJson(req) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > MAX_BODY) return reject(new Error('payload_too_large'));
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        req.destroy();
        return reject(new Error('payload_too_large'));
      }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    req.on('error', reject);
  });
}

/* Login rate limit. scrypt makes each attempt expensive for us as well as for
   an attacker, so the cap protects the box as much as the password. In-process
   on purpose: one node, and a Map that empties on restart is the right amount
   of machinery for this. */
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX = 10;
const attempts = new Map();

function loginAllowed(ip) {
  const now = Date.now();
  const seen = attempts.get(ip);
  if (!seen || seen.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    if (attempts.size > 5000) for (const [k, v] of attempts) if (v.resetAt < now) attempts.delete(k);
    return true;
  }
  seen.count += 1;
  return seen.count <= LOGIN_MAX;
}

const cookie = (token, maxAge) =>
  `tf_admin=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}` +
  (process.env.TF_DEV === '1' ? '' : '; Secure');

/* ---------------------------------------------------------------------
 * Routes. [method, pattern, handler, { public }]
 * `p` holds the pattern's capture groups; `body` is parsed only for writes.
 * ------------------------------------------------------------------- */

/* /login is handled ahead of this table — it is the one route without a session. */
const ROUTES = [
  ['POST', /^\/logout$/, (req, res, _p, _b, session) => {
    store.logout(session?.token);
    send(res, 200, { ok: true }, { 'set-cookie': 'tf_admin=; Path=/; HttpOnly; Max-Age=0' });
  }],

  ['GET', /^\/session$/, (req, res, _p, _b, session) => ok(res, { username: session.username })],

  /* ---- users ---- */
  ['GET', /^\/users$/, (req, res) => ok(res, store.users())],
  ['GET', /^\/users\/counts$/, (req, res) => ok(res, store.userCounts())],
  ['GET', /^\/analytics$/, (req, res) => ok(res, store.analytics())],
  ['GET', /^\/users\/([\w-]+)$/, (req, res, p) => {
    const detail = store.user(p[1]);
    return detail ? ok(res, detail) : missing(res);
  }],
  ['PATCH', /^\/users\/([\w-]+)$/, (req, res, p, body) => {
    if (!['active', 'pending', 'rejected'].includes(body.status)) return bad(res, 'invalid_status');
    return store.setUserStatus(p[1], body.status) ? ok(res) : missing(res);
  }],

  /* ---- brokers ---- */
  ['GET', /^\/brokers$/, (req, res) => ok(res, store.brokers())],
  ['GET', /^\/brokers\/totals$/, (req, res) => ok(res, store.brokerTotals())],
  ['POST', /^\/brokers$/, (req, res, _p, body) => {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad(res, 'name_required');
    if (body.status && !['public', 'private', 'stopped'].includes(body.status)) return bad(res, 'invalid_status');
    const share = body.shareRate === undefined ? 0.3 : Number(body.shareRate);
    if (!Number.isFinite(share) || share < 0 || share > 1) return bad(res, 'invalid_share_rate');
    const broker = store.addBroker({ ...body, name: body.name.trim(), shareRate: share });
    return broker ? ok(res, broker) : send(res, 409, { error: 'broker_exists' });
  }],
  ['PUT', /^\/brokers\/order$/, (req, res, _p, body) => {
    if (!Array.isArray(body.order)) return bad(res);
    const valid = body.order.every((b) => typeof b?.id === 'string'
      && ['public', 'private', 'stopped'].includes(b.status));
    if (!valid) return bad(res, 'invalid_order');
    store.reorderBrokers(body.order);
    ok(res, store.brokers());
  }],
  ['GET', /^\/brokers\/([\w-]+)$/, (req, res, p) => {
    const b = store.broker(p[1]);
    return b ? ok(res, b) : missing(res);
  }],
  ['DELETE', /^\/brokers\/([\w-]+)$/, (req, res, p) => {
    const result = store.deleteBroker(p[1]);
    if (result === 'not_found') return missing(res);
    if (result === 'in_use') return send(res, 409, { error: 'broker_in_use' });
    return ok(res);
  }],
  ['GET', /^\/brokers\/([\w-]+)\/preview$/, (req, res, p) => {
    const doc = store.preview(p[1]);
    if (doc) return ok(res, doc);
    // A broker added after seeding has no preview doc yet — 404ing here left
    // the form permanently blank (useAsync never surfaces the rejection).
    // Hand back defaults so it renders and the first Save creates the row.
    const broker = store.broker(p[1]);
    if (!broker) return missing(res);
    return ok(res, {
      brokerId: broker.id, name: broker.name, logoName: `${broker.name}.png`,
      status: broker.status, badgeOn: false, badgeText: '', badgeColor: '#22c55e',
      createAccountLink: '', goToBrokerLink: '', referralCodeOn: false, referralCode: '',
      details: {
        regulation: '', platform: '', accountTypes: '', leverage: '',
        depositBonus: '', spread: '', cashbackLevel: '', execution: '',
      },
      requireEmail: false, requireUserId: false,
    });
  }],
  ['PUT', /^\/brokers\/([\w-]+)\/preview$/, (req, res, p, body) => {
    store.setPreview(p[1], body);
    ok(res, body);
  }],
  ['GET', /^\/brokers\/([\w-]+)\/flow-messages$/, (req, res, p) => ok(res, store.flowMessages(p[1]))],
  ['PUT', /^\/brokers\/([\w-]+)\/flow-messages\/([\w-]+)$/, (req, res, p, body) => {
    if (typeof body.message !== 'string') return bad(res);
    return store.setFlowMessage(p[1], p[2], body.message) ? ok(res) : missing(res);
  }],
  ['GET', /^\/brokers\/([\w-]+)\/rebates$/, (req, res, p) => ok(res, store.rebates(p[1]))],
  ['GET', /^\/brokers\/([\w-]+)\/rebate-drafts$/, (req, res, p) => ok(res, store.drafts(p[1]))],
  ['POST', /^\/brokers\/([\w-]+)\/rebate-drafts$/, (req, res, p, body) => {
    const amount = Number(body.lastWeekRebate);
    if (!body.userId || !Number.isFinite(amount) || amount < 0) return bad(res, 'invalid_amount');
    const draft = store.addDraft(p[1], String(body.userId), amount);
    return draft ? ok(res, draft) : missing(res);
  }],
  ['DELETE', /^\/brokers\/([\w-]+)\/rebate-drafts\/([\w-]+)$/, (req, res, p) =>
    (store.deleteDraft(p[1], p[2]) ? ok(res) : missing(res))],
  ['POST', /^\/brokers\/([\w-]+)\/rebate-drafts\/publish$/, (req, res, p) =>
    ok(res, { published: store.publishDrafts(p[1]) })],

  /* The "Publish all" footer: every broker's drafts become real money in one
     transaction. Keyed per (cycle, broker, user), so a second click is a
     no-op rather than a second payout. */
  ['POST', /^\/rebate-drafts\/publish-all$/, (req, res, _p, body) =>
    ok(res, store.publishAll({
      cycleId: body.cycleId, name: body.name, range: body.range,
    }))],

  ['GET', /^\/cashback-cycles$/, (req, res) => ok(res, store.cycles())],

  /* ---- money out ---- */
  ['GET', /^\/withdrawals$/, (req, res) => ok(res, store.withdrawals())],
  /* Confirmed on-chain payments, which the dashboard previously had no window
     into at all — the orders table lives in the same file. */
  ['GET', /^\/payments$/, (req, res) => ok(res, store.payments())],
  ['GET', /^\/review-queue$/, (req, res) => ok(res, store.reviewQueue())],
  ['POST', /^\/review-queue\/([\w-]+)\/decision$/, (req, res, p, body) => {
    if (!['approved', 'waiting', 'rejected'].includes(body.decision)) return bad(res, 'invalid_decision');
    const decided = store.decideReview(p[1], body.decision);
    if (!decided) return missing(res);
    /* The broker's own status message for this transition ("Manage user flow"),
       fire-and-forget: a Telegram hiccup must not undo a decision that is
       already committed, and sendMessage no-ops without a bot token. */
    if (decided.telegramId) {
      const flow = store.flowMessages(decided.brokerId).find((m) => m.key === decided.flowKey);
      if (flow?.message) {
        void sendMessage(decided.telegramId, renderTemplate(flow.message, {
          name: decided.userName ?? '', broker: decided.brokerName,
        }), appButton());
      }
    }
    return ok(res);
  }],

  /* ---- subscription ---- */
  ['GET', /^\/subscribers$/, (req, res) => ok(res, store.subscribers())],
  ['GET', /^\/extra-grants$/, (req, res) => ok(res, store.grants())],
  ['POST', /^\/extra-grants$/, (req, res, _p, body) => {
    const days = Number(body.extraDays);
    if (!Number.isInteger(days) || days < 1) return bad(res, 'invalid_days');
    ok(res, store.addGrant({
      purchasedBefore: typeof body.purchasedBefore === 'string' ? body.purchasedBefore : '',
      addedAt: body.addedAt ?? new Date().toDateString(),
      addedTime: body.addedTime ?? '',
      extraDays: days,
      eligibleBefore: body.eligibleBefore ?? '',
      eligibleTime: body.eligibleTime ?? '',
      message: body.message,
      notify: !!body.notify,
    }));
  }],

  /* ---- events ---- */
  ['GET', /^\/events$/, (req, res) => ok(res, store.events())],
  ['POST', /^\/events$/, (req, res, _p, body) => {
    if (typeof body.title !== 'string' || !body.title.trim()) return bad(res, 'title_required');
    ok(res, store.addEvent(body));
  }],
  ['PUT', /^\/events\/([\w-]+)$/, (req, res, p, body) =>
    (store.updateEvent(p[1], body) ? ok(res) : missing(res))],
  ['DELETE', /^\/events\/([\w-]+)$/, (req, res, p) =>
    (store.deleteEvent(p[1]) ? ok(res) : missing(res))],

  /* ---- referral ---- */
  ['GET', /^\/referrals$/, (req, res) => ok(res, store.referralRows())],
  ['GET', /^\/referral-campaigns$/, (req, res) => ok(res, store.referralCampaigns())],
  ['POST', /^\/referral-campaigns$/, (req, res, _p, body) => {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad(res, 'name_required');
    ok(res, store.addReferralCampaign(body));
  }],
  ['PUT', /^\/referral-campaigns\/([\w-]+)$/, (req, res, p, body) => {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad(res, 'name_required');
    return store.updateReferralCampaign(p[1], body) ? ok(res, { ...body, id: p[1] }) : missing(res);
  }],
  ['PATCH', /^\/referral-campaigns\/([\w-]+)$/, (req, res, p, body) => {
    if (!['active', 'paused', 'ended'].includes(body.status)) return bad(res, 'invalid_status');
    return store.setReferralCampaignStatus(p[1], body.status) ? ok(res) : missing(res);
  }],

  /* ---- marketing campaigns ---- */
  ['GET', /^\/campaign-lists$/, (req, res) => ok(res, store.campaignLists())],
  ['POST', /^\/campaign-lists$/, (req, res, _p, body) => {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad(res, 'name_required');
    ok(res, store.addCampaignList(body.name.trim()));
  }],
  ['GET', /^\/campaign-lists\/([\w-]+)\/members$/, (req, res, p) => ok(res, store.listMembers(p[1]))],
  ['GET', /^\/campaigns$/, (req, res) => ok(res, store.campaigns())],
  /* Delivery counters, counted from campaign_sends rather than stored — a
     brand-new campaign reporting "1,240 sent" was the frames' placeholder. */
  ['GET', /^\/campaigns\/([\w-]+)\/stats$/, (req, res, p) => ok(res, store.campaignEngine.stats(p[1]))],
  ['POST', /^\/campaigns$/, (req, res, _p, body) => {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad(res, 'name_required');
    ok(res, store.addCampaign(body));
  }],
  ['PUT', /^\/campaigns\/([\w-]+)$/, (req, res, p, body) => {
    if (typeof body.name !== 'string' || !body.name.trim()) return bad(res, 'name_required');
    if (!store.updateCampaign(p[1], body)) return missing(res);
    store.setCampaignLists(p[1], Array.isArray(body.lists) ? body.lists : []);
    ok(res, { ...body, id: p[1] });
  }],
  ['PUT', /^\/campaigns\/([\w-]+)\/lists$/, (req, res, p, body) => {
    if (!Array.isArray(body.lists)) return bad(res);
    store.setCampaignLists(p[1], body.lists);
    ok(res, store.campaignLists());
  }],
  ['PATCH', /^\/campaigns\/([\w-]+)$/, (req, res, p, body) => {
    if (!['active', 'paused', 'ended'].includes(body.status)) return bad(res, 'invalid_status');
    return store.setCampaignStatus(p[1], body.status) ? ok(res) : missing(res);
  }],
  ['DELETE', /^\/campaigns\/([\w-]+)$/, (req, res, p) =>
    (store.deleteCampaign(p[1]) ? ok(res) : missing(res))],

  /* ---- bot messages ---- */
  ['GET', /^\/message-templates$/, (req, res) => ok(res, store.messageTemplates())],
  ['PUT', /^\/message-templates\/([\w-]+)$/, (req, res, p, body) => {
    if (typeof body.body !== 'string' || !body.body.trim()) return bad(res, 'body_required');
    const row = store.setMessageTemplate(p[1], body.body);
    return row ? ok(res, row) : missing(res);
  }],

  /* ---- signals ---- */
  ['GET', /^\/signals$/, (req, res) => ok(res, store.signals())],
  ['POST', /^\/signals$/, (req, res, _p, body) => {
    const nums = ['total', 'sl', 'tp1', 'tp2', 'tp3', 'tp4'];
    if (!body.id || nums.some((k) => !Number.isInteger(body[k]) || body[k] < 0)) return bad(res, 'invalid_result');
    if (!['draft', 'published'].includes(body.status)) return bad(res, 'invalid_status');
    ok(res, store.saveSignal(body));
  }],
  ['DELETE', /^\/signals\/([\w-]+)$/, (req, res, p) =>
    (store.deleteSignal(p[1]) ? ok(res) : missing(res))],

  /* ---- chart series ---- */
  ['GET', /^\/series\/([\w-]+)\/dims$/, (req, res, p) => ok(res, store.seriesDims(p[1]))],
  ['GET', /^\/series\/([\w-]+)$/, (req, res, p, _b, _s, url) => {
    const grain = url.searchParams.get('grain') ?? 'weekly';
    if (!GRAINS.includes(grain)) return bad(res, 'invalid_grain');
    const dims = (url.searchParams.get('dims') ?? '').split(',').filter(Boolean);
    ok(res, store.series(p[1], {
      dims,
      from: url.searchParams.get('from') || undefined,
      to: url.searchParams.get('to') || undefined,
      grain,
    }));
  }],
];

const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH']);

/**
 * Handle a request if it targets /api/admin. Returns false when it does not,
 * so the caller can fall through to the Mini App routes.
 */
export async function handleAdmin(req, res, url) {
  if (!url.pathname.startsWith('/api/admin')) return false;
  const path = url.pathname.slice('/api/admin'.length) || '/';

  // Login is the only route reachable without a session.
  if (req.method === 'POST' && path === '/login') {
    const ip = (req.headers['x-forwarded-for'] ?? '').split(',')[0].trim()
      || req.socket.remoteAddress || 'unknown';
    if (!loginAllowed(ip)) return send(res, 429, { error: 'too_many_attempts' }), true;
    let body;
    try {
      body = await readJson(req);
    } catch (err) {
      return bad(res, err.message), true;
    }
    const session = typeof body.username === 'string' && typeof body.password === 'string'
      ? store.login(body.username, body.password)
      : null;
    if (!session) return send(res, 401, { error: 'invalid_credentials' }), true;
    send(res, 200, { username: session.username }, { 'set-cookie': cookie(session.token, session.maxAge) });
    return true;
  }

  const session = store.sessionFor(req);
  if (!session) return send(res, 401, { error: 'unauthorized' }), true;

  for (const [method, pattern, handler] of ROUTES) {
    if (method !== req.method) continue;
    const p = pattern.exec(path);
    if (!p) continue;
    let body;
    if (WRITE_METHODS.has(method)) {
      try {
        body = await readJson(req);
      } catch (err) {
        return bad(res, err.message), true;
      }
    }
    try {
      await handler(req, res, p, body, session, url);
    } catch (err) {
      console.error('[admin]', req.method, path, err);
      if (!res.headersSent) send(res, 500, { error: 'server_error' });
    }
    return true;
  }

  return missing(res), true;
}

export { store as adminStore };
