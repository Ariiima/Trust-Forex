// Payment-path checks: server-side pricing, unique-amount dithering, and the
// watcher's match/confirm/double-credit behaviour. Run: node --test server/
import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from './db.mjs';
import { handleOrders, uniqueAmount, PLAN_PRICES } from './orders.mjs';
import { tick, EXPIRY_MS } from './watcher.mjs';
import { toBaseUnits } from './chains/units.mjs';

const store = openDb(':memory:');

/** Minimal req/res/ctx to drive handleOrders without an HTTP server. */
function call(method, path, body) {
  let sent;
  const res = {
    writeHead() {},
    end(json) {
      sent = JSON.parse(json);
    },
  };
  const ctx = {
    db: store,
    admin: { campaignEngine: { checkCode: () => ({ error: 'invalid_code' }) } },
    userId: 1,
    adminUserId: 'u1',
    username: 'tester',
    readBody: async () => body,
  };
  return handleOrders({ method }, res, new URL(`http://x${path}`), ctx).then((handled) => {
    assert.equal(handled, true);
    return sent;
  });
}

test('order price comes from the server table, not the client body', async () => {
  const { order } = await call('POST', '/api/orders', { planId: 'silver', amountUsd: 0.01 });
  assert.equal(order.amountUsd, PLAN_PRICES.silver);
  assert.equal(order.status, 'pending');
});

test('unknown plan is refused', async () => {
  const out = await call('POST', '/api/orders', { planId: 'platinum', amountUsd: 49 });
  assert.equal(out.error, 'invalid_order');
});

test('uniqueAmount never asks for less than the USD price and never collides', () => {
  const seen = new Set();
  for (let i = 0; i < 20; i += 1) {
    const amt = uniqueAmount({
      amountUsd: 49, rate: 1, currency: 'USDT', network: 'TRC-20', address: 'TAddr',
      db: { amountTaken: (c, n, a, v) => seen.has(v) },
    });
    assert.ok(Number(amt) >= 49, `${amt} >= 49`);
    assert.ok(!seen.has(amt));
    seen.add(amt);
  }
});

/** Seed a selected order the watcher can match. Created a minute ago: the
 *  adapter reports whole-second timestamps, and a same-instant order would
 *  (correctly) look newer than its own payment. */
function seedOrder(id, amountCrypto, createdAt = Date.now() - 60_000, amountUsd = 49) {
  store.createOrder({ id, userId: 1, username: 'tester', planId: 'silver', billing: 'monthly', amountUsd });
  store.updateOrder(id, { currency: 'USDT', network: 'TRC-20', amount_crypto: amountCrypto, address: 'TAddr' });
  store.db.prepare('UPDATE orders SET created_at = ? WHERE id = ?').run(createdAt, id);
}

const GATEWAYS = [{
  currency: 'USDT',
  networks: [{ network: 'TRC-20', address: 'TAddr', chain: 'tron', decimals: 6, requiredConfirmations: 1 }],
}];

const transferOf = (amount, txid) => ({
  txid, amountRaw: toBaseUnits(amount, 6), timestamp: Math.floor(Date.now() / 1000), confirmations: 1,
});

test('watcher confirms on exact amount match and never credits a tx twice', async () => {
  seedOrder('o1', '49.0123');
  const notified = [];
  const adapters = { tron: { listIncoming: async () => [transferOf('49.0123', 'tx1')] } };
  const args = {
    db: store, notify: (o) => notified.push(o.id),
    loadGateways: async () => GATEWAYS, adapters,
  };

  await tick(args);
  assert.equal(store.getOrder('o1').status, 'confirmed');
  assert.deepEqual(notified, ['o1']);

  // Same tx again, new order waiting on the same amount: must NOT be credited.
  seedOrder('o2', '49.0123');
  await tick(args);
  assert.equal(store.getOrder('o2').status, 'pending');
  assert.equal(notified.length, 1);
});

test('wrong amount does not match; stale orders expire', async () => {
  seedOrder('o3', '49.5555', Date.now() - EXPIRY_MS - 1000);
  seedOrder('o4', '49.7777');
  const adapters = { tron: { listIncoming: async () => [transferOf('49.9999', 'tx2')] } };
  await tick({ db: store, notify: () => {}, loadGateways: async () => GATEWAYS, adapters });
  assert.equal(store.getOrder('o3').status, 'expired'); // too old, no tx
  assert.equal(store.getOrder('o4').status, 'pending'); // amount mismatch
});

test('partial payments accumulate and confirm when the sum covers the order', async () => {
  // Single-candidate attribution needs a lone live order — retire leftovers.
  store.db.prepare(`UPDATE orders SET status='expired' WHERE status IN ('pending','submitted')`).run();
  seedOrder('p1', '50.0000');
  const notified = [];
  const args = {
    db: store, notify: (o) => notified.push(o.id), loadGateways: async () => GATEWAYS,
  };

  // Underpay: 20 of 50 — detected, summed, NOT confirmed.
  args.adapters = { tron: { listIncoming: async () => [transferOf('20', 'ptxA')] } };
  await tick(args);
  let row = store.getOrder('p1');
  assert.equal(row.status, 'pending');
  assert.equal(row.paid_units, toBaseUnits('20', 6));
  const asOrder = store.rowToOrder(row, { gateways: GATEWAYS });
  assert.equal(asOrder.paidUsd, 19.6); // 20/50.0 of $49
  assert.equal(asOrder.remainingCrypto, '30');

  // Second transfer covers the rest (20 + 31 >= 50) — confirmed via sum.
  args.adapters = { tron: { listIncoming: async () => [transferOf('20', 'ptxA'), transferOf('31', 'ptxB')] } };
  await tick(args);
  row = store.getOrder('p1');
  assert.equal(row.status, 'confirmed');
  assert.equal(row.txid, 'ptxB');
  assert.deepEqual(notified, ['p1']);

  // Replay of both transfers is a no-op (seen_txs guard).
  await tick(args);
  assert.equal(store.getOrder('p1').paid_units, (BigInt(toBaseUnits('20', 6)) + BigInt(toBaseUnits('31', 6))).toString());
});

test('a shortfall within the $0.50 grace confirms; past it stays incomplete', async () => {
  store.db.prepare(`UPDATE orders SET status='expired' WHERE status IN ('pending','submitted')`).run();
  // $200 order, 1:1 stable rate -> tolerance is $0.50 worth of tokens = 0.5.
  seedOrder('t1', '200.0000', Date.now() - 60_000, 200);
  const notified = [];
  const args = { db: store, notify: (o) => notified.push(o.id), loadGateways: async () => GATEWAYS };

  // Short by 0.49 (< 0.50 tolerance) -> confirms anyway.
  args.adapters = { tron: { listIncoming: async () => [transferOf('199.51', 'ttxA')] } };
  await tick(args);
  assert.equal(store.getOrder('t1').status, 'confirmed');
  assert.deepEqual(notified, ['t1']);

  seedOrder('t2', '200.0000', Date.now() - 60_000, 200);
  // Short by 0.51 (> 0.50 tolerance) -> parked as incomplete, not confirmed.
  args.adapters = { tron: { listIncoming: async () => [transferOf('199.49', 'ttxB')] } };
  await tick(args);
  assert.equal(store.getOrder('t2').status, 'pending');
});

test('overpayment confirms and hands the excess back as earning balance', async () => {
  store.db.prepare(`UPDATE orders SET status='expired' WHERE status IN ('pending','submitted')`).run();
  seedOrder('v1', '50.0000'); // $49 due, 1 crypto unit = $0.98
  const notified = [];
  await tick({
    db: store, loadGateways: async () => GATEWAYS,
    notify: (o, over) => notified.push([o.id, over]),
    adapters: { tron: { listIncoming: async () => [transferOf('60', 'vtxA')] } },
  });

  assert.equal(store.getOrder('v1').status, 'confirmed');
  // 10 of 50 tokens over = $9.80 of the $49, credited to the wallet by notify.
  assert.deepEqual(notified, [['v1', 9.8]]);
  // The confirmed sheet reads these: paid is NOT clamped to what was due.
  const asOrder = store.rowToOrder(store.getOrder('v1'), { gateways: GATEWAYS });
  assert.equal(asOrder.paidUsd, 58.8);
  assert.equal(asOrder.overpaidUsd, 9.8);
  assert.equal(asOrder.remainingUsd, 0);
});

test('partial attribution is refused with 2+ live orders or oversized deposits', async () => {
  seedOrder('p2', '60.0000');
  seedOrder('p3', '61.0000');
  const args = {
    db: store, notify: () => {}, loadGateways: async () => GATEWAYS,
    adapters: { tron: { listIncoming: async () => [transferOf('10', 'ptxC')] } },
  };
  await tick(args); // two live orders -> ambiguous -> ignored
  assert.equal(store.getOrder('p2').paid_units, null);
  assert.equal(store.getOrder('p3').paid_units, null);

  // Down to one live order: a deposit over 3x due is not a payment attempt.
  store.updateOrder('p3', { status: 'expired' });
  args.adapters = { tron: { listIncoming: async () => [transferOf('500', 'ptxD')] } };
  await tick(args);
  assert.equal(store.getOrder('p2').paid_units, null);
});

test('a partial payment survives 40 min of activity, then expires into a refund', async () => {
  const refunds = [];
  const args = {
    db: store, notify: () => {}, loadGateways: async () => GATEWAYS, adapters: {},
    refund: (row, usd) => refunds.push([row.id, usd]),
  };

  // Recent activity (updated_at fresh): stays pending, nothing refunded.
  seedOrder('p4', '70.0000', Date.now() - EXPIRY_MS - 1000);
  store.updateOrder('p4', { paid_units: toBaseUnits('10', 6), detected_at: Date.now() });
  await tick(args);
  assert.equal(store.getOrder('p4').status, 'pending');
  assert.equal(refunds.length, 0);

  // 40 min after the last partial: expired, paid share refunded in USD.
  store.db.prepare('UPDATE orders SET updated_at = ? WHERE id = ?').run(Date.now() - EXPIRY_MS - 1000, 'p4');
  await tick(args);
  assert.equal(store.getOrder('p4').status, 'expired');
  assert.deepEqual(refunds, [['p4', 7]]); // 10/70 of $49

  // Re-sweeping is a no-op.
  await tick(args);
  assert.equal(refunds.length, 1);
});

test('order creation resumes a partially-paid order and sweeps empty ones', async () => {
  store.db.prepare(`UPDATE orders SET status='expired' WHERE status IN ('pending','submitted')`).run();

  // An untouched pending order is retired when the user starts a new checkout.
  const first = await call('POST', '/api/orders', { planId: 'silver' });
  const second = await call('POST', '/api/orders', { planId: 'silver' });
  assert.equal(store.getOrder(first.order.id).status, 'expired');
  assert.equal(second.order.status, 'pending');

  // Give the live order a partial payment: creation now RESUMES it...
  store.updateOrder(second.order.id, {
    currency: 'USDT', network: 'TRC-20', amount_crypto: '49.9999', address: 'TAddr',
    paid_units: toBaseUnits('20', 6), detected_at: Date.now(),
  });
  const third = await call('POST', '/api/orders', { planId: 'gold' });
  assert.equal(third.order.id, second.order.id);
  assert.equal(third.resumed, true);
  assert.equal(third.order.address, 'TAddr'); // client skips pickers on this

  // ...and re-selecting it (which would re-dither the amount) is refused.
  const sel = await call('POST', `/api/orders/${second.order.id}/select`, { currency: 'USDT', network: 'TRC-20' });
  assert.equal(sel.error, 'order_partially_paid');
});
