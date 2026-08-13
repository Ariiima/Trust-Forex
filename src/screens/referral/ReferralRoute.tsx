import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cachedFlags, getFlags, getMyReferral, getReferrals, setFlag, type MyReferral } from '../../api/client';
import type { NavigationTab } from '../../design-system/components';
import ReferralPreview from './ReferralPreview';
import ReferralMain from './ReferralMain';
import type { Referral } from './ReferralMain';

/** "2026-09-12" or an epoch-ms string -> "September 12, 2026", the copy
 *  ReferralMain's sort and layer names both expect. Unparseable dates render
 *  as-is rather than "Invalid Date". */
function formatJoined(raw: string): string {
  const d = new Date(/^\d+$/.test(raw) ? Number(raw) : raw);
  return Number.isNaN(d.getTime())
    ? raw
    : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/* The intro (1333:8306) is shown once per ACCOUNT, so the "seen" bit lives on
 * the server (GET/POST /api/me/flags) rather than in localStorage. Until the
 * flag lands we hold on the page background — a flash of the intro to a
 * returning user is worse than a plain frame for one tick, but a *blank* frame
 * flashes white through the layout, so it has to be the real background. Only
 * the very first visit of a session waits at all; after that `cachedFlags`
 * seeds the state and there is nothing to wait for. */
export function ReferralRoute({
  onNavigate,
  force,
  initialSheet,
}: {
  onNavigate?: (tab: NavigationTab) => void;
  /** Review deep-link: bypass the server flag and pin a state. */
  force?: 'preview' | 'main' | 'empty';
  initialSheet?: 'about';
}): ReactNode {
  const [seen, setSeen] = useState<boolean | null>(() =>
    force ? force !== 'preview' : (cachedFlags()?.includes('referral_preview_seen') ?? null),
  );
  /* The account's own referral code. The links are useless without it — the
     screen used to render two empty "copy" rows. */
  const [mine, setMine] = useState<MyReferral | null>(null);
  const [referrals, setReferrals] = useState<Referral[]>();

  useEffect(() => {
    if (force) return;
    let live = true;
    getFlags()
      .then((flags) => live && setSeen(flags.includes('referral_preview_seen')))
      .catch(() => live && setSeen(true)); // API down: don't trap the user on the intro
    return () => {
      live = false;
    };
  }, [force]);

  useEffect(() => {
    let live = true;
    getMyReferral().then((r) => live && setMine(r)).catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  useEffect(() => {
    let live = true;
    getReferrals()
      .then((rows) => live && setReferrals(rows.map((r): Referral => (
        { id: r.id, joined: formatJoined(r.joinedAt), plan: r.plan, cashback: r.cashback }
      ))))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  if (seen === null) return <div className="scr-route-hold" />;

  if (!seen) {
    return (
      <ReferralPreview
        onStartInviting={() => {
          setSeen(true);
          void setFlag('referral_preview_seen');
        }}
      />
    );
  }

  return (
    <ReferralMain
      /* `force` only ever arrives from design/review's own deep link
         (`?state=main|empty`) — a real visit always renders its own
         /api/me/referrals list, never invented rows. */
      referrals={referrals ?? []}
      telegramLink={mine?.botLink ?? ''}
      websiteLink={mine?.websiteLink ?? ''}
      initialSheet={initialSheet}
      onNavigate={onNavigate}
    />
  );
}

export default ReferralRoute;
