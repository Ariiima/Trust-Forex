/**
 * The broker form — one component, two callers.
 *
 * Creating a broker and editing one are the same job: an operator fills in
 * everything users will see. They used to be different screens, so a new
 * broker was born with a name and a status and nothing else, and every other
 * field had to be discovered later by opening the broker and finding a second,
 * fuller form. This is that fuller form, and Add Broker now renders it too.
 *
 * The component owns no state: the caller holds the draft and decides what
 * "save" means, because creating posts to a different endpoint than updating.
 */
import { useState, type ReactNode } from 'react';
import { type BrokerPreview, type BrokerStatus } from '../data';
import {
  AnimatePresence, BrokerLogo, Card, Checkbox, ColorSwatches, Field, Icon, Select, TextInput, Toggle,
} from '../ui';
import { ImageCrop } from '../ui/ImageCrop';

const STATUS_OPTIONS = [
  { value: 'public' as const, label: 'Public' },
  { value: 'private' as const, label: 'Private' },
  { value: 'stopped' as const, label: 'Stopped' },
];

/** Field order matches the frame: left column reads down, then the right. */
const DETAIL_FIELDS = [
  ['regulation', 'Regulation'], ['depositBonus', 'Deposit bonus'],
  ['platform', 'Trading platform'], ['spread', 'Spread level'],
  ['accountTypes', 'Account types'], ['cashbackLevel', 'Cashback level'],
  ['leverage', 'Leverage'], ['execution', 'Execution speed'],
] as const;

/** A broker that exists but has been told nothing about itself yet. */
export function blankBrokerPreview(): BrokerPreview {
  return {
    brokerId: '',
    name: '',
    logoName: '',
    status: 'private',
    badgeOn: false,
    badgeText: '',
    badgeColor: '',
    createAccountLink: '',
    goToBrokerLink: '',
    referralCodeOn: false,
    referralCode: '',
    details: {
      regulation: '', platform: '', accountTypes: '', leverage: '',
      depositBonus: '', spread: '', cashbackLevel: '', execution: '',
    },
    requireEmail: true,
    requireUserId: false,
  };
}

/** A badge is its text and its colour together; neither is a badge on its own. */
export const badgeIncomplete = (v: BrokerPreview) =>
  v.badgeOn && !(v.badgeText.trim() && v.badgeColor);

export function BrokerForm({
  value, onChange, footer,
}: {
  value: BrokerPreview;
  onChange: (next: BrokerPreview) => void;
  /** Save/Cancel live with the caller — creating and updating differ. */
  footer?: ReactNode;
}) {
  // Object URL of a just-picked file, held until the crop is confirmed — the
  // file itself never becomes the stored logo.
  const [crop, setCrop] = useState<{ url: string; name: string } | null>(null);

  const set = <K extends keyof BrokerPreview>(key: K, next: BrokerPreview[K]) =>
    onChange({ ...value, [key]: next });
  const setDetail = (key: keyof BrokerPreview['details'], next: string) =>
    onChange({ ...value, details: { ...value.details, [key]: next } });

  return (
    <>
      <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        <Card title="Broker information">
          <div className="a-col">
            <Field label="Broker name">
              <TextInput value={value.name} onChange={(v) => set('name', v)} placeholder="e.g. Tickmill" />
            </Field>

            <Field label="Broker logo">
              <div className="a-row" style={{ border: '1px solid var(--edge)', borderRadius: 8, padding: 10 }}>
                <BrokerLogo name={value.name || '?'} logo={value.logoUrl} size={40} />
                <span className="a-cell2">
                  <span className="at-14 at-semibold">{value.logoName || 'No logo yet'}</span>
                  <span>PNG or JPG · up to 2MB</span>
                </span>
                <label className="a-btn a-btn--outline a-btn--sm a-spacer" style={{ cursor: 'pointer' }}>
                  <Icon name="upload" size={16} />
                  {value.logoUrl ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept="image/png,image/jpeg"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        window.alert('Logo must be 2MB or smaller.');
                        e.target.value = '';
                        return;
                      }
                      // Picking a file only opens the crop — nothing is stored
                      // until the operator confirms the framing.
                      setCrop({ url: URL.createObjectURL(file), name: file.name });
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
            </Field>

            <div className="a-row">
              <span className="at-13 at-semibold" style={{ width: 130 }}>Broker status</span>
              <Select
                value={value.status}
                onChange={(v: BrokerStatus) => set('status', v)}
                options={STATUS_OPTIONS}
                style={{ flex: 1 }}
              />
            </div>

            <div className="a-row">
              <span className="at-13 at-semibold" style={{ width: 130 }}>Optional badge</span>
              {/* Switching the badge off clears both halves, so no broker can
                  carry a colour with nothing to colour. */}
              <Toggle
                checked={value.badgeOn}
                onChange={(on) => onChange(on
                  ? { ...value, badgeOn: true }
                  : { ...value, badgeOn: false, badgeText: '', badgeColor: '' })}
              />
              <TextInput
                value={value.badgeText}
                onChange={(v) => set('badgeText', v)}
                placeholder="No badge"
                disabled={!value.badgeOn}
                style={{ flex: 1 }}
              />
            </div>

            <div className="a-row">
              <span className="at-13 at-semibold" style={{ width: 130 }}>Badge color</span>
              <ColorSwatches
                value={value.badgeColor}
                onChange={(v) => set('badgeColor', v)}
                disabled={!value.badgeOn || !value.badgeText.trim()}
              />
            </div>
          </div>
        </Card>

        <Card title="Links and referral">
          <div className="a-col">
            <Field label="Create account link">
              <TextInput
                value={value.createAccountLink}
                onChange={(v) => set('createAccountLink', v)}
                placeholder="https://…"
              />
            </Field>
            <Field label="Go to broker link">
              <TextInput
                value={value.goToBrokerLink}
                onChange={(v) => set('goToBrokerLink', v)}
                placeholder="https://…"
              />
            </Field>
            <div className="a-row">
              <span className="at-13 at-semibold">Referral code</span>
              <Checkbox
                checked={value.referralCodeOn}
                onChange={(v) => set('referralCodeOn', v)}
                label={<span className="at-muted">Optional</span>}
              />
            </div>
            <TextInput
              value={value.referralCode}
              onChange={(v) => set('referralCode', v)}
              disabled={!value.referralCodeOn}
            />
          </div>
        </Card>
      </div>

      <Card title="Broker details">
        <div className="a-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px 32px' }}>
          {DETAIL_FIELDS.map(([key, label]) => (
            <div key={key} className="a-row">
              <span className="at-13 at-semibold" style={{ width: 140 }}>{label}</span>
              <TextInput
                value={value.details[key]}
                onChange={(v) => setDetail(key, v)}
                style={{ flex: 1 }}
              />
            </div>
          ))}
        </div>
      </Card>

      <Card title="Required user information" subtitle="Select the details users must submit for account verification.">
        <div className="a-row" style={{ gap: 24 }}>
          <Checkbox checked={value.requireEmail} onChange={(v) => set('requireEmail', v)} label="Email address" />
          <Checkbox checked={value.requireUserId} onChange={(v) => set('requireUserId', v)} label="User ID" />
        </div>
        <p className="a-field__hint" style={{ marginTop: 8 }}>
          You can require either one or both of these details for verification.
        </p>
      </Card>

      {footer}

      <AnimatePresence>
        {crop && (
          <ImageCrop
            src={crop.url}
            onCancel={() => { URL.revokeObjectURL(crop.url); setCrop(null); }}
            onApply={(dataUrl) => {
              onChange({ ...value, logoName: crop.name, logoUrl: dataUrl });
              URL.revokeObjectURL(crop.url);
              setCrop(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}
