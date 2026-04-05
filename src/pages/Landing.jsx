import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import ThemeToggle from '@/components/ThemeToggle'
import { useEffect, useRef, useState, useMemo } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useSEO } from '@/hooks/useSEO'
import { ComposedChart, Bar, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Eye, Brain, Plug, Shield, BarChart3, Zap, Lock, Globe, Server,
  ArrowRight, Check, Sparkles,  TrendingUp, DollarSign, Clock, Users, Leaf,
  Building2, ChevronRight, CheckCircle2, ShieldCheck, KeyRound, Database, Activity
} from 'lucide-react'

const FEATURES = [
  { icon: Eye, title: 'Real-Time Cash Visibility', desc: 'Every account, every bank, every dollar — updated continuously across all institutions.', metric: '< 60s sync', gradient: 'from-cyan to-sky-400' },
  { icon: Brain, title: 'AI-Powered Forecasting', desc: '30/60/90-day cash projections that learn from your patterns and get smarter over time.', metric: '3 AI models', gradient: 'from-purple to-indigo-400' },
  { icon: Plug, title: 'Bank & ERP Connections', desc: 'Connect Chase, BofA, Mercury, SVB, QuickBooks, Xero, NetSuite, and Sage.', metric: 'Plaid-powered', gradient: 'from-green to-emerald-400' },
  { icon: Shield, title: 'Enterprise Security', desc: 'SOC 2 ready architecture, AES-256 encryption, row-level isolation. Your data never touches another org.', metric: 'SOC 2 Ready', gradient: 'from-amber to-orange-400' },
  { icon: BarChart3, title: 'Board-Ready Reports', desc: 'One-click treasury summaries, cash flow waterfalls, and variance analysis.', metric: '1-click export', gradient: 'from-rose-400 to-pink-500' },
  { icon: Zap, title: 'Treasury Copilot', desc: 'Ask questions in plain English. Get answers grounded in your actual financial data.', metric: 'Claude AI', gradient: 'from-cyan to-purple' },
]

const PLANS = [
  { name: 'Starter', price: '$499', annual: '$399', desc: 'For growing companies getting treasury under control', features: ['3 bank connections', 'Cash position dashboard', '30-day forecasting', 'Email alerts', 'Basic reports'] },
  { name: 'Growth', price: '$1,499', annual: '$1,199', desc: 'For mid-market teams managing real complexity', features: ['10 bank connections', 'AI Copilot', '90-day forecasting', 'Custom reports', 'Slack integration', 'API access'], popular: true },
  { name: 'Enterprise', price: '$2,499', annual: '$1,999', desc: 'For treasury teams that need everything', features: ['Unlimited connections', 'Priority support', 'Custom integrations', 'SSO / SAML', 'Audit log & compliance', 'Uptime SLA', 'Advanced security controls'] },
  { name: 'Custom', price: 'Custom', annual: 'Custom', desc: 'Tailored treasury for large organizations', features: ['Everything in Enterprise', 'Multi-region deployment', 'Custom SLA & uptime', 'Dedicated infrastructure', 'On-premise option', 'White-glove onboarding', 'Executive QBRs'], talkToSales: true },
]

const TESTIMONIALS = [
  { metric: '6h → 30s', metricLabel: 'Reconciliation time', title: 'Real-Time Cash Visibility', desc: 'Consolidate balances across every bank, entity, and currency into a single live dashboard. No more spreadsheet reconciliation.' },
  { metric: '3 Models', metricLabel: 'Forecast engine', title: 'AI-Powered Forecasting', desc: 'Linear, EMA, and Monte Carlo models with confidence bands. Switch between models in one click to stress-test projections.' },
  { metric: '∞ Entities', metricLabel: 'Multi-entity support', title: 'Multi-Entity Consolidation', desc: 'Roll up subsidiaries, BUs, and international entities with automated intercompany eliminations and currency conversion.' },
]

const INTEGRATIONS = ['JPMorgan Chase', 'Bank of America', 'Mercury', 'SVB', 'Wells Fargo', 'Citi', 'QuickBooks', 'Xero', 'Sage', 'NetSuite', 'Plaid', 'Stripe']

const HOW_IT_WORKS = [
  { step: '01', title: 'Connect your banks', desc: 'Link all your bank accounts and ERPs in under 60 seconds via Plaid or direct API.', icon: Plug },
  { step: '02', title: 'See your position', desc: 'Get a unified view of cash across every entity, account, and currency — updated continuously.', icon: Eye },
  { step: '03', title: 'Forecast & optimize', desc: 'AI-powered projections, scenario modeling, and copilot insights to maximize your treasury.', icon: Brain },
]

function AnimatedNumber({ target, suffix = '', prefix = '' }) {
  const [value, setValue] = useState(0)
  const ref = useRef(null)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        let start = 0
        const step = target / 40
        const timer = setInterval(() => {
          start += step
          if (start >= target) { setValue(target); clearInterval(timer) }
          else setValue(Math.floor(start))
        }, 30)
        observer.disconnect()
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])
  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>
}

function FadeIn({ children, delay = 0, className = '' }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setVisible(true); observer.disconnect() }
    }, { threshold: 0.1 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [])
  return (
    <div ref={ref} className={`transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'} ${className}`}
      style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  )
}

/* Demo chart — compound waveform bars + net flow line */
const DEMO_DAYS = (() => {
  const days = []
  let cumulative = 0
  const now = new Date()
  for (let i = 0; i < 30; i++) {
    const d = new Date(now); d.setDate(d.getDate() - (29 - i))
    const trend = i * 1.8
    const cycle = Math.sin(i * 0.35) * 25
    const weekly = Math.sin(i * 0.9) * 12
    const base = 40 + cycle + trend + weekly
    const inflow = Math.round((base + Math.sin(i * 0.7) * 15 + 5) * 1000)
    const outflow = Math.round((base * 0.62 + Math.cos(i * 0.5) * 12 + 4) * 1000)
    const net = inflow - outflow
    cumulative += net
    days.push({ date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), inflow, outflow, net, cumulative })
  }
  return days
})()

function DemoPulse({ isDark }) {
  const cCyan = isDark ? '#22D3EE' : '#0891B2'
  const cGreen = isDark ? 'rgba(52,211,153,0.5)' : 'rgba(5,150,105,0.7)'
  const cRed = isDark ? 'rgba(251,113,133,0.35)' : 'rgba(225,29,72,0.55)'
  return (
    <div className="bg-deep rounded-lg border border-border overflow-hidden" style={{ height: 160 }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={DEMO_DAYS} barGap={1} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
          <defs>
            <linearGradient id="demoInflowG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cGreen} stopOpacity={1} /><stop offset="100%" stopColor={cGreen} stopOpacity={isDark ? 0.6 : 0.75} />
            </linearGradient>
            <linearGradient id="demoOutflowG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cRed} stopOpacity={1} /><stop offset="100%" stopColor={cRed} stopOpacity={isDark ? 0.6 : 0.75} />
            </linearGradient>
            <linearGradient id="demoNetG" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={cCyan} stopOpacity={isDark ? 0.12 : 0.15} /><stop offset="100%" stopColor={cCyan} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 4" stroke={isDark ? 'rgba(30,48,80,0.2)' : 'rgba(15,23,42,0.06)'} vertical={false} />
          <XAxis dataKey="date" tick={{ fontSize: 8, fill: isDark ? '#334155' : '#94A3B8', fontFamily: 'JetBrains Mono' }} tickLine={false} axisLine={false} interval={6} />
          <YAxis tick={false} axisLine={false} width={0} />
          <Tooltip contentStyle={{ background: isDark ? '#0C1323' : '#fff', border: isDark ? '1px solid rgba(30,48,80,0.5)' : '1px solid rgba(15,23,42,0.1)', borderRadius: 10, fontSize: 11, fontFamily: 'JetBrains Mono', boxShadow: isDark ? '0 8px 32px rgba(0,0,0,0.4)' : '0 8px 32px rgba(0,0,0,0.1)' }}
            formatter={(v) => ['$' + (Math.abs(v) >= 1e3 ? (Math.abs(v)/1e3).toFixed(0) + 'K' : v)]}
            labelStyle={{ fontSize: 10, color: isDark ? '#94A3B8' : '#64748B' }} cursor={{ stroke: isDark ? 'rgba(34,211,238,0.1)' : 'rgba(8,145,178,0.06)', strokeWidth: 1 }} />
          <Bar dataKey="inflow" name="Inflows" fill="url(#demoInflowG)" radius={[2, 2, 0, 0]} />
          <Bar dataKey="outflow" name="Outflows" fill="url(#demoOutflowG)" radius={[2, 2, 0, 0]} />
          <Area dataKey="net" name="Net Trend" legendType="none" tooltipType="none" stroke="none" fill="url(#demoNetG)" />
          <Line dataKey="net" name="Net Flow" type="monotone" stroke={cCyan} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: isDark ? '#0C1323' : '#fff', fill: cCyan }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}



export default function Landing() {
  const { user, loading } = useAuth()
  const { isDark } = useTheme()
  const [annualPricing, setAnnualPricing] = useState(false)
  useSEO({ title: 'Cloud Treasury Management for Mid-Market Finance Teams', description: 'Real-time cash visibility, AI forecasting, and multi-entity treasury management. Replace spreadsheets with crystal-clear cash intelligence. From $599/mo.', canonical: '/' })

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-void"><div className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-void text-t1 overflow-x-hidden">
      {/* Gradient mesh */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-40%] right-[-20%] w-[900px] h-[900px] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, #22D3EE 0%, transparent 60%)', animation: 'float1 20s ease-in-out infinite' }} />
        <div className="absolute bottom-[-30%] left-[-10%] w-[700px] h-[700px] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, #818CF8 0%, transparent 60%)', animation: 'float2 25s ease-in-out infinite' }} />
        <div className="absolute top-[30%] left-[40%] w-[500px] h-[500px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #34D399 0%, transparent 60%)', animation: 'float3 18s ease-in-out infinite' }} />
      </div>

      <style>{`
        @keyframes float1 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-80px,60px) scale(1.1); } }
        @keyframes float2 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(60px,-40px) scale(1.05); } }
        @keyframes float3 { 0%,100% { transform: translate(0,0) scale(1); } 50% { transform: translate(-40px,-60px) scale(1.15); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-100%); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        .animate-slideUp { animation: slideUp 0.8s ease-out forwards; }
        .animate-slideDown { animation: slideDown 0.5s cubic-bezier(0.4,0,0.2,1) forwards; }
        .stagger-1 { animation-delay: 0.1s; opacity: 0; }
        .stagger-2 { animation-delay: 0.2s; opacity: 0; }
        .stagger-3 { animation-delay: 0.35s; opacity: 0; }
        .stagger-4 { animation-delay: 0.5s; opacity: 0; }
      `}</style>

      {/* Welcome banner for logged-in users */}
      {user && (
        <div className="fixed top-0 left-0 right-0 z-[60] animate-slideDown">
          <div className="bg-gradient-to-r from-cyan/[0.08] via-purple/[0.04] to-cyan/[0.08] border-b border-cyan/[0.1] backdrop-blur-2xl">
            <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center"><Sparkles size={14} className="text-cyan" /></div>
                <div>
                  <p className="text-[14px] font-medium text-t1">Welcome back{user.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''}</p>
                  <p className="text-[12px] text-t3">Your treasury dashboard is ready</p>
                </div>
              </div>
              <Link to="/dashboard" className="flex items-center gap-2 px-5 py-2 rounded-xl bg-cyan/[0.08] border border-cyan/[0.12] text-cyan text-[14px] font-semibold hover:bg-cyan/[0.12] transition-all">
                Go to Dashboard <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className={`fixed ${user ? 'top-[52px]' : 'top-0'} left-0 right-0 z-50 glass transition-all`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <img src="/logo.svg" alt="Vaultline" className="w-7 h-7 rounded-lg" />
            <h1 className="font-display text-xl font-black tracking-tight">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></h1>
          </div>
          <div className="hidden md:flex items-center gap-8 text-[14px] text-t2 font-medium">
            <a href="#features" className="hover:text-t1 transition">Features</a>
            <Link to="/security" className="hover:text-t1 transition">Security</Link>
            <a href="#integrations" className="hover:text-t1 transition">Integrations</a>
            <a href="#pricing" className="hover:text-t1 transition">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <Link to="/dashboard" className="px-5 py-2 rounded-xl bg-card border border-cyan/[0.15] text-cyan text-[14px] font-semibold hover:bg-cyan/[0.06] transition-all flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green animate-[pulse_3s_ease-in-out_infinite]" /> Dashboard
              </Link>
            ) : (<>
              <Link to="/login" className="text-[14px] text-t2 hover:text-t1 transition font-medium">Sign In</Link>
              <Link to="/signup" className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-void text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all shadow-[0_2px_16px_rgba(34,211,238,0.25)]">Get Started</Link>
            </>)}
          </div>
        </div>
      </nav>

      {/* ════ HERO ════ */}
      <section className={`${user ? 'pt-48' : 'pt-36'} pb-8 px-6 relative transition-all`}>
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-border mb-8 text-[13px] text-t2 animate-slideUp stagger-1 backdrop-blur-sm">
            <Sparkles size={14} className="text-cyan" />
            AI-powered treasury for modern finance teams
          </div>
          <h2 className="font-display text-[56px] leading-[1.06] font-black tracking-tight mb-6 animate-slideUp stagger-2">
            Your cash position.<br />
            <span className="bg-gradient-to-r from-cyan via-sky-300 to-purple bg-clip-text text-transparent">Crystal clear.</span>
          </h2>
          <p className="text-lg text-t2 max-w-2xl mx-auto mb-8 leading-relaxed animate-slideUp stagger-3">
            Vaultline connects all your bank accounts, forecasts your cash flow with AI-powered models, and gives your treasury team a copilot that actually knows your numbers.
          </p>
          {/* Trust badges */}
          <div className="flex items-center justify-center gap-5 mb-10 animate-slideUp stagger-3">
            {[
              { icon: ShieldCheck, label: 'SOC 2 Ready' },
              { icon: Lock, label: 'AES-256' },
              { icon: Database, label: 'Row-Level Isolation' },
              { icon: KeyRound, label: 'SSO / SAML' },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-1.5 text-[12px] font-mono text-t3">
                <b.icon size={13} className="text-cyan/60" /> {b.label}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 animate-slideUp stagger-4">
            <Link to="/signup" className="group px-8 py-3.5 rounded-[12px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[16px] font-bold shadow-[0_4px_28px_rgba(34,211,238,0.3)] hover:-translate-y-1 active:scale-[0.98] hover:shadow-[0_8px_40px_rgba(34,211,238,0.4)] transition-all flex items-center gap-2">
              Get Started <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link to="/roi" className="px-8 py-3.5 rounded-[12px] border border-border text-[16px] font-semibold text-t2 hover:border-cyan/30 hover:text-t1 transition-all backdrop-blur-sm">Calculate Your ROI</Link>
          </div>
          <p className="text-[12px] text-t3 mt-5 animate-slideUp stagger-4">30-day money-back guarantee · Cancel anytime · No long-term contracts</p>
          <div className="flex items-center justify-center gap-6 mt-3 animate-slideUp stagger-4">
            <Link to="/assess" className="text-[12px] text-t3 hover:text-purple transition flex items-center gap-1">Take Treasury Readiness Assessment <ChevronRight size={12} /></Link>
          </div>
        </div>
      </section>

      {/* ════ HERO DASHBOARD MOCKUP ════ */}
      <section className="px-6 pb-20">
        <FadeIn>
          <div className="max-w-5xl mx-auto relative">
            <div className="absolute -inset-4 bg-gradient-to-b from-cyan/10 via-purple/5 to-transparent rounded-[28px] blur-2xl" />
            <div className="relative glass rounded-[20px] p-1 shadow-[0_20px_80px_rgba(0,0,0,0.5)] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red/60" /><div className="w-3 h-3 rounded-full bg-amber/60" /><div className="w-3 h-3 rounded-full bg-green/60" />
                </div>
                <div className="flex-1 flex justify-center"><div className="bg-deep rounded-lg px-4 py-1 text-[11px] text-t3 font-mono flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green/60" /> www.vaultline.app/dashboard</div></div>
              </div>
              <div className="p-5 grid grid-cols-[200px_1fr] gap-4">
                <div className="space-y-0.5">
                  {['Dashboard', 'Cash Position', 'Forecasting', 'Transactions', 'Bank Connections', 'Reports'].map((item, i) => (
                    <div key={item} className={`px-3 py-2 rounded-lg text-[12px] font-mono ${i === 0 ? 'bg-cyan-glow text-cyan font-semibold' : 'text-t3'}`}>{item}</div>
                  ))}
                </div>
                <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-2.5">
                    {[
                      { label: 'TOTAL CASH', value: '$14.2M', color: 'text-cyan', change: '+3.2%', up: true },
                      { label: 'NET FLOW', value: '+$892K', color: 'text-green', change: '+12.4%', up: true },
                      { label: 'RUNWAY', value: '18.4 mo', color: 'text-purple', change: 'Stable', up: true },
                      { label: 'ACCURACY', value: '94.7%', color: 'text-amber', change: '+1.8pp', up: true },
                    ].map((s) => (
                      <div key={s.label} className="bg-deep rounded-lg p-3 border border-border relative overflow-hidden">
                        <div className="absolute inset-0 opacity-[0.015]" style={{ background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.5) 2px, rgba(0,0,0,0.5) 4px)' }} />
                        <p className="text-[9px] text-t3 font-mono uppercase tracking-[0.1em] relative">{s.label}</p>
                        <p className={`font-mono text-[18px] font-black ${s.color} mt-1 relative`} style={{ fontFeatureSettings: "'tnum' 1" }}>{s.value}</p>
                        <p className="text-[10px] text-green font-mono mt-1 relative">{s.change}</p>
                      </div>
                    ))}
                  </div>
                  <DemoPulse isDark={isDark} />
                  <div className="relative p-[1px] rounded-lg overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan via-purple to-cyan opacity-30" style={{ backgroundSize: '200%', animation: 'shimmer 3s linear infinite' }} />
                    <div className="relative bg-card rounded-lg px-4 py-2.5">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', borderRadius: '4px 4px 0 0', background: 'rgba(34,211,238,0.04)', border: '1px solid rgba(34,211,238,0.08)', borderBottom: 'none', fontFamily: 'JetBrains Mono, monospace', fontSize: '9px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: isDark ? '#22D3EE' : '#0891B2' }}>AI INSIGHT</span>
                      <p className="text-[12px] text-t3 mt-0.5">$2.8M idle cash detected in Chase Operating. Recommend sweep to high-yield savings.</p>
                    </div>
                  </div>
                  {/* Demo status bar */}
                  <div style={{ background: isDark ? 'rgba(3,7,17,0.7)' : 'rgba(241,245,249,0.9)', borderTop: `1px solid ${isDark ? 'rgba(34,211,238,0.06)' : 'rgba(8,145,178,0.1)'}`, fontFamily: 'JetBrains Mono, monospace', fontSize: '10px', letterSpacing: '0.02em' }}
                    className="flex items-center justify-between px-5 py-1.5 text-t3">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green" /> LIVE</span>
                      <span>4 ACCOUNTS</span>
                      <span>247 TXNS</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>PERIOD: <span style={{ color: isDark ? '#22D3EE' : '#0891B2' }}>30D</span></span>
                      <span>SYNC: <span style={{ color: isDark ? '#34D399' : '#059669' }}>OK</span></span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ════ SOCIAL PROOF STRIP ════ */}
      <section className="py-5 border-y border-border">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-center gap-8 text-[13px] text-t3">
          <span className="font-mono">Built for mid-market treasury teams</span>
          <span className="w-px h-4 bg-border" />
          {['$10M\u2013$500M revenue', 'Mid-market focus', 'SOC 2 ready'].map(t => (
            <span key={t} className="flex items-center gap-1.5 font-mono"><Check size={12} className="text-cyan/50" /> {t}</span>
          ))}
        </div>
      </section>

      {/* ════ STATS ════ */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto grid grid-cols-4 gap-8">
          {[
            { value: 12, suffix: 'K+', prefix: '', label: 'Banks Supported', icon: DollarSign },
            { value: 3, suffix: ' Models', prefix: '', label: 'Forecast Engine', icon: TrendingUp },
            { value: 28, suffix: '', prefix: '', label: 'Currencies Live', icon: Clock },
            { value: 30, suffix: '-Day', prefix: '', label: 'M-B Guarantee', icon: Building2 },
          ].map((s, i) => (
            <FadeIn key={s.label} delay={i * 100}>
              <div className="text-center group">
                <div className="w-10 h-10 rounded-xl bg-cyan-glow flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                  <s.icon size={18} className="text-cyan" />
                </div>
                <div className="font-display text-[36px] font-extrabold bg-gradient-to-r from-cyan-bright to-cyan bg-clip-text text-transparent">
                  <AnimatedNumber target={s.value} suffix={s.suffix} prefix={s.prefix || ''} />
                </div>
                <div className="text-[14px] text-t2 mt-1 font-medium">{s.label}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* ════ HOW IT WORKS ════ */}
      <section className="py-20 px-6 border-y border-border">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h3 className="font-display text-[36px] font-extrabold text-center mb-3 tracking-tight">Up and running in minutes</h3>
            <p className="text-t3 text-center mb-16 max-w-xl mx-auto text-[16px]">No 6-month implementation. No consultants. Connect your banks and see your position in under 60 seconds.</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {HOW_IT_WORKS.map((s, i) => (
              <FadeIn key={s.step} delay={i * 120}>
                <div className="relative">
                  <div className="text-[64px] font-display font-black text-cyan/[0.06] absolute -top-6 -left-2 select-none">{s.step}</div>
                  <div className="relative pt-6">
                    <div className={`w-12 h-12 rounded-[14px] bg-gradient-to-br ${i === 0 ? 'from-cyan to-sky-400' : i === 1 ? 'from-purple to-indigo-400' : 'from-green to-emerald-400'} flex items-center justify-center mb-4 shadow-lg`}>
                      <s.icon size={22} className="text-void" />
                    </div>
                    <h4 className="font-display font-bold text-[18px] mb-2">{s.title}</h4>
                    <p className="text-[14px] text-t2 leading-relaxed">{s.desc}</p>
                  </div>
                  {i < 2 && <ChevronRight size={20} className="text-border absolute top-12 -right-5 hidden lg:block" />}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ FEATURES ════ */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h3 className="font-display text-[36px] font-extrabold text-center mb-3 tracking-tight">Everything your treasury team needs</h3>
            <p className="text-t3 text-center mb-16 max-w-xl mx-auto text-[16px]">Modern treasury management without the enterprise price tag or 6-month implementation.</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <FadeIn key={f.title} delay={i * 80}>
                <div className="border border-border rounded-[18px] p-7 hover:border-cyan/30 hover:-translate-y-2 transition-all duration-300 group relative overflow-hidden backdrop-blur-sm">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-cyan/5 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="flex items-center justify-between mb-5">
                    <div className={`w-12 h-12 rounded-[14px] bg-gradient-to-br ${f.gradient} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                      <f.icon size={22} className="text-void" />
                    </div>
                    <span className="text-[11px] font-mono font-bold text-cyan bg-cyan/[0.06] border border-cyan/[0.1] px-2.5 py-1 rounded-full">{f.metric}</span>
                  </div>
                  <h4 className="font-display font-bold text-[16px] mb-2.5 group-hover:text-cyan active:text-cyan transition">{f.title}</h4>
                  <p className="text-[14px] text-t2 leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ SECURITY ════ */}
      <section id="security" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h3 className="font-display text-[36px] font-extrabold text-center mb-3 tracking-tight">Bank-grade security. Zero compromises.</h3>
            <p className="text-t3 text-center mb-16 max-w-xl mx-auto text-[16px]">Your financial data is encrypted at rest and in transit. Every query is scoped to your organization through row-level security policies.</p>
          </FadeIn>
          <div className="grid grid-cols-2 gap-5">
            {[
              { icon: ShieldCheck, title: 'SOC 2 Type II Ready', desc: 'Security architecture built to SOC 2 Type II standards. Formal audit logging, access controls, incident response, and data retention policies.', badge: 'Ready' },
              { icon: Lock, title: 'AES-256 Encryption', desc: 'Data encrypted at rest with AES-256 and in transit with TLS 1.3. Infrastructure hosted on AWS with managed key rotation.', badge: 'AES-256' },
              { icon: Database, title: 'Row-Level Isolation', desc: 'Every database query is scoped by Postgres RLS policies. Your data is cryptographically isolated from every other organization.', badge: 'RLS' },
              { icon: KeyRound, title: 'SSO & MFA', desc: 'TOTP-based multi-factor authentication. SAML 2.0 single sign-on with major identity providers planned.', badge: 'MFA' },
              { icon: ShieldCheck, title: 'HTTP Security Headers', desc: 'HSTS with preload, Content-Security-Policy, X-Frame-Options DENY, strict referrer policy, and permissions policy enforced on every response.', badge: 'HSTS' },
              { icon: Activity, title: 'Immutable Audit Trail', desc: 'Every login, data access, team change, and billing event logged with timestamp, user ID, and IP address. Exportable CSV for compliance.', badge: 'AUDIT' },
            ].map((s, i) => (
              <FadeIn key={s.title} delay={i * 100}>
                <div className="border border-border rounded-[18px] p-7 hover:border-cyan/20 transition-all group backdrop-blur-sm flex gap-5">
                  <div className="w-12 h-12 rounded-[14px] bg-cyan/[0.06] border border-cyan/[0.1] flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <s.icon size={22} className="text-cyan" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <h4 className="font-display font-bold text-[16px]">{s.title}</h4>
                      <span className="text-[10px] font-mono font-bold text-green bg-green/[0.06] border border-green/[0.1] px-2 py-0.5 rounded-full">{s.badge}</span>
                    </div>
                    <p className="text-[14px] text-t2 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link to="/security" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-semibold text-cyan border border-cyan/[0.12] bg-cyan/[0.04] hover:bg-cyan/[0.08] hover:-translate-y-px transition-all">
              View Trust Center →
            </Link>
          </div>
        </div>
      </section>

      {/* ════ INTEGRATIONS ════ */}
      <section id="integrations" className="py-20 px-6 border-y border-border">
        <FadeIn>
          <div className="max-w-4xl mx-auto text-center">
            <h3 className="font-display text-[36px] font-extrabold mb-3 tracking-tight">Connect everything</h3>
            <p className="text-t3 mb-4 text-[16px]">Thousands of banks via Plaid, plus direct integrations with leading accounting platforms.</p>
            <p className="text-[13px] text-t3 font-mono mb-12">Average connection time: <span className="text-cyan font-bold">47 seconds</span></p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              {INTEGRATIONS.map((name, i) => (
                <FadeIn key={name} delay={i * 40}>
                  <div className="px-5 py-2.5 rounded-full border border-border text-[14px] font-semibold text-t2 hover:border-cyan/40 hover:text-cyan hover:bg-cyan-glow transition-all cursor-default backdrop-blur-sm">{name}</div>
                </FadeIn>
              ))}
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ════ TESTIMONIALS ════ */}
      <section className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h3 className="font-display text-[36px] font-extrabold text-center mb-3 tracking-tight">Built for treasury teams that outgrew spreadsheets</h3>
            <p className="text-t3 text-center mb-16 text-[16px]">Every feature designed around real treasury workflows — not retrofitted from accounting software.</p>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <FadeIn key={t.name} delay={i * 120}>
                <div className="border border-border rounded-[18px] p-7 hover:border-cyan/20 transition-all group backdrop-blur-sm relative flex flex-col">
                  {/* Metric callout */}
                  <div className="mb-5 pb-4 border-b border-border">
                    <p className="font-mono text-[24px] font-black text-cyan">{t.metric}</p>
                    <p className="text-[11px] font-mono text-t3 uppercase tracking-wider mt-0.5">{t.metricLabel}</p>
                  </div>
                  <h4 className="text-[16px] font-bold mb-2">{t.title}</h4>
                  <p className="text-[15px] text-t2 leading-relaxed flex-1">{t.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CLIMATE ════ */}
      <section className="py-24 px-6 relative overflow-hidden">
        <FadeIn>
          <a href="https://climate.stripe.com/OeA2M0" target="_blank" rel="noopener noreferrer" className="block max-w-5xl mx-auto group">
            <div className="relative rounded-[24px] overflow-hidden cursor-pointer" style={{
              background: isDark ? 'linear-gradient(135deg, #041210 0%, #071a15 30%, #0a1f1a 60%, #040d0a 100%)' : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 30%, #a7f3d0 60%, #ecfdf5 100%)',
              border: `1px solid ${isDark ? 'rgba(52,211,153,0.12)' : 'rgba(5,150,105,0.15)'}`,
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(52,211,153,0.06)' : '0 20px 60px rgba(5,150,105,0.08), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}>
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                {[
                  { x: '15%', y: '20%', size: 220, color: isDark ? 'rgba(52,211,153,0.06)' : 'rgba(5,150,105,0.06)' },
                  { x: '70%', y: '60%', size: 180, color: isDark ? 'rgba(34,211,238,0.04)' : 'rgba(8,145,178,0.05)' },
                ].map((orb, i) => (
                  <div key={i} className="absolute rounded-full" style={{
                    left: orb.x, top: orb.y, width: orb.size, height: orb.size,
                    background: `radial-gradient(circle, ${orb.color} 0%, transparent 70%)`,
                    animation: `float${i + 1} ${8 + i * 2}s ease-in-out infinite`,
                  }} />
                ))}
              </div>
              <div className="relative px-10 py-12 flex items-center gap-12">
                <div className="shrink-0">
                  <div className="w-[100px] h-[100px] rounded-[24px] flex items-center justify-center" style={{
                    background: isDark ? 'linear-gradient(145deg, rgba(52,211,153,0.1) 0%, rgba(52,211,153,0.03) 100%)' : 'linear-gradient(145deg, rgba(5,150,105,0.1) 0%, rgba(5,150,105,0.03) 100%)',
                    border: `1px solid ${isDark ? 'rgba(52,211,153,0.15)' : 'rgba(5,150,105,0.12)'}`,
                  }}>
                    <Leaf size={40} strokeWidth={1.5} style={{ color: isDark ? '#34D399' : '#059669', transform: 'rotate(-12deg)' }} className="group-hover:scale-110 group-hover:rotate-0 transition-all duration-500" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-mono font-bold uppercase tracking-[0.12em] mb-2" style={{ color: isDark ? '#34D399' : '#059669' }}>CARBON-NEGATIVE TREASURY</p>
                  <h3 className="font-display text-[24px] font-extrabold tracking-tight leading-[1.2] mb-2" style={{ color: isDark ? '#F1F5F9' : '#0F172A' }}>
                    Your subscription removes CO2 from the atmosphere.
                  </h3>
                  <p className="text-[14px] leading-relaxed max-w-lg" style={{ color: isDark ? '#94A3B8' : '#475569' }}>
                    1% of Vaultline revenue funds direct air capture and geological sequestration via Stripe Climate.
                  </p>
                </div>
                <div className="shrink-0">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all" style={{
                    background: isDark ? 'rgba(52,211,153,0.08)' : 'rgba(5,150,105,0.06)',
                    border: `1px solid ${isDark ? 'rgba(52,211,153,0.15)' : 'rgba(5,150,105,0.12)'}`,
                  }}>
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" style={{ color: isDark ? '#34D399' : '#059669' }} />
                  </div>
                </div>
              </div>
            </div>
          </a>
        </FadeIn>
      </section>

      {/* ════ PRICING ════ */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <FadeIn>
            <h3 className="font-display text-[36px] font-extrabold text-center mb-3 tracking-tight">Simple, transparent pricing</h3>
            <p className="text-t3 text-center mb-2 text-[16px]">30-day money-back guarantee on all plans. Cancel anytime.</p>
            <p className="text-[13px] text-center text-cyan font-mono mb-8">No long-term contracts or penalties</p>
            <div className="flex items-center justify-center gap-3.5 mb-14">
              <span className={`text-sm font-medium ${!annualPricing ? 'text-t1' : 'text-t3'}`}>Monthly</span>
              <button onClick={() => setAnnualPricing(!annualPricing)} className={`w-[52px] h-7 rounded-full relative transition-colors ${annualPricing ? 'bg-cyan' : 'bg-surface border border-border'}`}>
                <span className={`absolute top-[3px] left-[3px] w-5 h-5 rounded-full bg-white shadow transition-transform ${annualPricing ? 'translate-x-6' : ''}`} />
              </button>
              <span className={`text-sm font-medium ${annualPricing ? 'text-t1' : 'text-t3'}`}>Annual</span>
              <span className="text-[13px] font-semibold text-green bg-green-soft px-2.5 py-1 rounded-full">Save 20%</span>
            </div>
          </FadeIn>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {PLANS.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 120}>
                <div className={`border rounded-[18px] p-8 flex flex-col relative backdrop-blur-sm transition-all hover:-translate-y-1 active:scale-[0.98] ${plan.popular ? 'border-cyan/50 shadow-[0_0_30px_rgba(34,211,238,0.15)]' : 'border-border hover:border-border'}`}>
                  {plan.popular && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan to-purple text-void text-[12px] font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">Most Popular</span>
                  )}
                  <h4 className="font-display text-xl font-bold">{plan.name}</h4>
                  <div className="mt-3 mb-1">
                    {plan.talkToSales ? (
                      <span className="font-display text-[28px] font-extrabold">Let's Talk</span>
                    ) : (
                      <><span className="font-display text-[40px] font-extrabold">{annualPricing ? plan.annual : plan.price}</span>
                      <span className="text-t2 text-[14px]">/mo</span></>
                    )}
                  </div>
                  <p className="text-[13px] text-t2 mb-6">{plan.desc}</p>
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2.5 text-[14px] text-t2">
                        <div className="w-[18px] h-[18px] rounded-full bg-cyan-glow flex items-center justify-center shrink-0"><Check size={10} className="text-cyan" /></div>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.talkToSales ? (
                    <a href="mailto:sales@vaultline.app" className="block w-full py-3.5 rounded-[12px] text-center text-[15px] font-semibold border border-border text-t2 hover:border-cyan/40 hover:text-cyan transition-all">Talk to Sales</a>
                  ) : (
                    <Link to="/signup" className={`block w-full py-3.5 rounded-[12px] text-center text-[15px] font-semibold transition-all ${plan.popular
                      ? 'bg-gradient-to-r from-cyan to-sky-400 text-void shadow-[0_2px_16px_rgba(34,211,238,0.25)] hover:-translate-y-px active:scale-[0.98]'
                      : 'border border-border text-t2 hover:border-cyan/40 hover:text-cyan'
                    }`}>Get Started</Link>
                  )}
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ════ CTA ════ */}
      <section className="py-24 px-6">
        <FadeIn>
          <div className="max-w-3xl mx-auto text-center relative">
            <div className="absolute -inset-8 bg-gradient-to-r from-cyan/10 via-purple/10 to-cyan/10 rounded-[30px] blur-3xl" />
            <div className="relative p-[1px] rounded-[22px] overflow-hidden" style={{ background: 'conic-gradient(from 0deg, #22D3EE, #818CF8, #22D3EE, #818CF8, #22D3EE)' }}>
              <div className="bg-deep/90 backdrop-blur-xl rounded-[inherit] py-20 px-12">
                <h3 className="font-display text-[32px] font-extrabold mb-4 tracking-tight">Stop managing treasury in spreadsheets</h3>
                <p className="text-t3 mb-10 max-w-lg mx-auto text-[16px] leading-relaxed">
                  Replace manual spreadsheet reconciliation with real-time cash visibility, AI-powered forecasting, and automated reporting.
                </p>
                <Link to="/signup" className="group inline-flex items-center gap-2.5 px-10 py-4 rounded-[14px] bg-gradient-to-r from-cyan to-sky-400 text-void text-[16px] font-bold shadow-[0_4px_32px_rgba(34,211,238,0.35)] hover:-translate-y-1 active:scale-[0.98] hover:shadow-[0_8px_48px_rgba(34,211,238,0.45)] transition-all">
                  Get Started Today <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <p className="text-[13px] text-t2 mt-5">30-day money-back guarantee · Cancel anytime · No long-term contracts</p>
              </div>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* ════ FOOTER ════ */}
      {/* ════ SUITE / ECOSYSTEM ════ */}
      <section className="py-20 px-6" id="suite">
        <FadeIn>
          <div className="max-w-5xl mx-auto text-center">
            <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-purple">THE VAULTLINE SUITE</span>
            <h2 className="font-display text-3xl font-black tracking-tight mt-3 mb-4">The Only Unified Treasury + FP&A + Compliance Platform</h2>
            <p className="text-t3 max-w-2xl mx-auto text-[15px] mb-4">No other mid-market solution bundles treasury management, financial planning, and supplier compliance in one subscription. Stop paying three vendors for what should be one platform.</p>
            
            {/* Bundle savings callout */}
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-2xl bg-purple/[0.04] border border-purple/[0.12] mb-12">
              <Sparkles size={16} className="text-purple" />
              <span className="text-[14px] font-semibold text-t1">Suite Bundle: <span className="font-mono text-purple">$2,799/mo</span></span>
              <span className="text-[12px] text-t3">Save $499/mo vs separate plans</span>
              <span className="text-[10px] font-mono text-green bg-green/[0.06] border border-green/[0.08] px-2 py-0.5 rounded">15% OFF</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
              {/* Vaultline — Active */}
              <div className="glass rounded-2xl p-6 text-left border border-cyan/[0.15] shadow-[0_0_24px_rgba(34,211,238,0.06)] transition-all">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-cyan/[0.12] text-cyan bg-cyan/[0.04]">TREASURY</span>
                  <span className="text-[9px] font-mono text-green bg-green/[0.06] border border-green/[0.08] px-2 py-0.5 rounded">ACTIVE</span>
                </div>
                <h3 className="font-display text-[18px] font-bold mb-1">Vaultline</h3>
                <p className="text-[12px] font-mono text-t3 mb-3">from $499/mo</p>
                <p className="text-[13px] text-t3 leading-relaxed mb-3">Treasury management. Real-time cash visibility, AI forecasting, multi-currency, bank integrations.</p>
                <div className="space-y-1.5 mb-4">
                  {['Cash position dashboard', 'AI forecast (3 models)', 'Multi-currency FX', 'AP/AR tracking', 'Bank & ERP sync'].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <Check size={12} className="text-cyan flex-shrink-0" />
                      <span className="text-[12px] text-t2">{f}</span>
                    </div>
                  ))}
                </div>
                <Link to="/dashboard" className="text-[13px] font-semibold text-cyan flex items-center gap-1 transition-all">Go to Dashboard &rarr;</Link>
              </div>

              {/* FinanceOS */}
              <Link to="/products/financeos" className="glass rounded-2xl p-6 text-left border border-border hover:border-blue-400/[0.2] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(96,165,250,0.08)] transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-border text-t2 group-hover:border-blue-400/[0.12] group-hover:text-blue-400 group-hover:bg-blue-400/[0.04] transition-all">FP&A</span>
                  <span className="text-[9px] font-mono text-purple bg-purple/[0.06] border border-purple/[0.08] px-2 py-0.5 rounded">LIVE DEMO</span>
                </div>
                <h3 className="font-display text-[18px] font-bold mb-1">FinanceOS</h3>
                <p className="text-[12px] font-mono text-t3 mb-3">included in Suite</p>
                <p className="text-[13px] text-t3 leading-relaxed mb-3">Cloud FP&A. Planning, budgeting, consolidation, variance analysis, and AI-powered modeling.</p>
                <div className="space-y-1.5 mb-4">
                  {['Budget vs actuals', 'Multi-entity consolidation', 'Variance detective', 'Scenario modeling', 'Board reporting'].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <Check size={12} className="text-blue-400 flex-shrink-0" />
                      <span className="text-[12px] text-t2">{f}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[13px] font-semibold text-blue-400 flex items-center gap-1 group-hover:gap-2 transition-all">
                  Try Interactive Demo <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>

              {/* Parallax */}
              <Link to="/products/parallax" className="glass rounded-2xl p-6 text-left border border-border hover:border-amber/[0.2] hover:-translate-y-1 hover:shadow-[0_8px_32px_rgba(251,191,36,0.06)] transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-border text-t2 group-hover:border-amber/[0.12] group-hover:text-amber group-hover:bg-amber/[0.04] transition-all">COMPLIANCE</span>
                  <span className="text-[9px] font-mono text-purple bg-purple/[0.06] border border-purple/[0.08] px-2 py-0.5 rounded">LIVE DEMO</span>
                </div>
                <h3 className="font-display text-[18px] font-bold mb-1">Parallax</h3>
                <p className="text-[12px] font-mono text-t3 mb-3">included in Suite</p>
                <p className="text-[13px] text-t3 leading-relaxed mb-3">Aerospace supplier compliance. Questionnaires, CAPA tracking, audit readiness, training matrix.</p>
                <div className="space-y-1.5 mb-4">
                  {['AS9100 / CMMC frameworks', 'Questionnaire management', 'CAPA lifecycle', 'Audit calendar', 'Training matrix'].map(f => (
                    <div key={f} className="flex items-center gap-2">
                      <Check size={12} className="text-amber flex-shrink-0" />
                      <span className="text-[12px] text-t2">{f}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[13px] font-semibold text-amber flex items-center gap-1 group-hover:gap-2 transition-all">
                  Try Interactive Demo <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </Link>
            </div>

            {/* Bundle CTA */}
            <FadeIn delay={200}>
              <div className="glass rounded-2xl p-8 border border-purple/[0.12] bg-gradient-to-br from-purple/[0.02] to-cyan/[0.02] text-left max-w-3xl mx-auto">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-purple/[0.12] text-purple bg-purple/[0.04]">SUITE BUNDLE</span>
                      <span className="text-[10px] font-mono text-green bg-green/[0.06] border border-green/[0.08] px-2 py-0.5 rounded">SAVE 15%</span>
                    </div>
                    <h3 className="font-display text-[22px] font-bold mb-2">All three products. One subscription.</h3>
                    <p className="text-[14px] text-t3 leading-relaxed max-w-md mb-4">Unified treasury management, financial planning, and supplier compliance with shared SSO, consolidated billing, and cross-product data flows.</p>
                    <div className="flex items-center gap-6 text-[13px] text-t2">
                      <div className="flex items-center gap-1.5"><Check size={14} className="text-green" /> Single sign-on</div>
                      <div className="flex items-center gap-1.5"><Check size={14} className="text-green" /> Consolidated billing</div>
                      <div className="flex items-center gap-1.5"><Check size={14} className="text-green" /> Cross-product insights</div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-8">
                    <div className="font-mono text-[28px] font-black text-t1 tracking-tight">$2,799<span className="text-[14px] text-t3 font-normal">/mo</span></div>
                    <div className="text-[12px] text-t3 font-mono">or $2,239/mo billed annually</div>
                    <a href="mailto:sales@vaultline.app?subject=Suite%20Bundle%20Inquiry" className="mt-3 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple text-white font-semibold text-[13px] hover:bg-purple/90 transition-all shadow-lg shadow-purple/20">
                      Contact Sales <ArrowRight size={14} />
                    </a>
                  </div>
                </div>
              </div>
            </FadeIn>
          </div>
        </FadeIn>
      </section>

      <footer className="border-t border-border py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-start justify-between mb-10">
            <div>
              <h1 className="font-display text-xl font-black tracking-tight mb-2">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></h1>
              <p className="text-[13px] text-t2 max-w-xs leading-relaxed mb-4">Modern treasury management for mid-market finance teams. Real-time visibility, AI-powered insights, and bank-grade security.</p>
              {/* Compliance badges in footer */}
              <div className="flex items-center gap-3">
                {['SOC 2 Ready', 'AES-256', 'SAML SSO'].map(b => (
                  <span key={b} className="text-[10px] font-mono text-t3 border border-border rounded px-2 py-0.5">{b}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-16">
              <div>
                <p className="text-[12px] text-t3 font-mono uppercase tracking-wider mb-3">PRODUCT</p>
                <div className="flex flex-col gap-2">
                  <a href="#features" className="text-[14px] text-t2 hover:text-t1 transition">Features</a>
                  <Link to="/security" className="text-[14px] text-t2 hover:text-t1 transition">Security</Link>
                  <a href="#pricing" className="text-[14px] text-t2 hover:text-t1 transition">Pricing</a>
                  <a href="#integrations" className="text-[14px] text-t2 hover:text-t1 transition">Integrations</a>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-t3 font-mono uppercase tracking-wider mb-3">SUITE</p>
                <div className="flex flex-col gap-2">
                  <Link to="/products/financeos" className="text-[14px] text-t2 hover:text-blue-400 transition">FinanceOS</Link>
                  <Link to="/products/parallax" className="text-[14px] text-t2 hover:text-amber transition">Parallax</Link>
                  <a href="mailto:sales@vaultline.app?subject=Suite Bundle Inquiry" className="text-[14px] text-t2 hover:text-purple transition">Bundle Pricing</a>
                  <a href="#suite" className="text-[14px] text-t2 hover:text-purple transition">Why the Suite</a>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-t3 font-mono uppercase tracking-wider mb-3">RESOURCES</p>
                <div className="flex flex-col gap-2">
                  <Link to="/roi" className="text-[14px] text-t2 hover:text-cyan transition">ROI Calculator</Link>
                  <Link to="/assess" className="text-[14px] text-t2 hover:text-purple transition">Treasury Assessment</Link>
                  <Link to="/benchmark" className="text-[14px] text-t2 hover:text-purple transition">Treasury Benchmark</Link>
                  <Link to="/burn-simulator" className="text-[14px] text-t2 hover:text-amber transition">Burn Rate Simulator</Link>
                  <Link to="/docs" className="text-[14px] text-t2 hover:text-t1 transition">API Docs</Link>
                  <a href="mailto:support@vaultline.app" className="text-[14px] text-t2 hover:text-t1 transition">Support</a>
                  <a href="mailto:sales@vaultline.app" className="text-[14px] text-t2 hover:text-t1 transition">Contact Sales</a>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-t3 font-mono uppercase tracking-wider mb-3">LEGAL</p>
                <div className="flex flex-col gap-2">
                  <Link to="/privacy" className="text-[14px] text-t2 hover:text-t1 transition">Privacy Policy</Link>
                  <Link to="/terms" className="text-[14px] text-t2 hover:text-t1 transition">Terms of Service</Link>
                  <Link to="/legal" className="text-[14px] text-t2 hover:text-t1 transition">Legal & Privacy Center</Link>
                  <Link to="/legal#dnsspi" onClick={() => {}} className="text-[14px] text-t2 hover:text-amber transition">Do Not Sell or Share</Link>
                </div>
              </div>
              <div>
                <p className="text-[12px] text-t3 font-mono uppercase tracking-wider mb-3">ACCOUNT</p>
                <div className="flex flex-col gap-2">
                  <Link to="/login" className="text-[14px] text-t2 hover:text-t1 transition">Sign In</Link>
                  <Link to="/signup" className="text-[14px] text-t2 hover:text-cyan active:text-cyan transition">Get Started</Link>
                </div>
              </div>
            </div>
          </div>
          <div className="h-px bg-border/30 mb-6" />
          <div className="flex items-center justify-between">
            <p className="text-[13px] text-t3">&copy; 2026 Vaultline. All rights reserved.</p>
            <a href="https://climate.stripe.com/OeA2M0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[12px] text-t3 hover:text-green transition">
              <Leaf size={12} className="text-green" /><span>1% to carbon removal via Stripe Climate</span>
            </a>
          </div>
        </div>
      </footer>

      {/* Return-to-dashboard pill */}
      {user && (
        <Link to="/dashboard" className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full glass border border-cyan/[0.15] shadow-[0_8px_32px_rgba(0,0,0,0.4)] hover:shadow-[0_8px_40px_rgba(34,211,238,0.15)] hover:-translate-y-0.5 active:scale-[0.98] transition-all group animate-slideUp stagger-3">
          <span className="w-2 h-2 rounded-full bg-green animate-[pulse_3s_ease-in-out_infinite]" />
          <span className="text-[13px] font-medium text-t2 group-hover:text-cyan active:text-cyan transition">Return to Dashboard</span>
          <ArrowRight size={13} className="text-t3 group-hover:text-cyan group-hover:translate-x-0.5 transition-all" />
        </Link>
      )}
    </div>
  )
}
