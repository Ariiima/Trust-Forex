import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

/** Figma styles: Primary-1 → primary, Primary-2 → secondary, Secodary (sic) → dark,
    Tertiary-1 → outline, Tertiary-2 → ghost. */
export type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'outline' | 'ghost';
export type ButtonSize = 'xsmall' | 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /**
   * xsmall = 32px, small = 40px, medium = 44px (default).
   * @deprecated `large` — 48px does not exist in the Figma set; it now renders 44px (= medium).
   */
  size?: ButtonSize;
  /** Stretch to the width of the container (used for full-width CTAs). */
  fullWidth?: boolean;
  /** Show a spinner, keep the label's width, and disable the button. */
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  loading = false,
  iconLeft,
  iconRight,
  children,
  className,
  type = 'button',
  disabled,
  ...rest
}: ButtonProps): ReactNode {
  const classes = [
    'ds-button',
    `ds-button-${variant}`,
    `ds-button-${size}`,
    fullWidth ? 'ds-button-full' : '',
    loading ? 'ds-button-loading' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {iconLeft ? <span className="ds-button-icon">{iconLeft}</span> : null}
      <span className="ds-button-label">{children}</span>
      {iconRight ? <span className="ds-button-icon">{iconRight}</span> : null}
      {loading ? (
        <span className="ds-button-spinner" aria-hidden="true">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="none">
            <circle
              cx="8"
              cy="8"
              r="6.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray="30 12"
            />
          </svg>
        </span>
      ) : null}
    </button>
  );
}
