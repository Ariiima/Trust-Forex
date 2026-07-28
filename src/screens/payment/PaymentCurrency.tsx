import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, ProgressBar } from '../../design-system/components';
import { PaymentHeader } from './PaymentHeader';
import { SelectRow } from './SelectRow';
import { CURRENCIES } from './currencyData';
import './PaymentCurrency.css';

/* ---------------------------------------------------------------------------
 * Payment — select currency — route /payment/currency
 * Checkout step 2/3 (part a). Canonical frame 1284:3883 (geometry-identical
 * to old 552-3121): BTC/USDT/SOL/USDC/ETH list, BTC selected. Plain picker.
 * The "Change currency" BottomSheet (789-2421) lives in PaymentNetwork —
 * that frame's backdrop is the network screen's layout.
 * ------------------------------------------------------------------------- */

export interface PaymentCurrencyProps {
  initialCurrencyId?: string;
  onBack?: () => void;
  onContinue?: (currencyId: string) => void;
}

export default function PaymentCurrency({
  initialCurrencyId = 'btc',
  onBack,
  onContinue,
}: PaymentCurrencyProps): ReactNode {
  const [selected, setSelected] = useState(initialCurrencyId);

  return (
    <div className="scr-payment-currency">
      <PaymentHeader onBack={onBack} />

      <main className="scr-payment-currency-body">
        <ProgressBar current="payment-details" />

        <section className="scr-payment-currency-card">
          <h2 className="scr-payment-currency-heading">Select currency</h2>
          <div className="scr-payment-currency-list">
            {CURRENCIES.map((c) => (
              <SelectRow
                key={c.id}
                icon={c.icon}
                primary={c.symbol}
                secondary={c.name}
                selected={c.id === selected}
                onClick={() => setSelected(c.id)}
              />
            ))}
          </div>
        </section>
      </main>

      <footer className="scr-payment-currency-footer">
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
