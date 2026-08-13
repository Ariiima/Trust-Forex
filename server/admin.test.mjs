// Admin store checks: user-number floor, flow-message seeding, broker delete
// guard, and the rebate-overview broker count. One shared in-memory db, same
// convention as payouts.test.mjs — tests run in file order and build on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from './sqlite.mjs';
import { openAdminDb } from './admin.mjs';

const store = openAdminDb(':memory:');

test('telegram signups get user_no starting at 1001, not 1', () => {
  const u1 = store.ensureUser({ id: 111, first_name: 'A' });
  const u2 = store.ensureUser({ id: 222, first_name: 'B' });
  assert.equal(u1.userNo, 1001);
  assert.equal(u2.userNo, 1002);
});

test('addBroker seeds the four status-message rows', () => {
  const broker = store.addBroker({ name: 'Hello Broker' });
  const flow = store.flowMessages(broker.id);
  assert.equal(flow.length, 4);
  assert.deepEqual(
    flow.map((m) => m.key).sort(),
    ['approved', 'rejected', 'rejected-deposit', 'waiting-deposit'],
  );
  assert.ok(flow.every((m) => m.message.length > 0), 'every seeded row has message text');
});

test('deleteBroker refuses a broker with live users, deletes an empty one', () => {
  const broker = store.addBroker({ name: 'Salam' });
  store.db.exec(`INSERT INTO review_queue (id, user_id, name, plan, broker_id, requested_at)
    VALUES ('r1', 'u1', 'U', 'standard', '${broker.id}', 'now')`);
  assert.equal(store.deleteBroker(broker.id), 'in_use');

  store.db.exec(`DELETE FROM review_queue WHERE id = 'r1'`);
  assert.equal(store.deleteBroker(broker.id), 'ok');
  assert.equal(store.broker(broker.id), undefined);
  assert.equal(store.flowMessages(broker.id).length, 0, 'flow messages cascade with the broker');
  assert.equal(store.deleteBroker(broker.id), 'not_found', 'deleting twice is a clean 404, not a crash');
});

test('brokerTotals.brokers counts brokers with a pending draft, not every broker', () => {
  store.addBroker({ name: 'Idle Broker' }); // exists, nothing drafted
  const busy = store.addBroker({ name: 'Busy Broker' });
  store.db.exec(`INSERT INTO rebates
      (broker_id, user_id, name, plan, email, broker_account_id, total_rebate, last_week_rebate, shared_rebate)
    VALUES ('${busy.id}', 'u1', 'U', 'standard', 'u@x.com', 'acc1', 0, 0, 0)`);
  store.addDraft(busy.id, 'u1', 100);

  assert.equal(store.brokerTotals().brokers, 1, 'only the broker with a live draft counts');
});

test('a database seeded with low user numbers gets renumbered to start at 1001', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-admin-test-'));
  const path = join(dir, 'db.sqlite');
  try {
    const seed = connect(path);
    seed.exec(`CREATE TABLE users (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, plan TEXT NOT NULL, email TEXT,
      broker_id TEXT, status TEXT NOT NULL, last_action_at TEXT,
      total_rebate REAL, last_month_rebate REAL, joined_at TEXT, broker TEXT,
      user_no INTEGER)`);
    seed.exec(`INSERT INTO users (id, name, plan, status, user_no) VALUES
      ('u1', 'First', 'none', 'active', 1), ('u2', 'Second', 'none', 'active', 2)`);

    const reopened = openAdminDb(path);
    const rows = reopened.db.prepare('SELECT id, user_no FROM users ORDER BY user_no').all();
    assert.deepEqual(rows.map((r) => [r.id, r.user_no]), [['u1', 1001], ['u2', 1002]]);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('broker verification: submit → waiting → deposit → approve', () => {
  const broker = store.addBroker({ name: 'Flow Broker' });
  const u = store.ensureUser({ id: 333, first_name: 'Flo' });
  const link = () => store.miniAppUser(u.id).brokers.filter((b) => b.brokerId === broker.id);

  assert.equal(store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'f@x.com' }),
    'missing_account', 'first submit needs the broker account id');
  assert.equal(store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'f@x.com', brokerAccountId: 'acc9' }), 'ok');
  assert.equal(store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'f@x.com', brokerAccountId: 'acc9' }),
    'pending', 'a second submit while under review is a no-op');
  assert.equal(link()[0].state, 'pending');

  const row = store.reviewQueue().find((r) => r.userId === u.id && r.brokerId === broker.id);
  assert.equal(row.lastStatus, 'No account');
  assert.equal(store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id }),
    'pending', 'no deposit claim while the account is still under review');

  const waiting = store.decideReview(row.id, 'waiting');
  assert.equal(waiting.flowKey, 'waiting-deposit');
  assert.equal(link()[0].state, 'waiting-for-deposit');

  assert.equal(store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id }), 'ok');
  assert.equal(link()[0].state, 'deposit-review');
  assert.equal(store.reviewQueue().find((r) => r.id === row.id).lastStatus, 'Deposit required');

  const approved = store.decideReview(row.id, 'approved');
  assert.equal(approved.flowKey, 'approved');
  assert.equal(link().length, 1, 'the approved review row is hidden behind the rebates row');
  assert.equal(link()[0].state, 'cashback-active');
  assert.equal(store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'f@x.com', brokerAccountId: 'acc9' }),
    'active', 'an earning relationship refuses a fresh submission');
});

test('broker verification: rejection, resubmission, rejected deposit', () => {
  const broker = store.addBroker({ name: 'Reject Broker' });
  const u = store.ensureUser({ id: 444, first_name: 'Rej' });
  const link = () => store.miniAppUser(u.id).brokers.find((b) => b.brokerId === broker.id);

  store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'r@x.com', brokerAccountId: 'a1' });
  const row = store.reviewQueue().find((r) => r.userId === u.id && r.brokerId === broker.id);
  assert.equal(store.decideReview(row.id, 'rejected').flowKey, 'rejected');
  assert.equal(link().state, 'rejected');

  // Resubmit fixes the email; the sheet has no account-id input, the old one is kept.
  assert.equal(store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'r2@x.com' }), 'ok');
  const reopened = store.reviewQueue().find((r) => r.id === row.id);
  assert.equal(reopened.lastStatus, 'Registration rejected');
  assert.equal(reopened.email, 'r2@x.com');
  assert.equal(reopened.brokerAccountId, 'a1');
  assert.equal(link().state, 'pending');

  // A rejected deposit sends the user back to "make a deposit", not to resubmission.
  store.decideReview(row.id, 'waiting');
  store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id });
  assert.equal(store.decideReview(row.id, 'rejected').flowKey, 'rejected-deposit');
  assert.equal(link().state, 'waiting-for-deposit');
  assert.equal(store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id }), 'ok', 'the deposit can be re-claimed');
  assert.equal(store.reviewQueue().find((r) => r.id === row.id).lastStatus, 'Deposit rejected');
});

const insertCampaign = (id, doc) => store.db
  .prepare("INSERT INTO campaigns (id, name, status, doc, created_at) VALUES (?, ?, 'active', ?, ?)")
  .run(id, id, JSON.stringify(doc), Date.now());

test('campaign audience: multi-select broker list matches by name, OR within the list', () => {
  const b1 = store.addBroker({ name: 'Alpha FX' });
  store.addBroker({ name: 'Beta FX' });
  const u = store.ensureUser({ id: 555, first_name: 'Aud' });
  store.db.prepare('UPDATE users SET broker = ? WHERE id = ?').run(b1.id, u.id);
  insertCampaign('camp-multi', {
    allUsers: false, brokerLists: 'Beta FX, Alpha FX', referralLists: '—',
    triggerType: 'After Start Robot', triggerN: 0, triggerUnit: 'day', message: 'hi',
  });
  const fired = store.campaignEngine.evaluate(Date.now());
  assert.ok(fired.some((f) => f.campaignId === 'camp-multi' && f.userId === u.id),
    'a user at the second-listed broker matches');
  assert.ok(!fired.some((f) => f.campaignId === 'camp-multi' && f.userId !== u.id),
    'users at no listed broker do not match');
});

test('campaign send limit caps how many people a campaign reaches', () => {
  insertCampaign('camp-cap', {
    allUsers: true, triggerType: 'After Start Robot', triggerN: 0, triggerUnit: 'day',
    limitType: 'Send Limit', sendLimit: 2, message: 'hi',
  });
  const fired = store.campaignEngine.evaluate(Date.now());
  assert.equal(fired.filter((f) => f.campaignId === 'camp-cap').length, 2);
  const again = store.campaignEngine.evaluate(Date.now());
  assert.equal(again.filter((f) => f.campaignId === 'camp-cap').length, 0, 'the cap holds on later ticks');
});

test('campaign usage limit rejects codes once redemptions hit the cap', () => {
  insertCampaign('camp-use', { limitType: 'Usage Limit', usageLimit: 1, discountValue: 10 });
  const mint = store.db.prepare(`INSERT INTO discount_codes
    (code, campaign_id, user_id, plans, percent, expires_at, created_at)
    VALUES (?, 'camp-use', ?, '', 10, NULL, ?)`);
  mint.run('TFAAA1', 'u-a', Date.now());
  mint.run('TFBBB2', 'u-b', Date.now());
  const eng = store.campaignEngine;
  assert.equal(eng.checkCode('TFAAA1', 'u-a').error, undefined, 'under the cap the code is fine');
  assert.ok(eng.redeem('TFAAA1', 'u-a', 'order1').ok);
  assert.equal(eng.checkCode('TFBBB2', 'u-b').error, 'limit_reached', 'the cap counts campaign-wide');
});

test('analytics: last_seen and daily_actives track app launches, not just signups', () => {
  // Same shared in-memory db as the rest of this file (connect() memoizes by
  // path, and ':memory:' is one path) — count deltas, not absolute totals.
  const DAY = 86_400_000;
  const now = Date.parse('2026-08-13T12:00:00Z');
  const before = store.analytics(now, 14);
  store.ensureUser({ id: 901, first_name: 'Today' });
  const stale = store.ensureUser({ id: 902, first_name: 'Stale' });
  store.db.prepare('UPDATE users SET last_seen = ? WHERE id = ?').run(now - 10 * DAY, stale.id);
  store.db.prepare('DELETE FROM daily_actives WHERE user_id = ?').run(stale.id);
  store.db.prepare('INSERT INTO daily_actives (day, user_id) VALUES (?, ?)')
    .run(new Date(now - 10 * DAY).toISOString().slice(0, 10), stale.id);

  const a = store.analytics(now, 14);
  assert.equal(a.totalUsers, before.totalUsers + 2);
  assert.equal(a.activeToday, before.activeToday + 1, 'only the fresh launch counts as active today');
  assert.equal(a.active7d, before.active7d + 1, 'the 10-day-old launch fell out of the 7-day window');
  assert.equal(a.daily.length, 14);
  assert.equal(a.daily.at(-1).day, new Date(now).toISOString().slice(0, 10));
  assert.equal(a.daily.at(-1).active, before.daily.at(-1).active + 1, "today's bucket has the fresh launch");
});

test('codesExpired: the in-app card outlives the discount until every minted code has run out', () => {
  insertCampaign('camp-exp', { discountValue: 10 });
  const eng = store.campaignEngine;
  const mint = store.db.prepare(`INSERT INTO discount_codes
    (code, campaign_id, user_id, plans, percent, expires_at, created_at)
    VALUES (?, 'camp-exp', ?, '', 10, ?, ?)`);
  const now = Date.now();
  assert.equal(eng.codesExpired('camp-exp', now), false, 'nothing minted yet is not expired');
  mint.run('TFEXP1', 'u-x', now + 1000, now);
  assert.equal(eng.codesExpired('camp-exp', now), false, 'still within its window');
  assert.equal(eng.codesExpired('camp-exp', now + 2000), true, 'past every code\'s expiry');
  mint.run('TFEXP2', 'u-y', null, now);
  assert.equal(eng.codesExpired('camp-exp', now + 2000), false, 'an open-ended code keeps the card alive');
});

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('run via: node --test server/admin.test.mjs');
}
