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

/* Tier stepper badges. In Figma these are small raster image chips (image
 * fills, unexportable here), so they are redrawn — but SOLID, not outlined.
 * Measured over the ring's interior on 850:2053, the reference glyphs carry an
 * ink fill-ratio of 0.29 / 0.50 / 0.41 / 0.44 (standard→diamond); the stroke
 * versions these replace carried 0.13-0.23, which is what made them read as
 * spindly next to the design. At a 12px render weight is the only thing that
 * survives, so weight is what is matched.
 *
 * Holes (the shield's rosette, the gem's facets) are subpaths under
 * fill-rule="evenodd" rather than a background-coloured shape on top, so the
 * badge stays correct on any surface.
 *
 * These are approximations of unexportable raster chips, not traced vectors —
 * a 13px source has no recoverable outline. An SVG export of the four would
 * make them exact. */
const TIER_ICONS: Record<CashbackPlan, ReactNode> = {
  standard: (
    <path
      fillRule="evenodd"
      d="M12 4.4a3.6 3.6 0 1 1 0 7.2 3.6 3.6 0 0 1 0-7.2zM12 13.2c4 0 7.2 2.9 7.2 6.4H4.8c0-3.5 3.2-6.4 7.2-6.4z"
    />
  ),
  silver: (
    <path
      fillRule="evenodd"
      d="M12 2.2 20.6 5.7v6.4c0 4.7-3.5 8-8.6 9.7-5.1-1.7-8.6-5-8.6-9.7V5.7zM12 8.4a3.3 3.3 0 1 0 0 6.6 3.3 3.3 0 0 0 0-6.6z"
    />
  ),
  gold: <path d="M2.8 7.6 8 11.4 12 4.2l4 7.2 5.2-3.8-1.9 11.2H4.7z" />,
  diamond: (
    <path
      fillRule="evenodd"
      d="M5.6 3.8h12.8l3.2 5.4-9.6 11-9.6-11zM9.5 9.9h5l-2.5 6.6z"
    />
  ),
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
                <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
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
