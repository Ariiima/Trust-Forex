import { useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet, Icon } from '../../design-system/components';
import usdt from '../../assets/crypto/usdt.png';
import './WithdrawHistorySheet.css';

/* ---------------------------------------------------------------------------
 * "Withdraw history" sheet — frames 1404:7767 / 1436:14727 (sheet 360x635).
 * Header, a 4-way filter bar (All / Completed / Pending / Failed) on a 328x40
 * track, then rows 318x108 on a 12 gap: coin + "USDT · TRC20", a status chip,
 * the amount, and the date / destination line.
 * ------------------------------------------------------------------------- */

export type WithdrawStatus = 'completed' | 'pending' | 'rejected';

export interface WithdrawRecord {
  id: string;
  symbol: string;
  network: string;
  status: WithdrawStatus;
  amount: number;
  date: string;
  time: string;
  to: string;
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'pending', label: 'Pending' },
  { key: 'rejected', label: 'Failed' },
] as const;

const STATUS_LABEL: Record<WithdrawStatus, string> = {
  completed: 'Completed',
  pending: 'Pending',
  rejected: 'Rejected',
};

/** Sample rows from 1404:7767 — layer names are the copy. */
export const WITHDRAW_HISTORY: readonly WithdrawRecord[] = [
  { id: '1', symbol: 'USDT', network: 'TRC20', status: 'pending', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvn' },
  { id: '2', symbol: 'USDT', network: 'BEP20', status: 'rejected', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvn' },
  { id: '3', symbol: 'USDT', network: 'ERC20', status: 'completed', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvn' },
  { id: '4', symbol: 'USDT', network: 'USDT', status: 'completed', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvn' },
];

export interface WithdrawHistorySheetProps {
  open: boolean;
  records?: readonly WithdrawRecord[];
  onClose?: () => void;
}

export function WithdrawHistorySheet({
  open,
  records = WITHDRAW_HISTORY,
  onClose,
}: WithdrawHistorySheetProps): ReactNode {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const shown = filter === 'all' ? records : records.filter((r) => r.status === filter);

  return (
    <BottomSheet open={open} onClose={onClose} className="scr-wdhist-sheet">
      <div className="scr-wdhist-head">
        <h2 className="scr-wdhist-title type-text-lg-semibold">Withdraw history</h2>
        <button type="button" className="scr-wdhist-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} strokeWidth={1.6} />
        </button>
      </div>

      <div className="scr-wdhist-filters" role="tablist">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={filter === f.key}
            className={'scr-wdhist-filter type-text-xs' + (filter === f.key ? ' scr-wdhist-filter--on' : '')}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="scr-wdhist-list">
        {shown.map((r) => (
          <li key={r.id} className="scr-wdhist-row">
            <div className="scr-wdhist-row-top">
              <span className="scr-wdhist-pair">
                <img src={usdt} alt="" width={24} height={24} />
                <span className="type-text-sm-semibold">
                  {r.symbol} · {r.network}
                </span>
              </span>
              <span className="scr-wdhist-amount type-text-sm-semibold">${r.amount.toFixed(2)}</span>
            </div>

            <span className={`scr-wdhist-chip scr-wdhist-chip--${r.status} type-text-xs-10`}>
              {STATUS_LABEL[r.status]}
            </span>

            <div className="scr-wdhist-row-foot type-text-xs-10">
              <span>
                {r.date} · {r.time}
              </span>
              <span>To: {r.to}</span>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

export default WithdrawHistorySheet;
