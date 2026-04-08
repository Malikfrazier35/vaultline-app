import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, ComposedChart, Legend } from 'recharts'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { useTheme } from '@/hooks/useTheme'
import { Layers, Plus, Trash2, Play, TrendingDown, TrendingUp, AlertTriangle, Save } from 'lucide-react'

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

const DEFAULT_SCENARIOS = [
  { id: 'base', name: 'Base Case', color: '#22D3EE', revenueGrowth: 0, burnChange: 0, oneTimeInflow: 0, oneTimeOutflow: 0, description: 'Current trajectory with no changes' },
  { id: 'optimistic', name: 'Optimistic', color: '#34D399', revenueGrowth: 15, burnChange: -5, oneTimeInflow: 0, oneTimeOutflow: 0, description: 'Revenue growth with cost optimization' },
  { id: 'pessimistic', name: 'Pessimistic', color: '#FB7185', revenueGrowth: -10, burnChange: 10, oneTimeInflow: 0, oneTimeOutflow: 0, description: 'Revenue decline with rising costs' },
]

export default function Scenarios() {
  const { accounts, transactions, cashPosition, forecast, loading } = useTreasury()
  const { org } = useAuth()
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const [toast, setToast] = useState(null)
  const [scenarios, setScenarios] = useState(() => {
    try {
      const saved = localStorage.getItem(`vaultline-scenarios-${org?.id}`)
      return saved ? JSON.parse(saved) : DEFAULT_SCENARIOS
    } catch { return DEFAULT_SCENARIOS }
  })
  const [months, setMonths] = useState(12)
  const [showBands, setShowBands] = useState(true)

  // Persist scenarios to localStorage on every change
  useEffect(() => {
    if (org?.id) localStorage.setItem(`vaultline-scenarios-${org.id}`, JSON.stringify(scenarios))
  }, [scenarios, org?.id])

  useEffect(() => { document.title = 'Scenario Modeling — Vaultline' }, [])

  const totalCash = cashPosition?.total_balance || 0
  const monthlyBurn = forecast?.monthly_burn || 0
  const now = new Date()
  const recentTx = (transactions || []).filter(t => new Date(t.date) >= new Date(now.getTime() - 30 * 86400000))
  const monthlyRevenue = recentTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)

  const chartData = useMemo(() => {
    if (loading) return []
    const data = []
    for (let m = 0; m <= months; m++) {
      const date = new Date(now.getFullYear(), now.getMonth() + m, 1)
      const label = date.toLocaleDateString('en-US', { month: 'short', year: m > 11 ? '2-digit' : undefined })
      const point = { month: label, monthIndex: m }

      scenarios.forEach(s => {
        const rev = monthlyRevenue * (1 + s.revenueGrowth / 100)
        const burn = monthlyBurn * (1 + s.burnChange / 100)
        const netMonthly = rev - burn
        const oneTime = (m === 1 ? s.oneTimeInflow : 0) - (m === 1 ? s.oneTimeOutflow : 0)
        const base = Math.max(0, totalCash + (netMonthly * m) + oneTime)
        const variance = m * 0.03 // 3% variance per month compounds
        point[s.id] = base
        point[`${s.id}_upper`] = Math.round(base * (1 + variance))
        point[`${s.id}_lower`] = Math.max(0, Math.round(base * (1 - variance)))
      })
      data.push(point)
    }
    return data
  }, [scenarios, months, totalCash, monthlyBurn, monthlyRevenue, loading])

  const scenarioMetrics = useMemo(() => {
    return scenarios.map(s => {
      const rev = monthlyRevenue * (1 + s.revenueGrowth / 100)
      const burn = monthlyBurn * (1 + s.burnChange / 100)
      const netMonthly = rev - burn
      const runway = burn > rev ? totalCash / (burn - rev) : Infinity
      const endBalance = Math.max(0, totalCash + (netMonthly * months) + s.oneTimeInflow - s.oneTimeOutflow)
      return { ...s, runway: runway === Infinity ? '∞' : runway.toFixed(1), endBalance, netMonthly, monthlyRevenue: rev, monthlyBurn: burn }
    })
  }, [scenarios, totalCash, monthlyBurn, monthlyRevenue, months])

  if (loading) return <SkeletonPage />

  function updateScenario(id, field, value) {
    setScenarios(scenarios.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  function addScenario() {
    setToast('Scenario added'); setTimeout(() => setToast(null), 2000)
    const colors = ['#A78BFA', '#FBBF24', '#F472B6', '#38BDF8', '#4ADE80']
    const id = `custom_${Date.now()}`
    setScenarios([...scenarios, { id, name: `Scenario ${scenarios.length + 1}`, color: colors[scenarios.length % colors.length], revenueGrowth: 0, burnChange: 0, oneTimeInflow: 0, oneTimeOutflow: 0, description: '' }])
  }

  function removeScenario(id) {
    setToast('Scenario removed'); setTimeout(() => setToast(null), 2000)
    if (scenarios.length <= 1) return
    setScenarios(scenarios.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="terminal-label">SCENARIO MODELING</span>
          <p className="text-[13px] text-t2 mt-0.5">Compare cash projections under different business assumptions</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={months} onChange={e => setMonths(parseInt(e.target.value))}
            className="glass-input rounded-xl px-3 py-2 text-[13px] text-t2 outline-none cursor-pointer">
            <option value={6}>6 months</option>
            <option value={12}>12 months</option>
            <option value={18}>18 months</option>
            <option value={24}>24 months</option>
          </select>
          <button onClick={() => setShowBands(!showBands)}
            className={`px-3 py-2 rounded-xl text-[12px] font-mono font-bold transition-all ${showBands ? 'bg-purple/[0.08] text-purple border border-purple/[0.12]' : 'text-t3 border border-border hover:text-t2'}`}>
            ±BANDS
          </button>
          <button onClick={addScenario}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold glow-sm hover:-translate-y-px active:scale-[0.98] transition-all">
            <Plus size={14} /> Add Scenario
          </button>
        </div>
      </div>

      {/* Comparison chart */}
      <div className="glass-card rounded-2xl p-6 terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="terminal-label">PROJECTED POSITION</span>
            <p className="text-[13px] text-t2 mt-1">{months}-month projection starting from {fmt(totalCash)}</p>
          </div>
          <div className="flex items-center gap-4">
            {scenarios.map(s => (
              <span key={s.id} className="flex items-center gap-1.5 text-[12px] text-t3">
                <span className="w-4 h-[3px] rounded-full" style={{ background: s.color }} />{s.name}
              </span>
            ))}
          </div>
        </div>
        <div className="h-[360px] chart-scanlines">
          {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <defs>
                {scenarios.map(s => (
                  <linearGradient key={`band-${s.id}`} id={`scenBand-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={s.color} stopOpacity={isDark ? 0.12 : 0.1} />
                    <stop offset="100%" stopColor={s.color} stopOpacity={0.01} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="1 6" stroke={ct.grid} vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: ct.tick }} tickLine={false} axisLine={false} width={60}
                tickFormatter={v => v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${(v / 1e3).toFixed(0)}K`} />
              <Tooltip content={<ChartTooltip isDark={isDark} />} />
              {showBands && scenarios.map(s => (
                <Area key={`upper-${s.id}`} type="monotone" dataKey={`${s.id}_upper`} stroke="none" fill={`url(#scenBand-${s.id})`} legendType="none" tooltipType="none" />
              ))}
              {showBands && scenarios.map(s => (
                <Area key={`lower-${s.id}`} type="monotone" dataKey={`${s.id}_lower`} stroke={s.color} strokeWidth={1} strokeDasharray="4 3" fill="none" strokeOpacity={0.3} legendType="none" tooltipType="none" />
              ))}
              {scenarios.map(s => (
                <Line key={s.id} type="monotone" dataKey={s.id} name={s.name} stroke={s.color} strokeWidth={2.5} dot={false} />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-t3 text-[13px]">No data to chart yet</div>
          )}
        </div>
      </div>

      {/* Scenario comparison cards */}
      <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${Math.min(scenarios.length, 3)}, 1fr)` }}>
        {scenarioMetrics.map(s => (
          <div key={s.id} className="glass-card rounded-2xl p-5 terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors" style={{ borderColor: `${s.color}20` }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-3 h-3 rounded-sm" style={{ background: s.color }} />
                <h4 className="text-[15px] font-bold">{s.name}</h4>
              </div>
              {scenarios.length > 1 && (
                <button onClick={() => removeScenario(s.id)} className="p-1 rounded-lg hover:bg-red/[0.08] text-t3 hover:text-red transition"><Trash2 size={13} /></button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="bg-deep rounded-xl p-3">
                <p className="text-[11px] text-t3 uppercase tracking-wider font-semibold">End Balance</p>
                <p className="font-mono text-[18px] terminal-data font-black mt-1" style={{ color: s.color }}>{fmt(s.endBalance)}</p>
              </div>
              <div className="bg-deep rounded-xl p-3">
                <p className="text-[11px] text-t3 uppercase tracking-wider font-semibold">Runway</p>
                <p className={`font-mono text-[18px] terminal-data font-black mt-1 ${s.runway === '∞' ? 'text-green' : parseFloat(s.runway) > 12 ? 'text-green' : parseFloat(s.runway) > 6 ? 'text-amber' : 'text-red'}`}>
                  {s.runway === '∞' ? '∞' : `${s.runway}mo`}
                </p>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-3">
              <SliderField label="Revenue Growth" value={s.revenueGrowth} onChange={v => updateScenario(s.id, 'revenueGrowth', v)} min={-50} max={50} suffix="%" color={s.color} />
              <SliderField label="Burn Change" value={s.burnChange} onChange={v => updateScenario(s.id, 'burnChange', v)} min={-50} max={50} suffix="%" color={s.color} />
              <SliderField label="One-Time Inflow" value={s.oneTimeInflow} onChange={v => updateScenario(s.id, 'oneTimeInflow', v)} min={0} max={5000000} step={50000} suffix="" format={fmt} color={s.color} />
              <SliderField label="One-Time Outflow" value={s.oneTimeOutflow} onChange={v => updateScenario(s.id, 'oneTimeOutflow', v)} min={0} max={5000000} step={50000} suffix="" format={fmt} color={s.color} />
            </div>
          </div>
        ))}
      </div>

      {/* Assumptions footer */}
      <div className="glass-card rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-t2">Modeling Assumptions</p>
            <p className="text-[13px] text-t2 mt-1 leading-relaxed">
              Projections based on current cash position of <span className="text-t2 font-medium">{fmt(totalCash)}</span>,
              monthly revenue of <span className="text-t2 font-medium">{fmt(monthlyRevenue)}</span>,
              and monthly burn of <span className="text-t2 font-medium">{fmt(monthlyBurn)}</span>.
              One-time flows apply in month 1. Revenue and burn changes are applied uniformly. Past performance does not guarantee future results.
            </p>
          </div>
        </div>
      </div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15]">
          <p className="text-[13px] text-cyan font-mono">{toast}</p>
        </div>
      )}
    </div>
  )
}

function SliderField({ label, value, onChange, min, max, step = 1, suffix, format, color }) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-t3 font-medium">{label}</span>
        <span className="font-mono text-[13px] font-bold text-t2">{format ? format(value) : `${value > 0 ? '+' : ''}${value}${suffix}`}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{ background: `linear-gradient(to right, ${color} ${pct}%, rgba(148,163,184,0.2) ${pct}%)` }} />
    </div>
  )
}
