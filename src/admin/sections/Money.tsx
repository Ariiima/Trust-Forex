/**
 * Money in and money out.
 *
 * The dashboard had six sections and no window onto the thing all of them are
 * ultimately about: what was paid to us, and what we owe. Both tables read the
 * same ledger and `orders` table the rest of the product books against, so
 * nothing here is a separate set of numbers that can drift.
 */
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  api, type OpenOrder, type PaymentRow, type UnmatchedReason, type UnmatchedTx, type WithdrawalRow,
} from '../data';
import { useAsync } from '../useAsync';
import {
  Button, Card, Cell2, Chip, CopyValue, EmptyState, Field, Modal, Money as Amount,
  Readings, Reading, SearchInput, Select, Skeleton, StatusChip, Tabs, UserCell, fmtNum, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

type Tab = 'in' | 'out' | 'unmatched';

const PAYMENT_COLUMNS: Column<PaymentRow>[] = [
  {
    id: 'id',
    header: 'Order',
    width: 200,
    /* The order is the row; its buyer is the line under it — by account
       number, the one user identifier the dashboard shows. */
    render: (p) => (
      <Cell2
        top={p.id}
        bottom={p.userId != null
          ? <Link to={`/users/tg${p.userId}`} className="a-userlink" target="_blank" rel="noreferrer">{p.userNo != null ? `#${p.userNo}` : (p.username ?? '—')}</Link>
          : (p.username ?? '—')}
      />
    ),
  },
  { id: 'plan', header: 'Plan', width: 100, render: (p) => p.planId },
  {
    id: 'amount',
    header: 'Amount',
    align: 'right',
    width: 120,
    sort: (p: PaymentRow) => p.amountUsd,
    render: (p) => <Amount value={p.amountUsd} />,
  },
  {
    id: 'currency',
    header: 'Paid in',
    width: 140,
    render: (p) => (p.currency ? <Cell2 top={p.currency} bottom={p.network ?? undefined} /> : <span className="at-muted">—</span>),
  },
  { id: 'status', header: 'Status', width: 120, render: (p) => <StatusChip status={p.status} /> },
  {
    id: 'confirmed',
    header: 'Confirmed',
    width: 170,
    render: (p) => (p.confirmedAt
      ? <Cell2 top={p.confirmedAt.split(' · ')[0]} bottom={p.confirmedAt.split(' · ')[1]} />
      : <span className="at-muted">—</span>),
  },
  {
    id: 'booked',
    header: 'In the books',
    width: 130,
    /* A confirmed payment that is not booked means the ledger has not credited
       the subscription — the hourly job catches up, so this only ever shows
       "Pending" for a few minutes. If one sticks, that is the alarm. */
    render: (p) => (p.status !== 'confirmed'
      ? <span className="at-muted">—</span>
      : p.booked ? <Chip tone="success">Booked</Chip> : <Chip tone="warn">Pending</Chip>),
  },
];

/* Why the watcher escalated, in the operator's words rather than the code's. */
const REASONS: Record<UnmatchedReason, { label: string; hint: string }> = {
  ambiguous: {
    label: 'Two orders live',
    hint: 'A wrong amount arrived while more than one order was waiting on this wallet. The amount is the only identity a payment carries, so only a human can say whose it is.',
  },
  no_live_order: {
    label: 'No order waiting',
    hint: 'Nothing was open on this wallet when it landed — a late payment on an expired order, or a deposit that has nothing to do with us.',
  },
  predates_order: {
    label: 'Older than the order',
    hint: 'It arrived before the only open order was created, so it cannot be that order’s payment.',
  },
  too_large: {
    label: 'Too large',
    hint: 'More than 3× what the open order is due — treated as an unrelated deposit rather than a payment attempt.',
  },
};

const shortAddr = (a: string | null) => (a && a.length > 18 ? `${a.slice(0, 8)}…${a.slice(-6)}` : a ?? '—');
const stamp = (ms: number) => new Date(ms).toISOString().slice(0, 16).replace('T', ' · ');

/**
 * The watcher's escalation queue. A transfer only lands here because attributing
 * it automatically would have been a guess, and a wrong guess pays one user's
 * money into another user's order — so the fix is a human, not a heuristic.
 */
function UnmatchedTab({ search }: { search: string }) {
  const [reload, setReload] = useState(0);
  const loaded = useAsync(api.unmatched, [reload]);
  const [picking, setPicking] = useState<UnmatchedTx | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const transfers = loaded?.transfers ?? [];
  const q = search.trim().toLowerCase();
  const shown = q
    ? transfers.filter((t) => `${t.txid} ${t.sender ?? ''} ${t.amount} ${t.currency ?? ''}`.toLowerCase().includes(q))
    : transfers;

  const ignore = async (t: UnmatchedTx) => {
    setBusy(t.txid);
    try {
      await api.ignoreUnmatched(t.txid);
      setReload((n) => n + 1);
    } catch {
      window.alert('Could not dismiss this transfer — try again.');
    } finally {
      setBusy(null);
    }
  };

  const columns: Column<UnmatchedTx>[] = [
    {
      id: 'at',
      header: 'Arrived',
      width: 150,
      sort: (t: UnmatchedTx) => t.at,
      render: (t) => <Cell2 top={stamp(t.at).split(' · ')[0]} bottom={stamp(t.at).split(' · ')[1]} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      width: 160,
      render: (t) => <Cell2 top={`${t.amount} ${t.currency ?? ''}`} bottom={t.network ?? t.chain} />,
    },
    {
      id: 'sender',
      /* Shown because it is the only other thing on the transfer, NOT because
         it identifies anyone — exchange withdrawals all share one hot wallet. */
      header: 'From',
      width: 170,
      render: (t) => <span className="at-muted" title={t.sender ?? ''}>{shortAddr(t.sender)}</span>,
    },
    {
      id: 'txid',
      header: 'Transaction',
      width: 170,
      render: (t) => <CopyValue value={t.txid} label="transaction id" display={shortAddr(t.txid)} />,
    },
    {
      id: 'reason',
      header: 'Why',
      width: 150,
      render: (t) => (
        <span title={REASONS[t.reason]?.hint}>
          <Chip tone={t.reason === 'ambiguous' ? 'warn' : 'neutral'}>
            {REASONS[t.reason]?.label ?? t.reason}
          </Chip>
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: 210,
      render: (t) => {
        if (t.resolution === 'attributed') {
          return <Cell2 top={<Chip tone="success">Attributed</Chip>} bottom={`${t.orderId} · ${t.resolvedBy ?? ''}`} />;
        }
        if (t.resolution === 'ignored') {
          return <Cell2 top={<span className="at-muted">Dismissed</span>} bottom={t.resolvedBy ?? ''} />;
        }
        return (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Button size="sm" variant="success" onClick={() => setPicking(t)}>Attribute</Button>
            <Button size="sm" variant="ghost" disabled={busy === t.txid} onClick={() => ignore(t)}>
              {busy === t.txid ? '…' : 'Not a payment'}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        rows={shown}
        columns={columns}
        rowKey={(t) => t.txid}
        loading={loaded === undefined}
        empty={(
          <EmptyState
            icon="file"
            title="Nothing needs a decision"
            hint="Transfers the watcher could not attribute on its own appear here."
          />
        )}
      />
      {picking && (
        <AttributeModal
          tx={picking}
          orders={loaded?.openOrders ?? []}
          onClose={() => setPicking(null)}
          onDone={() => { setPicking(null); setReload((n) => n + 1); }}
        />
      )}
    </>
  );
}

/* Only orders on the SAME (currency, network) are offered — the server refuses
   anything else, because crediting a TRON transfer to an ERC-20 order books
   money that never reached that order's address. */
function AttributeModal({
  tx, orders, onClose, onDone,
}: { tx: UnmatchedTx; orders: OpenOrder[]; onClose: () => void; onDone: () => void }) {
  const eligible = orders.filter((o) => o.currency === tx.currency && o.network === tx.network);
  const [orderId, setOrderId] = useState(eligible[0]?.id ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const picked = eligible.find((o) => o.id === orderId);

  const submit = async () => {
    if (!orderId) return;
    setSaving(true);
    setError('');
    try {
      const { result } = await api.attributeUnmatched(tx.txid, orderId);
      window.alert(result === 'confirmed'
        ? `Order ${orderId} is now confirmed — the buyer has been notified.`
        : `Booked against ${orderId}. It is still short, so the buyer got the "payment incomplete" message.`);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not attribute this transfer.');
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Attribute this payment"
      subtitle={`${tx.amount} ${tx.currency ?? ''} on ${tx.network ?? tx.chain}`}
      onClose={onClose}
      footer={(
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="success" disabled={!orderId || saving} onClick={submit}>
            {saving ? 'Booking…' : 'Book it'}
          </Button>
        </>
      )}
    >
      {eligible.length === 0 ? (
        <p className="at-muted">
          No open order on {tx.currency} {tx.network} to attribute it to. If the buyer's order has
          already expired, they need to start a new one — this transfer can be dismissed and refunded by hand.
        </p>
      ) : (
        <>
          <Field
            label="Order"
            hint="Only orders still open on this currency and network can take it."
          >
            <Select
              value={orderId}
              onChange={setOrderId}
              options={eligible.map((o) => ({
                value: o.id,
                label: `${o.id} · ${o.username ?? '—'} · ${o.planId} · due ${o.amountCrypto} ${o.currency}`,
              }))}
            />
          </Field>
          {picked && (
            <p className="at-muted" style={{ marginTop: 12 }}>
              Books {tx.amount} {tx.currency} against a {picked.amountCrypto} {picked.currency} invoice.
              {picked.paidUnits ? ' This order has already received a partial payment, which is added to this one.' : ''}
              {' '}It confirms if the total covers the invoice, otherwise the buyer is told what is still owed.
            </p>
          )}
          {error && <p style={{ color: 'var(--loss)', marginTop: 12 }}>{error}</p>}
        </>
      )}
    </Modal>
  );
}

export default function MoneySection() {
  // ?tab= so Notifications can land on the queue it is pointing at.
  const wanted = new URLSearchParams(useLocation().search).get('tab');
  const [tab, setTab] = useState<Tab>(wanted === 'out' || wanted === 'unmatched' ? wanted : 'in');
  const [search, setSearch] = useState('');
  // Counted on the shell so the tab carries its own badge — an unattributed
  // transfer is money sitting in the wallet against nobody's order.
  const loadedUnmatched = useAsync(api.unmatched);
  const pending = (loadedUnmatched?.transfers ?? []).filter((t) => !t.resolution).length;
  // Same counts the sidebar wears, so the tab that is waiting says so.
  const alerts = useAsync(api.alerts);
  const TABS: TabItem<Tab>[] = [
    { id: 'in', label: 'Payments in' },
    { id: 'out', label: 'Withdrawals', count: alerts?.withdrawals || undefined, alert: true },
    { id: 'unmatched', label: 'Unmatched', count: pending || undefined, alert: true },
  ];
  const [reloadPayments, setReloadPayments] = useState(0);
  const loadedPayments = useAsync(api.payments, [reloadPayments]);
  const loadedWithdrawals = useAsync(api.withdrawals);
  const payments = loadedPayments ?? [];
  // No hot wallet is configured yet, so every withdrawal lands here for a
  // human to pay by hand — this overlay is the only way the table (and the
  // "Withdrawn to date" reading below) learns about it without a reload.
  const [sentOverride, setSentOverride] = useState<Record<string, WithdrawalRow>>({});
  const [markingSent, setMarkingSent] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const withdrawals = (loadedWithdrawals ?? []).map((w) => sentOverride[w.id] ?? w);
  // Both ledgers feed every reading below, so the strip waits on both —
  // showing income before withdrawals have landed would read as final.
  const loading = loadedPayments === undefined || loadedWithdrawals === undefined;

  const confirmed = payments.filter((p) => p.status === 'confirmed');
  const income = confirmed.reduce((s, p) => s + p.amountUsd, 0);
  // Only count money that has actually left — a queued/manual row is a
  // liability, not yet a payment made.
  const owed = withdrawals.filter((w) => w.status === 'sent').reduce((s, w) => s + w.amount, 0);
  const unbooked = confirmed.filter((p) => !p.booked).length;

  /* Money that arrived where the watcher can't see it — a chain we don't poll,
     or a transfer that never landed. Settles through the same path as a
     watched payment: plan credited, DM sent, invite issued. */
  const [confirming, setConfirming] = useState<string | null>(null);
  const confirmByHand = async (p: PaymentRow) => {
    if (!window.confirm(
      `Confirm order ${p.id} ($${p.amountUsd.toFixed(2)}) as paid?\n\nThe buyer gets their plan and the confirmation message immediately. There is no undo.`,
    )) return;
    setConfirming(p.id);
    try {
      await api.confirmPayment(p.id);
      setReloadPayments((n) => n + 1);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not confirm this order.');
    } finally {
      setConfirming(null);
    }
  };
  const paymentColumns: Column<PaymentRow>[] = [
    ...PAYMENT_COLUMNS,
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: 140,
      render: (p) => (['pending', 'submitted'].includes(p.status) ? (
        <Button size="sm" variant="success" disabled={confirming === p.id} onClick={() => confirmByHand(p)}>
          {confirming === p.id ? 'Confirming…' : 'Confirm paid'}
        </Button>
      ) : <span className="at-muted">—</span>),
    },
  ];

  const markSent = async (w: WithdrawalRow) => {
    if (!window.confirm(`Mark ${w.currency} ${w.network} $${w.amount.toFixed(2)} to ${w.address} as sent?`)) return;
    setMarkingSent(w.id);
    try {
      const { withdrawal } = await api.markWithdrawalSent(w.id);
      setSentOverride((o) => ({ ...o, [w.id]: withdrawal }));
    } catch {
      window.alert('Could not mark this withdrawal as sent — try again.');
    } finally {
      setMarkingSent(null);
    }
  };

  /* Reason is typed here and quoted verbatim in the bot's rejection DM, so an
     empty one is refused rather than sent as "Reason: ". ponytail: window
     .prompt — same weight as the confirm() next to it; a modal when the copy
     needs formatting. */
  const reject = async (w: WithdrawalRow) => {
    const reason = window.prompt(`Reject $${w.amount.toFixed(2)} to ${w.address}?\n\nThe amount goes back to the user's earning balance and they are told why:`)?.trim();
    if (!reason) return;
    setRejecting(w.id);
    try {
      const { withdrawal } = await api.rejectWithdrawal(w.id, reason);
      setSentOverride((o) => ({ ...o, [w.id]: withdrawal }));
    } catch {
      window.alert('Could not reject this withdrawal — try again.');
    } finally {
      setRejecting(null);
    }
  };

  const WITHDRAWAL_COLUMNS: Column<WithdrawalRow>[] = [
    {
      id: 'user',
      header: 'User',
      width: 200,
      render: (w) => <UserCell name={w.name ?? '—'} userNo={w.userNo} userId={w.userId} />,
    },
    {
      id: 'at',
      header: 'Requested',
      width: 150,
      render: (w) => <Cell2 top={w.at.split(' · ')[0]} bottom={w.at.split(' · ')[1]} />,
    },
    {
      id: 'destination',
      header: 'Destination',
      render: (w) => <Cell2 top={`${w.currency} · ${w.network}`} bottom={w.address} />,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'right',
      width: 110,
      sort: (w: WithdrawalRow) => w.amount,
      render: (w) => <Amount value={w.amount} />,
    },
    { id: 'status', header: 'Status', width: 110, render: (w) => <StatusChip status={w.status} /> },
    {
      id: 'actions',
      header: 'Actions',
      align: 'right',
      width: 220,
      render: (w) => (w.status === 'sent' ? <span className="at-muted">Sent</span>
        : w.status === 'refunded' ? <span className="at-muted">Rejected</span> : (
          <div className="a-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
            <Button size="sm" variant="ghost" disabled={rejecting === w.id} onClick={() => reject(w)}>
              {rejecting === w.id ? 'Rejecting…' : 'Reject'}
            </Button>
            <Button size="sm" variant="success" disabled={markingSent === w.id} onClick={() => markSent(w)}>
              {markingSent === w.id ? 'Marking…' : 'Mark as sent'}
            </Button>
          </div>
        )),
    },
  ];

  const q = search.trim().toLowerCase();
  const shownPayments = q
    ? payments.filter((p) => `${p.id} ${p.username ?? ''} ${p.planId} ${p.txid ?? ''}`.toLowerCase().includes(q))
    : payments;
  const shownWithdrawals = q
    ? withdrawals.filter((w) => `${w.name ?? ''} ${w.userId} ${w.currency} ${w.network} ${w.address}`.toLowerCase().includes(q))
    : withdrawals;

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Money</h1>
          <p className="a-pagehead__sub">
            Confirmed subscription payments in, and the payout worklist out. No hot wallet is
            configured yet, so every withdrawal is paid by hand — mark it sent once it's done.
          </p>
        </div>
      </header>

      <Readings>
        <Reading label="Subscription income" value={loading ? <Skeleton width={64} height={22} /> : <Amount value={income} />} />
        <Reading label="Confirmed payments" value={loading ? <Skeleton width={36} height={22} /> : fmtNum(confirmed.length)} />
        <Reading label="Withdrawn to date" value={loading ? <Skeleton width={64} height={22} /> : <Amount value={owed} />} />
        <Reading
          label="Awaiting booking"
          value={loading ? <Skeleton width={28} height={22} /> : fmtNum(unbooked)}
          hint={loading ? undefined : (unbooked ? 'The hourly job books these' : 'All caught up')}
        />
        <Reading
          label="Needs a decision"
          value={loadedUnmatched === undefined ? <Skeleton width={28} height={22} /> : fmtNum(pending)}
          hint={loadedUnmatched === undefined ? undefined : (pending ? 'Money in the wallet against no order' : 'Nothing unattributed')}
        />
      </Readings>

      <Card
        flush
        actions={(
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              tab === 'in' ? 'Search order, user or txid'
                : tab === 'out' ? 'Search user or destination'
                  : 'Search txid, sender or amount'
            }
          />
        )}
        title={<Tabs items={TABS} value={tab} onChange={setTab} />}
      >
        {tab === 'in' && (
          <DataTable
            rows={shownPayments}
            columns={paymentColumns}
            rowKey={(p) => p.id}
            loading={loadedPayments === undefined}
            empty={<EmptyState icon="file" title="No payments yet" hint="Confirmed orders appear here as the watcher settles them." />}
          />
        )}
        {tab === 'out' && (
          <DataTable
            rows={shownWithdrawals}
            columns={WITHDRAWAL_COLUMNS}
            rowKey={(w) => w.id}
            loading={loadedWithdrawals === undefined}
            empty={<EmptyState icon="file" title="Nothing to pay out" hint="Withdrawal requests from the Earnings tab land here." />}
          />
        )}
        {tab === 'unmatched' && <UnmatchedTab search={search} />}
      </Card>
    </>
  );
}
