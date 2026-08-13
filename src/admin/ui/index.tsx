/**
 * Admin UI kit. One file because every piece here is 5-40 lines; splitting it
 * into 25 modules would add more import noise than it removes.
 * Styles live in ../admin.css (class prefix `a-`).
 */
import {
  useEffect, useId, useLayoutEffect, useRef, useState,
  type ChangeEvent, type CSSProperties, type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Icon, type IconName } from './Icon';

/* Every `{cond && <Modal/>}` / `{cond && <Confirm/>}` call site wraps itself
   with this so the close paths (Cancel, Escape, backdrop, a successful save)
   play the exit animation below instead of popping off instantly. */
export { AnimatePresence };

/* Scrim and card both animate in *and* out — mount is instant in React, so
   without this the whole overlay just vanishes on close, which reads as a
   flash. Timings match the --t-base / --t-sweep / --ease tokens in admin.css. */
const SCRIM_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.19, ease: [0.4, 0, 0.2, 1] as const },
};
/* Opacity only, no y/scale: the card carries border-radius + box-shadow, and
   animating transform on top of those forces the browser to rasterize a new
   composited layer for it — the wider the modal (AddResultModal's 920px),
   the more that layer costs and the more a blank first frame shows through
   as a flash. Opacity alone composites the layer it already painted. */
const CARD_MOTION = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.24, ease: [0.4, 0, 0.2, 1] as const },
};

export { Icon };
export type { IconName };

/* ---------------------------------------------------------------------
 * Formatting
 * ------------------------------------------------------------------- */

const NUM = new Intl.NumberFormat('en-US');
const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export const fmtNum = (n: number) => NUM.format(n);
export const fmtUsd = (n: number) => USD.format(n);
export const fmtPct = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

/** "+$1,250.75" / "-$825.15" — the sign is part of the design, not a minus glyph. */
export const fmtSigned = (n: number) => (n < 0 ? `-${USD.format(-n)}` : `+${USD.format(n)}`);

/**
 * Money cell. `signed` prints an explicit +/- and colours it; without it the
 * value is plain (the frames only colour amounts that represent a flow).
 */
export function Money({ value, signed, plain }: { value: number | null; signed?: boolean; plain?: boolean }) {
  if (value == null) return <span className="at-muted">—</span>;
  if (plain) return <>{fmtUsd(value)}</>;
  const cls = value < 0 ? 'at-neg' : 'at-pos';
  return <span className={signed ? cls : undefined}>{signed ? fmtSigned(value) : fmtUsd(value)}</span>;
}

/* ---------------------------------------------------------------------
 * Buttons
 * ------------------------------------------------------------------- */

export type ButtonVariant = 'primary' | 'outline' | 'ghost' | 'success' | 'warn' | 'danger' | 'plain';

export interface ButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: 'md' | 'sm';
  icon?: IconName;
  iconRight?: IconName;
  onClick?: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  style?: CSSProperties;
}

export function Button({
  children, variant = 'ghost', size = 'md', icon, iconRight,
  onClick, disabled, type = 'button', className = '', style,
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`a-btn a-btn--${variant}${size === 'sm' ? ' a-btn--sm' : ''} ${className}`}
      onClick={onClick}
      disabled={disabled}
      style={style}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export function IconButton({
  icon, label, onClick, danger, size = 18,
}: { icon: IconName; label: string; onClick?: () => void; danger?: boolean; size?: number }) {
  return (
    <button
      type="button"
      className={`a-iconbtn${danger ? ' a-iconbtn--danger' : ''}`}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

/**
 * The view sweep. An instrument's scale slides past a fixed index, so a view
 * change here arrives from the right against the same datum. Give it a `key`
 * that changes with the view (a route, a tab) and the remount replays it.
 */
export function Sweep({ children }: { children: ReactNode }) {
  return <div className="a-sweep">{children}</div>;
}

/** A row of readings: tiny legend over a large figure, ruled underneath. */
export function Readings({ children }: { children: ReactNode }) {
  return <div className="a-readings">{children}</div>;
}

export function Reading({
  label, value, hint, tone,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'index' | 'gain' | 'loss' | 'caution';
}) {
  return (
    <div className={`a-reading${tone ? ` a-reading--${tone}` : ''}`}>
      <span className="a-legend">{label}</span>
      <span className="a-reading__value">{value}</span>
      {hint && <span className="a-stat__hint">{hint}</span>}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Loading
 * ------------------------------------------------------------------- */

/** The shimmer placeholder, sized to stand in for the box it precedes. One
 *  shimmer (`.a-skel`, admin.css) for the whole product — everything that
 *  needs a loading state composes this rather than growing its own. */
export function Skeleton({
  width = '100%', height = 9, radius, style,
}: { width?: number | string; height?: number; radius?: number; style?: CSSProperties }) {
  return <span className="a-skel" style={{ width, height, borderRadius: radius, ...style }} />;
}

/** A run of lines the width of prose, each a little shorter than the last so
 *  the block reads as text waiting to arrive rather than a stack of bars. */
export function SkeletonText({ lines = 2, width = 100 }: { lines?: number; width?: number }) {
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={`${Math.max(width - i * 18, 30)}%`} />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------------
 * Surfaces
 * ------------------------------------------------------------------- */

export function Card({
  title, subtitle, actions, children, flush, className = '', style,
}: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode;
  children: ReactNode; flush?: boolean; className?: string; style?: CSSProperties;
}) {
  return (
    <section className={`a-card ${className}`} style={style}>
      {(title || actions) && (
        <header className="a-card__head">
          <div>
            {title && <div className="a-card__title">{title}</div>}
            {subtitle && <div className="at-13 at-muted">{subtitle}</div>}
          </div>
          {actions && <div className="a-row a-spacer">{actions}</div>}
        </header>
      )}
      <div className={`a-card__body${flush ? ' a-card__body--flush' : ''}`}>{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: ReactNode; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="a-stat">
      <span className="a-stat__label">{label}</span>
      <span className="a-stat__value">{value}</span>
      {hint && <span className="a-stat__hint">{hint}</span>}
    </div>
  );
}

export function EmptyState({ icon = 'file', title, hint }: { icon?: IconName; title: string; hint?: string }) {
  return (
    <div className="a-empty">
      <Icon name={icon} size={28} />
      <div className="at-14 at-semibold">{title}</div>
      {hint && <div className="at-13">{hint}</div>}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Tabs
 * ------------------------------------------------------------------- */

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  count?: number | string;
  icon?: IconName;
}

export function Tabs<T extends string>({
  items, value, onChange, sub,
}: { items: readonly TabItem<T>[]; value: T; onChange: (id: T) => void; sub?: boolean }) {
  return (
    <div className={`a-tabs${sub ? ' a-tabs--sub' : ''}`} role="tablist">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={`a-tab${t.id === value ? ' a-tab--active' : ''}`}
          onClick={() => onChange(t.id)}
        >
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.label}
          {t.count !== undefined && <span className="a-tab__count">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Chips
 * ------------------------------------------------------------------- */

export type ChipTone = 'success' | 'danger' | 'warn' | 'info' | 'primary' | 'purple' | 'neutral';

export function Chip({ tone = 'neutral', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`a-chip a-chip--${tone}`}>{children}</span>;
}

/** Status vocabulary shared by users, brokers, campaigns and cycles. */
const STATUS_TONE: Record<string, ChipTone> = {
  active: 'success', approved: 'success', published: 'success', public: 'success', live: 'success',
  pending: 'warn', paused: 'warn', draft: 'purple', waiting: 'warn',
  rejected: 'danger', expired: 'danger', stopped: 'danger', ended: 'danger', failed: 'danger',
  private: 'purple', inactive: 'neutral',
};

export function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? 'neutral';
  return <Chip tone={tone}>{status[0].toUpperCase() + status.slice(1)}</Chip>;
}

/* ---------------------------------------------------------------------
 * Identity
 * ------------------------------------------------------------------- */

export type PlanId = 'standard' | 'silver' | 'gold' | 'diamond';

const PLAN_BADGE: Record<PlanId, string> = {
  standard: new URL('../../assets/plans/badge-standard.png', import.meta.url).href,
  silver: new URL('../../assets/plans/badge-silver.png', import.meta.url).href,
  gold: new URL('../../assets/plans/badge-gold.png', import.meta.url).href,
  diamond: new URL('../../assets/plans/badge-diamond.png', import.meta.url).href,
};

export function PlanGlyph({ plan, size = 28 }: { plan: PlanId | 'none'; size?: number }) {
  /* No subscription is a real state, and the commonest one — it gets a muted
     dot rather than a broken image or, worse, somebody else's tier badge. */
  const badge = PLAN_BADGE[plan as PlanId];
  if (!badge) {
    return (
      <span
        title="No subscription"
        style={{
          width: size, height: size, flex: 'none', borderRadius: '50%',
          border: '1.5px dashed var(--admin-border)', display: 'inline-block',
        }}
      />
    );
  }
  return (
    <img
      src={badge}
      alt={plan}
      title={plan}
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', flex: 'none' }}
    />
  );
}

/** Broker mark. Real logos are PNGs on the broker record; initials cover the rest. */
export function BrokerLogo({
  name, logo, color, size = 28,
}: { name: string; logo?: string; color?: string; size?: number }) {
  const initials = name.replace(/[^A-Za-z ]/g, '').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span
      className="a-brokerlogo"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color ?? undefined }}
      title={name}
    >
      {logo ? <img src={logo} alt="" width={size} height={size} /> : initials}
    </span>
  );
}

export function UserCell({
  name, sub, plan, onClick,
}: { name: string; sub?: string; plan?: PlanId; onClick?: () => void }) {
  const body = (
    <>
      {plan && <PlanGlyph plan={plan} />}
      <span className="a-cell2">
        <span className="at-semibold">{name}</span>
        {sub && <span>{sub}</span>}
      </span>
    </>
  );
  if (!onClick) return <div className="a-user">{body}</div>;
  return (
    <button type="button" className="a-user" onClick={onClick} style={{ textAlign: 'left' }}>
      {body}
    </button>
  );
}

/**
 * A value that copies itself. For the fields an operator pastes into a broker
 * portal or a support thread — emails, account numbers — where selecting the
 * text by hand out of a table row is the fiddliest part of the job.
 */
export function CopyValue({
  value, label, className = '',
}: { value: string | null | undefined; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="at-muted">—</span>;
  return (
    <button
      type="button"
      className={`a-copyvalue${copied ? ' is-copied' : ''} ${className}`}
      title={copied ? 'Copied' : `Copy ${label ?? value}`}
      onClick={(e) => {
        e.stopPropagation(); // rows are often clickable; copying is not navigating
        navigator.clipboard?.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        });
      }}
    >
      <span>{value}</span>
      <Icon name={copied ? 'check' : 'copy'} size={13} />
    </button>
  );
}

/** Value over a muted caption — dates with times, ids under emails. */
export function Cell2({ top, bottom }: { top: ReactNode; bottom?: ReactNode }) {
  return (
    <span className="a-cell2">
      <span>{top}</span>
      {bottom !== undefined && <span>{bottom}</span>}
    </span>
  );
}

/* ---------------------------------------------------------------------
 * Form controls
 * ------------------------------------------------------------------- */

export function Field({
  label, optional, hint, children, style,
}: { label?: ReactNode; optional?: boolean; hint?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <label className="a-field" style={style}>
      {label && (
        <span className="a-field__label">
          {label} {optional && <span>(Optional)</span>}
        </span>
      )}
      {children}
      {hint && <span className="a-field__hint">{hint}</span>}
    </label>
  );
}

export function TextInput({
  value, onChange, placeholder, type = 'text', disabled, suffix, maxLength, style,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; disabled?: boolean; suffix?: ReactNode; maxLength?: number; style?: CSSProperties;
}) {
  const input = (
    <input
      className="a-input"
      type={type}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      maxLength={maxLength}
      style={style}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
    />
  );
  if (!suffix) return input;
  return (
    <span className="a-inputgroup">
      {input}
      <span className="a-inputgroup__suffix">{suffix}</span>
    </span>
  );
}

export function Textarea({
  value, onChange, placeholder, rows = 4, maxLength,
}: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number; maxLength?: number }) {
  return (
    <textarea
      className="a-textarea"
      rows={rows}
      value={value}
      placeholder={placeholder}
      maxLength={maxLength}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

export function SearchInput({
  value, onChange, placeholder = 'Search…', style,
}: { value: string; onChange: (v: string) => void; placeholder?: string; style?: CSSProperties }) {
  return (
    <span className="a-inputgroup" style={style}>
      <Icon name="search" size={18} />
      <input
        className="a-input"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  );
}

export function Select<T extends string>({
  value, onChange, options, disabled, style,
}: {
  value: T; onChange: (v: T) => void;
  options: readonly { value: T; label: string }[];
  disabled?: boolean; style?: CSSProperties;
}) {
  return (
    <span className="a-selectwrap" style={style}>
      <select className="a-select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <Icon name="chevron-down" size={16} />
    </span>
  );
}

export function Checkbox({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode; disabled?: boolean }) {
  return (
    <label className="a-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function Radio({
  checked, onChange, label, name,
}: { checked: boolean; onChange: () => void; label?: ReactNode; name: string }) {
  return (
    <label className="a-check">
      <input type="radio" name={name} checked={checked} onChange={onChange} />
      {label}
    </label>
  );
}

export function Toggle({
  checked, onChange, label,
}: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="a-toggle">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="a-toggle__track" />
    </label>
  );
}

export function NumberStepper({
  value, onChange, min = 0, max = 999, style,
}: { value: number; onChange: (v: number) => void; min?: number; max?: number; style?: CSSProperties }) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <span className="a-stepper" style={style}>
      <input
        className="a-input"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
      />
      <span className="a-stepper__btns">
        <button type="button" aria-label="Increase" onClick={() => onChange(clamp(value + 1))}>
          <Icon name="chevron-up" size={14} />
        </button>
        <button type="button" aria-label="Decrease" onClick={() => onChange(clamp(value - 1))}>
          <Icon name="chevron-down" size={14} />
        </button>
      </span>
    </span>
  );
}

/** Native date input — a custom calendar would be 200 lines for less behaviour. */
export function DateInput({
  value, onChange, type = 'date',
}: { value: string; onChange: (v: string) => void; type?: 'date' | 'datetime-local' }) {
  return <input className="a-input" type={type} value={value} onChange={(e) => onChange(e.target.value)} />;
}

/**
 * The badge palette, for every badge in the CRM.
 *
 * Drawn from the Mini App's own state and brand tokens so a badge an operator
 * sets here is a colour the product already uses, and so two badges set in two
 * different sections match. A colour outside the set is still reachable
 * through the hex field beside them.
 */
export const SWATCHES = [
  '#144CCD', // primary
  '#0099FF', // info
  '#48D48A', // success
  '#FFC300', // warning
  '#FF334C', // error
  '#7C4DFF', // accent — the one hue the token set lacks a slot for
] as const;

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Swatch + eyedropper + hex field. `<input type="color">` is the eyedropper —
 * the platform already ships the picker, so the presets are a shortcut beside
 * it rather than the only way in. A preset-only control cannot express the
 * brand colour a broker actually asks for.
 */
export function ColorSwatches({
  value, onChange, colors = SWATCHES, presetsOnly, disabled,
}: {
  value: string; onChange: (v: string) => void;
  colors?: readonly string[];
  /** Drops the hex text field for tight cells. The eyedropper stays — its
   *  native picker has hex entry, so a custom code is still reachable. */
  presetsOnly?: boolean;
  /** Greys the whole control out — for a colour that has nothing to colour yet. */
  disabled?: boolean;
}) {
  // Local text so a half-typed hex does not repaint the swatch on every key.
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);

  return (
    <div className={`a-swatches${disabled ? ' is-disabled' : ''}`} aria-disabled={disabled || undefined}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={c}
          disabled={disabled}
          className={`a-swatch${c.toLowerCase() === value.toLowerCase() ? ' a-swatch--active' : ''}`}
          style={{ background: c, color: c }}
          onClick={() => onChange(c)}
        >
          {c.toLowerCase() === value.toLowerCase() && <Icon name="check" size={13} strokeWidth={3} />}
        </button>
      ))}
      <label className="a-swatch a-swatch--pick" style={{ background: value || 'var(--plate-sunk)' }}>
        <Icon name="pencil" size={12} />
        <input
          type="color"
          disabled={disabled}
          value={HEX.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Pick a colour"
        />
      </label>
      {!presetsOnly && (
        <input
          className="a-input a-swatch__hex"
          value={text}
          spellCheck={false}
          disabled={disabled}
          aria-label="Colour hex"
          onChange={(e) => {
            const next = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`;
            setText(next);
            if (HEX.test(next)) onChange(next);
          }}
          onBlur={() => setText(value)}
        />
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Popovers
 * ------------------------------------------------------------------- */

/** Close on outside pointerdown or Escape. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);
  return ref;
}

export function Popover({
  button, children, align = 'left', open, onOpenChange,
}: {
  button: (open: boolean) => ReactNode; children: ReactNode;
  align?: 'left' | 'right'; open: boolean; onOpenChange: (v: boolean) => void;
}) {
  const ref = useDismiss(open, () => onOpenChange(false));
  return (
    <div className="a-pop" ref={ref}>
      <span onClick={() => onOpenChange(!open)}>{button(open)}</span>
      {open && <div className={`a-pop__panel${align === 'right' ? ' a-pop__panel--right' : ''}`}>{children}</div>}
    </div>
  );
}

export interface MultiSelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Checkbox dropdown with a search box and Clear/Apply — the broker and campaign
 * filters in the chart frames. Selection is staged locally so Apply is real:
 * closing without applying reverts.
 *
 * `selectAll` adds the tick-everything row. Leave it off where one of the
 * options is itself an aggregate the operator turns on independently — a
 * select-all row there would silently tick that aggregate alongside its parts
 * and plot the same figures twice.
 */
export function MultiSelect({
  label, options, value, onChange, allLabel = 'All', searchable = true, selectAll = true,
}: {
  label: string; options: readonly MultiSelectOption[]; value: string[];
  onChange: (v: string[]) => void; allLabel?: string; searchable?: boolean;
  selectAll?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  const [q, setQ] = useState('');

  const start = (next: boolean) => {
    if (next) { setDraft(value); setQ(''); }
    setOpen(next);
  };

  const all = draft.length === options.length;
  const shown = options.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()));

  return (
    <Popover
      open={open}
      onOpenChange={start}
      align="right"
      button={() => (
        <Button variant="ghost" iconRight="chevron-down">
          {label} ({value.length})
        </Button>
      )}
    >
      {searchable && (
        <SearchInput value={q} onChange={setQ} placeholder="Search…" />
      )}
      <div className="a-pop__list">
        {selectAll && (
          <label className="a-pop__row">
            <Checkbox
              checked={all}
              onChange={() => setDraft(all ? [] : options.map((o) => o.value))}
              label={<span className="at-semibold">{allLabel}</span>}
            />
          </label>
        )}
        {shown.map((o) => (
          <label key={o.value} className="a-pop__row">
            <Checkbox
              checked={draft.includes(o.value)}
              onChange={(on) => setDraft(on ? [...draft, o.value] : draft.filter((v) => v !== o.value))}
              label={
                <span className="a-row" style={{ gap: 8 }}>
                  {o.icon}
                  {o.label}
                </span>
              }
            />
          </label>
        ))}
      </div>
      <div className="a-pop__foot">
        <Button variant="plain" onClick={() => setDraft([])}>Clear</Button>
        <Button variant="primary" size="sm" onClick={() => { onChange(draft); setOpen(false); }}>Apply</Button>
      </div>
    </Popover>
  );
}

export interface MenuAction {
  label: string;
  icon?: IconName;
  danger?: boolean;
  onClick: () => void;
}

export function RowMenu({ actions }: { actions: MenuAction[] }) {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  return (
    <div className="a-pop" ref={ref} style={{ display: 'inline-block' }}>
      <IconButton icon="dots" label="Row actions" onClick={() => setOpen(!open)} />
      {open && (
        <div className="a-menu">
          {actions.map((a) => (
            <button
              key={a.label}
              type="button"
              className={a.danger ? 'is-danger' : undefined}
              onClick={() => { setOpen(false); a.onClick(); }}
            >
              {a.icon && <Icon name={a.icon} size={16} />}
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Modal
 * ------------------------------------------------------------------- */

export function Modal({
  title, subtitle, icon, width = 560, onClose, footer, children,
}: {
  title: ReactNode; subtitle?: ReactNode; icon?: ReactNode; width?: number;
  onClose: () => void; footer?: ReactNode; children: ReactNode;
}) {
  // Layout effect, not effect: this has to land in the same tick as the
  // first paint, or the lock (and whatever width it steals back via
  // scrollbar-gutter) lands a frame late and reads as a flash on open.
  useLayoutEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      className="a-modal__scrim"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ willChange: 'opacity' }}
      {...SCRIM_MOTION}
    >
      <motion.div
        className="a-modal"
        style={{ '--w': `${width}px`, willChange: 'opacity' } as CSSProperties}
        role="dialog"
        aria-modal="true"
        {...CARD_MOTION}
      >
        <header className="a-modal__head">
          {icon}
          <div style={{ flex: 1 }}>
            <div className="a-modal__title">{title}</div>
            {subtitle && <div className="a-modal__sub">{subtitle}</div>}
          </div>
          <IconButton icon="close" label="Close" onClick={onClose} />
        </header>
        <div className="a-modal__body">{children}</div>
        {footer && <footer className="a-modal__foot">{footer}</footer>}
      </motion.div>
    </motion.div>
  );
}

/**
 * The one confirmation. A modal earns its interruption here and nowhere else:
 * the action is about to destroy a record or put figures in front of customers,
 * and both are one click away from being irreversible.
 *
 * The confirming button takes focus on open, so Enter confirms and Escape (via
 * Modal) cancels without reaching for the mouse.
 */
export function Confirm({
  title, message, confirmLabel, cancelLabel = 'Cancel', danger, onCancel, onConfirm,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const focus = useRef<HTMLDivElement>(null);
  useEffect(() => {
    focus.current?.querySelector('button')?.focus();
  }, []);

  return (
    <Modal
      title={title}
      width={432}
      onClose={onCancel}
      footer={(
        <>
          <Button variant="ghost" onClick={onCancel}>{cancelLabel}</Button>
          <div ref={focus} style={{ display: 'contents' }}>
            <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button>
          </div>
        </>
      )}
    >
      <p className="at-14" style={{ color: 'var(--ink-2)' }}>{message}</p>
    </Modal>
  );
}

/* ---------------------------------------------------------------------
 * Drag-to-reorder
 * ------------------------------------------------------------------- */

/**
 * HTML5 drag events — no dependency, and it gives keyboard-free reordering
 * that matches the sort-brokers and broker-display frames.
 * ponytail: no keyboard reorder path; add arrow-key move if a11y demands it.
 */
export function DragList<T>({
  items, keyOf, onReorder, canDrag, children,
}: {
  items: T[]; keyOf: (item: T) => string; onReorder: (next: T[]) => void;
  canDrag?: (item: T) => boolean; children: (item: T, index: number) => ReactNode;
}) {
  const [from, setFrom] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  const drop = (to: number) => {
    if (from == null || from === to) return reset();
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onReorder(next);
    reset();
  };
  const reset = () => { setFrom(null); setOver(null); };

  return (
    <div className="a-draglist">
      {items.map((item, i) => {
        const draggable = canDrag ? canDrag(item) : true;
        return (
          <div
            key={keyOf(item)}
            className={`a-dragrow${from === i ? ' is-dragging' : ''}${over === i && from !== i ? ' is-over' : ''}`}
            draggable={draggable}
            onDragStart={() => draggable && setFrom(i)}
            onDragOver={(e) => { e.preventDefault(); setOver(i); }}
            onDrop={(e) => { e.preventDefault(); drop(i); }}
            onDragEnd={reset}
          >
            <span className="a-grip" aria-disabled={!draggable}>
              <Icon name="grip" size={16} />
            </span>
            {children(item, i)}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------
 * Rich text
 * ------------------------------------------------------------------- */

/**
 * Sticker picker.
 *
 * Telegram's own emoji stickers, grouped the way its picker groups them. These
 * are characters, so they survive being typed into the message body and arrive
 * on the phone as the sticker the operator picked — no upload, no file_id, no
 * dependency on which packs this bot happens to have installed.
 *
 * ponytail: emoji stickers only. Custom sticker SETS (t.me/addstickers/…) are
 * a different object — they send through sendSticker with a file_id rather
 * than inside the message text — and need the bot token wired to an admin
 * endpoint. scripts/get-stickers.mjs already pulls a pack; the picker below is
 * where a pack browser would slot in.
 */
const STICKERS: { group: string; items: string[] }[] = [
  {
    group: 'Reactions',
    items: ['👍', '👎', '❤️', '🔥', '🎉', '👏', '🙏', '💯', '✅', '❌', '⭐', '⚡'],
  },
  {
    group: 'Faces',
    items: ['😀', '😁', '😂', '🤣', '😊', '😍', '🤩', '😎', '🤔', '😐', '😢', '😡'],
  },
  {
    group: 'Money',
    items: ['💰', '💵', '💸', '💳', '🏦', '📈', '📉', '📊', '🧾', '🤑', '💎', '🪙'],
  },
  {
    group: 'Signals',
    items: ['🔔', '📣', '🚀', '🎯', '⏰', '📅', '🔒', '🔑', '⚠️', 'ℹ️', '🏆', '🎁'],
  },
];

function StickerPicker({ onPick }: { onPick: (sticker: string) => void }) {
  return (
    <div className="a-emoji">
      {STICKERS.map((g) => (
        <div key={g.group} className="a-emoji__group">
          <div className="a-emoji__label">{g.group}</div>
          <div className="a-emoji__grid">
            {g.items.map((s) => (
              <button key={s} type="button" aria-label={s} onClick={() => onPick(s)}>{s}</button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Toolbar + contenteditable. `document.execCommand` is deprecated but is still
 * the only cross-browser way to toggle inline marks without shipping an editor
 * framework; these fields hold short Telegram messages, not documents.
 * ponytail: swap for a real editor if collaborative editing or tables appear.
 */
export function RichText({
  value, onChange, placeholder = 'Type your message here…', maxLength, emoji = true, extraInsert, extraInserts,
}: {
  value: string; onChange: (html: string) => void;
  placeholder?: string; maxLength?: number; emoji?: boolean;
  /** One extra toolbar button that inserts a fixed token — e.g. a campaign's `{code}` variable. */
  extraInsert?: { label: string; text: string };
  /** Same idea, for a message with several tokens — e.g. a bot message's {plan}/{amount}. */
  extraInserts?: { label: string; text: string }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const emojiRef = useDismiss(showEmoji, () => setShowEmoji(false));

  // Only write into the DOM when the value came from outside; echoing our own
  // onChange back in would reset the caret to the start on every keystroke.
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value;
  }, [value]);

  const exec = (cmd: string) => {
    ref.current?.focus();
    document.execCommand(cmd);
    onChange(ref.current?.innerHTML ?? '');
  };

  const insert = (text: string) => {
    ref.current?.focus();
    document.execCommand('insertText', false, text);
    onChange(ref.current?.innerHTML ?? '');
  };

  const len = ref.current?.textContent?.length ?? 0;

  return (
    <div className="a-rte">
      {/* Telegram renders bold, italic, underline, blockquote and links, and
          nothing else this toolbar could offer — so the toolbar is exactly
          those plus stickers. The list buttons were removed because Telegram
          has no list markup to send them to: they produced <ul> that arrived
          as run-together lines. */}
      <div className="a-rte__bar">
        <button type="button" onClick={() => exec('bold')} aria-label="Bold"><Icon name="bold" size={16} /></button>
        <button type="button" onClick={() => exec('italic')} aria-label="Italic"><Icon name="italic" size={16} /></button>
        <button type="button" onClick={() => exec('underline')} aria-label="Underline"><Icon name="underline" size={16} /></button>
        <button
          type="button"
          aria-label="Quote"
          onClick={() => {
            ref.current?.focus();
            document.execCommand('formatBlock', false, 'blockquote');
            onChange(ref.current?.innerHTML ?? '');
          }}
        >
          <Icon name="quote" size={16} />
        </button>
        <button
          type="button"
          aria-label="Insert link"
          onClick={() => {
            const url = window.prompt('Link URL');
            if (!url) return;
            ref.current?.focus();
            document.execCommand('createLink', false, url);
            onChange(ref.current?.innerHTML ?? '');
          }}
        >
          <Icon name="link" size={16} />
        </button>
        {emoji && (
          <div className="a-pop" ref={emojiRef} style={{ display: 'inline-block' }}>
            <button
              type="button"
              className={showEmoji ? 'is-on' : undefined}
              aria-label="Insert sticker"
              onClick={() => setShowEmoji(!showEmoji)}
            >
              <Icon name="smile" size={16} />
            </button>
            {showEmoji && (
              <StickerPicker onPick={(s) => { insert(s); setShowEmoji(false); }} />
            )}
          </div>
        )}
        {extraInsert && (
          <button type="button" className="a-btn a-btn--outline a-btn--sm" onClick={() => insert(extraInsert.text)}>
            {extraInsert.label}
          </button>
        )}
        {extraInserts?.map((x) => (
          <button key={x.text} type="button" className="a-btn a-btn--outline a-btn--sm" onClick={() => insert(x.text)}>
            {x.label}
          </button>
        ))}
        {maxLength && <span className="a-rte__count">{len} / {maxLength}</span>}
      </div>
      <div
        ref={ref}
        className="a-rte__area"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        onInput={(e) => {
          const el = e.currentTarget;
          if (maxLength && (el.textContent?.length ?? 0) > maxLength) {
            el.innerHTML = value;
            return;
          }
          onChange(el.innerHTML);
        }}
      />
    </div>
  );
}

export function ImageUpload({
  value, onChange, hint = 'JPG, PNG up to 2MB',
}: { value?: string; onChange: (dataUrl: string | undefined) => void; hint?: string }) {
  const id = useId();
  return (
    <>
      <label className="a-upload" htmlFor={id}>
        {value ? (
          <img src={value} alt="" style={{ maxHeight: 72, borderRadius: 8 }} />
        ) : (
          <>
            <Icon name="image" size={24} />
            <span>
              <strong>Upload Image</strong>
              {hint}
            </span>
          </>
        )}
      </label>
      <input
        id={id}
        type="file"
        accept="image/png,image/jpeg"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          // 2MB is the stated cap in the frames; enforce it before reading.
          if (file.size > 2 * 1024 * 1024) {
            window.alert('Image must be 2MB or smaller.');
            e.target.value = '';
            return;
          }
          const reader = new FileReader();
          reader.onload = () => onChange(String(reader.result));
          reader.readAsDataURL(file);
        }}
      />
    </>
  );
}
