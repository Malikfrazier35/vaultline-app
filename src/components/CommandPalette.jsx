import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, LayoutDashboard, DollarSign, Activity, List, CreditCard, FileText,
  Settings, Users, Bell, Layers, Globe, Building2, Plug, Shield, Lock,
  Package, BarChart3, Wallet, KeyRound, ArrowRight, Command, MessageSquare, Eye, Clock, Target, Scale, Building, Star, AlertTriangle, ClipboardCheck
} from 'lucide-react'

const PAGES = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, keywords: 'home overview' },
  { label: 'Cash Position', path: '/position', icon: DollarSign, keywords: 'balance accounts cash' },
  { label: 'Forecasting', path: '/forecast', icon: Activity, keywords: 'forecast predict ai model' },
  { label: 'Transactions', path: '/transactions', icon: List, keywords: 'transactions payments history' },
  { label: 'Bank Connections', path: '/banks', icon: CreditCard, keywords: 'bank plaid connect link' },
  { label: 'Payments', path: '/payments', icon: Wallet, keywords: 'ar ap receivable payable invoice' },
  { label: 'Reports', path: '/reports', icon: FileText, keywords: 'reports export pdf' },
  { label: 'Scenarios', path: '/scenarios', icon: Layers, keywords: 'scenario model what if' },
  { label: 'Alerts', path: '/alerts', icon: Bell, keywords: 'alert notification threshold' },
  { label: 'Multi-Currency', path: '/currencies', icon: Globe, keywords: 'currency fx exchange rate' },
  { label: 'Entities', path: '/entities', icon: Building2, keywords: 'entity subsidiary consolidation' },
  { label: 'Data Import', path: '/import', icon: BarChart3, keywords: 'import csv upload quickbooks xero' },
  { label: 'Ecosystem', path: '/ecosystem', icon: Package, keywords: 'suite bundle financeos parallax' },
  { label: 'Integrations', path: '/integrations', icon: Plug, keywords: 'integration slack webhook api' },
  { label: 'Team', path: '/team', icon: Users, keywords: 'team invite member role' },
  { label: 'Settings', path: '/settings', icon: Settings, keywords: 'settings profile company branding' },
  { label: 'Billing', path: '/billing', icon: CreditCard, keywords: 'billing plan subscription stripe' },
  { label: 'SSO & Security', path: '/sso', icon: Lock, keywords: 'sso saml mfa security' },
  { label: 'API Access', path: '/api', icon: Shield, keywords: 'api key token webhook' },
  { label: 'Audit Log', path: '/audit', icon: Shield, keywords: 'audit log activity' },
  { label: 'Support', path: '/support', icon: MessageSquare, keywords: 'support help ticket' },
  { label: 'System Status', path: '/status', icon: Activity, keywords: 'status uptime health' },
  { label: 'Partner Program', path: '/partner-admin', icon: Users, keywords: 'partner referral commission' },
  { label: 'Security Center', path: '/security-center', icon: Shield, keywords: 'security threats sessions ip policy score' },
  { label: 'Privacy Center', path: '/privacy-center', icon: Eye, keywords: 'privacy gdpr ccpa consent dsr retention data subject' },
  { label: 'Time Manager', path: '/time', icon: Clock, keywords: 'time schedule task calendar timezone fiscal' },
  { label: 'Marketing Hub', path: '/marketing', icon: Target, keywords: 'marketing campaign content social brand calendar' },
  { label: 'Treasury Benchmark', path: '/benchmark', icon: BarChart3, keywords: 'benchmark compare industry metrics' },
  { label: 'Burn Rate Simulator', path: '/burn-simulator', icon: Activity, keywords: 'burn rate runway simulator cash scenario' },
  { label: 'Legal & Privacy Center', path: '/legal', icon: Scale, keywords: 'legal privacy rights dnsspi cookies subprocessors gdpr ccpa' },
  { label: 'Industry Hub', path: '/industry', icon: Building, keywords: 'industry vertical onboarding diversity sector healthcare saas manufacturing' },
  { label: 'Data Intelligence', path: '/data-intelligence', icon: Activity, keywords: 'data quality insights intelligence lineage anomaly reports sources' },
  { label: 'Cash Visibility', path: '/cash-visibility', icon: Eye, keywords: 'cash visibility real time balance position sweep concentration liquidity buffer' },
  { label: 'UX Preferences', path: '/ux', icon: Settings, keywords: 'ux preferences accessibility font contrast motion feedback walkthrough announcements' },
  { label: 'Resources', path: '/resources', icon: FileText, keywords: 'resources help guides templates library quick links tutorials' },
  { label: 'Payment Hub', path: '/payment-hub', icon: ArrowRight, keywords: 'payment hub send money transfer ach wire payee approval batch recurring' },
  { label: 'Design System', path: '/design-system', icon: Layers, keywords: 'design system components themes page states ui ux' },
  { label: 'Automation', path: '/automation', icon: Activity, keywords: 'automation rules engine webhook changelog trigger action' },
  { label: 'Opportunities', path: '/opportunities', icon: Star, keywords: 'opportunity idle cash vendor discount fx arbitrage revenue pipeline capture' },
  { label: 'Weaknesses', path: '/weaknesses', icon: AlertTriangle, keywords: 'weakness gap vulnerability data quality security process remediation scan' },
  { label: 'Threats', path: '/threats', icon: Shield, keywords: 'threat risk monitor market volatility fx regulatory cyber vendor countermeasure matrix' },
  { label: 'Audit Center', path: '/audit-center', icon: ClipboardCheck, keywords: 'audit program checklist finding compliance sox controls remediation' },
  { label: 'Security Center', path: '/security', icon: Shield, keywords: 'security trust soc compliance' },
]

export default function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Cmd+K / Ctrl+K to toggle
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault()
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelected(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const results = useMemo(() => {
    if (!query.trim()) return PAGES.slice(0, 8)
    const q = query.toLowerCase()
    return PAGES.filter(p =>
      p.label.toLowerCase().includes(q) ||
      p.path.toLowerCase().includes(q) ||
      p.keywords.includes(q)
    )
  }, [query])

  // Keyboard nav
  useEffect(() => {
    if (!open) return
    function handleNav(e) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(prev => Math.min(prev + 1, results.length - 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelected(prev => Math.max(prev - 1, 0)) }
      if (e.key === 'Enter' && results[selected]) {
        e.preventDefault()
        navigate(results[selected].path)
        setOpen(false)
      }
    }
    window.addEventListener('keydown', handleNav)
    return () => window.removeEventListener('keydown', handleNav)
  }, [open, results, selected, navigate])

  // Reset selection on query change
  useEffect(() => { setSelected(0) }, [query])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Palette */}
      <div className="relative w-full max-w-[520px] mx-4 glass-card rounded-2xl shadow-[0_24px_80px_rgba(0,0,0,0.4)] border-cyan/[0.08] overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <Search size={18} className="text-t3 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search pages, settings, features..."
            className="flex-1 bg-transparent text-[15px] text-t1 placeholder:text-t4 outline-none font-medium"
          />
          <kbd className="hidden sm:flex items-center gap-0.5 px-2 py-1 rounded-md bg-deep border border-border text-[10px] font-mono text-t4">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[320px] overflow-y-auto py-2">
          {results.length > 0 ? results.map((page, i) => {
            const Icon = page.icon
            return (
              <button
                key={page.path}
                onClick={() => { navigate(page.path); setOpen(false) }}
                onMouseEnter={() => setSelected(i)}
                className={`w-full flex items-center gap-3 px-5 py-2.5 text-left transition-colors ${
                  i === selected ? 'bg-cyan/[0.06]' : 'hover:bg-deep/50'
                }`}
              >
                <Icon size={16} className={`flex-shrink-0 ${i === selected ? 'text-cyan' : 'text-t3'}`} />
                <span className={`text-[14px] font-medium ${i === selected ? 'text-cyan' : 'text-t1'}`}>{page.label}</span>
                <span className="text-[11px] text-t4 font-mono ml-auto">{page.path}</span>
                {i === selected && <ArrowRight size={12} className="text-cyan flex-shrink-0" />}
              </button>
            )
          }) : (
            <div className="px-5 py-8 text-center">
              <p className="text-[13px] text-t3">No results for "{query}"</p>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-5 py-2.5 border-t border-border text-[10px] font-mono text-t4">
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-deep border border-border">↑↓</kbd> Navigate</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-deep border border-border">↵</kbd> Open</span>
          <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-deep border border-border">esc</kbd> Close</span>
        </div>
      </div>
    </div>
  )
}
