/**
 * Bootstrap the admin account.
 *
 *   TF_ADMIN_USER=admin TF_ADMIN_PASS='…' node server/seed.mjs
 *
 * Every other table starts empty — users, brokers, campaigns, and everything
 * else in the CRM come from real activity and the admin dashboard's own
 * forms, not from a seed script.
 */
import { openAdminDb } from './admin.mjs';

const store = openAdminDb();
const { db } = store;

const ADMIN_USER = process.env.TF_ADMIN_USER;
const ADMIN_PASS = process.env.TF_ADMIN_PASS;

if (ADMIN_USER && ADMIN_PASS) {
  if (ADMIN_PASS.length < 12) {
    console.error('TF_ADMIN_PASS must be at least 12 characters.');
    process.exit(1);
  }
  store.createAdmin(ADMIN_USER, ADMIN_PASS);
  console.log(`admin "${ADMIN_USER}" created`);
} else if (!db.prepare('SELECT COUNT(*) AS n FROM admins').get().n) {
  console.error('No admin account exists. Re-run with TF_ADMIN_USER and TF_ADMIN_PASS set.');
  process.exit(1);
}
