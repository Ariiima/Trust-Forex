import { useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet, Icon } from '../../design-system/components';
import usdt from '../../assets/crypto/usdt.png';
import './WithdrawHistorySheet.css';

/* ---------------------------------------------------------------------------
 * "Withdraw history" sheet — frame 1404:7767. Sheet 360x635 pinned to the
 * bottom edge, 16/16/24 padding.
 *
 * Vertical rhythm measured off the reference render (sheet top = 0):
 *   16  padding-top
 *   32  title line (16/32 regular) with the 24px close icon centred on it
 *   11  gap
 *    2  dashed rule — 4px on / 4px off, #F1F1F1
 *   15  gap
 *   40  filter track (328 wide, 1px #E4E4E4, r8, 4px inset pills r4)
 *   16  gap
 *  479  scrolling list (rows 318x108 on a 12 gap, 2px scroll rail)
 *   24  padding-bottom
 *
 * Row internals (card padding 12, three rows of 24 / 24 / 20 on an 8 gap):
 *   coin 24 + 8 + "USDT" · "TRC20" (12/24, 4px gaps, #E4E4E4 dot)
 *   status chip (10/20, 8px inset, r8) ......... amount (12/24)
 *   date · time (10/20) ................. "To:" + address (10/20)
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
  { id: '1', symbol: 'USDT', network: 'TRC20', status: 'pending', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvndiv' },
  { id: '2', symbol: 'USDT', network: 'BEP20', status: 'rejected', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvndiv' },
  { id: '3', symbol: 'USDT', network: 'ERC20', status: 'completed', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvndiv' },
  { id: '4', symbol: 'USDT', network: 'USDT', status: 'completed', amount: 100, date: 'Jul 25, 2026', time: '19:56', to: 'dvjdvojv...kvndiv' },
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
        <h2 className="scr-wdhist-title type-text-base">Withdraw history</h2>
        <button type="button" className="scr-wdhist-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} strokeWidth={1.6} />
        </button>
      </div>

      <div className="scr-wdhist-rule" aria-hidden="true" />

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
            <div className="scr-wdhist-pair">
              <img src={usdt} alt="" width={24} height={24} />
              <span className="type-text-xs">{r.symbol}</span>
              <span className="scr-wdhist-bullet" aria-hidden="true" />
              <span className="type-text-xs">{r.network}</span>
            </div>

            <div className="scr-wdhist-mid">
              <span className={`scr-wdhist-chip scr-wdhist-chip--${r.status} type-text-xs-10`}>
                {STATUS_LABEL[r.status]}
              </span>
              <span className="scr-wdhist-amount type-text-xs">${r.amount.toFixed(2)}</span>
            </div>

            <div className="scr-wdhist-foot type-text-xs-10">
              <span className="scr-wdhist-when">
                <span>{r.date}</span>
                <span className="scr-wdhist-dot" aria-hidden="true" />
                <span>{r.time}</span>
              </span>
              <span className="scr-wdhist-to">To: {r.to}</span>
            </div>
          </li>
        ))}
      </ul>
    </BottomSheet>
  );
}

export default WithdrawHistorySheet;
