import type { ReactNode } from 'react';
import { Icon } from './Icon';
import type { IconName } from './Icon';
import './Notification.css';

export type NotificationVariant = 'success' | 'error' | 'warning' | 'info';

const VARIANT_ICONS: Record<NotificationVariant, IconName> = {
  success: 'check',
  error: 'alert-circle',
  warning: 'alert-triangle',
  info: 'info',
};

export interface NotificationProps {
  /**
   * Figma has Success / Eror / "in progress" states; "in progress" maps to
   * `warning` and `info` is extrapolated from the state tokens.
   */
  variant: NotificationVariant;
  title: string;
  /** Optional second line; the strip grows from 40 to 64 tall. */
  description?: string;
  /** Renders a trailing dismiss button only when passed. */
  onClose?: () => void;
  className?: string;
}

export function Notification({
  variant,
  title,
  description,
  onClose,
  className,
}: NotificationProps): ReactNode {
  const classes = ['ds-notification', `ds-notification-${variant}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes} role={variant === 'error' ? 'alert' : 'status'}>
      <span className="ds-notification-icon">
        <Icon name={VARIANT_ICONS[variant]} size={20} />
      </span>
      <span className="ds-notification-body">
        <span className="ds-notification-title">{title}</span>
        {description ? <span className="ds-notification-desc">{description}</span> : null}
      </span>
      {onClose ? (
        <button
          type="button"
          className="ds-notification-close"
          onClick={onClose}
          aria-label="Dismiss"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
    </div>
  );
}
