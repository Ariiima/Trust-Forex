import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon } from '../../design-system/components';
import { PaymentHeader } from '../payment/PaymentHeader';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import { WithdrawOptionCard } from './WithdrawOptionCard';
import './WithdrawCurrency.css';

/* ---------------------------------------------------------------------------
 * Withdraw earnings — step 1, pick currency+network — route /earning/withdraw
 * Frame 1379:6901 (360x1000). One card (16,92 -> 328x816) holding six 296x112
 * options on a 12 gap: a 32px coin with a 16px network badge, the symbol and
 * network, a radio at x=252, then the network-fee / minimum-withdraw row.
 * The CTA stays disabled until something is picked (1482:5747 shows it live).
 * ------------------------------------------------------------------------- */

export interface WithdrawCurrencyProps {
  onBack?: () => void;
  onContinue?: (optionId: string) => void;
}

export function WithdrawCurrency({ onBack, onContinue }: WithdrawCurrencyProps): ReactNode {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div className="scr-wdcur">
      <PaymentHeader title="Withdraw earnings" onBack={onBack} />

      <main className="scr-wdcur-main">
        <section className="scr-wdcur-card">
          <h2 className="scr-wdcur-label type-text-xs">Select currency</h2>

          <ul className="scr-wdcur-list">
            {WITHDRAW_OPTIONS.map((o) => (
              <li key={o.id}>
                <WithdrawOptionCard option={o} selected={selected === o.id} onSelect={() => setSelected(o.id)} />
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="scr-wdcur-footer">
        <Button
          variant="primary"
          size="medium"
          fullWidth
          disabled={!selected}
          iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
          onClick={() => selected && onContinue?.(selected)}
        >
          Continue
        </Button>
      </footer>
    </div>
  );
}

export default WithdrawCurrency;
