import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { isPeriodAllowed, periodRequiredPlan } from '@/lib/planEngine'
import { DollarSign, TrendingUp, Clock, CheckCircle, ArrowUpRight, ArrowDownRight, Sparkles, Activity, CreditCard, ChevronRight, RefreshCw, Gift, Package, Copy, ArrowRight } from 'lucide-react'
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, AreaChart, Area, ReferenceLine } from 'recharts'
import { useMemo, useState, useEffect } from 'react'
import { useChartTheme } from '@/hooks/useChartTheme'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import GrowthNudge from '@/components/GrowthNudge'
import { MaskedBalance } from '@/components/MaskedValue'
import BankLogo from '@/components/BankLogo'
import OnboardingChecklist from '@/components/Onboarding'
import { ValueReinforcement, NPSSurvey, MilestoneBanner } from '@/components/CustomerJourney'
import { SectionBoundary } from '@/components/ErrorBoundary'

import { SkeletonPage } from '@/components/Skeleton'

const CATEGORIES_DARK = {
  revenue: { bg: 'bg-green-soft', text: 'text-green', label: 'Revenue', color: '#34D399' },
  payroll: { bg: 'bg-purple-soft', text: 'text-purple', label: 'Payroll', color: '#818CF8' },
  vendor: { bg: 'bg-amber-soft', text: 'text-amber', label: 'Vendor', color: '#FBBF24' },
  saas: { bg: 'bg-purple-soft', text: 'text-purple', label: 'SaaS', color: '#A78BFA' },
  tax: { bg: 'bg-red-soft', text: 'text-red', label: 'Tax', color: '#FB7185' },
  transfer: { bg: 'bg-cyan-glow', text: 'text-cyan', label: 'Transfer', color: '#22D3EE' },
  operations: { bg: 'bg-deep', text: 'text-t2', label: 'Ops', color: '#94A3B8' },
  other: { bg: 'bg-deep', text: 'text-t3', label: 'Other', color: '#64748B' },
}
const CATEGORIES_LIGHT = {
  revenue: { bg: 'bg-green-soft', text: 'text-green', label: 'Revenue', color: '#16A34A' },
  payroll: { bg: 'bg-purple-soft', text: 'text-purple', label: 'Payroll', color: '#7C3AED' },
  vendor: { bg: 'bg-amber-soft', text: 'text-amber', label: 'Vendor', color: '#D97706' },
  saas: { bg: 'bg-purple-soft', text: 'text-purple', label: 'SaaS', color: '#8B5CF6' },
  tax: { bg: 'bg-red-soft', text: 'text-red', label: 'Tax', color: '#DC2626' },
  transfer: { bg: 'bg-cyan-glow', text: 'text-cyan', label: 'Transfer', color: '#0891B2' },
  operations: { bg: 'bg-deep', text: 'text-t2', label: 'Ops', color: '#64748B' },
  other: { bg: 'bg-deep', text: 'text-t3', label: 'Other', color: '#94A3B8' },
}

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return `$${(abs / 1e6).toFixed(2)}M`
  if (abs >= 1e5) return `$${(abs / 1e3).toFixed(0)}K`
  if (abs >= 1e3) return `$${(abs / 1e3).toFixed(1)}K`
  return `$${abs.toFixed(0)}`
}

export default function Dashboard() {
  const { profile, org } = useAuth()
  const { accounts, transactions, cashPosition, forecast, loading, lastFetched, refetch } = useTreasury()
  const [searchQuery, setSearchQuery] = useState('')
  const [chartPeriod, setChartPeriod] = useState('30D')
  const [showMA, setShowMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)
  const [chartMode, setChartMode] = useState('flow') // flow (bars) | cumulative (area)
  const [hiddenSeries, setHiddenSeries] = useState(new Set())
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const CAT = isDark ? CATEGORIES_DARK : CATEGORIES_LIGHT

  useEffect(() => { document.title = 'Dashboard — Vaultline' }, [])

  const toggleSeries = (key) => setHiddenSeries(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })

  const chartData = useMemo(() => {
    const now = new Date()
    const days = chartPeriod === '7D' ? 7 : chartPeriod === '90D' ? 90 : 30
    const cutoff = new Date(now.getTime() - days * 86400000)
    
    // Build a complete date range with all days
    const byDate = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(cutoff.getTime() + (i + 1) * 86400000)
      const dateStr = d.toISOString().split('T')[0]
      byDate[dateStr] = { date: dateStr, inflows: 0, outflows: 0 }
    }
    
    // Fill in actual transaction data
    transactions.forEach((tx) => {
      const d = tx.date
      if (!d || !byDate[d]) return
      const amt = Number(tx.amount) || 0
      if (amt < 0) byDate[d].inflows += Math.abs(amt)
      else byDate[d].outflows += amt
    })
    
    const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({ ...d, net: d.inflows - d.outflows }))
    if (!sorted.length) return []
    // 7-day moving average on net
    sorted.forEach((d, i) => {
      if (i < 6) { d.ma7 = null; return }
      d.ma7 = Math.round(sorted.slice(i - 6, i + 1).reduce((s, x) => s + x.net, 0) / 7)
    })
    // EMA-14 on net
    const emaK = 2 / 15; let emaP = null
    sorted.forEach(d => {
      if (emaP === null) { emaP = d.net; d.ema14 = emaP; return }
      emaP = d.net * emaK + emaP * (1 - emaK); d.ema14 = Math.round(emaP)
    })
    // Cumulative running balance
    let cum = 0
    sorted.forEach(d => { cum += d.net; d.cumulative = Math.round(cum) })
    return sorted
  }, [transactions, chartPeriod])

  // High/Low/Avg for net flow
  const netValues = chartData.map(d => d.net)
  const chartHigh = netValues.length > 0 ? Math.max(...netValues) : 0
  const chartLow = netValues.length > 0 ? Math.min(...netValues) : 0
  const chartAvg = netValues.length > 0 ? Math.round(netValues.reduce((s, v) => s + v, 0) / netValues.length) : 0

  const sparkData = useMemo(() => chartData.slice(-7).map((d, i) => ({ i, v: d.net })), [chartData])

  const totalCash = cashPosition?.total_balance || 0
  const runway = forecast?.runway_months || 0
  const confidence = forecast?.confidence ? (forecast.confidence * 100).toFixed(0) : null

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000)
  const recentTx = transactions.filter(t => t.date && new Date(t.date) >= thirtyDaysAgo)
  const inflows = recentTx.filter(t => (Number(t.amount) || 0) < 0).reduce((s, t) => s + Math.abs(Number(t.amount) || 0), 0)
  const outflows = recentTx.filter(t => (Number(t.amount) || 0) > 0).reduce((s, t) => s + (Number(t.amount) || 0), 0)
  const netFlow = inflows - outflows

  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000)
  const thisWeekNet = recentTx.filter(t => new Date(t.date) >= sevenDaysAgo).reduce((s, t) => s + (t.amount < 0 ? Math.abs(t.amount) : -t.amount), 0)
  const lastWeekNet = recentTx.filter(t => { const d = new Date(t.date); return d >= fourteenDaysAgo && d < sevenDaysAgo }).reduce((s, t) => s + (t.amount < 0 ? Math.abs(t.amount) : -t.amount), 0)
  const weekChange = lastWeekNet !== 0 ? ((thisWeekNet - lastWeekNet) / Math.abs(lastWeekNet) * 100).toFixed(1) : null

  const topCategories = useMemo(() => {
    const map = {}
    recentTx.filter(t => t.amount > 0).forEach(t => { const c = t.category || 'other'; map[c] = (map[c] || 0) + t.amount })
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, total]) => ({
      cat, total, pct: outflows > 0 ? (total / outflows * 100) : 0, ...CAT[cat] || CAT.other
    }))
  }, [recentTx, outflows])

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      {/* Welcome bar */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-[24px] font-extrabold tracking-tight">{greeting}, {(profile?.full_name || 'there').split(' ')[0]}</h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-[13px] text-t3">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <span className="text-[10px] font-mono text-t3 bg-deep px-2 py-0.5 rounded border border-border">{accounts.length} ACCTS</span>
            <span className="text-[10px] font-mono text-t3 bg-deep px-2 py-0.5 rounded border border-border">{transactions.length} TXNS</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-t3 uppercase tracking-[0.1em] font-mono font-semibold">Total Cash Position</p>
          <p className="font-mono text-[32px] font-black text-t1 tracking-tight leading-none mt-1 terminal-data">{fmt(totalCash)}</p>
          {weekChange && (
            <span className={`inline-flex items-center gap-0.5 text-[13px] font-semibold font-mono mt-1 ${parseFloat(weekChange) >= 0 ? 'text-green' : 'text-red'}`}>
              {parseFloat(weekChange) >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {Math.abs(parseFloat(weekChange))}% vs last week
            </span>
          )}
        </div>
      </div>

      {/* Onboarding checklist — first-run setup */}
      <SectionBoundary name="Onboarding" height="h-auto"><OnboardingChecklist /></SectionBoundary>

      {/* Lifecycle engagement — value recap, milestones, NPS */}
      <SectionBoundary name="ValueReinforcement" height="h-auto"><ValueReinforcement /></SectionBoundary>
      <SectionBoundary name="MilestoneBanner" height="h-auto"><MilestoneBanner /></SectionBoundary>
      <SectionBoundary name="NPSSurvey" height="h-auto"><NPSSurvey /></SectionBoundary>

      {/* Stat cards */}
      <SectionBoundary name="Key Metrics" height="h-[120px]">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} color="cyan" label="Total Cash" value={fmt(totalCash)} isDark={isDark} sparkData={sparkData}
          badge={accounts.length > 0 ? `${accounts.length} acct${accounts.length !== 1 ? 's' : ''}` : null} />
        <StatCard icon={TrendingUp} color="green" label="Net Flow (30d)" value={`${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`} isDark={isDark} sparkData={sparkData}
          badge={netFlow >= 0 ? 'Positive' : 'Negative'} badgeColor={netFlow >= 0 ? 'green' : 'red'} />
        <StatCard icon={Clock} color="purple" label="Cash Runway" value={runway > 0 && isFinite(runway) ? `${runway.toFixed(1)} mo` : '\u2014'} isDark={isDark}
          badge={runway > 12 ? 'Healthy' : runway > 6 ? 'Monitor' : runway > 0 ? 'Low' : null}
          badgeColor={runway > 12 ? 'green' : runway > 6 ? 'amber' : 'red'} />
        <StatCard icon={CheckCircle} color="amber" label="Forecast Confidence" value={confidence ? `${confidence}%` : '\u2014'} isDark={isDark}
          badge={confidence ? (confidence > 85 ? 'High' : 'Moderate') : null}
          badgeColor={confidence > 85 ? 'green' : 'amber'} />
      </div>
      </SectionBoundary>

      {/* AI Insight */}
      {accounts.length > 0 && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-xl bg-cyan-glow flex items-center justify-center shrink-0 mt-0.5">
              <Sparkles size={16} className="text-cyan" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-cyan">AI Treasury Insight</span>
                <span className="w-1 h-1 rounded-full bg-t4" />
                <span className="text-[11px] text-t4">Updated just now</span>
              </div>
              <p className="text-[14px] text-t2 leading-[1.7]">
                {netFlow >= 0 ? (
                  <>Cash position is <span className="text-green font-semibold">healthy</span> {'\u2014'} {fmt(netFlow)} net inflows over 30 days across {accounts.length} account{accounts.length !== 1 ? 's' : ''}.
                  {totalCash > 500000 ? ` Consider allocating ${fmt(Math.min(totalCash * 0.12, 2000000))} to a high-yield treasury position.` : ''}</>
                ) : (
                  <><span className="text-amber font-semibold">{fmt(Math.abs(netFlow))} net outflows</span> over 30 days.
                  {runway > 0 && isFinite(runway) ? ` Runway at ${runway.toFixed(1)} months.` : ''} Review top expense categories below.</>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="flex items-center gap-3">
        <span className="terminal-label">ACTIONS</span>
        {[
          { label: 'Cash Position', to: '/position', color: 'cyan' },
          { label: 'Run Report', to: '/reports', color: 'green' },
          { label: 'AI Copilot', to: '#', color: 'purple', onClick: () => document.querySelector('[data-copilot]')?.click() },
          { label: 'Connect Bank', to: '/banks', color: 'amber' },
          { label: 'Forecast', to: '/forecasting', color: 'cyan' },
        ].map(a => (
          <Link key={a.label} to={a.to} onClick={a.onClick}
            className={`px-3.5 py-2 rounded-lg border border-border text-[12px] font-mono font-semibold text-t3 hover:text-${a.color} hover:border-${a.color}/[0.15] hover:bg-${a.color}/[0.03] active:scale-[0.98] transition-all`}>
            {a.label}
          </Link>
        ))}
      </div>

      {/* Growth nudges */}
      <SectionBoundary name="Recommendations" height="h-auto"><GrowthNudge /></SectionBoundary>

      {/* Main grid: Chart + Right sidebar */}
      <div className="grid grid-cols-[1fr_340px] gap-4">
        {/* Cash flow chart */}
        <SectionBoundary name="Cash Flow Chart" height="h-[380px]">
        <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-colors relative terminal-scanlines">
          <div className="relative z-[2]">
          <div className="flex items-center justify-between px-5 pt-5 pb-4">
            <div>
              <div className="flex items-center gap-3">
                <span className="terminal-label">CASHFLOW</span>
                <span className="text-[11px] font-mono text-t3">{chartData.length} pts</span>
              </div>
              <div className="flex items-center gap-4 mt-1.5">
                <span className="text-[11px] font-mono text-t3">IN: <span className="text-green font-semibold terminal-data">{fmt(chartData.reduce((s, d) => s + d.inflows, 0))}</span></span>
                <span className="text-[11px] font-mono text-t3">OUT: <span className="text-red font-semibold terminal-data">{fmt(chartData.reduce((s, d) => s + d.outflows, 0))}</span></span>
                <span className="text-[11px] font-mono text-t3">NET: <span className={`font-semibold terminal-data ${netFlow >= 0 ? 'text-cyan' : 'text-red'}`}>{netFlow >= 0 ? '+' : ''}{fmt(netFlow)}</span></span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-t3 font-mono flex-wrap">
              {/* Mode toggle */}
              <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
                {[{id:'flow',label:'FLOW'},{id:'cumulative',label:'CUMUL'}].map(m => (
                  <button key={m.id} onClick={() => setChartMode(m.id)} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${chartMode === m.id ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'}`}>{m.label}</button>
                ))}
              </div>
              {/* Period */}
              <div className="flex items-center gap-0.5 border border-border rounded-lg p-0.5">
                {['7D', '30D', '90D'].map(p => {
                  const allowed = isPeriodAllowed(org?.plan || 'starter', p)
                  return (
                    <button key={p} onClick={() => allowed ? setChartPeriod(p) : null} title={!allowed ? `Upgrade to ${periodRequiredPlan(p)} for ${p} view` : ''}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all relative ${chartPeriod === p ? 'bg-cyan/[0.08] text-cyan' : allowed ? 'text-t3 hover:text-t2' : 'text-t4/30 cursor-not-allowed line-through decoration-t4/20'}`}>
                      {p}
                    </button>
                  )
                })}
              </div>
              {/* Overlays */}
              <button onClick={() => setShowMA(!showMA)} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${showMA ? 'bg-green/[0.08] text-green border border-green/[0.12]' : 'text-t3 border border-transparent hover:text-t2'}`}>MA7</button>
              <button onClick={() => setShowEMA(!showEMA)} className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${showEMA ? 'bg-amber/[0.08] text-amber border border-amber/[0.12]' : 'text-t3 border border-transparent hover:text-t2'}`}>EMA14</button>
            </div>
          </div>
          {/* Interactive legend — click to toggle */}
          <div className="flex items-center gap-2 px-5 pb-2 text-[10px] font-mono">
            {[
              { key:'inflows', label:'In', color:ct.bar?.inflows || '#34D399', type:'square' },
              { key:'outflows', label:'Out', color:ct.bar?.outflows || '#FB7185', type:'square' },
              { key:'net', label:'Net', color:ct.line?.primary || '#22D3EE', type:'line' },
            ].map(s => {
              const hidden = hiddenSeries.has(s.key)
              return (
                <button key={s.key} onClick={() => toggleSeries(s.key)} className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all border ${hidden ? 'opacity-30 border-transparent' : 'border-border'}`}>
                  {s.type === 'square' ? <span className="w-2 h-2 rounded-sm" style={{ background: hidden ? '#475569' : s.color }} /> :
                   <span className="w-4 h-[2px] rounded-full" style={{ background: hidden ? '#475569' : s.color }} />}
                  <span style={{ color: hidden ? '#475569' : s.color }}>{s.label}</span>
                </button>
              )
            })}
            {chartData.length > 2 && (
              <span className="ml-auto flex items-center gap-3 text-t3">
                <span>H: <span className="text-green terminal-data">{fmt(chartHigh)}</span></span>
                <span>L: <span className="text-red terminal-data">{fmt(chartLow)}</span></span>
                <span>AVG: <span className="text-cyan terminal-data">{fmt(chartAvg)}</span></span>
              </span>
            )}
          </div>
          <div className="h-[260px] px-2 chart-scanlines">
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} barGap={1}>
                  <defs>
                    <linearGradient id="dashInflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ct.bar.inflows} stopOpacity={1} />
                      <stop offset="100%" stopColor={ct.bar.inflows} stopOpacity={isDark ? 0.4 : 0.6} />
                    </linearGradient>
                    <linearGradient id="dashOutflowGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ct.bar.outflows} stopOpacity={1} />
                      <stop offset="100%" stopColor={ct.bar.outflows} stopOpacity={isDark ? 0.4 : 0.6} />
                    </linearGradient>
                    <linearGradient id="dashNetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ct.line.primary} stopOpacity={isDark ? 0.1 : 0.14} />
                      <stop offset="100%" stopColor={ct.line.primary} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashCumGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={isDark ? '#22D3EE' : '#0891B2'} stopOpacity={isDark ? 0.15 : 0.2} />
                      <stop offset="100%" stopColor={isDark ? '#22D3EE' : '#0891B2'} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="1 6" stroke={ct.grid} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 6))}
                    tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} />
                  <YAxis tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} width={55}
                    tickFormatter={(v) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' })} />}
                    cursor={{ stroke: isDark ? 'rgba(34,211,238,0.12)' : 'rgba(8,145,178,0.08)', strokeWidth: 1 }} />
                  {/* Cumulative mode: area chart */}
                  {chartMode === 'cumulative' && !hiddenSeries.has('net') && (
                    <><Area dataKey="cumulative" name="Cumulative" type="monotone" stroke={isDark ? '#22D3EE' : '#0891B2'} strokeWidth={2.5} fill="url(#dashCumGrad)" dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? '#0C1323' : '#fff', fill: isDark ? '#22D3EE' : '#0891B2' }} /></>
                  )}
                  {/* Flow mode: bars + net line */}
                  {chartMode === 'flow' && !hiddenSeries.has('inflows') && <Bar dataKey="inflows" name="Inflows" fill="url(#dashInflowGrad)" radius={[6, 6, 2, 2]} animationBegin={200} animationDuration={800} animationEasing="ease-out" />}
                  {chartMode === 'flow' && !hiddenSeries.has('outflows') && <Bar dataKey="outflows" name="Outflows" fill="url(#dashOutflowGrad)" radius={[6, 6, 2, 2]} animationBegin={350} animationDuration={800} animationEasing="ease-out" />}
                  {chartMode === 'flow' && !hiddenSeries.has('net') && <Area dataKey="net" name="Net Trend" legendType="none" tooltipType="none" stroke="none" fill="url(#dashNetGrad)" />}
                  {chartMode === 'flow' && !hiddenSeries.has('net') && <Line dataKey="net" name="Net Flow" type="monotone" stroke={ct.line.primary} strokeWidth={2.5} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? '#0C1323' : '#fff', fill: ct.line.primary }} animationBegin={600} animationDuration={1000} animationEasing="ease-out" />}
                  {/* Overlays — work in both modes */}
                  {showMA && <Line dataKey="ma7" name="7-Day Avg" type="monotone" stroke={isDark ? '#34D399' : '#059669'} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />}
                  {showEMA && <Line dataKey="ema14" name="EMA-14" type="monotone" stroke={isDark ? '#FBBF24' : '#D97706'} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />}
                  {chartData.length > 3 && <ReferenceLine y={chartAvg} stroke={isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.2)'} strokeDasharray="6 4" label={{ value: 'AVG', position: 'right', fontSize: 9, fill: ct.tick, fontFamily: 'JetBrains Mono' }} />}
                </ComposedChart>
              </ResponsiveContainer>
            ) : <EmptyChart label="Cash flow data" sub="Connect a bank or import transactions" />}
          </div>
          {chartData.length > 0 && (
            <div className="terminal-status flex items-center justify-between px-5 py-1.5">
              <div className="flex items-center gap-4 text-t3">
                <span className="terminal-live">LIVE</span>
                <span>DAYS: <span className="text-t2">{chartData.length}</span></span>
                <span>MODE: <span className="text-cyan">{chartMode === 'cumulative' ? 'CUMUL' : 'FLOW'}</span></span>
                <span>PERIOD: <span className="text-cyan">{chartPeriod}</span></span>
              </div>
              <div className="flex items-center gap-4 text-t3">
                {showMA && <span className="text-green">MA7</span>}
                {showEMA && <span className="text-amber">EMA14</span>}
                <span>RATIO: <span className="text-t2 terminal-data">{chartData.length > 0 ? (chartData.filter(d => d.net >= 0).length / chartData.length * 100).toFixed(0) : 0}% +</span></span>
                {lastFetched && <span>UPDATED: <span className="text-t2">{Math.round((Date.now() - lastFetched) / 1000) < 60 ? 'just now' : `${Math.round((Date.now() - lastFetched) / 60000)}m ago`}</span></span>}
                <button onClick={() => refetch({ force: true })} className="text-t3 hover:text-cyan transition" title="Refresh data"><RefreshCw size={10} /></button>
              </div>
            </div>
          )}
          </div>
        </div>
        </SectionBoundary>

        {/* Right column: Accounts + Top spend */}
        <SectionBoundary name="Account Summary" height="h-[380px]">
        <div className="flex flex-col gap-4">
          {/* Accounts */}
          <div className="glass-card rounded-2xl p-4 hover:border-border-hover active:border-border-hover transition-colors flex-1">
            <div className="flex items-center justify-between mb-3">
              <span className="terminal-label">ACCOUNTS</span>
              <Link to="/position" className="text-[12px] text-t3 hover:text-cyan active:text-cyan transition flex items-center gap-0.5">View all <ChevronRight size={10} /></Link>
            </div>
            <div className="space-y-2">
              {accounts.slice(0, 4).map((acct) => (
                <div key={acct.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-deep active:bg-deep transition group">
                  <BankLogo
                    name={acct.bank_connections?.institution_name}
                    color={acct.bank_connections?.institution_color}
                    size={36}
                    className="shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-t1 truncate">{acct.bank_connections?.institution_name || acct.name}</p>
                    <p className="text-[11px] text-t3 capitalize">{acct.type}</p>
                  </div>
                  <div className="text-right">
                    <MaskedBalance value={acct.current_balance} className="font-bold text-t1 tracking-tight terminal-data" size="sm" />
                    {totalCash > 0 && <p className="text-[11px] text-t3">{(acct.current_balance / totalCash * 100).toFixed(0)}%</p>}
                  </div>
                </div>
              ))}
              {accounts.length === 0 && (
                <Link to="/banks" className="flex flex-col items-center py-6 text-center group">
                  <div className="w-10 h-10 rounded-xl bg-cyan-glow flex items-center justify-center mb-2 group-hover:bg-border-cyan transition">
                    <CreditCard size={18} className="text-t3 group-hover:text-cyan active:text-cyan transition" />
                  </div>
                  <p className="text-[13px] text-t2 font-medium group-hover:text-cyan active:text-cyan transition">Connect your first bank</p>
                </Link>
              )}
            </div>
          </div>

          {/* Top spend categories */}
          {topCategories.length > 0 && (
            <div className="glass-card rounded-2xl p-4 hover:border-border-hover active:border-border-hover transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="terminal-label">TOP SPEND</span>
                <Link to="/transactions" className="text-[12px] text-t3 hover:text-cyan active:text-cyan transition flex items-center gap-0.5">Details <ChevronRight size={10} /></Link>
              </div>
              <div className="space-y-2">
                {topCategories.map((c, i) => (
                  <div key={c.cat} className="group hover:bg-deep active:bg-deep rounded-lg p-2 -mx-2 transition">
                    <div className="flex items-center gap-2.5">
                      <span className="text-[10px] font-mono font-bold text-t3 w-4 text-right">{i + 1}</span>
                      <div className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: c.color }} />
                      <span className="text-[13px] text-t2 flex-1 truncate">{c.label}</span>
                      <span className="font-mono text-[13px] font-bold text-t1 terminal-data">{fmt(c.total)}</span>
                    </div>
                    <div className="flex items-center gap-2.5 mt-1.5 ml-[26px]">
                      <div className="flex-1 h-[4px] bg-deep rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${c.pct}%`, background: c.color }} />
                      </div>
                      <span className="text-[10px] font-mono text-t3 w-8 text-right">{c.pct.toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        </SectionBoundary>
      </div>

      {/* Recent Transactions */}
      <SectionBoundary name="Recent Transactions" height="h-[300px]">
      <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-colors relative terminal-scanlines">
        <div className="relative z-[2]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <span className="terminal-label">TXN FEED</span>
            <span className="text-[12px] text-t3 bg-deep px-1.5 py-0.5 rounded font-mono font-medium">{transactions.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 glass-input rounded-lg px-3 py-1.5">
              <svg className="w-3.5 h-3.5 text-t3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="bg-transparent text-[13px] text-t1 outline-none w-36 placeholder:text-t4" placeholder="Search..."
                value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>
            <Link to="/transactions" className="text-[12px] text-t3 hover:text-cyan active:text-cyan transition font-semibold">View all &rarr;</Link>
          </div>
        </div>
        <div className="overflow-x-auto -mx-5 px-5"><table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-deep">
              {['Date', 'Description', 'Category', 'Account', 'Amount'].map((h) => (
                <th key={h} className="text-left px-5 py-2.5 text-[11px] font-semibold text-t3 uppercase tracking-[0.08em] border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.filter(tx => {
              if (!searchQuery.trim()) return true
              return (tx.description || '').toLowerCase().includes(searchQuery.toLowerCase())
            }).slice(0, 8).map((tx) => {
              const cat = CAT[tx.category] || CAT.other
              const isCredit = tx.amount < 0
              return (
                <tr key={tx.id} className="hover:bg-deep active:bg-deep transition border-b border-border last:border-0">
                  <td className="px-5 py-3 text-[13px] text-t2 tabular-nums">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                  <td className="px-5 py-3 text-[14px] text-t1 font-medium max-w-[240px] truncate">{tx.description}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[11px] font-semibold ${cat.bg} ${cat.text}`}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />{cat.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[13px] text-t3">{tx.accounts?.bank_connections?.institution_name || '\u2014'}</td>
                  <td className="px-5 py-3">
                    <span className={`font-mono text-[14px] font-bold tracking-tight terminal-data ${isCredit ? 'text-green' : 'text-t1'}`}>
                      {isCredit ? '+' : '-'}${Math.abs(tx.amount).toLocaleString()}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        {transactions.length === 0 && (
          <div className="text-center py-14">
            <div className="w-12 h-12 rounded-xl bg-cyan-glow flex items-center justify-center mx-auto mb-3"><Activity size={20} className="text-t3" /></div>
            <p className="text-[14px] text-t2 font-medium">No transactions yet</p>
            <p className="text-[13px] text-t3 mt-1">Connect a bank account to see your transaction history</p>
          </div>
        )}
        </div>
      </div>
      </SectionBoundary>

    </div>
  )
}

/* Stat Card — theme-aware, no hardcoded dark opacities */
function StatCard({ icon: Icon, color, label, value, badge, badgeColor, sparkData, isDark }) {
  const colors = {
    cyan: { icon: 'bg-cyan-glow text-cyan', spark: '#22D3EE', borderActive: 'border-cyan' },
    green: { icon: 'bg-green-soft text-green', spark: '#34D399', borderActive: 'border-green' },
    purple: { icon: 'bg-purple-soft text-purple', spark: '#818CF8', borderActive: 'border-purple' },
    amber: { icon: 'bg-amber-soft text-amber', spark: '#FBBF24', borderActive: 'border-amber' },
  }
  const bc = { green: 'bg-green-soft text-green', amber: 'bg-amber-soft text-amber', red: 'bg-red-soft text-red' }
  const c = colors[color] || colors.cyan

  return (
    <div className="glass-card rounded-2xl p-5 hover:border-border-hover active:border-border-hover transition-all duration-300 relative overflow-hidden group terminal-scanlines">
      {/* Sparkline background */}
      {sparkData && sparkData.length > 2 && (
        <div className="absolute bottom-0 right-0 w-[55%] h-[35%] z-0" style={{ opacity: isDark ? 0.1 : 0.06 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <Area type="monotone" dataKey="v" stroke={c.spark} fill={c.spark} strokeWidth={1.5} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className="relative z-[2]">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon} group-hover:scale-105 transition-transform`}><Icon size={16} strokeWidth={2.2} /></div>
          {badge && (
            <span className={`text-[10px] font-bold font-mono px-2 py-[3px] rounded-md ${bc[badgeColor] || 'bg-cyan-glow text-cyan'}`}>{badge}</span>
          )}
        </div>
        <p className="font-mono text-[26px] font-black text-t1 tracking-tight leading-none terminal-data">{value}</p>
        <p className="text-[11px] text-t3 font-mono uppercase tracking-[0.06em] mt-2.5">{label}</p>
      </div>
    </div>
  )
}

function EmptyChart({ label, sub }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-xl bg-cyan-glow flex items-center justify-center mb-3"><TrendingUp size={20} className="text-t3" /></div>
      <p className="text-[14px] text-t2 font-medium">{label}</p>
      <p className="text-[12px] text-t3 mt-1">{sub}</p>
    </div>
  )
}
