import AnimatedBackground from "@/components/AnimatedBackground"
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSEO } from '@/hooks/useSEO'
import { useTheme } from '@/hooks/useTheme'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Plug, RefreshCw, Layers, Brain, Shield, LayoutDashboard,
  ArrowRight, Lock, Eye, ChevronDown, ChevronRight, Database,
  Zap, BarChart3, AlertTriangle, FileText, Clock, CheckCircle2
} from 'lucide-react'

const STAGES = [
  {
    num: '01', title: 'Connect your banks', subtitle: 'One-time setup, under 60 seconds',
    icon: Plug, color: 'cyan',
    flow: [
      { label: 'Customer clicks "Connect bank"', type: 'input' },
      { label: 'Secure bank login modal', type: 'process' },
      { label: 'Token exchange + encryption', type: 'secure' },
      { label: 'Connection stored', type: 'output' },
    ],
    detail: 'You select your bank and log in through a secure modal — Vaultline never sees your bank username or password. We receive an encrypted access token that lets us read balances and transactions. The token is encrypted at rest using field-level encryption before it touches our database.',
    tables: ['bank_connections', 'accounts', 'audit_log'],
    customerSees: 'A green checkmark and your bank appearing in the sidebar with a real logo.',
    problemSolved: 'No more logging into 3-5 separate bank portals every morning.',
  },
  {
    num: '02', title: 'Automatic data sync', subtitle: 'Runs every 4 hours, zero effort',
    icon: RefreshCw, color: 'green',
    flow: [
      { label: 'Scheduled sync trigger', type: 'process' },
      { label: 'Pull latest balances', type: 'input' },
      { label: 'Pull new transactions', type: 'input' },
      { label: 'Daily balance snapshot', type: 'output' },
    ],
    detail: 'Every 4 hours, Vaultline securely retrieves your latest account balances and any new transactions. Each balance is stamped as a daily snapshot — this time-series data is what powers your charts, forecasts, and trend analysis. If a bank connection needs re-authentication, you get an alert immediately.',
    tables: ['accounts', 'transactions', 'daily_balances'],
    customerSees: '"Last synced: 12 min ago" on your dashboard. Balances that match what you see in your bank portal.',
    problemSolved: 'No more copying balances into spreadsheets. Data stays current automatically.',
  },
  {
    num: '03', title: 'Smart categorization', subtitle: 'Every transaction gets context',
    icon: Layers, color: 'purple',
    flow: [
      { label: 'Raw bank transactions', type: 'input' },
      { label: 'Category classification', type: 'process' },
      { label: 'Inflow / outflow tagging', type: 'process' },
      { label: 'Clean, queryable dataset', type: 'output' },
    ],
    detail: 'Raw bank data is messy — transaction names are inconsistent, amounts need directionality, and multi-entity companies need each transaction assigned to the right subsidiary. Vaultline normalizes everything: revenue vs expense, category assignment (payroll, SaaS, transfer, revenue), and entity mapping. The result is a clean dataset you can filter, search, and report on.',
    tables: ['transactions (categorized)', 'accounts (with totals)'],
    customerSees: 'A searchable transaction table with categories, filters by type, and color-coded inflows/outflows.',
    problemSolved: 'No more manually tagging transactions in Excel. Spend categories are assigned automatically.',
  },
  {
    num: '04', title: 'AI-powered forecasting', subtitle: 'Three models compete for accuracy',
    icon: Brain, color: 'amber',
    flow: [
      { label: '30-90 days of balance history', type: 'input' },
      { label: 'Linear regression', type: 'process' },
      { label: 'Exponential moving average', type: 'process' },
      { label: 'Monte Carlo simulation (500 paths)', type: 'process' },
    ],
    detail: 'Three forecasting models run on your historical data simultaneously. Linear regression finds the straight-line trend. EMA-14 weights recent data heavier. Monte Carlo runs 500 random simulations to produce confidence bands (p10/p50/p90). Each model is backtested against the last 14 days — the one with the lowest error rate becomes your default forecast. You can switch between all three.',
    tables: ['forecasts', 'daily_balances (input)'],
    customerSees: 'A chart showing where your cash is headed for the next 30, 60, or 90 days — with confidence bands showing best and worst case scenarios.',
    problemSolved: 'No more guessing when you\'ll run out of cash. The forecast auto-selects the most accurate model for your specific cash flow pattern.',
  },
  {
    num: '05', title: 'Security monitoring', subtitle: 'Always watching, always logging',
    icon: Shield, color: 'red',
    flow: [
      { label: 'Every user action', type: 'input' },
      { label: 'Immutable audit trail', type: 'secure' },
      { label: '6-point anomaly scan', type: 'process' },
      { label: 'Alerts on threats', type: 'output' },
    ],
    detail: 'Every login, data access, export, and permission change is logged with timestamp, user ID, IP address, and device fingerprint. The anomaly scanner checks six patterns continuously: transaction velocity spikes, balance anomalies, after-hours access, brute force attempts, data exfiltration, and session hijacking. If anything triggers, the admin gets an alert and the event is flagged for review.',
    tables: ['audit_log', 'security_events', 'alerts'],
    customerSees: 'A security center showing your compliance posture, recent security events, and a one-click SOC 2 evidence report.',
    problemSolved: 'No more wondering who accessed what and when. Complete audit trail for compliance.',
  },
  {
    num: '06', title: 'Your dashboard', subtitle: 'Everything in one view',
    icon: LayoutDashboard, color: 'cyan',
    flow: [
      { label: 'Total cash position', type: 'output' },
      { label: 'Inflow/outflow chart', type: 'output' },
      { label: 'Forecast + runway', type: 'output' },
      { label: 'Alerts + bank status', type: 'output' },
    ],
    detail: 'One screen replaces your entire morning routine. Total cash across all banks at the top. Bar chart showing daily inflows and outflows with a net flow line. Account cards with real bank logos and masked balances. Top spend categories ranked by amount. Forecast projection. Active alerts. Last sync timestamp. Everything is live, everything is secure.',
    tables: ['All tables consolidated'],
    customerSees: 'A single dashboard that tells you exactly where your cash is, where it\'s going, and whether you need to act.',
    problemSolved: 'No more 4-6 hours per week on treasury operations. Open the dashboard, see everything, make decisions.',
  },
]

const COLOR_MAP = {
  cyan: { bg: 'bg-cyan-glow', text: 'text-cyan', border: 'border-cyan/20', accent: 'bg-cyan' },
  green: { bg: 'bg-green-soft', text: 'text-green', border: 'border-green/20', accent: 'bg-green' },
  purple: { bg: 'bg-purple-soft', text: 'text-purple', border: 'border-purple/20', accent: 'bg-purple' },
  amber: { bg: 'bg-amber-soft', text: 'text-amber', border: 'border-amber/20', accent: 'bg-amber' },
  red: { bg: 'bg-red-soft', text: 'text-red', border: 'border-red/20', accent: 'bg-red' },
}

function FlowPill({ label, type }) {
  const styles = {
    input: 'border-cyan/15 text-cyan',
    process: 'border-amber/15 text-amber',
    output: 'border-green/15 text-green',
    secure: 'border-red/15 text-red',
  }
  return <span className={`text-[11px] font-mono px-2 py-1 rounded-md border ${styles[type] || 'border-border text-t3'} bg-surface`}>{label}</span>
}

export default function HowItWorks() {
  const [active, setActive] = useState(0)
  const { isDark } = useTheme()
  useSEO({
    title: 'How Vaultline works — from bank connection to cash intelligence',
    description: 'See how Vaultline transforms raw bank data into real-time cash visibility, AI forecasting, and compliance-ready audit trails. Product tour for finance teams.',
    canonical: '/how-it-works',
  })

  const stage = STAGES[active]
  const Icon = stage.icon
  const clr = COLOR_MAP[stage.color]

  return (
    <div className="min-h-screen bg-void text-t1">
      <AnimatedBackground variant="particles" />
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border bg-deep/95 backdrop-blur-lg">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-display text-xl font-black tracking-tight">
            Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
          </Link>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login" className="text-[13px] text-t3 hover:text-t1 transition">Log in</Link>
            <Link to="/signup" className="px-4 py-2 rounded-lg bg-cyan text-void text-[13px] font-semibold hover:bg-cyan-bright transition">Start free trial</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 pt-28 pb-20">
        {/* Hero */}
        <div className="text-center mb-14">
          <p className="text-cyan text-[12px] font-mono uppercase tracking-widest mb-3">How it works</p>
          <h1 className="font-display text-3xl sm:text-4xl font-black mb-4 leading-tight">
            From bank connection to<br />crystal-clear cash intelligence
          </h1>
          <p className="text-t3 text-[15px] max-w-2xl mx-auto leading-relaxed">
            Vaultline connects to your bank accounts, syncs your data automatically, categorizes every transaction,
            runs three AI forecasting models, monitors security continuously — and presents it all on a single dashboard.
          </p>
        </div>

        {/* Before/After */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-14">
          <div className="glass-card rounded-xl p-5 border-l-[3px] border-l-red" style={{ borderRadius: 0 }}>
            <p className="text-[11px] font-mono uppercase tracking-wider text-red mb-2">Before Vaultline</p>
            <div className="space-y-2 text-[13px] text-t2">
              <p className="flex items-start gap-2"><Clock size={14} className="text-t4 mt-0.5 shrink-0" /> Log into 3-5 bank portals every morning</p>
              <p className="flex items-start gap-2"><FileText size={14} className="text-t4 mt-0.5 shrink-0" /> Copy balances into spreadsheets manually</p>
              <p className="flex items-start gap-2"><BarChart3 size={14} className="text-t4 mt-0.5 shrink-0" /> Build forecasts in Excel with stale data</p>
              <p className="flex items-start gap-2"><AlertTriangle size={14} className="text-t4 mt-0.5 shrink-0" /> No audit trail, no security monitoring</p>
            </div>
            <p className="text-[12px] font-semibold text-red mt-3">4-6 hours per week</p>
          </div>
          <div className="glass-card rounded-xl p-5 border-l-[3px] border-l-green" style={{ borderRadius: 0 }}>
            <p className="text-[11px] font-mono uppercase tracking-wider text-green mb-2">With Vaultline</p>
            <div className="space-y-2 text-[13px] text-t2">
              <p className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green mt-0.5 shrink-0" /> All banks on one dashboard, synced automatically</p>
              <p className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green mt-0.5 shrink-0" /> Transactions categorized and entity-mapped</p>
              <p className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green mt-0.5 shrink-0" /> AI forecast picks the most accurate model</p>
              <p className="flex items-start gap-2"><CheckCircle2 size={14} className="text-green mt-0.5 shrink-0" /> SOC 2-ready audit trail on every action</p>
            </div>
            <p className="text-[12px] font-semibold text-green mt-3">10 seconds to full visibility</p>
          </div>
        </div>

        {/* Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
          {/* Stage selector */}
          <div className="space-y-1.5">
            {STAGES.map((s, i) => {
              const SIcon = s.icon
              const isActive = i === active
              const c = COLOR_MAP[s.color]
              return (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  className={`w-full text-left p-3 rounded-xl border transition-all group ${isActive ? `${c.border} border-l-[3px] bg-surface` : 'border-transparent hover:bg-deep'}`}
                  style={isActive ? { borderLeftColor: 'var(--color-' + s.color + ')', borderRadius: 0 } : { borderRadius: 0 }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-mono font-semibold ${isActive ? c.bg + ' ' + c.text : 'bg-deep text-t4'}`}>
                      {s.num}
                    </div>
                    <div>
                      <p className={`text-[13px] font-semibold ${isActive ? 'text-t1' : 'text-t2'}`}>{s.title}</p>
                      <p className="text-[10px] text-t4">{s.subtitle}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Stage detail */}
          <div className="glass-card rounded-xl p-6 border border-border">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-10 h-10 rounded-xl ${clr.bg} flex items-center justify-center`}>
                <Icon size={20} className={clr.text} />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold">{stage.title}</h2>
                <p className="text-[12px] text-t3">{stage.subtitle}</p>
              </div>
            </div>

            {/* Data flow */}
            <div className="flex flex-wrap items-center gap-2 mb-5 pb-5 border-b border-border">
              {stage.flow.map((f, i) => (
                <span key={i} className="flex items-center gap-2">
                  <FlowPill label={f.label} type={f.type} />
                  {i < stage.flow.length - 1 && <ArrowRight size={12} className="text-t4 shrink-0" />}
                </span>
              ))}
            </div>

            {/* What happens */}
            <div className="mb-5">
              <p className="text-[11px] font-mono uppercase tracking-wider text-t4 mb-2">What happens</p>
              <p className="text-[13px] text-t2 leading-relaxed">{stage.detail}</p>
            </div>

            {/* What customer sees */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
              <div className="p-3 rounded-lg bg-deep border border-border">
                <p className="text-[10px] font-mono uppercase tracking-wider text-cyan mb-1.5">
                  <Eye size={10} className="inline mr-1" />What you see
                </p>
                <p className="text-[12px] text-t2 leading-relaxed">{stage.customerSees}</p>
              </div>
              <div className="p-3 rounded-lg bg-deep border border-border">
                <p className="text-[10px] font-mono uppercase tracking-wider text-green mb-1.5">
                  <Zap size={10} className="inline mr-1" />Problem solved
                </p>
                <p className="text-[12px] text-t2 leading-relaxed">{stage.problemSolved}</p>
              </div>
            </div>

            {/* Tables */}
            <div className="flex items-center gap-2 flex-wrap">
              <Database size={11} className="text-t4" />
              <span className="text-[10px] text-t4">Data:</span>
              {stage.tables.map(t => (
                <span key={t} className="text-[9px] font-mono px-2 py-0.5 rounded bg-deep border border-border text-t3">{t}</span>
              ))}
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-14 mb-4">
          <h3 className="font-display text-xl font-bold mb-3">Ready to see your cash position clearly?</h3>
          <p className="text-t3 text-[14px] mb-6 max-w-lg mx-auto">Connect your first bank account in under 60 seconds. Start your 14-day free trial today.</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/signup" className="px-6 py-3 rounded-xl bg-cyan text-void text-[14px] font-bold hover:bg-cyan-bright hover:-translate-y-px active:scale-[0.97] transition-all">
              Start free trial
            </Link>
            <Link to="/" className="px-6 py-3 rounded-xl border border-border text-[14px] font-semibold text-t2 hover:text-t1 hover:border-border-hover transition-all">
              Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
