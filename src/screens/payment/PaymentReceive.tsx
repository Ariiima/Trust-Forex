/* NOTE: a prior pass left a `status/` (QrPanel/StatusSheet/useOrderPoll)
 * order-polling rebuild of this screen half-finished — it's never imported
 * anywhere and App.tsx still routes '/payment/receive' straight to this
 * component. This file (not `status/`) is what actually renders in the app;
 * treat `status/` as unfinished scaffolding, not a replacement. */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon, ProgressBar } from '../../design-system/components';
import { Glyph } from './Glyph';
import { useBackButton } from '../../telegram';
import qrPlaceholder from '../../assets/qr-placeholder.png';
import wallet1 from '../../assets/payment/wallet-connect-1.png';
import wallet2 from '../../assets/payment/wallet-connect-2.png';
import wallet3 from '../../assets/payment/wallet-connect-3.png';
import './PaymentReceive.css';

/* ---------------------------------------------------------------------------
 * Payment — receive (QR + wallet address) — route /payment/receive
 * Checkout step 3/3, terminal. Built from the CANONICAL node/frame 1102-10506
 * ("Address QR" / "Payment QR" toggle, QR + Currency/Amount/Wallet-address
 * rows, Memo-required box, "pay with connecting wallet" icon row). Only the
 * "Address QR" tab has captured content — no distinct design exists for
 * "Payment QR", so both tabs render the same QR/rows block; see report.
 *
 * 1108-12055 was the *older* design iteration (different toggle labels
 * "Address only"/"all data", slightly different banner copy) — used only to
 * disambiguate, not built. Its backdrop is what's visible behind the two
 * modal bottom-sheets in the source file, but per the task both modals are
 * layered on this (canonical) screen instead — same pattern PaymentCurrency
 * used for its overlay-sheet screen.
 *
 * Two modals, useState + DS BottomSheet (reskinned via className, same
 * pattern as PaymentCurrency's sheet / BrokerDetail's sheets):
 *   'incomplete' (1108-12144) — amount due / paid / remaining rows + amber
 *                                "Pay remaining amount" CTA
 *   'confirmed'  (1108-12253) — success banner + due/paid rows + blue
 *                                "View subscription status" CTA (exits flow)
 * Neither modal has a visible on-screen trigger in the captured frames (no
 * sticky CTA on the base receive screen) — real triggering would come from a
 * payment-status poll/webhook the assembly layer owns. Exposed here via
 * `initialModal` so callers can drive it; not opened by any in-screen tap.
 * ------------------------------------------------------------------------- */

type QrTab = 'address' | 'payment';
type ModalKind = 'incomplete' | 'confirmed' | null;
type CopyField = 'amount' | 'address' | 'memo' | null;

// Exact values from node JSON (1102-10506 / 1108-12144 / 1108-12253) — this
// screen displays one fixed payment target, not a picker (mirrors
// BrokerDetail's hardcoded spec/referral constants).
const CURRENCY_NETWORK = 'BNB(BEP-20)';
const SEND_AMOUNT = '0.00350773';
const SEND_UNIT = 'BNB';
const WALLET_ADDRESS = '0X1C42......48Hf7f8';
const MEMO = '28442536';

const AMOUNT_DUE = '2.00';
const AMOUNT_PAID_CONFIRMED = '2.00';
const AMOUNT_REMAINING = '1.43';
const CURRENCY_CODE = 'USD';

const WALLET_ICONS = [
  { id: 'walletconnect', src: wallet1, alt: 'WalletConnect' },
  { id: 'metamask', src: wallet2, alt: 'MetaMask' },
  { id: 'other', src: wallet3, alt: 'Other wallet' },
] as const;

export interface PaymentReceiveProps {
  initialTab?: QrTab;
  /** Drives which (if any) status modal is open on mount — see note above. */
  initialModal?: ModalKind;
  onBack?: () => void;
  /** "Pay remaining amount" CTA in the incomplete-payment modal. */
  onPayRemaining?: () => void;
  /** "View subscription status" CTA in the confirmed-payment modal — exits the flow (back to Home). */
  onDone?: () => void;
}

export default function PaymentReceive({
  initialTab = 'address',
  initialModal = null,
  onBack,
  onPayRemaining,
  onDone,
}: PaymentReceiveProps): ReactNode {
  useBackButton(onBack);
  const [tab, setTab] = useState<QrTab>(initialTab);
  const [modal, setModal] = useState<ModalKind>(initialModal);
  const [copiedField, setCopiedField] = useState<CopyField>(null);

  const copy = (field: Exclude<CopyField, null>, value: string): void => {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
  };

  const copyButton = (field: Exclude<CopyField, null>, value: string, label: string): ReactNode => (
    <button
      type="button"
      className="scr-receive-copy"
      onClick={() => copy(field, value)}
      aria-label={copiedField === field ? `${label} copied` : `Copy ${label}`}
    >
      {copiedField === field ? (
        <Icon name="check" size={16} />
      ) : (
        <Glyph name="copy" size={16} />
      )}
    </button>
  );

  return (
    <div className="scr-receive">
      <main className="scr-receive-body">
        <ProgressBar current="make-payment" className="scr-receive-progress" />

        <section className="scr-receive-card">
          <div className="scr-receive-warning">
            <Glyph name="alert-triangle" size={20} />
            <p className="scr-receive-warning-text">
              Verify the network, wallet address, and exact amount before making the payment
            </p>
          </div>

          <div className="scr-receive-main">
            <div className="scr-receive-qrblock">
              <div className="scr-receive-tabs">
                <button
                  type="button"
                  className={'scr-receive-tab' + (tab === 'address' ? ' scr-receive-tab-active' : '')}
                  onClick={() => setTab('address')}
                  aria-pressed={tab === 'address'}
                >
                  Address QR
                </button>
                <button
                  type="button"
                  className={'scr-receive-tab' + (tab === 'payment' ? ' scr-receive-tab-active' : '')}
                  onClick={() => setTab('payment')}
                  aria-pressed={tab === 'payment'}
                >
                  Payment QR
                </button>
              </div>

              <div className="scr-receive-qr-frame">
                <img className="scr-receive-qr" src={qrPlaceholder} alt="Payment QR code" width={148} height={148} />
              </div>

              <div className="scr-receive-rows">
                <div className="scr-receive-row">
                  <span className="scr-receive-row-label">Currency (network)</span>
                  <span className="scr-receive-row-value">{CURRENCY_NETWORK}</span>
                </div>
                <div className="scr-receive-row">
                  <span className="scr-receive-row-label">Amount to send</span>
                  <span className="scr-receive-row-value scr-receive-row-value-copy">
                    {SEND_AMOUNT} {SEND_UNIT}
                    {copyButton('amount', `${SEND_AMOUNT} ${SEND_UNIT}`, 'amount')}
                  </span>
                </div>
                <div className="scr-receive-row">
                  <span className="scr-receive-row-label">Wallet address</span>
                  <span className="scr-receive-row-value scr-receive-row-value-copy">
                    {WALLET_ADDRESS}
                    {copyButton('address', WALLET_ADDRESS, 'wallet address')}
                  </span>
                </div>
              </div>
            </div>

            <div className="scr-receive-memo">
              <span className="scr-receive-memo-label">Memo required</span>
              <span className="scr-receive-row-value scr-receive-row-value-copy">
                {MEMO}
                {copyButton('memo', MEMO, 'memo')}
              </span>
            </div>

            <div className="scr-receive-connect">
              <div className="scr-receive-divider-row">
                <span className="scr-receive-divider-line" aria-hidden="true" />
                <span className="scr-receive-divider-text">Or pay with connecting wallet</span>
                <span className="scr-receive-divider-line" aria-hidden="true" />
              </div>
              <div className="scr-receive-wallets">
                {WALLET_ICONS.map((w) => (
                  <button type="button" key={w.id} className="scr-receive-wallet-btn" aria-label={w.alt}>
                    <img src={w.src} alt="" width={32} height={32} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Payment-incomplete modal (1108-12144) */}
      <BottomSheet open={modal === 'incomplete'} onClose={() => setModal(null)} className="scr-receive-sheet">
        <div className="scr-receive-sheet-inner">
          <div className="scr-receive-sheet-content">
            <div className="scr-receive-sheet-banner scr-receive-sheet-banner-warn">
              <Icon name="info" size={24} className="scr-receive-sheet-banner-icon" />
              <p className="scr-receive-sheet-banner-text">
                Your payment is incomplete. You must pay the remaining amount to continue.
              </p>
            </div>

            <div className="scr-receive-sheet-rows">
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">Amount to be paid</span>
                <span className="scr-receive-sheet-row-value">
                  {AMOUNT_DUE} {CURRENCY_CODE}
                </span>
              </div>
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">You paid</span>
                <span className="scr-receive-sheet-row-value">---</span>
              </div>
              <div className="scr-receive-sheet-row scr-receive-sheet-row-highlight">
                <span className="scr-receive-sheet-row-label">Remaining amount</span>
                <span className="scr-receive-sheet-row-value scr-receive-sheet-row-value-highlight">
                  {AMOUNT_REMAINING} {CURRENCY_CODE}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="small"
            fullWidth
            className="scr-receive-pay-btn"
            onClick={() => onPayRemaining?.()}
          >
            Pay remaining amount
          </Button>
        </div>
      </BottomSheet>

      {/* Payment-confirmed modal (1108-12253) */}
      <BottomSheet open={modal === 'confirmed'} onClose={() => setModal(null)} className="scr-receive-sheet">
        <div className="scr-receive-sheet-inner">
          <div className="scr-receive-sheet-content">
            <div className="scr-receive-sheet-banner scr-receive-sheet-banner-success">
              <Glyph name="check-circle" size={24} className="scr-receive-sheet-banner-icon" />
              <p className="scr-receive-sheet-banner-text">
                Your payment has been confirmed. View your updated subscription status now.
              </p>
            </div>

            <div className="scr-receive-sheet-rows">
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">amount to be paid</span>
                <span className="scr-receive-sheet-row-value">
                  {AMOUNT_DUE} {CURRENCY_CODE}
                </span>
              </div>
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">You paid</span>
                <span className="scr-receive-sheet-row-value">
                  {AMOUNT_PAID_CONFIRMED} {CURRENCY_CODE}
                </span>
              </div>
            </div>
          </div>

          <Button variant="primary" size="medium" fullWidth onClick={() => onDone?.()}>
            View subscription status
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
