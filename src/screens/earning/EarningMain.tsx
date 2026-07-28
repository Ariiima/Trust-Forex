import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import './EarningMain.css';

/* ---------------------------------------------------------------------------
 * Earning — main page — route /earning
 * Frame 1367:5166 (360x1045). Blue balance card (16,92 -> 328x396) with the
 * referral/cashback split bar and the two withdraw CTAs, then the "Earnings
 * analysis" card (16,513 -> 328x420): a 296x164 plot on a 6-line $0..$500
 * grid, a draggable crosshair, and a brush strip that pans the window.
 * ------------------------------------------------------------------------- */

const PLOT_W = 296;
const PLOT_H = 164;
const GRID = ['$500', '$400', '$300', '$200', '$100', '$0'];
const WEEKS = 24; // Aug 2026 W1 .. Sep 2026 W1 across the full series
const WINDOW = 12; // weeks visible at once; the brush pans this window

const REFERRAL_COLOR = '#48D48A';
const CASHBACK_COLOR = '#FFC300';

const money = (n: number) => `$${n.toFixed(2)}`;

/* ponytail: no /api/earnings series yet, so both lines are generated once from
   a fixed seed — deterministic, so the chart never jitters between renders.
   Swap `series` for the API payload; everything below is shape-agnostic. */
function makeSeries(seed: number, base: number, amp: number): number[] {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: WEEKS }, (_, i) => {
    const wave = Math.sin((i / WEEKS) * Math.PI * 2.2) * amp;
    return Math.max(20, base + wave + (rnd() - 0.5) * amp * 0.8);
  });
}

function weekLabel(i: number): string {
  const month = i < 12 ? 'Aug 2026' : 'Sep 2026';
  return `${month} · W${(i % 12) + 1}`;
}

export interface EarningMainProps {
  availableBalance?: number;
  totalEarnings?: number;
  referralEarnings?: number;
  cashbackEarnings?: number;
  onWithdraw?: () => void;
  onHistory?: () => void;
  onNavigate?: (tab: NavigationTab) => void;
}

export function EarningMain({
  availableBalance = 245,
  totalEarnings = 360,
  referralEarnings = 288,
  cashbackEarnings = 72,
  onWithdraw,
  onHistory,
  onNavigate,
}: EarningMainProps): ReactNode {
  const referralPct = Math.round((referralEarnings / (referralEarnings + cashbackEarnings)) * 100);
  const cashbackPct = 100 - referralPct;

  // Kept inside the $0..$500 axis so neither line clips the plot.
  const referral = useMemo(() => makeSeries(7, 240, 120), []);
  const cashback = useMemo(() => makeSeries(13, 150, 90), []);

  const [offset, setOffset] = useState(0); // first visible week
  const [cursor, setCursor] = useState(6); // selected week, relative to window
  const plotRef = useRef<HTMLDivElement>(null);

  const view = (s: number[]) => s.slice(offset, offset + WINDOW);
  const toPath = (s: number[]) =>
    view(s)
      .map((v, i) => {
        const x = (i / (WINDOW - 1)) * PLOT_W;
        const y = PLOT_H - (Math.min(v, 500) / 500) * PLOT_H;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const cursorX = (cursor / (WINDOW - 1)) * PLOT_W;
  const absWeek = offset + cursor;

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setCursor(Math.round(ratio * (WINDOW - 1)));
  };

  const pan = (dir: -1 | 1) => setOffset((o) => Math.max(0, Math.min(WEEKS - WINDOW, o + dir * 3)));

  return (
    <div className="scr-earn">
      {/* ---- balance card ---------------------------------------------- */}
      <section className="scr-earn-card">
        <div className="scr-earn-balance">
          <h1 className="scr-earn-balance-label type-text-base">Available balance</h1>
          <div className="scr-earn-balance-row">
            <span className="scr-earn-balance-value type-text-2xl-bold">{money(availableBalance)}</span>
            <span className="scr-earn-total">
              <span className="scr-earn-total-value type-text-base">{money(totalEarnings)}</span>
              <span className="scr-earn-total-label type-text-xs-10">Total earnings</span>
            </span>
          </div>
        </div>

        <hr className="scr-earn-rule" />

        <div className="scr-earn-breakdown">
          <h2 className="scr-earn-breakdown-title type-text-base">Earnings breakdown</h2>

          <div className="scr-earn-bar" role="img" aria-label={`Referral ${referralPct}%, cashback ${cashbackPct}%`}>
            <span className="scr-earn-bar-seg scr-earn-bar-seg--referral" style={{ width: `${referralPct}%` }}>
              <span className="type-text-xs-10">{referralPct}%</span>
            </span>
            <span className="scr-earn-bar-seg scr-earn-bar-seg--cashback" style={{ width: `${cashbackPct}%` }}>
              <span className="type-text-xs-10">{cashbackPct}%</span>
            </span>
          </div>

          <ul className="scr-earn-legend">
            {[
              { label: 'Referral earnings', value: referralEarnings, pct: referralPct, mod: 'referral' },
              { label: 'Cashback earnings', value: cashbackEarnings, pct: cashbackPct, mod: 'cashback' },
            ].map((l) => (
              <li key={l.label} className="scr-earn-legend-row">
                <span className="scr-earn-legend-left">
                  <span className={`scr-earn-dot scr-earn-dot--${l.mod}`} />
                  <span className="type-text-xs">{l.label}</span>
                </span>
                <span className="scr-earn-legend-right">
                  <span className="type-text-base">{money(l.value)}</span>
                  <span className="scr-earn-legend-sep" />
                  <span className="type-text-base">{l.pct}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="scr-earn-actions">
          <Button
            variant="primary"
            size="medium"
            fullWidth
            className="scr-earn-cta"
            iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
            onClick={onWithdraw}
          >
            Withdraw earnings
          </Button>
          <button type="button" className="scr-earn-ghost type-text-sm-semibold" onClick={onHistory}>
            Withdraw history
          </button>
        </div>
      </section>

      {/* ---- earnings analysis ----------------------------------------- */}
      <section className="scr-earn-analysis">
        <h2 className="scr-earn-analysis-title type-text-base-semibold">Earnings analysis</h2>

        <p className="scr-earn-range type-text-xs">
          {weekLabel(offset)} – {weekLabel(offset + WINDOW - 1)}
        </p>

        <div className="scr-earn-plot-wrap">
          <div className="scr-earn-grid">
            {GRID.map((g) => (
              <div key={g} className="scr-earn-grid-row">
                <span className="scr-earn-grid-label type-text-xs-10">{g}</span>
              </div>
            ))}
          </div>

          <div
            className="scr-earn-plot"
            ref={plotRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              track(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e);
            }}
          >
            <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} fill="none" preserveAspectRatio="none">
              <path d={toPath(referral)} stroke={REFERRAL_COLOR} strokeWidth={1.5} strokeLinejoin="round" />
              <path d={toPath(cashback)} stroke={CASHBACK_COLOR} strokeWidth={1.5} strokeLinejoin="round" />
            </svg>
            <span className="scr-earn-crosshair" style={{ left: `${(cursorX / PLOT_W) * 100}%` }} />
          </div>

          <div className="scr-earn-tooltip" style={{ left: `${(cursorX / PLOT_W) * 100}%` }}>
            <span className="scr-earn-tooltip-date type-text-xs-10">{weekLabel(absWeek)}</span>
            <span className="scr-earn-tooltip-row">
              <span className="scr-earn-legend-left">
                <span className="scr-earn-dot scr-earn-dot--referral" />
                <span className="type-text-xs-10">Referral earnings</span>
              </span>
              <span className="type-text-xs-10">{money(referral[absWeek] ?? 0)}</span>
            </span>
            <span className="scr-earn-tooltip-row">
              <span className="scr-earn-legend-left">
                <span className="scr-earn-dot scr-earn-dot--cashback" />
                <span className="type-text-xs-10">Cashback earnings</span>
              </span>
              <span className="type-text-xs-10">{money(cashback[absWeek] ?? 0)}</span>
            </span>
          </div>
        </div>

        {/* brush — pans the visible window (the frame's < > handles) */}
        <div className="scr-earn-brush">
          <button
            type="button"
            className="scr-earn-brush-handle"
            onClick={() => pan(-1)}
            disabled={offset === 0}
            aria-label="Earlier weeks"
          >
            ‹
          </button>
          <div className="scr-earn-brush-track">
            <svg viewBox={`0 0 ${PLOT_W} 40`} fill="none" preserveAspectRatio="none">
              <path
                d={referral
                  .map((v, i) => `${i === 0 ? 'M' : 'L'} ${(i / (WEEKS - 1)) * PLOT_W} ${40 - (v / 500) * 40}`)
                  .join(' ')}
                stroke={REFERRAL_COLOR}
                strokeWidth={1}
              />
            </svg>
            <span
              className="scr-earn-brush-window"
              style={{ left: `${(offset / WEEKS) * 100}%`, width: `${(WINDOW / WEEKS) * 100}%` }}
            />
          </div>
          <button
            type="button"
            className="scr-earn-brush-handle"
            onClick={() => pan(1)}
            disabled={offset >= WEEKS - WINDOW}
            aria-label="Later weeks"
          >
            ›
          </button>
        </div>

        <ul className="scr-earn-foot-legend">
          <li>
            <span className="scr-earn-dot scr-earn-dot--referral" />
            <span className="type-text-xs">Referral earnings</span>
          </li>
          <li>
            <span className="scr-earn-dot scr-earn-dot--cashback" />
            <span className="type-text-xs">Cashback earnings</span>
          </li>
        </ul>
      </section>

      <NavigationBar active="earning" onChange={onNavigate} className="scr-earn-nav" />
    </div>
  );
}

export default EarningMain;
