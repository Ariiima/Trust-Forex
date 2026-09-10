// Chain watcher — automatic on-chain payment verification (CONTRACT "Chain watcher").
// Polls public keyless endpoints every 20s, matches transfers to orders by exact
// UNIQUE-AMOUNT base-unit equality, promotes to confirmed, expires stale orders.
// Zero top-level sibling imports: index.mjs may start this while db.mjs/notify.mjs
// are still being built in parallel — only units.mjs is imported statically.
import { toBaseUnits, fromBaseUnits } from './chains/units.mjs';
// Pure data + a pure function only, same reasoning as jobs.mjs/payouts.mjs:
// payment.test.mjs imports `tick` directly against an in-memory db and must
// never see this module open the real one as a side effect of import.
import { MESSAGE_TEMPLATES, renderTemplate } from './admin.mjs';

export const EXPIRY_MS = 40 * 60 * 1000;

const DEFAULT_TPL = Object.fromEntries(MESSAGE_TEMPLATES.map((t) => [t.key, t.body]));

/** Underpayment grace: a shortfall this small confirms anyway instead of
 *  parking as "incomplete". Covers the dither (up to $0.0999, see orders.mjs
 *  uniqueAmount) plus ordinary wallet/network slop, at business cost of the
 *  same $0.50 max per order. ponytail: flat USD, not a % of price — fine for
 *  real plans ($200+, <0.25%), but on a sub-$2 SKU it forgives a big chunk of
 *  the order; don't ship a plan priced under a few dollars without revisiting. */
const PAYMENT_TOLERANCE_USD = 0.5;

async function tryImport(path) {
  try {
    return await import(path);
  } catch (e) {
    console.warn(`[watcher] optional module ${path} unavailable: ${e.message}`);
    return undefined;
  }
}

// 6s, not 20: with sub-second BSC blocks a payment reaches its confirmation
// threshold within one tick, so the tick period IS the user-visible latency.
export function startWatcher({ db, notify, loadGateways, adapters, intervalMs = 6_000, templates } = {}) {
  let timer = null;
  let stopped = false;
  let running = false;

  (async () => {
    try {
      if (!db) {
        const m = await tryImport('./db.mjs');
        db = m?.db ?? m?.default;
      }
      if (!notify) notify = await tryImport('./notify.mjs');
      if (!loadGateways) {
        loadGateways = async () => {
          const { readFile } = await import('node:fs/promises');
          return JSON.parse(await readFile(new URL('./gateways.json', import.meta.url), 'utf8'));
        };
      }
      if (!adapters) {
        adapters = {};
        for (const chain of ['evm', 'btc', 'tron', 'sol', 'ton']) {
          const m = await tryImport(`./chains/${chain}.mjs`);
          if (m) adapters[chain] = m;
        }
      }
      if (stopped) return;
      const run = async () => {
        if (running) return; // reentrancy guard — a slow tick skips the next beat
        running = true;
        try {
          await tick({ db, notify, loadGateways, adapters, templates });
        } catch (e) {
          console.error('[watcher] tick failed:', e);
        } finally {
          running = false;
        }
      };
      await run();
      if (stopped) return;
      timer = setInterval(run, intervalMs);
      timer.unref?.();
    } catch (e) {
      console.error('[watcher] failed to start:', e);
    }
  })();

  return {
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
    },
  };
}

// Exported for tests — pure function of its inputs, no timers.
export async function tick({ db, notify, loadGateways, adapters, now = Date.now(), refund, templates }) {
  // Liberal shims: sibling export shapes aren't contracted (see manifest assumptions).
  const dbh = db?.prepare ? db : db?.db;
  if (!dbh?.prepare) throw new Error('no usable db handle');
  const notifyFn = typeof notify === 'function'
    ? notify
    : (notify?.notifyOrderConfirmed ?? notify?.orderConfirmed ?? notify?.notify ?? (() => {}));
  const refundFn = refund ?? notify?.refundPartialOrder ?? (() => {});
  let gws = await loadGateways();
  if (gws && !Array.isArray(gws)) gws = gws.gateways ?? [];

  const netIndex = new Map();
  for (const g of gws ?? []) {
    for (const n of g.networks ?? []) netIndex.set(`${g.currency}|${n.network}`, n);
  }

  // Expire stale orders with no detected activity — an order latched to a txid
  // never expires; a human outcome is owed for it.
  dbh.prepare(
    `UPDATE orders SET status='expired', updated_at=?
     WHERE status IN ('pending','submitted') AND txid IS NULL AND detected_at IS NULL AND created_at < ?`,
  ).run(now, now - EXPIRY_MS);

  /* A partially-paid order the payer walked away from: 40 min after the LAST
     payment activity (updated_at moves on every partial), give up — expire it
     and hand what was paid back as earning balance via the refund hook. */
  const stalePartials = dbh.prepare(
    `SELECT * FROM orders WHERE status IN ('pending','submitted')
       AND paid_units IS NOT NULL AND updated_at < ?`,
  ).all(now - EXPIRY_MS);
  for (const row of stalePartials) {
    const res = dbh.prepare(
      `UPDATE orders SET status='expired', updated_at=? WHERE id=? AND status IN ('pending','submitted')`,
    ).run(now, row.id);
    if (res.changes === 0) continue;
    let paidUsd = 0;
    try {
      const g = netIndex.get(`${row.currency}|${row.network}`);
      const due = BigInt(toBaseUnits(row.amount_crypto, g?.decimals ?? 6));
      const paid = BigInt(row.paid_units);
      paidUsd = Math.min(Math.round(row.amount_usd * Number((paid * 10000n) / due)) / 10000, row.amount_usd);
      paidUsd = Math.round(paidUsd * 100) / 100;
    } catch (e) {
      console.error(`[watcher] refund math failed for ${row.id}:`, e.message);
    }
    try {
      await refundFn(row, paidUsd);
    } catch (e) {
      console.error('[watcher] refund failed:', e.message);
    }
  }

  const rows = dbh.prepare(
    `SELECT * FROM orders
     WHERE status IN ('pending','submitted')
       AND currency IS NOT NULL AND address IS NOT NULL AND amount_crypto IS NOT NULL`,
  ).all();

  // Group by (chain, rpc, address, tokenContract). rpc is in the key because the same
  // EVM address is routinely reused across ETH/BSC/Polygon — each rpc needs its own query.
  const groups = new Map();
  const skipLogged = new Set();
  for (const row of rows) {
    const nk = `${row.currency}|${row.network}`;
    const g = netIndex.get(nk);
    if (!g || g.manualOnly || !adapters?.[g.chain]) {
      if (!skipLogged.has(nk)) {
        skipLogged.add(nk);
        console.warn(`[watcher] skipping ${nk}: ${!g ? 'no gateway entry' : g.manualOnly ? 'manualOnly' : `no ${g.chain} adapter`}`);
      }
      continue;
    }
    const evm = g.chain === 'evm';
    const addrKey = evm ? String(g.address).toLowerCase() : g.address;
    const tokenKey = g.tokenContract ? (evm ? g.tokenContract.toLowerCase() : g.tokenContract) : '';
    const key = `${g.chain}|${g.rpc ?? ''}|${addrKey}|${tokenKey}`;
    let grp = groups.get(key);
    if (!grp) {
      groups.set(key, (grp = {
        adapter: adapters[g.chain],
        chain: g.chain,
        rpc: g.rpc,
        address: g.address,
        tokenContract: g.tokenContract,
        decimals: g.decimals,
        requiredConfirmations: g.requiredConfirmations,
        orders: [],
      }));
    }
    grp.orders.push(row);
  }

  // One adapter call per group; a failing group logs and never affects the others.
  await Promise.allSettled(
    [...groups.entries()].map(([key, grp]) =>
      runGroup(dbh, notifyFn, grp, now, templates).catch((e) => console.error('[watcher]', key, e.message)),
    ),
  );
}

async function runGroup(dbh, notifyFn, grp, now, templates) {
  const { adapter, rpc, address, tokenContract, decimals, requiredConfirmations, orders } = grp;
  const sinceTs = Math.floor(Math.min(...orders.map((o) => o.created_at)) / 1000);
  const transfers = await adapter.listIncoming({ address, tokenContract, decimals, sinceTs, rpc });

  const candidates = [];
  for (const o of orders) {
    try {
      candidates.push({ row: o, baseUnits: BigInt(toBaseUnits(o.amount_crypto, decimals)), done: false });
    } catch (e) {
      console.warn(`[watcher] order ${o.id} unusable amount_crypto ${o.amount_crypto}: ${e.message}`);
    }
  }
  // Oldest first — deterministic resolution if dither ever produced a duplicate amount.
  candidates.sort((a, b) => a.row.created_at - b.row.created_at);

  const seenStmt = dbh.prepare('SELECT order_id FROM seen_txs WHERE txid = ?');
  const detectStmt = dbh.prepare(
    `UPDATE orders SET txid=?, confirmations=?, detected_at=COALESCE(detected_at, ?), updated_at=?
     WHERE id=? AND status IN ('pending','submitted')`,
  );
  const insertSeen = dbh.prepare('INSERT OR IGNORE INTO seen_txs (txid, order_id) VALUES (?, ?)');
  const confirmStmt = dbh.prepare(
    `UPDATE orders SET status='confirmed', confirmations=?, confirmed_at=?, updated_at=?
     WHERE id=? AND status IN ('pending','submitted')`,
  );
  const readStmt = dbh.prepare('SELECT * FROM orders WHERE id = ?');

  /* notify.mjs reads the raw snake_case row (same shape orders.mjs hands it on
     the balance-settled path) — a camelCase copy silently lost order.user_id,
     i.e. no booking and no buyer DM. */
  const confirmAndNotify = async (o, res, overpaidUsd = 0) => {
    if (res.changes > 0) {
      try {
        await notifyFn(readStmt.get(o.id), overpaidUsd);
      } catch (e) {
        console.error('[watcher] notify failed:', e.message);
      }
    }
    // changes === 0 -> admin override already finalized it; skip notify.
  };

  for (const t of transfers) {
    let amt;
    try {
      amt = BigInt(t.amountRaw);
    } catch {
      continue;
    }
    let consumed = false;
    for (const c of candidates) {
      if (c.done) continue;
      const o = c.row;
      if (amt !== c.baseUnits) continue;
      if (t.timestamp * 1000 < o.created_at) continue; // adapter ts = unix seconds, DB = ms
      if (o.txid != null && o.txid !== t.txid) continue; // order latched to another tx
      const seen = seenStmt.get(t.txid);
      if (seen && seen.order_id !== o.id) {
        console.warn(`[watcher] tx ${t.txid} already credited to order ${seen.order_id}; skipping`);
        consumed = true;
        break; // transfer consumed elsewhere — never credit twice
      }
      // Detection: record txid + confirmations, status unchanged.
      detectStmt.run(t.txid, t.confirmations, now, now, o.id);
      o.txid = t.txid;
      o.confirmations = t.confirmations;
      if (t.confirmations >= requiredConfirmations) {
        // seen_txs insert FIRST — the double-credit guard.
        const ins = insertSeen.run(t.txid, o.id);
        if (ins.changes === 0) {
          const existing = seenStmt.get(t.txid);
          if (existing && existing.order_id !== o.id) {
            console.warn(`[watcher] double-credit blocked: tx ${t.txid} -> order ${existing.order_id}`);
            consumed = true;
            break;
          }
        }
        const res = confirmStmt.run(t.confirmations, now, now, o.id);
        c.done = true; // don't re-match this order later in the tick
        await confirmAndNotify(o, res);
      }
      consumed = true;
      break; // a transfer pays at most one order
    }

    /* Wrong-amount transfer. When exactly ONE live order is waiting on this
       address, attribute it as a partial (or over-) payment of that order:
       sum the arrivals and confirm once the total covers what is due. Only
       final transfers are summed (a reorged partial must not inflate the
       total), and only up to 3x the due amount — the receiving wallet also
       sees unrelated deposits, and a big one must not buy a stranger's order.

       Everything else is parked in `unmatched_txs` for a human. With 2+ live
       orders attribution is genuinely undecidable: the amount is the only
       identity a payment carries, and the sender is no help — exchange
       withdrawals all share one hot wallet, so guessing from `from` would
       credit one user's money to another's order. */
    if (consumed) continue;
    if (seenStmt.get(t.txid)) continue; // already counted (for this or another order)
    // Not final yet: reconsidered next tick. Checked before parking so the
    // admin screen never offers a transfer that could still be reorged away.
    if (t.confirmations < requiredConfirmations) continue;
    const live = candidates.filter((c) => !c.done);
    const park = (reason) => parkUnmatched(dbh, grp, t, reason, now);
    if (live.length !== 1) {
      park(live.length > 1 ? 'ambiguous' : 'no_live_order');
      continue;
    }
    const c = live[0];
    const o = c.row;
    if (t.timestamp * 1000 < o.created_at) { park('predates_order'); continue; }
    if (amt > c.baseUnits * 3n) { park('too_large'); continue; }
    const outcome = await creditPartial({
      dbh, notifyFn, templates, order: o, dueUnits: c.baseUnits, amount: amt,
      txid: t.txid, confirmations: t.confirmations, decimals: grp.decimals, now,
    });
    if (outcome === 'confirmed') c.done = true;
  }
}

/** Park a transfer the watcher would not attribute on its own. Upsert: the same
 *  transfer is re-seen on every tick until it is resolved — and resolving it
 *  writes a seen_txs row, which is what finally stops it being reconsidered. */
function parkUnmatched(dbh, grp, t, reason, now) {
  const order = grp.orders[0]; // one chain+address+token ⇒ one (currency, network)
  dbh.prepare(
    `INSERT INTO unmatched_txs
       (txid, chain, currency, network, address, sender, amount_raw, decimals, amount, reason, seen_at, tx_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(txid) DO UPDATE SET reason=excluded.reason`,
  ).run(
    t.txid, grp.chain, order?.currency ?? null, order?.network ?? null, grp.address, t.from ?? null,
    String(t.amountRaw), grp.decimals, fromBaseUnits(String(t.amountRaw), grp.decimals),
    reason, now, t.timestamp ? t.timestamp * 1000 : null,
  );
}

/**
 * Credit `amount` base units to `order` as a partial payment, confirming it
 * once the running total covers what is due (less the underpayment grace).
 *
 * The ONE place partial-payment money is booked — the watcher's single-live-
 * order path and the admin's manual attribution both come through here, so a
 * hand-attributed transfer settles by exactly the same arithmetic, sends the
 * same DM and returns the same overpayment to the earning balance.
 *
 * Returns 'confirmed' or 'partial'.
 */
export async function creditPartial({
  dbh, notifyFn, templates, order: o, dueUnits, amount, txid, confirmations, decimals, now = Date.now(),
}) {
  dbh.prepare('INSERT OR IGNORE INTO seen_txs (txid, order_id) VALUES (?, ?)').run(txid, o.id);
  const paid = BigInt(o.paid_units ?? '0') + amount;
  o.paid_units = paid.toString();
  o.txid = txid;
  // Tolerance in this order's own units, via the same amount_crypto/amount_usd
  // ratio the paidUsd display math already uses — no extra rate lookup.
  const toleranceUnits = BigInt(
    toBaseUnits(((Number(o.amount_crypto) * PAYMENT_TOLERANCE_USD) / o.amount_usd).toFixed(decimals), decimals),
  );
  const threshold = dueUnits > toleranceUnits ? dueUnits - toleranceUnits : 0n;
  dbh.prepare(
    `UPDATE orders SET paid_units=?, txid=?, confirmations=?, detected_at=COALESCE(detected_at, ?), updated_at=?
     WHERE id=? AND status IN ('pending','submitted')`,
  ).run(o.paid_units, txid, confirmations, now, now, o.id);

  if (paid < threshold) {
    console.log(`[watcher] partial payment on ${o.id}: ${o.paid_units}/${dueUnits} base units`);
    /* The payer has usually closed the page by the time an underpayment is
       discovered — Telegram is the channel that still reaches them. Once
       per partial tx (this branch is behind the seen_txs guard). */
    if (o.user_id) {
      try {
        const { sendMessage, appButton } = await import('./telegram.mjs');
        const body = renderTemplate(templates?.('payment_incomplete') ?? DEFAULT_TPL.payment_incomplete, {
          received: fromBaseUnits(o.paid_units, decimals), due: o.amount_crypto,
          remaining: fromBaseUnits((dueUnits - paid).toString(), decimals),
          currency: o.currency, network: o.network, address: o.address,
        });
        await sendMessage(o.user_id, body, appButton());
      } catch (e) {
        console.error('[watcher] partial DM failed:', e.message);
      }
    }
    return 'partial';
  }

  const res = dbh.prepare(
    `UPDATE orders SET status='confirmed', txid=?, confirmations=?, confirmed_at=?, updated_at=?
     WHERE id=? AND status IN ('pending','submitted')`,
  ).run(txid, confirmations, now, now, o.id);
  /* Overpayment: same amount_crypto/amount_usd ratio the display math uses.
     The order is paid; the excess belongs to the user, so it goes back as
     earning balance rather than sitting on our side of the books. */
  const overUnits = paid > dueUnits ? paid - dueUnits : 0n;
  const overpaidUsd = overUnits > 0n
    ? Math.round((o.amount_usd * Number((overUnits * 10000n) / dueUnits)) / 100) / 100
    : 0;
  // changes === 0 -> admin override already finalized it; skip notify.
  if (res.changes > 0) {
    try {
      await notifyFn(dbh.prepare('SELECT * FROM orders WHERE id = ?').get(o.id), overpaidUsd);
    } catch (e) {
      console.error('[watcher] notify failed:', e.message);
    }
  }
  return 'confirmed';
}

/** Reasons an attribution is refused, as returned to the admin UI. */
export const ATTRIBUTE_ERRORS = [
  'not_found', 'already_resolved', 'already_credited',
  'order_not_found', 'order_not_open', 'order_has_no_invoice', 'network_mismatch',
];

/**
 * Manual confirmation: settle an open order in full by hand, for money the
 * watcher will never see — paid on a chain we don't poll, sent from an
 * exchange that never landed, or handed over off-platform. Books the whole
 * remaining due through the same creditPartial() everything else uses, so the
 * DM, the ledger credit and the invite all fire exactly as usual.
 *
 * ponytail: provenance is the synthetic `manual:<order id>` txid, no extra
 * audit column. Add one if operators ever need "who confirmed this".
 */
export async function confirmOrderManually({
  db, notify, templates, orderId, loadGateways, now = Date.now(),
}) {
  const dbh = db?.prepare ? db : db?.db;
  const o = dbh.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!o) return { error: 'order_not_found' };
  if (!['pending', 'submitted'].includes(o.status)) return { error: 'order_not_open' };
  if (!o.amount_crypto || !o.currency) return { error: 'order_has_no_invoice' };

  let gws = await loadGateways();
  if (gws && !Array.isArray(gws)) gws = gws.gateways ?? [];
  const g = gws?.find((x) => x.currency === o.currency)?.networks?.find((n) => n.network === o.network);
  const decimals = g?.decimals ?? 6;
  const dueUnits = BigInt(toBaseUnits(o.amount_crypto, decimals));
  const paid = BigInt(o.paid_units ?? '0');

  const notifyFn = typeof notify === 'function'
    ? notify
    : (notify?.notifyOrderConfirmed ?? notify?.orderConfirmed ?? notify?.notify ?? (() => {}));
  const result = await creditPartial({
    dbh, notifyFn, templates, order: o, dueUnits,
    amount: dueUnits > paid ? dueUnits - paid : 0n,
    txid: `manual:${o.id}`, confirmations: g?.requiredConfirmations ?? 1, decimals, now,
  });
  return { result, order: dbh.prepare('SELECT * FROM orders WHERE id = ?').get(o.id) };
}

/**
 * Manual attribution: book a parked transfer against an order an admin chose,
 * exactly as the watcher would have had the amount been unambiguous.
 * Returns { result, order } or { error }.
 */
export async function attributeUnmatched({
  db, notify, templates, txid, orderId, by = null, loadGateways, now = Date.now(),
}) {
  const dbh = db?.prepare ? db : db?.db;
  const tx = dbh.prepare('SELECT * FROM unmatched_txs WHERE txid = ?').get(txid);
  if (!tx) return { error: 'not_found' };
  if (tx.resolution) return { error: 'already_resolved' };
  // Belt and braces: seen_txs is the double-credit guard the watcher uses, and
  // this path must never be the one that spends the same transfer twice.
  if (dbh.prepare('SELECT 1 FROM seen_txs WHERE txid = ?').get(txid)) return { error: 'already_credited' };

  const o = dbh.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!o) return { error: 'order_not_found' };
  if (!['pending', 'submitted'].includes(o.status)) return { error: 'order_not_open' };
  if (!o.amount_crypto || !o.currency) return { error: 'order_has_no_invoice' };
  /* Crediting a TRON transfer to an ERC-20 order would book money that never
     reached that order's address. The one mistake this screen could make that
     the watcher never can, so it is refused rather than warned about. */
  if (tx.currency && (tx.currency !== o.currency || tx.network !== o.network)) return { error: 'network_mismatch' };

  let gws = await loadGateways();
  if (gws && !Array.isArray(gws)) gws = gws.gateways ?? [];
  const g = gws?.find((x) => x.currency === o.currency)?.networks?.find((n) => n.network === o.network);
  const decimals = g?.decimals ?? tx.decimals;

  const notifyFn = typeof notify === 'function'
    ? notify
    : (notify?.notifyOrderConfirmed ?? notify?.orderConfirmed ?? notify?.notify ?? (() => {}));
  const result = await creditPartial({
    dbh, notifyFn, templates, order: o, dueUnits: BigInt(toBaseUnits(o.amount_crypto, decimals)),
    amount: BigInt(tx.amount_raw), txid, confirmations: g?.requiredConfirmations ?? 1, decimals, now,
  });
  dbh.prepare('UPDATE unmatched_txs SET resolution=?, order_id=?, resolved_by=?, resolved_at=? WHERE txid=?')
    .run('attributed', orderId, by, now, txid);
  return { result, order: dbh.prepare('SELECT * FROM orders WHERE id = ?').get(orderId) };
}

/**
 * Dismiss a parked transfer as not-a-payment (an unrelated deposit into the
 * wallet). Writes seen_txs so the watcher stops re-parking it every tick.
 */
export function ignoreUnmatched({ db, txid, by = null, now = Date.now() }) {
  const dbh = db?.prepare ? db : db?.db;
  const tx = dbh.prepare('SELECT * FROM unmatched_txs WHERE txid = ?').get(txid);
  if (!tx) return { error: 'not_found' };
  if (tx.resolution) return { error: 'already_resolved' };
  dbh.prepare('INSERT OR IGNORE INTO seen_txs (txid, order_id) VALUES (?, NULL)').run(txid);
  dbh.prepare('UPDATE unmatched_txs SET resolution=?, resolved_by=?, resolved_at=? WHERE txid=?')
    .run('ignored', by, now, txid);
  return { ok: true };
}

