import type { ReactNode } from 'react';
import { BottomSheet, Icon } from '../../design-system/components';
import { ReferralBenefits } from './ReferralBenefits';
import introArt from '../../assets/referral/referral-intro.png';
import './ReferralBenefits.css';
import './AboutReferralSheet.css';

/* ---------------------------------------------------------------------------
 * "About referral" sheet — frame 1391:5964. The sheet is 360x545, pinned to
 * the bottom of the 852 frame (top edge at y=307). Header row, dashed rule,
 * then the same intro block as the preview page (1341:5187) — art, 2-line
 * headline, three benefit rows — but on a narrower column, so the art is
 * 144x104 instead of 168x120 and the headline is 20/40 instead of 24/44.
 * ------------------------------------------------------------------------- */

export function AboutReferralSheet({ open, onClose }: { open: boolean; onClose?: () => void }): ReactNode {
  return (
    <BottomSheet open={open} onClose={onClose} className="scr-about-ref-sheet">
      <div className="scr-about-ref-head">
        <h2 className="scr-about-ref-title type-text-base">About referral</h2>
        <button type="button" className="scr-about-ref-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} />
        </button>
      </div>

      <div className="scr-about-ref-body">
        <img className="scr-about-ref-art" src={introArt} alt="" width={144} height={104} />

        <h3 className="scr-about-ref-headline type-text-xl-bold">
          Turn your network into referral <span className="scr-about-ref-accent">income</span>
        </h3>
        <ReferralBenefits />
      </div>
    </BottomSheet>
  );
}

export default AboutReferralSheet;
