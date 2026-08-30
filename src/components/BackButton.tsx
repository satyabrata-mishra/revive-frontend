import { useEffect, useSyncExternalStore } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  getNavHistorySnapshot,
  recordNavLocation,
  stepNavBack,
  stepNavForward,
  subscribeNavHistory,
} from '../lib/navHistory'

type Props = {
  className?: string
  onRefresh?: () => void
}

function pathOf(loc: { pathname: string; search: string; hash: string }) {
  return `${loc.pathname}${loc.search}${loc.hash}`
}

export function HistoryNav({ className = '', onRefresh }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const snap = useSyncExternalStore(
    subscribeNavHistory,
    getNavHistorySnapshot,
    getNavHistorySnapshot,
  )

  // Keep shared stack in sync with every route under AppLayout.
  useEffect(() => {
    recordNavLocation(pathOf(location), location.key)
  }, [location.pathname, location.search, location.hash, location.key])

  function goBack() {
    const target = stepNavBack()
    if (target != null) navigate(target)
  }

  function goForward() {
    const target = stepNavForward()
    if (target != null) navigate(target)
  }

  return (
    <div className={`history-nav ${className}`.trim()} role="group" aria-label="Page navigation">
      <button
        type="button"
        className="nav-history-btn"
        onClick={goBack}
        disabled={!snap.canBack}
        aria-label="Go back"
        title={snap.canBack ? `Back to ${snap.backPath}` : 'No previous page'}
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
          onClick={goForward}
          disabled={!snap.canForward}
          aria-label="Go forward"
          title={snap.canForward ? `Forward to ${snap.forwardPath}` : 'No next page'}
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
