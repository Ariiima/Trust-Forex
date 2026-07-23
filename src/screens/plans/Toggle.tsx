import type { ReactNode } from 'react';
import './Toggle.css';

/**
 * Local toggle switch — not in the design system, built to match the
 * "Use earning balance" control exactly (552:3115 off / 552:3116 on, the
 * latter has no JSON so colours were sampled from the reference PNG: track
 * #F1F1F1 off / #144CCD on, 40x20 pill, 16px white thumb inset 2px).
 */
export interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps): ReactNode {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={'scr-plans-toggle' + (checked ? ' scr-plans-toggle--on' : '')}
      onClick={() => onChange(!checked)}
    >
      <span className="scr-plans-toggle-thumb" />
    </button>
  );
}
