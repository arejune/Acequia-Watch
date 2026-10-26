// One shell for every role: app bar, screen transition, and tabs (bottom bar on
// phones, side rail on wide screens). Pushed screens (forms, details) hide tabs.
import { useEffect } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, ChevronLeft, ClipboardCheck, Compass, Gamepad2, House, LayoutDashboard, ListChecks, Map, Megaphone, Menu, ShieldCheck } from 'lucide-react'
import { useSession } from './session'
import { startAutoSync } from '../db/sync'
import { useOutboxSummary } from '../lib/hooks'
import { Notice, SyncPill } from '../components/ui'
import { haptic, WaterLine } from '../components/native'
import { Tour } from '../components/Tour'
import { TOURS } from './tours'
import type { Role } from '../db/types'

interface Tab { to: string; label: string; icon: typeof House; match: RegExp }

/** The public side, shown as its own section for anyone signed in. */
const COMMUNITY: Tab[] = [
  { to: '/explore', label: 'Front page', icon: Compass, match: /^\/explore/ },
  { to: '/learn', label: 'Learn', icon: BookOpen, match: /^\/learn/ },
  { to: '/act', label: 'Issues and bills', icon: Megaphone, match: /^\/act/ },
  { to: '/play', label: 'Play Turno', icon: Gamepad2, match: /^\/play/ },
]

const EXPLORE: Tab = { to: '/explore', label: 'Explore', icon: Compass, match: /^\/(explore|learn|act|play)/ }

function tabsFor(role: Role | null): Tab[] {
  if (role === 'steward') return [
    { to: '/steward', label: 'Home', icon: House, match: /^\/steward$/ },
    { to: '/steward/assess', label: 'Assess', icon: ClipboardCheck, match: /^\/steward\/assess/ },
    { to: '/map', label: 'Map', icon: Map, match: /^\/map/ },
    EXPLORE,
    { to: '/more', label: 'More', icon: Menu, match: /^\/more/ },
  ]
  if (role === 'agency' || role === 'admin') return [
    { to: '/agency', label: 'Overview', icon: LayoutDashboard, match: /^\/agency$/ },
    { to: '/map', label: 'Map', icon: Map, match: /^\/map/ },
    { to: '/agency/reports', label: 'Reports', icon: ListChecks, match: /^\/agency\/reports/ },
    ...(role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: ShieldCheck, match: /^\/admin/ }] : [EXPLORE]),
    { to: '/more', label: 'More', icon: Menu, match: /^\/more/ },
  ]
  return [
    { to: '/explore', label: 'Home', icon: House, match: /^\/explore/ },
    { to: '/learn', label: 'Learn', icon: BookOpen, match: /^\/learn/ },
    { to: '/act', label: 'Act', icon: Megaphone, match: /^\/act/ },
    { to: '/play', label: 'Play', icon: Gamepad2, match: /^\/play/ },
    { to: '/map', label: 'Map', icon: Map, match: /^\/map/ },
  ]
}

/** Screens that are "pushed" on top of a tab: no tab bar, back button instead. */
const PUSHED = [/^\/act\/.+/, /^\/steward\/report\//, /^\/steward\/inventory\/.+/, /^\/steward\/quick/, /^\/steward\/sync/, /^\/steward\/reports/, /^\/steward\/inventory$/]

/** Routes each role may open; anything else sends them home. */
const ALLOWED: Record<Role | 'guest', RegExp> = {
  guest: /^\/(explore|learn|act|play|map)/,
  steward: /^\/(steward|map|explore|learn|act|play|more)/,
  agency: /^\/(agency|map|explore|learn|act|play|more)/,
  admin: /^\/(agency|admin|map|explore|learn|act|play|more)/,
}

export const homeFor = (role: Role | null) => (role === 'steward' ? '/steward' : role ? '/agency' : '/explore')

export function AppShell() {
  const { profile, ready, expired } = useSession()
  const loc = useLocation()
  const nav = useNavigate()
  const { waiting } = useOutboxSummary()
  const role = profile?.role ?? null
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    if (role === 'steward') return startAutoSync()
  }, [role])

  // app-icon badge with the number of unsent items (where supported)
  useEffect(() => {
    const n = navigator as Navigator & { setAppBadge?: (n: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
    ;(waiting ? n.setAppBadge?.(waiting) : n.clearAppBadge?.())?.catch(() => {})
  }, [waiting])

  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])

  if (!ready) return null
  if (!ALLOWED[role ?? 'guest'].test(loc.pathname)) {
    return <Navigate to={role ? homeFor(role) : '/signin'} replace state={{ from: loc.pathname }} />
  }

  const tabs = tabsFor(role)
  const pushed = PUSHED.some((r) => r.test(loc.pathname))
  const active = tabs.findIndex((t) => t.match.test(loc.pathname))
  const tour = TOURS[role ?? 'guest']
  const forceTour = params.get('tour') === '1'

  return (
    <div className={`app${pushed ? ' app-pushed' : ''}`}>
      <nav className="rail" aria-label="Sections">
        <Link to={homeFor(role)} className="rail-brand" aria-label="Acequia Watch home">
          <img src="/icon.svg" alt="" width={36} height={36} /> <span>Acequia Watch</span>
        </Link>
        {(role ? tabs.filter((t) => t !== EXPLORE) : tabs).map(({ to, label, icon: Icon }, i) => (
          <Link key={to} to={to} aria-current={i === active ? 'page' : undefined} onClick={() => haptic()}>
            <Icon size={22} aria-hidden /> {label}
            {label === 'More' && waiting > 0 && <span className="badge">{waiting}</span>}
          </Link>
        ))}
        {role && (
          <>
            <p className="rail-section">Community</p>
            {COMMUNITY.map(({ to, label, icon: Icon, match }) => (
              <Link key={to} to={to} aria-current={match.test(loc.pathname) ? 'page' : undefined} onClick={() => haptic()}>
                <Icon size={22} aria-hidden /> {label}
              </Link>
            ))}
          </>
        )}
      </nav>

      <div className="app-main">
        <header className="appbar">
          {pushed ? (
            <button className="appbar-back" onClick={() => (window.history.length > 1 ? nav(-1) : nav(homeFor(role)))}>
              <ChevronLeft size={24} aria-hidden /> Back
            </button>
          ) : (
            <Link to={homeFor(role)} className="appbar-brand">
              <img src="/icon.svg" alt="" width={28} height={28} />
              <span>Acequia Watch</span>
            </Link>
          )}
          {role === 'steward' ? <span data-tour="sync"><SyncPill /></span> : role ? <span className="role-pill">{role === 'admin' ? 'Admin' : 'Agency · read only'}</span> : <Link className="btn btn-small" to="/signin" data-tour="signin">Sign in</Link>}
          <WaterLine />
        </header>

        {expired && (
          <div className="screen-pad">
            <Notice tone="warn"><strong>Session expired.</strong> Everything you save stays on this phone. <Link to="/signin">Sign in when you have signal</Link> to send it.</Notice>
          </div>
        )}

        <main id="main" className="screen" key={loc.pathname}>
          <Outlet />
        </main>
      </div>

      {loc.pathname === tour.home && (
        <Tour key={`${role}-${forceTour}`} id={role ?? 'guest'} steps={tour.steps} requires={tour.requires} force={forceTour} onEnd={() => forceTour && setParams({}, { replace: true })} />
      )}

      {!pushed && (
        <nav className="tabbar" aria-label="Sections" style={{ '--n': tabs.length, '--i': Math.max(0, active) } as React.CSSProperties}>
          {active >= 0 && <span className="tab-indicator" aria-hidden />}
          {tabs.map(({ to, label, icon: Icon }, i) => (
            <Link key={to} to={to} aria-current={i === active ? 'page' : undefined} onClick={() => haptic()}>
              <span className="tab-icon"><Icon size={23} strokeWidth={i === active ? 2.4 : 2} aria-hidden /></span>
              {label}
              {label === 'More' && waiting > 0 && <span className="badge" aria-label={`${waiting} waiting to sync`}>{waiting}</span>}
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}
