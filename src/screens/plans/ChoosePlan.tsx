import type { ReactNode } from 'react';
import { PlansHeader } from './PlansHeader';
import { PlanCard } from './PlanCard';
import { PLANS, type PlanId } from './plans-data';
import './ChoosePlan.css';

/**
 * Choose your plan — route `/plans`. Figma node 552:3126.
 * Standalone full-page plan picker: back-arrow header, subtitle, and three
 * plan cards (Silver/Gold/Diamond), each with its own feature checklist and
 * Continue button. Reached from Home's "View plans" / "Upgrade" / "Join VIP
 * channel" CTAs; each Continue routes to `/checkout` with that plan selected.
 */
export interface ChoosePlanProps {
  onBack?: () => void;
  onContinue?: (planId: PlanId) => void;
}

export default function ChoosePlan({ onBack, onContinue }: ChoosePlanProps): ReactNode {
  return (
    <div className="scr-choose">
      <PlansHeader title="Choose your plan" onBack={onBack} />

      <main className="scr-choose-body">
        <p className="scr-choose-subtitle">
          Get full signal access with every subscription, plus greater savings and higher benefit rates on longer
          terms.
        </p>

        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} variant="full" onContinue={() => onContinue?.(plan.id)} />
        ))}
      </main>
    </div>
  );
}
