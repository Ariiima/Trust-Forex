import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, CashbackOverview, BrokerState, NavigationBar, Icon } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { Glyph } from './Glyph';
import { BROKERS, BROKER_INFO, type BrokerId } from './brokers-data';
import goldBadgeUrl from '../../assets/brokers/gold-badge.png';
import giftUrl from '../../assets/brokers/cashback-gift.png';
import './Cashback.css';

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
        <CashbackOverview
          badge={<img src={goldBadgeUrl} alt="" width={56} height={56} />}
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
            <span className="scr-cashback-brokers-title">our brokers</span>
            <span className="scr-cashback-brokers-info">
              <Icon name="info" size={24} strokeWidth={1.8} />
            </span>
          </div>

          <div className="scr-cashback-brokers-list">
            {BROKERS.map((broker) => {
              const info = BROKER_INFO[broker.id];
              return (
                <button
                  key={broker.id}
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
                      <Icon name="chevron-right" size={16} strokeWidth={1.5} />
                    </span>
                  </span>

                  {broker.state === 'cashback-active' ? (
                    <span className="scr-cashback-broker-confirmed">
                      <Icon name="check" size={16} strokeWidth={1.8} />
                      deposit confirmed
                    </span>
                  ) : null}

                  <BrokerState state={broker.state} value={broker.totalEarned} />
                </button>
              );
            })}
          </div>
        </section>
      </main>

      <div className="scr-cashback-navwrap">
        <NavigationBar active="cashback" onChange={onNavigate} />
      </div>
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
              <Glyph name="shield" size={24} strokeWidth={2} />
            </span>
            <span className="scr-cashback-intro-step-text">
              <span className="scr-cashback-intro-step-title">Open trading accounts</span>
              <span className="scr-cashback-intro-step-sub">With verified broker partners</span>
            </span>
          </div>

          <div className="scr-cashback-intro-step">
            <span className="scr-cashback-intro-step-icon">
              <Glyph name="calendar" size={24} strokeWidth={2} />
            </span>
            <span className="scr-cashback-intro-step-text">
              <span className="scr-cashback-intro-step-title">Receive weekly cashback</span>
              <span className="scr-cashback-intro-step-sub">From every trade you make</span>
            </span>
          </div>

          <div className="scr-cashback-intro-step">
            <span className="scr-cashback-intro-step-icon">
              <Glyph name="trending-up" size={24} strokeWidth={2} />
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
