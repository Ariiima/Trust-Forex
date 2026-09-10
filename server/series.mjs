/**
 * Chart series for the dashboard — subscription / broker / referral.
 *
 * Nothing here is stored. Every point is replayed from the ledger (and the
 * review queue / users table) at read time, one dense day per dimension, then
 * rolled up to the requested grain. The `series` table this replaced was
 * written only by the demo seed, so once real users arrived every chart on
 * the dashboard was empty.
 *
 * Rolling daily rows up correctly needs three distinct rules, and getting
 * them wrong is what makes a dashboard quietly lie:
 *
 *   stocks  — a level (users on the books). Sums ACROSS dimensions, but takes
 *             the LAST day ACROSS time. Adding Monday's headcount to Tuesday's
 *             would report double the users.
 *   flows   — an amount accrued in a period (revenue, renewals). Sums across
 *             both.
 *   ratios  — never averaged. Percentages are recomputed from their own
 *             numerator and denominator after those have been aggregated,
 *             because the mean of daily rates is not the rate of the period.
 */

import { fmtDay } from './tz.mjs';

const DAY_MS = 86_400_000;
const dayOf = (ms) => fmtDay(ms);
const round2 = (n) => Math.round(n * 100) / 100;

export const SERIES_SPEC = {
  broker: {
    // activeUsers/pendingUsers are levels — who is approved / waiting for a
    // deposit right now. cashbackUsers is a FLOW: who was actually paid in
    // this period, so it is comparable with the money beside it and can never
    // outgrow the active headcount the way an ever-paid running total does.
    stocks: ['activeUsers', 'pendingUsers'],
    flows: ['cashbackUsers', 'grossRebate', 'sharedCashback', 'netRevenue'],
    // Counted as PEOPLE, not summed: these carry member ids per day, so
    // selecting several brokers unions them. One person paid at two brokers is
    // one cashback user — summing per broker double-counted them.
    people: ['activeUsers', 'pendingUsers', 'cashbackUsers'],
    ratios: {},
  },
  subscription: {
    stocks: ['totalSubscribers'],
    flows: ['renewals', 'reactivations', 'netRevenue', 'renewalsDue', 'lapsed'],
    // renewalsDue = renewals + lapsed: a term that ended was either renewed or
    // it lapsed. reactivationRate = how many of the lapsed came back.
    ratios: { renewalRate: ['renewals', 'renewalsDue'], reactivationRate: ['reactivations', 'lapsed'] },
    // Denominators the chart never plots on their own.
    internal: ['renewalsDue', 'lapsed'],
  },
  /* The referral funnel, in the order it actually happens:
       introduced  — people whose own referral link has brought in at least one
                     user. They are referrers, not referrals.
       invited     — everyone those referrers brought in.
       activeUsers — the invited accounts holding a live subscription.
     Plan and Cashback are shares of ACTIVE users, and both conversions are
     STOCKS like the denominator they divide by — a ratio is only meaningful
     when both sides aggregate the same way. */
  referral: {
    stocks: ['introduced', 'invited', 'activeUsers', 'planConversions', 'cashbackConversions'],
    flows: ['revenue', 'revenueShared', 'revenueNet'],
    ratios: {
      planRate: ['planConversions', 'activeUsers'],
      cashbackRate: ['cashbackConversions', 'activeUsers'],
    },
    internal: ['planConversions', 'cashbackConversions'],
  },
};

export const seriesNames = () => Object.keys(SERIES_SPEC);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** How many days a full bucket holds, used to spot a partial one. */
const GRAIN_DAYS = { daily: 1, weekly: 7, cycle: 7, monthly: 28, quarterly: 90 };

export const GRAINS = Object.keys(GRAIN_DAYS);

/** Bucket key + human label for a YYYY-MM-DD day at the requested grain. */
function bucketOf(day, grain) {
  const [y, m, d] = day.split('-').map(Number);
  if (grain === 'monthly') return { key: `${y}-${m}`, label: `${MONTHS[m - 1]} ${y}` };
  if (grain === 'daily') return { key: day, label: `${MONTHS[m - 1]} ${d}` };
  if (grain === 'quarterly') {
    const quarter = Math.floor((m - 1) / 3) + 1;
    return { key: `${y}-Q${quarter}`, label: `Q${quarter} ${y}` };
  }

  // Weekly and cycle both snap back to the Monday that owns this day: a
  // cashback payout cycle IS one Monday-to-Sunday week. They differ only in
  // how the bucket is named — a cycle is read as the span it paid out for,
  // so it carries both ends rather than just its first day.
  const date = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(date);
  monday.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const key = monday.toISOString().slice(0, 10);
  if (grain !== 'cycle') {
    return { key, label: `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()}` };
  }
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const end = monday.getUTCMonth() === sunday.getUTCMonth()
    ? `${sunday.getUTCDate()}`
    : `${MONTHS[sunday.getUTCMonth()]} ${sunday.getUTCDate()}`;
  return { key, label: `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()}–${end}` };
}

/**
 * Roll day rows `{dim, day, vals}` into chart points.
 * `rows` must already be filtered to the wanted dimensions and date range.
 */
export function aggregate(name, rows, grain) {
  const spec = SERIES_SPEC[name];
  if (!spec) return [];
  const measures = [...spec.stocks, ...spec.flows];
  const people = spec.people ?? [];

  // 1. Collapse dimensions: same day, different brokers -> one day. Numbers
  //    add; headcount members union, so a user counted under two brokers is
  //    one user.
  const days = new Map();
  for (const row of rows) {
    const day = days.get(row.day)
      ?? Object.fromEntries(measures.map((k) => [k, people.includes(k) ? new Set() : 0]));
    for (const k of measures) {
      if (people.includes(k)) for (const id of row.vals[k] ?? []) day[k].add(id);
      else day[k] += row.vals[k] ?? 0;
    }
    days.set(row.day, day);
  }

  // 2. Collapse days into buckets: flows accumulate, stocks take the last day.
  //    `_days` tracks how many days landed in each bucket so a partial one can
  //    be recognised below.
  const buckets = new Map();
  for (const day of [...days.keys()].sort()) {
    const { key, label } = bucketOf(day, grain);
    const bucket = buckets.get(key) ?? {
      label, _days: 0,
      ...Object.fromEntries(measures.map((k) => [k, people.includes(k) ? new Set() : 0])),
    };
    bucket._days += 1;
    for (const k of spec.flows) {
      if (people.includes(k)) for (const id of days.get(day)[k]) bucket[k].add(id);
      else bucket[k] += days.get(day)[k];
    }
    for (const k of spec.stocks) bucket[k] = days.get(day)[k];
    buckets.set(key, bucket);
  }

  // Drop a leading or trailing bucket that only caught part of its period.
  // A week holding two days of revenue is not a low week, it is an artefact of
  // where the range happens to start, and plotting it reads as a crash.
  const ordered = [...buckets.values()];
  const full = GRAIN_DAYS[grain] ?? 7;
  while (ordered.length > 1 && ordered[0]._days < full) ordered.shift();
  while (ordered.length > 1 && ordered[ordered.length - 1]._days < full) ordered.pop();

  // 3. Derive ratios from the aggregated components, then drop the internals.
  //    Money is rounded here, once: summing 120 daily floats otherwise surfaces
  //    as $4827.160000000001 in a tooltip.
  return ordered.map((bucket) => {
    const point = { label: bucket.label };
    for (const k of measures) point[k] = people.includes(k) ? bucket[k].size : round2(bucket[k]);
    for (const [key, [num, den]] of Object.entries(spec.ratios)) {
      point[key] = bucket[den] ? Number(((bucket[num] / bucket[den]) * 100).toFixed(1)) : 0;
    }
    for (const k of spec.internal ?? []) delete point[k];
    return point;
  });
}

/* ---------------------------------------------------------------------
 * Day builders — the replay
 * ------------------------------------------------------------------- */

/**
 * The scaffolding every dataset shares: events grouped by day, replayed in
 * order, and after each day one dense row per dimension. `flow(dim, key, n)`
 * accrues into the current day; `stock(dim, key, n)` sets a level that
 * carries forward until it is set again — so a dimension that had nothing
 * happen today still emits yesterday's headcount, which is what makes a
 * weekly bucket read the right last-day value.
 */
function replay({ events, dims, spec, today, apply }) {
  if (!events.length) return [];
  const byDay = new Map();
  for (const e of events) {
    const day = dayOf(e.at);
    (byDay.get(day) ?? byDay.set(day, []).get(day)).push(e);
  }
  const first = [...byDay.keys()].sort()[0];
  const people = spec.people ?? [];
  const numStocks = spec.stocks.filter((k) => !people.includes(k));
  const numFlows = spec.flows.filter((k) => !people.includes(k));
  const zero = (keys) => Object.fromEntries(keys.map((k) => [k, 0]));
  const sets = (keys) => Object.fromEntries(keys.map((k) => [k, new Set()]));
  const levels = new Map(); // dim -> { stock: level }
  const crowds = new Map(); // dim -> { people stock: Set of member id }
  const rows = [];
  let dayFlows; // dim -> { flow: accrued today }
  let dayCrowds; // dim -> { people flow: Set of member id touched today }
  const ctx = {
    flow(dim, key, n = 1) {
      const f = dayFlows.get(dim) ?? dayFlows.set(dim, zero(numFlows)).get(dim);
      f[key] += n;
    },
    stock(dim, key, n) {
      const l = levels.get(dim) ?? levels.set(dim, zero(numStocks)).get(dim);
      l[key] += n;
    },
    /**
     * One member of a headcount. A `people` stock carries forward until taken
     * back out (`in_` false); a `people` flow only counts for today.
     */
    member(dim, key, id, in_ = true) {
      const day = !spec.stocks.includes(key);
      const bag = day ? dayCrowds : crowds;
      const c = bag.get(dim) ?? bag.set(dim, sets(people)).get(dim);
      if (in_) c[key].add(id); else c[key].delete(id);
    },
  };
  for (let t = Date.parse(first); t <= today; t += DAY_MS) {
    const day = dayOf(t);
    dayFlows = new Map();
    dayCrowds = new Map();
    for (const e of byDay.get(day) ?? []) apply(e, ctx);
    for (const dim of dims()) {
      const vals = { ...(levels.get(dim) ?? zero(numStocks)), ...(dayFlows.get(dim) ?? zero(numFlows)) };
      // ponytail: one member-id array copied per dim per day. Fine at
      // dashboard scale (brokers × days × members); if it ever bites, emit
      // deltas and rebuild the sets in aggregate().
      for (const k of people) {
        const bag = spec.stocks.includes(k) ? crowds : dayCrowds;
        vals[k] = [...(bag.get(dim)?.[k] ?? [])];
      }
      rows.push({ dim, day, vals });
    }
  }
  return rows;
}

/**
 * Per-user subscription state machine, shared by the subscription chart and
 * the referral funnel (whose "active" is "invitee holds a live plan").
 * A `subscription` row while active is a renewal, after an expiry a
 * reactivation, otherwise a first purchase; an `expiry` row lapses the plan.
 * A `grant` only moves the expiry, and the expiry row that eventually lands
 * is what the replay keys on — so grants need no event of their own.
 */
function subscriptionEvents(db) {
  const rows = db.prepare(`SELECT id, at, user_id, kind, tier, revenue, detail, key FROM ledger
    WHERE kind IN ('subscription', 'expiry') ORDER BY at, id`).all();
  // The inviter's cut on each sale, keyed `<sale key>:ref` by ledger.payReferral.
  const refCut = new Map(db.prepare(`SELECT key, amount FROM ledger WHERE kind = 'referral'`).all()
    .map((r) => [r.key, r.amount]));
  const state = new Map(); // user -> { plan, everHad }
  return rows.map((r) => {
    const s = state.get(r.user_id) ?? { plan: null, everHad: false };
    let e;
    if (r.kind === 'subscription') {
      const plan = r.tier ?? 'none';
      e = {
        at: r.at, user: r.user_id, plan, prevPlan: s.plan,
        type: s.plan ? 'renewal' : s.everHad ? 'reactivation' : 'new',
        revenue: r.revenue, net: round2(r.revenue - (refCut.get(`${r.key}:ref`) ?? 0)),
      };
      s.plan = plan; s.everHad = true;
    } else {
      // An expiry for a plan the ledger never saw start (pre-ledger data):
      // the detail is "<plan> subscription expired".
      const plan = s.plan ?? r.detail.split(' ')[0];
      e = { at: r.at, user: r.user_id, plan, prevPlan: s.plan, type: 'expiry' };
      s.plan = null; s.everHad = true;
    }
    state.set(r.user_id, s);
    return e;
  });
}

const PLANS = ['silver', 'gold', 'diamond'];

function subscriptionDays(db, today) {
  const events = subscriptionEvents(db);
  const seen = new Set(PLANS);
  for (const e of events) seen.add(e.plan);
  return replay({
    events, today,
    dims: () => [...seen],
    spec: SERIES_SPEC.subscription,
    apply(e, { flow, stock }) {
      if (e.type === 'expiry') {
        stock(e.plan, 'totalSubscribers', -1);
        flow(e.plan, 'lapsed');
        flow(e.plan, 'renewalsDue');
        return;
      }
      if (e.type === 'renewal') {
        flow(e.plan, 'renewals');
        flow(e.plan, 'renewalsDue');
        if (e.prevPlan !== e.plan) { // an upgrade moves the head to the new plan
          stock(e.prevPlan, 'totalSubscribers', -1);
          stock(e.plan, 'totalSubscribers', 1);
        }
      } else {
        if (e.type === 'reactivation') flow(e.plan, 'reactivations');
        stock(e.plan, 'totalSubscribers', 1);
      }
      flow(e.plan, 'netRevenue', e.net);
    },
  });
}

/**
 * Broker: headcounts from the review decisions (each one books a zero-amount
 * `cashback` row keyed `review:<queue id>:<decision>`), money from the weekly
 * payouts. Each decision moves the user between three memberships —
 * approved = active, waiting = pending (waiting for their first deposit),
 * rejected = neither. Every count is of PEOPLE, so the same user showing up
 * under two brokers is one user once the dimensions are unioned.
 */
function brokerDays(db, today) {
  // Brokers the ledger mentions count even after the broker row is deleted —
  // otherwise removing a broker silently erases the money it made.
  const brokers = new Set(db.prepare('SELECT id FROM brokers').all().map((b) => b.id));
  const pays = db.prepare(`SELECT at, user_id, broker_id, amount, revenue, key FROM ledger
    WHERE kind = 'cashback' AND broker_id IS NOT NULL ORDER BY at, id`).all();
  for (const p of pays) brokers.add(p.broker_id);

  const events = [];
  for (const p of pays) {
    const m = /^review:.+:(approved|rejected|waiting)$/.exec(p.key ?? '');
    if (m) events.push({ at: p.at, kind: 'decision', broker: p.broker_id, user: p.user_id, decision: m[1] });
    else if (p.amount > 0 || p.revenue > 0) {
      events.push({ at: p.at, kind: 'pay', broker: p.broker_id, user: p.user_id, gross: p.revenue, shared: p.amount });
    }
  }
  events.sort((a, b) => a.at - b.at);

  return replay({
    events, today,
    dims: () => [...brokers],
    spec: SERIES_SPEC.broker,
    apply(e, { flow, member }) {
      if (e.kind === 'decision') {
        member(e.broker, 'activeUsers', e.user, e.decision === 'approved');
        member(e.broker, 'pendingUsers', e.user, e.decision === 'waiting');
      } else {
        member(e.broker, 'cashbackUsers', e.user); // ever paid, never leaves
        flow(e.broker, 'grossRebate', e.gross);
        flow(e.broker, 'sharedCashback', e.shared);
        flow(e.broker, 'netRevenue', round2(e.gross - e.shared));
      }
    },
  });
}

/**
 * Referral: dimension 'all' is the whole programme; each referral campaign is
 * a dimension of its own (users.ref_campaign). Money matches the Referral
 * table — revenue is what invitees netted us, shared is what the inviter was
 * paid off their own ledger rows.
 */
function referralDays(db, today) {
  const campaigns = db.prepare('SELECT id FROM referral_campaigns').all().map((c) => c.id);
  const users = db.prepare(`SELECT id, referred_by, ref_campaign, joined_at FROM users
    WHERE referred_by IS NOT NULL OR ref_campaign IS NOT NULL`).all();
  const invitee = new Map(users.map((u) => [u.id, u]));
  const dimsOf = (u) => (u.ref_campaign ? ['all', u.ref_campaign] : ['all']);
  const signupAt = new Map(db.prepare(`SELECT user_id, at FROM ledger WHERE kind = 'signup' AND key LIKE 'signup:%'`)
    .all().map((r) => [r.user_id, r.at]));

  const events = [];
  for (const u of users) {
    const at = signupAt.get(u.id) ?? Date.parse(u.joined_at) ?? today;
    events.push({ at, kind: 'invited', user: u.id });
  }
  for (const e of subscriptionEvents(db)) {
    if (invitee.has(e.user)) events.push({ ...e, kind: 'sub' });
  }
  const money = db.prepare(`SELECT at, user_id, kind, amount, revenue, ref_user_id FROM ledger
    WHERE kind IN ('subscription', 'cashback', 'referral') ORDER BY at, id`).all();
  for (const m of money) {
    if (m.kind === 'referral') {
      if (invitee.has(m.ref_user_id)) events.push({ at: m.at, kind: 'shared', user: m.ref_user_id, amount: m.amount });
    } else if (invitee.has(m.user_id)) {
      events.push({
        at: m.at, kind: 'revenue', user: m.user_id,
        amount: round2(m.revenue - m.amount), cashback: m.kind === 'cashback' && m.amount > 0,
      });
    }
  }
  events.sort((a, b) => a.at - b.at);

  const introduced = new Map(); // dim -> Set of referrers seen
  const converted = { plan: new Set(), cashback: new Set() }; // `${dim}:${user}`
  return replay({
    events, today,
    dims: () => ['all', ...campaigns],
    spec: SERIES_SPEC.referral,
    apply(e, { flow, stock }) {
      const u = invitee.get(e.user);
      for (const dim of dimsOf(u)) {
        const k = `${dim}:${e.user}`;
        if (e.kind === 'invited') {
          stock(dim, 'invited', 1);
          if (u.referred_by) {
            const set = introduced.get(dim) ?? introduced.set(dim, new Set()).get(dim);
            if (!set.has(u.referred_by)) { set.add(u.referred_by); stock(dim, 'introduced', 1); }
          }
        } else if (e.kind === 'sub') {
          if (e.type === 'expiry') stock(dim, 'activeUsers', -1);
          else {
            if (e.type !== 'renewal') stock(dim, 'activeUsers', 1);
            if (!converted.plan.has(k)) { converted.plan.add(k); stock(dim, 'planConversions', 1); }
          }
        } else if (e.kind === 'shared') {
          flow(dim, 'revenueShared', e.amount);
          flow(dim, 'revenueNet', -e.amount);
        } else {
          flow(dim, 'revenue', e.amount);
          flow(dim, 'revenueNet', e.amount);
          if (e.cashback && !converted.cashback.has(k)) {
            converted.cashback.add(k); stock(dim, 'cashbackConversions', 1);
          }
        }
      }
    },
  });
}

const BUILDERS = { subscription: subscriptionDays, broker: brokerDays, referral: referralDays };

/**
 * @param dims   dimension ids to include; empty/omitted means all of them
 * @param from/to  YYYY-MM-DD, inclusive
 * @param grain  one of GRAINS
 */
export function computeSeries(db, name, { dims, from = '0000-00-00', to = '9999-99-99', grain = 'weekly', now = Date.now() } = {}) {
  const build = BUILDERS[name];
  if (!build) return [];
  let rows = build(db, now).filter((r) => r.day >= from && r.day <= to);
  if (dims?.length) {
    const wanted = new Set(dims);
    rows = rows.filter((r) => wanted.has(r.dim));
  }
  return aggregate(name, rows, grain);
}

/* ---------------------------------------------------------------------
 * Self-check: node server/series.mjs
 * ------------------------------------------------------------------- */
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) {
  const { DatabaseSync } = await import('node:sqlite');
  const { LEDGER_SCHEMA } = await import('./ledger.mjs');
  const assert = (await import('node:assert/strict')).default;
  const db = new DatabaseSync(':memory:');
  db.exec(LEDGER_SCHEMA);
  db.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, referred_by TEXT, ref_campaign TEXT, joined_at TEXT);
    CREATE TABLE brokers (id TEXT PRIMARY KEY);
    CREATE TABLE referral_campaigns (id TEXT PRIMARY KEY);
    CREATE TABLE review_queue (id TEXT PRIMARY KEY, user_id TEXT, broker_id TEXT, requested_at TEXT, decision TEXT);`);
  const D0 = Date.UTC(2026, 0, 5); // a Monday
  const day = (n, h = 12) => D0 + n * DAY_MS + h * 3_600_000;
  const put = db.prepare(`INSERT INTO ledger (at, user_id, kind, detail, amount, revenue, tier, broker_id, ref_user_id, key)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const L = (at, user, kind, { detail = '', amount = 0, revenue = 0, tier = null, broker = null, ref = null, key = null } = {}) =>
    put.run(at, user, kind, detail, amount, revenue, tier, broker, ref, key);

  // A: inviter. B: invited by A, buys silver, lapses, comes back. C: buys gold, renews.
  db.exec(`INSERT INTO users VALUES ('A', NULL, NULL, '2026-01-05'), ('B', 'A', 'camp1', '2026-01-05'), ('C', NULL, NULL, '2026-01-05');
    INSERT INTO referral_campaigns VALUES ('camp1'); INSERT INTO brokers VALUES ('bk'), ('bk2');
    INSERT INTO review_queue VALUES ('q1', 'B', 'bk', '2026-01-05 · 09:00', 'approved'),
      ('q2', 'B', 'bk2', '2026-01-05 · 09:00', 'approved');`);
  L(day(0), 'B', 'signup', { ref: 'A', key: 'signup:B' });
  L(day(0), 'B', 'subscription', { revenue: 10, tier: 'silver', key: 'order:1' });
  L(day(0), 'A', 'referral', { amount: 1.5, ref: 'B', key: 'order:1:ref' });
  L(day(1), 'C', 'subscription', { revenue: 30, tier: 'gold', key: 'order:2' });
  L(day(2), 'B', 'expiry', { detail: 'silver subscription expired', key: 'expiry:B:1' });
  L(day(3), 'B', 'subscription', { revenue: 10, tier: 'silver', key: 'order:3' });
  L(day(4), 'C', 'subscription', { revenue: 30, tier: 'gold', key: 'order:4' });
  L(day(0), 'B', 'cashback', { broker: 'bk', key: 'review:q1:waiting', detail: 'Waiting for deposit' });
  L(day(1), 'B', 'cashback', { broker: 'bk', key: 'review:q1:approved', detail: 'Broker request approved' });
  // Same person, a second broker: both counts must stay 1, not 2.
  L(day(1), 'B', 'cashback', { broker: 'bk2', key: 'review:q2:approved', detail: 'Broker request approved' });
  L(day(5), 'B', 'cashback', { broker: 'bk', amount: 15, revenue: 100, key: 'cash:c1:bk:B' });
  L(day(5), 'B', 'cashback', { broker: 'bk2', amount: 5, revenue: 20, key: 'cash:c1:bk2:B' });
  L(day(5), 'A', 'referral', { amount: 3, ref: 'B', key: 'cash:c1:bk:B:ref' });

  const now = day(6, 23);
  const sub = computeSeries(db, 'subscription', { grain: 'daily', now });
  assert.equal(sub.length, 7);
  assert.deepEqual(sub.map((p) => p.totalSubscribers), [1, 2, 1, 2, 2, 2, 2]);
  assert.equal(sub[3].reactivations, 1);
  assert.equal(sub[4].renewals, 1);
  assert.equal(sub[4].renewalRate, 100);
  assert.equal(sub[2].renewalRate, 0); // one lapsed, none renewed that day
  assert.equal(sub[3].reactivationRate, 0); // nothing lapsed on the day it came back
  assert.equal(sub[0].netRevenue, 8.5); // $10 minus the inviter's $1.50
  // Plan filter: gold only sees C.
  const gold = computeSeries(db, 'subscription', { dims: ['gold'], grain: 'daily', now });
  assert.deepEqual(gold.map((p) => p.totalSubscribers), [0, 1, 1, 1, 1, 1, 1]);
  // Weekly rollup: one full Mon–Sun bucket, flows summed, stock = last day.
  const wk = computeSeries(db, 'subscription', { grain: 'weekly', now });
  assert.equal(wk.length, 1);
  assert.equal(wk[0].renewals, 1);
  assert.equal(wk[0].reactivations, 1);
  assert.equal(wk[0].totalSubscribers, 2);
  assert.equal(wk[0].renewalRate, 50); // 1 renewal of 2 due (1 renewed + 1 lapsed)

  // Both brokers at once: one person, so every headcount is 1 — the money adds.
  const br = computeSeries(db, 'broker', { grain: 'daily', now });
  assert.deepEqual(br.map((p) => p.pendingUsers), [1, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(br.map((p) => p.activeUsers), [0, 1, 1, 1, 1, 1, 1]);
  // Paid in the period, not ever-paid: the day after the payout is back to 0.
  assert.deepEqual(br.map((p) => p.cashbackUsers), [0, 0, 0, 0, 0, 1, 0]);
  assert.equal(br[5].grossRebate, 120);
  assert.equal(br[5].sharedCashback, 20);
  assert.equal(br[5].netRevenue, 100);
  // One broker on its own still sees its own share.
  const one = computeSeries(db, 'broker', { dims: ['bk2'], grain: 'daily', now });
  assert.deepEqual(one.map((p) => p.pendingUsers), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(one.map((p) => p.cashbackUsers), [0, 0, 0, 0, 0, 1, 0]);
  assert.equal(one[5].grossRebate, 20);
  // Weekly: the payout week counts the payee once across both brokers.
  const brWk = computeSeries(db, 'broker', { grain: 'weekly', now });
  assert.equal(brWk.length, 1);
  assert.equal(brWk[0].cashbackUsers, 1);
  assert.equal(brWk[0].activeUsers, 1);
  assert.equal(brWk[0].grossRebate, 120);
  // A broker deleted from the table keeps its history.
  db.exec(`DELETE FROM brokers WHERE id = 'bk2'`);
  assert.equal(computeSeries(db, 'broker', { grain: 'weekly', now })[0].grossRebate, 120);

  const rf = computeSeries(db, 'referral', { dims: ['all'], grain: 'daily', now });
  assert.deepEqual(rf.map((p) => p.invited), [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(rf.map((p) => p.introduced), [1, 1, 1, 1, 1, 1, 1]);
  assert.deepEqual(rf.map((p) => p.activeUsers), [1, 1, 0, 1, 1, 1, 1]);
  assert.equal(rf[0].planRate, 100);
  assert.equal(rf[5].cashbackRate, 100);
  assert.equal(rf[0].revenue, 10);
  assert.equal(rf[0].revenueShared, 1.5);
  assert.equal(rf[0].revenueNet, 8.5);
  assert.equal(rf[5].revenue, 100); // $85 net at bk + $15 at bk2
  assert.equal(rf[5].revenueShared, 3);
  const camp = computeSeries(db, 'referral', { dims: ['camp1'], grain: 'daily', now });
  assert.equal(camp[0].invited, 1);
  assert.deepEqual(computeSeries(db, 'referral', { dims: ['nope'], grain: 'daily', now }), []);
  assert.deepEqual(computeSeries(db, 'unknown', { now }), []);
  console.log('series.mjs: ok');
}
