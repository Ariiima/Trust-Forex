/**
 * What happens the moment a payment confirms.
 *
 * The watcher calls `notifyOrderConfirmed(order)` after it promotes an order.
 * Two things follow, in this order:
 *
 *  1. The books. The order is credited immediately rather than waiting for the
 *     hourly job, so the subscription is live before the user has finished
 *     reading the confirmation. The job still sweeps — this is the fast path,
 *     not the only one, and both go through the same keyed ledger write.
 *  2. The messages. The buyer gets their group invite, the admin chat gets the
 *     receipt. Neither can fail the booking above.
 */
import { MESSAGE_TEMPLATES, openAdminDb, renderTemplate } from './admin.mjs';
import { groupInvite, sendMessage, appButton } from './telegram.mjs';
import { openDb } from './db.mjs';
import { setEarningNotifier } from './ledger.mjs';

const admin = openAdminDb();
const store = openDb(); // same file/connection as index.mjs's — see sqlite.mjs

const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;
// plan_id is the slug ('gold'); the message says Gold.
const planLabel = (id) => String(id ?? '').replace(/^./, (c) => c.toUpperCase());

/* The admin's edited copy, falling back to the shipped default — the same
   fallback shape jobs.mjs/payouts.mjs/watcher.mjs use, so a template row
   that somehow isn't seeded yet still sends something sane. */
const DEFAULT_TPL = Object.fromEntries(MESSAGE_TEMPLATES.map((t) => [t.key, t.body]));
const tpl = (key) => admin.messageTemplate(key) ?? DEFAULT_TPL[key];

/* Earning-balance credits book deep inside the ledger — a sale confirming, a
   cashback cycle published from the dashboard — so the ledger hands them back
   here instead of learning to talk to Telegram. Fire-and-forget on purpose:
   publishAll calls it mid-transaction, and a Bot API hiccup must not roll back
   money that is already booked. */
setEarningNotifier(({ kind, telegramId, amount, fromName, from, broker }) => {
  if (!telegramId) return;
  const body = kind === 'cashback'
    ? renderTemplate(tpl('cashback_earned'), { amount: money(amount), broker })
    : renderTemplate(tpl('referral_earned'), {
      amount: money(amount), name: fromName,
      source: from === 'cashback' ? 'cashback' : 'subscription',
    });
  sendMessage(telegramId, body, appButton())
    .catch((err) => console.error(`[notify] ${kind} message failed:`, err.message));
});

export async function notifyOrderConfirmed(order, overpaidUsd = 0) {
  // Their ledger id, which is only `tg<id>` for accounts the Mini App created
  // — see ledger.userIdForTelegram.
  const userId = admin.ledger.userIdForTelegram(order.user_id);

  // 1. Book it now. Idempotent on `order:<id>`, so the job re-running is free.
  let booked = null;
  let tierPct = null;
  try {
    admin.ledger.reconcileOrders(Date.now(), (code, uid, oid) =>
      admin.campaignEngine.redeem(code, uid, oid));
    if (userId) {
      const me = admin.miniAppUser(userId);
      booked = me.subscription;
      tierPct = me.tier.pct; // the upgraded rate — cashback and referral share both
    }
  } catch (err) {
    console.error('[notify] booking failed:', err.message);
  }

  /* Paid more than the order asked for: the plan is bought and the excess is
     the user's, so it lands in the earning balance. Keyed per order like the
     underpayment refund — same money, opposite direction. */
  let credited = 0;
  if (userId && overpaidUsd > 0) {
    try {
      if (admin.ledger.creditRefund({
        userId, amountUsd: overpaidUsd, orderId: order.id, detail: 'Overpayment moved to balance',
      })) credited = overpaidUsd;
    } catch (err) {
      console.error('[notify] overpayment booking failed:', err.message);
    }
  }

  // 2. Tell the buyer, with the group link already in hand.
  if (order.user_id) {
    const link = booked
      ? await groupInvite(order.user_id, store.getGroupInvite(order.user_id))
      : null;
    if (link) store.setGroupInvite(order.user_id, link);
    // The wallet leg lives in balance_used, the on-chain leg in amount_usd —
    // the buyer's "total" is both together (see CLAUDE.md, orders.balance_used).
    const fromBalance = Number(order.balance_used ?? 0);
    /* One template, one render. The balance / overpaid / VIP lines only apply
       sometimes — passing '' drops the line they sit on (admin.renderTemplate),
       which is what let the five separate add-on templates go away. */
    await sendMessage(order.user_id, renderTemplate(tpl('payment_confirmed'), {
      plan: planLabel(order.plan_id),
      days: booked?.daysLeft || '',
      pct: tierPct ? `${tierPct}%` : '',
      total: money(Number(order.amount_usd ?? 0) + fromBalance),
      // "Amount Paid: {amount} {currency}" — the on-chain leg in the coin the
      // buyer actually sent, not its dollar value, or the line reads "$199.00
      // USDT". Absent on a purchase paid entirely from the earning balance,
      // and the line drops itself.
      amount: order.amount_crypto ?? '', currency: order.currency ?? '',
      earning_amount: fromBalance > 0 ? money(fromBalance) : '',
      overpaid_amount: credited ? money(credited) : '',
      link: link ?? '',
    }), appButton());
  }

  // 3. Tell us.
  const adminChat = process.env.TF_ADMIN_CHAT_ID;
  if (adminChat) {
    await sendMessage(adminChat,
      `💰 ${money(order.amount_usd)} — ${order.plan_id}\n`
      + `User: ${order.username ?? order.user_id ?? 'unknown'}\n`
      + `${order.currency ?? '?'} ${order.network ?? ''} · ${order.amount_crypto ?? '?'}\n`
      + `Order ${order.id}${order.txid ? `\ntx ${order.txid}` : ''}`);
  }
}

/**
 * A partially-paid order the user walked away from: the watcher expires it and
 * this books the paid amount as earning balance (idempotent per order), then
 * tells both sides. Losing an underpayment outright is how trust dies.
 */
export async function refundPartialOrder(order, paidUsd) {
  // Their ledger id, which is only `tg<id>` for accounts the Mini App created
  // — see ledger.userIdForTelegram.
  const userId = admin.ledger.userIdForTelegram(order.user_id);
  if (!userId || !(paidUsd > 0)) return;
  try {
    admin.ledger.creditRefund({ userId, amountUsd: paidUsd, orderId: order.id });
  } catch (err) {
    console.error('[notify] refund booking failed:', err.message);
    return; // don't announce money that wasn't booked
  }
  await sendMessage(order.user_id, renderTemplate(tpl('payment_partial_refund'), { amount: money(paidUsd) }), appButton());
  const adminChat = process.env.TF_ADMIN_CHAT_ID;
  if (adminChat) {
    await sendMessage(adminChat,
      `↩️ Underpaid order ${order.id} expired — ${money(paidUsd)} credited to `
      + `${order.username ?? order.user_id}'s balance.`);
  }
}

export { notifyOrderConfirmed as notify };
export default notifyOrderConfirmed;
