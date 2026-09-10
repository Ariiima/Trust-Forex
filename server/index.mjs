// Trust Forex API. Plain node:http — the surface is small enough that a
// framework would be more code than the routes.
//
// Implemented so far: the once-only preview flags (referral/cashback intro
// pages). The order/gateway routes from design/CONTRACT.md still need writing;
// they share this dispatcher and the same auth helper.
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';
import { openDb } from './db.mjs';
import { handleAdmin } from './admin-routes.mjs';
import { handleMcp } from './mcp.mjs';
// The Mini App's own db (flags, orders) and the admin's are separate files, so
// reading campaigns needs the admin store rather than `store` below.
import { MESSAGE_TEMPLATES, PUBLIC_URL, campaignBrokerList, openAdminDb, renderTemplate } from './admin.mjs';
import { appButton, groupInvite, sendMessage, startJoinGate } from './telegram.mjs';
import { handleOrders, loadGateways } from './orders.mjs';
import { enqueueWithdrawal, listWithdrawals, startPayouts, PAYOUT_SCHEMA } from './payouts.mjs';
import { startJobs } from './jobs.mjs';
import { describe as describeRequest, notifyAdmins, parseRequest, saveRequest } from './partnership.mjs';
// Side-effect only: registers the referral-earnings notifier on the ledger.
// The watcher imports notify.mjs lazily, and only once a payment is live —
// too late for a cashback cycle published from the dashboard.
import './notify.mjs';
import { connect, DB_PATH } from './sqlite.mjs';

const PORT = Number(process.env.TF_PORT ?? 8787);
const DEV = process.env.TF_DEV === '1';
const BOT_TOKEN = process.env.TF_BOT_TOKEN ?? '';

const store = openDb();
const admin = openAdminDb();
// The shipped copy, used until an admin edits it on the Messages page.
const WELCOME_DEFAULT = MESSAGE_TEMPLATES.find((t) => t.key === 'bot_welcome').body;
const rawDb = connect();
rawDb.exec(PAYOUT_SCHEMA);

/** Small JSON body reader; the Mini App's writes are all a few fields. */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > 64 * 1024) return {};
    chunks.push(c);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    return {};
  }
}

// Dev stands in for one signed-in Telegram account so the app is usable without
// a bot token. Same shape initData would give.
const DEV_USER = { id: 1, first_name: 'Dev', username: 'dev' };

/**
 * Anyone opening the app outside Telegram (no initData at all) is hashed from
 * their `X-Guest-Id` client header into a stable negative id — real Telegram
 * ids are always positive, so a guest can never collide with a real user —
 * and named "Guest" so they read as guests everywhere a Telegram user's name
 * would otherwise show, admin dashboard included.
 */
function guestUserFrom(req) {
  const gid = req.headers['x-guest-id'];
  if (typeof gid !== 'string' || !gid) return null;
  let h = 5381;
  for (let i = 0; i < gid.length; i++) h = ((h * 33) ^ gid.charCodeAt(i)) >>> 0;
  return { id: -(h % 1_000_000_000) - 1, first_name: 'Guest', username: 'guest' };
}

/**
 * Validate a Telegram Mini App initData string and return its `user` object.
 * Spec: sort "k=v" pairs (minus `hash`) by key, join with \n, HMAC-SHA256 with
 * key = HMAC-SHA256("WebAppData", botToken), compare to `hash`.
 * Returns null when absent/invalid — callers decide whether that's fatal.
 */
function tgUserFrom(req) {
  const raw = (req.headers.authorization ?? '').replace(/^tma\s+/i, '');
  if (!raw) return guestUserFrom(req) ?? (DEV ? DEV_USER : null);

  const params = new URLSearchParams(raw);
  const hash = params.get('hash');
  params.delete('hash');
  if (!hash || !BOT_TOKEN) return DEV ? DEV_USER : null;

  const check = [...params.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const sig = createHmac('sha256', secret).update(check).digest('hex');
  if (sig !== hash) return DEV ? DEV_USER : null;

  try {
    const user = JSON.parse(params.get('user') ?? '{}');
    // `start_param` carries a payload from t.me/<bot>?startapp=CODE (campaign
    // buttons; referral links now go through the bot's /start instead). It
    // rides along with the signed initData, so it cannot be forged by the
    // client the way a query string could.
    if (user.id) user.start_param = params.get('start_param') ?? undefined;
    return user.id ? user : null;
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

  // The admin dashboard authenticates with its own session cookie, not with
  // Telegram initData — check it before the Mini App auth below rejects it.
  if (await handleAdmin(req, res, url)) return;

  // POST /api/mcp — the same admin API, spoken to an AI agent. Bearer key only.
  if (await handleMcp(req, res, url)) return;

  /* GET /api/promos?section=subscription|referral|cashback -> { promos: [...] }
     The promo carousel's slides: every active campaign whose Display Location
     (admin step 4) includes this screen. Above the auth gate deliberately —
     the same cards go to everyone, there is no per-user content here, and
     gating them would blank the carousel wherever initData is missing. */
  if (req.method === 'GET' && url.pathname === '/api/promos') {
    const section = url.searchParams.get('section') ?? '';
    /* The card is the cropped image the editor's "In-App Content" step takes
       (title/desc/cta only exist on docs written before that step became
       image-only); a campaign with neither has nothing to show. */
    const promos = admin
      .campaigns()
      .filter((c) => c.status === 'active' && (c.locations ?? []).includes(section)
        && (c.cardImage || c.cardTitle) && !admin.campaignEngine.codesExpired(c.id))
      .map((c) => ({ id: c.id, title: c.cardTitle ?? '', subtitle: c.cardDesc ?? '', image: c.cardImage, cta: c.cardCta }));
    return send(res, 200, { promos });
  }

  /* POST /api/partnership — the broker partnership form on the landing site
     (partnership.mjs). No initData: the sender is a broker on trustforex.net,
     not a Mini App user, hence the open CORS header. */
  if (req.method === 'POST' && url.pathname === '/api/partnership') {
    res.setHeader('access-control-allow-origin', '*');
    const parsed = parseRequest(await readBody(req));
    if (parsed.error) return send(res, parsed.error === 'spam' ? 200 : 400, { error: parsed.error });
    const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '').split(',')[0].trim();
    const id = saveRequest(rawDb, parsed.row, ip);
    notifyAdmins(describeRequest(parsed.row, id)).catch((e) => console.warn('[partnership] alert failed:', e.message));
    return send(res, 200, { ok: true, id });
  }

  const tg = tgUserFrom(req);
  if (tg === null) return send(res, 401, { error: 'unauthorized' });
  // Flags still key on the Telegram id (they predate the merge and nothing else
  // joins them); everything below keys on the admin `users` row this resolves to.
  const userId = tg.id;
  const startParam = tg.start_param;
  const me = admin.ensureUser(tg, startParam);
  /* A campaign's "Open App" button carries `c_<campaignId>`, which is how the
     open rate is measured. Done on every launch rather than once: the table's
     primary key collapses repeat taps, so this is idempotent. */
  admin.recordCampaignOpen(me.id, startParam);

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

  /* GET /api/me -> the whole signed-in user in one read.
     One route rather than /me/subscription + /me/cashback + /me/referrals: the
     home, cashback, referral and earning tabs each want a different slice of
     the same three tables, and four round-trips to answer one screen is worse
     than a response nobody reads all of. */
  if (req.method === 'GET' && url.pathname === '/api/me') {
    return send(res, 200, { user: { id: me.id, name: me.name, plan: me.plan }, ...admin.miniAppUser(me.id) });
  }

  /* The payment surface from design/CONTRACT.md: gateways, orders, submission,
     status. Mounted here so it sits behind the same initData check. */
  if (await handleOrders(req, res, url, {
    db: store, admin, userId, adminUserId: me.id, username: tg.username ?? me.name, readBody,
  })) return;

  /* GET /api/me/wallet -> the Earning tab: balance, lifetime earned, history.
     Withdrawal-only by design — there is no deposit into this balance, it is
     what the platform owes the user. */
  if (req.method === 'GET' && url.pathname === '/api/me/wallet') {
    return send(res, 200, {
      ...admin.ledger.wallet(me.id),
      history: admin.ledger.timeline(me.id)
        .filter((r) => r.amount !== 0)
        .map((r) => ({ id: r.id, at: r.at, kind: r.kind, detail: r.detail, amount: r.amount })),
    });
  }

  /* POST /api/me/withdraw { amount, currency, network, address }
     -> { ok, balance, withdrawal }. Reserves the balance immediately; the
     payouts worker sends on-chain from the hot wallet (payouts.mjs). */
  if (req.method === 'POST' && url.pathname === '/api/me/withdraw') {
    const body = await readBody(req);
    const result = enqueueWithdrawal({
      db: rawDb, ledger: admin.ledger, userId: me.id, tgUserId: tg.id,
      amount: body.amount, currency: body.currency, network: body.network, address: body.address,
    });
    return send(res, result.error ? 400 : 200, result);
  }

  // GET /api/me/withdrawals -> { withdrawals } for the history sheet.
  if (req.method === 'GET' && url.pathname === '/api/me/withdrawals') {
    return send(res, 200, { withdrawals: listWithdrawals(rawDb, me.id) });
  }

  /* GET /api/me/referral -> the user's own link payload and standing.
     The bot link is what the website's CTAs must carry for attribution to
     survive the hop from site to Telegram. */
  if (req.method === 'GET' && url.pathname === '/api/me/referral') {
    const code = admin.ledger.refCodeFor(me.id);
    const bot = process.env.TF_BOT_USERNAME ?? '';
    return send(res, 200, {
      code,
      bot: bot || null,
      // `?start=`, not `?startapp=`: the link opens the bot chat, so a tap on
      // Start both attributes the invitee (the /start handler below) and lets
      // the bot message them — the Mini App is one button away from there.
      botLink: bot ? `https://t.me/${bot}?start=${code}` : null,
      websiteLink: `${PUBLIC_URL}/?ref=${code}`,
      tier: admin.ledger.tierOf(me.id),
      ...admin.booksFor(me.id),
    });
  }

  // GET /api/me/referrals -> { referrals: [...] } for the "Your referrals" list.
  if (req.method === 'GET' && url.pathname === '/api/me/referrals') {
    return send(res, 200, { referrals: admin.ledger.referralsFor(me.id) });
  }

  // GET /api/me/cashback-history -> { history: [...] } for the cashback history sheet.
  if (req.method === 'GET' && url.pathname === '/api/me/cashback-history') {
    /* Name and logo travel with the row: /api/brokers hides private brokers,
       and a user who earned cashback before one was hidden still has rows
       for it — those rendered as a bare id with no mark. */
    const history = admin.ledger.cashbackHistoryFor(me.id).map((h) => {
      const b = admin.broker(h.broker);
      return { ...h, brokerName: b?.name ?? h.broker, brokerLogo: b?.logoUrl ?? null };
    });
    return send(res, 200, { history });
  }

  // GET /api/me/earnings-weekly -> { weeks: [...] } for the Earning tab's chart.
  if (req.method === 'GET' && url.pathname === '/api/me/earnings-weekly') {
    return send(res, 200, { weeks: admin.ledger.weeklyEarnings(me.id) });
  }

  /* POST /api/me/brokers/:id/submit { email, brokerAccountId } — the broker
     connect flow's "Submit account": a verification request into the admin's
     review queue. POST .../deposit — "I made a deposit": puts the request back
     in front of the admin. Both answer with the refreshed broker links so the
     screen updates without a second round trip. */
  const bv = url.pathname.match(/^\/api\/me\/brokers\/([\w-]+)\/(submit|deposit)$/);
  if (req.method === 'POST' && bv) {
    const broker = admin.broker(bv[1]);
    if (!broker || broker.status === 'private') return send(res, 404, { error: 'not_found' });
    if (bv[2] === 'submit') {
      const body = await readBody(req);
      const email = String(body.email ?? '').trim();
      const brokerAccountId = String(body.brokerAccountId ?? '').trim();
      // Which fields the sheet actually asks for is per-broker (admin's
      // "Require" checkboxes); validate what it collected, not a fixed pair.
      const req_ = admin.preview(bv[1]) ?? { requireEmail: true, requireUserId: true };
      if ((req_.requireEmail !== false || email) && (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200)) {
        return send(res, 400, { error: 'invalid_email' });
      }
      if (brokerAccountId.length > 100) return send(res, 400, { error: 'invalid_account' });
      const r = admin.submitBrokerRequest({
        userId: me.id, brokerId: bv[1], email, brokerAccountId,
        needAccountId: req_.requireUserId !== false,
      });
      if (r === 'missing_account') return send(res, 400, { error: 'invalid_account' });
    } else {
      const r = admin.confirmBrokerDeposit({ userId: me.id, brokerId: bv[1] });
      if (r === 'not_found') return send(res, 409, { error: 'no_request' });
    }
    // 'active'/'pending' no-ops fall through on purpose: the truthful state
    // comes back either way, and a double tap is not an error the user can fix.
    return send(res, 200, { brokers: admin.miniAppUser(me.id).brokers });
  }

  /* POST /api/discount { code, planId } -> { percent } | { error }
     Unique campaign codes are bound to one account and one use; the check is
     here rather than at redemption so a shared code fails before checkout. */
  if (req.method === 'POST' && url.pathname === '/api/discount') {
    const body = await readBody(req);
    const result = admin.campaignEngine.checkCode(body.code, me.id, body.planId);
    return send(res, result.error ? 400 : 200, result);
  }

  /* POST /api/subscription/join -> a personal join-request invite to the VIP
     group. Issued only while the subscription is live and bound to this
     Telegram account — the link itself never expires, the join gate declines
     anyone else and anyone whose subscription has since lapsed. */
  if (req.method === 'POST' && url.pathname === '/api/subscription/join') {
    const sub = admin.miniAppUser(me.id).subscription;
    if (!sub || sub.status !== 'active' || (sub.daysLeft ?? 0) <= 0) {
      return send(res, 403, { error: 'no_active_subscription' });
    }
    const link = await groupInvite(tg.id, store.getGroupInvite(tg.id));
    if (link) store.setGroupInvite(tg.id, link);
    return link ? send(res, 200, { link }) : send(res, 503, { error: 'group_unavailable' });
  }

  /* GET /api/brokers -> the partner-broker catalogue (public listing only).
     `private` brokers are admin-side drafts and must not leak to the app. */
  if (req.method === 'GET' && url.pathname === '/api/brokers') {
    const rows = admin.brokers()
      .map((b) => ({ ...b, preview: admin.preview(b.id) ?? null, flow: admin.flowMessages(b.id) }));
    /* A user who arrived on a live referral campaign's link sees that
       campaign's list — its order, its badges, its private brokers — and
       everyone else sees the public one. */
    const campaign = admin.liveCampaignFor(me.id);
    const brokers = campaign
      ? campaignBrokerList(rows, campaign)
      : rows.filter((b) => b.status !== 'private').sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
    return send(res, 200, { brokers });
  }

  // GET /api/brokers/:id -> one broker plus its editable spec sheet / links.
  const b = url.pathname.match(/^\/api\/brokers\/([\w-]+)$/);
  if (req.method === 'GET' && b) {
    const broker = admin.broker(b[1]);
    // Private is only private to users the campaign that lists it didn't send.
    const onCampaign = (admin.liveCampaignFor(me.id)?.display ?? []).some((d) => d.brokerId === b[1]);
    if (!broker || (broker.status === 'private' && !onCampaign)) return send(res, 404, { error: 'not_found' });
    return send(res, 200, {
      broker,
      preview: admin.preview(b[1]) ?? null,
      flow: admin.flowMessages(b[1]),
    });
  }

  // GET /api/signals -> published signal results for Home's performance card.
  if (req.method === 'GET' && url.pathname === '/api/signals') {
    return send(res, 200, { results: admin.signals().filter((s) => s.status === 'published') });
  }

  send(res, 404, { error: 'not_found' });
});

server.listen(PORT, () => {
  console.log(`[trust-forex] api on :${PORT}${DEV ? ' (TF_DEV — auth bypassed)' : ''}`);
});

/* Outbound payouts. Guarded like the watcher: withdrawals still queue if the
   worker cannot start — they just wait for a restart to be paid. */
try {
  startPayouts({ db: rawDb, templates: admin.messageTemplate });
} catch (err) {
  console.error('[trust-forex] payouts failed to start:', err);
}

/* On-chain verification. Guarded: a watcher that cannot start must not take the
   API down with it — orders still get created, they just wait for a restart to
   be confirmed. */
try {
  const { startWatcher } = await import('./watcher.mjs');
  startWatcher({ db: store, loadGateways, templates: admin.messageTemplate });
} catch (err) {
  console.warn('[trust-forex] watcher not started:', err.message);
}

/* The VIP-channel doorman: approves join requests only from the buyer their
   link was minted for, and only while that subscription is still live.
   TF_ADMIN_IDS always count as subscribed — admins get in through their own
   links without buying a plan (and can test the gate the same way). */
const ADMIN_IDS = new Set((process.env.TF_ADMIN_IDS ?? '').split(',').map((s) => s.trim()).filter(Boolean));
startJoinGate((tgId) => {
  if (ADMIN_IDS.has(String(tgId))) return true;
  const sub = admin.miniAppUser(`tg${tgId}`).subscription;
  return sub?.status === 'active' && (sub.daysLeft ?? 0) > 0;
}, /* /start <code> from a referral or campaign link: same ensureUser as an
      app open, so the payload attributes exactly as start_param would. */
async (from, payload, chatId) => {
  admin.ensureUser(from, payload || undefined);
  await sendMessage(chatId, renderTemplate(
    admin.messageTemplate('bot_welcome') ?? WELCOME_DEFAULT,
    { name: from?.first_name ?? '' },
  ), appButton());
});

/* Everything time-driven: booking confirmed payments, lapsing subscriptions
   and removing them from the group, campaign triggers, backups. */
startJobs({
  db: admin.db,
  ledger: admin.ledger,
  campaigns: admin.campaignEngine,
  dbPath: DB_PATH,
  templates: admin.messageTemplate,
  // TF_JOBS_INTERVAL_MS is for the e2e test; unset = the hourly default.
  intervalMs: Number(process.env.TF_JOBS_INTERVAL_MS) || undefined,
});
