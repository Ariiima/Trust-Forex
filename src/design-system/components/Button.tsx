import type { ButtonHTMLAttributes, ReactNode } from 'react';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline';
export type ButtonSize = 'small' | 'medium' | 'large';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Figma Button variant (Color=Primary/Secondary) plus an outline/ghost style. */
  variant?: ButtonVariant;
  /** small = 40px, medium = 44px, large = 48px tall. Defaults to medium. */
  size?: ButtonSize;
  /** Stretch to the width of the container (used for full-width CTAs). */
  fullWidth?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  size = 'medium',
  fullWidth = false,
  iconLeft,
  iconRight,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps): ReactNode {
  const classes = [
    'ds-button',
    `ds-button-${variant}`,
    `ds-button-${size}`,
    fullWidth ? 'ds-button-full' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button type={type} className={classes} {...rest}>
      {iconLeft ? <span className="ds-button-icon">{iconLeft}</span> : null}
      <span className="ds-button-label">{children}</span>
      {iconRight ? <span className="ds-button-icon">{iconRight}</span> : null}
    </button>
  );
}
