import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, ProgressBar } from '../../design-system/components';
import { PaymentHeader } from './PaymentHeader';
import { SelectRow } from './SelectRow';
import { CURRENCIES } from './currencyData';
import { NETWORKS } from './networkData';
import './PaymentNetwork.css';

/* ---------------------------------------------------------------------------
 * Payment — select network — route /payment/network
 * Checkout step 2/3 (part b). One screen, two states from the inventory:
 *   552-3122  base picker — selected-currency summary card + BNB/Tron/ETH/
 *             Polygon/Avalanche/Solana list, BNB Smart Chain selected
 *   788-3192  same screen with a black tooltip callout open near the info
 *             (i) button, tail pointing down at it
 *
 * The tooltip is a dismissible positioned overlay: tapping the info button
 * toggles it; tapping anywhere outside (a full-screen transparent backdrop)
 * dismisses it. "Change currency" routes back to /payment/currency —
 * assembly wires onChangeCurrency, this screen does not navigate itself.
 * ------------------------------------------------------------------------- */

export interface PaymentNetworkProps {
  currencyId?: string;
  initialNetworkId?: string;
  onBack?: () => void;
  onChangeCurrency?: () => void;
  onContinue?: (networkId: string) => void;
}

export default function PaymentNetwork({
  currencyId = 'btc',
  initialNetworkId = 'bnb-smart-chain',
  onBack,
  onChangeCurrency,
  onContinue,
}: PaymentNetworkProps): ReactNode {
  const [selected, setSelected] = useState(initialNetworkId);
  const [tooltipOpen, setTooltipOpen] = useState(false);

  const currency = CURRENCIES.find((c) => c.id === currencyId) ?? CURRENCIES[0];

  return (
    <div className="scr-payment-network">
      <PaymentHeader onBack={onBack} />

      <main className="scr-payment-network-body">
        <ProgressBar current="payment-details" />

        <section className="scr-payment-network-card">
          <div className="scr-payment-network-selected">
            <p className="scr-payment-network-label">Selected currency</p>
            <div className="scr-payment-network-selected-row">
              <span className="scr-payment-network-selected-info">
                <img
                  className="scr-payment-network-selected-icon"
                  src={currency.icon}
                  alt=""
                  width={32}
                  height={32}
                />
                <span className="scr-payment-network-selected-text">
                  <span className="scr-payment-network-selected-symbol">{currency.symbol}</span>
                  <span className="scr-payment-network-selected-name">{currency.name}</span>
                </span>
              </span>
              <button type="button" className="scr-payment-network-change-btn" onClick={onChangeCurrency}>
                Change currency
              </button>
            </div>
          </div>

          <div className="scr-payment-network-select">
            <div className="scr-payment-network-select-head">
              <h2 className="scr-payment-network-select-title">Select network</h2>
              <button
                type="button"
                className="scr-payment-network-info-btn"
                onClick={() => setTooltipOpen((open) => !open)}
                aria-label="Network info"
                aria-expanded={tooltipOpen}
              >
                <Icon name="info" size={24} strokeWidth={1.5} />
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
              {NETWORKS.map((n) => (
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
        <Button
          variant="primary"
          size="medium"
          fullWidth
          iconRight={<Icon name="chevron-right" size={20} />}
          onClick={() => onContinue?.(selected)}
        >
          Continue
        </Button>
      </footer>
    </div>
  );
}
