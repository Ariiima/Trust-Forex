import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet } from '../../design-system/components';
import { Glyph } from './Glyph';
import { useScrollRail } from '../../design-system/useScrollRail';
import { getCashbackHistory, cachedCashbackHistory, getBrokers, cachedBrokers, type ApiBroker, type CashbackHistoryEntry } from '../../api/client';
import { BROKER_INFO, type HistoryRow } from './brokers-data';
import './CashbackHistorySheet.css';

const money = (n: number) => `$${n.toFixed(2)}`;

const toRow = (e: CashbackHistoryEntry): HistoryRow => ({
  broker: e.broker,
  name: e.brokerName,
  logo: e.brokerLogo,
  date: new Date(e.at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
  rate: `${e.ratePct}%`,
  amount: money(e.amount),
});

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
}

export function CashbackHistorySheet({
  open,
  onClose,
  rows,
}: CashbackHistorySheetProps): ReactNode {
  const [listRef, railThumb] = useScrollRail<HTMLUListElement>();

  /* `rows` passed in (design/review's own deep link) always wins; otherwise
     the sheet shows the honest live history — seeded from the boot prefetch
     (App.tsx) so it opens with its rows already there, and re-fetched on each
     open so a payout landing mid-session shows up. */
  const [live, setLive] = useState<HistoryRow[] | undefined>(() => cachedCashbackHistory()?.map(toRow));
  // Same source as the dashboard cards: admin-uploaded logoUrl, warm from
  // /cashback's own fetch on open.
  const [brokers, setBrokers] = useState<readonly ApiBroker[]>(() => cachedBrokers() ?? []);
  useEffect(() => {
    if (rows || !open) return;
    let alive = true;
    getCashbackHistory()
      .then((entries) => alive && setLive(entries.map(toRow)))
      .catch(() => undefined);
    getBrokers()
      .then((bs) => alive && setBrokers(bs))
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
        </div>
      ) : (
        <div className="scr-history-sheet-listwrap">
          <ul className="scr-history-sheet-list" ref={listRef}>
            {shown.map((row, i) => {
              // The row's own name/logo win — they come from the API and cover
              // private brokers too. The catalogue is admin-defined (any id),
              // so BROKER_INFO's 3 shipped brokers are the last fallback, and
              // no logo at all beats showing some other broker's mark.
              const b = brokers.find((x) => x.id === row.broker);
              const name = row.name ?? b?.preview?.name ?? b?.name ?? BROKER_INFO[row.broker]?.name ?? row.broker;
              const logo = row.logo ?? b?.logoUrl ?? BROKER_INFO[row.broker]?.logo;
              return (
                <li className="scr-history-sheet-row" key={`${row.broker}-${row.date}-${i}`}>
                  <span className="scr-history-sheet-row-id">
                    {logo ? (
                      <img className="scr-history-sheet-row-logo" src={logo} alt="" width={32} height={32} />
                    ) : null}
                    <span className="scr-history-sheet-row-text">
                      <span className="scr-history-sheet-row-name">{name}</span>
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
