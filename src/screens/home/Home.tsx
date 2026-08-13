import { Fragment, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatedEmoji, Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { PlanCard } from '../plans/PlanCard';
import { PLANS } from '../plans/plans-data';
import type { Plan } from '../plans/plans-data';
import { PromoCarousel } from './PromoCarousel';
import { bucketsFor, PERIODS, OVERVIEW } from './signal-buckets';
import type { Period } from './signal-buckets';
import { haptic } from '../../design-system/useCountUp';
import { getTg } from '../../telegram';
import { cachedMe, cachedSignals, getMe, getSignals, joinGroup, type MeSubscription, type SignalResult } from '../../api/client';
import heroExpiredArt from '../../assets/emoji/home-expired.json?url';
import heroNoSubArt from '../../assets/emoji/home.json?url';
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

export interface HomeProps {
  /** Which subscription state to show first. Defaults to `active`. */
  initialSubscription?: Subscription;
  /** CTA routing (View plans / Upgrade / Join VIP / Renew / plan tap). */
  onNavigate?: (route: string) => void;
  /** Bottom-nav tab change. */
  onTabChange?: (tab: NavigationTab) => void;
}

/**
 * Ask the server for a one-person invite to the VIP group and open it.
 *
 * Not a fixed t.me link: a shared link is a free subscription. The server
 * issues a single-use invite that expires with the subscription, and refuses
 * outright if the subscription is not live.
 */
async function openVipChannel(): Promise<void> {
  const { link } = await joinGroup().catch(() => ({ link: undefined }));
  if (!link) return;
  const tg = getTg();
  if (tg?.openTelegramLink) tg.openTelegramLink(link);
  else window.open(link, '_blank');
}

/* ---- static data ---------------------------------------------------------- */
const TP_TABS = [
  { id: 'TP1', rr: 'RR 1:0.5' },
  { id: 'TP2', rr: 'RR 1:1' },
  { id: 'TP3', rr: 'RR 1:2' },
  { id: 'TP4', rr: 'RR 1:3' },
] as const;


const PROMO_START: Record<Subscription, number> = { active: 1, expired: 2, none: 0 };


const CHART_PEAK_X = 155; // px within the 296-wide plot — default crosshair position
const CHART_W = 296; // svg is a fixed 296x164 box, so viewBox units are px
const CHART_TOP = 40; // .scr-home-chart is 204 tall, svg (164) sits flush to the bottom
const TIP_GAP = 8;
const TIP_W = 124; // .scr-home-tooltip

/** x of point i of n — point-to-edge across the plot. */
const chartXAt = (i: number, n: number) => (n > 1 ? (i / (n - 1)) * CHART_W : CHART_W / 2);

const CHART_H = 164;
/* Hit rate -> plot height, on a fixed 0..100% axis with room for the marker's
   radius at either end. Fixed, not fitted to the visible range: the three tiles
   directly above the chart report these same percentages, and an axis that
   restretched per tab would draw the same 62% week as a peak in one and a
   trough in the next. */
const CHART_PAD = 12;
const yForRate = (rate: number) =>
  CHART_H - CHART_PAD - (Math.max(0, Math.min(100, rate)) / 100) * (CHART_H - 2 * CHART_PAD);

/* ===========================================================================
 * Countdown ring — SVG arc gauge, green portion via stroke-dasharray.
 *
 * Geometry measured off the frame: the track's outer edge spans x64..287 and
 * y56..167 inside a ring box whose content starts at (64,56), so the centre
 * line has r=103.5 about (115.5, 111.5) with the 16px stroke reaching exactly
 * the box's top edge. It is NOT a half circle: the ends stop 8 above the
 * centre line (the frame's stroke tapers away over rows 160-167 rather than
 * ending full-width), so the round caps close flush on the bottom edge.
 *
 * This used r=104 about (116,104), which put the outer edge of the apex 8px
 * ABOVE the viewBox and clipped the top of the arc flat.
 * ========================================================================= */
const R = 103.5;
const CY = 111.5;
const CAP = 8; // half the 16px stroke
const END_Y = CY - CAP;
const END_DX = Math.sqrt(R * R - CAP * CAP);
const ARC = `M ${(116 - END_DX).toFixed(2)} ${END_Y} A ${R} ${R} 0 0 1 ${(116 + END_DX).toFixed(2)} ${END_Y}`;

function CountdownRing({ days, totalDays }: { days: number; totalDays: number }): ReactNode {
  const len = R * 2 * Math.asin(END_DX / R); // swept angle x radius
  /* The arc is what is LEFT of the term that was bought — full on day one,
     draining to nothing at expiry. The frame's fixed 0.41 was one sample
     state (green cap at x=156), not a constant. */
  const green = len * Math.min(1, Math.max(0, days / Math.max(1, totalDays)));
  return (
    <div className="scr-home-ring">
      <svg viewBox="0 0 232 112" fill="none">
        <path
          d={ARC}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={16}
          strokeLinecap="round"
        />
        {/* The green sweeps round on arrival. dashoffset animates from the
            segment's own length (fully hidden) to 0, so the arc grows from the
            9 o'clock start rather than fading in place. */}
        <path
          className="scr-home-ring-fill"
          d={ARC}
          stroke="#48D48A"
          strokeWidth={16}
          strokeLinecap="round"
          strokeDasharray={`${green} ${len}`}
          style={{ ['--ring-len' as string]: green.toFixed(2) }}
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
/** "1 Month" / "3 Months" — the purchased term, rounded to whole months. */
function termLabel(totalDays: number): string {
  const months = Math.max(1, Math.round(totalDays / 30));
  return `${months} Month${months > 1 ? 's' : ''}`;
}

/** "Aug 24,2026" — the frame's format, no separator space. */
function dateLabel(epochMs: number): string {
  const d = new Date(epochMs);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()},${d.getFullYear()}`;
}

function HeroActive({
  onNavigate,
  subscription,
}: {
  onNavigate?: (r: string) => void;
  subscription: MeSubscription | null;
}): ReactNode {
  // subscription is null only for the beat before /api/me answers — show a
  // quiet loading state rather than numbers that look like a real account.
  const loading = !subscription;
  const days = subscription?.daysLeft ?? 0;
  const totalDays = subscription?.totalDays ?? Math.max(days, 1);
  const plan = subscription?.plan ?? '';
  return (
    <section className="scr-home-hero scr-home-hero--active">
      <div className="scr-home-hero-top">
        <div className="scr-home-ringbox">
          <CountdownRing days={days} totalDays={totalDays} />
        </div>

        <div className="scr-home-status">
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Subscription status</span>
            <span className="scr-home-pill">
              <Icon name="check" size={16} />
              Active
            </span>
          </div>
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Current plan</span>
            <span className="scr-home-status-plan">
              <b>{loading ? '—' : plan[0].toUpperCase() + plan.slice(1)}</b>
              {/* The term actually bought — the frame's "1 Month" was the
                  Silver sample, and read as a lie on a 3-month Gold. */}
              {loading ? null : <span>/ {termLabel(totalDays)}</span>}
            </span>
          </div>
          <div className="scr-home-statusrow">
            <span className="scr-home-status-label">Expires on</span>
            <span className="scr-home-status-value">
              {subscription?.expiresAt ? dateLabel(subscription.expiresAt) : '—'}
            </span>
          </div>
        </div>
      </div>

      <div className="scr-home-hero-buttons">
        <button type="button" className="scr-home-herobtn scr-home-herobtn--solid" onClick={() => { void openVipChannel(); }}>
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
        <AnimatedEmoji className="scr-home-hero-art" src={art} />
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
  const [results, setResults] = useState<SignalResult[]>(() => cachedSignals() ?? []);
  useEffect(() => {
    if (cachedSignals()) return;
    let live = true;
    void getSignals().then((r) => live && setResults(r));
    return () => {
      live = false;
    };
  }, []);

  /* One point per week / month / quarter. The tiles above the chart are NOT
     the plotted buckets summed — they summarise a fixed recent window (4 weeks
     / 3 months / 12 months, OVERVIEW) regardless of how many points the chart
     draws. No published results yet (fresh deploy, or still loading) means an
     empty chart, not a fabricated one. */
  const buckets = results.length ? bucketsFor(results, period, tp) : [];
  const ov = OVERVIEW[period];
  const ovBuckets = (ov.fold === period ? buckets : bucketsFor(results, ov.fold, tp)).slice(-ov.n);
  const totals = ovBuckets.reduce((a, b) => ({ total: a.total + b.total, reached: a.reached + b.reached }), {
    total: 0,
    reached: 0,
  });
  const stats = {
    total: totals.total,
    reached: totals.reached,
    rate: totals.total ? ((totals.reached / totals.total) * 100).toFixed(1) : '0.0',
  };
  const overview = ov.label;

  /* Draggable crosshair (tweaks.md: "charts work via dragging the handle"), but
     it lands on points, never between them — the readout has nothing to say
     about the gaps. State is the point's index, not its x. */
  const points = buckets.map((b) => b.y ?? yForRate(b.rate));
  const [picked, setPicked] = useState(() => Math.round((CHART_PEAK_X / CHART_W) * 11));
  const idx = Math.max(0, Math.min(picked, points.length - 1)); // a shorter period can outrun it
  /* Same rule as the earnings chart: the readout follows the finger, so it only
     exists while there is one. `?tip` pins it open for the pixel harness —
     design/review/ref/home-active.png captures it mid-drag. */
  const [reading, setReading] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('tip'),
  );
  const plotRef = useRef<HTMLDivElement>(null);

  /* The readout survives the finger lifting — it is a reading, not a hover —
     and is dismissed by scrolling or touching anywhere outside the plot, the
     same rule the info callout below uses. */
  useEffect(() => {
    if (!reading) return;
    const close = (e: Event): void => {
      if (plotRef.current?.contains(e.target as Node)) return;
      // Page scrolls only — same carousel problem as the info callout below.
      if (e.type === 'scroll' && !(e.target as Node | null)?.contains?.(plotRef.current)) return;
      setReading(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
    };
  }, [reading]);
  const readout = buckets[idx];

  const line = points
    .map((y, i) => `${i === 0 ? 'M' : 'L'} ${chartXAt(i, points.length).toFixed(1)} ${y.toFixed(1)}`)
    .join(' ');
  const chartX = chartXAt(idx, points.length);
  /* The readout never covers the point it is reporting: it takes whichever side
     of the point it fits on. TIP_W <= (CHART_W - 2 x TIP_GAP) / 2, so one of
     the two always fits. */
  const tipLeft = chartX + TIP_GAP + TIP_W <= CHART_W ? chartX + TIP_GAP : chartX - TIP_GAP - TIP_W;

  /* One haptic tick per point crossed, keyed on the point rather than the
     pointer event — otherwise a single swipe buzzes continuously. */
  const lastVertex = useRef(-1);
  const trackPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = plotRef.current?.getBoundingClientRect();
    if (!rect) return;
    const t = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const i = Math.round(t * (points.length - 1));
    setPicked(i);
    if (i !== lastVertex.current) {
      lastVertex.current = i;
      haptic('light');
    }
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
        <span className="scr-home-overview-title">
          <span className="scr-home-overview-bullet">•</span>
          {overview}
        </span>
        <div className="scr-home-overview-stats">
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">Total signals</span>
            <span className="scr-home-stat-value">{stats.total}</span>
          </div>
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">{tp} reached</span>
            <span className="scr-home-stat-value">{stats.reached}</span>
          </div>
          <div className="scr-home-stat">
            <span className="scr-home-stat-label">{tp} hit rate</span>
            <span className="scr-home-stat-value scr-home-stat-value--success">{stats.rate}%</span>
          </div>
        </div>
      </div>

      <div
        className="scr-home-chart"
        ref={plotRef}
        onPointerDown={(e) => {
          if (!buckets.length) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setReading(true);
          trackPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) trackPointer(e);
        }}
      >
        {!buckets.length && (
          <span className="scr-home-chart-empty">No published results yet</span>
        )}
        <svg className="scr-home-chart-svg" viewBox="0 0 296 164" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="scr-home-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#144CCD" stopOpacity="0.33" />
              <stop offset="1" stopColor="#144CCD" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L ${CHART_W} 164 L 0 164 Z`} fill="url(#scr-home-chart-fill)" />
          <path d={line} stroke="#144CCD" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
          {/* No dot per point: same rule as the earnings chart — a dot on every
              bucket competed with the crosshair for "you are here" and left the
              line beaded. The point being read carries the only marker, and it
              is .scr-home-chart-marker below. */}
        </svg>
        {reading ? (
          <>
            <span className="scr-home-chart-crosshair" style={{ left: `${chartX}px` }} />
            <span
              className="scr-home-chart-marker"
              style={{ left: `${chartX}px`, top: CHART_TOP + points[idx] }}
            />
          </>
        ) : null}
        <div className="scr-home-tooltip" style={{ left: `${tipLeft}px`, display: reading ? undefined : 'none' }}>
          <span className="scr-home-tooltip-date">{readout?.label}</span>
          <div className="scr-home-tooltip-row">
            <span>Signals</span>
            <span>{readout?.total ?? 0}</span>
          </div>
          {/* The rows name the selected level. They said TP1 whichever tab was
              on, while reporting that tab's counts. */}
          <div className="scr-home-tooltip-row">
            <span>{tp} reached</span>
            <span>{readout?.reached ?? 0}</span>
          </div>
          <div className="scr-home-tooltip-row scr-home-tooltip-row--success">
            <span>{tp} hit rate</span>
            <span>{(readout?.rate ?? 0).toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="scr-home-period">
        {PERIODS.map((p) => (
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
          <span className="scr-home-planrow-price">
            <span className="scr-home-planrow-currency">$</span>
            {plan.price}
          </span>
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
  // ?tip opens it on load — design/review/ref/home-active.png captures this
  // frame with the callout showing.
  const [tipOpen, setTipOpen] = useState(
    () => import.meta.env.DEV && new URLSearchParams(window.location.search).has('tip'),
  );

  /* Picking a plan expands it in place rather than navigating: the row becomes
     the full card, and only its Continue button leaves the screen. The
     no-subscription frame opens with Gold already expanded, which is now just
     the initial selection rather than a special case in the render. */
  const [selected, setSelected] = useState<string | null>(
    subscription === 'none' ? 'gold' : null,
  );

  // Any scroll or tap outside the info button dismisses the callout. Capture
  // phase because the scroll happens on an inner element, not on document.
  const infoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!tipOpen) return;
    const close = (e: Event): void => {
      if (infoRef.current?.contains(e.target as Node)) return;
      /* Only a scroll of the PAGE dismisses. `scroll` does not bubble, but a
         capture-phase listener on document still sees every inner scroller —
         and the promo carousel below auto-advances on a dwell timer, so its
         horizontal scrollTo was closing this callout ~2s after it opened with
         nobody having touched anything. */
      if (e.type === 'scroll' && !(e.target as Node | null)?.contains?.(infoRef.current)) return;
      setTipOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    // Armed a beat late: inserting the callout shifts the page, and that shift
    // fires a scroll of its own that would close it again on the spot.
    const arm = setTimeout(() => document.addEventListener('scroll', close, true), 150);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
    };
  }, [tipOpen]);

  return (
    <section className="scr-home-card scr-home-plans">
      <div className="scr-home-plans-head">
        <h2 className="scr-home-card-title">Choose your plan</h2>
        <button
          type="button"
          ref={infoRef}
          className="ds-info-btn"
          aria-label="Plan info"
          onClick={() => setTipOpen((v) => !v)}
        >
          <Icon name="info" size={20} />
        </button>
      </div>

      {tipOpen ? (
        <div className="scr-home-infotip" role="tooltip">
          Longer subscriptions include greater savings and higher benefit rates
        </div>
      ) : null}

      {PLANS.map((plan) =>
        selected === plan.id ? (
          <PlanCard
            key={plan.id}
            plan={plan}
            variant="full"
            /* It is expanded because it is the picked one, so it carries the
               blue border — any tier, not just whichever one plans-data
               happens to flag as highlighted. */
            selected
            className="scr-home-plan-expanded"
            onContinue={() => onNavigate?.(`checkout?plan=${plan.id}`)}
          />
        ) : (
          <PlanRow key={plan.id} plan={plan} onClick={() => setSelected(plan.id)} />
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

  /* Which hero shows is the server's answer, not a prop — `initialSubscription`
     stays as the fallback (and as what the review harness pins). Same pattern as
     PromoCarousel: render the static state now, correct it when /api/me lands. */
  const [me, setMe] = useState(cachedMe);
  useEffect(() => {
    if (cachedMe()) return;
    let live = true;
    void getMe().then((m) => live && setMe(m));
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    const status = me?.subscription?.status;
    if (status === 'active' || status === 'expired') setSubscription(status);
    else if (me && !me.subscription) setSubscription('none');
  }, [me]);

  return (
    <div className="scr-home">
      {/* Review-only switcher so all three states are reachable. Gated on
          ?switcher rather than DEV: it overlays the hero, which made the dev
          server useless for pixel-diffing home. */}
      {import.meta.env.DEV && new URLSearchParams(window.location.search).has('switcher') && (
        <div className="scr-home-switcher" role="group" aria-label="Subscription state">
          {(['active', 'expired', 'none'] as Subscription[]).map((s) => (
            <button key={s} type="button" data-on={subscription === s} onClick={() => setSubscription(s)}>
              {s}
            </button>
          ))}
        </div>
      )}

      {subscription === 'active' ? (
        <HeroActive onNavigate={onNavigate} subscription={me?.subscription ?? null} />
      ) : subscription === 'expired' ? (
        <HeroMessage
          art={heroExpiredArt}
          title="Your subscription has expired"
          subtitle="Regain VIP signal access and enjoy your member benefits again."
          ctaLabel="Renew subscription"
          note={me?.subscription?.expiresAt ? `Expired on ${dateLabel(me.subscription.expiresAt)}` : undefined}
          onCta={() => onNavigate?.('plans')}
        />
      ) : (
        <HeroMessage
          art={heroNoSubArt}
          title="No active subscription"
          subtitle="Choose a plan to join the VIP signal channel and unlock additional member benefits"
          ctaLabel="View plans"
          onCta={() => onNavigate?.('plans')}
        />
      )}

      <PromoCarousel start={PROMO_START[subscription]} section="subscription" />

      <SignalCard />

      <ChoosePlanSection subscription={subscription} onNavigate={onNavigate} />

      <NavigationBar active="home" onChange={onTabChange} className="ds-navbar-floating" />
    </div>
  );
}
