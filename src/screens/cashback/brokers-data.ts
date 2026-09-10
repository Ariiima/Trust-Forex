import exnessLogoUrl from '../../assets/brokers/exness-logo.png';
import xmLogoUrl from '../../assets/broker/xm-logo.png';
import icMarketsLogoUrl from '../../assets/brokers/ic-markets-logo.png';
import type { FlowMessage, MeBrokerLink } from '../../api/client';

/**
 * Broker catalogue shared by the Cashback dashboard (`Cashback.tsx`) and
 * `CashbackHistorySheet.tsx`. Names/logos/state copy come from Figma node
 * 850:2053 ("Partner brokers" list); history rows from 1292:4273. The XM
 * logo reuses the crop already at `src/assets/broker/xm-logo.png` (from the
 * broker onboarding flow); Exness/IC Markets are new crops in
 * `src/assets/brokers/`.
 */
// Was a 3-value literal union; the catalogue is now the admin's broker table
// (getBrokers()), which can hold any id, so this widens to plain string.
export type BrokerId = string;

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

/** A link's server state, once the admin has actually decided it, maps to the
 * flow-message key carrying that decision's admin-edited banner text (Manage
 * user flow → Status message). States with no decision yet (pending,
 * deposit-review) have no entry — those banners keep their fixed "in
 * progress" copy, there's nothing an admin wrote for them to show. */
const FLOW_KEY_FOR_STATE: Partial<Record<MeBrokerLink['state'], string>> = {
  rejected: 'rejected',
  'waiting-for-deposit': 'waiting-deposit',
  'cashback-active': 'approved',
  'deposit-rejected': 'rejected-deposit',
};

/** Admin's own title for this link state, falling back to `fallback` when the
 * broker has no flow rows yet (pre-seed data) or the state has no decision. */
export function flowTitle(
  flow: readonly FlowMessage[] | undefined,
  linkState: MeBrokerLink['state'] | undefined,
  fallback: string,
): string {
  const key = linkState && FLOW_KEY_FOR_STATE[linkState];
  return (key && flow?.find((f) => f.key === key)?.title) || fallback;
}

export interface HistoryRow {
  broker: BrokerId;
  date: string;
  rate: string;
  amount: string;
  /** From the API row — a private broker never appears in getBrokers(). */
  name?: string;
  logo?: string | null;
}

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
