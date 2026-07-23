import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import './ProgressBar.css';

export type ProgressStep = 'order-created' | 'payment-details' | 'make-payment';

const STEP_ORDER: readonly ProgressStep[] = ['order-created', 'payment-details', 'make-payment'];

export interface ProgressBarProps {
  /** The step the user is currently on (Figma "Progress bar" State=…, 1102:9734). */
  current: ProgressStep;
  className?: string;
}

export function ProgressBar({ current, className }: ProgressBarProps): ReactNode {
  const activeIndex = STEP_ORDER.indexOf(current);
  const classes = ['ds-progress', className ?? ''].filter(Boolean).join(' ');
  const last = STEP_ORDER.length - 1;

  return (
    <div className={classes}>
      <div className="ds-progress-track">
        {STEP_ORDER.map((step, i) => {
          const status = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
          return (
            <Fragment key={step}>
              <span className={`ds-progress-dot ds-progress-dot-${status}`}>
                {status === 'done' ? (
                  <Icon name="check" size={16} strokeWidth={2.5} />
                ) : (
                  <span className="ds-progress-inner" />
                )}
              </span>
              {i < last ? (
                <span
                  className={`ds-progress-line${i < activeIndex ? ' ds-progress-line-filled' : ''}`}
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
