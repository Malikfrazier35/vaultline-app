import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Treemap, AreaChart, Area } from 'recharts'
import { ChartTooltip, fmtCurrency } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { useTheme } from '@/hooks/useTheme'
import { Building2, Plus, ChevronRight, ArrowUpRight, ArrowDownRight, Layers, TrendingUp, Shield, AlertTriangle, Activity, Wallet } from 'lucide-react'

const COLORS = ['#22D3EE', '#818CF8', '#34D399', '#FB7185', '#FBBF24', '#A78BFA']
const COLORS_LIGHT = ['#0891B2', '#6366F1', '#059669', '#E11D48', '#D97706', '#7C3AED']

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

/* Treemap cell */
function TreemapCell(props) {
  const { x, y, width, height, name, value, color, totalCash, isDark, index } = props
  if (width < 6 || height < 6) return null
  const pct = totalCash > 0 ? ((value / totalCash) * 100) : 0
  const gap = 3
  const rx = x + gap
  const ry = y + gap
  const rw = width - gap * 2
  const rh = height - gap * 2
  if (rw < 8 || rh < 8) return null
  const showFull = rw > 90 && rh > 60
  const showMin = rw > 50 && rh > 35
  const gradId = `tmGrad-${index}`
  const clipId = `tmClip-${index}`
  return (
    <g>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={isDark ? 0.3 : 0.22} />
          <stop offset="100%" stopColor={color} stopOpacity={isDark ? 0.1 : 0.06} />
        </linearGradient>
        <clipPath id={clipId}>
          <rect x={rx} y={ry} width={rw} height={rh} rx={8} />
        </clipPath>
      </defs>
      <rect x={rx} y={ry} width={rw} height={rh} rx={8} fill={`url(#${gradId})`} stroke={color} strokeWidth={1} strokeOpacity={isDark ? 0.18 : 0.15} />
      <g clipPath={`url(#${clipId})`}>
        <rect x={rx + 1} y={ry + 1} width={rw - 2} height={Math.min(rh * 0.22, 12)} rx={7} fill="white" fillOpacity={isDark ? 0.04 : 0.1} />
        {showFull && <>
          <text x={rx + 12} y={ry + 22} fontSize={12} fontWeight={800} fill={color} fontFamily="Plus Jakarta Sans, sans-serif">{name}</text>
          <text x={rx + 12} y={ry + 40} fontSize={16} fontWeight={900} fill={isDark ? '#F1F5F9' : '#0F172A'} fontFamily="JetBrains Mono, monospace">{fmt(value)}</text>
          {rh > 62 && <text x={rx + 12} y={ry + 55} fontSize={10} fill={isDark ? '#64748B' : '#94A3B8'} fontFamily="JetBrains Mono, monospace">{pct.toFixed(0)}% of total</text>}
        </>}
        {!showFull && showMin && <>
          <text x={rx + 8} y={ry + rh / 2 - 2} fontSize={10} fontWeight={700} fill={color}>{name}</text>
          <text x={rx + 8} y={ry + rh / 2 + 12} fontSize={11} fontWeight={800} fill={isDark ? '#CBD5E1' : '#334155'} fontFamily="JetBrains Mono, monospace">{fmt(value)}</text>
        </>}
      </g>
    </g>
  )
}

/* Mini sparkline SVG */
function Sparkline({ data, color, width = 80, height = 24 }) {
  if (!data || data.length < 2) return <div style={{ width, height }} />
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  return (
    <svg width={width} height={height} className="shrink-0">
      <polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" opacity={0.7} />
    </svg>
  )
}

export default function Entities() {
  const { accounts, transactions, cashPosition, loading } = useTreasury()
  const { org } = useAuth()
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const [view, setView] = useState('consolidated')
  const [expandedEntity, setExpandedEntity] = useState(null)
  const [toast, setToast] = useState(null)

  const colors = isDark ? COLORS : COLORS_LIGHT

  useEffect(() => { document.title = 'Multi-Entity \u2014 Vaultline' }, [])

  const totalCash = cashPosition?.total_balance || 0

  const entities = useMemo(() => {
    if (!accounts?.length) return [{ name: org?.name || 'Primary Entity', accounts: [], totalBalance: 0, isParent: true, color: colors[0] }]
    const map = {}
    accounts.forEach(a => {
      const name = a.bank_connections?.institution_name || 'Manual Accounts'
      if (!map[name]) map[name] = { name, accounts: [], totalBalance: 0 }
      map[name].accounts.push(a)
      map[name].totalBalance += a.current_balance || 0
    })
    const list = Object.values(map)
    if (list.length === 0) list.push({ name: org?.name || 'Primary Entity', accounts: [], totalBalance: 0, isParent: true })
    return list.sort((a, b) => b.totalBalance - a.totalBalance).map((e, i) => ({ ...e, color: colors[i % colors.length] }))
  }, [accounts, org, colors])

  // Per-entity metrics from transactions
  const entityMetrics = useMemo(() => {
    const now = new Date()
    const d30 = new Date(now.getTime() - 30 * 86400000)
    const d7 = new Date(now.getTime() - 7 * 86400000)
    const metrics = {}
    entities.forEach(e => {
      const acctIds = new Set(e.accounts.map(a => a.id))
      const eTx = transactions.filter(t => acctIds.has(t.account_id))
      const recent = eTx.filter(t => new Date(t.date) >= d30)
      const inflows = recent.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
      const outflows = recent.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const net = inflows - outflows
      const lastTx = eTx.length > 0 ? eTx.sort((a, b) => new Date(b.date) - new Date(a.date))[0] : null
      // Sparkline: daily balances (last 14 days simulated from transactions)
      const spark = []
      for (let i = 13; i >= 0; i--) {
        const day = new Date(now.getTime() - i * 86400000)
        const dayTx = eTx.filter(t => new Date(t.date).toDateString() === day.toDateString())
        const vol = dayTx.reduce((s, t) => s + Math.abs(t.amount), 0)
        spark.push(e.totalBalance + (Math.random() - 0.5) * e.totalBalance * 0.02 + vol * 0.001)
      }
      // Cash coverage ratio (months of outflows covered)
      const monthlyBurn = outflows || 1
      const coverage = e.totalBalance / monthlyBurn
      // Health status
      let health = 'healthy'
      if (coverage < 2) health = 'warning'
      if (coverage < 1) health = 'critical'
      if (e.totalBalance <= 0) health = 'critical'
      // Account type breakdown
      const types = {}
      e.accounts.forEach(a => { types[a.type || 'checking'] = (types[a.type || 'checking'] || 0) + 1 })

      metrics[e.name] = { inflows, outflows, net, lastTx, spark, coverage, health, types, txCount: recent.length }
    })
    return metrics
  }, [entities, transactions])

  if (loading) return <SkeletonPage />

  const treemapData = entities.filter(e => e.totalBalance > 0).map((e, i) => ({
    name: e.name.split(' ')[0], value: e.totalBalance, color: e.color, fullName: e.name, index: i,
  }))
  const donutData = entities.filter(e => e.totalBalance > 0).map(e => ({
    name: e.name.split(' ')[0], value: e.totalBalance, color: e.color,
  }))

  const now = new Date()
  const recentTx = transactions.filter(t => new Date(t.date) >= new Date(now.getTime() - 30 * 86400000))
  const totalInflows = recentTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalOutflows = recentTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const netFlow = totalInflows - totalOutflows

  const healthColors = { healthy: { bg: 'bg-green/[0.06]', text: 'text-green', border: 'border-green/[0.1]', label: 'HEALTHY' }, warning: { bg: 'bg-amber/[0.06]', text: 'text-amber', border: 'border-amber/[0.1]', label: 'WARNING' }, critical: { bg: 'bg-red/[0.06]', text: 'text-red', border: 'border-red/[0.1]', label: 'CRITICAL' } }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">MULTI-ENTITY</span>
          <span className="text-[12px] font-mono text-t3">{entities.length} entities / {accounts.length} accounts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-deep border border-border">
            {[{ id: 'consolidated', label: 'Consolidated', icon: Layers }, { id: 'entities', label: 'By Entity', icon: Building2 }].map(v => (
              <button key={v.id} onClick={() => setView(v.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[12px] font-mono font-semibold transition-all ${view === v.id ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2'}`}>
                <v.icon size={12} /> {v.label}
              </button>
            ))}
          </div>
          <button onClick={() => { setToast('Entity creation requires bank connection. Connect a new bank to add entities.'); setTimeout(() => setToast(null), 4000) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold glow-sm hover:-translate-y-px active:scale-[0.98] transition-all">
            <Plus size={14} /> Add Entity
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Consolidated', value: fmt(totalCash), color: 'cyan', icon: Layers },
          { label: 'Entities', value: entities.length.toString(), color: 'purple', icon: Building2 },
          { label: 'Inflows 30d', value: `+${fmt(totalInflows)}`, color: 'green', icon: ArrowUpRight },
          { label: 'Net Flow 30d', value: `${netFlow >= 0 ? '+' : ''}${fmt(netFlow)}`, color: netFlow >= 0 ? 'green' : 'red', icon: netFlow >= 0 ? TrendingUp : ArrowDownRight },
        ].map(k => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', purple: 'bg-purple/[0.08] text-purple', green: 'bg-green/[0.08] text-green', red: 'bg-red/[0.08] text-red' }
          return (
            <div key={k.label} className="glass-card rounded-2xl p-5 hover:border-border-hover active:border-border-hover transition-all terminal-scanlines relative">
              <div className="relative z-[2]">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm[k.color]}`}><k.icon size={15} /></div>
                  <span className="terminal-label">{k.label.toUpperCase().slice(0, 10)}</span>
                </div>
                <p className="font-mono text-[24px] font-black text-t1 tracking-tight terminal-data">{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts: Treemap + Donut */}
      <div className="grid grid-cols-[1.2fr_0.8fr] gap-4">
        {/* Treemap */}
        <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-colors terminal-scanlines relative">
          <div className="relative z-[2]">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between">
              <span className="terminal-label">ALLOCATION MAP</span>
              <span className="text-[11px] font-mono text-t3">{treemapData.length} entities</span>
            </div>
            <div className="h-[260px] px-4 pb-4 overflow-hidden">
              {treemapData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <Treemap data={treemapData} dataKey="value" nameKey="name" stroke="none" content={<TreemapCell totalCash={totalCash} isDark={isDark} />} animationDuration={0} />
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-[13px] text-t3 font-mono">NO DATA</div>}
            </div>
            <div className="terminal-status flex items-center justify-between px-5 py-1.5">
              <div className="flex items-center gap-3 text-t3">
                <span className="terminal-live">LIVE</span>
                <span>TOTAL: <span className="text-cyan terminal-data">{fmt(totalCash)}</span></span>
              </div>
              <span className="text-t3">SIZE = BALANCE</span>
            </div>
          </div>
        </div>

        {/* Donut + ranked list */}
        <div className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-colors terminal-scanlines relative">
          <div className="relative z-[2]">
            <div className="px-5 pt-5 pb-2 flex items-center justify-between">
              <span className="terminal-label">SHARE</span>
              <span className="text-[11px] font-mono text-t3">{donutData.length} entities</span>
            </div>
            <div className="h-[170px] relative">
              {donutData.length > 0 ? (<>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donutData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={48} outerRadius={72} paddingAngle={3} strokeWidth={0}>
                      {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="font-mono text-[16px] font-black text-t1 terminal-data">{fmt(totalCash)}</p>
                  <p className="text-[9px] text-t3 font-mono uppercase">TOTAL</p>
                </div>
              </>) : <div className="h-full flex items-center justify-center text-[12px] text-t3 font-mono">NO DATA</div>}
            </div>
            <div className="px-5 pb-3 space-y-1.5">
              {entities.filter(e => e.totalBalance > 0).map((e, i) => {
                const pct = totalCash > 0 ? (e.totalBalance / totalCash * 100) : 0
                return (
                  <div key={e.name} className="flex items-center gap-2">
                    <span className="text-[10px] font-mono font-bold text-t3 w-3">{i + 1}</span>
                    <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: e.color }} />
                    <span className="text-[12px] text-t2 flex-1 truncate">{e.name}</span>
                    <span className="text-[11px] font-mono font-bold text-t1 terminal-data">{fmt(e.totalBalance)}</span>
                    <span className="text-[10px] font-mono text-t3 w-8 text-right">{pct.toFixed(0)}%</span>
                  </div>
                )
              })}
            </div>
            <div className="terminal-status flex items-center justify-between px-5 py-1.5">
              <span className="text-t3">ENTITIES: <span className="text-t2">{entities.length}</span></span>
              <span className="text-t3">RANKED DESC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Entity detail cards — PREMIUM with health, sparkline, metrics */}
      <div className="flex items-center gap-2 mt-2">
        <span className="terminal-label">ENTITY HEALTH</span>
        <span className="text-[11px] font-mono text-t3">{entities.length} entities</span>
      </div>
      <div className="space-y-3">
        {entities.map((entity) => {
          const pct = totalCash > 0 ? (entity.totalBalance / totalCash * 100) : 0
          const isExpanded = expandedEntity === entity.name
          const m = entityMetrics[entity.name] || {}
          const hc = healthColors[m.health || 'healthy']
          return (
            <div key={entity.name} className="glass-card rounded-2xl overflow-hidden hover:border-border-hover active:border-border-hover transition-all">
              <button className="w-full flex items-center justify-between p-5 text-left" onClick={() => setExpandedEntity(isExpanded ? null : entity.name)}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[13px] font-extrabold text-white shrink-0 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
                    style={{ background: entity.color }}>
                    {entity.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-[15px] font-bold text-t1">{entity.name}</h4>
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border ${hc.bg} ${hc.text} ${hc.border}`}>{hc.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[12px] text-t3 font-mono">{entity.accounts.length} acct{entity.accounts.length !== 1 ? 's' : ''}</span>
                      <span className="text-[12px] text-t3 font-mono">{pct.toFixed(1)}% share</span>
                      {m.coverage && <span className="text-[12px] text-t3 font-mono">{m.coverage.toFixed(1)}x coverage</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  {/* Sparkline */}
                  <Sparkline data={m.spark || []} color={entity.color} />
                  {/* 30d flow summary */}
                  <div className="text-right hidden lg:block">
                    <div className="flex items-center gap-3 text-[11px] font-mono">
                      <span className="text-green">+{fmt(m.inflows || 0)}</span>
                      <span className="text-red">-{fmt(m.outflows || 0)}</span>
                    </div>
                    <p className="text-[10px] text-t3 font-mono mt-0.5">{m.txCount || 0} txns / 30d</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-[20px] font-black text-t1 tracking-tight terminal-data">{fmt(entity.totalBalance)}</p>
                    <div className="w-28 h-[4px] bg-deep rounded-full overflow-hidden mt-1.5">
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: entity.color }} />
                    </div>
                  </div>
                  <ChevronRight size={16} className={`text-t3 transition-transform ${isExpanded ? 'rotate-90 text-cyan' : ''}`} />
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 pt-0">
                  <div className="border-t border-border pt-4">
                    {/* Entity metrics strip */}
                    <div className="grid grid-cols-5 gap-3 mb-4">
                      {[
                        { l: 'BALANCE', v: fmt(entity.totalBalance), c: 'text-cyan' },
                        { l: 'INFLOWS', v: '+' + fmt(m.inflows || 0), c: 'text-green' },
                        { l: 'OUTFLOWS', v: '-' + fmt(m.outflows || 0), c: 'text-red' },
                        { l: 'NET FLOW', v: (m.net >= 0 ? '+' : '') + fmt(m.net || 0), c: m.net >= 0 ? 'text-green' : 'text-red' },
                        { l: 'COVERAGE', v: (m.coverage || 0).toFixed(1) + 'x', c: (m.coverage || 0) >= 3 ? 'text-green' : (m.coverage || 0) >= 1.5 ? 'text-amber' : 'text-red' },
                      ].map(s => (
                        <div key={s.l} className="terminal-inset p-3 text-center">
                          <p className="text-[9px] font-mono text-t3 uppercase tracking-wider">{s.l}</p>
                          <p className={`font-mono text-[15px] font-black mt-1 terminal-data ${s.c}`}>{s.v}</p>
                        </div>
                      ))}
                    </div>
                    {/* Sub-accounts grid */}
                    {entity.accounts.length > 0 && (
                      <div className="grid grid-cols-3 gap-3">
                        {entity.accounts.map(a => {
                          const acctPct = entity.totalBalance > 0 ? (a.current_balance / entity.totalBalance * 100) : 0
                          return (
                            <div key={a.id} className="terminal-inset p-4">
                              <div className="flex items-center justify-between mb-2">
                                <p className="text-[13px] font-semibold text-t2 truncate">{a.name}</p>
                                <span className="text-[10px] font-mono text-t3 uppercase bg-deep px-1.5 py-0.5 rounded">{a.type || 'checking'}</span>
                              </div>
                              <p className="font-mono text-[17px] font-black text-t1 terminal-data">${a.current_balance?.toLocaleString()}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <div className="flex-1 h-[3px] bg-deep rounded-full overflow-hidden">
                                  <div className="h-full rounded-full" style={{ width: `${acctPct}%`, background: entity.color }} />
                                </div>
                                <span className="text-[11px] font-mono text-t3">{acctPct.toFixed(0)}%</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    {/* Last activity */}
                    {m.lastTx && (
                      <div className="mt-3 flex items-center gap-2 text-[11px] font-mono text-t3">
                        <Activity size={10} />
                        <span>Last transaction: {new Date(m.lastTx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} / {m.lastTx.description?.slice(0, 40)}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15] animate-[slideUp_0.3s_ease-out] max-w-sm">
          <p className="text-[13px] text-t2">{toast}</p>
        </div>
      )}
    </div>
  )
}
