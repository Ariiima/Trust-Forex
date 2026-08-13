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
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { connect } from './sqlite.mjs';
import { PAYMENT_SCHEMA } from './db.mjs';
import { LEDGER_SCHEMA, openLedger, PLAN_DAYS, TIER_PCT } from './ledger.mjs';
import { CAMPAIGN_SCHEMA, openCampaigns } from './campaigns.mjs';

const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h; admins re-auth daily
const SCRYPT_KEYLEN = 64;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL,
  salt TEXT NOT NULL, hash TEXT NOT NULL, created_at INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token TEXT PRIMARY KEY, admin_id INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL, email TEXT,
  broker_id TEXT, status TEXT NOT NULL, last_action_at TEXT,
  total_rebate REAL, last_month_rebate REAL, joined_at TEXT,
  -- Which broker this account is registered with. The Recent-users table used
  -- to fabricate this column from the row index.
  broker TEXT);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

CREATE TABLE IF NOT EXISTS activity (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, at TEXT NOT NULL, activity TEXT NOT NULL,
  category TEXT NOT NULL, amount REAL, signed INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS idx_activity_user ON activity(user_id, category);

CREATE TABLE IF NOT EXISTS user_summary (
  user_id TEXT PRIMARY KEY, cashback_net REAL, cashback_sale REAL,
  ref_invited INTEGER, ref_active INTEGER, ref_plan REAL, ref_cashback REAL,
  ref_revenue REAL, ref_earnings REAL);

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

CREATE TABLE IF NOT EXISTS referral_rows (
  id TEXT PRIMARY KEY, name TEXT, plan TEXT, invited INTEGER,
  plan_count INTEGER, plan_pct REAL, cashback_count INTEGER, cashback_pct REAL,
  revenue REAL, revenue_shared REAL, revenue_net REAL);

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

-- Chart data at its finest grain: one row per (dataset, dimension, day). The
-- dimension is what the on-chart filters select (a broker id, a plan, a referral
-- campaign); every coarser view is aggregated from these rows at read time, so a
-- filter or a granularity change is a real query rather than a relabelled chart.
CREATE TABLE IF NOT EXISTS series (
  name TEXT NOT NULL, dim TEXT NOT NULL, day TEXT NOT NULL, vals TEXT NOT NULL,
  PRIMARY KEY (name, dim, day));
CREATE INDEX IF NOT EXISTS idx_series_range ON series(name, day);

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

function cookieValue(req, name) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim();
  }
  return null;
}


/* ---------------------------------------------------------------------
 * Chart aggregation
 *
 * Every dataset is stored per day per dimension. Rolling that up correctly
 * needs three distinct rules, and getting them wrong is what makes a dashboard
 * quietly lie:
 *
 *   stocks  — a level (users on the books). Sums ACROSS dimensions, but takes
 *             the LAST day ACROSS time. Adding Monday's headcount to Tuesday's
 *             would report double the users.
 *   flows   — an amount accrued in a period (revenue, renewals). Sums across
 *             both.
 *   ratios  — never averaged. Percentages are recomputed from their own
 *             numerator and denominator after those have been aggregated,
 *             because the mean of daily rates is not the rate of the period.
 * ------------------------------------------------------------------- */

const SERIES_SPEC = {
  broker: {
    stocks: ['activeUsers', 'pendingUsers', 'cashbackUsers'],
    flows: ['grossRebate', 'sharedCashback', 'netRevenue'],
    ratios: {},
  },
  subscription: {
    stocks: ['totalSubscribers'],
    flows: ['renewals', 'reactivations', 'netRevenue', 'renewalsDue', 'lapsed'],
    ratios: { renewalRate: ['renewals', 'renewalsDue'], reactivationRate: ['reactivations', 'lapsed'] },
    // Denominators the chart never plots on their own.
    internal: ['renewalsDue', 'lapsed'],
  },
  /* The referral funnel, in the order it actually happens:
       introduced  — people whose own referral link has brought in at least one
                     user. They are referrers, not referrals.
       invited     — everyone those referrers brought in. Always the larger of
                     the two: one referrer accounts for several invitees.
       activeUsers — the invited accounts that are actually active.
     Plan and Cashback are shares of ACTIVE users, not of invited: an account
     that never activated cannot have bought a plan, so counting it in the
     denominator understates conversion for every campaign equally.

     Both conversions are STOCKS, like the denominator they divide by. "How
     many active users hold a plan" is a count at a moment, not something that
     accrues — as a flow it summed a week of daily counts over a single day's
     active users and reported rates in the hundreds of percent. A ratio is
     only meaningful when both sides aggregate the same way. */
  referral: {
    stocks: ['introduced', 'invited', 'activeUsers', 'planConversions', 'cashbackConversions'],
    flows: ['revenue', 'revenueShared', 'revenueNet'],
    ratios: {
      planRate: ['planConversions', 'activeUsers'],
      cashbackRate: ['cashbackConversions', 'activeUsers'],
    },
    internal: ['planConversions', 'cashbackConversions'],
  },
  'signal-spark': { stocks: [], flows: ['value'], ratios: {} },
};

export const seriesNames = () => Object.keys(SERIES_SPEC);

/** The four states "Manage user flow → Status message" edits, seeded for every
 *  broker so the tab never opens empty. An admin still has to write the real
 *  copy; this is only the scaffolding the four icons render against. */
const FLOW_DEFAULTS = [
  {
    key: 'rejected', title: 'Registration Rejected', from: 'Sent when a registration request is declined',
    chip: 'rejected', message: 'Hi {name}, we could not approve your registration with {broker}. Please double-check your details and try again.',
  },
  {
    key: 'waiting-deposit', title: 'Waiting for Deposit', from: 'Sent when registration is approved and a deposit is required',
    chip: 'waiting', message: 'Hi {name}, your registration with {broker} is approved. Make your first deposit to start earning cashback.',
  },
  {
    key: 'rejected-deposit', title: 'Deposit Rejected', from: 'Sent when a submitted deposit fails review',
    chip: 'rejected', message: 'Hi {name}, we could not verify your deposit with {broker}. Please check the amount and try again.',
  },
  {
    key: 'approved', title: 'Approved', from: 'Sent when registration and deposit are both approved',
    chip: 'approved', message: "Hi {name}, you're all set! Your account with {broker} is active and earning cashback.",
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
    key: 'payment_confirmed', name: 'Payment Confirmed', group: 'Payments',
    hint: "Sent the instant an order's payment is confirmed on-chain.",
    vars: ['plan', 'amount', 'currency'],
    body: 'Payment confirmed — <b>{plan}</b> is active.\n{amount} received in {currency}.',
  },
  {
    key: 'payment_partial_refund', name: 'Order Expired — Partial Refund', group: 'Payments',
    hint: 'Sent when an order expires after a partial payment; the amount paid is credited to earning balance.',
    vars: ['amount'],
    body: 'Your order expired with a partial payment.\n{amount} was added to your earning balance in the app.',
  },
  {
    key: 'payment_incomplete', name: 'Payment Incomplete', group: 'Payments',
    hint: 'Sent when an on-chain transfer arrives short of the order total.',
    vars: ['received', 'due', 'remaining', 'currency', 'network', 'address'],
    body: '⚠️ Payment incomplete — we received <b>{received} {currency}</b> of {due} {currency}.\n'
      + 'Send the remaining <b>{remaining} {currency}</b> ({network}) to:\n<code>{address}</code>\n'
      + 'or reopen the app to continue your order.',
  },
  {
    key: 'subscription_reminder', name: 'Expiry Reminder', group: 'Subscription',
    hint: 'Sent 3 days before a subscription ends.',
    vars: ['plan', 'days'],
    body: 'Your <b>{plan}</b> subscription ends in {days}.\nRenew to keep VIP signal access and your cashback tier.',
  },
  {
    key: 'subscription_lapsed', name: 'Subscription Lapsed', group: 'Subscription',
    hint: "Sent the moment a subscription's term ends and access is revoked.",
    vars: ['plan'],
    body: 'Your <b>{plan}</b> subscription has ended. Your cashback and referral share are back to the 10% base rate until you renew.',
  },
  {
    key: 'withdrawal_sent', name: 'Withdrawal Sent', group: 'Withdrawals',
    hint: 'Sent once a withdrawal is broadcast on-chain.',
    vars: ['amount', 'currency', 'network', 'txid'],
    body: '✅ Withdrawal sent — {amount} {currency} ({network})\ntx {txid}',
  },
  {
    key: 'withdrawal_manual', name: 'Withdrawal Processing Manually', group: 'Withdrawals',
    hint: 'Sent when a withdrawal is parked for manual review — over caps, an RPC error, or a crash mid-send.',
    vars: [],
    body: 'Your withdrawal is being processed manually — you will be notified when it is sent.',
  },
];

/** {token} substitution, unknown tokens left as-is so a typo shows rather than
 *  vanishes. Pure — no db, no admin.mjs state — so every send site can import
 *  it without opening a connection, which matters for the ones under test. */
export function renderTemplate(body, vars = {}) {
  return String(body ?? '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How many days a full bucket holds, used to spot a partial one. */
const GRAIN_DAYS = { daily: 1, weekly: 7, cycle: 7, monthly: 28, quarterly: 90 };

export const GRAINS = Object.keys(GRAIN_DAYS);

/** Bucket key + human label for a YYYY-MM-DD day at the requested grain. */
function bucketOf(day, grain) {
  const [y, m, d] = day.split('-').map(Number);
  if (grain === 'monthly') return { key: `${y}-${m}`, label: `${MONTHS[m - 1]} ${y}` };
  if (grain === 'daily') return { key: day, label: `${MONTHS[m - 1]} ${d}` };
  if (grain === 'quarterly') {
    const quarter = Math.floor((m - 1) / 3) + 1;
    return { key: `${y}-Q${quarter}`, label: `Q${quarter} ${y}` };
  }

  // Weekly and cycle both snap back to the Monday that owns this day: a
  // cashback payout cycle IS one Monday-to-Sunday week. They differ only in
  // how the bucket is named — a cycle is read as the span it paid out for,
  // so it carries both ends rather than just its first day.
  const date = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const key = monday.toISOString().slice(0, 10);
  if (grain !== 'cycle') {
    return { key, label: `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()}` };
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const end = monday.getUTCMonth() === sunday.getUTCMonth()
    ? `${sunday.getUTCDate()}`
    : `${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}`;
  return { key, label: `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()}–${end}` };
}

/**
 * Roll stored day rows into chart points.
 * `rows` must already be filtered to the wanted dimensions and date range.
 */
function aggregate(name, rows, grain) {
  const spec = SERIES_SPEC[name];
  if (!spec) return [];
  const measures = [...spec.stocks, ...spec.flows];

  // 1. Collapse dimensions: same day, different brokers -> one day.
  const days = new Map();
  for (const row of rows) {
    const vals = JSON.parse(row.vals);
    const day = days.get(row.day) ?? Object.fromEntries(measures.map((k) => [k, 0]));
    for (const k of measures) day[k] += vals[k] ?? 0;
    days.set(row.day, day);
  }

  // 2. Collapse days into buckets: flows accumulate, stocks take the last day.
  //    `size` tracks how many days landed in each bucket so a partial one can
  //    be recognised in step 3.
  const buckets = new Map();
  for (const day of [...days.keys()].sort()) {
    const { key, label } = bucketOf(day, grain);
    const bucket = buckets.get(key)
      ?? { label, _days: 0, ...Object.fromEntries(measures.map((k) => [k, 0])) };
    bucket._days += 1;
    for (const k of spec.flows) bucket[k] += days.get(day)[k];
    for (const k of spec.stocks) bucket[k] = days.get(day)[k];
    buckets.set(key, bucket);
  }

  // Drop a leading or trailing bucket that only caught part of its period.
  // A week holding two days of revenue is not a low week, it is an artefact of
  // where the range happens to start, and plotting it reads as a crash.
  const ordered = [...buckets.values()];
  const full = GRAIN_DAYS[grain] ?? 7;
  while (ordered.length > 1 && ordered[0]._days < full) ordered.shift();
  while (ordered.length > 1 && ordered[ordered.length - 1]._days < full) ordered.pop();

  // 3. Derive ratios from the aggregated components, then drop the internals.
  //    Money is rounded here, once: summing 120 daily floats otherwise surfaces
  //    as $4827.160000000001 in a tooltip.
  return ordered.map((bucket) => {
    const point = { label: bucket.label };
    for (const k of measures) point[k] = Math.round(bucket[k] * 100) / 100;
    for (const [key, [num, den]] of Object.entries(spec.ratios)) {
      point[key] = bucket[den] ? Number(((bucket[num] / bucket[den]) * 100).toFixed(1)) : 0;
    }
    for (const k of spec.internal ?? []) delete point[k];
    return point;
  });
}

/* ---------------------------------------------------------------------
 * Store
 * ------------------------------------------------------------------- */

export function openAdminDb(path) {
  const db = connect(path);
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

  // Every statement compiled once, at open.
  const q = {
    adminByName: db.prepare('SELECT * FROM admins WHERE username = ?'),
    insertAdmin: db.prepare('INSERT OR REPLACE INTO admins (username, salt, hash, created_at) VALUES (?, ?, ?, ?)'),
    insertSession: db.prepare('INSERT INTO admin_sessions (token, admin_id, expires_at) VALUES (?, ?, ?)'),
    session: db.prepare(`SELECT s.admin_id, s.expires_at, a.username FROM admin_sessions s
      JOIN admins a ON a.id = s.admin_id WHERE s.token = ?`),
    deleteSession: db.prepare('DELETE FROM admin_sessions WHERE token = ?'),
    sweepSessions: db.prepare('DELETE FROM admin_sessions WHERE expires_at < ?'),

    users: db.prepare('SELECT * FROM users ORDER BY rowid'),
    user: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByTelegram: db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    /* Per-user lookups for the Mini App. The admin's own screens read these
       tables whole (one page, every user); a Mini App request only ever wants
       its own row, so these are indexed reads rather than a filter over all(). */
    subscriber: db.prepare('SELECT * FROM subscribers WHERE id = ?'),
    myRebates: db.prepare('SELECT * FROM rebates WHERE user_id = ?'),
    myReviews: db.prepare('SELECT * FROM review_queue WHERE user_id = ? ORDER BY rowid'),
    myReferralRow: db.prepare('SELECT * FROM referral_rows WHERE id = ?'),
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
    activity: db.prepare('SELECT * FROM activity WHERE user_id = ? ORDER BY rowid'),
    summary: db.prepare('SELECT * FROM user_summary WHERE user_id = ?'),

    // drafted_payment / unreviewed are counted here rather than stored, so the
    // card can never drift from the tables it summarises.
    brokers: db.prepare(`SELECT b.*,
        (SELECT COUNT(*) FROM rebate_drafts d WHERE d.broker_id = b.id) AS drafted_payment,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision IS NULL) AS unreviewed,
        -- Headcounts are counted, not stored, for the same reason as the two
        -- above: a card that disagrees with the table under it is a bug report.
        (SELECT COUNT(*) FROM rebates rb WHERE rb.broker_id = b.id) AS live_active,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision IS NULL) AS live_pending
      FROM brokers b ORDER BY (b.rank IS NULL), b.rank, b.rowid`),
    broker: db.prepare(`SELECT b.*,
        (SELECT COUNT(*) FROM rebate_drafts d WHERE d.broker_id = b.id) AS drafted_payment,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision IS NULL) AS unreviewed,
        -- Headcounts are counted, not stored, for the same reason as the two
        -- above: a card that disagrees with the table under it is a bug report.
        (SELECT COUNT(*) FROM rebates rb WHERE rb.broker_id = b.id) AS live_active,
        (SELECT COUNT(*) FROM review_queue r WHERE r.broker_id = b.id AND r.decision IS NULL) AS live_pending
      FROM brokers b WHERE b.id = ?`),
    insertBroker: db.prepare(`INSERT INTO brokers
      (id, name, color, status, rank, active_users, pending_users, share_rate, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`),
    maxRank: db.prepare('SELECT COALESCE(MAX(rank), 0) AS n FROM brokers'),
    // `brokers` here is "brokers with money to publish", not the platform's
    // broker count — this bar exists to answer "is there anything to pay out",
    // and a broker sitting at zero drafts is not part of that answer.
    brokerTotals: db.prepare(`SELECT
      (SELECT COALESCE(SUM(total_rebate), 0) FROM rebates) AS total_rebate,
      (SELECT COALESCE(SUM(shared_rebate), 0) FROM rebate_drafts) AS drafted,
      (SELECT COUNT(DISTINCT broker_id) FROM rebate_drafts) AS brokers`),
    setBrokerOrder: db.prepare('UPDATE brokers SET rank = ?, status = ? WHERE id = ?'),
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

    cycles: db.prepare('SELECT * FROM cashback_cycles ORDER BY rowid'),
    reviewQueue: db.prepare("SELECT * FROM review_queue WHERE decision IS NULL ORDER BY rowid"),
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
    // Eligibility is the whole point of the "purchased before" field.
    eligibleCount: db.prepare(`SELECT COUNT(*) AS n FROM subscribers
      WHERE status = 'active' AND (? = '' OR purchased_at <= ?)`),
    eligibleIds: db.prepare(`SELECT id FROM subscribers
      WHERE status = 'active' AND (? = '' OR purchased_at <= ?)`),

    events: db.prepare('SELECT * FROM events ORDER BY created_at DESC'),
    insertEvent: db.prepare('INSERT INTO events (id, title, description, icon, date, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    updateEvent: db.prepare('UPDATE events SET title = ?, description = ?, icon = ?, date = ? WHERE id = ?'),
    deleteEvent: db.prepare('DELETE FROM events WHERE id = ?'),

    referralRows: db.prepare(`SELECT r.*, u.user_no FROM referral_rows r
      LEFT JOIN users u ON u.id = r.id ORDER BY r.invited DESC`),
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
    referralCampaigns: db.prepare('SELECT * FROM referral_campaigns ORDER BY rowid'),
    insertReferralCampaign: db.prepare(`INSERT INTO referral_campaigns
      (id, name, status, link_code, invited, plan_count, plan_total, cashback_count, cashback_total,
       revenue, revenue_shared, revenue_net, plan_share, cashback_share, website_link, bot_link, end_date, doc)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?, ?, ?)`),
    setReferralCampaignStatus: db.prepare('UPDATE referral_campaigns SET status = ? WHERE id = ?'),
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

    seriesRows: db.prepare(`SELECT dim, day, vals FROM series
      WHERE name = ? AND day >= ? AND day <= ? ORDER BY day`),
    seriesDims: db.prepare('SELECT DISTINCT dim FROM series WHERE name = ? ORDER BY dim'),
    setSeries: db.prepare('INSERT OR REPLACE INTO series (name, dim, day, vals) VALUES (?, ?, ?, ?)'),

    messageTemplateRow: db.prepare('SELECT * FROM message_templates WHERE key = ?'),
    insertMessageTemplate: db.prepare('INSERT OR IGNORE INTO message_templates (key, body, updated_at) VALUES (?, ?, ?)'),
    upsertMessageTemplate: db.prepare(`INSERT INTO message_templates (key, body, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET body = excluded.body, updated_at = excluded.updated_at`),
  };

  const nowMs = () => Date.now();
  /** Stamp a launch: last_seen for the "active in the last N days" snapshots,
   *  daily_actives for the day-by-day trend. Called on every ensureUser(). */
  const touchActivity = (userId, now = nowMs()) => {
    q.touchLastSeen.run(now, userId);
    q.markDailyActive.run(new Date(now).toISOString().slice(0, 10), userId);
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

  // Same idea for the bot's transactional messages: INSERT OR IGNORE so a
  // template an admin has already edited is never overwritten by a restart,
  // and a template added to MESSAGE_TEMPLATES later still shows up seeded.
  for (const t of MESSAGE_TEMPLATES) q.insertMessageTemplate.run(t.key, t.body, nowMs());

  return {
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

    /** Session row for a request, or null when absent/expired. */
    sessionFor(req) {
      const token = cookieValue(req, 'tf_admin');
      if (!token) return null;
      const row = q.session.get(token);
      if (!row) return null;
      if (row.expires_at < nowMs()) {
        q.deleteSession.run(token);
        return null;
      }
      return { token, adminId: row.admin_id, username: row.username };
    },

    /* ---- reads ---- */

    users: () => q.users.all().map(toUser),

    /**
     * Every per-user figure, derived from the ledger.
     *
     * ponytail: falls back to the seeded `user_summary` row for a user who has
     * no ledger history at all, so the demo data still renders. Delete the
     * fallback — and the table — once seed.mjs writes ledger rows.
     */
    booksFor(id) {
      const l = ledger.summaryFor(id);
      if (l.hasLedger) return l;
      const s = q.summary.get(id);
      if (!s) return l;
      return {
        ...l,
        cashbackNet: s.cashback_net ?? 0,
        cashbackPaid: s.cashback_sale ?? 0,
        refInvited: s.ref_invited ?? 0,
        refActive: s.ref_active ?? 0,
        refRevenue: s.ref_revenue ?? 0,
        refEarnings: s.ref_earnings ?? 0,
      };
    },

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
        /* The timeline the walkthrough asked to simplify: one row per real
           state change, straight off the ledger, instead of the generated
           activity feed. Falls back to `activity` for seeded users. */
        activity: (() => {
          const rows = ledger.timeline(id);
          return rows.length ? rows.map(toLedgerRow) : q.activity.all(id).map(toActivity);
        })(),
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
      q.insertTelegramUser.run(id, name, tg.id, new Date().toISOString().slice(0, 10));
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
      const ref = q.myReferralRow.get(id);
      const now = Date.now();
      const tier = ledger.tierOf(id, now);
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
          conversion: ref ? { planPct: ref.plan_pct, cashbackPct: ref.cashback_pct } : null,
        },
        /** One entry per broker this user has any relationship with. */
        brokers: [
          ...q.myRebates.all(id).map((r) => ({
            brokerId: r.broker_id, state: 'cashback-active',
            brokerAccountId: r.broker_account_id, email: r.email,
            totalRebate: r.total_rebate, sharedRebate: r.shared_rebate,
          })),
          // A row still in the review queue outranks nothing — it is a broker
          // the user has submitted but that has no rebates yet. An 'approved'
          // row is skipped: approval created the rebates row above, which is
          // the live relationship. last_status carries the phase — a queue row
          // whose last status is a Deposit one is past account verification.
          ...q.myReviews.all(id).filter((r) => r.decision !== 'approved').map((r) => {
            const depositPhase = (r.last_status ?? '').startsWith('Deposit');
            const state = r.decision == null
              ? (depositPhase ? 'deposit-review' : 'pending')
              : r.decision === 'waiting' ? 'waiting-for-deposit'
                // A rejected deposit goes back to "make a deposit", not to the
                // resubmit-account path — the account itself already passed.
                : depositPhase ? 'waiting-for-deposit' : 'rejected';
            return {
              brokerId: r.broker_id, state,
              brokerAccountId: r.broker_account_id, email: r.email,
              lastStatus: r.last_status, requestedAt: r.requested_at,
            };
          }),
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
      const from = new Date(now - (trendDays - 1) * DAY).toISOString().slice(0, 10);
      const byDay = new Map(q.dailyActiveCounts.all(from).map((r) => [r.day, r.n]));
      const daily = [];
      for (let i = trendDays - 1; i >= 0; i -= 1) {
        const day = new Date(now - i * DAY).toISOString().slice(0, 10);
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
      q.insertBroker.run(id, name, color, status, rank, shareRate, new Date().toISOString().slice(0, 10));
      seedFlowMessages(id);
      return toBroker(q.broker.get(id));
    },
    /**
     * Full delete, not a status change. Refuses a broker that still has any
     * live relationship — active/pending users or an undrafted payout — so
     * deleting never silently orphans rebate history; stop it first (status
     * 'stopped') to wind those down, then delete once it's actually empty.
     * Returns 'ok' | 'in_use' | 'not_found'.
     */
    deleteBroker(id) {
      const b = q.broker.get(id);
      if (!b) return 'not_found';
      if (b.live_active > 0 || b.live_pending > 0 || b.drafted_payment > 0) return 'in_use';
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
        for (const { id, status } of order) {
          q.setBrokerOrder.run(status === 'public' ? ++rank : null, status, id);
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
    setPreview: (brokerId, doc) => q.setPreview.run(brokerId, JSON.stringify(doc)),

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

    /** Money leaving the platform, newest first — the payout worklist. */
    withdrawals: () => q.withdrawals.all().map((r) => ({
      id: `l${r.id}`, userId: r.user_id, name: r.name,
      at: new Date(r.at).toISOString().slice(0, 16).replace('T', ' · '),
      amount: Math.abs(r.amount), detail: r.detail,
    })),

    /** Money arriving. Reads `orders` directly — one file, so no bridge. */
    payments: () => q.payments.all().map((r) => ({
      id: r.id, userId: r.user_id, username: r.username, planId: r.plan_id,
      amountUsd: r.amount_usd, currency: r.currency, network: r.network,
      txid: r.txid, status: r.status,
      confirmedAt: r.confirmed_at ? new Date(r.confirmed_at).toISOString().slice(0, 16).replace('T', ' · ') : null,
      booked: r.booked === 1,
    })),

    cycles: () => q.cycles.all().map(toCycle),
    reviewQueue: () => q.reviewQueue.all().map(toReview),

    /**
     * The Mini App's "Submit account" — a broker-account verification request.
     * Creates the queue row on first submit; a rejected row re-enters the
     * queue with the corrected details. Returns 'ok' | 'active' (already
     * earning cashback) | 'pending' (already under review / account already
     * verified) | 'missing_account' (first submit needs the broker user id).
     */
    submitBrokerRequest({ userId, brokerId, email, brokerAccountId }) {
      if (q.rebate.get(brokerId, userId)) return 'active';
      const existing = q.reviewByUserBroker.get(userId, brokerId);
      if (existing && existing.decision !== 'rejected') return 'pending';
      const at = new Date(nowMs()).toISOString().slice(0, 16).replace('T', ' · ');
      db.exec('BEGIN');
      try {
        if (existing) {
          const last = (existing.last_status ?? '').startsWith('Deposit')
            ? 'Deposit rejected' : 'Registration rejected';
          q.reopenReview.run(email, brokerAccountId || existing.broker_account_id, at, last, existing.id);
        } else {
          if (!brokerAccountId) { db.exec('ROLLBACK'); return 'missing_account'; }
          const user = q.user.get(userId);
          q.insertReview.run(`rv${randomBytes(4).toString('hex')}`, userId,
            user?.name ?? userId, user?.plan ?? 'none', brokerId, at, email, brokerAccountId, 'No account');
        }
        q.setUserBrokerContact.run(email, brokerId, at, userId);
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
      if (q.rebate.get(brokerId, userId)) return 'active';
      const row = q.reviewByUserBroker.get(userId, brokerId);
      if (!row) return 'not_found';
      const depositPhase = (row.last_status ?? '').startsWith('Deposit');
      const from = row.decision === 'waiting' ? 'Deposit required'
        : row.decision === 'rejected' && depositPhase ? 'Deposit rejected'
          : null;
      if (!from) return row.decision == null ? 'pending' : 'not_found';
      const at = new Date(nowMs()).toISOString().slice(0, 16).replace('T', ' · ');
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
      db.exec('BEGIN');
      try {
        q.setDecision.run(decision, id);
        if (row.user_id) {
          q.setUserStatus.run(status, row.user_id);
          /* An approval also opens the cashback relationship: without a
             `rebates` row there is nothing to draft a weekly rebate against,
             so the user would be "approved" and permanently unpayable. */
          if (decision === 'approved') {
            q.ensureRebate.run(row.broker_id, row.user_id, row.name, row.plan, row.email, row.broker_account_id);
          }
          ledger.append({
            userId: row.user_id, kind: 'cashback', amount: 0, revenue: 0,
            brokerId: row.broker_id, key: `review:${id}:${decision}`,
            detail: `Broker request ${decision}`,
          });
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      const flowKey = decision === 'approved' ? 'approved'
        : decision === 'waiting' ? 'waiting-deposit'
          : (row.last_status ?? '').startsWith('Deposit') ? 'rejected-deposit' : 'rejected';
      return {
        flowKey,
        telegramId: row.user_id ? q.user.get(row.user_id)?.telegram_id ?? null : null,
        userName: row.name, brokerId: row.broker_id,
        brokerName: q.broker.get(row.broker_id)?.name ?? row.broker_id,
      };
    },

    rebates: (brokerId) => q.rebates.all(brokerId).map(toRebate),
    drafts: (brokerId) => q.drafts.all(brokerId).map(toDraft),
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
      const now = new Date();
      const actionDate = `${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
        + ` · ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      q.upsertDraft.run(brokerId, userId, lastWeekRebate, shared, actionDate);
      return {
        ...toRebate(base), lastWeekRebate, sharedRebate: shared, actionDate,
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
    /**
     * Bulk extra days. The frames only recorded the grant; this applies it —
     * every eligible subscriber's expiry moves and each one gets a ledger row,
     * so the grant shows up in their timeline and in the days-left column.
     * Returns the recipients so the caller can send the custom message.
     */
    addGrant(grant) {
      const id = `g${randomBytes(6).toString('hex')}`;
      const before = grant.purchasedBefore ?? '';
      const eligible = q.eligibleIds.all(before, before);
      const note = `+${grant.extraDays} days (bulk grant)`;
      db.exec('BEGIN');
      try {
        for (const row of eligible) ledger.grantDays(row.id, grant.extraDays, note);
        q.insertGrant.run(
          id, grant.addedAt, grant.addedTime, grant.extraDays,
          grant.eligibleBefore, grant.eligibleTime, eligible.length,
          grant.message ?? '', grant.notify ? 1 : 0, nowMs(),
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { id, ...grant, affected: eligible.length, recipients: eligible.map((r) => r.id) };
    },

    events: () => q.events.all().map(toEvent),
    addEvent(event) {
      const id = `e${randomBytes(6).toString('hex')}`;
      q.insertEvent.run(id, event.title, event.description ?? '', event.icon ?? 'info', event.date ?? '', nowMs());
      return { id, ...event };
    },
    updateEvent: (id, e) => q.updateEvent.run(e.title, e.description ?? '', e.icon ?? 'info', e.date ?? '', id).changes > 0,
    deleteEvent: (id) => q.deleteEvent.run(id).changes > 0,

    /** ponytail: seeded `referral_rows` are the fallback while no real
     *  attribution exists yet. Drop the table once the seed writes users. */
    referralRows() {
      const live = q.liveReferralRows.all();
      if (!live.length) return q.referralRows.all().map(toReferralRow);
      const round2 = (n) => Math.round(n * 100) / 100;
      const pct = (n, d) => (d ? Number(((n / d) * 100).toFixed(1)) : 0);
      return live.map((r) => ({
        id: r.id, name: r.name, plan: r.plan, userNo: r.user_no, invited: r.invited,
        planCount: r.plan_count, planPct: pct(r.plan_count, r.invited),
        cashbackCount: r.cashback_count, cashbackPct: pct(r.cashback_count, r.invited),
        revenue: round2(r.revenue),
        revenueShared: round2(r.revenue_shared),
        revenueNet: round2(r.revenue - r.revenue_shared),
      }));
    },
    referralCampaigns: () => q.referralCampaigns.all().map(toReferralCampaign),
    addReferralCampaign(c) {
      const id = `rc${randomBytes(6).toString('hex')}`;
      q.insertReferralCampaign.run(
        id, c.name, 'active', c.linkCode ?? null,
        c.planShare ?? 0, c.cashbackShare ?? 0,
        c.websiteLink ?? '', c.botLink ?? '', c.endDate ?? '',
        // The whole record, same as addCampaign. `c.doc` only ever existed as a
        // nested property nothing sent, so every field without a column of its
        // own — the broker display order, the excluded list — was dropped here.
        JSON.stringify(c),
      );
      return { id, ...c, status: 'active' };
    },
    setReferralCampaignStatus: (id, status) => q.setReferralCampaignStatus.run(status, id).changes > 0,
    updateReferralCampaign(id, c) {
      return q.updateReferralCampaign.run(
        c.name, c.linkCode ?? null, c.planShare ?? 0, c.cashbackShare ?? 0,
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

    seriesDims: (name) => q.seriesDims.all(name).map((r) => r.dim),
    /**
     * @param dims  dimension ids to include; empty/omitted means all of them
     * @param from/to  YYYY-MM-DD, inclusive
     * @param grain  'daily' | 'weekly' | 'monthly'
     */
    series(name, { dims, from = '0000-00-00', to = '9999-99-99', grain = 'weekly' } = {}) {
      let rows = q.seriesRows.all(name, from, to);
      if (dims?.length) {
        const wanted = new Set(dims);
        rows = rows.filter((r) => wanted.has(r.dim));
      }
      return aggregate(name, rows, grain);
    },
    setSeries(name, dim, points) {
      db.exec('BEGIN');
      try {
        for (const { day, ...values } of points) q.setSeries.run(name, dim, day, JSON.stringify(values));
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

/* ---------------------------------------------------------------------
 * Row -> client shape
 * ------------------------------------------------------------------- */

const toUser = (r) => ({
  id: r.id, name: r.name, plan: r.plan, email: r.email, brokerId: r.broker_id, broker: r.broker,
  userNo: r.user_no, telegramId: r.telegram_id ?? null,
  status: r.status, lastActionAt: r.last_action_at || '—',
  totalRebate: r.total_rebate, lastMonthRebate: r.last_month_rebate, joinedAt: r.joined_at,
});

const toActivity = (r) => ({
  id: r.id, at: r.at, activity: r.activity, category: r.category,
  amount: r.amount, signed: r.signed === 1,
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
  at: new Date(r.at).toISOString().slice(0, 16).replace('T', ' · '),
  activity: r.detail || r.kind,
  category: LEDGER_CATEGORY[r.kind] ?? 'Subscription',
  amount: r.amount || null,
  signed: r.amount !== 0,
});

const toBroker = (r) => ({
  id: r.id, name: r.name, color: r.color, status: r.status, rank: r.rank,
  // Live counts win; the stored columns only still answer for seeded brokers
  // that have no rebate or queue rows of their own yet.
  activeUsers: r.live_active || r.active_users || 0,
  pendingUsers: r.live_pending || r.pending_users || 0,
  draftedPayment: r.drafted_payment, unreviewed: r.unreviewed,
  shareRate: r.share_rate, updatedAt: r.updated_at,
});

const toFlowMessage = (r) => ({ key: r.key, title: r.title, from: r.from_state, chip: r.chip, message: r.message });

const toCycle = (r) => ({
  id: r.id, name: r.name, range: r.range_label, grossRebate: r.gross_rebate,
  sharedCashback: r.shared_cashback, netRevenue: r.net_revenue,
  cashbackUsers: r.cashback_users, publishedAt: r.published_at,
});

const toReview = (r) => ({
  id: r.id, userId: r.user_id, name: r.name, plan: r.plan, brokerId: r.broker_id,
  requestedAt: r.requested_at, email: r.email, brokerAccountId: r.broker_account_id,
  lastStatus: r.last_status,
});

const toRebate = (r) => ({
  userId: r.user_id, name: r.name, plan: r.plan, email: r.email,
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
  const bought = sub.purchased_at ? Date.parse(`${sub.purchased_at}T00:00:00Z`) : NaN;
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
  id: r.id, name: r.name, plan: r.plan, purchasedAt: r.purchased_at, lastActionAt: r.last_action_at,
  lastActionTime: r.last_action_time, daysLeft: r.days_left,
  totalPaid: r.total_paid, status: r.status,
});

const toGrant = (r) => ({
  id: r.id, addedAt: r.added_at, addedTime: r.added_time, extraDays: r.extra_days,
  eligibleBefore: r.eligible_before, eligibleTime: r.eligible_time, affected: r.affected,
});

const toEvent = (r) => ({ id: r.id, title: r.title, description: r.description, icon: r.icon, date: r.date });

const toReferralRow = (r) => ({
  id: r.id, name: r.name, plan: r.plan, userNo: r.user_no, invited: r.invited,
  planCount: r.plan_count, planPct: r.plan_pct,
  cashbackCount: r.cashback_count, cashbackPct: r.cashback_pct,
  revenue: r.revenue, revenueShared: r.revenue_shared, revenueNet: r.revenue_net,
});

const toReferralCampaign = (r) => ({
  /* Spread first, so the real columns below win. Without this the doc-only
     fields (the broker-display order/badges and the excluded-broker list) were
     written on save and then never read back, so reopening the campaign showed
     an empty editor — same contract as toCampaign. */
  ...JSON.parse(r.doc || '{}'),
  id: r.id, name: r.name, status: r.status, linkCode: r.link_code, invited: r.invited,
  planCount: r.plan_count, planTotal: r.plan_total,
  cashbackCount: r.cashback_count, cashbackTotal: r.cashback_total,
  revenue: r.revenue, revenueShared: r.revenue_shared, revenueNet: r.revenue_net,
  planShare: r.plan_share, cashbackShare: r.cashback_share,
  websiteLink: r.website_link, botLink: r.bot_link, endDate: r.end_date,
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
  console.log('admin.mjs: renderTemplate ok');
}
