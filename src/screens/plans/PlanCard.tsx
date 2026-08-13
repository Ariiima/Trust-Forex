import type { ReactNode } from 'react';
import { Button, Icon } from '../../design-system/components';
import { Glyph } from './icons';
import { FEATURE_LABELS, type Plan } from './plans-data';
import './PlanCard.css';

/**
 * Plan card — Figma "Frame 2147229926/27/28" (552:3126). Two variants:
 *  - `full`: badge/name/price + feature checklist + per-tier Continue button
 *    (used on ChoosePlan and, later, Home's "choose your plan" list).
 *  - `compact`: badge/name/price only, wrapped in a selectable bordered
 *    row (used by the Checkout "Change plan" BottomSheet, 748:3736 — no
 *    JSON for that frame, geometry approximated from the reference PNG).
 */
export interface PlanCardProps {
  plan: Plan;
  variant: 'full' | 'compact';
  /** shows the blue "selected" border. */
  selected?: boolean;
  /** click anywhere on the card/row. On `full` this also makes the card
      selectable: the Continue button only appears once it is selected. */
  onSelect?: () => void;
  /** full only — Continue button click. */
  onContinue?: () => void;
  /** full only — extra class on the card root (Home uses it for the expand). */
  className?: string;
}

function PlanTag({ tag }: { tag: NonNullable<Plan['tag']> }): ReactNode {
  return <span className={`scr-plans-tag scr-plans-tag--${tag.variant}`}>{tag.label}</span>;
}

export function PlanCard({ plan, variant, selected, onSelect, onContinue, className }: PlanCardProps): ReactNode {
  // A `full` card with onSelect is a picker card: Continue appears only once
  // picked. Without it (Home's expanded card) the card is always open.
  const picker = variant === 'full' && Boolean(onSelect);
  /* The blue border follows the selection whenever the caller has an opinion
     about it, whether or not the card is a picker. It used to fall back to
     `plan.highlighted` for any non-picker card, so Home's expanded card drew
     the border for Gold — the tier flagged in plans-data — and for nothing
     else, whichever plan the user had actually picked. */
  const highlighted = variant === 'full' ? (selected ?? plan.highlighted) : selected;

  if (variant === 'compact') {
    return (
      <button
        type="button"
        className={'scr-plans-compact' + (highlighted ? ' scr-plans-compact--selected' : '')}
        onClick={onSelect}
        aria-pressed={Boolean(selected)}
      >
        <img className="scr-plans-badge scr-plans-badge--sm" src={plan.badge} alt="" width={48} height={48} />
        <span className="scr-plans-compact-text">
          <span className="scr-plans-namerow">
            <span className="scr-plans-name">{plan.name}</span>
            {plan.tag ? <PlanTag tag={plan.tag} /> : null}
          </span>
          <span className="scr-plans-pricerow">
            <span className="scr-plans-price">
              <span className="scr-plans-currency">$</span>
              {plan.price}
            </span>
            <span className="scr-plans-duration">/ {plan.duration}</span>
          </span>
        </span>
      </button>
    );
  }

  return (
    <article
      className={
        'scr-plans-card' + (highlighted ? ' scr-plans-card--highlight' : '') + (className ? ' ' + className : '')
      }
      onClick={onSelect}
      role={picker ? 'button' : undefined}
      aria-pressed={picker ? Boolean(selected) : undefined}
      tabIndex={picker ? 0 : undefined}
      onKeyDown={picker ? (e) => ['Enter', ' '].includes(e.key) && (e.preventDefault(), onSelect?.()) : undefined}
    >
      <div className="scr-plans-headerblock">
        <img className="scr-plans-badge" src={plan.badge} alt="" width={56} height={56} />
        <div className="scr-plans-text">
          <span className="scr-plans-namerow">
            <span className="scr-plans-name">{plan.name}</span>
            {plan.tag ? <PlanTag tag={plan.tag} /> : null}
          </span>
          <span className="scr-plans-pricerow">
            <span className="scr-plans-price">
              <span className="scr-plans-currency">$</span>
              {plan.price}
            </span>
            <span className="scr-plans-duration">/ {plan.duration}</span>
          </span>
        </div>
      </div>

      <div className="scr-plans-divider" aria-hidden="true" />

      <ul className="scr-plans-features">
        {FEATURE_LABELS.map((label) => (
          <li className="scr-plans-feature" key={label}>
            <Icon name="check" size={16} />
            <span className="scr-plans-feature-label">{label}</span>
          </li>
        ))}
        <li className="scr-plans-feature">
          <Icon name="check" size={16} />
          <span className="scr-plans-feature-label">Broker cashback boost</span>
          <span className="scr-plans-feature-value">
            {plan.boost}
            <Glyph name="trending-up" size={16} />
          </span>
        </li>
        <li className="scr-plans-feature">
          <Icon name="check" size={16} />
          <span className="scr-plans-feature-label">Referral share boost</span>
          <span className="scr-plans-feature-value">
            {plan.boost}
            <Glyph name="trending-up" size={16} />
          </span>
        </li>
      </ul>

      {picker && !selected ? null : (
        <Button
          variant="outline"
          size="medium"
          fullWidth
          className={highlighted ? 'scr-plans-continue--highlight' : ''}
          onClick={onContinue}
        >
          Continue
        </Button>
      )}
    </article>
  );
}
