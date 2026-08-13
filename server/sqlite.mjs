/**
 * The database. One file, one connection, for the whole app.
 *
 * The Mini App's tables (orders, user_flags — keyed by Telegram user id) and
 * the admin's (users, brokers, campaigns, … — keyed by the admin's own TEXT id)
 * used to live in two separate SQLite files opened by two separate modules.
 * That made the one join the product actually needs — "which admin user row is
 * this Telegram account?" — impossible to write, so every per-user screen in
 * the Mini App fell back to hardcoded mock data.
 *
 * Same file now. The two openers still own their own schema and their own
 * prepared statements; they just share the handle. Table names do not collide.
 */
import { DatabaseSync } from 'node:sqlite';

export const DB_PATH =
  process.env.TF_DB || new URL('./trustforex.sqlite', import.meta.url).pathname;

// Memoized per path: openDb() and openAdminDb() are both called at module load
// in the same process, and two DatabaseSync handles on one file would take
// their own locks for no reason.
const open = new Map();

export function connect(path = DB_PATH) {
  let db = open.get(path);
  if (!db) {
    db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL');
    // Reads dominate and the file is local; NORMAL avoids an fsync per write
    // without risking corruption (only the last transaction on a host crash).
    db.exec('PRAGMA synchronous=NORMAL');
    db.exec('PRAGMA foreign_keys=ON');
    open.set(path, db);
  }
  return db;
}
