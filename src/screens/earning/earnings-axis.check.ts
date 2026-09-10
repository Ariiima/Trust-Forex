/* node --experimental-strip-types src/screens/earning/earnings-axis.check.ts */
import { axisFor, axisLabel, GRID_LINES } from './earnings-axis.ts';

const eq = (a: unknown, b: unknown, m: string) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`);
};

// No data keeps the frame's resting axis.
eq(axisFor([]), { bottom: 0, top: 500, step: 100 }, 'empty');
eq(axisFor([0, 0, 0]), { bottom: 0, top: 500, step: 100 }, 'all zero');

// The reported bug: a $26 peak drew against a $0..$50 axis, half the card empty.
eq(axisFor([0, 0, 26]).top, 30, '26 peak');

// Whatever the data, the peak has to reach the top half of the plot and the
// axis must still clear it — that is the whole contract of this module.
for (const max of [0.2, 1, 3, 7, 26, 49, 123, 480, 5000, 12345]) {
  for (const min of [0, max / 2, max * 0.9]) {
    const a = axisFor([min, max]);
    if (a.top < max) throw new Error(`axis clips ${max}: top ${a.top}`);
    const frac = (max - a.bottom) / (a.top - a.bottom);
    // The one-cent grid floor is allowed to leave headroom; nothing else is.
    if (frac < 0.6 && a.step > 0.01) throw new Error(`${min}..${max} peaks at only ${(frac * 100) | 0}% of the plot`);
    eq(a.top, a.bottom + a.step * (GRID_LINES - 1), `grid lines ${min}..${max}`);
  }
}

// Labels: whole dollars stay whole, cents keep two places.
eq(axisLabel(30), '$30', 'whole');
eq(axisLabel(0.25), '$0.25', 'cents');

console.log('earnings-axis ok');
