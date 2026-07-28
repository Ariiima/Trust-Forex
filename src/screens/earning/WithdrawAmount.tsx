import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, Input } from '../../design-system/components';
import { PaymentHeader } from '../payment/PaymentHeader';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import './WithdrawAmount.css';

/* ---------------------------------------------------------------------------
 * Withdraw earnings — step 2, amount + wallet — route /earning/withdraw/amount
 * Frame 1402:7310 (360x852). One card (16,92 -> 328x335): the chosen currency
 * with a "Change currency" button, the amount field with a Max chip and the
 * available-balance line, then the wallet-address field.
 *
 * 2-1..2-5 are the same screen in different action states (tweaks.md #1), so
 * the below-minimum copy comes from the DS Input's error state rather than a
 * separate layer — the frame XML has no error text of its own.
 * ------------------------------------------------------------------------- */

const money = (n: number) => `$${n.toFixed(2)}`;

export interface WithdrawAmountProps {
  optionId?: string;
  availableBalance?: number;
  onBack?: () => void;
  onChangeCurrency?: () => void;
  onContinue?: (amount: number, wallet: string) => void;
}

export function WithdrawAmount({
  optionId = 'usdt-bep20',
  availableBalance = 245,
  onBack,
  onChangeCurrency,
  onContinue,
}: WithdrawAmountProps): ReactNode {
  const option = WITHDRAW_OPTIONS.find((o) => o.id === optionId) ?? WITHDRAW_OPTIONS[0];
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [touched, setTouched] = useState(false);

  const numeric = Number(amount);
  const belowMinimum = touched && amount !== '' && (!Number.isFinite(numeric) || numeric < option.minimum);
  const overBalance = touched && Number.isFinite(numeric) && numeric > availableBalance;
  const amountError = belowMinimum
    ? 'Amount is below the minimum.'
    : overBalance
      ? 'Amount exceeds your available balance.'
      : undefined;

  const ready = !amountError && Number.isFinite(numeric) && numeric >= option.minimum && wallet.trim() !== '';

  return (
    <div className="scr-wdamt">
      <PaymentHeader title="Withdraw earnings" onBack={onBack} />

      <main className="scr-wdamt-main">
        <section className="scr-wdamt-card">
          <h2 className="scr-wdamt-title type-text-xs">Withdrawal details</h2>

          <div className="scr-wdamt-currency">
            <span className="scr-wdamt-coin">
              <img src={option.icon} alt="" width={32} height={32} />
            </span>
            <span className="scr-wdamt-currency-name">
              <span className="scr-wdamt-currency-symbol type-text-sm-semibold">{option.symbol}</span>
              <span className="scr-wdamt-currency-network type-text-xs-10">({option.network})</span>
            </span>
            <Button variant="outline" size="xsmall" className="scr-wdamt-change" onClick={onChangeCurrency}>
              Change currency
            </Button>
          </div>

          <div className="scr-wdamt-amount">
            <Input
              label="Amount to withdraw"
              value={amount}
              onChange={(v) => {
                setAmount(v);
                setTouched(true);
              }}
              placeholder="Enter amount"
              error={amountError}
              rightSlot={
                <button
                  type="button"
                  className="scr-wdamt-max type-text-sm"
                  onClick={() => {
                    setAmount(String(availableBalance));
                    setTouched(true);
                  }}
                >
                  Max
                </button>
              }
            />
            <p className="scr-wdamt-balance type-text-xs">Available balance: {money(availableBalance)}</p>
          </div>

          <Input
            label="Wallet address"
            value={wallet}
            onChange={setWallet}
            placeholder="Enter wallet address"
            rightSlot={<Icon name="scan" size={20} strokeWidth={1.6} className="scr-wdamt-scan" />}
          />
        </section>
      </main>

      <footer className="scr-wdamt-footer">
        <Button
          variant="primary"
          size="medium"
          fullWidth
          disabled={!ready}
          iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
          onClick={() => onContinue?.(numeric, wallet)}
        >
          Continue
        </Button>
      </footer>
    </div>
  );
}

export default WithdrawAmount;
