import { NavLink, Outlet, useLocation, Link } from 'react-router-dom'
import ErrorBoundary, { SectionBoundary } from '@/components/ErrorBoundary'
import MobileNav from '@/components/MobileNav'
import { useAuth } from '@/hooks/useAuth'
import { usePlaid } from '@/hooks/usePlaid'
import {
  LayoutDashboard, DollarSign, Activity, List,
  CreditCard, FileText, Receipt, Settings, LogOut, MessageSquare, RefreshCw, Users, Upload,
  Bell, Layers, Globe, Building2, Code, Shield, Plug, Lock, Leaf, Gift, Package, TrendingUp, Wallet, Eye,
  PanelLeftClose, PanelLeftOpen, Menu, X, Clock, Megaphone, Brain, Palette, BookOpen, Send as SendIcon, Zap as ZapIcon,
  Sparkles, AlertTriangle, ShieldAlert, ClipboardCheck, ChevronRight
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import clsx from 'clsx'
import Copilot from '@/components/Copilot'
import CommandPalette from '@/components/CommandPalette'
import { TrialBar, DunningBanner, WinBackBanner } from '@/components/CustomerJourney'
import NotificationCenter from '@/components/NotificationCenter'
import { useNavigation, trackFeature } from '@/hooks/useNavigation'
import { useTheme } from '@/hooks/useTheme'
import ThemeToggle from '@/components/ThemeToggle'

const NAV = [
  { section: 'Treasury', items: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/position', icon: DollarSign, label: 'Cash Position' },
    { to: '/forecast', icon: Activity, label: 'Forecasting' },
    { to: '/scenarios', icon: Layers, label: 'Scenarios' },
    { to: '/currencies', icon: Globe, label: 'Multi-Currency' },
  ]},
  { section: 'Operations', items: [
    { to: '/transactions', icon: List, label: 'Transactions' },
    { to: '/banks', icon: CreditCard, label: 'Bank Connections' },
    { to: '/payments', icon: Wallet, label: 'Payments' },
    { to: '/reports', icon: FileText, label: 'Reports' },
    { to: '/alerts', icon: Bell, label: 'Alerts' },
  ]},
  { section: 'Compliance', items: [
    { to: '/audit-center', icon: ClipboardCheck, label: 'Audit Center' },
    { to: '/security-center', icon: Shield, label: 'Security' },
    { to: '/audit', icon: Eye, label: 'Audit Log' },
  ]},
  { section: 'Account', items: [
    { to: '/team', icon: Users, label: 'Team' },
    { to: '/billing', icon: Receipt, label: 'Billing' },
    { to: '/settings', icon: Settings, label: 'Settings' },
    { to: '/support', icon: MessageSquare, label: 'Support' },
  ]},
]

// Extended nav — accessible via sidebar "More" toggle + Cmd+K
const NAV_MORE = [
  { to: '/cash-visibility', icon: Eye, label: 'Cash Visibility' },
  { to: '/entities', icon: Building2, label: 'Entities' },
  { to: '/payment-hub', icon: SendIcon, label: 'Payment Hub' },
  { to: '/import', icon: Upload, label: 'Import Data' },
  { to: '/time', icon: Clock, label: 'Time Manager' },
  { to: '/integrations', icon: Plug, label: 'Integrations' },
  { to: '/api', icon: Code, label: 'API Access' },
  { to: '/ecosystem', icon: Package, label: 'Ecosystem' },
  { to: '/sso', icon: Lock, label: 'SSO & Security' },
  { to: '/privacy-center', icon: Eye, label: 'Privacy Center' },
  { to: '/resources', icon: BookOpen, label: 'Resources' },
  { to: '/industry', icon: Building2, label: 'Industry Hub' },
  { to: '/data-intelligence', icon: Brain, label: 'Data Intelligence' },
  { to: '/opportunities', icon: Sparkles, label: 'Opportunities' },
  { to: '/weaknesses', icon: AlertTriangle, label: 'Weaknesses' },
  { to: '/threats', icon: ShieldAlert, label: 'Threats' },
  { to: '/automation', icon: ZapIcon, label: 'Automation' },
  { to: '/marketing', icon: Megaphone, label: 'Marketing' },
  { to: '/ux', icon: Palette, label: 'UX Preferences' },
  { to: '/design-system', icon: Palette, label: 'Design System' },
]

const PAGE_META = {
  '/dashboard': { title: 'Dashboard', sub: 'Overview across all entities' },
  '/position': { title: 'Cash Position', sub: 'Real-time balances across all accounts' },
  '/forecast': { title: 'Forecasting', sub: 'AI-powered cash flow predictions' },
  '/scenarios': { title: 'Scenarios', sub: 'Model cash outcomes under different assumptions' },
  '/currencies': { title: 'Multi-Currency', sub: 'FX rates, positions & currency alerts' },
  '/entities': { title: 'Entities', sub: 'Multi-entity consolidated treasury view' },
  '/transactions': { title: 'Transactions', sub: 'Smart categorization & tagging' },
  '/banks': { title: 'Bank Connections', sub: 'Connected financial institutions' },
  '/reports': { title: 'Reports', sub: 'Generate & schedule treasury reports' },
  '/payments': { title: 'Payments', sub: 'Accounts receivable & payable tracking' },
  '/alerts': { title: 'Alerts', sub: 'Smart treasury notifications & thresholds' },
  '/import': { title: 'Import Data', sub: 'Upload CSV, add accounts, connect software' },
  '/integrations': { title: 'Integrations', sub: 'Connect Slack, ERPs, webhooks & more' },
  '/api': { title: 'API Access', sub: 'Keys, endpoints & usage metrics' },
  '/audit': { title: 'Audit Log', sub: 'Security & compliance event history' },
  '/sso': { title: 'SSO & Security', sub: 'Identity providers, MFA & access policies' },
  '/billing': { title: 'Billing & Plans', sub: 'Manage your subscription' },
  '/team': { title: 'Team', sub: 'Manage members & roles' },
  '/settings': { title: 'Settings', sub: 'Workspace & notification preferences' },
  '/docs': { title: 'API Documentation', sub: 'Endpoints, authentication & webhooks' },
  '/ecosystem': { title: 'Ecosystem', sub: 'Products, referrals & bundle discounts' },
  '/products/financeos': { title: 'FinanceOS', sub: 'Cloud FP&A — planning, budgeting & consolidation' },
  '/products/parallax': { title: 'Parallax', sub: 'Aerospace supplier compliance management' },
  '/support': { title: 'Support', sub: 'Tickets, knowledge base & help center' },
  '/partner-admin': { title: 'Partners', sub: 'Referral tracking & commission management' },
  '/security-center': { title: 'Security Center', sub: 'Security posture, events & policies' },
  '/privacy-center': { title: 'Privacy Center', sub: 'Consent, DSRs & data retention' },
  '/time': { title: 'Time Manager', sub: 'Scheduled tasks, time tracking & timezones' },
  '/marketing': { title: 'Marketing Hub', sub: 'Campaigns, content & social calendar' },
  '/industry': { title: 'Industry Hub', sub: 'Vertical onboarding, compliance & diversity' },
  '/data-intelligence': { title: 'Data Intelligence', sub: 'Quality, insights, lineage & reports' },
  '/cash-visibility': { title: 'Cash Visibility', sub: 'Real-time positions, sweeps & liquidity buffers' },
  '/ux': { title: 'UX Preferences', sub: 'Accessibility, display, guided help & feedback' },
  '/resources': { title: 'Resources', sub: 'Guides, templates, quick links & help center' },
  '/payment-hub': { title: 'Payment Hub', sub: 'Send payments, manage payees & approvals' },
  '/design-system': { title: 'Design System', sub: 'Components, page states & themes' },
  '/automation': { title: 'Automation', sub: 'Rules engine, webhooks & changelog' },
  '/opportunities': { title: 'Opportunities', sub: 'AI-detected opportunities, scoring & capture' },
  '/weaknesses': { title: 'Weaknesses', sub: 'Internal gaps, remediation & health scanning' },
  '/threats': { title: 'Threats', sub: 'External risks, monitoring & countermeasures' },
  '/audit-center': { title: 'Audit Center', sub: 'Programs, checklists, findings & compliance' },
}

export default function Layout() {
  const { profile, org, signOut } = useAuth()
  const location = useLocation()
  const meta = PAGE_META[location.pathname] || { title: 'Vaultline', sub: '' }
  const [copilotOpen, setCopilotOpen] = useState(false)
  const { syncAccounts, syncing } = usePlaid()
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('vaultline-sidebar') === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [showMore, setShowMore] = useState(false)
  const { isDark } = useTheme()
  useNavigation()

  // ═══ SWIPE DETECTION for sidebar ═══
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const sidebarRef = useRef(null)

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  function handleTouchEnd(e) {
    if (touchStartX.current === null) return
    const deltaX = e.changedTouches[0].clientX - touchStartX.current
    const deltaY = e.changedTouches[0].clientY - touchStartY.current
    const isHorizontal = Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50
    if (!isHorizontal) { touchStartX.current = null; return }

    const isMobile = window.innerWidth < 1024
    if (isMobile) {
      // Swipe right → open, swipe left → close
      if (deltaX > 0 && !mobileOpen) setMobileOpen(true)
      if (deltaX < 0 && mobileOpen) setMobileOpen(false)
    } else {
      // Desktop: swipe left → collapse, swipe right → expand
      if (deltaX < 0 && !collapsed) { setCollapsed(true); localStorage.setItem('vaultline-sidebar', 'collapsed') }
      if (deltaX > 0 && collapsed) { setCollapsed(false); localStorage.setItem('vaultline-sidebar', 'expanded') }
    }
    touchStartX.current = null
  }

  // Edge swipe: swipe from left edge of screen to open sidebar (mobile)
  useEffect(() => {
    function edgeSwipeStart(e) {
      if (e.touches[0].clientX < 20 && window.innerWidth < 1024) {
        touchStartX.current = e.touches[0].clientX
        touchStartY.current = e.touches[0].clientY
      }
    }
    function edgeSwipeEnd(e) {
      if (touchStartX.current !== null && touchStartX.current < 20) {
        const deltaX = e.changedTouches[0].clientX - touchStartX.current
        if (deltaX > 60) setMobileOpen(true)
        touchStartX.current = null
      }
    }
    document.addEventListener('touchstart', edgeSwipeStart, { passive: true })
    document.addEventListener('touchend', edgeSwipeEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', edgeSwipeStart)
      document.removeEventListener('touchend', edgeSwipeEnd)
    }
  }, [])

  // Close mobile sidebar on nav + scroll to top
  useEffect(() => {
    setMobileOpen(false)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [location.pathname])

  // Persist collapse state
  function toggleCollapse() {
    const next = !collapsed
    setCollapsed(next)
    localStorage.setItem('vaultline-sidebar', next ? 'collapsed' : 'expanded')
  }

  const initials = profile?.full_name
    ?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  return (
    <div className={`flex h-screen overflow-hidden ${!isDark ? 'warm-accent-top relative' : ''}`}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar — terminal panel */}
      <aside
        ref={sidebarRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={clsx(
        'flex flex-col glass relative terminal-scanlines transition-all duration-300 z-50',
        !isDark && 'warm-sidebar',
        // Mobile: fixed overlay
        'fixed lg:relative inset-y-0 left-0',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        // Desktop: collapse
        collapsed ? 'lg:w-[72px]' : 'lg:w-[260px]',
        'w-[260px] shrink-0'
      )}>
        <div className="glass-ridge" />
        {/* Logo */}
        <Link to="/" className="block px-7 py-5 border-b border-border hover:bg-deep active:bg-deep transition">
          <div className="flex items-center gap-3">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name || 'Company'} className="w-8 h-8 rounded-lg object-contain bg-white shadow-[0_2px_12px_rgba(0,0,0,0.08)]" onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
            ) : null}
            <img src="/logo.svg" alt="Vaultline" className="w-8 h-8 rounded-lg shadow-[0_2px_12px_rgba(34,211,238,0.2)]" style={org?.logo_url ? { display: 'none' } : {}} />
            {!collapsed && (
              <div>
                <h1 className="font-display text-[18px] font-extrabold tracking-[-0.02em]">
                  {org?.logo_url ? (org?.name || 'Vaultline') : <>Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></>}
                </h1>
                <p className="text-[11px] text-t3/70 uppercase tracking-[0.12em] font-semibold -mt-0.5">{org?.logo_url ? 'Powered by Vaultline' : 'Treasury'}</p>
              </div>
            )}
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto scrollbar-none">
          {NAV.map((group) => (
            <div key={group.section} className="mb-7">
              {!collapsed && (
                <p className="text-[11px] font-semibold text-t3/50 uppercase tracking-[0.12em] px-3 mb-2">
                  {group.section}
                </p>
              )}
              {collapsed && <div className="h-px bg-border/30 mx-2 mb-3 mt-1" />}
              {group.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  title={collapsed ? item.label : undefined}
                  className={({ isActive }) =>
                    clsx(
                      'relative flex items-center gap-3 rounded-xl text-[14px] mb-0.5 transition-all duration-200',
                      collapsed ? 'px-0 py-[9px] justify-center' : 'px-3 py-[9px]',
                      isActive
                        ? 'bg-gradient-to-r from-cyan/[0.12] to-cyan/[0.04] text-cyan font-semibold shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15)]'
                        : 'text-t2 hover:bg-deep hover:text-t1'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-cyan rounded-r shadow-[0_0_8px_rgba(34,211,238,0.5)]" />
                      )}
                      <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.8} className={clsx(isActive ? 'opacity-100' : 'opacity-60', collapsed && 'mx-auto')} />
                      {!collapsed && item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          ))}

          {/* More toggle — extended nav items */}
          {!collapsed && (
            <div className="mb-4">
              <button onClick={() => setShowMore(!showMore)} className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-semibold text-t3/50 uppercase tracking-[0.12em] hover:text-t2 transition">
                <span>More</span>
                <ChevronRight size={12} className={`transition-transform ${showMore ? 'rotate-90' : ''}`} />
              </button>
              {showMore && NAV_MORE.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  title={item.label}
                  className={({ isActive }) =>
                    clsx(
                      'relative flex items-center gap-3 rounded-xl text-[13px] mb-0.5 transition-all duration-200 px-3 py-[7px]',
                      isActive
                        ? 'bg-gradient-to-r from-cyan/[0.12] to-cyan/[0.04] text-cyan font-semibold shadow-[inset_0_0_0_1px_rgba(34,211,238,0.15)]'
                        : 'text-t3 hover:bg-deep hover:text-t1'
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      {isActive && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-cyan rounded-r shadow-[0_0_8px_rgba(34,211,238,0.5)]" />}
                      <item.icon size={15} strokeWidth={isActive ? 2.2 : 1.8} className={isActive ? 'opacity-100' : 'opacity-50'} />
                      {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          )}
          {collapsed && NAV_MORE.some(item => location.pathname === item.to) && NAV_MORE.filter(item => location.pathname === item.to).map(item => (
            <NavLink key={item.to} to={item.to} title={item.label} className="relative flex items-center justify-center rounded-xl py-[9px] mb-0.5 bg-gradient-to-r from-cyan/[0.12] to-cyan/[0.04] text-cyan">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 bg-cyan rounded-r" />
              <item.icon size={17} strokeWidth={2.2} />
            </NavLink>
          ))}
        </nav>

        {/* Referral program */}
        {!collapsed && (
          <Link to="/ecosystem"
            className="mx-4 mb-2 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-purple/[0.04] border border-purple/[0.08] hover:border-purple/[0.16] transition group">
            <Gift size={13} className="text-purple/70 group-hover:text-purple transition shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-purple/80 group-hover:text-purple transition">Refer & Earn $100</p>
              <p className="text-[10px] text-t3 truncate">Share Vaultline with your network</p>
            </div>
          </Link>
        )}

        {/* Carbon-aware indicator */}
        {!collapsed && (
          <a href="https://climate.stripe.com/OeA2M0" target="_blank" rel="noopener noreferrer"
            className="mx-4 mb-3 flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green/[0.04] border border-green/[0.08] hover:border-green/[0.16] transition group">
            <Leaf size={13} className="text-green/70 group-hover:text-green transition shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-green/80 group-hover:text-green transition">1% to Carbon Removal</p>
              <p className="text-[10px] text-t3 truncate">Stripe Climate member</p>
            </div>
          </a>
        )}

        {/* Collapse toggle — desktop only */}
        <button onClick={toggleCollapse}
          className="hidden lg:flex mx-4 mb-2 items-center justify-center gap-2 px-3 py-2 rounded-xl text-t3 hover:text-t1 hover:bg-deep border border-transparent hover:border-border transition-all text-[11px] font-mono"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={15} /> : <><PanelLeftClose size={15} /> <span>Collapse</span></>}
        </button>

        {/* User card */}
        <div className="px-4 py-4 border-t border-border">
          <div className={clsx('flex items-center gap-3 p-2 rounded-xl hover:bg-deep active:bg-deep transition', collapsed && 'justify-center')}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-[13px] font-bold text-white shadow-[0_2px_10px_rgba(34,211,238,0.15)]"
              style={{ background: org?.brand_color ? `linear-gradient(135deg, ${org.brand_color}, ${org.brand_color}99)` : 'linear-gradient(135deg, rgba(34,211,238,0.8), rgba(129,140,248,0.8))' }}>
              {initials}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-t1 truncate">{profile?.full_name}</p>
                <p className="text-[12px] text-t3 truncate">{org?.name}</p>
              </div>
            )}
            {!collapsed && (
              <button onClick={signOut} className="p-2.5 -mr-1 rounded-lg hover:bg-deep text-t3 hover:text-red/80 active:text-red transition" title="Sign out">
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* Premium topbar */}
        <header className={`shrink-0 flex items-center justify-between px-4 sm:px-8 h-[62px] glass relative z-10 ${!isDark ? 'warm-header-bg' : ''}`}>
          <div className="glass-ridge" />
          {!isDark && <div className="warm-divider absolute bottom-0 left-4 right-4" />}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button onClick={() => setMobileOpen(true)} className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-deep text-t2 hover:text-t1 transition">
              <Menu size={20} />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-display text-[18px] sm:text-[20px] font-bold text-t1 tracking-[-0.015em]">{meta.title}</h2>
                {org?.plan && <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded border border-border text-t3 hidden sm:inline">{org.plan}</span>}
              </div>
              <p className="text-[12px] sm:text-[13px] text-t2 mt-0.5 hidden sm:block">
                {org?.name} <span className="text-border mx-1.5">·</span> {meta.sub}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-lg bg-green/[0.06] border border-green/[0.12] text-[13px] font-medium text-green/90">
              <span className="w-[6px] h-[6px] rounded-full bg-green animate-[pulse_3s_ease-in-out_infinite]" />
              {syncing ? 'Syncing...' : 'Live'}
            </div>
            <NotificationCenter />
            <ThemeToggle />
            <button
              onClick={syncAccounts}
              disabled={syncing}
              className="px-4 py-[7px] rounded-lg bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold shadow-[0_1px_8px_rgba(34,211,238,0.2)] hover:shadow-[0_2px_16px_rgba(34,211,238,0.3)] hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {syncing ? 'Syncing...' : 'Sync'}
            </button>
          </div>
        </header>

        {/* Customer lifecycle banners — wrapped so one crash doesn't kill layout */}
        <SectionBoundary name="Banners" height="h-auto">
          <TrialBar />
          <DunningBanner />
          <WinBackBanner />
        </SectionBoundary>

        {/* Page content — terminal grid background */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 pb-20 lg:pb-8 relative z-[1] terminal-grid">
          <ErrorBoundary>
            <div key={location.pathname} className="page-enter">
              <Outlet />
            </div>
          </ErrorBoundary>
        </main>

        {/* Terminal status bar */}
        <div className="terminal-status shrink-0 flex items-center justify-between px-6 py-1.5 z-10">
          <div className="flex items-center gap-4 text-t3">
            <span className="terminal-live">CONNECTED</span>
            <span>SYS <span className="text-green">OK</span></span>
            <span>RLS <span className="text-green">ON</span></span>
          </div>
          <div className="flex items-center gap-4 text-t3">
            <span>VAULTLINE v1.0</span>
            <span>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          </div>
        </div>
      </div>

      {/* Copilot FAB — lifted on mobile to clear tab bar */}
      <button
        data-copilot onClick={() => setCopilotOpen(!copilotOpen)}
        className="fixed bottom-20 lg:bottom-7 right-5 lg:right-7 w-[48px] h-[48px] lg:w-[52px] lg:h-[52px] rounded-2xl bg-gradient-to-br from-cyan to-purple flex items-center justify-center shadow-[0_4px_24px_rgba(34,211,238,0.25)] hover:shadow-[0_6px_32px_rgba(34,211,238,0.35)] hover:scale-105 active:scale-95 transition-all z-50"
      >
        <MessageSquare size={20} className="text-void" />
      </button>

      {/* Mobile bottom tab navigation */}
      <MobileNav />

      <SectionBoundary name="Copilot" height="h-0">
        <Copilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />
      </SectionBoundary>
      <SectionBoundary name="Command Palette" height="h-0">
        <CommandPalette />
      </SectionBoundary>
    </div>
  )
}
