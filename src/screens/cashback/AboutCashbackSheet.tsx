import type { ReactNode } from 'react';
import { AnimatedEmoji, BottomSheet } from '../../design-system/components';
import { Glyph } from './Glyph';
import { CashbackSteps } from './CashbackSteps';
import introArt from '../../assets/emoji/cashback.json?url';
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
          <Glyph name="close" size={24} />
        </button>
      </div>
      <div className="scr-cashback-sheet-divider" aria-hidden="true" />
    </div>
  );
}

export interface AboutCashbackSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AboutCashbackSheet({ open, onClose }: AboutCashbackSheetProps): ReactNode {
  return (
    <BottomSheet open={open} onClose={onClose} className="scr-about-sheet">
      <SheetHeader title="About cashback" onClose={onClose} />

      <div className="scr-about-sheet-body">
        <AnimatedEmoji className="scr-about-cashback-art" src={introArt} />

        <h2 className="scr-about-sheet-headline">
          Make every trade more rewarding with <span className="scr-about-sheet-accent">cashback</span>
        </h2>

        <CashbackSteps />
      </div>
    </BottomSheet>
  );
}
