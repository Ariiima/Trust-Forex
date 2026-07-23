import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon, ProgressBar } from '../../design-system/components';
import { PlansHeader } from './PlansHeader';
import { PlanCard } from './PlanCard';
import { Toggle } from './Toggle';
import { Glyph } from './icons';
import { PLANS, DISCOUNT_CODE, DISCOUNT_AMOUNT, EARNING_BALANCE_AVAILABLE, type PlanId } from './plans-data';
import './Checkout.css';

/**
 * Checkout — route `/checkout`, stepper step 1/3. Figma 552:3115 (base) /
 * 552:3116 (balance toggle on, no JSON — colours sampled from the PNG) /
 * 748:3643 (discount applied, no JSON) / 748:3736 (change-plan BottomSheet,
 * no JSON). One component; toggle / discount / modal are local useState —
 * see PlanCard's compact variant for the modal row geometry note.
 */
export interface CheckoutProps {
  initialPlan?: PlanId;
  onBack?: () => void;
  onReviewOrder?: (summary: { planId: PlanId; total: number }) => void;
}

export default function Checkout({ initialPlan = 'silver', onBack, onReviewOrder }: CheckoutProps): ReactNode {
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [useBalance, setUseBalance] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [modalPlanId, setModalPlanId] = useState<PlanId>(initialPlan);

  const plan = useMemo(() => PLANS.find((p) => p.id === planId)!, [planId]);

  const total = useMemo(() => {
    let t = plan.checkoutPrice;
    if (useBalance) t -= EARNING_BALANCE_AVAILABLE;
    if (discountApplied) t -= DISCOUNT_AMOUNT;
    return Math.max(t, 0);
  }, [plan, useBalance, discountApplied]);

  const applyDiscount = (): void => {
    if (discountInput.trim().toUpperCase() === DISCOUNT_CODE) {
      setDiscountApplied(true);
    }
  };

  const openChangePlan = (): void => {
    setModalPlanId(planId);
    setChangePlanOpen(true);
  };

  const confirmChangePlan = (): void => {
    setPlanId(modalPlanId);
    setChangePlanOpen(false);
  };

  return (
    <div className="scr-checkout">
      <PlansHeader title="Checkout" onBack={onBack} />

      <main className="scr-checkout-body">
        <ProgressBar current="order-created" />

        <section className="scr-checkout-card">
          <div className="scr-checkout-row">
            <div className="scr-checkout-planinfo">
              <span className="scr-checkout-label">Selected plan</span>
              <span className="scr-checkout-planname">
                {plan.name} <span className="scr-checkout-duration">/ {plan.duration}</span>
              </span>
            </div>
            <button type="button" className="scr-checkout-changebtn" onClick={openChangePlan}>
              Change plan
            </button>
          </div>

          <div className="scr-checkout-divider" aria-hidden="true" />

          <div className="scr-checkout-balance">
            <div className="scr-checkout-balance-row">
              <span className="scr-checkout-title14">Use earning balance</span>
              <Toggle checked={useBalance} onChange={setUseBalance} label="Use earning balance" />
            </div>
            <span className="scr-checkout-available">
              <span className="scr-checkout-label">Available :</span>
              <span className="scr-checkout-availvalue">$ {EARNING_BALANCE_AVAILABLE.toFixed(2)}</span>
            </span>
          </div>

          <div className="scr-checkout-divider" aria-hidden="true" />

          <div className="scr-checkout-discount">
            <span className="scr-checkout-title14">Discount code</span>
            {discountApplied ? (
              <div className="scr-checkout-chip">
                <span className="scr-checkout-chip-code">{DISCOUNT_CODE}</span>
                <span className="scr-checkout-chip-amount">-${DISCOUNT_AMOUNT.toFixed(2)}</span>
                <button
                  type="button"
                  className="scr-checkout-chip-clear"
                  aria-label="Remove discount code"
                  onClick={() => {
                    setDiscountApplied(false);
                    setDiscountInput('');
                  }}
                >
                  <Glyph name="close" size={16} strokeWidth={1.5} />
                </button>
              </div>
            ) : (
              <input
                className="scr-checkout-discountinput"
                value={discountInput}
                onChange={(e) => setDiscountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyDiscount();
                }}
                onBlur={applyDiscount}
                placeholder="Enter code ( optional )"
              />
            )}
          </div>

          <div className="scr-checkout-total">
            <span className="scr-checkout-totallabel">Total payable</span>
            <span className="scr-checkout-totalvalue">$ {total.toFixed(2)}</span>
          </div>
        </section>
      </main>

      <footer className="scr-checkout-footer">
        <Button
          variant="primary"
          size="medium"
          fullWidth
          iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
          onClick={() => onReviewOrder?.({ planId, total })}
        >
          Review order
        </Button>
      </footer>

      <BottomSheet open={changePlanOpen} onClose={() => setChangePlanOpen(false)} className="scr-checkout-sheet">
        <div className="scr-checkout-sheet-inner">
          <div className="scr-checkout-sheet-titlerow">
            <h2 className="scr-checkout-sheet-title">Change plan</h2>
            <button
              type="button"
              className="scr-checkout-sheet-close"
              aria-label="Close"
              onClick={() => setChangePlanOpen(false)}
            >
              <Glyph name="close" size={24} strokeWidth={1.5} />
            </button>
          </div>
          <div className="scr-checkout-sheet-divider" aria-hidden="true" />

          <div className="scr-checkout-sheet-list">
            {PLANS.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                variant="compact"
                selected={modalPlanId === p.id}
                onSelect={() => setModalPlanId(p.id)}
              />
            ))}
          </div>

          <Button
            variant="primary"
            size="medium"
            fullWidth
            iconRight={<Icon name="chevron-right" size={20} strokeWidth={1.6} />}
            onClick={confirmChangePlan}
          >
            Confirm plan
          </Button>
        </div>
      </BottomSheet>
    </div>
  );
}
