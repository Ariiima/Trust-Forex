/* The Earnings-analysis y axis: six grid lines the visible window fills. */
export const GRID_LINES = 6; // the frame draws six, 32px apart

/** Round a raw axis step up to a readable multiple of 10^k. The ladder is
    fine-grained (max 1.5x between rungs) so the peak lands near the top line:
    the coarse 1/2/2.5/5 ladder turned a $26 peak into a $0..$50 axis, which is
    what the plot looked flat against. */
function niceStep(raw: number): number {
  // Floor at one cent so a $0.20 series gets a $0..$0.25 axis, not $0..$5.
  const mag = 10 ** Math.floor(Math.log10(Math.max(raw, 0.01)));
  const steps = mag <= 0.01
    ? [1, 2, 3, 4, 5, 6, 8, 10] // no half-cent lines
    : [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  return (steps.find((m) => m * mag >= raw) ?? 10) * mag;
}

export interface Axis {
  bottom: number;
  top: number;
  step: number;
}

/** Six grid lines the given values fill top to bottom. The axis used to be a
    fixed $0..$500, so squeezing the brush down to a fortnight of $30 swings
    drew both series as flat lines along the bottom of the card. */
export function axisFor(values: readonly number[]): Axis {
  // Empty or all-zero data keeps the frame's resting $0..$500 axis.
  if (!values.length || Math.max(...values) <= 0) return { bottom: 0, top: 500, step: 100 };
  const min = Math.min(...values);
  const max = Math.max(...values);
  // Two passes: the first picks a step to round the floor down to, the second
  // sizes the step to the range that floor actually leaves — which guarantees
  // `top` clears `max` without a third pass.
  const rough = niceStep((max - min) / (GRID_LINES - 1));
  const bottom = Math.max(0, Math.floor(min / rough) * rough);
  const step = niceStep((max - bottom) / (GRID_LINES - 1));
  return { bottom, top: bottom + step * (GRID_LINES - 1), step };
}

export const axisLabel = (n: number) => `$${Math.round(n * 100) / 100 % 1 ? n.toFixed(2) : Math.round(n)}`;
