import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { POP } from '../motion';
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

  /* The black pill is its own layer rather than the button's own background so
   * it can grow out from behind the icon instead of just blinking on. It cannot
   * *travel* between tabs (a shared `layoutId` would need one nav instance that
   * outlives the route change; each tab screen renders its own, and the
   * referral intro deliberately renders none), so this is a mount animation.
   * borderRadius is inline because motion only scale-corrects radii it owns. */
  const active = state === 'active';

  return (
    <button
      type="button"
      className={classes}
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
    >
      {active ? (
        <m.span
          className="ds-navitem-pill"
          initial={{ opacity: 0, scaleX: 0.62 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={POP}
          style={{ borderRadius: 999, originX: 0.18 }}
        />
      ) : null}
      <span className="ds-navitem-icon">{icon}</span>
      {active ? <span className="ds-navitem-label">{label}</span> : null}
    </button>
  );
}
