import type { ReactNode } from 'react';
import { BottomSheet, Button } from '../../design-system/components';
import { Glyph } from './Glyph';
import { BROKER_INFO, HISTORY_ROWS, type HistoryRow } from './brokers-data';
import './CashbackHistorySheet.css';

/* ---------------------------------------------------------------------------
 * Cashback history bottom sheet — Figma 1292:4273 (filled) / 1233:6263
 * (empty), overlays /cashback. Supersedes the old routed CashbackHistory
 * screen. The thin grey rail on the right is a static scroll-thumb mock
 * baked into the design (same convention as before); the row list itself is
 * a real scrollable region.
 * ------------------------------------------------------------------------- */

export interface CashbackHistorySheetProps {
  open: boolean;
  onClose: () => void;
  /** Payout rows; pass [] to get the empty state (1233:6263). */
  rows?: readonly HistoryRow[];
  /** Empty-state "Start earning" CTA (fires after the sheet closes itself). */
  onStartEarning?: () => void;
}

export function CashbackHistorySheet({
  open,
  onClose,
  rows = HISTORY_ROWS,
  onStartEarning,
}: CashbackHistorySheetProps): ReactNode {
  return (
    <BottomSheet open={open} onClose={onClose} className="scr-history-sheet">
      {/* Own header, not the shared AboutCashbackSheet SheetHeader: measured
          off cashback-history.png this title sits lower (26px top padding,
          not 8) and the rule under it is dashed, not solid — the two
          sheets only look alike at a glance. */}
      <div className="scr-history-sheet-head">
        <span className="scr-history-sheet-headtitle">Cashback history</span>
        <button type="button" className="scr-history-sheet-headclose" onClick={onClose} aria-label="Close">
          <Glyph name="close" size={24} />
        </button>
      </div>
      <div className="scr-history-sheet-headdivider" aria-hidden="true" />

      {rows.length === 0 ? (
        <div className="scr-history-sheet-empty">
          <p className="scr-history-sheet-empty-title">No cashback activity yet</p>
          <p className="scr-history-sheet-empty-body">
            Complete the cashback setup with a partner broker. Your earnings will appear here after
            your first cashback is processed.
          </p>
          <Button
            variant="primary"
            size="medium"
            fullWidth
            className="scr-history-sheet-empty-cta"
            onClick={() => {
              onClose();
              onStartEarning?.();
            }}
          >
            Start earning
          </Button>
        </div>
      ) : (
        <div className="scr-history-sheet-listwrap">
          <ul className="scr-history-sheet-list">
            {rows.map((row, i) => {
              const info = BROKER_INFO[row.broker];
              return (
                <li className="scr-history-sheet-row" key={`${row.broker}-${row.date}-${i}`}>
                  <span className="scr-history-sheet-row-id">
                    <img className="scr-history-sheet-row-logo" src={info.logo} alt="" width={32} height={32} />
                    <span className="scr-history-sheet-row-text">
                      <span className="scr-history-sheet-row-name">{info.name}</span>
                      <span className="scr-history-sheet-row-date">{row.date}</span>
                    </span>
                  </span>
                  <span className="scr-history-sheet-row-nums">
                    <span className="scr-history-sheet-row-rate">{row.rate}</span>
                    <span className="scr-history-sheet-row-amount">{row.amount}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          <span className="scr-history-sheet-rail" aria-hidden="true">
            <span className="scr-history-sheet-rail-thumb" />
          </span>
        </div>
      )}
    </BottomSheet>
  );
}
