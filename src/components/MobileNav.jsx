import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, ArrowLeftRight, Bell, Landmark, MoreHorizontal } from 'lucide-react'

const TABS = [
  { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { path: '/transactions', label: 'Txns', icon: ArrowLeftRight },
  { path: '/alerts', label: 'Alerts', icon: Bell },
  { path: '/banks', label: 'Banks', icon: Landmark },
  { path: '/settings', label: 'More', icon: MoreHorizontal },
]

/**
 * MobileNav — bottom tab bar for mobile screens.
 * Shows on screens < 1024px. Replaces hamburger sidebar navigation.
 * Fixed to bottom, 5 tabs, active state indicator.
 */
export default function MobileNav() {
  const location = useLocation()

  // Match active tab — handle sub-routes
  function isActive(path) {
    if (path === '/dashboard') return location.pathname === '/dashboard' || location.pathname === '/'
    if (path === '/settings') {
      // "More" tab catches everything not in the other 4 tabs
      return !['/dashboard', '/', '/transactions', '/alerts', '/banks'].includes(location.pathname)
    }
    return location.pathname.startsWith(path)
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-border bg-card/95 backdrop-blur-lg safe-area-bottom">
      <div className="flex items-center justify-around h-[56px] px-2">
        {TABS.map(tab => {
          const active = isActive(tab.path)
          const Icon = tab.icon
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className="flex flex-col items-center justify-center gap-0.5 w-16 h-full relative"
            >
              {/* Active indicator dot */}
              {active && (
                <span className="absolute top-1 w-1 h-1 rounded-full bg-cyan" />
              )}
              <Icon
                size={20}
                strokeWidth={active ? 2.2 : 1.8}
                className={`transition-colors ${active ? 'text-cyan' : 'text-t3'}`}
              />
              <span className={`text-[9px] font-medium tracking-wide transition-colors ${active ? 'text-cyan' : 'text-t4'}`}>
                {tab.label}
              </span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
