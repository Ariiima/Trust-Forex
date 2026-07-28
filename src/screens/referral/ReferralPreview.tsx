import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon } from '../../design-system/components';
import type { IconName } from '../../design-system/components';
import './ReferralPreview.css';

/* ---------------------------------------------------------------------------
 * Referral — preview (empty) state — route /referral
 * Frame 1333:8306 (360x852). Shown ONCE to a new user: a single white card
 * (16,92 -> 328x496) with a centred 3-line headline and three benefit rows,
 * plus a pinned CTA (16,792 -> 328x44). The CTA is disabled for a 5s
 * countdown and counts down in its own label — the frame captures it at
 * "(3)", i.e. 3 seconds left.
 * ------------------------------------------------------------------------- */

interface Benefit {
  icon: IconName;
  title: string;
  sub: string;
}

// Layer names in 1341:5187 are the copy, verbatim.
const BENEFITS: readonly Benefit[] = [
  { icon: 'users', title: 'Invite your friends', sub: 'to start earning together' },
  { icon: 'award', title: 'Earn more rewards', sub: 'as friends become active' },
  { icon: 'report', title: 'Track every referral', sub: 'to clearly follow your progress' },
];

export interface ReferralPreviewProps {
  /** Seconds the CTA stays disabled. Design shows a 5s countdown. */
  countdownSeconds?: number;
  onStartInviting?: () => void;
}

export function ReferralPreview({ countdownSeconds = 5, onStartInviting }: ReferralPreviewProps): ReactNode {
  const [left, setLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <div className="scr-referral-preview">
      <main className="scr-referral-preview-main">
        <section className="scr-referral-preview-card">
          <h1 className="scr-referral-preview-title type-text-2xl-bold">
            Turn your network into referral <span className="scr-referral-preview-accent">income</span>
          </h1>

          <ul className="scr-referral-preview-benefits">
            {BENEFITS.map((b) => (
              <li key={b.icon} className="scr-referral-preview-benefit">
                <span className="scr-referral-preview-benefit-badge">
                  <Icon name={b.icon} size={32} />
                </span>
                <span className="scr-referral-preview-benefit-text">
                  <span className="scr-referral-preview-benefit-title type-text-sm-semibold">{b.title}</span>
                  <span className="scr-referral-preview-benefit-sub type-text-xs">{b.sub}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="scr-referral-preview-footer">
        <Button variant="primary" size="medium" fullWidth disabled={left > 0} onClick={onStartInviting}>
          {left > 0 ? `Start inviting (${left})` : 'Start inviting'}
        </Button>
      </footer>
    </div>
  );
}

export default ReferralPreview;
