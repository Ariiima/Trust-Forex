/**
 * The campaign engine.
 *
 * The builder in the admin panel stores a campaign as a JSON doc; this turns
 * that doc into an actual audience and fires it. A campaign matches a user when
 * three independent things all hold:
 *
 *   1. audience restriction — everyone, or one referral campaign's arrivals,
 *      or one broker's registrants
 *   2. state matrix — the user's live (subscription, broker, referral) state is
 *      among the selected combinations
 *   3. timing trigger — an anchor event happened, and the configured offset has
 *      since elapsed ("7 days after starting the bot", "3 days before expiry")
 *
 * Firing writes (or bumps) the user's `campaign_sends` row and, when the
 * campaign carries an offer, mints a unique single-user discount code. A
 * campaign fires once per OCCURRENCE of its trigger — a renewal is a new
 * "subscription started", the next expiry a new "3 days before" — with the
 * "Send Limit" (one/two/three per user) capping how many of those a person
 * gets. Delivery itself is the caller's job — this module never talks to
 * Telegram, so it stays runnable in a test. server/campaigns.e2e.test.mjs
 * drives the whole thing through the real server.
 */
import { randomBytes } from 'node:crypto';
import { wallMs } from './tz.mjs';

export const CAMPAIGN_SCHEMA = `
CREATE TABLE IF NOT EXISTS discount_codes (
  code TEXT PRIMARY KEY, campaign_id TEXT NOT NULL, user_id TEXT,
  plans TEXT NOT NULL DEFAULT '', percent REAL NOT NULL DEFAULT 0,
  expires_at INTEGER, used_at INTEGER, order_id TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_codes_user ON discount_codes(user_id);

CREATE TABLE IF NOT EXISTS campaign_sends (
  campaign_id TEXT NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL,
  code TEXT, delivered INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (campaign_id, user_id));
CREATE INDEX IF NOT EXISTS idx_sends_pending ON campaign_sends(delivered);

/* One row per user who opened the app from a campaign's "Open App" button.
   The composite primary key is the whole mechanism: a user who taps the
   button five times is one row, so the open rate measures people reached
   rather than enthusiasm. Writes go through INSERT OR IGNORE, so the stored
   time is the FIRST tap, never the latest. */
CREATE TABLE IF NOT EXISTS campaign_opens (
  campaign_id TEXT NOT NULL, user_id TEXT NOT NULL, at INTEGER NOT NULL,
  PRIMARY KEY (campaign_id, user_id));
`;

const UNIT_MS = {
  second: 1_000, seconds: 1_000,
  minute: 60_000, minutes: 60_000,
  hour: 3_600_000, hours: 3_600_000,
  day: 86_400_000, days: 86_400_000,
  week: 604_800_000, weeks: 604_800_000,
  month: 2_592_000_000, months: 2_592_000_000,
};

/** The limit dropdown stores words ("one", "two", "three"); older docs may hold numbers. */
const WORD_N = { one: 1, two: 2, three: 3 };
const capOf = (v) => WORD_N[String(v ?? '').toLowerCase()] ?? (Number(v) || 0);

const offsetMs = (n, unit) => (Number(n) || 0) * (UNIT_MS[String(unit ?? 'day').toLowerCase()] ?? UNIT_MS.day);

/** Which group each "Select User Type" checkbox belongs to, and what it asserts. */
const TYPE_GROUPS = {
  'No Subscriber': ['subscription', 'none'],
  'Active Subscriber': ['subscription', 'active'],
  'Expired Subscriber': ['subscription', 'expired'],
  'No Broker': ['broker', 'none'],
  'Pending Broker': ['broker', 'pending'],
  'Active Broker': ['broker', 'active'],
  'No Referral': ['referral', 'none'],
  'Pending Referral': ['referral', 'pending'],
  'Active Referral': ['referral', 'active'],
};

/**
 * Dates reach here in two shapes: ISO (`<input type="date">`) and the
 * human "May 20, 2024" the seeded records and the admin's own formatters use.
 * Slicing to 10 chars turns the second into "May 20, 2" and quietly yields NaN,
 * which reads downstream as "this campaign has no start date".
 */
const dayMs = (s) => {
  if (!s) return null;
  const str = String(s).trim();
  /* "2026-08-15 · 12:34" (review_queue.requested_at) keeps its time; a bare
     date is that day's midnight — hour/minute triggers need the real instant
     when one is recorded. Both are wall clock in the system zone (tz.mjs),
     which is what wrote them. */
  const stamped = /^(\d{4}-\d{2}-\d{2}) · (\d{2}:\d{2})/.exec(str);
  if (stamped) return wallMs(`${stamped[1]}T${stamped[2]}`);
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(str);
  if (iso) return wallMs(`${iso[0]}T00:00`);
  const t = Date.parse(str);
  return Number.isNaN(t) ? null : t;
};

export function openCampaigns(db) {
  /* Per-user resend support: `n` counts how many times this campaign has
     reached this user, `due_at` is the trigger instant of the latest send —
     the "occurrence" it fired for. Added in place; rows from before carry
     n = 1 and no due_at. */
  const cols = new Set(db.prepare('PRAGMA table_info(campaign_sends)').all().map((c) => c.name));
  if (!cols.has('n')) db.exec('ALTER TABLE campaign_sends ADD COLUMN n INTEGER NOT NULL DEFAULT 1');
  if (!cols.has('due_at')) db.exec('ALTER TABLE campaign_sends ADD COLUMN due_at INTEGER');

  const q = {
    users: db.prepare('SELECT * FROM users'),
    user: db.prepare('SELECT * FROM users WHERE id = ?'),
    subscriber: db.prepare('SELECT * FROM subscribers WHERE id = ?'),

    /* Broker relationship, as the app models it: an approved rebate row is
       active, an undecided queue row is pending. */
    brokerState: db.prepare(`SELECT
        (SELECT COUNT(*) FROM rebates WHERE user_id = ?) AS active,
        (SELECT COUNT(*) FROM review_queue WHERE user_id = ? AND decision IS NULL) AS pending,
        (SELECT MIN(rowid) FROM review_queue WHERE user_id = ? AND decision IS NULL) AS pending_row`),
    pendingBrokerAt: db.prepare(`SELECT requested_at FROM review_queue
      WHERE user_id = ? AND decision IS NULL ORDER BY rowid LIMIT 1`),

    /* Referral relationship: an invitee who has ever subscribed is active, one
       who has not is still pending. */
    invitees: db.prepare(`SELECT u.id, u.joined_at,
        (SELECT MIN(at) FROM ledger l WHERE l.user_id = u.id AND l.kind = 'signup') AS signed_at,
        (SELECT COUNT(*) FROM subscribers s WHERE s.id = u.id AND s.status = 'active') AS active
      FROM users u WHERE u.referred_by = ? ORDER BY u.rowid`),
    signedAt: db.prepare(`SELECT MIN(at) AS at FROM ledger WHERE user_id = ? AND kind = 'signup'`),

    lastLedger: db.prepare(`SELECT at FROM ledger WHERE user_id = ? AND kind = ?
      ORDER BY at DESC LIMIT 1`),
    /* Real money only: decideReview logs every broker decision (approved,
       rejected, waiting) as a zero-amount 'cashback' activity row, which must
       not read as "has received cashback". */
    anyCashback: db.prepare(`SELECT 1 FROM ledger WHERE user_id = ? AND kind = 'cashback'
      AND (amount > 0 OR revenue > 0) LIMIT 1`),

    campaigns: db.prepare(`SELECT * FROM campaigns WHERE status = 'active'`),
    sent: db.prepare('SELECT n, at, due_at FROM campaign_sends WHERE campaign_id = ? AND user_id = ?'),
    send: db.prepare(`INSERT OR IGNORE INTO campaign_sends (campaign_id, user_id, at, code, delivered, n, due_at)
      VALUES (?, ?, ?, ?, 0, 1, ?)`),
    resend: db.prepare(`UPDATE campaign_sends SET n = n + 1, at = ?, code = ?, delivered = 0, due_at = ?
      WHERE campaign_id = ? AND user_id = ?`),
    markDelivered: db.prepare('UPDATE campaign_sends SET delivered = 1 WHERE campaign_id = ? AND user_id = ?'),
    undelivered: db.prepare(`SELECT s.*, u.telegram_id, c.doc FROM campaign_sends s
      JOIN users u ON u.id = s.user_id
      JOIN campaigns c ON c.id = s.campaign_id
      WHERE s.delivered = 0`),
    sendCount: db.prepare('SELECT COALESCE(SUM(n), 0) AS n FROM campaign_sends WHERE campaign_id = ?'),
    codeCount: db.prepare('SELECT COUNT(*) AS n FROM discount_codes WHERE campaign_id = ?'),

    /* The campaign table's figures, every one of them counted rather than
       stored. `delivered = 1` is deliberate: a send that Telegram rejected
       was never in front of anybody and must not dilute the open rate. */
    stats: db.prepare(`SELECT
        (SELECT COALESCE(SUM(CASE WHEN delivered = 1 THEN n ELSE n - 1 END), 0)
           FROM campaign_sends WHERE campaign_id = c.id) AS sent,
        (SELECT COUNT(*) FROM campaign_opens WHERE campaign_id = c.id) AS opened,
        (SELECT COUNT(*) FROM discount_codes WHERE campaign_id = c.id) AS codes,
        (SELECT COUNT(*) FROM discount_codes WHERE campaign_id = c.id AND used_at IS NOT NULL) AS codes_used
      FROM (SELECT ? AS id) c`),
    recordOpen: db.prepare(`INSERT OR IGNORE INTO campaign_opens
      (campaign_id, user_id, at) VALUES (?, ?, ?)`),
    sendExists: db.prepare('SELECT 1 FROM campaign_sends WHERE campaign_id = ? AND user_id = ?'),

    insertCode: db.prepare(`INSERT INTO discount_codes
      (code, campaign_id, user_id, plans, percent, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`),
    code: db.prepare('SELECT * FROM discount_codes WHERE code = ?'),
    useCode: db.prepare('UPDATE discount_codes SET used_at = ?, order_id = ? WHERE code = ? AND used_at IS NULL'),
    myCodes: db.prepare(`SELECT * FROM discount_codes WHERE user_id = ? AND used_at IS NULL
      AND (expires_at IS NULL OR expires_at > ?) ORDER BY created_at DESC`),

    refCampaignByName: db.prepare('SELECT id FROM referral_campaigns WHERE name = ? OR id = ?'),
    brokerByNameOrId: db.prepare('SELECT id FROM brokers WHERE name = ? OR id = ?'),

    campaignById: db.prepare('SELECT doc FROM campaigns WHERE id = ?'),
    usedCodeCount: db.prepare(`SELECT COUNT(*) AS n FROM discount_codes
      WHERE campaign_id = ? AND user_id = ? AND used_at IS NOT NULL`),
    /* A public code is never burned (shared by design), so one person's
       redemptions of it are their confirmed orders that carried it.
       orders.user_id is the Telegram id, hence the join. */
    usedPublicCount: db.prepare(`SELECT COUNT(*) AS n FROM orders o JOIN users u ON u.telegram_id = o.user_id
      WHERE o.discount_code = ? AND u.id = ? AND o.confirmed_at IS NOT NULL`),

    /* For the in-app card's expiry: has every code this campaign ever minted
       run out? `openEnded` (a code with no expiry) or `n = 0` (nothing minted
       yet) both mean "not expired" — the offer hasn't started running out. */
    codeExpiry: db.prepare(`SELECT COUNT(*) AS n, MAX(expires_at) AS max_expires,
        SUM(CASE WHEN expires_at IS NULL THEN 1 ELSE 0 END) AS open_ended
      FROM discount_codes WHERE campaign_id = ?`),
  };

  /** The three axes the state matrix tests, resolved live. */
  function stateOf(userId, now) {
    const sub = q.subscriber.get(userId);
    const subscription = !sub ? 'none'
      : sub.status === 'active' && (sub.expires_at == null || sub.expires_at > now) ? 'active'
        : 'expired';
    const b = q.brokerState.get(userId, userId, userId);
    const broker = b.active > 0 ? 'active' : b.pending > 0 ? 'pending' : 'none';
    const invitees = q.invitees.all(userId);
    const referral = invitees.some((i) => i.active) ? 'active'
      : invitees.length ? 'pending' : 'none';
    return { subscription, broker, referral, plan: sub?.plan, invitees, sub };
  }

  /**
   * When this campaign is due for this user, as an epoch ms, or null when the
   * anchoring event has not happened. "Remaining Subscription" counts BACKWARDS
   * from the expiry — it is the only trigger that fires before its event.
   */
  function dueAt(campaign, userId, state, user) {
    const off = offsetMs(campaign.triggerN ?? 7, campaign.triggerUnit ?? 'day');
    const last = (kind) => q.lastLedger.get(userId, kind)?.at ?? null;
    const plus = (t) => (t == null ? null : t + off);
    // The signup row holds the exact instant; joined_at is date-only.
    const started = () => q.signedAt.get(userId)?.at ?? dayMs(user.joined_at);
    const joined = (i) => i.signed_at ?? dayMs(i.joined_at);

    switch (campaign.triggerType) {
      case 'After Start Robot':
        return plus(started());
      case 'After Subscription Started':
        return plus(last('subscription') ?? dayMs(state.sub?.purchased_at));
      case 'After Subscription Expired':
        return plus(last('expiry'));
      case 'Remaining Subscription':
        return state.sub?.expires_at == null ? null : state.sub.expires_at - off;
      case 'After Pending Broker':
        return plus(dayMs(q.pendingBrokerAt.get(userId)?.requested_at));
      case 'No Cashback Received':
        // Fires only while the thing it is waiting for still has not happened.
        return q.anyCashback.get(userId) ? null : plus(started());
      case 'After Pending Referral': {
        const pending = state.invitees.find((i) => !i.active);
        return pending ? plus(joined(pending)) : null;
      }
      case 'Last Referral Joined': {
        const lastOne = state.invitees.at(-1);
        return lastOne ? plus(joined(lastOne)) : null;
      }
      case 'After Active Referral': {
        const active = state.invitees.find((i) => i.active);
        return active ? plus(joined(active)) : null;
      }
      case 'Last Active Referral': {
        const active = state.invitees.filter((i) => i.active).at(-1);
        return active ? plus(joined(active)) : null;
      }
      default:
        return plus(started());
    }
  }

  /** Does the user's live state satisfy the campaign's checkbox matrix? */
  function matchesTypes(campaign, state) {
    const types = campaign.userTypes;
    if (!Array.isArray(types) || !types.length) return true;

    const wanted = { subscription: [], broker: [], referral: [] };
    for (const t of types) {
      const g = TYPE_GROUPS[t];
      if (g) wanted[g[0]].push(g[1]);
    }
    for (const axis of ['subscription', 'broker', 'referral']) {
      // An axis with nothing ticked is not a filter on that axis.
      if (wanted[axis].length && !wanted[axis].includes(state[axis])) return false;
    }
    // The plan chips narrow the subscriber branches (active or expired — the
    // lapsed plan is still on the row); a user with no subscription has no plan
    // to narrow by.
    if (state.subscription !== 'none' && wanted.subscription.includes(state.subscription)
      && Array.isArray(campaign.audiencePlans) && campaign.audiencePlans.length
      && !campaign.audiencePlans.includes(state.plan)) return false;
    return true;
  }

  /** The editor stores multi-selects as one 'A, B' string; '—' is none. */
  const listOf = (s) => (!s || s === '—' ? [] : String(s).split(',').map((x) => x.trim()).filter(Boolean));

  /* OR within a list, AND across the two lists — the exact sentence
     describeAudience shows the admin: "Users in (A or B) and with an account
     at (X or Y)". Lists hold display names; resolve to ids before comparing. */
  function matchesAudience(campaign, user) {
    if (campaign.allUsers !== false) return true;
    const refs = listOf(campaign.referralLists);
    if (refs.length && !refs.some((name) => {
      const target = q.refCampaignByName.get(name, name);
      return !!target && user.ref_campaign === target.id;
    })) return false;
    const brokers = listOf(campaign.brokerLists);
    if (brokers.length && !brokers.some((name) => {
      const id = q.brokerByNameOrId.get(name, name)?.id ?? name;
      return user.broker === id || user.broker_id === id;
    })) return false;
    return true;
  }

  function mintCode(campaign, userId, now) {
    if (!campaign.discountValue) return null;
    /* A public code is one string for everyone: a single row with a null
       user_id, created on the first send. It still needs the row — without it
       `checkCode` would reject the very code the campaign just handed out. */
    if (campaign.codeType === 'public') {
      const shared = (campaign.publicCode || '').trim().toUpperCase();
      if (!shared) return null;
      if (!q.code.get(shared)) {
        q.insertCode.run(
          shared, campaign.id, null,
          (campaign.applicablePlans ?? []).join(','), campaign.discountValue,
          campaign.expiryN ? now + offsetMs(campaign.expiryN, campaign.expiryUnit) : null,
          now,
        );
      }
      return shared;
    }
    let code;
    do {
      code = `TF${randomBytes(3).toString('hex').toUpperCase()}`;
    } while (q.code.get(code));
    const expires = campaign.expiryN ? now + offsetMs(campaign.expiryN, campaign.expiryUnit) : null;
    q.insertCode.run(
      code, campaign.id, userId,
      (campaign.applicablePlans ?? []).join(','), campaign.discountValue, expires, now,
    );
    return code;
  }

  return {
    /**
     * What a campaign actually achieved, counted from its own rows.
     *
     * Every figure is null when there is nothing behind it, rather than 0:
     * a campaign that has sent nothing has no open rate, and printing "0%"
     * would report a measurement that was never taken. The admin renders
     * null as an em-dash.
     */
    stats(campaignId) {
      const r = q.stats.get(campaignId);
      const rate = (num, den) => (den ? Math.round((num / den) * 1000) / 10 : null);
      return {
        /* `sent` and `codes` are the raw totals GET /campaigns/:id/stats has
           always returned. `sent` counts every attempt; `messageSent` counts
           only the ones Telegram delivered, which is the honest denominator
           for a rate about people who saw something. */
        sent: q.sendCount.get(campaignId).n,
        codes: q.codeCount.get(campaignId).n,
        messageSent: r.sent || null,
        openRate: rate(r.opened, r.sent),
        codeSent: r.codes || null,
        codeUsedRate: rate(r.codes_used, r.codes),
      };
    },

    /**
     * Record that `userId` opened the app from `campaignId`'s button.
     *
     * Only counts for someone the campaign was actually sent to — otherwise a
     * forwarded link would let the open rate exceed 100%. Repeat taps are
     * dropped by the table's primary key, so the first one is the only one.
     */
    recordOpen(campaignId, userId, now = Date.now()) {
      if (!campaignId || !userId) return false;
      if (!q.sendExists.get(campaignId, userId)) return false;
      return q.recordOpen.run(campaignId, userId, now).changes > 0;
    },

    /**
     * The "Expiry" field expires the discount code (checked in `checkCode`
     * above) and, from the same clock, the in-app card. A campaign with no
     * codes minted yet isn't expired — the offer hasn't started running out.
     */
    codesExpired(campaignId, now = Date.now()) {
      const r = q.codeExpiry.get(campaignId);
      if (!r?.n || r.open_ended) return false;
      return r.max_expires <= now;
    },

    /**
     * Evaluate every active campaign against every user. Returns the sends it
     * created, so the caller can deliver them.
     *
     * ponytail: full cross product, campaigns × users, on an hourly tick. At a
     * few thousand users that is milliseconds of synchronous SQLite. Narrow it
     * with a candidate query per trigger type if the user table reaches six
     * figures.
     */
    evaluate(now = Date.now()) {
      const campaigns = q.campaigns.all().map((r) => ({ ...JSON.parse(r.doc), id: r.id, name: r.name }));
      if (!campaigns.length) return [];
      const users = q.users.all();
      const fired = [];

      for (const campaign of campaigns) {
        const startsAt = dayMs(campaign.startDate);
        const endsAt = dayMs(campaign.endDate);
        if (startsAt && now < startsAt) continue;
        // The end date is a day the campaign still runs on, not the day it stops.
        if (endsAt && now >= endsAt + UNIT_MS.day) continue;
        /* A campaign fires for a user once per occurrence of its trigger — a
           renewal is a new "subscription started", the next expiry a new
           "3 days before". "Send Limit" caps how many of those a user gets
           ("Two times per user"); "No Limit" (notifications) and "Usage
           Limit" (the cap is on redemptions instead) leave that open. */
        const perUser = campaign.limitType === 'Send Limit' ? capOf(campaign.sendLimit) || 1 : Infinity;

        for (const user of users) {
          const prev = q.sent.get(campaign.id, user.id);
          if (prev && prev.n >= perUser) continue;
          if (!matchesAudience(campaign, user)) continue;
          const state = stateOf(user.id, now);
          if (!matchesTypes(campaign, state)) continue;
          const due = dueAt(campaign, user.id, state, user);
          if (due == null || due > now) continue;
          // Same occurrence as the last send (rows from before due_at existed
          // count their send time): nothing new has happened.
          if (prev && due <= (prev.due_at ?? prev.at)) continue;

          const code = mintCode(campaign, user.id, now);
          if (prev) q.resend.run(now, code, due, campaign.id, user.id);
          else q.send.run(campaign.id, user.id, now, code, due);
          fired.push({ campaignId: campaign.id, userId: user.id, code, telegramId: user.telegram_id });
        }
      }
      return fired;
    },

    /** Sends still waiting on a Telegram message. */
    pendingDeliveries: () => q.undelivered.all().map((r) => ({
      campaignId: r.campaign_id, userId: r.user_id, code: r.code,
      telegramId: r.telegram_id, campaign: JSON.parse(r.doc),
    })),
    markDelivered: (campaignId, userId) => q.markDelivered.run(campaignId, userId).changes > 0,

    /** Delivery counters for the campaign table, counted not stored. */
    /** Live offers for this user — what the Mini App shows on its cards. */
    offersFor(userId, now = Date.now()) {
      return q.myCodes.all(userId, now).map((c) => ({
        code: c.code, percent: c.percent,
        plans: c.plans ? c.plans.split(',') : [],
        expiresAt: c.expires_at, campaignId: c.campaign_id,
      }));
    },

    /**
     * Validate a code at checkout. Unique codes are bound to one user and one
     * use — "non-shareable" is only true if the check enforces it, so a code
     * belonging to somebody else is rejected here rather than at redemption.
     */
    checkCode(code, userId, planId, now = Date.now()) {
      const row = q.code.get(String(code ?? '').trim().toUpperCase());
      if (!row) return { error: 'unknown_code' };
      if (row.used_at) return { error: 'code_used' };
      if (row.expires_at && row.expires_at <= now) return { error: 'code_expired' };
      if (row.user_id && row.user_id !== userId) return { error: 'not_your_code' };
      /* "Usage Limit" caps how many times one person redeems this campaign's
         offer ("One time per user"): their burned unique codes plus, for a
         public code, their confirmed orders that carried it. Checked here so
         a capped-out code fails at checkout, before an order is priced.
         ponytail: open (unconfirmed) orders don't count, so a user can hold
         several discounted invoices at once; only confirmations are capped. */
      const docRow = q.campaignById.get(row.campaign_id);
      const doc = docRow ? JSON.parse(docRow.doc) : null;
      if (doc?.limitType === 'Usage Limit' && userId) {
        const cap = capOf(doc.usageLimit);
        if (cap) {
          const used = q.usedCodeCount.get(row.campaign_id, userId).n
            + (row.user_id ? 0 : q.usedPublicCount.get(row.code, userId).n);
          if (used >= cap) return { error: 'limit_reached' };
        }
      }
      const plans = row.plans ? row.plans.split(',') : [];
      if (planId && plans.length && !plans.includes(planId)) return { error: 'wrong_plan', plans };
      return { code: row.code, percent: row.percent, plans };
    },

    /**
     * Spend a code. Only unique codes are burned — a public code is shared by
     * design, so marking it used on the first redemption would cancel the
     * campaign for everyone else who received it.
     */
    redeem(code, userId, orderId, now = Date.now()) {
      const check = this.checkCode(code, userId, null, now);
      if (check.error) return check;
      const row = q.code.get(check.code);
      if (!row.user_id) return { ok: true, percent: check.percent, shared: true };
      return q.useCode.run(now, orderId ?? null, check.code).changes > 0
        ? { ok: true, percent: check.percent }
        : { error: 'code_used' };
    },
  };
}
