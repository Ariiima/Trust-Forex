import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cachedFlags, getFlags, setFlag } from '../../api/client';
import type { NavigationTab } from '../../design-system/components';
import CashbackPreview from './CashbackPreview';
import Cashback from './Cashback';
import type { BrokerId } from './brokers-data';

/* The intro (850:1913) is shown once per ACCOUNT, so the "seen" bit lives on
 * the server (GET/POST /api/me/flags) rather than in localStorage. Same
 * contract as ReferralRoute, including the cached-flag seed and the
 * background-coloured hold instead of a blank frame — see the note there. */
export function CashbackRoute({
  onNavigate,
  onOpenBroker,
  onUpgradePlan,
  force,
  initialSheet,
}: {
  onNavigate?: (tab: NavigationTab) => void;
  onOpenBroker?: (brokerId: BrokerId) => void;
  onUpgradePlan?: () => void;
  /** Review deep-link: bypass the server flag and pin a state. */
  force?: 'preview' | 'main';
  initialSheet?: 'about' | 'history';
}): ReactNode {
  const [seen, setSeen] = useState<boolean | null>(() =>
    force ? force !== 'preview' : (cachedFlags()?.includes('cashback_preview_seen') ?? null),
  );

  useEffect(() => {
    if (force) return;
    let live = true;
    getFlags()
      .then((flags) => live && setSeen(flags.includes('cashback_preview_seen')))
      .catch(() => live && setSeen(true)); // API down: don't trap the user on the intro
    return () => {
      live = false;
    };
  }, [force]);

  if (seen === null) return <div className="scr-route-hold" />;

  if (!seen) {
    return (
      <CashbackPreview
        onStartEarning={() => {
          setSeen(true);
          void setFlag('cashback_preview_seen');
        }}
      />
    );
  }

  return (
    <Cashback
      initialSheet={initialSheet}
      onNavigate={onNavigate}
      onOpenBroker={onOpenBroker}
      onUpgradePlan={onUpgradePlan}
    />
  );
}

export default CashbackRoute;
