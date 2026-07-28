import type { ReactNode } from 'react';
import { BottomSheet, Button, Icon } from '../../../design-system/components';
import { Glyph } from '../Glyph';
import type { Order } from '../../../api/client';

/* Status-driven bottom panel over the QR screen — Waiting (1108-12055),
 * Error (1108-12144, also used for `expired`) and Confirmed (1108-12253).
 * NOT dismissible: no onClose, scrim tap is a no-op — the sheet only changes
 * when the polled order status does. Panel hugs its content (the 420px in the
 * XML is the overlay slice, not a height requirement — D16). Styles live in
 * PaymentStatus.css. */

export type StatusSheetVariant = 'waiting' | 'error' | 'confirmed';

export interface StatusSheetProps {
  variant: StatusSheetVariant;
  order: Order;
  /** Error CTA — assembly decides where re-payment goes. */
  onPayRemaining?: () => void;
  /** Confirmed CTA 1. */
  onViewSubscription?: () => void;
  /** Confirmed CTA 2 — back to home. */
  onDone?: () => void;
}

function Row({
  label,
  highlight = false,
  children,
}: {
  label: string;
  highlight?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <div className={'scr-status-sheet-row' + (highlight ? ' scr-status-sheet-row-highlight' : '')}>
      <span className="scr-status-sheet-row-label">{label}</span>
      <span className={'scr-status-sheet-row-value' + (highlight ? ' scr-status-sheet-row-value-highlight' : '')}>
        {children}
      </span>
    </div>
  );
}

export function StatusSheet({
  variant,
  order,
  onPayRemaining,
  onViewSubscription,
  onDone,
}: StatusSheetProps): ReactNode {
  const usd = order.amountUsd.toFixed(2);

  return (
    <BottomSheet open className="scr-status-sheet">
      <div className={`scr-status-sheet-inner scr-status-sheet-inner-${variant}`}>
        {variant === 'waiting' ? (
          <div className="scr-status-sheet-content">
            <div className="scr-status-sheet-banner scr-status-sheet-banner-warn">
              <Glyph name="clock-hour-5" size={24} strokeWidth={1.6} className="scr-status-sheet-banner-icon" />
              <p className="scr-status-sheet-banner-text">
                Your payment is currently under review. Confirmation may take a few moments.
              </p>
            </div>
            <div className="scr-status-sheet-rows">
              <Row label="Amount to be paid">
                <span>{usd}</span>
                <span>USD</span>
              </Row>
              <Row label="You paid">
                <Glyph name="loader-2" size={20} strokeWidth={1.6} className="scr-status-sheet-spinner" />
              </Row>
            </div>
          </div>
        ) : null}

        {variant === 'error' ? (
          <>
            <div className="scr-status-sheet-content">
              <div className="scr-status-sheet-banner scr-status-sheet-banner-warn">
                <Icon name="info" size={24} strokeWidth={1.6} className="scr-status-sheet-banner-icon" />
                <p className="scr-status-sheet-banner-text">
                  Your payment is incomplete. You must pay the remaining amount to continue.
                </p>
              </div>
              <div className="scr-status-sheet-rows">
                <Row label="Amount to be paid">
                  <span>{usd}</span>
                  <span>USD</span>
                </Row>
                {/* API has no partial-payment field — "---" mirrors the shipped modal (D11) */}
                <Row label="You paid">---</Row>
                <Row label="Remaining amount" highlight>
                  <span>{usd}</span>
                  <span>USD</span>
                </Row>
              </div>
            </div>
            <Button
              variant="primary"
              size="medium"
              fullWidth
              className="scr-status-pay-btn"
              onClick={() => onPayRemaining?.()}
            >
              Pay remaining amount
            </Button>
          </>
        ) : null}

        {variant === 'confirmed' ? (
          <>
            <div className="scr-status-sheet-content">
              <div className="scr-status-sheet-banner scr-status-sheet-banner-success">
                <Glyph name="check-circle" size={24} strokeWidth={1.6} className="scr-status-sheet-banner-icon" />
                <p className="scr-status-sheet-banner-text">
                  Your payment has been confirmed. View your updated subscription status now.
                </p>
              </div>
              <div className="scr-status-sheet-rows">
                {/* lowercase "amount" is the exact layer text (1106:11456) */}
                <Row label="amount to be paid">
                  <span>{usd}</span>
                  <span>USD</span>
                </Row>
                <Row label="You paid">
                  <span>{usd}</span>
                  <span>USD</span>
                </Row>
              </div>
            </div>
            <div className="scr-status-sheet-ctas">
              <Button variant="primary" size="medium" fullWidth onClick={() => onViewSubscription?.()}>
                View subscription status
              </Button>
              <Button variant="outline" size="medium" fullWidth onClick={() => onDone?.()}>
                Back to home
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </BottomSheet>
  );
}
