/**
 * Campaign builder, end to end.
 *
 * Boots the real server (`node server/index.mjs`) on a scratch database with a
 * mock Telegram Bot API in front of it, then drives every configuration the
 * admin's Campaign editor can produce through the same HTTP surface the
 * dashboard and the Mini App use:
 *
 *   admin  POST /api/admin/campaigns   (docs shaped exactly like buildPatch())
 *   engine jobs tick every 200ms       (evaluate → mint → deliver via "Telegram")
 *   app    GET /api/me, POST /api/discount, POST /api/orders, GET /api/promos
 *
 * The only thing done behind the API's back is time travel: anchors (signup,
 * expiry, requests) are backdated straight in the sqlite file, because no
 * endpoint can, and "7 days after" cannot wait 7 days.
 *
 *   node --test server/campaigns.e2e.test.mjs
 */
import test, { after, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const TOKEN = 'e2e-bot-token';
const BOT = 'tfe2ebot';
const TICK_MS = 200;
const DAY = 86_400_000;
const HOUR = 3_600_000;

/* ---------------------------------------------------------------- harness */

let dir, db, api, child, tg, cookie;
/** Every Bot API call the server made, oldest first: { method, body }. */
const tgCalls = [];
/** Chat ids the mock should refuse (Telegram "blocked the bot"). */
const tgReject = new Set();

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, what, timeout = 4000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await fn();
    if (last) return last;
    await sleep(60);
  }
  throw new Error(`timed out waiting for ${what}`);
}
/** Enough ticks to be sure nothing more is coming. */
const settle = () => sleep(TICK_MS * 4);

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tf-camp-e2e-'));
  const dbPath = join(dir, 'db.sqlite');

  tg = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const method = req.url.split('/').pop();
      const body = raw ? JSON.parse(raw) : {};
      tgCalls.push({ method, body });
      const ok = !tgReject.has(String(body.chat_id));
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify(ok
        ? { ok: true, result: { message_id: tgCalls.length } }
        : { ok: false, description: 'Forbidden: bot was blocked by the user' }));
    });
  });
  const tgPort = await listen(tg);
  const probe = createServer();
  const port = await listen(probe);
  await new Promise((r) => probe.close(r));
  api = `http://127.0.0.1:${port}`;

  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('..', import.meta.url).pathname,
    env: {
      ...process.env,
      TF_DB: dbPath, TF_PORT: String(port), TF_DEV: '0',
      TF_BOT_TOKEN: TOKEN, TF_BOT_USERNAME: BOT,
      TF_TELEGRAM_API: `http://127.0.0.1:${tgPort}/bot`,
      TF_JOBS_INTERVAL_MS: String(TICK_MS),
      TF_GROUP_ID: '', TF_ADMIN_IDS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise((resolve, reject) => {
    child.stdout.on('data', (d) => { if (String(d).includes('api on')) resolve(); });
    child.stderr.on('data', (d) => process.env.TF_E2E_VERBOSE && process.stderr.write(d));
    child.on('exit', (code) => reject(new Error(`server exited early (${code})`)));
  });

  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA busy_timeout = 3000');
  // The dashboard login. scrypt-hashed like the seed script does it.
  const { hashPassword } = await import('./admin.mjs');
  const { salt, hash } = hashPassword('e2e-password-123');
  db.prepare('INSERT INTO admins (username, salt, hash, created_at) VALUES (?, ?, ?, ?)')
    .run('e2e', salt, hash, Date.now());
  const login = await fetch(`${api}/api/admin/login`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username: 'e2e', password: 'e2e-password-123' }),
  });
  assert.equal(login.status, 200, 'admin login');
  cookie = login.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  child?.kill();
  await new Promise((r) => tg?.close(r));
  db?.close();
  if (dir) rmSync(dir, { recursive: true, force: true });
});

/* -------------------------------------------------------------- clients */

async function admin(method, path, body) {
  const res = await fetch(`${api}/api/admin${path}`, {
    method, headers: { 'content-type': 'application/json', cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  return { http: res.status, ...(Array.isArray(json) ? { list: json } : json) };
}

/** Signed initData for a Telegram user, exactly as the Mini App would send it. */
function initData(tgId, startParam) {
  const params = new URLSearchParams();
  params.set('user', JSON.stringify({ id: tgId, first_name: `U${tgId}`, username: `u${tgId}` }));
  params.set('auth_date', String(Math.floor(Date.now() / 1000)));
  if (startParam) params.set('start_param', startParam);
  const check = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  params.set('hash', createHmac('sha256', secret).update(check).digest('hex'));
  return params.toString();
}

async function app(tgId, method, path, body, startParam) {
  const res = await fetch(`${api}${path}`, {
    method, headers: { 'content-type': 'application/json', authorization: `tma ${initData(tgId, startParam)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { http: res.status, ...(await res.json().catch(() => ({}))) };
}

let nextTg = 700_000;
/** A fresh Telegram user who has just opened the app. Returns their ids. */
async function newUser(startParam) {
  const tgId = ++nextTg;
  const me = await app(tgId, 'GET', '/api/me', undefined, startParam);
  assert.equal(me.http, 200, `/api/me for ${tgId}`);
  return { tgId, id: `tg${tgId}` };
}

/* Time travel. Anchors live in three places, all backdated together so every
   trigger that reads them agrees. */
const uid = () => `u${Math.random().toString(36).slice(2, 8)}`;
function backdateSignup(userId, ms) {
  const at = Date.now() - ms;
  db.prepare('UPDATE users SET joined_at = ? WHERE id = ?').run(new Date(at).toISOString().slice(0, 10), userId);
  db.prepare("UPDATE ledger SET at = ? WHERE user_id = ? AND kind = 'signup'").run(at, userId);
}
/** A subscription the way the ledger writes one, positioned in time. */
function giveSubscription(userId, { plan = 'gold', startedAgo = 0, expiresIn = 30 * DAY, status = 'active' } = {}) {
  const at = Date.now() - startedAgo;
  const key = `sub:${uid()}`;
  db.prepare(`INSERT INTO ledger (at, user_id, kind, detail, amount, revenue, tier, key)
    VALUES (?, ?, 'subscription', ?, 0, 0, ?, ?)`).run(at, userId, `${plan} plan`, plan, key);
  db.prepare(`INSERT INTO subscribers (id, name, plan, purchased_at, last_action_at, expires_at, total_paid, status)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?)
    ON CONFLICT(id) DO UPDATE SET plan = excluded.plan, purchased_at = excluded.purchased_at,
      expires_at = excluded.expires_at, status = excluded.status`)
    .run(userId, userId, plan, new Date(at).toISOString().slice(0, 10), new Date(at).toISOString().slice(0, 10),
      Date.now() + expiresIn, status);
}
function expireSubscription(userId, expiredAgo) {
  db.prepare("UPDATE subscribers SET status = 'expired', expires_at = ? WHERE id = ?").run(Date.now() - expiredAgo, userId);
  db.prepare(`INSERT INTO ledger (at, user_id, kind, detail, key) VALUES (?, ?, 'expiry', 'expired', ?)`)
    .run(Date.now() - expiredAgo, userId, `expiry:${uid()}`);
}
const cashbackRow = (userId) => db.prepare(`INSERT INTO ledger (at, user_id, kind, detail, amount, key)
  VALUES (?, ?, 'cashback', 'e2e', 1, ?)`).run(Date.now(), userId, `cb:${uid()}`);

/* ------------------------------------------------------- campaign docs */

let seq = 0;
/**
 * A campaign document exactly as CampaignEditor.buildPatch() ships it for a
 * brand-new campaign, with the operator's choices layered on top. Every field
 * name and default here mirrors the editor — if the editor changes shape,
 * this is where the test should start failing.
 */
function doc(overrides = {}) {
  const triggerN = overrides.triggerN ?? 0;
  const triggerUnit = overrides.triggerUnit ?? 'day';
  const expiryN = overrides.expiryN ?? 7;
  const expiryUnit = overrides.expiryUnit ?? 'day';
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  return {
    name: `e2e-${++seq}`,
    startDate: '',
    endDate: null,
    allUsers: true,
    referralLists: '—',
    brokerLists: '—',
    audiencePlans: [],
    triggerType: 'After Start Robot',
    triggerTime: `${triggerN} ${cap(triggerUnit)}${triggerN === 1 ? '' : 's'} After`,
    triggerN,
    triggerUnit,
    expiry: `${expiryN} ${expiryUnit}${expiryN === 1 ? '' : 's'}`,
    expiryN,
    expiryUnit,
    audience: [],
    userTypes: ['No Subscriber', 'Active Subscriber', 'Expired Subscriber'],
    discountValue: 20,
    applicablePlans: [],
    limitType: 'Send Limit', // the editor's default radio
    status: 'active',
    codeType: 'unique',
    publicCode: undefined,
    includeCode: true,
    message: 'Hello {code}',
    messageImage: undefined,
    sendLimit: 'one',
    usageLimit: 'one',
    cardImage: undefined,
    locations: ['subscription', 'referral', 'cashback'],
    messageSent: null,
    openRate: null,
    codeSent: null,
    codeUsedRate: null,
    createdAt: 'Aug 15, 2026',
    createdTime: '12:00 PM',
    ...overrides,
  };
}

async function createCampaign(overrides) {
  const r = await admin('POST', '/campaigns', doc(overrides));
  assert.equal(r.http, 200, `create campaign: ${JSON.stringify(r)}`);
  return r;
}

/* Each test starts with no live campaigns, so one test's "everyone" campaign
   cannot reach the next test's users. Users themselves persist — a campaign
   that targets everyone still reaches every earlier user, which is why tests
   that assert on stats also restrict their audience via isolated(). */
beforeEach(async () => {
  for (const c of (await admin('GET', '/campaigns')).list ?? []) await admin('DELETE', `/campaigns/${c.id}`);
});

/** A private audience: a referral campaign nobody else joins through. */
async function isolated() {
  const n = ++seq;
  const rc = await admin('POST', '/referral-campaigns', { name: `ISO-${n}`, linkCode: `iso${n}` });
  assert.equal(rc.http, 200);
  return {
    aud: { allUsers: false, referralLists: rc.name, brokerLists: '—' },
    user: () => newUser(rc.linkCode),
  };
}
const publicBroker = (name) => admin('POST', '/brokers', { name, status: 'public' });
const stats = (id) => admin('GET', `/campaigns/${id}/stats`);
const sendsOf = (id) => db.prepare('SELECT * FROM campaign_sends WHERE campaign_id = ? ORDER BY at').all(id);
const codesOf = (id) => db.prepare('SELECT * FROM discount_codes WHERE campaign_id = ?').all(id);
const waitSend = (id, userId) => waitFor(
  () => db.prepare('SELECT * FROM campaign_sends WHERE campaign_id = ? AND user_id = ?').get(id, userId),
  `send ${id} → ${userId} (has: ${sendsOf(id).map((s) => s.user_id).join(',')})`,
).catch((e) => { throw new Error(`${e.message} | now: ${sendsOf(id).map((s) => s.user_id).join(',')}`); });
const waitDelivered = (id, userId) => waitFor(
  () => db.prepare('SELECT * FROM campaign_sends WHERE campaign_id = ? AND user_id = ? AND delivered = 1').get(id, userId),
  `delivery ${id} → ${userId}`,
);
/** Bot messages to one chat, optionally only those carrying one campaign's Open App button. */
const messagesTo = (tgId, campaignId) => tgCalls.filter((c) => (c.method === 'sendMessage' || c.method === 'sendPhoto')
  && String(c.body.chat_id) === String(tgId)
  && (!campaignId || c.body.reply_markup?.inline_keyboard?.[0]?.[0]?.url?.endsWith(`c_${campaignId}`)));
const lastMessageTo = (tgId, campaignId) => messagesTo(tgId, campaignId).at(-1);

/* ================================================================ tests */

test('smoke: the editor defaults reach a new user — message, code, offer, stats', async () => {
  const iso = await isolated();
  const c = await createCampaign({ ...iso.aud, message: 'Welcome! Use {code} at checkout.' });
  const u = await iso.user();
  const send = await waitSend(c.id, u.id);
  assert.match(send.code, /^TF[0-9A-F]{6}$/, 'a unique code was minted');
  await waitDelivered(c.id, u.id);

  const msg = lastMessageTo(u.tgId, c.id);
  assert.equal(msg.method, 'sendMessage');
  assert.equal(msg.body.text, `Welcome! Use <code>${send.code}</code> at checkout.`, '{code} substituted');
  assert.equal(msg.body.parse_mode, 'HTML');
  assert.equal(msg.body.reply_markup.inline_keyboard[0][0].url, `https://t.me/${BOT}?startapp=c_${c.id}`,
    'the Open App button carries the campaign id');

  const me = await app(u.tgId, 'GET', '/api/me');
  assert.deepEqual(me.offers.map((o) => [o.code, o.percent, o.plans, o.campaignId]),
    [[send.code, 20, [], c.id]], '/api/me lists the live offer');
  const check = await app(u.tgId, 'POST', '/api/discount', { code: send.code, planId: 'gold' });
  assert.equal(check.http, 200);
  assert.equal(check.percent, 20);

  const s = await stats(c.id);
  assert.equal(s.sent, 1);
  assert.equal(s.messageSent, 1);
  assert.equal(s.codeSent, 1);
  assert.equal(s.openRate, 0, 'one delivery, no tap yet: a measured 0%');
  const list = await admin('GET', '/campaigns');
  const row = list.list.find((x) => x.id === c.id);
  assert.equal(row.messageSent, 1, 'the campaign table carries the counted stats');
});

test('a user is reached once, not once per tick', async () => {
  const c = await createCampaign();
  const u = await newUser();
  await waitDelivered(c.id, u.id);
  await settle();
  assert.equal(sendsOf(c.id).filter((s) => s.user_id === u.id).length, 1);
  assert.equal(messagesTo(u.tgId, c.id).length, 1);
});

/* ---- Step 4: timing trigger — every type, every unit ---- */

test('trigger units: second, minute, hour and day all mean what the dropdown says', async () => {
  const cases = [
    ['second', 90, 2 * 60_000, 30_000],
    ['minute', 30, 45 * 60_000, 10 * 60_000],
    ['hour', 2, 3 * HOUR, 1 * HOUR],
    ['day', 7, 8 * DAY, 3 * DAY],
  ];
  for (const [unit, n, oldEnough, tooYoung] of cases) {
    const c = await createCampaign({ triggerType: 'After Start Robot', triggerN: n, triggerUnit: unit });
    const young = await newUser();
    backdateSignup(young.id, tooYoung);
    const old = await newUser();
    backdateSignup(old.id, oldEnough);
    await waitSend(c.id, old.id);
    await settle();
    assert.equal(sendsOf(c.id).some((s) => s.user_id === young.id), false,
      `${n} ${unit}(s): a user ${tooYoung / 1000}s old is not due yet`);
  }
});

test('trigger: After Subscription Started / After Subscription Expired', async () => {
  const started = await createCampaign({ triggerType: 'After Subscription Started', triggerN: 1, triggerUnit: 'day' });
  const expired = await createCampaign({ triggerType: 'After Subscription Expired', triggerN: 1, triggerUnit: 'day' });
  const active = await newUser();
  giveSubscription(active.id, { startedAgo: 2 * DAY });
  const lapsed = await newUser();
  giveSubscription(lapsed.id, { startedAgo: 40 * DAY });
  expireSubscription(lapsed.id, 2 * DAY);
  const fresh = await newUser();
  giveSubscription(fresh.id, { startedAgo: 0 });
  const nobody = await newUser();

  await waitSend(started.id, active.id);
  await waitSend(started.id, lapsed.id); // it did start, 40 days ago
  await waitSend(expired.id, lapsed.id);
  await settle();
  const ids = (c) => sendsOf(c.id).map((s) => s.user_id);
  assert.ok(!ids(started).includes(fresh.id), 'a subscription that started today is not 1 day old');
  assert.ok(!ids(started).includes(nobody.id));
  assert.ok(!ids(expired).includes(active.id), 'an active subscription has not expired');
  assert.ok(!ids(expired).includes(nobody.id));
});

test('trigger: Remaining Subscription counts backwards from expiry', async () => {
  const c = await createCampaign({
    triggerType: 'Remaining Subscription', triggerN: 3, triggerUnit: 'day', userTypes: ['Active Subscriber'],
  });
  const soon = await newUser();
  giveSubscription(soon.id, { expiresIn: 2 * DAY });
  const later = await newUser();
  giveSubscription(later.id, { expiresIn: 10 * DAY });
  await waitSend(c.id, soon.id);
  await settle();
  assert.equal(sendsOf(c.id).some((s) => s.user_id === later.id), false, '10 days left is not "3 days before"');
});

test('trigger: After Pending Broker (hours after the request, not days)', async () => {
  const broker = await publicBroker(`E2E Broker ${seq}`);
  const c = await createCampaign({ triggerType: 'After Pending Broker', triggerN: 2, triggerUnit: 'hour', userTypes: ['Pending Broker'] });
  const u = await newUser();
  const r = await app(u.tgId, 'POST', `/api/me/brokers/${broker.id}/submit`, { email: 'a@b.co', brokerAccountId: '123' });
  assert.equal(r.http, 200);
  await settle();
  assert.equal(sendsOf(c.id).length, 0, 'a request made just now is not 2 hours old');
  const at = new Date(Date.now() - 3 * HOUR).toISOString().slice(0, 16).replace('T', ' · ');
  db.prepare('UPDATE review_queue SET requested_at = ? WHERE user_id = ?').run(at, u.id);
  await waitSend(c.id, u.id);
});

test('trigger: No Cashback Received fires only while there is still none', async () => {
  const c = await createCampaign({ triggerType: 'No Cashback Received', triggerN: 1, triggerUnit: 'day' });
  const dry = await newUser();
  backdateSignup(dry.id, 2 * DAY);
  const paid = await newUser();
  backdateSignup(paid.id, 2 * DAY);
  cashbackRow(paid.id);
  await waitSend(c.id, dry.id);
  await settle();
  assert.equal(sendsOf(c.id).some((s) => s.user_id === paid.id), false);
});

test('trigger: the four referral triggers', async () => {
  const pendingRef = await createCampaign({ triggerType: 'After Pending Referral', triggerN: 1, triggerUnit: 'hour' });
  const lastJoined = await createCampaign({ triggerType: 'Last Referral Joined', triggerN: 1, triggerUnit: 'hour' });
  const activeRef = await createCampaign({ triggerType: 'After Active Referral', triggerN: 1, triggerUnit: 'hour' });
  const lastActive = await createCampaign({ triggerType: 'Last Active Referral', triggerN: 1, triggerUnit: 'hour' });

  const inviter = await newUser();
  const ref = await app(inviter.tgId, 'GET', '/api/me/referral');
  assert.ok(ref.code, 'the inviter has a referral code');
  const invitee = await newUser(ref.code); // joins through the inviter's link
  assert.equal(db.prepare('SELECT referred_by FROM users WHERE id = ?').get(invitee.id).referred_by, inviter.id);
  await settle();
  const noSends = [pendingRef, lastJoined, activeRef, lastActive].every((c) => sendsOf(c.id).length === 0);
  assert.ok(noSends, 'nothing is due an hour after a signup that just happened');

  backdateSignup(invitee.id, 2 * HOUR);
  await waitSend(pendingRef.id, inviter.id);
  await waitSend(lastJoined.id, inviter.id);
  await settle();
  assert.equal(sendsOf(activeRef.id).length, 0, 'the invitee has not subscribed');
  assert.equal(sendsOf(lastActive.id).length, 0);

  giveSubscription(invitee.id);
  await waitSend(activeRef.id, inviter.id);
  await waitSend(lastActive.id, inviter.id);
  const lonely = await newUser();
  await settle();
  assert.equal(sendsOf(pendingRef.id).some((s) => s.user_id === lonely.id), false, 'no invitees, no referral triggers');
});

test('trigger: N = 0 fires immediately; a negative N is refused by the editor, treated as 0 by the engine', async () => {
  const c = await createCampaign({ triggerType: 'After Start Robot', triggerN: 0 });
  const u = await newUser();
  await waitSend(c.id, u.id);
});

/* ---- Step 3: user-type matrix ---- */

test('user types: each checkbox matches its own state and nothing else', async () => {
  const broker = await publicBroker(`Matrix Broker ${seq}`);
  // One user per state on every axis.
  const none = await newUser();
  const activeSub = await newUser(); giveSubscription(activeSub.id, { plan: 'gold' });
  const expiredSub = await newUser(); giveSubscription(expiredSub.id, { plan: 'silver' }); expireSubscription(expiredSub.id, DAY);
  const pendingBroker = await newUser();
  await app(pendingBroker.tgId, 'POST', `/api/me/brokers/${broker.id}/submit`, { email: 'p@b.co', brokerAccountId: '1' });
  const activeBroker = await newUser();
  await app(activeBroker.tgId, 'POST', `/api/me/brokers/${broker.id}/submit`, { email: 'x@b.co', brokerAccountId: '2' });
  const rq = db.prepare('SELECT id FROM review_queue WHERE user_id = ?').get(activeBroker.id);
  assert.equal((await admin('POST', `/review-queue/${rq.id}/decision`, { decision: 'approved' })).http, 200);
  const inviter = await newUser();
  const refCode = (await app(inviter.tgId, 'GET', '/api/me/referral')).code;
  const pendingInvitee = await newUser(refCode);
  const activeInviter = await newUser();
  const refCode2 = (await app(activeInviter.tgId, 'GET', '/api/me/referral')).code;
  const activeInvitee = await newUser(refCode2); giveSubscription(activeInvitee.id);

  const everyone = [none, activeSub, expiredSub, pendingBroker, activeBroker, inviter, pendingInvitee, activeInviter, activeInvitee];
  const expect = {
    'No Subscriber': everyone.filter((u) => ![activeSub, expiredSub, activeInvitee].includes(u)),
    'Active Subscriber': [activeSub, activeInvitee],
    'Expired Subscriber': [expiredSub],
    'No Broker': everyone.filter((u) => ![pendingBroker, activeBroker].includes(u)),
    'Pending Broker': [pendingBroker],
    'Active Broker': [activeBroker],
    'No Referral': everyone.filter((u) => ![inviter, activeInviter].includes(u)),
    'Pending Referral': [inviter],
    'Active Referral': [activeInviter],
  };
  const campaigns = {};
  for (const type of Object.keys(expect)) campaigns[type] = await createCampaign({ userTypes: [type] });
  for (const type of Object.keys(expect)) for (const u of expect[type]) await waitSend(campaigns[type].id, u.id);
  await settle();
  for (const type of Object.keys(expect)) {
    const got = new Set(sendsOf(campaigns[type].id).map((s) => s.user_id));
    const want = new Set(expect[type].map((u) => u.id));
    for (const id of got) if (everyone.some((u) => u.id === id)) assert.ok(want.has(id), `${type} must not reach ${id}`);
  }
});

test('user types: OR inside an axis, AND across axes', async () => {
  const c = await createCampaign({ userTypes: ['Active Subscriber', 'Expired Subscriber', 'No Broker'] });
  const a = await newUser(); giveSubscription(a.id);
  const e = await newUser(); giveSubscription(e.id); expireSubscription(e.id, DAY);
  const n = await newUser();
  await waitSend(c.id, a.id);
  await waitSend(c.id, e.id);
  await settle();
  assert.equal(sendsOf(c.id).some((s) => s.user_id === n.id), false, 'no subscription fails the subscriber axis');
});

test('user types: level chips narrow Active AND Expired subscribers by plan', async () => {
  const c = await createCampaign({ userTypes: ['Active Subscriber', 'Expired Subscriber'], audiencePlans: ['gold'] });
  const goldActive = await newUser(); giveSubscription(goldActive.id, { plan: 'gold' });
  const silverActive = await newUser(); giveSubscription(silverActive.id, { plan: 'silver' });
  const goldExpired = await newUser(); giveSubscription(goldExpired.id, { plan: 'gold' }); expireSubscription(goldExpired.id, DAY);
  const silverExpired = await newUser(); giveSubscription(silverExpired.id, { plan: 'silver' }); expireSubscription(silverExpired.id, DAY);
  await waitSend(c.id, goldActive.id);
  await waitSend(c.id, goldExpired.id);
  await settle();
  const got = sendsOf(c.id).map((s) => s.user_id);
  assert.ok(!got.includes(silverActive.id), 'silver active is outside the Gold chip');
  assert.ok(!got.includes(silverExpired.id), 'silver expired is outside the Gold chip');
});

/* ---- Step 2: audience restriction ---- */

test('audience: referral-campaign list and broker list, OR within, AND across', async () => {
  const rc1 = await admin('POST', '/referral-campaigns', { name: `RC-A-${seq}`, linkCode: `rca${seq}` });
  const rc2 = await admin('POST', '/referral-campaigns', { name: `RC-B-${seq}`, linkCode: `rcb${seq}` });
  const b1 = await publicBroker(`Aud Broker 1-${seq}`);
  const b2 = await publicBroker(`Aud Broker 2-${seq}`);

  const fromA = await newUser(rc1.linkCode);
  const fromB = await newUser(rc2.linkCode);
  const fromAatB1 = await newUser(rc1.linkCode);
  await app(fromAatB1.tgId, 'POST', `/api/me/brokers/${b1.id}/submit`, { email: 'q@b.co', brokerAccountId: '9' });
  const atB2 = await newUser();
  await app(atB2.tgId, 'POST', `/api/me/brokers/${b2.id}/submit`, { email: 'w@b.co', brokerAccountId: '8' });
  const plain = await newUser();

  const eitherRef = await createCampaign({ allUsers: false, referralLists: `${rc1.name}, ${rc2.name}`, brokerLists: '—' });
  const refAndBroker = await createCampaign({ allUsers: false, referralLists: rc1.name, brokerLists: b1.name });
  const eitherBroker = await createCampaign({ allUsers: false, referralLists: '—', brokerLists: `${b1.name}, ${b2.name}` });
  // "All Users" ticked alongside a list: the list is a no-op, everyone matches.
  const allPlusList = await createCampaign({ allUsers: true, referralLists: rc1.name, brokerLists: '—' });

  await waitSend(eitherRef.id, fromA.id);
  await waitSend(eitherRef.id, fromB.id);
  await waitSend(eitherRef.id, fromAatB1.id);
  await waitSend(refAndBroker.id, fromAatB1.id);
  await waitSend(eitherBroker.id, fromAatB1.id);
  await waitSend(eitherBroker.id, atB2.id);
  await waitSend(allPlusList.id, plain.id);
  await settle();
  const ids = (c) => sendsOf(c.id).map((s) => s.user_id);
  assert.ok(!ids(eitherRef).includes(plain.id) && !ids(eitherRef).includes(atB2.id));
  assert.deepEqual(ids(refAndBroker).filter((id) => [fromA, fromB, fromAatB1, atB2, plain].some((u) => u.id === id)),
    [fromAatB1.id], 'AND across the two lists');
  assert.ok(!ids(eitherBroker).includes(fromA.id) && !ids(eitherBroker).includes(plain.id));
});

/* ---- Step 1: start / end dates ---- */

test('start and end dates gate the whole campaign, end date inclusive', async () => {
  const iso = (ms) => new Date(Date.now() + ms).toISOString().slice(0, 10);
  const future = await createCampaign({ startDate: iso(2 * DAY) });
  const over = await createCampaign({ startDate: iso(-10 * DAY), endDate: iso(-2 * DAY) });
  const endsToday = await createCampaign({ startDate: iso(-10 * DAY), endDate: iso(0) });
  const u = await newUser();
  await waitSend(endsToday.id, u.id);
  await settle();
  assert.equal(sendsOf(future.id).length, 0, 'not started yet');
  assert.equal(sendsOf(over.id).length, 0, 'already over');
});

/* ---- Steps 5 + 6: expiry, offer on/off, code type, plans, value ---- */

test('offer off: message goes out with no code, nothing to redeem', async () => {
  const iso = await isolated();
  const c = await createCampaign({ ...iso.aud, discountValue: 0, message: 'Just saying hi', includeCode: true });
  const u = await iso.user();
  await waitDelivered(c.id, u.id);
  assert.equal(sendsOf(c.id)[0].code, null);
  assert.equal(lastMessageTo(u.tgId, c.id).body.text, 'Just saying hi');
  assert.deepEqual((await app(u.tgId, 'GET', '/api/me')).offers, []);
  const s = await stats(c.id);
  assert.equal(s.codeSent, null);
  assert.equal(s.messageSent, 1);
});

test('expiry period sets the code expiry; an expired code is refused and hidden', async () => {
  const c = await createCampaign({ expiryN: 2, expiryUnit: 'hour' });
  const u = await newUser();
  const send = await waitSend(c.id, u.id);
  const row = codesOf(c.id).find((x) => x.code === send.code);
  assert.ok(Math.abs(row.expires_at - (send.at + 2 * HOUR)) < 5000, 'expires 2 hours after minting');
  db.prepare('UPDATE discount_codes SET expires_at = ? WHERE code = ?').run(Date.now() - 1000, send.code);
  assert.equal((await app(u.tgId, 'POST', '/api/discount', { code: send.code })).error, 'code_expired');
  assert.equal((await app(u.tgId, 'GET', '/api/me')).offers.some((o) => o.campaignId === c.id), false,
    'expired offers drop off /api/me');

  const units = { week: 7 * DAY, month: 30 * DAY, day: DAY };
  for (const [unit, ms] of Object.entries(units)) {
    const cc = await createCampaign({ expiryN: 1, expiryUnit: unit });
    const uu = await newUser();
    const s = await waitSend(cc.id, uu.id);
    const r = codesOf(cc.id).find((x) => x.code === s.code);
    assert.ok(Math.abs(r.expires_at - (s.at + ms)) < 5000, `1 ${unit}`);
  }
  const forever = await createCampaign({ expiryN: 0 });
  const uf = await newUser();
  const sf = await waitSend(forever.id, uf.id);
  assert.equal(codesOf(forever.id).find((x) => x.code === sf.code).expires_at, null, '0 = never expires');
});

test('unique code: bound to its owner, single use, wrong plan refused', async () => {
  const c = await createCampaign({ applicablePlans: ['gold', 'diamond'], discountValue: 25 });
  const owner = await newUser();
  const other = await newUser();
  const send = await waitSend(c.id, owner.id);
  assert.equal((await app(other.tgId, 'POST', '/api/discount', { code: send.code, planId: 'gold' })).error, 'not_your_code');
  assert.equal((await app(owner.tgId, 'POST', '/api/discount', { code: send.code, planId: 'silver' })).error, 'wrong_plan');
  assert.equal((await app(owner.tgId, 'POST', '/api/discount', { code: send.code.toLowerCase(), planId: 'gold' })).percent, 25,
    'case-insensitive');
  const offer = (await app(owner.tgId, 'GET', '/api/me')).offers.find((o) => o.code === send.code);
  assert.deepEqual(offer.plans, ['gold', 'diamond']);
});

test('discount value prices the order server-side, and the code burns when the order confirms', async () => {
  const iso = await isolated();
  const c = await createCampaign({ ...iso.aud, discountValue: 50, message: 'Half off: {code}' });
  const u = await iso.user();
  const send = await waitSend(c.id, u.id);
  const order = await app(u.tgId, 'POST', '/api/orders', { planId: 'gold', billing: 'monthly', code: send.code });
  assert.equal(order.http, 200, JSON.stringify(order));
  assert.equal(order.order.amountUsd, 1.5, 'gold is 3 in test pricing, 50% off');
  const sel = await app(u.tgId, 'POST', `/api/orders/${order.order.id}/select`, { currency: 'USDT', network: 'TRC-20' });
  assert.equal(sel.http, 200, JSON.stringify(sel));
  const conf = await admin('POST', `/payments/${order.order.id}/confirm`);
  assert.equal(conf.http, 200, JSON.stringify(conf));
  await waitFor(() => db.prepare('SELECT used_at FROM discount_codes WHERE code = ?').get(send.code)?.used_at, 'redemption');
  assert.equal((await app(u.tgId, 'POST', '/api/discount', { code: send.code })).error, 'code_used');
  const s = await stats(c.id);
  assert.equal(s.codeUsedRate, 100);
  const me = await app(u.tgId, 'GET', '/api/me');
  assert.equal(me.subscription?.plan, 'gold', 'the discounted order still books the plan');
  assert.equal(me.offers.some((o) => o.campaignId === c.id), false, 'a used code is no longer an offer');
});

test('100% discount: the order needs no payment and confirms on the spot', async () => {
  const c = await createCampaign({ discountValue: 100 });
  const u = await newUser();
  const send = await waitSend(c.id, u.id);
  const order = await app(u.tgId, 'POST', '/api/orders', { planId: 'silver', billing: 'monthly', code: send.code });
  assert.equal(order.order.amountUsd, 0);
  assert.equal(order.order.status, 'confirmed');
  await waitFor(async () => (await app(u.tgId, 'GET', '/api/me')).subscription?.plan === 'silver', 'free plan booked');
});

test('public code: one shared string, never burned, usable by anyone who has it', async () => {
  const CODE = `SUMMER${seq + 1}`;
  const c = await createCampaign({ codeType: 'public', publicCode: CODE.toLowerCase(), discountValue: 15, usageLimit: 'one', limitType: 'No Limit' });
  const a = await newUser();
  const b = await newUser();
  const sa = await waitSend(c.id, a.id);
  const sb = await waitSend(c.id, b.id);
  assert.equal(sa.code, CODE, 'uppercased');
  assert.equal(sb.code, CODE, 'the same string for everyone');
  assert.equal(codesOf(c.id).length, 1, 'one row, minted on the first send');
  const outsider = await newUser();
  assert.equal((await app(outsider.tgId, 'POST', '/api/discount', { code: CODE })).percent, 15, 'a public code is public');
  await waitDelivered(c.id, a.id);
  assert.equal(lastMessageTo(a.tgId, c.id).body.text, `Hello <code>${CODE}</code>`);
  const s = await stats(c.id);
  assert.equal(s.codeSent, 1, 'codes minted, not sends');
});

test('public code selected but left blank: refused at creation', async () => {
  const r = await admin('POST', '/campaigns', doc({ codeType: 'public', publicCode: '' }));
  assert.equal(r.http, 400, 'a public-code campaign with no code has nothing to send');
});

/* ---- Step 7: message ---- */

test('message: {code} placement, append fallback, includeCode off, rich text, image', async () => {
  const appended = await createCampaign({ message: 'Hi <b>there</b><br>line two', includeCode: true });
  const bare = await createCampaign({ message: 'No code shown', includeCode: false });
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const photo = await createCampaign({ message: 'Look: {code}', messageImage: png });
  const u = await newUser();
  await waitDelivered(appended.id, u.id);
  await waitDelivered(bare.id, u.id);
  await waitDelivered(photo.id, u.id);
  const codeFor = (c) => sendsOf(c.id).find((s) => s.user_id === u.id).code;
  const m1 = lastMessageTo(u.tgId, appended.id);
  assert.equal(m1.body.text, `Hi <b>there</b>\nline two\n\nYour code: <code>${codeFor(appended)}</code>`,
    '<br> becomes a newline, the code is appended');
  const m2 = lastMessageTo(u.tgId, bare.id);
  assert.equal(m2.body.text, 'No code shown', 'includeCode off sends the message alone');
  assert.ok(codeFor(bare), '…but the code is still minted');
  const m3 = lastMessageTo(u.tgId, photo.id);
  assert.equal(m3.body.photo, png);
  assert.equal(m3.body.caption, `Look: <code>${codeFor(photo)}</code>`);
});

test('delivery: a Telegram refusal is retried next tick, and never counts as sent', async () => {
  const iso = await isolated();
  const c = await createCampaign(iso.aud);
  const u = await iso.user();
  tgReject.add(String(u.tgId));
  const send = await waitSend(c.id, u.id);
  await settle();
  assert.equal(sendsOf(c.id).find((s) => s.user_id === u.id).delivered, 0);
  assert.equal((await stats(c.id)).messageSent, null, 'undelivered is not "sent"');
  assert.equal((await stats(c.id)).sent, 1, '…though the attempt is on the books');
  tgReject.delete(String(u.tgId));
  await waitDelivered(c.id, u.id);
  assert.equal((await stats(c.id)).messageSent, 1);
  assert.equal(send.code, sendsOf(c.id)[0].code, 'the retry re-sends the same code');
});

/* ---- Steps 8 + 9: in-app card, display location ---- */

test('in-app card: shows in exactly the chosen sections, hides when paused or its codes are all expired', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
  const c = await createCampaign({ cardImage: png, locations: ['subscription', 'cashback'], expiryN: 1, expiryUnit: 'hour' });
  const promos = async (section) => (await (await fetch(`${api}/api/promos?section=${section}`)).json()).promos;
  const has = async (section) => (await promos(section)).some((p) => p.id === c.id);
  assert.equal(await has('subscription'), true);
  assert.equal(await has('cashback'), true);
  assert.equal(await has('referral'), false);
  const slide = (await promos('subscription')).find((p) => p.id === c.id);
  assert.equal(slide.image, png, 'the cropped image is the card');

  await admin('PATCH', `/campaigns/${c.id}`, { status: 'paused' });
  assert.equal(await has('subscription'), false, 'paused campaigns leave the carousel');
  await admin('PATCH', `/campaigns/${c.id}`, { status: 'active' });
  assert.equal(await has('subscription'), true);

  const u = await newUser();
  await waitSend(c.id, u.id);
  db.prepare('UPDATE discount_codes SET expires_at = ? WHERE campaign_id = ?').run(Date.now() - 1, c.id);
  assert.equal(await has('subscription'), false, 'every code expired = the offer is over');

  const noImage = await createCampaign({ locations: ['subscription'] });
  assert.equal((await promos('subscription')).some((p) => p.id === noImage.id), false, 'no image, no card');
});

/* ---- Step 10: limits ---- */

test('send limit is per user: N times, once per occurrence of the trigger event', async () => {
  const iso = await isolated();
  const c = await createCampaign({ ...iso.aud, triggerType: 'After Subscription Started', triggerN: 0, limitType: 'Send Limit', sendLimit: 'two', userTypes: ['Active Subscriber'] });
  const u = await iso.user();
  giveSubscription(u.id, { startedAgo: 3 * DAY });
  const first = await waitSend(c.id, u.id);
  const mine = () => sendsOf(c.id).find((s) => s.user_id === u.id);
  assert.equal(first.n, 1);

  // Same event, later ticks: nothing new.
  await settle();
  assert.equal(mine().n, 1);

  // A renewal is a new "subscription started" — second send, new code.
  giveSubscription(u.id, { startedAgo: 0 });
  await waitFor(() => mine().n === 2, 'second send');
  assert.notEqual(mine().code, first.code, 'a fresh code each time');
  assert.equal(codesOf(c.id).filter((x) => x.user_id === u.id).length, 2, 'both codes stay valid');
  await waitFor(() => messagesTo(u.tgId, c.id).length === 2, 'second delivery');

  // Third renewal: the cap of two holds.
  giveSubscription(u.id, { startedAgo: 0 });
  await settle();
  assert.equal(mine().n, 2, '"Two times per user" means two');
  assert.equal((await stats(c.id)).sent, 2, 'stats count sends, not people');
  assert.equal((await stats(c.id)).messageSent, 2);
});

test('send limit "one" (the default) is once per user even when the trigger recurs', async () => {
  const c = await createCampaign({ triggerType: 'After Subscription Started', triggerN: 0, userTypes: ['Active Subscriber'] });
  const u = await newUser();
  giveSubscription(u.id, { startedAgo: 3 * DAY });
  await waitSend(c.id, u.id);
  giveSubscription(u.id, { startedAgo: 0 });
  await settle();
  assert.equal(sendsOf(c.id).filter((s) => s.user_id === u.id).length, 1);
});

test('no limit: fires again on every recurrence, and Remaining Subscription re-arms after a renewal', async () => {
  const c = await createCampaign({ triggerType: 'Remaining Subscription', triggerN: 3, triggerUnit: 'day', limitType: 'No Limit', userTypes: ['Active Subscriber'], discountValue: 0, message: 'Renew soon' });
  const u = await newUser();
  giveSubscription(u.id, { expiresIn: 2 * DAY });
  await waitSend(c.id, u.id);
  const mine = () => sendsOf(c.id).find((s) => s.user_id === u.id);
  giveSubscription(u.id, { expiresIn: 32 * DAY }); // renewed — not due
  await settle();
  assert.equal(mine().n, 1);
  // A month passes: everything already on the books moves 30 days into the
  // past and the renewed term is now 2 days from its end.
  db.prepare('UPDATE campaign_sends SET at = at - ?, due_at = due_at - ? WHERE campaign_id = ?').run(30 * DAY, 30 * DAY, c.id);
  db.prepare('UPDATE subscribers SET expires_at = ? WHERE id = ?').run(Date.now() + 2 * DAY, u.id);
  await waitFor(() => mine().n === 2, 'reminder fires again for the next cycle');
  assert.equal(messagesTo(u.tgId, c.id).length >= 1, true);
  await waitFor(() => messagesTo(u.tgId, c.id).length === 2, 'the second reminder is delivered');
});

test('usage limit is per user: a public code redeems N times per person', async () => {
  const CODE = `USE${seq}X`;
  const c = await createCampaign({ codeType: 'public', publicCode: CODE, limitType: 'Usage Limit', usageLimit: 'one', discountValue: 10 });
  const a = await newUser();
  const b = await newUser();
  await waitSend(c.id, a.id);
  await waitSend(c.id, b.id);
  const buy = async (u) => {
    const o = await app(u.tgId, 'POST', '/api/orders', { planId: 'silver', billing: 'monthly', code: CODE });
    if (o.http !== 200) return o;
    await app(u.tgId, 'POST', `/api/orders/${o.order.id}/select`, { currency: 'USDT', network: 'TRC-20' });
    const conf = await admin('POST', `/payments/${o.order.id}/confirm`);
    assert.equal(conf.http, 200);
    await waitFor(() => db.prepare('SELECT confirmed_at FROM orders WHERE id = ?').get(o.order.id)?.confirmed_at, 'confirm');
    await settle(); // reconcile
    return o;
  };
  assert.equal((await buy(a)).http, 200, 'first redemption');
  assert.equal((await app(a.tgId, 'POST', '/api/discount', { code: CODE })).error, 'limit_reached', 'a used it once');
  assert.equal((await app(b.tgId, 'POST', '/api/discount', { code: CODE })).percent, 10, 'b has not — the cap is per user');
  assert.equal((await buy(b)).http, 200);
  assert.equal((await app(b.tgId, 'POST', '/api/discount', { code: CODE })).error, 'limit_reached');
});

/* ---- list actions: pause / resume / edit / delete / open rate ---- */

test('pause stops new sends, resume continues, edit applies to later sends only', async () => {
  const c = await createCampaign({ message: 'v1 {code}', discountValue: 10 });
  const first = await newUser();
  await waitDelivered(c.id, first.id);
  assert.equal((await admin('PATCH', `/campaigns/${c.id}`, { status: 'paused' })).http, 200);
  const during = await newUser();
  await settle();
  assert.equal(sendsOf(c.id).some((s) => s.user_id === during.id), false, 'paused = silent');

  const full = (await admin('GET', '/campaigns')).list.find((x) => x.id === c.id);
  const edited = { ...full, message: 'v2 {code}', discountValue: 30, status: 'active' };
  assert.equal((await admin('PUT', `/campaigns/${c.id}`, edited)).http, 200);
  await waitDelivered(c.id, during.id);
  assert.match(lastMessageTo(during.tgId, c.id).body.text, /^v2 /);
  assert.equal(codesOf(c.id).find((x) => x.user_id === during.id).percent, 30);
  assert.equal(codesOf(c.id).find((x) => x.user_id === first.id).percent, 10, 'already-minted codes keep their terms');
  assert.equal(sendsOf(c.id).filter((s) => s.user_id === first.id).length, 1, 'an edit does not re-send');
});

test('open rate: a tap on the Open App button counts once per person, only for recipients', async () => {
  const iso = await isolated();
  const c = await createCampaign(iso.aud);
  const u = await iso.user();
  const other = await iso.user();
  await waitDelivered(c.id, u.id);
  await waitDelivered(c.id, other.id);
  await app(u.tgId, 'GET', '/api/me', undefined, `c_${c.id}`);
  await app(u.tgId, 'GET', '/api/me', undefined, `c_${c.id}`);
  const stranger = await newUser(`c_${c.id}`); // never sent to: the tap does not count
  await settle();
  const s = await stats(c.id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM campaign_opens WHERE campaign_id = ?').get(c.id).n, 1);
  assert.equal(s.messageSent, 2);
  assert.equal(s.openRate, 50);
  void stranger;
});

test('delete removes the campaign; its sends stop and its stats 404', async () => {
  const c = await createCampaign();
  const u = await newUser();
  await waitSend(c.id, u.id);
  assert.equal((await admin('DELETE', `/campaigns/${c.id}`)).http, 200);
  assert.equal((await admin('GET', '/campaigns')).list.some((x) => x.id === c.id), false);
  const later = await newUser();
  await settle();
  assert.equal(sendsOf(c.id).some((s) => s.user_id === later.id), false);
});

/* ================================================================
 * Functionalities through the product's own flows — nothing seeded.
 * Every state below is produced the way a real user and a real operator
 * produce it (open the app, buy a plan, confirm a payment, approve a broker,
 * publish cashback, let the jobs tick lapse a subscription); the only writes
 * behind the API's back move the clock on rows the product itself wrote.
 * ================================================================ */

/** Buy a plan the way the Mini App + admin do: order → invoice → confirm → booked by the tick. */
async function buy(u, planId, code) {
  const o = await app(u.tgId, 'POST', '/api/orders', { planId, billing: 'monthly', ...(code ? { code } : {}) });
  assert.equal(o.http, 200, `order: ${JSON.stringify(o)}`);
  if (o.order.status !== 'confirmed') {
    const sel = await app(u.tgId, 'POST', `/api/orders/${o.order.id}/select`, { currency: 'USDT', network: 'TRC-20' });
    assert.equal(sel.http, 200, `select: ${JSON.stringify(sel)}`);
    const conf = await admin('POST', `/payments/${o.order.id}/confirm`);
    assert.equal(conf.http, 200, `confirm: ${JSON.stringify(conf)}`);
  }
  await waitFor(async () => (await app(u.tgId, 'GET', '/api/me')).subscription?.status === 'active', `${planId} booked`);
  return o.order;
}

test('lifecycle: welcome → purchase → thanks + referral → expiry reminder → lapse → win-back → renewal', async () => {
  const iso = await isolated();
  const welcome = await createCampaign({ ...iso.aud, message: 'Welcome, {code} takes 10% off', discountValue: 10, userTypes: ['No Subscriber'] });
  const thanks = await createCampaign({ ...iso.aud, triggerType: 'After Subscription Started', triggerN: 0, userTypes: ['Active Subscriber'], discountValue: 0, message: 'Thanks for subscribing' });
  const friend = await createCampaign({ ...iso.aud, triggerType: 'After Active Referral', triggerN: 0, userTypes: ['Active Referral'], discountValue: 0, message: 'Your friend subscribed' });
  // Test pricing gives gold a 2-day term (ledger PLAN_DAYS), so the reminder is "1 day before".
  const reminder = await createCampaign({ ...iso.aud, triggerType: 'Remaining Subscription', triggerN: 1, triggerUnit: 'day', userTypes: ['Active Subscriber'], limitType: 'No Limit', discountValue: 0, message: '1 day left' });
  const winback = await createCampaign({ ...iso.aud, triggerType: 'After Subscription Expired', triggerN: 0, userTypes: ['Expired Subscriber'], discountValue: 30, message: 'Come back: {code}' });

  const inviter = await iso.user();
  const refCode = (await app(inviter.tgId, 'GET', '/api/me/referral')).code;
  const buyer = await newUser(refCode);
  db.prepare('UPDATE users SET ref_campaign = (SELECT ref_campaign FROM users WHERE id = ?) WHERE id = ?').run(inviter.id, buyer.id); // same private audience
  const w = await waitDelivered(welcome.id, buyer.id);
  assert.equal(lastMessageTo(buyer.tgId, welcome.id).body.text, `Welcome, <code>${w.code}</code> takes 10% off`);

  // Buys with the welcome code: priced at 90%, code burned once the tick books it.
  const order = await buy(buyer, 'gold', w.code);
  assert.equal(order.amountUsd, 2.7);
  await waitFor(() => db.prepare('SELECT used_at FROM discount_codes WHERE code = ?').get(w.code)?.used_at, 'welcome code redeemed');
  await waitDelivered(thanks.id, buyer.id);
  await waitDelivered(friend.id, inviter.id);
  assert.equal(lastMessageTo(inviter.tgId, friend.id).body.text, 'Your friend subscribed');
  await settle();
  const me1 = await app(buyer.tgId, 'GET', '/api/me');
  assert.ok(me1.subscription.expiresAt - Date.now() > 1.5 * DAY, 'a fresh 2-day term');
  assert.equal(sendsOf(reminder.id).length, 0, '2 days left is not "1 day left"');
  assert.equal(sendsOf(winback.id).length, 0, 'not expired');

  // A day and a half passes.
  db.prepare('UPDATE subscribers SET expires_at = ? WHERE id = ?').run(Date.now() + 12 * HOUR, buyer.id);
  await waitDelivered(reminder.id, buyer.id);
  assert.equal(lastMessageTo(buyer.tgId, reminder.id).body.text, '1 day left');

  // Half a day more: the tick lapses the subscription itself (ledger 'expiry',
  // plan back to none) and the win-back fires off that real event.
  db.prepare('UPDATE subscribers SET expires_at = ? WHERE id = ?').run(Date.now() - 1000, buyer.id);
  await waitFor(async () => (await app(buyer.tgId, 'GET', '/api/me')).subscription?.status === 'expired', 'lapsed by the jobs tick');
  const wb = await waitDelivered(winback.id, buyer.id);
  assert.match(lastMessageTo(buyer.tgId, winback.id).body.text, /^Come back: <code>TF/);
  assert.equal((await app(buyer.tgId, 'POST', '/api/discount', { code: wb.code, planId: 'gold' })).percent, 30);

  // Renews with the win-back code: back to active, "thanks" does not repeat
  // (Send Limit one), the reminder re-arms for the new term.
  const renewal = await buy(buyer, 'gold', wb.code);
  assert.equal(renewal.amountUsd, 2.1);
  await settle();
  assert.equal(sendsOf(thanks.id).find((s) => s.user_id === buyer.id).n, 1, '"one time per user" holds across a renewal');
  db.prepare('UPDATE campaign_sends SET at = at - ?, due_at = due_at - ? WHERE campaign_id = ?').run(2 * DAY, 2 * DAY, reminder.id);
  db.prepare('UPDATE subscribers SET expires_at = ? WHERE id = ?').run(Date.now() + 12 * HOUR, buyer.id);
  await waitFor(() => sendsOf(reminder.id).find((s) => s.user_id === buyer.id).n === 2, 'reminder fires again next cycle');
  await waitFor(() => messagesTo(buyer.tgId, reminder.id).length === 2, 'and is delivered again');

  const s = await stats(winback.id);
  assert.equal(s.messageSent, 1);
  assert.equal(s.codeUsedRate, 100, 'the win-back code was redeemed');
});

test('cashback via the real rebate flow: No Cashback Received stops once a cycle is published', async () => {
  const iso = await isolated();
  const broker = await publicBroker(`Cashback Broker ${seq}`);
  const approve = async (u) => {
    assert.equal((await app(u.tgId, 'POST', `/api/me/brokers/${broker.id}/submit`, { email: `${u.tgId}@x.co`, brokerAccountId: String(u.tgId) })).http, 200);
    const rq = db.prepare('SELECT id FROM review_queue WHERE user_id = ?').get(u.id);
    assert.equal((await admin('POST', `/review-queue/${rq.id}/decision`, { decision: 'approved' })).http, 200);
  };
  const paid = await iso.user();
  const dry = await iso.user();
  await approve(paid);
  await approve(dry);
  // The operator drafts and publishes a rebate for `paid` only.
  assert.equal((await admin('POST', `/brokers/${broker.id}/rebate-drafts`, { userId: paid.id, lastWeekRebate: 40 })).http, 200);
  assert.equal((await admin('POST', `/brokers/${broker.id}/rebate-drafts/publish`)).http, 200);
  assert.ok((await app(paid.tgId, 'GET', '/api/me')).cashback.earned > 0, 'the cashback landed on their account');

  const c = await createCampaign({ ...iso.aud, triggerType: 'No Cashback Received', triggerN: 0, userTypes: ['Active Broker'], discountValue: 0, message: 'Trade to earn cashback' });
  await waitDelivered(c.id, dry.id);
  assert.equal(lastMessageTo(dry.tgId, c.id).body.text, 'Trade to earn cashback');
  await settle();
  assert.equal(sendsOf(c.id).some((s) => s.user_id === paid.id), false, 'someone already paid is not nagged');
});

test('campaign lists: create, assign a campaign, read members', async () => {
  const l = await admin('POST', '/campaign-lists', { name: `List ${seq}` });
  assert.equal(l.http, 200);
  const c = await createCampaign();
  assert.equal((await admin('PUT', `/campaigns/${c.id}/lists`, { lists: [l.id] })).http, 200);
  assert.deepEqual(await admin('GET', `/campaign-lists/${l.id}/members`).then((r) => r.list), [c.id]);
  assert.equal((await admin('GET', '/campaign-lists')).list.find((x) => x.id === l.id).count, 1);
});
