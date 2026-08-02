import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon } from '../../design-system/components';
import { Glyph } from './icons';
import './OrderSummarySheet.css';

/**
 * Order summary BottomSheet — Figma 1206:4219. Opened by Checkout's
 * "Review order" CTA; recaps plan / price breakdown / total and hands off
 * to order creation via `onConfirm`. Also usable standalone.
 * Note this sheet's money format is `$49.00` (no space after $), unlike the
 * checkout card's `$ 49.00` — both taken literally from the Figma layers.
 */
export interface OrderSummarySheetProps {
  open: boolean;
  onClose: () => void;
  planName: string; // "Silver"
  planDuration: string; // "1 month"
  price: number; // plan.checkoutPrice
  /** Balance applied when the checkout toggle is on; undefined hides the row. */
  balanceUsed?: number;
  /** Applied discount; undefined hides the row. */
  discount?: { code: string; amount: number };
  total: number;
  onConfirm: () => void;
}

export function OrderSummarySheet({
  open,
  onClose,
  planName,
  planDuration,
  price,
  balanceUsed,
  discount,
  total,
  onConfirm,
}: OrderSummarySheetProps): ReactNode {
  return (
    <BottomSheet open={open} onClose={onClose} className="scr-ordersum-sheet">
      <div className="scr-ordersum-inner">
        <div className="scr-ordersum-titlerow">
          <h2 className="scr-ordersum-title">Order summary</h2>
          <button type="button" className="scr-ordersum-close" aria-label="Close" onClick={onClose}>
            <Glyph name="close" size={24} />
          </button>
        </div>
        <div className="scr-ordersum-divider" aria-hidden="true" />

        <div className="scr-ordersum-planrow">
          <span className="scr-ordersum-rowlabel">Plan</span>
          <span className="scr-ordersum-planname">
            {planName} <span className="scr-ordersum-duration">/ {planDuration}</span>
          </span>
        </div>
        <div className="scr-ordersum-divider" aria-hidden="true" />

        <div className="scr-ordersum-breakdown">
          <div className="scr-ordersum-breakrow">
            <span className="scr-ordersum-breaklabel">Price</span>
            <span className="scr-ordersum-breakvalue">${price.toFixed(2)}</span>
          </div>
          {balanceUsed != null ? (
            <div className="scr-ordersum-breakrow">
              <span className="scr-ordersum-breaklabel">Earning balance</span>
              <span className="scr-ordersum-breakvalue">-${balanceUsed.toFixed(2)}</span>
            </div>
          ) : null}
          {discount ? (
            <div className="scr-ordersum-breakrow">
              <span className="scr-ordersum-breaklabel">Discount ( {discount.code} )</span>
              <span className="scr-ordersum-breakvalue">-${discount.amount.toFixed(2)}</span>
            </div>
          ) : null}
        </div>
        <div className="scr-ordersum-divider" aria-hidden="true" />

        <div className="scr-ordersum-totalrow">
          <span className="scr-ordersum-rowlabel">Total payable</span>
          <span className="scr-ordersum-totalvalue">${total.toFixed(2)}</span>
        </div>

        <Button
          variant="primary"
          size="medium"
          fullWidth
          className="scr-ordersum-confirm"
          iconRight={<Icon name="chevron-right" size={20} />}
          onClick={onConfirm}
        >
          Confirm order
        </Button>
      </div>
    </BottomSheet>
  );
}
