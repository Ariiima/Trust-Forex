// Chain watcher — automatic on-chain payment verification (CONTRACT "Chain watcher").
// Polls public keyless endpoints every 20s, matches transfers to orders by exact
// UNIQUE-AMOUNT base-unit equality, promotes to confirmed, expires stale orders.
// Zero top-level sibling imports: index.mjs may start this while db.mjs/notify.mjs
// are still being built in parallel — only units.mjs is imported statically.
import { toBaseUnits } from './chains/units.mjs';

export const EXPIRY_MS = 40 * 60 * 1000;

async function tryImport(path) {
  try {
    return await import(path);
  } catch (e) {
    console.warn(`[watcher] optional module ${path} unavailable: ${e.message}`);
    return undefined;
  }
}

export function startWatcher({ db, notify, loadGateways, adapters, intervalMs = 20_000 } = {}) {
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
        for (const chain of ['evm', 'btc', 'tron', 'sol']) {
          const m = await tryImport(`./chains/${chain}.mjs`);
          if (m) adapters[chain] = m;
        }
      }
      if (stopped) return;
      const run = async () => {
        if (running) return; // reentrancy guard — a slow tick skips the next beat
        running = true;
        try {
          await tick({ db, notify, loadGateways, adapters });
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
export async function tick({ db, notify, loadGateways, adapters, now = Date.now() }) {
  // Liberal shims: sibling export shapes aren't contracted (see manifest assumptions).
  const dbh = db?.prepare ? db : db?.db;
  if (!dbh?.prepare) throw new Error('no usable db handle');
  const notifyFn = typeof notify === 'function'
    ? notify
    : (notify?.notifyOrderConfirmed ?? notify?.orderConfirmed ?? notify?.notify ?? (() => {}));
  let gws = await loadGateways();
  if (gws && !Array.isArray(gws)) gws = gws.gateways ?? [];

  const netIndex = new Map();
  for (const g of gws ?? []) {
    for (const n of g.networks ?? []) netIndex.set(`${g.currency}|${n.network}`, n);
  }

  // Expire stale orders with no detected tx — an order latched to a txid never expires.
  dbh.prepare(
    `UPDATE orders SET status='expired', updated_at=?
     WHERE status IN ('pending','submitted') AND txid IS NULL AND created_at < ?`,
  ).run(now, now - EXPIRY_MS);

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
      runGroup(dbh, notifyFn, grp, now).catch((e) => console.error('[watcher]', key, e.message)),
    ),
  );
}

async function runGroup(dbh, notifyFn, grp, now) {
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

  for (const t of transfers) {
    let amt;
    try {
      amt = BigInt(t.amountRaw);
    } catch {
      continue;
    }
    for (const c of candidates) {
      if (c.done) continue;
      const o = c.row;
      if (amt !== c.baseUnits) continue;
      if (t.timestamp * 1000 < o.created_at) continue; // adapter ts = unix seconds, DB = ms
      if (o.txid != null && o.txid !== t.txid) continue; // order latched to another tx
      const seen = seenStmt.get(t.txid);
      if (seen && seen.order_id !== o.id) {
        console.warn(`[watcher] tx ${t.txid} already credited to order ${seen.order_id}; skipping`);
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
            break;
          }
        }
        const res = confirmStmt.run(t.confirmations, now, now, o.id);
        c.done = true; // don't re-match this order later in the tick
        if (res.changes > 0) {
          const order = rowToOrder(readStmt.get(o.id), requiredConfirmations);
          try {
            await notifyFn(order);
          } catch (e) {
            console.error('[watcher] notify failed:', e.message);
          }
        }
        // changes === 0 -> admin override already finalized it; skip notify.
      }
      break; // a transfer pays at most one order
    }
  }
}

function rowToOrder(row, requiredConfirmations) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    planId: row.plan_id,
    billing: row.billing,
    amountUsd: row.amount_usd,
    currency: row.currency,
    network: row.network,
    amountCrypto: row.amount_crypto,
    address: row.address,
    memo: row.memo,
    status: row.status,
    txid: row.txid,
    confirmations: row.confirmations,
    requiredConfirmations, // from gateway config — not a DB column
    detectedAt: row.detected_at,
    confirmedAt: row.confirmed_at,
    createdAt: row.created_at,
  };
}
