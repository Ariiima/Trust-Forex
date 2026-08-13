/**
 * The two things the Results section has to get right, kept away from the JSX
 * so they can be checked without a browser:
 *
 *   1. Which Monday–Sunday week a date belongs to, and what that week is called.
 *   2. What a take-profit level's win rate is, given that the levels are
 *      cumulative — a signal that ran to TP3 touched TP1 and TP2 on the way.
 *
 * The check lives in ./results-math.check.ts, which nothing imports — a guarded
 * self-check in here would ship its dead branch to the browser bundle. Run it:
 *   node --experimental-strip-types src/admin/sections/results-math.check.ts
 */

export const LEVELS = ['tp1', 'tp2', 'tp3', 'tp4'] as const;
export type Level = (typeof LEVELS)[number];

/** What a stored period holds: how many signals *ended* at each level. */
export interface Counts {
  total: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  tp4: number;
}

/* ---------------------------------------------------------------------
 * Win rates
 * ------------------------------------------------------------------- */

/**
 * Signals that touched `level` — its own tally plus every level above it.
 * Stored counts are final outcomes, so this is where "cumulative" happens;
 * storing the cumulative figure instead would lose where each signal stopped.
 */
export function reached(c: Counts, level: Level): number {
  return LEVELS.slice(LEVELS.indexOf(level)).reduce((n, l) => n + c[l], 0);
}

/** reached / total, as a percentage. A period with no signals rates 0. */
export const rateOf = (n: number, total: number): number => (total ? (n / total) * 100 : 0);

/** Sum a run of periods into one, so a rate over 12 weeks is one division. */
export function totals(rows: Counts[]): Counts {
  return rows.reduce<Counts>(
    (a, r) => ({
      total: a.total + r.total,
      sl: a.sl + r.sl,
      tp1: a.tp1 + r.tp1,
      tp2: a.tp2 + r.tp2,
      tp3: a.tp3 + r.tp3,
      tp4: a.tp4 + r.tp4,
    }),
    { total: 0, sl: 0, tp1: 0, tp2: 0, tp3: 0, tp4: 0 },
  );
}

/* ---------------------------------------------------------------------
 * Weeks
 * ------------------------------------------------------------------- */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Week {
  /** Stable across reloads and machines: the Monday's own date. */
  id: string;
  /** "August · Week 5" */
  period: string;
  /** "Aug 31–Sep 6, 2026" */
  range: string;
}

/** UTC throughout: a week must not shift because the operator is in Tehran. */
const utc = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));

/** The Monday on or before `d`. ISO weeks run Monday → Sunday. */
export function mondayOf(d: Date): Date {
  const m = utc(d);
  m.setUTCDate(m.getUTCDate() - ((m.getUTCDay() + 6) % 7));
  return m;
}

/**
 * The week that starts on `monday`.
 *
 * A week is never split. Ownership starts from the same rule ISO week-
 * numbering uses — the week's Thursday (day 4 of 7, so it always falls on
 * the majority side) — but a month never shows a Week 5: since a Thursday
 * only lands on day 29-31 of its month when that week's Sunday has already
 * rolled into the next month, a would-be 5th week is just the next month's
 * Week 1 instead (Jul 27–Aug 2 is "August · Week 1", not "July · Week 5").
 *
 * This can't be made driftless AND collision-free at once — 52 weeks never
 * divides evenly into 12 months — so roughly 4-5 times a year the pushed
 * week and the next month's own first week both read "Week 1"; the date
 * range under each label (Jul 27–Aug 2 vs Aug 3–9) is what tells them apart.
 * The alternative, cascading every later week in the month to make room,
 * drifts the labels away from the real calendar by a full month within a
 * year (see git history) — worse than the rare double "Week 1".
 */
export function weekOf(monday: Date): Week {
  const start = mondayOf(monday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 6);
  const owner = new Date(start);
  owner.setUTCDate(owner.getUTCDate() + 3);

  let n = Math.floor((owner.getUTCDate() - 1) / 7) + 1;
  // `period` never carries a year (see below), so wrapping December -> January
  // here needs no year tracking of its own.
  let ownerMonth = owner.getUTCMonth();
  if (n === 5) {
    n = 1;
    ownerMonth = (ownerMonth + 1) % 12;
  }
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();

  const from = `${SHORT[start.getUTCMonth()]} ${start.getUTCDate()}`;
  const to = sameMonth ? `${end.getUTCDate()}` : `${SHORT[end.getUTCMonth()]} ${end.getUTCDate()}`;

  return {
    id: `w${start.toISOString().slice(0, 10)}`,
    period: `${MONTHS[ownerMonth]} · Week ${n}`,
    range: sameYear
      ? `${from}–${to}, ${end.getUTCFullYear()}`
      : `${from}, ${start.getUTCFullYear()}–${to}, ${end.getUTCFullYear()}`,
  };
}

/** The last `count` weeks, newest first, ending with the one containing `from`. */
export function recentWeeks(count: number, from: Date): Week[] {
  const latest = mondayOf(from);
  return Array.from({ length: count }, (_, i) => {
    const m = new Date(latest);
    m.setUTCDate(m.getUTCDate() - i * 7);
    return weekOf(m);
  });
}
