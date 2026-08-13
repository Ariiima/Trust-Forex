import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { WithdrawHistorySheet } from './WithdrawHistorySheet';
import type { WithdrawRecord } from './WithdrawHistorySheet';
import { haptic, useSeenValue } from '../../design-system/useCountUp';
import { cachedMe, getEarningsWeekly, getMe, getWithdrawals } from '../../api/client';
import type { WeeklyEarnings } from '../../api/client';
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
const PLOT_H = 160; // top grid line (y568) .. bottom grid line (y728)
const GRID_LINES = 6; // the frame draws six, 32px apart
const WEEKS = 20; // matches the server's own default window (ledger.weeklyEarnings)
const WINDOW = 13; // weeks visible at once by default
const MIN_WINDOW = 4; // smallest range the brush can be squeezed to
/** The frame shows the newest window selected — brush mask 36% / window 64%. */
const OFFSET_0 = WEEKS - WINDOW;
/** Crosshair, as a fraction of the plot width. 168/296 — where the frame puts it. */
const CURSOR_0 = 168 / PLOT_W;
/** Gap between a data point and its readout box. */
const TIP_GAP = 8;
const TIP_W = 140; // .scr-earn-tooltip

const REFERRAL_COLOR = '#48D48A';
const CASHBACK_COLOR = '#FFC300';

const money = (n: number) => `$${n.toFixed(2)}`;

/* Before /api/me/earnings-weekly answers, every week plots the current total
   — flat, like the no-data resting state axisFor already draws at $0..$500.
   Honest about what's known (the total) without inventing what isn't (the
   history) for the one beat before the real series lands. */
function flatSeries(total: number): number[] {
  return Array.from({ length: WEEKS }, () => total);
}

/** Same fallback beat as flatSeries — a placeholder label until the real
    week's start date is known. */
function weekLabel(i: number): string {
  return `Week ${i + 1}`;
}

/** Round a raw axis step up to 1/2/2.5/5 x 10^k, so the labels stay readable. */
function niceStep(raw: number): number {
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
}

interface Axis {
  bottom: number;
  top: number;
  step: number;
}

/** Six grid lines the given values fill top to bottom. The axis used to be a
    fixed $0..$500, so squeezing the brush down to a fortnight of $30 swings
    drew both series as flat lines along the bottom of the card. */
function axisFor(values: readonly number[]): Axis {
  // Empty or all-zero data keeps the frame's resting $0..$500 axis.
  if (!values.length || Math.max(...values) <= 0) return { bottom: 0, top: 500, step: 100 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Two passes: the first picks a step to round the floor down to, the second
  // sizes the step to the range that floor actually leaves — which guarantees
  // `top` clears `max` without a third pass.
  const rough = niceStep((max - min) / (GRID_LINES - 1));
  const bottom = Math.max(0, Math.floor(min / rough) * rough);
  const step = niceStep((max - bottom) / (GRID_LINES - 1));
  return { bottom, top: bottom + step * (GRID_LINES - 1), step };
}

const axisLabel = (n: number) => `$${n % 1 ? n.toFixed(2) : n}`;

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
  availableBalance = 0,
  totalEarnings: totalEarningsDefault = 0,
  referralEarnings: referralEarningsDefault = 0,
  cashbackEarnings: cashbackEarningsDefault = 0,
  onWithdraw,
  onHistory,
  onNavigate,
}: EarningMainProps): ReactNode {
  // `live` is null only for the beat before /api/me answers — the money
  // figures show a quiet loading state rather than numbers that look real.
  const [live, setLive] = useState(() => cachedMe() ?? null);
  const loading = !live;
  useEffect(() => {
    if (cachedMe()) return;
    let alive = true;
    void getMe().then((me) => alive && setLive(me));
    return () => {
      alive = false;
    };
  }, []);

  /* `earned`, not `earnings`/`netTotal`: those two are the admin's own books
     (our margin, and the payout carried negative), so they would have shown the
     user the company's cut on a screen labelled "your earnings". The API does
     the sign flip; see miniAppUser in server/admin.mjs. */
  const referralEarnings = live ? live.referral.earned : referralEarningsDefault;
  const cashbackEarnings = live ? live.cashback.earned : cashbackEarningsDefault;
  const totalEarnings = live ? referralEarnings + cashbackEarnings : totalEarningsDefault;
  /* What is actually withdrawable: lifetime earnings minus what has already
     been taken out. Showing lifetime here would let someone try to withdraw
     money they have already withdrawn. */
  const withdrawable = live ? live.wallet.balance : availableBalance;

  // 0/0 is NaN, which rendered "NaN%" on a fresh account.
  const referralPct = totalEarnings ? Math.round((referralEarnings / totalEarnings) * 100) : 0;
  const cashbackPct = totalEarnings ? 100 - referralPct : 0;

  /* The figures render at their real value; only the change animates — a green
     +N chip for whatever came in since this device last looked. Same treatment
     as the referral card. There is no chip on a first visit (no baseline to
     difference against), which is also what frame 1367:5166 shows. */
  const balance = useSeenValue('earning.balance', withdrawable);

  const [historyOpen, setHistoryOpen] = useState(initialSheet === 'history');
  /* Live withdrawal history for the sheet; `undefined` keeps the sheet's
     built-in demo rows (the pixel-harness deep-link has no server). */
  const [withdrawals, setWithdrawals] = useState<WithdrawRecord[]>();
  useEffect(() => {
    if (!historyOpen) return;
    let alive = true;
    getWithdrawals()
      .then((rows) => {
        if (!alive) return;
        setWithdrawals(rows.map((w) => ({
          id: w.id,
          symbol: w.currency,
          network: w.network,
          status: w.status,
          amount: w.amount,
          date: new Date(w.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
          time: new Date(w.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          to: w.address.length > 16 ? `${w.address.slice(0, 8)}...${w.address.slice(-6)}` : w.address,
        })));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [historyOpen]);

  /* The chart's real series, once /api/me/earnings-weekly answers. Stays
     undefined (flatSeries fallback) on a fresh mount and on a failed fetch —
     same "don't invent history" treatment flatSeries itself already carries. */
  const [weekly, setWeekly] = useState<WeeklyEarnings[]>();
  useEffect(() => {
    let alive = true;
    getEarningsWeekly().then((weeks) => alive && setWeekly(weeks)).catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  /* Real week -> its own date range label once loaded; the fabricated
     "Week N" placeholder until then. */
  const labelFor = (i: number): string => {
    const w = weekly?.[i];
    return w ? new Date(w.start).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : weekLabel(i);
  };

  /* The readout follows the finger, so it only exists while there is one. `?tip`
     pins it open for the pixel harness — frame 1367:5166 captures it mid-drag,
     which is a review state, not the resting one. */
  const [reading, setReading] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('tip'),
  );
  const pinned = OFFSET_0 + Math.round(CURSOR_0 * (WINDOW - 1));
  /* An absolute week index, not a fraction of the plot: the readout only ever
     sits on a real data point, so the state that drives it is that point. A
     fraction also drifted off the points as soon as the brush was resized. */
  const [cursorWeek, setCursorWeek] = useState(pinned);
  const plotRef = useRef<HTMLDivElement>(null);

  // Client review: lifting the finger used to hide the readout immediately —
  // it should stay up until the user scrolls or taps elsewhere. Same
  // dismissal pattern as the "Choose your plan" info callout (Home.tsx,
  // ~line 519): capture phase because the scroll happens on an inner
  // element, not on document. No arming delay is needed here (unlike that
  // callout) — the tooltip is always mounted and only toggles `display`, so
  // showing it doesn't shift layout or fire a scroll of its own.
  useEffect(() => {
    if (!reading) return;
    const close = (e: Event): void => {
      if (!plotRef.current?.contains(e.target as Node)) setReading(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
    };
  }, [reading]);

  const referral = useMemo(
    () => weekly ? weekly.map((w) => w.referral) : flatSeries(referralEarnings),
    [weekly, referralEarnings],
  );
  const cashback = useMemo(
    () => weekly ? weekly.map((w) => w.cashback) : flatSeries(cashbackEarnings),
    [weekly, cashbackEarnings],
  );

  /* The brush is a real range control: drag either handle to resize the window,
     drag the window itself to pan. Both edges are week indices into the series;
     `span` is derived, so the plot re-scales as the range narrows. */
  const [range, setRange] = useState({ from: OFFSET_0, to: OFFSET_0 + WINDOW - 1 });
  const brushRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'from' | 'to' | 'pan'; grabWeek: number; from: number; to: number } | null>(null);

  const offset = range.from;
  const span = range.to - range.from + 1;

  /* The visible slice is the brush's range, not a fixed width. It used to be
     `slice(offset, offset + WINDOW)` plotted over `WINDOW` points, so panning
     worked but resizing did nothing at all: squeezing the handles moved the
     window's edges while the plot kept drawing the same 13 weeks. Both the
     slice and the divisor come off `span` now, so narrowing the brush really
     does zoom into that portion, and widening it to the full strip shows
     everything. */
  const view = (s: number[]) => s.slice(range.from, range.to + 1);
  const shownReferral = view(referral);
  const shownCashback = view(cashback);

  /* The visible window drives the axis, so resizing the brush restretches the
     data over the full plot height instead of leaving it flat against a fixed
     $0..$500. The brush's own mini-chart keeps the whole series' axis — it is
     the overview, and rescaling it as the window moved would make the overview
     move too. */
  const axis = axisFor([...shownReferral, ...shownCashback]);
  const brushAxis = axisFor([...referral, ...cashback]);

  const yAt = (v: number, h: number, ax: Axis) =>
    h - ((Math.min(Math.max(v, ax.bottom), ax.top) - ax.bottom) / (ax.top - ax.bottom)) * h;
  /** Point-to-edge: the first and last weeks sit on the plot's own edges. */
  const xAt = (i: number, n: number, w: number) => (n > 1 ? (i / (n - 1)) * w : w / 2);

  const path = (pts: number[], w: number, h: number, ax: Axis) => {
    // No data: a flat line along the baseline rather than nothing at all.
    if (pts.length === 0) return `M 0 ${h.toFixed(1)} L ${w.toFixed(1)} ${h.toFixed(1)}`;
    if (pts.length === 1) {
      const y = yAt(pts[0], h, ax).toFixed(1);
      return `M 0 ${y} L ${w.toFixed(1)} ${y}`;
    }
    return pts
      .map((v, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i, pts.length, w).toFixed(1)} ${yAt(v, h, ax).toFixed(1)}`)
      .join(' ');
  };

  /* The crosshair lands on weeks, never between them — there is no data in the
     gaps for it to report. One haptic tick per week crossed, keyed on the week
     itself rather than the pointer event, or a single swipe would fire dozens
     of times and buzz continuously instead of ticking. */
  const lastWeek = useRef(-1);
  const track = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const week = range.from + Math.round(t * (span - 1));
    setCursorWeek(week);
    if (week !== lastWeek.current) {
      lastWeek.current = week;
      haptic('light');
    }
  };

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

  /* A brush resize can leave the cursor outside the window; clamp rather than
     reset, so the readout stays on the nearest week it can still show. */
  const week = Math.min(Math.max(cursorWeek, range.from), range.to);
  const cursorX = xAt(week - range.from, span, PLOT_W);
  /* The readout never covers the point it is reporting: it takes whichever side
     of the point it fits on, flipping once the point runs out of room on the
     right. TIP_W <= (PLOT_W - 2 x TIP_GAP) / 2, so one of the two always fits. */
  const tipLeft = cursorX + TIP_GAP + TIP_W <= PLOT_W ? cursorX + TIP_GAP : cursorX - TIP_GAP - TIP_W;

  return (
    <div className="scr-earn">
      {/* ---- balance card ---------------------------------------------- */}
      <section className="scr-earn-card">
        <div className="scr-earn-summary">
          <h1 className="scr-earn-balance-label">Available balance</h1>
          <div className="scr-earn-balance-row">
            <span className="scr-earn-balance-value">{loading ? '—' : money(withdrawable)}</span>
            {!loading && balance.delta > 0 ? (
              <span className="scr-earn-balance-delta">
                <Icon name="arrow-up" size={16} />
                {money(balance.delta)}
              </span>
            ) : null}
            <span className="scr-earn-total">
              <span className="scr-earn-total-value">{loading ? '—' : money(totalEarnings)}</span>
              <span className="scr-earn-total-label">Total earnings</span>
            </span>
          </div>

          <hr className="scr-earn-rule" />

          <h2 className="scr-earn-breakdown-title">Earnings breakdown</h2>

          <div
            className="scr-earn-bar"
            role="img"
            aria-label={!loading && totalEarnings <= 0 ? 'No earnings yet' : `Referral ${referralPct}%, cashback ${cashbackPct}%`}
          >
            {!loading && totalEarnings <= 0 ? (
              <span className="scr-earn-bar-empty">No earnings yet</span>
            ) : null}
            {referralPct > 0 ? (
              <span className="scr-earn-bar-seg scr-earn-bar-seg--referral" style={{ flexBasis: `${referralPct}%` }}>
                <span>{referralPct}%</span>
              </span>
            ) : null}
            {cashbackPct > 0 ? (
              <span className="scr-earn-bar-seg scr-earn-bar-seg--cashback" style={{ flexBasis: `${cashbackPct}%` }}>
                <span>{cashbackPct}%</span>
              </span>
            ) : null}
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
                  <span className="scr-earn-legend-value">{loading ? '—' : money(l.value)}</span>
                  <span className="scr-earn-legend-sep" />
                  <span className="scr-earn-legend-value">{loading ? '—' : `${l.pct}%`}</span>
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
            iconRight={<Icon name="chevron-right" size={20} />}
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
          {labelFor(offset)}
          <span className="scr-earn-range-sep">–</span>
          {labelFor(range.to)}
        </p>

        <div className="scr-earn-plot-wrap">
          <div className="scr-earn-grid">
            {Array.from({ length: GRID_LINES }, (_, i) => axis.top - i * axis.step).map((g) => (
              <div key={g} className="scr-earn-grid-row">
                <span className="scr-earn-grid-label">{axisLabel(g)}</span>
              </div>
            ))}
          </div>

          <div
            className="scr-earn-plot"
            ref={plotRef}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              setReading(true);
              track(e);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e);
            }}
          >
            <svg viewBox={`0 0 ${PLOT_W} ${PLOT_H}`} fill="none" preserveAspectRatio="none">
              {[
                { pts: shownReferral, color: REFERRAL_COLOR },
                { pts: shownCashback, color: CASHBACK_COLOR },
              ].map((s) => (
                <g key={s.color}>
                  <path d={path(s.pts, PLOT_W, PLOT_H, axis)} stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
                  {/* Only the week being read carries a dot. A dot on every
                      week competed with the crosshair for "you are here" and
                      left the line looking beaded; the reading is what the
                      operator is pointing at, so it is the only marked point. */}
                  {reading && s.pts[week - range.from] !== undefined && (
                    <circle
                      cx={xAt(week - range.from, s.pts.length, PLOT_W)}
                      cy={yAt(s.pts[week - range.from], PLOT_H, axis)}
                      r={4}
                      fill={s.color}
                      stroke="#fff"
                      strokeWidth={2}
                    />
                  )}
                </g>
              ))}
            </svg>
          </div>

          {reading ? <span className="scr-earn-crosshair" style={{ left: `${cursorX}px` }} /> : null}

          <div
            className="scr-earn-tooltip"
            style={{ left: `${tipLeft}px`, display: reading ? undefined : 'none' }}
          >
            <span className="scr-earn-tooltip-date">{labelFor(week)}</span>
            <span className="scr-earn-tooltip-row">
              <span className="scr-earn-legend-left">
                <span className="scr-earn-dot scr-earn-dot--referral" />
                <span className="scr-earn-tooltip-label">Referral</span>
              </span>
              <span className="scr-earn-tooltip-value">{money(referral[week] ?? 0)}</span>
            </span>
            <span className="scr-earn-tooltip-row">
              <span className="scr-earn-legend-left">
                <span className="scr-earn-dot scr-earn-dot--cashback" />
                <span className="scr-earn-tooltip-label">Cashback</span>
              </span>
              <span className="scr-earn-tooltip-value">{money(cashback[week] ?? 0)}</span>
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
            <path d={path(referral, PLOT_W, 32, brushAxis)} stroke={REFERRAL_COLOR} strokeWidth={2} strokeLinejoin="round" />
            <path d={path(cashback, PLOT_W, 32, brushAxis)} stroke={CASHBACK_COLOR} strokeWidth={2} strokeLinejoin="round" />
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

      <WithdrawHistorySheet open={historyOpen} records={withdrawals} onClose={() => setHistoryOpen(false)} />

      <NavigationBar active="earning" onChange={onNavigate} className="ds-navbar-floating" />
    </div>
  );
}

export default EarningMain;
