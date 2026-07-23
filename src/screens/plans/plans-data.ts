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
   * Checkout's "Total payable" base amount. Confirmed from Figma (552:3115)
   * only for Silver ($49.00 — the checkout mock uses a different figure
   * than the $200 sticker price on this same plan; not derivable, taken
   * as-is). Gold/Diamond have no checkout reference screen, so their
   * checkout base falls back to the catalogue price — an assumption, not a
   * confirmed Figma value (see report).
   */
  checkoutPrice: number;
}

export const PLANS: readonly Plan[] = [
  {
    id: 'silver',
    name: 'Silver',
    price: '200.00',
    duration: '1 month',
    badge: badgeSilverUrl,
    boost: '15%',
    checkoutPrice: 49.0,
  },
  {
    id: 'gold',
    name: 'Gold',
    price: '550.00',
    duration: '3 months',
    badge: badgeGoldUrl,
    boost: '20%',
    tag: { label: 'Most popular', variant: 'popular' },
    highlighted: true,
    checkoutPrice: 550.0,
  },
  {
    id: 'diamond',
    name: 'Diamond',
    price: '1700.00',
    duration: '12 months',
    badge: badgeDiamondUrl,
    boost: '30%',
    tag: { label: 'Best value', variant: 'value' },
    checkoutPrice: 1700.0,
  },
];

/** Fixed values confirmed from the checkout reference screens (Silver only). */
export const EARNING_BALANCE_AVAILABLE = 12.5;
export const DISCOUNT_CODE = 'SUMMER12';
export const DISCOUNT_AMOUNT = 4.5;

export const FEATURE_LABELS = ['VIP signal channel access', 'All trading signals included'] as const;
