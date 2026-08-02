import { Fragment } from 'react';
import type { ReactNode } from 'react';
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

  /* Each step of the flow is its own route, so the bar remounts every time and
     a CSS transition would never fire — the connector would simply render
     already green. The segment leading into the current step is therefore
     marked and animated on mount, so arriving on a page shows the green travel
     to the circle you just reached. Segments before it are static.

     The current dot waits for that segment to arrive; on the first step there
     is nothing to wait for, so it pops almost immediately. */
  return (
    <div
      className={classes}
      style={{ ['--ds-progress-dot-delay' as string]: activeIndex > 0 ? '0.34s' : '0.06s' }}
    >
      <div className="ds-progress-track">
        {STEP_ORDER.map((step, i) => {
          const status = i < activeIndex ? 'done' : i === activeIndex ? 'current' : 'todo';
          return (
            <Fragment key={step}>
              <span className={`ds-progress-dot ds-progress-dot-${status}`}>
                {status === 'todo' ? null : <span className="ds-progress-inner" />}
              </span>
              {i < last ? (
                <span
                  className={
                    'ds-progress-line' +
                    (i < activeIndex ? ' ds-progress-line-filled' : '') +
                    (i === activeIndex - 1 ? ' ds-progress-line-advancing' : '')
                  }
                />
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
