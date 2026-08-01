import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../design-system/components';
import { ReferralBenefits } from './ReferralBenefits';
import introArt from '../../assets/referral/referral-intro.png';
import './ReferralBenefits.css';
import './ReferralPreview.css';

/* ---------------------------------------------------------------------------
 * Referral — preview (empty) state — route /referral
 * Frame 1333:8306 (360x852). Shown ONCE to a new user: a single white card
 * (16,16 -> 328x568 in app coords) holding a 168x120 illustration, a centred
 * 2-line headline and three benefit rows, plus a pinned CTA (16 from the
 * bottom -> 328x44). The CTA is disabled for a 5s countdown and counts down in
 * its own label — the frame captures it at "(3)", i.e. 3 seconds left.
 * ------------------------------------------------------------------------- */


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
          <img className="scr-referral-preview-art" src={introArt} alt="" width={168} height={120} />

          <h1 className="scr-referral-preview-title type-text-2xl-bold">
            Turn your network into referral <span className="scr-referral-preview-accent">income</span>
          </h1>

          <ReferralBenefits className="scr-referral-preview-benefits" />
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
