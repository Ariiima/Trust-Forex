import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon, ProgressBar } from '../../design-system/components';
import type { Gateway } from '../../api/client';
import { useBackButton } from '../../telegram';
import { Glyph } from './Glyph';
import { SelectRow } from './SelectRow';
import { CURRENCIES } from './currencyData';
import { NETWORKS } from './networkData';
import { currencyOptions, networkOptions } from './gatewayDisplay';
import './PaymentNetwork.css';

/* ---------------------------------------------------------------------------
 * Payment — select network — route /payment/network
 * Checkout step 2/3 (part b). Canonical frame 1292:4030 (geometry-identical
 * to old 552-3122): selected-currency summary + BNB/Tron/ETH/Polygon/
 * Avalanche/Solana list, BNB Smart Chain selected. Two overlay states:
 *   788-3192  black tooltip callout near the info (i) button
 *   789-2421  "Change currency" BottomSheet — opened by the summary row's
 *             "Change currency" button (that frame's backdrop is THIS
 *             screen's layout). Draft selection commits on "Choose
 *             currency"; close/scrim discards. Currency is uncontrolled
 *             after mount — commit fires onCurrencyChange for assembly.
 * ------------------------------------------------------------------------- */

export interface PaymentNetworkProps {
  initialCurrencyId?: string;
  initialNetworkId?: string;
  /** Live options from GET /api/gateways. Omitted = static demo lists (the
   *  design-review harness hits this route with no order in flight). */
  gateways?: Gateway[];
  /** Continue is in flight (POST /orders/:id/select) — disables the CTA. */
  busy?: boolean;
  /** Select failed, e.g. live rate unavailable. Shown above the CTA. */
  error?: string;
  onBack?: () => void;
  onCurrencyChange?: (currencyId: string) => void;
  onContinue?: (networkId: string, currencyId: string) => void;
}

export default function PaymentNetwork({
  initialCurrencyId,
  initialNetworkId,
  gateways,
  busy,
  error,
  onBack,
  onCurrencyChange,
  onContinue,
}: PaymentNetworkProps): ReactNode {
  // No in-app header: Telegram draws the bar, so back lives on its BackButton.
  useBackButton(onBack);
  const currencies = gateways ? currencyOptions(gateways) : CURRENCIES;
  const fallbackCurrencyId = initialCurrencyId ?? currencies[0]?.id ?? 'btc';
  const [currencyId, setCurrencyId] = useState(fallbackCurrencyId);
  // The frame shows nothing chosen and the CTA disabled — no default.
  const [selected, setSelected] = useState<string | undefined>(initialNetworkId);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(fallbackCurrencyId);

  const currency = currencies.find((c) => c.id === currencyId) ?? currencies[0];
  // Live mode narrows the list to the chosen currency's networks; a currency
  // switch invalidates a network selection that no longer exists.
  const networks = gateways
    ? networkOptions(gateways, currencyId).map((n) => ({ id: n.id, label: n.label, icon: n.icon }))
    : NETWORKS;

  // Clicks elsewhere are caught by the backdrop below; scrolling isn't.
  useEffect(() => {
    if (!tooltipOpen) return;
    const close = (): void => setTooltipOpen(false);
    document.addEventListener('scroll', close, true);
    return () => document.removeEventListener('scroll', close, true);
  }, [tooltipOpen]);

  const openSheet = (): void => {
    setDraft(currencyId);
    setSheetOpen(true);
  };

  const handleChoose = (): void => {
    setCurrencyId(draft);
    // Live lists differ per currency — drop a network pick the new currency lacks.
    if (gateways && selected && !networkOptions(gateways, draft).some((n) => n.id === selected)) {
      setSelected(undefined);
    }
    setSheetOpen(false);
    onCurrencyChange?.(draft);
  };

  return (
    <div className="scr-payment-network">
      <main className="scr-payment-network-body">
        <ProgressBar current="payment-details" />

        <section className="scr-payment-network-card">
          <div className="scr-payment-network-selected">
            <p className="scr-payment-network-label">Selected currency</p>
            <div className="scr-payment-network-selected-row">
              <span className="scr-payment-network-selected-info">
                <img
                  className="scr-payment-network-selected-icon"
                  src={currency?.icon}
                  alt=""
                  width={32}
                  height={32}
                />
                <span className="scr-payment-network-selected-text">
                  <span className="scr-payment-network-selected-symbol">{currency?.symbol}</span>
                  <span className="scr-payment-network-selected-name">{currency?.name}</span>
                </span>
              </span>
              <button type="button" className="scr-payment-network-change-btn" onClick={openSheet}>
                Change currency
              </button>
            </div>
          </div>

          <div className="scr-payment-network-select">
            <div className="scr-payment-network-select-head">
              <h2 className="scr-payment-network-select-title">Select network</h2>
              <button
                type="button"
                className="ds-info-btn"
                onClick={() => setTooltipOpen((open) => !open)}
                aria-label="Network info"
                aria-expanded={tooltipOpen}
              >
                <Icon name="info" size={20} />
              </button>

              {tooltipOpen ? (
                <>
                  <button
                    type="button"
                    className="scr-payment-network-tooltip-backdrop"
                    onClick={() => setTooltipOpen(false)}
                    aria-label="Dismiss tooltip"
                  />
                  <div className="scr-payment-network-tooltip" role="tooltip">
                    Make sure the selected network matches the network used for payment.
                    <span className="scr-payment-network-tooltip-arrow" />
                  </div>
                </>
              ) : null}
            </div>

            <div className="scr-payment-network-list">
              {networks.map((n) => (
                <SelectRow
                  key={n.id}
                  icon={n.icon}
                  primary={n.label}
                  selected={n.id === selected}
                  onClick={() => setSelected(n.id)}
                />
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="scr-payment-network-footer">
        {error ? <p className="scr-payment-network-error">{error}</p> : null}
        <Button
          variant="primary"
          size="medium"
          fullWidth
          iconRight={<Icon name="chevron-right" size={20} />}
          disabled={!selected || busy}
          onClick={() => selected && onContinue?.(selected, currencyId)}
        >
          {busy ? 'Preparing…' : 'Continue'}
        </Button>
      </footer>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} className="scr-payment-network-sheet">
        <div className="scr-payment-network-sheet-inner">
          <div className="scr-payment-network-sheet-content">
            <div className="scr-payment-network-sheet-head">
              <div className="scr-payment-network-sheet-titlerow">
                <h2 className="scr-payment-network-sheet-title">Change currency</h2>
                <button
                  className="scr-payment-network-sheet-close"
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                >
                  <Glyph name="close" size={24} />
                </button>
              </div>
              <hr className="scr-payment-network-sheet-divider" />
            </div>

            <div className="scr-payment-network-sheet-list">
              {currencies.map((c) => (
                <SelectRow
                  key={c.id}
                  icon={c.icon}
                  primary={c.symbol}
                  secondary={c.name}
                  selected={c.id === draft}
                  onClick={() => setDraft(c.id)}
                />
              ))}
            </div>
          </div>

          <Button
            variant="primary"
            size="medium"
            fullWidth
            iconRight={<Icon name="chevron-right" size={20} />}
            onClick={handleChoose}
          >
            Choose currency
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
