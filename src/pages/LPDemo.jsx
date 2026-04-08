import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import AnimatedBackground from '@/components/AnimatedBackground'
import { CheckCircle2, Shield, Landmark, TrendingUp, ArrowRight, Loader2 } from 'lucide-react'

export default function LPDemo() {
  const [searchParams] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', company: '', size: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const utm = {
    source: searchParams.get('utm_source') || '',
    medium: searchParams.get('utm_medium') || '',
    campaign: searchParams.get('utm_campaign') || '',
    content: searchParams.get('utm_content') || '',
    term: searchParams.get('utm_term') || '',
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.name || !form.email || !form.company) return
    setSubmitting(true)
    setError(null)

    try {
      await supabase.functions.invoke('lead-capture', {
        body: { ...form, ...utm, type: 'demo_request', source_page: '/lp/demo' }
      })

      // Fire Google Ads conversion
      if (window.gtag) {
        window.gtag('event', 'conversion', { send_to: 'AW-18032992189/demo_request' })
      }

      setSubmitted(true)
    } catch (err) {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-void text-t1 flex items-center justify-center relative">
        <AnimatedBackground variant="contours" />
        <div className="relative z-10 text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-2xl bg-green/[0.08] border border-green/[0.12] flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={28} className="text-green" />
          </div>
          <h1 className="font-display text-2xl font-black mb-3">We'll be in touch</h1>
          <p className="text-t3 text-[14px] leading-relaxed">Our team will reach out within 24 hours to schedule your personalized demo. In the meantime, you can explore the product at vaultline.app.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-void text-t1 relative">
      <AnimatedBackground variant="contours" />

      {/* Logo only — no navigation */}
      <div className="relative z-10 px-6 py-5">
        <span className="font-display text-xl font-black tracking-tight">
          Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
        </span>
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-6 pt-8 pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left — Value prop */}
          <div>
            <p className="text-cyan text-[11px] font-mono uppercase tracking-widest mb-4">Treasury management platform</p>
            <h1 className="font-display text-3xl sm:text-4xl font-black leading-tight mb-6">
              See your entire cash position in one place
            </h1>
            <p className="text-t3 text-[15px] leading-relaxed mb-8">
              Stop logging into 5 bank portals every morning. Vaultline connects your accounts, syncs your data automatically, and gives your treasury team real-time visibility into every dollar.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan/[0.06] border border-cyan/[0.1] flex items-center justify-center shrink-0 mt-0.5">
                  <Landmark size={15} className="text-cyan" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-t1">Connect all your banks in 60 seconds</p>
                  <p className="text-[12px] text-t3 mt-0.5">Plaid-powered. Chase, Wells Fargo, BofA, SVB — 12,000+ institutions.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green/[0.06] border border-green/[0.1] flex items-center justify-center shrink-0 mt-0.5">
                  <TrendingUp size={15} className="text-green" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-t1">AI forecasting picks the best model for your data</p>
                  <p className="text-[12px] text-t3 mt-0.5">Three models compete. The most accurate one becomes your default.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple/[0.06] border border-purple/[0.1] flex items-center justify-center shrink-0 mt-0.5">
                  <Shield size={15} className="text-purple" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-t1">SOC 2 ready on day one</p>
                  <p className="text-[12px] text-t3 mt-0.5">Immutable audit trail, encrypted at rest, row-level security. 14/14 trust criteria.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="glass-card rounded-2xl p-8 border border-border">
            <h2 className="font-display text-lg font-bold mb-1">Book a personalized demo</h2>
            <p className="text-t3 text-[13px] mb-6">See Vaultline with your use case. 30 minutes, no commitment.</p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-t3 mb-1.5 block">Full name</label>
                <input type="text" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-deep border border-border text-t1 text-[13px] focus:border-cyan/30 focus:outline-none transition" placeholder="Jane Smith" />
              </div>
              <div>
                <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-t3 mb-1.5 block">Work email</label>
                <input type="email" required value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-deep border border-border text-t1 text-[13px] focus:border-cyan/30 focus:outline-none transition" placeholder="jane@company.com" />
              </div>
              <div>
                <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-t3 mb-1.5 block">Company</label>
                <input type="text" required value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-deep border border-border text-t1 text-[13px] focus:border-cyan/30 focus:outline-none transition" placeholder="Acme Corp" />
              </div>
              <div>
                <label className="text-[11px] font-mono font-semibold uppercase tracking-wider text-t3 mb-1.5 block">Company size</label>
                <select value={form.size} onChange={e => setForm(f => ({ ...f, size: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl bg-deep border border-border text-t1 text-[13px] focus:border-cyan/30 focus:outline-none transition appearance-none">
                  <option value="">Select...</option>
                  <option value="1-50">1-50 employees</option>
                  <option value="51-200">51-200 employees</option>
                  <option value="201-500">201-500 employees</option>
                  <option value="500+">500+ employees</option>
                </select>
              </div>

              {error && <p className="text-red text-[12px]">{error}</p>}

              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-cyan to-cyan/80 text-white font-bold text-[14px] hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : <>Book my demo <ArrowRight size={16} /></>}
              </button>
            </form>

            <p className="text-t4 text-[10px] text-center mt-4">No credit card required. We'll never share your information.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
