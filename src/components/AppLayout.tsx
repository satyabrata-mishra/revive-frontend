import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { HistoryNav } from './BackButton'

const links = [
  { to: '/dashboard', label: 'Dashboard', end: true },
  { to: '/cases', label: 'Cases' },
  { to: '/monitoring', label: 'Monitoring' },
  { to: '/review', label: 'Human Review' },
  { to: '/audit', label: 'Audit' },
]

export function AppLayout() {
  const [refreshKey, setRefreshKey] = useState(0)
  const [toolbarStuck, setToolbarStuck] = useState(false)
  const sentinelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setToolbarStuck(!entry.isIntersecting)
      },
      { threshold: 0, rootMargin: '-68px 0px 0px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="app-shell">
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
      <div ref={sentinelRef} className="page-toolbar-sentinel" aria-hidden="true" />
      <div className={`page-toolbar${toolbarStuck ? ' is-stuck' : ''}`}>
        <HistoryNav onRefresh={() => setRefreshKey((k) => k + 1)} />
      </div>
      <main className="main">
        <Outlet key={refreshKey} />
      </main>
    </div>
  )
}
