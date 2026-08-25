import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

type HistState = {
  stack: string[]
  index: number
}

type Props = {
  className?: string
  onRefresh?: () => void
}

export function HistoryNav({ className = '', onRefresh }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [hist, setHist] = useState<HistState>({
    stack: [location.key],
    index: 0,
  })

  useEffect(() => {
    setHist((prev) => {
      const existing = prev.stack.indexOf(location.key)
      if (existing !== -1) {
        return { stack: prev.stack, index: existing }
      }
      const stack = [...prev.stack.slice(0, prev.index + 1), location.key]
      return { stack, index: stack.length - 1 }
    })
  }, [location.key])

  const canBack = hist.index > 0
  const canForward = hist.index < hist.stack.length - 1

  return (
    <div className={`history-nav ${className}`.trim()} role="group" aria-label="Page navigation">
      <button
        type="button"
        className="nav-history-btn"
        onClick={() => navigate(-1)}
        disabled={!canBack}
        aria-label="Go back"
        title={canBack ? 'Back' : 'No previous page'}
      >
        <span aria-hidden="true">←</span>
      </button>
      <div className="history-nav-right">
        {onRefresh && (
          <button
            type="button"
            className="nav-history-btn"
            onClick={onRefresh}
            aria-label="Refresh page"
            title="Refresh"
          >
            <span aria-hidden="true">↻</span>
          </button>
        )}
        <button
          type="button"
          className="nav-history-btn"
          onClick={() => navigate(1)}
          disabled={!canForward}
          aria-label="Go forward"
          title={canForward ? 'Forward' : 'No next page'}
        >
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

/** @deprecated Prefer HistoryNav */
export function BackButton(props: Props) {
  return <HistoryNav {...props} />
}
