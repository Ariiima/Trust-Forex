import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { Glyph } from './Glyph';
import type { ReferralGlyphName } from './Glyph';
import { PromoCarousel } from '../home/PromoCarousel';
import { AboutReferralSheet } from './AboutReferralSheet';
import { EarningsGlyph } from './EarningsGlyph';
import { useSeenValue } from '../../design-system/useCountUp';
import { useScrollRail } from '../../design-system/useScrollRail';
import { cachedMe, getMe } from '../../api/client';
import shareCoin from '../../assets/referral/referral-share-coin.png';
import './ReferralMain.css';

/* ---------------------------------------------------------------------------
 * Referral — main page — route /referral
 * Frame 1333:8366 (360x1266, 76px of that is chrome the app does not draw, so
 * every y below is frame-y minus 76). Blue earnings card (16,16 -> 328x396)
 * holding a 2x2 stat grid and the two copyable links, the shared promo carousel
 * (16,436 -> 328x110), then the "Your referrals" card (16,570 -> 328x508) whose
 * list scrolls inside a 296x428 viewport.
 * Variants 1408:2763 (same height) and 1436:14439 (978 tall = empty list).
 * ------------------------------------------------------------------------- */

export interface Referral {
  id: string;
  joined: string;
  plan: number;
  cashback: number;
}

interface Stat {
  /** A pack icon, or one of the two composites the pack has no equivalent for. */
  icon: ReferralGlyphName | { earnings: 'plan' | 'cashback' };
  label: string;
  value: string;
  delta?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

/** Clipboard for non-secure contexts. Returns whether the copy actually took. */
function legacyCopy(value: string): boolean {
  const ta = document.createElement('textarea');
  ta.value = value;
  ta.setAttribute('readonly', '');
  // Off-screen but still focusable — display:none would not be selectable.
  ta.style.cssText = 'position:fixed;top:0;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  document.body.removeChild(ta);
  return ok;
}

export interface ReferralMainProps {
  totalEarnings?: number;
  sharePct?: number;
  invitedUsers?: number;
  invitedDelta?: number;
  activeUsers?: number;
  planEarnings?: number;
  cashbackEarnings?: number;
  referrals?: readonly Referral[];
  /** Review deep-link: open the About sheet on mount. */
  initialSheet?: 'about';
  telegramLink?: string;
  websiteLink?: string;
  onNavigate?: (tab: NavigationTab) => void;
  onAbout?: () => void;
}

export function ReferralMain({
  totalEarnings: totalEarningsDefault = 0,
  sharePct: sharePctDefault = 10,
  invitedUsers: invitedUsersDefault = 0,
  invitedDelta = 0,
  activeUsers: activeUsersDefault = 0,
  planEarnings: planEarningsDefault = 0,
  cashbackEarnings: cashbackEarningsDefault = 0,
  referrals = [],
  initialSheet,
  telegramLink = '',
  websiteLink = '',
  onNavigate,
  onAbout,
}: ReferralMainProps): ReactNode {
  /* Zeros render immediately; /api/me swaps the real figures in. cachedMe()
     seeds this synchronously so a tab switch (which remounts the screen)
     doesn't re-fetch and visibly re-swap the numbers. */
  const [live, setLive] = useState(() => cachedMe()?.referral ?? null);
  useEffect(() => {
    if (cachedMe()) return;
    let alive = true;
    void getMe().then((me) => alive && setLive(me?.referral ?? null));
    return () => {
      alive = false;
    };
  }, []);

  const invitedUsers = live?.invited ?? invitedUsersDefault;
  const activeUsers = live?.active ?? activeUsersDefault;
  /* `earned` is the user's cut; `plan` + `cashback` are what their referrals
     generated for the platform (they sum to `revenue`, the admin's own
     "Our Monthly Revenue"). This screen is the user's, so the headline is what
     they earned and the two tiles split it in the same proportion — quoting the
     platform's revenue under "Total referral earnings" would overstate what the
     user is owed by the whole margin. */
  const generated = (live?.plan ?? 0) + (live?.cashback ?? 0);
  const totalEarnings = live ? live.earned : totalEarningsDefault;
  const planEarnings = live
    ? (generated ? (live.earned * live.plan) / generated : 0)
    : planEarningsDefault;
  const cashbackEarnings = live
    ? (generated ? (live.earned * live.cashback) / generated : 0)
    : cashbackEarningsDefault;
  // The commission rate itself is one pair; the badge shows the plan rate.
  const sharePct = live?.share ? Math.round(live.share.planPct) : sharePctDefault;

  /* Figures render at their real value straight away — rolling them up from
     zero made the card read as "loading" every single visit for information
     that is not new. What animates is only the change: the green +N chip, which
     is the part the user has not seen before.

     On a first visit there is no baseline to difference against, so the chip
     falls back to the server's own figure — which is also what frame 1333:8366
     renders. After that it is the real "since you last looked" increment, and
     it disappears once seen. */
  const invited = useSeenValue('referral.invited', invitedUsers);
  const invitedDeltaShown = invited.firstVisit ? invitedDelta : invited.delta;

  const [copied, setCopied] = useState<'telegram' | 'website' | null>(null);
  const [aboutOpen, setAboutOpen] = useState(initialSheet === 'about');
  const [sortBy, setSortBy] = useState<'earnings' | 'newest'>('earnings');
  const [listRef, railThumb] = useScrollRail<HTMLDivElement>();

  /* Client design call, no Figma frame: the second info button (over the
     copyable links) shows a one-line tooltip instead of opening the About
     sheet. Dismissal matches Home's "Choose your plan" info callout (see
     Home.tsx's ChoosePlanSection tipOpen effect) — any scroll or tap outside
     the button closes it. Hover is layered on top of that, not a replacement
     for it: this is a touch app, but hover lets the tooltip be reached with a
     mouse during desktop testing. */
  const [linkTipTapped, setLinkTipTapped] = useState(false);
  const [linkTipHovered, setLinkTipHovered] = useState(false);
  const linkTipShown = linkTipTapped || linkTipHovered;
  const linkTipRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!linkTipTapped) return;
    const close = (e: Event): void => {
      if (linkTipRef.current?.contains(e.target as Node)) return;
      // Page scrolls only — this screen has the auto-advancing promo carousel
      // too; see the long note on Home's info callout.
      if (e.type === 'scroll' && !(e.target as Node | null)?.contains?.(linkTipRef.current)) return;
      setLinkTipTapped(false);
    };
    document.addEventListener('pointerdown', close, true);
    // Armed a beat late, same guard as Home's callout: an insertion that
    // nudges the page would otherwise fire a scroll that closes this on the
    // same tick it opened.
    const arm = setTimeout(() => document.addEventListener('scroll', close, true), 150);
    return () => {
      clearTimeout(arm);
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
    };
  }, [linkTipTapped]);

  /* navigator.clipboard exists only in a secure context. This was served over
     plain http for a while, where it throws — and the old catch swallowed that,
     so the button never acknowledged the tap. The site is on https now, so this
     path is the one that runs; the execCommand fallback stays because it is the
     only thing that works if it is ever served over http again. */
  const copy = async (which: 'telegram' | 'website', value: string) => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(value);
      ok = true;
    } catch {
      ok = legacyCopy(value);
    }
    if (!ok) return;
    setCopied(which);
    setTimeout(() => setCopied(null), 1500);
  };

  const stats: readonly Stat[] = [
    {
      icon: 'user-receive',
      label: 'Invited users',
      value: String(invitedUsers),
      delta: invitedDeltaShown > 0 ? `+${invitedDeltaShown}` : undefined,
    },
    { icon: 'user-check', label: 'Active users', value: String(activeUsers) },
    { icon: { earnings: 'plan' }, label: 'Plan earnings', value: money(planEarnings) },
    { icon: { earnings: 'cashback' }, label: 'Cashback earnings', value: money(cashbackEarnings) },
  ];

  const total = (r: Referral) => r.plan + r.cashback;
  // "Sep 12,2026" — the comma trips strict parsers, so normalise it. Anything
  // unparseable sorts to the bottom rather than scrambling the list with NaN.
  const joinedAt = (r: Referral) => Date.parse(r.joined.replace(',', ' ')) || 0;
  const sorted = [...referrals].sort((a, b) =>
    sortBy === 'newest' ? joinedAt(b) - joinedAt(a) : total(b) - total(a),
  );

  return (
    <div className="scr-refmain">
      <section className="scr-refmain-card">
        <div className="scr-refmain-head">
          <h1 className="scr-refmain-head-title type-text-sm">Total referral earnings</h1>
          <button
            type="button"
            className="ds-info-btn ds-info-btn--on-dark"
            onClick={onAbout ?? (() => setAboutOpen(true))}
            aria-label="About referral"
          >
            <Icon name="info" size={20} />
          </button>
        </div>

        <div className="scr-refmain-amount-row">
          <span className="scr-refmain-amount type-text-2xl-semibold">{money(totalEarnings)}</span>
          <div className="scr-refmain-share">
            <div className="scr-refmain-share-top">
              {/* 1429:14241 is a raster badge in Figma — cropped 1:1 out of the frame. */}
              <img className="scr-refmain-share-coin" src={shareCoin} alt="" width={24} height={24} />
              <span className="scr-refmain-share-pct type-text-base-semibold">{sharePct}%</span>
            </div>
            <span className="scr-refmain-share-label type-text-xs-10">Referral share</span>
          </div>
        </div>

        <div className="scr-refmain-rule" />

        <ul className="scr-refmain-stats">
          {stats.map((s) => (
            <li key={s.label} className="scr-refmain-stat">
              <span className="scr-refmain-stat-badge">
                {typeof s.icon === 'string' ? (
                  <Glyph name={s.icon} size={18} />
                ) : (
                  <EarningsGlyph kind={s.icon.earnings} size={18} />
                )}
              </span>
              <span className="scr-refmain-stat-text">
                <span className="scr-refmain-stat-label type-text-xs-10">{s.label}</span>
                <span className="scr-refmain-stat-value-row">
                  <span className="scr-refmain-stat-value type-text-sm-semibold">{s.value}</span>
                  {s.delta ? (
                    <span className="scr-refmain-stat-delta type-text-xs">
                      <Icon name="arrow-up" size={16} />
                      {s.delta}
                    </span>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="scr-refmain-links">
          <div className="scr-refmain-head scr-refmain-links-head">
            <h2 className="scr-refmain-head-title type-text-sm">Copy your referral link</h2>
            <button
              type="button"
              ref={linkTipRef}
              className="ds-info-btn ds-info-btn--on-dark"
              aria-label="Referral link info"
              onClick={() => setLinkTipTapped((v) => !v)}
              onMouseEnter={() => setLinkTipHovered(true)}
              onMouseLeave={() => setLinkTipHovered(false)}
            >
              <Icon name="info" size={20} />
            </button>
            {linkTipShown ? (
              <div className="scr-refmain-linktip" role="tooltip">
                Choose how friends start; both links track referrals.
              </div>
            ) : null}
          </div>

          {(
            [
              { key: 'telegram' as const, icon: 'send' as const, stroke: 1.34, label: 'Telegram link', value: telegramLink },
              { key: 'website' as const, icon: 'globe' as const, stroke: 1.42, label: 'Website link', value: websiteLink },
            ]
          ).map((l) => (
            <div key={l.key} className="scr-refmain-link">
              <span className="scr-refmain-link-main">
                <Glyph name={l.icon} size={20} strokeWidth={l.stroke} className="scr-refmain-link-icon" />
                <span className="scr-refmain-link-label type-text-sm">{l.label}</span>
              </span>
              <button
                type="button"
                className={'scr-refmain-copy' + (copied === l.key ? ' scr-refmain-copy--done' : '')}
                onClick={() => copy(l.key, l.value)}
              >
                {/* The label stays put; only the glyph acknowledges the copy,
                    so the button never changes width under the finger. Both
                    icons stay mounted and cross-fade via CSS (below) rather
                    than one replacing the other, which read as a snap. */}
                <span className="type-text-xs">Copy</span>
                <span className="scr-refmain-copy-icon">
                  <Glyph name="copy" size={16} className="scr-refmain-copy-icon-copy" />
                  <Glyph name="check" size={16} className="scr-refmain-copy-icon-check" />
                </span>
              </button>
            </div>
          ))}
        </div>
      </section>

      <PromoCarousel start={1} section="referral" />

      <section
        className={'scr-refmain-list-card' + (referrals.length === 0 ? ' scr-refmain-list-card--empty' : '')}
      >
        <div className="scr-refmain-list-head">
          <h2 className="scr-refmain-list-title type-text-base">Your referrals</h2>
          {/* Empty variant 1436:14439 drops the sort control entirely — there is
              nothing to order, so the head row is title-only. */}
          {referrals.length > 0 ? (
            <button
              type="button"
              className="scr-refmain-sort"
              onClick={() => setSortBy((v) => (v === 'earnings' ? 'newest' : 'earnings'))}
            >
              <Glyph name="swap-vertical" size={16} />
              <span className="type-text-xs">
                {sortBy === 'newest' ? 'Newest users' : 'Highest earnings'}
              </span>
            </button>
          ) : null}
        </div>

        {referrals.length === 0 ? (
          // Empty variant 1436:14439 — the list is replaced by three centred lines.
          <p className="scr-refmain-empty type-text-sm">
            You have no referrals yet, share your link to invite your first friend and start earning together.
          </p>
        ) : (
          <div className="scr-refmain-list-port">
            <div className="scr-refmain-list-scroll" ref={listRef}>
              <ul className="scr-refmain-referrals">
              {sorted.map((r) => (
                <li key={r.id} className="scr-refmain-referral">
                  <div className="scr-refmain-referral-top">
                    <span className="scr-refmain-referral-id">
                      <Glyph name="user" size={16} />
                      <span className="type-text-xs">{r.id}</span>
                    </span>
                    <span className="scr-refmain-referral-joined type-text-xs-10">Joined {r.joined}</span>
                  </div>
                  <div className="scr-refmain-referral-cols">
                    {[
                      { label: 'Plan', value: money(r.plan) },
                      { label: 'Cashback', value: money(r.cashback) },
                      // Green only when there is something to show — 1003's $0.00
                      // stays default-coloured in the frame.
                      { label: 'Total', value: money(total(r)), strong: total(r) > 0 },
                    ].map((c) => (
                      <span key={c.label} className="scr-refmain-referral-col">
                        <span className="scr-refmain-referral-col-label type-text-xs-10">{c.label}</span>
                        <span
                          className={
                            'scr-refmain-referral-col-value type-text-xs' +
                            (c.strong ? ' scr-refmain-referral-col-value--total' : '')
                          }
                        >
                          {c.value}
                        </span>
                      </span>
                    ))}
                  </div>
                </li>
              ))}
              </ul>
            </div>
            <span className="scr-refmain-list-rail" aria-hidden="true">
              <span className="scr-refmain-list-thumb" style={railThumb} />
            </span>
          </div>
        )}
      </section>

      <AboutReferralSheet open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <NavigationBar active="referral" onChange={onNavigate} className="ds-navbar-floating" />
    </div>
  );
}

export default ReferralMain;
