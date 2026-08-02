import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, CashbackOverview, BrokerState, NavigationBar, Icon } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { Glyph } from './Glyph';
import { BROKERS, BROKER_INFO, OVERVIEW, type BrokerId, type BrokerBanner } from './brokers-data';
import giftUrl from '../../assets/brokers/cashback-gift.png';
import './Cashback.css';

/* Status-banner icon per Figma "Notification" variant (1316:8158). `pending`
 * ("in progress") has no icon in the DS Icon set, so it's a small local arc —
 * static, not spinning (the reference is a still frame; shoot.mjs freezes
 * motion anyway, so an animated one would drift from whatever angle the
 * capture lands on). */
function PendingGlyph(): ReactNode {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
    </svg>
  );
}

const BANNER_ICON: Record<BrokerBanner['variant'], ReactNode> = {
  error: <Icon name="close" size={16} />,
  success: <Icon name="check" size={16} />,
  pending: <PendingGlyph />,
};


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

// The Figma source reuses the exact same gift-box imageRef on all 3 slides,
// but its bounding box is only partly opaque (the rest is transparent,
// showing whatever sits underneath — the blue card on slide 1, page grey
// beyond it). The 2x PNG cache has no alpha channel, so the crop bakes in
// blue as its "transparent" fill; reusing it on the green/orange slides
// would paint a visible blue patch. Only slide 1 (pixel-verified, on-canvas
// in 850:2053) gets the art; see report.
const PROMO_SLIDES: readonly { key: string; bg: string; badge: string; title: string; sub: string; art?: boolean }[] = [
  { key: 'summer', bg: '#7A9DFE', badge: 'Special Offer', title: 'Summer discount', sub: 'get 20% OFF on 12 month plan', art: true },
  { key: 'invite', bg: '#68CB64', badge: 'Invite & Earn', title: 'invite friends', sub: 'get 10% from thier deposits' },
  { key: 'tasks', bg: '#FFA202', badge: 'Stay Active', title: 'complete tasks', sub: 'win rewards & get amazing prizes' },
];

export interface CashbackProps {
  /** Seeds the internal `hasAccounts` state; the intro shows when false. Defaults to true (dashboard). */
  initialHasAccounts?: boolean;
  /** Bottom nav tab switch — wired straight into NavigationBar's onChange. */
  onNavigate?: (tab: NavigationTab) => void;
  onOpenBroker?: (brokerId: BrokerId) => void;
  onCashbackHistory?: () => void;
  onUpgradePlan?: () => void;
  /** Intro splash CTA ("Start earning ( 3 )"). */
  onStartEarning?: () => void;
}

export default function Cashback({
  initialHasAccounts = true,
  onNavigate,
  onOpenBroker,
  onCashbackHistory,
  onUpgradePlan,
  onStartEarning,
}: CashbackProps): ReactNode {
  // "hasAccounts" drives which of the two Figma frames renders. There is no
  // in-app control to flip it (a real build would derive it from the
  // broker-accounts list once that data exists) — the initial value is the
  // only lever, exposed as a prop for the eventual assembly layer.
  const [hasAccounts] = useState(initialHasAccounts);

  if (!hasAccounts) {
    return <CashbackIntro onStartEarning={onStartEarning} />;
  }

  return (
    <div className="scr-cashback">
      <main className="scr-cashback-body">
        {/* 850:2053's own Cashback Overview instance is the "State=Standard
            user" variant (982:1427) — $0 balance, Standard/Base access,
            10% rate, no delta chip, stacked full-width actions. Nothing on
            this screen is wired to real account data yet (brokers-data.ts
            is static too), so — like every other value on this card —
            this is the literal default for the dashboard frame, not a
            reviewer-only edge case; it's set directly rather than gated
            behind a query param. The DS CashbackOverview component has no
            props for "no delta" / "no current-state label row" / stacked
            actions, so those three are scoped CSS overrides below (see
            report) rather than edits to design-system/CashbackOverview.*. */}
        <CashbackOverview
          className="scr-cashback-hero"
          {...OVERVIEW}
          onCashbackHistory={onCashbackHistory}
          onUpgrade={onUpgradePlan}
        />

        <div className="scr-cashback-promo" role="region" aria-label="Promotions">
          {PROMO_SLIDES.map((slide, i) => (
            <article key={slide.key} className="scr-cashback-promo-card" style={{ background: slide.bg }}>
              <div className="scr-cashback-promo-content">
                <span className="scr-cashback-promo-badge">{slide.badge}</span>
                <h3 className="scr-cashback-promo-title">{slide.title}</h3>
                <p className="scr-cashback-promo-sub">{slide.sub}</p>
              </div>
              {slide.art ? (
                <img className="scr-cashback-promo-art" src={giftUrl} alt="" width={115} height={110} />
              ) : null}
              <span className="scr-cashback-promo-dots" aria-hidden="true">
                {[0, 1, 2].map((d) => (
                  <span key={d} className={'scr-cashback-promo-dot' + (d === i ? ' scr-cashback-promo-dot--active' : '')}>
                    {d === i ? <span className="scr-cashback-promo-dot-fill" /> : null}
                  </span>
                ))}
              </span>
            </article>
          ))}
        </div>

        <section className="scr-cashback-brokers">
          <div className="scr-cashback-brokers-head">
            <span className="scr-cashback-brokers-title">Partner brokers</span>
            <span className="scr-cashback-brokers-info">
              <Icon name="info" size={24} />
            </span>
          </div>

          <div className="scr-cashback-brokers-list">
            {BROKERS.map((broker, i) => {
              const info = BROKER_INFO[broker.id];
              return (
                <button
                  key={broker.key ?? `${broker.id}-${i}`}
                  type="button"
                  className="scr-cashback-broker"
                  onClick={() => onOpenBroker?.(broker.id)}
                >
                  <span className="scr-cashback-broker-top">
                    <span className="scr-cashback-broker-id">
                      <img className="scr-cashback-broker-logo" src={info.logo} alt="" width={32} height={32} />
                      <span className="scr-cashback-broker-name">{info.name}</span>
                    </span>
                    <span className="scr-cashback-broker-right">
                      {broker.popular ? <span className="scr-cashback-broker-popular">Popular</span> : null}
                      <Icon name="chevron-right" size={16} />
                    </span>
                  </span>

                  {/* Each broker gets 1-2 status banners (Figma "Notification",
                      1316:8158) above its BrokerState panel — not just the
                      single cashback-active case the previous build special-cased. */}
                  <span className="scr-cashback-broker-content">
                    {broker.banners?.map((banner, bi) => (
                      <span
                        key={bi}
                        className={`scr-cashback-broker-banner scr-cashback-broker-banner--${banner.variant}`}
                      >
                        {BANNER_ICON[banner.variant]}
                        {banner.title}
                      </span>
                    ))}

                    <BrokerState
                      state={broker.state}
                      label={broker.stateLabel}
                      caption={broker.stateCaption}
                      value={broker.totalEarned}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="scr-cashback-brokers-note">
            This list includes every verified broker available in your region.
          </p>
        </section>
      </main>

      <NavigationBar active="cashback" onChange={onNavigate} className="ds-navbar-floating" />
    </div>
  );
}

interface CashbackIntroProps {
  onStartEarning?: () => void;
}

function CashbackIntro({ onStartEarning }: CashbackIntroProps): ReactNode {
  return (
    <div className="scr-cashback-intro">
      <div className="scr-cashback-intro-card">
        <h1 className="scr-cashback-intro-headline">
          Make Every Trade More Rewarding With <span className="scr-cashback-intro-accent">Cashback</span>
        </h1>

        <div className="scr-cashback-intro-steps">
          <div className="scr-cashback-intro-step">
            <span className="scr-cashback-intro-step-icon">
              <Glyph name="shield" size={24} />
            </span>
            <span className="scr-cashback-intro-step-text">
              <span className="scr-cashback-intro-step-title">Open trading accounts</span>
              <span className="scr-cashback-intro-step-sub">With verified broker partners</span>
            </span>
          </div>

          <div className="scr-cashback-intro-step">
            <span className="scr-cashback-intro-step-icon">
              <Glyph name="calendar" size={24} />
            </span>
            <span className="scr-cashback-intro-step-text">
              <span className="scr-cashback-intro-step-title">Receive weekly cashback</span>
              <span className="scr-cashback-intro-step-sub">From every trade you make</span>
            </span>
          </div>

          <div className="scr-cashback-intro-step">
            <span className="scr-cashback-intro-step-icon">
              <Glyph name="trending-up" size={24} />
            </span>
            <span className="scr-cashback-intro-step-text">
              <span className="scr-cashback-intro-step-title">upgrade your plan</span>
              <span className="scr-cashback-intro-step-sub">for a higher cashback rate</span>
            </span>
          </div>
        </div>

        <Button
          variant="primary"
          size="medium"
          fullWidth
          className="scr-cashback-intro-cta"
          onClick={onStartEarning}
        >
          Start earning ( 3 )
        </Button>
      </div>
    </div>
  );
}
