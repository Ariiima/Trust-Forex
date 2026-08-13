import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, BottomSheet, Icon, Input, ProgressBar, Switch } from '../../design-system/components';
import { PlanCard } from './PlanCard';
import { OrderSummarySheet } from './OrderSummarySheet';
import { Glyph } from './icons';
import { PLANS, type PlanId } from './plans-data';
import { cachedMe, checkDiscount, getMe } from '../../api/client';
import { useBackButton } from '../../telegram';
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
  onReviewOrder?: (summary: { planId: PlanId; total: number; code?: string; useBalance?: boolean }) => void;
}

// No in-app header: this screen renders none. Figma 552:3115 shows only one
// back/title bar in the top 76px, which is the "Telegram header" chrome
// instance, not app content — pixel-verified against the reference (with no
// header, the progress bar lands at build y=16, matching ref y=92 minus the
// 76px chrome exactly). A PlansHeader call previously duplicated that
// chrome, pushing every element down 44px. Back instead comes from
// Telegram's native BackButton.
export default function Checkout({ initialPlan = 'silver', onBack, onReviewOrder }: CheckoutProps): ReactNode {
  useBackButton(onBack);
  const [planId, setPlanId] = useState<PlanId>(initialPlan);
  /* The applied code, as the server validated it — a percentage off this plan,
     bound to this account. `null` means nothing is applied. */
  const [discount, setDiscount] = useState<{ code: string; percent: number } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [discountInput, setDiscountInput] = useState('');
  const [checking, setChecking] = useState(false);
  const [changePlanOpen, setChangePlanOpen] = useState(false);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [modalPlanId, setModalPlanId] = useState<PlanId>(initialPlan);

  const plan = useMemo(() => PLANS.find((p) => p.id === planId)!, [planId]);

  /* Earning balance, straight off /api/me — the same figure the Earning tab
     shows. Starts at 0 so the row renders with the screen rather than popping
     in, and the toggle is simply not operable until there is something to
     spend. */
  const [balance, setBalance] = useState(() => cachedMe()?.wallet.balance ?? 0);
  const [useBalance, setUseBalance] = useState(false);
  useEffect(() => {
    let live = true;
    void getMe().then((me) => live && me && setBalance(me.wallet.balance));
    return () => {
      live = false;
    };
  }, []);

  /** What the code takes off, in dollars — campaign discounts are percentages. */
  const discountAmount = useMemo(
    () => (discount ? Math.round(plan.checkoutPrice * (discount.percent / 100) * 100) / 100 : 0),
    [discount, plan],
  );

  /* The discount comes off first, then the wallet covers what is left of it —
     the same order the server applies them in, so the "Total payable" here is
     the amount the order is actually created for. */
  const afterDiscount = Math.max(plan.checkoutPrice - discountAmount, 0);
  const balanceApplied = useBalance ? Math.min(balance, afterDiscount) : 0;
  const total = useMemo(
    () => Math.round((afterDiscount - balanceApplied) * 100) / 100,
    [afterDiscount, balanceApplied],
  );

  /* Validated server-side against the campaign that minted it: unique codes are
     bound to one account and one use, so a forwarded code has to fail here
     rather than at payment. */
  const applyDiscount = (): void => {
    const code = discountInput.trim();
    if (!code || checking) return;
    setChecking(true);
    checkDiscount(code, planId)
      .then((r) => {
        if (r.error || r.percent === undefined) {
          setDiscount(null);
          setDiscountError(
            r.error === 'code_used' ? 'That code has already been used.'
              : r.error === 'code_expired' ? 'That code has expired.'
                : r.error === 'wrong_plan' ? 'That code does not apply to this plan.'
                  : r.error === 'limit_reached' ? 'This offer has reached its redemption limit.'
                    : 'That code is not valid.',
          );
          return;
        }
        setDiscount({ code: r.code ?? code.toUpperCase(), percent: r.percent });
        setDiscountError('');
      })
      .catch(() => setDiscountError('Could not check that code.'))
      .finally(() => setChecking(false));
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

          {/* The server does the same sum again from its own books — this is
              the display of it, not the authority on it (POST /api/orders,
              `useBalance`). Always rendered, even at $0.00: a control that
              vanishes when the wallet is empty reads as a missing feature, and
              "Available: $0.00" is the answer to the question it raises. */}
          <div className="scr-checkout-balance">
            <div className="scr-checkout-balance-row">
              <span className="scr-checkout-title14">Use earning balance</span>
              <Switch
                checked={useBalance}
                onChange={setUseBalance}
                disabled={balance <= 0}
              />
            </div>
            <span className="scr-checkout-available">
              <span className="scr-checkout-label">Available :</span>
              {/* No space after the $ — same money format as the summary sheet
                  and the total below it. */}
              <span className="scr-checkout-availvalue">${balance.toFixed(2)}</span>
            </span>
          </div>

          <div className="scr-checkout-divider" aria-hidden="true" />

          {discount ? (
            <div className="scr-checkout-discount">
              <span className="scr-checkout-discount-label">Discount code</span>
              <div className="scr-checkout-chip">
                <span className="scr-checkout-chip-code">{discount.code}</span>
                <span className="scr-checkout-chip-amount">-${discountAmount.toFixed(2)}</span>
                <button
                  type="button"
                  className="scr-checkout-chip-clear"
                  aria-label="Remove discount code"
                  onClick={() => {
                    setDiscount(null);
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
                  setDiscountError('');
                }}
                placeholder="Enter code ( optional )"
                error={discountError || undefined}
              />
            </div>
          )}
        </section>
      </main>

      <footer className="scr-checkout-footer">
        <div className="scr-checkout-total">
          <span className="scr-checkout-totallabel">Total payable</span>
          <span className="scr-checkout-totalvalue">${total.toFixed(2)}</span>
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
        balanceUsed={balanceApplied > 0 ? balanceApplied : undefined}
        discount={discount ? { code: discount.code, amount: discountAmount } : undefined}
        total={total}
        onConfirm={() =>
          onReviewOrder?.({ planId, total, code: discount?.code, useBalance: balanceApplied > 0 })
        }
      />
    </div>
  );
}
