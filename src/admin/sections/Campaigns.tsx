import { useState } from 'react';
import { api, type CampaignList, type CampaignStatus, type MarketingCampaign } from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, Button, Card, Cell2, Confirm, EmptyState, Icon, PlanGlyph, Select, Skeleton, Stat, StatusChip,
  TextInput, fmtNum, fmtPct, type IconName,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';
import { CampaignEditor } from './CampaignEditor';


export default function Campaigns() {
  const [editorOpen, setEditorOpen] = useState(false);
  // The editor collects the whole campaign into one document; publishing
  // writes it once, so a half-finished campaign never reaches the server.
  const [draft, setDraft] = useState<Partial<MarketingCampaign>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const open = (campaign?: MarketingCampaign) => {
    setDraft(campaign ?? {});
    setEditingId(campaign?.id ?? null);
    setEditorOpen(true);
  };

  const publish = (doc: Partial<MarketingCampaign> & { name: string }) => {
    const request = editingId ? api.updateCampaign(editingId, doc) : api.addCampaign(doc);
    return request.then(() => {
      setEditorOpen(false);
      setEditingId(null);
      setDraft({});
      setReloadKey((k) => k + 1);
    });
  };

  if (editorOpen) {
    return (
      <CampaignEditor
        draft={draft}
        editing={!!editingId}
        onCancel={() => setEditorOpen(false)}
        onPublish={(patch) => publish({ ...draft, ...patch } as Partial<MarketingCampaign> & { name: string })}
      />
    );
  }
  return <CampaignList key={reloadKey} onCreate={() => open()} onEdit={open} />;
}

/* ---------------------------------------------------------------------
 * List + detail panel
 * ------------------------------------------------------------------- */

/** The icon each kind of audience is read by, across the CRM. */
const AUDIENCE_ICON: Record<string, IconName> = {
  'All Users': 'users',
  'Active Subscriber': 'user-check',
  'Expired Subscriber': 'clock',
  'No Subscriber': 'user',
  'Active Broker': 'briefcase',
  'Pending Broker': 'briefcase',
  'No Broker': 'briefcase',
  'Active Referral': 'user-plus',
  'Pending Referral': 'user-plus',
  'No Referral': 'user-plus',
  Referral: 'user-plus',
  Broker: 'briefcase',
};

/**
 * What a campaign actually targets.
 *
 * NOT `campaign.audience` — that field holds a decorative run of icon names
 * ("bell", "link", "gift", "star") that never described an audience, so every
 * campaign rendered the same meaningless row of glyphs. The real targeting is
 * the toggles the builder writes, so the column is derived from those and each
 * chip can say what it means.
 */
function audienceOf(c: MarketingCampaign): { label: string; icon: IconName }[] {
  const out: { label: string; icon: IconName }[] = [];
  const add = (label: string, icon: IconName) => out.push({ label, icon });

  if (c.allUsers) add('All users', 'users');
  for (const t of c.userTypes ?? []) add(t, AUDIENCE_ICON[t] ?? 'user');
  for (const p of c.audiencePlans ?? []) add(`${p[0].toUpperCase()}${p.slice(1)} plan`, 'gem');

  const named = (csv: string | undefined, icon: IconName, kind: string) => {
    if (!csv || csv === '—') return;
    for (const name of csv.split(',').map((s) => s.trim()).filter(Boolean)) {
      add(`${kind}: ${name}`, icon);
    }
  };
  named(c.referralLists, 'user-plus', 'Referral list');
  named(c.brokerLists, 'briefcase', 'Broker list');

  return out;
}

/** Five to a row, so nine audiences read as 5 + 4 rather than one long line. */
function AudienceIcons({ campaign }: { campaign: MarketingCampaign }) {
  const items = audienceOf(campaign);
  if (!items.length) return <span className="at-muted">—</span>;
  return (
    <span
      className="a-audience"
      style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto)', justifyContent: 'start', gap: 4 }}
    >
      {items.map((a, i) => (
        <span key={`${a.label}${i}`} title={a.label} style={{ color: 'var(--ink-2)' }}>
          <Icon name={a.icon} size={16} />
        </span>
      ))}
    </span>
  );
}

/** Count over a labeled rate — "25,430" over "62.5% opened app" style captions. */
function SentCell({ n, pct, caption }: { n: number | null; pct: number | null; caption: string }) {
  if (n == null) return <span className="at-muted">—</span>;
  return <Cell2 top={fmtNum(n)} bottom={pct == null ? undefined : `${fmtPct(pct)} ${caption}`} />;
}

function CampaignList({
  onCreate, onEdit,
}: { onCreate: () => void; onEdit: (c: MarketingCampaign) => void }) {
  const loadedLists = useAsync(api.campaignLists);
  const [extraLists, setExtraLists] = useState<CampaignList[]>([]);
  const lists = [...(loadedLists ?? []), ...extraLists];

  const loaded = useAsync(api.marketingCampaigns);
  const [edited, setEdited] = useState<MarketingCampaign[] | null>(null);
  const all = edited ?? loaded ?? [];

  const [listId, setListId] = useState('all');
  const [naming, setNaming] = useState(false);
  const [newList, setNewList] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MarketingCampaign | null>(null);

  // Membership lives in its own table, so the chip filter is a real lookup.
  const members = useAsync(() => api.campaignListMembers(listId), [listId]);
  const campaigns = listId === 'all' || !members
    ? all
    : all.filter((c) => members.includes(c.id));
  // Waits on membership too when a list is picked — without it, switching
  // lists showed the unfiltered table for a beat before narrowing.
  const loading = loaded === undefined || (listId !== 'all' && members === undefined);

  const selected = campaigns.find((c) => c.id === selectedId) ?? campaigns[0];

  const setStatus = (id: string, status: CampaignStatus) => {
    setEdited(all.map((c) => (c.id === id ? { ...c, status } : c)));
    api.setCampaignStatus(id, status).catch(() => setEdited(all));
  };

  const remove = (id: string) => {
    setEdited(all.filter((c) => c.id !== id));
    setSelectedId(null);
    api.deleteCampaign(id).catch(() => setEdited(all));
  };

  const addList = () => {
    const name = newList.trim();
    if (!name) return;
    setNaming(false);
    setNewList('');
    api.addCampaignList(name).then((l) => setExtraLists((x) => [...x, l])).catch(() => {});
  };

  // setCampaignLists replaces membership wholesale, so "add to list" has to
  // fetch what the campaign already belongs to first — otherwise adding it to
  // list B silently drops it out of list A.
  const addToList = (campaignId: string, listId: string) =>
    Promise.all(
      lists
        .filter((l) => l.id !== 'all' && l.id !== listId)
        .map((l) => api.campaignListMembers(l.id).then((m) => (m.includes(campaignId) ? l.id : null))),
    ).then((current) => api.setCampaignLists(campaignId, [...current.filter((id): id is string => !!id), listId, 'all']));

  const columns: Column<MarketingCampaign>[] = [
    {
      id: 'name', header: 'Campaign Name', width: 220,
      render: (c) => (
        <b
          title={c.name}
          style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: 220 }}
        >
          {c.name}
        </b>
      ),
      sort: (c) => c.name,
    },
    { id: 'audience', header: 'Audience', width: 180, render: (c) => <AudienceIcons campaign={c} /> },
    { id: 'message', header: 'Message Sent', align: 'center', render: (c) => <SentCell n={c.messageSent} pct={c.openRate} caption="opened app" />, sort: (c) => c.messageSent ?? -1 },
    { id: 'code', header: 'Code Sent', align: 'center', render: (c) => <SentCell n={c.codeSent} pct={c.codeUsedRate} caption="used" />, sort: (c) => c.codeSent ?? -1 },
    { id: 'start', header: 'Start Date', render: (c) => c.startDate },
    { id: 'end', header: 'End Date', render: (c) => c.endDate ?? <span className="at-muted">—</span> },
    { id: 'created', header: 'Created', render: (c) => <Cell2 top={c.createdAt} bottom={c.createdTime} /> },
  ];

  return (
    <div className="a-split">
      <div className="a-col">
        <header className="a-pagehead">
          <h1 className="a-pagehead__title">All Campaigns</h1>
          <Button variant="primary" icon="plus" className="a-spacer" onClick={onCreate}>Create New Campaign</Button>
        </header>

        <div className="a-row" style={{ gap: 8, marginBottom: 4 }}>
          {naming ? (
            <span className="a-row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <TextInput value={newList} onChange={setNewList} placeholder="List name" style={{ width: 180 }} />
              <Button variant="primary" size="sm" onClick={addList} disabled={!newList.trim()}>Add</Button>
              <Button size="sm" onClick={() => { setNaming(false); setNewList(''); }}>Cancel</Button>
            </span>
          ) : (
            <Button variant="outline" size="sm" icon="plus" onClick={() => setNaming(true)}>New List</Button>
          )}
          {lists.map((l) => (
            <button
              key={l.id}
              type="button"
              className={`a-tab${listId === l.id ? ' a-tab--active' : ''}`}
              onClick={() => setListId(l.id)}
            >
              {l.name}
              <span className="a-chip a-chip--neutral">
                  {loadedLists === undefined ? <Skeleton width={12} height={12} /> : l.count}
                </span>
            </button>
          ))}
        </div>

        <Card flush>
          <DataTable
            columns={columns}
            rows={campaigns}
            rowKey={(c) => c.id}
            showIndex
            maxHeight={620}
            onRowClick={(c) => setSelectedId(c.id)}
            selectedKey={selected?.id}
            loading={loading}
            empty={<EmptyState icon="megaphone" title="No campaigns in this list" hint="Pick another list, or create a campaign." />}
          />
        </Card>
      </div>

      {selected && (
        <CampaignPanel
          campaign={selected}
          lists={lists}
          onAddToList={(list) => addToList(selected.id, list).catch(() => {})}
          onStatus={(status) => setStatus(selected.id, status)}
          onEdit={() => onEdit(selected)}
          onDelete={() => setDeleting(selected)}
        />
      )}

      <AnimatePresence>
        {deleting && (
          <Confirm
            danger
            title="Delete campaign"
            message={<>Are you sure you want to delete <b style={{ color: 'var(--ink)' }}>{deleting.name}</b>? This cannot be undone.</>}
            confirmLabel="Delete"
            onCancel={() => setDeleting(null)}
            onConfirm={() => { remove(deleting.id); setDeleting(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function CampaignPanel({
  campaign: c, lists, onAddToList, onStatus, onEdit, onDelete,
}: {
  campaign: MarketingCampaign;
  lists: CampaignList[];
  onAddToList: (listId: string) => void;
  onStatus: (s: CampaignStatus) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [addedTo, setAddedTo] = useState('');
  return (
    <aside className="a-panel">
      <div className="a-panel__head">
        <span className="at-20 at-bold" style={{ flex: 1 }}>{c.name}</span>
        <StatusChip status={c.status} />
      </div>

      <Select
        value={addedTo}
        onChange={(v) => { setAddedTo(v); if (v) onAddToList(v); }}
        options={[
          { value: '', label: 'Add to list…' },
          ...lists.filter((l) => l.id !== 'all').map((l) => ({ value: l.id, label: l.name })),
        ]}
      />

      <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Stat label="Message Sent" value={c.messageSent == null ? '—' : fmtNum(c.messageSent)} hint={c.openRate == null ? undefined : `${fmtPct(c.openRate)} opened app`} />
        <Stat label="Code Sent" value={c.codeSent == null ? '—' : fmtNum(c.codeSent)} hint={c.codeUsedRate == null ? undefined : `${fmtPct(c.codeUsedRate)} used`} />
      </div>

      <div className="a-section">
        <div className="a-section__title">Campaign Information</div>
        <dl className="a-deflist">
          <dt>Start Date</dt><dd>{c.startDate}</dd>
          <dt>End Date</dt><dd>{c.endDate ?? '—'}</dd>
          {/* Expiry here is the discount code's usable window, not the campaign's end date. */}
          {c.includeCode && (<><dt>Code Expiry</dt><dd>{c.expiry}</dd></>)}
          <dt>Created</dt><dd>{c.createdAt} {c.createdTime}</dd>
        </dl>
      </div>

      <div className="a-section">
        <div className="a-section__title">Audience</div>
        <AudienceIcons campaign={c} />
        <dl className="a-deflist">
          <dt>All Users</dt><dd>{c.allUsers ? 'Yes' : 'No'}</dd>
          <dt>Referral Campaign List</dt><dd>{c.referralLists}</dd>
          <dt>Broker List</dt><dd>{c.brokerLists}</dd>
        </dl>
      </div>

      <div className="a-section">
        <div className="a-section__title">Timing Trigger</div>
        <dl className="a-deflist">
          <dt>Trigger Type</dt><dd>{c.triggerType}</dd>
          <dt>Trigger Time</dt><dd>{c.triggerTime}</dd>
        </dl>
      </div>

      <div className="a-section">
        <div className="a-section__title">Limit (Usage &amp; Send)</div>
        <dl className="a-deflist">
          <dt>Limit Type</dt><dd>{c.limitType}</dd>
        </dl>
      </div>

      <div className="a-section">
        <div className="a-section__title">Offering Discount</div>
        <dl className="a-deflist">
          <dt>Discount Value</dt><dd>{c.discountValue ? `${c.discountValue}%` : '—'}</dd>
        </dl>
        <div className="a-row" style={{ gap: 8 }}>
          {(c.applicablePlans ?? []).map((p) => (
            <span key={p} className="a-chip a-chip--neutral">
              <PlanGlyph plan={p} size={18} /> {p[0].toUpperCase() + p.slice(1)}
            </span>
          ))}
        </div>
      </div>

      <div className="a-row" style={{ gap: 8 }}>
        <Button variant="success" size="sm" icon="play" disabled={c.status === 'active'} onClick={() => onStatus('active')}>
          {c.status === 'paused' ? 'Resume' : 'Start'}
        </Button>
        <Button variant="warn" size="sm" icon="pause" disabled={c.status !== 'active'} onClick={() => onStatus('paused')}>Pause</Button>
        <Button variant="outline" size="sm" icon="pencil" onClick={onEdit}>Edit</Button>
        <Button variant="danger" size="sm" icon="trash" onClick={onDelete}>Delete</Button>
      </div>
    </aside>
  );
}
