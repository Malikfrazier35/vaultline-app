import AnimatedBackground from "@/components/AnimatedBackground"
import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import ThemeToggle from '@/components/ThemeToggle'
import {
  BarChart3, ArrowRight, Check, Loader2, Zap, TrendingUp,
  Clock, Users, DollarSign, Target, AlertTriangle, ChevronRight, Shield
} from 'lucide-react'

const METRICS = [
  { id: 'reconciliation_hours', label: 'Weekly reconciliation hours', min: 0, max: 40, step: 1, default: 12, format: v => `${v}h`, icon: Clock },
  { id: 'bank_connections', label: 'Bank accounts managed', min: 1, max: 30, step: 1, default: 4, format: v => v, icon: Shield },
  { id: 'forecast_accuracy', label: 'Forecast accuracy (%)', min: 0, max: 100, step: 1, default: 60, format: v => `${v}%`, icon: Target },
  { id: 'cash_visibility_delay', label: 'Cash visibility delay (hours)', min: 0, max: 72, step: 1, default: 24, format: v => `${v}h`, icon: Clock },
  { id: 'manual_processes_pct', label: 'Manual process reliance (%)', min: 0, max: 100, step: 1, default: 50, format: v => `${v}%`, icon: AlertTriangle },
  { id: 'error_rate', label: 'Spreadsheet error rate (%)', min: 0, max: 15, step: 0.1, default: 3.8, format: v => `${v}%`, icon: AlertTriangle },
  { id: 'team_size', label: 'Treasury team size', min: 1, max: 20, step: 1, default: 3, format: v => v, icon: Users },
  { id: 'monthly_burn', label: 'Monthly burn rate ($)', min: 10000, max: 5000000, step: 10000, default: 250000, format: v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`, icon: DollarSign },
]

const RATING_COLORS = { excellent: 'text-green', good: 'text-cyan', below_average: 'text-amber', needs_improvement: 'text-red' }
const RATING_LABELS = { excellent: 'Excellent', good: 'Good', below_average: 'Below Average', needs_improvement: 'Needs Work' }

export default function Benchmark() {
  const [inputs, setInputs] = useState(Object.fromEntries(METRICS.map(m => [m.id, m.default])))
  const [step, setStep] = useState('input') // input | capture | results
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [results, setResults] = useState(null)

  useSEO({ title: 'Treasury Benchmark 2014 Compare Your Operations', description: 'Benchmark your treasury operations against industry peers. See how your cash management, forecasting, and controls stack up.', canonical: '/benchmark' })

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const { data } = await safeInvoke('tools', { action: 'benchmark', inputs })
      // Capture lead
      if (email) {
        const params = new URLSearchParams(window.location.search)
        await safeInvoke('lead-capture', {
          body: { action: 'capture', email, company_name: company, source: 'benchmark', roi_inputs: inputs, utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), page_url: window.location.href },
        })
      }
      setResults(data)
      setStep('results')
    } catch (err) { console.error(err) }
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen bg-void">
      <AnimatedBackground variant="contours" />
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[800px] h-[800px] top-[-300px] left-[-200px] bg-[radial-gradient(circle,rgba(139,92,246,0.05)_0%,transparent_60%)] pointer-events-none" />

      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Vaultline" className="w-8 h-8 rounded-lg" />
          <span className="font-display text-lg font-extrabold">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/roi" className="text-[13px] text-t2 hover:text-cyan transition">ROI Calculator</Link>
          <Link to="/signup" className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px transition-all">Get Started</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="text-center mb-10 pt-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-purple">TREASURY BENCHMARK</span>
          <h1 className="font-display text-4xl font-black tracking-tight mt-3 mb-3">How does your treasury stack up?</h1>
          <p className="text-[16px] text-t3 max-w-2xl mx-auto">Enter your metrics. Compare against industry medians and see where you lead — and where you're losing ground.</p>
        </div>

        {step === 'input' && (
          <div className="grid grid-cols-1 lg:grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-8 space-y-5">
              <h2 className="font-display text-lg font-bold flex items-center gap-2"><BarChart3 size={18} className="text-purple" /> Your Treasury Metrics</h2>
              {METRICS.map(m => {
                const Icon = m.icon; const val = inputs[m.id]; const pct = ((val - m.min) / (m.max - m.min)) * 100
                return (
                  <div key={m.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2"><Icon size={13} className="text-t3" /><span className="text-[12px] text-t2">{m.label}</span></div>
                      <span className="font-mono text-[14px] font-bold text-purple terminal-data">{m.format(val)}</span>
                    </div>
                    <input type="range" min={m.min} max={m.max} step={m.step} value={val}
                      onChange={e => setInputs(p => ({ ...p, [m.id]: parseFloat(e.target.value) }))}
                      className="w-full h-[4px] rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #8B5CF6 ${pct}%, rgba(148,163,184,0.15) ${pct}%)` }} />
                  </div>
                )
              })}
            </div>

            <div className="space-y-4">
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-[13px] font-bold text-t2 mb-3">Get Your Benchmark Report</h3>
                <form onSubmit={e => { e.preventDefault(); setStep('capture') }} className="space-y-3">
                  <input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="Work email" required
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-purple/40 transition placeholder:text-t3" />
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name (optional)"
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-purple/40 transition placeholder:text-t3" />
                  <button type="submit" className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple/90 to-purple/70 text-void font-semibold text-[15px] shadow-[0_2px_12px_rgba(139,92,246,0.2)] hover:-translate-y-px transition-all flex items-center justify-center gap-2">
                    <BarChart3 size={15} /> Compare Against Industry
                  </button>
                </form>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <p className="text-[11px] text-t3">Based on data from 500+ mid-market treasury operations</p>
              </div>
            </div>
          </div>
        )}

        {step === 'capture' && (
          <div className="max-w-lg mx-auto">
            <div className="glass-card rounded-2xl p-8 text-center">
              <Loader2 size={28} className="text-purple mx-auto mb-4 animate-spin" />
              <h2 className="font-display text-xl font-bold mb-2">Analyzing your metrics...</h2>
              <p className="text-[14px] text-t3 mb-4">Comparing against industry benchmarks across 8 dimensions.</p>
              {/* Auto-submit on mount */}
              <form onSubmit={handleSubmit} ref={el => { if (el && !submitting && !results) el.requestSubmit?.() }}>
                <button type="submit" className="hidden" />
              </form>
            </div>
          </div>
        )}

        {step === 'results' && results && (
          <div className="space-y-6">
            {/* Overall score */}
            <div className="glass-card rounded-2xl p-8 text-center border-purple/[0.12]">
              <span className="text-[11px] font-mono text-purple uppercase tracking-wider">YOUR TREASURY SCORE</span>
              <p className="font-mono text-[52px] font-black text-t1 terminal-data mt-2">{results.overall_score}<span className="text-[20px] text-t3">/100</span></p>
              <p className="text-[15px] text-t3 mt-2">
                {results.overall_score >= 75 ? 'Your treasury is ahead of most peers.' : results.overall_score >= 50 ? 'You\'re on par — but there\'s room to improve.' : 'Significant opportunity to modernize your treasury.'}
              </p>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-1 md:grid-cols-1 sm:grid-cols-2 gap-4">
              {(results.results || []).map(r => (
                <div key={r.metric} className="glass-card rounded-xl p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[13px] font-medium text-t1">{r.label}</span>
                    <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded ${RATING_COLORS[r.rating]} bg-${r.rating === 'excellent' ? 'green' : r.rating === 'good' ? 'cyan' : r.rating === 'below_average' ? 'amber' : 'red'}/[0.06]`}>
                      {RATING_LABELS[r.rating]}
                    </span>
                  </div>
                  <div className="flex items-end gap-4 mb-2">
                    <div>
                      <span className="text-[10px] font-mono text-t4">YOU</span>
                      <p className="font-mono text-[18px] font-bold text-t1 terminal-data">{r.your_value}{r.unit && r.unit !== '$' ? r.unit : ''}{r.unit === '$' ? '' : ''}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-mono text-t4">MEDIAN</span>
                      <p className="font-mono text-[14px] text-t3">{r.median}{r.unit && r.unit !== '$' ? r.unit : ''}</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-border/20 relative">
                    <div className="h-full rounded-full bg-gradient-to-r from-red via-amber to-green transition-all" style={{ width: `${r.percentile}%` }} />
                    <div className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-purple shadow-sm" style={{ left: `${r.percentile}%`, transform: 'translate(-50%, -50%)' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] font-mono text-t4">Bottom 25%</span>
                    <span className="text-[9px] font-mono text-purple">Percentile: {r.percentile}th</span>
                    <span className="text-[9px] font-mono text-t4">Top 25%</span>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="glass-card rounded-2xl p-8 text-center border-cyan/[0.12]">
              <h3 className="font-display text-xl font-bold mb-2">Ready to improve your score?</h3>
              <p className="text-[14px] text-t3 mb-4 max-w-lg mx-auto">Vaultline automates reconciliation, improves forecast accuracy, and gives you real-time cash visibility — moving your score into the top quartile.</p>
              <div className="flex items-center justify-center gap-3">
                <Link to="/signup" className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] glow-md hover:-translate-y-px transition-all flex items-center gap-2">
                  Get Started <ArrowRight size={15} />
                </Link>
                <Link to="/roi" className="px-6 py-3 rounded-xl border border-border text-[14px] text-t2 font-semibold hover:border-border-hover transition-all">
                  Calculate ROI
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
