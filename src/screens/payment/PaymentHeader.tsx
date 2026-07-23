import type { ReactNode } from 'react';
import { Glyph } from './Glyph';
import './PaymentHeader.css';

export interface PaymentHeaderProps {
  title?: string;
  onBack?: () => void;
}

/** Shared in-app header for the payment flow: "← Payment". The trailing
 *  chevron-down / dots-vertical seen in the frames are Telegram WebView
 *  chrome, excluded app-wide (Telegram draws its own). */
export function PaymentHeader({ title = 'Payment', onBack }: PaymentHeaderProps): ReactNode {
  return (
    <header className="scr-payment-header">
      <span className="scr-payment-header-left">
        <button className="scr-payment-header-back" type="button" onClick={onBack} aria-label="Back">
          <Glyph name="back" size={20} strokeWidth={1.5} />
        </button>
        <span className="scr-payment-header-title">{title}</span>
      </span>
    </header>
  );
}
