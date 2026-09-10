/**
 * Admin API — schema, auth and routes.
 *
 * Plain node:sqlite + node:http, same as the rest of the server. Speed comes
 * from doing less: every statement is prepared once at open, the router is a
 * flat array matched with one regex test per entry, and the whole surface is
 * synchronous SQLite reads on a local file — no ORM, no query builder, no
 * per-request compilation.
 *
 * Rows are stored snake_case and mapped to the camelCase shapes in
 * src/admin/data.ts at the edge, so the client types are the contract.
 */
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { connect } from './sqlite.mjs';
import { PAYMENT_SCHEMA } from './db.mjs';
import { LEDGER_SCHEMA, openLedger, PLAN_DAYS, TIER_PCT } from './ledger.mjs';
import { CAMPAIGN_SCHEMA, openCampaigns } from './campaigns.mjs';
import { computeSeries } from './series.mjs';
import { fmtDay, fmtTime, fmtStamp, wallMs } from './tz.mjs';
export { GRAINS, seriesNames } from './series.mjs';

/** Where the Mini App and the dashboard live. The apex 301s here, so old
 *  `trustforex.net/?ref=` links still work — but every link we mint is direct. */
export const PUBLIC_URL = process.env.TF_PUBLIC_URL ?? 'https://app.trustforex.net';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h; admins re-auth daily
const SCRYPT_KEYLEN = 64;
const round2 = (n) => Math.round(n * 100) / 100;
/** n of d as a one-decimal percentage; 0 when there is nothing to divide by. */
const pctOf = (n, d) => (d ? Number(((n / d) * 100).toFixed(1)) : 0);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL, hash TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);

-- Bearer keys for programmatic callers (the MCP server, i.e. an AI agent).
-- Only the sha256 of the key is kept: a 256-bit random secret has nothing to
-- brute-force, so scrypt here would only cost 100ms on every agent call.
-- scope is the blast radius: read | write | money, see API_SCOPES.
CREATE TABLE IF NOT EXISTS admin_api_keys (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, prefix TEXT NOT NULL,
  hash TEXT NOT NULL UNIQUE, scope TEXT NOT NULL,
  created_at INTEGER NOT NULL, last_used_at INTEGER);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL, email TEXT,
  broker_id TEXT, status TEXT NOT NULL, last_action_at TEXT,
  total_rebate REAL, last_month_rebate REAL, joined_at TEXT,
  -- Which broker this account is registered with. The Recent-users table used
  -- to fabricate this column from the row index.
  broker TEXT);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- drafted_payment and unreviewed are NOT stored: they are counts of rows in
-- rebate_drafts and review_queue, so storing them would let the card disagree
-- with the tables it summarises the moment anything is drafted or decided.
CREATE TABLE IF NOT EXISTS brokers (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT, status TEXT NOT NULL,
  rank INTEGER, active_users INTEGER, pending_users INTEGER,
  share_rate REAL NOT NULL DEFAULT 0.3, updated_at TEXT);

-- Document-shaped records. A column per field would be 20 migrations of churn
-- for data nothing ever filters on.
CREATE TABLE IF NOT EXISTS broker_preview (broker_id TEXT PRIMARY KEY, doc TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS flow_messages (
  broker_id TEXT NOT NULL, key TEXT NOT NULL, title TEXT, from_state TEXT,
  chip TEXT, message TEXT NOT NULL, ord INTEGER,
  PRIMARY KEY (broker_id, key));

CREATE TABLE IF NOT EXISTS cashback_cycles (
  id TEXT PRIMARY KEY, name TEXT, range_label TEXT, gross_rebate REAL,
  shared_cashback REAL, net_revenue REAL, cashback_users INTEGER, published_at TEXT);

CREATE TABLE IF NOT EXISTS review_queue (
  id TEXT PRIMARY KEY, user_id TEXT, name TEXT, plan TEXT, broker_id TEXT,
  requested_at TEXT, email TEXT, broker_account_id TEXT, last_status TEXT,
  decision TEXT);
CREATE INDEX IF NOT EXISTS idx_review_open ON review_queue(broker_id, decision);
CREATE INDEX IF NOT EXISTS idx_review_broker ON review_queue(broker_id);

CREATE TABLE IF NOT EXISTS rebates (
  broker_id TEXT NOT NULL, user_id TEXT NOT NULL, name TEXT, plan TEXT, email TEXT,
  broker_account_id TEXT, total_rebate REAL, last_week_rebate REAL, shared_rebate REAL,
  PRIMARY KEY (broker_id, user_id));

CREATE TABLE IF NOT EXISTS rebate_drafts (
  broker_id TEXT NOT NULL, user_id TEXT NOT NULL, last_week_rebate REAL NOT NULL,
  shared_rebate REAL NOT NULL, action_date TEXT NOT NULL,
  PRIMARY KEY (broker_id, user_id));

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY, name TEXT, plan TEXT, last_action_at TEXT, last_action_time TEXT,
  days_left INTEGER, total_paid REAL, status TEXT,
  -- What "purchased before" on an extra-day grant is measured against.
  purchased_at TEXT);
CREATE INDEX IF NOT EXISTS idx_subscribers_purchased ON subscribers(purchased_at);
CREATE INDEX IF NOT EXISTS idx_subscribers_status ON subscribers(status, plan);

CREATE TABLE IF NOT EXISTS extra_grants (
  id TEXT PRIMARY KEY, added_at TEXT, added_time TEXT, extra_days INTEGER,
  eligible_before TEXT, eligible_time TEXT, affected INTEGER, message TEXT, notify INTEGER,
  created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT, icon TEXT,
  date TEXT, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS referral_campaigns (
  id TEXT PRIMARY KEY, name TEXT, status TEXT, link_code TEXT, invited INTEGER,
  plan_count INTEGER, plan_total INTEGER, cashback_count INTEGER, cashback_total INTEGER,
  revenue REAL, revenue_shared REAL, revenue_net REAL, plan_share REAL, cashback_share REAL,
  website_link TEXT, bot_link TEXT, end_date TEXT, doc TEXT);

CREATE TABLE IF NOT EXISTS campaign_lists (id TEXT PRIMARY KEY, name TEXT, count INTEGER);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY, name TEXT, status TEXT, doc TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS signal_results (
  id TEXT PRIMARY KEY, period TEXT, range_label TEXT, total INTEGER, sl INTEGER,
  tp1 INTEGER, tp2 INTEGER, tp3 INTEGER, tp4 INTEGER, status TEXT,
  published_at TEXT, published_time TEXT, ord INTEGER);

CREATE TABLE IF NOT EXISTS campaign_list_members (
  list_id TEXT NOT NULL, campaign_id TEXT NOT NULL,
  PRIMARY KEY (list_id, campaign_id));

-- The bot's transactional copy — payment/subscription/withdrawal DMs. Keyed by
-- a fixed code-defined key (MESSAGE_TEMPLATES below), never admin-created, so
-- this is a body-only override table rather than a full CRUD resource.
CREATE TABLE IF NOT EXISTS message_templates (
  key TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL);

-- One row per user per calendar day they opened the app (UTC, 'YYYY-MM-DD'),
-- written INSERT OR IGNORE on every ensureUser() call. users.last_seen only
-- holds the latest timestamp, so it can answer "active in the last N days"
-- but not a day-by-day trend — this is what the usage-over-time chart reads.
CREATE TABLE IF NOT EXISTS daily_actives (
  day TEXT NOT NULL, user_id TEXT NOT NULL, PRIMARY KEY (day, user_id));
CREATE INDEX IF NOT EXISTS idx_daily_actives_day ON daily_actives(day);
`;

/* ---------------------------------------------------------------------
 * Passwords & sessions
 * ------------------------------------------------------------------- */

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex') };
}

function passwordMatches(password, salt, expected) {
  const actual = scryptSync(password, salt, SCRYPT_KEYLEN);
  const want = Buffer.from(expected, 'hex');
  // Length check first: timingSafeEqual throws on a mismatch instead of returning false.
  return want.length === actual.length && timingSafeEqual(actual, want);
}

/* What a bearer key may reach. */
export const API_SCOPES = ['read', 'write', 'money'];
const keyHash = (key) => createHash('sha256').update(key).digest('hex');

/* Routes that move money or hand out paid time. A key reaches these only at
   scope `money`, so an agent misreading a table cannot mark a withdrawal sent.
   Two of these paths (`gateways`, `extra-grants`) also answer GET; reading is
   not moving, so the method check below is what keeps the gate on the verb
   rather than on the noun. */
const MONEY_PATHS = /^\/(withdrawals\/[\w-]+\/(mark-sent|reject)|unmatched\/[\w-]+\/attribute|payments\/[\w-]+\/confirm|rebate-drafts\/publish-all|brokers\/[\w-]+\/rebate-drafts\/publish|gateways|extra-grants)$/;

/**
 * What a bearer key may NOT do, in one place — the dispatcher applies it once,
 * so every route is covered and route 73 is covered the day it is added.
 * A cookie session (a human at the dashboard) is never denied here.
 * Returns an error code, or null to allow.
 */
export function keyDenial(session, method, path) {
  if (!session.viaKey) return null;
  // A key never mints or revokes a key. Without this line `read` becomes
  // `money` in two calls, and every other rule here is decoration.
  if (path.startsWith('/api-keys')) return 'cookie_session_required';
  if (session.scope === 'read' && method !== 'GET') return 'read_only_key';
  // A GET never moves money. Gating the noun rather than the verb hid the
  // deposit-wallet list and the grant history from every non-money key.
  if (session.scope !== 'money' && method !== 'GET' && MONEY_PATHS.test(path)) return 'money_scope_required';
  return null;
}

function cookieValue(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}


/** The four states "Manage user flow → Status message" edits, seeded for every
 *  broker so the tab never opens empty. This is the live copy written for
 *  Xchief in production, promoted to the default so every other broker and
 *  every broker added later starts from it. `old` is the seed it replaced —
 *  a row still holding that untouched gets upgraded at boot, hand-written
 *  copy is never overwritten. */
const FLOW_DEFAULTS = [
  {
    key: 'rejected', title: 'Registration Rejected', from: 'Sent when a registration request is declined',
    chip: 'rejected',
    message: '<b>❌ Registration Rejected</b><br><br>Your registration with {broker} broker was rejected because the Email or User ID may be incorrect, or the registration could not be found, so please review your details and try again.',
    old: 'Hi {name}, we could not approve your registration with {broker}. Please double-check your details and try again.',
  },
  {
    key: 'waiting-deposit', title: 'Waiting for Deposit', from: 'Sent when registration is approved and a deposit is required',
    chip: 'waiting',
    message: '<b>⏳ Waiting for Deposit</b><br><br>Your registration with {broker} broker has been confirmed; please make a deposit to prepare your account for trading and activate your Cashback Earning.',
    old: 'Hi {name}, your registration with {broker} is approved. Make your first deposit to start earning cashback.',
  },
  {
    key: 'rejected-deposit', title: 'Deposit confirmation failed', from: 'Sent when a submitted deposit fails review',
    chip: 'rejected',
    message: '<b>❌ Deposit Verification Rejected</b><br><br>Your deposit with {broker} broker could not be verified; please check your account and ensure that a deposit has been made so you can start trading and activate your Cashback Earning.',
    old: 'Hi {name}, we could not verify your deposit with {broker}. Please check the amount and try again.',
  },
  {
    key: 'approved', title: 'Deposit confirmed', from: 'Sent when registration and deposit are both approved',
    chip: 'approved',
    message: '<b>✅ Cashback Activated</b><br><br>Your deposit with {broker} broker has been confirmed and your account is ready for trading; Cashback is calculated and credited weekly based on your plan’s share percentage.',
    old: "Hi {name}, you're all set! Your account with {broker} is active and earning cashback.",
  },
];

/**
 * The bot's transactional messages — every DM a user gets outside of a
 * marketing campaign (which already has its own editor). One entry per
 * `sendMessage` call site in notify.mjs/jobs.mjs/payouts.mjs/watcher.mjs;
 * `key` is what those modules look up, `vars` documents the {tokens} that
 * call site actually fills in, for the editor's insert buttons and preview.
 * `body` here is also the seed written to message_templates on first boot —
 * the copy an admin who has never opened this page still sends.
 */
export const MESSAGE_TEMPLATES = [
  {
    key: 'bot_welcome', name: 'Welcome (/start)', group: 'General',
    hint: "The bot's reply to /start — the first thing anyone sees, including everyone arriving on a referral or campaign link.",
    vars: ['name'],
    body: '<b>Welcome to Trust Forex, {name} 👋</b><br><br>Explore Forex signal plans, review transparently presented results, and choose a subscription for VIP Channel access with the Cashback and Referral benefits available through your account.',
  },
  /* One message, not six. The days / rate / balance / overpaid / VIP-link lines
     only apply sometimes; renderTemplate drops a line whose token came through
     empty, so they live here as {tokens} an admin can reword or move — which
     five separate `payment_confirmed_*` keys made impossible. */
  {
    key: 'payment_confirmed', name: 'Payment Confirmed', group: 'Payments',
    hint: "Sent the instant an order's payment is confirmed on-chain — renewals included. The balance, overpayment and VIP-link lines delete themselves when they don't apply, so keep each on its own line.",
    vars: ['plan', 'days', 'pct', 'total', 'currency', 'amount', 'earning_amount', 'overpaid_amount', 'link'],
    body: '<b>✅ Payment Completed</b><br><br>'
      + 'Your {plan} subscription is confirmed for {days} days with a {pct} Cashback &amp; Referral Rate.<br><br>'
      + '▫️Plan Price: {total}<br>'
      + '▫️Amount Paid: {amount} {currency}<br>'
      + '▫️Paid from Earning Balance: {earning_amount}<br>'
      + '▫️Overpaid Amount Added to Earning Balance: {overpaid_amount}<br><br>'
      + 'Join VIP Channel: {link}',
  },
  {
    key: 'payment_partial_refund', name: 'Order Expired — Partial Refund', group: 'Payments',
    hint: 'Sent when an order expires after a partial payment; the amount paid is credited to earning balance.',
    vars: ['amount'],
    body: '<b>⌛️ Order Expired</b><br><br>Your recent order has expired, but the {amount} you paid has been added to your Earning Balance for future use.',
  },
  {
    key: 'payment_incomplete', name: 'Payment Incomplete', group: 'Payments',
    hint: 'Sent when an on-chain transfer arrives short of the order total.',
    vars: ['received', 'due', 'remaining', 'currency', 'network', 'address'],
    body: '<b>\u26A0\uFE0F Payment Incomplete</b><br><br>'
      + 'We received {received} {currency} of the {due} {currency} required.<br><br>'
      + 'Please send the exact remaining amount using the same wallet and network as your previous payment to activate your subscription.<br><br>'
      + '▫️<u>Amount to Send</u>: {remaining} {currency}<br>'
      + '▫️<u>Payment Network</u>: {network}<br>'
      + '▫️<u>Payment Wallet</u>: {address}',
  },
  {
    key: 'subscription_lapsed', name: 'Subscription Lapsed', group: 'Subscription',
    hint: "Sent the moment a subscription's term ends and access is revoked.",
    vars: ['plan'],
    body: '<b>🔄 Subscription Expired</b><br><br>'
      + 'Your {plan} subscription has ended, and your Cashback &amp; Referral Rate is now back to the <u>Base Rate (10%)</u>.<br><br>'
      + 'Renew whenever you’re ready to <u>restore VIP Channel access</u> and continue enjoying the benefits and Cashback &amp; Referral Rate included in your chosen plan.',
  },
  {
    key: 'cashback_earned', name: 'Cashback Paid', group: 'Earnings',
    hint: 'Sent when a cashback cycle is published — one message per broker that paid them.',
    vars: ['amount', 'broker'],
    body: '<b>💰 Cashback Paid</b><br><br>Your Cashback of <b>{amount}</b> from {broker} broker has been added to your Earning Balance.',
  },
  {
    key: 'referral_earned', name: 'Referral Earnings', group: 'Earnings',
    hint: 'Sent to the inviter each time one of their invitees earns them a share — a plan they bought, or their weekly cashback.',
    vars: ['amount', 'name', 'source'],
    body: '<b>🤝 Referral Paid</b><br><br>Your Referral reward of <b>{amount}</b> from user {name} has been added to your Earning Balance.',
  },
  {
    key: 'withdrawal_sent', name: 'Withdrawal Sent', group: 'Withdrawals',
    hint: 'Sent once a withdrawal is broadcast on-chain.',
    vars: ['amount', 'currency', 'network', 'txid'],
    body: '<b>✅ Withdrawal Completed Successfully</b><br><br>Your withdrawal of {amount} in {currency} via the {network} network has been completed.',
  },
  {
    key: 'withdrawal_manual', name: 'Withdrawal Processing Manually', group: 'Withdrawals',
    hint: 'Sent when a withdrawal is parked for manual review — over caps, an RPC error, or a crash mid-send.',
    vars: [],
    body: '<b>⏳ Withdrawal Request Submitted Successfully</b><br><br>Your withdrawal request has been received and is now being processed; you will be notified once it is completed.',
  },
  {
    key: 'withdrawal_rejected', name: 'Withdrawal Rejected', group: 'Withdrawals',
    hint: 'Sent when an admin rejects a withdrawal request. The reason is typed by hand in the Reject dialog; the amount goes straight back to the earning balance it was frozen from.',
    vars: ['amount', 'reason'],
    body: '<b>⚠️ Withdrawal Request Rejected</b><br><br>'
      + 'Your withdrawal request could not be completed, and {amount} has been returned to your Earning Balance.<br><br>'
      + 'ℹ️ <u>Rejection Reason</u>: {reason}',
  },
];

/** {token} substitution, unknown tokens left as-is so a typo shows rather than
 *  vanishes. A token the caller *did* pass but left empty takes its whole line
 *  with it — that is how one Payment Confirmed message can carry the overpaid /
 *  balance / VIP-link lines that only apply sometimes, instead of six separate
 *  templates. Lines split on <br> (what the editor writes) and on \n alike.
 *  Pure — no db, no admin.mjs state — so every send site can import it without
 *  opening a connection, which matters for the ones under test. */
export function renderTemplate(body, vars = {}) {
  const parts = String(body ?? '').split(/(<br\s*\/?>|\n)/i); // [line, sep, line, sep, …, line]
  let out = '';
  for (let i = 0; i < parts.length; i += 2) {
    let blank = false;
    const line = parts[i].replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      if (vars[k] === '' || vars[k] === null || vars[k] === undefined) { blank = true; return ''; }
      return String(vars[k]);
    });
    if (!blank) out += line + (parts[i + 1] ?? '');
  }
  return out.replace(/(?:<br\s*\/?>|\s)+$/i, ''); // no dangling break where the last line dropped
}

/* ---------------------------------------------------------------------
 * Store
 * ------------------------------------------------------------------- */

/**
 * `users.user_no` for an account id — the only user identifier operators ever
 * see. `users.id` (`tg<telegram id>` for Mini App accounts) is a key, not a
 * label; showing it leaked a raw Telegram id into half the tables.
 *
 * ponytail: one lookup per row. Every one of these lists is capped in the
 * hundreds and the DB is a local file; join `user_no` into the queries if a
 * list ever gets big.
 */
let userNoStmt;
export function userNoOf(id) {
  if (!id) return null;
  userNoStmt ??= connect().prepare('SELECT user_no FROM users WHERE id = ?');
  return userNoStmt.get(String(id))?.user_no ?? null;
}

/** payments/withdrawals carry a Telegram id, not a users.id. */
let userNoByTgStmt;
export function userNoOfTelegram(tgId) {
  if (tgId == null) return null;
  userNoByTgStmt ??= connect().prepare('SELECT user_no FROM users WHERE telegram_id = ?');
  return userNoByTgStmt.get(Number(tgId))?.user_no ?? null;
}

/** payouts.mjs `withdrawals` row -> the shape the dashboard's Money screen
 *  reads, shared by the list and the mark-sent mutation so a click never has
 *  to reconcile two different row shapes for the same table. */
function toWithdrawalRow(r) {
  return {
    id: r.id, userId: r.user_id, name: r.name ?? null, userNo: userNoOf(r.user_id),
    at: fmtStamp(r.created_at),
    amount: r.amount_usd, fee: r.fee_usd, currency: r.currency, network: r.network,
    address: r.address, status: r.status, txid: r.txid ?? undefined,
  };
}

export function openAdminDb(path) {
  const db = connect(path);
  // Lazy: prepared on first real call, not here — see the `withdrawals` /
  // `markWithdrawalSent` comment below for why.
  let withdrawalRequestsStmt, markWithdrawalSentStmt, rejectWithdrawalStmt, readWithdrawalStmt, openWithdrawalsStmt;
  db.exec(SCHEMA);
  // `orders` may not exist yet — this module can load before openDb() runs, and
  // the ledger reconciles against it. Both schemas are CREATE IF NOT EXISTS.
  db.exec(PAYMENT_SCHEMA);
  db.exec(LEDGER_SCHEMA);
  db.exec(CAMPAIGN_SCHEMA);

  /* Columns added after the tables shipped. CREATE TABLE IF NOT EXISTS will not
     alter an existing table, so each one is checked and added here.

     `telegram_id` is the identity bridge: users.id is the admin's own TEXT id
     and predates the Mini App, so the Telegram account id gets its own column
     rather than a primary-key rewrite every other table would have to follow.
     `referred_by`/`ref_campaign`/`ref_code` are referral attribution, and
     `subscribers.expires_at` is the instant a term ends — days-left is computed
     from it and never stored, because a stored countdown is wrong by morning. */
  const addColumn = (table, column, type) => {
    if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
  };
  addColumn('users', 'telegram_id', 'INTEGER');
  addColumn('users', 'referred_by', 'TEXT');
  addColumn('users', 'ref_campaign', 'TEXT');
  addColumn('users', 'ref_code', 'TEXT');
  /* The number an operator says out loud. `users.id` is an opaque internal key
     that predates the Mini App; `user_no` is the short account number shown in
     the UI and typed into the campaign editor, counting from 1000. */
  addColumn('users', 'user_no', 'INTEGER');
  addColumn('subscribers', 'expires_at', 'INTEGER');
  // The campaign code an order was priced with, redeemed when the ledger books
  // the payment — so an order that expires unpaid hands the code back.
  addColumn('orders', 'discount_code', 'TEXT');
  /* Earning balance put towards an order. openDb() adds this too — it has to
     exist here as well, because reconcileOrders' `SELECT o.*` is prepared a few
     lines below and this module routinely loads before openDb() runs. */
  addColumn('orders', 'balance_used', 'REAL');
  addColumn('orders', 'paid_units', 'TEXT');
  // Stamped on every ensureUser() call — i.e. every Mini App launch — so DAU/
  // WAU/MAU can be counted straight off this column instead of a new activity
  // log. Epoch ms, unlike joined_at's date-only string: activity needs same-day
  // resolution, signup doesn't.
  addColumn('users', 'last_seen', 'INTEGER');
  // Demo-seed leftovers: never written by the product, dropped where they exist.
  db.exec('DROP TABLE IF EXISTS series; DROP TABLE IF EXISTS referral_rows; '
    + 'DROP TABLE IF EXISTS user_summary; DROP TABLE IF EXISTS activity');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_telegram ON users(telegram_id) WHERE telegram_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_refcode ON users(ref_code) WHERE ref_code IS NOT NULL');
  db.exec('CREATE INDEX IF NOT EXISTS idx_users_referrer ON users(referred_by)');

  /* Account numbers count from 1. They used to start at 1000, which read as an
     id rather than as "the ninth account" — this renumbers that one block in
     insertion order, once. Self-limiting: after it runs the minimum is 1, so
     the condition is false forever after, and it refuses to touch a set anyone
     could already have written down elsewhere (a campaign owner is stored by
     number). Beyond that one pass the old rule stands — a number, once handed
     out, is never reassigned. */
  {
    const numbered = db.prepare('SELECT COUNT(*) n, MIN(user_no) lo FROM users WHERE user_no IS NOT NULL').get();
    const referenced = db.prepare("SELECT COUNT(*) n FROM campaigns WHERE doc LIKE '%ownerUserNo%'").get()?.n ?? 0;
    if (numbered.n && numbered.lo >= 1000 && !referenced) {
      const assign = db.prepare('UPDATE users SET user_no = ? WHERE rowid = ?');
      const rows = db.prepare('SELECT rowid FROM users WHERE user_no IS NOT NULL ORDER BY user_no').all();
      db.exec('BEGIN');
      // Out of the way of the unique index first: 1..n overlaps 1000..1000+n
      // only if n > 999, but a half-applied renumber is not worth the bet.
      db.exec('UPDATE users SET user_no = -user_no WHERE user_no IS NOT NULL');
      rows.forEach((row, i) => assign.run(i + 1, row.rowid));
      db.exec('COMMIT');
    }
  }

  /* Account numbers now count from 1001 — a four-digit number reads as an
     account id rather than "user #3". Same one-shot shape as the 1000→1 pass
     above and self-limiting the same way: once every number is >= 1001 the
     condition is false forever, so this never re-touches a number an operator
     has already written down (a campaign owner is stored by number). */
  {
    const numbered = db.prepare('SELECT COUNT(*) n, MIN(user_no) lo FROM users WHERE user_no IS NOT NULL').get();
    const referenced = db.prepare("SELECT COUNT(*) n FROM campaigns WHERE doc LIKE '%ownerUserNo%'").get()?.n ?? 0;
    if (numbered.n && numbered.lo < 1001 && !referenced) {
      const assign = db.prepare('UPDATE users SET user_no = ? WHERE rowid = ?');
      const rows = db.prepare('SELECT rowid FROM users WHERE user_no IS NOT NULL ORDER BY user_no').all();
      db.exec('BEGIN');
      db.exec('UPDATE users SET user_no = -user_no WHERE user_no IS NOT NULL');
      rows.forEach((row, i) => assign.run(1001 + i, row.rowid));
      db.exec('COMMIT');
    }
  }

  /* Backfill in insertion order, continuing from the highest number already
     handed out — never renumbering an account that has one, because a user
     number an operator has written down must not change under them. Floored
     at 1001 so the very first account in a fresh database still starts there
     instead of at 1. */
  {
    const pending = db.prepare('SELECT rowid FROM users WHERE user_no IS NULL ORDER BY rowid').all();
    if (pending.length) {
      const assign = db.prepare('UPDATE users SET user_no = ? WHERE rowid = ?');
      let next = Math.max(1001, db.prepare('SELECT COALESCE(MAX(user_no), 0) AS n FROM users').get().n + 1);
      db.exec('BEGIN');
      for (const row of pending) assign.run(next++, row.rowid);
      db.exec('COMMIT');
    }
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_no ON users(user_no) WHERE user_no IS NOT NULL');

  const ledger = openLedger(db);
  const campaigns = openCampaigns(db);

  /** A bearer key's session, or null. Defined out here so `sessionFor` needs no `this`. */
  const keySession = (req) => {
    const key = /^Bearer\s+(tfk_[\w-]+)$/.exec(req.headers.authorization ?? '')?.[1];
    if (!key) return null;
    const row = q.apiKeyByHash.get(keyHash(key));
    if (!row) return null;
    q.touchApiKey.run(nowMs(), row.id);
    // `username` lands in the same `by:` audit columns a human's actions do.
    return { adminId: null, username: `key:${row.name}`, viaKey: true, scope: row.scope };
  };

  // Every statement compiled once, at open.
  const q = {
    adminByName: db.prepare('SELECT * FROM admins WHERE username = ?'),
    insertAdmin: db.prepare('INSERT OR REPLACE INTO admins (username, salt, hash, created_at) VALUES (?, ?, ?, ?)'),
    insertSession: db.prepare('INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)'),
    session: db.prepare(`SELECT s.admin_id, s.expires_at, a.username FROM admin_sessions s
      JOIN admins a ON a.id = s.admin_id WHERE s.token = ?`),
    deleteSession: db.prepare('DELETE FROM admin_sessions WHERE token = ?'),
    sweepSessions: db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?'),

    insertApiKey: db.prepare(`INSERT INTO admin_api_keys
      (id, name, prefix, hash, scope, created_at) VALUES (?, ?, ?, ?, ?, ?)`),
    apiKeyByHash: db.prepare('SELECT * FROM admin_api_keys WHERE hash = ?'),
    apiKeys: db.prepare('SELECT id, name, prefix, scope, created_at, last_used_at FROM admin_api_keys ORDER BY created_at DESC'),
    deleteApiKey: db.prepare('DELETE FROM admin_api_keys WHERE id = ?'),
    touchApiKey: db.prepare('UPDATE admin_api_keys SET last_used_at = ? WHERE id = ?'),

    // users.total_rebate/last_month_rebate are seeded to 0 at signup and never
    // touched again — publishAll only bumps `rebates`. Compute both live from
    // the tables that actually move, same as the Active-users tab does.
    //
    // One row per (user, broker): a user can submit to several brokers, and
    // review_queue is the table that actually carries that pair. The LEFT JOIN
    // keeps a single broker-less row for a user with no decided request yet.
    users: db.prepare(`SELECT u.*,
        rq.broker_id AS link_broker_id, rq.broker_account_id AS link_broker_account_id,
        rq.decision AS link_decision, rq.email AS link_email,
        rq.requested_at AS link_action_at,
        (SELECT COALESCE(SUM(total_rebate), 0) FROM rebates
          WHERE user_id = u.id AND (rq.broker_id IS NULL OR broker_id = rq.broker_id)) AS live_total_rebate,
        (SELECT COALESCE(SUM(amount), 0) FROM ledger
          WHERE user_id = u.id AND kind = 'cashback' AND at >= ?
            AND (rq.broker_id IS NULL OR broker_id = rq.broker_id)) AS live_last_month_rebate
      FROM users u
      LEFT JOIN review_queue rq ON rq.user_id = u.id AND rq.decision IS NOT NULL
      ORDER BY u.rowid, rq.rowid`),
    user: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByTelegram: db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    /* Per-user lookups for the Mini App. The admin's own screens read these
       tables whole (one page, every user); a Mini App request only ever wants
       its own row, so these are indexed reads rather than a filter over all(). */
    subscriber: db.prepare('SELECT * FROM subscribers WHERE id = ?'),
    myRebates: db.prepare('SELECT * FROM rebates WHERE user_id = ?'),
    myReviews: db.prepare('SELECT * FROM review_queue WHERE user_id = ? ORDER BY rowid'),
    /* plan 'none' — a brand-new account has not bought anything, and seeding it
       as Silver put a tier badge (and a 15% rate) on someone who has never
       paid. The column is display only; the rate comes from ledger.tierOf. */
    insertTelegramUser: db.prepare(`INSERT INTO users
      (id, name, plan, status, telegram_id, joined_at, total_rebate, last_month_rebate, user_no)
      VALUES (?, ?, 'none', 'active', ?, ?, 0, 0,
        (SELECT MAX(1001, (SELECT COALESCE(MAX(user_no), 0) FROM users) + 1)))`),
    userByNo: db.prepare('SELECT * FROM users WHERE user_no = ?'),
    touchLastSeen: db.prepare('UPDATE users SET last_seen = ? WHERE id = ?'),
    markDailyActive: db.prepare('INSERT OR IGNORE INTO daily_actives (day, user_id) VALUES (?, ?)'),
    activeSince: db.prepare('SELECT COUNT(*) AS n FROM users WHERE last_seen >= ?'),
    totalUsers: db.prepare('SELECT COUNT(*) AS n FROM users'),
    dailyActiveCounts: db.prepare(`SELECT day, COUNT(*) AS n FROM daily_actives
      WHERE day >= ? GROUP BY day ORDER BY day`),
    setUserStatus: db.prepare('UPDATE users SET status = ? WHERE id = ?'),
    userCounts: db.prepare(`SELECT
      COUNT(*) AS all_users,
      SUM(status = 'active') AS active,
      SUM(status = 'pending') AS pending,
      SUM(status = 'rejected') AS rejected FROM users`),

    // drafted_payment / unreviewed are counted here rather than stored, so the
    // card can never drift from the tables it summarises.
    brokers: db.prepare(`SELECT b.*, bp.doc AS preview_doc,
        (SELECT COUNT(*) FROM rebate_drafts d WHERE d.broker_id = b.id) AS drafted_payment,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision IS NULL) AS unreviewed,
        -- Headcounts are counted, not stored, for the same reason as the two
        -- above: a card that disagrees with the table under it is a bug report.
        -- Both read the same review_queue.decision the user rows render from
        -- (approved -> Active, waiting/undecided -> Pending). Counting the
        -- the rebates table instead kept a demoted user in the Active tally,
        -- so the card said 2/0 over a list showing 1 active + 1 pending.
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision = 'approved') AS live_active,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id
           AND (r.decision IS NULL OR r.decision = 'waiting')) AS live_pending,
        -- Not active + pending: a rejected link is still a row in the list.
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id) AS live_users
      FROM brokers b LEFT JOIN broker_preview bp ON bp.broker_id = b.id
      ORDER BY (b.rank IS NULL), b.rank, b.rowid`),
    broker: db.prepare(`SELECT b.*, bp.doc AS preview_doc,
        (SELECT COUNT(*) FROM rebate_drafts d WHERE d.broker_id = b.id) AS drafted_payment,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision IS NULL) AS unreviewed,
        -- Headcounts are counted, not stored, for the same reason as the two
        -- above: a card that disagrees with the table under it is a bug report.
        -- Both read the same review_queue.decision the user rows render from
        -- (approved -> Active, waiting/undecided -> Pending). Counting the
        -- the rebates table instead kept a demoted user in the Active tally,
        -- so the card said 2/0 over a list showing 1 active + 1 pending.
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision = 'approved') AS live_active,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id
           AND (r.decision IS NULL OR r.decision = 'waiting')) AS live_pending,
        -- Not active + pending: a rejected link is still a row in the list.
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id) AS live_users
      FROM brokers b LEFT JOIN broker_preview bp ON bp.broker_id = b.id WHERE b.id = ?`),
    insertBroker: db.prepare(`INSERT INTO brokers
      (id, name, color, status, rank, active_users, pending_users, share_rate, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`),
    maxRank: db.prepare('SELECT COALESCE(MAX(rank), 0) AS n FROM brokers'),
    // `brokers` here is "brokers with money to publish", not the platform's
    // broker count — this bar exists to answer "is there anything to pay out",
    // and a broker sitting at zero drafts is not part of that answer.
    // Both halves of the bar describe THIS cycle only — the gross the operator
    // typed on the pending drafts, and the users' tier slice of it. Published
    // cycles drop out (their gross lives in cashback_cycles). It used to sum
    // `rebates.total_rebate`, the users' net, so it read $0 next to a $30 draft.
    brokerTotals: db.prepare(`SELECT
      (SELECT COALESCE(SUM(last_week_rebate), 0) FROM rebate_drafts) AS total_rebate,
      (SELECT COALESCE(SUM(shared_rebate), 0) FROM rebate_drafts) AS drafted,
      (SELECT COUNT(DISTINCT broker_id) FROM rebate_drafts) AS brokers`),
    setBrokerOrder: db.prepare('UPDATE brokers SET rank = ?, status = ?, updated_at = ? WHERE id = ?'),
    touchBroker: db.prepare('UPDATE brokers SET updated_at = ? WHERE id = ?'),
    deleteBroker: db.prepare('DELETE FROM brokers WHERE id = ?'),
    deleteBrokerPreview: db.prepare('DELETE FROM broker_preview WHERE broker_id = ?'),
    deleteBrokerFlowMessages: db.prepare('DELETE FROM flow_messages WHERE broker_id = ?'),
    deleteBrokerRebates: db.prepare('DELETE FROM rebates WHERE broker_id = ?'),
    deleteBrokerRebateDrafts: db.prepare('DELETE FROM rebate_drafts WHERE broker_id = ?'),
    deleteBrokerReviewQueue: db.prepare('DELETE FROM review_queue WHERE broker_id = ?'),
    preview: db.prepare('SELECT doc FROM broker_preview WHERE broker_id = ?'),
    setPreview: db.prepare('INSERT OR REPLACE INTO broker_preview (broker_id, doc) VALUES (?, ?)'),
    flowMessages: db.prepare('SELECT * FROM flow_messages WHERE broker_id = ? ORDER BY ord'),
    setFlowMessage: db.prepare('UPDATE flow_messages SET message = ? WHERE broker_id = ? AND key = ?'),
    insertFlowMessage: db.prepare(`INSERT OR IGNORE INTO flow_messages
      (broker_id, key, title, from_state, chip, message, ord) VALUES (?, ?, ?, ?, ?, ?, ?)`),

    withdrawals: db.prepare(`SELECT l.*, u.name FROM ledger l
      LEFT JOIN users u ON u.id = l.user_id
      WHERE l.kind = 'withdrawal' ORDER BY l.at DESC`),
    payments: db.prepare(`SELECT o.*,
        EXISTS (SELECT 1 FROM ledger l WHERE l.key = 'order:' || o.id) AS booked
      FROM orders o ORDER BY o.created_at DESC LIMIT 500`),
    /* The watcher's "I won't guess" pile. Unresolved first, then the audit
       trail of what was already attributed or dismissed. */
    unmatchedTxs: db.prepare(`SELECT * FROM unmatched_txs
      ORDER BY (resolution IS NOT NULL), COALESCE(tx_at, seen_at) DESC LIMIT 200`),
    /* Candidates for manual attribution: still open, already has an invoice.
       `username` comes off the order row — the two id spaces don't join by
       string-building 'tg' || user_id (see ledger.userIdForTelegram). */
    openOrders: db.prepare(`SELECT * FROM orders
      WHERE status IN ('pending','submitted') AND amount_crypto IS NOT NULL
      ORDER BY created_at DESC LIMIT 200`),

    cycles: db.prepare('SELECT * FROM cashback_cycles ORDER BY rowid'),
    /* Undecided only: a row parked on waiting-for-deposit is owed by the user,
       not by us, and comes back here on its own when they confirm the deposit
       (confirmBrokerDeposit -> reopenReview clears the decision). */
    reviewQueue: db.prepare("SELECT * FROM review_queue WHERE decision IS NULL ORDER BY rowid"),
    countOpenReviews: db.prepare('SELECT COUNT(*) AS n FROM review_queue WHERE decision IS NULL'),
    countOpenUnmatched: db.prepare('SELECT COUNT(*) AS n FROM unmatched_txs WHERE resolution IS NULL'),
    setDecision: db.prepare('UPDATE review_queue SET decision = ? WHERE id = ?'),
    reviewRow: db.prepare('SELECT * FROM review_queue WHERE id = ?'),
    reviewByUserBroker: db.prepare('SELECT * FROM review_queue WHERE user_id = ? AND broker_id = ?'),
    insertReview: db.prepare(`INSERT INTO review_queue
      (id, user_id, name, plan, broker_id, requested_at, email, broker_account_id, last_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    /* Re-entering the queue: decision NULL puts it back in front of the admin,
       last_status says what state it came from, requested_at is the re-entry
       time so the queue sorts by when the admin actually got the request. */
    reopenReview: db.prepare(`UPDATE review_queue SET email = ?, broker_account_id = ?,
      requested_at = ?, last_status = ?, decision = NULL WHERE id = ?`),
    /* Marks the deposit phase once the account passes — see decideReview. */
    setLastStatus: db.prepare('UPDATE review_queue SET last_status = ? WHERE id = ?'),
    setUserBrokerContact: db.prepare(`UPDATE users SET email = ?, broker = ?, status = 'pending',
      last_action_at = ? WHERE id = ?`),

    ensureRebate: db.prepare(`INSERT OR IGNORE INTO rebates
      (broker_id, user_id, name, plan, email, broker_account_id, total_rebate, last_week_rebate, shared_rebate)
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0)`),
    rebates: db.prepare('SELECT * FROM rebates WHERE broker_id = ? ORDER BY total_rebate DESC'),
    rebate: db.prepare('SELECT * FROM rebates WHERE broker_id = ? AND user_id = ?'),
    drafts: db.prepare(`SELECT d.*, r.name, r.plan, r.email, r.broker_account_id, r.total_rebate
      FROM rebate_drafts d JOIN rebates r ON r.broker_id = d.broker_id AND r.user_id = d.user_id
      WHERE d.broker_id = ? ORDER BY d.rowid`),
    upsertDraft: db.prepare(`INSERT OR REPLACE INTO rebate_drafts
      (broker_id, user_id, last_week_rebate, shared_rebate, action_date) VALUES (?, ?, ?, ?, ?)`),
    deleteDraft: db.prepare('DELETE FROM rebate_drafts WHERE broker_id = ? AND user_id = ?'),
    clearDrafts: db.prepare('DELETE FROM rebate_drafts WHERE broker_id = ?'),

    subscribers: db.prepare('SELECT * FROM subscribers ORDER BY rowid'),
    grants: db.prepare('SELECT * FROM extra_grants ORDER BY created_at DESC'),
    insertGrant: db.prepare(`INSERT INTO extra_grants
      (id, added_at, added_time, extra_days, eligible_before, eligible_time, affected, message, notify, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    // Eligibility is the whole point of the "purchased before" field: the
    // latest purchase instant (ledger row; midnight UTC of the legacy date
    // column for rows booked without one) is before the cutoff. Both `?` take
    // the same epoch ms, or null for "everyone active".
    eligibleCount: db.prepare(`SELECT COUNT(*) AS n ${ELIGIBLE_SQL}`),
    eligibleIds: db.prepare(`SELECT s.id, u.telegram_id ${ELIGIBLE_SQL}`),

    events: db.prepare('SELECT * FROM events ORDER BY created_at DESC'),
    insertEvent: db.prepare('INSERT INTO events (id, title, description, icon, date, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    updateEvent: db.prepare('UPDATE events SET title = ?, description = ?, icon = ?, date = ? WHERE id = ?'),
    deleteEvent: db.prepare('DELETE FROM events WHERE id = ?'),

    /* The referral table, derived. `revenue` is what the invitees netted US;
       `revenue_shared` is what we handed back to the inviter, read off their
       own ledger rows rather than recomputed from a rate — the rate can change
       between earning and payout, the row cannot. */
    liveReferralRows: db.prepare(`SELECT u.id, u.name, u.plan, u.user_no,
        (SELECT COUNT(*) FROM users i WHERE i.referred_by = u.id) AS invited,
        (SELECT COUNT(*) FROM users i JOIN subscribers s ON s.id = i.id
          WHERE i.referred_by = u.id) AS plan_count,
        (SELECT COUNT(DISTINCT l.user_id) FROM ledger l JOIN users i ON i.id = l.user_id
          WHERE i.referred_by = u.id AND l.kind = 'cashback' AND l.amount > 0) AS cashback_count,
        (SELECT COALESCE(SUM(l.revenue - l.amount), 0) FROM ledger l JOIN users i ON i.id = l.user_id
          WHERE i.referred_by = u.id AND l.kind IN ('subscription', 'cashback')) AS revenue,
        (SELECT COALESCE(SUM(l.amount), 0) FROM ledger l
          WHERE l.user_id = u.id AND l.kind = 'referral') AS revenue_shared
      FROM users u
      WHERE EXISTS (SELECT 1 FROM users i WHERE i.referred_by = u.id)
      ORDER BY invited DESC`),
    /* The activity columns are counted from the invitees tagged with the
       campaign (users.ref_campaign) and their ledger rows — the stored
       invited / plan_… / cashback_… / revenue_… columns were inserted as 0 and
       never written again. Same definitions as liveReferralRows, plus the
       "(total)" figures: purchases and payouts, not just people. */
    referralCampaigns: db.prepare(`SELECT c.*,
        (SELECT COUNT(*) FROM users i WHERE i.ref_campaign = c.id) AS invited,
        (SELECT COUNT(*) FROM users i JOIN subscribers s ON s.id = i.id
          WHERE i.ref_campaign = c.id) AS plan_count,
        (SELECT COUNT(*) FROM ledger l JOIN users i ON i.id = l.user_id
          WHERE i.ref_campaign = c.id AND l.kind = 'subscription') AS plan_total,
        (SELECT COUNT(DISTINCT l.user_id) FROM ledger l JOIN users i ON i.id = l.user_id
          WHERE i.ref_campaign = c.id AND l.kind = 'cashback' AND l.amount > 0) AS cashback_count,
        (SELECT COUNT(*) FROM ledger l JOIN users i ON i.id = l.user_id
          WHERE i.ref_campaign = c.id AND l.kind = 'cashback' AND l.amount > 0) AS cashback_total,
        (SELECT COALESCE(SUM(l.revenue - l.amount), 0) FROM ledger l JOIN users i ON i.id = l.user_id
          WHERE i.ref_campaign = c.id AND l.kind IN ('subscription', 'cashback')) AS revenue,
        (SELECT COALESCE(SUM(l.amount), 0) FROM ledger l JOIN users i ON i.id = l.ref_user_id
          WHERE i.ref_campaign = c.id AND l.kind = 'referral') AS revenue_shared
      FROM referral_campaigns c ORDER BY c.rowid`),
    insertReferralCampaign: db.prepare(`INSERT INTO referral_campaigns
      (id, name, status, link_code, invited, plan_count, plan_total, cashback_count, cashback_total,
       revenue, revenue_shared, revenue_net, plan_share, cashback_share, website_link, bot_link, end_date, doc)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?)`),
    setReferralCampaignStatus: db.prepare('UPDATE referral_campaigns SET status = ? WHERE id = ?'),
    refCampaignByCode: db.prepare('SELECT id FROM referral_campaigns WHERE link_code = ?'),
    codelessCampaigns: db.prepare("SELECT id FROM referral_campaigns WHERE link_code IS NULL OR link_code = ''"),
    setCampaignLinkCode: db.prepare('UPDATE referral_campaigns SET link_code = ? WHERE id = ?'),
    liveCampaignDocs: db.prepare("SELECT id, doc FROM referral_campaigns WHERE status = 'active'"),
    updateReferralCampaign: db.prepare(`UPDATE referral_campaigns
      SET name = ?, link_code = ?, plan_share = ?, cashback_share = ?, end_date = ?, doc = ? WHERE id = ?`),

    campaignLists: db.prepare(`SELECT l.id, l.name,
        (SELECT COUNT(*) FROM campaign_list_members m WHERE m.list_id = l.id) AS count
      FROM campaign_lists l ORDER BY l.rowid`),
    insertList: db.prepare('INSERT OR REPLACE INTO campaign_lists (id, name, count) VALUES (?, ?, 0)'),
    listMembers: db.prepare('SELECT campaign_id FROM campaign_list_members WHERE list_id = ?'),
    addListMember: db.prepare('INSERT OR IGNORE INTO campaign_list_members (list_id, campaign_id) VALUES (?, ?)'),
    removeListMember: db.prepare('DELETE FROM campaign_list_members WHERE list_id = ? AND campaign_id = ?'),
    updateCampaign: db.prepare('UPDATE campaigns SET name = ?, status = ?, doc = ? WHERE id = ?'),
    campaignCount: db.prepare('SELECT COUNT(*) AS n FROM campaigns'),
    campaigns: db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC'),
    insertCampaign: db.prepare('INSERT INTO campaigns (id, name, status, doc, created_at) VALUES (?, ?, ?, ?, ?)'),
    setCampaignStatus: db.prepare('UPDATE campaigns SET status = ? WHERE id = ?'),
    deleteCampaign: db.prepare('DELETE FROM campaigns WHERE id = ?'),

    /* `id` is `w<monday's-ISO-date>` (see results-math.ts), so sorting the
       string sorts by week regardless of when a row was inserted or last
       edited — draft or published. The old `ORDER BY ord` sorted by an
       `ord` column nothing ever set, so it degenerated to SQLite's physical
       row order: INSERT OR REPLACE re-inserts an edited row at the end,
       which is why a freshly drafted week could sink to the bottom. */
    signals: db.prepare('SELECT * FROM signal_results ORDER BY id DESC'),
    upsertSignal: db.prepare(`INSERT OR REPLACE INTO signal_results
      (id, period, range_label, total, sl, tp1, tp2, tp3, tp4, status, published_at, published_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    deleteSignal: db.prepare('DELETE FROM signal_results WHERE id = ?'),


    messageTemplateRow: db.prepare('SELECT * FROM message_templates WHERE key = ?'),
    insertMessageTemplate: db.prepare('INSERT OR IGNORE INTO message_templates (key, body, updated_at) VALUES (?, ?, ?)'),
    upsertMessageTemplate: db.prepare(`INSERT INTO message_templates (key, body, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`),
  };

  const nowMs = () => Date.now();
  /* Audit-row key suffix: unique per event so a repeated decision is a second
     row, not an INSERT OR IGNORE no-op (ms alone collides in tests and in
     back-to-back clicks). */
  const auditStamp = () => `${nowMs()}-${randomBytes(2).toString('hex')}`;
  /** Stamp a launch: last_seen for the "active in the last N days" snapshots,
   *  daily_actives for the day-by-day trend. Called on every ensureUser(). */
  const touchActivity = (userId, now = nowMs()) => {
    q.touchLastSeen.run(now, userId);
    q.markDailyActive.run(fmtDay(now), userId);
  };

  /** INSERT OR IGNORE, so calling this on a broker that already has some or
   *  all of its four rows only fills in what's missing. */
  const seedFlowMessages = (brokerId) => {
    FLOW_DEFAULTS.forEach((d, i) => q.insertFlowMessage.run(brokerId, d.key, d.title, d.from, d.chip, d.message, i));
  };
  // Backfill once at boot: every broker gets its four status-message rows,
  // seeded or hand-added, past or future — the table shipped with nothing
  // ever writing to it, so "Status message" opened empty for every broker.
  for (const row of db.prepare('SELECT id FROM brokers').all()) seedFlowMessages(row.id);
  // The Xchief copy became the default (FLOW_DEFAULTS). Every broker still
  // holding the seed it replaced gets moved onto it; anything an admin typed
  // is left exactly as they typed it.
  for (const d of FLOW_DEFAULTS) {
    db.prepare('UPDATE flow_messages SET message=? WHERE key=? AND message=?').run(d.message, d.key, d.old);
  }

  // Same idea for the bot's transactional messages: INSERT OR IGNORE so a
  // template an admin has already edited is never overwritten by a restart,
  // and a template added to MESSAGE_TEMPLATES later still shows up seeded.
  for (const t of MESSAGE_TEMPLATES) q.insertMessageTemplate.run(t.key, t.body, nowMs());
  /* Payment Confirmed absorbed the five add-on rows it used to append — one
     editable message now, with the sometimes-lines dropping themselves. Move
     every earlier seed onto it and delete the add-ons; a payment_confirmed an
     admin rewrote by hand matches none of these and is left alone. */
  db.prepare(`UPDATE message_templates SET body=? WHERE key='payment_confirmed' AND body IN (?, ?)`)
    .run(MESSAGE_TEMPLATES.find((t) => t.key === 'payment_confirmed').body,
      'Payment confirmed — <b>{plan}</b> is active.\n{amount} received in {currency}.',
      'Payment confirmed — <b>{plan}</b> is active.\nSubscription total: {total}\n{amount} received in {currency}.');
  db.prepare(`DELETE FROM message_templates WHERE key LIKE 'payment\\_confirmed\\_%' ESCAPE '\\'`).run();
  // Expiry reminders are a campaign trigger now ("Remaining Subscription"), not a fixed message.
  db.prepare(`DELETE FROM message_templates WHERE key='subscription_reminder'`).run();
  // Manual payouts carry no txid; drop the old seed's "tx {txid}" line where it's still untouched.
  db.prepare(`UPDATE message_templates SET body=? WHERE key='withdrawal_sent' AND body=?`)
    .run(MESSAGE_TEMPLATES.find((t) => t.key === 'withdrawal_sent').body,
      '✅ Withdrawal sent — {amount} {currency} ({network})\ntx {txid}');

  const store = {
    db,
    q,
    /** The money spine and the campaign engine, exposed for the routes and jobs.
     *  Named `campaignEngine`, not `campaigns` — the latter is already the
     *  reader that returns the campaign list. */
    ledger,
    campaignEngine: campaigns,

    /* ---- auth ---- */

    createAdmin(username, password) {
      const { salt, hash } = hashPassword(password);
      q.insertAdmin.run(username, salt, hash, nowMs());
    },

    login(username, password) {
      const admin = q.adminByName.get(username);
      // Hash anyway on a miss so a bad username and a bad password take the
      // same time; otherwise the endpoint enumerates valid usernames.
      if (!admin) {
        hashPassword(password);
        return null;
      }
      if (!passwordMatches(password, admin.salt, admin.hash)) return null;
      const token = randomBytes(32).toString('hex');
      q.insertSession.run(token, admin.id, nowMs() + SESSION_TTL_MS);
      q.sweepSessions.run(nowMs());
      return { token, username: admin.username, maxAge: SESSION_TTL_MS / 1000 };
    },

    logout(token) {
      if (token) q.deleteSession.run(token);
    },

    /* ---- API keys ----
       The plaintext is returned exactly once, at creation; only its sha256 is
       stored, so a lost key is reminted rather than recovered. */

    createApiKey(name, scope) {
      const key = `tfk_${randomBytes(32).toString('base64url')}`;
      const row = {
        id: `k${randomBytes(6).toString('hex')}`,
        name, prefix: key.slice(0, 12), scope, createdAt: nowMs(), lastUsedAt: null,
      };
      q.insertApiKey.run(row.id, name, row.prefix, keyHash(key), scope, row.createdAt);
      return { ...row, key };
    },

    apiKeys: () => q.apiKeys.all().map((r) => ({
      id: r.id, name: r.name, prefix: r.prefix, scope: r.scope,
      createdAt: r.created_at, lastUsedAt: r.last_used_at,
    })),

    revokeApiKey: (id) => q.deleteApiKey.run(id).changes > 0,

    /** Session row for a request, or null when absent/expired.
     *  A cookie is a human at the dashboard; a bearer key is a program, and
     *  carries `viaKey`/`scope` so the dispatcher can narrow what it reaches. */
    sessionFor(req) {
      const token = cookieValue(req, 'tf_admin');
      if (!token) return keySession(req);
      const row = q.session.get(token);
      if (!row) return null;
      if (row.expires_at < nowMs()) {
        q.deleteSession.run(token);
        return null;
      }
      return { token, adminId: row.admin_id, username: row.username };
    },

    /* ---- reads ---- */

    /* `users.plan` is a signup-time snapshot ('none' for every Mini App
       account) and never moves again. The tier badge must be the LIVE tier,
       same as user() and the rebate tables serve. */
    users: () => q.users.all(Date.now() - 30 * 86400000)
      .map((r) => ({ ...toUser(r), plan: ledger.tierOf(r.id) })),

    /** Every per-user figure, derived from the ledger. */
    booksFor: (id) => ledger.summaryFor(id),


    user(id) {
      const row = q.user.get(id);
      if (!row) return undefined;
      const b = this.booksFor(id);
      return {
        user: { ...toUser(row), tier: ledger.tierOf(id), tierPct: TIER_PCT[ledger.tierOf(id)] * 100 },
        cashback: { netTotal: b.cashbackNet, saleTotal: b.cashbackPaid },
        referral: {
          invited: b.refInvited, active: b.refActive, plan: b.refPlanCount ?? 0,
          cashback: b.refCashbackCount ?? 0, revenue: b.refRevenue, earnings: b.refEarnings,
        },
        wallet: ledger.wallet(id),
        /* The timeline: one row per real state change, straight off the ledger. */
        activity: ledger.timeline(id).map(toLedgerRow),
      };
    },
    /**
     * The admin `users` row for a Telegram account, created on first sight.
     * Every per-user Mini App route goes through this, so a user exists in the
     * dashboard from their first open rather than only after an admin adds them.
     */
    ensureUser(tg, startParam) {
      const existing = q.userByTelegram.get(tg.id);
      if (existing) {
        // Attribution is first-writer-wins, so this is a no-op for anyone who
        // already has an inviter — but a user who opened the app before the
        // link existed still gets credited.
        if (startParam) ledger.attribute(existing.id, startParam);
        touchActivity(existing.id);
        return toUser(q.user.get(existing.id));
      }
      const id = `tg${tg.id}`;
      const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ') || tg.username || id;
      q.insertTelegramUser.run(id, name, tg.id, fmtDay());
      ledger.append({ userId: id, kind: 'signup', detail: 'Started the bot', key: `start:${id}` });
      if (startParam) ledger.attribute(id, startParam);
      touchActivity(id);
      return toUser(q.user.get(id));
    },
    /**
     * Note that a user reached the app through a campaign's button.
     *
     * The start param is namespaced `c_<campaignId>` so it cannot be confused
     * with a referral code, which shares the same channel. Anything else is
     * not a campaign open and is ignored.
     */
    recordCampaignOpen(userId, startParam) {
      if (typeof startParam !== 'string' || !startParam.startsWith('c_')) return false;
      return campaigns.recordOpen(startParam.slice(2), userId);
    },

    /** Everything the Mini App needs about the signed-in user, in one read. */
    miniAppUser(id) {
      const sub = q.subscriber.get(id);
      const b = this.booksFor(id);
      const now = Date.now();
      const tier = ledger.tierOf(id, now);
      // A row still in the review queue outranks nothing — it is a broker the
      // user has submitted but that has no rebates yet. An 'approved' row is
      // skipped: approval created the rebates row below, which is the live
      // relationship. last_status carries the phase — a queue row whose last
      // status is a Deposit one is past account verification.
      const reviewOverrides = q.myReviews.all(id).filter((r) => r.decision !== 'approved').map((r) => {
        const depositPhase = (r.last_status ?? '').startsWith('Deposit');
        const state = r.decision == null
          ? (depositPhase ? 'deposit-review' : 'pending')
          : r.decision === 'waiting' ? 'waiting-for-deposit'
            // A rejected deposit goes back to "make a deposit", not to the
            // resubmit-account path — the account itself already passed.
            : depositPhase ? 'deposit-rejected' : 'rejected';
        return {
          brokerId: r.broker_id, state,
          brokerAccountId: r.broker_account_id, email: r.email,
          lastStatus: r.last_status, requestedAt: r.requested_at,
        };
      });
      // An admin can reject/waitlist a user who was already approved and
      // earning — that rewrites this same review_queue row's decision but
      // never touches the rebates row it created, so the rebates row alone
      // can't tell "still active" from "approved once, since reverted". The
      // fresher review decision wins the broker's displayed step; the
      // rebates row (and its money history) is untouched either way.
      const overriddenBrokerIds = new Set(reviewOverrides.map((r) => r.brokerId));
      return {
        /** The tier the user is actually earning at, and its rate. */
        tier: { id: tier, pct: TIER_PCT[tier] * 100 },
        wallet: ledger.wallet(id),
        /** Their own referral link payload — the code the bot's start param carries. */
        refCode: ledger.refCodeFor(id),
        offers: campaigns.offersFor(id, now),
        subscription: sub
          ? {
            plan: sub.plan,
            status: sub.status,
            // Computed, never read off a stored countdown.
            daysLeft: sub.expires_at == null
              ? sub.days_left
              : Math.max(0, Math.ceil((sub.expires_at - now) / 86_400_000)),
            /* The full term this purchase bought — the 100% the Home ring's
               days-left arc is drawn against. Measured purchase→expiry, so an
               early renewal (which carries the unused days forward) counts
               them in the total instead of overflowing the ring. */
            totalDays: totalDaysOf(sub),
            expiresAt: sub.expires_at,
            purchasedAt: sub.purchased_at,
            totalPaid: sub.total_paid,
          }
          : null,
        /* `earned` is the only figure the Mini App may show as the user's own
           money. The admin keeps these books platform-side — `cashback_net` and
           `ref_revenue` are OUR margin ("Our Monthly Net"), while
           `cashback_sale` and `ref_earnings` are what was paid out to the user
           ("Paid to User") and are carried negative. Showing `netTotal` on the
           cashback card would quote the company's cut back at the customer, so
           the sign flip happens here, once, rather than in each screen. */
        cashback: {
          earned: Math.abs(b.cashbackPaid),
          netTotal: b.cashbackNet,
          saleTotal: b.cashbackPaid,
        },
        referral: {
          invited: b.refInvited, active: b.refActive, plan: b.refPlanCount ?? 0,
          cashback: b.refCashbackCount ?? 0, revenue: b.refRevenue, earnings: b.refEarnings,
          earned: Math.abs(b.refEarnings),
          /* The commission rate this user actually earns at: their live tier,
             on both revenue streams. NOT referral_rows' plan_pct/cashback_pct —
             those are conversion rates (what share of invitees bought a plan),
             and showing one as "referral share" would quote a funnel metric as
             a payout rate. */
          share: { planPct: TIER_PCT[tier] * 100, cashbackPct: TIER_PCT[tier] * 100 },
          /* Conversion, kept separate and named for what it is. */
          conversion: b.refInvited
            ? { planPct: pctOf(b.refPlanCount, b.refInvited), cashbackPct: pctOf(b.refCashbackCount, b.refInvited) }
            : null,
        },
        /** One entry per broker this user has any relationship with. */
        brokers: [
          ...q.myRebates.all(id).filter((r) => !overriddenBrokerIds.has(r.broker_id)).map((r) => ({
            brokerId: r.broker_id, state: 'cashback-active',
            brokerAccountId: r.broker_account_id, email: r.email,
            totalRebate: r.total_rebate, sharedRebate: r.shared_rebate,
          })),
          ...reviewOverrides,
        ],
      };
    },
    userCounts() {
      const r = q.userCounts.get();
      return { all: r.all_users ?? 0, active: r.active ?? 0, pending: r.pending ?? 0, rejected: r.rejected ?? 0 };
    },
    setUserStatus: (id, status) => q.setUserStatus.run(status, id).changes > 0,

    /**
     * Usage overview: total users, how many opened the app in the last
     * day/3 days/7 days (from `last_seen`, a live snapshot — never cached),
     * and daily active counts for the trend chart (from `daily_actives`,
     * exact per-day history back to whenever tracking started).
     */
    analytics(now = nowMs(), trendDays = 30) {
      const DAY = 86_400_000;
      const since = (ms) => q.activeSince.get(now - ms).n;
      const from = fmtDay(now - (trendDays - 1) * DAY);
      const byDay = new Map(q.dailyActiveCounts.all(from).map((r) => [r.day, r.n]));
      const daily = [];
      for (let i = trendDays - 1; i >= 0; i -= 1) {
        const day = fmtDay(now - i * DAY);
        daily.push({ day, active: byDay.get(day) ?? 0 });
      }
      return {
        totalUsers: q.totalUsers.get().n,
        activeToday: since(DAY), active3d: since(3 * DAY), active7d: since(7 * DAY),
        daily,
      };
    },

    brokers: () => q.brokers.all().map(toBroker),
    broker: (id) => { const r = q.broker.get(id); return r ? toBroker(r) : undefined; },
    /** Live totals for the rebate overview bar — summed, never estimated. */
    brokerTotals() {
      const r = q.brokerTotals.get();
      return { totalRebate: r.total_rebate, draftedPayment: r.drafted, brokers: r.brokers };
    },
    addBroker({ name, status = 'private', color = '#111111', shareRate = 0.3 }) {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
        || `broker-${randomBytes(3).toString('hex')}`;
      if (q.broker.get(id)) return undefined; // ids are derived from the name, so collisions are real duplicates
      const rank = status === 'public' ? q.maxRank.get().n + 1 : null;
      q.insertBroker.run(id, name, color, status, rank, shareRate, new Date().toISOString());
      seedFlowMessages(id);
      return toBroker(q.broker.get(id));
    },
    /**
     * Full delete, not a status change. Refuses a broker with anything still
     * actionable — an open review request or a drafted-but-unpublished
     * payout — so deleting never silently drops work in flight. Settled
     * rebate history (`live_active`) does NOT block: nothing ever clears a
     * `rebates` row except this delete, so requiring it to be zero first
     * would make any broker with rebate history permanently undeletable.
     * The delete itself cascades those rows away.
     * Returns 'ok' | 'in_use' | 'not_found'.
     */
    deleteBroker(id) {
      const b = q.broker.get(id);
      if (!b) return 'not_found';
      if (b.unreviewed > 0 || b.drafted_payment > 0) return 'in_use';
      db.exec('BEGIN');
      try {
        q.deleteBrokerPreview.run(id);
        q.deleteBrokerFlowMessages.run(id);
        q.deleteBrokerRebates.run(id);
        q.deleteBrokerRebateDrafts.run(id);
        q.deleteBrokerReviewQueue.run(id);
        q.deleteBroker.run(id);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return 'ok';
    },
    /** One transaction: partial reorders would leave duplicate ranks. */
    reorderBrokers(order) {
      db.exec('BEGIN');
      try {
        let rank = 0;
        const now = new Date().toISOString();
        for (const { id, status } of order) {
          q.setBrokerOrder.run(status === 'public' ? ++rank : null, status, now, id);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    preview(brokerId) {
      const row = q.preview.get(brokerId);
      return row ? JSON.parse(row.doc) : undefined;
    },
    setPreview: (brokerId, doc) => {
      q.setPreview.run(brokerId, JSON.stringify(doc));
      q.touchBroker.run(new Date().toISOString(), brokerId);
    },

    flowMessages: (brokerId) => q.flowMessages.all(brokerId).map(toFlowMessage),
    setFlowMessage: (brokerId, key, message) => q.setFlowMessage.run(message, brokerId, key).changes > 0,

    /** The bot's transactional copy, metadata from MESSAGE_TEMPLATES merged
     *  with whatever body an admin has saved over the shipped default. */
    messageTemplates: () => MESSAGE_TEMPLATES.map((def) => {
      const row = q.messageTemplateRow.get(def.key);
      return {
        key: def.key, name: def.name, group: def.group, hint: def.hint, vars: def.vars,
        body: row?.body ?? def.body, default: def.body, updatedAt: row?.updated_at ?? 0,
      };
    }),
    /** The live body for one key — what notify/jobs/payouts/watcher actually
     *  send. Undefined only if MESSAGE_TEMPLATES has never been seeded for
     *  it (can't happen post-boot); callers fall back to their own copy. */
    messageTemplate: (key) => q.messageTemplateRow.get(key)?.body,
    setMessageTemplate(key, body) {
      if (!MESSAGE_TEMPLATES.some((t) => t.key === key)) return undefined;
      const updatedAt = nowMs();
      q.upsertMessageTemplate.run(key, body, updatedAt);
      return { key, body, updatedAt };
    },

    /**
     * Money leaving the platform, newest first — the payout worklist. Reads
     * payouts.mjs's own `withdrawals` table (queued/sending/manual/sent), not
     * the ledger — the ledger only knows a reservation was made, not whether
     * it was ever actually paid out. Statements are prepared lazily, on first
     * call rather than up in `q`: payouts.mjs's schema is exec'd from
     * index.mjs, and this module's factory can run before that line does
     * (admin-routes.mjs opens its own store at import time) — by the time an
     * HTTP request reaches here the server has finished booting either way.
     */
    withdrawals: () => {
      withdrawalRequestsStmt ??= db.prepare(`SELECT w.*, u.name FROM withdrawals w
        LEFT JOIN users u ON u.id = w.user_id ORDER BY w.created_at DESC LIMIT 500`);
      return withdrawalRequestsStmt.all().map(toWithdrawalRow);
    },

    /** The three queues that need a human, for the sidebar's badges. Counts
     *  only — the pages themselves do the real reads. */
    alerts() {
      let withdrawals = 0;
      try {
        openWithdrawalsStmt ??= db.prepare(
          "SELECT COUNT(*) AS n FROM withdrawals WHERE status IN ('queued','sending','manual')");
        withdrawals = openWithdrawalsStmt.get().n;
      } catch {
        // payouts.mjs creates that table in startPayouts(), which an admin-only
        // process (or a test) never runs. No table = nothing owed, not a 500.
      }
      return {
        reviews: q.countOpenReviews.get().n,
        unmatched: q.countOpenUnmatched.get().n,
        withdrawals,
        campaignBrokers: campaignsNeedingBrokerReview(
          q.brokers.all().map((b) => b.id),
          q.liveCampaignDocs.all().map((r) => JSON.parse(r.doc || '{}')),
        ),
      };
    },

    /** Admin has paid a `manual`/`queued` row by hand — record it as sent and
     *  tell the user, the same as the automated path in payouts.mjs would.
     *  Returns the same shape `withdrawals()` rows have (plus `tgUserId`, for
     *  the caller to notify), or null if it was already resolved — no
     *  double-notify on a second click. */
    markWithdrawalSent(id) {
      markWithdrawalSentStmt ??= db.prepare(
        `UPDATE withdrawals SET status='sent', error=NULL, updated_at=?
         WHERE id=? AND status IN ('queued','sending','manual')`,
      );
      readWithdrawalStmt ??= db.prepare('SELECT * FROM withdrawals WHERE id = ?');
      const res = markWithdrawalSentStmt.run(nowMs(), id);
      if (res.changes === 0) return null;
      const row = readWithdrawalStmt.get(id);
      return { ...toWithdrawalRow(row), tgUserId: row.tg_user_id };
    },

    /** Admin refused a withdrawal. `enqueueWithdrawal` debited the balance the
     *  moment the request was made (that is the freeze that stops a user
     *  queueing the same money twice), so rejecting has to hand it back —
     *  keyed on the withdrawal id, so a double click credits once. Same
     *  null-if-already-resolved contract as markWithdrawalSent. */
    rejectWithdrawal(id, reason) {
      rejectWithdrawalStmt ??= db.prepare(
        `UPDATE withdrawals SET status='refunded', error=?, updated_at=?
         WHERE id=? AND status IN ('queued','sending','manual')`,
      );
      readWithdrawalStmt ??= db.prepare('SELECT * FROM withdrawals WHERE id = ?');
      const res = rejectWithdrawalStmt.run(String(reason), nowMs(), id);
      if (res.changes === 0) return null;
      const row = readWithdrawalStmt.get(id);
      ledger.creditRefund({
        userId: row.user_id, amountUsd: row.amount_usd, orderId: id,
        detail: 'Rejected withdrawal returned to balance',
      });
      return { ...toWithdrawalRow(row), tgUserId: row.tg_user_id };
    },

    /** Money arriving. Reads `orders` directly — one file, so no bridge. */
    payments: () => q.payments.all().map((r) => ({
      id: r.id, userId: r.user_id, username: r.username, planId: r.plan_id,
      userNo: userNoOfTelegram(r.user_id),
      amountUsd: r.amount_usd, currency: r.currency, network: r.network,
      txid: r.txid, status: r.status,
      confirmedAt: r.confirmed_at ? fmtStamp(r.confirmed_at) : null,
      booked: r.booked === 1,
    })),

    /* Money that arrived but could not be attributed to an order on its own —
       the watcher's escalation to a human. See unmatched_txs in db.mjs. */
    unmatchedTxs: () => q.unmatchedTxs.all().map((r) => ({
      txid: r.txid, chain: r.chain, currency: r.currency, network: r.network,
      address: r.address, sender: r.sender, amount: r.amount, decimals: r.decimals,
      reason: r.reason, at: r.tx_at ?? r.seen_at,
      resolution: r.resolution, orderId: r.order_id, resolvedBy: r.resolved_by, resolvedAt: r.resolved_at,
    })),

    /** Open orders an unmatched transfer could belong to, for the picker. */
    openOrders: () => q.openOrders.all().map((r) => ({
      id: r.id, userId: r.user_id, username: r.username, planId: r.plan_id,
      amountUsd: r.amount_usd, currency: r.currency, network: r.network,
      amountCrypto: r.amount_crypto, paidUnits: r.paid_units, createdAt: r.created_at,
    })),

    cycles: () => q.cycles.all().map(toCycle),
    reviewQueue: () => q.reviewQueue.all()
      .map((r) => ({ ...toReview(r), plan: ledger.tierOf(r.user_id) })),

    /** A `rebates` row means "this (user,broker) link is live and earning" —
     *  true until an admin's later decision walks it back to waiting/rejected.
     *  That doesn't delete the row (it would zero out the admin's running
     *  rebate total, which the ledger — not this row — is the real record
     *  of), so the row alone can't tell "still active" from "approved once,
     *  since reverted". Whatever review_queue.decision says now wins. */
    liveRebateLink(userId, brokerId) {
      if (!q.rebate.get(brokerId, userId)) return false;
      const row = q.reviewByUserBroker.get(userId, brokerId);
      return !row || row.decision == null || row.decision === 'approved';
    },

    /**
     * The Mini App's "Submit account" — a broker-account verification request.
     * Creates the queue row on first submit; a rejected row re-enters the
     * queue with the corrected details. Returns 'ok' | 'active' (already
     * earning cashback) | 'pending' (already under review / account already
     * verified) | 'missing_account' (first submit needs the broker user id).
     */
    submitBrokerRequest({ userId, brokerId, email, brokerAccountId, needAccountId = true }) {
      if (this.liveRebateLink(userId, brokerId)) return 'active';
      const existing = q.reviewByUserBroker.get(userId, brokerId);
      if (existing && existing.decision !== 'rejected') return 'pending';
      const at = fmtStamp(nowMs());
      db.exec('BEGIN');
      try {
        let reviewId = existing?.id;
        if (existing) {
          const last = (existing.last_status ?? '').startsWith('Deposit')
            ? 'Deposit rejected' : 'Registration rejected';
          q.reopenReview.run(email, brokerAccountId || existing.broker_account_id, at, last, existing.id);
        } else {
          if (needAccountId && !brokerAccountId) { db.exec('ROLLBACK'); return 'missing_account'; }
          const user = q.user.get(userId);
          reviewId = `rv${randomBytes(4).toString('hex')}`;
          q.insertReview.run(reviewId, userId,
            user?.name ?? userId, user?.plan ?? 'none', brokerId, at, email ?? '', brokerAccountId ?? '', 'No account');
        }
        q.setUserBrokerContact.run(email, brokerId, at, userId);
        // The other half of the audit trail: the request itself, not just our
        // decision on it. Zero-amount, so no chart counts it as money.
        ledger.append({
          userId, kind: 'cashback', amount: 0, revenue: 0, brokerId,
          key: `review:${reviewId}:${auditStamp()}:submitted`,
          detail: `${q.broker.get(brokerId)?.name ?? brokerId} request submitted`,
        });
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return 'ok';
    },

    /**
     * The Mini App's "I made a deposit" — puts the row back in front of the
     * admin. Only meaningful from waiting-for-deposit (or a rejected deposit
     * being retried); anything else is a no-op with a name.
     */
    confirmBrokerDeposit({ userId, brokerId }) {
      if (this.liveRebateLink(userId, brokerId)) return 'active';
      const row = q.reviewByUserBroker.get(userId, brokerId);
      if (!row) return 'not_found';
      const depositPhase = (row.last_status ?? '').startsWith('Deposit');
      const from = row.decision === 'waiting' ? 'Deposit required'
        : row.decision === 'rejected' && depositPhase ? 'Deposit rejected'
          : null;
      if (!from) return row.decision == null ? 'pending' : 'not_found';
      const at = fmtStamp(nowMs());
      q.reopenReview.run(row.email, row.broker_account_id, at, from, row.id);
      return 'ok';
    },

    /** A decision is not just a queue state — it is the user's account status.
     *  Returns false, or what the caller needs to DM the user: the flow-message
     *  key resolved from decision + phase, and where to send it. */
    decideReview(id, decision) {
      const row = q.reviewRow.get(id);
      if (!row) return false;
      const status = { approved: 'active', rejected: 'rejected', waiting: 'pending' }[decision];
      /* The deposit phase is where a reject means "your deposit didn't check
         out": the user was told to deposit and hasn't been approved since. An
         ALREADY-APPROVED row is not in it — that user's deposit passed, so
         rejecting them is a registration rejection that walks the link all
         the way back, not a deposit we failed to verify. */
      const depositPhase = (row.last_status ?? '').startsWith('Deposit') && row.decision !== 'approved';
      db.exec('BEGIN');
      try {
        q.setDecision.run(decision, id);
        // last_status is what carries the phase into the next decision.
        if (decision !== 'rejected' && !depositPhase) q.setLastStatus.run('Deposit required', id);
        if (decision === 'rejected' && !depositPhase) q.setLastStatus.run('Registration rejected', id);
        if (row.user_id) {
          q.setUserStatus.run(status, row.user_id);
          /* An approval also opens the cashback relationship: without a
             `rebates` row there is nothing to draft a weekly rebate against,
             so the user would be "approved" and permanently unpayable. */
          if (decision === 'approved') {
            q.ensureRebate.run(row.broker_id, row.user_id, row.name, row.plan, row.email, row.broker_account_id);
          }
          /* The stamp keeps re-decisions of the same row distinct (the key is
             INSERT OR IGNORE'd), and stays BEFORE the decision so series.mjs's
             `review:…:<decision>` match still reads it. */
          ledger.append({
            userId: row.user_id, kind: 'cashback', amount: 0, revenue: 0,
            brokerId: row.broker_id, key: `review:${id}:${auditStamp()}:${decision}`,
            detail: `${q.broker.get(row.broker_id)?.name ?? row.broker_id} request ${decision}`,
          });
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      const flowKey = decision === 'approved' ? 'approved'
        : decision === 'waiting' ? 'waiting-deposit'
          : depositPhase ? 'rejected-deposit' : 'rejected';
      return {
        flowKey,
        telegramId: row.user_id ? q.user.get(row.user_id)?.telegram_id ?? null : null,
        userName: row.name, brokerId: row.broker_id,
        brokerName: q.broker.get(row.broker_id)?.name ?? row.broker_id,
      };
    },

    /** Same decision, addressed by (user, broker) instead of a queue row id —
     *  what the "Recent users" table needs since it never shows review_queue ids.
     *  Same phase rule as the queue: a verified account stays verified, so a
     *  reject after "waiting for deposit" is a deposit rejection. */
    decideReviewForUser(userId, brokerId, decision) {
      const row = q.reviewByUserBroker.get(userId, brokerId);
      return row ? this.decideReview(row.id, decision) : false;
    },

    /* `rebates.plan` is a snapshot taken when the row was created, so it goes
       stale the moment a user upgrades. The share is the LIVE tier — the same
       one addDraft and publishing use — so serve that, not the column. */
    // A demoted user (approved, then walked back to waiting/rejected) must
    // drop out of the draft list — a stale rebates row would otherwise still
    // let the admin draft a weekly cut for someone who isn't currently live.
    rebates(brokerId) {
      return q.rebates.all(brokerId)
        .filter((r) => this.liveRebateLink(r.user_id, brokerId))
        .map((r) => ({ ...toRebate(r), plan: ledger.tierOf(r.user_id) }));
    },
    drafts: (brokerId) => q.drafts.all(brokerId)
      .map((r) => ({ ...toDraft(r), plan: ledger.tierOf(r.user_id) })),
    /**
     * Draft one user's cut of what a broker paid us this week.
     *
     * `lastWeekRebate` is the gross figure the admin reads off the broker's
     * report. The split is the USER'S live tier — 10/15/20/30 — not a
     * per-broker constant: what we entered is already net of the broker's own
     * cut, so applying a second broker rate here would be taking it twice.
     */
    addDraft(brokerId, userId, lastWeekRebate) {
      const base = q.rebate.get(brokerId, userId);
      if (!base) return undefined;
      const tier = ledger.tierOf(userId);
      const shared = Math.round(lastWeekRebate * TIER_PCT[tier] * 100) / 100;
      const actionDate = fmtStamp();
      q.upsertDraft.run(brokerId, userId, lastWeekRebate, shared, actionDate);
      return {
        // `plan: tier`, not toRebate's stale `rebates.plan` snapshot — the
        // client merges this reply over its row, so the column would drag the
        // badge back to whatever tier the user had when the row was created.
        ...toRebate(base), plan: tier, lastWeekRebate, sharedRebate: shared, actionDate,
        tier, tierPct: TIER_PCT[tier] * 100,
      };
    },
    deleteDraft: (brokerId, userId) => q.deleteDraft.run(brokerId, userId).changes > 0,
    /* Publishing is what actually moves money: one transaction, one keyed
       ledger row per (cycle, broker, user), so the button that pays everybody
       is safe to press twice. `brokerId` publishes just that broker's drafts;
       omit it for the "Publish all" footer. */
    publishDrafts: (brokerId) => ledger.publishAll({ brokerId }).published,
    publishAll: (opts) => ledger.publishAll(opts),

    /** Days left is computed from `expires_at`; a stored countdown is stale by
     *  the next morning. Rows seeded before expiries existed keep their value. */
    subscribers() {
      const now = nowMs();
      return q.subscribers.all().map((r) => toSubscriber({
        ...r,
        days_left: r.expires_at == null
          ? r.days_left
          : Math.max(0, Math.ceil((r.expires_at - now) / 86_400_000)),
      }));
    },
    grants: () => q.grants.all().map(toGrant),
    /** How many active subscribers a grant with this cutoff (epoch ms | null) would reach. */
    eligibleCount: (beforeMs) => q.eligibleCount.get(beforeMs, beforeMs).n,
    /**
     * Bulk extra days. The frames only recorded the grant; this applies it —
     * every eligible subscriber's expiry moves and each one gets a ledger row,
     * so the grant shows up in their timeline and in the days-left column.
     * Returns the recipients so the caller can send the custom message.
     * `purchasedBefore` is epoch ms (already resolved from Tehran wall clock)
     * or null; the display strings are derived here so every row reads in
     * Tehran time no matter where the operator sits.
     */
    addGrant(grant) {
      const id = `g${randomBytes(6).toString('hex')}`;
      const before = grant.purchasedBefore ?? null;
      const eligible = q.eligibleIds.all(before, before);
      const note = `+${grant.extraDays} days (bulk grant)`;
      const now = nowMs();
      const saved = {
        id, addedAt: fmtDay(now), addedTime: fmtTime(now), extraDays: grant.extraDays,
        eligibleBefore: before == null ? '—' : fmtDay(before),
        eligibleTime: before == null ? '—' : fmtTime(before),
        affected: eligible.length, message: grant.message ?? '', notify: !!grant.notify,
      };
      db.exec('BEGIN');
      try {
        for (const row of eligible) ledger.grantDays(row.id, grant.extraDays, note);
        q.insertGrant.run(
          id, saved.addedAt, saved.addedTime, saved.extraDays,
          saved.eligibleBefore, saved.eligibleTime, saved.affected,
          saved.message, saved.notify ? 1 : 0, now,
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { ...saved, recipients: eligible.map((r) => r.telegram_id).filter(Boolean) };
    },

    events: () => q.events.all().map(toEvent),
    addEvent(event) {
      const id = `e${randomBytes(6).toString('hex')}`;
      q.insertEvent.run(id, event.title, event.description ?? '', event.icon ?? 'info', event.date ?? '', nowMs());
      return { id, ...event };
    },
    updateEvent: (id, e) => q.updateEvent.run(e.title, e.description ?? '', e.icon ?? 'info', e.date ?? '', id).changes > 0,
    deleteEvent: (id) => q.deleteEvent.run(id).changes > 0,

    referralRows: () => q.liveReferralRows.all().map((r) => ({
      id: r.id, name: r.name, plan: r.plan, userNo: r.user_no, invited: r.invited,
      planCount: r.plan_count, planPct: pctOf(r.plan_count, r.invited),
      cashbackCount: r.cashback_count, cashbackPct: pctOf(r.cashback_count, r.invited),
      revenue: round2(r.revenue),
      revenueShared: round2(r.revenue_shared),
      revenueNet: round2(r.revenue - r.revenue_shared),
    })),
    referralCampaigns: () => q.referralCampaigns.all().map(toReferralCampaign),

    /** A campaign's link code, unique against both other campaigns and the
     *  users' own referral codes — `ledger.attribute` reads one namespace for
     *  both, and a collision would hand a campaign's arrivals to a user. */
    newLinkCode() {
      let code;
      do {
        code = randomBytes(4).toString('hex');
      } while (q.refCampaignByCode.get(code) || db.prepare('SELECT 1 FROM users WHERE ref_code = ?').get(code));
      return code;
    },
    addReferralCampaign(c) {
      const id = `rc${randomBytes(6).toString('hex')}`;
      q.insertReferralCampaign.run(
        // No code, no link: the editor never sent one, so every campaign was
        // created with a null code and an empty Copy box.
        id, c.name, 'active', c.linkCode || this.newLinkCode(),
        c.planShare ?? 0, c.cashbackShare ?? 0,
        c.websiteLink ?? '', c.botLink ?? '', c.endDate ?? '',
        // The whole record, same as addCampaign. `c.doc` only ever existed as a
        // nested property nothing sent, so every field without a column of its
        // own — the broker display order, the excluded list — was dropped here.
        JSON.stringify(c),
      );
      return this.referralCampaigns().find((r) => r.id === id);
    },
    setReferralCampaignStatus: (id, status) => q.setReferralCampaignStatus.run(status, id).changes > 0,
    updateReferralCampaign(id, c) {
      return q.updateReferralCampaign.run(
        c.name, c.linkCode || this.newLinkCode(), c.planShare ?? 0, c.cashbackShare ?? 0,
        c.endDate ?? '', JSON.stringify(c), id,
      ).changes > 0;
    },

    campaignLists: () => q.campaignLists.all(),
    addCampaignList(name) {
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `list-${randomBytes(3).toString('hex')}`;
      q.insertList.run(id, name);
      return { id, name, count: 0 };
    },
    setCampaignLists(campaignId, listIds) {
      db.exec('BEGIN');
      try {
        for (const l of q.campaignLists.all()) q.removeListMember.run(l.id, campaignId);
        for (const id of listIds) q.addListMember.run(id, campaignId);
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
    listMembers: (listId) => q.listMembers.all(listId).map((r) => r.campaign_id),
    updateCampaign(id, c) {
      return q.updateCampaign.run(c.name, c.status ?? 'active', JSON.stringify(c), id).changes > 0;
    },
    /* Stats are counted from campaign_sends / campaign_opens / discount_codes
       and overlaid on the way out, so the stored doc can never disagree with
       what the tables say. Older docs carry seeded copies of these numbers
       that nothing ever measured; they are dropped rather than shipped, so a
       stale figure cannot reappear if some caller reads the wrong key. */
    campaigns: () => q.campaigns.all().map((r) => {
      const { messagePct, appSent, appPct, codePct, ...doc } = toCampaign(r);
      return { ...doc, ...campaigns.stats(r.id) };
    }),
    addCampaign(c) {
      const id = `m${randomBytes(6).toString('hex')}`;
      q.insertCampaign.run(id, c.name, c.status ?? 'active', JSON.stringify(c), nowMs());
      return { id, ...c, status: c.status ?? 'active' };
    },
    setCampaignStatus: (id, status) => q.setCampaignStatus.run(status, id).changes > 0,
    deleteCampaign: (id) => q.deleteCampaign.run(id).changes > 0,

    signals: () => q.signals.all().map(toSignal),
    saveSignal(r) {
      q.upsertSignal.run(
        r.id, r.period, r.range, r.total, r.sl, r.tp1, r.tp2, r.tp3, r.tp4,
        r.status, r.publishedAt ?? null, r.publishedTime ?? null,
      );
      return r;
    },
    deleteSignal: (id) => q.deleteSignal.run(id).changes > 0,

    /** Chart points, replayed live from the ledger — see series.mjs. */
    series: (name, opts) => computeSeries(db, name, opts),

    /**
     * The referral campaign whose broker list a user should be seeing, parsed,
     * or null for everyone else.
     *
     * "Live" is status `active` and an end date that has not passed — which is
     * also how a campaign lets its people go: pausing, stopping, deleting or
     * running past the end date all fall through to the public list, and
     * reopening (or extending) it takes them back, because the tag on the user
     * is never cleared.
     */
    liveCampaignFor(userId) {
      const c = ledger.refCampaignFor(userId);
      if (!c || c.status !== 'active') return null;
      if (c.end_date && c.end_date < fmtDay()) return null;
      return JSON.parse(c.doc || '{}');
    },
  };

  /* Campaigns created before link codes were generated have none, so their
     Copy boxes are empty and their links attribute nobody. One code each,
     once. */
  for (const r of q.codelessCampaigns.all()) q.setCampaignLinkCode.run(store.newLinkCode(), r.id);

  return store;
}

/**
 * The broker catalogue as one campaign's users see it: the campaign's own
 * order, its badge overrides, its excluded brokers gone, and a private broker
 * shown when the campaign lists it (the whole point of a private broker on a
 * partner's list). Anything the campaign never mentioned — a broker added
 * after it was built — keeps its own settings and sits at the end.
 */
export function campaignBrokerList(brokers, doc) {
  const display = doc?.display ?? [];
  const excluded = new Set(doc?.excluded ?? []);
  const at = new Map(display.map((d, i) => [d.brokerId, i]));
  const badge = new Map(display.map((d) => [d.brokerId, d]));
  const END = Number.MAX_SAFE_INTEGER;
  return brokers
    .filter((b) => !excluded.has(b.id) && (at.has(b.id) || b.status !== 'private'))
    .sort((a, b) => ((at.get(a.id) ?? END) - (at.get(b.id) ?? END)) || ((a.rank ?? 0) - (b.rank ?? 0)))
    .map((b) => {
      const d = badge.get(b.id);
      // Only a listed broker's badge is overridden — an unlisted one keeps the
      // badge its own preview carries.
      if (!d || !b.preview) return b;
      return {
        ...b,
        preview: {
          ...b.preview,
          badgeOn: d.badgeOn, badgeText: d.badgeText, badgeColor: d.badgeColor,
        },
      };
    });
}

/** Brokers an active campaign has never been told about — the count behind the
 *  "check the new broker's place in your campaigns" notification. */
export function campaignsNeedingBrokerReview(brokerIds, docs) {
  return docs.filter((doc) => {
    const known = new Set([...(doc.display ?? []).map((d) => d.brokerId), ...(doc.excluded ?? [])]);
    return brokerIds.some((id) => !known.has(id));
  }).length;
}

/* ---------------------------------------------------------------------
 * Row -> client shape
 * ------------------------------------------------------------------- */

// A row from q.users carries at most one review_queue link (link_broker_id);
// { approved: 'active', rejected: 'rejected', waiting: 'pending' } is the same
// map decideReview uses to turn a decision into a status.
const LINK_STATUS = { approved: 'active', rejected: 'rejected', waiting: 'pending' };
const toUser = (r) => ({
  id: r.id, name: r.name, plan: r.plan, email: r.link_email || r.email,
  brokerId: r.link_broker_account_id ?? r.broker_id, broker: r.link_broker_id ?? r.broker,
  userNo: r.user_no, telegramId: r.telegram_id ?? null,
  status: r.link_decision ? LINK_STATUS[r.link_decision] : r.status,
  // Every per-row field comes off the link when there is one: `users.email` /
  // `.status` / `.last_action_at` are one-per-account, so a user with three
  // broker links would otherwise show the same three cells on all three rows.
  lastActionAt: r.link_action_at ?? r.last_action_at ?? '—',
  totalRebate: r.live_total_rebate ?? r.total_rebate, lastMonthRebate: r.live_last_month_rebate ?? r.last_month_rebate,
  joinedAt: r.joined_at,
});

/** Which tab of the user timeline a ledger kind belongs under. */
const LEDGER_CATEGORY = {
  subscription: 'Subscription', grant: 'Subscription', expiry: 'Subscription',
  cashback: 'Cashback', referral: 'Referral', signup: 'Referral',
  withdrawal: 'Wallet', reminder: 'Campaign', campaign: 'Campaign',
};

/** One ledger row as a timeline entry. Non-money rows carry a null amount so
 *  the table renders an em dash rather than a misleading $0.00. */
const toLedgerRow = (r) => ({
  id: `l${r.id}`,
  at: fmtStamp(r.at),
  activity: r.detail || r.kind,
  category: LEDGER_CATEGORY[r.kind] ?? 'Subscription',
  amount: r.amount || null,
  signed: r.amount !== 0,
});

const toBroker = (r) => ({
  id: r.id, name: r.name, color: r.color, status: r.status, rank: r.rank,
  // Counted live off review_queue — the stored active_users/pending_users
  // columns are seed leftovers and 0 approved is a real answer, not a miss.
  activeUsers: r.live_active ?? 0,
  pendingUsers: r.live_pending ?? 0,
  totalUsers: r.live_users ?? 0,
  draftedPayment: r.drafted_payment, unreviewed: r.unreviewed,
  shareRate: r.share_rate, updatedAt: r.updated_at,
  // The logo lives in the preview doc, not its own column — pull it along so
  // list/detail rows can show it without a second fetch per broker.
  logoUrl: r.preview_doc ? JSON.parse(r.preview_doc).logoUrl : undefined,
});

const toFlowMessage = (r) => ({ key: r.key, title: r.title, from: r.from_state, chip: r.chip, message: r.message });

const toCycle = (r) => ({
  id: r.id, name: r.name, range: r.range_label, grossRebate: r.gross_rebate,
  sharedCashback: r.shared_cashback, netRevenue: r.net_revenue,
  cashbackUsers: r.cashback_users, publishedAt: r.published_at,
});

const toReview = (r) => ({
  id: r.id, userId: r.user_id, name: r.name, plan: r.plan, brokerId: r.broker_id,
  userNo: userNoOf(r.user_id),
  requestedAt: r.requested_at, email: r.email, brokerAccountId: r.broker_account_id,
  lastStatus: r.last_status,
});

const toRebate = (r) => ({
  userId: r.user_id, name: r.name, plan: r.plan, email: r.email, userNo: userNoOf(r.user_id),
  brokerAccountId: r.broker_account_id, totalRebate: r.total_rebate,
  lastWeekRebate: r.last_week_rebate, sharedRebate: r.shared_rebate,
});

const toDraft = (r) => ({
  ...toRebate(r),
  lastWeekRebate: r.last_week_rebate,
  sharedRebate: r.shared_rebate,
  actionDate: r.action_date,
});

/** Length of the term a subscriber is currently sitting in, in days: the span
 *  from the last purchase to the expiry. Falls back to the plan's catalogue
 *  length when either end is missing, and never reports less than what is
 *  still left (an admin day-grant extends the term without a new purchase). */
function totalDaysOf(sub) {
  const bought = sub.purchased_at ? wallMs(`${sub.purchased_at}T00:00`) ?? NaN : NaN;
  /* Floor, not round: `purchased_at` is a date (midnight), so the span runs a
     part-day long and rounding up would leave a brand-new term reading 90 of
     91 — a ring that is never quite full on the day you paid. */
  const span = sub.expires_at && Number.isFinite(bought)
    ? Math.floor((sub.expires_at - bought) / 86_400_000)
    : (PLAN_DAYS[sub.plan] ?? 30);
  const left = sub.expires_at == null
    ? (sub.days_left ?? 0)
    : Math.max(0, Math.ceil((sub.expires_at - Date.now()) / 86_400_000));
  return Math.max(1, span, left);
}

const toSubscriber = (r) => ({
  id: r.id, name: r.name, plan: r.plan, userNo: userNoOf(r.id), purchasedAt: r.purchased_at, lastActionAt: r.last_action_at,
  lastActionTime: r.last_action_time, daysLeft: r.days_left,
  totalPaid: r.total_paid, status: r.status,
});

/* Kept as a name the rest of the code already imports; the zone itself now
   lives in tz.mjs and is operator-settable. */
export const tehranMs = wallMs;

const ELIGIBLE_SQL = `FROM subscribers s LEFT JOIN users u ON u.id = s.id
  WHERE s.status = 'active' AND (? IS NULL OR COALESCE(
    (SELECT MAX(l.at) FROM ledger l WHERE l.user_id = s.id AND l.kind = 'subscription'),
    strftime('%s', s.purchased_at) * 1000) < ?)`;

const toGrant = (r) => ({
  id: r.id, addedAt: r.added_at, addedTime: r.added_time, extraDays: r.extra_days,
  eligibleBefore: r.eligible_before, eligibleTime: r.eligible_time, affected: r.affected,
});

const toEvent = (r) => ({ id: r.id, title: r.title, description: r.description, icon: r.icon, date: r.date });

const toReferralCampaign = (r) => ({
  /* Spread first, so the real columns below win. Without this the doc-only
     fields (the broker-display order/badges and the excluded-broker list) were
     written on save and then never read back, so reopening the campaign showed
     an empty editor — same contract as toCampaign. */
  ...JSON.parse(r.doc || '{}'),
  id: r.id, name: r.name, status: r.status, linkCode: r.link_code, invited: r.invited,
  planCount: r.plan_count, planTotal: r.plan_total,
  cashbackCount: r.cashback_count, cashbackTotal: r.cashback_total,
  revenue: round2(r.revenue), revenueShared: round2(r.revenue_shared),
  revenueNet: round2(r.revenue - r.revenue_shared),
  planShare: r.plan_share, cashbackShare: r.cashback_share,
  /* Derived, not stored: the columns were only ever written with the empty
     strings the editor sent, and the bot username can change under a campaign
     that outlives it. */
  websiteLink: r.link_code ? `${PUBLIC_URL}/?ref=${r.link_code}` : '',
  botLink: r.link_code && process.env.TF_BOT_USERNAME
    ? `https://t.me/${process.env.TF_BOT_USERNAME}?start=${r.link_code}` : '',
  endDate: r.end_date,
});

const toCampaign = (r) => ({ ...JSON.parse(r.doc), id: r.id, name: r.name, status: r.status });

const toSignal = (r) => ({
  id: r.id, period: r.period, range: r.range_label, total: r.total, sl: r.sl,
  tp1: r.tp1, tp2: r.tp2, tp3: r.tp3, tp4: r.tp4, status: r.status,
  publishedAt: r.published_at, publishedTime: r.published_time,
});

// node server/admin.mjs — renderTemplate is the one piece of this file with
// real logic that isn't a SQL statement; everything else is exercised by
// hitting the running admin API.
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  console.assert(renderTemplate('Hi {name}, {amount} due.', { name: 'Alex', amount: '$10' }) === 'Hi Alex, $10 due.',
    'known tokens substitute');
  console.assert(renderTemplate('Hi {name}.', {}) === 'Hi {name}.', 'unknown token is left as-is, not blanked');
  console.assert(renderTemplate(null, { a: 1 }) === '', 'no body renders as empty string, never throws');
  console.assert(new Set(MESSAGE_TEMPLATES.map((t) => t.key)).size === MESSAGE_TEMPLATES.length,
    'every message template key is unique');

  /* An empty token takes its line, and only its line — the whole reason
     Payment Confirmed is one message instead of six. */
  const lines = 'Paid: {amount}<br>Balance: {bal}<br>Link: {link}';
  console.assert(renderTemplate(lines, { amount: '$10', bal: '', link: 'x' }) === 'Paid: $10<br>Link: x',
    'an empty token drops its own line, the ones around it survive');
  console.assert(renderTemplate(lines, { amount: '$10', bal: '$2', link: '' }) === 'Paid: $10<br>Balance: $2',
    'a dropped last line leaves no dangling <br>');
  console.assert(renderTemplate('a\n{x}\nb', { x: '' }) === 'a\nb', '\\n splits lines too, not just <br>');
  console.assert(renderTemplate('Hi {name} — {gone}', { name: 'Alex', gone: '' }) === '',
    'a line is all-or-nothing: one empty token takes the filled tokens on that line with it');

  /* The campaign broker list: order, exclusion, private brokers, badges, and
     where a broker nobody has told the campaign about ends up. */
  const B = (id, status = 'public', rank = 0) => ({ id, status, rank, preview: { badgeOn: false, badgeText: '', badgeColor: '' } });
  const all = [B('a', 'public', 3), B('b', 'public', 1), B('c', 'private'), B('d', 'public', 2)];
  const doc = {
    display: [
      { brokerId: 'c', badgeOn: true, badgeText: 'Exclusive', badgeColor: '#144CCD' },
      { brokerId: 'a', badgeOn: false, badgeText: '', badgeColor: '' },
    ],
    excluded: ['b'],
  };
  const view = campaignBrokerList(all, doc);
  console.assert(view.map((b) => b.id).join(',') === 'c,a,d',
    'campaign order first, excluded gone, an unlisted broker last');
  console.assert(view[0].preview.badgeText === 'Exclusive', 'a listed private broker shows with its campaign badge');
  console.assert(campaignBrokerList(all, {}).map((b) => b.id).join(',') === 'b,d,a',
    'no display doc: public brokers by their own rank, private still hidden');
  console.assert(campaignsNeedingBrokerReview(['a', 'b', 'c', 'd'], [doc]) === 1,
    'a broker the campaign has never heard of needs a look');
  console.assert(campaignsNeedingBrokerReview(['a', 'b', 'c'], [doc]) === 0,
    'every broker either displayed or excluded is settled');

  console.log('admin.mjs: renderTemplate + campaign broker list ok');
}
