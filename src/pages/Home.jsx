import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { useToast } from '@/components/Toast'
import { SkeletonPage } from '@/components/Skeleton'
import { Link } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import {
  LayoutDashboard, Wallet, TrendingUp, ArrowRightLeft, Building2,
  FileText, Shield, Bell, Settings, Plus, ArrowRight, Clock,
  Zap, CheckCircle2, AlertTriangle, ChevronRight, Landmark
} from 'lucide-react'

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

function timeAgo(date) {
  if (!date) return 'never'
  const diff = Date.now() - new Date(date).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const QUICK_ACTIONS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', desc: 'Full treasury overview', color: 'cyan' },
  { to: '/position', icon: Wallet, label: 'Cash position', desc: 'Account balances', color: 'green' },
  { to: '/forecast', icon: TrendingUp, label: 'Forecasting', desc: 'Runway & models', color: 'purple' },
  { to: '/transactions', icon: ArrowRightLeft, label: 'Transactions', desc: 'Recent activity', color: 'amber' },
  { to: '/banks', icon: Landmark, label: 'Bank connections', desc: 'Manage accounts', color: 'cyan' },
  { to: '/reports', icon: FileText, label: 'Reports', desc: 'Generate & export', color: 'green' },
  { to: '/security-center', icon: Shield, label: 'Security center', desc: 'Controls & events', color: 'red', minPlan: 'enterprise' },
  { to: '/settings', icon: Settings, label: 'Settings', desc: 'Profile & org', color: 'purple' },
]

const QA_PLAN_RANK = { starter: 0, growth: 1, enterprise: 2 }

export default function Home() {
  const { accounts, transactions, cashPosition, forecast, bankConnections, loading } = useTreasury()
  const { user, profile, org } = useAuth()
  const { isDark } = useTheme()

  useEffect(() => { document.title = 'Home — Vaultline' }, [])

  const totalCash = cashPosition?.total_balance || 0
  const runway = forecast?.runway_months || 0
  const netFlow = useMemo(() => {
    if (!transactions?.length) return 0
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
    return transactions
      .filter(t => new Date(t.date) >= thirtyDaysAgo)
      .reduce((sum, t) => sum + (t.amount || 0), 0)
  }, [transactions])

  const recentTx = useMemo(() => {
    if (!transactions?.length) return []
    return [...transactions].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
  }, [transactions])

  const connectedBanks = bankConnections?.filter(b => b.status === 'connected')?.length || 0
  const totalAccounts = accounts?.length || 0

  const greeting = useMemo(() => {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const firstName = user?.user_metadata?.full_name?.split(' ')[0]
    || profile?.first_name
    || user?.email?.split('@')[0]
    || ''

  if (loading) return <SkeletonPage />

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

      {/* Greeting */}
      <div>
        <h1 className="text-[28px] font-display font-black tracking-tight text-t1">
          {greeting}{firstName ? `, ${firstName}` : ''}.
        </h1>
        <p className="text-[14px] text-t3 mt-1">
          {org?.name || 'Your organization'} — {totalAccounts} account{totalAccounts !== 1 ? 's' : ''} across {connectedBanks} bank{connectedBanks !== 1 ? 's' : ''}
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link to="/position" className="glass-card rounded-2xl p-5 hover:border-border-hover transition group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-t3">Total cash</span>
            <ChevronRight size={14} className="text-t4 group-hover:text-cyan transition" />
          </div>
          <p className="text-[28px] font-mono font-black text-t1 tracking-tight terminal-data">{fmt(totalCash)}</p>
          <p className="text-[11px] font-mono text-t3 mt-1">{totalAccounts} account{totalAccounts !== 1 ? 's' : ''}</p>
        </Link>

        <Link to="/forecast" className="glass-card rounded-2xl p-5 hover:border-border-hover transition group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-t3">Net flow (30d)</span>
            <ChevronRight size={14} className="text-t4 group-hover:text-cyan transition" />
          </div>
          <p className={`text-[28px] font-mono font-black tracking-tight terminal-data ${netFlow >= 0 ? 'text-green' : 'text-red'}`}>
            {netFlow >= 0 ? '+' : ''}{fmt(netFlow)}
          </p>
          <p className="text-[11px] font-mono text-t3 mt-1">{transactions?.length || 0} transactions</p>
        </Link>

        <Link to="/forecast" className="glass-card rounded-2xl p-5 hover:border-border-hover transition group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-t3">Runway</span>
            <ChevronRight size={14} className="text-t4 group-hover:text-cyan transition" />
          </div>
          <p className={`text-[28px] font-mono font-black tracking-tight terminal-data ${runway > 12 ? 'text-green' : runway > 6 ? 'text-amber' : 'text-red'}`}>
            {runway > 0 ? `${runway.toFixed(1)} mo` : '—'}
          </p>
          <p className="text-[11px] font-mono text-t3 mt-1">{runway > 12 ? 'Healthy' : runway > 6 ? 'Monitor' : runway > 0 ? 'Critical' : 'No data'}</p>
        </Link>

        <Link to="/banks" className="glass-card rounded-2xl p-5 hover:border-border-hover transition group">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.1em] text-t3">Banks</span>
            <ChevronRight size={14} className="text-t4 group-hover:text-cyan transition" />
          </div>
          <p className="text-[28px] font-mono font-black text-t1 tracking-tight terminal-data">{connectedBanks}</p>
          <p className={`text-[11px] font-mono mt-1 ${connectedBanks > 0 ? 'text-green' : 'text-amber'}`}>{connectedBanks > 0 ? 'Connected' : 'Not connected'}</p>
        </Link>
      </div>

      {/* Quick actions grid */}
      <div>
        <h2 className="text-[13px] font-mono font-bold uppercase tracking-[0.1em] text-t3 mb-3">Quick actions</h2>
        <div className="grid grid-cols-4 gap-3">
          {QUICK_ACTIONS.filter(a => !a.minPlan || (QA_PLAN_RANK[org?.plan || 'starter'] || 0) >= (QA_PLAN_RANK[a.minPlan] || 0)).map(a => (
            <Link key={a.to} to={a.to}
              className="glass-card rounded-xl p-4 hover:border-border-hover hover:-translate-y-0.5 transition-all group">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-3 bg-${a.color}/[0.06] border border-${a.color}/[0.1]`}>
                <a.icon size={15} className={`text-${a.color}`} />
              </div>
              <p className="text-[13px] font-semibold text-t1 group-hover:text-cyan transition">{a.label}</p>
              <p className="text-[11px] text-t3 mt-0.5">{a.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent transactions + status */}
      <div className="grid grid-cols-[1fr_320px] gap-4">

        {/* Recent transactions */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="terminal-label">Recent transactions</span>
            <Link to="/transactions" className="text-[11px] font-mono font-semibold text-cyan hover:underline flex items-center gap-1">
              View all <ArrowRight size={10} />
            </Link>
          </div>
          {recentTx.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[13px] text-t3">No transactions yet</p>
              <Link to="/banks" className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-cyan/[0.06] text-cyan text-[12px] font-semibold border border-cyan/[0.1] hover:bg-cyan/[0.1] transition">
                <Plus size={13} /> Connect a bank
              </Link>
            </div>
          ) : (
            <div className="space-y-1">
              {recentTx.map(tx => (
                <div key={tx.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-none">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-t1 truncate">{tx.description || tx.name || 'Transaction'}</p>
                    <p className="text-[10px] font-mono text-t3 mt-0.5">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p>
                  </div>
                  <span className={`text-[13px] font-mono font-semibold terminal-data ${tx.amount >= 0 ? 'text-green' : 'text-t1'}`}>
                    {tx.amount >= 0 ? '+' : ''}{fmt(tx.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* System status */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-5">
            <span className="terminal-label">System status</span>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green animate-pulse" />
                  <span className="text-[12px] text-t2">Bank sync</span>
                </div>
                <span className="text-[10px] font-mono text-t3">{connectedBanks} active</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${forecast ? 'bg-green' : 'bg-amber'}`} />
                  <span className="text-[12px] text-t2">Forecast model</span>
                </div>
                <span className="text-[10px] font-mono text-t3">{forecast ? 'Active' : 'Not generated'}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green" />
                  <span className="text-[12px] text-t2">Encryption</span>
                </div>
                <span className="text-[10px] font-mono text-t3">AES-256</span>
              </div>
            </div>
          </div>

          {/* Onboarding checklist (shows if incomplete) */}
          {(connectedBanks === 0 || !forecast) && (
            <div className="glass-card rounded-2xl p-5">
              <span className="terminal-label">Getting started</span>
              <div className="mt-4 space-y-2">
                <Link to="/banks" className={`flex items-center gap-3 p-2.5 rounded-xl transition ${connectedBanks > 0 ? 'opacity-50' : 'hover:bg-deep'}`}>
                  {connectedBanks > 0 ? <CheckCircle2 size={16} className="text-green" /> : <div className="w-4 h-4 rounded-full border-2 border-t3" />}
                  <span className="text-[12px] text-t1 font-medium">Connect your first bank</span>
                </Link>
                <Link to="/import" className={`flex items-center gap-3 p-2.5 rounded-xl transition ${transactions?.length > 0 ? 'opacity-50' : 'hover:bg-deep'}`}>
                  {transactions?.length > 0 ? <CheckCircle2 size={16} className="text-green" /> : <div className="w-4 h-4 rounded-full border-2 border-t3" />}
                  <span className="text-[12px] text-t1 font-medium">Import transactions</span>
                </Link>
                <Link to="/forecast" className={`flex items-center gap-3 p-2.5 rounded-xl transition ${forecast ? 'opacity-50' : 'hover:bg-deep'}`}>
                  {forecast ? <CheckCircle2 size={16} className="text-green" /> : <div className="w-4 h-4 rounded-full border-2 border-t3" />}
                  <span className="text-[12px] text-t1 font-medium">Generate your first forecast</span>
                </Link>
                <Link to="/team" className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-deep transition">
                  <div className="w-4 h-4 rounded-full border-2 border-t3" />
                  <span className="text-[12px] text-t1 font-medium">Invite your team</span>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
