import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, Input } from '../../design-system/components';
import { useBackButton } from '../../telegram';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import { WithdrawSummarySheet } from './WithdrawSummarySheet';
import { ChangeCurrencySheet } from './ChangeCurrencySheet';
import './WithdrawAmount.css';

/* ---------------------------------------------------------------------------
 * Withdraw earnings — step 2, amount + wallet — route /earning/withdraw/amount
 * Frame 1402:7310 (360x852). The top 76px is chrome the app does not draw: the
 * 32px iOS status bar plus a 44px bar whose frame layer is an instance named
 * "Telegram header". Back therefore comes from Telegram's native BackButton
 * (see src/telegram), not an in-app header. One card (16,92 -> 328x366): the
 * chosen currency with a "Change currency" button, the amount field with a Max
 * chip, the available-balance line, the below-minimum notice, then the wallet
 * field.
 *
 * Frame offsets, all sampled off the 1:1 render (frame coords):
 *   card            16,92   328 wide, radius 16
 *   title           32,108  12/24 sub-text
 *   currency row    32,144  296x56, radius 12, pad 8/16/8/12
 *   amount label    32,216  14/28 main-text        (Input label)
 *   amount field    32,248  296x44, radius 8, #F1F1F1 fill, pad 0 16
 *   balance line    32,299  12/24, +7 under the field
 *   error line      32,330  12/24 #FF334C, +7 under the balance
 *   wallet Input    32,366  +12 under the error
 *   CTA             16,792  328x44
 *
 * 2-1..2-5 are the same screen in different action states (tweaks.md #1). 2-1
 * shows the below-minimum notice with the field still empty, and the notice
 * sits *below* the balance line, so it is a sibling of the DS Input rather than
 * the Input's own error slot (which renders directly under the field).
 * ------------------------------------------------------------------------- */

const money = (n: number) => `$${n.toFixed(2)}`;

export interface WithdrawAmountProps {
  optionId?: string;
  availableBalance?: number;
  /** Review deep-links: prefill the form / open a sheet (see design/review). */
  initialAmount?: string;
  initialWallet?: string;
  initialSheet?: 'change' | 'summary' | 'submitted';
  onBack?: () => void;
  onChangeCurrency?: () => void;
  onContinue?: (amount: number, wallet: string) => void;
}

export function WithdrawAmount({
  optionId = 'usdt-bep20',
  availableBalance = 245,
  initialAmount = '',
  initialWallet = '',
  initialSheet,
  onBack,
  onChangeCurrency,
  onContinue,
}: WithdrawAmountProps): ReactNode {
  useBackButton(onBack);
  const [currencyId, setCurrencyId] = useState(optionId);
  const [changeOpen, setChangeOpen] = useState(initialSheet === 'change');
  const option = WITHDRAW_OPTIONS.find((o) => o.id === currencyId) ?? WITHDRAW_OPTIONS[0];
  const [amount, setAmount] = useState(initialAmount);
  const [wallet, setWallet] = useState(initialWallet);
  const [summary, setSummary] = useState<'closed' | 'confirm' | 'submitted'>(
    initialSheet === 'summary' ? 'confirm' : initialSheet === 'submitted' ? 'submitted' : 'closed',
  );

  const numeric = Number(amount);
  /* 2-1 shows the notice with the field still empty, so it is not gated on a
     touched flag — anything under the minimum (including nothing) shows it. */
  const belowMinimum = !Number.isFinite(numeric) || numeric < option.minimum;
  const overBalance = Number.isFinite(numeric) && numeric > availableBalance;
  const amountError = belowMinimum
    ? 'Amount is below the minimum.'
    : overBalance
      ? 'Amount exceeds your available balance.'
      : undefined;

  const ready = !amountError && Number.isFinite(numeric) && numeric >= option.minimum && wallet.trim() !== '';

  return (
    <div className="scr-wdamt">

      <main className="scr-wdamt-main">
        <section className="scr-wdamt-card">
          <h2 className="scr-wdamt-title type-text-xs">Withdrawal details</h2>

          <div className="scr-wdamt-currency">
            <span className="scr-wdamt-coin">
              <img src={option.icon} alt="" width={32} height={32} />
            </span>
            <span className="scr-wdamt-currency-name">
              <span className="scr-wdamt-currency-symbol type-text-xs-semibold">{option.symbol}</span>
              <span className="scr-wdamt-currency-network type-text-xs-10">({option.network})</span>
            </span>
            <Button variant="outline" size="xsmall" className="scr-wdamt-change" onClick={onChangeCurrency ?? (() => setChangeOpen(true))}>
              Change currency
            </Button>
          </div>

          <div className="scr-wdamt-amount">
            <Input
              label="Amount to withdraw"
              value={amount}
              onChange={setAmount}
              placeholder="Enter amount"
              rightSlot={
                <button
                  type="button"
                  className="scr-wdamt-max"
                  onClick={() => setAmount(String(availableBalance))}
                >
                  Max
                </button>
              }
            />
            <p className="scr-wdamt-balance">
              Available balance: <span className="scr-wdamt-balance-value">{money(availableBalance)}</span>
            </p>
            {amountError ? (
              <p className="scr-wdamt-error" role="alert">
                {/* the frame leads with the info glyph (dot over stem), tinted red */}
                <Icon name="info" size={16} strokeWidth={1.6} />
                {amountError}
              </p>
            ) : null}
          </div>

          <Input
            label="Wallet address"
            value={wallet}
            onChange={setWallet}
            placeholder="Enter wallet address"
            rightSlot={<Icon name="scan" size={16} strokeWidth={1.75} className="scr-wdamt-scan" />}
          />
        </section>
      </main>

      <footer className="scr-wdamt-footer">
        <Button
          variant="primary"
          size="medium"
          fullWidth
          disabled={!ready}
          iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.75} />}
          onClick={() => {
            setSummary('confirm');
            onContinue?.(numeric, wallet);
          }}
        >
          Continue
        </Button>
      </footer>

      <ChangeCurrencySheet
        open={changeOpen}
        selectedId={currencyId}
        onClose={() => setChangeOpen(false)}
        onChoose={(id) => {
          setCurrencyId(id);
          setChangeOpen(false);
        }}
      />

      <WithdrawSummarySheet
        open={summary !== 'closed'}
        state={summary === 'submitted' ? 'submitted' : 'confirm'}
        currency={option.symbol}
        network={option.network}
        wallet={wallet}
        amount={numeric || 0}
        networkFee={option.networkFee}
        onClose={() => setSummary('closed')}
        onConfirm={() => setSummary('submitted')}
      />
    </div>
  );
}

export default WithdrawAmount;
