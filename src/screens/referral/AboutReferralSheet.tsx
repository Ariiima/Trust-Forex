import type { ReactNode } from 'react';
import { BottomSheet, Icon } from '../../design-system/components';
import { ReferralBenefits } from './ReferralBenefits';
import './ReferralBenefits.css';
import './AboutReferralSheet.css';

/* ---------------------------------------------------------------------------
 * "About referral" sheet — frame 1391:5964 (sheet 360x424 @y=427).
 * Same three benefit rows as the preview page, but on a 262-wide column, so
 * the headline wraps to 2 lines of 40 (text-xl) instead of 3 of 44.
 * ------------------------------------------------------------------------- */

export function AboutReferralSheet({ open, onClose }: { open: boolean; onClose?: () => void }): ReactNode {
  return (
    <BottomSheet open={open} onClose={onClose} className="scr-about-ref-sheet">
      <div className="scr-about-ref-head">
        <h2 className="scr-about-ref-title type-text-lg-semibold">About referral</h2>
        <button type="button" className="scr-about-ref-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} strokeWidth={1.6} />
        </button>
      </div>

      <div className="scr-about-ref-body">
        <h3 className="scr-about-ref-headline type-text-xl-bold">
          Turn your network into referral <span className="scr-about-ref-accent">income</span>
        </h3>
        <ReferralBenefits />
      </div>
    </BottomSheet>
  );
}

export default AboutReferralSheet;
