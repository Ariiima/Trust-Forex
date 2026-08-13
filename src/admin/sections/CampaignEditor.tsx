/**
 * Campaign builder — one page.
 *
 * Was a two-step wizard; an operator reviewing a campaign before creating it
 * had to walk back and forth between the steps to check what they had set, so
 * every section now sits on one scrollable page.
 */
import { useId, useRef, useState, type ChangeEvent, type RefObject } from 'react';
import { api, type MarketingCampaign, type PlanId } from '../data';
import { useAsync } from '../useAsync';
import {
  AnimatePresence, Button, Card, Checkbox, Confirm, DateInput, Field, Icon, MultiSelect,
  PlanGlyph, Radio, RichText, Select, TextInput, Toggle, type IconName,
} from '../ui';
import { ImageCrop } from '../ui/ImageCrop';

const PLANS: PlanId[] = ['silver', 'gold', 'diamond'];

function StepHead({ n, title, sub }: { n: number; title: string; sub?: string }) {
  return (
    <div className="a-row" style={{ gap: 12, alignItems: 'flex-start' }}>
      <span className="a-stepnum">{n}</span>
      <div>
        <div className="at-16 at-bold">{title}</div>
        {sub && <div className="at-13 at-muted">{sub}</div>}
      </div>
    </div>
  );
}

const USER_TYPES = [
  {
    group: 'Subscribers', icon: 'user-plus' as IconName, color: '#7c3aed',
    items: ['No Subscriber', 'Active Subscriber', 'Expired Subscriber'], plans: true,
  },
  {
    group: 'Brokers', icon: 'users' as IconName, color: '#2563eb',
    items: ['No Broker', 'Pending Broker', 'Active Broker'], plans: false,
  },
  {
    group: 'Referrals', icon: 'user-check' as IconName, color: '#16a34a',
    items: ['No Referral', 'Pending Referral', 'Active Referral'], plans: false,
  },
];

const TRIGGERS = [
  ['After Start Robot', 'Trigger after the user starts the robot.', 'robot', '#7c3aed'],
  ['After Subscription Started', 'Trigger after the user starts a subscription.', 'calendar', '#16a34a'],
  ['After Subscription Expired', 'Trigger after the user’s subscription expires.', 'calendar', '#ef4444'],
  ['Remaining Subscription', 'Trigger before subscription is going to expire.', 'clock', '#f59e0b'],
  ['After Pending Broker', 'Trigger after user has a pending broker.', 'briefcase', '#2563eb'],
  ['No Cashback Received', 'Trigger if user has not received any cashback.', 'gift', '#16a34a'],
  ['After Pending Referral', 'Trigger after user has a pending referral.', 'user-plus', '#7c3aed'],
  ['Last Referral Joined', 'Trigger after the last referral joined.', 'users', '#2563eb'],
  ['After Active Referral', 'Trigger after user has an active referral.', 'target', '#16a34a'],
  ['Last Active Referral', 'Trigger after the last active referral.', 'star', '#7c3aed'],
] as const;

const TRIGGER_UNITS = [
  { value: 'second', label: 'Second' },
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
];

const EXPIRY_UNITS = [
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const LIMIT_OPTIONS = [
  { value: 'one', label: 'One time per user' },
  { value: 'two', label: 'Two times per user' },
  { value: 'three', label: 'Three times per user' },
];

/** Which audience glyphs a campaign shows, derived from the selected user types. */
const AUDIENCE_FROM_TYPES = (types: string[]) => {
  const map: Record<string, string> = {
    'No Subscriber': 'user-plus', 'Active Subscriber': 'users', 'Expired Subscriber': 'clock',
    'No Broker': 'briefcase', 'Pending Broker': 'clock', 'Active Broker': 'briefcase',
    'No Referral': 'user-plus', 'Pending Referral': 'bell', 'Active Referral': 'user-check',
  };
  return [...new Set(types.map((t) => map[t]).filter(Boolean))];
};

/**
 * Plain-English readout of the Audience Restriction rule. Categories AND
 * together and picks within a category OR together, and that combination is
 * exactly the shape an operator misreads at a glance — so it gets spelled out.
 */
function describeAudience(allUsersOn: boolean, referralList: string[], brokerList: string[]): string {
  const clauses: string[] = [];
  if (referralList.length) {
    clauses.push(referralList.length > 1 ? `in (${referralList.join(' or ')})` : `in ${referralList[0]}`);
  }
  if (brokerList.length) {
    clauses.push(brokerList.length > 1 ? `with an account at (${brokerList.join(' or ')})` : `with an account at ${brokerList[0]}`);
  }
  // "All Users" ANDed with a real restriction is the restriction — the "all"
  // side narrows nothing, so it only shows up in the sentence on its own.
  if (clauses.length) return `Users ${clauses.join(' and ')}.`;
  return allUsersOn ? 'All users.' : 'No audience restriction selected — choose at least one.';
}

/** contentEditable's "empty" is usually `<br>`, not `''` — check the text a
    message would actually send, not the HTML wrapping it. */
const isBlank = (html: string) => !html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();

/** Mirrors the substitution in server/jobs.mjs so the preview matches what
    actually sends: a {code} token wins over the append-at-end fallback. */
function previewMessage(message: string, includeCode: boolean, sampleCode: string): string {
  if (message.includes('{code}')) return message.replaceAll('{code}', `<code>${sampleCode}</code>`);
  return includeCode ? `${message}<br><br>Your code: <code>${sampleCode}</code>` : message;
}

/**
 * Upload Image, generalised from the broker logo picker in BrokerManage.tsx:
 * picking a file only opens ImageCrop, so nothing is stored until the
 * operator confirms the framing. Adds Replace/Delete once an image is set.
 */
function CroppedImage({
  value, onChange, shape, aspect, hint = 'JPG, PNG up to 2MB', title, subtitle,
}: {
  value?: string;
  onChange: (dataUrl: string | undefined) => void;
  shape?: 'circle' | 'rect';
  aspect?: number;
  hint?: string;
  title?: string;
  subtitle?: string;
}) {
  const id = useId();
  const [pending, setPending] = useState<string | null>(null);

  const cancelCrop = () => {
    if (pending) URL.revokeObjectURL(pending);
    setPending(null);
  };

  const pick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // 2MB is the stated cap in the frames; enforce it before reading.
    if (file.size > 2 * 1024 * 1024) {
      window.alert('Image must be 2MB or smaller.');
      return;
    }
    setPending(URL.createObjectURL(file));
  };

  return (
    <>
      {value ? (
        <div className="a-row" style={{ gap: 8 }}>
          <img src={value} alt="" style={{ maxHeight: 72, borderRadius: 8 }} />
          <span className="a-row" style={{ gap: 8 }}>
            <label className="a-btn a-btn--outline a-btn--sm" htmlFor={id} style={{ cursor: 'pointer' }}>
              <Icon name="upload" size={16} /> Replace
            </label>
            <Button variant="outline" size="sm" icon="trash" onClick={() => onChange(undefined)}>Delete</Button>
          </span>
        </div>
      ) : (
        <label className="a-upload" htmlFor={id}>
          <Icon name="image" size={24} />
          <span>
            <strong>Upload Image</strong>
            {hint}
          </span>
        </label>
      )}
      <input id={id} type="file" accept="image/png,image/jpeg" hidden onChange={pick} />
      <AnimatePresence>
        {pending && (
          <ImageCrop
            src={pending}
            shape={shape}
            aspect={aspect}
            title={title}
            subtitle={subtitle}
            onCancel={cancelCrop}
            onApply={(dataUrl) => { onChange(dataUrl); cancelCrop(); }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

type FieldKey = 'name' | 'audience' | 'userType' | 'trigger' | 'message';

export function CampaignEditor({
  draft, editing, onCancel, onPublish,
}: {
  draft: Partial<MarketingCampaign>;
  editing: boolean;
  onCancel: () => void;
  onPublish: (patch: Partial<MarketingCampaign>) => Promise<void>;
}) {
  // Real options, not placeholders — an audience restriction that cannot name
  // a list is not a restriction.
  const referralCampaigns = useAsync(api.referralCampaigns) ?? [];
  const brokers = useAsync(api.brokers) ?? [];

  /* ---- Campaign Info ---- */
  const [name, setName] = useState(draft.name ?? '');
  const [start, setStart] = useState(draft.startDate ?? '');
  const [end, setEnd] = useState(draft.endDate ?? '');

  /* ---- Audience Restriction ----
     The three picks are independent and combine with AND; picks inside one
     list combine with OR. referralLists/brokerLists on the record are still
     single display strings (data.ts is owned elsewhere), so a multi-pick here
     is stored joined with ", " and split back apart when an edit loads it. */
  const [allUsersOn, setAllUsersOn] = useState(draft.allUsers ?? true);
  const [referralList, setReferralList] = useState<string[]>(
    draft.referralLists && draft.referralLists !== '—' ? draft.referralLists.split(', ') : [],
  );
  const [brokerList, setBrokerList] = useState<string[]>(
    draft.brokerLists && draft.brokerLists !== '—' ? draft.brokerLists.split(', ') : [],
  );

  /* ---- Select User Type ----
     Nothing pre-selected for a new campaign — a blank audience here is a real,
     visible state, not a stale default. Levels only mean anything once a
     subscriber status is in the mix, so they load disabled (and empty) unless
     the saved type selection already includes one. */
  const [types, setTypes] = useState<string[]>(draft.userTypes ?? []);
  const loadedLevelsEnabled = (draft.userTypes ?? []).some(
    (t) => t === 'Active Subscriber' || t === 'Expired Subscriber',
  );
  const [audiencePlans, setAudiencePlans] = useState<PlanId[]>(
    loadedLevelsEnabled ? (draft.audiencePlans ?? []) : [],
  );
  const subscriberLevelsEnabled = types.includes('Active Subscriber') || types.includes('Expired Subscriber');

  const toggleType = (t: string) => {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    setTypes(next);
    const stillEnabled = next.includes('Active Subscriber') || next.includes('Expired Subscriber');
    if (!stillEnabled && audiencePlans.length) setAudiencePlans([]);
  };

  /* ---- Timing Trigger / Expiry ---- */
  const [trigger, setTrigger] = useState<string>(draft.triggerType ?? '');
  const [triggerN, setTriggerN] = useState(draft.triggerN ?? 7);
  const [triggerUnit, setTriggerUnit] = useState(draft.triggerUnit ?? 'day');
  const [expiryN, setExpiryN] = useState(draft.expiryN ?? 7);
  const [expiryUnit, setExpiryUnit] = useState(draft.expiryUnit ?? 'day');

  /* ---- Offer / Discount ---- */
  const [offerOn, setOfferOn] = useState((draft.discountValue ?? 20) > 0);
  const [codeType, setCodeType] = useState<'unique' | 'public'>(draft.codeType ?? 'unique');
  const [publicCode, setPublicCode] = useState(draft.publicCode ?? '');
  const [applicablePlans, setApplicablePlans] = useState<PlanId[]>(draft.applicablePlans ?? []);
  const [discount, setDiscount] = useState(String(draft.discountValue ?? 20));

  /* ---- Message to User (Telegram) ----
     Seeded from `draft`, not blank: this panel doubles as the edit form, and
     starting empty meant re-opening a campaign silently wiped the message the
     bot was sending the moment you saved. */
  const [includeCode, setIncludeCode] = useState(draft.includeCode ?? true);
  const [message, setMessage] = useState(draft.message ?? '');
  const [messageImage, setMessageImage] = useState<string | undefined>(draft.messageImage);

  /* ---- In-App Content ----
     Only an image reaches the Mini App now — cardTitle/cardDesc/cardCta are no
     longer edited here (data.ts keeps the fields for whoever else reads them). */
  const [cardImage, setCardImage] = useState<string | undefined>(draft.cardImage);

  /* ---- Display Location / Limits ---- */
  const [locations, setLocations] = useState<string[]>(
    draft.locations ?? ['subscription', 'referral', 'cashback'],
  );
  const [limit, setLimit] = useState<'none' | 'send' | 'usage'>(
    draft.limitType === 'No Limit' ? 'none' : draft.limitType === 'Usage Limit' ? 'usage' : 'send',
  );
  const [sendLimit, setSendLimit] = useState(draft.sendLimit ?? 'one');
  const [usageLimit, setUsageLimit] = useState(draft.usageLimit ?? 'one');

  const toggleLocation = (id: string) =>
    setLocations(locations.includes(id) ? locations.filter((x) => x !== id) : [...locations, id]);

  /* ---- Validation, confirm, publish ---- */
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishError, setPublishError] = useState('');

  const nameRef = useRef<HTMLDivElement>(null);
  const audienceRef = useRef<HTMLDivElement>(null);
  const userTypeRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const messageRef = useRef<HTMLDivElement>(null);

  /** Marks every incomplete section, then scrolls to the first one — so a
      half-finished campaign never silently fails to create. */
  const validate = (): boolean => {
    const next: Partial<Record<FieldKey, string>> = {};
    if (!name.trim()) next.name = 'Campaign name is required.';
    if (!allUsersOn && !referralList.length && !brokerList.length) {
      next.audience = 'Choose at least one audience: All Users, a referral list, or a broker list.';
    }
    if (!types.length) next.userType = 'Select at least one user type.';
    if (triggerN < 0) next.trigger = 'Timing trigger cannot be negative.';
    if (isBlank(message)) next.message = 'Enter the message to send the user.';
    setErrors(next);

    const order: [FieldKey, RefObject<HTMLDivElement | null>][] = [
      ['name', nameRef], ['audience', audienceRef], ['userType', userTypeRef],
      ['trigger', triggerRef], ['message', messageRef],
    ];
    const first = order.find(([key]) => next[key]);
    first?.[1].current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return !first;
  };

  const buildPatch = (): Partial<MarketingCampaign> & { name: string } => {
    const now = new Date();
    return {
      name: name.trim(),
      startDate: start,
      endDate: end || null,
      allUsers: allUsersOn,
      referralLists: referralList.length ? referralList.join(', ') : '—',
      brokerLists: brokerList.length ? brokerList.join(', ') : '—',
      audiencePlans,
      triggerType: trigger || 'After Start Robot',
      triggerTime: `${triggerN} ${triggerUnit[0].toUpperCase()}${triggerUnit.slice(1)}${triggerN === 1 ? '' : 's'} After`,
      triggerN,
      triggerUnit,
      expiry: `${expiryN} ${expiryUnit}${expiryN === 1 ? '' : 's'}`,
      expiryN,
      expiryUnit,
      audience: AUDIENCE_FROM_TYPES(types),
      userTypes: types,
      discountValue: offerOn ? Number(discount) || 0 : 0,
      applicablePlans,
      limitType: limit === 'none' ? 'No Limit' : limit === 'send' ? 'Send Limit' : 'Usage Limit',
      status: 'active',
      codeType,
      publicCode: codeType === 'public' ? publicCode : undefined,
      includeCode,
      message,
      messageImage,
      sendLimit,
      usageLimit,
      cardImage,
      locations,
      // A brand-new campaign has sent nothing yet; showing a number here would
      // be inventing delivery stats.
      messageSent: draft.messageSent ?? null,
      openRate: draft.openRate ?? null,
      codeSent: draft.codeSent ?? null,
      codeUsedRate: draft.codeUsedRate ?? null,
      createdAt: draft.createdAt ?? now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      createdTime: draft.createdTime ?? now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const doPublish = () => {
    setConfirmOpen(false);
    setSaving(true);
    setPublishError('');
    onPublish(buildPatch()).catch(() => { setPublishError('Could not publish the campaign.'); setSaving(false); });
  };

  const tryPublish = () => {
    if (!validate()) return;
    // Confirm guards creation, per the frames — an edit just saves, matching
    // how every other edit form here behaves.
    if (editing) { doPublish(); return; }
    setConfirmOpen(true);
  };

  return (
    <>
      <header className="a-pagehead">
        <div>
          <h1 className="a-pagehead__title">{editing ? 'Edit Campaign' : 'Create New Campaign'}</h1>
          <p className="a-pagehead__sub">Audience, delivery and content — everything on one page.</p>
        </div>
        <span className="a-row a-spacer" style={{ gap: 8 }}>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" icon="send" disabled={saving} onClick={tryPublish}>
            {saving ? 'Publishing…' : editing ? 'Save changes' : 'Create Campaign'}
          </Button>
        </span>
      </header>
      {publishError && <p className="at-13 at-neg" role="alert">{publishError}</p>}

      <div ref={nameRef}>
        <Card>
          <StepHead n={1} title="Campaign Info" />
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
            <Field label="Campaign Name">
              <TextInput value={name} onChange={setName} placeholder="Enter campaign name" />
            </Field>
            <Field label="Start Date" optional><DateInput value={start} onChange={setStart} /></Field>
            <Field label="End Date" optional><DateInput value={end} onChange={setEnd} /></Field>
          </div>
          {errors.name && <p className="at-13 at-neg" role="alert" style={{ marginTop: 8 }}>{errors.name}</p>}
        </Card>
      </div>

      <div ref={audienceRef}>
        <Card>
          <StepHead
            n={2}
            title="Audience Restriction"
            sub="Pick as many as apply — picks inside a list combine with OR, the three lists combine with AND."
          />
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
            <div className={`a-optioncard${allUsersOn ? ' a-optioncard--on' : ''}`}>
              <Checkbox checked={allUsersOn} onChange={setAllUsersOn} />
              <span className="a-event__icon" style={{ background: '#e7edfa', color: '#2563eb' }}><Icon name="users" size={18} /></span>
              <span className="at-14 at-semibold">All Users</span>
            </div>
            <div className={`a-optioncard${referralList.length ? ' a-optioncard--on' : ''}`}>
              <span className="a-event__icon" style={{ background: '#f3e8ff', color: '#7c3aed' }}><Icon name="user-plus" size={18} /></span>
              <Field label="Referral Campaign List" optional style={{ flex: 1 }}>
                <MultiSelect
                  label="Referral lists"
                  value={referralList}
                  onChange={setReferralList}
                  options={referralCampaigns.map((c) => ({ value: c.name, label: c.name }))}
                />
              </Field>
            </div>
            <div className={`a-optioncard${brokerList.length ? ' a-optioncard--on' : ''}`}>
              <span className="a-event__icon" style={{ background: '#e7edfa', color: '#2563eb' }}><Icon name="briefcase" size={18} /></span>
              <Field label="Broker List" optional style={{ flex: 1 }}>
                <MultiSelect
                  label="Brokers"
                  value={brokerList}
                  onChange={setBrokerList}
                  options={brokers.map((b) => ({ value: b.name, label: b.name }))}
                />
              </Field>
            </div>
          </div>
          <p className="at-13 at-muted" style={{ marginTop: 10 }}>{describeAudience(allUsersOn, referralList, brokerList)}</p>
          {errors.audience && <p className="at-13 at-neg" role="alert" style={{ marginTop: 4 }}>{errors.audience}</p>}
        </Card>
      </div>

      <div ref={userTypeRef}>
        <Card>
          <StepHead n={3} title="Select User Type" />
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
            {USER_TYPES.map((g) => (
              <div key={g.group} className="a-usertype">
                <div className="a-row at-14 at-semibold" style={{ justifyContent: 'center', color: g.color }}>
                  <Icon name={g.icon} size={18} /> {g.group}
                </div>
                <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', textAlign: 'center' }}>
                  {g.items.map((it) => (
                    <label key={it} className="a-usertype__item">
                      <span className="a-event__icon" style={{ background: g.color, color: '#fff', margin: '0 auto' }}>
                        <Icon name="user" size={18} />
                      </span>
                      <span className="at-12">{it}</span>
                      <Checkbox checked={types.includes(it)} onChange={() => toggleType(it)} />
                    </label>
                  ))}
                </div>
                {g.plans && (
                  <>
                    <div className="a-row" style={{ justifyContent: 'center', gap: 8 }}>
                      {PLANS.map((p) => (
                        <button
                          key={p}
                          type="button"
                          aria-pressed={audiencePlans.includes(p)}
                          disabled={!subscriberLevelsEnabled}
                          className={`a-planchip${audiencePlans.includes(p) ? ' a-planchip--on' : ''}`}
                          onClick={() => setAudiencePlans(
                            audiencePlans.includes(p) ? audiencePlans.filter((x) => x !== p) : [...audiencePlans, p],
                          )}
                        >
                          <PlanGlyph plan={p} size={20} />
                          <span className="at-13 at-semibold">{p[0].toUpperCase() + p.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                    {!subscriberLevelsEnabled && (
                      <p className="at-12 at-muted" style={{ textAlign: 'center' }}>
                        Levels apply to Active or Expired Subscribers only.
                      </p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
          {errors.userType && <p className="at-13 at-neg" role="alert" style={{ marginTop: 8 }}>{errors.userType}</p>}
        </Card>
      </div>

      <div ref={triggerRef}>
        <Card>
          <div className="a-row">
            <StepHead n={4} title="Timing Trigger (Optional)" sub="Choose when this campaign should start for each user." />
            <span className="a-row a-spacer" style={{ gap: 8 }}>
              <TextInput value={String(triggerN)} onChange={(v) => setTriggerN(Number(v) || 0)} type="number" style={{ width: 90 }} />
              <Select value={triggerUnit} onChange={setTriggerUnit} options={TRIGGER_UNITS} style={{ width: 120 }} />
            </span>
          </div>
          {errors.trigger && <p className="at-13 at-neg" role="alert" style={{ marginTop: 8 }}>{errors.trigger}</p>}
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', marginTop: 12 }}>
            {TRIGGERS.map(([label, hint, icon, color]) => (
              <label key={label} className="a-triggerrow">
                <span className="a-triggerrow__icon" style={{ background: color }}>
                  <Icon name={icon as IconName} size={16} />
                </span>
                <Radio name="trigger" checked={trigger === label} onChange={() => setTrigger(label)} />
                <span className="a-cell2">
                  <span className="at-13 at-semibold">{label}</span>
                  <span>{hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <div className="a-row">
          <StepHead n={5} title="Expiry Period (Optional)" sub="Set how long the campaign remains active before it expires." />
          <span className="a-row a-spacer" style={{ gap: 8 }}>
            <TextInput value={String(expiryN)} onChange={(v) => setExpiryN(Number(v) || 0)} type="number" style={{ width: 90 }} />
            <Select value={expiryUnit} onChange={setExpiryUnit} options={EXPIRY_UNITS} style={{ width: 120 }} />
          </span>
        </div>
      </Card>

      <Card>
        <div className="a-row">
          <StepHead n={6} title="Offer / Discount" />
          <Toggle checked={offerOn} onChange={setOfferOn} label={<span className="a-spacer at-13">Enable Offer</span>} />
        </div>
        <div className="a-col" style={{ marginTop: 12, opacity: offerOn ? 1 : 0.5 }}>
          <span className="at-13 at-semibold">Code Type</span>
          <label className="a-row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <Radio name="codeType" checked={codeType === 'unique'} onChange={() => setCodeType('unique')} />
            <span className="a-cell2">
              <span className="at-14 at-semibold">Unique Code</span>
              <span>Each code can be used only once</span>
            </span>
          </label>
          <label className="a-row" style={{ gap: 8, alignItems: 'flex-start' }}>
            <Radio name="codeType" checked={codeType === 'public'} onChange={() => setCodeType('public')} />
            <span className="a-cell2">
              <span className="at-14 at-semibold">Public Code</span>
              <span>One code for everyone</span>
            </span>
          </label>
          <TextInput
            value={publicCode}
            onChange={setPublicCode}
            placeholder="Enter public code"
            disabled={codeType !== 'public'}
          />

          <span className="at-13 at-semibold">Applicable Plans</span>
          <div className="a-row" style={{ gap: 8 }}>
            {PLANS.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={applicablePlans.includes(p)}
                className={`a-planchip${applicablePlans.includes(p) ? ' a-planchip--on' : ''}`}
                onClick={() => setApplicablePlans(
                  applicablePlans.includes(p) ? applicablePlans.filter((x) => x !== p) : [...applicablePlans, p],
                )}
              >
                <PlanGlyph plan={p} size={20} />
                <span className="at-13 at-semibold">{p[0].toUpperCase() + p.slice(1)}</span>
              </button>
            ))}
          </div>

          <Field label="Discount Value">
            <TextInput value={discount} onChange={setDiscount} type="number" suffix="%" />
          </Field>
        </div>
      </Card>

      <div ref={messageRef}>
        <Card>
          <StepHead n={7} title="Message to User" sub="The Telegram bot message sent to a matched user." />
          <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 12 }}>
            <div className="a-col">
              <Checkbox
                checked={includeCode}
                onChange={setIncludeCode}
                label="Include discount code"
              />
              {/* {code} lets the admin place the code mid-sentence; if it's absent
                  and the checkbox above is on, the code is appended at the end
                  instead (server/jobs.mjs). */}
              <Field label="Message Text" hint="Use {code} to place the discount code anywhere in the text.">
                <RichText
                  value={message}
                  onChange={setMessage}
                  maxLength={1024}
                  extraInsert={{ label: '{code}', text: '{code}' }}
                />
              </Field>
              {errors.message && <p className="at-13 at-neg" role="alert">{errors.message}</p>}
              <Field label="Upload Image" optional>
                {/* Telegram doesn't clip a message photo to one frame the way the
                    Mini App card does; 16:9 just keeps the crop step from cutting
                    off more than the operator intends. */}
                <CroppedImage
                  value={messageImage}
                  onChange={setMessageImage}
                  shape="rect"
                  aspect={16 / 9}
                  title="Frame the message image"
                  subtitle="Drag and zoom until it sits the way you want. This is what Telegram will attach."
                />
              </Field>
            </div>
            <div className="a-col">
              <span className="a-field__label">Preview</span>
              {/* Telegram renders exactly the bold/italic/underline/quote/link
                  marks the toolbar produces, so the RichText HTML is safe to
                  render as-is here. */}
              <div style={{
                background: 'var(--plate-sunk)', border: '1px solid var(--edge)',
                borderRadius: 14, borderBottomLeftRadius: 4, padding: 10, maxWidth: 320,
              }}
              >
                {messageImage && (
                  <img src={messageImage} alt="" style={{ width: '100%', borderRadius: 8, marginBottom: 8, display: 'block' }} />
                )}
                <div
                  className="at-13"
                  style={{ lineHeight: '19px', color: 'var(--ink)' }}
                  dangerouslySetInnerHTML={{
                    __html: message
                      ? previewMessage(message, includeCode, publicCode || 'ABCD1234')
                      : '<span style="color:var(--ink-3)">Your message will appear here…</span>',
                  }}
                />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <StepHead n={8} title="In-App Content" sub="The image the Mini App's promo carousel shows — nothing else reaches it." />
        <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 12 }}>
          <Field label="Upload Image">
            {/* The promo slide is 328x110 CSS px (.scr-home-slide, src/screens/
                home/Home.css) — crop to that frame so what's confirmed here is
                exactly what ships. */}
            <CroppedImage
              value={cardImage}
              onChange={setCardImage}
              shape="rect"
              aspect={328 / 110}
              title="Frame the in-app card"
              subtitle="The frame is the promo card the Mini App renders, at its exact proportions."
            />
          </Field>
          {cardImage && (
            <div>
              <span className="a-field__label">Preview</span>
              <img
                src={cardImage}
                alt=""
                style={{ width: 328, maxWidth: '100%', aspectRatio: '328 / 110', objectFit: 'cover', borderRadius: 12, display: 'block' }}
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <StepHead n={9} title="Display Location" sub="Choose where this campaign will be displayed in the app." />
        <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
          {([
            ['subscription', 'Subscription Section', 'Show in the subscription area.', '#7c3aed', 'calendar'],
            ['referral', 'Referral Section', 'Show in the referral area.', '#16a34a', 'user-plus'],
            ['cashback', 'Cashback Section', 'Show in the cashback area.', '#f59e0b', 'gift'],
          ] as const).map(([id, title, hint, color, icon]) => (
            <label key={id} className={`a-optioncard${locations.includes(id) ? ' a-optioncard--on' : ''}`}>
              <span className="a-event__icon" style={{ background: color, color: '#fff' }}>
                <Icon name={icon} size={18} />
              </span>
              <span className="a-cell2" style={{ flex: 1 }}>
                <span className="at-14 at-semibold">{title}</span>
                <span>{hint}</span>
              </span>
              <Checkbox checked={locations.includes(id)} onChange={() => toggleLocation(id)} />
            </label>
          ))}
        </div>
      </Card>

      <Card>
        <StepHead
          n={10}
          title="Resend, Usage & Expiry"
          sub="Define how often this campaign can be sent to a user and how many times the offer can be used."
        />
        <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr 1fr', marginTop: 12 }}>
          <label className={`a-optioncard${limit === 'none' ? ' a-optioncard--on' : ''}`}>
            <Radio name="limit" checked={limit === 'none'} onChange={() => setLimit('none')} />
            <span className="a-event__icon" style={{ background: '#7c3aed', color: '#fff' }}><Icon name="infinity" size={18} /></span>
            <span className="a-cell2" style={{ flex: 1 }}>
              <span className="at-14 at-semibold">No Limit</span>
              <span>Preferred for notification use.</span>
            </span>
          </label>
          <label className={`a-optioncard${limit === 'send' ? ' a-optioncard--on' : ''}`}>
            <Radio name="limit" checked={limit === 'send'} onChange={() => setLimit('send')} />
            <span className="a-event__icon" style={{ background: '#2563eb', color: '#fff' }}><Icon name="send" size={18} /></span>
            <span className="a-cell2" style={{ flex: 1 }}>
              <span className="at-14 at-semibold">Send Limit <span className="at-muted">(per user)</span></span>
              <span>Limit how many times this campaign can be sent to a user.</span>
            </span>
            <Select value={sendLimit} onChange={setSendLimit} options={LIMIT_OPTIONS} disabled={limit !== 'send'} style={{ width: 170 }} />
          </label>
          <label className={`a-optioncard${limit === 'usage' ? ' a-optioncard--on' : ''}`}>
            <Radio name="limit" checked={limit === 'usage'} onChange={() => setLimit('usage')} />
            <span className="a-event__icon" style={{ background: '#16a34a', color: '#fff' }}><Icon name="user-check" size={18} /></span>
            <span className="a-cell2" style={{ flex: 1 }}>
              <span className="at-14 at-semibold">Usage Limit <span className="at-muted">(per user)</span></span>
              <span>Limit how many times the offer can be used by a user.</span>
            </span>
            <Select value={usageLimit} onChange={setUsageLimit} options={LIMIT_OPTIONS} disabled={limit !== 'usage'} style={{ width: 170 }} />
          </label>
        </div>
      </Card>

      <AnimatePresence>
        {confirmOpen && (
          <Confirm
            title="Create campaign"
            message={<>Are you sure you want to create the campaign <b style={{ color: 'var(--ink)' }}>{name.trim()}</b>?</>}
            confirmLabel="Create campaign"
            onCancel={() => setConfirmOpen(false)}
            onConfirm={doPublish}
          />
        )}
      </AnimatePresence>
    </>
  );
}
