// Trust Forex payment DB — node:sqlite. Schema is CONTRACT-exact; the watcher
// cluster codes against it literally. All timestamps are epoch MILLISECONDS.
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY, user_id INTEGER, username TEXT, plan_id TEXT NOT NULL, billing TEXT NOT NULL,
  amount_usd REAL NOT NULL, currency TEXT, network TEXT, amount_crypto TEXT, address TEXT, memo TEXT,
  status TEXT NOT NULL DEFAULT 'pending', txid TEXT, confirmations INTEGER DEFAULT 0,
  detected_at INTEGER, confirmed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS seen_txs (txid TEXT PRIMARY KEY, order_id TEXT);
-- One row per (user, flag) the user has "used up" — currently the once-only
-- referral/cashback preview pages. Server-side so it survives reinstalls and
-- follows the account across devices, unlike localStorage.
CREATE TABLE IF NOT EXISTS user_flags (
  user_id INTEGER NOT NULL, flag TEXT NOT NULL, set_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, flag));
`;

const EXPIRY_MS = 40 * 60 * 1000;

/** Canonical decimal string: strip trailing fractional zeros + trailing dot.
 *  Shared normalizer — the watcher must apply the same rule to on-chain amounts. */
export function canonicalAmount(str) {
  const s = String(str);
  return s.includes('.') ? s.replace(/0+$/, '').replace(/\.$/, '') : s;
}

/** Network entry from parsed gateways.json, or undefined. */
export function findGateway(gateways, currency, network) {
  const cur = gateways?.gateways?.find((g) => g.currency === currency);
  return cur?.networks?.find((n) => n.network === network);
}

const PATCH_KEYS = [
  'currency', 'network', 'amount_crypto', 'address', 'memo',
  'status', 'txid', 'confirmations', 'detected_at', 'confirmed_at',
];

export function openDb(path = process.env.TF_DB || new URL('./data.sqlite', import.meta.url).pathname) {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL'); // test process opens the same file concurrently
  db.exec(SCHEMA);

  const stmts = {
    insert: db.prepare(`INSERT INTO orders (id, user_id, username, plan_id, billing, amount_usd, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),
    byId: db.prepare('SELECT * FROM orders WHERE id = ?'),
    taken: db.prepare(`SELECT 1 FROM orders WHERE currency=? AND network=? AND address=? AND amount_crypto=?
      AND status IN ('pending','submitted') LIMIT 1`),
    awaiting: db.prepare(`SELECT * FROM orders WHERE status IN ('pending','submitted')`),
    newestConfirmed: db.prepare(`SELECT * FROM orders WHERE user_id=? AND status='confirmed'
      ORDER BY confirmed_at DESC LIMIT 1`),
    seen: db.prepare('SELECT 1 FROM seen_txs WHERE txid = ?'),
    insertSeen: db.prepare('INSERT OR IGNORE INTO seen_txs (txid, order_id) VALUES (?, ?)'),
    expire: db.prepare(`UPDATE orders SET status='expired', updated_at=?
      WHERE status IN ('pending','submitted') AND detected_at IS NULL AND created_at < ?`),
    flags: db.prepare('SELECT flag FROM user_flags WHERE user_id = ?'),
    setFlag: db.prepare('INSERT OR IGNORE INTO user_flags (user_id, flag, set_at) VALUES (?, ?, ?)'),
  };

  const getOrder = (id) => stmts.byId.get(id);

  return {
    db, // raw DatabaseSync handle
    getOrder,

    /** Flags this user has already consumed, e.g. ['referral_preview_seen']. */
    getFlags(userId) {
      return stmts.flags.all(userId).map((r) => r.flag);
    },

    /** Idempotent — re-marking an already-set flag is a no-op. */
    setFlag(userId, flag) {
      stmts.setFlag.run(userId, flag, Date.now());
    },

    createOrder({ id, userId, username, planId, billing, amountUsd }) {
      const now = Date.now();
      stmts.insert.run(id, userId, username, planId, billing, amountUsd, now, now);
      return getOrder(id);
    },

    updateOrder(id, patch) {
      const keys = Object.keys(patch).filter((k) => PATCH_KEYS.includes(k));
      if (keys.length) {
        // dynamic SET can't be prepared once — orders are low-volume, fine
        db.prepare(`UPDATE orders SET ${keys.map((k) => `${k}=?`).join(', ')}, updated_at=? WHERE id=?`)
          .run(...keys.map((k) => patch[k]), Date.now(), id);
      }
      return getOrder(id);
    },

    amountTaken(currency, network, address, amountCrypto) {
      return stmts.taken.get(currency, network, address, amountCrypto) !== undefined;
    },

    listAwaiting() {
      return stmts.awaiting.all();
    },

    newestConfirmedForUser(userId) {
      return stmts.newestConfirmed.get(userId);
    },

    hasSeenTx(txid) {
      return stmts.seen.get(txid) !== undefined;
    },

    recordSeenTx(txid, orderId) {
      stmts.insertSeen.run(txid, orderId);
    },

    /** snake_case row → contract camelCase order JSON. Omits nullish optionals.
     *  requiredConfirmations resolved from gateways.json (not a DB column). */
    rowToOrder(row, gateways) {
      if (!row) return undefined;
      const o = {
        id: row.id, planId: row.plan_id, billing: row.billing, amountUsd: row.amount_usd,
        status: row.status, createdAt: row.created_at,
      };
      if (row.currency != null) o.currency = row.currency;
      if (row.network != null) o.network = row.network;
      if (row.amount_crypto != null) o.amountCrypto = row.amount_crypto;
      if (row.address != null) o.address = row.address;
      if (row.memo != null) o.memo = row.memo;
      if (row.txid != null) o.txid = row.txid;
      if (row.confirmations != null) o.confirmations = row.confirmations;
      const gw = o.currency && o.network ? findGateway(gateways, o.currency, o.network) : undefined;
      if (gw) o.requiredConfirmations = gw.requiredConfirmations;
      if (row.detected_at != null) o.detectedAt = row.detected_at;
      if (row.confirmed_at != null) o.confirmedAt = row.confirmed_at;
      return o;
    },

    /** Lazy expiry sweep: pending/submitted, no detected tx, older than 40 min. Returns count. */
    expireStale(now = Date.now()) {
      return Number(stmts.expire.run(now, now - EXPIRY_MS).changes);
    },
  };
}
