/**
 * Self-check for ./signal-buckets.ts. Nothing imports this file; run it:
 *
 *   node --experimental-strip-types src/screens/home/signal-buckets.check.ts
 *
 * Plain throws rather than node:assert, matching admin/sections/results-math.check.ts.
 */
import { bucketsFor, MAX_POINTS } from './signal-buckets.ts';
import type { SignalResult } from '../../api/client.ts';

const eq = (got: unknown, want: unknown, why = 'check failed') => {
  if (!Object.is(got, want)) throw new Error(`${why}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
};
const deq = (got: unknown, want: unknown, why = 'check failed') =>
  eq(JSON.stringify(got), JSON.stringify(want), why);

/** A published week, in the shape results-math.ts writes them. */
const week = (
  month: string,
  n: number,
  year: number,
  counts: Partial<Pick<SignalResult, 'total' | 'sl' | 'tp1' | 'tp2' | 'tp3' | 'tp4'>>,
): SignalResult => ({
  id: `${month}${n}${year}`,
  period: `${month} · Week ${n}`,
  // Real weeks never share a range even when two share a label (weekOf's
  // rare "Month · Week 1" collision, results-math.ts) — vary it by `n` here
  // too, so this fixture doesn't accidentally test something no real payload
  // can produce.
  range: `${month.slice(0, 3)} ${(n - 1) * 7 + 1}–${n * 7}, ${year}`,
  total: 0,
  sl: 0,
  tp1: 0,
  tp2: 0,
  tp3: 0,
  tp4: 0,
  ...counts,
});

/* Newest first, the order /signals returns. Two weeks of August 2026, one of
   July 2026, one of December 2025. */
const rows: SignalResult[] = [
  week('August', 2, 2026, { total: 10, tp1: 4, tp2: 2 }),
  week('August', 1, 2026, { total: 10, tp1: 2, tp3: 1 }),
  week('July', 4, 2026, { total: 20, tp1: 5 }),
  week('December', 1, 2025, { total: 4, tp2: 1 }),
];

/* ---- weekly: one point per row, oldest first ------------------------- */
const w = bucketsFor(rows, 'Weekly', 'TP1');
eq(w.length, 4, 'four published weeks, four points');
deq(w.map((b) => b.label), ['Dec 2025 · W1', 'Jul 2026 · W4', 'Aug 2026 · W1', 'Aug 2026 · W2'], 'oldest first');

/* ---- monthly: the two August weeks fold into one point --------------- */
const m = bucketsFor(rows, 'Monthly', 'TP1');
deq(m.map((b) => b.label), ['Dec 2025', 'Jul 2026', 'Aug 2026'], 'one point per month');
eq(m[2].total, 20, 'August is both its weeks');
eq(m[2].reached, 9, 'TP1 counts everything that ran past it: 4+2 then 2+1');
eq(m[2].rate, 45);

/* ---- yearly: one point per quarter ------------------------------------ */
const y = bucketsFor(rows, 'Yearly', 'TP1');
deq(y.map((b) => b.label), ['Q4 2025', 'Q3 2026'], 'one point per quarter');
eq(y[1].total, 40, 'Q3 2026 is the July week plus both August weeks');

/* ---- cumulative levels ------------------------------------------------ */
const tp2 = bucketsFor(rows, 'Monthly', 'TP2');
eq(tp2[2].reached, 3, 'TP2 drops the four that stopped at TP1, keeps the TP3 runner');
eq(bucketsFor(rows, 'Monthly', 'TP4')[2].reached, 0, 'nothing reached TP4');

/* ---- a week that straddles New Year belongs to whichever year has most
   of its days: 3 in Dec 2025, 4 in Jan 2026, so it's January's ----------- */
const straddle: SignalResult[] = [
  { ...week('January', 1, 2026, { total: 1 }), range: 'Dec 29, 2025–Jan 4, 2026' },
];
eq(bucketsFor(straddle, 'Yearly', 'TP1')[0].label, 'Q1 2026', 'the majority of days are in 2026');

/* ---- an unparseable row still plots ----------------------------------- */
const odd: SignalResult[] = [{ ...week('August', 1, 2026, { total: 3 }), period: 'Q3 rollup', range: 'whenever' }];
const o = bucketsFor(odd, 'Monthly', 'TP1');
eq(o.length, 1, 'kept, not dropped');
eq(o[0].label, 'Q3 rollup', 'labelled with whatever it called itself');

/* ---- the cap keeps the newest ----------------------------------------- */
const many: SignalResult[] = Array.from({ length: 40 }, (_, i) =>
  week('January', 1, 2026 - i, { total: 1 }),
);
const capped = bucketsFor(many, 'Yearly', 'TP1');
eq(capped.length, MAX_POINTS, 'capped');
eq(capped[capped.length - 1].label, 'Q1 2026', 'the newest bucket survives');

/* ---- zero signals is 0%, not NaN --------------------------------------- */
eq(bucketsFor([week('March', 1, 2026, {})], 'Weekly', 'TP1')[0].rate, 0);

console.log('signal-buckets: all checks passed');
