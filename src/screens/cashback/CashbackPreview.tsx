import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatedEmoji, Button } from '../../design-system/components';
import { CashbackSteps } from './CashbackSteps';
import introArt from '../../assets/emoji/cashback.json?url';
import './AboutCashbackSheet.css';
import './CashbackPreview.css';

/* ---------------------------------------------------------------------------
 * Cashback — preview (intro) state — route /cashback
 * Frame 850:1913. Same anatomy as the referral intro (1333:8306): one white
 * card holding the art, a centred headline and the three step rows, plus a
 * pinned CTA disabled for a 5s countdown that counts down in its own label —
 * the frame captures it at "(3)".
 *
 * Step rows come from CashbackSteps and are styled by AboutCashbackSheet.css,
 * which is why that stylesheet is imported here too.
 * ------------------------------------------------------------------------- */

export interface CashbackPreviewProps {
  /** Seconds the CTA stays disabled. Design shows a 5s countdown. */
  countdownSeconds?: number;
  onStartEarning?: () => void;
}

export function CashbackPreview({ countdownSeconds = 5, onStartEarning }: CashbackPreviewProps): ReactNode {
  const [left, setLeft] = useState(countdownSeconds);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <div className="scr-cashback-preview">
      <main className="scr-cashback-preview-main">
        <section className="scr-cashback-preview-card">
          <AnimatedEmoji className="scr-cashback-preview-art" src={introArt} />

          <h1 className="scr-cashback-preview-title type-text-2xl-bold">
            Make every trade more rewarding with{' '}
            <span className="scr-cashback-preview-accent">cashback</span>
          </h1>

          <CashbackSteps className="scr-cashback-preview-steps" />
        </section>
      </main>

      <footer className="scr-cashback-preview-footer">
        <Button variant="primary" size="medium" fullWidth disabled={left > 0} onClick={onStartEarning}>
          {left > 0 ? `Start earning (${left})` : 'Start earning'}
        </Button>
      </footer>
    </div>
  );
}

export default CashbackPreview;
