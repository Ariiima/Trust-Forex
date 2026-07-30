import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { BottomSheet, Button, Icon } from '../../design-system/components';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import { WithdrawOptionCard } from './WithdrawOptionCard';
import './ChangeCurrencySheet.css';

/* ---------------------------------------------------------------------------
 * "Change currency" sheet — frame 1402:7191 (sheet 360x631 @y=221).
 * Same option cards as the step-1 picker, 328 wide here, with the CTA at
 * y=563. The draft selection only commits on "Choose currency"; closing or
 * tapping the scrim discards it — same contract as the payment-network sheet.
 * ------------------------------------------------------------------------- */

export interface ChangeCurrencySheetProps {
  open: boolean;
  selectedId: string;
  onClose?: () => void;
  onChoose?: (optionId: string) => void;
}

export function ChangeCurrencySheet({ open, selectedId, onClose, onChoose }: ChangeCurrencySheetProps): ReactNode {
  const [draft, setDraft] = useState(selectedId);

  // Re-seed each time it opens so a discarded draft never leaks into the next open.
  useEffect(() => {
    if (open) setDraft(selectedId);
  }, [open, selectedId]);

  return (
    <BottomSheet open={open} onClose={onClose} className="scr-chgcur-sheet">
      <div className="scr-chgcur-head">
        <h2 className="scr-chgcur-title type-text-lg-semibold">Change currency</h2>
        <button type="button" className="scr-chgcur-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} strokeWidth={1.6} />
        </button>
      </div>

      <ul className="scr-chgcur-list">
        {WITHDRAW_OPTIONS.map((o) => (
          <li key={o.id}>
            <WithdrawOptionCard option={o} selected={draft === o.id} onSelect={() => setDraft(o.id)} />
          </li>
        ))}
      </ul>

      <Button
        variant="primary"
        size="medium"
        fullWidth
        className="scr-chgcur-cta"
        onClick={() => onChoose?.(draft)}
      >
        Choose currency
      </Button>
    </BottomSheet>
  );
}

export default ChangeCurrencySheet;
