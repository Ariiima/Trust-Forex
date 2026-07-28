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

/** Compact 40px status banner shown above a card's BrokerState (850:2053). */
export interface BrokerBanner {
  variant: 'success' | 'error';
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
}

export const BROKERS: readonly BrokerCardData[] = [
  {
    id: 'exness',
    key: 'exness',
    state: 'no-account',
    popular: true,
    banners: [{ variant: 'error', title: 'Account verification failed' }],
  },
  {
    id: 'xm',
    key: 'xm',
    state: 'waiting-for-deposit',
    banners: [
      { variant: 'success', title: 'Account verified' },
      { variant: 'error', title: 'Deposit verification failed' },
    ],
  },
  {
    id: 'ic-markets',
    key: 'ic-markets',
    state: 'cashback-active',
    totalEarned: '$85.00',
    banners: [{ variant: 'success', title: 'Deposit confirmed' }],
  },
  // 2nd XM card (1284:4014) — banner/state guessed, instance unexpanded in XML.
  {
    id: 'xm',
    key: 'xm-2',
    state: 'no-account',
    banners: [{ variant: 'success', title: 'Account verified' }],
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
