import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet, Button } from '../../design-system/components';
import { Glyph } from './Glyph';
import { useScrollRail } from '../../design-system/useScrollRail';
import { getCashbackHistory } from '../../api/client';
import { BROKER_INFO, type HistoryRow } from './brokers-data';
import './CashbackHistorySheet.css';

const money = (n: number) => `$${n.toFixed(2)}`;

/* ---------------------------------------------------------------------------
 * Cashback history bottom sheet — Figma 1292:4273 (filled) / 1233:6263
 * (empty), overlays /cashback. Supersedes the old routed CashbackHistory
 * screen. The thin grey rail on the right is the design's own scroll thumb,
 * driven off the list's real scroll position (useScrollRail) rather than
 * parked at the frame's fixed height.
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
  rows,
  onStartEarning,
}: CashbackHistorySheetProps): ReactNode {
  const [listRef, railThumb] = useScrollRail<HTMLUListElement>();

  /* `rows` passed in (design/review's own deep link) always wins; otherwise
     the sheet fetches the honest live history — no sample data standing in
     while that request is out. */
  const [live, setLive] = useState<HistoryRow[]>();
  useEffect(() => {
    if (rows || !open) return;
    let alive = true;
    getCashbackHistory()
      .then((entries) => alive && setLive(entries.map((e) => ({
        broker: e.broker,
        date: new Date(e.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
        rate: `${e.ratePct}%`,
        amount: money(e.amount),
      }))))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [open, rows]);

  // undefined while the fetch is out — distinct from [] (a confirmed-empty
  // history) so the "No cashback activity yet" copy doesn't flash up for
  // the one beat before the real rows land.
  const shown = rows ?? live;
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

      {shown === undefined ? null : shown.length === 0 ? (
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
          <ul className="scr-history-sheet-list" ref={listRef}>
            {shown.map((row, i) => {
              // Broker catalogue is admin-defined (any id) — BROKER_INFO only
              // has logos for the 3 shipped brokers, so fall back the same
              // way Cashback.tsx's liveCards does, not an unchecked index.
              const info = BROKER_INFO[row.broker] ?? { name: row.broker, logo: BROKER_INFO.xm.logo };
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
            <span className="scr-history-sheet-rail-thumb" style={railThumb} />
          </span>
        </div>
      )}
    </BottomSheet>
  );
}
