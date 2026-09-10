import { useEffect, useState } from 'react';
import type { ComponentType, FocusEvent, ReactNode, SVGProps } from 'react';
import * as DS from '../../design-system/components';
import type { ProgressStep } from '../../design-system/components';
import { useBackButton } from '../../telegram';
import {
  cachedBrokers, getBrokers, cachedMe, getMe, setCachedMe, submitBrokerAccount, confirmBrokerDeposit,
} from '../../api/client';
import type { Me, MeBrokerLink } from '../../api/client';
import { BROKER_INFO, flowTitle } from '../cashback/brokers-data';
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
 *   S1-sheet  submit-account sheet    (the fields the broker requires)
 *   S2        verified + awaiting     → step 2, CTA "i made a deposit"
 *   S2-sheet  confirm-deposit sheet   (read-only rows)
 *   S3-review deposit submitted       → still step 2, NO footer CTA (under review)
 *   S4        deposit confirmed       → "Cashback activated" (kept from old step 3;
 *             'confirmed' extends the spec enum so the terminal copy stays reachable)
 * No in-app header — back nav is the Telegram BackButton.
 * ------------------------------------------------------------------------- */

const { Button, ProgressBar, BottomSheet, Icon, Skeleton } = DS;

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
  onSubmit?: () => void;
}
interface DSNotificationProps {
  variant: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
  onClose?: () => void;
  autoDismiss?: number;
  hideClose?: boolean;
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
  | 'zap'
  | 'loader';

const GLYPHS: Record<GlyphName, readonly string[]> = {
  // Figma 1316:7986 icon: box 3..21 r4, arrow diag + full-span head, 1.25px stroke at 20px.
  external: ['M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1 -4 4h-10a4 4 0 0 1 -4 -4v-10a4 4 0 0 1 4 -4z', 'M9 15l6 -6', 'M9 9h6v6'],
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
  // Fixed: ref/broker.png shows a double-headed diagonal resize arrow here, not
  // the 4 corner-brackets this used to be (measured at the "Leverage" row icon).
  maximize: ['M6 18l12 -12', 'M12 6l6 0l0 6', 'M6 12l0 6l6 0'],
  cash2: [
    'M7 9m0 2a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2z',
    'M14 14m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0',
    'M17 9v-2a2 2 0 0 0 -2 -2h-10a2 2 0 0 0 -2 2v6a2 2 0 0 0 2 2h2',
  ],
  zap: ['M13 3l0 7l6 0l-8 11l0 -7l-6 0l8 -11'],
  // "Verification in progres" banner icon (ref/broker.png, ~40x40 strip under
  // the broker card): a 3/4-ring spinner glyph, near-black stroke, spun via
  // CSS (.scr-broker-pending-icon) so reduced-motion can turn it off cleanly.
  loader: ['M12 3a9 9 0 1 0 9 9'],
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
  /** null while the catalogue is still loading — renders a Skeleton row. */
  value: string | null;
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

// preview.details keys line up with XM_SPECS 1:1 — indexed rather than named
// so a missing/partial payload falls back to XM_SPECS's own value row by row.
const DETAIL_KEYS: readonly string[] = [
  'regulation', 'platform', 'accountTypes', 'leverage', 'depositBonus', 'spread', 'cashbackLevel', 'execution',
];

const REFERRAL_CODE = '45789632'; // fallback until the catalogue has a live preview

export type AccountStatus = 'none' | 'submitted' | 'failed' | 'verified';
export type DepositStatus = 'none' | 'awaiting' | 'submitted' | 'confirmed';
type Modal = 'submit-account' | 'made-deposit' | null;

/** The server's one-axis link state, unfolded onto the screen's two axes. */
const LINK_STATES: Record<MeBrokerLink['state'], readonly [AccountStatus, DepositStatus]> = {
  pending: ['submitted', 'none'],
  rejected: ['failed', 'none'],
  'waiting-for-deposit': ['verified', 'awaiting'],
  'deposit-review': ['verified', 'submitted'],
  // A failed deposit review leaves the account verified — back to "make a deposit".
  'deposit-rejected': ['verified', 'awaiting'],
  'cashback-active': ['verified', 'confirmed'],
};

/** How often an under-review screen asks /api/me whether the admin decided. */
const POLL_MS = 15_000;

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

/** Leave the webview through the Telegram API when it's there, plain window
 *  otherwise. Admins type links bare ("xm.com/…"), so assume https. */
function openExternal(url: string): void {
  const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(href);
  else window.open(href, '_blank', 'noopener');
}

/** How long a self-dismissing status banner stays up, bar included. */
const BANNER_MS = 5000;

// ponytail: per-device memory of "this banner already ran", under the same
// tf.banner.* namespace the Cashback list uses (its own keys — the two screens
// announce separately). Storage throws in some webviews; treat that as unseen.
const seenBanner = (k: string) => { try { return localStorage.getItem(k) === '1'; } catch { return false; } };
const markBannerSeen = (k: string) => { try { localStorage.setItem(k, '1'); } catch { /* private mode */ } };

interface Banner {
  key: string;
  variant: DSNotificationProps['variant'];
  title: string;
  /** Renders the neutral "verification in progres" strip instead of a tinted
   * Notification — ref/broker.png shows a plain #F1F1F1 bg + black spinner +
   * black text, which matches none of the DS Notification variant colors. */
  pending?: boolean;
}

export interface BrokerDetailProps {
  /** Route param — drives getBrokers(); falls back to XM's static specs. */
  brokerId?: string;
  onBack?: () => void;
  /** Dev/test hooks until the broker verification backend lands (spec §4). */
  initialAccountStatus?: AccountStatus;
  initialDepositStatus?: DepositStatus;
}

export default function BrokerDetail({
  brokerId,
  onBack,
  // design/review/ref/broker.png captures the pending state (the "Verification
  // in progres" banner, a green *current* progress dot, a disabled footer CTA)
  // = accountStatus 'submitted'. That is a REVIEW state, not the route's
  // default: a first-time visitor has submitted nothing, so this stays 'none'
  // and the reference state is reached via ?account=submitted.
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
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState<{ email?: string; userId?: string }>({});
  const [netError, setNetError] = useState('');

  // No in-app header (spec D1) — Telegram native BackButton drives onBack.
  useBackButton(onBack);

  // The whole broker catalogue is warmed by the boot splash (App.tsx) before
  // any screen mounts, preview/flow copy included — so this normally reads
  // straight from cache with nothing left to fetch. The live call below only
  // covers a cold cache (a deep link that skipped the splash, e.g. a fresh
  // tab opened straight to this route in dev).
  const [brokers, setBrokers] = useState<Awaited<ReturnType<typeof getBrokers>> | undefined>(() => cachedBrokers());
  const [me, setMe] = useState<Me | null>(() => cachedMe() ?? null);
  useEffect(() => {
    let live = true;
    // The catalogue barely changes, so it's cache-only past the first load —
    // but `me` is the admin's decision on this exact broker. Revalidate it on
    // every visit, or a reject/waiting/approve made while this screen wasn't
    // open (or its 15s poll wasn't running) shows stale state until restart.
    if (cachedBrokers() === undefined) void getBrokers().then((b) => { if (live) setBrokers(b); });
    void getMe().then((m) => { if (live && m) setMe(m); });
    return () => {
      live = false;
    };
  }, []);

  const loading = brokerId != null && brokers === undefined;
  const broker = brokerId ? brokers?.find((b) => b.id === brokerId) : undefined;
  const preview = broker?.preview;
  // The XM_SPECS/REFERRAL_CODE fallback is only for the no-brokerId harness
  // render (design/review deep-links, bare-route previews) — there's nothing
  // else to show. A real route always has a brokerId; while the catalogue is
  // still loading this must NOT borrow XM's specs (that was the "shows
  // fallback data first" bug) — a Skeleton row instead, `null` marks that.
  const specs: readonly Spec[] = XM_SPECS.map((s, i) => ({
    ...s,
    value: preview?.details?.[DETAIL_KEYS[i]] ?? (loading ? null : brokerId ? '—' : s.value),
  }));
  const referralCode = preview?.referralCode ?? (loading ? null : brokerId ? '' : REFERRAL_CODE);
  // Name/logo don't need to wait on the fetch — the catalogue already has
  // them keyed by brokerId, so a known broker renders its own name/logo
  // immediately instead of "XM" flashing before the payload swaps in.
  const catalogueInfo = brokerId ? BROKER_INFO[brokerId] : undefined;
  const brokerName = preview?.name ?? catalogueInfo?.name ?? (loading ? null : 'XM');
  const badgeOn = preview?.badgeOn ?? !brokerId;
  const badgeText = preview?.badgeText ?? 'Popular';
  const badgeColor = preview?.badgeColor;
  // ponytail: no XM fallback — an unknown broker showed XM's mark for a frame
  // before its own arrived. Empty slot until we actually have the logo.
  const logo = broker?.logoUrl ?? catalogueInfo?.logo;
  const myLink = me?.brokers.find((b) => b.brokerId === brokerId);

  /* The server's review state wins over local guesses whenever it exists —
     the harness deep-links (?account=…) have no link and keep their initial
     props. Keyed on the state string so a poll that changes nothing re-renders
     nothing. */
  const linkState = myLink?.state;
  useEffect(() => {
    if (!linkState) return;
    const [acc, dep] = LINK_STATES[linkState];
    setAccountStatus(acc);
    setDepositStatus(dep);
  }, [linkState]);

  // While the admin holds the ball, ask /api/me until the decision lands.
  useEffect(() => {
    if (!brokerId) return;
    if (accountStatus !== 'submitted' && depositStatus !== 'submitted') return;
    const t = window.setInterval(() => {
      // getMe() resolves null on a failed fetch — keep the last good read.
      void getMe().then((m) => { if (m) setMe(m); });
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, [brokerId, accountStatus, depositStatus]);

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
    depositStatus === 'confirmed'
      ? 'make-payment'
      : // ponytail: deposit submitted is still step 2 — step 3 is the accepted deposit
        depositStatus === 'awaiting' || depositStatus === 'submitted'
        ? 'payment-details'
        : 'order-created';
  const hero = heroCopy(depositStatus);
  // Registration link before an account exists, the plain broker link after —
  // either falls back to the other, since admins often fill only one.
  const heroLink = (depositStatus === 'none'
    ? preview?.createAccountLink || preview?.goToBrokerLink
    : preview?.goToBrokerLink || preview?.createAccountLink) ?? '';
  // A resubmit asks for the same fields again — the rejected details are
  // cleared, so hiding the user-ID input left the sheet with nothing in it
  // for a broker that only asks for a user ID.
  const needEmail = preview?.requireEmail ?? true;
  const needUserId = preview?.requireUserId ?? false;

  // Banner titles fall back to the spec-inferred copy (§10.1) only when the
  // broker has no admin-edited flow message for this decision yet; otherwise
  // the operator's own "Manage user flow" text wins (broker.flow, live from
  // getBroker — same admin-editable copy their Telegram DM uses).
  const banners: Banner[] = [];
  if (accountStatus === 'submitted') {
    // Copy measured verbatim from design/review/ref/broker.png: the text is
    // visually cut off at "progres" (no ellipsis) in the reference itself.
    // No admin decision exists yet at this point, so there's no flow entry to read.
    banners.push({ key: 'account-review', variant: 'info', title: 'Verification in progres', pending: true });
  }
  if (accountStatus === 'failed') {
    banners.push({
      key: 'account-failed',
      variant: 'error',
      title: flowTitle(broker?.flow, linkState, 'Account verification failed'),
    });
  }
  if (linkState === 'waiting-for-deposit') {
    // The admin's "waiting for deposit" decision IS the account-verified news.
    banners.push({
      key: 'account-verified',
      variant: 'success',
      title: flowTitle(broker?.flow, linkState, 'Account verified'),
    });
  }
  if (linkState === 'deposit-review') {
    // Same "under review" beat as a submitted account — no admin decision yet,
    // so no flow entry to read.
    banners.push({ key: 'deposit-review', variant: 'info', title: 'Verification in progres', pending: true });
  }
  if (linkState === 'deposit-rejected') {
    banners.push({
      key: 'deposit-failed',
      variant: 'error',
      title: flowTitle(broker?.flow, linkState, 'Deposit confirmation failed'),
    });
  }
  if (linkState === 'cashback-active') {
    // The list announces this one too — the detail screen must not stay silent
    // just because its hero already says "Cashback activated".
    banners.push({
      key: 'deposit-confirmed',
      variant: 'success',
      title: flowTitle(broker?.flow, linkState, 'Deposit confirmed'),
    });
  }
  /* Same rule as the Cashback list: an outcome banner is news. Once it has
     announced itself on this device it must not greet the user again on every
     visit — failures included.
     `requestedAt` is in the key because the server restamps it on every
     re-entry into review: a second rejection is a second piece of news, not the
     one already dismissed. */
  const bannerSeenKey = (k: string) => `tf.banner.${brokerId ?? 'xm'}:${myLink?.requestedAt ?? ''}:${k}`;
  const visibleBanners = banners.filter(
    (b) => !dismissed.includes(b.key) && (b.pending || !seenBanner(bannerSeenKey(b.key))),
  );

  const cta =
    depositStatus === 'none'
      ? { label: 'Submit account', modal: 'submit-account' as const } // ref: capital S
      : depositStatus === 'awaiting'
        ? { label: 'i made a deposit', modal: 'made-deposit' as const }
        // 'submitted' is under review — nothing left to press until the admin decides.
        : null;

  const copyReferral = (): void => {
    if (!referralCode) return;
    navigator.clipboard?.writeText(referralCode).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const openModal = (which: Modal): void => {
    setFieldError({});
    setNetError('');
    // Rejected details were wrong — start blank rather than re-offering them.
    if (which === 'submit-account') { setEmail(''); setUserId(''); }
    setModal(which);
  };

  const submitAccount = (): void => {
    const errs: { email?: string; userId?: string } = {};
    if (needEmail && !/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address';
    if (needUserId && !userId.trim()) errs.userId = 'Enter your broker user ID';
    setFieldError(errs);
    if (errs.email || errs.userId) return;
    if (!brokerId) {
      // Bare-route harness render — no server, keep the local preview behaviour.
      setAccountStatus('submitted');
      setDismissed([]);
      setModal(null);
      return;
    }
    setBusy(true);
    submitBrokerAccount(brokerId, { email: email.trim(), brokerAccountId: userId.trim() || undefined })
      .then((brokers) => {
        const patch = (m: Me | null) => (m ? { ...m, brokers } : m);
        setMe(patch);
        setCachedMe(patch);
        setDismissed([]);
        setModal(null);
      })
      .catch(() => setNetError('Could not submit — please try again'))
      .finally(() => setBusy(false));
  };

  const confirmDeposit = (): void => {
    if (!brokerId) {
      setDepositStatus('submitted');
      setDismissed([]);
      setModal(null);
      return;
    }
    setBusy(true);
    confirmBrokerDeposit(brokerId)
      .then((brokers) => {
        const patch = (m: Me | null) => (m ? { ...m, brokers } : m);
        setMe(patch);
        setCachedMe(patch);
        setDismissed([]);
        setModal(null);
      })
      .catch(() => setNetError('Could not submit — please try again'))
      .finally(() => setBusy(false));
  };

  const scrollFocusedIntoView = (e: FocusEvent<HTMLDivElement>): void => {
    (e.target as HTMLElement).scrollIntoView?.({ block: 'nearest' });
  };

  const displayEmail = email || myLink?.email || '—';
  const displayUserId = userId || myLink?.brokerAccountId || '—';

  return (
    <div className="scr-broker">
      <main className="scr-broker-body">
        {/* Broker card: name row + 0..2 dismissible notification banners */}
        <section className="scr-broker-card">
          <div className="scr-broker-card-row">
            <div className="scr-broker-card-left">
              {logo ? (
                <img className="scr-broker-logo" src={logo} alt={brokerName ?? ''} width={32} height={32} />
              ) : loading ? (
                <Skeleton className="scr-broker-logo" />
              ) : (
                <span className="scr-broker-logo" />
              )}
              {brokerName ? (
                <span className="scr-broker-name">{brokerName}</span>
              ) : (
                <Skeleton className="scr-broker-name-skeleton" />
              )}
            </div>
            {badgeOn ? (
              <span
                className="scr-broker-popular"
                style={badgeColor ? { background: `${badgeColor}22`, color: badgeColor } : undefined}
              >
                {badgeText}
              </span>
            ) : null}
          </div>
          {visibleBanners.map((b) =>
            b.pending ? (
              <div key={b.key} className="scr-broker-pending-banner" role="status">
                <span className="scr-broker-pending-icon">
                  <Glyph name="loader" size={20} />
                </span>
                <span className="scr-broker-pending-title">{b.title}</span>
              </div>
            ) : (
              <Notification
                key={b.key}
                variant={b.variant}
                title={b.title}
                /* Every outcome — verified, failed — is news, not state: it
                   announces itself, drains its bar and goes. What to do next
                   is the hero's job, not the banner's. */
                autoDismiss={BANNER_MS}
                onClose={() => {
                  markBannerSeen(bannerSeenKey(b.key));
                  setDismissed((d) => [...d, b.key]);
                }}
                // ref shows icon + text + drain bar only — no close button
                // (the pending banner above never had one either).
                hideClose
              />
            ),
          )}
        </section>

        {/* Blue onboarding hero */}
        <section className="scr-broker-hero">
          <ProgressBar current={progress} className="scr-broker-stepper" />

          <div className="scr-broker-hero-text">
            <h2 className="scr-broker-hero-title">{hero.title}</h2>
            <p className="scr-broker-hero-sub">{hero.subtitle}</p>
          </div>

          <div className="scr-broker-hero-block">
            {loading ? (
              <div className="scr-broker-referral">
                <span className="scr-broker-referral-label">referral code</span>
                <Skeleton className="scr-broker-referral-code-skeleton" />
              </div>
            ) : (
              referralCode && (
                <div className="scr-broker-referral">
                  <span className="scr-broker-referral-label">referral code</span>
                  <button
                    className="scr-broker-referral-code"
                    type="button"
                    onClick={copyReferral}
                    aria-label={copied ? 'Copied' : 'Copy referral code'}
                  >
                    {referralCode}
                  </button>
                </div>
              )
            )}
            <button
              className="scr-broker-linkbtn"
              type="button"
              disabled={!heroLink}
              onClick={() => heroLink && openExternal(heroLink)}
            >
              <span className="scr-broker-linkbtn-label">{hero.actionLabel}</span>
              <Glyph name="external" size={20} strokeWidth={1.5} />
            </button>
          </div>
        </section>

        {/* Broker details spec list */}
        <section className="scr-broker-details">
          <h3 className="scr-broker-details-title">Broker details</h3>
          {specs.map((s) => (
            <div className="scr-broker-spec" key={s.label}>
              <span className="scr-broker-spec-left">
                <Glyph name={s.icon} size={20} />
                <span className="scr-broker-spec-label">{s.label}</span>
              </span>
              {s.value === null ? (
                <Skeleton className="scr-broker-spec-value-skeleton" />
              ) : (
                <span className="scr-broker-spec-value">{s.value}</span>
              )}
            </div>
          ))}
        </section>
      </main>

      {/* Sticky bottom CTA — S1 & S2; stays visible but disabled once the deposit is under review */}
      {cta ? (
        <footer className="scr-broker-footer">
          <Button
            variant="primary"
            size="medium"
            fullWidth
            // ref: while accountStatus='submitted' or depositStatus='submitted' the CTA
            // renders in the DS disabled style (grey #E4E4E4 bg / #7C7C7C text) — can't
            // resubmit an account, or a deposit, that's already under review.
            disabled={accountStatus === 'submitted' || depositStatus === 'submitted'}
            iconRight={<Icon name="chevron-right" size={20} />}
            onClick={() => openModal(cta.modal)}
          >
            {cta.label}
          </Button>
        </footer>
      ) : null}

      {/* Submit-account sheet — the inputs the broker asks for (email, user ID, or both) */}
      <BottomSheet open={modal === 'submit-account'} onClose={() => setModal(null)} className="scr-broker-sheet">
        <div className="scr-broker-sheet-inner" onFocus={scrollFocusedIntoView}>
          <div className="scr-broker-sheet-content">
            <div className="scr-broker-sheet-head">
              <div className="scr-broker-sheet-titledesc">
                <div className="scr-broker-sheet-titlerow">
                  <h2 className="scr-broker-sheet-title">Submit account details</h2>
                  <button className="scr-broker-sheet-close" type="button" onClick={() => setModal(null)} aria-label="Close">
                    <Glyph name="close" size={24} />
                  </button>
                </div>
                <p className="scr-broker-sheet-desc">
                  {needEmail
                    ? 'please send us the email you used to register with your broker'
                    : 'please send us the user ID of the account you registered with your broker'}
                </p>
              </div>
              <hr className="scr-broker-sheet-divider" />
            </div>

            <div className="scr-broker-fields">
              {needEmail ? (
                <Input
                  value={email}
                  onChange={(v) => { setEmail(v); setFieldError((e) => ({ ...e, email: undefined })); }}
                  placeholder="Enter your Email address"
                  error={fieldError.email}
                  onSubmit={submitAccount}
                />
              ) : null}
              {needUserId ? (
                <Input
                  value={userId}
                  onChange={(v) => { setUserId(v); setFieldError((e) => ({ ...e, userId: undefined })); }}
                  placeholder="Enter your user ID"
                  error={fieldError.userId}
                  onSubmit={submitAccount}
                />
              ) : null}
              {netError ? <Notification variant="error" title={netError} onClose={() => setNetError('')} /> : null}
            </div>
          </div>

          {/* Sticky within the sheet's own scroller, same as the page CTA
              — unreachable-without-scrolling was the same bug here once the
              keyboard clamp shrinks the sheet. Hidden while a field has focus
              (index.css `body.is-typing footer`), else it sits on top of the
              input being typed into. */}
          <footer className="scr-broker-sheet-footer">
            <Button
              variant="primary"
              size="medium"
              fullWidth
              disabled={busy}
              iconRight={<Icon name="chevron-right" size={20} />}
              onClick={submitAccount}
            >
              submit account
            </Button>
          </footer>
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
                    <Glyph name="close" size={24} />
                  </button>
                </div>
                <p className="scr-broker-sheet-desc">great! please confirm your deposit so we can review your account</p>
              </div>
              <hr className="scr-broker-sheet-divider" />
            </div>

            <div className="scr-broker-readcard">
              <div className="scr-broker-readrow">
                <Glyph name="mail" size={20} />
                <div className="scr-broker-readrow-text">
                  <span className="scr-broker-readrow-label">Email address</span>
                  <span className="scr-broker-readrow-value">{displayEmail}</span>
                </div>
              </div>
              <div className="scr-broker-readrow">
                <Glyph name="user" size={20} />
                <div className="scr-broker-readrow-text">
                  <span className="scr-broker-readrow-label">User ID</span>
                  <span className="scr-broker-readrow-value">{displayUserId}</span>
                </div>
              </div>
            </div>
            {netError ? <Notification variant="error" title={netError} onClose={() => setNetError('')} /> : null}
          </div>

          <footer className="scr-broker-sheet-footer">
            <Button
              variant="primary"
              size="medium"
              fullWidth
              disabled={busy}
              iconRight={<Icon name="chevron-right" size={20} />}
              onClick={confirmDeposit}
            >
              i made a deposit
            </Button>
          </footer>
        </div>
      </BottomSheet>
    </div>
  );
}
