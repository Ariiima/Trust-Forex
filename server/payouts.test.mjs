// Payout pipeline checks: enqueue validation, the conservative state machine,
// caps, and the crash sweep. Fake senders — nothing touches a chain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { connect } from './sqlite.mjs';
import {
  PAYOUT_SCHEMA, enqueueWithdrawal, listWithdrawals, processQueue, startPayouts, usdToUnits,
} from './payouts.mjs';

const db = connect(':memory:');
db.exec(PAYOUT_SCHEMA);

/** Fake ledger with one account holding $100. */
let balance = 100;
const ledger = {
  withdraw(userId, amount) {
    if (amount > balance) return { error: 'insufficient_funds', balance };
    balance -= amount;
    return { ok: true, balance };
  },
};

const TRON_ADDR = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const EVM_ADDR = '0x55d398326f99059fF775485246999027B3197955';

const enqueue = (over = {}) =>
  enqueueWithdrawal({
    db, ledger, userId: 'u1', tgUserId: null,
    amount: 20, currency: 'USDT', network: 'TRC20', address: TRON_ADDR, ...over,
  });

const statusOf = (id) => db.prepare('SELECT status, txid, error FROM withdrawals WHERE id = ?').get(id);

test('usdToUnits uses integer math', () => {
  assert.equal(usdToUnits(19, 6), '19000000');
  assert.equal(usdToUnits(0.01, 18), '10000000000000000');
  assert.equal(usdToUnits(19.99, 6), '19990000');
});

test('enqueue validates before touching the ledger', () => {
  assert.equal(enqueue({ currency: 'DOGE' }).error, 'unknown_option');
  assert.equal(enqueue({ amount: 5 }).error, 'below_minimum');
  assert.equal(enqueue({ address: 'not-an-address' }).error, 'invalid_address');
  assert.equal(enqueue({ network: 'BEP20' }).error, 'invalid_address'); // tron addr on evm net
  assert.equal(enqueue({ amount: 500 }).error, 'insufficient_funds');
  assert.equal(balance, 100, 'no debit on any rejection');
});

test('happy path: enqueue reserves, worker sends, fee is held back', async () => {
  const r = enqueue({ amount: 20 });
  assert.equal(r.ok, true);
  assert.equal(balance, 80, 'reserved immediately');
  assert.equal(r.withdrawal.status, 'pending');

  const sends = [];
  await processQueue({
    db,
    senders: { tron: async ({ units, address }) => (sends.push({ units, address }), 'txABC') },
  });
  const row = statusOf(r.withdrawal.id);
  assert.equal(row.status, 'sent');
  assert.equal(row.txid, 'txABC');
  // $20 minus the $3 TRC20 fee, in 6-decimal units.
  assert.deepEqual(sends, [{ units: usdToUnits(17, 6), address: TRON_ADDR }]);

  const list = listWithdrawals(db, 'u1');
  assert.equal(list[0].status, 'completed');
  assert.equal(list[0].txid, 'txABC');
});

test('a throwing sender parks as manual and is never retried', async () => {
  const r = enqueue({ amount: 15 });
  let calls = 0;
  const senders = { tron: async () => { calls += 1; throw new Error('rpc down'); } };
  await processQueue({ db, senders });
  assert.equal(statusOf(r.withdrawal.id).status, 'manual');
  assert.match(statusOf(r.withdrawal.id).error, /rpc down/);
  await processQueue({ db, senders });
  assert.equal(calls, 1, 'manual rows are not picked up again');
});

test('missing hot wallet parks as manual', async () => {
  const r = enqueue({ amount: 12, network: 'BEP20', address: EVM_ADDR });
  await processQueue({ db, senders: {} });
  assert.equal(statusOf(r.withdrawal.id).status, 'manual');
  assert.match(statusOf(r.withdrawal.id).error, /no_hot_wallet/);
});

test('per-withdrawal cap parks as manual; day cap queues for tomorrow', async () => {
  balance = 5000;
  const big = enqueue({ amount: 900 }); // over TF_PAYOUT_MAX_TX default 500
  // Two days ahead: earlier tests' sends fall outside this test's UTC day.
  const now = Date.now() + 48 * 3600 * 1000;
  const senders = { tron: async () => 'tx1' };
  await processQueue({ db, senders, now });
  assert.equal(statusOf(big.withdrawal.id).status, 'manual');

  // Fill today's cap (default 2000), then one more must wait...
  const a = enqueue({ amount: 499 });
  const b = enqueue({ amount: 499 });
  const c = enqueue({ amount: 499 });
  const d = enqueue({ amount: 499 });
  const e = enqueue({ amount: 499 }); // 5 × 499 = 2495 > 2000 — e exceeds the cap
  await processQueue({ db, senders, now });
  for (const w of [a, b, c, d]) assert.equal(statusOf(w.withdrawal.id).status, 'sent');
  assert.equal(statusOf(e.withdrawal.id).status, 'queued');
  assert.equal(statusOf(e.withdrawal.id).error, 'day_cap');

  // ...and sends once the UTC day rolls over.
  await processQueue({ db, senders, now: now + 24 * 3600 * 1000 + 1000 });
  assert.equal(statusOf(e.withdrawal.id).status, 'sent');
});

test('boot sweep parks rows caught mid-send', () => {
  balance = 5000;
  const r = enqueue({ amount: 25 });
  db.prepare(`UPDATE withdrawals SET status='sending' WHERE id=?`).run(r.withdrawal.id);
  const worker = startPayouts({ db, senders: {} });
  worker.stop();
  assert.equal(statusOf(r.withdrawal.id).status, 'manual');
  assert.match(statusOf(r.withdrawal.id).error, /crashed_mid_send/);
});
