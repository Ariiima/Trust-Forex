/* ---------------------------------------------------------------------------
 * TEMPORARY DEMO DATA — six months of a fictional account's usage, served in
 * place of the real API so the Mini App can be shown off without a server (or
 * with an empty one).
 *
 * TO REMOVE: delete this file and the four lines that mention `mock` in
 * api/client.ts (`import { MOCK, mockResponse }` and the three-line early
 * return at the top of `request`). Nothing else in the app touches it.
 *
 * TO TURN ON: open the app with `?mock=1` (it sticks for the tab, `?mock=0`
 * clears it), or build/run with `VITE_MOCK=1`.
 *
 * Every figure below is derived from one list of credit events, so the totals
 * on Home, Cashback, Referral and Earning agree with each other and with the
 * histories behind them.
 * ------------------------------------------------------------------------- */

import type {
  ApiBroker, CashbackHistoryEntry, Me, MyReferral, Referral,
  SignalResult, WeeklyEarnings, WithdrawalRecord,
} from './client';

/* ---- the switch ---------------------------------------------------------- */

const KEY = 'tf-mock';
const param = new URLSearchParams(window.location.search).get('mock');
if (param !== null) {
  try {
    if (param === '0') sessionStorage.removeItem(KEY);
    else sessionStorage.setItem(KEY, '1');
  } catch { /* private mode — the URL param still covers this one page load */ }
}

function sticky(): boolean {
  try { return sessionStorage.getItem(KEY) === '1'; } catch { return false; }
}

export const MOCK: boolean =
  import.meta.env.VITE_MOCK === '1' || param === '1' || sticky();

/* ---- helpers ------------------------------------------------------------- */

const DAY = 86_400_000;
const WEEK = 7 * DAY;
const NOW = Date.now();
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Deterministic PRNG (mulberry32) — the same demo numbers on every reload. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const ymd = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Same week naming as the admin's `weekOf` (src/admin/sections/results-math.ts),
    duplicated here so removing the mock never has to touch admin code. */
function weekOf(ms: number): { id: string; period: string; range: string } {
  const d = new Date(ms);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const owner = new Date(start);
  owner.setUTCDate(owner.getUTCDate() + 3);

  const n = Math.floor((owner.getUTCDate() - 1) / 7) + 1;
  const from = `${SHORT[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const to = start.getUTCMonth() === end.getUTCMonth()
    ? `${end.getUTCDate()}`
    : `${SHORT[end.getUTCMonth()]} ${end.getUTCDate()}`;

  return {
    id: `w${start.toISOString().slice(0, 10)}`,
    period: `${LONG[owner.getUTCMonth()]} · Week ${n}`,
    range: start.getUTCFullYear() === end.getUTCFullYear()
      ? `${from}–${to}, ${end.getUTCFullYear()}`
      : `${from}, ${start.getUTCFullYear()}–${to}, ${end.getUTCFullYear()}`,
  };
}

/* ---- the story ----------------------------------------------------------- */

const JOINED = NOW - 183 * DAY;          // six months ago
const PLAN = 'diamond';                  // 12-month term, still running
const PLAN_PAID = 1699;
const TIER_PCT = 30;                     // diamond's cashback/referral rate
const REF_CODE = 'TF7K2M9';
const BOT = 'TrustForexBot';

interface Credit { at: number; kind: 'referral' | 'cashback'; amount: number }
const credits: Credit[] = [];

/* Cashback payouts — one per fortnightly rebate cycle, per linked broker. */
const cashbackHistory: CashbackHistoryEntry[] = [];
const BROKER_RUNS = [
  { id: 'exness', name: 'Exness', from: 14, low: 9, high: 47 },
  { id: 'xm', name: 'XM', from: 70, low: 4, high: 23 },
] as const;

for (const b of BROKER_RUNS) {
  const r = rng(b.id.length * 9001 + b.from);
  for (let d = b.from; d <= 183; d += 14) {
    const at = JOINED + d * DAY + 11 * 3600_000;
    if (at > NOW) break;
    const amount = round2(b.low + r() * (b.high - b.low));
    credits.push({ at, kind: 'cashback', amount });
    cashbackHistory.push({
      broker: b.id, brokerName: b.name, brokerLogo: null,
      at, ratePct: TIER_PCT, amount,
    });
  }
}
cashbackHistory.sort((a, b) => b.at - a.at);

/* Referrals — 23 invited, 14 of them earning. Indices 0–5 bought a plan,
   5–13 run cashback, so one invitee shows up in both counts. */
const PLAN_PRICES = [200, 499, 1699];
const referrals: Referral[] = [];

for (let i = 0; i < 23; i++) {
  const r = rng(4200 + i * 31);
  const joinedAt = JOINED + Math.floor(r() * 178) * DAY;
  let plan = 0;
  let cashback = 0;

  if (i <= 5) {
    const at = Math.min(NOW - DAY, joinedAt + (3 + Math.floor(r() * 17)) * DAY);
    plan = round2(PLAN_PRICES[Math.floor(r() * 3)] * 0.15);
    credits.push({ at, kind: 'referral', amount: plan });
  }
  if (i >= 5 && i <= 13) {
    for (let d = 21; joinedAt + d * DAY <= NOW; d += 14) {
      const amount = round2(0.6 + r() * 5.6);
      cashback = round2(cashback + amount);
      credits.push({ at: joinedAt + d * DAY, kind: 'referral', amount });
    }
  }

  referrals.push({ id: String(1180 + i * 7), joinedAt: String(joinedAt), plan, cashback });
}
referrals.sort((a, b) => Number(b.joinedAt) - Number(a.joinedAt));

/* ---- books derived from those events ------------------------------------- */

const sum = (kind: Credit['kind']) =>
  round2(credits.filter((c) => c.kind === kind).reduce((n, c) => n + c.amount, 0));

const cashbackEarned = sum('cashback');
const referralEarned = sum('referral');
const totalEarned = round2(cashbackEarned + referralEarned);

const withdrawals: WithdrawalRecord[] = [
  { id: 'wd_9f31', currency: 'USDT', network: 'TRC20', amount: 120, fee: 1, address: 'TQm4…9Kd2', status: 'completed', txid: '4b7c9e2a1d5f8c3b6a0e7d4f2c9b1a8e', createdAt: NOW - 121 * DAY },
  { id: 'wd_a70c', currency: 'USDT', network: 'TRC20', amount: 200, fee: 1, address: 'TQm4…9Kd2', status: 'completed', txid: 'e1d8c3b6a9f2074c5b8e1a3d6f9c2b40', createdAt: NOW - 53 * DAY },
  { id: 'wd_c22e', currency: 'USDT', network: 'BEP20', amount: 75, fee: 0.5, address: '0x8Ab…4C1e', status: 'pending', createdAt: NOW - 2 * DAY },
];
const withdrawn = round2(withdrawals.filter((w) => w.status === 'completed').reduce((n, w) => n + w.amount, 0));
const reserved = round2(withdrawals.filter((w) => w.status === 'pending').reduce((n, w) => n + w.amount, 0));
const balance = round2(totalEarned - withdrawn - reserved);

/** Same 20-week window the server builds (ledger.weeklyEarnings). */
function weeklyEarnings(): WeeklyEarnings[] {
  const end = Math.ceil(NOW / WEEK) * WEEK;
  const start = end - 20 * WEEK;
  const weeks: WeeklyEarnings[] = Array.from({ length: 20 }, (_, i) => ({
    start: start + i * WEEK, referral: 0, cashback: 0,
  }));
  for (const c of credits) {
    if (c.at < start || c.at >= end) continue;
    const w = weeks[Math.floor((c.at - start) / WEEK)];
    w[c.kind] = round2(w[c.kind] + c.amount);
  }
  return weeks;
}

/* ---- the account --------------------------------------------------------- */

const me: Me = {
  user: { id: 'tg100200300', name: 'Alex Morgan', plan: PLAN },
  tier: { id: 'diamond', pct: TIER_PCT / 100 },
  wallet: { balance, earned: totalEarned, withdrawn },
  refCode: REF_CODE,
  offers: [
    { code: 'LOYAL20', percent: 20, plans: [], expiresAt: NOW + 9 * DAY, campaignId: 'cmp_loyalty' },
  ],
  subscription: {
    plan: PLAN,
    status: 'active',
    daysLeft: 182,
    totalDays: 365,
    purchasedAt: ymd(JOINED),
    expiresAt: JOINED + 365 * DAY,
    totalPaid: PLAN_PAID,
  },
  cashback: { earned: cashbackEarned, netTotal: round2(cashbackEarned / 0.3), saleTotal: round2(cashbackEarned / 0.3) },
  referral: {
    invited: 23, active: 14, plan: 6, cashback: 9,
    revenue: round2(referralEarned / 0.15), earnings: round2(referralEarned / 0.15 - referralEarned),
    earned: referralEarned,
    share: { planPct: 15, cashbackPct: 10 },
    conversion: { planPct: 26, cashbackPct: 39 },
  },
  brokers: [
    { brokerId: 'exness', state: 'cashback-active', brokerAccountId: '40218877', email: 'alex.morgan@example.com', totalRebate: round2(cashbackHistory.filter((h) => h.broker === 'exness').reduce((n, h) => n + h.amount, 0)), sharedRebate: 0, requestedAt: String(JOINED + 5 * DAY) },
    { brokerId: 'xm', state: 'cashback-active', brokerAccountId: '71204431', email: 'alex.morgan@example.com', totalRebate: round2(cashbackHistory.filter((h) => h.broker === 'xm').reduce((n, h) => n + h.amount, 0)), sharedRebate: 0, requestedAt: String(JOINED + 61 * DAY) },
    { brokerId: 'ic-markets', state: 'waiting-for-deposit', brokerAccountId: '5590123', email: 'alex.morgan@example.com', totalRebate: 0, sharedRebate: 0, requestedAt: String(NOW - 6 * DAY) },
  ],
};

const myReferral: MyReferral = {
  code: REF_CODE,
  bot: BOT,
  botLink: `https://t.me/${BOT}?start=${REF_CODE}`,
  websiteLink: `https://trustforex.net/?ref=${REF_CODE}`,
  tier: PLAN,
  refInvited: 23,
  refActive: 14,
  refRevenue: me.referral.revenue,
  refEarnings: referralEarned,
};

const flow = (key: string, title: string) => ({ key, title, from: 'Trust Forex', chip: title, message: '' });

const brokers: ApiBroker[] = [
  {
    id: 'exness', name: 'Exness', color: '#FFD24C', status: 'active', rank: 1, shareRate: 0.3,
    preview: { brokerId: 'exness', name: 'Exness', badgeOn: true, badgeText: 'Popular', badgeColor: '#48D48A', requireEmail: true, requireUserId: true },
    flow: [flow('approved', 'Deposit confirmed'), flow('waiting-deposit', 'Account verified')],
  },
  {
    id: 'xm', name: 'XM', color: '#2B6CB0', status: 'active', rank: 2, shareRate: 0.28,
    preview: { brokerId: 'xm', name: 'XM', requireEmail: true, requireUserId: true },
    flow: [flow('approved', 'Deposit confirmed'), flow('waiting-deposit', 'Account verified')],
  },
  {
    id: 'ic-markets', name: 'IC Markets', color: '#E53E3E', status: 'active', rank: 3, shareRate: 0.25,
    preview: { brokerId: 'ic-markets', name: 'IC Markets', requireEmail: true, requireUserId: true },
    flow: [flow('approved', 'Deposit confirmed'), flow('waiting-deposit', 'Account verified')],
  },
];

/** 26 published weeks — six months of signal results, newest first. */
function signals(): SignalResult[] {
  const out: SignalResult[] = [];
  for (let i = 0; i < 26; i++) {
    const w = weekOf(NOW - (i + 1) * WEEK);
    const r = rng(7700 + i * 13);
    const total = 16 + Math.floor(r() * 20);
    const sl = Math.round(total * (0.18 + r() * 0.2));
    const rest = total - sl;
    const tp4 = Math.round(rest * (0.08 + r() * 0.1));
    const tp3 = Math.round(rest * (0.15 + r() * 0.1));
    const tp2 = Math.round(rest * (0.24 + r() * 0.1));
    out.push({ ...w, total, sl, tp1: rest - tp2 - tp3 - tp4, tp2, tp3, tp4 });
  }
  return out;
}

/* ---- the interception point ---------------------------------------------- */

/** The canned body for `path`, or undefined to let the real request through. */
export function mockResponse(path: string): unknown {
  const [route] = path.split('?');
  switch (route) {
    case '/me': return me;
    case '/me/subscription': return {
      status: 'active', planId: PLAN, billing: 'yearly', expiresAt: me.subscription!.expiresAt,
    };
    case '/me/flags': return { flags: ['referral_preview_seen', 'cashback_preview_seen'] };
    case '/me/wallet': return {
      balance, earned: totalEarned, withdrawn,
      history: [...credits]
        .sort((a, b) => b.at - a.at)
        .map((c, i) => ({ id: i + 1, at: c.at, kind: c.kind, detail: c.kind === 'cashback' ? 'Broker rebate' : 'Referral commission', amount: c.amount })),
    };
    case '/me/referral': return myReferral;
    case '/me/referrals': return { referrals };
    case '/me/cashback-history': return { history: cashbackHistory };
    case '/me/earnings-weekly': return { weeks: weeklyEarnings() };
    case '/me/withdrawals': return { withdrawals };
    case '/brokers': return { brokers };
    case '/signals': return { results: signals() };
    default: return undefined;
  }
}
