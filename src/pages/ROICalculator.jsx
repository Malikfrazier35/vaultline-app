import AnimatedBackground from "@/components/AnimatedBackground"
import { useState, useEffect, useMemo } from 'react'
import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import {
  Calculator, DollarSign, Clock, Users, Building2, TrendingUp,
  ArrowRight, Check, Loader2, BarChart3, Zap, Shield, ChevronRight
} from 'lucide-react'

function fmt(n) { return n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n.toFixed(0)}` }

const SLIDERS = [
  { id: 'monthly_cash', label: 'Total cash under management', min: 500000, max: 500000000, step: 500000, default: 25000000, format: fmt, icon: DollarSign },
  { id: 'bank_accounts', label: 'Number of bank accounts', min: 1, max: 50, step: 1, default: 5, format: v => v, icon: Building2 },
  { id: 'hours_per_week', label: 'Hours/week on treasury tasks', min: 1, max: 60, step: 1, default: 15, format: v => `${v}h`, icon: Clock },
  { id: 'team_size', label: 'Finance team size', min: 1, max: 30, step: 1, default: 3, format: v => v, icon: Users },
  { id: 'entities', label: 'Business entities', min: 1, max: 20, step: 1, default: 1, format: v => v, icon: Building2 },
]

export default function ROICalculator() {
  const [inputs, setInputs] = useState(Object.fromEntries(SLIDERS.map(s => [s.id, s.default])))
  const [step, setStep] = useState('calculate') // calculate | capture | results
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [leadResult, setLeadResult] = useState(null)

  useSEO({ title: 'ROI Calculator 2014 See Your Treasury Savings', description: 'Calculate how much your company could save with automated treasury management. Input your numbers, get instant ROI estimates for Vaultline.', canonical: '/roi' })

  const roi = useMemo(() => {
    const { monthly_cash, bank_accounts, hours_per_week, team_size, entities } = inputs
    const hourlyRate = 85 // avg finance team hourly rate

    // Time savings
    const reconciliationHours = bank_accounts * 2.5 // hours/week per account on manual reconciliation
    const reportingHours = entities * 3 // hours/week per entity
    const forecastingHours = 4 // manual forecasting
    const currentTotal = Math.min(hours_per_week, reconciliationHours + reportingHours + forecastingHours)
    const automatedTotal = currentTotal * 0.15 // 85% reduction
    const hoursSaved = currentTotal - automatedTotal
    const weeklyDollarSaved = hoursSaved * hourlyRate
    const annualTimeSavings = weeklyDollarSaved * 52

    // Error reduction
    const spreadsheetErrorRate = 0.038 // 3.8% of spreadsheet cells contain errors (Ray Panko research)
    const avgErrorCost = monthly_cash * 0.001 // 0.1% of cash managed = error exposure
    const annualErrorReduction = avgErrorCost * spreadsheetErrorRate * 12 * 0.9 // 90% error elimination

    // Idle cash optimization
    const idleCashPct = 0.12 // 12% of cash typically idle in manual treasury
    const yieldRate = 0.045 // 4.5% yield on optimized sweep
    const annualYieldGain = monthly_cash * idleCashPct * yieldRate

    // Fraud prevention
    const fraudRisk = monthly_cash * 0.0002 // 0.02% annual fraud exposure baseline
    const annualFraudReduction = fraudRisk * 0.7 // 70% reduction with real-time monitoring

    const totalAnnualROI = annualTimeSavings + annualErrorReduction + annualYieldGain + annualFraudReduction
    const vaultlineCost = 1499 * 12 // Growth plan annual
    const netROI = totalAnnualROI - vaultlineCost
    const roiMultiple = totalAnnualROI / vaultlineCost
    const paybackDays = Math.ceil(vaultlineCost / (totalAnnualROI / 365))

    return {
      hoursSaved: Math.round(hoursSaved),
      annualTimeSavings: Math.round(annualTimeSavings),
      annualErrorReduction: Math.round(annualErrorReduction),
      annualYieldGain: Math.round(annualYieldGain),
      annualFraudReduction: Math.round(annualFraudReduction),
      totalAnnualROI: Math.round(totalAnnualROI),
      vaultlineCost,
      netROI: Math.round(netROI),
      roiMultiple: Math.round(roiMultiple * 10) / 10,
      paybackDays,
    }
  }, [inputs])

  async function handleCapture(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const params = new URLSearchParams(window.location.search)
      const { data } = await supabase.functions.invoke('lead-capture', {
        body: {
          action: 'capture', email, full_name: name, company_name: company, title,
          source: 'roi_calculator',
          company_size: inputs.team_size <= 10 ? '11-50' : inputs.team_size <= 50 ? '51-200' : '201-500',
          roi_inputs: inputs,
          roi_result: roi,
          utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
          referrer: document.referrer, page_url: window.location.href,
        },
      })
      setLeadResult(data)
      setStep('results')
      if (window.gtag) window.gtag('event', 'generate_lead', { event_category: 'lead', event_label: 'roi_calculator', value: roi.totalAnnualSavings })
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  return (
    <div className="min-h-screen bg-void">
      <AnimatedBackground variant="contours" />
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      {/* Ambient glow */}
      <div className="absolute w-[800px] h-[800px] top-[-300px] left-[-200px] bg-[radial-gradient(circle,var(--color-cyan-glow)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] bottom-[-200px] right-[-100px] bg-[radial-gradient(circle,rgba(129,140,248,0.04)_0%,transparent_60%)] pointer-events-none" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-5 max-w-6xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Vaultline" className="w-8 h-8 rounded-lg" />
          <span className="font-display text-lg font-extrabold">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/assess" className="text-[13px] text-t2 hover:text-cyan transition">Treasury Assessment</Link>
          <Link to="/signup" className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold hover:-translate-y-px transition-all">Start Free Trial</Link>
        </div>
      </nav>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        {/* Header */}
        <div className="text-center mb-12 pt-8">
          <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-cyan">ROI CALCULATOR</span>
          <h1 className="font-display text-4xl font-black tracking-tight mt-3 mb-3">How much is manual treasury costing you?</h1>
          <p className="text-[16px] text-t3 max-w-2xl mx-auto">Enter your numbers. See exactly how much time, money, and risk Vaultline eliminates — personalized to your treasury operation.</p>
        </div>

        {step === 'calculate' && (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Input panel */}
            <div className="lg:col-span-3 glass-card rounded-2xl p-8">
              <h2 className="font-display text-lg font-bold mb-6 flex items-center gap-2"><Calculator size={18} className="text-cyan" /> Your Treasury Profile</h2>
              <div className="space-y-6">
                {SLIDERS.map(s => {
                  const Icon = s.icon
                  const val = inputs[s.id]
                  const pct = ((val - s.min) / (s.max - s.min)) * 100
                  return (
                    <div key={s.id}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-t3" />
                          <span className="text-[13px] text-t2">{s.label}</span>
                        </div>
                        <span className="font-mono text-[15px] font-bold text-cyan terminal-data">{s.format(val)}</span>
                      </div>
                      <input type="range" min={s.min} max={s.max} step={s.step} value={val}
                        onChange={e => setInputs(prev => ({ ...prev, [s.id]: parseFloat(e.target.value) }))}
                        className="w-full h-[4px] rounded-full appearance-none cursor-pointer"
                        style={{ background: `linear-gradient(to right, #22D3EE ${pct}%, rgba(148,163,184,0.15) ${pct}%)` }}
                      />
                      <div className="flex justify-between text-[10px] font-mono text-t4 mt-1">
                        <span>{s.format(s.min)}</span><span>{s.format(s.max)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <button onClick={() => setStep('capture')}
                className="w-full mt-8 py-3.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[15px] glow-sm hover:glow-md hover:-translate-y-px active:scale-[0.98] transition-all flex items-center justify-center gap-2">
                See Your Full ROI Report <ArrowRight size={16} />
              </button>
            </div>

            {/* Live preview */}
            <div className="lg:col-span-2 space-y-4">
              <div className="glass-card rounded-2xl p-6 border-cyan/[0.1]">
                <span className="text-[10px] font-mono text-t4 uppercase tracking-wider">ESTIMATED ANNUAL ROI</span>
                <p className="font-mono text-[36px] font-black text-green terminal-data mt-1">{fmt(roi.totalAnnualROI)}</p>
                <p className="text-[12px] text-t3 mt-1">{roi.roiMultiple}x return on Vaultline investment</p>
                <div className="h-px bg-border/30 my-4" />
                <div className="space-y-3">
                  {[
                    { label: 'Time savings', value: roi.annualTimeSavings, sub: `${roi.hoursSaved}h/week freed`, color: 'cyan' },
                    { label: 'Error reduction', value: roi.annualErrorReduction, sub: 'Eliminated spreadsheet risk', color: 'green' },
                    { label: 'Yield optimization', value: roi.annualYieldGain, sub: 'Idle cash put to work', color: 'purple' },
                    { label: 'Fraud prevention', value: roi.annualFraudReduction, sub: 'Real-time monitoring', color: 'amber' },
                  ].map(r => (
                    <div key={r.label} className="flex items-center justify-between">
                      <div>
                        <span className="text-[12px] text-t2">{r.label}</span>
                        <p className="text-[10px] text-t4">{r.sub}</p>
                      </div>
                      <span className={`font-mono text-[14px] font-bold text-${r.color} terminal-data`}>{fmt(r.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-xl p-4 text-center">
                <p className="text-[12px] text-t3">Payback period</p>
                <p className="font-mono text-[24px] font-black text-cyan terminal-data">{roi.paybackDays} days</p>
              </div>
            </div>
          </div>
        )}

        {step === 'capture' && (
          <div className="max-w-lg mx-auto">
            <div className="glass-card rounded-2xl p-8">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-cyan/[0.08] flex items-center justify-center mx-auto mb-3">
                  <BarChart3 size={22} className="text-cyan" />
                </div>
                <h2 className="font-display text-xl font-bold">Your personalized ROI report is ready</h2>
                <p className="text-[14px] text-t3 mt-2">Enter your details to unlock the full breakdown with category splits, benchmark comparisons, and recommended plan.</p>
              </div>

              <form onSubmit={handleCapture} className="space-y-3">
                <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="Work email"
                  className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                  className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                <div className="grid grid-cols-2 gap-3">
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                  <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Job title"
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[15px] glow-sm hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Processing...</> : <><Zap size={15} /> Get My ROI Report</>}
                </button>
              </form>

              <button onClick={() => setStep('calculate')} className="w-full text-center text-[12px] text-t3 hover:text-cyan mt-4 transition">← Back to calculator</button>

              <div className="flex items-center justify-center gap-4 mt-6">
                {['No commitment', 'No sales call', '30-second signup'].map(t => (
                  <span key={t} className="text-[10px] font-mono text-t4 flex items-center gap-1"><Check size={10} className="text-green" />{t}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 'results' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {/* ROI Hero */}
            <div className="glass-card rounded-2xl p-8 text-center border-green/[0.12]">
              <span className="text-[11px] font-mono text-green uppercase tracking-wider">YOUR ESTIMATED ANNUAL ROI</span>
              <p className="font-mono text-[52px] font-black text-green terminal-data mt-2">{fmt(roi.totalAnnualROI)}</p>
              <p className="text-[15px] text-t2 mt-2">{roi.roiMultiple}x return — pays for itself in <span className="font-mono font-bold text-cyan">{roi.paybackDays} days</span></p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Time Savings', value: roi.annualTimeSavings, detail: `${roi.hoursSaved}h/week`, icon: Clock, color: 'cyan' },
                { label: 'Error Reduction', value: roi.annualErrorReduction, detail: '90% fewer errors', icon: Shield, color: 'green' },
                { label: 'Yield Gain', value: roi.annualYieldGain, detail: 'Idle cash optimized', icon: TrendingUp, color: 'purple' },
                { label: 'Fraud Prevention', value: roi.annualFraudReduction, detail: 'Real-time monitoring', icon: Shield, color: 'amber' },
              ].map(r => {
                const Icon = r.icon
                return (
                  <div key={r.label} className="glass-card rounded-xl p-4">
                    <Icon size={16} className={`text-${r.color} mb-2`} />
                    <p className={`font-mono text-[20px] font-black text-${r.color} terminal-data`}>{fmt(r.value)}</p>
                    <p className="text-[12px] text-t2 mt-1">{r.label}</p>
                    <p className="text-[10px] text-t4">{r.detail}</p>
                  </div>
                )
              })}
            </div>

            {/* Segment + CTA */}
            <div className="glass-card rounded-2xl p-8 border-cyan/[0.12]">
              <div className="flex items-start justify-between flex-wrap gap-6">
                <div>
                  {leadResult?.segment && (
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border mb-3 inline-block ${
                      leadResult.segment === 'enterprise_ready' ? 'text-green bg-green/[0.06] border-green/[0.08]' :
                      leadResult.segment === 'scaling' ? 'text-cyan bg-cyan/[0.06] border-cyan/[0.08]' :
                      'text-amber bg-amber/[0.06] border-amber/[0.08]'
                    }`}>
                      {leadResult.segment.replace('_', ' ')}
                    </span>
                  )}
                  <h3 className="font-display text-xl font-bold mb-2">
                    {leadResult?.segment === 'enterprise_ready' ? 'Your treasury needs enterprise tooling' :
                     leadResult?.segment === 'scaling' ? 'You\'re ready to professionalize your treasury' :
                     'Start automating your treasury basics'}
                  </h3>
                  <p className="text-[14px] text-t3 max-w-md">
                    {leadResult?.segment === 'enterprise_ready'
                      ? 'With your scale, the Enterprise plan with unlimited connections, SSO, and dedicated CSM is the right fit.'
                      : 'The Growth plan with AI forecasting, 10 bank connections, and API access covers your needs.'}
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Link to="/signup" className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] glow-md hover:-translate-y-px transition-all flex items-center gap-2">
                    Start Free Trial <ArrowRight size={15} />
                  </Link>
                  <Link to="/assess" className="px-6 py-3 rounded-xl border border-border text-[14px] text-t2 font-semibold hover:border-border-hover hover:text-t1 transition-all text-center">
                    Take Treasury Assessment
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
