import type { ReactNode } from 'react'
import './BottomSheet.css'

export interface BottomSheetProps {
  open: boolean
  onClose?: () => void
  className?: string
  children: ReactNode
}

export function BottomSheet({ open, onClose, className, children }: BottomSheetProps) {
  if (!open) return null
  return (
    <div className="ds-sheet-overlay" onClick={onClose}>
      <div
        className={'ds-sheet' + (className ? ' ' + className : '')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ds-sheet-handle" />
        {children}
      </div>
    </div>
  )
}
