/**
 * Admin data layer.
 *
 * Types are the contract between the screens and `/api/admin` (server/admin.mjs
 * maps its snake_case rows onto exactly these shapes). Screens only ever touch
 * the `api` object at the bottom — no screen builds a URL or handles a fetch.
 */
import type { PlanId } from './ui';

export type { PlanId };

/* =====================================================================
 * Types
 * ================================================================== */

export type UserStatus = 'active' | 'pending' | 'rejected';
export type BrokerStatus = 'public' | 'private' | 'stopped';

export interface AdminUser {
  id: string;
  name: string;
  plan: PlanId;
  email: string | null;
  /** The short account number an operator reads and types — counts from 1001. */
  userNo: number | null;
  /** Telegram's own numeric id for this account; null for admin-seeded rows
      the Mini App never created. */
  telegramId: number | null;
  brokerId: string;
  status: UserStatus;
  /** Broker id this account registered with. */
  broker: string | null;
  lastActionAt: string;
  totalRebate: number | null;
  lastMonthRebate: number | null;
  joinedAt: string;
}

export interface Analytics {
  totalUsers: number;
  activeToday: number;
  active3d: number;
  active7d: number;
  /** Daily active counts, oldest first, one entry per calendar day. */
  daily: { day: string; active: number }[];
}

export type ActivityCategory = 'Subscription' | 'Cashback' | 'Referral' | 'Wallet' | 'Campaign';

export interface ActivityRow {
  id: string;
  at: string;
  activity: string;
  category: ActivityCategory;
  /** null renders as an em dash — the row is not a money movement. */
  amount: number | null;
  /** Whether the amount should carry an explicit +/- and colour. */
  signed?: boolean;
}

export interface UserDetail {
  user: AdminUser;
  cashback: { netTotal: number; saleTotal: number };
  referral: {
    invited: number; active: number; plan: number;
    cashback: number; revenue: number; earnings: number;
  };
  activity: ActivityRow[];
}

export interface Broker {
  id: string;
  name: string;
  color: string;
  status: BrokerStatus;
  /** The broker's cut of a rebate, 0–1. Drives the shared-rebate column. */
  shareRate: number;
  /** Public brokers are ranked; private/stopped show a dash. */
  rank: number | null;
  activeUsers: number;
  pendingUsers: number;
  draftedPayment: number;
  unreviewed: number;
  updatedAt: string;
}

/** Money leaving the platform — the payout worklist. Reads payouts.mjs's own
 *  `withdrawals` table, so `status` is the real state, not a ledger echo. */
export interface WithdrawalRow {
  id: string;
  userId: string;
  name: string | null;
  at: string;
  amount: number;
  fee: number;
  currency: string;
  network: string;
  address: string;
  status: 'queued' | 'sending' | 'manual' | 'sent';
  txid?: string;
}

/** Money arriving. Straight off the `orders` table the watcher confirms. */
export interface PaymentRow {
  id: string;
  userId: number | null;
  username: string | null;
  planId: string;
  amountUsd: number;
  currency: string | null;
  network: string | null;
  txid: string | null;
  status: string;
  confirmedAt: string | null;
  /** Whether the ledger has booked it — an unbooked confirmed order is a bug. */
  booked: boolean;
}

export interface CashbackCycle {
  id: string;
  name: string;
  range: string;
  grossRebate: number;
  sharedCashback: number;
  netRevenue: number;
  cashbackUsers: number;
  publishedAt: string;
}

export type ReviewStatus = 'Registration rejected' | 'Deposit required' | 'No account' | 'Deposit rejected';

export interface ReviewRequest {
  id: string;
  userId: string;
  name: string;
  plan: PlanId;
  brokerId: string;
  requestedAt: string;
  email: string | null;
  brokerAccountId: string;
  lastStatus: ReviewStatus;
}

export interface RebateRow {
  userId: string;
  name: string;
  plan: PlanId;
  email: string;
  brokerAccountId: string;
  totalRebate: number;
  lastWeekRebate: number | null;
  sharedRebate: number;
}

export interface DraftRebate extends RebateRow {
  lastWeekRebate: number;
  actionDate: string;
}

export type FlowStatusKey = 'rejected' | 'waiting-deposit' | 'rejected-deposit' | 'approved';

export interface FlowMessage {
  key: FlowStatusKey;
  title: string;
  from: string;
  chip: string;
  message: string;
}

export interface BrokerPreview {
  brokerId: string;
  name: string;
  logoName: string;
  /** Data URL of an uploaded logo; absent means fall back to initials. */
  logoUrl?: string;
  status: BrokerStatus;
  badgeOn: boolean;
  badgeText: string;
  badgeColor: string;
  createAccountLink: string;
  goToBrokerLink: string;
  referralCodeOn: boolean;
  referralCode: string;
  details: { regulation: string; platform: string; accountTypes: string; leverage: string; depositBonus: string; spread: string; cashbackLevel: string; execution: string };
  requireEmail: boolean;
  requireUserId: boolean;
}

export interface Subscriber {
  id: string;
  name: string;
  plan: PlanId;
  /** YYYY-MM-DD — what an extra-day grant's "purchased before" tests. */
  purchasedAt: string | null;
  lastActionAt: string;
  lastActionTime: string;
  daysLeft: number;
  totalPaid: number;
  status: 'active' | 'expired';
}

export interface ExtraGrant {
  id: string;
  addedAt: string;
  addedTime: string;
  extraDays: number;
  eligibleBefore: string;
  eligibleTime: string;
  affected: number;
}

export type EventIcon = 'check-circle' | 'megaphone' | 'alert' | 'calendar' | 'file' | 'info' | 'trending-up' | 'settings';

export interface EventNote {
  id: string;
  title: string;
  description: string;
  icon: EventIcon;
  date: string;
}

export interface ReferralRow {
  id: string;
  name: string;
  plan: PlanId;
  /** The short account number an operator reads and types — counts from 1. */
  userNo: number | null;
  invited: number;
  planCount: number;
  planPct: number;
  cashbackCount: number;
  cashbackPct: number;
  revenue: number;
  revenueShared: number;
  revenueNet: number;
}

export type CampaignStatus = 'active' | 'paused' | 'ended';

export interface ReferralCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  linkCode: string | null;
  invited: number;
  planCount: number;
  planTotal: number;
  cashbackCount: number;
  cashbackTotal: number;
  revenue: number;
  revenueShared: number;
  revenueNet: number;
  planShare: number;
  cashbackShare: number;
  websiteLink: string;
  botLink: string;
  endDate: string;
  /** Step 2's broker-display editor (order, badges) and excluded-broker list.
      Stored in the campaign's JSON doc, so these need no schema change. */
  display?: { brokerId: string; badgeOn: boolean; badgeText: string; badgeColor: string }[];
  excluded?: string[];
  /** The account this campaign belongs to, by user number. Optional: a
      house campaign belongs to nobody. Doc-stored, like the fields above. */
  ownerUserNo?: number | null;
}

export interface MarketingCampaign {
  id: string;
  name: string;
  status: CampaignStatus;
  audience: string[];
  /** Raw "Select User Type" checkbox selection behind `audience`'s derived icons. */
  userTypes?: string[];
  /* Counted server-side from campaign_sends / campaign_opens / discount_codes,
     never stored on the campaign. null means nothing has happened yet — a
     campaign that has sent nothing has no open rate, and 0% would report a
     measurement nobody took. The table renders null as an em-dash. */
  /** Messages Telegram actually delivered. */
  messageSent: number | null;
  /** Share of those recipients who tapped "Open App" at least once. */
  openRate: number | null;
  /** Discount codes minted for this campaign. */
  codeSent: number | null;
  /** Share of those codes that have been redeemed. */
  codeUsedRate: number | null;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  createdTime: string;
  expiry: string;
  allUsers: boolean;
  referralLists: string;
  brokerLists: string;
  triggerType: string;
  triggerTime: string;
  /** Raw pieces behind triggerTime/expiry's formatted text, so editing doesn't
      have to reverse-parse "7 Days After" back into a number and a unit. */
  triggerN?: number;
  triggerUnit?: string;
  expiryN?: number;
  expiryUnit?: string;
  limitType: string;
  discountValue: number;
  /** Step 2's "Offer / Discount" plan chips — which plans the discount applies to. */
  applicablePlans: PlanId[];
  /** Step 1's "Select User Type" plan chips — audience targeting, a separate
      concept from which plans the discount is applicable to. */
  audiencePlans?: PlanId[];
  /* Step 2's in-app card — this is what the Mini App's promo carousel renders,
     one slide per active campaign whose `locations` include that screen. The
     whole record is stored as a JSON doc server-side, so these needed no
     schema change. */
  cardTitle?: string;
  cardDesc?: string;
  /** Data URL from the admin's ImageUpload.
      ponytail: inlined into the doc — fine at the 2MB upload cap, move to a
      file/blob store if campaign docs start bloating the /campaigns response. */
  cardImage?: string;
  /** CTA destination, or undefined when the campaign has no CTA. */
  cardCta?: string;
  /** Which screens show it: 'subscription' (home) | 'referral' | 'cashback'. */
  locations?: string[];
  /* Delivery. `unique` mints a per-user, single-use code the engine binds to
     one account; `public` reuses one string for everyone. */
  codeType?: 'unique' | 'public';
  publicCode?: string;
  includeCode?: boolean;
  /** Telegram message body, HTML from the rich-text editor. */
  message?: string;
  messageImage?: string;
  showCode?: boolean;
  sendLimit?: string;
  usageLimit?: string;
}

export interface CampaignList {
  id: string;
  name: string;
  count: number;
}

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
  status: 'draft' | 'published';
  publishedAt: string | null;
  publishedTime: string | null;
}

export interface SeriesPoint {
  label: string;
  [key: string]: string | number;
}

/** `cycle` buckets by cashback payout cycle, which is one Monday–Sunday week. */
export type Grain = 'daily' | 'cycle' | 'weekly' | 'monthly' | 'quarterly';

export interface SeriesQuery {
  /** Dimension ids to include (broker ids, plan ids, campaign ids). Empty = all. */
  dims?: string[];
  from?: string;
  to?: string;
  grain?: Grain;
}

export interface BrokerTotals {
  totalRebate: number;
  draftedPayment: number;
  brokers: number;
}

/** The bot's transactional copy — payment/subscription/withdrawal DMs. Fixed
 *  set of keys (server/admin.mjs MESSAGE_TEMPLATES); this page edits `body`
 *  only. Marketing campaigns have their own message editor, not this one. */
export interface MessageTemplate {
  key: string;
  name: string;
  group: 'Payments' | 'Subscription' | 'Withdrawals';
  hint: string;
  /** {tokens} this message's send site actually fills in. */
  vars: string[];
  body: string;
  /** The shipped copy, so the editor can offer "Reset to default". */
  default: string;
  /** 0 = never edited — still sending the shipped default. */
  updatedAt: number;
}


/* =====================================================================
 * Transport
 * ================================================================== */

const BASE = '/api/admin';

/** Thrown for any non-2xx; `status` lets callers single out 401. */
export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Set when a request 401s, so the shell can drop straight to the login screen. */
let onUnauthorized: (() => void) | undefined;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    ...init,
    // Session lives in an HttpOnly cookie; it must ride along on every call.
    credentials: 'same-origin',
    headers: init?.body ? { 'content-type': 'application/json' } : undefined,
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

const get = <T,>(path: string) => request<T>(path);
const write = <T,>(method: string, path: string, body?: unknown) =>
  request<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

/* =====================================================================
 * API
 * ================================================================== */

export const api = {
  /* ---- session ---- */
  session: () => get<{ username: string }>('/session'),
  login: (username: string, password: string) =>
    write<{ username: string }>('POST', '/login', { username, password }),
  logout: () => write<void>('POST', '/logout'),

  /* ---- users ---- */
  users: () => get<AdminUser[]>('/users'),
  user: (id: string) => get<UserDetail>(`/users/${id}`),
  userCounts: () => get<{ all: number; active: number; pending: number; rejected: number }>('/users/counts'),
  setUserStatus: (id: string, status: UserStatus) => write<void>('PATCH', `/users/${id}`, { status }),

  /* ---- analytics ---- */
  analytics: () => get<Analytics>('/analytics'),

  /* ---- brokers ---- */
  brokers: () => get<Broker[]>('/brokers'),
  brokerTotals: () => get<BrokerTotals>('/brokers/totals'),
  addBroker: (b: { name: string; status?: BrokerStatus; color?: string; shareRate?: number }) =>
    write<Broker>('POST', '/brokers', b),
  broker: (id: string) => get<Broker>(`/brokers/${id}`),
  /** Refused (409) while the broker still has active/pending users or an
      undrafted payout — stop it first, then delete once it's empty. */
  deleteBroker: (id: string) => write<void>('DELETE', `/brokers/${id}`),
  reorderBrokers: (order: { id: string; status: BrokerStatus }[]) =>
    write<Broker[]>('PUT', '/brokers/order', { order }),
  brokerPreview: (id: string) => get<BrokerPreview>(`/brokers/${id}/preview`),
  saveBrokerPreview: (id: string, doc: BrokerPreview) => write<BrokerPreview>('PUT', `/brokers/${id}/preview`, doc),
  flowMessages: (id: string) => get<FlowMessage[]>(`/brokers/${id}/flow-messages`),
  saveFlowMessage: (id: string, key: string, message: string) =>
    write<void>('PUT', `/brokers/${id}/flow-messages/${key}`, { message }),
  rebateRows: (id: string) => get<RebateRow[]>(`/brokers/${id}/rebates`),
  rebateDrafts: (id: string) => get<DraftRebate[]>(`/brokers/${id}/rebate-drafts`),
  addRebateDraft: (id: string, userId: string, lastWeekRebate: number) =>
    write<DraftRebate>('POST', `/brokers/${id}/rebate-drafts`, { userId, lastWeekRebate }),
  deleteRebateDraft: (id: string, userId: string) =>
    write<void>('DELETE', `/brokers/${id}/rebate-drafts/${userId}`),
  publishRebateDrafts: (id: string) => write<{ published: number }>('POST', `/brokers/${id}/rebate-drafts/publish`),
  /** Every broker's drafts, one transaction, one cycle. Safe to press twice. */
  publishAllRebateDrafts: (body: { cycleId?: string; name?: string; range?: string } = {}) =>
    write<{ published: number; gross: number; shared: number; cycleId: string }>(
      'POST', '/rebate-drafts/publish-all', body,
    ),

  withdrawals: () => get<WithdrawalRow[]>('/withdrawals'),
  /** Record a `manual`/`queued` row as paid by hand — there's no hot wallet
   *  configured yet, so this is the only path any withdrawal completes through. */
  markWithdrawalSent: (id: string, txid: string) =>
    write<{ withdrawal: WithdrawalRow }>('POST', `/withdrawals/${id}/mark-sent`, { txid }),
  payments: () => get<PaymentRow[]>('/payments'),

  cashbackCycles: () => get<CashbackCycle[]>('/cashback-cycles'),
  reviewQueue: () => get<ReviewRequest[]>('/review-queue'),
  decideReview: (id: string, decision: 'approved' | 'waiting' | 'rejected') =>
    write<void>('POST', `/review-queue/${id}/decision`, { decision }),

  /* ---- subscription ---- */
  subscribers: () => get<Subscriber[]>('/subscribers'),
  extraGrants: () => get<ExtraGrant[]>('/extra-grants'),
  addExtraGrant: (grant: Partial<ExtraGrant> & {
    extraDays: number; purchasedBefore?: string; message?: string; notify?: boolean;
  }) => write<ExtraGrant>('POST', '/extra-grants', grant),

  /* ---- events ---- */
  events: () => get<EventNote[]>('/events'),
  addEvent: (event: Omit<EventNote, 'id'>) => write<EventNote>('POST', '/events', event),
  updateEvent: (id: string, event: Omit<EventNote, 'id'>) => write<void>('PUT', `/events/${id}`, event),
  deleteEvent: (id: string) => write<void>('DELETE', `/events/${id}`),

  /* ---- referral ---- */
  referralRows: () => get<ReferralRow[]>('/referrals'),
  referralCampaigns: () => get<ReferralCampaign[]>('/referral-campaigns'),
  addReferralCampaign: (c: Partial<ReferralCampaign> & { name: string }) =>
    write<ReferralCampaign>('POST', '/referral-campaigns', c),
  setReferralCampaignStatus: (id: string, status: CampaignStatus) =>
    write<void>('PATCH', `/referral-campaigns/${id}`, { status }),
  updateReferralCampaign: (id: string, c: Partial<ReferralCampaign> & { name: string }) =>
    write<ReferralCampaign>('PUT', `/referral-campaigns/${id}`, c),

  /* ---- marketing campaigns ---- */
  campaignLists: () => get<CampaignList[]>('/campaign-lists'),
  addCampaignList: (name: string) => write<CampaignList>('POST', '/campaign-lists', { name }),
  campaignListMembers: (listId: string) => get<string[]>(`/campaign-lists/${listId}/members`),
  setCampaignLists: (id: string, lists: string[]) =>
    write<CampaignList[]>('PUT', `/campaigns/${id}/lists`, { lists }),
  marketingCampaigns: () => get<MarketingCampaign[]>('/campaigns'),
  addCampaign: (c: Partial<MarketingCampaign> & { name: string }) =>
    write<MarketingCampaign>('POST', '/campaigns', c),
  updateCampaign: (id: string, c: Partial<MarketingCampaign> & { name: string }) =>
    write<MarketingCampaign>('PUT', `/campaigns/${id}`, c),
  setCampaignStatus: (id: string, status: CampaignStatus) =>
    write<void>('PATCH', `/campaigns/${id}`, { status }),
  deleteCampaign: (id: string) => write<void>('DELETE', `/campaigns/${id}`),

  /* ---- bot messages ---- */
  messageTemplates: () => get<MessageTemplate[]>('/message-templates'),
  /** Server returns only what it wrote — the caller merges it over the
      metadata (name/group/hint/vars/default) it already has. */
  saveMessageTemplate: (key: string, body: string) =>
    write<{ key: string; body: string; updatedAt: number }>('PUT', `/message-templates/${key}`, { body }),

  /* ---- signals ---- */
  signalResults: () => get<SignalResult[]>('/signals'),
  saveSignalResult: (r: SignalResult) => write<SignalResult>('POST', '/signals', r),
  deleteSignalResult: (id: string) => write<void>('DELETE', `/signals/${id}`),

  /* ---- chart series ----
   * Filters are query params, not client-side slicing: the server holds daily
   * per-dimension rows and rolls them up (stocks take the last value, flows sum,
   * rates are recomputed from their components). Slicing an already-aggregated
   * array here would give the wrong answer for every rate on the chart. */
  series: (name: string, q: SeriesQuery = {}) => {
    const params = new URLSearchParams();
    if (q.dims?.length) params.set('dims', q.dims.join(','));
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
    params.set('grain', q.grain ?? 'weekly');
    return get<SeriesPoint[]>(`/series/${name}?${params}`);
  },
};

export type Api = typeof api;
