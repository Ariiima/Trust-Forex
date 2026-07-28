import { useEffect, useState } from 'react';
import type { ComponentType, FocusEvent, ReactNode, SVGProps } from 'react';
import * as DS from '../../design-system/components';
import type { ProgressStep } from '../../design-system/components';
import xmLogoUrl from '../../assets/broker/xm-logo.png';
import './BrokerDetail.css';

/* ---------------------------------------------------------------------------
 * Broker connect flow — route /cashback/broker/:brokerId
 *
 * Two-axis state machine (spec §1, frames 1292-5199 / 1089-7010 / 1233-6658 /
 * 1292-4878 / 1292-5029 / 1233-7121 / 1089-8064 / 1242-7675 / 1292-5439 /
 * 1242-7555):
 *   accountStatus: none | submitted | failed | verified
 *   depositStatus: none | awaiting | submitted | confirmed
 *   S1        deposit none            → step 1, CTA "submit account"
 *   S1-sheet  submit-account sheet    (2 inputs; 1 input when account failed)
 *   S2        verified + awaiting     → step 2, CTA "i made a deposit"
 *   S2-sheet  confirm-deposit sheet   (read-only rows)
 *   S3-review deposit submitted       → step 3, NO footer CTA (under review)
 *   S4        deposit confirmed       → "Cashback activated" (kept from old step 3;
 *             'confirmed' extends the spec enum so the terminal copy stays reachable)
 * No in-app header — back nav is the Telegram BackButton.
 * ------------------------------------------------------------------------- */

const { Button, ProgressBar, BottomSheet, Icon } = DS;

// The ds-components cluster ships Input/Notification in parallel (CONTRACT §DS APIs).
// ponytail: resolved through the namespace so this file typechecks before they land;
// null-render fallback only exists mid-build. Upgrade: direct named imports.
interface DSInputProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
  rightSlot?: ReactNode;
  disabled?: boolean;
}
interface DSNotificationProps {
  variant: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  onClose?: () => void;
}
const dsExtra = DS as unknown as Record<string, unknown>;
const Input = (dsExtra.Input ?? (() => null)) as ComponentType<DSInputProps>;
const Notification = (dsExtra.Notification ?? (() => null)) as ComponentType<DSNotificationProps>;

// Inline Tabler glyphs — the DS Icon set does not cover these; per the brief,
// new glyphs are inlined here with currentColor so the consuming CSS colours them.
type GlyphName =
  | 'external'
  | 'close'
  | 'mail'
  | 'user'
  | 'shield'
  | 'monitor'
  | 'gift'
  | 'activity'
  | 'maximize'
  | 'cash2'
  | 'zap';

const GLYPHS: Record<GlyphName, readonly string[]> = {
  external: ['M4 6a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v12a2 2 0 0 1 -2 2h-12a2 2 0 0 1 -2 -2z', 'M9 15l6 -6', 'M11 9h4v4'],
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
  /* placeholder icon */
  maximize: ['M4 8v-2a2 2 0 0 1 2 -2h2', 'M4 16v2a2 2 0 0 0 2 2h2', 'M16 4h2a2 2 0 0 1 2 2v2', 'M16 20h2a2 2 0 0 0 2 -2v-2'],
  /* placeholder icon */
  cash2: [
    'M7 9m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z',
    'M14 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M17 9v-2a2 2 0 0 0 -2 -2h-10a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h2',
  ],
  zap: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
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

// Canonical row order from the 5 newest full screens (spec D4).
const XM_SPECS: readonly Spec[] = [
  { icon: 'shield', label: 'Regulation', value: 'FCA, CySEC' },
  { icon: 'monitor', label: 'Trading Platform', value: 'MT4 / MT5' },
  { icon: 'user', label: 'Account Types', value: 'Standard / ECN' },
  { icon: 'maximize', label: 'Leverage', value: 'Up to 1:500' },
  { icon: 'gift', label: 'Deposit Bonus', value: 'Up to 50%' },
  { icon: 'activity', label: 'Spread Level', value: 'Low' },
  { icon: 'cash2', label: 'Cashback level', value: 'High' },
  { icon: 'zap', label: 'Execution Speed', value: 'Fast' },
];

const REFERRAL_CODE = '45789632';

export type AccountStatus = 'none' | 'submitted' | 'failed' | 'verified';
export type DepositStatus = 'none' | 'awaiting' | 'submitted' | 'confirmed';
type Modal = 'submit-account' | 'made-deposit' | null;

interface HeroCopy {
  title: string;
  subtitle: string;
  actionLabel: string;
}

// Copy is NOT in the XML (generic layers) — current strings retained (spec §10.4).
function heroCopy(deposit: DepositStatus): HeroCopy {
  if (deposit === 'none') {
    return {
      title: 'Create your broker account',
      subtitle: 'Register through the link below, then return to submit your account details.',
      actionLabel: 'Create account',
    };
  }
  if (deposit === 'awaiting') {
    return {
      title: 'Activate your cashback',
      subtitle: 'Fund your registered broker account, then return to submit it for review.',
      actionLabel: 'Go to broker',
    };
  }
  if (deposit === 'submitted') {
    return {
      title: 'waiting for deposit',
      subtitle: 'complete your deposit to unlock full access to your broker account',
      actionLabel: 'Go to broker',
    };
  }
  return {
    title: 'Cashback activated',
    subtitle: 'Earn cashback on every trade made through your registered broker account',
    actionLabel: 'Go to broker',
  };
}

interface Banner {
  key: string;
  variant: DSNotificationProps['variant'];
  title: string;
}

export interface BrokerDetailProps {
  /** Route param (assembly layer passes it); the captured instance is XM. */
  brokerId?: string;
  onBack?: () => void;
  /** Dev/test hooks until the broker verification backend lands (spec §4). */
  initialAccountStatus?: AccountStatus;
  initialDepositStatus?: DepositStatus;
}

export default function BrokerDetail({
  onBack,
  initialAccountStatus = 'none',
  initialDepositStatus = 'none',
}: BrokerDetailProps): ReactNode {
  const [accountStatus, setAccountStatus] = useState<AccountStatus>(initialAccountStatus);
  const [depositStatus, setDepositStatus] = useState<DepositStatus>(initialDepositStatus);
  const [modal, setModal] = useState<Modal>(null);
  const [email, setEmail] = useState('');
  const [userId, setUserId] = useState('');
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState<readonly string[]>([]);

  // No in-app header (spec D1) — Telegram native BackButton drives onBack.
  // ponytail: talks to window.Telegram directly; swap to useBackButton from
  // src/telegram once the backend+telegram cluster lands that module.
  useEffect(() => {
    const bb = window.Telegram?.WebApp?.BackButton;
    if (!bb || !onBack) return;
    bb.onClick(onBack);
    bb.show();
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [onBack]);

  // ponytail: verification outcome comes from a backend that doesn't exist yet;
  // a 2.5s timer auto-verifies (pass initialAccountStatus="failed" to exercise the
  // resubmit sheet). Upgrade: poll the broker-account endpoint, set failed|verified.
  useEffect(() => {
    if (accountStatus !== 'submitted') return;
    const t = window.setTimeout(() => {
      setAccountStatus('verified');
      setDepositStatus((d) => (d === 'none' ? 'awaiting' : d));
    }, 2500);
    return () => window.clearTimeout(t);
  }, [accountStatus]);

  // Keyboard open (spec §6, frame 1233-7121): clamp the sheet to the visual
  // viewport so head + inputs stay reachable above the keyboard.
  useEffect(() => {
    if (!modal) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const clamp = (): void => {
      document.documentElement.style.setProperty('--scr-broker-vvh', `${vv.height}px`);
    };
    clamp();
    vv.addEventListener('resize', clamp);
    return () => {
      vv.removeEventListener('resize', clamp);
      document.documentElement.style.removeProperty('--scr-broker-vvh');
    };
  }, [modal]);

  const progress: ProgressStep =
    depositStatus === 'submitted' || depositStatus === 'confirmed'
      ? 'make-payment'
      : depositStatus === 'awaiting'
        ? 'payment-details'
        : 'order-created';
  const hero = heroCopy(depositStatus);
  const resubmit = accountStatus === 'failed';

  // Banner titles are inference (spec §10.1) — only "Account verification failed"
  // is confirmed copy. All banners are dismissible (S2-sheet frame shows zero).
  const banners: Banner[] = [];
  if (accountStatus === 'submitted') {
    banners.push({ key: 'account-review', variant: 'info', title: 'Account under review' });
  }
  if (accountStatus === 'failed') {
    banners.push({ key: 'account-failed', variant: 'error', title: 'Account verification failed' });
  }
  if (accountStatus === 'verified' && depositStatus === 'awaiting') {
    banners.push({ key: 'account-verified', variant: 'success', title: 'Account verified' });
    banners.push({ key: 'deposit-awaiting', variant: 'info', title: 'Make a deposit to activate cashback' });
  }
  if (depositStatus === 'submitted') {
    banners.push({ key: 'deposit-review', variant: 'info', title: 'Deposit under review' });
  }
  const visibleBanners = banners.filter((b) => !dismissed.includes(b.key));

  const cta =
    depositStatus === 'none'
      ? { label: 'submit account', modal: 'submit-account' as const }
      : depositStatus === 'awaiting'
        ? { label: 'i made a deposit', modal: 'made-deposit' as const }
        : null;

  const copyReferral = (): void => {
    navigator.clipboard?.writeText(REFERRAL_CODE).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const submitAccount = (): void => {
    setAccountStatus('submitted');
    setDismissed([]);
    setModal(null);
  };

  const confirmDeposit = (): void => {
    setDepositStatus('submitted');
    setDismissed([]);
    setModal(null);
  };

  const scrollFocusedIntoView = (e: FocusEvent<HTMLDivElement>): void => {
    (e.target as HTMLElement).scrollIntoView?.({ block: 'nearest' });
  };

  const displayEmail = email || 'Trustforex.info@gmail.com';
  const displayUserId = userId || 'Nimanm24';

  return (
    <div className="scr-broker">
      <main className="scr-broker-body">
        {/* Broker card: name row + 0..2 dismissible notification banners */}
        <section className="scr-broker-card">
          <div className="scr-broker-card-row">
            <div className="scr-broker-card-left">
              <img className="scr-broker-logo" src={xmLogoUrl} alt="XM" width={32} height={32} />
              <span className="scr-broker-name">XM</span>
            </div>
            <span className="scr-broker-popular">popular</span>
          </div>
          {visibleBanners.map((b) => (
            <Notification
              key={b.key}
              variant={b.variant}
              title={b.title}
              onClose={() => setDismissed((d) => [...d, b.key])}
            />
          ))}
        </section>

        {/* Blue onboarding hero */}
        <section className="scr-broker-hero">
          <ProgressBar current={progress} className="scr-broker-stepper" />

          <div className="scr-broker-hero-text">
            <h2 className="scr-broker-hero-title">{hero.title}</h2>
            <p className="scr-broker-hero-sub">{hero.subtitle}</p>
          </div>

          <div className="scr-broker-hero-block">
            <div className="scr-broker-referral">
              <span className="scr-broker-referral-label">referral code</span>
              <button
                className="scr-broker-referral-code"
                type="button"
                onClick={copyReferral}
                aria-label={copied ? 'Copied' : 'Copy referral code'}
              >
                {REFERRAL_CODE}
              </button>
            </div>
            <button className="scr-broker-linkbtn" type="button">
              <span className="scr-broker-linkbtn-label">{hero.actionLabel}</span>
              <Glyph name="external" size={24} strokeWidth={1.5} />
            </button>
          </div>
        </section>

        {/* Broker details spec list */}
        <section className="scr-broker-details">
          <h3 className="scr-broker-details-title">Broker details</h3>
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

      {/* Sticky bottom CTA — S1 & S2 only; gone once the deposit is under review */}
      {cta ? (
        <footer className="scr-broker-footer">
          <Button
            variant="primary"
            size="medium"
            fullWidth
            iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
            onClick={() => setModal(cta.modal)}
          >
            {cta.label}
          </Button>
        </footer>
      ) : null}

      {/* Submit-account sheet (2 inputs; 1-input resubmit when verification failed) */}
      <BottomSheet open={modal === 'submit-account'} onClose={() => setModal(null)} className="scr-broker-sheet">
        <div className="scr-broker-sheet-inner" onFocus={scrollFocusedIntoView}>
          <div className="scr-broker-sheet-content">
            <div className="scr-broker-sheet-head">
              <div className="scr-broker-sheet-titledesc">
                <div className="scr-broker-sheet-titlerow">
                  <h2 className="scr-broker-sheet-title">Submit account details</h2>
                  <button className="scr-broker-sheet-close" type="button" onClick={() => setModal(null)} aria-label="Close">
                    <Glyph name="close" size={24} strokeWidth={1.5} />
                  </button>
                </div>
                <p className="scr-broker-sheet-desc">please send us the email you used to register with your broker</p>
              </div>
              <hr className="scr-broker-sheet-divider" />
            </div>

            <div className="scr-broker-fields">
              <Input
                label="Email address"
                value={email}
                onChange={setEmail}
                placeholder="enter your email address"
              />
              {!resubmit ? (
                <Input
                  label="user ID"
                  value={userId}
                  onChange={setUserId}
                  placeholder="enter your user ID"
                />
              ) : null}
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

      {/* Confirm-deposit sheet (single bordered container, two read-only rows) */}
      <BottomSheet open={modal === 'made-deposit'} onClose={() => setModal(null)} className="scr-broker-sheet">
        <div className="scr-broker-sheet-inner">
          <div className="scr-broker-sheet-content">
            <div className="scr-broker-sheet-head">
              <div className="scr-broker-sheet-titledesc">
                <div className="scr-broker-sheet-titlerow">
                  <h2 className="scr-broker-sheet-title">Confirm your deposit</h2>
                  <button className="scr-broker-sheet-close" type="button" onClick={() => setModal(null)} aria-label="Close">
                    <Glyph name="close" size={24} strokeWidth={1.5} />
                  </button>
                </div>
                <p className="scr-broker-sheet-desc">great! please confirm your deposit so we can review your account</p>
              </div>
              <hr className="scr-broker-sheet-divider" />
            </div>

            <div className="scr-broker-readcard">
              <div className="scr-broker-readrow">
                <Glyph name="mail" size={20} strokeWidth={1.6} />
                <div className="scr-broker-readrow-text">
                  <span className="scr-broker-readrow-label">Email address</span>
                  <span className="scr-broker-readrow-value">{displayEmail}</span>
                </div>
              </div>
              <div className="scr-broker-readrow">
                <Glyph name="user" size={20} strokeWidth={1.6} />
                <div className="scr-broker-readrow-text">
                  <span className="scr-broker-readrow-label">User ID</span>
                  <span className="scr-broker-readrow-value">{displayUserId}</span>
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
