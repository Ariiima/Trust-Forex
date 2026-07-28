import type { ReactNode } from 'react';
import './Radio.css';

export interface RadioProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  className?: string;
}

export function Radio({ checked, onChange, disabled = false, className }: RadioProps): ReactNode {
  const classes = ['ds-radio', checked ? 'ds-radio-checked' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      className={classes}
      disabled={disabled}
      onClick={onChange}
    />
  );
}
