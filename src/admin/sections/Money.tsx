/**
 * Money in and money out.
 *
 * The dashboard had six sections and no window onto the thing all of them are
 * ultimately about: what was paid to us, and what we owe. Both tables read the
 * same ledger and `orders` table the rest of the product books against, so
 * nothing here is a separate set of numbers that can drift.
 */
import { useState } from 'react';
import { api, type PaymentRow, type WithdrawalRow } from '../data';
import { useAsync } from '../useAsync';
import {
  Button, Card, Cell2, Chip, EmptyState, Money as Amount, Readings, Reading, SearchInput,
  Skeleton, StatusChip, Tabs, fmtNum, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

type Tab = 'in' | 'out';

const TABS: TabItem<Tab>[] = [
  { id: 'in', label: 'Payments in' },
  { id: 'out', label: 'Withdrawals' },
];

const PAYMENT_COLUMNS: Column<PaymentRow>[] = [
  {
    id: 'id',
    header: 'Order',
    width: 200,
    render: (p) => <Cell2 top={p.id} bottom={p.username ?? (p.userId != null ? `tg${p.userId}` : '—')} />,
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

export default function MoneySection() {
  const [tab, setTab] = useState<Tab>('in');
  const [search, setSearch] = useState('');
  const loadedPayments = useAsync(api.payments);
  const loadedWithdrawals = useAsync(api.withdrawals);
  const payments = loadedPayments ?? [];
  // No hot wallet is configured yet, so every withdrawal lands here for a
  // human to pay by hand — this overlay is the only way the table (and the
  // "Withdrawn to date" reading below) learns about it without a reload.
  const [sentOverride, setSentOverride] = useState<Record<string, WithdrawalRow>>({});
  const [markingSent, setMarkingSent] = useState<string | null>(null);
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

  const markSent = async (w: WithdrawalRow) => {
    const txid = window.prompt(`Mark ${w.currency} ${w.network} $${w.amount.toFixed(2)} to ${w.address} as sent.\n\nTransaction ID (optional):`);
    if (txid === null) return; // cancelled
    setMarkingSent(w.id);
    try {
      const { withdrawal } = await api.markWithdrawalSent(w.id, txid.trim());
      setSentOverride((o) => ({ ...o, [w.id]: withdrawal }));
    } catch {
      window.alert('Could not mark this withdrawal as sent — try again.');
    } finally {
      setMarkingSent(null);
    }
  };

  const WITHDRAWAL_COLUMNS: Column<WithdrawalRow>[] = [
    {
      id: 'user',
      header: 'User',
      width: 200,
      render: (w) => <Cell2 top={w.name ?? w.userId} bottom={w.userId} />,
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
      width: 160,
      render: (w) => (w.status === 'sent' ? (
        <span className="at-muted">{w.txid ?? '—'}</span>
      ) : (
        <Button size="sm" variant="success" disabled={markingSent === w.id} onClick={() => markSent(w)}>
          {markingSent === w.id ? 'Marking…' : 'Mark as sent'}
        </Button>
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
      </Readings>

      <Card
        flush
        actions={(
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={tab === 'in' ? 'Search order, user or txid' : 'Search user or destination'}
          />
        )}
        title={<Tabs items={TABS} value={tab} onChange={setTab} />}
      >
        {tab === 'in' ? (
          <DataTable
            rows={shownPayments}
            columns={PAYMENT_COLUMNS}
            rowKey={(p) => p.id}
            loading={loadedPayments === undefined}
            empty={<EmptyState icon="file" title="No payments yet" hint="Confirmed orders appear here as the watcher settles them." />}
          />
        ) : (
          <DataTable
            rows={shownWithdrawals}
            columns={WITHDRAWAL_COLUMNS}
            rowKey={(w) => w.id}
            loading={loadedWithdrawals === undefined}
            empty={<EmptyState icon="file" title="Nothing to pay out" hint="Withdrawal requests from the Earnings tab land here." />}
          />
        )}
      </Card>
    </>
  );
}
