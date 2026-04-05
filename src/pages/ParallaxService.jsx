import { useSEO } from '@/hooks/useSEO'
import { useState, useEffect, useMemo } from 'react'

import { useTheme } from '@/hooks/useTheme'
import { Link } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar } from 'recharts'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { Shield, ArrowRight, Check, ClipboardCheck, AlertTriangle, BookOpen, CalendarCheck, Users, FileSearch, Radar, Gauge, Lock, CheckCircle2, ArrowUpRight } from 'lucide-react'

/* ═══ DEMO DATA — Aerospace compliance panels ═══ */
function genComplianceScore() {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  let score = 72
  return months.map(m => {
    score = Math.min(100, Math.max(60, score + (Math.random() - 0.3) * 5))
    return { month: m, score: Math.round(score), target: 85 }
  })
}

function genFrameworkData() {
  return [
    { name: 'AS9100D', score: 92, fill: '#FBBF24' },
    { name: 'CMMC L2', score: 78, fill: '#22D3EE' },
    { name: 'ITAR', score: 95, fill: '#34D399' },
    { name: 'NADCAP', score: 85, fill: '#A78BFA' },
  ]
}

function genCAPAData() {
  return [
    { name: 'Open', value: 8, color: '#FB7185' },
    { name: 'In Progress', value: 14, color: '#FBBF24' },
    { name: 'Verified', value: 6, color: '#22D3EE' },
    { name: 'Closed', value: 34, color: '#34D399' },
  ]
}

export default function ParallaxService() {
  useSEO({ title: 'Parallax u2014 Aerospace Supplier Compliance', description: 'Parallax aerospace compliance OS. AS9100D, CMMC Level 2, ESG, and AS6174 compliance management for Tier 3/4 aerospace suppliers.', canonical: '/products/parallax' })

  const { isDark } = useTheme()
  const ct = useChartTheme()
  const [activePanel, setActivePanel] = useState('score')

  useEffect(() => { document.title = 'Parallax — Aerospace Supplier Compliance OS' }, [])

  const scoreData = useMemo(() => genComplianceScore(), [])
  const frameworkData = useMemo(() => genFrameworkData(), [])
  const capaData = useMemo(() => genCAPAData(), [])

  const PANELS = [
    { id: 'score', label: 'Compliance Score', icon: Gauge },
    { id: 'frameworks', label: 'Framework Coverage', icon: Shield },
    { id: 'capa', label: 'CAPA Lifecycle', icon: ClipboardCheck },
  ]

  const FEATURES = [
    { icon: Shield, title: 'AS9100 / CMMC Frameworks', desc: 'Pre-built control libraries mapped to AS9100D, CMMC Level 2, ITAR, and NADCAP with gap analysis.' },
    { icon: ClipboardCheck, title: 'Questionnaire Management', desc: 'Centralized supplier questionnaires with scoring, follow-up workflows, and response tracking.' },
    { icon: AlertTriangle, title: 'CAPA Lifecycle', desc: 'Full corrective/preventive action workflow — root cause analysis, containment, verification, closure.' },
    { icon: CalendarCheck, title: 'Audit Calendar', desc: 'Automated scheduling, auditor assignment, finding tracking, and evidence collection in one view.' },
    { icon: BookOpen, title: 'Training Matrix', desc: 'Role-based training requirements, certification tracking, expiry alerts, and compliance gap reports.' },
    { icon: FileSearch, title: 'Document Control', desc: 'Version-controlled procedures, revision workflows, acknowledgment tracking, and retention policies.' },
  ]

  const METRICS = [
    { label: 'Audit Ready', value: '2x', sub: 'faster preparation' },
    { label: 'CAPA Closure', value: '67%', sub: 'faster resolution' },
    { label: 'Finding Risk', value: '-40%', sub: 'reduction year-over-year' },
    { label: 'Frameworks', value: '12+', sub: 'pre-built libraries' },
  ]

  return (
    <div className="space-y-8 max-w-[1100px] mx-auto">

      {/* ═══ HERO — Kit 5 warm amber gradient + Kit 4 dot-grid ═══ */}
      <div className="relative overflow-hidden rounded-3xl" style={{ background: isDark ? 'linear-gradient(135deg, #1C1917 0%, #44403C 50%, #57534E 100%)' : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 50%, #FDE68A 100%)' }}>
        <div className="absolute top-6 left-6 grid grid-cols-5 gap-2 opacity-[0.12]">
          {[...Array(25)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#FBBF24' : '#D97706' }} />)}
        </div>
        <div className="absolute bottom-6 right-6 grid grid-cols-4 gap-2 opacity-[0.08]">
          {[...Array(16)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#FBBF24' : '#D97706' }} />)}
        </div>
        <div className="absolute -top-16 -right-16 w-[280px] h-[280px] rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%)' }} />

        <div className="relative z-[2] px-10 py-12">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: isDark ? 'rgba(251,191,36,0.15)' : 'rgba(217,119,6,0.1)', border: isDark ? '1px solid rgba(251,191,36,0.2)' : '1px solid rgba(217,119,6,0.15)' }}>
              <Shield size={20} style={{ color: isDark ? '#FBBF24' : '#D97706' }} />
            </div>
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: isDark ? '#FDE68A' : '#D97706' }}>AEROSPACE SUPPLIER COMPLIANCE OS</span>
          </div>
          <h1 className="font-display text-[36px] font-black tracking-tight leading-[1.1] mb-3" style={{ color: isDark ? '#FFFBEB' : '#1C1917' }}>
            Parallax
          </h1>
          <p className="text-[16px] leading-relaxed max-w-[520px] mb-6" style={{ color: isDark ? 'rgba(254,243,199,0.7)' : 'rgba(28,25,23,0.6)' }}>
            Compliance management for aerospace suppliers — from AS9100 audits to CAPA closure, in one platform.
          </p>

          <div className="flex gap-6">
            {METRICS.map(m => (
              <div key={m.label} className="px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(217,119,6,0.04)', border: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(217,119,6,0.08)' }}>
                <p className="text-[22px] font-mono font-black" style={{ color: isDark ? '#FBBF24' : '#D97706' }}>{m.value}</p>
                <p className="text-[10px] font-mono font-semibold uppercase tracking-wider" style={{ color: isDark ? '#FDE68A' : '#92400E' }}>{m.label}</p>
                <p className="text-[9px] font-mono" style={{ color: isDark ? 'rgba(254,243,199,0.5)' : 'rgba(146,64,14,0.5)' }}>{m.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ DYNAMIC CHART PANELS ═══ */}
      <div className="glass-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 pt-5 pb-4">
          <div>
            <span className="terminal-label">LIVE DEMO</span>
            <p className="text-[12px] text-t3 mt-0.5">Interactive compliance modules — explore each view</p>
          </div>
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
            {PANELS.map(p => (
              <button key={p.id} onClick={() => setActivePanel(p.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-mono font-bold transition-all ${
                  activePanel === p.id ? 'bg-amber/[0.08] text-amber border border-amber/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'
                }`}>
                <p.icon size={12} /> {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="h-[340px] px-4 pb-4">
          {activePanel === 'score' && (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={scoreData}>
                <defs>
                  <linearGradient id="parScoreGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FBBF24" stopOpacity={isDark ? 0.2 : 0.25} />
                    <stop offset="100%" stopColor="#FBBF24" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="2 4" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} />
                <YAxis domain={[50, 100]} tick={{ fontSize: 10, fill: ct.tick, fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} width={35} tickFormatter={v => `${v}%`} />
                <Tooltip content={<ChartTooltip isDark={isDark} />} />
                <Area type="monotone" dataKey="target" name="Target" stroke={isDark ? '#475569' : '#94A3B8'} strokeDasharray="6 4" fill="none" dot={false} />
                <Area type="monotone" dataKey="score" name="Compliance Score" stroke={isDark ? '#FBBF24' : '#D97706'} strokeWidth={2.5} fill="url(#parScoreGrad)" dot={{ r: 3, fill: isDark ? '#FBBF24' : '#D97706', stroke: 'none' }} />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {activePanel === 'frameworks' && (
            <div className="flex items-center h-full gap-10 px-6">
              <div className="flex-1 flex flex-col gap-3">
                {frameworkData.map(f => (
                  <div key={f.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[13px] font-semibold">{f.name}</span>
                      <span className="text-[13px] font-mono font-bold" style={{ color: f.fill }}>{f.score}%</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${f.score}%`, background: `linear-gradient(90deg, ${f.fill}90, ${f.fill})` }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="w-[240px] flex flex-col gap-2">
                <div className="px-4 py-3 rounded-xl text-center" style={{ background: isDark ? 'rgba(52,211,153,0.06)' : 'rgba(5,150,105,0.04)', border: isDark ? '1px solid rgba(52,211,153,0.12)' : '1px solid rgba(5,150,105,0.1)' }}>
                  <p className="text-[10px] font-mono font-bold text-green uppercase">AVG COVERAGE</p>
                  <p className="text-[28px] font-mono font-black text-green">{Math.round(frameworkData.reduce((s, f) => s + f.score, 0) / frameworkData.length)}%</p>
                </div>
                <div className="px-4 py-3 rounded-xl text-center" style={{ background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(217,119,6,0.04)', border: isDark ? '1px solid rgba(251,191,36,0.12)' : '1px solid rgba(217,119,6,0.1)' }}>
                  <p className="text-[10px] font-mono font-bold text-amber uppercase">GAPS IDENTIFIED</p>
                  <p className="text-[28px] font-mono font-black text-amber">{frameworkData.filter(f => f.score < 90).length}</p>
                </div>
              </div>
            </div>
          )}

          {activePanel === 'capa' && (
            <div className="flex items-center h-full gap-8 px-4">
              <div className="w-[280px] h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={capaData} cx="50%" cy="50%" innerRadius={65} outerRadius={115} paddingAngle={3} dataKey="value">
                      {capaData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip isDark={isDark} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 flex flex-col gap-2">
                {capaData.map(c => (
                  <div key={c.name} className="flex items-center justify-between px-4 py-3 rounded-xl" style={{ background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', border: `1px solid ${c.color}20` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
                      <span className="text-[13px] font-semibold">{c.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-mono font-bold terminal-data">{c.value}</span>
                      <span className="text-[10px] font-mono text-t3">{Math.round(c.value / capaData.reduce((s, x) => s + x.value, 0) * 100)}%</span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between px-4 py-3 rounded-xl mt-1" style={{ background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(217,119,6,0.04)', border: isDark ? '1px solid rgba(251,191,36,0.12)' : '1px solid rgba(217,119,6,0.1)' }}>
                  <span className="text-[12px] font-mono font-bold text-amber">TOTAL CAPAs</span>
                  <span className="text-[16px] font-mono font-black text-amber terminal-data">{capaData.reduce((s, c) => s + c.value, 0)}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="terminal-status flex items-center justify-between px-6 py-1.5">
          <div className="flex items-center gap-4 text-t3">
            <span className="terminal-live">DEMO</span>
            <span>MODULE: <span className="text-amber">{PANELS.find(p => p.id === activePanel)?.label}</span></span>
          </div>
          <span className="text-t3">PARALLAX v1.0</span>
        </div>
      </div>

      {/* ═══ FEATURES GRID ═══ */}
      <div>
        <span className="terminal-label">CAPABILITIES</span>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {FEATURES.map((f, i) => (
            <div key={i} className="glass-card rounded-2xl p-5 group hover:-translate-y-0.5 hover:border-amber/[0.12] transition-all">
              <div className="w-10 h-10 rounded-xl bg-amber/[0.06] flex items-center justify-center mb-3 group-hover:bg-amber/[0.1] transition">
                <f.icon size={18} className="text-amber" />
              </div>
              <h3 className="text-[14px] font-semibold mb-1">{f.title}</h3>
              <p className="text-[12px] text-t3 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ CTA ═══ */}
      <div className="relative overflow-hidden rounded-2xl" style={{ background: isDark ? 'linear-gradient(135deg, #1C1917 0%, #44403C 100%)' : 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 100%)' }}>
        <div className="absolute top-4 right-4 grid grid-cols-3 gap-1.5 opacity-[0.1]">
          {[...Array(9)].map((_, i) => <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: isDark ? '#FBBF24' : '#D97706' }} />)}
        </div>
        <div className="relative z-[2] px-8 py-8 flex items-center justify-between">
          <div>
            <h3 className="font-display text-[20px] font-extrabold" style={{ color: isDark ? '#FFFBEB' : '#1C1917' }}>Ready for your next audit?</h3>
            <p className="text-[13px] mt-1" style={{ color: isDark ? 'rgba(254,243,199,0.6)' : 'rgba(146,64,14,0.6)' }}>Bundle with Vaultline for 15% off. Compliance + Treasury in one platform.</p>
          </div>
          <div className="flex items-center gap-3">
            <a href="mailto:sales@vaultline.app?subject=Parallax Interest&body=Hi, I'd like to learn about adding Parallax to our Vaultline setup."
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all hover:-translate-y-px" style={{ background: isDark ? '#FBBF24' : '#D97706', color: isDark ? '#1C1917' : '#fff' }}>
              Contact Sales
            </a>
            <Link to="/ecosystem" className="px-5 py-2.5 rounded-xl text-[13px] font-semibold border transition-all hover:-translate-y-px" style={{ borderColor: isDark ? 'rgba(251,191,36,0.2)' : 'rgba(217,119,6,0.15)', color: isDark ? '#FDE68A' : '#D97706' }}>
              View Bundle →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
