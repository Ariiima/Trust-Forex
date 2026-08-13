import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { CashbackOverview, BrokerState, NavigationBar, Icon } from '../../design-system/components';
import type { NavigationTab, BrokerStateVariant, CashbackPlan } from '../../design-system/components';
import { BROKER_INFO, OVERVIEW, type BrokerId, type BrokerBanner } from './brokers-data';
import { AboutCashbackSheet } from './AboutCashbackSheet';
import { CashbackHistorySheet } from './CashbackHistorySheet';
import { PromoCarousel } from '../home/PromoCarousel';
import { cachedMe, getMe, cachedBrokers, getBrokers } from '../../api/client';
import type { ApiBroker, Me, MeBrokerLink } from '../../api/client';
import './Cashback.css';

/* Status-banner icon per Figma "Notification" variant (1316:8158). `pending`
 * ("in progress") has no icon in the DS Icon set, so it's a small local arc.
 * It spins — "verification in progress" claiming to be in progress while
 * sitting perfectly still reads as a stuck screen. The pixel harness captures
 * with reduced motion, where the CSS parks it at 0deg, so the reference frame
 * still matches. */
function PendingGlyph(): ReactNode {
  return (
    <svg className="scr-cashback-spinner" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

const BANNER_ICON: Record<BrokerBanner['variant'], ReactNode> = {
  error: <Icon name="close" size={16} />,
  success: <Icon name="check" size={16} />,
  pending: <PendingGlyph />,
};

/** How long a self-dismissing status banner stays up, bar included. */
const BANNER_MS = 5000;

/* Same behaviour as the DS Notification's autoDismiss — the outcome banners
   drain a bar and go — but written out here because these live inside the
   broker card's <button>, whose content model is phrasing only. `pending` is
   an ongoing state rather than news, so it stays until the state changes; so
   does `error`, which the user still has to act on. */
function StatusBanner({ banner }: { banner: BrokerBanner }): ReactNode {
  const transient = banner.variant === 'success';
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (!transient) return;
    const t = window.setTimeout(() => setGone(true), BANNER_MS);
    return () => window.clearTimeout(t);
  }, [transient]);

  if (gone) return null;
  return (
    <span
      className={`scr-cashback-broker-banner scr-cashback-broker-banner--${banner.variant}`}
      style={{ ['--banner-ms' as string]: `${BANNER_MS}ms` }}
    >
      {BANNER_ICON[banner.variant]}
      {banner.title}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * Partner-broker list — merges the admin's broker catalogue (getBrokers)
 * with the signed-in user's per-broker link state (getMe().brokers), matched
 * on brokerId. Both sources are reduced to this one shape so the render loop
 * below never has to know which one it's looking at. The list stays empty
 * until getBrokers() actually answers — no invented cards for the pre-fetch
 * beat.
 * ------------------------------------------------------------------------- */

interface BrokerCard {
  id: BrokerId;
  key: string;
  name: string;
  logo: string;
  popular: boolean;
  popularLabel: string;
  state: BrokerStateVariant;
  stateLabel?: string;
  stateCaption?: string;
  totalEarned?: string;
  banners: readonly BrokerBanner[];
}

// BrokerState only models no-account/waiting-for-deposit/cashback-active —
// a link's 'pending' (submitted, awaiting review) and 'rejected' states both
// read as "no account yet", same as 850:2053's own pending/rejected XM cards.
const STATE_COPY: Record<BrokerStateVariant, { label: string; caption: string }> = {
  'no-account': { label: 'No linked account', caption: 'Create an account to start earning cashback.' },
  'waiting-for-deposit': { label: 'Deposit required', caption: 'Make your first deposit to activate cashback.' },
  'cashback-active': { label: 'Cashback active', caption: 'Total earned :' },
};

function stateFor(linkState: MeBrokerLink['state'] | undefined): BrokerStateVariant {
  return linkState === 'waiting-for-deposit' || linkState === 'cashback-active' ? linkState : 'no-account';
}

function bannerFor(linkState: MeBrokerLink['state'] | undefined): BrokerBanner | undefined {
  switch (linkState) {
    case 'rejected':
      return { variant: 'error', title: 'Account verification failed' };
    case 'pending':
      return { variant: 'pending', title: 'Verification in progres' }; // sic — 850:2053's own copy
    case 'waiting-for-deposit':
      return { variant: 'success', title: 'Account verified' };
    case 'cashback-active':
      return { variant: 'success', title: 'Deposit confirmed' };
    default:
      return undefined;
  }
}

function liveCards(brokers: readonly ApiBroker[], me: Me | null): readonly BrokerCard[] {
  const links = new Map((me?.brokers ?? []).map((l) => [l.brokerId, l]));
  return brokers.map((b) => {
    const link = links.get(b.id);
    const state = stateFor(link?.state);
    const banner = bannerFor(link?.state);
    return {
      id: b.id,
      key: b.id,
      name: b.preview?.name ?? b.name,
      // preview.logoName is a filename, not a URL — no asset pipeline for it,
      // so this keeps using the bundled crops, falling back to XM's for any
      // catalogue id that isn't one of the three shipped logos.
      logo: BROKER_INFO[b.id]?.logo ?? BROKER_INFO.xm.logo,
      popular: b.preview?.badgeOn ?? false,
      popularLabel: b.preview?.badgeText ?? 'Popular',
      state,
      stateLabel: STATE_COPY[state].label,
      stateCaption: STATE_COPY[state].caption,
      totalEarned: state === 'cashback-active' ? `$${(link?.totalRebate ?? 0).toFixed(2)}` : undefined,
      banners: banner ? [banner] : [],
    };
  });
}

/* Badge AND rate both come from `me.tier`, never `me.user.plan`: tier is the
   live rate (an expired Gold is `none`/10% the moment it lapses), while
   user.plan keeps the last plan bought. Reading one for the badge and the
   other for the rate is how you end up showing a Gold badge next to 10%. */
function planFrom(tierId: string): CashbackPlan {
  return tierId === 'silver' || tierId === 'gold' || tierId === 'diamond' ? tierId : 'standard';
}

/* ---------------------------------------------------------------------------
 * Cashback hub — route `/cashback` (bottom-nav tab 2).
 *
 * Two Figma frames, one component:
 *   850:2053  "cashback-dashboard" — total-cashback overview, promo
 *             carousel, "our brokers" list, floating nav bar.
 *   850:1913  "cashback-intro"     — first-run/empty splash shown when the
 *             signed-in user has no broker accounts yet.
 *
 * Both frames bake in the Telegram WebView chrome row (✕ Trust forex ⌄ ⋮)
 * and the iOS status bar; per the screen-building brief these are host
 * chrome, not app content, and are excluded here (matching the convention
 * already set by src/screens/broker/BrokerDetail.tsx and PlansHeader — only
 * in-app back-arrow headers get built).
 * ------------------------------------------------------------------------- */

/* The promo strip is the shared PromoCarousel, same as Home and Referral. It
   used to be a second copy here with its own cards and its own dots, which is
   why the two drifted: this one only had art on slide 1 (the cashback crop of
   the gift box has no alpha, so it painted a blue patch on the green and orange
   slides) and its dots never moved on their own. */

export interface CashbackProps {
  /** Opens a sheet on mount — review deep-link (`?sheet=about|history`). */
  initialSheet?: 'about' | 'history';
  /** Bottom nav tab switch — wired straight into NavigationBar's onChange. */
  onNavigate?: (tab: NavigationTab) => void;
  onOpenBroker?: (brokerId: BrokerId) => void;
  onUpgradePlan?: () => void;
  /** Intro splash CTA ("Start earning ( 3 )"). */
  onStartEarning?: () => void;
}

export default function Cashback({
  initialSheet,
  onNavigate,
  onOpenBroker,
  onUpgradePlan,
}: CashbackProps): ReactNode {
  // The intro splash is no longer a branch here — CashbackRoute owns it and
  // gates it on the per-account `cashback_preview_seen` flag, matching referral.
  const [aboutOpen, setAboutOpen] = useState(initialSheet === 'about');
  /* "Cashback history" is a sheet over this screen, not a route. It used to
     navigate to /cashback/history, which unmounted the dashboard and rendered
     the same sheet over an empty page — so the whole screen behind it vanished
     when the sheet opened. The design (1292:4273) shows it on top of the
     dashboard, and that only works if the dashboard is still there. */
  const [historyOpen, setHistoryOpen] = useState(initialSheet === 'history');

  /* Partner-brokers "i" callout — same pattern as Home's plan-info callout:
     any tap outside the button or a scroll of the page dismisses it. Capture
     phase because the scroll happens on an inner element; the PromoCarousel
     above auto-advances, so its horizontal scrollTo must not count as a
     page scroll (the target-contains guard). */
  const [brokersTipOpen, setBrokersTipOpen] = useState(false);
  const brokersInfoRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!brokersTipOpen) return;
    const close = (e: Event): void => {
      if (brokersInfoRef.current?.contains(e.target as Node)) return;
      if (e.type === 'scroll' && !(e.target as Node | null)?.contains?.(brokersInfoRef.current)) return;
      setBrokersTipOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    const arm = setTimeout(() => document.addEventListener('scroll', close, true), 150);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
    };
  }, [brokersTipOpen]);

  // OVERVIEW renders immediately so the hero card is never blank; getMe()
  // swaps real numbers in once it lands. The broker list has no such
  // placeholder — it stays empty until getBrokers() actually answers, so
  // there is nothing invented to swap out. cachedX() seeds both
  // synchronously so a tab switch doesn't re-fetch and visibly re-swap.
  const [me, setMe] = useState<Me | null>(() => cachedMe() ?? null);
  const [brokers, setBrokers] = useState<readonly ApiBroker[] | undefined>(() => cachedBrokers());
  useEffect(() => {
    if (cachedMe() !== undefined && cachedBrokers() !== undefined) return;
    let live = true;
    void Promise.all([getMe(), getBrokers()]).then(([m, b]) => {
      if (!live) return;
      setMe(m);
      setBrokers(b);
    });
    return () => {
      live = false;
    };
  }, []);

  const cards = brokers ? liveCards(brokers, me) : [];
  const plan = me ? planFrom(me.tier.id) : OVERVIEW.plan;

  return (
    <div className="scr-cashback">
      <main className="scr-cashback-body">
        {/* 850:2053's own Cashback Overview instance is the "State=Standard
            user" variant (982:1427): no delta chip, no current-state label
            row, stacked full-width actions. The DS CashbackOverview
            component has no props for any of those three, so they're scoped
            CSS overrides below (see report) rather than edits to
            design-system/CashbackOverview.*. total/plan come from getMe();
            OVERVIEW is the pre-fetch/no-server fallback (rate and
            planDuration have no API field yet, so those stay static). */}
        <CashbackOverview
          className="scr-cashback-hero"
          {...OVERVIEW}
          plan={plan}
          /* `earned`, not `netTotal`: the latter is the platform's margin on
             this user's rebates ("Our Monthly Net" in the admin), not their
             cashback. See miniAppUser in server/admin.mjs. */
          total={me ? `$${me.cashback.earned.toFixed(2)}` : OVERVIEW.total}
          planName={me ? plan.charAt(0).toUpperCase() + plan.slice(1) : OVERVIEW.planName}
          /* The rate the server actually pays this user at, not the card's
             per-tier default — those are Figma sample values. */
          rate={me ? `${+me.tier.pct.toFixed(1)}%` : OVERVIEW.rate}
          /* "Base access" is only true of the no-subscription tier; on a real
             plan let the card's own per-tier term through. */
          planDuration={me && plan !== 'standard' ? undefined : OVERVIEW.planDuration}
          onInfo={() => setAboutOpen(true)}
          onCashbackHistory={() => setHistoryOpen(true)}
          onUpgrade={onUpgradePlan}
        />

        <PromoCarousel start={0} section="cashback" />

        <section className="scr-cashback-brokers">
          <div className="scr-cashback-brokers-head">
            <span className="scr-cashback-brokers-title">Partner brokers</span>
            <button
              type="button"
              ref={brokersInfoRef}
              className="ds-info-btn"
              aria-label="About partner brokers"
              onClick={() => setBrokersTipOpen((v) => !v)}
            >
              <Icon name="info" size={20} />
            </button>
          </div>

          {brokersTipOpen ? (
            <div className="scr-cashback-infotip" role="tooltip">
              Compare partner brokers and register through our link to activate cashback.
            </div>
          ) : null}

          {brokers && cards.length === 0 ? (
            <p className="scr-cashback-brokers-empty">No partner brokers are currently available in your region</p>
          ) : null}

          <div className="scr-cashback-brokers-list">
            {cards.map((card) => (
              <button
                key={card.key}
                type="button"
                className="scr-cashback-broker"
                onClick={() => onOpenBroker?.(card.id)}
              >
                <span className="scr-cashback-broker-top">
                  <span className="scr-cashback-broker-id">
                    <img className="scr-cashback-broker-logo" src={card.logo} alt="" width={32} height={32} />
                    <span className="scr-cashback-broker-name">{card.name}</span>
                  </span>
                  <span className="scr-cashback-broker-right">
                    {card.popular ? <span className="scr-cashback-broker-popular">{card.popularLabel}</span> : null}
                    <Icon name="chevron-right" size={16} />
                  </span>
                </span>

                {/* Each broker gets 0-1 status banner (Figma "Notification",
                    1316:8158) above its BrokerState panel, driven by the
                    user's link state for that broker. */}
                <span className="scr-cashback-broker-content">
                  {card.banners.map((banner, bi) => (
                    <StatusBanner key={bi} banner={banner} />
                  ))}

                  <BrokerState
                    state={card.state}
                    label={card.stateLabel}
                    caption={card.stateCaption}
                    value={card.totalEarned}
                  />
                </span>
              </button>
            ))}
          </div>

          <p className="scr-cashback-brokers-note">
            This list includes every verified broker available in your region.
          </p>
        </section>
      </main>

      <NavigationBar active="cashback" onChange={onNavigate} className="ds-navbar-floating" />

      <AboutCashbackSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />
      <CashbackHistorySheet open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </div>
  );
}
