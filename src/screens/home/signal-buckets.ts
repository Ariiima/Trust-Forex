/**
 * Signal-performance chart data: published weekly results folded into the
 * points one tab of the chart draws.
 *
 * The API's rows are always weekly — `period: "August · Week 3"`,
 * `range: "Aug 18–24, 2026"` (see admin/sections/results-math.ts, weekOf).
 * Weekly plots one row per point; Monthly folds them into months, Yearly into
 * quarters — so each tab shows distinct buckets instead of the same weeks under
 * three different names.
 *
 * Self-check: node --experimental-strip-types src/screens/home/signal-buckets.check.ts
 */
import type { SignalResult } from '../../api/client';

export type Period = 'Weekly' | 'Monthly' | 'Yearly';

export const PERIODS: Period[] = ['Weekly', 'Monthly', 'Yearly'];

/** The tiles above the chart summarise a fixed recent window, independent of
    the (up to 30) points the chart draws: fold the rows at `fold` granularity
    and keep the newest `n` buckets. */
export const OVERVIEW: Record<Period, { fold: Period; n: number; label: string }> = {
  Weekly: { fold: 'Weekly', n: 4, label: 'Last 4 weeks overview' },
  Monthly: { fold: 'Monthly', n: 3, label: 'Last 3 months overview' },
  Yearly: { fold: 'Monthly', n: 12, label: 'Last 12 months overview' },
};

/* A phone plot is 296px wide: past ~30 points the gaps fall under 10px and the
   crosshair can no longer be aimed at any one of them. Older buckets drop off
   the left, which is also the direction a chart ages in. */
export const MAX_POINTS = 30;

export const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface Bucket {
  key: string;
  /** Earnings-page format: "Aug 2026 · W3" / "Aug 2026" / "Q3 2026". */
  label: string;
  total: number;
  reached: number;
  /** Percent, 0..100. */
  rate: number;
  /** Demo rows only — the traced silhouette's own height (Home.demoBuckets). */
  y?: number;
}

const LEVELS = ['tp1', 'tp2', 'tp3', 'tp4'] as const;

/** "August · Week 3" + "Aug 18–24, 2026" -> the pieces the labels are built of.
    `period`'s month is whichever side of the dash holds most of the week's
    days (weekOf's rule), so a row straddling New Year — "Dec 29, 2025–Jan 4,
    2026" owned by January — must take its year from the January side, not
    just the first one written. */
function partsOf(r: SignalResult): { month: number; year: number; week: number } | null {
  const month = SHORT_MONTHS.findIndex((m) => r.period.startsWith(m));
  const week = Number(r.period.match(/Week (\d+)/)?.[1]);
  if (month < 0 || !week) return null;
  const [from, to = ''] = r.range.split('–');
  const side = to.startsWith(SHORT_MONTHS[month]) ? to : from;
  const year = Number((side.match(/\d{4}/) ?? to.match(/\d{4}/))?.[0]);
  return year ? { month, year, week } : null;
}

/**
 * The rows folded into one point per week / month / year, oldest first, capped
 * at MAX_POINTS. `tp` picks which take-profit level counts as reached: the
 * levels are cumulative, so TP2 counts everything that ran past TP2 as well.
 */
export function bucketsFor(results: readonly SignalResult[], period: Period, tp: string): Bucket[] {
  const from = Math.max(0, LEVELS.indexOf(tp.toLowerCase() as (typeof LEVELS)[number]));
  const by = new Map<string, Bucket>();

  for (const r of results) {
    const p = partsOf(r);
    /* An unparseable row still plots, as its own point under its own label:
       dropping a week of published results because someone reworded the period
       string would quietly understate the totals. */
    // Weekly keys on the row's own date range, not the parsed week number: a
    // handful of times a year two distinct weeks share one "Month · Week 1"
    // label (results-math.ts's weekOf, admin side), and keying on the number
    // would fold two different weeks' counts into a single chart point.
    const key = !p
      ? r.period
      : period === 'Yearly'
        ? `${p.year}-Q${Math.floor(p.month / 3) + 1}`
        : period === 'Monthly'
          ? `${p.year}-${p.month}`
          : `${p.year}-${p.month}-${r.range}`;
    const label = !p
      ? r.period
      : period === 'Yearly'
        ? `Q${Math.floor(p.month / 3) + 1} ${p.year}`
        : period === 'Monthly'
          ? `${SHORT_MONTHS[p.month]} ${p.year}`
          : `${SHORT_MONTHS[p.month]} ${p.year} · W${p.week}`;

    const b = by.get(key) ?? { key, label, total: 0, reached: 0, rate: 0 };
    b.total += r.total;
    b.reached += LEVELS.slice(from).reduce((n, l) => n + r[l], 0);
    by.set(key, b);
  }

  // The API hands them over newest first; a chart reads left to right, oldest
  // to newest. Insertion order is that order reversed.
  const all = [...by.values()].reverse();
  for (const b of all) b.rate = b.total ? (b.reached / b.total) * 100 : 0;
  return all.slice(-MAX_POINTS);
}
