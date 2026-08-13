/**
 * The payment routes from design/CONTRACT.md: gateways, order creation,
 * currency selection, submission, and the read the status screens poll.
 *
 * Two pieces carry the weight:
 *
 *  - **Rates.** CoinGecko, 60s cache, stablecoins pinned to 1. A failed lookup
 *    refuses the order rather than guessing — a wrong rate is a wrong price.
 *  - **Unique amounts.** Many users pay the same wallet, so each live order
 *    gets its own amount, dithered in the last three decimals. That amount IS
 *    the identifier the watcher matches on, so it must be unique among every
 *    non-final order sharing a (currency, network, address).
 */
import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { canonicalAmount, findGateway } from './db.mjs';

const GATEWAYS_PATH = new URL('./gateways.json', import.meta.url);

/** Display decimals per currency — the dither occupies the last three. */
const DISPLAY_DECIMALS = { USDT: 4, USDC: 4, DAI: 4, BTC: 8, ETH: 8, BNB: 8, SOL: 6, TRX: 6, TON: 6 };

/** USD price per plan — mirror of `checkoutPrice` in src/screens/plans/plans-data.ts.
 *  The server prices every order from this table; the client's amountUsd is
 *  display-only, because a price taken from the request body is a price the
 *  sender picked. */
export const PLAN_PRICES = { silver: 2, gold: 499, diamond: 1699 }; // ponytail: silver at $2 for testing, revert before launch

/** CoinGecko ids. Stablecoins are absent on purpose: they are pinned to 1. */
const COINGECKO_IDS = {
  BTC: 'bitcoin', ETH: 'ethereum', BNB: 'binancecoin', SOL: 'solana', TRX: 'tron', TON: 'the-open-network',
};
const STABLE = new Set(['USDT', 'USDC', 'DAI']);

const RATE_TTL_MS = 60_000;
const rateCache = new Map(); // currency -> { rate, at }

/** Re-read on every call: gateways.json is a hand-edited admin file, and
 *  restarting the API to add a wallet is not a deploy anyone should need. */
export function loadGateways() {
  try {
    return JSON.parse(readFileSync(GATEWAYS_PATH, 'utf8'));
  } catch {
    return { gateways: [] };
  }
}

/**
 * USD per unit of `currency`. Throws rather than returning a guess — pricing an
 * order off a stale or invented rate is how someone pays a third of the price.
 */
export async function usdRate(currency) {
  if (STABLE.has(currency)) return 1;
  const hit = rateCache.get(currency);
  if (hit && Date.now() - hit.at < RATE_TTL_MS) return hit.rate;

  const id = COINGECKO_IDS[currency];
  if (!id) throw new Error(`no_rate_source:${currency}`);
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    { signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error('rate_unavailable');
  const body = await res.json();
  const rate = Number(body?.[id]?.usd);
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('rate_unavailable');
  rateCache.set(currency, { rate, at: Date.now() });
  return rate;
}

/**
 * A crypto amount nobody else is currently waiting on.
 *
 * The dither is added, never subtracted, so the user is never asked for less
 * than the plan costs. `amountTaken` is checked against live orders on the same
 * address, because that is the set the watcher will be matching within.
 */
export function uniqueAmount({ amountUsd, rate, currency, network, address, db }) {
  const decimals = DISPLAY_DECIMALS[currency] ?? 6;
  const step = 10 ** -decimals;
  const base = amountUsd / rate;

  for (let attempt = 0; attempt < 50; attempt += 1) {
    // Round the base UP to the display precision, then dither the last 3 places.
    const rounded = Math.ceil(base / step) * step;
    const candidate = canonicalAmount((rounded + randomInt(1, 1000) * step).toFixed(decimals));
    if (!db.amountTaken(currency, network, address, candidate)) return candidate;
  }
  throw new Error('amount_collision');
}

const send = (res, code, body) => {
  const json = JSON.stringify(body);
  res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(json) });
  res.end(json);
};

/**
 * Handle the order routes. Returns false when the path is not one of ours, so
 * the caller falls through to the rest of the Mini App surface.
 *
 * `ctx` carries the request's authenticated user and the two stores.
 */
export async function handleOrders(req, res, url, ctx) {
  const { db, admin, userId, adminUserId, username, readBody } = ctx;
  const path = url.pathname;
  const gateways = loadGateways();

  /* GET /api/gateways — only networks with an address configured. An entry
     with no wallet is not a payment option, it is a way to lose a payment. */
  if (req.method === 'GET' && path === '/api/gateways') {
    const list = (gateways.gateways ?? [])
      .map((g) => ({
        currency: g.currency,
        name: g.name,
        networks: (g.networks ?? [])
          .filter((n) => n.address && !n.disabled)
          .map((n) => ({ network: n.network, address: n.address, memo: n.memo })),
      }))
      .filter((g) => g.networks.length);
    return send(res, 200, { gateways: list }), true;
  }

  // POST /api/orders { planId, billing, code? } -> { order } (amountUsd is server-priced)
  if (req.method === 'POST' && path === '/api/orders') {
    const body = await readBody(req);

    /* Money in flight wins over a fresh checkout: a live order holding a
       partial payment is resumed (the client lands straight on the receive
       screen showing the remaining amount) instead of stranding the funds
       behind a new order. */
    const open = db.db.prepare(
      `SELECT * FROM orders WHERE user_id=? AND status IN ('pending','submitted')
         AND paid_units IS NOT NULL ORDER BY created_at DESC LIMIT 1`,
    ).get(userId);
    if (open) return send(res, 200, { order: db.rowToOrder(open, gateways), resumed: true }), true;

    /* Abandoned empty checkouts pile up as live orders on the same address and
       make partial-payment attribution ambiguous — retire them on re-entry. */
    db.db.prepare(
      `UPDATE orders SET status='expired', updated_at=?
       WHERE user_id=? AND status='pending' AND txid IS NULL AND detected_at IS NULL`,
    ).run(Date.now(), userId);

    const amountUsd = PLAN_PRICES[body.planId];
    if (!amountUsd) {
      return send(res, 400, { error: 'invalid_order' }), true;
    }
    /* A discount is applied here, server-side, against the code's own record.
       Trusting the client's total would let anyone post amountUsd: 1. */
    let priced = amountUsd;
    let code = null;
    if (body.code) {
      const check = admin.campaignEngine.checkCode(body.code, adminUserId, body.planId);
      if (check.error) return send(res, 400, { error: check.error }), true;
      priced = Math.round(amountUsd * (1 - check.percent / 100) * 100) / 100;
      code = check.code;
    }

    /* "Use earning balance": the wallet covers what it can, and the crypto leg
       is priced on the remainder. This is an INTENT — nothing leaves the wallet
       until the order confirms (ledger.spendBalance, called from
       reconcileOrders), so an order that is abandoned or expires costs the user
       nothing and no expiry path owes a reversal. */
    let fromBalance = 0;
    if (body.useBalance) {
      const { balance } = admin.ledger.wallet(adminUserId);
      fromBalance = Math.min(Math.round(Math.max(0, balance) * 100) / 100, priced);
    }
    const dueUsd = Math.round((priced - fromBalance) * 100) / 100;

    const id = `o${Date.now().toString(36)}${randomInt(1e6).toString(36)}`;
    const order = db.createOrder({
      id, userId, username, planId: body.planId,
      billing: body.billing === 'yearly' ? 'yearly' : 'monthly',
      amountUsd: dueUsd,
      balanceUsed: fromBalance,
    });
    /* Reserved on the order, not redeemed yet: an order that expires unpaid
       must give the code back. It is spent when the ledger books the payment. */
    if (code) db.db.prepare('UPDATE orders SET discount_code = ? WHERE id = ?').run(code, id);

    /* Paid in full out of the balance: there is no crypto leg to wait for, so
       the order confirms here and takes the same booking + Telegram path the
       watcher uses. Never chosen for the user — only when they asked for it and
       their balance actually covered the whole price. */
    if (dueUsd <= 0) {
      const now = Date.now();
      db.db.prepare(
        `UPDATE orders SET status='confirmed', confirmed_at=?, updated_at=? WHERE id=? AND status='pending'`,
      ).run(now, now, id);
      const settled = db.getOrder(id);
      try {
        const { notifyOrderConfirmed } = await import('./notify.mjs');
        await notifyOrderConfirmed(settled);
      } catch (err) {
        // The books are the sweep's job either way; only the DM is lost here.
        console.error('[orders] balance-settled notify failed:', err.message);
      }
      return send(res, 200, { order: db.rowToOrder(db.getOrder(id), gateways) }), true;
    }

    return send(res, 200, { order: db.rowToOrder(order, gateways) }), true;
  }

  const select = path.match(/^\/api\/orders\/([\w-]+)\/select$/);
  if (req.method === 'POST' && select) {
    const body = await readBody(req);
    const order = db.getOrder(select[1]);
    if (!order) return send(res, 404, { error: 'not_found' }), true;
    if (order.user_id !== userId) return send(res, 403, { error: 'forbidden' }), true;
    if (order.status !== 'pending') return send(res, 409, { error: 'order_not_pending' }), true;
    /* Re-selecting re-dithers amount_crypto — on a partially-paid order that
       would corrupt the paid/due arithmetic the watcher sums against. */
    if (order.paid_units != null) return send(res, 409, { error: 'order_partially_paid' }), true;

    const gw = findGateway(gateways, body.currency, body.network);
    if (!gw || !gw.address) return send(res, 400, { error: 'unknown_gateway' }), true;

    let rate;
    try {
      rate = await usdRate(body.currency);
    } catch {
      return send(res, 503, { error: 'rate_unavailable' }), true;
    }

    let amountCrypto;
    try {
      amountCrypto = uniqueAmount({
        amountUsd: order.amount_usd, rate, currency: body.currency,
        network: body.network, address: gw.address, db,
      });
    } catch {
      return send(res, 503, { error: 'amount_collision' }), true;
    }

    const updated = db.updateOrder(order.id, {
      currency: body.currency, network: body.network, amount_crypto: amountCrypto,
      address: gw.address, memo: gw.memo ?? null,
    });
    return send(res, 200, { order: db.rowToOrder(updated, gateways) }), true;
  }

  const submit = path.match(/^\/api\/orders\/([\w-]+)\/submit$/);
  if (req.method === 'POST' && submit) {
    const body = await readBody(req);
    const order = db.getOrder(submit[1]);
    if (!order) return send(res, 404, { error: 'not_found' }), true;
    if (order.user_id !== userId) return send(res, 403, { error: 'forbidden' }), true;
    /* "I've paid" is a hint, not a promotion. Only the watcher confirms, so a
       tap here cannot conjure a subscription. */
    const updated = db.updateOrder(order.id, {
      status: order.status === 'pending' ? 'submitted' : order.status,
      txid: typeof body.txid === 'string' && body.txid ? body.txid : order.txid,
    });
    return send(res, 200, { order: db.rowToOrder(updated, gateways) }), true;
  }

  const one = path.match(/^\/api\/orders\/([\w-]+)$/);
  if (req.method === 'GET' && one) {
    db.expireStale();
    const order = db.getOrder(one[1]);
    if (!order) return send(res, 404, { error: 'not_found' }), true;
    if (order.user_id !== userId) return send(res, 403, { error: 'forbidden' }), true;
    return send(res, 200, { order: db.rowToOrder(order, gateways) }), true;
  }

  /* GET /api/me/subscription — the ledger's view, not "newest confirmed order
     + 30 days". Extra-day grants and early renewals both move the expiry, and
     recomputing it from an order would ignore them. */
  if (req.method === 'GET' && path === '/api/me/subscription') {
    const sub = admin.miniAppUser(adminUserId).subscription;
    if (!sub || !sub.expiresAt) return send(res, 200, { status: 'none' }), true;
    return send(res, 200, {
      status: sub.expiresAt > Date.now() ? 'active' : 'expired',
      planId: sub.plan,
      expiresAt: sub.expiresAt,
    }), true;
  }

  return false;
}
