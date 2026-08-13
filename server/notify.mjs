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

const admin = openAdminDb();

const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;

/* The admin's edited copy, falling back to the shipped default — the same
   fallback shape jobs.mjs/payouts.mjs/watcher.mjs use, so a template row
   that somehow isn't seeded yet still sends something sane. */
const DEFAULT_TPL = Object.fromEntries(MESSAGE_TEMPLATES.map((t) => [t.key, t.body]));
const tpl = (key) => admin.messageTemplate(key) ?? DEFAULT_TPL[key];

export async function notifyOrderConfirmed(order, overpaidUsd = 0) {
  // Their ledger id, which is only `tg<id>` for accounts the Mini App created
  // — see ledger.userIdForTelegram.
  const userId = admin.ledger.userIdForTelegram(order.user_id);

  // 1. Book it now. Idempotent on `order:<id>`, so the job re-running is free.
  let booked = null;
  try {
    admin.ledger.reconcileOrders(Date.now(), (code, uid, oid) =>
      admin.campaignEngine.redeem(code, uid, oid));
    booked = userId ? admin.miniAppUser(userId).subscription : null;
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
    const link = booked?.expiresAt ? await groupInvite(booked.expiresAt, order.user_id) : null;
    const base = renderTemplate(tpl('payment_confirmed'), {
      plan: order.plan_id, amount: money(order.amount_usd), currency: order.currency ?? '—',
    });
    await sendMessage(order.user_id,
      base
      + (credited ? `\nYou paid ${money(credited)} more than due — it was added to your earning balance.` : '')
      + (booked?.daysLeft ? `\nYour access runs for ${booked.daysLeft} more days.` : '')
      + (link ? `\n\nJoin the VIP group: ${link}` : ''), appButton());
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
