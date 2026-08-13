import type { ReactNode } from 'react';
import { CashbackOverview } from '../../design-system/components';
import { CashbackHistorySheet } from './CashbackHistorySheet';
import { OVERVIEW } from './brokers-data';
import { useBackButton } from '../../telegram';
import './CashbackHistory.css';

/**
 * Cashback history — route `/cashback/history`. Figma frame is the
 * CashbackHistorySheet (1292:4273) overlaying the /cashback dashboard, not
 * a standalone page: pixel-sampling cashback-history.png confirms the blue
 * card peeking above the sheet is `primary-colors-900` dimmed by the
 * standard BottomSheet scrim (rgba(33,33,33,.16) over #144CCD -> #1645B1,
 * matches the reference exactly), and the sheet height (684px) is the same
 * value CashbackHistorySheet.css already carries. So this route renders the
 * real dashboard card peeking out from behind the real sheet component,
 * always open, in place of the old back-arrow full-page header.
 */
export interface CashbackHistoryProps {
  onBack?: () => void;
}

export default function CashbackHistory({ onBack }: CashbackHistoryProps): ReactNode {
  // No in-app header (the sheet's own close button is the in-app affordance) —
  // Telegram's native BackButton needs the same wiring as every other screen.
  useBackButton(onBack);
  return (
    <div className="scr-history">
      <div className="scr-history-bg" aria-hidden="true">
        <CashbackOverview {...OVERVIEW} />
      </div>

      <CashbackHistorySheet open onClose={() => onBack?.()} />
    </div>
  );
}
