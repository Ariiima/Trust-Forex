import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { getFlags, setFlag } from '../../api/client';
import type { NavigationTab } from '../../design-system/components';
import ReferralPreview from './ReferralPreview';
import ReferralMain from './ReferralMain';
import { REFERRALS } from './referral-data';

/* The intro (1333:8306) is shown once per ACCOUNT, so the "seen" bit lives on
 * the server (GET/POST /api/me/flags) rather than in localStorage. While the
 * flag is loading we render nothing — a flash of the intro to a returning user
 * is worse than a blank frame for one tick. */
export function ReferralRoute({ onNavigate }: { onNavigate?: (tab: NavigationTab) => void }): ReactNode {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let live = true;
    getFlags()
      .then((flags) => live && setSeen(flags.includes('referral_preview_seen')))
      .catch(() => live && setSeen(true)); // API down: don't trap the user on the intro
    return () => {
      live = false;
    };
  }, []);

  if (seen === null) return null;

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

  return <ReferralMain referrals={REFERRALS} onNavigate={onNavigate} />;
}

export default ReferralRoute;
