/**
 * The whole state matrix, exhaustively.
 *
 * Builds one user for every combination of the three axes the campaign
 * editor filters on — subscription {none, active, expired} × broker {none,
 * pending, active} × referral {none, pending, active} = 27 users, plus their
 * invitees — through the store's own actions (buy, lapse, submit a broker,
 * approve, join via a referral link). Then, for
 *
 *   • all 512 "Select User Type" checkbox combinations,
 *   • all 10 timing triggers,
 *   • all 8 plan-chip subsets on Active/Expired subscribers,
 *
 * asserts that the engine fires for exactly the users the editor's rule
 * says (OR inside an axis, AND across, an axis with nothing ticked is no
 * filter) and that the jobs tick then sends a Telegram message to exactly
 * those people — expected sets are computed from each user's known
 * construction, never from the engine's own state reader.
 *
 *   node --test server/campaigns.matrix.test.mjs      (~3s, in-process)
 */
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.TF_DB = ':memory:';
process.env.TF_BOT_TOKEN = 'matrix-token';
process.env.TF_BOT_USERNAME = 'matrixbot';
const { openAdminDb } = await import('./admin.mjs');
const { openDb } = await import('./db.mjs');
const { startJobs } = await import('./jobs.mjs');

const store = openAdminDb();
openDb(); // orders schema, for the tick's reconcile step
const { ledger, campaignEngine: eng, db } = store;
const DAY = 86_400_000;
const NOW = Date.now();

/* ---------------------------------------------------------- the users */

const SUB = ['none', 'active', 'expired'];
const BROKER = ['none', 'pending', 'active'];
const REF = ['none', 'pending', 'active'];
const PLANS = ['silver', 'gold', 'diamond'];

const broker = store.addBroker({ name: 'Matrix Broker', status: 'public' });
let tgSeq = 900_000;
/** Every user we made, with the state we made them in. */
const users = [];

function subscribe(userId, plan) {
  ledger.creditSubscription({ userId, planId: plan, amountUsd: 1, orderId: `o-${userId}-${plan}` });
}
function lapse(userId) {
  db.prepare('UPDATE subscribers SET expires_at = ? WHERE id = ?').run(NOW - DAY, userId);
  ledger.expireDue(NOW); // the product's own lapse: status expired + 'expiry' ledger row
}
function newTgUser(startParam) {
  const u = store.ensureUser({ id: ++tgSeq, first_name: `M${tgSeq}` }, startParam);
  return { id: u.id, tgId: tgSeq };
}

let planIdx = 0;
for (const s of SUB) for (const b of BROKER) for (const r of REF) {
  const u = { ...newTgUser(), s, b, r, plan: null, invitees: [] };
  if (s !== 'none') {
    u.plan = PLANS[planIdx++ % 3];
    subscribe(u.id, u.plan);
    if (s === 'expired') lapse(u.id);
  }
  if (b !== 'none') {
    assert.equal(store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: `${u.id}@x.co`, brokerAccountId: u.id }), 'ok');
    if (b === 'active') {
      const rq = db.prepare('SELECT id FROM review_queue WHERE user_id = ?').get(u.id);
      assert.ok(store.decideReview(rq.id, 'approved'));
    }
  }
  if (r !== 'none') {
    const code = ledger.refCodeFor(u.id);
    const inv = { ...newTgUser(code), s: 'none', b: 'none', r: 'none', plan: null, invitees: [], inviteeOf: u.id };
    if (r === 'active') { inv.s = 'active'; inv.plan = 'gold'; subscribe(inv.id, 'gold'); }
    u.invitees.push(inv);
    users.push(inv);
  }
  users.push(u);
}
assert.equal(users.length, 27 + 18, '27 matrix users + 18 invitees');

/* --------------------------------------------------- the expectations */

const TYPE_AXIS = {
  'No Subscriber': ['s', 'none'], 'Active Subscriber': ['s', 'active'], 'Expired Subscriber': ['s', 'expired'],
  'No Broker': ['b', 'none'], 'Pending Broker': ['b', 'pending'], 'Active Broker': ['b', 'active'],
  'No Referral': ['r', 'none'], 'Pending Referral': ['r', 'pending'], 'Active Referral': ['r', 'active'],
};
const TYPES = Object.keys(TYPE_AXIS);

/** The editor's rule, written independently of the engine. */
function matchesTypes(u, types, chips = []) {
  const want = { s: [], b: [], r: [] };
  for (const t of types) want[TYPE_AXIS[t][0]].push(TYPE_AXIS[t][1]);
  for (const axis of ['s', 'b', 'r']) if (want[axis].length && !want[axis].includes(u[axis])) return false;
  if (chips.length && u.s !== 'none' && want.s.includes(u.s) && !chips.includes(u.plan)) return false;
  return true;
}

/** Which users each trigger (N = 0) is due for, from how they were built. */
const TRIGGER_DUE = {
  'After Start Robot': () => true,
  'After Subscription Started': (u) => u.s !== 'none',
  'After Subscription Expired': (u) => u.s === 'expired',
  'Remaining Subscription': (u) => u.s === 'expired', // "0 days before expiry" = at expiry; only lapsed terms are past it
  'After Pending Broker': (u) => u.b === 'pending',
  'No Cashback Received': () => true, // nobody has been paid cashback
  'After Pending Referral': (u) => u.r === 'pending',
  'Last Referral Joined': (u) => u.r !== 'none',
  'After Active Referral': (u) => u.r === 'active',
  'Last Active Referral': (u) => u.r === 'active',
};

/* -------------------------------------------------------- campaigns */

let seq = 0;
const insert = db.prepare("INSERT INTO campaigns (id, name, status, doc, created_at) VALUES (?, ?, 'active', ?, ?)");
function campaign(doc) {
  const id = `mx${++seq}`;
  insert.run(id, id, JSON.stringify({
    allUsers: true, referralLists: '—', brokerLists: '—', triggerType: 'After Start Robot', triggerN: 0, triggerUnit: 'day',
    userTypes: [], audiencePlans: [], discountValue: 0, message: `msg ${id}`, limitType: 'Send Limit', sendLimit: 'one', ...doc,
  }), NOW);
  return id;
}

const expected = new Map(); // campaign id → Set(user id)
const label = new Map();

// 1. every checkbox combination (2^9, including "nothing ticked" = everyone)
for (let mask = 0; mask < 1 << TYPES.length; mask++) {
  const types = TYPES.filter((_, i) => mask & (1 << i));
  const id = campaign({ userTypes: types });
  label.set(id, `types [${types.join(', ')}]`);
  expected.set(id, new Set(users.filter((u) => matchesTypes(u, types)).map((u) => u.id)));
}
// 2. every trigger, on everyone
for (const [trigger, due] of Object.entries(TRIGGER_DUE)) {
  const id = campaign({ triggerType: trigger });
  label.set(id, `trigger ${trigger}`);
  expected.set(id, new Set(users.filter(due).map((u) => u.id)));
}
// 3. every plan-chip subset on the subscriber branches
for (let mask = 1; mask < 8; mask++) {
  const chips = PLANS.filter((_, i) => mask & (1 << i));
  const types = ['Active Subscriber', 'Expired Subscriber'];
  const id = campaign({ userTypes: types, audiencePlans: chips });
  label.set(id, `chips [${chips.join(', ')}]`);
  expected.set(id, new Set(users.filter((u) => matchesTypes(u, types, chips)).map((u) => u.id)));
}

/* --------------------------------------------------------- run + assert */

const sent = []; // every Telegram message the tick sent: { chatId, campaignId }
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  if (String(url).includes('/sendMessage')) {
    // The tick also sends expiry reminders and lapse notices; only the campaign
    // sends carry a `c_<id>` deep link, and only those are what this counts.
    const link = body.reply_markup?.inline_keyboard?.[0]?.[0]?.url ?? '';
    if (link.includes('c_')) sent.push({ chatId: body.chat_id, campaignId: link.split('c_')[1] });
  }
  return { json: async () => ({ ok: true, result: {} }) };
};

test('every user-type combination, trigger and plan-chip subset messages exactly the users it should', async () => {
  const jobs = startJobs({ db, ledger, campaigns: eng, intervalMs: 3_600_000 });
  const until = Date.now() + 20_000;
  while (eng.pendingDeliveries().length || sent.length === 0) {
    if (Date.now() > until) throw new Error('deliveries did not drain');
    await new Promise((r) => setTimeout(r, 50));
  }
  jobs.stop();

  const byTg = new Map(users.map((u) => [u.tgId, u.id]));
  const got = new Map(); // campaign id → Set(user id) actually messaged
  for (const m of sent) {
    if (!got.has(m.campaignId)) got.set(m.campaignId, new Set());
    got.get(m.campaignId).add(byTg.get(m.chatId));
  }

  const failures = [];
  for (const [id, want] of expected) {
    const have = got.get(id) ?? new Set();
    const missing = [...want].filter((u) => !have.has(u));
    const extra = [...have].filter((u) => !want.has(u));
    if (missing.length || extra.length) failures.push(`${label.get(id)}: missing ${missing.length}, extra ${extra.length}`);
  }
  assert.deepEqual(failures, [], `${failures.length} of ${expected.size} campaigns messaged the wrong people:\n${failures.slice(0, 20).join('\n')}`);
  assert.equal(sent.length, [...expected.values()].reduce((n, s) => n + s.size, 0), 'one message per (campaign, user), no more');
  console.log(`matrix: ${expected.size} campaigns × ${users.length} users, ${sent.length} messages, all as expected`);
});

test('a second tick sends nothing new — every campaign is once per user', async () => {
  const before = sent.length;
  const jobs = startJobs({ db, ledger, campaigns: eng, intervalMs: 3_600_000 });
  await new Promise((r) => setTimeout(r, 300));
  jobs.stop();
  assert.equal(sent.length, before);
});
