/**
 * Results — the weekly record of how the published signals actually closed.
 *
 * Two rules run through the whole section:
 *
 *   Levels are cumulative. A signal that ran to TP3 touched TP1 and TP2 on the
 *   way, so every count and every win rate here includes the levels above it.
 *   What gets *stored* is still where each signal stopped — the cumulative
 *   figure is derived, because the reverse cannot be (see ./results-math.ts).
 *
 *   Weeks are Monday to Sunday and never split. A week belongs to the month its
 *   Monday falls in, so the last week of August can run into September and is
 *   still one August week.
 *
 * The performance card is deliberately the Mini App's Home card rebuilt: same
 * tabs, same three tiles, same tooltip rows. An operator checking what a
 * customer sees should not have to translate.
 */
import { useMemo, useState } from 'react';
import { api, type SignalResult } from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, Button, Card, Cell2, Confirm, EmptyState, Icon, IconButton, Modal, Reading, Readings,
  Skeleton, StatusChip, Tabs, fmtNum, fmtPct, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';
import { Sparkline } from '../ui/Chart';
import {
  LEVELS, rateOf, reached, recentWeeks, totals, type Counts, type Level, type Week,
} from './results-math';

type Outcome = Level | 'sl';

const OUTCOMES: { id: Outcome; label: string; short: string; tone: 'gain' | 'loss' }[] = [
  { id: 'tp1', label: 'Take Profit 1 (TP1)', short: '1', tone: 'gain' },
  { id: 'tp2', label: 'Take Profit 2 (TP2)', short: '2', tone: 'gain' },
  { id: 'tp3', label: 'Take Profit 3 (TP3)', short: '3', tone: 'gain' },
  { id: 'tp4', label: 'Take Profit 4 (TP4)', short: '4', tone: 'gain' },
  { id: 'sl', label: 'Stop Loss (SL)', short: 'SL', tone: 'loss' },
];

/** Risk:reward per take-profit level — fixed by the signal methodology. */
const RR: Record<Level, string> = { tp1: 'RR 1:0.5', tp2: 'RR 1:1', tp3: 'RR 1:2', tp4: 'RR 1:3' };

/** How many weeks each period tab reads back over. Matches the Mini App. */
const PERIOD_WEEKS = { weekly: 4, monthly: 12, yearly: 48 } as const;
const PERIOD_LABEL = {
  weekly: 'Last 4 weeks overview',
  monthly: 'Last 12 weeks overview',
  yearly: 'Last 48 weeks overview',
} as const;
type Period = keyof typeof PERIOD_WEEKS;

function Pip({ outcome, size = 24 }: { outcome: Outcome; size?: number }) {
  const o = OUTCOMES.find((x) => x.id === outcome)!;
  return (
    <span
      className={`a-pip a-pip--${o.tone}`}
      style={{ width: size, height: size, fontSize: size * (o.id === 'sl' ? 0.38 : 0.5) }}
    >
      {o.short}
    </span>
  );
}

/** A level's cumulative count over its win rate — the pair the spec asks for. */
function LevelCell({ row, level }: { row: SignalResult; level: Level }) {
  const n = reached(row, level);
  return (
    <span className="a-levelcell">
      <b>{fmtNum(n)}</b>
      <span>{row.total ? fmtPct(rateOf(n, row.total), 1) : '—'}</span>
    </span>
  );
}

export default function Results() {
  const loaded = useAsync(api.signalResults);
  const [edits, setEdits] = useState<SignalResult[] | null>(null);
  // '' opens an empty batch; an id opens that period's existing counts.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<SignalResult | null>(null);
  const [tp, setTp] = useState<Level>('tp1');
  const [period, setPeriod] = useState<Period>('weekly');

  const rows = edits ?? loaded ?? [];
  const loading = loaded === undefined;

  /* The picker offers every recent week, not only the ones already recorded —
     adding a result for a week nobody has touched yet is the common case. A
     week that already has a row reuses that row's id, so saving edits it
     rather than filing a second result for the same seven days.
     Matched by id first (`w<monday>`, stable and unique regardless of the
     label) — a handful of times a year two different weeks now share the
     same "Month · Week 1" text (see results-math.ts's weekOf), and matching
     by that text alone would have handed one week's saved row to the other. */
  const weeks = useMemo(() => {
    const byId = new Set(rows.map((r) => r.id));
    const byPeriod = new Map(rows.map((r) => [r.period, r.id]));
    return recentWeeks(52, new Date()).map((w) => ({
      ...w,
      id: byId.has(w.id) ? w.id : (byPeriod.get(w.period) ?? w.id),
    }));
  }, [rows]);

  const columns: Column<SignalResult>[] = [
    {
      id: 'period',
      header: 'Period',
      render: (r) => <Cell2 top={<b>{r.period}</b>} bottom={r.range} />,
      sort: (r) => r.period,
    },
    {
      id: 'total',
      header: 'Signals',
      align: 'center',
      width: 84,
      render: (r) => fmtNum(r.total),
      sort: (r) => r.total,
    },
    /* No SL column: every level already carries its own rate, and a signal
       that stopped out is simply one that reached no level. The SL rate for
       the whole period is in the readings strip above. */
    ...LEVELS.map((level): Column<SignalResult> => ({
      id: level,
      /* The pip alone is a green disc with a bare digit in it — it needs the
         level's name beside it or the column means nothing on its own. */
      header: (
        <span className="a-levelhead">
          <Pip outcome={level} size={20} />
          {level.toUpperCase()}
        </span>
      ),
      align: 'center',
      width: 92,
      render: (r) => <LevelCell row={r} level={level} />,
      sort: (r) => rateOf(reached(r, level), r.total),
    })),
    { id: 'status', header: 'Status', align: 'center', width: 104, render: (r) => <StatusChip status={r.status} /> },
    {
      id: 'published',
      header: 'Published',
      align: 'center',
      width: 128,
      render: (r) => (r.publishedAt
        ? <Cell2 top={r.publishedAt} bottom={r.publishedTime ?? undefined} />
        : <span className="at-muted">—</span>),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: 88,
      render: (r) => (
        <span className="a-rowactions">
          <IconButton icon="pencil" label={`Edit ${r.period}`} size={16} onClick={() => setEditingId(r.id)} />
          <IconButton icon="trash" label={`Delete ${r.period}`} size={16} danger onClick={() => setDeleting(r)} />
        </span>
      ),
    },
  ];

  /* Overall figures are published-only: a draft is a working note, and putting
     it in the headline rate would state a number no customer can see. */
  const published = rows.filter((r) => r.status === 'published');
  const overall = totals(published);

  /* The chart plots the selected level's hit rate per week, oldest first, over
     however many weeks the period tab asks for. `rows` arrives newest-first. */
  const plot = useMemo(() => {
    const window = published.slice(0, PERIOD_WEEKS[period]).reverse();
    return window.map((r) => ({
      label: r.period,
      range: r.range,
      total: r.total,
      reached: reached(r, tp),
      rate: Number(rateOf(reached(r, tp), r.total).toFixed(1)),
    }));
  }, [published, period, tp]);

  const span = totals(published.slice(0, PERIOD_WEEKS[period]));
  const spanReached = published
    .slice(0, PERIOD_WEEKS[period])
    .reduce((n, r) => n + reached(r, tp), 0);

  const save = (result: SignalResult, status: 'draft' | 'published') => {
    const saved: SignalResult = {
      ...result,
      status,
      publishedAt: status === 'published' ? (result.publishedAt ?? todayLabel()) : null,
      publishedTime: status === 'published' ? (result.publishedTime ?? timeLabel()) : null,
    };
    const next = [saved, ...rows.filter((r) => r.id !== result.id)];
    setEdits(next);
    setEditingId(null);
    api.saveSignalResult(saved).catch(() => setEdits(rows));
  };

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Results</h1>
          <p className="a-pagehead__sub">
            How each week&rsquo;s signals closed. Levels are cumulative — a TP3 hit counts at TP1 and TP2 too.
          </p>
        </div>
        <Button variant="primary" icon="plus" className="a-spacer" onClick={() => setEditingId('')}>
          Add result
        </Button>
      </header>

      <Readings>
        <Reading
          label="Published signals"
          value={loading ? <Skeleton width={40} height={22} /> : fmtNum(overall.total)}
          hint={loading ? undefined : `${published.length} weeks`}
        />
        {LEVELS.map((level) => (
          <Reading
            key={level}
            label={`${level.toUpperCase()} win rate`}
            tone="gain"
            value={loading ? <Skeleton width={40} height={22} /> : (overall.total ? fmtPct(rateOf(reached(overall, level), overall.total), 1) : '—')}
            hint={loading ? undefined : `${fmtNum(reached(overall, level))} of ${fmtNum(overall.total)}`}
          />
        ))}
        <Reading
          label="SL rate"
          tone="loss"
          value={loading ? <Skeleton width={40} height={22} /> : (overall.total ? fmtPct(rateOf(overall.sl, overall.total), 1) : '—')}
          hint={loading ? undefined : `${fmtNum(overall.sl)} of ${fmtNum(overall.total)}`}
        />
      </Readings>

      <Card title="Signal performance" subtitle="The card customers see on the Mini App home screen.">
        <div className="a-tplevels">
          {LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={tp === level}
              className={`a-tplevel${tp === level ? ' a-tplevel--on' : ''}`}
              onClick={() => setTp(level)}
            >
              <span className="a-tplevel__name">{level.toUpperCase()}</span>
              <span className="a-tplevel__rr">{RR[level]}</span>
            </button>
          ))}
        </div>

        <div className="a-overview">
          <span className="a-overview__title">{PERIOD_LABEL[period]}</span>
          <div className="a-overview__stats">
            <div>
              <span className="a-overview__label">Total signals</span>
              <span className="a-overview__value">{loading ? <Skeleton width={36} height={20} /> : fmtNum(span.total)}</span>
            </div>
            <div>
              <span className="a-overview__label">{tp.toUpperCase()} reached</span>
              <span className="a-overview__value">{loading ? <Skeleton width={36} height={20} /> : fmtNum(spanReached)}</span>
            </div>
            <div>
              <span className="a-overview__label">{tp.toUpperCase()} hit rate</span>
              <span className="a-overview__value at-pos">
                {loading ? <Skeleton width={36} height={20} /> : (span.total ? fmtPct(rateOf(spanReached, span.total), 1) : '—')}
              </span>
            </div>
          </div>
        </div>

        {/* Loading has to be its own branch, ahead of the empty check — rows
            resolve to [] before the fetch settles, and reading that as "no
            results" flashed the empty state on every visit. */}
        {loading ? (
          <Skeleton height={168} radius={12} />
        ) : plot.length ? (
          <Sparkline
            data={plot}
            xKey="label"
            yKey="rate"
            height={168}
            color="#144CCD"
            /* The same four rows, in the same order, as the Mini App tooltip. */
            tooltip={(row) => (
              <>
                <div className="a-tooltip__row"><span>Signals</span><b>{fmtNum(row.total)}</b></div>
                <div className="a-tooltip__row">
                  <span>{tp.toUpperCase()} reached</span><b>{fmtNum(row.reached)}</b>
                </div>
                <div className="a-tooltip__row a-tooltip__row--gain">
                  <span>{tp.toUpperCase()} hit rate</span><b>{fmtPct(row.rate, 1)}</b>
                </div>
              </>
            )}
          />
        ) : (
          <EmptyState icon="file" title="Nothing published yet" hint="Publish a week's result and its hit rate plots here." />
        )}

        <Tabs
          items={[
            { id: 'weekly', label: 'Weekly' },
            { id: 'monthly', label: 'Monthly' },
            { id: 'yearly', label: 'Yearly' },
          ] satisfies TabItem<Period>[]}
          value={period}
          onChange={setPeriod}
          sub
        />
      </Card>

      <Card title="Result history" flush>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          showIndex
          loading={loading}
          empty={<EmptyState icon="file" title="No results recorded" hint="Add a week's result to start the history." />}
        />
      </Card>

      <AnimatePresence>
        {editingId !== null && (
          <AddResultModal
            weeks={weeks}
            rows={rows}
            editing={rows.find((r) => r.id === editingId)}
            onClose={() => setEditingId(null)}
            onSave={save}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleting && (
          <Confirm
            danger
            title="Delete result"
            message={(
              <>
                Are you sure you want to delete the result for{' '}
                <b style={{ color: 'var(--ink)' }}>{deleting.period}</b> ({deleting.range})?
                {deleting.status === 'published' && ' It is published, so customers can see it right now.'}
              </>
            )}
            cancelLabel="Cancel"
            confirmLabel="Delete result"
            onCancel={() => setDeleting(null)}
            onConfirm={() => {
              const next = rows.filter((x) => x.id !== deleting.id);
              setEdits(next);
              setDeleting(null);
              api.deleteSignalResult(deleting.id).catch(() => setEdits(rows));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* Dates the operator reads back, not ISO stamps — these sit next to
   "May 11, 2024" rows that came from the seed in the same format. */
const todayLabel = () =>
  new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const timeLabel = () =>
  new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

/* ---------------------------------------------------------------------
 * Add result
 * ------------------------------------------------------------------- */

/** A stored result is only totals, so editing rehydrates them as N tally marks. */
const entriesFrom = (r: SignalResult): Outcome[] => ([
  ...Array<Outcome>(r.tp1).fill('tp1'), ...Array<Outcome>(r.tp2).fill('tp2'),
  ...Array<Outcome>(r.tp3).fill('tp3'), ...Array<Outcome>(r.tp4).fill('tp4'),
  ...Array<Outcome>(r.sl).fill('sl'),
]);

function AddResultModal({
  weeks, rows, editing, onClose, onSave,
}: {
  weeks: Week[];
  rows: SignalResult[];
  editing?: SignalResult;
  onClose: () => void;
  onSave: (result: SignalResult, status: 'draft' | 'published') => void;
}) {
  const [weekId, setWeekId] = useState(editing?.id ?? weeks[0]?.id ?? '');
  const [entries, setEntries] = useState<Outcome[]>(editing ? entriesFrom(editing) : []);
  const [pickingWeek, setPickingWeek] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const week = weeks.find((w) => w.id === weekId);
  // Status per week id — a drafted week is not yet "Recorded", it's a draft.
  const statusOf = new Map(rows.map((r) => [r.id, r.status]));

  /* What the operator taps is where a signal *stopped*. What the summary shows
     is how many touched each level, which is that tally plus everything above
     it — so tapping TP3 visibly moves TP1, TP2 and TP3 at once. */
  const stopped = (o: Outcome) => entries.filter((e) => e === o).length;
  const counts: Counts = {
    total: entries.length,
    sl: stopped('sl'),
    tp1: stopped('tp1'),
    tp2: stopped('tp2'),
    tp3: stopped('tp3'),
    tp4: stopped('tp4'),
  };
  const touched = (o: Outcome) => (o === 'sl' ? counts.sl : reached(counts, o));

  const build = (): SignalResult => ({
    ...counts,
    id: week?.id ?? editing?.id ?? `w${new Date().toISOString().slice(0, 10)}`,
    period: week?.period ?? editing?.period ?? 'New week',
    range: week?.range ?? editing?.range ?? '—',
    status: 'draft',
    publishedAt: editing?.publishedAt ?? null,
    publishedTime: editing?.publishedTime ?? null,
  });

  return (
    <Modal
      title={editing ? `Edit ${editing.period}` : 'Add result'}
      subtitle={week?.range}
      width={920}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" icon="trash" disabled={!counts.total} onClick={() => setEntries([])}>
            Clear all
          </Button>
          <Button variant="ghost" icon="file" disabled={!counts.total} className="a-spacer" onClick={() => onSave(build(), 'draft')}>
            Save draft
          </Button>
          <Button variant="primary" icon="send" disabled={!counts.total} onClick={() => setPublishing(true)}>
            Publish
          </Button>
        </>
      )}
    >
      <div className="a-resultgrid">
        <div className="a-col">
          <div>
            <div className="a-field__label" style={{ marginBottom: 6 }}>Week</div>
            <button
              type="button"
              className="a-input a-row"
              style={{ justifyContent: 'space-between' }}
              aria-expanded={pickingWeek}
              onClick={() => setPickingWeek(!pickingWeek)}
            >
              {week ? `${week.period} · ${week.range}` : 'Choose a week'}
              <Icon name={pickingWeek ? 'chevron-up' : 'chevron-down'} size={16} />
            </button>
            {pickingWeek && (
              /* ponytail: week list, not a month grid — picking the week is the
                 whole job, and a calendar would have to explain that the last
                 row of August runs into September anyway. */
              <div className="a-weeklist">
                {weeks.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    className={`a-weekrow${w.id === weekId ? ' a-weekrow--on' : ''}`}
                    onClick={() => { setWeekId(w.id); setPickingWeek(false); }}
                  >
                    <span className="a-cell2">
                      <span className="at-14 at-semibold">{w.period}</span>
                      <span>{w.range}</span>
                    </span>
                    {statusOf.get(w.id) === 'published' && <span className="a-weekrow__tag">Recorded</span>}
                    {statusOf.get(w.id) === 'draft' && <span className="a-weekrow__tag a-weekrow__tag--draft">Draft</span>}
                    {w.id === weekId && (
                      <span className="a-weekrow__tick"><Icon name="check" size={16} /></span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="a-field__label" style={{ marginBottom: 6 }}>Where the signal closed</div>
            <div className="a-row" style={{ gap: 6 }}>
              {OUTCOMES.map((o) => (
                <Button
                  key={o.id}
                  variant={o.id === 'sl' ? 'danger' : 'success'}
                  onClick={() => setEntries([...entries, o.id])}
                >
                  <Pip outcome={o.id} size={20} />
                  {o.id.toUpperCase()}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="a-row" style={{ marginBottom: 6 }}>
              <span className="a-field__label">Entries</span>
              <Button
                variant="plain"
                size="sm"
                icon="undo"
                className="a-spacer"
                disabled={!entries.length}
                onClick={() => setEntries(entries.slice(0, -1))}
              >
                Undo last
              </Button>
            </div>
            <div className="a-entrylist">
              {entries.length === 0 && <div className="a-empty at-13">No entries yet.</div>}
              {/* Newest first, numbered by entry order — #6 is the last tap. */}
              {[...entries].reverse().map((e, i) => {
                const index = entries.length - 1 - i;
                return (
                  <div key={index} className="a-entryrow">
                    <span className="at-13 at-muted">#{index + 1}</span>
                    <Pip outcome={e} size={20} />
                    <span className="at-13 at-semibold">{e.toUpperCase()}</span>
                    <IconButton
                      icon="trash"
                      label={`Remove entry ${index + 1}`}
                      size={15}
                      danger
                      onClick={() => setEntries(entries.filter((_, ix) => ix !== index))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="a-col">
          <div className="a-field__label">This batch</div>
          <div className="a-summaryrow a-summaryrow--total">
            <span className="at-14 at-semibold" style={{ flex: 1 }}>Total signals</span>
            <span className="at-16 at-bold" style={{ color: 'var(--index)' }}>{counts.total}</span>
          </div>
          {OUTCOMES.map((o) => (
            <div key={o.id} className="a-summaryrow">
              <Pip outcome={o.id} />
              <span className="at-14" style={{ flex: 1 }}>{o.label}</span>
              <span className={`at-16 at-bold ${o.tone === 'gain' ? 'at-pos' : 'at-neg'}`}>
                {touched(o.id)}
              </span>
              <span className={`at-13 ${o.tone === 'gain' ? 'at-pos' : 'at-neg'} a-summaryrow__pct`}>
                {counts.total ? fmtPct(rateOf(touched(o.id), counts.total), 1) : '—'}
              </span>
            </div>
          ))}
          <p className="at-12 at-muted" style={{ marginTop: 2 }}>
            Each take-profit counts every signal that ran past it, so a TP3 close
            adds to TP1 and TP2 as well. A stop-loss counts only as SL.
          </p>
        </div>
      </div>

      <AnimatePresence>
        {publishing && (
          <Confirm
            title="Publish result"
            message={(
              <>
                Are you sure you want to publish the result for{' '}
                <b style={{ color: 'var(--ink)' }}>{week?.period ?? editing?.period}</b>?
                {' '}It goes live on every customer&rsquo;s home screen.
              </>
            )}
            cancelLabel="Cancel"
            confirmLabel="Publish result"
            onCancel={() => setPublishing(false)}
            onConfirm={() => {
              setPublishing(false);
              onSave(build(), 'published');
            }}
          />
        )}
      </AnimatePresence>
    </Modal>
  );
}
