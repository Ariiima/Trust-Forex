import type { ReactNode } from 'react';
import './Switch.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (c: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onChange, disabled = false, className }: SwitchProps): ReactNode {
  const classes = ['ds-switch', checked ? 'ds-switch-on' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={classes}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="ds-switch-knob" aria-hidden="true" />
    </button>
  );
}
