import { SkeletonPage } from "@/components/Skeleton"
import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { Link, Navigate } from 'react-router-dom'
import { BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ComposedChart, Tooltip, Line, RadialBarChart, RadialBar, Treemap, Legend, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis } from 'recharts'
import { ChartTooltip, fmtCurrency } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import {
  Users, Building2, DollarSign, TrendingUp, CreditCard, Database,
  ChevronRight, ArrowLeft, Clock, Activity, Shield, Link2,
  RefreshCw, Upload, MessageSquare, BarChart3, Eye,
  ArrowUpRight, ArrowDownRight, Zap, Target, Layers, Globe
} from 'lucide-react'

const SUPER_ADMINS = ['malikfrazier35@yahoo.com', 'financialholdingllc@gmail.com']
const PIE_COLORS = ['#22D3EE', '#818CF8', '#34D399', '#FB7185', '#FBBF24', '#F472B6', '#A78BFA']
const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'customers', label: 'Customers', icon: Building2 },
  { id: 'connections', label: 'Connections', icon: Link2 },
  { id: 'activity', label: 'Activity', icon: Activity },
]
const STATUS = {
  active: 'bg-green-soft text-green', trialing: 'bg-cyan-glow text-cyan',
  inactive: 'bg-[rgba(148,163,184,0.08)] text-t3', past_due: 'bg-red-soft text-red',
  canceled: 'bg-red-soft text-red', connected: 'bg-green-soft text-green',
  disconnected: 'bg-[rgba(148,163,184,0.08)] text-t3', token_expired: 'bg-amber-soft text-amber',
}

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(1) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(0) + 'K'
  return '$' + abs.toFixed(0)
}
function timeSince(d) {
  if (!d) return 'never'
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function SuperAdmin() {
  const { user, loading: authLoading } = useAuth()
  const { isDark } = useTheme()
  const ct = useChartTheme()
  const [platform, setPlatform] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => { document.title = 'Admin — Vaultline' }, [])

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-void"><div className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" /></div>
  if (!user || !SUPER_ADMINS.includes(user.email)) return <Navigate to="/dashboard" replace />

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const { data, error: fnErr } = await safeInvoke('super-admin', { action: 'overview' })
      if (fnErr) throw new Error(fnErr.message)
      if (data?.error) throw new Error(data.error)
      setPlatform(data.platform); setOrgs(data.orgs)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }
  async function refresh() { setRefreshing(true); await fetchData(); setRefreshing(false) }
  async function updateOrg(orgId, updates) {
    await safeInvoke('super-admin', { action: 'update_org', org_id: orgId, updates })
    await fetchData()
  }
  async function deleteUser(userId, orgId) {
    if (!confirm('PERMANENTLY delete this user and ALL their organization data? This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? All accounts, transactions, connections, and history will be destroyed.')) return
    await safeInvoke('super-admin', { action: 'delete_user', user_id: userId, org_id: orgId })
    setSelectedOrg(null)
    await fetchData()
  }

  if (loading) return <SkeletonPage />

  if (selectedOrg) {
    const org = orgs.find(o => o.id === selectedOrg)
    if (!org) { setSelectedOrg(null); return null }
    return <CustomerDetail org={org} onBack={() => setSelectedOrg(null)} onUpdate={updateOrg} onDelete={deleteUser} isDark={isDark} ct={ct} />
  }

  return (
    <div className="min-h-screen bg-void text-t1">
      <nav className="sticky top-0 z-50 border-b border-border bg-void/80 backdrop-blur-xl px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg font-black tracking-tight">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></h1>
          <span className="bg-red text-void text-[11px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">Admin</span>
        </div>
        <div className="flex items-center gap-2.5">
          <button onClick={refresh} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[13px] font-medium text-t3 hover:text-t1 hover:border-border-hover active:border-border-hover transition disabled:opacity-50">
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
          <Link to="/dashboard" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-[13px] font-medium text-t3 hover:text-t1 hover:border-border-hover active:border-border-hover transition">
            <ArrowLeft size={13} /> Dashboard
          </Link>
        </div>
      </nav>
      <div className="border-b border-border bg-deep/60 backdrop-blur-sm">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center gap-0.5">
          {TABS.map(t => {
            const counts = { overview: null, customers: orgs.length, connections: platform ? (platform.total_bank_connections + platform.total_qb_connections + platform.total_acct_connections) : 0, activity: platform?.recent_audit?.length || 0 }
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`relative flex items-center gap-2 px-5 py-3 text-[14px] font-medium transition-colors ${
                  tab === t.id ? 'text-cyan' : 'text-t3 hover:text-t2'
                }`}>
                <t.icon size={15} strokeWidth={tab === t.id ? 2.2 : 1.8} />
                {t.label}
                {counts[t.id] !== null && counts[t.id] > 0 && (
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-semibold ${
                    tab === t.id ? 'bg-cyan/[0.1] text-cyan' : 'bg-card text-t3'
                  }`}>{counts[t.id]}</span>
                )}
                {tab === t.id && <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-cyan rounded-t glow-xs" />}
              </button>
            )
          })}
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 py-6">
        {error && <div className="bg-red-soft text-red text-[14px] rounded-xl px-5 py-3 mb-6">{error}</div>}
        {tab === 'overview' && <OverviewTab platform={platform} orgs={orgs} isDark={isDark} ct={ct} />}
        {tab === 'customers' && <CustomersTab orgs={orgs} onSelect={setSelectedOrg} />}
        {tab === 'connections' && <ConnectionsTab platform={platform} orgs={orgs} />}
        {tab === 'activity' && <ActivityTab platform={platform} />}
      </div>
    </div>
  )
}

/* ═══ OVERVIEW ═══ */
function OverviewTab({ platform: p, orgs, isDark, ct }) {
  if (!p) return null
  const planPrices = { starter: 499, growth: 1499, enterprise: 2499 }
  const mrr = orgs.reduce((s, o) => s + (o.plan_status === 'active' ? (planPrices[o.plan] || 0) : 0), 0)
  const arr = mrr * 12
  const totalConns = p.total_bank_connections + p.total_qb_connections + p.total_acct_connections
  const avgCashPerOrg = p.total_orgs > 0 ? p.total_cash_managed / p.total_orgs : 0
  const avgTxPerOrg = p.total_orgs > 0 ? p.total_transactions / p.total_orgs : 0
  const activePct = p.total_orgs > 0 ? ((p.active_plans / p.total_orgs) * 100).toFixed(0) : 0

  // Signup growth chart data (cumulative)
  const cumulativeSignups = useMemo(() => {
    let total = 0
    return (p.signups_by_day || []).map(([date, count]) => { total += count; return { date, count, cumulative: total } })
  }, [p.signups_by_day])

  // Revenue by org (top 5)
  const revenueByOrg = useMemo(() => {
    return orgs.filter(o => o.plan_status === 'active').map(o => ({
      name: o.name?.slice(0, 16) || 'Unknown', value: planPrices[o.plan] || 0, plan: o.plan, cash: o.total_balance
    })).sort((a, b) => b.value - a.value).slice(0, 6)
  }, [orgs])

  // Net cash flow trend
  const cashFlowTrend = useMemo(() => {
    return (p.tx_by_day || []).map(d => ({ ...d, net: (d.inflows || 0) - (d.outflows || 0) }))
  }, [p.tx_by_day])

  // Health radar data
  const healthRadar = [
    { metric: 'Activation', value: parseInt(activePct) || 0, fullMark: 100 },
    { metric: 'Connections', value: Math.min(totalConns * 20, 100), fullMark: 100 },
    { metric: 'Transactions', value: Math.min(p.total_transactions / 10, 100), fullMark: 100 },
    { metric: 'Engagement', value: Math.min((p.copilot_messages?.length || 0) * 5, 100), fullMark: 100 },
    { metric: 'Retention', value: p.total_orgs > 0 ? Math.min((p.active_plans / p.total_orgs) * 120, 100) : 0, fullMark: 100 },
    { metric: 'Data Volume', value: Math.min(p.total_transactions / 5, 100), fullMark: 100 },
  ]

  // Conversion funnel
  const funnel = [
    { stage: 'Signed Up', count: p.total_users, pct: 100, color: '#22D3EE' },
    { stage: 'Created Org', count: p.total_orgs, pct: p.total_users > 0 ? ((p.total_orgs / p.total_users) * 100) : 0, color: '#818CF8' },
    { stage: 'Connected Bank', count: orgs.filter(o => o.bank_connections.length > 0).length, pct: p.total_orgs > 0 ? ((orgs.filter(o => o.bank_connections.length > 0).length / p.total_orgs) * 100) : 0, color: '#34D399' },
    { stage: 'Active Plan', count: p.active_plans, pct: p.total_orgs > 0 ? ((p.active_plans / p.total_orgs) * 100) : 0, color: '#FBBF24' },
  ]

  // Utilization gauges
  const gauges = [
    { name: 'Activation', value: parseInt(activePct), fill: '#22D3EE' },
    { name: 'Bank Conn.', value: Math.min(totalConns * 15, 100), fill: '#34D399' },
    { name: 'AI Usage', value: Math.min((p.copilot_messages?.length || 0) * 4, 100), fill: '#818CF8' },
  ]

  return (
    <div className="space-y-5">
      {/* ═══ HERO KPI ROW ═══ */}
      <div className="grid grid-cols-6 gap-3">
        {[
          { icon: DollarSign, label: 'MRR', value: `$${mrr.toLocaleString()}`, color: 'cyan', delta: '+100%', deltaUp: true },
          { icon: TrendingUp, label: 'ARR', value: `$${arr.toLocaleString()}`, color: 'green', delta: null },
          { icon: Building2, label: 'Organizations', value: p.total_orgs, color: 'purple', delta: null },
          { icon: Users, label: 'Total Users', value: p.total_users, color: 'cyan', delta: null },
          { icon: Database, label: 'Cash Managed', value: fmt(p.total_cash_managed), color: 'amber', delta: null },
          { icon: Link2, label: 'Connections', value: totalConns, color: 'purple', delta: null },
        ].map(k => (
          <div key={k.label} className="glass-card rounded-[14px] p-4 terminal-scanlines relative hover:border-border-cyan active:border-border-cyan transition group">
            <div className="flex items-center justify-between mb-2">
              <k.icon size={14} className={`text-${k.color} opacity-70 group-hover:opacity-100 transition`} />
              {k.delta && <span className={`flex items-center gap-0.5 text-[11px] font-bold ${k.deltaUp ? 'text-green' : 'text-red'}`}>{k.deltaUp ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}{k.delta}</span>}
            </div>
            <p className={`font-mono text-[22px] font-bold text-${k.color}`}>{k.value}</p>
            <p className="text-[12px] text-t3 mt-1 uppercase tracking-wider font-medium">{k.label}</p>
          </div>
        ))}
      </div>

      {/* ═══ CONVERSION FUNNEL + HEALTH RADAR + UTILIZATION GAUGES ═══ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Conversion funnel */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="terminal-label mb-4 flex items-center gap-2"><Target size={13} className="text-cyan" /> Conversion Funnel</h3>
          <div className="space-y-2.5">
            {funnel.map((s, i) => (
              <div key={s.stage}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-medium text-t1">{s.stage}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold" style={{ color: s.color }}>{s.count}</span>
                    {i > 0 && <span className="text-[11px] text-t3 font-mono bg-void/40 px-1.5 py-0.5 rounded">{s.pct}%</span>}
                  </div>
                </div>
                <div className="h-2.5 bg-void/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(s.pct, 4)}%`, background: s.color, opacity: 0.7 + (i * 0.1) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Health radar */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="terminal-label mb-2 flex items-center gap-2"><Zap size={13} className="text-amber" /> Platform Health</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={healthRadar} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="rgba(30,60,100,0.25)" />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                <Radar name="Health" dataKey="value" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.15} strokeWidth={2} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Utilization gauges */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="terminal-label mb-2 flex items-center gap-2"><Layers size={13} className="text-green" /> Utilization</h3>
          <div className="h-[170px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart cx="50%" cy="50%" innerRadius="25%" outerRadius="90%" data={gauges} startAngle={180} endAngle={0}>
                <RadialBar background={{ fill: 'rgba(30,60,100,0.15)' }} dataKey="value" cornerRadius={6} />
              </RadialBarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-5 -mt-2">
            {gauges.map(g => (
              <div key={g.name} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: g.fill }} />
                <span className="text-[11px] text-t3">{g.name}</span>
                <span className="text-[12px] font-bold" style={{ color: g.fill }}>{g.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ INFO ROW: Plan + Status + System ═══ */}
      <div className="grid grid-cols-3 gap-3">
        <Card title="Plan Distribution">
          {[{ l: 'Starter', c: p.plan_breakdown.starter, bg: 'bg-cyan', p: '$499/mo', rev: p.plan_breakdown.starter * 499 },
            { l: 'Growth', c: p.plan_breakdown.growth, bg: 'bg-purple', p: '$1,499/mo', rev: p.plan_breakdown.growth * 1499 },
            { l: 'Enterprise', c: p.plan_breakdown.enterprise, bg: 'bg-green', p: '$2,499/mo', rev: p.plan_breakdown.enterprise * 2499 },
          ].map(x => (
            <div key={x.l} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2.5">
                <div className={`w-2.5 h-2.5 rounded-full ${x.bg}`} />
                <span className="text-[14px] font-medium">{x.l}</span>
                <span className="text-[12px] text-t3">{x.p}</span>
              </div>
              <div className="text-right">
                <span className="font-display text-[16px] font-bold">{x.c}</span>
                {x.rev > 0 && <span className="text-[11px] text-t3 ml-2">${x.rev.toLocaleString()}/mo</span>}
              </div>
            </div>
          ))}
          <div className="border-t border-border/30 mt-2 pt-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-t2">Total MRR</span>
            <span className="font-mono text-[16px] font-bold text-cyan">${mrr.toLocaleString()}</span>
          </div>
        </Card>
        <Card title="Status Breakdown">
          {[{ l: 'Active', c: p.active_plans, bg: 'bg-green', pct: activePct },
            { l: 'Trialing', c: p.trialing, bg: 'bg-cyan', pct: p.total_orgs > 0 ? ((p.trialing / p.total_orgs) * 100) : 0 },
            { l: 'Inactive', c: p.inactive, bg: 'bg-t3', pct: p.total_orgs > 0 ? ((p.inactive / p.total_orgs) * 100) : 0 },
          ].map(x => (
            <div key={x.l}>
              <div className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2.5"><div className={`w-2.5 h-2.5 rounded-full ${x.bg}`} /><span className="text-[14px] font-medium">{x.l}</span></div>
                <div className="flex items-center gap-2"><span className="text-[12px] text-t3">{x.pct}%</span><span className="font-display text-[16px] font-bold">{x.c}</span></div>
              </div>
              <div className="h-1.5 bg-void/30 rounded-full overflow-hidden mb-1">
                <div className={`h-full rounded-full ${x.bg}`} style={{ width: `${Math.max(x.pct, 2)}%` }} />
              </div>
            </div>
          ))}
        </Card>
        <Card title="System Health">
          {[{ l: 'Edge Functions', v: '16 deployed', ok: true },
            { l: 'Database', v: 'Active Healthy', ok: true },
            { l: 'Supabase', v: 'Pro Plan', ok: true },
            { l: 'Plaid', v: 'In Review', ok: false },
            { l: 'Intuit', v: 'Sandbox', ok: false },
            { l: 'Stripe', v: 'Live', ok: true },
          ].map(x => (
            <div key={x.l} className="flex items-center justify-between py-1.5">
              <span className="text-[14px] text-t2">{x.l}</span>
              <div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${x.ok ? 'bg-green shadow-[0_0_4px_rgba(52,211,153,0.4)]' : 'bg-amber shadow-[0_0_4px_rgba(251,191,36,0.3)]'}`} /><span className="text-[13px] text-t2">{x.v}</span></div>
            </div>
          ))}
        </Card>
      </div>

      {/* ═══ FULL-WIDTH CHARTS ROW ═══ */}
      <div className="grid grid-cols-2 gap-3">
        {/* Cash history with gradient fill */}
        <ChartCard title="Platform Cash History" sub="Aggregate daily balances across all orgs" data={p.balance_history} isDark={isDark} ct={ct}>
          {p.balance_history.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={p.balance_history}>
                <defs>
                  <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#22D3EE" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(p.balance_history.length / 6))} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} width={55} tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />} />
                <Area type="monotone" dataKey="balance" name="Total Cash" stroke="#22D3EE" fill="url(#cashGrad)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        {/* Cash flow with net line overlay */}
        <ChartCard title="Cash Flow & Net Trend" sub="Daily inflows, outflows, and net position" data={cashFlowTrend} isDark={isDark} ct={ct}>
          {cashFlowTrend.length > 0 && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cashFlowTrend} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(cashFlowTrend.length / 6))} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} />} />
                <Bar dataKey="inflows" name="Inflows" fill={ct.bar.inflows} radius={[3, 3, 0, 0]} />
                <Bar dataKey="outflows" name="Outflows" fill={ct.bar.outflows} radius={[3, 3, 0, 0]} />
                <Line type="monotone" dataKey="net" name="Net Flow" stroke="#FBBF24" strokeWidth={2} dot={false} strokeDasharray="4 2" />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* ═══ SECOND CHART ROW: Signups + Revenue + Categories ═══ */}
      <div className="grid grid-cols-3 gap-3">
        {/* Cumulative signup growth */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="text-[15px] font-semibold mb-1 flex items-center gap-2"><TrendingUp size={14} className="text-green" /> User Growth</h3>
          <p className="text-[12px] text-t3 mb-3">Cumulative signups over time</p>
          <div className="h-[180px]">
            {cumulativeSignups.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativeSignups}>
                  <defs>
                    <linearGradient id="signupGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="#34D399" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(cumulativeSignups.length / 4))} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                  <YAxis tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} width={30} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Area type="monotone" dataKey="cumulative" name="Total Users" stroke="#34D399" fill="url(#signupGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-t3 text-[14px]">No signups yet</div>}
          </div>
        </div>

        {/* Revenue by org */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="text-[15px] font-semibold mb-1 flex items-center gap-2"><DollarSign size={14} className="text-cyan" /> Revenue by Customer</h3>
          <p className="text-[12px] text-t3 mb-3">MRR contribution per org</p>
          <div className="h-[180px]">
            {revenueByOrg.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByOrg} layout="vertical" barSize={16}>
                  <XAxis type="number" tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} tickLine={false} axisLine={false} width={90} />
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  <Bar dataKey="value" name="MRR" fill="#22D3EE" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : <div className="h-full flex items-center justify-center text-t3 text-[14px]">No active subscriptions</div>}
          </div>
        </div>

        {/* Category donut */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="text-[15px] font-semibold mb-1">Transaction Categories</h3>
          <p className="text-[12px] text-t3 mb-2">Volume by category across platform</p>
          {p.category_breakdown.length > 0 ? (
            <div className="grid grid-cols-[120px_1fr] gap-3 items-center">
              <div className="h-[120px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart><Pie data={p.category_breakdown} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={32} outerRadius={55} paddingAngle={2} strokeWidth={0}>
                    {p.category_breakdown.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie></PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5">
                {p.category_breakdown.slice(0, 5).map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="text-[12px] font-medium capitalize flex-1 truncate">{cat.category}</span>
                    <span className="font-mono text-[12px] font-semibold text-t2">{fmt(cat.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="h-[140px] flex items-center justify-center text-t3 text-[14px]">No transactions yet</div>}
        </div>
      </div>

      {/* ═══ KEY METRICS STRIP ═══ */}
      <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
        <h3 className="terminal-label mb-4 flex items-center gap-2"><Globe size={13} className="text-cyan" /> Platform Metrics</h3>
        <div className="grid grid-cols-6 gap-4">
          {[
            { l: 'Avg Cash/Org', v: fmt(avgCashPerOrg), c: 'text-green' },
            { l: 'Avg Tx/Org', v: avgTxPerOrg.toFixed(0), c: 'text-cyan' },
            { l: 'Activation %', v: `${activePct}%`, c: parseInt(activePct) > 60 ? 'text-green' : 'text-amber' },
            { l: 'AI Messages', v: p.copilot_messages?.length || 0, c: 'text-purple' },
            { l: 'Data Imports', v: p.recent_imports?.length || 0, c: 'text-amber' },
            { l: 'ARPU', v: p.active_plans > 0 ? `$${Math.round(mrr / p.active_plans)}` : '$0', c: 'text-cyan' },
          ].map(m => (
            <div key={m.l} className="text-center">
              <p className={`font-mono text-[20px] font-bold ${m.c}`}>{m.v}</p>
              <p className="text-[11px] text-t3 mt-1 uppercase tracking-wider">{m.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ RECENT SIGNUPS ═══ */}
      {p.recent_signups.length > 0 && (
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2"><Users size={15} className="text-purple" /> Recent Signups</h3>
          <div className="divide-y divide-border/30">
            {p.recent_signups.map(u => (
              <div key={u.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center text-[11px] font-bold text-cyan">{(u.full_name || 'U')[0]}</div>
                  <div><p className="text-[14px] font-medium">{u.full_name || 'Unnamed'}</p><p className="text-[13px] text-t3">{u.email}</p></div>
                </div>
                <span className="text-[13px] text-t3">{timeSince(u.created_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ CUSTOMERS ═══ */
function CustomersTab({ orgs, onSelect }) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const planPrices = { starter: 499, growth: 1499, enterprise: 2499 }
  const filtered = orgs.filter(o => {
    if (statusFilter !== 'all' && o.plan_status !== statusFilter) return false
    if (search && !o.name?.toLowerCase().includes(search.toLowerCase()) && !o.member_list?.some(m => m.email?.toLowerCase().includes(search.toLowerCase()))) return false
    return true
  })
  const totalMRR = orgs.reduce((s, o) => s + (o.plan_status === 'active' ? (planPrices[o.plan] || 0) : 0), 0)
  const avgCash = orgs.length > 0 ? orgs.reduce((s, o) => s + (o.total_balance || 0), 0) / orgs.length : 0
  const activeRate = orgs.length > 0 ? ((orgs.filter(o => o.plan_status === 'active').length / orgs.length) * 100).toFixed(0) : 0
  const totalMembers = orgs.reduce((s, o) => s + (o.members || 0), 0)

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPI icon={Building2} label="Organizations" value={orgs.length} color="text-cyan" small />
        <KPI icon={TrendingUp} label="Total MRR" value={`$${totalMRR.toLocaleString()}`} color="text-green" small />
        <KPI icon={Users} label="Total Members" value={totalMembers} color="text-purple" small />
        <KPI icon={Eye} label="Activation Rate" value={`${activeRate}%`} color="text-amber" small />
      </div>

      {/* Revenue by plan */}
      <div className="grid grid-cols-3 gap-3">
        {[{ plan: 'starter', label: 'Starter', price: 499, color: 'cyan' }, { plan: 'growth', label: 'Growth', price: 1499, color: 'purple' }, { plan: 'enterprise', label: 'Enterprise', price: 2499, color: 'green' }].map(p => {
          const count = orgs.filter(o => o.plan === p.plan && o.plan_status === 'active').length
          return (
            <div key={p.plan} className="glass-card rounded-[14px] p-4 terminal-scanlines relative hover:border-border-cyan active:border-border-cyan transition">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[12px] font-semibold uppercase tracking-wider text-${p.color}`}>{p.label}</span>
                <span className={`text-[11px] px-2 py-0.5 rounded bg-${p.color}/[0.08] text-${p.color} font-semibold`}>${p.price}/mo</span>
              </div>
              <p className="font-display text-[28px] font-extrabold text-t1">{count}</p>
              <p className="text-[12px] text-t2 mt-1">org{count !== 1 ? 's' : ''} · ${(count * p.price).toLocaleString()}/mo revenue</p>
            </div>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-card/70 border border-border rounded-xl px-3.5 py-2 flex-1 max-w-[320px]">
          <svg className="w-3.5 h-3.5 text-t3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="bg-transparent text-[14px] text-t1 outline-none flex-1 placeholder:text-t3" placeholder="Search orgs or emails..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-1.5">
          {['all', 'active', 'trialing', 'inactive'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-[13px] font-medium capitalize transition ${statusFilter === s ? 'bg-cyan-glow text-cyan' : 'bg-card/50 border border-border text-t3 hover:text-t1'}`}>{s}</button>
          ))}
        </div>
        <span className="text-[13px] text-t2 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="glass-card rounded-[14px] overflow-hidden terminal-scanlines relative">
        <table className="w-full">
          <thead><tr>
            {['Organization', 'Members', 'Plan', 'Status', 'Cash Managed', 'Net Flow (30d)', 'Connections', 'Health', ''].map(h => (
              <th key={h} className="text-left px-4 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider border-b border-border bg-deep/30">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map(org => {
              const health = org.plan_status === 'active' && org.bank_connections.length > 0 ? 'healthy' : org.plan_status === 'active' ? 'setup' : 'at-risk'
              const healthColors = { healthy: 'bg-green text-green', setup: 'bg-amber text-amber', 'at-risk': 'bg-red text-red' }
              return (
                <tr key={org.id} className="hover:bg-card/40 transition cursor-pointer group border-b border-border/20 last:border-0" onClick={() => onSelect(org.id)}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center text-[13px] font-bold text-cyan">{org.name?.slice(0, 2).toUpperCase()}</div><div><p className="text-[14px] font-semibold group-hover:text-cyan active:text-cyan transition">{org.name}</p><p className="text-[12px] text-t3">{org.member_list?.[0]?.email || '—'}</p></div></div></td>
                  <td className="px-4 py-3 text-[14px] text-t2">{org.members}</td>
                  <td className="px-4 py-3"><Badge text={org.plan || 'none'} /></td>
                  <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${STATUS[org.plan_status] || ''}`}>{org.plan_status}</span></td>
                  <td className="px-4 py-3 font-mono text-[14px] font-semibold">{fmt(org.total_balance)}</td>
                  <td className={`px-4 py-3 font-mono text-[14px] font-semibold ${org.net_flow_30d >= 0 ? 'text-green' : 'text-red'}`}>{org.net_flow_30d >= 0 ? '+' : ''}{fmt(org.net_flow_30d)}</td>
                  <td className="px-4 py-3 text-[14px] text-t2">{org.bank_connections.length + org.qb_connections.length + org.accounting_connections.length}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${healthColors[health]?.split(' ')[0]}`} /><span className={`text-[12px] font-medium capitalize ${healthColors[health]?.split(' ')[1]}`}>{health}</span></div></td>
                  <td className="px-4 py-3"><ChevronRight size={14} className="text-t3 group-hover:text-cyan active:text-cyan transition" /></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p className="text-center text-[14px] text-t2 py-12">No organizations match your filters</p>}
      </div>
    </div>
  )
}

/* ═══ CUSTOMER DETAIL ═══ */
function CustomerDetail({ org, onBack, onUpdate, onDelete, isDark, ct }) {
  const [detailTab, setDetailTab] = useState('dashboard')
  const DTABS = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'accounts', label: 'Accounts', icon: CreditCard },
    { id: 'transactions', label: 'Transactions', icon: Activity },
    { id: 'connections', label: 'Connections', icon: Link2 },
    { id: 'team', label: 'Team', icon: Users },
    { id: 'admin', label: 'Admin', icon: Shield },
  ]

  const balChart = useMemo(() => {
    const byDate = {}
    ;(org.daily_balances || []).forEach(b => { byDate[b.date] = (byDate[b.date] || 0) + (b.balance || 0) })
    return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b)).map(([date, bal]) => ({ date, balance: bal }))
  }, [org.daily_balances])

  const txChart = useMemo(() => {
    const byDate = {}
    ;(org.transactions || []).forEach(t => {
      if (!byDate[t.date]) byDate[t.date] = { date: t.date, inflows: 0, outflows: 0 }
      if (t.amount < 0) byDate[t.date].inflows += Math.abs(t.amount)
      else byDate[t.date].outflows += t.amount
    })
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  }, [org.transactions])

  return (
    <div className="min-h-screen bg-void text-t1">
      <nav className="sticky top-0 z-50 border-b border-border bg-void/80 backdrop-blur-xl px-6 h-14 flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 text-t3 hover:text-t1 transition text-sm"><ArrowLeft size={16} /> Back</button>
        <div className="flex items-center gap-3"><span className="font-display text-[16px] font-bold">{org.name}</span><span className={`px-2.5 py-0.5 rounded text-[12px] font-semibold uppercase ${STATUS[org.plan_status] || ''}`}>{org.plan_status}</span></div>
        <span className="text-[13px] text-t2">{org.id.slice(0, 16)}...</span>
      </nav>
      <div className="border-b border-border bg-deep/50">
        <div className="max-w-[1400px] mx-auto px-6 flex items-center gap-1">
          {DTABS.map(t => (
            <button key={t.id} onClick={() => setDetailTab(t.id)}
              className={`relative flex items-center gap-2 px-5 py-3 text-[14px] font-medium transition-colors ${
                detailTab === t.id ? 'text-cyan' : 'text-t3 hover:text-t2'
              }`}>
              <t.icon size={14} strokeWidth={detailTab === t.id ? 2.2 : 1.8} /> {t.label}
              {detailTab === t.id && <div className="absolute bottom-0 left-3 right-3 h-[2px] bg-cyan rounded-t glow-xs" />}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-[1400px] mx-auto px-6 py-6 space-y-6">
        {detailTab === 'dashboard' && <>
          <div className="grid grid-cols-5 gap-3">
            <KPI icon={DollarSign} label="Total Cash" value={fmt(org.total_balance)} color="text-cyan" small />
            <KPI icon={TrendingUp} label="Inflows (30d)" value={`+${fmt(org.inflows_30d)}`} color="text-green" small />
            <KPI icon={Activity} label="Outflows (30d)" value={`-${fmt(org.outflows_30d)}`} color="text-red" small />
            <KPI icon={Clock} label="Runway" value={org.forecast?.runway_months ? `${org.forecast.runway_months.toFixed(1)} mo` : '—'} color="text-purple" small />
            <KPI icon={Database} label="Transactions" value={org.transactions_count} color="text-amber" small />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <ChartCard title="Cash Position" sub="Daily balance history" data={balChart} isDark={isDark} ct={ct}>
              {balChart.length > 0 && <ResponsiveContainer width="100%" height="100%"><AreaChart data={balChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(balChart.length / 6))} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} width={55} tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />} />
                <Area type="monotone" dataKey="balance" name="Balance" stroke={ct.line.primary} fill={ct.area.primary} strokeWidth={2} />
              </AreaChart></ResponsiveContainer>}
            </ChartCard>
            <ChartCard title="Cash Flow" sub="Inflows vs outflows" data={txChart} isDark={isDark} ct={ct}>
              {txChart.length > 0 && <ResponsiveContainer width="100%" height="100%"><ComposedChart data={txChart} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(txChart.length / 6))} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />} />
                <Bar dataKey="inflows" name="Inflows" fill={ct.bar.inflows} radius={[3, 3, 0, 0]} />
                <Bar dataKey="outflows" name="Outflows" fill={ct.bar.outflows} radius={[3, 3, 0, 0]} />
              </ComposedChart></ResponsiveContainer>}
            </ChartCard>
          </div>
        </>}

        {detailTab === 'accounts' && <DataTable
          title={`${org.accounts?.length || 0} Accounts — ${fmt(org.total_balance)} total`}
          headers={['Account', 'Type', 'Balance', 'Share', 'Active']}
          rows={(org.accounts || []).map(a => [
            a.name,
            <span className="capitalize">{a.type}</span>,
            <span className="font-mono font-semibold">{fmt(a.current_balance)}</span>,
            <div className="flex items-center gap-2"><div className="w-16 h-1.5 bg-void/60 rounded-full overflow-hidden"><div className="h-full bg-cyan rounded-full" style={{ width: `${org.total_balance > 0 ? (a.current_balance / org.total_balance * 100) : 0}%` }} /></div><span className="text-[13px] text-t2">{org.total_balance > 0 ? (a.current_balance / org.total_balance * 100).toFixed(0) : 0}%</span></div>,
            <span className={`w-2 h-2 rounded-full inline-block ${a.is_active ? 'bg-green' : 'bg-t4'}`} />,
          ])}
        />}

        {detailTab === 'transactions' && <DataTable
          title={`${org.transactions_count} Transactions`}
          headers={['Date', 'Description', 'Category', 'Amount', 'Status']}
          rows={(org.transactions || []).map(tx => [
            new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            <span className="max-w-[300px] truncate block">{tx.description}</span>,
            <Badge text={tx.category || 'other'} />,
            <span className={`font-mono font-medium ${tx.amount < 0 ? 'text-green' : 'text-t1'}`}>{tx.amount < 0 ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}</span>,
            <span className="flex items-center gap-1.5"><span className={`w-1.5 h-1.5 rounded-full ${tx.is_pending ? 'bg-amber' : 'bg-green'}`} />{tx.is_pending ? 'Pending' : 'Cleared'}</span>,
          ])}
        />}

        {detailTab === 'connections' && <div className="space-y-4">
          {[{ t: 'Bank Connections (Plaid)', d: org.bank_connections }, { t: 'QuickBooks', d: org.qb_connections }, { t: 'Accounting (Xero/Sage)', d: org.accounting_connections }].map(s => (
            <div key={s.t} className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
              <h3 className="text-[15px] font-semibold mb-3">{s.t} ({s.d?.length || 0})</h3>
              {s.d?.length > 0 ? <div className="divide-y divide-border/30">{s.d.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-3">
                  <div><p className="text-[14px] font-medium">{c.institution_name || c.company_name || c.provider}</p><p className="text-[13px] text-t2">Last synced: {timeSince(c.last_synced_at)}</p></div>
                  <span className={`px-2.5 py-0.5 rounded text-[12px] font-semibold uppercase ${STATUS[c.status] || ''}`}>{c.status}</span>
                </div>
              ))}</div> : <p className="text-[13px] text-t2">None</p>}
            </div>
          ))}
        </div>}

        {detailTab === 'team' && <div className="glass-card rounded-[14px] overflow-hidden terminal-scanlines relative">
          <div className="px-5 py-4 border-b border-border"><h3 className="text-[15px] font-semibold">{org.members} Team Members</h3></div>
          <div className="divide-y divide-border/30">
            {(org.member_list || []).map(m => (
              <div key={m.id} className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan to-purple flex items-center justify-center text-[13px] font-bold text-white">{(m.full_name || '??').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</div>
                  <div><p className="text-[14px] font-medium">{m.full_name || 'Unnamed'}</p><p className="text-[13px] text-t2">{m.email}</p></div>
                </div>
                <div className="flex items-center gap-3"><span className="text-[13px] text-t2">{timeSince(m.created_at)}</span><Badge text={m.role} /></div>
              </div>
            ))}
          </div>
        </div>}

        {detailTab === 'admin' && <div className="space-y-4">
          <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
            <h3 className="text-[15px] font-semibold mb-4">Organization Details</h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {[['Org ID', org.id], ['Name', org.name], ['Plan', org.plan || 'none'], ['Status', org.plan_status], ['Max Connections', org.max_bank_connections],
                ['Stripe Customer', org.stripe_customer_id || 'none'], ['Stripe Sub', org.stripe_subscription_id || 'none'],
                ['Trial Ends', org.trial_ends_at ? new Date(org.trial_ends_at).toLocaleDateString() : 'N/A'], ['Created', new Date(org.created_at).toLocaleString()],
              ].map(([l, v]) => (
                <div key={l} className="flex justify-between py-2 border-b border-border/30"><span className="text-[14px] text-t2">{l}</span><span className="font-mono text-[13px]">{v}</span></div>
              ))}
            </div>
          </div>
          <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
            <h3 className="text-[15px] font-semibold mb-4">Quick Actions</h3>
            <div className="flex flex-wrap gap-2">
              {org.plan_status !== 'active' && <ActionBtn l="Activate" c="green" onClick={() => onUpdate(org.id, { plan_status: 'active' })} />}
              <ActionBtn l="Starter" c="cyan" onClick={() => onUpdate(org.id, { plan: 'starter', max_bank_connections: 3 })} />
              <ActionBtn l="Growth" c="purple" onClick={() => onUpdate(org.id, { plan: 'growth', max_bank_connections: 10 })} />
              <ActionBtn l="Enterprise" c="amber" onClick={() => onUpdate(org.id, { plan: 'enterprise', max_bank_connections: 999 })} />
              {org.plan_status === 'active' && <ActionBtn l="Cancel" c="red" onClick={() => onUpdate(org.id, { plan_status: 'canceled' })} />}
              <ActionBtn l="Set Inactive" c="red" onClick={() => onUpdate(org.id, { plan_status: 'inactive' })} />
            </div>
          </div>
          <div className="bg-red/[0.03] border border-red/[0.15] rounded-[14px] p-5">
            <h3 className="text-[15px] font-semibold text-red mb-2">Danger Zone</h3>
            <p className="text-[13px] text-t2 mb-4">Permanently delete this organization and all associated data. This action cannot be undone.</p>
            <div className="flex gap-2">
              {org.member_list?.map(m => (
                <button key={m.id} onClick={() => onDelete(m.id, org.id)}
                  className="px-4 py-2 rounded-xl bg-red/[0.08] border border-red/[0.2] text-red text-[13px] font-semibold hover:bg-red/[0.15] transition">
                  Delete {m.full_name || m.email}
                </button>
              ))}
            </div>
          </div>
        </div>}
      </div>
    </div>
  )
}

/* ═══ CONNECTIONS ═══ */
function ConnectionsTab({ platform, orgs }) {
  const conns = platform?.all_connections || []
  const orgMap = {}; orgs.forEach(o => { orgMap[o.id] = o.name })

  // Provider breakdown
  const byProvider = {}
  conns.forEach(c => { byProvider[c.type] = (byProvider[c.type] || 0) + 1 })
  const providerData = Object.entries(byProvider).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count)

  // Status breakdown
  const connected = conns.filter(c => c.status === 'connected').length
  const disconnected = conns.filter(c => c.status === 'disconnected' || c.status === 'error').length
  const expired = conns.filter(c => c.status === 'token_expired').length
  const healthy = conns.length > 0 ? ((connected / conns.length) * 100).toFixed(0) : 0

  // Recently synced
  const recentSync = [...conns].filter(c => c.last_synced_at).sort((a, b) => new Date(b.last_synced_at) - new Date(a.last_synced_at)).slice(0, 8)

  const providerColors = { plaid: '#22D3EE', quickbooks: '#34D399', xero: '#818CF8', sage: '#FBBF24', netsuite: '#FB7185' }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KPI icon={Link2} label="Total Connections" value={conns.length} color="text-cyan" small />
        <KPI icon={Activity} label="Connected" value={connected} color="text-green" small />
        <KPI icon={Clock} label="Token Expired" value={expired} color="text-amber" small />
        <KPI icon={Shield} label="Disconnected" value={disconnected} color="text-red" small />
        <KPI icon={Eye} label="Health Rate" value={`${healthy}%`} color="text-purple" small />
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Provider breakdown */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="terminal-label mb-4">By Provider</h3>
          <div className="space-y-3">
            {providerData.map(p => (
              <div key={p.name} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold text-white" style={{ background: providerColors[p.name] || '#64748B' }}>{p.name.slice(0, 2).toUpperCase()}</div>
                <span className="text-[14px] font-medium capitalize flex-1">{p.name}</span>
                <div className="w-24 h-2 bg-void/40 rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-cyan" style={{ width: `${conns.length > 0 ? (p.count / conns.length * 100) : 0}%` }} />
                </div>
                <span className="text-[14px] font-semibold text-t1 w-8 text-right">{p.count}</span>
              </div>
            ))}
            {providerData.length === 0 && <p className="text-[14px] text-t2 text-center py-4">No connections yet</p>}
          </div>
        </div>

        {/* Status breakdown */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="terminal-label mb-4">Connection Health</h3>
          <div className="space-y-3">
            {[{ label: 'Connected', count: connected, color: 'green', pct: conns.length > 0 ? (connected / conns.length * 100) : 0 },
              { label: 'Token Expired', count: expired, color: 'amber', pct: conns.length > 0 ? (expired / conns.length * 100) : 0 },
              { label: 'Disconnected', count: disconnected, color: 'red', pct: conns.length > 0 ? (disconnected / conns.length * 100) : 0 },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className={`w-2.5 h-2.5 rounded-full bg-${s.color} shrink-0`} />
                <span className="text-[14px] text-t2 flex-1">{s.label}</span>
                <div className="w-20 h-2 bg-void/40 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-${s.color}`} style={{ width: `${s.pct}%` }} />
                </div>
                <span className="text-[14px] font-semibold text-t1 w-8 text-right">{s.count}</span>
              </div>
            ))}
          </div>
          {conns.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-t3">Overall health</span>
                <span className={`text-[16px] font-bold ${parseInt(healthy) > 80 ? 'text-green' : parseInt(healthy) > 50 ? 'text-amber' : 'text-red'}`}>{healthy}%</span>
              </div>
              <div className="w-full h-2.5 bg-void/40 rounded-full overflow-hidden mt-2">
                <div className={`h-full rounded-full ${parseInt(healthy) > 80 ? 'bg-green' : parseInt(healthy) > 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${healthy}%` }} />
              </div>
            </div>
          )}
        </div>

        {/* Recent sync activity */}
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <h3 className="terminal-label mb-4">Recent Syncs</h3>
          <div className="space-y-2">
            {recentSync.map((c, i) => (
              <div key={i} className="flex items-center gap-2.5 py-1.5">
                <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'connected' ? 'bg-green' : 'bg-amber'}`} />
                <span className="text-[13px] font-medium text-t1 flex-1 truncate">{c.institution_name || c.company_name || '—'}</span>
                <span className="text-[12px] text-t3 capitalize">{c.type}</span>
                <span className="text-[12px] text-t3 shrink-0">{timeSince(c.last_synced_at)}</span>
              </div>
            ))}
            {recentSync.length === 0 && <p className="text-[14px] text-t2 text-center py-4">No sync activity</p>}
          </div>
        </div>
      </div>

      {/* Full connections table */}
      <div className="glass-card rounded-[14px] overflow-hidden terminal-scanlines relative">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h3 className="text-[15px] font-semibold">All Connections</h3>
          <span className="text-[13px] text-t2">{conns.length} total</span>
        </div>
        <table className="w-full">
          <thead><tr>
            {['Provider', 'Institution', 'Organization', 'Status', 'Last Synced', 'Connected'].map(h => (
              <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider border-b border-border bg-deep/30">{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {conns.map((c, i) => (
              <tr key={i} className="hover:bg-card/40 transition border-b border-border/20 last:border-0">
                <td className="px-5 py-3"><Badge text={c.type} /></td>
                <td className="px-5 py-3 text-[14px] font-medium text-t1">{c.institution_name || c.company_name || '—'}</td>
                <td className="px-5 py-3 text-[14px] text-t2">{orgMap[c.org_id] || c.org_id?.slice(0, 8)}</td>
                <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${STATUS[c.status] || ''}`}>{c.status}</span></td>
                <td className="px-5 py-3 text-[13px] text-t2">{c.last_synced_at ? timeSince(c.last_synced_at) : 'Never'}</td>
                <td className="px-5 py-3 text-[13px] text-t3">{timeSince(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {conns.length === 0 && <p className="text-center text-[14px] text-t2 py-12">No connections yet</p>}
      </div>
    </div>
  )
}

/* ═══ ACTIVITY ═══ */
function ActivityTab({ platform }) {
  const [sub, setSub] = useState('audit')
  const auditLog = platform?.recent_audit || []
  const imports = platform?.recent_imports || []
  const copilot = platform?.copilot_messages || []

  // Activity stats
  const today = new Date().toISOString().split('T')[0]
  const todayAudit = auditLog.filter(l => l.created_at?.startsWith(today)).length
  const totalActions = auditLog.length
  const uniqueUsers = new Set(auditLog.map(l => l.user_id).filter(Boolean)).size
  const actionBreakdown = {}
  auditLog.forEach(l => { actionBreakdown[l.action] = (actionBreakdown[l.action] || 0) + 1 })
  const topActions = Object.entries(actionBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 6)

  const actionColors = { login: '#22D3EE', signup: '#34D399', create: '#34D399', update: '#FBBF24', delete: '#FB7185', sync: '#818CF8', connect: '#34D399', disconnect: '#FB7185', export: '#22D3EE', import: '#FBBF24' }

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        <KPI icon={Activity} label="Total Events" value={totalActions} color="text-cyan" small />
        <KPI icon={Clock} label="Today" value={todayAudit} color="text-green" small />
        <KPI icon={Users} label="Active Users" value={uniqueUsers} color="text-purple" small />
        <KPI icon={Upload} label="Data Imports" value={imports.length} color="text-amber" small />
        <KPI icon={MessageSquare} label="AI Conversations" value={copilot.length} color="text-cyan" small />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2">
        {[{ id: 'audit', l: 'Audit Log', i: Shield, count: auditLog.length },
          { id: 'imports', l: 'Data Imports', i: Upload, count: imports.length },
          { id: 'copilot', l: 'Copilot', i: MessageSquare, count: copilot.length },
          { id: 'breakdown', l: 'Breakdown', i: BarChart3, count: null },
        ].map(t => (
          <button key={t.id} onClick={() => setSub(t.id)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[14px] font-medium transition ${sub === t.id ? 'bg-cyan-glow text-cyan border border-cyan/[0.15]' : 'bg-card/50 text-t3 hover:text-t1 border border-border'}`}>
            <t.i size={14} /> {t.l} {t.count !== null && <span className="text-[11px] opacity-60">({t.count})</span>}
          </button>
        ))}
      </div>

      {/* Audit log — timeline view */}
      {sub === 'audit' && (
        <div className="glass-card rounded-[14px] overflow-hidden terminal-scanlines relative">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-[15px] font-semibold flex items-center gap-2"><Shield size={15} className="text-cyan" /> Audit Trail</h3>
            <span className="text-[13px] text-t2">{auditLog.length} events</span>
          </div>
          <div className="divide-y divide-border/20">
            {auditLog.map((log, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 hover:bg-card/40 transition">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: (actionColors[log.action] || '#64748B') + '18' }}><div className="w-2 h-2 rounded-full" style={{ background: actionColors[log.action] || '#64748B' }} /></div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-t1 font-medium">
                    <span className="font-semibold capitalize" style={{ color: actionColors[log.action] || 'var(--color-t1)' }}>{log.action}</span>
                    {log.resource_type && <span className="text-t2"> · {log.resource_type}</span>}
                  </p>
                  {log.details && <p className="text-[13px] text-t3 truncate mt-0.5">{typeof log.details === 'object' ? JSON.stringify(log.details).slice(0, 80) : log.details}</p>}
                </div>
                <span className="text-[12px] text-t3 tabular-nums shrink-0">{log.user_id?.slice(0, 8)}...</span>
                <span className="text-[12px] text-t3 shrink-0 w-16 text-right">{timeSince(log.created_at)}</span>
              </div>
            ))}
          </div>
          {auditLog.length === 0 && <p className="text-center text-[14px] text-t2 py-12">No audit events yet</p>}
        </div>
      )}

      {/* Data imports */}
      {sub === 'imports' && (
        <div className="glass-card rounded-[14px] overflow-hidden terminal-scanlines relative">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-[15px] font-semibold flex items-center gap-2"><Upload size={15} className="text-amber" /> Import History</h3>
            <span className="text-[13px] text-t2">{imports.length} imports</span>
          </div>
          {imports.length > 0 ? (
            <table className="w-full">
              <thead><tr>
                {['Source', 'File', 'Status', 'Rows', 'Skipped', 'Errors', 'Time'].map(h => (
                  <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider border-b border-border bg-deep/30">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {imports.map((imp, i) => (
                  <tr key={i} className="hover:bg-card/40 transition border-b border-border/20 last:border-0">
                    <td className="px-5 py-3"><span className="capitalize text-[14px] font-medium">{imp.source}</span></td>
                    <td className="px-5 py-3 text-[13px] text-t2 truncate max-w-[180px]">{imp.file_name || '—'}</td>
                    <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase ${imp.status === 'completed' ? 'bg-green-soft text-green' : imp.status === 'failed' ? 'bg-red-soft text-red' : 'bg-cyan-glow text-cyan'}`}>{imp.status}</span></td>
                    <td className="px-5 py-3 text-[14px] text-t2">{imp.rows_imported || 0}</td>
                    <td className="px-5 py-3 text-[14px] text-t3">{imp.rows_skipped || 0}</td>
                    <td className="px-5 py-3 text-[14px] text-t3">{imp.errors ? Object.keys(imp.errors).length : 0}</td>
                    <td className="px-5 py-3 text-[13px] text-t3">{timeSince(imp.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-center text-[14px] text-t2 py-12">No imports yet</p>}
        </div>
      )}

      {/* Copilot conversations */}
      {sub === 'copilot' && (
        <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[15px] font-semibold flex items-center gap-2"><MessageSquare size={15} className="text-cyan" /> AI Copilot History</h3>
            <span className="text-[13px] text-t2">{copilot.length} messages</span>
          </div>
          <div className="space-y-2.5 max-h-[600px] overflow-y-auto">
            {copilot.map(msg => (
              <div key={msg.id} className={`p-4 rounded-xl ${msg.role === 'user' ? 'bg-void/60 border border-border/50' : 'bg-cyan/[0.04] border border-cyan/[0.08]'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${msg.role === 'user' ? 'bg-purple/[0.12] text-purple' : 'bg-cyan/[0.12] text-cyan'}`}>
                    {msg.role === 'user' ? 'U' : 'AI'}
                  </span>
                  <span className="text-[12px] font-semibold text-t2 capitalize">{msg.role}</span>
                  <span className="text-[11px] text-t3">{timeSince(msg.created_at)}</span>
                </div>
                <p className="text-[14px] text-t2 leading-relaxed">{msg.content?.slice(0, 300)}{msg.content?.length > 300 ? '...' : ''}</p>
              </div>
            ))}
            {copilot.length === 0 && <p className="text-[14px] text-t2 text-center py-8">No copilot conversations yet</p>}
          </div>
        </div>
      )}

      {/* Action breakdown */}
      {sub === 'breakdown' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
            <h3 className="terminal-label mb-4">Actions by Type</h3>
            <div className="space-y-3">
              {topActions.map(([action, count]) => (
                <div key={action} className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: (actionColors[action] || '#64748B') + '18' }}><div className="w-2 h-2 rounded-full" style={{ background: actionColors[action] || '#64748B' }} /></div>
                  <span className="text-[14px] font-medium capitalize flex-1">{action}</span>
                  <div className="w-28 h-2 bg-void/40 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-cyan" style={{ width: `${totalActions > 0 ? (count / totalActions * 100) : 0}%` }} />
                  </div>
                  <span className="text-[14px] font-semibold text-t1 w-10 text-right">{count}</span>
                </div>
              ))}
              {topActions.length === 0 && <p className="text-[14px] text-t2 text-center py-4">No activity data</p>}
            </div>
          </div>
          <div className="glass-card rounded-[14px] p-5 terminal-scanlines relative">
            <h3 className="terminal-label mb-4">Platform Activity Summary</h3>
            <div className="space-y-3">
              {[{ l: 'Total audit events', v: totalActions, c: 'cyan' },
                { l: 'Unique active users', v: uniqueUsers, c: 'purple' },
                { l: 'Events today', v: todayAudit, c: 'green' },
                { l: 'Data imports completed', v: imports.filter(i => i.status === 'completed').length, c: 'amber' },
                { l: 'Data imports failed', v: imports.filter(i => i.status === 'failed').length, c: 'red' },
                { l: 'AI copilot messages', v: copilot.length, c: 'cyan' },
                { l: 'User messages', v: copilot.filter(m => m.role === 'user').length, c: 'purple' },
                { l: 'AI responses', v: copilot.filter(m => m.role === 'assistant').length, c: 'green' },
              ].map(item => (
                <div key={item.l} className="flex items-center justify-between py-1">
                  <span className="text-[14px] text-t2">{item.l}</span>
                  <span className={`text-[15px] font-bold text-${item.c}`}>{item.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══ SHARED ═══ */
function KPI({ icon: Icon, label, value, color, small }) {
  return (
    <div className="glass-card rounded-[14px] p-4 terminal-scanlines relative hover:border-border-cyan active:border-border-cyan transition group">
      <div className="flex items-center justify-between mb-2.5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${color.replace('text-', '')}/[0.08] group-hover:bg-${color.replace('text-', '')}/[0.12] transition`}>
          <Icon size={small ? 14 : 15} className={color} strokeWidth={2} />
        </div>
      </div>
      <p className={`font-mono ${small ? 'text-[20px]' : 'text-[24px]'} font-bold ${color} tracking-tight`}>{value}</p>
      <p className="text-[11px] text-t3 uppercase tracking-[0.08em] font-medium mt-1.5">{label}</p>
    </div>
  )
}
function Card({ title, children }) {
  return (
    <div className="glass-card rounded-[14px] p-5 hover:border-border-hover active:border-border-hover transition">
      <h3 className="text-[12px] text-t3 font-semibold uppercase tracking-[0.08em] mb-4 flex items-center gap-2">
        <div className="w-1 h-3.5 rounded-full bg-cyan/50" />{title}
      </h3>
      {children}
    </div>
  )
}
function ChartCard({ title, sub, data, children }) {
  return (
    <div className="glass-card rounded-[14px] p-5 hover:border-border-hover active:border-border-hover transition">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="text-[12px] text-t3 mt-0.5">{sub}</p>
        </div>
        {data?.length > 0 && <span className="text-[11px] text-t3 bg-void/30 px-2 py-0.5 rounded-md">{data.length} pts</span>}
      </div>
      <div className="h-[220px]">{data?.length > 0 ? children : <div className="h-full flex flex-col items-center justify-center"><div className="w-10 h-10 rounded-xl bg-cyan/[0.04] flex items-center justify-center mb-2"><Globe size={18} className="text-t3" /></div><p className="text-t3 text-[14px]">No data yet</p></div>}</div>
    </div>
  )
}
function DataTable({ title, headers, rows }) {
  return (
    <div className="glass-card rounded-[14px] overflow-hidden hover:border-border-hover active:border-border-hover transition">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <span className="text-[12px] text-t3">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <table className="w-full">
        <thead><tr>{headers.map(h => <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-wider border-b border-border bg-deep/20">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className="hover:bg-card/40 transition border-b border-border/15 last:border-0">{row.map((cell, j) => <td key={j} className="px-5 py-3 text-[14px] text-t2">{cell}</td>)}</tr>)}</tbody>
      </table>
      {rows.length === 0 && <p className="text-center text-[14px] text-t3 py-10">No data</p>}
    </div>
  )
}
function Badge({ text }) {
  const colors = { plaid: 'bg-cyan/[0.08] text-cyan', quickbooks: 'bg-green/[0.08] text-green', xero: 'bg-purple/[0.08] text-purple', sage: 'bg-amber/[0.08] text-amber', netsuite: 'bg-red/[0.08] text-red', starter: 'bg-cyan/[0.08] text-cyan', growth: 'bg-purple/[0.08] text-purple', enterprise: 'bg-green/[0.08] text-green' }
  return <span className={`px-2 py-0.5 rounded-md text-[12px] font-semibold uppercase ${colors[text?.toLowerCase()] || 'bg-cyan-glow text-cyan'}`}>{text}</span>
}
function ActionBtn({ l, c, onClick }) {
  const cs = { green: 'bg-green-soft text-green hover:bg-green/20', cyan: 'bg-cyan-glow text-cyan hover:bg-cyan/20', purple: 'bg-purple-soft text-purple hover:bg-purple/20', amber: 'bg-amber-soft text-amber hover:bg-amber/20', red: 'bg-red-soft text-red hover:bg-red/20' }
  return <button onClick={onClick} className={`px-3 py-1.5 rounded-lg text-[13px] font-semibold transition ${cs[c]}`}>{l}</button>
}
