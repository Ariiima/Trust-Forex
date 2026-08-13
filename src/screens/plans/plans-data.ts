import badgeSilverUrl from '../../assets/plans/badge-silver.png';
import badgeGoldUrl from '../../assets/plans/badge-gold.png';
import badgeDiamondUrl from '../../assets/plans/badge-diamond.png';

/**
 * VIP subscription plan catalogue — shared by `/plans` (ChoosePlan) and the
 * "Change plan" BottomSheet on `/checkout`. Exact prices/durations/boost
 * rates from Figma node 552:3126 (choose-plan). All three tiers share the
 * same feature list; only the boost percentage differs.
 */
export type PlanId = 'silver' | 'gold' | 'diamond';

export interface Plan {
  id: PlanId;
  name: string;
  price: string;
  duration: string;
  badge: string;
  /** Boost % shown on both "Broker cashback boost" and "Referral share boost" rows. */
  boost: string;
  tag?: { label: string; variant: 'popular' | 'value' };
  /** Gold is visually highlighted (blue border + blue "Continue" text). */
  highlighted?: boolean;
  /**
   * Checkout's "Total payable" base amount. Real prices set by the owner
   * (08-09): 200 / 499 / 1699 — this superseded the $49 Silver figure from
   * the Figma checkout mock (552:3115). Must stay in sync with PLAN_PRICES
   * in server/orders.mjs, which is what actually prices an order.
   */
  checkoutPrice: number;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'silver',
    name: 'Silver',
    price: '2.00', // ponytail: testing price, mirrors server/orders.mjs PLAN_PRICES.silver — revert both together
    duration: '1 month',
    badge: badgeSilverUrl,
    boost: '15%',
    checkoutPrice: 2.0,
  },
  {
    id: 'gold',
    name: 'Gold',
    price: '499.00',
    duration: '3 months',
    badge: badgeGoldUrl,
    boost: '20%',
    tag: { label: 'Most popular', variant: 'popular' },
    highlighted: true,
    checkoutPrice: 499.0,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: '1699.00',
    duration: '12 months',
    badge: badgeDiamondUrl,
    boost: '30%',
    tag: { label: 'Best value', variant: 'value' },
    checkoutPrice: 1699.0,
  },
];

export const FEATURE_LABELS = ['VIP signal channel access', 'All trading signals included'] as const;
