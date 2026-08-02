import type { ReactNode } from 'react'
import { AnimatePresence, m, useReducedMotion } from 'motion/react'
import { FADE, SHEET } from '../motion'
import './BottomSheet.css'

export interface BottomSheetProps {
  open: boolean
  onClose?: () => void
  className?: string
  children: ReactNode
}

/* The rise/fall lives here rather than in CSS because a sheet has to animate on
 * the way *out* too, and CSS cannot animate an element that is already gone —
 * `open === false` used to just drop it from the tree. AnimatePresence holds it
 * for the length of the exit. Every call site drives this with an `open` prop
 * and keeps the sheet mounted, so none of them needed changing.
 *
 * No drag-to-dismiss: all twelve sheets set `.ds-sheet-handle { display: none }`,
 * so there is no grab affordance to hang it off, and four of them scroll their
 * body — a whole-sheet drag listener would eat those scrolls. Tap-the-scrim is
 * the design's dismissal. Add drag if a handle ever shows up.
 */
export function BottomSheet({ open, onClose, className, children }: BottomSheetProps) {
  /* The rise is a transform, so `reducedMotion="user"` suppresses it already.
   * The scrim is opacity, which motion keeps animating even then — so skip the
   * entrance outright and let a reduced-motion capture be correct on frame 1. */
  const still = useReducedMotion()

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          className="ds-sheet-overlay"
          onClick={onClose}
          initial={still ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={FADE}
        >
          <m.div
            className={'ds-sheet' + (className ? ' ' + className : '')}
            onClick={(e) => e.stopPropagation()}
            initial={still ? false : { y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={SHEET}
          >
            <div className="ds-sheet-handle" />
            {children}
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
