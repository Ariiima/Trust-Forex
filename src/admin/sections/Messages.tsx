/**
 * Bot Messages — the Telegram copy sent for payments and withdrawals.
 *
 * Fourteen fixed templates, edited one at a time: an index of all of them on
 * the left (so an operator sees the whole set and what has been customized
 * without scrolling), the writer and its live Telegram preview on the right.
 * Marketing campaigns have their own message editor (Campaigns) — this page is
 * transactional copy only.
 *
 * Drafts live in one map keyed by template, so clicking through the index
 * never silently drops unsaved words; an unsaved row is marked in the index.
 */
import { useState } from 'react';
import { api, type MessageTemplate } from '../data';
import { useAsync } from '../useAsync';
import {
  Button, Chip, EmptyState, Icon, RichText, Skeleton,
  type ChipTone, type IconName,
} from '../ui';

type Group = MessageTemplate['group'];

const GROUP_ORDER: Group[] = ['General', 'Payments', 'Subscription', 'Earnings', 'Withdrawals'];

const GROUP_ICON: Record<Group, IconName> = {
  General: 'send', Payments: 'dollar', Subscription: 'gem',
  Earnings: 'users', Withdrawals: 'wallet',
};
const GROUP_TONE: Record<Group, ChipTone> = {
  General: 'neutral', Payments: 'success', Subscription: 'primary',
  Earnings: 'info', Withdrawals: 'purple',
};

/** Realistic stand-ins for each template's {tokens}, so the preview reads
    like a real message instead of literal braces. Keys match server/admin.mjs
    MESSAGE_TEMPLATES; a key missing here just previews with braces showing. */
const SAMPLE: Record<string, Record<string, string>> = {
  payment_confirmed: {
    plan: 'Gold', days: '90', pct: '20%', total: '$249.00', amount: '$199.00',
    currency: 'USDT', earning_amount: '$50.00', overpaid_amount: '', link: 'https://t.me/+AbC…',
  },
  payment_partial_refund: { amount: '$32.50' },
  payment_incomplete: {
    received: '18.40', due: '20.00', remaining: '1.60',
    currency: 'USDT', network: 'TRC20', address: 'TXy9f…q4fQ2',
  },
  bot_welcome: { name: 'Sara' },
  subscription_lapsed: { plan: 'Gold' },
  cashback_earned: { amount: '$24.60', broker: 'Exness' },
  referral_earned: { amount: '$17.40', name: '#128', source: 'subscription' },
  withdrawal_sent: { amount: '$98.00', currency: 'USDT', network: 'TRC20', txid: '0x9f2c…41ab' },
  withdrawal_manual: {},
  withdrawal_rejected: { amount: '$98.00', reason: 'The destination address does not match your verified wallet.' },
};

/** Mirrors server/admin.mjs renderTemplate exactly, so the preview matches
    what actually sends: unknown tokens are left as-is, not blanked — and a
    token passed empty takes its whole line with it (that is how one Payment
    Confirmed carries lines that only apply sometimes). */
function render(body: string, vars: Record<string, string>) {
  const parts = body.split(/(<br\s*\/?>|\n)/i);
  let out = '';
  for (let i = 0; i < parts.length; i += 2) {
    let blank = false;
    const line = parts[i].replace(/\{(\w+)\}/g, (m, k) => {
      if (!(k in vars)) return m;
      if (!vars[k]) { blank = true; return ''; }
      return vars[k];
    });
    if (!blank) out += line + (parts[i + 1] ?? '');
  }
  return out.replace(/(?:<br\s*\/?>|\s)+$/i, '');
}

/** One flat line for the index — the message as text, marks and line breaks
    collapsed away, so fourteen rows stay scannable at a glance. */
function oneLine(html: string) {
  return html
    .replace(/<\/(div|p|blockquote)>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The Telegram bubble CampaignEditor's message step uses, on the same sunk
    ground, so an admin previews a bot DM the same way in both places. Its
    links open the way they will for the user — in a new tab, so checking one
    never navigates the dashboard away from an unsaved draft. */
function Bubble({ html }: { html: string }) {
  return (
    <div className="a-tg-ground">
      <div
        className="a-tg-bubble at-13"
        onClick={(e) => {
          const a = (e.target as HTMLElement).closest?.('a');
          if (!a) return;
          e.preventDefault();
          window.open(a.getAttribute('href') ?? '', '_blank', 'noopener');
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function Editor({
  t, draft, onDraft, onSaved,
}: {
  t: MessageTemplate;
  draft: string;
  onDraft: (body: string) => void;
  onSaved: (row: MessageTemplate) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const vars = SAMPLE[t.key] ?? {};
  const dirty = draft !== t.body;
  // Derived, not read off updatedAt: the boot seed stamps every row with a
  // timestamp, so updatedAt > 0 called all fourteen "Customized" on a database
  // nobody had touched. Differing from the shipped copy is the actual claim.
  const edited = t.body !== t.default;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const row = await api.saveMessageTemplate(t.key, draft);
      onSaved({ ...t, ...row });
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2400);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save — check the connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="a-card a-msgpane">
      <header className="a-msgpane__head">
        <span className={`a-msgpane__mark a-msgpane__mark--${GROUP_TONE[t.group]}`}>
          <Icon name={GROUP_ICON[t.group]} size={16} />
        </span>
        <div className="a-msgpane__heading">
          <h2 className="at-16 at-semibold">{t.name}</h2>
          <p className="at-12 at-muted">{t.hint}</p>
        </div>
        <Chip tone={edited ? 'primary' : 'neutral'}>{edited ? 'Customized' : 'Shipped default'}</Chip>
      </header>

      <div className="a-msgpane__body">
        <div className="a-col" style={{ gap: 8, minWidth: 0 }}>
          <span className="a-field__label">Message text</span>
          <RichText
            value={draft}
            onChange={onDraft}
            extraInserts={t.vars.map((v) => ({ label: `{${v}}`, text: `{${v}}`, hint: vars[v] }))}
          />
          {error && <p className="at-13 at-neg" role="alert">{error}</p>}
        </div>

        <div className="a-col" style={{ gap: 8 }}>
          <span className="a-field__label">Preview</span>
          <Bubble html={render(draft, vars)} />
          {t.vars.length > 0 && (
            <p className="at-12 at-muted">Tokens are shown with sample values.</p>
          )}
        </div>
      </div>

      <footer className="a-msgpane__foot">
        {draft !== t.default ? (
          <Button variant="ghost" onClick={() => onDraft(t.default)} disabled={saving}>
            Restore shipped copy
          </Button>
        ) : <span />}
        <div className="a-row" style={{ gap: 10 }}>
          {justSaved && !dirty && (
            <span className="a-msgpane__saved at-12">
              <Icon name="check" size={14} /> Saved
            </span>
          )}
          {dirty && (
            <Button variant="outline" onClick={() => onDraft(t.body)} disabled={saving}>Discard changes</Button>
          )}
          <Button variant="primary" icon="check" onClick={save} disabled={saving || !dirty || !oneLine(draft)}>
            {saving ? 'Saving…' : 'Save message'}
          </Button>
        </div>
      </footer>
    </section>
  );
}

export default function Messages() {
  const loaded = useAsync(api.messageTemplates);
  const [saved, setSaved] = useState<MessageTemplate[] | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string | null>(null);

  const list = saved ?? loaded;
  const current = list?.find((t) => t.key === selected) ?? list?.[0];
  const draft = current ? drafts[current.key] ?? current.body : '';

  const onSaved = (row: MessageTemplate) => {
    setSaved((list ?? []).map((t) => (t.key === row.key ? row : t)));
    setDrafts((d) => {
      const next = { ...d };
      delete next[row.key];
      return next;
    });
  };

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">Bot Messages</h1>
          <p className="a-pagehead__sub">
            The Telegram copy the bot sends on its own — payments, subscriptions, earnings and
            withdrawals. Marketing campaigns have their own message editor.
          </p>
        </div>
      </header>

      {list === undefined ? (
        <div className="a-msglayout">
          <Skeleton height={420} radius={16} />
          <Skeleton height={420} radius={16} />
        </div>
      ) : list.length === 0 || !current ? (
        <EmptyState
          icon="mail"
          title="No bot messages"
          hint="The server seeds these on first boot — restart the API if this stays empty."
        />
      ) : (
        <div className="a-msglayout">
          <nav className="a-msgindex" aria-label="Bot messages">
            {GROUP_ORDER.map((group) => {
              const rows = list.filter((t) => t.group === group);
              if (rows.length === 0) return null;
              return (
                <div key={group} className="a-msgindex__group">
                  <span className="a-msgindex__label">{group}</span>
                  {rows.map((t) => {
                    const body = drafts[t.key] ?? t.body;
                    const unsaved = body !== t.body;
                    return (
                      <button
                        key={t.key}
                        type="button"
                        className={`a-msgrow${t.key === current.key ? ' a-msgrow--on' : ''}`}
                        aria-current={t.key === current.key ? 'true' : undefined}
                        onClick={() => setSelected(t.key)}
                      >
                        <span className="a-msgrow__name">{t.name}</span>
                        <span className="a-msgrow__snip">{oneLine(render(body, SAMPLE[t.key] ?? {}))}</span>
                        {unsaved ? (
                          <span className="a-msgrow__dot a-msgrow__dot--unsaved" title="Unsaved changes" />
                        ) : t.body !== t.default ? (
                          <span className="a-msgrow__dot" title="Customized" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </nav>

          <Editor
            key={current.key}
            t={current}
            draft={draft}
            onDraft={(body) => setDrafts((d) => ({ ...d, [current.key]: body }))}
            onSaved={onSaved}
          />
        </div>
      )}
    </>
  );
}
