/**
 * Self-check for ./results-math.ts. Nothing imports this file; run it directly:
 *
 *   node --experimental-strip-types src/admin/sections/results-math.check.ts
 *
 * Plain throws rather than node:assert — its assertion signatures demand an
 * explicit annotation at every call site under `tsc`, and a thrown Error is
 * the whole mechanism anyway.
 */
import {
  LEVELS, mondayOf, rateOf, reached, recentWeeks, totals, weekOf, type Counts,
} from './results-math.ts';

const eq = (got: unknown, want: unknown, why = 'check failed') => {
  if (!Object.is(got, want)) throw new Error(`${why}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const deq = (got: unknown, want: unknown, why = 'check failed') =>
  eq(JSON.stringify(got), JSON.stringify(want), why);
const day = (s: string) => new Date(`${s}T00:00:00Z`);

/* ---- the spec's worked example --------------------------------------
   Ten signals: five ended at TP2, three at TP3, two stopped out. */
const c: Counts = { total: 10, sl: 2, tp1: 0, tp2: 5, tp3: 3, tp4: 0 };

eq(reached(c, 'tp1'), 8, 'the TP2 and TP3 finishers all touched TP1');
eq(reached(c, 'tp2'), 8, 'the TP3 finishers touched TP2 on the way');
eq(reached(c, 'tp3'), 3);
eq(reached(c, 'tp4'), 0);

eq(rateOf(reached(c, 'tp1'), c.total), 80);
eq(rateOf(reached(c, 'tp2'), c.total), 80);
eq(rateOf(reached(c, 'tp3'), c.total), 30);
eq(rateOf(reached(c, 'tp4'), c.total), 0);
eq(rateOf(c.sl, c.total), 20, 'SL rate');
eq(rateOf(0, 0), 0, 'an empty period must not divide by zero');

// The property the cumulative rule guarantees: a rate never rises with the level.
const rates = LEVELS.map((l) => rateOf(reached(c, l), c.total));
deq(rates, [...rates].sort((a, b) => b - a), 'rates must fall as the level rises');

eq(totals([c, c]).total, 20, 'periods sum');
eq(totals([c, c]).tp3, 6);
eq(totals([]).total, 0, 'no periods sums to zero, not NaN');

/* ---- weeks ----------------------------------------------------------
   Monday to Sunday, never split, named for whichever month holds most
   of its days. */
const straddle = weekOf(day('2026-08-31'));
eq(straddle.period, 'September · Week 1', 'six of its seven days are in September');
eq(straddle.range, 'Aug 31–Sep 6, 2026', 'the week is one span, not two');

for (const d of ['2026-08-31', '2026-09-02', '2026-09-06']) {
  eq(weekOf(mondayOf(day(d))).id, straddle.id, `${d} resolves to the Aug 31 week`);
}
eq(weekOf(mondayOf(day('2026-09-07'))).period, 'September · Week 2', 'the following week is also September, next in line');

// Year boundary: Mon 29 Dec 2025 runs into Sun 4 Jan 2026 — 3 days in
// December, 4 in January, so January owns it.
eq(weekOf(day('2025-12-29')).period, 'January · Week 1');
eq(weekOf(day('2025-12-29')).range, 'Dec 29, 2025–Jan 4, 2026', 'both years are named');

// Sunday belongs to the week that started six days earlier, not the next one.
eq(weekOf(mondayOf(day('2026-08-02'))).range, 'Jul 27–Aug 2, 2026', 'Sunday closes its own week');

/* No month ever shows a Week 5: July has five Thursdays in 2026 (2, 9, 16,
   23, 30), so its would-be fifth week — majority-July by day count — is
   pushed to be August's first week instead. */
eq(weekOf(day('2026-07-27')).period, 'August · Week 1', 'no July · Week 5');
eq(weekOf(day('2026-07-20')).period, 'July · Week 4', 'July still keeps its real first four');
// The trade-off: August's own first week reads the same label, told apart
// only by the range underneath — see the comment on weekOf for why.
eq(weekOf(day('2026-08-03')).period, 'August · Week 1', 'August’s own week 1 collides on label, not on range');
eq(weekOf(day('2026-08-03')).range, 'Aug 3–9, 2026');

deq(
  recentWeeks(4, day('2026-08-05')).map((w) => w.id),
  ['w2026-08-03', 'w2026-07-27', 'w2026-07-20', 'w2026-07-13'],
  'recent weeks run backwards from the current Monday',
);

console.log('results-math: ok');
