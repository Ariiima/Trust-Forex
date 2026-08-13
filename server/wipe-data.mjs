/**
 * Reset to a clean slate: delete every row of user/transaction/demo data while
 * keeping admin logins, the broker catalogue (+ its preview/flow-message
 * config) and the marketing campaign definitions (+ their lists and the bot's
 * message templates).
 *
 *   node server/wipe-data.mjs             # TF_DB or the default trustforex.sqlite
 *   TF_DB=/path/to/live.sqlite node server/wipe-data.mjs
 *
 * Also seeds the three built-in promo-carousel cards (PromoCarousel.tsx's
 * PROMOS) as real campaigns, INSERT OR IGNORE by name, so the carousel keeps
 * showing them as CRM-editable content instead of the hardcoded fallback.
 */
import { openAdminDb } from './admin.mjs';
import { PAYOUT_SCHEMA } from './payouts.mjs';

// Order matters: children before the tables they reference, though nothing
// here has an FK constraint to enforce it — this just keeps counts sane if
// one delete throws.
const WIPE_TABLES = [
  'orders', 'seen_txs', 'user_flags', // payment DB
  'ledger', 'withdrawals', // money spine + payouts
  'users', 'activity', 'user_summary', 'cashback_cycles', 'review_queue',
  'rebates', 'rebate_drafts', 'subscribers', 'extra_grants', 'events',
  'referral_rows', 'referral_campaigns', 'signal_results', 'series',
  'discount_codes', 'campaign_sends', 'campaign_opens', // per-user campaign activity, not the campaigns themselves
  'admin_sessions', // force re-login everywhere
];

const KEEP_TABLES = [
  'admins', 'brokers', 'broker_preview', 'flow_messages',
  'campaigns', 'campaign_lists', 'campaign_list_members', 'message_templates',
];

const PROMO_CARDS = [
  { name: 'Summer discount', cardTitle: 'Summer discount', cardDesc: 'Get 20% OFF on 12 month plan' },
  { name: 'Invite & Earn', cardTitle: 'invite friends', cardDesc: 'get 10% from thier deposits' },
  { name: 'Complete tasks', cardTitle: 'Complete tasks', cardDesc: 'Win rewards & get amazing prizes' },
];

export function wipeData(path) {
  const store = openAdminDb(path);
  const { db } = store;
  // withdrawals is payouts.mjs's table — index.mjs execs its schema at boot,
  // but this script runs standalone, so make sure it exists before touching it.
  db.exec(PAYOUT_SCHEMA);
  const before = {};
  for (const t of WIPE_TABLES) before[t] = db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n;

  db.exec('BEGIN');
  try {
    for (const t of WIPE_TABLES) db.exec(`DELETE FROM ${t}`);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Seed the built-in promo cards as real campaigns, if none of that name
  // exists yet — same "everyone, every screen" reach as the hardcoded
  // fallback it replaces.
  const existing = new Set(db.prepare('SELECT name FROM campaigns').all().map((r) => r.name));
  let seeded = 0;
  for (const p of PROMO_CARDS) {
    if (existing.has(p.name)) continue;
    store.addCampaign({
      name: p.name,
      status: 'active',
      allUsers: true,
      audience: [],
      locations: ['subscription', 'referral', 'cashback'],
      cardTitle: p.cardTitle,
      cardDesc: p.cardDesc,
      messageSent: null, openRate: null, codeSent: null, codeUsedRate: null,
      createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdTime: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    });
    seeded += 1;
  }

  return { before, seeded };
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { before, seeded } = wipeData(process.env.TF_DB);
  console.log('Wiped:');
  for (const [t, n] of Object.entries(before)) console.log(`  ${t}: ${n} row(s)`);
  console.log(`Kept as-is: ${KEEP_TABLES.join(', ')}`);
  console.log(`Seeded ${seeded} promo campaign(s).`);
}
