import type { ReactNode } from 'react';
import { BottomSheet, Button, Icon } from '../../design-system/components';
import { Glyph } from '../payment/Glyph';
import './WithdrawSummarySheet.css';

/* ---------------------------------------------------------------------------
 * "Withdrawal summary" sheet — frames 1402:7573 (confirm, 364 tall) and
 * 1404:7924 (submitted, with the clock banner). Same 328-wide row stack either
 * way: label left, value right-aligned, five rows 28 tall on a 12 gap running
 * at an unbroken 40px pitch. Everything is Sora regular — the values are
 * distinguished from the labels by colour (#212121 vs #7C7C7C), not weight.
 * ------------------------------------------------------------------------- */

const money = (n: number) => `$${n.toFixed(2)}`;

export interface WithdrawSummarySheetProps {
  open: boolean;
  /** `submitted` swaps the CTA for the under-review banner (1404:7924). */
  state?: 'confirm' | 'submitted';
  currency?: string;
  network?: string;
  wallet?: string;
  amount?: number;
  networkFee?: number;
  onClose?: () => void;
  onConfirm?: () => void;
}

/** 0X1C42......48Hf7f8 — the frames elide the middle of the address. */
function shorten(address: string): string {
  return address.length <= 16 ? address : `${address.slice(0, 6)}......${address.slice(-7)}`;
}

export function WithdrawSummarySheet({
  open,
  state = 'confirm',
  currency = 'USDT',
  network = 'BEP-20',
  wallet = '0X1C4212345678948Hf7f8',
  amount = 245,
  networkFee = 1,
  onClose,
  onConfirm,
}: WithdrawSummarySheetProps): ReactNode {
  const rows = [
    { label: 'Currency', value: `${currency} (${network})` },
    { label: 'Wallet address', value: shorten(wallet) },
    { label: 'Withdrawal amount', value: money(amount) },
    { label: 'Network fee', value: money(networkFee) },
    { label: 'Final amount', value: money(Math.max(0, amount - networkFee)) },
  ];

  return (
    <BottomSheet open={open} onClose={onClose} className="scr-wdsum-sheet">
      <div className="scr-wdsum-head">
        <h2 className="scr-wdsum-title type-text-base">Withdrawal summary</h2>
        <button type="button" className="scr-wdsum-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={24} strokeWidth={1.6} />
        </button>
      </div>

      <div className="scr-wdsum-rule" />

      {state === 'submitted' ? (
        <div className="scr-wdsum-banner">
          <Glyph name="clock-hour-5" size={24} strokeWidth={1.6} className="scr-wdsum-banner-icon" />
          <p className="scr-wdsum-banner-text type-text-xs">
            Your withdrawal request was successfully submitted and is now under review.
          </p>
        </div>
      ) : null}

      <dl className="scr-wdsum-rows">
        {rows.map((r) => (
          <div key={r.label} className="scr-wdsum-row">
            <dt className="scr-wdsum-label type-text-sm">{r.label}</dt>
            <dd className="scr-wdsum-value type-text-sm">{r.value}</dd>
          </div>
        ))}
      </dl>

      {state === 'confirm' ? (
        <Button
          variant="primary"
          size="medium"
          fullWidth
          className="scr-wdsum-cta"
          iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
          onClick={onConfirm}
        >
          Request withdrawal
        </Button>
      ) : (
        <Button variant="primary" size="medium" fullWidth className="scr-wdsum-cta" onClick={onClose}>
          Done
        </Button>
      )}
    </BottomSheet>
  );
}

export default WithdrawSummarySheet;
