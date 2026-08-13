import type { ReactNode } from 'react';
import { Icon } from './Icon';
import tierStandardUrl from '../../assets/cashback/tier-standard.png';
import tierSilverUrl from '../../assets/cashback/tier-silver.png';
import tierGoldUrl from '../../assets/cashback/tier-gold.png';
import tierDiamondUrl from '../../assets/cashback/tier-diamond.png';
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

/* Tier stepper chips, cropped 1:1 (ring included) from the design's own PNG
 * export, so no redrawing error. White artwork on transparency; the dim state
 * comes from the parent's opacity. */
const TIER_ICONS: Record<CashbackPlan, string> = {
  standard: tierStandardUrl,
  silver: tierSilverUrl,
  gold: tierGoldUrl,
  diamond: tierDiamondUrl,
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
  /** Opens the "About cashback" sheet. Omitted = the info glyph renders inert. */
  onInfo?: () => void;
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
  onInfo,
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
            <button
              type="button"
              className="ds-info-btn ds-info-btn--on-dark"
              onClick={onInfo}
              aria-label="About cashback"
            >
              <Icon name="info" size={20} />
            </button>
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
                <img src={TIER_ICONS[tier.key]} alt="" />
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
