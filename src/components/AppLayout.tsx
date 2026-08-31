import { useEffect, useId, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { HistoryNav } from './BackButton'

type NavLeaf = {
  to: string
  label: string
  purpose: string
  end?: boolean
}

type NavMenu = {
  id: string
  label: string
  items: NavLeaf[]
}

const menus: NavMenu[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      {
        to: '/control-tower',
        label: 'Control Tower',
        purpose: 'Live ops view — what Revive is doing and what needs humans',
      },
      {
        to: '/war-room',
        label: 'Recovery War Room',
        purpose: 'Critical recovery incidents — coordinate humans and AI to resolve',
      },
      {
        to: '/dashboard',
        label: 'Dashboard',
        purpose: 'Portfolio pulse — money at risk, recovered, and what needs attention',
        end: true,
      },
    ],
  },
  {
    id: 'recover',
    label: 'Recover',
    items: [
      {
        to: '/cases',
        label: 'Cases',
        purpose: 'Recovery work queue — prioritize by money at stake',
      },
      {
        to: '/review',
        label: 'Human Review',
        purpose: 'Authorize policy-gated actions with evidence',
      },
      {
        to: '/monitoring',
        label: 'Monitoring',
        purpose: 'What is happening to recovery cases right now',
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    items: [
      {
        to: '/forecast',
        label: 'Recovery Forecast',
        purpose: 'How much can you recover over 7 / 14 / 30 days',
      },
      {
        to: '/audit',
        label: 'Decision Audit',
        purpose: 'Why did Revive take this decision — full trail',
      },
    ],
  },
  {
    id: 'optimize',
    label: 'Optimize',
    items: [
      {
        to: '/strategy-lab',
        label: 'Recovery Strategy Lab',
        purpose: 'What recovery strategy should I use across my portfolio?',
      },
      {
        to: '/simulator',
        label: 'Case Simulator',
        purpose: 'What happens if I take this action on one case?',
      },
    ],
  },
]

function pathMatches(pathname: string, to: string, end?: boolean) {
  if (end) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function menuIsActive(pathname: string, menu: NavMenu) {
  return menu.items.some((item) => pathMatches(pathname, item.to, item.end))
}

function NavDropdown({
  menu,
  openId,
  setOpenId,
}: {
  menu: NavMenu
  openId: string | null
  setOpenId: (id: string | null) => void
}) {
  const location = useLocation()
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const open = openId === menu.id
  const active = menuIsActive(location.pathname, menu)

  useEffect(() => {
    setOpenId(null)
  }, [location.pathname, setOpenId])

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpenId(null)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpenId])

  return (
    <div
      ref={rootRef}
      className={`nav-dropdown${open ? ' is-open' : ''}${active ? ' is-active' : ''}`}
      onMouseEnter={() => setOpenId(menu.id)}
      onMouseLeave={() => setOpenId(null)}
    >
      <button
        type="button"
        className={`nav-link nav-dropdown-trigger${active ? ' active' : ''}${open ? ' is-open' : ''}`}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpenId(open ? null : menu.id)}
      >
        {menu.label}
        <span className="nav-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div id={menuId} className="nav-menu" role="menu">
        {menu.items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            role="menuitem"
            className={({ isActive }) =>
              isActive ? 'nav-menu-item is-active' : 'nav-menu-item'
            }
            onClick={() => setOpenId(null)}
          >
            <span className="nav-menu-item-label">{item.label}</span>
            <span className="nav-menu-item-purpose">{item.purpose}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}

export function AppLayout() {
  const location = useLocation()
  const isIntelligence = location.pathname.startsWith('/intelligence')
  const isCopilot = /\/cases\/[^/]+\/copilot\/?$/.test(location.pathname)
  const isLockedWorkspace = isIntelligence || isCopilot
  const [refreshKey, setRefreshKey] = useState(0)
  const [toolbarStuck, setToolbarStuck] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
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
    if (!isLockedWorkspace) return
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
  }, [isLockedWorkspace])

  const shellClass = [
    'app-shell',
    isIntelligence ? 'app-shell-intel' : '',
    isCopilot ? 'app-shell-copilot' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const mainClass = [
    'main',
    isIntelligence ? 'main-intel' : '',
    isCopilot ? 'main-copilot' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={shellClass}>
      <header className="topbar">
        <Link to="/" className="brand-block brand-link">
          <img src="/revive-logo.png" alt="" className="topbar-logo" />
          <div>
            <span className="brand">REVIVE</span>
            <span className="brand-sub">Recover Revenue. Intelligently.</span>
          </div>
        </Link>
        <nav className="nav" aria-label="Primary">
          {menus.map((menu) => (
            <NavDropdown
              key={menu.id}
              menu={menu}
              openId={openId}
              setOpenId={setOpenId}
            />
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
      {/* One shared history toolbar for every AppLayout page (incl. Copilot + ReviveIQ). */}
      {!isIntelligence && (
        <>
          <div ref={sentinelRef} className="page-toolbar-sentinel" aria-hidden="true" />
          <div
            className={`page-toolbar${toolbarStuck ? ' is-stuck' : ''}${isCopilot ? ' copilot-toolbar' : ''}`}
          >
            <HistoryNav onRefresh={() => setRefreshKey((k) => k + 1)} />
          </div>
        </>
      )}
      {isIntelligence && (
        <div className="page-toolbar intel-history-toolbar">
          <HistoryNav onRefresh={() => setRefreshKey((k) => k + 1)} />
        </div>
      )}
      <main className={mainClass}>
        <Outlet key={refreshKey} />
      </main>

      {!isLockedWorkspace && (
        <Link
          to="/intelligence"
          className="ask-revive-launcher"
          title="Ask Revive IQ — portfolio answers with evidence (read-only)"
        >
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
