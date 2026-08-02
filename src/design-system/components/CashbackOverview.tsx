import type { ReactNode } from 'react';
import { Icon } from './Icon';
import badgeStandardUrl from '../../assets/plans/badge-standard.png';
import badgeSilverUrl from '../../assets/plans/badge-silver.png';
import badgeGoldUrl from '../../assets/plans/badge-gold.png';
import badgeDiamondUrl from '../../assets/plans/badge-diamond.png';
import './CashbackOverview.css';

export type CashbackPlan = 'standard' | 'silver' | 'gold' | 'diamond';

/** The real tier artwork, all four exported from the same badge sheet. */
const BADGES: Record<CashbackPlan, string> = {
  standard: badgeStandardUrl,
  silver: badgeSilverUrl,
  gold: badgeGoldUrl,
  diamond: badgeDiamondUrl,
};

// Tier stepper badges. In Figma these are small raster image chips (image
// fills, unexportable here); the rendered design shows them as circular
// outline glyphs — a person, a shield, a crown and a diamond — so they are
// reproduced with inline stroke icons (currentColor, sized by CSS).
const TIER_ICONS: Record<CashbackPlan, ReactNode> = {
  standard: (
    <>
      <path d="M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0" />
      <path d="M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2" />
    </>
  ),
  silver: (
    <>
      <path d="M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3" />
      <path d="M12 8.5l1.1 2.25 2.4 .35 -1.75 1.7 .42 2.4 -2.17 -1.14 -2.17 1.14 .42 -2.4 -1.75 -1.7 2.4 -.35z" />
    </>
  ),
  gold: <path d="M12 6l4 6l5 -4l-2 10h-14l-2 -10l5 4z" />,
  diamond: <path d="M6 5h12l3 5l-8.5 9.5a0.7 .7 0 0 1 -1 0l-8.5 -9.5z" />,
};

const TIERS: readonly { key: CashbackPlan; label: string }[] = [
  { key: 'standard', label: 'Standard' },
  { key: 'silver', label: 'Silver' },
  { key: 'gold', label: 'Gold' },
  { key: 'diamond', label: 'Diamond' },
];

/**
 * Per-tier defaults. Only the Gold sample (20%) is confirmed from Figma; the
 * other rates are placeholders and should be overridden via the `rate` prop.
 */
const PLAN_DEFAULTS: Record<CashbackPlan, { name: string; duration: string; rate: string }> = {
  standard: { name: 'standard plan', duration: '1 month', rate: '10%' },
  silver: { name: 'silver plan', duration: '1 month', rate: '15%' },
  gold: { name: 'gold plan', duration: '3 months', rate: '20%' },
  diamond: { name: 'diamond plan', duration: '12 months', rate: '30%' },
};

export interface CashbackOverviewProps {
  /** Figma "Cashback Overview" State (the user's current plan tier). Defaults to gold. */
  plan?: CashbackPlan;
  /** Headline total, e.g. "$1.245.80". */
  total?: string;
  /** Small caption under the total. */
  totalCaption?: string;
  /** Positive delta chip, e.g. "+$45.00". */
  delta?: string;
  /** Overrides the current-plan name (defaults from `plan`). */
  planName?: string;
  planDuration?: string;
  rate?: string;
  /** Overrides the tier artwork; defaults to the badge for `plan`. */
  badge?: ReactNode;
  onCashbackHistory?: () => void;
  onUpgrade?: () => void;
  className?: string;
}

export function CashbackOverview({
  plan = 'gold',
  total = '$1,245.80',
  totalCaption = 'Across all brokers',
  delta = '+$45.00',
  planName,
  planDuration,
  rate,
  badge,
  onCashbackHistory,
  onUpgrade,
  className,
}: CashbackOverviewProps): ReactNode {
  const def = PLAN_DEFAULTS[plan];
  const activeIndex = TIERS.findIndex((t) => t.key === plan);
  const classes = ['ds-cashback', `ds-cashback-${plan}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      <div className="ds-cashback-top">
        {/* total cashback */}
        <div className="ds-cashback-summary">
          <div className="ds-cashback-row">
            <span className="ds-cashback-label">Total cashback</span>
            <span className="ds-cashback-info">
              <Icon name="info" size={24} />
            </span>
          </div>
          <div className="ds-cashback-row ds-cashback-total-row">
            <div className="ds-cashback-amount-wrap">
              <span className="ds-cashback-amount">{total}</span>
              <span className="ds-cashback-muted">{totalCaption}</span>
            </div>
            <div className="ds-cashback-delta">
              <span className="ds-cashback-delta-icon">
                <Icon name="arrow-up" size={16} />
              </span>
              <span className="ds-cashback-muted">{delta}</span>
            </div>
          </div>
        </div>

        <div className="ds-cashback-divider" aria-hidden="true" />

        {/* current state panel */}
        <div className="ds-cashback-current">
          <div className="ds-cashback-row">
            <span className="ds-cashback-label">current state</span>
            <span className="ds-cashback-label">cashback rate</span>
          </div>
          <div className="ds-cashback-row ds-cashback-current-body">
            <div className="ds-cashback-plan">
              <span className="ds-cashback-badge" aria-hidden="true">
                {badge ?? <img src={BADGES[plan]} alt="" width={56} height={56} />}
              </span>
              <div className="ds-cashback-plan-text">
                <span className="ds-cashback-plan-name">{planName ?? def.name}</span>
                <span className="ds-cashback-muted">{planDuration ?? def.duration}</span>
              </div>
            </div>
            <span className="ds-cashback-rate">{rate ?? def.rate}</span>
          </div>
        </div>
      </div>

      {/* tier progression */}
      <div className="ds-cashback-tiers">
        {TIERS.map((tier, i) => (
          <div className="ds-cashback-tier-group" key={tier.key}>
            <div className={`ds-cashback-tier${i > activeIndex ? ' ds-cashback-tier-dim' : ''}`}>
              <span className="ds-cashback-tier-badge" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  {TIER_ICONS[tier.key]}
                </svg>
              </span>
              <span className="ds-cashback-tier-label">{tier.label}</span>
            </div>
            {i < TIERS.length - 1 ? <span className="ds-cashback-tier-line" /> : null}
          </div>
        ))}
      </div>

      {/* actions */}
      <div className="ds-cashback-actions">
        <button type="button" className="ds-cashback-btn ds-cashback-btn-history" onClick={onCashbackHistory}>
          Cashback history
        </button>
        <button type="button" className="ds-cashback-btn ds-cashback-btn-upgrade" onClick={onUpgrade}>
          Upgrade plan
        </button>
      </div>
    </div>
  );
}
