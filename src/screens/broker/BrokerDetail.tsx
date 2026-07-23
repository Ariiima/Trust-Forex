import { useState } from 'react';
import type { ReactNode, SVGProps } from 'react';
import { Button, ProgressBar, BottomSheet, Icon } from '../../design-system/components';
import type { ProgressStep } from '../../design-system/components';
import xmLogoUrl from '../../assets/broker/xm-logo.png';
import depositWaitUrl from '../../assets/broker/deposit-wait.png';
import './BrokerDetail.css';

/* ---------------------------------------------------------------------------
 * Broker detail onboarding — route /cashback/broker/:brokerId
 *
 * One screen, a 3-step onboarding state machine (inventory flow C):
 *   step 1  "Create your broker account"  → sticky CTA "submit account"
 *              → <submit-account> BottomSheet (email + user ID)  → advances to 2
 *   step 2  "Activate your cashback"       → sticky CTA "i made a deposit"
 *              → <made-deposit> BottomSheet (prefilled)          → waiting sub-state
 *   step 2  "waiting for deposit"          → sticky CTA "i made a deposit"
 *              → <made-deposit> BottomSheet                      → advances to 3
 *   step 3  "Cashback activated"           → terminal, no sticky CTA
 *
 * All values are taken from the Figma node JSON (1089-7010 / 1089-8064 /
 * 1090-8188 / 1090-9123 heroes, 1089-7650 / 1090-8325 modals). The XM broker
 * logo and the clock/card illustration are 2x crops in src/assets/broker/.
 * ------------------------------------------------------------------------- */

// Inline Tabler glyphs — the DS Icon set does not cover these; per the brief,
// new glyphs are inlined here with currentColor so the consuming CSS colours them.
type GlyphName =
  | 'back'
  | 'external'
  | 'copy'
  | 'close'
  | 'mail'
  | 'user'
  | 'shield'
  | 'monitor'
  | 'gift'
  | 'activity'
  | 'info'
  | 'zap'
  | 'credit-card';

const GLYPHS: Record<GlyphName, readonly string[]> = {
  back: ['M5 12l14 0', 'M5 12l6 6', 'M5 12l6 -6'],
  external: ['M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M9 15l6 -6', 'M11 9h4v4'],
  copy: [
    'M10 8h8a2 2 0 0 1 2 2v8a2 2 0 0 1 -2 2h-8a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2z',
    'M6 16a2 2 0 0 1 -2 -2v-8a2 2 0 0 1 2 -2h8a2 2 0 0 1 2 2',
  ],
  close: ['M18 6l-12 12', 'M6 6l12 12'],
  mail: ['M3 7a2 2 0 0 1 2 -2h14a2 2 0 0 1 2 2v10a2 2 0 0 1 -2 2h-14a2 2 0 0 1 -2 -2z', 'M3 7l9 6l9 -6'],
  user: ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M6 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2'],
  shield: ['M12 3a12 12 0 0 0 8.5 3a12 12 0 0 1 -8.5 15a12 12 0 0 1 -8.5 -15a12 12 0 0 0 8.5 -3'],
  monitor: ['M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1v-10a1 1 0 0 1 1 -1z', 'M7 20h10', 'M9 16v4', 'M15 16v4'],
  gift: [
    'M3 8m0 1a1 1 0 0 1 1 -1h16a1 1 0 0 1 1 1v2a1 1 0 0 1 -1 1h-16a1 1 0 0 1 -1 -1z',
    'M12 8l0 13',
    'M19 12v7a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-7',
    'M7.5 8a2.5 2.5 0 0 1 0 -5a4.8 8 0 0 1 4.5 5a4.8 8 0 0 1 4.5 -5a2.5 2.5 0 0 1 0 5',
  ],
  activity: ['M3 12h4l3 8l4 -16l3 8h4'],
  info: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 9h.01', 'M11 12h1v4h1'],
  zap: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  'credit-card': ['M3 5m0 3a3 3 0 0 1 3 -3h12a3 3 0 0 1 3 3v8a3 3 0 0 1 -3 3h-12a3 3 0 0 1 -3 -3z', 'M3 10l18 0', 'M7 15l.01 0', 'M11 15l2 0'],
};

interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: GlyphName;
  size?: number;
  strokeWidth?: number;
}

function Glyph({ name, size = 24, strokeWidth = 1.75, ...rest }: GlyphProps): ReactNode {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {GLYPHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

// ---- Broker content (app content — the captured instance is "XM broker") ----
interface Spec {
  icon: GlyphName;
  label: string;
  value: string;
}

const XM_SPECS: readonly Spec[] = [
  { icon: 'shield', label: 'Regulation', value: 'FCA, CySEC' },
  { icon: 'monitor', label: 'Trading Platform', value: 'MT4 / MT5' },
  { icon: 'gift', label: 'Deposit Bonus', value: 'Up to 50%' },
  { icon: 'activity', label: 'Spread Level', value: 'Low' },
  { icon: 'info', label: 'Leverage', value: 'Up to 1:500' },
  { icon: 'user', label: 'Account Types', value: 'Standard / ECN' },
  { icon: 'zap', label: 'Execution Speed', value: 'Fast' },
  { icon: 'credit-card', label: 'Withdrawal Speed', value: 'Fast' },
];

const REFERRAL_CODE = '45789632';

type Step = 1 | 2 | 3;
type Modal = 'submit-account' | 'made-deposit' | null;

interface HeroCopy {
  title: string;
  subtitle: string;
  actionLabel: string;
  /** Second (caption) line — only the "open via our link" bordered button. */
  actionCaption?: string;
  /** 'solid' = white filled CTA; 'outline' = bordered on-blue CTA. */
  actionStyle: 'solid' | 'outline';
  showArt: boolean;
  showReferral: boolean;
}

function heroCopy(step: Step, depositSubmitted: boolean): HeroCopy {
  if (step === 1) {
    return {
      title: 'Create your broker account',
      subtitle: 'Register through the link below, then return to submit your account details.',
      actionLabel: 'Create account',
      actionStyle: 'solid',
      showArt: false,
      showReferral: true,
    };
  }
  if (step === 2 && !depositSubmitted) {
    return {
      title: 'Activate your cashback',
      subtitle: 'Fund your registered broker account, then return to submit it for review.',
      actionLabel: 'Go to broker',
      actionStyle: 'solid',
      showArt: false,
      showReferral: true,
    };
  }
  if (step === 2) {
    return {
      title: 'waiting for deposit',
      subtitle: 'complete your deposit to unlock full access to your broker account',
      actionLabel: 'open via our link',
      actionCaption: 'Use Our Official Link To Ensure Tracking',
      actionStyle: 'outline',
      showArt: true,
      showReferral: false,
    };
  }
  return {
    title: 'Cashback activated',
    subtitle: 'Earn cashback on every trade made through your registered broker account',
    actionLabel: 'Go to broker',
    actionStyle: 'solid',
    showArt: false,
    showReferral: true,
  };
}

export interface BrokerDetailProps {
  /** Route param (assembly layer passes it); the captured instance is XM. */
  brokerId?: string;
  onBack?: () => void;
}

export default function BrokerDetail({ onBack }: BrokerDetailProps): ReactNode {
  const [step, setStep] = useState<Step>(1);
  const [depositSubmitted, setDepositSubmitted] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [copied, setCopied] = useState(false);

  const progress: ProgressStep =
    step === 1 ? 'order-created' : step === 2 ? 'payment-details' : 'make-payment';
  const hero = heroCopy(step, depositSubmitted);

  const copyReferral = (): void => {
    navigator.clipboard?.writeText(REFERRAL_CODE).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  // submit-account modal → advance to step 2 (activate)
  const submitAccount = (): void => {
    setStep(2);
    setDepositSubmitted(false);
    setModal(null);
  };

  // made-deposit modal → activate → waiting → complete
  const confirmDeposit = (): void => {
    setModal(null);
    if (!depositSubmitted) {
      setDepositSubmitted(true);
    } else {
      setStep(3);
    }
  };

  const displayEmail = email || 'trustforex.info@gmail.com';
  const displayUserId = userId || 'nimanm24';

  return (
    <div className="scr-broker">
      <header className="scr-broker-header">
        <button className="scr-broker-back" type="button" onClick={onBack} aria-label="Back">
          <Glyph name="back" size={24} strokeWidth={1.5} />
        </button>
        <span className="scr-broker-headtitle">xm broker</span>
      </header>

      <main className="scr-broker-body">
        {/* Broker card */}
        <section className="scr-broker-card">
          <div className="scr-broker-card-left">
            <img className="scr-broker-logo" src={xmLogoUrl} alt="XM" width={32} height={32} />
            <span className="scr-broker-name">XM</span>
          </div>
          <span className="scr-broker-popular">Popular</span>
        </section>

        {/* Blue onboarding hero */}
        <section className="scr-broker-hero">
          <ProgressBar current={progress} className="scr-broker-stepper" />

          <div className={'scr-broker-hero-content' + (hero.showArt ? ' scr-broker-hero-content--art' : '')}>
            {hero.showArt ? (
              <img className="scr-broker-hero-art" src={depositWaitUrl} alt="" width={56} height={50} />
            ) : null}
            <div className="scr-broker-hero-text">
              <h2 className="scr-broker-hero-title">{hero.title}</h2>
              <p className="scr-broker-hero-sub">{hero.subtitle}</p>
            </div>
          </div>

          {hero.actionStyle === 'solid' ? (
            <div className="scr-broker-hero-block">
              <button className="scr-broker-linkbtn" type="button">
                <span className="scr-broker-linkbtn-label">{hero.actionLabel}</span>
                <Glyph name="external" size={24} strokeWidth={1.5} />
              </button>
              {hero.showReferral ? (
                <div className="scr-broker-referral">
                  <span className="scr-broker-referral-label">referral code</span>
                  <span className="scr-broker-referral-right">
                    <span className="scr-broker-referral-code">{REFERRAL_CODE}</span>
                    <button
                      className="scr-broker-copy"
                      type="button"
                      onClick={copyReferral}
                      aria-label={copied ? 'Copied' : 'Copy referral code'}
                    >
                      {copied ? <Icon name="check" size={16} strokeWidth={2} /> : <Glyph name="copy" size={16} strokeWidth={1.6} />}
                    </button>
                  </span>
                </div>
              ) : null}
            </div>
          ) : (
            <button className="scr-broker-linkbtn scr-broker-linkbtn--outline" type="button">
              <span className="scr-broker-linkbtn-two">
                <span className="scr-broker-linkbtn-label">{hero.actionLabel}</span>
                <span className="scr-broker-linkbtn-caption">{hero.actionCaption}</span>
              </span>
              <Glyph name="external" size={24} strokeWidth={1.5} />
            </button>
          )}
        </section>

        {/* Broker details spec list */}
        <section className="scr-broker-details">
          <h3 className="scr-broker-details-title">broker details</h3>
          {XM_SPECS.map((s) => (
            <div className="scr-broker-spec" key={s.label}>
              <span className="scr-broker-spec-left">
                <Glyph name={s.icon} size={20} strokeWidth={1.6} />
                <span className="scr-broker-spec-label">{s.label}</span>
              </span>
              <span className="scr-broker-spec-value">{s.value}</span>
            </div>
          ))}
        </section>
      </main>

      {/* Sticky bottom CTA — present on steps 1 & 2 only (step 3 is terminal) */}
      {step !== 3 ? (
        <footer className="scr-broker-footer">
          <Button
            variant="primary"
            size="medium"
            fullWidth
            iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
            onClick={() => setModal(step === 1 ? 'submit-account' : 'made-deposit')}
          >
            {step === 1 ? 'submit account' : 'i made a deposit'}
          </Button>
        </footer>
      ) : null}

      {/* Submit-account modal */}
      <BottomSheet open={modal === 'submit-account'} onClose={() => setModal(null)} className="scr-broker-sheet">
        <div className="scr-broker-sheet-inner">
          <div className="scr-broker-sheet-content">
            <div className="scr-broker-sheet-head">
              <div className="scr-broker-sheet-titledesc">
                <div className="scr-broker-sheet-titlerow">
                  <h2 className="scr-broker-sheet-title">submit your account</h2>
                  <button className="scr-broker-sheet-close" type="button" onClick={() => setModal(null)} aria-label="Close">
                    <Glyph name="close" size={24} strokeWidth={1.5} />
                  </button>
                </div>
                <p className="scr-broker-sheet-desc">please send us the email you used to register with your broker</p>
              </div>
              <hr className="scr-broker-sheet-divider" />
            </div>

            <div className="scr-broker-fields scr-broker-fields--input">
              <label className="scr-broker-field">
                <span className="scr-broker-field-label">Email address</span>
                <span className="scr-broker-input">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="enter your email address"
                  />
                  {email ? (
                    <button className="scr-broker-input-clear" type="button" onClick={() => setEmail('')} aria-label="Clear email">
                      <Glyph name="close" size={16} strokeWidth={1.5} />
                    </button>
                  ) : null}
                </span>
              </label>

              <label className="scr-broker-field">
                <span className="scr-broker-field-label">user ID</span>
                <span className="scr-broker-input">
                  <input
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    placeholder="enter your user ID"
                  />
                  {userId ? (
                    <button className="scr-broker-input-clear" type="button" onClick={() => setUserId('')} aria-label="Clear user ID">
                      <Glyph name="close" size={16} strokeWidth={1.5} />
                    </button>
                  ) : null}
                </span>
              </label>
            </div>
          </div>

          <Button
            variant="primary"
            size="medium"
            fullWidth
            iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
            onClick={submitAccount}
          >
            submit account
          </Button>
        </div>
      </BottomSheet>

      {/* Made-a-deposit modal (prefilled) */}
      <BottomSheet open={modal === 'made-deposit'} onClose={() => setModal(null)} className="scr-broker-sheet">
        <div className="scr-broker-sheet-inner">
          <div className="scr-broker-sheet-content">
            <div className="scr-broker-sheet-head">
              <div className="scr-broker-sheet-titledesc">
                <div className="scr-broker-sheet-titlerow">
                  <h2 className="scr-broker-sheet-title">i made a deposit</h2>
                  <button className="scr-broker-sheet-close" type="button" onClick={() => setModal(null)} aria-label="Close">
                    <Glyph name="close" size={24} strokeWidth={1.5} />
                  </button>
                </div>
                <p className="scr-broker-sheet-desc">great! please confirm your deposit so we can review your account</p>
              </div>
              <hr className="scr-broker-sheet-divider" />
            </div>

            <div className="scr-broker-fields scr-broker-fields--read">
              <div className="scr-broker-readfield">
                <Glyph name="mail" size={20} strokeWidth={1.6} />
                <div className="scr-broker-readfield-text">
                  <span className="scr-broker-readfield-label">Email address</span>
                  <span className="scr-broker-readfield-value">{displayEmail}</span>
                </div>
              </div>
              <div className="scr-broker-readfield">
                <Glyph name="user" size={20} strokeWidth={1.6} />
                <div className="scr-broker-readfield-text">
                  <span className="scr-broker-readfield-label">user ID</span>
                  <span className="scr-broker-readfield-value">{displayUserId}</span>
                </div>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="medium"
            fullWidth
            iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
            onClick={confirmDeposit}
          >
            i made a deposit
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
