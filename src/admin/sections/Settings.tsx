/**
 * Settings — the knobs that belong to the system rather than to a user, a
 * broker or a campaign. One page, one card per knob.
 */
import { useEffect, useMemo, useState } from 'react';
import { api, currentTz, fmtStamp, type ApiKey, type ApiScope } from '../data';
import {
  Button, Card, Chip, Confirm, CopyValue, Field, Select, TextInput,
} from '../ui';
import { DataTable, type Column } from '../ui/DataTable';

export default function Settings() {
  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Settings</h1>
          <p className="a-pagehead__sub">
            System-wide settings. These apply everywhere at once — the dashboard, the bot and the
            charts all read them.
          </p>
        </div>
      </header>
      <SystemClock />
      <ApiKeys />
    </>
  );
}

/**
 * The system clock. One zone for every date and time the system writes or
 * shows — server stamps, chart day buckets, the dashboard's own labels.
 *
 * Stamps already written keep the zone they were cut in; changing this changes
 * what gets written from now on.
 */
function SystemClock() {
  const [tz, setTz] = useState(currentTz());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [, tick] = useState(0);

  useEffect(() => {
    api.settings().then((s) => setTz(s.tz)).catch(() => {});
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // ponytail: every zone Intl knows, straight from the platform — no curated list to keep current.
  const zones = useMemo(
    () => Intl.supportedValuesOf('timeZone').map((z) => ({ value: z, label: z.replace(/_/g, ' ') })),
    [],
  );

  const save = (z: string) => {
    setTz(z);
    setBusy(true);
    setErr('');
    api.saveSettings(z)
      .then(() => window.location.reload())  // every stamp already rendered is now stale
      .catch((e) => { setErr(e instanceof Error ? e.message : 'Could not save the timezone.'); setBusy(false); });
  };

  return (
    <Card title="System clock">
      <Field
        label="Timezone"
        hint="Every date and time the system records or shows is read in this zone. Timestamps written before a change keep the zone they were written in."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Select value={tz} onChange={save} options={zones} disabled={busy} style={{ minWidth: 260 }} />
          <span className="at-16 at-muted">Now: {fmtStamp()}</span>
        </div>
      </Field>
      {err && <p className="at-16" style={{ color: 'var(--color-danger)' }}>{err}</p>}
    </Card>
  );
}

/**
 * API keys — how a program reaches this dashboard. The MCP server at
 * POST /api/mcp authenticates with one of these, so an AI agent with a key here
 * can run the dashboard within its scope.
 *
 * The plaintext key exists in one response and is never readable again; only
 * its hash is stored. A lost key is reminted, not recovered.
 */
const SCOPES: { value: ApiScope; label: string }[] = [
  { value: 'read', label: 'Read only — every page, no changes' },
  { value: 'write', label: 'Manage — everything except money' },
  { value: 'money', label: 'Full — including withdrawals and wallets' },
];
const SCOPE_TONE = { read: 'neutral', write: 'info', money: 'warn' } as const;

function ApiKeys() {
  const [keys, setKeys] = useState<ApiKey[] | null>(null);
  const [name, setName] = useState('');
  const [scope, setScope] = useState<ApiScope>('write');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  /** The plaintext, held only until the admin navigates away from this page. */
  const [minted, setMinted] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);

  const load = () => api.apiKeys().then(setKeys).catch(() => setKeys([]));
  useEffect(() => { load(); }, []);

  const create = () => {
    setBusy(true);
    setErr('');
    api.createApiKey(name.trim(), scope)
      .then((k) => { setMinted(k.key); setName(''); load(); })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Could not create the key.'))
      .finally(() => setBusy(false));
  };

  const revoke = (key: ApiKey) => {
    setRevoking(null);
    api.revokeApiKey(key.id).then(load).catch(() => {});
  };

  const columns: Column<ApiKey>[] = [
    { id: 'name', header: 'Name', render: (k) => k.name, sort: (k) => k.name },
    { id: 'prefix', header: 'Key', render: (k) => <CopyValue value={k.prefix} display={`${k.prefix}…`} label="key prefix" /> },
    {
      id: 'scope',
      header: 'Access',
      render: (k) => <Chip tone={SCOPE_TONE[k.scope]}>{k.scope}</Chip>,
    },
    { id: 'created', header: 'Created', render: (k) => fmtStamp(k.createdAt), sort: (k) => k.createdAt },
    {
      id: 'used',
      header: 'Last used',
      // A key that has never been used has no last-use time; "—" says that,
      // where a date would claim a request nobody made.
      render: (k) => (k.lastUsedAt ? fmtStamp(k.lastUsedAt) : <span className="at-muted">—</span>),
      sort: (k) => k.lastUsedAt ?? 0,
    },
    {
      id: 'revoke',
      header: '',
      align: 'right',
      render: (k) => <Button variant="ghost" onClick={() => setRevoking(k)}>Revoke</Button>,
    },
  ];

  return (
    <Card title="API keys">
      <Field
        label="New key"
        hint="Programs and AI agents authenticate with these, at POST /api/mcp or /api/admin. Access is per key: read-only sees every page and changes nothing; manage runs the dashboard — brokers, campaigns, messages, reviews — but is refused on withdrawals, payments and deposit wallets; full lifts that too. No key can create or revoke a key."
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <TextInput value={name} onChange={setName} placeholder="What uses this key" style={{ minWidth: 220 }} />
          <Select value={scope} onChange={setScope} options={SCOPES} style={{ minWidth: 300 }} />
          <Button onClick={create} disabled={busy || !name.trim()}>Create key</Button>
        </div>
      </Field>

      {minted && (
        <Field
          label="Copy it now"
          hint="This is the only time the key is shown. Only its hash is stored, so it cannot be shown again — if it is lost, revoke it and make another."
        >
          <CopyValue value={minted} label="API key" />
        </Field>
      )}

      {err && <p className="at-16" style={{ color: 'var(--color-danger)' }}>{err}</p>}

      <DataTable
        columns={columns}
        rows={keys ?? []}
        rowKey={(k) => k.id}
        loading={keys === null}
        maxHeight={320}
        empty="No API keys yet."
      />

      {revoking && (
        <Confirm
          title="Revoke this key?"
          message={`"${revoking.name}" stops working immediately, and anything using it starts failing. This cannot be undone.`}
          confirmLabel="Revoke"
          danger
          onCancel={() => setRevoking(null)}
          onConfirm={() => revoke(revoking)}
        />
      )}
    </Card>
  );
}
