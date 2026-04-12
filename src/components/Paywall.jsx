import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import { ArrowRight, Check, Shield, Loader2 } from 'lucide-react'

const PLANS = [
  {
    name: 'Starter', price: '$499', period: '/mo',
    features: ['3 bank connections', 'Cash position dashboard', '30-day forecasting', 'Email alerts', 'Basic reports'],
    priceId: 'price_1THX62FNFhtB2ZujfPfhaKXc',
  },
  {
    name: 'Growth', price: '$1,499', period: '/mo', popular: true,
    features: ['10 bank connections', 'Advanced AI Treasury Copilot', '90-day forecasting', 'Custom reports', 'Slack integration', 'API access'],
    priceId: 'price_1THX63FNFhtB2ZujQmJpAnaU',
  },
  {
    name: 'Enterprise', price: '$2,499', period: '/mo',
    features: ['Unlimited connections', 'Priority support', 'Custom integrations', 'SSO / SAML', 'Audit log & compliance', 'Advanced security controls'],
    priceId: 'price_1THX64FNFhtB2Zujajul8HIw',
  },
]

export default function Paywall() {
  const { profile, org, signOut, refetch } = useAuth()
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [error, setError] = useState(null)

  async function startCheckout(priceId) {
    setCheckoutLoading(priceId)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-checkout', {
        body: { price_id: priceId },
      })
      if (fnErr) throw new Error(fnErr.message || 'Checkout failed')
      if (data?.error) throw new Error(data.error)
      if (data?.url) window.location.href = data.url
    } catch (err) {
      setError(err.message)
    } finally {
      setCheckoutLoading(null)
    }
  }

  // Only bypass paywall for active (paid) subscribers
  if (org?.plan_status === 'active') {
    refetch?.()
    return null
  }

  return (
    <div className="min-h-screen bg-void flex flex-col items-center justify-center px-6 py-16 relative overflow-hidden">
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="fixed top-[-300px] right-[-200px] w-[800px] h-[800px] bg-[radial-gradient(circle,var(--color-cyan-glow)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="font-display text-2xl font-black tracking-tight mb-2">
            Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
          </h1>
          <div className="flex items-center justify-center gap-2 mb-6">
            <Shield size={18} className="text-cyan" />
            <span className="text-[14px] text-t2">Welcome, {profile?.full_name || 'there'}.</span>
          </div>
          {org?.plan_status === 'past_due' ? (
            <>
              <h2 className="font-display text-3xl font-black mb-3">Payment Failed</h2>
              <p className="text-t3 max-w-md mx-auto mb-4">Your last payment didn't go through. Update your payment method to restore access to your dashboard.</p>
              <button onClick={async () => {
                try {
                  const { data } = await supabase.functions.invoke('stripe-portal', {})
                  if (data?.url) window.location.href = data.url
                } catch {}
              }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                Update Payment Method
              </button>
            </>
          ) : org?.plan_status === 'canceled' || org?.plan_status === 'pending_deletion' ? (
            <>
              <h2 className="font-display text-3xl font-black mb-3">{org?.closed_at ? 'Welcome Back' : 'Reactivate Your Account'}</h2>
              <p className="text-t3 max-w-md mx-auto">{org?.closed_at
                ? 'Your account was closed but your data is still here. Pick a plan to restore full access to your treasury dashboard.'
                : 'Your subscription has been canceled. Choose a plan to restore access to your treasury dashboard.'
              }</p>
            </>
          ) : org?.plan_status === 'trialing' && org?.trial_ends_at && new Date(org.trial_ends_at) < new Date() ? (
            <>
              <h2 className="font-display text-3xl font-black mb-3">Your free trial has ended</h2>
              <p className="text-t3 max-w-md mx-auto">Choose a plan to continue using Vaultline. Your data is safe and waiting for you.</p>
            </>
          ) : (
            <>
              <h2 className="font-display text-3xl font-black mb-3">Choose your plan to get started</h2>
              <p className="text-t3 max-w-md mx-auto">14-day free trial · Cancel anytime</p>
            </>
          )}
          {error && <p className="text-red text-[13px] mt-4 bg-red/[0.06] inline-block px-4 py-2 rounded-lg">{error}</p>}
        </div>

        <div className="grid grid-cols-3 gap-5 mb-10">
          {PLANS.map((plan) => (
            <div key={plan.name} className={`border rounded-[16px] p-7 flex flex-col relative ${plan.popular ? 'border-cyan glow-md' : 'border-border'}`}>
              {plan.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-cyan to-purple text-void text-[12px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Most Popular</span>
              )}
              <h3 className="font-display text-xl font-bold">{plan.name}</h3>
              <div className="mt-3 mb-1">
                <span className="font-display text-[34px] font-extrabold">{plan.price}</span>
                <span className="text-t2 text-[14px]">{plan.period}</span>
              </div>
              <p className="text-[13px] text-green font-medium mb-5">Starting at {plan.price}/mo</p>
              <ul className="space-y-3 mb-7 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[14px] text-t2">
                    <Check size={15} className="text-green shrink-0" /> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => startCheckout(plan.priceId)} disabled={checkoutLoading === plan.priceId}
                className={`w-full py-3 rounded-[10px] text-center text-[14px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60 ${plan.popular
                  ? 'bg-gradient-to-r from-cyan to-sky-400 text-void glow-sm hover:-translate-y-px active:scale-[0.98]'
                  : 'border border-border text-t2 hover:border-border-hover hover:text-t1'
                }`}>
                {checkoutLoading === plan.priceId ? <Loader2 size={14} className="animate-spin" /> : <>Start Free Trial <ArrowRight size={14} /></>}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center">
          <button onClick={signOut} className="text-[13px] text-t3 hover:text-t2 transition">Sign out</button>
        </div>
      </div>
    </div>
  )
}
