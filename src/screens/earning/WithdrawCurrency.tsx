import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon } from '../../design-system/components';
import { useBackButton } from '../../telegram';
import { WITHDRAW_OPTIONS } from './withdraw-data';
import { WithdrawOptionCard } from './WithdrawOptionCard';
import './WithdrawCurrency.css';

/* ---------------------------------------------------------------------------
 * Withdraw earnings — step 1, pick currency+network — route /earning/withdraw
 * Frame 1379:6901 (360x1000). The top 76px of the frame is Telegram chrome
 * (32 status bar + 44 native header) which the app never draws, so the screen
 * starts at the 328x816 card (16,92 in frame space -> 16,16 on screen). It
 * holds six 296-wide options on a 12 gap: a 32px coin with a 16px network
 * badge, the symbol and network, a 20px radio, then the network-fee /
 * minimum-withdraw row.
 * The CTA stays disabled until something is picked (1482:5747 shows it live).
 * ------------------------------------------------------------------------- */

export interface WithdrawCurrencyProps {
  /** Review deep-link: preselect an option. */
  initialSelected?: string;
  /** Telegram draws the header + back button; kept so the router can pass it. */
  onBack?: () => void;
  onContinue?: (optionId: string) => void;
}

export function WithdrawCurrency({ initialSelected, onBack, onContinue }: WithdrawCurrencyProps): ReactNode {
  // No in-app header: Telegram draws the bar, so back lives on its BackButton.
  useBackButton(onBack);
  const [selected, setSelected] = useState<string | null>(initialSelected ?? null);

  return (
    <div className="scr-wdcur">
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
