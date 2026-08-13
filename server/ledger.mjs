/**
 * The money spine.
 *
 * Every figure the dashboard and the Mini App show about a balance, our
 * revenue, a tier or a payout derives from `ledger` — one append-only row per
 * state change. Nothing that moves money is kept as a running total, because a
 * running total and its own history can disagree and only one of them can be
 * right.
 *
 * Sign convention, always from the USER's side:
 *   amount  > 0   credited to their wallet (cashback, referral share)
 *   amount  < 0   debited (withdrawal)
 *   revenue > 0   what WE took in for this event, gross, before their cut
 * Our net on any row is `revenue - amount`. Everything is USDT.
 *
 * Rows carry `key`, a UNIQUE idempotency string. Publishing a weekly cycle
 * twice, or reconciling the same confirmed order twice, is a no-op rather than
 * a double payment.
 */
import { randomBytes } from 'node:crypto';

/** Share of our revenue the user keeps, by live subscription tier. */
export const TIER_PCT = { none: 0.1, silver: 0.15, gold: 0.2, diamond: 0.3 };

/** Plan duration. From the catalogue in src/screens/plans/plans-data.ts. */
export const PLAN_DAYS = { silver: 30, gold: 90, diamond: 365 };

const DAY_MS = 86_400_000;

/** Kinds that represent real income to us; the rest are wallet or timeline rows. */
const REVENUE_KINDS = "('subscription','cashback','referral')";

export const LEDGER_SCHEMA = `
CREATE TABLE IF NOT EXISTS ledger (
  id INTEGER PRIMARY KEY,
  at INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  revenue REAL NOT NULL DEFAULT 0,
  -- The tier this row was paid at, frozen at write time. Tier is otherwise
  -- live-derived, so without this a later expiry would silently rewrite what
  -- someone was already paid.
  tier TEXT,
  broker_id TEXT, ref_user_id TEXT, cycle_id TEXT,
  key TEXT UNIQUE);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, at);
CREATE INDEX IF NOT EXISTS idx_ledger_kind ON ledger(kind, at);
CREATE INDEX IF NOT EXISTS idx_ledger_cycle ON ledger(cycle_id);
`;

const round2 = (n) => Math.round(n * 100) / 100;
const today = (ms) => new Date(ms).toISOString().slice(0, 10);

export function openLedger(db) {
  const q = {
    append: db.prepare(`INSERT OR IGNORE INTO ledger
      (at, user_id, kind, detail, amount, revenue, tier, broker_id, ref_user_id, cycle_id, key)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    timeline: db.prepare('SELECT * FROM ledger WHERE user_id = ? ORDER BY at DESC, id DESC'),

    /* Wallet: credits minus debits. `earned` deliberately counts only positive
       rows — the Earning screen shows lifetime earnings next to a balance, and
       netting withdrawals into it would make the two numbers the same. */
    wallet: db.prepare(`SELECT
        COALESCE(SUM(amount), 0) AS balance,
        COALESCE(SUM(CASE WHEN amount > 0 THEN amount END), 0) AS earned,
        COALESCE(SUM(CASE WHEN kind = 'withdrawal' THEN -amount END), 0) AS withdrawn
      FROM ledger WHERE user_id = ?`),
    /* Per-user books, split the way the admin's user detail wants them:
       what we kept vs what we paid out, per stream. */
    summary: db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN kind='cashback' THEN revenue - amount END), 0) AS cashback_net,
        COALESCE(SUM(CASE WHEN kind='cashback' THEN amount END), 0) AS cashback_paid,
        COALESCE(SUM(CASE WHEN kind='referral' THEN amount END), 0) AS ref_earnings,
        COALESCE(SUM(CASE WHEN kind='subscription' THEN revenue END), 0) AS plan_revenue
      FROM ledger WHERE user_id = ?`),
    /* What our referrals actually brought in, seen from the inviter's side. */
    refRevenue: db.prepare(`SELECT
        COALESCE(SUM(revenue - amount), 0) AS revenue
      FROM ledger WHERE user_id IN (SELECT id FROM users WHERE referred_by = ?)
        AND kind IN ${REVENUE_KINDS}`),
    refCounts: db.prepare(`SELECT
        COUNT(*) AS invited,
        SUM(EXISTS (SELECT 1 FROM subscribers s WHERE s.id = u.id AND s.status = 'active')) AS active,
        SUM(EXISTS (SELECT 1 FROM subscribers s WHERE s.id = u.id)) AS plan_count,
        SUM(EXISTS (SELECT 1 FROM ledger l WHERE l.user_id = u.id AND l.kind = 'cashback')) AS cashback_count
      FROM users u WHERE u.referred_by = ?`),

    user: db.prepare('SELECT * FROM users WHERE id = ?'),
    userByTelegram: db.prepare('SELECT * FROM users WHERE telegram_id = ?'),
    userByRefCode: db.prepare('SELECT * FROM users WHERE ref_code = ?'),
    setReferrer: db.prepare('UPDATE users SET referred_by = ?, ref_campaign = ? WHERE id = ? AND referred_by IS NULL'),
    setRefCode: db.prepare('UPDATE users SET ref_code = ? WHERE id = ?'),
    setUserPlan: db.prepare('UPDATE users SET plan = ?, last_action_at = ? WHERE id = ?'),

    subscriber: db.prepare('SELECT * FROM subscribers WHERE id = ?'),
    upsertSubscriber: db.prepare(`INSERT INTO subscribers
        (id, name, plan, purchased_at, last_action_at, expires_at, total_paid, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
      ON CONFLICT(id) DO UPDATE SET
        plan = excluded.plan, purchased_at = excluded.purchased_at,
        last_action_at = excluded.last_action_at, expires_at = excluded.expires_at,
        total_paid = COALESCE(subscribers.total_paid, 0) + excluded.total_paid,
        status = 'active'`),
    extendSubscriber: db.prepare('UPDATE subscribers SET expires_at = ?, status = ? WHERE id = ?'),
    due: db.prepare(`SELECT s.*, u.telegram_id FROM subscribers s
      JOIN users u ON u.id = s.id
      WHERE s.status = 'active' AND s.expires_at IS NOT NULL AND s.expires_at <= ?`),
    expiring: db.prepare(`SELECT s.*, u.telegram_id FROM subscribers s
      JOIN users u ON u.id = s.id
      WHERE s.status = 'active' AND s.expires_at BETWEEN ? AND ?`),
    activeSubs: db.prepare(`SELECT * FROM subscribers WHERE status = 'active'`),

    /* Confirmed payments not yet in the books. The Mini App's `orders` and the
       admin's tables share one file, so this is a plain anti-join rather than a
       cross-process handshake — whoever confirms an order, the ledger catches
       up on the next tick. */
    unbookedOrders: db.prepare(`SELECT o.* FROM orders o
      WHERE o.status = 'confirmed'
        AND NOT EXISTS (SELECT 1 FROM ledger l WHERE l.key = 'order:' || o.id)`),

    draftsAll: db.prepare(`SELECT d.*, b.name AS broker_name FROM rebate_drafts d
      JOIN brokers b ON b.id = d.broker_id ORDER BY d.broker_id, d.rowid`),
    draftsFor: db.prepare(`SELECT d.*, b.name AS broker_name FROM rebate_drafts d
      JOIN brokers b ON b.id = d.broker_id WHERE d.broker_id = ? ORDER BY d.rowid`),
    clearAllDrafts: db.prepare('DELETE FROM rebate_drafts'),
    clearBrokerDrafts: db.prepare('DELETE FROM rebate_drafts WHERE broker_id = ?'),
    bumpRebate: db.prepare(`UPDATE rebates
      SET total_rebate = COALESCE(total_rebate, 0) + ?, last_week_rebate = ?, shared_rebate = ?
      WHERE broker_id = ? AND user_id = ?`),
    insertCycle: db.prepare(`INSERT OR REPLACE INTO cashback_cycles
      (id, name, range_label, gross_rebate, shared_cashback, net_revenue, cashback_users, published_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`),

    refCampaignByCode: db.prepare('SELECT * FROM referral_campaigns WHERE link_code = ? AND status = \'active\''),
    refCampaign: db.prepare('SELECT * FROM referral_campaigns WHERE id = ?'),

    /* One row per invitee, split plan vs cashback by the referral payout's own
       key prefix (`cash:` from publishAll, everything else from payReferral's
       subscription callers) — the only place that distinction survives, since
       a referral row itself carries no `kind` of its own to split on. */
    referralList: db.prepare(`SELECT i.id, i.user_no, i.joined_at,
        COALESCE(SUM(CASE WHEN l.key LIKE 'cash:%' THEN l.amount END), 0) AS cashback,
        COALESCE(SUM(CASE WHEN l.key NOT LIKE 'cash:%' THEN l.amount END), 0) AS plan
      FROM users i
      LEFT JOIN ledger l ON l.user_id = i.referred_by AND l.kind = 'referral' AND l.ref_user_id = i.id
      WHERE i.referred_by = ?
      GROUP BY i.id ORDER BY i.joined_at DESC`),

    /* This user's own cashback payouts, newest first — the cashback history sheet. */
    cashbackHistory: db.prepare(`SELECT broker_id, at, tier, amount FROM ledger
      WHERE user_id = ? AND kind = 'cashback' ORDER BY at DESC`),
  };

  /** Live tier. Reads the clock, never a stored plan column — an expired
   *  Diamond is `none` the moment the subscription lapses, by decision. */
  function tierOf(userId, now = Date.now()) {
    const s = q.subscriber.get(userId);
    if (!s || s.status !== 'active') return 'none';
    if (s.expires_at != null && s.expires_at <= now) return 'none';
    return TIER_PCT[s.plan] ? s.plan : 'none';
  }

  const pctOf = (userId, now) => TIER_PCT[tierOf(userId, now)];

  /** Append one row. Returns false when `key` has already been booked. */
  function append({ userId, kind, detail = '', amount = 0, revenue = 0, tier = null,
    brokerId = null, refUserId = null, cycleId = null, key = null, at = Date.now() }) {
    return q.append.run(at, userId, kind, detail, round2(amount), round2(revenue),
      tier, brokerId, refUserId, cycleId, key).changes > 0;
  }

  /**
   * Pay the inviter their share of what we netted on `userId`.
   *
   * The cut comes out of OUR net, not the gross: the invitee has already taken
   * their own tier's slice, and paying the inviter off the gross would hand out
   * up to 60% of a trade between the two of them.
   *
   * A campaign link overrides the inviter's tier with the campaign's negotiated
   * share — that is the whole point of giving a partner a dedicated link.
   */
  function payReferral({ userId, net, kind, key, at = Date.now() }) {
    if (net <= 0) return 0;
    const user = q.user.get(userId);
    const inviter = user?.referred_by;
    if (!inviter || inviter === userId) return 0;

    let pct = pctOf(inviter, at);
    const campaign = user.ref_campaign ? q.refCampaign.get(user.ref_campaign) : null;
    if (campaign) {
      const share = kind === 'subscription' ? campaign.plan_share : campaign.cashback_share;
      // Campaign shares are stored as percentages (60 = 60%).
      if (share != null) pct = share > 1 ? share / 100 : share;
    }

    const amount = round2(net * pct);
    if (amount <= 0) return 0;
    append({
      userId: inviter, kind: 'referral', amount, revenue: 0,
      tier: tierOf(inviter, at), refUserId: userId, at, key: `${key}:ref`,
      detail: `Referral share from ${user.name ?? userId}`,
    });
    return amount;
  }

  return {
    TIER_PCT,
    tierOf,
    pctOf,
    append,

    /** A stable, shareable code per user; generated on first request. */
    refCodeFor(userId) {
      const row = q.user.get(userId);
      if (!row) return null;
      if (row.ref_code) return row.ref_code;
      let code;
      do {
        code = randomBytes(4).toString('hex');
      } while (q.userByRefCode.get(code));
      q.setRefCode.run(code, userId);
      return code;
    },

    /**
     * Record who sent this user, from a `startapp=` / `?ref=` payload. The code
     * is either another user's referral code or a referral campaign's link
     * code. First writer wins — attribution never moves once set, so a later
     * link cannot steal an existing inviter's earnings.
     */
    attribute(userId, code) {
      if (!code || typeof code !== 'string') return null;
      const self = q.user.get(userId);
      if (!self || self.referred_by) return null;

      const inviter = q.userByRefCode.get(code);
      if (inviter && inviter.id !== userId) {
        q.setReferrer.run(inviter.id, null, userId);
        append({
          userId, kind: 'signup', detail: `Invited by ${inviter.name ?? inviter.id}`,
          refUserId: inviter.id, key: `signup:${userId}`,
        });
        return { inviter: inviter.id };
      }

      const campaign = q.refCampaignByCode.get(code);
      if (campaign) {
        // A campaign may be tied to a user's referral code, or run in-house —
        // in which case there is no inviter to pay and only the tag is kept.
        const owner = campaign.link_code && q.userByRefCode.get(campaign.link_code)?.id;
        q.setReferrer.run(owner ?? null, campaign.id, userId);
        append({
          userId, kind: 'signup', detail: `Joined via campaign ${campaign.name}`,
          key: `signup:${userId}`,
        });
        return { campaign: campaign.id, inviter: owner ?? null };
      }
      return null;
    },

    /**
     * Book a paid subscription: extend the term, log the revenue, pay the
     * inviter. Extends from whichever is later — the current expiry (so an
     * early renewal is not punished) or now.
     */
    creditSubscription({ userId, planId, amountUsd, orderId, at = Date.now() }) {
      const days = PLAN_DAYS[planId] ?? 30;
      const current = q.subscriber.get(userId);
      const from = Math.max(current?.expires_at ?? 0, at);
      const expires = from + days * DAY_MS;
      const user = q.user.get(userId);
      const key = orderId ? `order:${orderId}` : `sub:${userId}:${at}`;

      const booked = append({
        userId, kind: 'subscription', amount: 0, revenue: amountUsd, tier: planId,
        detail: `${planId} plan — ${days} days`, at, key,
      });
      if (!booked) return null; // already in the books

      q.upsertSubscriber.run(
        userId, user?.name ?? userId, planId, today(at), today(at), expires, amountUsd,
      );
      q.setUserPlan.run(planId, today(at), userId);
      payReferral({ userId, net: amountUsd, kind: 'subscription', key, at });
      return { expiresAt: expires, plan: planId };
    },

    /** Extra days from an admin grant. No revenue, still a state change. */
    grantDays(userId, days, note = '', at = Date.now()) {
      const s = q.subscriber.get(userId);
      if (!s) return null;
      const expires = Math.max(s.expires_at ?? at, at) + days * DAY_MS;
      q.extendSubscriber.run(expires, 'active', userId);
      append({
        userId, kind: 'grant', detail: note || `+${days} days`, at,
        key: `grant:${userId}:${at}`,
      });
      return expires;
    },

    /**
     * Pull confirmed payments into the books. Safe to run on every tick.
     *
     * `redeemCode` is injected rather than imported so the ledger keeps no
     * dependency on the campaign engine — it is the engine that owns what a
     * code means, this just reports that one was spent.
     */
    reconcileOrders(now = Date.now(), redeemCode) {
      const rows = q.unbookedOrders.all();
      for (const o of rows) {
        const userId = this.userIdForTelegram(o.user_id);
        if (!userId) continue;
        /* The plan sold for its full price even when part of it came out of
           the buyer's own balance — that part is a separate debit below, not a
           discount. Booking only the crypto leg would understate revenue and
           short the inviter's referral cut. */
        const fromBalance = Number(o.balance_used ?? 0);
        const booked = this.creditSubscription({
          userId, planId: o.plan_id, amountUsd: round2(o.amount_usd + fromBalance),
          orderId: o.id, at: o.confirmed_at ?? now,
        });
        // Keyed per order, so this is the one place the balance leaves, whether
        // the sweep or the confirm hook gets here first.
        if (fromBalance > 0) {
          this.spendBalance({ userId, amountUsd: fromBalance, orderId: o.id, at: o.confirmed_at ?? now });
        }
        if (booked && o.discount_code && redeemCode) redeemCode(o.discount_code, userId, o.id);
      }
      return rows.length;
    },

    /**
     * Publish every broker's drafted rebates as one weekly cycle.
     *
     * One transaction and one idempotency key per (cycle, broker, user): the
     * button that pays everybody is the easiest button in the product to press
     * twice.
     */
    publishAll({ cycleId, name, range, brokerId, at = Date.now() } = {}) {
      const drafts = brokerId ? q.draftsFor.all(brokerId) : q.draftsAll.all();
      if (!drafts.length) return { published: 0, gross: 0, shared: 0 };
      const id = cycleId ?? `cy-${today(at)}`;
      let gross = 0;
      let shared = 0;

      db.exec('BEGIN');
      try {
        for (const d of drafts) {
          const key = `cash:${id}:${d.broker_id}:${d.user_id}`;
          const booked = append({
            userId: d.user_id, kind: 'cashback', amount: d.shared_rebate,
            revenue: d.last_week_rebate, tier: tierOf(d.user_id, at),
            brokerId: d.broker_id, cycleId: id, at, key,
            detail: `${d.broker_name} cashback`,
          });
          if (!booked) continue;
          gross += d.last_week_rebate;
          shared += d.shared_rebate;
          q.bumpRebate.run(d.shared_rebate, d.last_week_rebate, d.shared_rebate, d.broker_id, d.user_id);
          payReferral({
            userId: d.user_id, net: d.last_week_rebate - d.shared_rebate,
            kind: 'cashback', key, at,
          });
        }
        if (brokerId) q.clearBrokerDrafts.run(brokerId); else q.clearAllDrafts.run();
        q.insertCycle.run(
          id, name ?? `Cycle ${today(at)}`, range ?? today(at),
          round2(gross), round2(shared), round2(gross - shared),
          new Set(drafts.map((d) => d.user_id)).size,
          new Date(at).toISOString().slice(0, 16).replace('T', ' '),
        );
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      return { published: drafts.length, gross: round2(gross), shared: round2(shared), cycleId: id };
    },

    /**
     * Lapse everything past its expiry. Returns the affected rows so the caller
     * can message and remove them from the Telegram group — this function does
     * not talk to Telegram, so it stays runnable in a test.
     */
    expireDue(now = Date.now()) {
      const rows = q.due.all(now);
      for (const r of rows) {
        q.extendSubscriber.run(r.expires_at, 'expired', r.id);
        q.setUserPlan.run('none', today(now), r.id);
        append({
          userId: r.id, kind: 'expiry', detail: `${r.plan} subscription expired`,
          at: now, key: `expiry:${r.id}:${r.expires_at}`,
        });
      }
      return rows;
    },

    /** Active subscriptions falling due inside the window — for reminders. */
    expiringWithin(ms, now = Date.now()) {
      return q.expiring.all(now, now + ms);
    },

    /**
     * The ledger's user id for a Telegram account id, or null if we have never
     * seen them.
     *
     * `orders.user_id` is the Telegram id; `users.id` is the admin's own key.
     * For anyone ensureUser() created, that key IS `tg<telegram id>` — but
     * accounts seeded into the dashboard before the Mini App existed keep their
     * original id and are bridged by the `telegram_id` column instead. Assuming
     * the `tg` form meant their confirmed orders were silently never booked: no
     * subscription, no revenue, no referral cut.
     */
    userIdForTelegram(telegramId) {
      if (telegramId == null) return null;
      const direct = q.user.get(`tg${telegramId}`);
      return (direct ?? q.userByTelegram.get(telegramId))?.id ?? null;
    },

    wallet: (userId) => {
      const w = q.wallet.get(userId);
      return { balance: round2(w.balance), earned: round2(w.earned), withdrawn: round2(w.withdrawn) };
    },

    /** Money off an order that comes back as earning balance rather than being
     *  lost: an abandoned underpayment, or the excess on an overpayment.
     *  Keyed per order, so re-sweeping the same order is a no-op — and the key
     *  is deliberately the same one underpayments have always used, because
     *  re-keying it would credit every refund already booked a second time. */
    creditRefund({ userId, amountUsd, orderId, at = Date.now(), detail = 'Underpaid order moved to balance' }) {
      return append({
        userId, kind: 'refund', amount: amountUsd, detail, at, key: `refund:${orderId}`,
      });
    },

    /**
     * Earning balance put towards an order ("Use earning balance" at checkout).
     *
     * Booked when the order CONFIRMS, never when it is created: an order that
     * is abandoned or expires has therefore taken nothing, and none of the
     * three expiry paths needs a reversal it could forget to make. The order
     * carries the intent (orders.balance_used) and prices its crypto leg on
     * the remainder; this is where the money actually moves.
     *
     * Spends what is there rather than what was asked for — the balance can
     * have been withdrawn in the minutes since checkout, and a subscription
     * that is already paid for must not be held up over it. Keyed per order,
     * so the hourly sweep re-running is free.
     */
    spendBalance({ userId, amountUsd, orderId, at = Date.now() }) {
      const want = round2(Number(amountUsd));
      if (!Number.isFinite(want) || want <= 0) return null;
      const { balance } = this.wallet(userId);
      const value = Math.min(want, round2(balance));
      if (value <= 0) return null;
      if (value < want) {
        console.warn(`[ledger] order ${orderId}: balance covered ${value} of ${want} — spent while checking out`);
      }
      return append({
        userId, kind: 'purchase', amount: -value, at,
        detail: 'Earning balance used at checkout', key: `spend:${orderId}`,
      });
    },

    /** Withdrawal. Refuses to overdraw — this is the one balance that leaves. */
    withdraw(userId, amount, destination = '', at = Date.now()) {
      const value = round2(Number(amount));
      if (!Number.isFinite(value) || value <= 0) return { error: 'invalid_amount' };
      const { balance } = this.wallet(userId);
      if (value > balance) return { error: 'insufficient_funds', balance };
      append({
        userId, kind: 'withdrawal', amount: -value, at,
        detail: destination ? `Withdrawal to ${destination}` : 'Withdrawal',
        key: `wd:${userId}:${at}`,
      });
      return { ok: true, balance: round2(balance - value) };
    },

    timeline: (userId) => q.timeline.all(userId),

    /** Every invitee of `userId`, with what they've earned the inviter so far. */
    referralsFor(userId) {
      return q.referralList.all(userId).map((r) => ({
        id: r.user_no != null ? String(r.user_no) : r.id,
        joinedAt: r.joined_at,
        plan: round2(r.plan),
        cashback: round2(r.cashback),
      }));
    },

    /** This user's cashback payouts, newest first. */
    cashbackHistoryFor(userId) {
      return q.cashbackHistory.all(userId).map((r) => ({
        broker: r.broker_id,
        at: r.at,
        ratePct: (TIER_PCT[r.tier] ?? 0) * 100,
        amount: round2(r.amount),
      }));
    },

    /**
     * Referral + cashback income folded into fixed 7-day buckets, oldest first,
     * for the Earning tab's chart. Buckets are anchored on the epoch rather than
     * a calendar week/month — there is no label to collide (see the signal
     * results' own week-numbering fight), just a plain rolling window ending
     * at `now`'s week.
     */
    weeklyEarnings(userId, weeks = 20, now = Date.now()) {
      const WEEK_MS = 7 * DAY_MS;
      const end = Math.ceil(now / WEEK_MS) * WEEK_MS;
      const start = end - weeks * WEEK_MS;
      const buckets = Array.from({ length: weeks }, (_, i) => ({
        start: start + i * WEEK_MS, referral: 0, cashback: 0,
      }));
      for (const r of q.timeline.all(userId)) {
        if (r.at < start || r.at >= end) continue;
        const b = buckets[Math.floor((r.at - start) / WEEK_MS)];
        if (r.kind === 'referral') b.referral = round2(b.referral + r.amount);
        else if (r.kind === 'cashback') b.cashback = round2(b.cashback + r.amount);
      }
      return buckets;
    },

    /** Per-user books for the admin's user detail and the Mini App cards. */
    summaryFor(userId) {
      const s = q.summary.get(userId);
      const counts = q.refCounts.get(userId) ?? {};
      const rev = q.refRevenue.get(userId) ?? {};
      const earnings = q.wallet.get(userId);
      return {
        cashbackNet: round2(s.cashback_net),
        cashbackPaid: round2(s.cashback_paid),
        planRevenue: round2(s.plan_revenue),
        refInvited: counts.invited ?? 0,
        refActive: counts.active ?? 0,
        refPlanCount: counts.plan_count ?? 0,
        refCashbackCount: counts.cashback_count ?? 0,
        refRevenue: round2(rev.revenue ?? 0),
        refEarnings: round2(s.ref_earnings),
        balance: round2(earnings.balance),
        /** True once anything at all has been booked for this user. */
        hasLedger: (earnings.earned ?? 0) !== 0 || (s.plan_revenue ?? 0) !== 0,
      };
    },

    /** Every subscriber row with days-left computed, never stored. */
    subscribersWithDaysLeft(now = Date.now()) {
      return q.activeSubs.all().map((s) => ({
        ...s,
        days_left: s.expires_at == null
          ? s.days_left
          : Math.max(0, Math.ceil((s.expires_at - now) / DAY_MS)),
      }));
    },
  };
}

/* ---------------------------------------------------------------------
 * Self-check: node server/ledger.mjs
 * Covers the four rules that decide what people get paid.
 * ------------------------------------------------------------------- */
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const { default: assert } = await import('node:assert/strict');
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT, plan TEXT, status TEXT,
      last_action_at TEXT, referred_by TEXT, ref_campaign TEXT, ref_code TEXT, telegram_id INTEGER,
      user_no INTEGER, joined_at TEXT);
    CREATE TABLE subscribers (id TEXT PRIMARY KEY, name TEXT, plan TEXT, purchased_at TEXT,
      last_action_at TEXT, expires_at INTEGER, days_left INTEGER, total_paid REAL, status TEXT);
    CREATE TABLE brokers (id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE rebates (broker_id TEXT, user_id TEXT, total_rebate REAL,
      last_week_rebate REAL, shared_rebate REAL, PRIMARY KEY (broker_id, user_id));
    CREATE TABLE rebate_drafts (broker_id TEXT, user_id TEXT, last_week_rebate REAL,
      shared_rebate REAL, action_date TEXT, PRIMARY KEY (broker_id, user_id));
    CREATE TABLE cashback_cycles (id TEXT PRIMARY KEY, name TEXT, range_label TEXT,
      gross_rebate REAL, shared_cashback REAL, net_revenue REAL, cashback_users INTEGER, published_at TEXT);
    CREATE TABLE referral_campaigns (id TEXT PRIMARY KEY, name TEXT, status TEXT,
      link_code TEXT, plan_share REAL, cashback_share REAL);
    CREATE TABLE orders (id TEXT PRIMARY KEY, user_id INTEGER, plan_id TEXT,
      amount_usd REAL, status TEXT, confirmed_at INTEGER, balance_used REAL);
  `);
  db.exec(LEDGER_SCHEMA);
  const L = openLedger(db);

  const addUser = (id, name) => db.prepare('INSERT INTO users (id, name, plan, status) VALUES (?, ?, \'none\', \'active\')').run(id, name);
  addUser('u1', 'Inviter');
  addUser('u2', 'Invitee');
  db.prepare('INSERT INTO brokers VALUES (?, ?)').run('exness', 'Exness');
  db.prepare('INSERT INTO rebates VALUES (?, ?, 0, 0, 0)').run('exness', 'u2');

  const T0 = 1_700_000_000_000;

  // 1. No subscription is the 10% tier.
  assert.equal(L.tierOf('u2', T0), 'none');
  assert.equal(L.pctOf('u2', T0), 0.1);

  // 2. Buying Gold moves the tier and books the revenue once.
  L.creditSubscription({ userId: 'u2', planId: 'gold', amountUsd: 550, orderId: 'o1', at: T0 });
  assert.equal(L.tierOf('u2', T0), 'gold');
  assert.equal(L.pctOf('u2', T0), 0.2);
  assert.equal(L.creditSubscription({ userId: 'u2', planId: 'gold', amountUsd: 550, orderId: 'o1', at: T0 }), null,
    'the same order must never be booked twice');

  // 3. Expiry drops the tier immediately — 90 days of Gold, then nothing.
  assert.equal(L.tierOf('u2', T0 + 89 * DAY_MS), 'gold', 'still inside the 90-day term');
  const afterExpiry = T0 + 91 * DAY_MS;
  assert.equal(L.tierOf('u2', afterExpiry), 'none', 'lapsed the moment the term ended');
  assert.equal(L.expireDue(afterExpiry).length, 1);
  assert.equal(L.tierOf('u2', afterExpiry), 'none');

  // 4. Cashback splits on the tier, and the inviter is paid out of OUR net.
  db.prepare('UPDATE users SET referred_by = ? WHERE id = ?').run('u1', 'u2');
  // The inviter's own tier is read at payout time, so it has to be live first.
  L.creditSubscription({ userId: 'u1', planId: 'diamond', amountUsd: 1700, orderId: 'o3', at: T0 });
  L.creditSubscription({ userId: 'u2', planId: 'gold', amountUsd: 550, orderId: 'o2', at: T0 });
  db.prepare('INSERT INTO rebate_drafts VALUES (?, ?, ?, ?, ?)')
    .run('exness', 'u2', 100, 20, 'now'); // gold = 20%
  const cycle = L.publishAll({ cycleId: 'cy1', at: T0 });
  assert.equal(cycle.gross, 100);
  assert.equal(cycle.shared, 20);
  assert.equal(L.wallet('u2').balance, 20, 'invitee keeps their 20%');
  // Our net on the cashback row is 80; the Diamond inviter takes 30% of that.
  // Plus 30% of the 550 subscription we booked for u2 above.
  assert.equal(L.wallet('u1').balance, round2(80 * 0.3 + 550 * 0.3));

  // 4a. The Mini App's own reads: referral list split plan vs cashback, this
  // user's cashback payouts, and the weekly-bucketed chart feed.
  const refs = L.referralsFor('u1');
  assert.equal(refs.length, 1, 'u1 has exactly one invitee');
  assert.equal(refs[0].id, 'u2', 'no user_no on this fixture — falls back to the raw id');
  assert.equal(refs[0].plan, round2(550 * 0.3), 'referral share from the subscription, not the cashback');
  assert.equal(refs[0].cashback, round2(80 * 0.3), 'referral share from the cashback, keyed cash:');

  const cbHistory = L.cashbackHistoryFor('u2');
  assert.equal(cbHistory.length, 1);
  assert.equal(cbHistory[0].broker, 'exness');
  assert.equal(cbHistory[0].ratePct, 20, 'gold tier, frozen on the row');
  assert.equal(cbHistory[0].amount, 20, 'the invitee\'s own 20% share, not our net');

  const weekly = L.weeklyEarnings('u2', 4, T0 + DAY_MS);
  assert.equal(weekly.length, 4);
  assert.equal(weekly[weekly.length - 1].cashback, 20, 'this week carries the cashback payout');
  assert.equal(weekly.slice(0, -1).every((w) => w.referral === 0 && w.cashback === 0), true,
    'older weeks are untouched');

  // 5. Publishing the same cycle again pays nobody twice.
  db.prepare('INSERT INTO rebate_drafts VALUES (?, ?, ?, ?, ?)')
    .run('exness', 'u2', 100, 20, 'now');
  L.publishAll({ cycleId: 'cy1', at: T0 });
  assert.equal(L.wallet('u2').balance, 20, 'replayed cycle must be a no-op');

  // 6. A withdrawal cannot overdraw.
  assert.equal(L.withdraw('u2', 50).error, 'insufficient_funds');
  assert.equal(L.withdraw('u2', 15, 'TRC20').ok, true);
  assert.equal(L.wallet('u2').balance, 5);
  assert.equal(L.wallet('u2').earned, 20, 'earnings are lifetime, not net of withdrawals');

  // 7. "Use earning balance": the wallet pays part of an order at confirm time.
  //    u2 is on 5 after the withdrawal above; give them a plan priced at 8 with
  //    5 of it covered from balance, i.e. 3 still to arrive on-chain.
  db.prepare('INSERT INTO orders VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('o9', 2, 'silver', 3, 'confirmed', T0, 5);
  // reconcileOrders keys users off `tg<telegram_id>`, so point that at u2.
  db.prepare('UPDATE users SET id = ? WHERE id = ?').run('tg2', 'u2');
  db.prepare('UPDATE subscribers SET id = ? WHERE id = ?').run('tg2', 'u2');
  db.prepare('UPDATE ledger SET user_id = ? WHERE user_id = ?').run('tg2', 'u2');

  const before = L.wallet('tg2').balance;
  L.reconcileOrders(T0);
  assert.equal(L.wallet('tg2').balance, round2(before - 5), 'the balance leg leaves the wallet');
  assert.equal(
    db.prepare("SELECT revenue FROM ledger WHERE key = 'order:o9'").get().revenue, 8,
    'the plan sold for 8 — the balance leg is a debit, not a discount',
  );

  // Replaying it neither books the plan twice nor spends the balance twice.
  L.reconcileOrders(T0);
  assert.equal(L.wallet('tg2').balance, round2(before - 5), 'replayed reconcile is a no-op');

  // 8. A balance that shrank between checkout and confirmation spends what is
  //    left rather than overdrawing — the subscription is already paid for.
  db.prepare('INSERT INTO orders (id, user_id, plan_id, amount_usd, status, confirmed_at, balance_used) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run('o10', 2, 'silver', 1, 'confirmed', T0, 999);
  L.reconcileOrders(T0);
  assert.equal(L.wallet('tg2').balance, 0, 'spent down to zero, never past it');

  // 9. An account seeded into the dashboard before the Mini App existed keeps
  //    its own id and is bridged by telegram_id — its orders must still book.
  db.prepare('INSERT INTO users (id, name, plan, status, telegram_id) VALUES (?, ?, \'none\', \'active\', ?)')
    .run('legacy7', 'Seeded', 77);
  assert.equal(L.userIdForTelegram(77), 'legacy7', 'bridged by telegram_id, not by the tg convention');
  assert.equal(L.userIdForTelegram(999), null, 'never seen');
  db.prepare('INSERT INTO orders (id, user_id, plan_id, amount_usd, status, confirmed_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run('o11', 77, 'silver', 20, 'confirmed', T0);
  L.reconcileOrders(T0);
  assert.equal(
    db.prepare("SELECT revenue FROM ledger WHERE key = 'order:o11'").get()?.revenue, 20,
    'a bridged account\'s confirmed order is booked, not skipped',
  );

  console.log('ledger: all checks passed');
}
