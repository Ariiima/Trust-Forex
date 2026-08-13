import { useState } from 'react';
import {
  api, type CampaignStatus, type Grain, type ReferralCampaign, type ReferralRow,
} from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, BrokerLogo, Button, Card, Cell2, Checkbox, ColorSwatches, Confirm, DateInput,
  EmptyState, Field, Icon, MultiSelect, PlanGlyph, Select, StatusChip,
  Sweep, Tabs, TextInput, DragList, fmtNum, fmtPct, fmtUsd, type TabItem,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';
import { LineChart, type Series } from '../ui/Chart';

type Tab = 'overview' | 'campaigns';

const TABS: TabItem<Tab>[] = [
  { id: 'overview', label: 'Referral overview' },
  { id: 'campaigns', label: 'Referral campaign overview' },
];

/* The funnel, in the order it happens. Introduced users are the referrers —
   accounts whose own link has brought in at least one person. Invited users
   are everyone those referrers brought in, so it is always the larger number.
   Active users are the invited accounts that actually activated, and the Plan
   and Cashback rates are shares of THOSE — an account that never activated
   could not have bought a plan. */
const SERIES: Series[] = [
  { key: 'introduced', label: 'Introduced Users', axis: 'count' },
  { key: 'invited', label: 'Invited Users', axis: 'count' },
  { key: 'activeUsers', label: 'Active Users', axis: 'count' },
  { key: 'planRate', label: 'Plan (% of active)', axis: 'rate', style: 'dashed' },
  { key: 'cashbackRate', label: 'Cashback (% of active)', axis: 'rate', style: 'dotted' },
  { key: 'revenue', label: 'Revenue', axis: 'usd' },
  { key: 'revenueShared', label: 'Revenue Shared', axis: 'usd', style: 'dashed' },
  { key: 'revenueNet', label: 'Revenue Net', axis: 'usd', style: 'dotted' },
];

/* Daily is gone: referral movement is not legible day to day, and the payout
   that matters lands per cashback cycle. `all` is the whole programme —
   campaigns plus organic — and is its own dimension, never a select-all. */
const REFERRAL_GRAINS: { value: Grain; label: string }[] = [
  { value: 'cycle', label: 'Cyclically' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const ALL_REFERRALS = 'all';

export default function Referral() {
  const [tab, setTab] = useState<Tab>('overview');
  // null = closed, '' = creating, an id = editing that campaign.
  const [editing, setEditing] = useState<string | null>(null);

  if (editing !== null) {
    return <CreateCampaign campaignId={editing || undefined} onBack={() => setEditing(null)} />;
  }

  return (
    <>
      <header className="a-pagehead">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </header>
      <Sweep key={tab}>
        {tab === 'overview'
          ? <Overview />
          : <CampaignOverview onCreate={() => setEditing('')} onEdit={setEditing} />}
      </Sweep>
    </>
  );
}

/* ---------------------------------------------------------------------
 * Overview
 * ------------------------------------------------------------------- */

function Overview() {
  const loadedRows = useAsync(api.referralRows);
  const rows = loadedRows ?? [];
  const campaigns = useAsync(api.referralCampaigns) ?? [];
  /* "All referrals" is a dimension like any other, not a select-all: it is the
     whole programme including referrals that never came through a campaign, so
     it can be the only thing on screen while every campaign is unticked. */
  const [selected, setSelected] = useState<string[]>([ALL_REFERRALS]);
  const [grain, setGrain] = useState<Grain>('cycle');

  const dims = [
    { value: ALL_REFERRALS, label: 'All referrals' },
    ...campaigns.map((c) => ({ value: c.id, label: c.name })),
  ];

  // An empty selection means "no dimensions", which the series API would read
  // as "every dimension" — so it is held back rather than plotted as a total.
  const data = useAsync(
    () => (selected.length ? api.series('referral', { dims: selected, grain }) : Promise.resolve([])),
    [selected.join(','), grain],
  );



  const columns: Column<ReferralRow>[] = [
    { id: 'user', header: 'User', render: (r) => <UserWithPlan row={r} />, sort: (r) => r.name },
    { id: 'invited', header: 'Invited Users', align: 'right', render: (r) => fmtNum(r.invited), sort: (r) => r.invited },
    {
      id: 'plan',
      header: 'Plan',
      align: 'center',
      render: (r) => <Cell2 top={<b>{r.planCount}</b>} bottom={fmtPct(r.planPct)} />,
      sort: (r) => r.planCount,
    },
    {
      id: 'cashback',
      header: 'Cashback',
      align: 'center',
      render: (r) => <Cell2 top={<b>{r.cashbackCount}</b>} bottom={fmtPct(r.cashbackPct)} />,
      sort: (r) => r.cashbackCount,
    },
    { id: 'revenue', header: 'Revenue', align: 'right', render: (r) => fmtUsd(r.revenue), sort: (r) => r.revenue },
    { id: 'shared', header: 'Revenue Shared', align: 'right', render: (r) => <span className="at-neg">-{fmtUsd(Math.abs(r.revenueShared))}</span>, sort: (r) => r.revenueShared },
    { id: 'net', header: 'Revenue Net', align: 'right', render: (r) => <span className="at-pos">{fmtUsd(r.revenueNet)}</span>, sort: (r) => r.revenueNet },
  ];

  return (
    <>
      <Card
        title="Referral Growth"
        actions={
          <>
            <MultiSelect
              label="Sources"
              options={dims}
              value={selected}
              onChange={setSelected}
              searchable={false}
              selectAll={false}
            />
            <Select value={grain} onChange={setGrain} options={REFERRAL_GRAINS} style={{ width: 140 }} />
          </>
        }
      >
        {selected.length ? (
          <LineChart data={data ?? []} series={SERIES} xKey="label" height={360} loading={!data} />
        ) : (
          <EmptyState
            icon="chart"
            title="Nothing selected"
            hint="Tick All referrals, or one or more campaigns, to plot them."
          />
        )}
      </Card>

      <Card title="All Referrals" flush>
        <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} showIndex loading={loadedRows === undefined} />
      </Card>
    </>
  );
}

/** Name over the account number — the number belongs to the user, not to a
 *  column of its own, and an operator reads the two together. */
function UserWithPlan({ row }: { row: ReferralRow }) {
  return (
    <span className="a-user">
      <PlanGlyph plan={row.plan} />
      <span className="a-cell2">
        <span className="at-semibold">{row.name}</span>
        <span>{row.userNo != null ? `#${row.userNo}` : '—'}</span>
      </span>
    </span>
  );
}

/* ---------------------------------------------------------------------
 * Campaign overview
 * ------------------------------------------------------------------- */

function CampaignOverview({
  onCreate, onEdit,
}: { onCreate: () => void; onEdit: (id: string) => void }) {
  const loaded = useAsync(api.referralCampaigns);
  const [edited, setEdited] = useState<ReferralCampaign[] | null>(null);
  const campaigns = edited ?? loaded ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = campaigns.find((c) => c.id === selectedId) ?? campaigns[0];
  // Which status change is awaiting confirmation. Pause and Stop both change
  // what happens to people clicking a live link, so neither fires on one click.
  const [confirming, setConfirming] = useState<'paused' | 'ended' | null>(null);

  const setStatus = (id: string, status: CampaignStatus) => {
    setEdited(campaigns.map((c) => (c.id === id ? { ...c, status } : c)));
    api.setReferralCampaignStatus(id, status).catch(() => setEdited(campaigns));
  };

  const columns: Column<ReferralCampaign>[] = [
    /* Capped, and allowed to wrap: "Black Friday Website Campaign" otherwise
       stretches this column until the money columns fall off the plate. */
    {
      id: 'name',
      header: 'Campaign',
      width: 190,
      render: (c) => <b className="a-campaignname">{c.name}</b>,
      sort: (c) => c.name,
    },
    /* Both hold short fixed-shape values — a status chip and a 5-digit code —
       so they are sized to their content rather than sharing the slack the
       money columns need. */
    { id: 'status', header: 'Status', width: 92, render: (c) => <StatusChip status={c.status} /> },
    { id: 'code', header: 'Link Code', width: 96, render: (c) => (c.linkCode ? <span style={{ color: 'var(--primary-colors-900)' }}>{c.linkCode}</span> : <span className="at-muted">—</span>) },
    { id: 'invited', header: 'Invited', group: 'Referral Activity', align: 'right', render: (c) => fmtNum(c.invited), sort: (c) => c.invited },
    {
      id: 'plan',
      header: 'Plan',
      group: 'Referral Activity',
      align: 'center',
      render: (c) => <Cell2 top={<b>{c.planCount} ({c.planTotal})</b>} bottom={fmtPct((c.planCount / c.planTotal) * 100)} />,
    },
    {
      id: 'cashback',
      header: 'Cashback',
      group: 'Referral Activity',
      align: 'center',
      render: (c) => <Cell2 top={<b>{c.cashbackCount} ({c.cashbackTotal})</b>} bottom={fmtPct((c.cashbackCount / c.cashbackTotal) * 100)} />,
    },
    { id: 'revenue', header: 'Revenue', group: 'Revenue Activity', align: 'right', render: (c) => fmtUsd(c.revenue), sort: (c) => c.revenue },
    { id: 'shared', header: 'Revenue Shared', group: 'Revenue Activity', align: 'right', render: (c) => <span className="at-neg">-{fmtUsd(Math.abs(c.revenueShared))}</span> },
    { id: 'net', header: 'Revenue Net', group: 'Revenue Activity', align: 'right', render: (c) => <span className="at-pos">{fmtUsd(c.revenueNet)}</span> },
    { id: 'planShare', header: 'Plan', group: 'Share Percentage', align: 'center', render: (c) => `${c.planShare}%` },
    { id: 'cbShare', header: 'Cashback', group: 'Share Percentage', align: 'center', render: (c) => `${c.cashbackShare}%` },
  ];

  return (
    <div className="a-split">
      <Card
        title="Referral Campaigns"
        flush
        actions={<Button variant="primary" icon="plus" onClick={onCreate}>Create New Campaign</Button>}
      >
        <DataTable
          columns={columns}
          rows={campaigns}
          rowKey={(c) => c.id}
          showIndex
          maxHeight={560}
          onRowClick={(c) => setSelectedId(c.id)}
          selectedKey={selected?.id}
          loading={loaded === undefined}
        />
      </Card>

      {selected && (
        <aside className="a-panel">
          <div className="a-panel__head">
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--primary-colors-900)' }} />
            <span className="at-20 at-bold">{selected.name}</span>
            <StatusChip status={selected.status} />
          </div>

          <div className="a-section" style={{ borderTop: 0, paddingTop: 0 }}>
            <div className="a-section__title">Campaign Links</div>
            <Field label="Start from Website">
              <CopyRow value={selected.websiteLink} />
            </Field>
            <Field label="Start from Telegram Bot">
              <CopyRow value={selected.botLink} />
            </Field>
          </div>

          <div className="a-section">
            <div className="a-section__title">End date</div>
            <span className="a-row" style={{ border: '1px solid var(--admin-border)', borderRadius: 8, padding: '8px 12px' }}>
              <Icon name="calendar" size={18} />
              {selected.endDate}
            </span>
          </div>

          <div className="a-row" style={{ marginTop: 'auto', gap: 8 }}>
            <Button variant="outline" size="sm" icon="pencil" onClick={() => onEdit(selected.id)}>Edit</Button>
            {selected.status === 'paused' ? (
              /* Resuming only reopens a link that already exists — nothing is
                 lost by it, so it is the one of the three that just happens. */
              <Button variant="success" size="sm" icon="play" onClick={() => setStatus(selected.id, 'active')}>Resume</Button>
            ) : (
              <Button
                variant="warn"
                size="sm"
                icon="pause"
                disabled={selected.status === 'ended'}
                onClick={() => setConfirming('paused')}
              >
                Pause
              </Button>
            )}
            <Button
              variant="danger"
              size="sm"
              icon="stop"
              disabled={selected.status === 'ended'}
              onClick={() => setConfirming('ended')}
            >
              Stop
            </Button>
          </div>
        </aside>
      )}

      <AnimatePresence>
        {selected && confirming && (
          <Confirm
            danger={confirming === 'ended'}
            title={confirming === 'paused' ? 'Pause campaign' : 'Stop campaign'}
            message={(
              <>
                Are you sure you want to {confirming === 'paused' ? 'pause' : 'stop'}{' '}
                <b style={{ color: 'var(--ink)' }}>{selected.name}</b>?
                <br /><br />
                {confirming === 'paused'
                  ? 'New users can no longer join through its link or code while it is paused. Its existing users, figures and history are kept, and you can resume it at any time.'
                  : 'Its link and code stop working for good. Its users, figures and history are kept, but a stopped campaign cannot be resumed — pause it instead if you may want it back.'}
              </>
            )}
            cancelLabel="Cancel"
            confirmLabel={confirming === 'paused' ? 'Pause campaign' : 'Stop campaign'}
            onCancel={() => setConfirming(null)}
            onConfirm={() => {
              setStatus(selected.id, confirming);
              setConfirming(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CopyRow({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <input className="a-input" readOnly value={value} />
      <Button
        variant="plain"
        onClick={() => {
          navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </Button>
    </span>
  );
}

/* ---------------------------------------------------------------------
 * Create campaign
 * ------------------------------------------------------------------- */

interface DisplayRow {
  brokerId: string;
  badgeOn: boolean;
  badgeText: string;
  badgeColor: string;
}

/** A badge is its text and its colour together — one without the other is not
 *  a state the editor offers, and not a state that can be saved. */
const badgeIncomplete = (r: DisplayRow) => r.badgeOn && !(r.badgeText.trim() && r.badgeColor);

function CreateCampaign({ campaignId, onBack }: { campaignId?: string; onBack: () => void }) {
  const brokers = useAsync(api.brokers) ?? [];
  const campaigns = useAsync(api.referralCampaigns) ?? [];
  const users = useAsync(api.users) ?? [];
  const existing = campaignId ? campaigns.find((c) => c.id === campaignId) : undefined;

  const [name, setName] = useState('');
  const [ownerNo, setOwnerNo] = useState('');
  const [planShare, setPlanShare] = useState('');
  const [cashbackShare, setCashbackShare] = useState('');
  const [endDate, setEndDate] = useState('');
  const [display, setDisplay] = useState<DisplayRow[] | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Prefill once the campaign being edited arrives. Broker display/excluded
  // default blank otherwise, which wiped that editor's choices on re-save.
  const [hydrated, setHydrated] = useState(false);
  if (existing && !hydrated) {
    setHydrated(true);
    setName(existing.name);
    setOwnerNo(existing.ownerUserNo != null ? String(existing.ownerUserNo) : '');
    setPlanShare(String(existing.planShare));
    setCashbackShare(String(existing.cashbackShare));
    setEndDate(existing.endDate ?? '');
    if (existing.display) setDisplay(existing.display);
    if (existing.excluded) setExcluded(existing.excluded);
  }

  /* Optional, but not free-form: an unrecognised number would attach the
     campaign to nobody while looking like it had worked. */
  const owner = ownerNo.trim() ? users.find((u) => String(u.userNo) === ownerNo.trim()) : undefined;
  const ownerUnknown = Boolean(ownerNo.trim()) && !owner;

  const rows = display ?? brokers
    .filter((b) => !excluded.includes(b.id))
    .map((b) => ({ brokerId: b.id, badgeOn: false, badgeText: '', badgeColor: '' }));

  const incomplete = rows.filter(badgeIncomplete);
  const blocked = !name.trim() || ownerUnknown || incomplete.length > 0;

  const save = () => {
    if (blocked) return;
    setSaving(true);
    setError('');
    /* Flat, not nested under `doc`: the server stores the whole payload as the
       campaign's JSON and `toReferralCampaign` spreads it back over the row.
       Sending `doc: {...}` buried these one level down, so the broker display,
       the excluded list and the owner were written and then never read — the
       editor reopened empty every time. */
    const payload = {
      name: name.trim(),
      linkCode: existing?.linkCode ?? null,
      planShare: Number(planShare) || 0,
      cashbackShare: Number(cashbackShare) || 0,
      endDate,
      display: rows,
      excluded,
      ownerUserNo: owner ? owner.userNo : null,
    };
    const request = campaignId
      ? api.updateReferralCampaign(campaignId, payload)
      : api.addReferralCampaign(payload);
    request.then(onBack).catch(() => { setError('Could not save the campaign.'); setSaving(false); });
  };

  const brokerOf = (id: string) => brokers.find((b) => b.id === id);
  const patch = (id: string, p: Partial<DisplayRow>) =>
    setDisplay(rows.map((r) => (r.brokerId === id ? { ...r, ...p } : r)));

  /* The two lists are one list split by `excluded`, so a broker moving between
     them has to leave one side and arrive on the other. Excluding used to drop
     the broker from `display` and restoring only edited `excluded` — which
     left `display` pinned without it, so brokers went right and never came
     back. Both directions now write both halves. */
  const exclude = (id: string) => {
    setExcluded([...excluded, id]);
    setDisplay(rows.filter((r) => r.brokerId !== id));
  };
  const include = (id: string) => {
    setExcluded(excluded.filter((x) => x !== id));
    if (rows.some((r) => r.brokerId === id)) return;
    setDisplay([...rows, { brokerId: id, badgeOn: false, badgeText: '', badgeColor: '' }]);
  };

  return (
    <>
      <header className="a-pagehead">
        <Button icon="chevron-left" onClick={onBack} />
        <h1 className="a-pagehead__title">{campaignId ? 'Edit Campaign' : 'Create New Campaign'}</h1>
        <span className="a-row a-spacer" style={{ gap: 12 }}>
          {error && <span className="at-13 at-neg" role="alert">{error}</span>}
          {!error && incomplete.length > 0 && (
            <span className="at-13 at-neg" role="alert">
              {incomplete.length === 1 ? 'A badge needs' : `${incomplete.length} badges need`} text and a colour.
            </span>
          )}
          <Button variant="primary" disabled={saving || blocked} onClick={save}>
            {saving ? 'Saving…' : campaignId ? 'Save changes' : 'Publish'}
          </Button>
        </span>
      </header>

      <Card>
        <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <Field label="Campaign Name">
            <TextInput value={name} onChange={setName} placeholder="Enter Campaign Name" />
          </Field>
          {/* Was a dropdown of other campaigns' codes, which linked a campaign
              to a campaign. It attaches to an account, by user number. */}
          <Field
            label="User ID"
            optional
            hint={
              owner ? `Linked to ${owner.name}.`
                : ownerUnknown ? <span className="at-neg">No account has that number.</span>
                  : 'Leave empty for a house campaign that belongs to no account.'
            }
          >
            <TextInput value={ownerNo} onChange={setOwnerNo} placeholder="e.g. 1000" />
          </Field>
          <Field label="Plan Revenue Share">
            <span className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <span className="a-event__icon" style={{ background: '#e7edfa', color: 'var(--primary-colors-900)' }}>
                <Icon name="award" size={18} />
              </span>
              <TextInput value={planShare} onChange={setPlanShare} placeholder="Enter percentage" type="number" suffix="%" />
            </span>
          </Field>
          <Field label="Cashback Revenue Share">
            <span className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <span className="a-event__icon" style={{ background: '#e9f9f1', color: '#16a34a' }}>
                <Icon name="briefcase" size={18} />
              </span>
              <TextInput value={cashbackShare} onChange={setCashbackShare} placeholder="Enter percentage" type="number" suffix="%" />
            </span>
          </Field>
          <Field label="End Date" optional>
            <DateInput value={endDate} onChange={setEndDate} />
          </Field>
        </div>
      </Card>

      <div className="a-grid" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)' }}>
        <Card title="Broker Display">
          <div className="a-row at-13 at-muted" style={{ paddingLeft: 36 }}>
            <span style={{ flex: 1 }}>Broker</span>
            <span style={{ width: 60 }}>Badge</span>
            <span style={{ width: 150 }}>Badge text</span>
            <span style={{ width: 200 }}>Color</span>
            <span style={{ width: 40 }}>Action</span>
          </div>
          <DragList items={rows} keyOf={(r) => r.brokerId} onReorder={setDisplay}>
            {(r) => {
              const b = brokerOf(r.brokerId);
              return (
                <>
                  <BrokerLogo name={b?.name ?? r.brokerId} color={b?.color} />
                  <span className="at-14 at-semibold" style={{ flex: 1 }}>{b?.name ?? r.brokerId}</span>
                  <span style={{ width: 60 }}>
                    {/* Turning the badge off clears both halves, so no row can
                        carry a colour with nothing to colour. */}
                    <Checkbox
                      checked={r.badgeOn}
                      onChange={(on) => patch(r.brokerId, on
                        ? { badgeOn: true }
                        : { badgeOn: false, badgeText: '', badgeColor: '' })}
                    />
                  </span>
                  <span style={{ width: 150 }}>
                    <TextInput
                      value={r.badgeText}
                      onChange={(v) => patch(r.brokerId, { badgeText: v })}
                      placeholder="No badge"
                      disabled={!r.badgeOn}
                    />
                  </span>
                  <span style={{ width: 200 }}>
                    {/* No colour until there is badge text to put it on, and
                        once there is, one has to be picked before saving. The
                        system palette every badge uses; a custom code goes in
                        through the eyedropper (the hex field is too wide for
                        this cell). */}
                    <ColorSwatches
                      value={r.badgeColor}
                      onChange={(v) => patch(r.brokerId, { badgeColor: v })}
                      presetsOnly
                      disabled={!r.badgeOn || !r.badgeText.trim()}
                    />
                  </span>
                  <span style={{ width: 40 }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="chevron-right"
                      onClick={() => exclude(r.brokerId)}
                    />
                  </span>
                </>
              );
            }}
          </DragList>
        </Card>

        <Card title="Excluded Brokers" subtitle="Hidden from this campaign's broker list.">
          <div className="a-col">
            {excluded.length === 0 && (
              <EmptyState
                icon="briefcase"
                title="No brokers excluded"
                hint="Every broker on the left is shown to users who join through this campaign."
              />
            )}
            {excluded.map((id) => {
              const b = brokerOf(id);
              if (!b) return null;
              return (
                <div key={id} className="a-excludedrow">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="chevron-left"
                    onClick={() => include(id)}
                    aria-label={`Show ${b.name} again`}
                  />
                  <BrokerLogo name={b.name} color={b.color} />
                  <span className="at-14 at-semibold" style={{ flex: 1 }}>{b.name}</span>
                  <StatusChip status={b.status} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
