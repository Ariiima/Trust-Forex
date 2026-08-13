/* ---------------------------------------------------------------------------
 * Frontend client for the crypto payment gateway REST API (CONTRACT §"Frontend
 * API client"). Base '/api' — Vite dev proxies to the node server on :8787.
 * Auth: `Authorization: tma <initData>` header when running inside Telegram,
 * else `X-Guest-Id` — see telegram/index.ts's getGuestId.
 * ------------------------------------------------------------------------- */

import { getGuestId } from '../telegram';

export type OrderStatus = 'pending' | 'submitted' | 'confirmed' | 'failed' | 'expired';

export interface GatewayNetwork {
  network: string;
  address: string;
  memo?: string;
}

export interface Gateway {
  currency: string;
  name: string;
  networks: GatewayNetwork[];
}

export interface Order {
  id: string;
  planId: string;
  billing: 'monthly' | 'yearly';
  amountUsd: number;
  currency?: string;
  network?: string;
  /** Decimal string — unique-amount matching needs exact digits, never float. */
  amountCrypto?: string;
  address?: string;
  memo?: string;
  status: OrderStatus;
  txid?: string;
  confirmations?: number;
  requiredConfirmations?: number;
  detectedAt?: number;
  confirmedAt?: number;
  createdAt: number;
  /** Earning balance covering part of the price. `amountUsd` is the remainder
      that still has to be paid on-chain, so price = amountUsd + balanceUsed. */
  balanceUsed?: number;
  /** Partial payments (watcher sum-matching): what arrived / what is owed. */
  paidUsd?: number;
  remainingUsd?: number;
  /** Decimal string — the exact amount still to send. */
  remainingCrypto?: string;
  /** Paid past the asking price. Booked to the earning balance on confirm. */
  overpaidUsd?: number;
}

export interface Subscription {
  status: 'active' | 'expired' | 'none';
  planId?: string;
  billing?: 'monthly' | 'yearly';
  expiresAt?: number;
}

export class ApiError extends Error {
  status: number;

  /** Raw response body, kept so callers can read a structured `{ error }`. */
  body: string;

  constructor(status: number, body: string) {
    super(`API error ${status}${body ? `: ${body}` : ''}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** GET when `body` is undefined, JSON POST otherwise. */
async function request<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  const initData = window.Telegram?.WebApp?.initData;
  if (initData) headers.Authorization = 'tma ' + initData;
  else headers['X-Guest-Id'] = getGuestId();
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch('/api' + path, {
    method: body !== undefined ? 'POST' : 'GET',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new ApiError(res.status, await res.text().catch(() => ''));
  return (await res.json()) as T;
}

/* ---- API surface -------------------------------------------------------- */

function fetchGateways(): Promise<Gateway[]> {
  return request<{ gateways: Gateway[] }>('/gateways').then((r) => r.gateways);
}
// Cached like `me`/`brokers`/`signals` below: the wallet list is the same for
// everyone, so the boot prefetch (App.tsx) warms it once and the payment flow
// never has to show its `scr-route-hold` blank frame again mid-transition.
const gatewaysCache = cache<Gateway[]>(fetchGateways, []);
export const cachedGateways = () => gatewaysCache.peek();
export const getGateways = () => gatewaysCache.get();

export function createOrder(input: {
  planId: string;
  billing: 'monthly' | 'yearly';
  /** Display-only: the server prices the order from planId (+ code) itself. */
  amountUsd: number;
  /** Validated discount code from /api/discount — server re-checks and reprices. */
  code?: string;
  /** Put the earning balance towards this order. The server decides how much
      of it actually applies, from its own books. */
  useBalance?: boolean;
}): Promise<Order> {
  return request<{ order: Order }>('/orders', input).then((r) => r.order);
}

export function selectGateway(
  orderId: string,
  input: { currency: string; network: string },
): Promise<Order> {
  return request<{ order: Order }>(`/orders/${orderId}/select`, input).then((r) => r.order);
}

export function submitOrder(orderId: string, input?: { txid?: string }): Promise<Order> {
  return request<{ order: Order }>(`/orders/${orderId}/submit`, input ?? {}).then((r) => r.order);
}

export function getOrder(orderId: string): Promise<Order> {
  return request<{ order: Order }>(`/orders/${orderId}`).then((r) => r.order);
}

export function getSubscription(): Promise<Subscription> {
  return request<Subscription>('/me/subscription');
}

/* ---- read-through cache --------------------------------------------------
 * Every tab switch unmounts and remounts a screen, so an uncached fetch means
 * the same request on every visit and a visible swap from fallback to real data
 * each time. `cache` keeps the last answer per key and hands it back
 * synchronously, so screens can seed their initial state from it and only the
 * first visit of a session waits.
 *
 * A failed fetch caches `fallback` rather than propagating: none of this data
 * is worth an error state in the UI — the screens have static defaults and a
 * static build has no server at all. */
function cache<T>(load: (key: string) => Promise<T>, fallback: T) {
  const seen = new Map<string, T>();
  return {
    peek: (key = '') => seen.get(key),
    get: (key = '') =>
      load(key)
        .catch(() => fallback)
        .then((v) => {
          seen.set(key, v);
          return v;
        }),
  };
}

/* ---- the signed-in user --------------------------------------------------
 * One request answers home, cashback, referral and earning. Shapes mirror the
 * admin's own records (server/admin.mjs `miniAppUser`). */

export interface MeSubscription {
  plan: string;
  status: string;
  daysLeft: number;
  /** The full term this purchase bought — what `daysLeft` counts down from. */
  totalDays?: number;
  purchasedAt: string | null;
  /** Epoch ms the term ends/ended — null for a legacy row with only `daysLeft`. */
  expiresAt: number | null;
  totalPaid: number;
}

export interface MeBrokerLink {
  brokerId: string;
  /** 'pending' = account submitted, awaiting admin review;
   *  'deposit-review' = deposit claimed, awaiting admin review. */
  state: 'cashback-active' | 'waiting-for-deposit' | 'deposit-review' | 'pending' | 'rejected';
  brokerAccountId?: string;
  email?: string;
  totalRebate?: number;
  sharedRebate?: number;
  lastStatus?: string;
  requestedAt?: string;
}

/** A live campaign offer bound to this account. */
export interface MeOffer {
  code: string;
  percent: number;
  /** Empty means the code applies to every plan. */
  plans: string[];
  expiresAt: number | null;
  campaignId: string;
}

export interface Me {
  user: { id: string; name: string; plan: string };
  /** The rate this user actually earns at, derived from the live subscription. */
  tier: { id: 'none' | 'silver' | 'gold' | 'diamond'; pct: number };
  /** Withdrawable balance, lifetime earnings, lifetime withdrawals. */
  wallet: { balance: number; earned: number; withdrawn: number };
  /** This account's referral code — the `startapp=` payload on their link. */
  refCode: string | null;
  offers: MeOffer[];
  subscription: MeSubscription | null;
  /* `earned` is this user's own money — the only one a screen may show them.
     `netTotal` / `saleTotal` / `revenue` / `earnings` are the admin's
     platform-side books (our margin, and the payout carried negative); they are
     here because the admin screens read the same shape, not for display. */
  cashback: { earned: number; netTotal: number; saleTotal: number };
  referral: {
    invited: number; active: number; plan: number; cashback: number;
    revenue: number; earnings: number; earned: number;
    /** Commission rate from the active referral campaign. */
    share: { planPct: number; cashbackPct: number } | null;
    /** Funnel conversion — what share of invitees converted. Not a payout rate. */
    conversion: { planPct: number; cashbackPct: number } | null;
  };
  brokers: MeBrokerLink[];
}

const meCache = cache<Me | null>(() => request<Me>('/me'), null);
export const cachedMe = () => meCache.peek();
export const getMe = () => meCache.get();

/* ---- wallet, referral, offers -------------------------------------------- */

export interface WalletEntry {
  id: number;
  at: number;
  kind: string;
  detail: string;
  /** Signed: positive credited, negative withdrawn. */
  amount: number;
}

export interface Wallet {
  balance: number;
  earned: number;
  withdrawn: number;
  history: WalletEntry[];
}

export const getWallet = () => request<Wallet>('/me/wallet');

/**
 * A rejection here is an expected answer, not a failure: "insufficient funds"
 * and "that code is not yours" are 400s carrying a reason the screen shows.
 * Anything without a JSON body still throws.
 */
async function requestSoft<T>(path: string, body?: unknown): Promise<T> {
  try {
    return await request<T>(path, body);
  } catch (err) {
    if (err instanceof ApiError && err.body) {
      try {
        return JSON.parse(err.body) as T;
      } catch { /* not a structured error — rethrow below */ }
    }
    throw err;
  }
}

/** A withdrawal as the payouts pipeline reports it (server/payouts.mjs).
 *  status 'pending' covers queued/sending/manual — one thing to the user. */
export interface WithdrawalRecord {
  id: string;
  currency: string;
  network: string;
  amount: number;
  fee: number;
  address: string;
  status: 'pending' | 'completed' | 'rejected';
  txid?: string;
  createdAt: number;
}

export interface WithdrawResult {
  ok?: true;
  balance?: number;
  withdrawal?: WithdrawalRecord;
  error?: string;
  minimum?: number;
}

/** Withdraw from Earnings. Reserves the balance and queues an automatic
 *  on-chain payout; the server refuses to overdraw. */
export const withdraw = (input: { amount: number; currency: string; network: string; address: string }): Promise<WithdrawResult> =>
  requestSoft<WithdrawResult>('/me/withdraw', input);

/** Withdrawal history, newest first — feeds the Earning history sheet. */
export const getWithdrawals = (): Promise<WithdrawalRecord[]> =>
  request<{ withdrawals: WithdrawalRecord[] }>('/me/withdrawals').then((r) => r.withdrawals);

export interface MyReferral {
  code: string;
  botLink: string | null;
  websiteLink: string;
  tier: string;
  refInvited: number;
  refActive: number;
  refRevenue: number;
  refEarnings: number;
}

export const getMyReferral = () => request<MyReferral>('/me/referral');

/** One invited user, and what they've earned this account so far. */
export interface Referral {
  /** The invitee's own user_no — the number an operator would call them by. */
  id: string;
  /** Epoch ms, or a plain YYYY-MM-DD for accounts that predate joined_at. */
  joinedAt: string;
  plan: number;
  cashback: number;
}

/** Per-invitee breakdown for the "Your referrals" list, newest first. */
export const getReferrals = (): Promise<Referral[]> =>
  request<{ referrals: Referral[] }>('/me/referrals').then((r) => r.referrals);

/** One cashback payout, as booked on the ledger. */
export interface CashbackHistoryEntry {
  broker: string;
  at: number;
  /** e.g. 20 for 20% — the tier this row was paid at, frozen at write time. */
  ratePct: number;
  amount: number;
}

/** This user's cashback payouts, newest first — feeds the history sheet. */
export const getCashbackHistory = (): Promise<CashbackHistoryEntry[]> =>
  request<{ history: CashbackHistoryEntry[] }>('/me/cashback-history').then((r) => r.history);

/** Referral + cashback income folded into 7-day buckets, oldest first. */
export interface WeeklyEarnings {
  /** Epoch ms — the bucket's start. */
  start: number;
  referral: number;
  cashback: number;
}

/** The Earning tab's chart feed — a fixed-size rolling window ending this week. */
export const getEarningsWeekly = (): Promise<WeeklyEarnings[]> =>
  request<{ weeks: WeeklyEarnings[] }>('/me/earnings-weekly').then((r) => r.weeks);

/** Validate a campaign discount code before checkout commits to it. */
export const checkDiscount = (code: string, planId?: string) =>
  requestSoft<{ code?: string; percent?: number; plans?: string[]; error?: string }>(
    '/discount', { code, planId },
  );

/** A single-use invite to the VIP group, valid while the subscription is. */
export const joinGroup = () =>
  requestSoft<{ link?: string; error?: string }>('/subscription/join', {});

/* ---- broker catalogue ---------------------------------------------------- */

export interface BrokerPreview {
  brokerId: string;
  name: string;
  logoName?: string;
  badgeOn?: boolean;
  badgeText?: string;
  badgeColor?: string;
  createAccountLink?: string;
  goToBrokerLink?: string;
  referralCodeOn?: boolean;
  referralCode?: string;
  details?: Record<string, string>;
}

export interface ApiBroker {
  id: string;
  name: string;
  color: string;
  status: string;
  rank: number | null;
  shareRate: number;
  preview: BrokerPreview | null;
}

const brokersCache = cache<ApiBroker[]>(() => request<{ brokers: ApiBroker[] }>('/brokers').then((r) => r.brokers), []);
export const cachedBrokers = () => brokersCache.peek();
export const getBrokers = () => brokersCache.get();

export interface BrokerDetailPayload {
  broker: ApiBroker;
  preview: BrokerPreview | null;
  flow: { key: string; title: string; from: string; chip: string; message: string }[];
}

const brokerCache = cache<BrokerDetailPayload | null>((id) => request<BrokerDetailPayload>(`/brokers/${id}`), null);
export const cachedBroker = (id: string) => brokerCache.peek(id);
export const getBroker = (id: string) => brokerCache.get(id);

/* Both verification calls answer with the refreshed broker links, so the
 * screen can update `me` in place instead of refetching the whole read. */
export const submitBrokerAccount = (brokerId: string, input: { email: string; brokerAccountId?: string }) =>
  request<{ brokers: MeBrokerLink[] }>(`/me/brokers/${brokerId}/submit`, input).then((r) => r.brokers);
export const confirmBrokerDeposit = (brokerId: string) =>
  request<{ brokers: MeBrokerLink[] }>(`/me/brokers/${brokerId}/deposit`, {}).then((r) => r.brokers);

/* ---- signal performance -------------------------------------------------- */

export interface SignalResult {
  id: string;
  period: string;
  range: string;
  total: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp4: number;
}

const signalsCache = cache<SignalResult[]>(
  () => request<{ results: SignalResult[] }>('/signals').then((r) => r.results),
  [],
);
export const cachedSignals = () => signalsCache.peek();
export const getSignals = () => signalsCache.get();

/* ---- promo carousel ------------------------------------------------------
 * Slides come from the admin's marketing campaigns (Campaigns step 3 "In-App
 * Card Content" + step 4 "Display Location"), so the same campaign can show on
 * one screen or all three. */

export interface Promo {
  id: string;
  title: string;
  subtitle: string;
  /** Data URL uploaded in the admin; absent campaigns fall back to built-in art. */
  image?: string;
  cta?: string;
}

export type PromoSection = 'subscription' | 'referral' | 'cashback';

/* Cached per section for the same reason the flags are: the carousel lives on
   three tabs and each tab switch remounts it, so an uncached fetch would swap
   the built-in slides for the real ones again on every visit. */
const promoCache = new Map<PromoSection, Promo[]>();

export function cachedPromos(section: PromoSection): Promo[] | undefined {
  return promoCache.get(section);
}

export function getPromos(section: PromoSection): Promise<Promo[]> {
  return request<{ promos: Promo[] }>(`/promos?section=${section}`)
    .then((r) => r.promos)
    // No campaigns endpoint (static-only deploy) is not an error worth showing:
    // the carousel keeps its built-in slides.
    .catch(() => [])
    .then((promos) => {
      promoCache.set(section, promos);
      return promos;
    });
}

/* ---- once-only preview flags --------------------------------------------
 * Server-side (see server/index.mjs) so "already saw the intro" follows the
 * Telegram account rather than one device's localStorage. */

export type UserFlag = 'referral_preview_seen' | 'cashback_preview_seen';

/* The bottom nav unmounts a tab's whole tree when you leave it, so /cashback
   and /referral re-ask for the flags on every single visit and render nothing
   until the answer lands — a blank frame between every tab switch. The answer
   cannot change within a session except through setFlag, so keep the last one
   and let a remount seed its state from it synchronously. */
let flagsCache: UserFlag[] | undefined;

/** Last known /me/flags, or undefined before the first answer. */
export function cachedFlags(): UserFlag[] | undefined {
  return flagsCache;
}

export function getFlags(): Promise<UserFlag[]> {
  return (
    request<{ flags: UserFlag[] }>('/me/flags')
      // A malformed 200 (proxy/HTML shim) must not lock the cache on
      // `undefined` — that would reopen the blank hold on every visit,
      // not just the first, instead of the one-shot miss below.
      .then((r) => (flagsCache = r.flags ?? []))
      /* API down (it is not deployed everywhere the static build is): treat
         every intro as already seen rather than trapping the user on it, and
         cache that so the next visit doesn't blank waiting to fail again. */
      .catch(() => (flagsCache = ['referral_preview_seen', 'cashback_preview_seen']))
  );
}

export function setFlag(flag: UserFlag): Promise<UserFlag[]> {
  // Cache it before the round-trip: leaving the tab while the POST is still in
  // flight would otherwise replay the intro the user just dismissed.
  flagsCache = [...new Set([...(flagsCache ?? []), flag])];
  return request<{ flags: UserFlag[] }>(`/me/flags/${flag}`, {}).then((r) => (flagsCache = r.flags));
}
