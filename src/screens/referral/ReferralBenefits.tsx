import type { ReactNode } from 'react';
import { Icon } from '../../design-system/components';
import type { IconName } from '../../design-system/components';

/* The three benefit rows are shared by the preview page (1341:5187) and the
 * "About referral" sheet (1362:4756) — identical rows, only the column width
 * and headline size differ, so those stay with the callers. */

interface Benefit {
  icon: IconName;
  title: string;
  sub: string;
}

export const BENEFITS: readonly Benefit[] = [
  { icon: 'users', title: 'Invite your friends', sub: 'to start earning together' },
  { icon: 'award', title: 'Earn more rewards', sub: 'as friends become active' },
  { icon: 'report', title: 'Track every referral', sub: 'to clearly follow your progress' },
];

export function ReferralBenefits({ className }: { className?: string }): ReactNode {
  return (
    <ul className={['scr-referral-benefits', className ?? ''].filter(Boolean).join(' ')}>
      {BENEFITS.map((b) => (
        <li key={b.icon} className="scr-referral-benefit">
          <span className="scr-referral-benefit-badge">
            <Icon name={b.icon} size={24} strokeWidth={2} />
          </span>
          <span className="scr-referral-benefit-text">
            <span className="scr-referral-benefit-title type-text-sm">{b.title}</span>
            <span className="scr-referral-benefit-sub type-text-xs">{b.sub}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
