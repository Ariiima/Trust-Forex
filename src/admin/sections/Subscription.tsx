import { useMemo, useState } from 'react';
import { api, type ExtraGrant, type Grain, type PlanId, type Subscriber } from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, Button, Card, Cell2, Checkbox, Chip, Confirm, DateInput, EmptyState, Field, Modal,
  PlanGlyph, RichText, Select, Skeleton, StatusChip, Sweep, Tabs, Toggle,
  UserCell, fmtUsd, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';
import { LineChart, type Series } from '../ui/Chart';
import EventsRail from './EventsRail';

type Tab = 'analysis' | 'subscribers' | 'extra';

const TABS: TabItem<Tab>[] = [
  { id: 'analysis', label: 'Subscription analysis', icon: 'chart' },
  { id: 'subscribers', label: 'View subscribers', icon: 'users' },
  { id: 'extra', label: 'Add extra subscription', icon: 'plus' },
];

const PLANS: PlanId[] = ['silver', 'gold', 'diamond'];

// Subscription charts bucket by billing cycle first — Daily/Weekly/Monthly
// (Brokers' GRAIN_OPTIONS) doesn't apply here.
const SUBSCRIPTION_GRAINS: { value: Grain; label: string }[] = [
  { value: 'cycle', label: 'Cyclically' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const SERIES: Series[] = [
  { key: 'totalSubscribers', label: 'Total subscribers', axis: 'count' },
  { key: 'renewals', label: 'Renewals', axis: 'count' },
  { key: 'renewalRate', label: 'Renewal rate', axis: 'rate', style: 'dashed' },
  { key: 'reactivations', label: 'Reactivations', axis: 'count' },
  { key: 'reactivationRate', label: 'Reactivation rate', axis: 'rate', style: 'dotted' },
  { key: 'netRevenue', label: 'Net Revenue (USD)', axis: 'usd' },
];

export default function Subscription() {
  const [tab, setTab] = useState<Tab>('analysis');
  return (
    <>
      <header className="a-pagehead">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </header>
      <Sweep key={tab}>
      {tab === 'analysis' && <Analysis />}
      {tab === 'subscribers' && <Subscribers />}
      {tab === 'extra' && <ExtraSubscriptions />}
      </Sweep>
    </>
  );
}

/* ---------------------------------------------------------------------
 * Analysis
 * ------------------------------------------------------------------- */

function Analysis() {
  const loadedEvents = useAsync(api.events);
  const events = loadedEvents ?? [];
  const [plans, setPlans] = useState<PlanId[]>(PLANS);
  const [grain, setGrain] = useState<Grain>('cycle');

  // Plans are chart dimensions: deselecting Gold re-queries without it, and the
  // renewal rate is recomputed from the remaining plans' own numerators.
  const data = useAsync(
    () => api.series('subscription', { dims: plans, grain }),
    [plans.join(','), grain],
  );

  const togglePlan = (p: PlanId) =>
    setPlans(plans.includes(p) ? plans.filter((x) => x !== p) : [...plans, p]);

  return (
    <div className="a-split">
      <Card
        title="Subscription analysis"
        actions={
          <Select
            value={grain}
            onChange={setGrain}
            options={SUBSCRIPTION_GRAINS}
            style={{ width: 120 }}
          />
        }
      >
        <div className="a-row" style={{ marginBottom: 12 }}>
          <span className="at-13 at-muted">Plans</span>
          {PLANS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={plans.includes(p)}
              onClick={() => togglePlan(p)}
              className={`a-planchip${plans.includes(p) ? ' a-planchip--on' : ''}`}
            >
              <PlanGlyph plan={p} size={22} />
            </button>
          ))}
        </div>
        {plans.length === 0
          ? <EmptyState icon="filter" title="No plans selected" hint="Pick at least one plan to chart." />
          : <LineChart data={data ?? []} series={SERIES} xKey="label" height={360} loading={!data} />}
      </Card>
      <EventsRail events={events} loading={loadedEvents === undefined} />
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Subscribers
 * ------------------------------------------------------------------- */

type Segment = 'all' | 'active' | 'expired';

function Subscribers() {
  const loadedSubs = useAsync(api.subscribers);
  const all = loadedSubs ?? [];
  const [segment, setSegment] = useState<Segment>('all');
  const [plans, setPlans] = useState<PlanId[]>(PLANS);

  const loadingSubs = loadedSubs === undefined;
  const counts = {
    all: all.length,
    active: all.filter((s) => s.status === 'active').length,
    expired: all.filter((s) => s.status === 'expired').length,
  };
  const planCounts = Object.fromEntries(
    PLANS.map((p) => [p, all.filter((s) => s.plan === p).length]),
  ) as Record<PlanId, number>;

  const filtered = useMemo(() => all.filter((s) =>
    (segment === 'all' || s.status === segment)
    && plans.includes(s.plan)
    ), [all, segment, plans]);

  const columns: Column<Subscriber>[] = [
    { id: 'user', header: 'User', render: (s) => <UserCell name={s.name} sub={`#${s.id}`} plan={s.plan} /> },
    { id: 'last', header: 'Last action', render: (s) => <Cell2 top={s.lastActionAt} bottom={s.lastActionTime} />, sort: (s) => `${s.lastActionAt} ${s.lastActionTime}` },
    {
      id: 'days',
      header: 'Days left',
      render: (s) => (
        <span className={s.daysLeft === 0 ? 'at-muted' : undefined}>
          {s.daysLeft} {s.daysLeft === 1 ? 'day' : 'days'}
        </span>
      ),
      sort: (s) => s.daysLeft,
    },
    { id: 'paid', header: 'Total paid', align: 'right', render: (s) => fmtUsd(s.totalPaid), sort: (s) => s.totalPaid },
    { id: 'status', header: 'Status', align: 'right', render: (s) => <StatusChip status={s.status} /> },
  ];

  return (
    <Card flush>
      <div className="a-filterbar">
        <div className="a-filterbar__group">
          <Tabs
            items={[
              { id: 'all', label: 'All users', count: loadingSubs ? undefined : counts.all },
              { id: 'active', label: 'Active users', count: loadingSubs ? undefined : counts.active },
              { id: 'expired', label: 'Expired users', count: loadingSubs ? undefined : counts.expired },
            ]}
            value={segment}
            onChange={setSegment}
            sub
          />
        </div>
        <div className="a-filterbar__group">
          <span className="a-filterbar__label">Plan</span>
          {PLANS.map((p) => (
            <span key={p} className={`a-planfilter${plans.includes(p) ? ' a-planfilter--on' : ''}`}>
              <Checkbox
                checked={plans.includes(p)}
                onChange={(on) => setPlans(on ? [...plans, p] : plans.filter((x) => x !== p))}
                label={<><PlanGlyph plan={p} size={22} /> {loadingSubs ? <Skeleton width={16} height={14} /> : planCounts[p]}</>}
              />
            </span>
          ))}
        </div>
      </div>

      <DataTable columns={columns} rows={filtered} rowKey={(s) => s.id} showIndex loading={loadedSubs === undefined} />
    </Card>
  );
}

/* ---------------------------------------------------------------------
 * Extra-day grants
 * ------------------------------------------------------------------- */

const DEFAULT_GRANT_MESSAGE =
  'We have added <b>2 extra days</b> to your subscription.<br>Your access has been extended automatically, and the updated expiration date is now reflected in your account.';

function ExtraSubscriptions() {
  const loadedGrants = useAsync(api.extraGrants);
  const [grants, setGrants] = useState<ExtraGrant[] | null>(null);
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [days, setDays] = useState(2);
  const [before, setBefore] = useState('2025-05-23T10:30');
  const [notify, setNotify] = useState(true);
  const [message, setMessage] = useState(DEFAULT_GRANT_MESSAGE);

  const list = grants ?? loadedGrants ?? [];

  const apply = () => {
    setConfirming(false);
    setOpen(false);
    const now = new Date();
    api.addExtraGrant({
      addedAt: now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      addedTime: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
      extraDays: days,
      // The server counts eligible subscribers against this date.
      purchasedBefore: before.split('T')[0] ?? '',
      eligibleBefore: before.split('T')[0] || '—',
      eligibleTime: before.split('T')[1] ?? '—',
      message,
      notify,
    })
      // `affected` is counted server-side, so the row only exists once it lands.
      .then((saved) => setGrants([saved, ...list]))
      .catch(() => {});
  };

  const columns: Column<ExtraGrant>[] = [
    { id: 'added', header: 'Added at', render: (g) => <Cell2 top={g.addedAt} bottom={g.addedTime} />, sort: (g) => g.addedAt },
    { id: 'days', header: 'Extra days', render: (g) => <Chip tone="primary">{g.extraDays} {g.extraDays === 1 ? 'day' : 'days'}</Chip>, sort: (g) => g.extraDays },
    { id: 'before', header: 'Eligible before', render: (g) => <Cell2 top={g.eligibleBefore} bottom={g.eligibleTime} /> },
    { id: 'affected', header: 'Affected subscriptions', align: 'right', render: (g) => `${g.affected} subscriptions`, sort: (g) => g.affected },
  ];

  return (
    <>
      <Card
        title="Recent extra-day subscriptions"
        flush
        actions={<Button variant="primary" icon="plus" onClick={() => setOpen(true)}>Add extra subscription</Button>}
      >
        <DataTable columns={columns} rows={list} rowKey={(g) => g.id} showIndex loading={loadedGrants === undefined} />
      </Card>

      <AnimatePresence>
        {open && (
          <Modal
            title="Add extra subscription"
            width={640}
            onClose={() => setOpen(false)}
            footer={
              <>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button variant="primary" icon="plus" onClick={() => setConfirming(true)}>Confirm</Button>
              </>
            }
          >
            <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <Field label="Extra days" hint="Enter the number of days to add.">
                <div className="a-inputgroup">
                  <input
                    className="a-input"
                    type="number"
                    min={1}
                    value={days}
                    onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
                  />
                  <span className="a-inputgroup__suffix" style={{ width: 56 }}>days</span>
                </div>
              </Field>
              <Field label="Purchased before" hint="Users who purchased before this date will be eligible.">
                <DateInput type="datetime-local" value={before} onChange={setBefore} />
              </Field>
            </div>

            <div className="a-row" style={{ margin: '16px 0 8px' }}>
              <span className="at-13 at-semibold">Telegram message</span>
              <Toggle checked={notify} onChange={setNotify} label={<span className="a-spacer at-13">Notify users</span>} />
            </div>
            <RichText value={message} onChange={setMessage} />
            <p className="a-field__hint" style={{ marginTop: 8 }}>You can edit this message before publishing.</p>
          </Modal>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirming && (
          <Confirm
            title="Apply extra subscription"
            message={(
              <>
                Are you sure you want to apply this extra subscription? It affects every subscriber
                who purchased before <b style={{ color: 'var(--ink)' }}>{before.split('T')[0] || '—'}</b>
                {notify && ', and sends them a Telegram message'}.
              </>
            )}
            cancelLabel="Cancel"
            confirmLabel="Apply extra subscription"
            onCancel={() => setConfirming(false)}
            onConfirm={apply}
          />
        )}
      </AnimatePresence>
    </>
  );
}
