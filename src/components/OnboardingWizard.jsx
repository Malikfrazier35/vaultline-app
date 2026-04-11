import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePlaid } from '@/hooks/usePlaid'
import { supabase } from '@/lib/supabase'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { ArrowRight, ArrowLeft, Shield, CreditCard, CheckCircle2, X, Sparkles, Check, Zap, Building2, Crown, Loader2, Lock } from 'lucide-react'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

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

// ── Embedded card form (rendered inside <Elements>) ──
function CardForm({ onSuccess, onError, loading, setLoading }) {
  const stripe = useStripe()
  const elements = useElements()

  async function handleSubmit() {
    if (!stripe || !elements) return
    setLoading(true)
    onError(null)

    const { error } = await stripe.confirmSetup({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/home?checkout=success`,
      },
      redirect: 'if_required',
    })

    if (error) {
      onError(error.message)
      setLoading(false)
    } else {
      onSuccess()
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: { billingDetails: { address: { country: 'US' } } },
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!stripe || loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50"
      >
        {loading ? (
          <><Loader2 size={14} className="animate-spin" /> Confirming...</>
        ) : (
          <>Start 14-Day Free Trial <ArrowRight size={14} /></>
        )}
      </button>
      <div className="flex items-center justify-center gap-4 pt-1">
        <div className="flex items-center gap-1.5">
          <Lock size={10} className="text-t3" />
          <span className="text-[10px] text-t3 font-mono">Card stored by Stripe</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Shield size={10} className="text-t3" />
          <span className="text-[10px] text-t3 font-mono">You won't be charged today</span>
        </div>
      </div>
    </div>
  )
}

export default function OnboardingWizard({ onComplete }) {
  const { profile, org } = useAuth()
  const { openPlaidLink, linking } = usePlaid()
  const [step, setStep] = useState(0)
  const [bankConnected, setBankConnected] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [billingCycle, setBillingCycle] = useState('monthly')
  const [setupLoading, setSetupLoading] = useState(false)
  const [setupError, setSetupError] = useState(null)
  const [clientSecret, setClientSecret] = useState(null)
  const [cardLoading, setCardLoading] = useState(false)

  useEffect(() => {
    if (org?.onboarding_completed) setDismissed(true)
  }, [org])

  if (dismissed) return null

  const firstName = profile?.full_name?.split(' ')[0] || 'there'
  const STEPS = ['welcome', 'plan', 'payment', 'connect', 'security', 'ready']
  const currentStep = STEPS[step]
  const isLast = step === STEPS.length - 1

  async function handlePlaidConnect() {
    await openPlaidLink()
    setBankConnected(true)
    setTimeout(() => setStep(s => Math.min(s + 1, STEPS.length - 1)), 500)
  }

  async function createSubscription() {
    setSetupLoading(true)
    setSetupError(null)
    try {
      if (org?.id) {
        await supabase.from('organizations').update({ plan: selectedPlan }).eq('id', org.id)
      }
      const plan = PLANS.find(p => p.id === selectedPlan)
      const priceId = billingCycle === 'annual' ? plan?.yrPriceId : plan?.moPriceId
      if (!priceId) throw new Error('No price found for selected plan')

      const { data, error: fnErr } = await supabase.functions.invoke('stripe-create-subscription', {
        body: { price_id: priceId },
      })
      if (fnErr) throw new Error(fnErr.message || 'Subscription setup failed')
      if (data?.error) throw new Error(data.error)
      if (!data?.clientSecret) throw new Error('No client secret returned')

      setClientSecret(data.clientSecret)
      setStep(s => s + 1)
    } catch (err) {
      setSetupError(err.message)
    } finally {
      setSetupLoading(false)
    }
  }

  function onCardSuccess() {
    setCardLoading(false)
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

  const selectedPlanObj = PLANS.find(p => p.id === selectedPlan)
  const selectedPrice = billingCycle === 'annual' ? selectedPlanObj?.annual : selectedPlanObj?.price

  const elementsOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'night',
      variables: {
        colorPrimary: '#22d3ee',
        colorBackground: '#0c0e14',
        colorText: '#e2e8f0',
        colorDanger: '#ef4444',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
        borderRadius: '12px',
        spacingUnit: '4px',
      },
      rules: {
        '.Input': {
          border: '1px solid rgba(255,255,255,0.08)',
          backgroundColor: 'rgba(255,255,255,0.03)',
          padding: '12px 14px',
        },
        '.Input:focus': {
          border: '1px solid rgba(34,211,238,0.4)',
          boxShadow: '0 0 0 2px rgba(34,211,238,0.1)',
        },
        '.Label': {
          fontSize: '12px',
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          color: '#94a3b8',
        },
      },
    },
  } : null

  return (
    <div className="fixed inset-0 z-[9999] bg-void/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className={`w-full bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 ${currentStep === 'plan' ? 'max-w-2xl' : 'max-w-lg'}`}>
        {/* Progress */}
        <div className="px-8 pt-6 pb-4 flex items-center gap-4">
          <div className="flex-1 flex items-center gap-1">
            {STEPS.map((_, i) => (
              <div key={i} className={`flex-1 h-1 rounded-full transition-all ${i <= step ? 'bg-cyan' : 'bg-border/40'}`} />
            ))}
          </div>
          <span className="text-[10px] font-mono text-t3">{step + 1}/{STEPS.length}</span>
        </div>

        <div className="px-8 pb-4">
          {/* ═══ WELCOME ═══ */}
          {currentStep === 'welcome' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/[0.12] to-purple/[0.08] flex items-center justify-center mb-6">
              <Sparkles size={24} className="text-cyan" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2">Welcome, {firstName}</h2>
            <p className="text-t2 text-[14px] mb-2">Let's get your treasury command center running.</p>
            <p className="text-t3 text-[13px] leading-relaxed">Vaultline gives you real-time cash visibility, intelligent forecasting, and AI-powered insights — all in one platform.</p>
          </>)}

          {/* ═══ PLAN SELECTION ═══ */}
          {currentStep === 'plan' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple/[0.12] to-cyan/[0.08] flex items-center justify-center mb-5">
              <CreditCard size={24} className="text-purple" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-1">Choose your plan</h2>
            <p className="text-t3 text-[13px] mb-5">14-day free trial on all plans. Cancel anytime.</p>

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

          {/* ═══ PAYMENT (Embedded Stripe Elements) ═══ */}
          {currentStep === 'payment' && (<>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/[0.12] to-green/[0.08] flex items-center justify-center mb-5">
              <Lock size={24} className="text-cyan" />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-1">Add payment method</h2>
            <p className="text-t3 text-[13px] mb-2">Your 14-day trial starts now. You won't be charged until it ends.</p>

            <div className="rounded-xl border border-border bg-deep p-3 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedPlanObj && <selectedPlanObj.icon size={16} className={{ cyan: 'text-cyan', purple: 'text-purple', amber: 'text-amber' }[selectedPlanObj.color]} />}
                <div>
                  <p className="text-[13px] font-semibold text-t1">{selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} Plan</p>
                  <p className="text-[11px] text-t3 font-mono">{billingCycle === 'annual' ? 'Annual billing' : 'Monthly billing'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[16px] font-black font-mono text-t1">${selectedPrice}/mo</p>
                <p className="text-[10px] text-green font-mono">$0 due today</p>
              </div>
            </div>

            {clientSecret && elementsOptions ? (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <CardForm
                  onSuccess={onCardSuccess}
                  onError={setSetupError}
                  loading={cardLoading}
                  setLoading={setCardLoading}
                />
              </Elements>
            ) : (
              <div className="flex items-center justify-center py-8">
                <Loader2 size={20} className="animate-spin text-t3" />
              </div>
            )}

            {setupError && (
              <p className="text-[12px] text-red font-mono mt-3 text-center">{setupError}</p>
            )}
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
                  <p className="text-[11px] text-t3 font-mono">Card saved · Cancel anytime</p>
                </div>
              </div>
            </div>
          </>)}
        </div>

        {/* Actions */}
        <div className="px-8 pb-6 flex items-center justify-between gap-3">
          {step > 0 && currentStep !== 'payment' ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-[13px] text-t3 hover:text-t1 transition">
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            {(currentStep === 'connect' || currentStep === 'security') && (
              <button onClick={skip} className="text-[13px] text-t3 hover:text-t1 transition">Skip</button>
            )}

            {currentStep === 'welcome' && (
              <button onClick={() => setStep(1)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Next <ArrowRight size={14} />
              </button>
            )}

            {currentStep === 'plan' && (
              <div className="flex flex-col items-end gap-2">
                {setupError && <p className="text-[12px] text-red font-mono">{setupError}</p>}
                <button onClick={createSubscription} disabled={setupLoading}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                  {setupLoading ? <><Loader2 size={14} className="animate-spin" /> Setting up...</> : <>Continue <ArrowRight size={14} /></>}
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
              <button onClick={() => setStep(s => s + 1)} className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Next <ArrowRight size={14} />
              </button>
            )}

            {isLast && (
              <button onClick={finish}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-green to-cyan text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Launch Dashboard <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
