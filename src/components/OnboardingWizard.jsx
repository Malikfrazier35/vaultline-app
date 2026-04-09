import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePlaid } from '@/hooks/usePlaid'
import { supabase } from '@/lib/supabase'
import { ArrowRight, ArrowLeft, Shield, CreditCard, BarChart3, CheckCircle2, X, Sparkles, Check, Zap, Building2, Crown, Loader2 } from 'lucide-react'

const PLANS = [
  {
    id: 'starter', label: 'Starter', price: 499, annual: 399,
    icon: Zap, color: 'cyan',
    features: ['3 bank connections', 'Real-time cash position', '30-day forecast', 'AI Treasury Copilot', 'Smart transaction tagging', 'Basic reports'],
    moPriceId: 'price_1TAdoLFV8yRihVmreiDmJaka',
    yrPriceId: 'price_1TAdoRFV8yRihVmrMjdX3zCp',
  },
  {
    id: 'growth', label: 'Growth', price: 1499, annual: 1199,
    icon: Crown, color: 'purple', featured: true,
    features: ['10 bank connections', 'Advanced AI Treasury Copilot', 'AI-powered 90-day forecast', 'Multi-entity support', 'Slack & email alerts', 'API access'],
    moPriceId: 'price_1TAdoVFV8yRihVmr3OFQDI5C',
    yrPriceId: 'price_1TAdoaFV8yRihVmrRb8ogqIR',
  },
  {
    id: 'enterprise', label: 'Enterprise', price: 2499, annual: 1999,
    icon: Building2, color: 'amber',
    features: ['Unlimited connections', 'Scenario modeling', 'Security & audit center', 'Compliance reports', 'SSO / SAML', 'Priority support'],
    moPriceId: 'price_1TAdogFV8yRihVmrKdDLEbP7',
    yrPriceId: 'price_1TAdokFV8yRihVmrvGYisOLP',
  },
]

export default function OnboardingWizard({ onComplete }) {
  const { profile, org } = useAuth()
  const { openPlaidLink, linking } = usePlaid()
  const [step, setStep] = useState(0)
  const [bankConnected, setBankConnected] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [checkoutLoading, setCheckoutLoading] = useState(false)

  useEffect(() => {
    if (org?.onboarding_completed) setDismissed(true)
  }, [org])

  if (dismissed) return null

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const STEPS = ['welcome', 'plan', 'connect', 'security', 'ready']
  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  async function handlePlaidConnect() {
    await openPlaidLink()
    setBankConnected(true)
    setTimeout(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 500)
  }

  async function selectPlanAndContinue(startTrial = true) {
    if (org?.id) {
      await supabase.from('organizations').update({
        plan: selectedPlan,
        plan_status: 'trialing',
        trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
      }).eq('id', org.id)
    }

    if (!startTrial) {
      setCheckoutLoading(true)
      try {
        const plan = PLANS.find(p => p.id === selectedPlan)
        const priceId = billingCycle === 'annual' ? plan?.yrPriceId : plan?.moPriceId
        if (priceId) {
          const { data } = await supabase.functions.invoke('stripe-checkout', {
            body: { price_id: priceId },
          })
          if (data?.url) { window.location.href = data.url; return }
        }
      } catch {}
      setCheckoutLoading(false)
    }

    setStep(s => s + 1)
  }

  async function finish() {
    if (org?.id) {
      await supabase.from('organizations').update({ onboarding_completed: true }).eq('id', org.id)
    }
    onComplete?.()
    setDismissed(true)
  }

  function skip() {
    if (isLast) { finish(); return }
    setStep(s => s + 1)
  }

  return (
    <div className="fixed inset-0 z-[100] bg-void/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`w-full bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${currentStep === 'plan' ? 'max-w-2xl' : 'max-w-lg'}`}>

        {/* Progress dots */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex gap-2">
            {STEPS.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-cyan' : i < step ? 'w-4 bg-cyan/40' : 'w-4 bg-border'
              }`} />
            ))}
          </div>
          <button onClick={finish} className="text-t3 hover:text-t1 transition p-1" title="Skip setup">
            <X size={16} />
          </button>
        </div>

        <div className="px-8 py-6">

          {/* ═══ WELCOME ═══ */}
          {currentStep === 'welcome' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/[0.12] to-purple/[0.08] flex items-center justify-center mb-6">
              <Sparkles size={24} className="text-cyan" />
            </div>
            <p className="text-[13px] text-cyan font-mono font-semibold tracking-wider mb-2">Hi {firstName}</p>
            <h2 className="text-2xl font-black tracking-tight mb-2">Welcome to Vaultline</h2>
            <p className="text-t2 text-[14px] mb-4">Your treasury command center is ready.</p>
            <p className="text-t3 text-[13px] leading-relaxed mb-6">See every bank account, forecast your cash flow, and catch anomalies before they become problems — all in one place.</p>
            <div className="rounded-xl border border-border bg-deep p-4">
              <div className="flex gap-3 mb-3">
                {[{ l: 'Total cash', v: '$2.26M', s: '+3.2%', c: 'text-cyan' }, { l: 'Net flow', v: '+$47K', s: '30 days', c: 'text-green' }, { l: 'Runway', v: '14.2 mo', s: 'Stable', c: 'text-t1' }].map(d => (
                  <div key={d.l} className="flex-1 rounded-lg bg-surface border border-border p-3">
                    <p className="text-[9px] font-mono text-t3 uppercase tracking-wider">{d.l}</p>
                    <p className={`text-[18px] font-black font-mono ${d.c}`}>{d.v}</p>
                    <p className="text-[10px] text-t3 font-mono">{d.s}</p>
                  </div>
                ))}
              </div>
              <div className="h-12 rounded-lg bg-gradient-to-r from-cyan/[0.06] to-purple/[0.04] border border-border flex items-center justify-center">
                <BarChart3 size={16} className="text-cyan/40" />
                <span className="text-[10px] text-t3 ml-2 font-mono">90-day balance chart</span>
              </div>
            </div>
          </>)}

          {/* ═══ PLAN SELECTION ═══ */}
          {currentStep === 'plan' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple/[0.12] to-cyan/[0.08] flex items-center justify-center mb-5">
              <CreditCard size={24} className="text-purple" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-1">Choose your plan</h2>
            <p className="text-t3 text-[13px] mb-5">All plans include a 14-day free trial. No credit card required to start.</p>

            <div className="flex items-center justify-center gap-3 mb-5">
              <span className={`text-[12px] font-mono ${billingCycle === 'monthly' ? 'text-t1 font-semibold' : 'text-t3'}`}>Monthly</span>
              <button onClick={() => setBillingCycle(b => b === 'monthly' ? 'annual' : 'monthly')}
                className={`relative w-11 h-6 rounded-full transition-colors ${billingCycle === 'annual' ? 'bg-green' : 'bg-border'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${billingCycle === 'annual' ? 'left-6' : 'left-1'}`} />
              </button>
              <span className={`text-[12px] font-mono ${billingCycle === 'annual' ? 'text-t1 font-semibold' : 'text-t3'}`}>Annual</span>
              {billingCycle === 'annual' && <span className="text-[10px] font-mono text-green bg-green/[0.08] px-2 py-0.5 rounded">SAVE 20%</span>}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {PLANS.map(plan => {
                const price = billingCycle === 'annual' ? plan.annual : plan.price
                const isSelected = selectedPlan === plan.id
                const border = isSelected ? { cyan: 'border-cyan/30', purple: 'border-purple/30', amber: 'border-amber/30' }[plan.color] : 'border-border'
                const bg = isSelected ? { cyan: 'bg-cyan/[0.03]', purple: 'bg-purple/[0.03]', amber: 'bg-amber/[0.03]' }[plan.color] : ''
                const tc = { cyan: 'text-cyan', purple: 'text-purple', amber: 'text-amber' }[plan.color]
                return (
                  <button key={plan.id} onClick={() => setSelectedPlan(plan.id)}
                    className={`text-left rounded-xl p-4 border-2 transition-all hover:shadow-sm ${border} ${bg} ${plan.featured ? 'relative' : ''}`}>
                    {plan.featured && <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-purple bg-purple/[0.1] px-2 py-0.5 rounded border border-purple/20">POPULAR</span>}
                    <plan.icon size={18} className={isSelected ? tc : 'text-t3'} />
                    <p className="text-[14px] font-bold mt-2">{plan.label}</p>
                    <p className="text-[20px] font-black font-mono mt-1">${price}<span className="text-[11px] text-t3 font-normal">/mo</span></p>
                    <div className="mt-3 space-y-1">
                      {plan.features.slice(0, 4).map(f => (
                        <p key={f} className="text-[10px] text-t3 flex items-center gap-1.5">
                          <Check size={10} className={isSelected ? tc : 'text-t3/50'} /> {f}
                        </p>
                      ))}
                    </div>
                    {isSelected && <div className={`mt-3 text-[10px] font-mono font-semibold ${tc} text-center`}>Selected</div>}
                  </button>
                )
              })}
            </div>
          </>)}

          {/* ═══ CONNECT BANK ═══ */}
          {currentStep === 'connect' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/[0.12] to-purple/[0.08] flex items-center justify-center mb-6">
              <CreditCard size={24} className="text-cyan" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">Connect your banks</h2>
            <p className="text-t2 text-[14px] mb-4">12,000+ banks supported via Plaid.</p>
            <p className="text-t3 text-[13px] leading-relaxed mb-6">Your credentials never touch our servers. Plaid handles authentication directly with your bank. Connect in under 60 seconds.</p>
          </>)}

          {/* ═══ SECURITY ═══ */}
          {currentStep === 'security' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/[0.12] to-purple/[0.08] flex items-center justify-center mb-6">
              <Shield size={24} className="text-cyan" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">Your data is protected</h2>
            <p className="text-t2 text-[14px] mb-4">Enterprise-grade from day one.</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {['SOC 2 Ready', 'AES-256', 'Row-Level Isolation', 'HSTS Enforced', 'Audit Trail'].map(b => (
                <span key={b} className="text-[10px] font-mono font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-cyan/[0.15] bg-cyan/[0.04] text-cyan">{b}</span>
              ))}
            </div>
            <p className="text-t3 text-[13px] leading-relaxed">Every query is cryptographically isolated to your organization. Full audit trail on every action.</p>
          </>)}

          {/* ═══ READY ═══ */}
          {currentStep === 'ready' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-green/[0.12] to-cyan/[0.08] flex items-center justify-center mb-6">
              <CheckCircle2 size={24} className="text-green" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">You're all set</h2>
            <p className="text-t2 text-[14px] mb-4">
              {bankConnected ? 'We\'re syncing your accounts now. Your dashboard will be ready in seconds.' : 'Connect your banks anytime from the Bank Connections page.'}
            </p>
            <div className="rounded-xl border border-border bg-deep p-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple/[0.08] flex items-center justify-center"><Crown size={14} className="text-purple" /></div>
                <div>
                  <p className="text-[13px] font-semibold text-t1">{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} plan · 14-day free trial</p>
                  <p className="text-[11px] text-t3 font-mono">No credit card charged until you upgrade</p>
                </div>
              </div>
            </div>
          </>)}
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-[13px] text-t3 hover:text-t1 transition">
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            {!isLast && currentStep !== 'plan' && (
              <button onClick={skip} className="text-[13px] text-t3 hover:text-t1 transition">Skip</button>
            )}

            {currentStep === 'welcome' && (
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Next <ArrowRight size={14} />
              </button>
            )}

            {currentStep === 'plan' && (
              <div className="flex items-center gap-2">
                <button onClick={() => selectPlanAndContinue(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                  Start Free Trial <ArrowRight size={14} />
                </button>
                <button onClick={() => selectPlanAndContinue(false)} disabled={checkoutLoading}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-purple/20 bg-purple/[0.04] text-purple text-[13px] font-semibold hover:bg-purple/[0.08] transition-all">
                  {checkoutLoading ? <><Loader2 size={14} className="animate-spin" /> Processing...</> : <>Pay Now</>}
                </button>
              </div>
            )}

            {currentStep === 'connect' && (
              <button onClick={handlePlaidConnect} disabled={linking}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                {linking ? 'Connecting...' : <>Connect Bank <ArrowRight size={14} /></>}
              </button>
            )}

            {currentStep === 'security' && (
              <button onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Next <ArrowRight size={14} />
              </button>
            )}

            {currentStep === 'ready' && (
              <button onClick={finish}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-purple text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Go to Dashboard <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
