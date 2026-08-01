import { useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { WithdrawHistorySheet } from './WithdrawHistorySheet';
import './EarningMain.css';

/* ---------------------------------------------------------------------------
 * Earning — main page — route /earning
 * Frame 1367:5166 (360x1044, minus the 76px status-bar + Telegram header the
 * app does not draw). Every offset below was sampled off the 1:1 frame render:
 *   blue card      16,16   328x396  (radius 16, #144CCD)
 *   analysis card  16,436  328x420  (radius 16, #FFF)
 *   grid           6 lines 32px apart, first at y567, each 2px of #F8F8F8
 *   plot           x32..328, $500 -> y568, $0 -> y728
 *   tooltip        102,544  196x73
 *   brush          32,752   296x48
 * ------------------------------------------------------------------------- */

const PLOT_W = 296; // x32..328 — the card's content width
const PLOT_H = 160; // $500 grid line (y568) .. $0 grid line (y728)
const GRID = ['$500', '$400', '$300', '$200', '$100', '$0'];
const WEEKS = 20; // Jul 2026 W6 .. Sep 2026 W1 across the full series
const WINDOW = 13; // weeks visible at once by default
const MIN_WINDOW = 4; // smallest range the brush can be squeezed to
/** The frame shows the newest window selected — brush mask 36% / window 64%. */
const OFFSET_0 = WEEKS - WINDOW;
/** Crosshair, as a fraction of the plot width. 168/296 — where the frame puts it. */
const CURSOR_0 = 168 / PLOT_W;

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

/** Scale a mock series so the initially-selected week reports `target` — what
    the frame's tooltip shows — then squash it so nothing clips the $0..$500
    axis. Affine, so the curve keeps its shape. */
function pinTo(series: number[], index: number, target: number): number[] {
  const base = series[index];
  const k = target / base;
  const scaled = series.map((v) => target + (v - base) * k);
  const max = Math.max(...scaled);
  const squash = max > 470 ? (470 - target) / (max - target) : 1;
  return scaled.map((v) => Math.max(12, target + (v - target) * squash));
}

/** 12 weeks to a month; week OFFSET_0 of the series is Aug 2026 W1. */
const MONTHS = ['Jul', 'Aug', 'Sep', 'Oct'];
function weekLabel(i: number): string {
  const k = i - OFFSET_0;
  return `${MONTHS[Math.floor(k / 12) + 1]} 2026 · W${(((k % 12) + 12) % 12) + 1}`;
}

export interface EarningMainProps {
  /** Review deep-link: open the history sheet on mount. */
  initialSheet?: 'history';
  availableBalance?: number;
  totalEarnings?: number;
  referralEarnings?: number;
  cashbackEarnings?: number;
  onWithdraw?: () => void;
  onHistory?: () => void;
  onNavigate?: (tab: NavigationTab) => void;
}

export function EarningMain({
  initialSheet,
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

  const [historyOpen, setHistoryOpen] = useState(initialSheet === 'history');
  const [cursor, setCursor] = useState(CURSOR_0); // 0..1 across the visible window
  const plotRef = useRef<HTMLDivElement>(null);

  const pinned = OFFSET_0 + Math.round(CURSOR_0 * (WINDOW - 1));
  const referral = useMemo(() => pinTo(makeSeries(7, 240, 120), pinned, referralEarnings), [pinned, referralEarnings]);
  const cashback = useMemo(() => pinTo(makeSeries(13, 150, 90), pinned, cashbackEarnings), [pinned, cashbackEarnings]);

  const view = (s: number[]) => s.slice(offset, offset + WINDOW);
  const path = (s: number[], w: number, h: number, n: number, all = false) =>
    (all ? s : view(s))
      .map((v, i) => {
        const x = (i / (n - 1)) * w;
        const y = h - (Math.min(v, 500) / 500) * h;
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');

  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCursor(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  };

  /* The brush is a real range control: drag either handle to resize the window,
     drag the window itself to pan. Both edges are week indices into the series;
     `span` is derived, so the plot re-scales as the range narrows. */
  const [range, setRange] = useState({ from: OFFSET_0, to: OFFSET_0 + WINDOW - 1 });
  const brushRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'from' | 'to' | 'pan'; grabWeek: number; from: number; to: number } | null>(null);

  const offset = range.from;
  const span = range.to - range.from + 1;

  /** Pointer x -> fractional week index across the whole strip. */
  const weekAt = (clientX: number) => {
    const rect = brushRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return ((clientX - rect.left) / rect.width) * (WEEKS - 1);
  };

  const onBrushDown = (mode: 'from' | 'to' | 'pan') => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Capture on the strip, not the handle: the pointer routinely leaves a 12px
    // handle mid-drag, and the move handler lives on the strip.
    brushRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { mode, grabWeek: weekAt(e.clientX), from: range.from, to: range.to };
  };

  const onBrushMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = weekAt(e.clientX) - d.grabWeek;
    const clamp = (v: number) => Math.max(0, Math.min(WEEKS - 1, Math.round(v)));

    if (d.mode === 'pan') {
      const width = d.to - d.from;
      let from = clamp(d.from + delta);
      from = Math.min(from, WEEKS - 1 - width);
      setRange({ from, to: from + width });
    } else if (d.mode === 'from') {
      const from = Math.min(clamp(d.from + delta), d.to - (MIN_WINDOW - 1));
      setRange({ from, to: d.to });
    } else {
      const to = Math.max(clamp(d.to + delta), d.from + (MIN_WINDOW - 1));
      setRange({ from: d.from, to });
    }
  };

  const endDrag = (e: React.PointerEvent) => {
    brushRef.current?.releasePointerCapture?.(e.pointerId);
    dragRef.current = null;
  };

  /* The series is plotted point-to-edge, so the brush window spans the same
     fractions of the strip that its first and last points sit at. */
  const windowLeft = (range.from / (WEEKS - 1)) * 100;
  const windowWidth = ((range.to - range.from) / (WEEKS - 1)) * 100;

  const absWeek = offset + Math.round(cursor * (span - 1));

  return (
    <div className="scr-earn">
      {/* ---- balance card ---------------------------------------------- */}
      <section className="scr-earn-card">
        <div className="scr-earn-summary">
          <h1 className="scr-earn-balance-label">Available balance</h1>
          <div className="scr-earn-balance-row">
            <span className="scr-earn-balance-value">{money(availableBalance)}</span>
            <span className="scr-earn-total">
              <span className="scr-earn-total-value">{money(totalEarnings)}</span>
              <span className="scr-earn-total-label">Total earnings</span>
            </span>
          </div>

          <hr className="scr-earn-rule" />

          <h2 className="scr-earn-breakdown-title">Earnings breakdown</h2>

          <div className="scr-earn-bar" role="img" aria-label={`Referral ${referralPct}%, cashback ${cashbackPct}%`}>
            <span className="scr-earn-bar-seg scr-earn-bar-seg--referral" style={{ width: `${referralPct}%` }}>
              <span>{referralPct}%</span>
            </span>
            <span className="scr-earn-bar-seg scr-earn-bar-seg--cashback" style={{ width: `${cashbackPct}%` }}>
              <span>{cashbackPct}%</span>
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
                  <span className="scr-earn-legend-label">{l.label}</span>
                </span>
                <span className="scr-earn-legend-right">
                  <span className="scr-earn-legend-value">{money(l.value)}</span>
                  <span className="scr-earn-legend-sep" />
                  <span className="scr-earn-legend-value">{l.pct}%</span>
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
          <button
            type="button"
            className="scr-earn-ghost"
            onClick={onHistory ?? (() => setHistoryOpen(true))}
          >
            Withdraw history
          </button>
        </div>
      </section>

      {/* ---- earnings analysis ----------------------------------------- */}
      <section className="scr-earn-analysis">
        <h2 className="scr-earn-analysis-title">Earnings analysis</h2>

        <p className="scr-earn-range">
          {weekLabel(offset)}
          <span className="scr-earn-range-sep">–</span>
          {weekLabel(range.to)}
        </p>

        <div className="scr-earn-plot-wrap">
          <div className="scr-earn-grid">
            {GRID.map((g) => (
              <div key={g} className="scr-earn-grid-row">
                <span className="scr-earn-grid-label">{g}</span>
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
              <path d={path(referral, PLOT_W, PLOT_H, WINDOW)} stroke={REFERRAL_COLOR} strokeWidth={2} strokeLinejoin="round" />
              <path d={path(cashback, PLOT_W, PLOT_H, WINDOW)} stroke={CASHBACK_COLOR} strokeWidth={2} strokeLinejoin="round" />
            </svg>
          </div>

          <span className="scr-earn-crosshair" style={{ left: `${cursor * PLOT_W}px` }} />

          <div className="scr-earn-tooltip" style={{ left: `${cursor * PLOT_W}px` }}>
            <span className="scr-earn-tooltip-date">{weekLabel(absWeek)}</span>
            <span className="scr-earn-tooltip-row">
              <span className="scr-earn-legend-left">
                <span className="scr-earn-dot scr-earn-dot--referral" />
                <span className="scr-earn-tooltip-label">Referral earnings</span>
              </span>
              <span className="scr-earn-tooltip-value">{money(referral[absWeek] ?? 0)}</span>
            </span>
            <span className="scr-earn-tooltip-row">
              <span className="scr-earn-legend-left">
                <span className="scr-earn-dot scr-earn-dot--cashback" />
                <span className="scr-earn-tooltip-label">Cashback earnings</span>
              </span>
              <span className="scr-earn-tooltip-value">{money(cashback[absWeek] ?? 0)}</span>
            </span>
          </div>
        </div>

        {/* brush — pans the visible window (the frame's ‹ › handles) */}
        <div
          className="scr-earn-brush"
          ref={brushRef}
          onPointerMove={onBrushMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
        >
          <span className="scr-earn-brush-mask" style={{ width: `${windowLeft}%` }} />
          <span
            className="scr-earn-brush-window"
            style={{ left: `${windowLeft}%`, width: `${windowWidth}%` }}
            onPointerDown={onBrushDown('pan')}
          />
          <svg className="scr-earn-brush-chart" viewBox={`0 0 ${PLOT_W} 32`} fill="none" preserveAspectRatio="none">
            <path d={path(referral, PLOT_W, 32, WEEKS, true)} stroke={REFERRAL_COLOR} strokeWidth={2} strokeLinejoin="round" />
            <path d={path(cashback, PLOT_W, 32, WEEKS, true)} stroke={CASHBACK_COLOR} strokeWidth={2} strokeLinejoin="round" />
          </svg>
          <button
            type="button"
            className="scr-earn-brush-handle"
            style={{ left: `${windowLeft}%` }}
            onPointerDown={onBrushDown('from')}
            aria-label="Drag to change the start of the range"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M7.5 2 L3.5 6 L7.5 10" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
          <button
            type="button"
            className="scr-earn-brush-handle"
            style={{ left: `${windowLeft + windowWidth}%`, marginLeft: '-12px' }}
            onPointerDown={onBrushDown('to')}
            aria-label="Drag to change the end of the range"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M4.5 2 L8.5 6 L4.5 10" fill="none" stroke="currentColor" strokeWidth="1" />
            </svg>
          </button>
        </div>

        <ul className="scr-earn-foot-legend">
          <li>
            <span className="scr-earn-dot scr-earn-dot--referral" />
            <span>Referral earnings</span>
          </li>
          <li>
            <span className="scr-earn-dot scr-earn-dot--cashback" />
            <span>Cashback earnings</span>
          </li>
        </ul>
      </section>

      <WithdrawHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />

      <NavigationBar active="earning" onChange={onNavigate} className="scr-earn-nav" />
    </div>
  );
}

export default EarningMain;
