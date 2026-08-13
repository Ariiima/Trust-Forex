import { useEffect, useState } from 'react';
import type { MouseEvent, ReactNode } from 'react';
import QRCode from 'qrcode';
import { Button, BottomSheet, Icon, ProgressBar } from '../../design-system/components';
import { Glyph } from './Glyph';
import { getMe, joinGroup } from '../../api/client';
import { useBackButton } from '../../telegram';
import { useOrderPoll } from './useOrderPoll';
import { metamaskUrl, paymentUri, trustWalletUrl } from './walletLinks';
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
type ModalKind = 'review' | 'incomplete' | 'confirmed' | 'expired' | null;
type CopyField = 'amount' | 'address' | 'memo' | null;

// Demo values from node JSON (1102-10506 / 1108-12144 / 1108-12253) — what the
// screen renders in dev/review when the route is hit with no orderId at all
// (the design-review harness). A real order always resolves through the poll;
// while it's still in flight the fields show a loading dash, not these.
const CURRENCY_NETWORK = 'BNB(BEP-20)';
const SEND_AMOUNT = '0.00350773';
const SEND_UNIT = 'BNB';
const WALLET_ADDRESS = '0X1C42......48Hf7f8';
const MEMO = '28442536';

const AMOUNT_DUE = '2.00';
const AMOUNT_PAID_CONFIRMED = '2.00';
const AMOUNT_REMAINING = '1.43';
const CURRENCY_CODE = 'USD';

/** Figma shows the address elided to head……tail; copy still copies the full string. */
const elide = (s: string): string => (s.length > 18 ? `${s.slice(0, 6)}......${s.slice(-8)}` : s);

const WALLET_ICONS = [
  { id: 'walletconnect', src: wallet1, alt: 'WalletConnect' },
  { id: 'metamask', src: wallet2, alt: 'MetaMask' },
  { id: 'other', src: wallet3, alt: 'Other wallet' },
] as const;

/** External wallet link, routed through the Telegram API when available so it
 *  leaves the webview cleanly; plain target=_blank otherwise. */
function walletAnchor(e: MouseEvent<HTMLAnchorElement>, url: string): void {
  const tg = window.Telegram?.WebApp;
  if (tg?.openLink) {
    e.preventDefault();
    tg.openLink(url);
  }
}

export interface PaymentReceiveProps {
  /** Live order to display and poll. Omitted = static demo values (harness). */
  orderId?: string;
  initialTab?: QrTab;
  /** Drives which (if any) status modal is open on mount — see note above. */
  initialModal?: ModalKind;
  onBack?: () => void;
  /** "Pay remaining amount" CTA in the incomplete-payment modal. */
  onPayRemaining?: () => void;
  /** "View subscription status" CTA in the confirmed-payment modal — exits the flow (back to Home). */
  onDone?: () => void;
  /** "Back to checkout" CTA in the expired-order modal. */
  onExpired?: () => void;
}

export default function PaymentReceive({
  orderId,
  initialTab = 'address',
  initialModal = null,
  onBack,
  onPayRemaining,
  onDone,
  onExpired,
}: PaymentReceiveProps): ReactNode {
  useBackButton(onBack);
  const [tab, setTab] = useState<QrTab>(initialTab);
  const [modal, setModal] = useState<ModalKind>(initialModal);
  const [copiedField, setCopiedField] = useState<CopyField>(null);
  const [qrSrc, setQrSrc] = useState<string | null>(null);

  const rawOrder = useOrderPoll(orderId);
  /* After a partial payment, everything the user acts on — the amount row, the
     QR, the wallet deep links — switches to the REMAINING amount, so "pay
     what the screen shows" stays the one rule of the whole flow. */
  const order =
    rawOrder && rawOrder.status !== 'confirmed' && rawOrder.remainingCrypto && rawOrder.remainingCrypto !== '0'
      ? { ...rawOrder, amountCrypto: rawOrder.remainingCrypto }
      : rawOrder;

  /* Live display values. The demo constants are for the bare-route render
     (no orderId at all) in dev/review only — a real order still waiting on
     its first poll tick shows a loading dash, never the demo wallet address:
     that address is placeholder text, but every visit to this screen used to
     flash it, amounts and all, before the real one landed. */
  const demoOk = !orderId && import.meta.env.DEV;
  const currencyNetwork = order ? `${order.currency ?? ''}(${order.network ?? ''})` : demoOk ? CURRENCY_NETWORK : '—';
  const sendAmount = order ? (order.amountCrypto ?? '—') : demoOk ? SEND_AMOUNT : '—';
  const sendUnit = order ? (order.currency ?? '') : demoOk ? SEND_UNIT : '';
  const walletAddress = order ? (order.address ?? '') : demoOk ? WALLET_ADDRESS : '';
  const memo = orderId ? order?.memo : demoOk ? MEMO : undefined;
  const amountDue = order ? order.amountUsd.toFixed(2) : demoOk ? AMOUNT_DUE : '0.00';
  const amountPaid = order ? (order.paidUsd ?? order.amountUsd).toFixed(2) : demoOk ? AMOUNT_PAID_CONFIRMED : '0.00';
  const amountRemaining = order ? (order.remainingUsd ?? 0).toFixed(2) : demoOk ? AMOUNT_REMAINING : '0.00';
  const overpaid = order?.overpaidUsd ?? 0;

  /* "Address QR" encodes the bare address; "Payment QR" a full payment
     request (address + exact amount) where a scannable standard exists —
     falling back to the address on networks without one (TRON). */
  const qrData = tab === 'payment' && order ? (paymentUri(order) ?? walletAddress) : walletAddress;
  useEffect(() => {
    if (!qrData || !orderId) return;
    let stale = false;
    QRCode.toDataURL(qrData, { width: 296, margin: 1 })
      .then((url) => {
        if (!stale) setQrSrc(url);
      })
      .catch(() => undefined);
    return () => {
      stale = true;
    };
  }, [qrData, orderId]);

  // The poll is the trigger the design left to "the assembly layer". Ladder of
  // states: confirmed / dead > partially paid > detected-under-review. Each
  // effect dep is a value, so a dismissed sheet reopens only when the payment
  // actually progresses, not on every poll tick.
  const status = order?.status;
  const detectedTx = order?.txid;
  const paidUsd = order?.paidUsd ?? 0;
  useEffect(() => {
    if (status === 'confirmed') {
      setModal('confirmed');
      /* The books are already updated server-side; refresh the shared `me`
         cache now so Home / subscription screens mount on the ACTIVE state,
         not the pre-payment snapshot they cached at boot. */
      void getMe();
    } else if (status === 'expired' || status === 'failed') setModal('expired');
    else if (paidUsd > 0) setModal('incomplete');
    else if (detectedTx) setModal('review');
  }, [status, detectedTx, paidUsd]);

  const [vipBusy, setVipBusy] = useState(false);
  const openVip = (): void => {
    if (vipBusy) return;
    setVipBusy(true);
    joinGroup()
      .then((r) => {
        if (r.link) {
          const tg = window.Telegram?.WebApp;
          if (tg?.openTelegramLink) tg.openTelegramLink(r.link);
          else window.open(r.link, '_blank', 'noreferrer');
        }
      })
      .catch(() => undefined)
      .finally(() => setVipBusy(false));
  };

  const copy = (field: Exclude<CopyField, null>, value: string): void => {
    navigator.clipboard?.writeText(value).catch(() => undefined);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
  };

  const copyButton = (field: Exclude<CopyField, null>, value: string, label: string): ReactNode => (
    <button
      type="button"
      className={'scr-receive-copy' + (copiedField === field ? ' scr-receive-copy--done' : '')}
      onClick={() => copy(field, value)}
      aria-label={copiedField === field ? `${label} copied` : `Copy ${label}`}
    >
      {/* Both glyphs stay mounted and cross-fade via CSS (below) — same
          pattern as ReferralMain's copy buttons — rather than one replacing
          the other, which read as an instant snap. */}
      <span className="scr-receive-copy-icon">
        <Glyph name="copy" size={16} className="scr-receive-copy-icon-copy" />
        <Icon name="check" size={16} className="scr-receive-copy-icon-check" />
      </span>
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
                <img className="scr-receive-qr" src={qrSrc ?? qrPlaceholder} alt="Payment QR code" width={148} height={148} />
              </div>

              <div className="scr-receive-rows">
                <div className="scr-receive-row">
                  <span className="scr-receive-row-label">Currency (network)</span>
                  <span className="scr-receive-row-value">{currencyNetwork}</span>
                </div>
                <div className="scr-receive-row">
                  <span className="scr-receive-row-label">Amount to send</span>
                  <span className="scr-receive-row-value scr-receive-row-value-copy">
                    {sendAmount} {sendUnit}
                    {copyButton('amount', sendAmount, 'amount')}
                  </span>
                </div>
                <div className="scr-receive-row">
                  <span className="scr-receive-row-label">Wallet address</span>
                  <span className="scr-receive-row-value scr-receive-row-value-copy">
                    {elide(walletAddress)}
                    {copyButton('address', walletAddress, 'wallet address')}
                  </span>
                </div>
              </div>
            </div>

            {memo ? (
              <div className="scr-receive-memo">
                <span className="scr-receive-memo-label">Memo required</span>
                <span className="scr-receive-row-value scr-receive-row-value-copy">
                  {memo}
                  {copyButton('memo', memo, 'memo')}
                </span>
              </div>
            ) : null}

            <div className="scr-receive-connect">
              <div className="scr-receive-divider-row">
                <span className="scr-receive-divider-line" aria-hidden="true" />
                <span className="scr-receive-divider-text">Or pay with connecting wallet</span>
                <span className="scr-receive-divider-line" aria-hidden="true" />
              </div>
              <div className="scr-receive-wallets">
                {orderId ? (
                  order ? (
                    /* Only wallets whose deep link carries the full payment
                       (receiving address + exact amount) get a tile — a button
                       that opens a wallet empty-handed invites a wrong-amount
                       payment the watcher can never match. */
                    [
                      {
                        id: 'trust-wallet',
                        alt: 'Trust Wallet',
                        url: trustWalletUrl(order),
                        icon: <img src={wallet1} alt="" width={32} height={32} />,
                      },
                      {
                        id: 'metamask',
                        alt: 'MetaMask',
                        url: metamaskUrl(order),
                        icon: <img src={wallet2} alt="" width={32} height={32} />,
                      },
                    ]
                      .filter((w): w is typeof w & { url: string } => Boolean(w.url))
                      .map((w) => (
                        <a
                          key={w.id}
                          className="scr-receive-wallet-btn"
                          href={w.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={w.alt}
                          onClick={(e) => walletAnchor(e, w.url)}
                        >
                          {w.icon}
                        </a>
                      ))
                  ) : null
                ) : (
                  // Bare-route demo: the three decorative icons from the frame.
                  WALLET_ICONS.map((w) => (
                    <button type="button" key={w.id} className="scr-receive-wallet-btn" aria-label={w.alt}>
                      <img src={w.src} alt="" width={32} height={32} />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Payment-under-review modal — first on-chain sighting, confirmations
          still accruing. No CTA: it resolves itself into confirmed/incomplete. */}
      <BottomSheet open={modal === 'review'} onClose={() => setModal(null)} className="scr-receive-sheet">
        <div className="scr-receive-sheet-inner">
          <div className="scr-receive-sheet-content">
            <div className="scr-receive-sheet-banner scr-receive-sheet-banner-review">
              <Glyph name="clock-hour-5" size={24} className="scr-receive-sheet-banner-icon" />
              <p className="scr-receive-sheet-banner-text">
                Your payment is currently under review. Confirmation may take a few moments.
              </p>
            </div>

            <div className="scr-receive-sheet-rows">
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">Amount to be paid</span>
                <span className="scr-receive-sheet-row-value">
                  {amountDue} {CURRENCY_CODE}
                </span>
              </div>
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">You paid</span>
                <span className="scr-receive-sheet-row-value">
                  <Icon name="loader-2" size={20} className="scr-receive-spin" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </BottomSheet>

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
                  {amountDue} {CURRENCY_CODE}
                </span>
              </div>
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">You paid</span>
                <span className="scr-receive-sheet-row-value">{order ? `${amountPaid} ${CURRENCY_CODE}` : '---'}</span>
              </div>
              <div className="scr-receive-sheet-row scr-receive-sheet-row-highlight">
                <span className="scr-receive-sheet-row-label">Remaining amount</span>
                <span className="scr-receive-sheet-row-value scr-receive-sheet-row-value-highlight">
                  {amountRemaining} {CURRENCY_CODE}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            size="small"
            fullWidth
            className="scr-receive-pay-btn"
            /* Live: the screen behind already shows the remaining amount/QR —
               the CTA just gets the sheet out of the way. */
            onClick={() => (orderId ? setModal(null) : onPayRemaining?.())}
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
                  {amountDue} {CURRENCY_CODE}
                </span>
              </div>
              <div className="scr-receive-sheet-row">
                <span className="scr-receive-sheet-row-label">You paid</span>
                <span className="scr-receive-sheet-row-value">
                  {amountPaid} {CURRENCY_CODE}
                </span>
              </div>
              {/* Overpaid: the plan is bought and the excess is the user's, so
                  say where it went before they have to ask. */}
              {overpaid > 0 ? (
                <div className="scr-receive-sheet-row scr-receive-sheet-row-highlight scr-receive-sheet-row-credit">
                  <span className="scr-receive-sheet-row-label">You paid extra</span>
                  <span className="scr-receive-sheet-row-value scr-receive-sheet-row-value-highlight">
                    +{overpaid.toFixed(2)} {CURRENCY_CODE}
                  </span>
                </div>
              ) : null}
            </div>

            {overpaid > 0 ? (
              <p className="scr-receive-sheet-note">
                You paid {overpaid.toFixed(2)} {CURRENCY_CODE} more than the amount due — it has been
                added to your earning balance.
              </p>
            ) : null}
          </div>

          <div className="scr-receive-sheet-actions">
            <Button variant="primary" size="medium" fullWidth onClick={() => onDone?.()}>
              View subscription status
            </Button>
            {orderId ? (
              <Button variant="outline" size="medium" fullWidth disabled={vipBusy} onClick={openVip}>
                Join VIP channel
              </Button>
            ) : null}
          </div>
        </div>
      </BottomSheet>

      {/* Order-expired modal — no Figma frame exists; reuses the incomplete
          sheet's warn styling. Not dismissable into a dead screen: the only
          exit is back to checkout for a fresh order. */}
      <BottomSheet open={modal === 'expired'} onClose={() => onExpired?.()} className="scr-receive-sheet">
        <div className="scr-receive-sheet-inner">
          <div className="scr-receive-sheet-content">
            <div className="scr-receive-sheet-banner scr-receive-sheet-banner-warn">
              <Icon name="info" size={24} className="scr-receive-sheet-banner-icon" />
              <p className="scr-receive-sheet-banner-text">
                {paidUsd > 0
                  ? `This payment window has expired. The ${paidUsd.toFixed(2)} ${CURRENCY_CODE} you paid was added to your earning balance.`
                  : 'This payment window has expired. Start a new order to continue.'}
              </p>
            </div>
          </div>

          <Button variant="primary" size="medium" fullWidth onClick={() => onExpired?.()}>
            Back to checkout
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
