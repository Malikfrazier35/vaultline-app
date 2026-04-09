import { useTreasury } from '@/hooks/useTreasury'
import { SkeletonPage } from '@/components/Skeleton'
import BankLogo from '@/components/BankLogo'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { isPeriodAllowed, periodRequiredPlan } from '@/lib/planEngine'
import { useVisibilityRefetch } from '@/hooks/useVisibilityRefetch'
import { AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { useChartTheme } from '@/hooks/useChartTheme'
import { ChartTooltip, fmtCurrency } from '@/components/ChartTooltip'
import { useTheme } from '@/hooks/useTheme'
import { ArrowUpRight, ArrowDownRight, TrendingUp, Eye, EyeOff, Layers } from 'lucide-react'

const COLORS = ['#22D3EE', '#818CF8', '#34D399', '#FB7185', '#FBBF24', '#A78BFA']
const COLORS_LIGHT = ['#0891B2', '#6366F1', '#059669', '#E11D48', '#D97706', '#7C3AED']

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

export default function CashPosition() {
  const { accounts, transactions, cashPosition, loading } = useTreasury()
  const { org } = useAuth()
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const [dailyBalances, setDailyBalances] = useState([])
  const [period, setPeriod] = useState('MTD') // Default to MTD
  const [hiddenAccounts, setHiddenAccounts] = useState(new Set())
  const [chartMode, setChartMode] = useState('position') // position (stacked) | trend (overlay)
  const [acctFilter, setAcctFilter] = useState('all') // all | checking | savings | credit
  const [showSMA, setShowSMA] = useState(false)
  const [showEMA, setShowEMA] = useState(false)

  const colors = isDark ? COLORS : COLORS_LIGHT

  useEffect(() => { document.title = 'Cash Position — Vaultline' }, [])

  const fetchBalances = useCallback(() => {
    if (!org?.id) return
    supabase.from('daily_balances')
      .select('date, balance, account_id, accounts(name, type, bank_connections(institution_name, institution_color))')
      .eq('org_id', org.id).order('date', { ascending: true })
      .then(({ data }) => { if (data) setDailyBalances(data) })
  }, [org?.id])
  useEffect(() => { fetchBalances() }, [fetchBalances])
  useVisibilityRefetch(fetchBalances, { pollMs: 60000, enabled: !!org?.id })

  const totalBalance = cashPosition?.total_balance || 0

  const positionData = useMemo(() => {
    if (!dailyBalances.length) return []
    // Accounting period calculations
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let cutoff
    if (period === '7D') { cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 7) }
    else if (period === '30D') { cutoff = new Date(today); cutoff.setDate(cutoff.getDate() - 30) }
    else if (period === 'MTD') cutoff = new Date(today.getFullYear(), today.getMonth(), 1)
    else if (period === 'QTD') { const q = Math.floor(today.getMonth() / 3) * 3; cutoff = new Date(today.getFullYear(), q, 1) }
    else cutoff = new Date(today.getFullYear(), 0, 1) // YTD
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth()+1).padStart(2,'0')}-${String(cutoff.getDate()).padStart(2,'0')}`

    const byDate = {}
    dailyBalances.forEach((b) => {
      if (b.date < cutoffStr) return
      // Account type filter
      const type = b.accounts?.type || 'checking'
      if (acctFilter !== 'all' && type !== acctFilter) return
      if (!byDate[b.date]) byDate[b.date] = { date: b.date, _total: 0 }
      const name = b.accounts?.bank_connections?.institution_name?.split(' ')[0] || b.accounts?.name || 'Unknown'
      byDate[b.date][name] = (byDate[b.date][name] || 0) + (b.balance || 0)
      byDate[b.date]._total += (b.balance || 0)
    })
    const sorted = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
    // SMA-7 on total
    sorted.forEach((d, i) => {
      d.sma7 = i < 6 ? null : Math.round(sorted.slice(i - 6, i + 1).reduce((s, x) => s + (x._total || 0), 0) / 7)
    })
    // EMA-14 on total
    const emaK = 2 / 15; let emaP = null
    sorted.forEach(d => {
      if (d._total == null) { d.ema14 = emaP; return }
      if (emaP === null) { emaP = d._total; d.ema14 = emaP; return }
      emaP = d._total * emaK + emaP * (1 - emaK); d.ema14 = Math.round(emaP)
    })
    return sorted
  }, [dailyBalances, period, acctFilter])

  const accountNames = useMemo(() => {
    const names = new Set()
    positionData.forEach(d => { Object.keys(d).forEach(k => { if (k !== 'date' && k !== '_total') names.add(k) }) })
    return [...names]
  }, [positionData])

  const pieData = accounts.filter(a => a.current_balance > 0).map((a, i) => ({
    name: a.bank_connections?.institution_name?.split(' ')[0] || a.name,
    value: a.current_balance, color: colors[i % colors.length],
    full: a.bank_connections?.institution_name || a.name, type: a.type,
  }))

  const toggleAccount = (name) => {
    setHiddenAccounts(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n })
  }

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const monthlyTx = transactions.filter(t => new Date(t.date) >= startOfMonth)
  const monthInflows = monthlyTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const monthOutflows = monthlyTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const netChange = monthInflows - monthOutflows
  const openBal = totalBalance - netChange

  const high = positionData.length > 0 ? Math.max(...positionData.map(d => d._total || 0)) : 0
  const low = positionData.length > 0 ? Math.min(...positionData.map(d => d._total || 0)) : 0
  const avg = positionData.length > 0 ? positionData.reduce((s, d) => s + (d._total || 0), 0) / positionData.length : 0

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      {/* Waterfall KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Opening', value: fmt(openBal), color: 'text-t1', sub: startOfMonth.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) },
          { label: 'Inflows', value: `+${fmt(monthInflows)}`, color: 'text-green', sub: 'MTD', icon: ArrowUpRight },
          { label: 'Outflows', value: `-${fmt(monthOutflows)}`, color: 'text-red', sub: 'MTD', icon: ArrowDownRight },
          { label: 'Net', value: `${netChange >= 0 ? '+' : ''}${fmt(netChange)}`, color: netChange >= 0 ? 'text-green' : 'text-red', sub: openBal > 0 ? `${netChange >= 0 ? '+' : ''}${((netChange / openBal) * 100).toFixed(1)}%` : '—' },
          { label: 'Position', value: fmt(totalBalance), color: 'text-cyan', sub: 'Now', highlight: true },
        ].map((item) => (
          <div key={item.label} className={`glass-card rounded-2xl p-4 text-center terminal-scanlines relative ${item.highlight ? 'border-cyan/[0.15]' : ''}`}>
            <div className="relative z-[2]">
              <p className="text-[10px] text-t3 uppercase tracking-[0.1em] font-mono font-semibold">{item.label}</p>
              <div className="flex items-center justify-center gap-1 mt-2">
                {item.icon && <item.icon size={14} className={item.color} />}
                <p className={`font-mono text-[20px] font-black ${item.color} tracking-tight terminal-data`}>{item.value}</p>
              </div>
              <p className={`text-[11px] mt-1 font-mono ${item.color === 'text-t1' ? 'text-t3' : item.color} opacity-60`}>{item.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Main chart + allocation */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Stacked area chart */}
        <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-colors terminal-scanlines relative">
          <div className="relative z-[2]">
            {/* Chart header */}
            <div className="flex items-center justify-between px-6 pt-5 pb-3">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="terminal-label">CASH POSITION</span>
                  <span className="text-[11px] font-mono text-t3">{positionData.length * accountNames.length} pts</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border" style={{
                    color: isDark ? '#22D3EE' : '#0891B2',
                    background: isDark ? 'rgba(34,211,238,0.06)' : 'rgba(8,145,178,0.04)',
                    borderColor: isDark ? 'rgba(34,211,238,0.1)' : 'rgba(8,145,178,0.08)',
                  }}>{period}</span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-[11px] font-mono text-t3">H <span className="text-green font-semibold terminal-data">{fmt(high)}</span></span>
                  <span className="text-[11px] font-mono text-t3">L <span className="text-red font-semibold terminal-data">{fmt(low)}</span></span>
                  <span className="text-[11px] font-mono text-t3">Avg <span className="text-t2 font-semibold terminal-data">{fmt(avg)}</span></span>
                  <span className="text-[11px] font-mono text-t3">Δ <span className={`font-semibold terminal-data ${high - low > 0 ? 'text-amber' : 'text-t2'}`}>{fmt(high - low)}</span></span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {/* Account type filter */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
                  {[{ id: 'all', label: 'All' }, { id: 'checking', label: 'Operating' }, { id: 'savings', label: 'Savings' }, { id: 'credit', label: 'Credit' }].map(f => (
                    <button key={f.id} onClick={() => setAcctFilter(f.id)}
                      className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                        acctFilter === f.id ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2'
                      }`}>{f.label}</button>
                  ))}
                </div>
                {/* View mode */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
                  {[{ id: 'position', label: 'Position' }, { id: 'trend', label: 'Trend' }].map(m => (
                    <button key={m.id} onClick={() => setChartMode(m.id)}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                        chartMode === m.id ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2'
                      }`}>{m.label}</button>
                  ))}
                </div>
                {/* Period selector — accounting periods */}
                <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
                  {['7D', '30D', 'MTD', 'QTD', 'YTD'].map(r => {
                    const allowed = isPeriodAllowed(org?.plan || 'starter', r)
                    return (
                      <button key={r} onClick={() => allowed ? setPeriod(r) : null} title={!allowed ? `Upgrade to ${periodRequiredPlan(r)} for ${r} view` : ''}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                          period === r ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : allowed ? 'text-t3 hover:text-t2' : 'text-t4/30 cursor-not-allowed line-through decoration-t4/20'
                        }`}>{r}</button>
                    )
                  })}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setShowSMA(!showSMA)} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${showSMA ? 'bg-green/[0.08] text-green border border-green/[0.12]' : 'text-t3 border border-transparent hover:text-t2'}`}>SMA7</button>
                  <button onClick={() => setShowEMA(!showEMA)} className={`px-2 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${showEMA ? 'bg-amber/[0.08] text-amber border border-amber/[0.12]' : 'text-t3 border border-transparent hover:text-t2'}`}>EMA14</button>
                </div>
              </div>
            </div>

            {/* Interactive legend */}
            <div className="flex items-center gap-2 px-6 pb-3 flex-wrap">
              {accountNames.map((name, i) => {
                const hidden = hiddenAccounts.has(name)
                return (
                  <button key={name} onClick={() => toggleAccount(name)}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono font-medium transition-all border ${
                      hidden ? 'opacity-30 border-transparent' : 'border-border'
                    }`} style={{ background: hidden ? 'transparent' : (isDark ? `${colors[i % colors.length]}08` : `${colors[i % colors.length]}06`) }}>
                    <span className="w-2 h-2 rounded-sm" style={{ background: hidden ? '#475569' : colors[i % colors.length] }} />
                    <span style={{ color: hidden ? '#475569' : colors[i % colors.length] }}>{name}</span>
                    {hidden ? <EyeOff size={9} className="ml-0.5" /> : null}
                  </button>
                )
              })}
            </div>

            {/* Chart */}
            <div className="h-[360px] px-3 pb-2">
              {positionData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={positionData}>
                    <defs>
                      {accountNames.map((name, i) => (
                        <linearGradient key={name} id={`cpGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={colors[i % colors.length]} stopOpacity={isDark ? 0.2 : 0.22} />
                          <stop offset="100%" stopColor={colors[i % colors.length]} stopOpacity={0.01} />
                        </linearGradient>
                      ))}
                    </defs>
                    <CartesianGrid strokeDasharray="1 6" stroke={ct.grid} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false}
                      interval={Math.max(0, Math.floor(positionData.length / 6))}
                      tickFormatter={(v) => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} />
                    <YAxis tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono, monospace' }} tickLine={false} axisLine={false} width={60}
                      tickFormatter={(v) => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={(v) => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' })} />}
                      cursor={{ stroke: isDark ? 'rgba(34,211,238,0.15)' : 'rgba(8,145,178,0.1)', strokeWidth: 1 }} />
                    {/* Average reference line */}
                    <ReferenceLine y={avg} stroke={isDark ? '#506680' : '#94A3B8'} strokeDasharray="6 4" strokeWidth={1}
                      label={{ value: `AVG ${fmt(avg)}`, position: 'right', fontSize: 9, fill: ct.tick, fontFamily: 'JetBrains Mono, monospace' }} />
                    {accountNames.filter(n => !hiddenAccounts.has(n)).map((name, i) => (
                      <Area key={name} type="monotone" dataKey={name} name={name}
                        stackId={chartMode === 'position' ? '1' : undefined}
                        stroke={colors[i % colors.length]} fill={`url(#cpGrad-${i})`}
                        strokeWidth={chartMode === 'trend' ? 2.5 : 1.5}
                        dot={chartMode === 'trend' ? { r: 2, fill: colors[i % colors.length], stroke: 'none' } : false}
                        activeDot={{ r: 5, strokeWidth: 2, stroke: isDark ? '#0C1323' : '#fff' }} />
                    ))}
                    {showSMA && <Line dataKey="sma7" name="SMA-7" type="monotone" stroke={isDark ? '#34D399' : '#059669'} strokeWidth={2} strokeDasharray="4 3" dot={false} connectNulls />}
                    {showEMA && <Line dataKey="ema14" name="EMA-14" type="monotone" stroke={isDark ? '#FBBF24' : '#D97706'} strokeWidth={2} strokeDasharray="6 3" dot={false} />}
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex flex-col items-center justify-center">
                  <div className="w-14 h-14 rounded-2xl bg-cyan/[0.06] flex items-center justify-center mb-4"><TrendingUp size={24} className="text-t3" /></div>
                  <p className="text-[14px] text-t2 font-medium">Balance history builds after sync</p>
                </div>
              )}
            </div>

            {/* Status strip */}
            <div className="terminal-status flex items-center justify-between px-6 py-1.5">
              <div className="flex items-center gap-4 text-t3">
                <span className="terminal-live">LIVE</span>
                <span>ACCTS: <span className="text-t2">{accounts.length}</span></span>
                <span>MODE: <span className="text-cyan">{chartMode === 'position' ? 'POSITION' : 'TREND'}</span></span>
              </div>
              <div className="flex items-center gap-4 text-t3">
                <span>FILTER: <span className="text-cyan">{acctFilter === 'all' ? 'ALL' : acctFilter.toUpperCase()}</span></span>
                <span>VISIBLE: <span className="text-cyan">{accountNames.filter(n => !hiddenAccounts.has(n)).length}/{accountNames.length}</span></span>
                <span>PERIOD: <span className="text-cyan">{period}</span></span>
              </div>
            </div>
          </div>
        </div>

        {/* Right panel — donut + account breakdown */}
        <div className="flex flex-col gap-4">
          {/* Allocation donut */}
          <div className="glass-card rounded-2xl p-5 hover:border-border-hover active:border-border-hover transition-colors terminal-scanlines relative">
            <div className="relative z-[2]">
              <span className="terminal-label">ALLOCATION</span>
              <div className="h-[190px] mt-3 relative">
                {pieData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={78} paddingAngle={2} strokeWidth={0}>
                          {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip content={<ChartTooltip isDark={isDark} />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <p className="font-mono text-[18px] font-black text-t1 terminal-data">{fmt(totalBalance)}</p>
                      <p className="text-[9px] text-t3 font-mono uppercase tracking-wider">TOTAL</p>
                    </div>
                  </>
                ) : <div className="h-full flex flex-col items-center justify-center text-center px-4"><p className="text-[12px] font-semibold text-t2 mb-1">No balance history yet</p><p className="text-[10px] text-t4">Data appears after your first bank sync</p></div>}
              </div>
              {/* Legend with % bars */}
              <div className="space-y-2 mt-3">
                {pieData.map(d => {
                  const pct = totalBalance > 0 ? (d.value / totalBalance * 100) : 0
                  return (
                    <div key={d.name}>
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
                          <span className="text-[11px] text-t2 truncate">{d.full}</span>
                        </div>
                        <span className="text-[11px] font-mono text-t1 font-semibold terminal-data">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-[3px] bg-deep rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: d.color }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Quick stats */}
          <div className="glass-card rounded-2xl p-4 terminal-scanlines relative">
            <div className="relative z-[2] space-y-2.5">
              {[
                { label: 'Period High', value: fmt(high), color: 'text-green' },
                { label: 'Period Low', value: fmt(low), color: 'text-red' },
                { label: 'Volatility', value: fmt(high - low), color: 'text-amber' },
                { label: 'Avg Balance', value: fmt(avg), color: 'text-cyan' },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-t3 uppercase tracking-wider">{s.label}</span>
                  <span className={`text-[13px] font-mono font-bold terminal-data ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Account detail rows */}
      <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-colors">
        <div className="px-6 py-3.5 border-b border-border flex items-center justify-between">
          <span className="terminal-label">ACCOUNT BREAKDOWN</span>
          <span className="text-[11px] font-mono text-t3">{accounts.length} accounts</span>
        </div>
        <div className="divide-y divide-border">
          {accounts.map((acct, i) => {
            const pct = totalBalance > 0 ? (acct.current_balance / totalBalance * 100) : 0
            return (
              <div key={acct.id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-deep active:bg-deep transition group">
                <BankLogo
                  name={acct.bank_connections?.institution_name || acct.name}
                  color={acct.bank_connections?.institution_color || colors[i % colors.length]}
                  size={40}
                  className="shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[14px] font-semibold text-t1 truncate">{acct.bank_connections?.institution_name || acct.name}</p>
                    <p className="font-mono text-[16px] font-black text-t1 tracking-tight terminal-data">${acct.current_balance?.toLocaleString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-t3 capitalize font-mono">{acct.type}</span>
                    <div className="flex-1 h-[4px] bg-deep rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
                    </div>
                    <span className="text-[12px] text-t2 font-mono font-semibold terminal-data w-10 text-right">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              </div>
            )
          })}
          {accounts.length === 0 && (
            <div className="empty-state py-12">
              <div className="icon"><svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path d="M3 21h18M3 7V5a2 2 0 012-2h14a2 2 0 012 2v2M3 7h18M3 7v11a2 2 0 002 2h14a2 2 0 002-2V7" stroke="currentColor" strokeWidth="1.5"/></svg></div>
              <p className="title">No accounts connected</p>
              <p className="desc">Connect a bank via Plaid to see your real-time cash position across all accounts.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
