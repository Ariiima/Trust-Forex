import type { ReactNode } from 'react';
import './NavigationItem.css';

export type NavigationItemState = 'default' | 'active';

export interface NavigationItemProps {
  icon: ReactNode;
  label: string;
  /**
   * 'active' renders the black label pill (icon + label); 'default' renders the
   * icon only in grey (the label is still exposed to assistive tech).
   */
  state?: NavigationItemState;
  onClick?: () => void;
  className?: string;
}

export function NavigationItem({
  icon,
  label,
  state = 'default',
  onClick,
  className,
}: NavigationItemProps): ReactNode {
  const classes = ['ds-navitem', `ds-navitem-${state}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={label}
      aria-current={state === 'active' ? 'page' : undefined}
    >
      <span className="ds-navitem-icon">{icon}</span>
      {state === 'active' ? <span className="ds-navitem-label">{label}</span> : null}
    </button>
  );
}
