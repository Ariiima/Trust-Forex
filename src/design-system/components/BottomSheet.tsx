import { useEffect, useRef } from 'react'
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
 * No drag-to-dismiss and so no grab handle: nothing here drags, and four sheets
 * scroll their body, which a whole-sheet drag listener would eat. Tap-the-scrim
 * is the design's dismissal. Add both together if drag ever lands.
 */
export function BottomSheet({ open, onClose, className, children }: BottomSheetProps) {
  /* The rise is a transform, so `reducedMotion="user"` suppresses it already.
   * The scrim is opacity, which motion keeps animating even then — so skip the
   * entrance outright and let a reduced-motion capture be correct on frame 1. */
  const still = useReducedMotion()
  const overlayRef = useRef<HTMLDivElement>(null)

  /* Stop the page behind the sheet from scrolling.
   *
   * Done by refusing the gesture on the overlay rather than by locking the
   * document, because both of the usual document locks are worse here:
   * `position: fixed` on the body takes it out of flow and reflows the page the
   * sheet is covering (worth 0.05 on the cashback-history diff, whose reference
   * frame captures a sheet already open), and `overflow: hidden` on the root
   * clamps the scroll offset to 0, so the page visibly jumps to the top behind
   * the scrim. A sheet should change nothing about what it covers.
   *
   * Scrollable content *inside* the sheet still works: the handler walks up
   * from the target and bows out if it finds a scroller with room left, so the
   * history lists keep scrolling while the page behind stays put.
   *
   * Native listeners because both events must be non-passive to be
   * cancellable, and React attaches touchmove as passive. */
  useEffect(() => {
    const el = overlayRef.current
    if (!open || !el) return

    const stop = (e: Event) => {
      for (let n = e.target as HTMLElement | null; n && n !== el; n = n.parentElement) {
        const oy = getComputedStyle(n).overflowY
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight) return
      }
      e.preventDefault()
    }

    el.addEventListener('wheel', stop, { passive: false })
    el.addEventListener('touchmove', stop, { passive: false })
    return () => {
      el.removeEventListener('wheel', stop)
      el.removeEventListener('touchmove', stop)
    }
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <m.div
          className="ds-sheet-overlay"
          ref={overlayRef}
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
            {children}
          </m.div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
