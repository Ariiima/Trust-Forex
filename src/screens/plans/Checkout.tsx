import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon, Input, ProgressBar, Switch } from '../../design-system/components';
import { PlanCard } from './PlanCard';
import { OrderSummarySheet } from './OrderSummarySheet';
import { Glyph } from './icons';
import { PLANS, DISCOUNT_CODE, DISCOUNT_AMOUNT, EARNING_BALANCE_AVAILABLE, type PlanId } from './plans-data';
import './Checkout.css';

/**
 * Checkout — route `/checkout`, stepper step 1/3. Figma 552:3115 (base) /
 * 552:3116 (balance on) / 748:3643 (discount) / 748:3736 (change-plan
 * BottomSheet) / 1206:4219 (order-summary BottomSheet). One component;
 * toggle / discount / sheets are local useState. "Review order" opens the
 * OrderSummarySheet; its confirm fires `onReviewOrder` (order creation).
 */
export interface CheckoutProps {
  initialPlan?: PlanId;
  onBack?: () => void;
  onReviewOrder?: (summary: { planId: PlanId; total: number }) => void;
}

// `onBack` is accepted for API compatibility (App.tsx wires it up) but
// unused here: this screen renders no in-app header. Figma 552:3115 shows
// only one back/title bar in the top 76px, which is the "Telegram header"
// chrome instance, not app content — pixel-verified against the reference
// (with no header, the progress bar lands at build y=16, matching ref
// y=92 minus the 76px chrome exactly). A PlansHeader call previously
// duplicated that chrome, pushing every element down 44px.
export default function Checkout({ initialPlan = 'silver', onReviewOrder }: CheckoutProps): ReactNode {
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  const [useBalance, setUseBalance] = useState(false);
  const [discountApplied, setDiscountApplied] = useState(false);
  const [discountError, setDiscountError] = useState(false);
  const [discountInput, setDiscountInput] = useState('');
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [modalPlanId, setModalPlanId] = useState<PlanId>(initialPlan);

  const plan = useMemo(() => PLANS.find((p) => p.id === planId)!, [planId]);

  const total = useMemo(() => {
    let t = plan.checkoutPrice;
    if (useBalance) t -= EARNING_BALANCE_AVAILABLE;
    if (discountApplied) t -= DISCOUNT_AMOUNT;
    return Math.max(t, 0);
  }, [plan, useBalance, discountApplied]);

  const applyDiscount = (): void => {
    const code = discountInput.trim();
    if (!code) return;
    if (code.toUpperCase() === DISCOUNT_CODE) {
      setDiscountApplied(true);
      setDiscountError(false);
    } else {
      setDiscountError(true);
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
              <Switch checked={useBalance} onChange={setUseBalance} />
            </div>
            <span className="scr-checkout-available">
              <span className="scr-checkout-label">Available :</span>
              <span className="scr-checkout-availvalue">$ {EARNING_BALANCE_AVAILABLE.toFixed(2)}</span>
            </span>
          </div>

          <div className="scr-checkout-divider" aria-hidden="true" />

          {discountApplied ? (
            <div className="scr-checkout-discount">
              <span className="scr-checkout-discount-label">Discount code</span>
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
                  <Glyph name="close" size={16} />
                </button>
              </div>
            </div>
          ) : (
            // ponytail: DS Input exposes no onBlur/onKeyDown, so the wrapper
            // catches the bubbled events to apply the code on Enter/blur.
            // Ceiling: breaks if Input ever portals its <input>; upgrade path
            // is an "Apply" action in Input's rightSlot.
            <div
              className="scr-checkout-discount"
              onBlur={applyDiscount}
              onKeyDown={(e) => {
                if (e.key === 'Enter') applyDiscount();
              }}
            >
              <span className="scr-checkout-discount-label">Discount code</span>
              {/* Input's own `label` prop is skipped — this screen's field
                  uses the filled 44px variant (see Checkout.css), which
                  doesn't match the DS Input's default 48px outlined field
                  or its 12/24 label; the label above is rendered locally at
                  14/28 to match the chip-applied state instead. */}
              <Input
                className="scr-checkout-discount-field"
                value={discountInput}
                onChange={(v) => {
                  setDiscountInput(v);
                  setDiscountError(false);
                }}
                placeholder="Enter code ( optional )"
                error={discountError ? 'Invalid code' : undefined}
              />
            </div>
          )}
        </section>
      </main>

      <footer className="scr-checkout-footer">
        <div className="scr-checkout-total">
          <span className="scr-checkout-totallabel">Total payable</span>
          <span className="scr-checkout-totalvalue">$ {total.toFixed(2)}</span>
        </div>
        <Button
          variant="primary"
          size="medium"
          fullWidth
          iconRight={<Icon name="chevron-right" size={20} />}
          onClick={() => setOrderSummaryOpen(true)}
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
              <Glyph name="close" size={24} />
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
            className="scr-checkout-sheet-confirm"
            iconRight={<Icon name="chevron-right" size={20} />}
            onClick={confirmChangePlan}
          >
            Confirm plan
          </Button>
        </div>
      </BottomSheet>

      <OrderSummarySheet
        open={orderSummaryOpen}
        onClose={() => setOrderSummaryOpen(false)}
        planName={plan.name}
        planDuration={plan.duration}
        price={plan.checkoutPrice}
        balanceUsed={useBalance ? EARNING_BALANCE_AVAILABLE : undefined}
        discount={discountApplied ? { code: DISCOUNT_CODE, amount: DISCOUNT_AMOUNT } : undefined}
        total={total}
        onConfirm={() => onReviewOrder?.({ planId, total })}
      />
    </div>
  );
}
