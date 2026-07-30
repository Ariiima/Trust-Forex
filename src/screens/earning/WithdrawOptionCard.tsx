import type { ReactNode } from 'react';
import { Radio } from '../../design-system/components';
import type { WithdrawOption } from './withdraw-data';
import './WithdrawOptionCard.css';

/* One selectable currency+network card. Identical in the step-1 picker
 * (1379:6901, 296 wide) and the "Change currency" sheet (1402:7191, 328 wide),
 * so the width comes from the container. */

const money = (n: number) => `$${n.toFixed(2)}`;

export function WithdrawOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: WithdrawOption;
  selected: boolean;
  onSelect: () => void;
}): ReactNode {
  return (
    <label className={'scr-wdopt' + (selected ? ' scr-wdopt--on' : '')}>
      <span className="scr-wdopt-top">
        <span className="scr-wdopt-coin">
          <img src={option.icon} alt="" width={32} height={32} />
          <img className="scr-wdopt-coin-net" src={option.networkIcon} alt="" width={16} height={16} />
        </span>
        <span className="scr-wdopt-name">
          <span className="scr-wdopt-symbol type-text-sm-semibold">{option.symbol}</span>
          <span className="scr-wdopt-network type-text-xs-10">{option.network}</span>
        </span>
        <Radio checked={selected} onChange={onSelect} />
      </span>

      <span className="scr-wdopt-meta">
        <span className="scr-wdopt-meta-cell">
          <span className="scr-wdopt-meta-label type-text-xs-10">Network fee</span>
          <span className="scr-wdopt-meta-value type-text-xs">{money(option.networkFee)}</span>
        </span>
        <span className="scr-wdopt-meta-cell">
          <span className="scr-wdopt-meta-label type-text-xs-10">Minimum withdraw</span>
          <span className="scr-wdopt-meta-value type-text-xs">{money(option.minimum)}</span>
        </span>
      </span>
    </label>
  );
}
