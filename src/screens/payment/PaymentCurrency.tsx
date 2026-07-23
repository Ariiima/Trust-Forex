import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon, ProgressBar } from '../../design-system/components';
import { Glyph } from './Glyph';
import { PaymentHeader } from './PaymentHeader';
import { SelectRow } from './SelectRow';
import { CURRENCIES } from './currencyData';
import './PaymentCurrency.css';

/* ---------------------------------------------------------------------------
 * Payment — select currency — route /payment/currency
 * Checkout step 2/3 (part a). One screen, two states from the inventory:
 *   552-3121  base picker — BTC/USDT/SOL/USDC/ETH list, BTC selected
 *   789-2421  "Change currency" BottomSheet open over the same currency list
 *
 * Discrepancy: 789-2421's own backdrop (the dimmed page behind the sheet)
 * renders the *Network* screen's layout ("Selected currency" summary +
 * "Select network" heading), not 552-3121's plain list — i.e. in the source
 * file this sheet is opened from PaymentNetwork's "Change currency" button,
 * not from this screen. Per the task assignment it's built here instead,
 * reusing the same currency data/rows. Since 552-3121 has no visible
 * trigger of its own, re-tapping the already-selected row reopens the sheet
 * so the state stays reachable without inventing new UI. See report.
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
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(initialCurrencyId);

  const handleRowClick = (id: string): void => {
    if (id === selected) {
      setDraft(selected);
      setSheetOpen(true);
      return;
    }
    setSelected(id);
  };

  const handleChoose = (): void => {
    setSelected(draft);
    setSheetOpen(false);
  };

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
                onClick={() => handleRowClick(c.id)}
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

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} className="scr-payment-currency-sheet">
        <div className="scr-payment-currency-sheet-inner">
          <div className="scr-payment-currency-sheet-content">
            <div className="scr-payment-currency-sheet-head">
              <div className="scr-payment-currency-sheet-titlerow">
                <h2 className="scr-payment-currency-sheet-title">Change currency</h2>
                <button
                  className="scr-payment-currency-sheet-close"
                  type="button"
                  onClick={() => setSheetOpen(false)}
                  aria-label="Close"
                >
                  <Glyph name="close" size={24} strokeWidth={1.5} />
                </button>
              </div>
              <hr className="scr-payment-currency-sheet-divider" />
            </div>

            <div className="scr-payment-currency-sheet-list">
              {CURRENCIES.map((c) => (
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
