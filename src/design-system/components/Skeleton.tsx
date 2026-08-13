import type { ReactNode } from 'react';
import './Skeleton.css';

/**
 * Skeleton — the one loading placeholder for the app. Every screen that
 * renders from a fetch already has a static constant to show instead (see
 * design/WIRING.md's "static constant renders immediately" rule), so this
 * exists only for the handful of spots with no such constant to fall back
 * on — an asset actually loaded over the network with nothing sensible to
 * paint until it lands.
 *
 * Sized entirely by the caller's className, same contract as AnimatedEmoji:
 * this component owns no dimensions of its own, so it drops into whatever
 * box it is standing in for without shifting anything around it.
 */
export function Skeleton({ className }: { className?: string }): ReactNode {
  return <span className={'ds-skeleton' + (className ? ' ' + className : '')} aria-hidden="true" />;
}
