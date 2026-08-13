import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, ProgressBar } from '../../design-system/components';
import type { Gateway } from '../../api/client';
import { useBackButton } from '../../telegram';
import { SelectRow } from './SelectRow';
import { CURRENCIES } from './currencyData';
import { currencyOptions } from './gatewayDisplay';
import './PaymentCurrency.css';

/* ---------------------------------------------------------------------------
 * Payment — select currency — route /payment/currency
 * Checkout step 2/3 (part a). Canonical frame 1284:3883 (geometry-identical
 * to old 552-3121): BTC/USDT/SOL/USDC/ETH list, none selected — every row's
 * border and radio render in the plain unselected state and the CTA starts
 * disabled, matching the reference pixel-for-pixel (row borders/radios are
 * all --stroke-colors-default, the button is the grey :disabled style).
 * The "Change currency" BottomSheet (789-2421) lives in PaymentNetwork —
 * that frame's backdrop is the network screen's layout.
 * ------------------------------------------------------------------------- */

export interface PaymentCurrencyProps {
  initialCurrencyId?: string;
  /** Live options from GET /api/gateways. Omitted = static demo list (the
   *  design-review harness hits this route with no order in flight). */
  gateways?: Gateway[];
  onBack?: () => void;
  onContinue?: (currencyId: string) => void;
}

export default function PaymentCurrency({
  initialCurrencyId,
  gateways,
  onBack,
  onContinue,
}: PaymentCurrencyProps): ReactNode {
  // No in-app header: Telegram draws the bar, so back lives on its BackButton.
  useBackButton(onBack);
  const [selected, setSelected] = useState<string | null>(initialCurrencyId ?? null);
  const currencies = gateways ? currencyOptions(gateways) : CURRENCIES;

  return (
    <div className="scr-payment-currency">
      <main className="scr-payment-currency-body">
        <ProgressBar current="payment-details" />

        <section className="scr-payment-currency-card">
          <h2 className="scr-payment-currency-heading">Select currency</h2>
          <div className="scr-payment-currency-list">
            {gateways && currencies.length === 0 ? (
              <p className="scr-payment-currency-empty">
                Payments are temporarily unavailable. Please try again later.
              </p>
            ) : (
              currencies.map((c) => (
                <SelectRow
                  key={c.id}
                  icon={c.icon}
                  primary={c.symbol}
                  secondary={c.name}
                  selected={c.id === selected}
                  onClick={() => setSelected(c.id)}
                />
              ))
            )}
          </div>
        </section>
      </main>

      <footer className="scr-payment-currency-footer">
        <Button
          variant="primary"
          size="medium"
          fullWidth
          disabled={!selected}
          iconRight={<Icon name="chevron-right" size={20} />}
          onClick={() => selected && onContinue?.(selected)}
        >
          Continue
        </Button>
      </footer>
    </div>
  );
}
