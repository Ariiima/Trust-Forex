import { useEffect, useRef } from 'react';
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
  /** Called when the user taps the close button, or autoDismiss expires. */
  onClose?: () => void;
  /** ms to live: a bar drains from full to empty, then onClose fires. */
  autoDismiss?: number;
  /** Suppresses the close button even when onClose is passed — autoDismiss
   * (and the caller's own dismiss logic) still fire, there's just nothing
   * for the user to tap. */
  hideClose?: boolean;
  className?: string;
}

export function Notification({
  variant,
  title,
  description,
  onClose,
  autoDismiss,
  hideClose,
  className,
}: NotificationProps): ReactNode {
  const classes = ['ds-notification', `ds-notification-${variant}`, className ?? '']
    .filter(Boolean)
    .join(' ');

  /* A timer, not the bar's animationend: the bar sits behind a
     prefers-reduced-motion query (as everything animated here does), so a
     reduced-motion client — including the pixel-capture harness — would never
     get the event and the strip would sit there forever. */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!autoDismiss) return;
    // Through the ref, so an inline `onClose={() => ...}` at the call site
    // doesn't restart the countdown on every render — which never expires.
    const t = window.setTimeout(() => closeRef.current?.(), autoDismiss);
    return () => window.clearTimeout(t);
  }, [autoDismiss]);

  return (
    <div className={classes} role={variant === 'error' ? 'alert' : 'status'}>
      <span className="ds-notification-icon">
        <Icon name={VARIANT_ICONS[variant]} size={20} />
      </span>
      <span className="ds-notification-body">
        <span className="ds-notification-title">{title}</span>
        {description ? <span className="ds-notification-desc">{description}</span> : null}
      </span>
      {onClose && !hideClose ? (
        <button
          type="button"
          className="ds-notification-close"
          onClick={onClose}
          aria-label="Dismiss"
        >
          <Icon name="close" size={16} />
        </button>
      ) : null}
      {autoDismiss ? (
        <span
          className="ds-notification-timer"
          style={{ animationDuration: `${autoDismiss}ms` }}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}
