import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, Radio } from '../../design-system/components';
import { PaymentHeader } from '../payment/PaymentHeader';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import './WithdrawCurrency.css';

/* ---------------------------------------------------------------------------
 * Withdraw earnings — step 1, pick currency+network — route /earning/withdraw
 * Frame 1379:6901 (360x1000). One card (16,92 -> 328x816) holding six 296x112
 * options on a 12 gap: a 32px coin with a 16px network badge, the symbol and
 * network, a radio at x=252, then the network-fee / minimum-withdraw row.
 * The CTA stays disabled until something is picked (1482:5747 shows it live).
 * ------------------------------------------------------------------------- */

const money = (n: number) => `$${n.toFixed(2)}`;

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
                <label className={'scr-wdcur-opt' + (selected === o.id ? ' scr-wdcur-opt--on' : '')}>
                  <span className="scr-wdcur-opt-top">
                    <span className="scr-wdcur-coin">
                      <img src={o.icon} alt="" width={32} height={32} />
                      <img className="scr-wdcur-coin-net" src={o.networkIcon} alt="" width={16} height={16} />
                    </span>
                    <span className="scr-wdcur-opt-name">
                      <span className="scr-wdcur-opt-symbol type-text-sm-semibold">{o.symbol}</span>
                      <span className="scr-wdcur-opt-network type-text-xs-10">{o.network}</span>
                    </span>
                    <Radio checked={selected === o.id} onChange={() => setSelected(o.id)} />
                  </span>

                  <span className="scr-wdcur-opt-meta">
                    <span className="scr-wdcur-meta-cell">
                      <span className="scr-wdcur-meta-label type-text-xs-10">Network fee</span>
                      <span className="scr-wdcur-meta-value type-text-xs">{money(o.networkFee)}</span>
                    </span>
                    <span className="scr-wdcur-meta-cell">
                      <span className="scr-wdcur-meta-label type-text-xs-10">Minimum withdraw</span>
                      <span className="scr-wdcur-meta-value type-text-xs">{money(o.minimum)}</span>
                    </span>
                  </span>
                </label>
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
