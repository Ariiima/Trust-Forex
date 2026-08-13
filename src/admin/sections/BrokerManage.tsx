import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type BrokerPreview, type DraftRebate, type FlowMessage, type RebateRow } from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, BrokerLogo, Button, Card, Cell2, Confirm, CopyValue, EmptyState, Field,
  Icon, IconButton, RichText, StatusChip, Sweep, Tabs,
  UserCell, fmtUsd, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';
import { BrokerForm, badgeIncomplete } from './BrokerForm';

type Tab = 'all' | 'active' | 'flow';
type FlowTab = 'messages' | 'preview';


export default function BrokerManage() {
  const nav = useNavigate();
  const { brokerId = '' } = useParams();
  const broker = useAsync(() => api.broker(brokerId), [brokerId]);
  const [tab, setTab] = useState<Tab>('all');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // This broker's own headcount, not the platform-wide totals.
  const tabs: TabItem<Tab>[] = [
    {
      id: 'all',
      label: 'All users',
      count: broker ? (broker.activeUsers + broker.pendingUsers).toLocaleString() : undefined,
    },
    { id: 'active', label: 'Active users', count: broker?.activeUsers.toLocaleString() },
    { id: 'flow', label: 'Manage user flow' },
  ];

  const removeBroker = () => {
    setDeleting(true);
    setDeleteError('');
    api.deleteBroker(brokerId)
      .then(() => nav('/brokers'))
      .catch((err) => {
        setDeleteError(err?.message === 'broker_in_use'
          ? 'This broker still has active or pending users, or a payout waiting to publish — clear those first.'
          : 'Could not delete. Try again.');
        setDeleting(false);
      });
  };

  return (
    <>
      <header className="a-pagehead">
        <Button icon="chevron-left" onClick={() => nav('/brokers')}>Brokers</Button>
        <Tabs items={tabs} value={tab} onChange={setTab} />
        {broker && (
          <span className="a-row a-spacer" style={{ gap: 8 }}>
            <BrokerLogo name={broker.name} color={broker.color} size={30} />
            <span className="at-16 at-semibold">{broker.name}</span>
            <StatusChip status={broker.status} />
          </span>
        )}
        {broker && (
          <Button variant="danger" icon="trash" disabled={deleting} onClick={() => setConfirmDelete(true)}>
            Delete broker
          </Button>
        )}
      </header>
      {deleteError && <p className="at-13 at-neg" role="alert">{deleteError}</p>}

      <Sweep key={tab}>
      {tab === 'all' && <AllUsers brokerId={brokerId} />}
      {tab === 'active' && <ActiveUsers brokerId={brokerId} shareRate={broker?.shareRate ?? 0.3} />}
      {tab === 'flow' && <ManageFlow brokerId={brokerId} />}
      </Sweep>

      <AnimatePresence>
        {confirmDelete && (
          <Confirm
            title="Delete broker"
            message={<>Are you sure you want to permanently delete <b style={{ color: 'var(--ink)' }}>{broker?.name}</b>? This cannot be undone.</>}
            confirmLabel="Delete broker"
            danger
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => { setConfirmDelete(false); removeBroker(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ---------------------------------------------------------------------
 * All users for this broker
 * ------------------------------------------------------------------- */

function AllUsers({ brokerId }: { brokerId: string }) {
  const loadedUsers = useAsync(api.users);
  const all = loadedUsers ?? [];
  // Scoped to this broker — the tab is inside a broker, so a platform-wide list
  // would contradict the count in its own header.
  const users = all.filter((u) => u.broker === brokerId);
  const rows = users;

  const columns: Column<(typeof users)[number]>[] = [
    // The account number under the name, never users.id — see UserDetail.
    { id: 'user', header: 'User', render: (u) => <UserCell name={u.name} sub={u.userNo != null ? `#${u.userNo}` : u.id} plan={u.plan} /> },
    {
      id: 'email',
      header: 'Email / Broker ID',
      render: (u) => <Cell2 top={<CopyValue value={u.email} label="email" />} bottom={<CopyValue value={u.brokerId} label="broker ID" />} />,
    },
    { id: 'status', header: 'Status', render: (u) => <StatusChip status={u.status} /> },
    { id: 'total', header: 'Total Rebate', align: 'right', render: (u) => (u.totalRebate == null ? <span className="at-muted">—</span> : fmtUsd(u.totalRebate)), sort: (u) => u.totalRebate ?? -1 },
    { id: 'lastMonth', header: 'Last Month Rebate', align: 'right', render: (u) => (u.lastMonthRebate == null ? <span className="at-muted">—</span> : fmtUsd(u.lastMonthRebate)), sort: (u) => u.lastMonthRebate ?? -1 },
    { id: 'last', header: 'Last action', align: 'right', render: (u) => <Cell2 top={u.lastActionAt.split(' · ')[0]} bottom={u.lastActionAt.split(' · ')[1]} /> },
  ];

  return (
    <Card
      title={`All users (${rows.length})`}
      flush
    >
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(u) => u.id}
        showIndex
        loading={loadedUsers === undefined}
      />
    </Card>
  );
}

/* ---------------------------------------------------------------------
 * Active users → rebate drafting
 * ------------------------------------------------------------------- */

function ActiveUsers({ brokerId, shareRate }: { brokerId: string; shareRate: number }) {
  const loadedRows = useAsync(() => api.rebateRows(brokerId), [brokerId]);
  // Publishing moves money from drafted into each row's own total, which the
  // rows query owns — overridden here so publish doesn't leave "Total Rebate"
  // frozen at its pre-publish figure until the page reloads.
  const [rowsOverride, setRowsOverride] = useState<RebateRow[] | null>(null);
  const loaded = rowsOverride ?? loadedRows ?? [];
  const loadedDrafts = useAsync(() => api.rebateDrafts(brokerId), [brokerId]);
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [edited, setEdited] = useState<DraftRebate[] | null>(null);

  // Server list until the admin touches it, then the local one.
  const draft = edited ?? loadedDrafts ?? [];
  // Resolves against the *latest* state, not a value captured at render time.
  // The previous version resolved against the render-time `draft`, so the
  // server response for a commit mapped over the pre-click list and wiped the
  // row that had just been added.
  const setDraft = (next: DraftRebate[] | ((prev: DraftRebate[]) => DraftRebate[])) =>
    setEdited((prev) => {
      const base = prev ?? loadedDrafts ?? [];
      return typeof next === 'function' ? next(base) : next;
    });

  const shownRows = loaded;

  const entered = (r: RebateRow) => Number(amounts[r.userId] ?? r.lastWeekRebate ?? 0);
  const shared = (r: RebateRow) => Number((entered(r) * shareRate).toFixed(2));

  // Optimistic: the row lands in the draft list immediately and the server
  // reply (which owns the share calculation) overwrites it when it arrives.
  const addToDraft = (r: RebateRow) => {
    const value = entered(r);
    if (!value) return;
    const optimistic: DraftRebate = {
      ...r, lastWeekRebate: value, sharedRebate: shared(r), actionDate: 'now',
    };
    setDraft((d) => [...d.filter((x) => x.userId !== r.userId), optimistic]);
    setCommitted({ userId: r.userId, delta: optimistic.sharedRebate });
    api.addRebateDraft(brokerId, r.userId, value)
      .then((saved) => setDraft((d) => d.map((x) => (x.userId === r.userId ? { ...r, ...saved } : x))))
      .catch(() => setDraft((d) => d.filter((x) => x.userId !== r.userId)));
  };

  const editDraft = (userId: string, value: number) => {
    setDraft((d) => d.map((x) => (x.userId === userId
      ? { ...x, lastWeekRebate: value, sharedRebate: Number((value * shareRate).toFixed(2)) }
      : x)));
    api.addRebateDraft(brokerId, userId, value).catch(() => {});
  };

  // The row that just committed, so it can arrive in the ledger rather than
  // simply appear, and the total can show what changed.
  const [committed, setCommitted] = useState<{ userId: string; delta: number } | null>(null);

  const removeDraft = (userId: string) => {
    setDraft((d) => d.filter((x) => x.userId !== userId));
    api.deleteRebateDraft(brokerId, userId).catch(() => {});
  };

  // Drafted rows are read-only by default; a row joins this set only when its
  // own pencil is clicked, never from clicking the row or the value.
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const toggleEdit = (userId: string) =>
    setEditingRows((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });

  const activeColumns: Column<RebateRow>[] = [
    { id: 'user', header: 'User', render: (r) => <UserCell name={r.name} sub={r.userId} plan={r.plan} /> },
    {
      id: 'email',
      header: 'Email Broker ID',
      render: (r) => <Cell2 top={<CopyValue value={r.email} label="email" />} bottom={<CopyValue value={r.brokerAccountId} label="broker ID" />} />,
    },
    { id: 'total', header: 'Total Rebate', align: 'right', render: (r) => fmtUsd(r.totalRebate), sort: (r) => r.totalRebate },
    {
      id: 'week',
      header: 'Last Week Rebate',
      align: 'center',
      width: 170,
      render: (r) => (
        <input
          className="a-input"
          type="number"
          step="0.01"
          min="0"
          value={amounts[r.userId] ?? (r.lastWeekRebate ?? '')}
          onChange={(e) => setAmounts((a) => ({ ...a, [r.userId]: e.target.value }))}
          style={{ height: 34, textAlign: 'center' }}
          aria-label={`Last week rebate for ${r.name}`}
        />
      ),
    },
    {
      id: 'shared',
      header: 'Shared Rebate',
      align: 'right',
      render: (r) => <span className={shared(r) ? 'at-neg' : undefined}>{fmtUsd(shared(r))}</span>,
    },
    {
      id: 'action',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          variant="success"
          disabled={!entered(r) || draft.some((d) => d.userId === r.userId)}
          onClick={() => addToDraft(r)}
        >
          {draft.some((d) => d.userId === r.userId) ? 'In draft' : 'Add to Draft'}
        </Button>
      ),
    },
  ];

  // Only the newest commit animates; re-rendering must not replay it for
  // every row already in the ledger.
  const draftColumns: Column<DraftRebate>[] = [
    {
      id: 'user',
      header: 'User',
      render: (r) => (
        <span className={committed?.userId === r.userId ? 'a-commit' : undefined} style={{ display: 'block' }}>
          <UserCell name={r.name} sub={r.userId} plan={r.plan} />
        </span>
      ),
    },
    {
      id: 'email',
      header: 'Email Broker ID',
      render: (r) => <Cell2 top={<CopyValue value={r.email} label="email" />} bottom={<CopyValue value={r.brokerAccountId} label="broker ID" />} />,
    },
    { id: 'total', header: 'Total Rebate', align: 'right', render: (r) => fmtUsd(r.totalRebate) },
    {
      id: 'week',
      header: 'Last Week Rebate',
      align: 'center',
      width: 170,
      // Read-only until the pencil is clicked — the row and the value itself
      // are not click targets, only the pencil opens the field.
      render: (r) => {
        const isEditing = editingRows.has(r.userId);
        return (
          <span className="a-row" style={{ gap: 6, justifyContent: 'center' }}>
            {isEditing ? (
              <input
                className="a-input"
                type="number"
                step="0.01"
                min="0"
                value={r.lastWeekRebate}
                onChange={(e) => editDraft(r.userId, Number(e.target.value) || 0)}
                style={{ height: 34, width: 100, textAlign: 'center' }}
                aria-label={`Draft rebate for ${r.name}`}
                autoFocus
              />
            ) : (
              <span>{fmtUsd(r.lastWeekRebate)}</span>
            )}
            <IconButton
              icon="pencil"
              label={isEditing ? `Stop editing draft rebate for ${r.name}` : `Edit draft rebate for ${r.name}`}
              size={15}
              onClick={() => toggleEdit(r.userId)}
            />
          </span>
        );
      },
    },
    { id: 'shared', header: 'Shared Rebate', align: 'right', render: (r) => <span className="at-neg">{fmtUsd(r.sharedRebate)}</span> },
    { id: 'date', header: 'Action date', align: 'right', render: (r) => <Cell2 top={r.actionDate.split(' · ')[0]} bottom={r.actionDate.split(' · ')[1]} /> },
    {
      id: 'delete',
      header: 'Action',
      align: 'right',
      render: (r) => (
        <Button size="sm" variant="ghost" icon="trash" onClick={() => removeDraft(r.userId)}>
          Delete
        </Button>
      ),
    },
  ];

  const total = draft.reduce((s, d) => s + d.sharedRebate, 0);

  return (
    <>
      <Card
        title={`All active users (${shownRows.length})`}
        subtitle={`Shared rebate is calculated at this broker's ${Math.round(shareRate * 100)}% share.`}
        flush
      >
        <DataTable
          columns={activeColumns}
          rows={shownRows}
          rowKey={(r) => r.userId}
          showIndex
          maxHeight={420}
          loading={loadedRows === undefined}
        />
      </Card>

      <Card
        title={`Draft Rebate List (${draft.length})`}
        flush
        actions={draft.length > 0 && (
          <Button
            variant="primary"
            icon="send"
            onClick={() => api.publishRebateDrafts(brokerId)
              .then(() => {
                setDraft([]);
                api.rebateRows(brokerId).then(setRowsOverride);
              })
              .catch(() => {})}
          >
            Publish draft
          </Button>
        )}
      >
        <DataTable
          columns={draftColumns}
          rows={draft}
          rowKey={(r) => r.userId}
          showIndex
          maxHeight={420}
          loading={loadedDrafts === undefined}
          empty={
            <EmptyState
              icon="file"
              title="No rebates drafted yet"
              hint="Enter a last-week rebate above, then add the user to this draft. Nothing is paid until you publish."
            />
          }
        />
        {draft.length > 0 && (
          <div className="a-row" style={{ padding: '12px 20px', borderTop: '1px solid var(--admin-hairline)' }}>
            <span className="at-13 at-muted">Payable to users</span>
            <span className="a-spacer a-total at-16 at-bold at-neg">
              {fmtUsd(total)}
              {/* Only the change is news — the total never counts up from zero. */}
              {committed && (
                <span key={committed.userId + committed.delta} className="a-total__delta">
                  +{fmtUsd(committed.delta)}
                </span>
              )}
            </span>
          </div>
        )}
      </Card>
    </>
  );
}

/* ---------------------------------------------------------------------
 * Manage user flow
 * ------------------------------------------------------------------- */

const FLOW_TABS: TabItem<FlowTab>[] = [
  { id: 'messages', label: 'Status message' },
  { id: 'preview', label: 'Broker preview' },
];

function ManageFlow({ brokerId }: { brokerId: string }) {
  const [tab, setTab] = useState<FlowTab>('messages');
  return (
    <>
      <Tabs items={FLOW_TABS} value={tab} onChange={setTab} sub />
      {tab === 'messages' ? <StatusMessages brokerId={brokerId} /> : <BrokerPreviewForm brokerId={brokerId} />}
    </>
  );
}

const FLOW_MARK: Record<string, { icon: 'x-circle' | 'clock' | 'check-circle'; color: string }> = {
  rejected: { icon: 'x-circle', color: '#ef4444' },
  'waiting-deposit': { icon: 'clock', color: '#f59e0b' },
  'rejected-deposit': { icon: 'x-circle', color: '#ef4444' },
  approved: { icon: 'check-circle', color: '#16a34a' },
};

function StatusMessages({ brokerId }: { brokerId: string }) {
  const loaded = useAsync(() => api.flowMessages(brokerId), [brokerId]) ?? [];
  const [messages, setMessages] = useState<FlowMessage[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const list = messages ?? loaded;

  const save = (key: string) => {
    const message = drafts[key] ?? list.find((m) => m.key === key)?.message ?? '';
    const prev = list;
    setMessages(list.map((m) => (m.key === key ? { ...m, message } : m)));
    setEditing(null);
    // Roll back on failure — otherwise the edited text stays on screen looking
    // saved when the server never got it.
    api.saveFlowMessage(brokerId, key, message).catch(() => setMessages(prev));
  };

  return (
    <Card flush>
      {list.map((m) => {
        const mark = FLOW_MARK[m.key];
        const isEditing = editing === m.key;
        return (
          <div key={m.key} className="a-flowrow">
            <div className="a-flowrow__meta">
              <span className="a-flowrow__mark" style={{ background: mark.color }}>
                <Icon name={mark.icon} size={22} />
              </span>
              <div>
                <div className="at-20 at-semibold">{m.title}</div>
                <div className="at-13 at-muted">{m.from}</div>
                <div style={{ marginTop: 8 }}><StatusChip status={m.chip} /></div>
              </div>
            </div>

            <Field label="Message Text" style={{ flex: 1 }}>
              {isEditing ? (
                <RichText
                  value={drafts[m.key] ?? m.message}
                  onChange={(v) => setDrafts((d) => ({ ...d, [m.key]: v }))}
                />
              ) : (
                <div
                  className="a-rte__area"
                  style={{ border: '1px solid var(--admin-border)', borderRadius: 'var(--r-sm)' }}
                  dangerouslySetInnerHTML={{ __html: m.message }}
                />
              )}
            </Field>

            <div className="a-row" style={{ alignSelf: 'flex-end', gap: 8 }}>
              {isEditing ? (
                <>
                  <Button icon="close" onClick={() => setEditing(null)}>Cancel</Button>
                  <Button variant="primary" icon="check" onClick={() => save(m.key)}>Save</Button>
                </>
              ) : (
                <Button variant="outline" icon="pencil" onClick={() => setEditing(m.key)}>Edit</Button>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

function BrokerPreviewForm({ brokerId }: { brokerId: string }) {
  const loaded = useAsync(() => api.brokerPreview(brokerId), [brokerId]);
  const [form, setForm] = useState<BrokerPreview | undefined>(undefined);
  // The values this form last hydrated from — the initial load, or the last
  // successful save. Dirtiness and Cancel both compare against this rather
  // than `loaded`, which never updates once the fetch has resolved.
  const [baseline, setBaseline] = useState<BrokerPreview | undefined>(undefined);
  const [error, setError] = useState('');
  const [confirmSave, setConfirmSave] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  if (!loaded) return null;

  const state = form ?? loaded;
  const hydrated = baseline ?? loaded;
  const dirty = JSON.stringify(state) !== JSON.stringify(hydrated);
  const discard = () => setForm(hydrated);
  const incomplete = badgeIncomplete(state);

  return (
    <>
      <header>
        <h2 className="a-pagehead__title">Broker preview</h2>
        <p className="a-pagehead__sub">Review and update the information shown to users.</p>
      </header>

      <BrokerForm
        value={state}
        onChange={setForm}
        footer={(
          <div className="a-row">
            {error && <span className="at-13 at-neg" role="alert">{error}</span>}
            {!error && incomplete && (
              <span className="at-13 at-neg" role="alert">A badge needs text and a colour.</span>
            )}
            <span className="a-spacer" />
            <Button variant="ghost" onClick={() => (dirty ? setConfirmLeave(true) : discard())}>Cancel</Button>
            <Button variant="primary" disabled={incomplete} onClick={() => setConfirmSave(true)}>Save changes</Button>
          </div>
        )}
      />

      <AnimatePresence>
        {confirmLeave && (
          <Confirm
            title="Unsaved changes"
            message="You have unsaved changes. Are you sure you want to leave without saving?"
            confirmLabel="Leave without saving"
            cancelLabel="Keep editing"
            danger
            onCancel={() => setConfirmLeave(false)}
            onConfirm={() => { setConfirmLeave(false); discard(); }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {confirmSave && (
          <Confirm
            title="Save changes"
            message="Are you sure you want to save the changes to this broker?"
            confirmLabel="Save changes"
            onCancel={() => setConfirmSave(false)}
            onConfirm={() => {
              setConfirmSave(false);
              setError('');
              api.saveBrokerPreview(brokerId, state)
                .then(() => setBaseline(state))
                .catch(() => setError('Could not save. Try again.'));
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
