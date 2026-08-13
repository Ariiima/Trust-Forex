import type { ReactNode } from 'react';
import { Glyph, type GlyphName } from './Glyph';

/* The three step rows are shared by the intro splash (850:1913) and the
 * "About cashback" sheet (1233:5894) — identical rows and identical copy in
 * both frames, so they live here rather than being duplicated per caller.
 * Same split as referral's ReferralBenefits. */

const STEPS: readonly { glyph: GlyphName; title: string; sub: string }[] = [
  { glyph: 'shield', title: 'Open trading accounts', sub: 'With verified broker partners' },
  { glyph: 'calendar', title: 'Receive weekly cashback', sub: 'From every trade you make' },
  { glyph: 'trending-up', title: 'Upgrade your plan', sub: 'For a higher cashback rate' },
];

export function CashbackSteps({ className }: { className?: string }): ReactNode {
  return (
    <div className={['scr-about-sheet-steps', className ?? ''].filter(Boolean).join(' ')}>
      {STEPS.map((step) => (
        <div className="scr-about-sheet-step" key={step.glyph}>
          <span className="scr-about-sheet-step-icon">
            <Glyph name={step.glyph} size={24} />
          </span>
          <span className="scr-about-sheet-step-text">
            <span className="scr-about-sheet-step-title">{step.title}</span>
            <span className="scr-about-sheet-step-sub">{step.sub}</span>
          </span>
        </div>
      ))}
    </div>
  );
}
