import type { BrokerStateVariant } from '../../design-system/components';
import exnessLogoUrl from '../../assets/brokers/exness-logo.png';
import xmLogoUrl from '../../assets/broker/xm-logo.png';
import icMarketsLogoUrl from '../../assets/brokers/ic-markets-logo.png';

/**
 * Broker catalogue shared by the Cashback dashboard (`Cashback.tsx`) and
 * `CashbackHistory.tsx`. Names/logos/state copy come from Figma node
 * 850:2053 ("our brokers" list); history rows from 881:1391. The XM logo
 * reuses the crop already at `src/assets/broker/xm-logo.png` (from the
 * broker onboarding flow); Exness/IC Markets are new crops in
 * `src/assets/brokers/` (see report).
 */
export type BrokerId = 'exness' | 'xm' | 'ic-markets';

export const BROKER_INFO: Record<BrokerId, { name: string; logo: string }> = {
  exness: { name: 'Exness', logo: exnessLogoUrl },
  xm: { name: 'XM', logo: xmLogoUrl },
  'ic-markets': { name: 'IC Markets', logo: icMarketsLogoUrl },
};

export interface BrokerCardData {
  id: BrokerId;
  /** Maps 1:1 to the design-system BrokerState variant. */
  state: BrokerStateVariant;
  /** Only Exness shows the green "Popular" pill in 850:2053. */
  popular?: boolean;
  /** cashback-active only, e.g. "$85.00". */
  totalEarned?: string;
}

export const BROKERS: readonly BrokerCardData[] = [
  { id: 'exness', state: 'no-account', popular: true },
  { id: 'xm', state: 'waiting-for-deposit' },
  { id: 'ic-markets', state: 'cashback-active', totalEarned: '$85.00' },
];

export interface HistoryRow {
  broker: BrokerId;
  date: string;
  rate: string;
  amount: string;
}

/** Exact rows from 881:1391 (top to bottom). Rate/amount are the same for all seven. */
export const HISTORY_ROWS: readonly HistoryRow[] = [
  { broker: 'xm', date: 'May20,2026', rate: '10%', amount: '$45.00' },
  { broker: 'exness', date: 'May18,2026', rate: '10%', amount: '$45.00' },
  { broker: 'ic-markets', date: 'May14,2026', rate: '10%', amount: '$45.00' },
  { broker: 'exness', date: 'May8,2026', rate: '10%', amount: '$45.00' },
  { broker: 'ic-markets', date: 'May6,2026', rate: '10%', amount: '$45.00' },
  { broker: 'xm', date: 'May6,2026', rate: '10%', amount: '$45.00' },
  { broker: 'xm', date: 'May4,2026', rate: '10%', amount: '$45.00' },
];
