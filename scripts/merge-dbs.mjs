/**
 * One-off: fold the old two-file layout into server/trustforex.sqlite.
 *
 * admin.sqlite carried everything the dashboard manages; data.sqlite carried
 * orders, seen_txs and user_flags. Nothing joined them, which is exactly the
 * problem. This copies admin.sqlite across (it holds all the real rows), then
 * lifts the Mini App's three tables over from data.sqlite.
 *
 * Idempotent and non-destructive: the two originals are left on disk, and
 * re-running only re-copies rows that are missing (INSERT OR IGNORE).
 *
 *   node scripts/merge-dbs.mjs
 */
import { DatabaseSync } from 'node:sqlite';
import { copyFileSync, existsSync } from 'node:fs';

const dir = new URL('../server/', import.meta.url).pathname;
const target = `${dir}trustforex.sqlite`;
const adminDb = `${dir}admin.sqlite`;
const dataDb = `${dir}data.sqlite`;

if (!existsSync(target)) {
  if (!existsSync(adminDb)) {
    console.error(`No ${adminDb} to merge from. Run "npm run admin:seed" instead.`);
    process.exit(1);
  }
  // A WAL checkpoint first, or the copy misses everything still in the -wal.
  const src = new DatabaseSync(adminDb);
  src.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  src.close();
  copyFileSync(adminDb, target);
  console.log('copied admin.sqlite -> trustforex.sqlite');
}

const db = new DatabaseSync(target);
db.exec('PRAGMA journal_mode=WAL');

if (existsSync(dataDb)) {
  const old = new DatabaseSync(dataDb);
  old.exec('PRAGMA wal_checkpoint(TRUNCATE)');

  // Create the Mini App tables on the target if the merge runs before the
  // server has ever opened it.
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY, user_id INTEGER, username TEXT, plan_id TEXT NOT NULL, billing TEXT NOT NULL,
      amount_usd REAL NOT NULL, currency TEXT, network TEXT, amount_crypto TEXT, address TEXT, memo TEXT,
      status TEXT NOT NULL DEFAULT 'pending', txid TEXT, confirmations INTEGER DEFAULT 0,
      detected_at INTEGER, confirmed_at INTEGER, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS seen_txs (txid TEXT PRIMARY KEY, order_id TEXT);
    CREATE TABLE IF NOT EXISTS user_flags (
      user_id INTEGER NOT NULL, flag TEXT NOT NULL, set_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, flag));
  `);

  for (const table of ['orders', 'seen_txs', 'user_flags']) {
    const rows = old.prepare(`SELECT * FROM ${table}`).all();
    if (!rows.length) continue;
    const cols = Object.keys(rows[0]);
    const stmt = db.prepare(
      `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    );
    for (const r of rows) stmt.run(...cols.map((c) => r[c]));
    console.log(`${table}: ${rows.length} row(s) carried over`);
  }
  old.close();
}

console.log('done —', target);
console.log('The old admin.sqlite / data.sqlite are untouched; delete them once you are happy.');
db.close();
