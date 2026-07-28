import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon, NavigationBar } from '../../design-system/components';
import type { NavigationTab } from '../../design-system/components';
import { Glyph } from './Glyph';
import type { ReferralGlyphName } from './Glyph';
import { PromoCarousel } from '../home/PromoCarousel';
import './ReferralMain.css';

/* ---------------------------------------------------------------------------
 * Referral — main page — route /referral
 * Frame 1333:8366 (360x1266). Blue earnings card (16,92 -> 328x396) holding a
 * 2x2 stat grid and the two copyable links, the shared promo carousel
 * (16,512 -> 328x110), then the "Your referrals" list (16,646 -> 328x508).
 * Variants 1408:2763 (same height) and 1436:14439 (978 tall = empty list).
 * ------------------------------------------------------------------------- */

export interface Referral {
  id: string;
  joined: string;
  plan: number;
  cashback: number;
}

interface Stat {
  icon: ReferralGlyphName;
  label: string;
  value: string;
  delta?: string;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export interface ReferralMainProps {
  totalEarnings?: number;
  sharePct?: number;
  invitedUsers?: number;
  invitedDelta?: number;
  activeUsers?: number;
  planEarnings?: number;
  cashbackEarnings?: number;
  referrals?: readonly Referral[];
  telegramLink?: string;
  websiteLink?: string;
  onNavigate?: (tab: NavigationTab) => void;
  onAbout?: () => void;
}

export function ReferralMain({
  totalEarnings = 245,
  sharePct = 10,
  invitedUsers = 42,
  invitedDelta = 2,
  activeUsers = 22,
  planEarnings = 180,
  cashbackEarnings = 65,
  referrals = [],
  telegramLink = '',
  websiteLink = '',
  onNavigate,
  onAbout,
}: ReferralMainProps): ReactNode {
  const [copied, setCopied] = useState<'telegram' | 'website' | null>(null);
  // null = as-delivered order, which is what frame 1333:8366 shows even though
  // the control is labelled "Highest earnings". Sorting starts on first tap.
  const [sortDesc, setSortDesc] = useState<boolean | null>(null);

  const copy = async (which: 'telegram' | 'website', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* clipboard blocked (non-secure context) — the link stays selectable */
    }
  };

  const stats: readonly Stat[] = [
    { icon: 'user-receive', label: 'Invited users', value: String(invitedUsers), delta: `+${invitedDelta}` },
    { icon: 'user-check', label: 'Active users', value: String(activeUsers) },
    { icon: 'shopping-bag', label: 'Plan earnings', value: money(planEarnings) },
    { icon: 'cash', label: 'Cashback earnings', value: money(cashbackEarnings) },
  ];

  const total = (r: Referral) => r.plan + r.cashback;
  const sorted =
    sortDesc === null
      ? referrals
      : [...referrals].sort((a, b) => (sortDesc ? total(b) - total(a) : total(a) - total(b)));

  return (
    <div className="scr-refmain">
      <section className="scr-refmain-card">
        <div className="scr-refmain-card-top">
          <div className="scr-refmain-head">
            <h1 className="scr-refmain-head-title type-text-base">Total referral earnings</h1>
            <button type="button" className="scr-refmain-info" onClick={onAbout} aria-label="About referral">
              <Icon name="info" size={24} strokeWidth={1.6} />
            </button>
          </div>

          <div className="scr-refmain-amount-row">
            <span className="scr-refmain-amount type-text-2xl-bold">{money(totalEarnings)}</span>
            <div className="scr-refmain-share">
              <div className="scr-refmain-share-top">
                <span className="scr-refmain-share-coin" aria-hidden="true" />
                <span className="scr-refmain-share-pct type-text-base-bold">{sharePct}%</span>
              </div>
              <span className="scr-refmain-share-label type-text-xs-10">Referral share</span>
            </div>
          </div>
        </div>

        <hr className="scr-refmain-rule" />

        <ul className="scr-refmain-stats">
          {stats.map((s) => (
            <li key={s.label} className="scr-refmain-stat">
              <span className="scr-refmain-stat-badge">
                <Glyph name={s.icon} size={18} />
              </span>
              <span className="scr-refmain-stat-text">
                <span className="scr-refmain-stat-label type-text-xs-10">{s.label}</span>
                <span className="scr-refmain-stat-value-row">
                  <span className="scr-refmain-stat-value type-text-base-bold">{s.value}</span>
                  {s.delta ? (
                    <span className="scr-refmain-stat-delta type-text-xs">
                      <Icon name="arrow-up" size={16} strokeWidth={2} />
                      {s.delta}
                    </span>
                  ) : null}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div className="scr-refmain-links">
          <div className="scr-refmain-head">
            <h2 className="scr-refmain-head-title type-text-base">Copy your referral link</h2>
            <button type="button" className="scr-refmain-info" onClick={onAbout} aria-label="About referral links">
              <Icon name="info" size={20} strokeWidth={1.6} />
            </button>
          </div>

          {(
            [
              { key: 'telegram' as const, icon: 'send' as const, label: 'Telegram link', value: telegramLink },
              { key: 'website' as const, icon: 'globe' as const, label: 'Website link', value: websiteLink },
            ]
          ).map((l) => (
            <div key={l.key} className="scr-refmain-link">
              <span className="scr-refmain-link-main">
                <Glyph name={l.icon} size={20} className="scr-refmain-link-icon" />
                <span className="scr-refmain-link-label type-text-sm-semibold">{l.label}</span>
              </span>
              <button type="button" className="scr-refmain-copy" onClick={() => copy(l.key, l.value)}>
                <span className="type-text-xs">{copied === l.key ? 'Copied' : 'Copy'}</span>
                <Glyph name="copy" size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <PromoCarousel start={1} />

      <section className="scr-refmain-list-card">
        <div className="scr-refmain-list-head">
          <h2 className="scr-refmain-list-title type-text-base-semibold">Your referrals</h2>
          <button type="button" className="scr-refmain-sort" onClick={() => setSortDesc((v) => v === false)}>
            <Glyph name="swap-vertical" size={16} />
            <span className="type-text-xs">{sortDesc === false ? 'Lowest earnings' : 'Highest earnings'}</span>
          </button>
        </div>

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
      </section>

      <NavigationBar active="referral" onChange={onNavigate} className="scr-refmain-nav" />
    </div>
  );
}

export default ReferralMain;
