import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  api, type AdminUser, type Broker, type BrokerPreview, type BrokerStatus, type BrokerTotals,
  type CashbackCycle, type Grain, type ReviewRequest,
} from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, BrokerLogo, Button, Card, Cell2, Chip, Confirm, CopyValue, DragList, EmptyState, Icon, Modal,
  MultiSelect, Select, Skeleton, StatusChip, Sweep, Tabs, UserCell,
  fmtNum, fmtUsd, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';
import { BrokerForm, badgeIncomplete, blankBrokerPreview } from './BrokerForm';
import { LineChart, type Series } from '../ui/Chart';
import EventsRail from './EventsRail';

type Tab = 'all' | 'cycles' | 'charts' | 'review';

const TABS: TabItem<Tab>[] = [
  { id: 'all', label: 'All brokers' },
  { id: 'cycles', label: 'Cashback cycle' },
  { id: 'charts', label: 'Broker charts' },
  { id: 'review', label: 'Unreviewed users' },
];

const STATUS_OPTIONS = [
  { value: 'public' as const, label: 'Public' },
  { value: 'private' as const, label: 'Private' },
  { value: 'stopped' as const, label: 'Stopped' },
];

const CHART_SERIES: Series[] = [
  { key: 'activeUsers', label: 'Active users', axis: 'count' },
  { key: 'pendingUsers', label: 'Pending users', axis: 'count' },
  { key: 'cashbackUsers', label: 'Cashback users', axis: 'count' },
  { key: 'grossRebate', label: 'Gross rebate (USD)', axis: 'usd' },
  { key: 'sharedCashback', label: 'Shared cashback (USD)', axis: 'usd', style: 'dashed' },
  { key: 'netRevenue', label: 'Net revenue (USD)', axis: 'usd' },
];

export default function Brokers() {
  const nav = useNavigate();
  const loaded = useAsync(api.brokers);
  const [tab, setTab] = useState<Tab>('all');
  const [brokers, setBrokers] = useState<Broker[] | null>(null);
  const [sorting, setSorting] = useState(false);
  const [adding, setAdding] = useState(false);

  // ponytail: no name filter — the broker list tops out around a dozen or two
  // rows, all visible on one page, so a search box was a control for a
  // problem this screen doesn't have.
  const list = brokers ?? loaded ?? [];

  if (adding) {
    return (
      <AddBrokerPage
        onCancel={() => setAdding(false)}
        onAdded={(b) => { setBrokers([...list, b]); setAdding(false); }}
      />
    );
  }

  return (
    <>
      <header className="a-pagehead">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </header>

      <Sweep key={tab}>
      {tab === 'all' && (
        <AllBrokers
          brokers={list}
          loading={loaded === undefined}
          onOpen={(b) => nav(`/brokers/${b.id}`)}
          onSort={() => setSorting(true)}
          onAdd={() => setAdding(true)}
          onPublishedAll={() => api.brokers().then(setBrokers)}
        />
      )}
      {tab === 'cycles' && <Cycles />}
      {tab === 'charts' && <Charts />}
      {tab === 'review' && <ReviewQueue />}
      </Sweep>


      <AnimatePresence>
        {sorting && (
          <SortBrokersModal
            brokers={list}
            onClose={() => setSorting(false)}
            onSave={(next) => {
              setBrokers(next);
              setSorting(false);
              api.reorderBrokers(next.map((b) => ({ id: b.id, status: b.status })))
                .then(setBrokers)
                .catch(() => setBrokers(loaded ?? null));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------------------------------------------------------------
 * All brokers
 * ------------------------------------------------------------------- */

function AllBrokers({
  brokers, loading, onOpen, onSort, onAdd, onPublishedAll,
}: {
  brokers: Broker[]; loading: boolean; onOpen: (b: Broker) => void;
  onSort: () => void; onAdd: () => void; onPublishedAll: () => void;
}) {
  // Summed from the rebate and draft tables, not estimated from headcount.
  const loadedTotals = useAsync(api.brokerTotals);
  const [totalsOverride, setTotalsOverride] = useState<BrokerTotals | null>(null);
  const totals = totalsOverride ?? loadedTotals;
  const [publishing, setPublishing] = useState(false);
  const pendingDrafts = brokers.reduce((s, b) => s + b.draftedPayment, 0);

  /* One request, one transaction, one weekly cycle. This used to fan out a
     publish per broker: N transactions, N cycle rows, and a half-paid week if
     any of them failed. Both the card grid (via onPublishedAll) and this
     summary bar read the same publish, so both have to refetch — the bar used
     to sit frozen at its pre-publish numbers until the page reloaded. */
  const publishAll = () => {
    setPublishing(true);
    api.publishAllRebateDrafts()
      .then(() => {
        onPublishedAll();
        return api.brokerTotals().then(setTotalsOverride);
      })
      .finally(() => setPublishing(false));
  };

  return (
    <>
      <div className="a-row">
        <span className="a-spacer" />
        <Button icon="sort" onClick={onSort}>Sort brokers</Button>
        <Button variant="primary" icon="plus" onClick={onAdd}>Add broker</Button>
      </div>

      <div className="a-brokergrid">
        {loading && Array.from({ length: 6 }, (_, i) => (
          <div key={`skeleton-${i}`} className="a-brokercard" aria-hidden="true">
            <div className="a-row">
              <Skeleton width={22} height={22} radius={6} />
              <Skeleton width={34} height={34} radius={17} />
              <Skeleton width={110} height={16} />
            </div>
            <dl className="a-brokercard__stats">
              <dt><Skeleton width={70} /></dt><dd><Skeleton width={32} /></dd>
              <dt><Skeleton width={78} /></dt><dd><Skeleton width={32} /></dd>
              <dt><Skeleton width={92} /></dt><dd><Skeleton width={32} /></dd>
            </dl>
            <div className="a-row" style={{ marginTop: 12 }}><Skeleton width="60%" /></div>
          </div>
        ))}
        {!loading && brokers.map((b) => (
          <button key={b.id} type="button" className="a-brokercard" onClick={() => onOpen(b)}>
            <div className="a-row">
              <span className="a-brokercard__rank">{b.rank ?? '–'}</span>
              <BrokerLogo name={b.name} color={b.color} size={34} />
              <span className="at-16 at-semibold">{b.name}</span>
              <span className="a-spacer">
                <StatusChip status={b.status} />
              </span>
            </div>
            <dl className="a-brokercard__stats">
              <dt>Active Users</dt><dd>{fmtNum(b.activeUsers)}</dd>
              <dt>Pending Users</dt><dd>{fmtNum(b.pendingUsers)}</dd>
              <dt>Drafted payment</dt><dd>{fmtNum(b.draftedPayment)}</dd>
            </dl>
            <div className="a-row at-12 at-muted" style={{ marginTop: 12 }}>
              Last updated:
              <span className="a-spacer">{b.updatedAt}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="a-summarybar">
        <span className="at-16 at-semibold">Rebate payment overview</span>
        <span className="a-summarybar__item">
          <span className="a-summarybar__icon"><Icon name="dollar" size={20} /></span>
          <span className="a-cell2">
            <span className="a-summarybar__label">Total rebate amount</span>
            <span className="a-summarybar__value">{totals ? fmtUsd(totals.totalRebate) : <Skeleton width={72} height={20} />}</span>
          </span>
        </span>
        <span className="a-summarybar__item">
          <span className="a-summarybar__icon"><Icon name="file" size={20} /></span>
          <span className="a-cell2">
            <span className="a-summarybar__label">Drafted payment</span>
            <span className="a-summarybar__value">{totals ? fmtUsd(totals.draftedPayment) : <Skeleton width={72} height={20} />}</span>
          </span>
        </span>
        <span className="a-summarybar__item">
          <span className="a-summarybar__icon"><Icon name="bank" size={20} /></span>
          <span className="a-cell2">
            <span className="a-summarybar__label">Total brokers</span>
            <span className="a-summarybar__value">{totals ? totals.brokers : <Skeleton width={28} height={20} />}</span>
          </span>
        </span>
        <Button
          variant="ghost"
          icon="send"
          className="a-spacer"
          disabled={publishing || pendingDrafts === 0}
          onClick={publishAll}
        >
          {pendingDrafts ? `Publish all (${pendingDrafts})` : 'Nothing to publish'}
        </Button>
      </div>
    </>
  );
}

/**
 * Add broker — the same form the broker's own preview page uses.
 *
 * It used to be a two-field modal (name + status), which meant a new broker
 * arrived with nothing users could see and every real field had to be filled
 * in afterwards from a different screen. Creating and editing now show the
 * identical form; only the save differs, because the broker has to exist
 * before its preview can be written.
 *
 * A broker's id is derived from its name, so a duplicate name is a duplicate
 * broker — the server answers 409 and the form says so rather than silently
 * creating a second row.
 */
function AddBrokerPage({ onCancel, onAdded }: { onCancel: () => void; onAdded: (b: Broker) => void }) {
  const [draft, setDraft] = useState<BrokerPreview>(blankBrokerPreview);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(blankBrokerPreview());
  const incomplete = badgeIncomplete(draft);
  const blocked = !draft.name.trim() || incomplete;

  const create = () => {
    setBusy(true);
    setError('');
    /* Two calls, because the preview is keyed on an id the server mints. If
       the second fails the broker still exists, so the operator lands on its
       preview page rather than losing everything they typed. */
    api.addBroker({ name: draft.name.trim(), status: draft.status })
      .then((broker) =>
        api.saveBrokerPreview(broker.id, { ...draft, brokerId: broker.id })
          .then(() => onAdded(broker)))
      .catch((err) => {
        setError(err?.message === 'broker_exists'
          ? 'A broker with that name already exists.'
          : 'Could not save. Try again.');
        setBusy(false);
      });
  };

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Add broker</h1>
          <p className="a-pagehead__sub">
            Everything users will see. New brokers start private; publish from Sort brokers when ready.
          </p>
        </div>
      </header>

      <BrokerForm
        value={draft}
        onChange={setDraft}
        footer={(
          <div className="a-row">
            {error && <span className="at-13 at-neg" role="alert">{error}</span>}
            {!error && incomplete && (
              <span className="at-13 at-neg" role="alert">A badge needs text and a colour.</span>
            )}
            <span className="a-spacer" />
            <Button variant="ghost" onClick={() => (dirty ? setConfirmLeave(true) : onCancel())}>Cancel</Button>
            <Button variant="primary" icon="plus" disabled={busy || blocked} onClick={() => setConfirming(true)}>
              {busy ? 'Adding…' : 'Add broker'}
            </Button>
          </div>
        )}
      />

      <AnimatePresence>
        {confirming && (
          <Confirm
            title="Add broker"
            message={<>Are you sure you want to create <b style={{ color: 'var(--ink)' }}>{draft.name.trim()}</b>?</>}
            confirmLabel="Add broker"
            onCancel={() => setConfirming(false)}
            onConfirm={() => { setConfirming(false); create(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmLeave && (
          <Confirm
            title="Unsaved changes"
            message="You have unsaved changes. Are you sure you want to leave without saving?"
            confirmLabel="Leave without saving"
            cancelLabel="Keep editing"
            danger
            onCancel={() => setConfirmLeave(false)}
            onConfirm={() => { setConfirmLeave(false); onCancel(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * Reorder + restatus in one dialog. Rank belongs to public brokers only, so the
 * numbers are recomputed from the new order on save rather than stored per row.
 */
function SortBrokersModal({
  brokers, onClose, onSave,
}: { brokers: Broker[]; onClose: () => void; onSave: (next: Broker[]) => void }) {
  const [draft, setDraft] = useState(brokers);

  const commit = () => {
    let rank = 0;
    onSave(draft.map((b) => ({ ...b, rank: b.status === 'public' ? ++rank : null })));
  };

  return (
    <Modal
      title="Sort brokers"
      subtitle="Reorder public brokers or change their status."
      width={660}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={commit}>Save changes</Button>
        </>
      }
    >
      <DragList
        items={draft}
        keyOf={(b) => b.id}
        onReorder={setDraft}
        canDrag={(b) => b.status === 'public'}
      >
        {(b, i) => (
          <>
            <span className="at-13 at-muted" style={{ width: 20 }}>
              {b.status === 'public' ? draft.slice(0, i + 1).filter((x) => x.status === 'public').length : ''}
            </span>
            <BrokerLogo name={b.name} color={b.color} />
            <span className="at-14 at-semibold" style={{ flex: 1 }}>{b.name}</span>
            <Select
              value={b.status}
              options={STATUS_OPTIONS}
              onChange={(status: BrokerStatus) =>
                setDraft(draft.map((x) => (x.id === b.id ? { ...x, status } : x)))}
              style={{ width: 140 }}
            />
          </>
        )}
      </DragList>
    </Modal>
  );
}

/* ---------------------------------------------------------------------
 * Cashback cycles
 * ------------------------------------------------------------------- */

function Cycles() {
  const loadedCycles = useAsync(api.cashbackCycles);
  const cycles = loadedCycles ?? [];

  const columns: Column<CashbackCycle>[] = [
    { id: 'cycle', header: 'Cycle', render: (c) => <Cell2 top={<b>{c.name}</b>} bottom={c.range} />, sort: (c) => c.name },
    { id: 'gross', header: 'Gross rebate', align: 'right', render: (c) => fmtUsd(c.grossRebate), sort: (c) => c.grossRebate },
    { id: 'shared', header: 'Shared cashback', align: 'right', render: (c) => <span className="at-neg">{fmtUsd(c.sharedCashback)}</span>, sort: (c) => c.sharedCashback },
    { id: 'net', header: 'Net revenue', align: 'right', render: (c) => <span className="at-pos">{fmtUsd(c.netRevenue)}</span>, sort: (c) => c.netRevenue },
    { id: 'users', header: 'Cashback users', align: 'right', render: (c) => fmtNum(c.cashbackUsers), sort: (c) => c.cashbackUsers },
    { id: 'published', header: 'Published at', align: 'right', render: (c) => <Cell2 top={c.publishedAt.split(' · ')[0]} bottom={c.publishedAt.split(' · ')[1]} /> },
  ];

  return (
    <Card title={`Cashback cycles (${cycles.length})`} flush>
      <DataTable columns={columns} rows={cycles} rowKey={(c) => c.id} showIndex loading={!loadedCycles} />
    </Card>
  );
}

/* ---------------------------------------------------------------------
 * Charts
 * ------------------------------------------------------------------- */

function Charts() {
  const brokers = useAsync(api.brokers) ?? [];
  const events = useAsync(api.events) ?? [];
  const [selected, setSelected] = useState<string[]>([]);
  const [grain, setGrain] = useState<Grain>('weekly');

  // Refetched whenever the filter or the granularity changes — the server owns
  // the rollup, so a narrower selection is a different query, not a slice.
  const data = useAsync(
    () => api.series('broker', { dims: selected, grain }),
    [selected.join(','), grain],
  );

  const options = brokers.map((b) => ({
    value: b.id,
    label: b.name,
    icon: <BrokerLogo name={b.name} color={b.color} size={20} />,
  }));

  return (
    <div className="a-split">
      <Card
        title="Users and cashback overview"
        actions={
          <>
            <MultiSelect
              label="Brokers"
              options={options}
              value={selected.length ? selected : brokers.map((b) => b.id)}
              onChange={(next) => setSelected(next.length === brokers.length ? [] : next)}
              allLabel="All brokers"
            />
            <Select
              value={grain}
              onChange={setGrain}
              options={GRAIN_OPTIONS}
              style={{ width: 130 }}
            />
          </>
        }
      >
        <LineChart data={data ?? []} series={CHART_SERIES} xKey="label" height={360} loading={!data} />
      </Card>
      <EventsRail events={events} />
    </div>
  );
}

export const GRAIN_OPTIONS: { value: Grain; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

/* ---------------------------------------------------------------------
 * Unreviewed users
 * ------------------------------------------------------------------- */

const REVIEW_TONE: Record<string, string> = {
  'Registration rejected': 'at-neg',
  'Deposit rejected': 'at-neg',
  'Deposit required': 'a-review-warn',
  'No account': 'at-muted',
};

/** "Jun 12, 2024 · 08:05 AM" only sorts correctly as a timestamp — the middle
    dot trips up Date.parse, so strip it before parsing. */
/**
 * "Jun 12, 2024 · 08:05 AM" -> a number that sorts by real recency.
 *
 * The two halves are parsed separately because only the first half is
 * dependable: these rows carry 24-hour clock times with an AM suffix, and
 * `Date.parse` rejects "Jun 7, 2024 13:20 AM" outright. Handing the whole
 * string to it returned NaN for a third of the rows, which fell back to zero
 * and left the column ordering those rows against real timestamps — the sort
 * looked shuffled rather than wrong, which is worse.
 */
function parseDisplayDate(s: string | null | undefined): number {
  if (!s) return 0;
  const [datePart, timePart = ''] = s.split('·').map((p) => p.trim());
  const day = Date.parse(datePart);
  if (Number.isNaN(day)) return 0;
  const hhmm = timePart.match(/(\d{1,2}):(\d{2})/);
  if (!hhmm) return day;
  // A 12-hour "PM" only shifts an hour that is genuinely in the morning half;
  // "13:20 PM" is already past noon and must not be pushed to 25:20.
  const hour = Number(hhmm[1]);
  const pm = /pm/i.test(timePart) && hour < 12;
  return day + (hour + (pm ? 12 : 0)) * 3_600_000 + Number(hhmm[2]) * 60_000;
}

function ReviewQueue() {
  const nav = useNavigate();
  const loadedQueue = useAsync(api.reviewQueue);
  const queue = loadedQueue ?? [];
  const brokers = useAsync(api.brokers) ?? [];
  const loadedUsers = useAsync(api.users);
  const [edited, setEdited] = useState<AdminUser[] | null>(null);
  const users = edited ?? loadedUsers ?? [];
  const [decided, setDecided] = useState<Record<string, string>>({});
  const [brokerFilter, setBrokerFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const brokerOf = (id: string) => brokers.find((b) => b.id === id);

  const decide = (id: string, outcome: 'approved' | 'waiting' | 'rejected') => {
    const request = queue.find((r) => r.id === id);
    setDecided((d) => ({ ...d, [id]: outcome }));
    // The server writes both the queue row and the account status in one
    // transaction; mirror both here so the two tables never disagree on screen.
    if (request) {
      const status = ({ approved: 'active', rejected: 'rejected', waiting: 'pending' } as const)[outcome];
      setEdited(users.map((u) => (u.id === request.userId ? { ...u, status } : u)));
    }
    api.decideReview(id, outcome).catch(() => setDecided((d) => {
      const { [id]: _dropped, ...rest } = d;
      return rest;
    }));
  };

  const reviewColumns: Column<ReviewRequest>[] = [
    { id: 'user', header: 'User', render: (r) => <UserCell name={r.name} sub={r.userId} plan={r.plan} /> },
    {
      id: 'broker',
      header: 'Broker',
      render: (r) => {
        const b = brokerOf(r.brokerId);
        return (
          <span className="a-row" style={{ gap: 8 }}>
            <BrokerLogo name={b?.name ?? r.brokerId} color={b?.color} size={24} />
            {b?.name ?? r.brokerId}
          </span>
        );
      },
      sort: (r) => r.brokerId,
    },
    {
      id: 'requested',
      header: 'Requested at',
      render: (r) => <Cell2 top={r.requestedAt.split(' · ')[0]} bottom={r.requestedAt.split(' · ')[1]} />,
      sort: (r) => parseDisplayDate(r.requestedAt),
    },
    {
      id: 'email',
      header: 'Email / Broker ID',
      render: (r) => (
        <Cell2
          top={<CopyValue value={r.email} label="email" />}
          bottom={<CopyValue value={r.brokerAccountId} label="broker ID" />}
        />
      ),
    },
    {
      id: 'status',
      header: 'Last status',
      render: (r) => <span className={REVIEW_TONE[r.lastStatus] ?? ''}>{r.lastStatus}</span>,
      sort: (r) => r.lastStatus,
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) =>
        decided[r.id] ? (
          <Chip tone={decided[r.id] === 'approved' ? 'success' : decided[r.id] === 'rejected' ? 'danger' : 'warn'}>
            {decided[r.id][0].toUpperCase() + decided[r.id].slice(1)}
          </Chip>
        ) : (
          <span className="a-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button size="sm" variant="success" onClick={() => decide(r.id, 'approved')}>Approve</Button>
            <Button size="sm" variant="warn" onClick={() => decide(r.id, 'waiting')}>Waiting for deposit</Button>
            <Button size="sm" variant="danger" onClick={() => decide(r.id, 'rejected')}>Reject</Button>
          </span>
        ),
    },
  ];

  const recent = users.filter((u) =>
    (statusFilter === 'all' || u.status === statusFilter)
    && (brokerFilter === 'all' || u.broker === brokerFilter));

  const recentColumns: Column<(typeof users)[number]>[] = [
    {
      id: 'user',
      header: 'User',
      render: (u) => (
        <UserCell
          name={u.name}
          sub={u.userNo != null ? `#${u.userNo}` : u.id}
          plan={u.plan}
          onClick={() => nav(`/users/${u.id}`)}
        />
      ),
    },
    {
      id: 'broker',
      header: 'Broker',
      render: (u) => {
        const b = brokerOf(u.broker ?? '');
        return b ? (
          <span className="a-row" style={{ gap: 8 }}>
            <BrokerLogo name={b.name} color={b.color} size={24} />
            {b.name}
          </span>
        ) : <span className="at-muted">—</span>;
      },
      sort: (u) => u.broker ?? '',
    },
    {
      id: 'email',
      header: 'Email / Broker ID',
      render: (u) => (
        <Cell2
          top={<CopyValue value={u.email} label="email" />}
          bottom={<CopyValue value={u.brokerId} label="broker ID" />}
        />
      ),
    },
    { id: 'status', header: 'Status', render: (u) => <StatusChip status={u.status} /> },
    {
      id: 'date',
      header: 'Action date',
      align: 'right',
      render: (u) => <Cell2 top={u.lastActionAt.split(' · ')[0]} bottom={u.lastActionAt.split(' · ')[1]} />,
      sort: (u) => parseDisplayDate(u.lastActionAt),
    },
  ];

  return (
    <>
      <Card title="Users under review" flush>
        <DataTable columns={reviewColumns} rows={queue} rowKey={(r) => r.id} showIndex maxHeight={420} loading={!loadedQueue}
          empty={<EmptyState icon="check-circle" title="Nothing waiting for review" hint="New broker registrations land here." />} />
      </Card>

      <Card
        title="Recent users"
        flush
        actions={
          <>
            <Select
              value={brokerFilter}
              onChange={setBrokerFilter}
              options={[{ value: 'all', label: 'Broker: All brokers' }, ...brokers.map((b) => ({ value: b.id, label: b.name }))]}
              style={{ width: 200 }}
            />
            <Select
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: 'Status: All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'pending', label: 'Pending' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              style={{ width: 200 }}
            />
          </>
        }
      >
        <DataTable columns={recentColumns} rows={recent} rowKey={(u) => u.id} showIndex maxHeight={420} />
      </Card>
    </>
  );
}
