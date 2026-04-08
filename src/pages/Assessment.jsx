import AnimatedBackground from "@/components/AnimatedBackground"
import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import {
  ClipboardCheck, ArrowRight, ArrowLeft, Check, Loader2,
  BarChart3, AlertTriangle, TrendingUp, Shield, Clock, Zap
} from 'lucide-react'

const QUESTIONS = [
  {
    id: 'current_tool',
    question: 'What do you primarily use for cash visibility today?',
    options: [
      { value: 'spreadsheets', label: 'Spreadsheets (Excel/Google Sheets)', score: 20 },
      { value: 'basic_accounting', label: 'Accounting software (QBO, Xero)', score: 10 },
      { value: 'erp_module', label: 'ERP treasury module', score: 5 },
      { value: 'dedicated_tms', label: 'Dedicated TMS', score: 0 },
    ],
  },
  {
    id: 'reconciliation_time',
    question: 'How long does daily cash reconciliation take?',
    options: [
      { value: 'hours', label: 'Hours (manual download + paste)', score: 15 },
      { value: 'thirty_min', label: '30-60 minutes', score: 10 },
      { value: 'fifteen_min', label: '15 minutes or less', score: 5 },
      { value: 'automated', label: 'Fully automated', score: 0 },
    ],
  },
  {
    id: 'bank_count',
    question: 'How many bank accounts do you manage?',
    options: [
      { value: 1, label: '1-2 accounts', score: 5 },
      { value: 3, label: '3-5 accounts', score: 10 },
      { value: 8, label: '6-10 accounts', score: 15 },
      { value: 15, label: '10+ accounts', score: 20 },
    ],
  },
  {
    id: 'spreadsheet_reliance',
    question: 'How dependent are you on spreadsheets for treasury decisions?',
    options: [
      { value: 'heavy', label: 'Completely — everything lives in spreadsheets', score: 20 },
      { value: 'moderate', label: 'Significantly — most reporting is manual', score: 12 },
      { value: 'light', label: 'Somewhat — we have some automation', score: 5 },
      { value: 'none', label: 'Not at all — fully automated', score: 0 },
    ],
  },
  {
    id: 'forecasting',
    question: 'How do you forecast cash flow?',
    options: [
      { value: 'none', label: 'We don\'t forecast', score: 15 },
      { value: 'spreadsheet', label: 'Manual spreadsheet models', score: 12 },
      { value: 'basic_tool', label: 'Basic tool with limited models', score: 5 },
      { value: 'advanced', label: 'AI/ML-powered multi-model forecasting', score: 0 },
    ],
  },
  {
    id: 'multi_currency',
    question: 'Do you manage multiple currencies?',
    options: [
      { value: true, label: 'Yes — FX exposure is a concern', score: 10 },
      { value: false, label: 'No — single currency only', score: 0 },
    ],
  },
  {
    id: 'team_size',
    question: 'How many people touch treasury tasks?',
    options: [
      { value: 1, label: '1 person (me)', score: 5 },
      { value: 3, label: '2-3 people', score: 10 },
      { value: 5, label: '4-6 people', score: 15 },
      { value: 10, label: '7+ people', score: 20 },
    ],
  },
  {
    id: 'budget_range',
    question: 'What\'s your budget for treasury tooling?',
    options: [
      { value: 'exploring', label: 'Just exploring options', score: 5 },
      { value: '$0-500', label: 'Under $500/month', score: 10 },
      { value: '$500-2500', label: '$500-$2,500/month', score: 15 },
      { value: '$2500+', label: '$2,500+/month', score: 20 },
    ],
  },
  {
    id: 'timeline',
    question: 'When are you looking to implement?',
    options: [
      { value: 'researching', label: 'Just researching', score: 5 },
      { value: '3-6months', label: '3-6 months', score: 8 },
      { value: '1-3months', label: '1-3 months', score: 12 },
      { value: 'immediate', label: 'Immediately', score: 20 },
    ],
  },
]

const SEGMENTS = {
  enterprise_ready: {
    label: 'Enterprise Ready',
    color: 'green',
    icon: Shield,
    headline: 'Your treasury operation needs dedicated tooling',
    desc: 'Your scale, complexity, and team size indicate you\'ve outgrown manual processes. A dedicated TMS with multi-entity support, AI forecasting, and bank-grade security is the right move.',
    plan: 'Enterprise',
    features: ['Unlimited bank connections', 'AI Copilot', 'Multi-currency FX', 'SSO & SAML', 'Priority support', 'Uptime SLA'],
  },
  scaling: {
    label: 'Scaling',
    color: 'cyan',
    icon: TrendingUp,
    headline: 'You\'re outgrowing spreadsheets',
    desc: 'Your treasury complexity is growing faster than your manual processes can handle. Automating cash visibility, forecasting, and reconciliation will free up significant time and reduce risk.',
    plan: 'Growth',
    features: ['10 bank connections', 'AI-powered forecasting', 'Multi-entity support', 'API access', 'Custom reports', 'Slack integration'],
  },
  spreadsheet_dependent: {
    label: 'Getting Started',
    color: 'amber',
    icon: BarChart3,
    headline: 'Time to professionalize your treasury',
    desc: 'You\'re at the stage where manual processes still work but are becoming a liability. Starting with automated cash visibility and basic forecasting will give you a foundation to scale.',
    plan: 'Starter',
    features: ['3 bank connections', 'Cash position dashboard', '30-day forecasting', 'Email alerts', 'Basic reports'],
  },
}

export default function Assessment() {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState({})
  const [step, setStep] = useState('quiz') // quiz | capture | results
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)

  useSEO({ title: 'Treasury Readiness Assessment', description: 'Score your treasury operations in 2 minutes. Get a personalized readiness report covering cash visibility, forecasting, controls, and automation.', canonical: '/assess' })

  const totalScore = Object.values(answers).reduce((s, v) => s + (v?.score || 0), 0)
  const maxScore = QUESTIONS.reduce((s, q) => s + Math.max(...q.options.map(o => o.score)), 0)
  const progress = (Object.keys(answers).length / QUESTIONS.length) * 100

  function selectAnswer(questionId, option) {
    setAnswers(prev => ({ ...prev, [questionId]: option }))
    // Auto-advance after short delay
    if (current < QUESTIONS.length - 1) {
      setTimeout(() => setCurrent(prev => prev + 1), 300)
    }
  }

  function getSegment() {
    if (totalScore >= 80) return 'enterprise_ready'
    if (totalScore >= 45) return 'scaling'
    return 'spreadsheet_dependent'
  }

  async function handleCapture(e) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const segment = getSegment()
      const answersFlat = Object.fromEntries(Object.entries(answers).map(([k, v]) => [k, v.value]))
      const params = new URLSearchParams(window.location.search)

      const { data } = await supabase.functions.invoke('lead-capture', {
        body: {
          action: 'capture', email, full_name: name, company_name: company,
          source: 'assessment',
          assessment_answers: { ...answersFlat, total_score: totalScore },
          utm_source: params.get('utm_source'), utm_medium: params.get('utm_medium'), utm_campaign: params.get('utm_campaign'),
          referrer: document.referrer, page_url: window.location.href,
        },
      })
      setResult({ ...data, segment: data?.segment || segment })
      setStep('results')
    } catch (err) { console.error(err) }
    finally { setSubmitting(false) }
  }

  const q = QUESTIONS[current]
  const segmentKey = result?.segment || getSegment()
  const seg = SEGMENTS[segmentKey]

  return (
    <div className="min-h-screen bg-void">
      <AnimatedBackground variant="contours" />
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[800px] h-[800px] top-[-300px] right-[-200px] bg-[radial-gradient(circle,var(--color-cyan-glow)_0%,transparent_60%)] pointer-events-none" />

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

      <div className="relative z-10 max-w-3xl mx-auto px-6 pb-20">
        {step === 'quiz' && (
          <>
            <div className="text-center mb-10 pt-8">
              <span className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-purple">TREASURY ASSESSMENT</span>
              <h1 className="font-display text-3xl font-black tracking-tight mt-3 mb-3">Is your treasury ready for the next stage?</h1>
              <p className="text-[15px] text-t3 max-w-xl mx-auto">9 questions. 2 minutes. Get a personalized readiness score and a recommended path forward.</p>
            </div>

            {/* Progress */}
            <div className="mb-8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-mono text-t3">{current + 1} of {QUESTIONS.length}</span>
                <span className="text-[11px] font-mono text-cyan">{Math.round(progress)}%</span>
              </div>
              <div className="h-[4px] rounded-full bg-border/20">
                <div className="h-full rounded-full bg-gradient-to-r from-cyan to-purple transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* Question */}
            <div className="glass-card rounded-2xl p-8">
              <h2 className="text-[18px] font-bold text-t1 mb-6">{q.question}</h2>
              <div className="space-y-3">
                {q.options.map(opt => {
                  const selected = answers[q.id]?.value === opt.value
                  return (
                    <button key={opt.value} onClick={() => selectAnswer(q.id, opt)}
                      className={`w-full text-left p-4 rounded-xl border transition-all ${
                        selected
                          ? 'bg-cyan/[0.06] border-cyan/[0.2] glow-xs'
                          : 'bg-deep/50 border-border/30 hover:border-border hover:bg-deep'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          selected ? 'border-cyan bg-cyan' : 'border-border'
                        }`}>
                          {selected && <Check size={10} className="text-void" />}
                        </div>
                        <span className={`text-[14px] ${selected ? 'text-cyan font-medium' : 'text-t1'}`}>{opt.label}</span>
                      </div>
                    </button>
                  )
                })}
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-between mt-8">
                <button onClick={() => setCurrent(prev => Math.max(0, prev - 1))} disabled={current === 0}
                  className="flex items-center gap-1.5 text-[13px] text-t3 hover:text-t1 transition disabled:opacity-30">
                  <ArrowLeft size={14} /> Previous
                </button>
                {current < QUESTIONS.length - 1 ? (
                  <button onClick={() => setCurrent(prev => prev + 1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all">
                    Next <ArrowRight size={14} />
                  </button>
                ) : Object.keys(answers).length >= QUESTIONS.length - 1 ? (
                  <button onClick={() => setStep('capture')}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[14px] font-semibold glow-sm hover:-translate-y-px transition-all">
                    See My Results <ArrowRight size={14} />
                  </button>
                ) : (
                  <span className="text-[12px] text-t4 font-mono">{QUESTIONS.length - Object.keys(answers).length} remaining</span>
                )}
              </div>
            </div>
          </>
        )}

        {step === 'capture' && (
          <div className="max-w-lg mx-auto pt-12">
            <div className="glass-card rounded-2xl p-8">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-purple/[0.08] flex items-center justify-center mx-auto mb-3">
                  <ClipboardCheck size={22} className="text-purple" />
                </div>
                <h2 className="font-display text-xl font-bold">Your assessment is complete</h2>
                <p className="text-[14px] text-t3 mt-2">Enter your email to unlock your personalized treasury readiness report and recommended action plan.</p>
              </div>
              <form onSubmit={handleCapture} className="space-y-3">
                <input value={email} onChange={e => setEmail(e.target.value)} required type="email" placeholder="Work email"
                  className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name"
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                  <input value={company} onChange={e => setCompany(e.target.value)} placeholder="Company name"
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3" />
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[15px] glow-sm hover:-translate-y-px transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-4">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Analyzing...</> : <><Zap size={15} /> Get My Report</>}
                </button>
              </form>
              <button onClick={() => { setStep('quiz'); setCurrent(QUESTIONS.length - 1) }} className="w-full text-center text-[12px] text-t3 hover:text-cyan mt-4 transition">← Back to questions</button>
            </div>
          </div>
        )}

        {step === 'results' && seg && (
          <div className="pt-8 space-y-6">
            {/* Score hero */}
            <div className={`glass-card rounded-2xl p-8 text-center border-${seg.color}/[0.12]`}>
              <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-3 py-1 rounded border text-${seg.color} bg-${seg.color}/[0.06] border-${seg.color}/[0.08]`}>
                {seg.label}
              </span>
              <div className="mt-4 mb-4">
                <span className="font-mono text-[56px] font-black text-t1 terminal-data">{totalScore}</span>
                <span className="text-[20px] text-t3 font-mono">/{maxScore}</span>
              </div>
              <h2 className="font-display text-2xl font-bold mb-2">{seg.headline}</h2>
              <p className="text-[15px] text-t3 max-w-xl mx-auto">{seg.desc}</p>
            </div>

            {/* Recommended plan */}
            <div className="glass-card rounded-2xl p-8">
              <div className="flex items-start justify-between flex-wrap gap-6">
                <div>
                  <span className="text-[10px] font-mono text-t4 uppercase tracking-wider">RECOMMENDED PLAN</span>
                  <h3 className="font-display text-xl font-bold mt-1 mb-3">Vaultline {seg.plan}</h3>
                  <div className="space-y-2">
                    {seg.features.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Check size={13} className="text-green flex-shrink-0" />
                        <span className="text-[13px] text-t2">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Link to="/signup" className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] glow-md hover:-translate-y-px transition-all flex items-center gap-2">
                    Get Started <ArrowRight size={15} />
                  </Link>
                  <Link to="/roi" className="px-6 py-3 rounded-xl border border-border text-[14px] text-t2 font-semibold hover:border-border-hover hover:text-t1 transition-all text-center">
                    Calculate Your ROI
                  </Link>
                </div>
              </div>
            </div>

            {/* Answer breakdown */}
            <div className="glass-card rounded-2xl p-6">
              <h3 className="text-[14px] font-bold text-t2 mb-4">Your Answers</h3>
              <div className="space-y-2">
                {QUESTIONS.map(q => {
                  const a = answers[q.id]
                  if (!a) return null
                  return (
                    <div key={q.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                      <span className="text-[12px] text-t3">{q.question}</span>
                      <span className="text-[12px] font-mono text-t1 font-medium ml-4 text-right">{a.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
