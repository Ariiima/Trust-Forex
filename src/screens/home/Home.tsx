import { Fragment, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { PlanCard } from '../plans/PlanCard';
import { PLANS } from '../plans/plans-data';
import type { Plan } from '../plans/plans-data';
import { PromoCarousel } from './PromoCarousel';
import heroExpiredArt from '../../assets/home/hero-expired.png';
import heroWalletArt from '../../assets/home/hero-wallet.png';
import './Home.css';

/* ---------------------------------------------------------------------------
 * Home — route `/`. Figma nodes 552-3106 (active, canonical) / 552-3107
 * (expired) / 639-4482 (no-subscription). One component, driven by a
 * `subscription` state; only the hero card, the centred promo slide and the
 * "Choose your plan" section (Gold expands in the no-subscription state)
 * change between the three. The Telegram webview header and iOS status bar
 * are chrome, not app content, so they are intentionally not built.
 * ------------------------------------------------------------------------- */

export type Subscription = 'active' | 'expired' | 'none';
type Period = 'Weekly' | 'Monthly' | 'Yearly';

export interface HomeProps {
  /** Which subscription state to show first. Defaults to `active`. */
  initialSubscription?: Subscription;
  /** CTA routing (View plans / Upgrade / Join VIP / Renew / plan tap). */
  onNavigate?: (route: string) => void;
  /** Bottom-nav tab change. */
  onTabChange?: (tab: NavigationTab) => void;
}

/* ---- static data ---------------------------------------------------------- */
const TP_TABS = [
  { id: 'TP1', rr: 'RR 1:0.5' },
  { id: 'TP2', rr: 'RR 1:1' },
  { id: 'TP3', rr: 'RR 1:2' },
  { id: 'TP4', rr: 'RR 1:3' },
] as const;

const PERIODS: Record<Period, { overview: string; date: string }> = {
  Weekly: { overview: 'Last 4 weeks overview', date: 'August · Week 1' },
  Monthly: { overview: 'Last 3 months overview', date: 'September 2026' },
  Yearly: { overview: 'Last 12 months overview', date: 'Q1 2026' },
};

const PROMO_START: Record<Subscription, number> = { active: 1, expired: 2, none: 0 };


// Signal-performance area chart — synthesised to match the render's silhouette
// (exact vector not exported from Figma): high mid baseline, twin peaks at
// ~31%/40% width, crosshair x=155, trough at ~76%, late rebound bump at ~82%.
const CHART_LINE =
  'M 0 100 L 8 96 L 16 102 L 24 94 L 32 99 L 40 92 L 48 96 L 56 88 L 64 92 L 72 84 L 80 74 L 86 64 L 92 52 L 98 62 L 104 68 L 110 52 L 118 42 L 126 50 L 134 56 L 141 52 L 148 53 L 155 56 L 164 62 L 172 74 L 180 80 L 188 78 L 196 90 L 204 96 L 212 94 L 220 104 L 228 110 L 236 92 L 243 72 L 250 80 L 258 92 L 266 96 L 274 88 L 282 92 L 290 86 L 296 88';
const CHART_AREA = `${CHART_LINE} L 296 164 L 0 164 Z`;
const CHART_PEAK_X = 155; // px within the 296-wide plot (XML crosshair x)
const CHART_W = 296; // svg is a fixed 296x164 box, so viewBox units are px
const CHART_TOP = 56; // .scr-home-chart is 220 tall, svg sits flush to the bottom

// "M 0 100 L 8 96 ..." -> [[0,100],[8,96],...]; the drawn curve IS the dataset.
const CHART_POINTS: readonly (readonly [number, number])[] = (CHART_LINE.match(/[\d.]+ [\d.]+/g) ?? []).map(
  (p) => p.split(' ').map(Number) as [number, number],
);

/** Height of the curve at plot x, linearly interpolated between vertices. */
function chartYAt(x: number): number {
  const pts = CHART_POINTS;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    if (x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0 || 1);
  }
  return pts[pts.length - 1][1];
}

/* ponytail: no real time-series behind the chart, so the readout is derived
   from the curve itself — y is inverted (lower pixel = better). Swap this for
   the API series once /api/signals exists; the drag handling stays as-is. */
function chartReadout(x: number) {
  const y = chartYAt(x);
  const strength = Math.max(0, Math.min(1, (164 - y) / 140));
  const signals = Math.round(18 + strength * 34);
  const rate = 38 + strength * 44;
  return { signals, tp1: Math.round((signals * rate) / 100), rate: rate.toFixed(1) };
}

/* ===========================================================================
 * Countdown ring — SVG semicircle gauge, green arc via stroke-dasharray.
 * The exact filled-crescent geometry isn't derivable, so the green fraction
 * is tuned to match the render (~0.66 of the 180° arc).
 * ========================================================================= */
function CountdownRing({ days }: { days: number }): ReactNode {
  // Arc vector is 224×112 in a 232×112 box (x4..228 incl the 16px stroke)
  // → path radius 104 centred at (116,104); round caps close flush at y112.
  const len = Math.PI * 104; // arc length of the semicircle
  const green = len * 0.66;
  return (
    <div className="scr-home-ring">
      <svg viewBox="0 0 232 112" fill="none">
        <path
          d="M 12 104 A 104 104 0 0 1 220 104"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        <path
          d="M 12 104 A 104 104 0 0 1 220 104"
          stroke="#48D48A"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${green} ${len}`}
        />
      </svg>
      <div className="scr-home-ring-center">
        <span className="scr-home-ring-num">{days}</span>
        <span className="scr-home-ring-sub">Days left</span>
      </div>
    </div>
  );
}

/* ---- hero: active --------------------------------------------------------- */
function HeroActive({ onNavigate }: { onNavigate?: (r: string) => void }): ReactNode {
  return (
    <section className="scr-home-hero scr-home-hero--active">
      <div className="scr-home-hero-top">
        <div className="scr-home-ringbox">
          <CountdownRing days={22} />
        </div>

        <div className="scr-home-status">
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Subscription status</span>
            <span className="scr-home-pill">
              <Icon name="check" size={16} strokeWidth={1.75} />
              Active
            </span>
          </div>
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Current plan</span>
            <span className="scr-home-status-plan">
              <b>Silver</b>
              <span>/ 1 Month</span>
            </span>
          </div>
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Expires on</span>
            <span className="scr-home-status-value">Aug 24,2026</span>
          </div>
        </div>
      </div>

      <div className="scr-home-hero-buttons">
        <button type="button" className="scr-home-herobtn scr-home-herobtn--solid" onClick={() => onNavigate?.('vip-channel')}>
          Join VIP channel
        </button>
        <button type="button" className="scr-home-herobtn scr-home-herobtn--ghost" onClick={() => onNavigate?.('plans')}>
          Upgrade
        </button>
      </div>
    </section>
  );
}

/* ---- hero: expired / none ------------------------------------------------- */
function HeroMessage({
  art,
  title,
  subtitle,
  ctaLabel,
  note,
  onCta,
}: {
  art: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  note?: string;
  onCta?: () => void;
}): ReactNode {
  return (
    <section className="scr-home-hero scr-home-hero--message">
      <div className="scr-home-hero-message-top">
        <img className="scr-home-hero-art" src={art} alt="" width={140} height={140} />
        <div className="scr-home-hero-copy">
          <span className="scr-home-hero-title">{title}</span>
          <span className="scr-home-hero-subtitle">{subtitle}</span>
        </div>
      </div>
      <div className="scr-home-hero-bottom">
        <button type="button" className="scr-home-herobtn scr-home-herobtn--full" onClick={onCta}>
          {ctaLabel}
        </button>
        {note ? <span className="scr-home-hero-note">{note}</span> : null}
      </div>
    </section>
  );
}

/* ---- signal performance --------------------------------------------------- */
function SignalCard(): ReactNode {
  const [tp, setTp] = useState<string>('TP1');
  const [period, setPeriod] = useState<Period>('Monthly');
  const cfg = PERIODS[period];

  // Draggable crosshair (tweaks.md: "charts work via dragging the handle").
  const [chartX, setChartX] = useState(CHART_PEAK_X);
  const plotRef = useRef<HTMLDivElement>(null);
  const readout = chartReadout(chartX);

  const trackPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((e.clientX - rect.left) / rect.width) * CHART_W;
    setChartX(Math.max(0, Math.min(CHART_W, x)));
  };

  return (
    <section className="scr-home-card scr-home-signal">
      <div className="scr-home-signal-head">
        <h2 className="scr-home-card-title">Signal performance</h2>
        <div className="scr-home-tp">
          {TP_TABS.map((t, i) => (
            <Fragment key={t.id}>
              {i > 0 ? <span className="scr-home-tp-div" /> : null}
              <button
                type="button"
                className={'scr-home-tp-btn' + (t.id === tp ? ' scr-home-tp-btn--on' : '')}
                onClick={() => setTp(t.id)}
              >
                <span className="scr-home-tp-name">{t.id}</span>
                <span className="scr-home-tp-rr">{t.rr}</span>
              </button>
            </Fragment>
          ))}
        </div>
      </div>

      <div className="scr-home-overview">
        <span className="scr-home-overview-title">• {cfg.overview}</span>
        <div className="scr-home-overview-stats">
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">Total signals</span>
            <span className="scr-home-stat-value">80</span>
          </div>
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">TP1 reached</span>
            <span className="scr-home-stat-value">50</span>
          </div>
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">TP1 hit rate</span>
            <span className="scr-home-stat-value scr-home-stat-value--success">62.0%</span>
          </div>
        </div>
      </div>

      <div
        className="scr-home-chart"
        ref={plotRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          trackPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) trackPointer(e);
        }}
      >
        <svg className="scr-home-chart-svg" viewBox="0 0 296 164" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="scr-home-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#144CCD" stopOpacity="0.33" />
              <stop offset="1" stopColor="#144CCD" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={CHART_AREA} fill="url(#scr-home-chart-fill)" />
          <path d={CHART_LINE} stroke="#144CCD" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        <span className="scr-home-chart-crosshair" style={{ left: `${chartX}px` }} />
        <span
          className="scr-home-chart-marker"
          style={{ left: `${chartX}px`, top: CHART_TOP + chartYAt(chartX) }}
        />
        <div className="scr-home-tooltip" style={{ left: `${chartX}px` }}>
          <span className="scr-home-tooltip-date">{cfg.date}</span>
          <div className="scr-home-tooltip-row">
            <span>Signals</span>
            <span>{readout.signals}</span>
          </div>
          <div className="scr-home-tooltip-row">
            <span>TP1 reached</span>
            <span>{readout.tp1}</span>
          </div>
          <div className="scr-home-tooltip-row scr-home-tooltip-row--success">
            <span>TP1 hit rate</span>
            <span>{readout.rate}%</span>
          </div>
        </div>
      </div>

      <div className="scr-home-period">
        {(Object.keys(PERIODS) as Period[]).map((p) => (
          <button
            key={p}
            type="button"
            className={'scr-home-period-btn' + (p === period ? ' scr-home-period-btn--on' : '')}
            onClick={() => setPeriod(p)}
          >
            {p}
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---- compact plan row (Choose your plan) ---------------------------------- */
function PlanRow({ plan, onClick }: { plan: Plan; onClick?: () => void }): ReactNode {
  return (
    <button type="button" className="scr-home-planrow" onClick={onClick}>
      <img className="scr-home-planrow-badge" src={plan.badge} alt="" width={56} height={56} />
      <span className="scr-home-planrow-text">
        <span className="scr-home-planrow-namerow">
          <span className="scr-home-planrow-name">{plan.name}</span>
          {plan.tag ? <span className={`scr-home-tag scr-home-tag--${plan.tag.variant}`}>{plan.tag.label}</span> : null}
        </span>
        <span className="scr-home-planrow-pricerow">
          <Icon name="currency-dollar" size={20} strokeWidth={1.7} />
          <span className="scr-home-planrow-price">{plan.price}</span>
          <span className="scr-home-planrow-duration">/ {plan.duration}</span>
        </span>
      </span>
    </button>
  );
}

/* ---- choose your plan ----------------------------------------------------- */
function ChoosePlanSection({
  subscription,
  onNavigate,
}: {
  subscription: Subscription;
  onNavigate?: (r: string) => void;
}): ReactNode {
  const [tipOpen, setTipOpen] = useState(false);

  return (
    <section className="scr-home-card scr-home-plans">
      <div className="scr-home-plans-head">
        <h2 className="scr-home-card-title">Choose your plan</h2>
        <button
          type="button"
          className="scr-home-info"
          aria-label="Plan info"
          onClick={() => setTipOpen((v) => !v)}
        >
          <Icon name="info" size={20} strokeWidth={1.5} />
        </button>
      </div>

      {tipOpen ? (
        <div className="scr-home-infotip" role="tooltip">
          Longer subscriptions include greater savings and higher benefit rates
        </div>
      ) : null}

      {PLANS.map((plan) =>
        subscription === 'none' && plan.id === 'gold' ? (
          <PlanCard key={plan.id} plan={plan} variant="full" onContinue={() => onNavigate?.('checkout')} />
        ) : (
          <PlanRow key={plan.id} plan={plan} onClick={() => onNavigate?.('plans')} />
        ),
      )}
    </section>
  );
}

/* ===========================================================================
 * Home
 * ========================================================================= */
export default function Home({ initialSubscription = 'active', onNavigate, onTabChange }: HomeProps): ReactNode {
  const [subscription, setSubscription] = useState<Subscription>(initialSubscription);

  return (
    <div className="scr-home">
      {/* dev-only switcher so all three states are reachable in review */}
      {import.meta.env.DEV && (
        <div className="scr-home-switcher" role="group" aria-label="Subscription state">
          {(['active', 'expired', 'none'] as Subscription[]).map((s) => (
            <button key={s} type="button" data-on={subscription === s} onClick={() => setSubscription(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {subscription === 'active' ? (
        <HeroActive onNavigate={onNavigate} />
      ) : subscription === 'expired' ? (
        <HeroMessage
          art={heroExpiredArt}
          title="Your subscription has expired"
          subtitle="Regain VIP signal access and enjoy your member benefits again."
          ctaLabel="Renew subscription"
          note="Expired on Aug 24, 2025"
          onCta={() => onNavigate?.('plans')}
        />
      ) : (
        <HeroMessage
          art={heroWalletArt}
          title="No active subscription"
          subtitle="Choose a plan to join the VIP signal channel and unlock additional member benefits"
          ctaLabel="View plans"
          onCta={() => onNavigate?.('plans')}
        />
      )}

      <PromoCarousel start={PROMO_START[subscription]} />

      <SignalCard />

      <ChoosePlanSection subscription={subscription} onNavigate={onNavigate} />

      <div className="scr-home-navbar">
        <NavigationBar active="home" onChange={onTabChange} />
      </div>
    </div>
  );
}
