import type { ReactNode } from 'react';
import { Glyph } from './Glyph';
import { BROKER_INFO, HISTORY_ROWS } from './brokers-data';
import './CashbackHistory.css';

/**
 * Cashback history — route `/cashback/history`. Figma node 881:1391.
 * Back-arrow header (app content, built) + a scrollable list of past
 * payouts (broker, date, rate, amount). Pushed from the Cashback
 * dashboard's "Cashback history" button.
 *
 * The thin grey rail on the left of the list in the Figma frame is a
 * static scroll-thumb mock baked into the design (not a live scrollbar
 * sync) — reproduced here as the same static decoration; the row list
 * itself is a real scrollable region.
 */
export interface CashbackHistoryProps {
  onBack?: () => void;
}

export default function CashbackHistory({ onBack }: CashbackHistoryProps): ReactNode {
  return (
    <div className="scr-history">
      <header className="scr-history-header">
        <button className="scr-history-back" type="button" onClick={onBack} aria-label="Back">
          <Glyph name="back" size={20} strokeWidth={1.5} />
        </button>
        <span className="scr-history-headtitle">cashback history</span>
      </header>

      <main className="scr-history-body">
        <div className="scr-history-card">
          <span className="scr-history-scrollbar" aria-hidden="true">
            <span className="scr-history-scrollbar-thumb" />
          </span>

          <ul className="scr-history-list">
            {HISTORY_ROWS.map((row, i) => {
              const info = BROKER_INFO[row.broker];
              return (
                <li className="scr-history-row" key={`${row.broker}-${row.date}-${i}`}>
                  <span className="scr-history-row-id">
                    <img className="scr-history-row-logo" src={info.logo} alt="" width={32} height={32} />
                    <span className="scr-history-row-text">
                      <span className="scr-history-row-name">{info.name}</span>
                      <span className="scr-history-row-date">{row.date}</span>
                    </span>
                  </span>
                  <span className="scr-history-row-nums">
                    <span className="scr-history-row-rate">{row.rate}</span>
                    <span className="scr-history-row-amount">{row.amount}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </main>
    </div>
  );
}
