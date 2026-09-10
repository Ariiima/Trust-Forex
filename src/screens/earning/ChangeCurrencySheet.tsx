import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet, Button, Icon } from '../../design-system/components';
import { useScrollRail } from '../../design-system/useScrollRail';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import { WithdrawOptionCard } from './WithdrawOptionCard';
import './ChangeCurrencySheet.css';

/* ---------------------------------------------------------------------------
 * "Change currency" sheet — frame 1402:7191 (sheet 360x635 @y=217 in frame
 * space, 141 on screen). Same option cards as the step-1 picker, 318 wide
 * here because the 328 scroll area reserves 10px for the rail. The draft
 * selection only commits on "Choose currency"; closing or tapping the scrim
 * discards it — same contract as the payment-network sheet.
 * ------------------------------------------------------------------------- */

export interface ChangeCurrencySheetProps {
  open: boolean;
  selectedId: string;
  onClose?: () => void;
  onChoose?: (optionId: string) => void;
}

export function ChangeCurrencySheet({ open, selectedId, onClose, onChoose }: ChangeCurrencySheetProps): ReactNode {
  const [draft, setDraft] = useState(selectedId);
  const [listRef, railThumb] = useScrollRail<HTMLUListElement>();

  // Re-seed each time it opens so a discarded draft never leaks into the next open.
  useEffect(() => {
    if (open) setDraft(selectedId);
  }, [open, selectedId]);

  return (
    <BottomSheet open={open} onClose={onClose} className="scr-chgcur-sheet">
      <div className="scr-chgcur-head">
        <h2 className="scr-chgcur-title type-text-base">Change currency</h2>
        <button type="button" className="scr-chgcur-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} />
        </button>
      </div>

      <div className="scr-chgcur-rule" aria-hidden="true" />

      <div className="scr-chgcur-body">
        <ul className="scr-chgcur-list" ref={listRef}>
          {WITHDRAW_OPTIONS.map((o) => (
            <li key={o.id}>
              <WithdrawOptionCard option={o} selected={draft === o.id} onSelect={() => setDraft(o.id)} />
            </li>
          ))}
        </ul>
        {/* The design's 2px rail; thumb height/offset from useScrollRail. */}
        <span className="scr-chgcur-rail" aria-hidden="true">
          <span className="scr-chgcur-rail-thumb" style={railThumb} />
        </span>
      </div>

      <Button
        variant="primary"
        size="medium"
        fullWidth
        className="scr-chgcur-cta"
        iconRight={<Icon name="chevron-right" size={20} />}
        onClick={() => onChoose?.(draft)}
      >
        Choose currency
      </Button>
    </BottomSheet>
  );
}

export default ChangeCurrencySheet;
