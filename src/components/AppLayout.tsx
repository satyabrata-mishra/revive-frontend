import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { HistoryNav } from './BackButton'

const links = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/forecast', label: 'Forecast' },
  { to: '/cases', label: 'Cases' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/review', label: 'Human Review' },
  { to: '/audit', label: 'Audit' },
  { to: '/simulator', label: 'Simulator' },
  { to: '/strategy-lab', label: 'Strategy Lab' },
]

export function AppLayout() {
  const location = useLocation()
  const isIntelligence = location.pathname.startsWith('/intelligence')
  const [refreshKey, setRefreshKey] = useState(0)
  const [toolbarStuck, setToolbarStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isIntelligence) return
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setToolbarStuck(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-64px 0px 0px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isIntelligence])

  useEffect(() => {
    if (!isIntelligence) return
    const root = document.getElementById('root')
    const prevHtml = document.documentElement.style.overflow
    const prevBody = document.body.style.overflow
    const prevHtmlH = document.documentElement.style.height
    const prevBodyH = document.body.style.height
    const prevRootH = root?.style.height ?? ''
    const prevRootO = root?.style.overflow ?? ''
    document.documentElement.style.overflow = 'hidden'
    document.documentElement.style.height = '100%'
    document.body.style.overflow = 'hidden'
    document.body.style.height = '100%'
    if (root) {
      root.style.height = '100%'
      root.style.overflow = 'hidden'
    }
    return () => {
      document.documentElement.style.overflow = prevHtml
      document.documentElement.style.height = prevHtmlH
      document.body.style.overflow = prevBody
      document.body.style.height = prevBodyH
      if (root) {
        root.style.height = prevRootH
        root.style.overflow = prevRootO
      }
    }
  }, [isIntelligence])

  return (
    <div className={`app-shell${isIntelligence ? ' app-shell-intel' : ''}`}>
      <header className="topbar">
        <Link to="/" className="brand-block brand-link">
          <img src="/revive-logo.png" alt="" className="topbar-logo" />
          <div>
            <span className="brand">REVIVE</span>
            <span className="brand-sub">Recover Revenue. Intelligently.</span>
          </div>
        </Link>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="merchant-chip" title="Signed in merchant context">
          <span className="merchant-avatar" aria-hidden="true">
            AC
          </span>
          <span className="merchant-meta">
            <span className="merchant-label">Merchant</span>
            <span className="merchant-name">AcmeCloud</span>
          </span>
          <span className="merchant-status" aria-label="Active">
            Live
          </span>
        </div>
      </header>
      {!isIntelligence && (
        <>
          <div ref={sentinelRef} className="page-toolbar-sentinel" aria-hidden="true" />
          <div className={`page-toolbar${toolbarStuck ? ' is-stuck' : ''}`}>
            <HistoryNav onRefresh={() => setRefreshKey((k) => k + 1)} />
          </div>
        </>
      )}
      <main className={`main${isIntelligence ? ' main-intel' : ''}`}>
        <Outlet key={isIntelligence ? 'intel' : refreshKey} />
      </main>

      {!isIntelligence && (
        <Link to="/intelligence" className="ask-revive-launcher" title="Ask Revive IQ">
          <span className="ask-revive-launcher-core">
            <span className="ask-revive-launcher-icon" aria-hidden="true">
              <span className="ask-revive-launcher-mark">✦</span>
            </span>
            <span className="ask-revive-launcher-label">Ask Revive IQ</span>
          </span>
        </Link>
      )}
    </div>
  )
}
