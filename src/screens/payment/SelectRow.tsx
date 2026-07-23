import type { ReactNode } from 'react';
import './SelectRow.css';

export interface SelectRowProps {
  icon: string;
  primary: string;
  /** Two-line rows (currency: symbol + name) when set; single-line
   *  (network: full label) when omitted. */
  secondary?: string;
  selected: boolean;
  onClick: () => void;
}

/** Shared currency/network picker row — 56px tall with a two-line label
 *  (779:2365 in 552-3121) or 52px tall with a single-line label
 *  (1108:11980 in 552-3122). Reused by PaymentCurrency's list + its
 *  "Change currency" sheet, and PaymentNetwork's network list. */
export function SelectRow({ icon, primary, secondary, selected, onClick }: SelectRowProps): ReactNode {
  const rowClass =
    'scr-select-row' + (secondary ? '' : ' scr-select-row-single') + (selected ? ' scr-select-row-selected' : '');
  const radioClass = 'scr-select-row-radio' + (selected ? ' scr-select-row-radio-selected' : '');

  return (
    <button type="button" className={rowClass} onClick={onClick} aria-pressed={selected}>
      <span className="scr-select-row-info">
        <img className="scr-select-row-icon" src={icon} alt="" width={32} height={32} />
        {secondary ? (
          <span className="scr-select-row-labels">
            <span className="scr-select-row-primary">{primary}</span>
            <span className="scr-select-row-secondary">{secondary}</span>
          </span>
        ) : (
          <span className="scr-select-row-primary scr-select-row-primary-single">{primary}</span>
        )}
      </span>
      <span className={radioClass}>{selected ? <span className="scr-select-row-radio-dot" /> : null}</span>
    </button>
  );
}
