import { useId } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import './Input.css';

export interface InputProps {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** Error message line (red border + red msg). Wins over `hint`. */
  error?: string;
  /** Grey helper line under the field. */
  hint?: string;
  /** Trailing content inside the field, e.g. a paste chip or icon. */
  rightSlot?: ReactNode;
  disabled?: boolean;
  className?: string;
}

export function Input({
  label,
  value,
  onChange,
  placeholder,
  error,
  hint,
  rightSlot,
  disabled = false,
  className,
}: InputProps): ReactNode {
  const id = useId();
  const msg = error ?? hint;
  const msgId = `${id}-msg`;
  const classes = [
    'ds-input',
    error ? 'ds-input-error' : '',
    disabled ? 'ds-input-disabled' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {label ? (
        <label className="ds-input-label" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="ds-input-field">
        <input
          id={id}
          className="ds-input-control"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={msg ? msgId : undefined}
        />
        {rightSlot ? <span className="ds-input-right">{rightSlot}</span> : null}
      </div>
      {msg ? (
        <span id={msgId} className={`ds-input-msg${error ? ' ds-input-msg-error' : ''}`}>
          {error ? <Icon name="alert-circle" size={16} strokeWidth={1.75} /> : null}
          {msg}
        </span>
      ) : null}
    </div>
  );
}
