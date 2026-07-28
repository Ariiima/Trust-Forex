import type { ReactNode } from 'react';
import { BottomSheet } from '../../design-system/components';
import { Glyph, type GlyphName } from './Glyph';
import './AboutCashbackSheet.css';

/* ---------------------------------------------------------------------------
 * About-cashback bottom sheet — Figma 1233:5894, overlays /cashback.
 * Opened from the CashbackOverview card's info icon. Also exports the shared
 * sheet header (title + close + hairline divider) reused by
 * CashbackHistorySheet — same anatomy in both frames.
 * ------------------------------------------------------------------------- */

export interface SheetHeaderProps {
  title: string;
  onClose?: () => void;
}

/** Shared sheet header: 32px title row, 24px close glyph, hairline divider. */
export function SheetHeader({ title, onClose }: SheetHeaderProps): ReactNode {
  return (
    <div className="scr-cashback-sheet-head">
      <div className="scr-cashback-sheet-titlerow">
        <span className="scr-cashback-sheet-title">{title}</span>
        <button type="button" className="scr-cashback-sheet-close" onClick={onClose} aria-label="Close">
          <Glyph name="close" size={24} strokeWidth={1.8} />
        </button>
      </div>
      <div className="scr-cashback-sheet-divider" aria-hidden="true" />
    </div>
  );
}

// Same three steps as the intro splash (850:1913) but this frame's copy is
// sentence case — deliberately its own strings, do not share with the intro.
const STEPS: readonly { glyph: GlyphName; title: string; sub: string }[] = [
  { glyph: 'shield', title: 'Open trading accounts', sub: 'With verified broker partners' },
  { glyph: 'calendar', title: 'Receive weekly cashback', sub: 'From every trade you make' },
  { glyph: 'trending-up', title: 'Upgrade your plan', sub: 'For a higher cashback rate' },
];

export interface AboutCashbackSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AboutCashbackSheet({ open, onClose }: AboutCashbackSheetProps): ReactNode {
  return (
    <BottomSheet open={open} onClose={onClose} className="scr-about-sheet">
      <SheetHeader title="About cashback" onClose={onClose} />

      <div className="scr-about-sheet-body">
        <h2 className="scr-about-sheet-headline">
          Make every trade more rewarding with <span className="scr-about-sheet-accent">cashback</span>
        </h2>

        <div className="scr-about-sheet-steps">
          {STEPS.map((step) => (
            <div className="scr-about-sheet-step" key={step.glyph}>
              <span className="scr-about-sheet-step-icon">
                <Glyph name={step.glyph} size={24} strokeWidth={2} />
              </span>
              <span className="scr-about-sheet-step-text">
                <span className="scr-about-sheet-step-title">{step.title}</span>
                <span className="scr-about-sheet-step-sub">{step.sub}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </BottomSheet>
  );
}
