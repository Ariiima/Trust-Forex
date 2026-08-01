import type { BrokerStateVariant } from '../../design-system/components';
import exnessLogoUrl from '../../assets/brokers/exness-logo.png';
import xmLogoUrl from '../../assets/broker/xm-logo.png';
import icMarketsLogoUrl from '../../assets/brokers/ic-markets-logo.png';

/**
 * Broker catalogue shared by the Cashback dashboard (`Cashback.tsx`) and
 * `CashbackHistorySheet.tsx`. Names/logos/state copy come from Figma node
 * 850:2053 ("Partner brokers" list); history rows from 1292:4273. The XM
 * logo reuses the crop already at `src/assets/broker/xm-logo.png` (from the
 * broker onboarding flow); Exness/IC Markets are new crops in
 * `src/assets/brokers/`.
 */
export type BrokerId = 'exness' | 'xm' | 'ic-markets';

export const BROKER_INFO: Record<BrokerId, { name: string; logo: string }> = {
  exness: { name: 'Exness', logo: exnessLogoUrl },
  xm: { name: 'XM', logo: xmLogoUrl },
  'ic-markets': { name: 'IC Markets', logo: icMarketsLogoUrl },
};

/**
 * Compact 40px status banner shown above a card's BrokerState (850:2053,
 * Figma "Notification" component 1316:8158 — states Success / Eror / "in
 * progress"; "in progress" is modelled here as `pending`).
 */
export interface BrokerBanner {
  variant: 'success' | 'error' | 'pending';
  title: string;
}

export interface BrokerCardData {
  id: BrokerId;
  /** Unique list key — XM appears twice in 850:2053. */
  key: string;
  /** Maps 1:1 to the design-system BrokerState variant. */
  state: BrokerStateVariant;
  /** Only Exness shows the green "popular" pill in 850:2053. */
  popular?: boolean;
  /** cashback-active only, e.g. "$85.00". */
  totalEarned?: string;
  banners?: readonly BrokerBanner[];
  /** Overrides BrokerState's default label copy (850:2053 wording is per-card, not generic). */
  stateLabel?: string;
  /** Overrides BrokerState's default caption copy. */
  stateCaption?: string;
}

export const BROKERS: readonly BrokerCardData[] = [
  {
    id: 'exness',
    key: 'exness',
    state: 'no-account',
    popular: true,
    banners: [{ variant: 'error', title: 'Account verification failed' }],
    stateLabel: 'No linked account',
    stateCaption: 'Create an account to start earning cashback.',
  },
  {
    id: 'xm',
    key: 'xm',
    state: 'waiting-for-deposit',
    // Error above success, matching 850:2053's stacking order (verified
    // against the reference render — the failed check sits on top).
    banners: [
      { variant: 'error', title: 'Deposit verification failed' },
      { variant: 'success', title: 'Account verified' },
    ],
    stateLabel: 'Deposit required',
    stateCaption: 'Make your first deposit to activate cashback.',
  },
  {
    id: 'ic-markets',
    key: 'ic-markets',
    state: 'cashback-active',
    totalEarned: '$85.00',
    banners: [{ variant: 'success', title: 'Deposit confirmed' }],
    stateLabel: 'Cashback active',
    stateCaption: 'Total earned :', // space before the colon per 850:2053
  },
  // 2nd XM card (1284:4014) — "in progress" Notification + "no account"
  // BrokerState per the reference render (previous guess of a second
  // "Account verified" banner didn't match; see report).
  {
    id: 'xm',
    key: 'xm-2',
    state: 'no-account',
    banners: [{ variant: 'pending', title: 'Verification in progres' }], // sic — 850:2053's own copy
    stateLabel: 'No linked account',
    stateCaption: 'Create an account to start earning cashback.',
  },
];

export interface HistoryRow {
  broker: BrokerId;
  date: string;
  rate: string;
  amount: string;
}

/** Exact rows from 1292:4273 (top to bottom; lowercase dates per layer names). */
export const HISTORY_ROWS: readonly HistoryRow[] = [
  { broker: 'xm', date: 'may20,2026', rate: '10%', amount: '$45.00' },
  { broker: 'exness', date: 'may18,2026', rate: '10%', amount: '$45.00' },
  { broker: 'ic-markets', date: 'may14,2026', rate: '10%', amount: '$45.00' },
  { broker: 'exness', date: 'may8,2026', rate: '10%', amount: '$45.00' },
  { broker: 'ic-markets', date: 'may6,2026', rate: '10%', amount: '$45.00' },
  { broker: 'xm', date: 'may6,2026', rate: '10%', amount: '$45.00' },
  { broker: 'xm', date: 'may4,2026', rate: '10%', amount: '$45.00' },
  { broker: 'xm', date: 'may6,2026', rate: '10%', amount: '$45.00' },
  { broker: 'xm', date: 'may4,2026', rate: '10%', amount: '$45.00' },
];

/**
 * The dashboard hero's mock state, shared with /cashback/history — whose frame
 * peeks this same card behind the sheet.
 *
 * The two Figma frames disagree about it: 850:2053 (the dashboard) draws the
 * "State=Standard user" variant at $0.00, while 1292:4273 (the history sheet)
 * draws $1,245.80 behind the scrim. Rendering each screen's own number makes
 * the total jump from $0.00 to $1,245.80 when you open the sheet, so one value
 * has to win until /api/cashback exists. The dashboard's wins: it is the
 * canonical instance of the card, and on the history route the card is a dimmed
 * backdrop that the sheet covers below its first line.
 */
export const OVERVIEW = {
  plan: 'standard',
  total: '$0.00',
  planName: 'Standard',
  planDuration: 'Base access',
  rate: '10%',
} as const;
