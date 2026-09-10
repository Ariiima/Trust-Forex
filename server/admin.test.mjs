// Admin store checks: user-number floor, flow-message seeding, broker delete
// guard, and the rebate-overview broker count. One shared in-memory db, same
// convention as payouts.test.mjs — tests run in file order and build on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connect } from './sqlite.mjs';
import { keyDenial, openAdminDb, tehranMs } from './admin.mjs';
import { openLedger } from './ledger.mjs';
import { PAYOUT_SCHEMA, enqueueWithdrawal } from './payouts.mjs';

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

  const t = store.brokerTotals();
  assert.equal(t.brokers, 1, 'only the broker with a live draft counts');
  assert.equal(t.totalRebate, 100, 'total rebate = the gross typed on the draft');
  store.db.exec(`INSERT INTO cashback_cycles
      (id, name, range_label, gross_rebate, shared_cashback, net_revenue, cashback_users, published_at)
    VALUES ('cy-old', 'Old', 'last week', 40, 8, 32, 1, 'now')`);
  assert.equal(store.brokerTotals().totalRebate, 100, 'published cycles are not this cycle');
  assert.ok(t.draftedPayment > 0 && t.draftedPayment < t.totalRebate,
    'drafted payment is the user tier slice of that gross');
});

test('rebates report the live tier, not the plan snapshot on the row', () => {
  const broker = store.addBroker({ name: 'Upgrade Broker' });
  store.db.exec(`INSERT INTO rebates
      (broker_id, user_id, name, plan, email, broker_account_id, total_rebate, last_week_rebate, shared_rebate)
    VALUES ('${broker.id}', 'u9', 'U9', 'silver', 'u9@x.com', 'acc9', 0, 0, 0)`);
  // The user has since upgraded — subscribers is where the live plan lives.
  store.db.exec(`INSERT INTO subscribers (id, name, plan, status, expires_at)
    VALUES ('u9', 'U9', 'gold', 'active', ${Date.now() + 86_400_000})`);

  assert.equal(store.rebates(broker.id)[0].plan, 'gold');
  const saved = store.addDraft(broker.id, 'u9', 100);
  assert.equal(saved.sharedRebate, 20, '20%, not silver 15%');
  // The client merges this reply over its row, so a stale plan here is a badge
  // that flips back to silver the moment the draft is added.
  assert.equal(saved.plan, 'gold', 'the reply carries the live tier too, not just the right money');
  assert.equal(store.drafts(broker.id).find((d) => d.userId === 'u9').plan, 'gold');
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
  // A broker whose "Require user ID" box is off submits with the email alone.
  assert.equal(store.submitBrokerRequest({
    userId: store.ensureUser({ id: 334, first_name: 'Noid' }).id,
    brokerId: broker.id, email: 'n@x.com', needAccountId: false,
  }), 'ok');
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

  // Demoting an approved, earning user back to "waiting for deposit" must
  // not leave the old rebates row still gating the flow — the step has to
  // walk back and "I made a deposit" has to work again, same as a fresh
  // waiting-for-deposit link.
  const demoted = store.decideReview(row.id, 'waiting');
  assert.equal(demoted.flowKey, 'waiting-deposit');
  assert.equal(link()[0].state, 'waiting-for-deposit', 'demoting an active user must move the step back');
  assert.ok(!store.rebates(broker.id).some((r) => r.userId === u.id),
    'a demoted user drops out of the active-users draft list');
  assert.equal(store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id }), 'ok',
    '"I made a deposit" must work again after a demotion, not be swallowed by the stale rebates row');
  assert.equal(link()[0].state, 'deposit-review');
  store.decideReview(row.id, 'approved');
  assert.equal(link()[0].state, 'cashback-active', 're-approving restores the active state');
  assert.ok(store.rebates(broker.id).some((r) => r.userId === u.id), 're-approving puts the user back in the draft list');

  // Rejecting an already-approved user rewrites the same review_queue row's
  // decision but never touches the rebates row it created — the link must
  // walk back off cashback-active, not keep reading as still earning. Their
  // deposit already passed, so this is a registration rejection: telling them
  // we could not verify a deposit we did verify is the wrong news.
  assert.equal(store.decideReview(row.id, 'rejected').flowKey, 'rejected');
  assert.equal(link().length, 1, 'still one entry, not a stale rebates row plus the new decision');
  assert.equal(link()[0].state, 'rejected');
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
  assert.equal(link().state, 'deposit-rejected');
  assert.equal(store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id }), 'ok', 'the deposit can be re-claimed');
  assert.equal(store.reviewQueue().find((r) => r.id === row.id).lastStatus, 'Deposit rejected');
});

test('reject after "waiting for deposit" is a deposit rejection, from the users table too', () => {
  const broker = store.addBroker({ name: 'Phase Broker' });
  const u = store.ensureUser({ id: 445, first_name: 'Pha' });
  const link = () => store.miniAppUser(u.id).brokers.find((b) => b.brokerId === broker.id);

  store.submitBrokerRequest({ userId: u.id, brokerId: broker.id, email: 'p@x.com', brokerAccountId: 'a1' });
  const row = store.reviewQueue().find((r) => r.userId === u.id && r.brokerId === broker.id);
  store.decideReview(row.id, 'waiting');
  // The row is out of the queue now, so the only Reject left is "Recent users".
  // The account passed — the news is a failed deposit, and the app agrees.
  assert.equal(store.decideReviewForUser(u.id, broker.id, 'rejected').flowKey, 'rejected-deposit');
  assert.equal(link().state, 'deposit-rejected');
  assert.equal(store.confirmBrokerDeposit({ userId: u.id, brokerId: broker.id }), 'ok');

  // Approving straight from the queue verifies the account just the same.
  const u2 = store.ensureUser({ id: 446, first_name: 'Two' });
  store.submitBrokerRequest({ userId: u2.id, brokerId: broker.id, email: 'q@x.com', brokerAccountId: 'a2' });
  const row2 = store.reviewQueue().find((r) => r.userId === u2.id && r.brokerId === broker.id);
  // ...but rejecting that approved user is not a deposit failure: theirs passed.
  store.decideReview(row2.id, 'approved');
  assert.equal(store.decideReviewForUser(u2.id, broker.id, 'rejected').flowKey, 'rejected');
  assert.equal(store.miniAppUser(u2.id).brokers.find((b) => b.brokerId === broker.id).state, 'rejected');

  // A registration that was never approved still rejects as a registration.
  const u3 = store.ensureUser({ id: 447, first_name: 'Three' });
  store.submitBrokerRequest({ userId: u3.id, brokerId: broker.id, email: 'r@x.com', brokerAccountId: 'a3' });
  assert.equal(store.decideReviewForUser(u3.id, broker.id, 'rejected').flowKey, 'rejected');
  assert.equal(store.miniAppUser(u3.id).brokers.find((b) => b.brokerId === broker.id).state, 'rejected');
});

test('users(): one row per (user, broker), not one row per user', () => {
  const brokerA = store.addBroker({ name: 'Multi A' });
  const brokerB = store.addBroker({ name: 'Multi B' });
  const u = store.ensureUser({ id: 555, first_name: 'Multi' });

  store.submitBrokerRequest({ userId: u.id, brokerId: brokerA.id, email: 'm@x.com', brokerAccountId: 'a1' });
  store.decideReview(store.reviewQueue().find((r) => r.userId === u.id && r.brokerId === brokerA.id).id, 'approved');
  store.submitBrokerRequest({ userId: u.id, brokerId: brokerB.id, email: 'm2@x.com', brokerAccountId: 'b1' });
  store.decideReview(store.reviewQueue().find((r) => r.userId === u.id && r.brokerId === brokerB.id).id, 'rejected');

  const rows = store.users().filter((r) => r.id === u.id);
  assert.equal(rows.length, 2, 'two decided broker links, two rows');
  const rowA = rows.find((r) => r.broker === brokerA.id);
  const rowB = rows.find((r) => r.broker === brokerB.id);
  assert.equal(rowA.status, 'active');
  assert.equal(rowB.status, 'rejected');
  // Every cell is the link's own — `users.email` / `.status` / `.last_action_at`
  // are one per account, so reading them here made all rows echo the last edit.
  assert.equal(rowA.email, 'm@x.com');
  assert.equal(rowB.email, 'm2@x.com');
  assert.equal(rowA.brokerId, 'a1');
  assert.equal(rowB.brokerId, 'b1');

  // A user with no decided broker link at all still gets exactly one row.
  const lone = store.ensureUser({ id: 556, first_name: 'Lone' });
  const loneRows = store.users().filter((r) => r.id === lone.id);
  assert.equal(loneRows.length, 1);
  assert.equal(loneRows[0].broker, null);
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

test('campaign send limit is per user, once per occurrence of the trigger', () => {
  const u = store.ensureUser({ id: 777, first_name: 'Renewer' });
  const sub = (at) => {
    store.db.prepare(`INSERT INTO ledger (at, user_id, kind, detail, key) VALUES (?, ?, 'subscription', 'gold', ?)`)
      .run(at, u.id, `sub:${at}`);
    store.db.prepare(`INSERT INTO subscribers (id, name, plan, status, expires_at) VALUES (?, 'R', 'gold', 'active', ?)
      ON CONFLICT(id) DO UPDATE SET expires_at = excluded.expires_at`).run(u.id, at + 30 * 86_400_000);
  };
  insertCampaign('camp-cap', {
    allUsers: true, userTypes: ['Active Subscriber'], triggerType: 'After Subscription Started',
    triggerN: 0, triggerUnit: 'day', limitType: 'Send Limit', sendLimit: 'two', message: 'hi',
  });
  const now = Date.now();
  const mine = (fired) => fired.filter((f) => f.campaignId === 'camp-cap' && f.userId === u.id).length;
  sub(now - 1000);
  assert.equal(mine(store.campaignEngine.evaluate(now)), 1, 'first subscription');
  assert.equal(mine(store.campaignEngine.evaluate(now + 1)), 0, 'same subscription, no resend');
  sub(now + 10);
  assert.equal(mine(store.campaignEngine.evaluate(now + 20)), 1, 'a renewal is a new occurrence');
  sub(now + 30);
  assert.equal(mine(store.campaignEngine.evaluate(now + 40)), 0, '"two times per user" holds');
  assert.equal(store.campaignEngine.stats('camp-cap').sent, 2, 'stats count sends');
});

test('campaign usage limit caps redemptions per user, not campaign-wide', () => {
  insertCampaign('camp-use', { limitType: 'Usage Limit', usageLimit: 'one', discountValue: 10 });
  const mint = store.db.prepare(`INSERT INTO discount_codes
    (code, campaign_id, user_id, plans, percent, expires_at, created_at)
    VALUES (?, 'camp-use', ?, '', 10, NULL, ?)`);
  mint.run('TFAAA1', 'u-a', Date.now());
  mint.run('TFAAA2', 'u-a', Date.now());
  mint.run('TFBBB2', 'u-b', Date.now());
  const eng = store.campaignEngine;
  assert.equal(eng.checkCode('TFAAA1', 'u-a').error, undefined, 'under the cap the code is fine');
  assert.ok(eng.redeem('TFAAA1', 'u-a', 'order1').ok);
  assert.equal(eng.checkCode('TFAAA2', 'u-a').error, 'limit_reached', 'u-a has used their one');
  assert.equal(eng.checkCode('TFBBB2', 'u-b').error, undefined, 'u-b has not — the cap is per user');
});

test('analytics: last_seen and daily_actives track app launches, not just signups', () => {
  // Same shared in-memory db as the rest of this file (connect() memoizes by
  // path, and ':memory:' is one path) — count deltas, not absolute totals.
  const DAY = 86_400_000;
  const now = Date.now(); // ensureUser stamps the real today, so the window must too
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

test('reviewQueue holds only rows a decision is owed on', () => {
  const broker = store.addBroker({ name: 'Queue Broker' });
  store.db.exec(`INSERT INTO review_queue
      (id, user_id, name, plan, broker_id, requested_at, last_status, decision)
    VALUES ('q-new',  'uq1', 'UQ1', 'standard', '${broker.id}', 'now', 'No account', NULL),
           ('q-wait', 'uq2', 'UQ2', 'standard', '${broker.id}', 'now', 'No account', 'waiting'),
           ('q-done', 'uq3', 'UQ3', 'standard', '${broker.id}', 'now', 'No account', 'approved')`);

  const ids = store.reviewQueue().map((r) => r.id);
  assert.deepEqual(ids.filter((id) => id.startsWith('q-')), ['q-new'],
    'waiting-for-deposit is owed by the user; approved is settled');

  // The user confirming the deposit is what puts it back in front of the admin.
  store.confirmBrokerDeposit({ userId: 'uq2', brokerId: broker.id });
  const back = store.reviewQueue().find((r) => r.id === 'q-wait');
  assert.equal(back.lastStatus, 'Deposit required', 'the row says why it is back');
});

test('rejecting from Recent users keeps the phase, same as the queue', () => {
  const broker = store.addBroker({ name: 'Revoke Broker' });
  store.db.exec(`INSERT INTO review_queue
      (id, user_id, name, plan, broker_id, requested_at, last_status, decision)
    VALUES ('rv-dep', 'ur1', 'UR1', 'standard', '${broker.id}', 'now', 'Deposit required', 'approved')`);

  // Approved: both checks passed, so a reject is a registration rejection.
  assert.equal(store.decideReview('rv-dep', 'rejected').flowKey, 'rejected');
  const shown = store.miniAppUser('ur1').brokers.find((b) => b.brokerId === broker.id);
  assert.equal(shown.state, 'rejected', 'the Mini App agrees with the message');

  // Still waiting for the deposit: rejecting IS the failed-deposit news.
  store.db.exec(`INSERT INTO review_queue
      (id, user_id, name, plan, broker_id, requested_at, last_status, decision)
    VALUES ('rv-wait', 'ur2', 'UR2', 'standard', '${broker.id}', 'now', 'Deposit required', 'waiting')`);
  const out = store.decideReviewForUser('ur2', broker.id, 'rejected');
  assert.equal(out.flowKey, 'rejected-deposit', 'waiting for a deposit — this is a deposit rejection');
  assert.equal(store.miniAppUser('ur2').brokers.find((b) => b.brokerId === broker.id).state, 'deposit-rejected');
});

test('alerts counts only the open rows, and survives a missing withdrawals table', () => {
  const broker = store.addBroker({ name: 'Alert Broker' });
  const before = store.alerts();
  store.db.exec(`INSERT INTO review_queue (id, user_id, name, plan, broker_id, requested_at, decision)
    VALUES ('a-open', 'ua', 'UA', 'standard', '${broker.id}', 'now', NULL),
           ('a-done', 'ub', 'UB', 'standard', '${broker.id}', 'now', 'approved')`);
  store.db.exec(`INSERT INTO unmatched_txs
      (txid, chain, address, amount_raw, amount, decimals, reason, seen_at, resolution)
    VALUES ('t-open', 'evm', '0x1', '1000000', '1', 6, 'ambiguous', 1, NULL),
           ('t-done', 'evm', '0x1', '2000000', '2', 6, 'ambiguous', 1, 'ignored')`);

  const now = store.alerts();
  assert.equal(now.reviews, before.reviews + 1, 'a decided row is not waiting on anyone');
  assert.equal(now.unmatched, before.unmatched + 1, 'a resolved transfer is not waiting either');
  // payouts.mjs owns `withdrawals` and never ran here.
  assert.equal(now.withdrawals, 0);
});

test('extra-day grant cutoff is Tehran wall clock against the purchase instant', () => {
  const day = 86_400_000;
  // 12:00 Tehran on 2026-08-16 is 08:30Z.
  const cutoff = Date.parse('2026-08-16T08:30:00Z');
  const seed = (id, boughtAt) => {
    store.db.prepare(`INSERT INTO subscribers (id, name, plan, purchased_at, expires_at, status)
      VALUES (?, ?, 'standard', ?, ?, 'active')`).run(id, id, new Date(boughtAt).toISOString().slice(0, 10), boughtAt + 30 * day);
    store.db.prepare(`INSERT INTO ledger (user_id, kind, amount, revenue, at, key)
      VALUES (?, 'subscription', 0, 49, ?, ?)`).run(id, boughtAt, `k-${id}`);
  };
  seed('g-early', cutoff - 60_000);      // 11:59 Tehran — in
  seed('g-late', cutoff + 60_000);       // 12:01 Tehran — out
  // Legacy row: only the UTC date column, no ledger row → treated as midnight UTC of that day.
  store.db.prepare(`INSERT INTO subscribers (id, name, plan, purchased_at, expires_at, status)
    VALUES ('g-legacy', 'L', 'standard', '2026-08-15', ?, 'active')`).run(cutoff + 30 * day);

  assert.equal(tehranMs('2026-08-16T12:00'), cutoff);
  assert.equal(tehranMs(''), null);
  assert.equal(store.eligibleCount(cutoff), 2, 'early + legacy, not late');
  const all = store.eligibleCount(null);
  assert.ok(all >= 3, 'no cutoff = every active subscriber');

  const grant = store.addGrant({ purchasedBefore: cutoff, extraDays: 2, message: 'hi', notify: true });
  assert.equal(grant.affected, 2);
  assert.equal(grant.eligibleBefore, '2026-08-16');
  assert.equal(grant.eligibleTime, '12:00');
  const early = store.db.prepare('SELECT expires_at FROM subscribers WHERE id = ?').get('g-early');
  assert.equal(early.expires_at, cutoff - 60_000 + 32 * day, 'eligible subscriber got the days');
  const late = store.db.prepare('SELECT expires_at FROM subscribers WHERE id = ?').get('g-late');
  assert.equal(late.expires_at, cutoff + 60_000 + 30 * day, 'late one untouched');
});

if (process.argv[1] === new URL(import.meta.url).pathname) {
  console.log('run via: node --test server/admin.test.mjs');
}

test('broker headcounts follow the review decision, not the rebates table', () => {
  const b = store.addBroker({ name: 'Headcount Broker' });
  store.db.exec(`INSERT INTO review_queue (id, user_id, name, plan, broker_id, requested_at, decision)
    VALUES ('hc1', 'hu1', 'A', 'standard', '${b.id}', 'now', 'approved'),
           ('hc2', 'hu2', 'B', 'standard', '${b.id}', 'now', 'waiting')`);
  // Both users have rebate history; only the approved one is active.
  store.db.exec(`INSERT INTO rebates
      (broker_id, user_id, name, plan, email, broker_account_id, total_rebate, last_week_rebate, shared_rebate)
    VALUES ('${b.id}', 'hu1', 'A', 'standard', 'a@x.com', 'a1', 10, 0, 0),
           ('${b.id}', 'hu2', 'B', 'standard', 'b@x.com', 'b1', 54.5, 0, 0)`);

  const row = store.broker(b.id);
  assert.equal(row.activeUsers, 1);
  assert.equal(row.pendingUsers, 1, 'waiting-for-deposit is pending, not invisible');

  store.db.exec(`INSERT INTO review_queue (id, user_id, name, plan, broker_id, requested_at, decision)
    VALUES ('hc3', 'hu3', 'C', 'standard', '${b.id}', 'now', 'rejected')`);
  assert.equal(store.broker(b.id).totalUsers, 3, 'the All-users tab counts rejected links too');
});

test('the timeline names the broker, and logs every submit and every decision', () => {
  const b = store.addBroker({ name: 'Timeline Broker' });
  const u = store.ensureUser({ id: 909, first_name: 'T' });
  assert.equal(store.submitBrokerRequest({
    userId: u.id, brokerId: b.id, email: 't@x.com', brokerAccountId: 'acc1',
  }), 'ok');

  const id = store.db.prepare('SELECT id FROM review_queue WHERE user_id = ?').get(u.id).id;
  store.decideReview(id, 'waiting');
  store.decideReview(id, 'approved');
  store.decideReview(id, 'waiting'); // same decision twice must not be swallowed

  const details = store.user(u.id).activity.map((a) => a.activity);
  for (const want of ['Timeline Broker request submitted', 'Timeline Broker request approved']) {
    assert.ok(details.includes(want), `${want} missing from ${JSON.stringify(details)}`);
  }
  assert.equal(details.filter((d) => d === 'Timeline Broker request waiting').length, 2);
});

test('rejecting a withdrawal gives the frozen balance back, once', () => {
  store.db.exec(PAYOUT_SCHEMA);
  const ledger = openLedger(store.db);
  const u = store.ensureUser({ id: 808, first_name: 'W' });
  ledger.append({ userId: u.id, kind: 'cashback', amount: 50, detail: 'seed' });

  const { withdrawal } = enqueueWithdrawal({
    db: store.db, ledger, userId: u.id, tgUserId: 808,
    amount: 20, currency: 'USDT', network: 'TRC20', address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
  });
  assert.equal(ledger.wallet(u.id).balance, 30, 'requesting freezes the amount');

  const row = store.rejectWithdrawal(withdrawal.id, 'Address is not yours');
  assert.equal(row.status, 'refunded');
  assert.equal(row.tgUserId, 808, 'the caller needs this to send the rejection DM');
  assert.equal(ledger.wallet(u.id).balance, 50, 'the freeze is released in full');

  assert.equal(store.rejectWithdrawal(withdrawal.id, 'again'), null, 'already resolved');
  assert.equal(ledger.wallet(u.id).balance, 50, 'a second click credits nothing');

  assert.equal(store.markWithdrawalSent(withdrawal.id), null, 'a rejected row cannot then be paid');
});

/* ---- API keys ---------------------------------------------------------
   The key is what an AI agent authenticates with over /mcp, so what a key
   cannot reach matters as much as what it can. */

test('an API key authenticates by Authorization header, and only until revoked', () => {
  const made = store.createApiKey('agent', 'write');
  assert.ok(made.key.startsWith('tfk_'), 'the plaintext is handed back once, at creation');
  assert.equal(made.prefix, made.key.slice(0, 12));

  const listed = store.apiKeys().find((k) => k.id === made.id);
  assert.ok(listed, 'it lists');
  assert.equal(listed.key, undefined, 'the plaintext is never listed again');
  assert.equal(store.db.prepare('SELECT hash FROM admin_api_keys WHERE id = ?').get(made.id).hash.includes(made.key), false,
    'the key itself is not what is stored');

  const req = { headers: { authorization: `Bearer ${made.key}` } };
  const session = store.sessionFor(req);
  assert.equal(session.viaKey, true);
  assert.equal(session.scope, 'write');
  assert.equal(session.username, 'key:agent', 'actions attribute to the key in the same audit columns');

  assert.equal(store.sessionFor({ headers: { authorization: 'Bearer tfk_nonsense' } }), null);
  assert.equal(store.sessionFor({ headers: {} }), null, 'no cookie and no key is no session');

  assert.equal(store.revokeApiKey(made.id), true);
  assert.equal(store.sessionFor(req), null, 'a revoked key stops working immediately');
  assert.equal(store.revokeApiKey(made.id), false, 'revoking twice is a clean 404');
});

test('scope is what a key may reach; a cookie session is unaffected', () => {
  const key = (scope) => ({ viaKey: true, scope });
  const human = { username: 'admin' };

  // No key manages keys — the boundary that stops read becoming money in two calls.
  for (const scope of ['read', 'write', 'money']) {
    assert.equal(keyDenial(key(scope), 'GET', '/api-keys'), 'cookie_session_required');
    assert.equal(keyDenial(key(scope), 'POST', '/api-keys'), 'cookie_session_required');
  }
  assert.equal(keyDenial(human, 'POST', '/api-keys'), null, 'a human at the dashboard still mints keys');

  assert.equal(keyDenial(key('read'), 'GET', '/users'), null);
  assert.equal(keyDenial(key('read'), 'POST', '/campaigns'), 'read_only_key');
  assert.equal(keyDenial(key('read'), 'DELETE', '/campaigns/m1'), 'read_only_key');

  // The point of the whole exercise: an agent may run campaigns, not move money.
  assert.equal(keyDenial(key('write'), 'POST', '/campaigns'), null);
  assert.equal(keyDenial(key('write'), 'PUT', '/campaigns/m1'), null);
  assert.equal(keyDenial(key('write'), 'PATCH', '/campaigns/m1'), null);
  for (const path of ['/withdrawals/w1/mark-sent', '/withdrawals/w1/reject', '/payments/o1/confirm',
    '/unmatched/tx1/attribute', '/rebate-drafts/publish-all', '/brokers/b1/rebate-drafts/publish',
    '/gateways', '/extra-grants']) {
    assert.equal(keyDenial(key('write'), 'POST', path), 'money_scope_required', path);
    assert.equal(keyDenial(key('money'), 'POST', path), null, `money scope reaches ${path}`);
    assert.equal(keyDenial(human, 'POST', path), null, `a human reaches ${path}`);
  }
  // Reading is never moving. Gating these by path alone hid the deposit-wallet
  // list and the grant history from every read and write key.
  for (const path of ['/withdrawals', '/payments', '/unmatched', '/gateways', '/extra-grants']) {
    assert.equal(keyDenial(key('read'), 'GET', path), null, `GET ${path} is a read`);
    assert.equal(keyDenial(key('write'), 'GET', path), null, `GET ${path} is a read`);
  }
  assert.equal(keyDenial(key('write'), 'PUT', '/gateways'), 'money_scope_required',
    'writing deposit addresses is still money');
  assert.equal(keyDenial(key('write'), 'POST', '/extra-grants'), 'money_scope_required',
    'handing out paid days is still money');
  assert.equal(keyDenial(key('write'), 'POST', '/brokers/b1/rebate-drafts'), null,
    'drafting a rebate is not publishing one');
});
