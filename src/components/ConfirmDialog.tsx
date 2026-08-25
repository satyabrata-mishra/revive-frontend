import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: 'primary' | 'danger'
  busy?: boolean
  /** When set, shows an optional note field in the dialog. */
  note?: string
  notePlaceholder?: string
  onNoteChange?: (note: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
  busy = false,
  note,
  notePlaceholder = 'Optional note…',
  onNoteChange,
  onConfirm,
  onCancel,
}: Props) {
  const confirmRef = useRef<HTMLButtonElement>(null)
  const noteRef = useRef<HTMLTextAreaElement>(null)
  const showNote = typeof note === 'string' && !!onNoteChange

  useEffect(() => {
    if (!open) return
    if (showNote) noteRef.current?.focus()
    else confirmRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !busy) onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onCancel, showNote])

  if (!open) return null

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel()
      }}
    >
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-desc"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="confirm-dialog-title">{title}</h3>
        <p id="confirm-dialog-desc">{message}</p>
        {showNote && (
          <label className="dialog-note">
            <span>Optional reviewer note</span>
            <textarea
              ref={noteRef}
              className="note-input"
              rows={3}
              placeholder={notePlaceholder}
              value={note}
              disabled={busy}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </label>
        )}
        <div className="dialog-actions">
          <button type="button" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={tone === 'danger' ? 'danger' : 'primary'}
            disabled={busy}
            aria-busy={busy}
            onClick={onConfirm}
          >
            {busy ? (
              <span
                className={`loading-spinner loading-spinner-sm${tone === 'primary' ? ' on-dark' : ''}`}
                aria-hidden="true"
              />
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
