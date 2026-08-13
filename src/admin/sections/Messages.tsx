/**
 * Bot Messages — the Telegram copy sent for payments, subscriptions and
 * withdrawals. One card per message, edited in place with a live preview of
 * exactly what the user sees. Marketing campaigns have their own message
 * editor (Campaigns) — this page is transactional copy only.
 */
import { useState } from 'react';
import { api, type MessageTemplate } from '../data';
import { useAsync } from '../useAsync';
import {
  Button, Card, Chip, EmptyState, Field, Icon, RichText, Skeleton, Tabs,
  type ChipTone, type IconName, type TabItem,
} from '../ui';

type Group = MessageTemplate['group'];

const GROUP_TABS: TabItem<Group>[] = [
  { id: 'Payments', label: 'Payments' },
  { id: 'Subscription', label: 'Subscription' },
  { id: 'Withdrawals', label: 'Withdrawals' },
];

const GROUP_ICON: Record<Group, IconName> = {
  Payments: 'dollar', Subscription: 'calendar', Withdrawals: 'wallet',
};
const GROUP_TONE: Record<Group, ChipTone> = {
  Payments: 'success', Subscription: 'info', Withdrawals: 'purple',
};

/** Realistic stand-ins for each template's {tokens}, so the preview reads
    like a real message instead of literal braces. Keys match server/admin.mjs
    MESSAGE_TEMPLATES; a key missing here just previews with braces showing. */
const SAMPLE: Record<string, Record<string, string>> = {
  payment_confirmed: { plan: 'Gold', amount: '$249.00', currency: 'USDT' },
  payment_partial_refund: { amount: '$32.50' },
  payment_incomplete: {
    received: '18.40', due: '20.00', remaining: '1.60',
    currency: 'USDT', network: 'TRC20', address: 'TXy9f…q4fQ2',
  },
  subscription_reminder: { plan: 'Gold', days: '3 days' },
  subscription_lapsed: { plan: 'Gold' },
  withdrawal_sent: { amount: '$98.00', currency: 'USDT', network: 'TRC20', txid: '0x7ab3…e91c' },
  withdrawal_manual: {},
};

/** Mirrors server/admin.mjs renderTemplate exactly, so the preview matches
    what actually sends: unknown tokens are left as-is, not blanked. */
function render(body: string, vars: Record<string, string>) {
  return body.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m);
}

/** The Telegram bubble mock CampaignEditor's message step uses, reused here
    so an admin previews a bot DM the same way in both places. */
function Bubble({ html }: { html: string }) {
  return (
    <div
      className="at-13"
      style={{
        background: 'var(--plate-sunk)', border: '1px solid var(--edge)',
        borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, maxWidth: 360,
        lineHeight: '19px', color: 'var(--ink)', whiteSpace: 'pre-wrap',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function TemplateCard({ t, onSaved }: { t: MessageTemplate; onSaved: (row: MessageTemplate) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(t.body);
  const [saving, setSaving] = useState(false);

  const vars = SAMPLE[t.key] ?? {};
  const preview = render(editing ? draft : t.body, vars);
  const edited = t.updatedAt > 0;

  const save = async () => {
    setSaving(true);
    try {
      const row = await api.saveMessageTemplate(t.key, draft);
      onSaved({ ...t, ...row });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title={(
        <span className="a-row" style={{ gap: 8 }}>
          <Icon name={GROUP_ICON[t.group]} size={16} />
          {t.name}
        </span>
      )}
      subtitle={t.hint}
      actions={<Chip tone={edited ? GROUP_TONE[t.group] : 'neutral'}>{edited ? 'Customized' : 'Default'}</Chip>}
    >
      {editing ? (
        <>
          <Field
            label="Message Text"
            hint={t.vars.length ? 'Tap a token to insert it at the cursor.' : undefined}
          >
            <RichText
              value={draft}
              onChange={setDraft}
              extraInserts={t.vars.map((v) => ({ label: `{${v}}`, text: `{${v}}` }))}
            />
          </Field>
          <div className="a-grid" style={{ gridTemplateColumns: 'auto 1fr', gap: 24, alignItems: 'end' }}>
            <div>
              <span className="a-field__label">Preview</span>
              <div style={{ marginTop: 6 }}><Bubble html={preview} /></div>
            </div>
            <div className="a-row" style={{ gap: 8, justifyContent: 'flex-end' }}>
              {draft !== t.default && (
                <Button variant="outline" onClick={() => setDraft(t.default)} disabled={saving}>
                  Reset to default
                </Button>
              )}
              <Button onClick={() => { setDraft(t.body); setEditing(false); }} disabled={saving}>Cancel</Button>
              <Button variant="primary" icon="check" onClick={save} disabled={saving || !draft.trim()}>
                {saving ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <div className="a-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 }}>
          <Bubble html={preview} />
          <Button variant="outline" icon="pencil" onClick={() => { setDraft(t.body); setEditing(true); }}>
            Edit
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function Messages() {
  const loaded = useAsync(api.messageTemplates);
  const [templates, setTemplates] = useState<MessageTemplate[] | null>(null);
  const [tab, setTab] = useState<Group>('Payments');

  const list = templates ?? loaded;
  const shown = (list ?? []).filter((t) => t.group === tab);

  const onSaved = (row: MessageTemplate) => setTemplates((list ?? []).map((t) => (t.key === row.key ? row : t)));

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Bot Messages</h1>
          <p className="a-pagehead__sub">
            The Telegram copy sent for payments, subscriptions and withdrawals.
            Marketing campaigns have their own message editor.
          </p>
        </div>
      </header>

      <Tabs items={GROUP_TABS} value={tab} onChange={setTab} />

      <div className="a-grid" style={{ marginTop: 16, gap: 16 }}>
        {list === undefined ? (
          <>
            <Skeleton height={148} radius={16} />
            <Skeleton height={148} radius={16} />
          </>
        ) : shown.length === 0 ? (
          <EmptyState icon="mail" title="Nothing here" />
        ) : (
          shown.map((t) => <TemplateCard key={t.key} t={t} onSaved={onSaved} />)
        )}
      </div>
    </>
  );
}
