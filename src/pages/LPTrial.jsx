import { Link, useSearchParams } from 'react-router-dom'
import AnimatedBackground from '@/components/AnimatedBackground'
import { CheckCircle2, Shield, Clock, Zap, ArrowRight } from 'lucide-react'

export default function LPTrial() {
  const [searchParams] = useSearchParams()

  // Pass UTMs through to signup
  const utmParams = new URLSearchParams()
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
    const val = searchParams.get(key)
    if (val) utmParams.set(key, val)
  }
  const signupUrl = `/signup${utmParams.toString() ? '?' + utmParams.toString() : ''}`

  // Track trial interest in GA4
  function handleClick() {
    if (window.gtag) {
      window.gtag('event', 'trial_start_click', { event_category: 'lead', event_label: 'lp_trial' })
    }
  }

  return (
    <div className="min-h-screen bg-void text-t1 relative">
      <AnimatedBackground variant="particles" />

      {/* Logo only */}
      <div className="relative z-10 px-6 py-5">
        <span className="font-display text-xl font-black tracking-tight">
          Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
        </span>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-6 pt-12 pb-20 text-center">

        <p className="text-cyan text-[11px] font-mono uppercase tracking-widest mb-5">14-day free trial — cancel anytime</p>

        <h1 className="font-display text-4xl sm:text-5xl font-black leading-[1.1] mb-6">
          Stop logging into<br />5 bank portals<br />every morning
        </h1>

        <p className="text-t3 text-[16px] leading-relaxed max-w-lg mx-auto mb-10">
          Connect your banks, see your total cash position in real time, and let AI forecast where your money is headed. Setup takes 60 seconds.
        </p>

        {/* Primary CTA */}
        <Link to={signupUrl} onClick={handleClick}
          className="inline-flex items-center gap-3 px-10 py-4 rounded-2xl bg-gradient-to-r from-cyan to-cyan/80 text-white font-bold text-[16px] hover:-translate-y-1 active:scale-[0.97] transition-all glow-md">
          Start free trial <ArrowRight size={20} />
        </Link>

        <p className="text-t4 text-[12px] mt-4">Start free for 14 days. Cancel anytime.</p>

        {/* Trust strip */}
        <div className="flex items-center justify-center gap-8 mt-14 flex-wrap">
          <div className="flex items-center gap-2 text-t3 text-[12px]">
            <Shield size={14} className="text-green" />
            SOC 2 ready
          </div>
          <div className="flex items-center gap-2 text-t3 text-[12px]">
            <Clock size={14} className="text-cyan" />
            60-second setup
          </div>
          <div className="flex items-center gap-2 text-t3 text-[12px]">
            <Zap size={14} className="text-amber" />
            3 AI forecast models
          </div>
          <div className="flex items-center gap-2 text-t3 text-[12px]">
            <CheckCircle2 size={14} className="text-green" />
            12,000+ banks supported
          </div>
        </div>

        {/* Social proof */}
        <div className="mt-16 glass-card rounded-2xl p-8 text-left">
          <p className="text-[11px] font-mono uppercase tracking-wider text-t4 mb-4">What you get in 60 seconds</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-green mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-t1">All banks on one dashboard</p>
                <p className="text-[11px] text-t3 mt-0.5">Chase, Wells Fargo, BofA, SVB, and 12,000 more via Plaid</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-green mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-t1">Automatic transaction categorization</p>
                <p className="text-[11px] text-t3 mt-0.5">Payroll, SaaS, revenue, transfers — tagged on import</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-green mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-t1">AI cash flow forecasting</p>
                <p className="text-[11px] text-t3 mt-0.5">Linear, EMA, and Monte Carlo models compete for accuracy</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 size={16} className="text-green mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-t1">Immutable audit trail</p>
                <p className="text-[11px] text-t3 mt-0.5">Every action logged with timestamp, user ID, and IP</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
