import { useSEO } from '@/hooks/useSEO'
import { useState, useEffect, useMemo } from 'react'

import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, ComposedChart } from 'recharts'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { TrendingUp, ArrowRight, Check, BarChart3, Target, Layers, Brain, FileBarChart, Shield, Zap, ArrowUpRight, Star, Users, DollarSign } from 'lucide-react'

/* ═══ DEMO DATA — Kit 5 analytics-style dynamic panels ═══ */
function genBudgetData() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return months.map((m, i) => ({
    month: m,
    budget: 120000 + Math.round(Math.random() * 30000),
    actual: 100000 + Math.round(Math.random() * 50000),
    forecast: i > 7 ? 115000 + Math.round(Math.random() * 25000) : null,
  }))
}

function genVarianceData() {
  return ['Payroll','SaaS','Marketing','Ops','Travel','R&D'].map(cat => ({
    name: cat,
    variance: Math.round((Math.random() - 0.4) * 20000),
  }))
}

function genEntityData() {
  return [
    { name: 'HQ US', value: 4200000, color: '#60A5FA' },
    { name: 'EU Sub', value: 1800000, color: '#22D3EE' },
    { name: 'APAC', value: 950000, color: '#A78BFA' },
    { name: 'LATAM', value: 420000, color: '#FBBF24' },
  ]
}

export default function FinanceOSService() {
  useSEO({ title: 'FinanceOS u2014 Cloud FP&A Platform', description: 'FinanceOS by Financial Holding LLC. Cloud-native FP&A platform with budgeting, variance analysis, and financial reporting for growing teams.', canonical: '/products/financeos' })

  const { isDark } = useTheme()
  const ct = useChartTheme()
  const [activePanel, setActivePanel] = useState('budget')

  useEffect(() => { document.title = 'FinanceOS — Cloud FP&A Platform' }, [])

  const budgetData = useMemo(() => genBudgetData(), [])
  const varianceData = useMemo(() => genVarianceData(), [])
  const entityData = useMemo(() => genEntityData(), [])

  const fmt = (n) => {
    const a = Math.abs(n || 0)
    if (a >= 1e6) return `$${(a / 1e6).toFixed(1)}M`
    if (a >= 1e3) return `$${(a / 1e3).toFixed(0)}K`
    return `$${a.toFixed(0)}`
  }

  const PANELS = [
    { id: 'budget', label: 'Budget vs Actual', icon: BarChart3 },
    { id: 'variance', label: 'Variance Detective', icon: Target },
    { id: 'entity', label: 'Multi-Entity', icon: Layers },
  ]

  const FEATURES = [
    { icon: BarChart3, title: 'Budget vs Actual Tracking', desc: 'Real-time comparisons with automated variance alerts and drill-down capability across cost centers.' },
    { icon: Layers, title: 'Multi-Entity Consolidation', desc: 'Roll up subsidiaries, BUs, and international entities with automated intercompany eliminations.' },
    { icon: Target, title: 'Variance Detective', desc: 'AI-powered anomaly detection surfaces the "why" behind every budget deviation automatically.' },
    { icon: Brain, title: 'Scenario Modeling', desc: 'Monte Carlo simulations, what-if analysis, and sensitivity testing for board-ready projections.' },
    { icon: FileBarChart, title: 'Board Reporting', desc: 'One-click executive packages with dynamic charts, KPI dashboards, and commentary workflows.' },
    { icon: Shield, title: 'Audit-Ready Controls', desc: 'Immutable change logs, approval workflows, SOX-aligned permissions, and data lineage tracking.' },
  ]

  const METRICS = [
    { label: 'Faster Close', value: '5x', sub: 'vs spreadsheets' },
    { label: 'AI Models', value: '3', sub: 'forecast engines' },
    { label: 'Time Saved', value: '40h', sub: 'per month per analyst' },
    { label: 'Entities', value: '∞', sub: 'unlimited consolidation' },
  ]

  return (
    <div className="space-y-8 max-w-[1100px] mx-auto">

      {/* ═══ HERO — Kit 5 gradient + Kit 4 dot-grid ═══ */}
      <div className="relative overflow-hidden rounded-3xl" style={{ background: isDark ? 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 50%, #1E40AF 100%)' : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 50%, #BFDBFE 100%)' }}>
        {/* Kit 4 dot-grid */}
        <div className="absolute top-6 left-6 grid grid-cols-5 gap-2 opacity-[0.12]">
          {[...Array(25)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#60A5FA' : '#2563EB' }} />)}
        </div>
        <div className="absolute bottom-6 right-6 grid grid-cols-4 gap-2 opacity-[0.08]">
          {[...Array(16)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#60A5FA' : '#2563EB' }} />)}
        </div>
        <div className="absolute -top-16 -right-16 w-[280px] h-[280px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(96,165,250,0.4) 0%, transparent 70%)' }} />

        <div className="relative z-[2] px-10 py-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(37,99,235,0.1)', border: isDark ? '1px solid rgba(96,165,250,0.2)' : '1px solid rgba(37,99,235,0.15)' }}>
              <TrendingUp size={20} style={{ color: isDark ? '#60A5FA' : '#2563EB' }} />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#93C5FD' : '#2563EB' }}>AI-NATIVE FP&A PLATFORM</span>
          </div>
          <h1 className="font-display text-[36px] font-black tracking-tight leading-[1.1] mb-3" style={{ color: isDark ? '#EFF6FF' : '#0F172A' }}>
            FinanceOS
          </h1>
          <p className="text-[16px] leading-relaxed max-w-[500px] mb-6" style={{ color: isDark ? 'rgba(167,243,208,0.7)' : 'rgba(2,44,34,0.6)' }}>
            Connects your ERP, CRM, and billing data into a unified model with AI-powered variance detection and natural language querying.
          </p>

          {/* Kit 5 metrics strip */}
          <div className="flex gap-6">
            {METRICS.map(m => (
              <div key={m.label} className="px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(37,99,235,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(37,99,235,0.08)' }}>
                <p className="text-[22px] font-mono font-black" style={{ color: isDark ? '#60A5FA' : '#2563EB' }}>{m.value}</p>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: isDark ? '#BFDBFE' : '#1E40AF' }}>{m.label}</p>
                <p className="text-[9px] font-mono" style={{ color: isDark ? 'rgba(167,243,208,0.5)' : 'rgba(6,95,70,0.5)' }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ DYNAMIC CHART PANELS — Kit 5 analytics view ═══ */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <span className="terminal-label">LIVE DEMO</span>
            <p className="text-[12px] text-t3 mt-0.5">Interactive product preview — explore each module</p>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
            {PANELS.map(p => (
              <button key={p.id} onClick={() => setActivePanel(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-bold transition-all ${
                  activePanel === p.id ? 'bg-blue-400/[0.08] text-blue-400 border border-blue-400/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'
                }`}>
                <p.icon size={12} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[340px] px-4 pb-4">
          {activePanel === 'budget' && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={budgetData} barGap={2}>
                <defs>
                  <linearGradient id="fosBudgetGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#60A5FA" stopOpacity={isDark ? 0.2 : 0.25} />
                    <stop offset="100%" stopColor="#60A5FA" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={55} tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} />
                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                <Bar dataKey="budget" name="Budget" fill={isDark ? 'rgba(96,165,250,0.25)' : 'rgba(37,99,235,0.2)'} radius={[4,4,0,0]} />
                <Bar dataKey="actual" name="Actual" fill={isDark ? '#60A5FA' : '#2563EB'} radius={[4,4,0,0]} />
                <Line dataKey="forecast" name="Forecast" type="monotone" stroke={isDark ? '#FBBF24' : '#D97706'} strokeWidth={2} strokeDasharray="6 3" dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {activePanel === 'variance' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={varianceData} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="2 4" stroke={ct.grid} horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 0 ? `+$${(v/1e3).toFixed(0)}K` : `-$${(Math.abs(v)/1e3).toFixed(0)}K`} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: ct.tick, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={70} />
                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                <Bar dataKey="variance" name="Variance" radius={[0,4,4,0]}>
                  {varianceData.map((d, i) => (
                    <Cell key={i} fill={d.variance >= 0 ? (isDark ? '#60A5FA' : '#2563EB') : (isDark ? '#FB7185' : '#E11D48')} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {activePanel === 'entity' && (
            <div className="flex items-center h-full gap-8 px-4">
              <div className="w-[280px] h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={entityData} cx="50%" cy="50%" innerRadius={70} outerRadius={120} paddingAngle={3} dataKey="value">
                      {entityData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                {entityData.map(e => (
                  <div key={e.name} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${e.color}20` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: e.color }} />
                      <span className="text-[13px] font-semibold">{e.name}</span>
                    </div>
                    <span className="text-[14px] font-mono font-bold terminal-data">{fmt(e.value)}</span>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl mt-1" style={{ background: isDark ? 'rgba(96,165,250,0.06)' : 'rgba(37,99,235,0.04)', border: isDark ? '1px solid rgba(96,165,250,0.12)' : '1px solid rgba(37,99,235,0.1)' }}>
                  <span className="text-[12px] font-mono font-bold text-blue-400">CONSOLIDATED</span>
                  <span className="text-[16px] font-mono font-black text-blue-400 terminal-data">{fmt(entityData.reduce((s, e) => s + e.value, 0))}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="terminal-status flex items-center justify-between px-6 py-1.5">
          <div className="flex items-center gap-4 text-t3">
            <span className="terminal-live">DEMO</span>
            <span>MODULE: <span className="text-blue-400">{PANELS.find(p => p.id === activePanel)?.label}</span></span>
          </div>
          <span className="text-t3">FINANCEOS v2.0</span>
        </div>
      </div>

      {/* ═══ FEATURES GRID — Kit 4 infographic card pattern ═══ */}
      <div>
        <span className="terminal-label">CAPABILITIES</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 group hover:-translate-y-0.5 hover:border-blue-400/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-blue-400/[0.06] flex items-center justify-center mb-3 group-hover:bg-blue-400/[0.1] transition">
                <f.icon size={18} className="text-blue-400" />
              </div>
              <h3 className="text-[14px] font-semibold mb-1">{f.title}</h3>
              <p className="text-[12px] text-t3 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CTA — Kit 5 glass card style ═══ */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: isDark ? 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)' : 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)' }}>
        <div className="absolute top-4 right-4 grid grid-cols-3 gap-1.5 opacity-[0.1]">
          {[...Array(9)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#60A5FA' : '#2563EB' }} />)}
        </div>
        <div className="relative z-[2] px-8 py-8 flex items-center justify-between">
          <div>
            <h3 className="font-display text-[20px] font-extrabold" style={{ color: isDark ? '#EFF6FF' : '#0F172A' }}>Ready to replace your spreadsheets?</h3>
            <p className="text-[13px] mt-1" style={{ color: isDark ? 'rgba(167,243,208,0.6)' : 'rgba(6,95,70,0.6)' }}>Bundle with Vaultline for 15% off. Already a customer? You're pre-qualified.</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="mailto:sales@vaultline.app?subject=FinanceOS Interest&body=Hi, I'd like to learn about adding FinanceOS to our Vaultline setup."
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:-translate-y-px" style={{ background: isDark ? '#60A5FA' : '#2563EB', color: isDark ? '#0F172A' : '#fff' }}>
              Contact Sales
            </a>
            <Link to="/ecosystem" className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border transition-all hover:-translate-y-px" style={{ borderColor: isDark ? 'rgba(96,165,250,0.2)' : 'rgba(37,99,235,0.15)', color: isDark ? '#93C5FD' : '#2563EB' }}>
              View Bundle →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
