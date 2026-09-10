/**
 * Referral, end to end — the whole path a real invite takes:
 *
 *   inviter opens app  → GET /api/me/referral       → t.me/<bot>?start=<code>
 *   invitee taps Start → bot receives "/start <code>" (getUpdates)
 *                      → user created + attributed, welcome DM with Open App
 *   invitee opens app  → still attributed, inviter's list shows them
 *   guest via website  → not credited (browser identity); the Join-channel
 *                        hop carries ?ref into /start, where the credit lands
 *   invitee buys       → inviter's wallet gets the referral share, and the
 *                        dashboard's Referral table has the row
 *
 * Same harness as campaigns.e2e: the real server on a scratch db, a mock Bot
 * API in front of it (this one also serves a getUpdates queue), initData
 * signed exactly as the Mini App would.
 *
 *   node --test server/referral.e2e.test.mjs
 */
import test, { after, before } from 'node:test';
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

let dir, db, api, child, tg, cookie;
/** Every Bot API call the server made, oldest first: { method, body }. */
const tgCalls = [];
/** Updates waiting for the server's next getUpdates. */
const updates = [];
let nextUpdateId = 1;

const listen = (srv) => new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv.address().port)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(fn, what, timeout = 5000) {
  const until = Date.now() + timeout;
  let last;
  while (Date.now() < until) {
    last = await fn();
    if (last) return last;
    await sleep(60);
  }
  throw new Error(`timed out waiting for ${what}`);
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), 'tf-ref-e2e-'));
  const dbPath = join(dir, 'db.sqlite');
  tg = createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => {
      const method = req.url.split('/').pop();
      const body = raw ? JSON.parse(raw) : {};
      tgCalls.push({ method, body });
      res.setHeader('content-type', 'application/json');
      if (method === 'getUpdates') {
        const batch = updates.filter((u) => u.update_id >= (body.offset ?? 0));
        updates.length = 0;
        return res.end(JSON.stringify({ ok: true, result: batch }));
      }
      res.end(JSON.stringify({ ok: true, result: { message_id: tgCalls.length } }));
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

/** A browser visitor: no initData, the client's X-Guest-Id instead. */
async function guest(guestId, path) {
  const res = await fetch(`${api}${path}`, { headers: { 'x-guest-id': guestId } });
  return { http: res.status, ...(await res.json().catch(() => ({}))) };
}

/** The invitee taps Start in the bot chat: Telegram delivers this update. */
function pressStart(tgId, payload) {
  updates.push({
    update_id: nextUpdateId++,
    message: {
      message_id: nextUpdateId, date: Math.floor(Date.now() / 1000),
      chat: { id: tgId, type: 'private' },
      from: { id: tgId, is_bot: false, first_name: `U${tgId}`, username: `u${tgId}` },
      text: payload ? `/start ${payload}` : '/start',
    },
  });
}

const userRow = (id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);
const dmsTo = (chatId) => tgCalls.filter((c) => c.method === 'sendMessage' && String(c.body.chat_id) === String(chatId));

/* ---------------------------------------------------------------- tests */

const A = 810_001; // inviter
const B = 810_002; // invitee via the bot link
const C = 810_003; // invitee who came through the website as a guest first
const D = 810_004; // second link, must not steal B
let code;

test('the inviter\'s link opens the bot, not the app', async () => {
  const me = await app(A, 'GET', '/api/me');
  assert.equal(me.http, 200);
  const ref = await app(A, 'GET', '/api/me/referral');
  assert.equal(ref.http, 200);
  code = ref.code;
  assert.match(code, /^[0-9a-f]{8}$/);
  assert.equal(ref.bot, BOT);
  assert.equal(ref.botLink, `https://t.me/${BOT}?start=${code}`, '?start=, so a tap lands in the bot chat');
  assert.equal(ref.websiteLink, `https://app.trustforex.net/?ref=${code}`);
});

test('pressing Start with the code creates the invitee, attributes them, and DMs the app button', async () => {
  pressStart(B, code);
  const row = await waitFor(() => userRow(`tg${B}`), 'invitee row from /start');
  assert.equal(row.referred_by, `tg${A}`);
  const signup = db.prepare("SELECT detail FROM ledger WHERE user_id = ? AND kind = 'signup' AND ref_user_id = ?").get(`tg${B}`, `tg${A}`);
  assert.ok(signup, 'a signup ledger row names the inviter');
  const dm = await waitFor(() => dmsTo(B)[0], 'welcome DM');
  assert.match(dm.body.text, /Welcome/);
  assert.equal(dm.body.reply_markup.inline_keyboard[0][0].text, 'Open App');
  assert.equal(dm.body.reply_markup.inline_keyboard[0][0].url, `https://t.me/${BOT}?startapp=app`);
});

test('the invitee then opens the app and is still the inviter\'s; both sides see it', async () => {
  const me = await app(B, 'GET', '/api/me');
  assert.equal(me.http, 200);
  assert.equal(userRow(`tg${B}`).referred_by, `tg${A}`, 'an app open without a payload changes nothing');
  const list = await app(A, 'GET', '/api/me/referrals');
  assert.equal(list.referrals.length, 1);
  assert.equal(list.referrals[0].id, String(userRow(`tg${B}`).user_no), 'the app shows the invitee by user number');
  const mine = await app(A, 'GET', '/api/me/referral');
  assert.equal(mine.refInvited, 1);
  const rows = await admin('GET', '/referrals');
  const a = rows.list.find((r) => r.id === `tg${A}`);
  assert.ok(a, 'the dashboard\'s Referral table has the inviter');
  assert.equal(a.invited, 1);
});

test('a website guest is not credited — the code rides their /start into Telegram instead', async () => {
  const g = await guest('guest-c-browser', `/api/me?ref=${code}`);
  assert.equal(g.http, 200);
  const guestRow = db.prepare("SELECT * FROM users WHERE name = 'Guest'").get();
  assert.ok(guestRow, 'the browser visitor exists as a Guest row');
  assert.ok(guestRow.telegram_id < 0, 'guests carry a negative id and can never collide with a real user');
  assert.equal(guestRow.referred_by, null, 'a browser identity cannot follow them into Telegram, so it is never the credited one');
  // The Join-channel sheet sends them to t.me/<bot>?start=<code>; in Telegram
  // they are a new person to us, attributed by the /start payload.
  pressStart(C, code);
  const row = await waitFor(() => userRow(`tg${C}`), 'guest-turned-user row');
  assert.equal(row.referred_by, `tg${A}`);
  assert.equal((await app(A, 'GET', '/api/me/referral')).refInvited, 2, 'counted once, as the Telegram identity');
});

test('attribution is first-writer-wins and never to oneself', async () => {
  const other = await app(D, 'GET', '/api/me/referral');
  pressStart(B, other.code); // B taps someone else's link later
  await sleep(TICK_MS * 4);
  assert.equal(userRow(`tg${B}`).referred_by, `tg${A}`, 'a later link cannot steal the invitee');
  pressStart(A, code); // A taps their own link
  await sleep(TICK_MS * 4);
  assert.equal(userRow(`tg${A}`).referred_by, null, 'no self-referral');
  pressStart(D, 'nope1234'); // a code that is nobody's
  await sleep(TICK_MS * 4);
  assert.equal(userRow(`tg${D}`).referred_by, null);
});

test('the invitee buys a plan and the inviter is paid their referral share', async () => {
  const before = await app(A, 'GET', '/api/me/referral');
  const order = await app(B, 'POST', '/api/orders', { planId: 'gold', billing: 'monthly' });
  assert.equal(order.http, 200, JSON.stringify(order));
  const sel = await app(B, 'POST', `/api/orders/${order.order.id}/select`, { currency: 'USDT', network: 'TRC-20' });
  assert.equal(sel.http, 200, JSON.stringify(sel));
  const conf = await admin('POST', `/payments/${order.order.id}/confirm`);
  assert.equal(conf.http, 200, JSON.stringify(conf));
  const share = await waitFor(() => db.prepare("SELECT amount FROM ledger WHERE user_id = ? AND kind = 'referral' AND ref_user_id = ?").get(`tg${A}`, `tg${B}`), 'referral share row');
  assert.ok(share.amount > 0, 'the inviter earned something');
  const after = await app(A, 'GET', '/api/me/referral');
  assert.equal(after.refEarnings, before.refEarnings + share.amount, 'the app\'s referral earnings moved by exactly the share');
  const list = await app(A, 'GET', '/api/me/referrals');
  const b = list.referrals.find((r) => r.id === String(userRow(`tg${B}`).user_no));
  assert.equal(b.plan, share.amount, 'the invitee row shows the plan share');
  const rows = await admin('GET', '/referrals');
  const a = rows.list.find((r) => r.id === `tg${A}`);
  assert.equal(a.planCount, 1);
  assert.equal(a.revenueShared, share.amount);
});
