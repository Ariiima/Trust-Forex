import type { ReactNode } from 'react';
import './BrokerState.css';

export type BrokerStateVariant = 'no-account' | 'waiting-for-deposit' | 'cashback-active';

interface VariantDef {
  label: string;
  caption: string;
}

const VARIANTS: Record<BrokerStateVariant, VariantDef> = {
  'no-account': { label: 'no account', caption: 'Register To Start Earning Cashback' },
  'waiting-for-deposit': { label: 'waiting for deposit', caption: 'Make Your First Deposit' },
  'cashback-active': { label: 'cashback active', caption: 'Total Earned' },
};

export interface BrokerStateProps {
  /** Figma broker-state variant (State=…). Drives dot colour, title colour and default copy. */
  state: BrokerStateVariant;
  /** Override the coloured title. */
  label?: string;
  /** Override the grey caption / left sub-label. */
  caption?: string;
  /**
   * Right-aligned value shown next to the caption (used by 'cashback-active',
   * e.g. "$85.00"). When present the caption + value share one space-between row.
   */
  value?: ReactNode;
  className?: string;
}

export function BrokerState({
  state,
  label,
  caption,
  value,
  className,
}: BrokerStateProps): ReactNode {
  const def = VARIANTS[state];
  const classes = ['ds-broker', `ds-broker-${state}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role="status">
      <div className="ds-broker-head">
        <span className="ds-broker-dot" aria-hidden="true" />
        <span className="ds-broker-title">{label ?? def.label}</span>
      </div>
      {value !== undefined ? (
        <div className="ds-broker-sub ds-broker-sub-row">
          <span className="ds-broker-caption">{caption ?? def.caption}</span>
          <span className="ds-broker-value">{value}</span>
        </div>
      ) : (
        <span className="ds-broker-sub ds-broker-caption">{caption ?? def.caption}</span>
      )}
    </div>
  );
}
