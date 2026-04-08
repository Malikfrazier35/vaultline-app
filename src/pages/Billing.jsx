import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useSearchParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { Check, Crown, Zap, Building2, Clock, CreditCard, Shield, ExternalLink, ArrowRight, Receipt, TrendingUp, Loader2, CheckCircle2, Lock } from 'lucide-react'

const PLANS = [
  {
    name: 'Starter', icon: Zap, desc: 'Growing teams getting organized', color: 'cyan',
    moPrice: 499, yrPrice: 399, annual: '$4,788/yr',
    moPriceId: 'price_1TAdoLFV8yRihVmreiDmJaka',
    yrPriceId: 'price_1TAdoRFV8yRihVmrMjdX3zCp',
    features: ['Up to 3 bank connections', 'Real-time cash position', '30-day cash forecast', 'Smart transaction tagging', 'Basic reports & exports', 'Email support'],
  },
  {
    name: 'Growth', icon: Crown, desc: 'Full treasury visibility', featured: true, color: 'purple',
    moPrice: 1499, yrPrice: 1199, annual: '$14,388/yr',
    moPriceId: 'price_1TAdoVFV8yRihVmr3OFQDI5C',
    yrPriceId: 'price_1TAdoaFV8yRihVmrRb8ogqIR',
    features: ['Up to 10 bank connections', 'AI-powered 90-day forecast', 'Multi-entity support', 'Auto categorization', 'Board reporting templates', 'Slack & email alerts', 'API access', 'Priority support'],
  },
  {
    name: 'Enterprise', icon: Building2, desc: 'Complex treasury at scale', color: 'green',
    moPrice: 2499, yrPrice: 1999, annual: '$23,988/yr',
    moPriceId: 'price_1TAdogFV8yRihVmrKdDLEbP7',
    yrPriceId: 'price_1TAdokFV8yRihVmrvGYisOLP',
    features: ['Unlimited bank connections', 'AI copilot + scenario modeling', 'Multi-currency & FX alerts', 'Scenario modeling', 'Accounting software sync', 'Security center & audit logs', 'Priority email support', 'Compliance report generator'],
  },
  {
    name: 'Custom', icon: Shield, desc: 'Tailored for large organizations', color: 'amber',
    talkToSales: true,
    features: ['Everything in Enterprise', 'SSO / SAML integration', 'Custom SLA & uptime guarantee', 'Dedicated onboarding', 'Custom API integrations', 'Volume discounts', 'Quarterly business reviews'],
  },
]

export default function Billing() {
  const { org, refetch } = useAuth()
  const toast = useToast()
  const [annual, setAnnual] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(null)
  const [checkoutError, setCheckoutError] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [searchParams] = useSearchParams()
  const checkoutSuccess = searchParams.get('checkout') === 'success'

  useEffect(() => { document.title = 'Billing \u2014 Vaultline' }, [])

  // Toast on checkout success
  useEffect(() => {
    if (checkoutSuccess) toast.success('Subscription activated!', 'Welcome to Vaultline')
  }, [checkoutSuccess])

  // Refresh org data on checkout return
  useEffect(() => {
    if (checkoutSuccess) {
      const poll = setInterval(() => { refetch?.() }, 2000)
      setTimeout(() => clearInterval(poll), 30000) // stop after 30s
      return () => clearInterval(poll)
    }
  }, [checkoutSuccess])

  const currentPlan = org?.plan || 'starter'
  const isTrialing = org?.plan_status === 'trialing'
  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000)) : 0

  async function startCheckout(priceId) {
    setCheckoutLoading(priceId)
    setCheckoutError(null)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-checkout', {
        body: { price_id: priceId },
      })
      if (fnErr) throw new Error(fnErr.message || 'Checkout failed')
      if (data?.error) throw new Error(data.error)
      if (data?.url) window.location.href = data.url
      else throw new Error('No checkout URL returned')
    } catch (err) {
      setCheckoutError(err.message)
      toast.error(err.message, 'Checkout failed')
    } finally {
      setCheckoutLoading(null)
    }
  }

  async function openPortal() {
    setPortalLoading(true)
    try {
      const { data, error: fnErr } = await supabase.functions.invoke('stripe-portal')
      if (fnErr) throw new Error(fnErr.message || 'Portal failed')
      if (data?.error) throw new Error(data.error)
      if (data?.url) window.location.href = data.url
      else throw new Error('No portal URL returned')
    } catch (err) {
      toast.error(err.message, 'Unable to open billing portal')
    } finally {
      setPortalLoading(false)
    }
  }

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">BILLING</span>
          <span className="text-[12px] font-mono text-t3">{org?.name}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[11px] font-mono px-2.5 py-1 rounded border ${isTrialing ? 'text-amber bg-amber/[0.06] border-amber/[0.1]' : 'text-green bg-green/[0.06] border-green/[0.1]'}`}>
            {isTrialing ? 'TRIAL' : org?.plan_status === 'active' ? 'ACTIVE' : 'INACTIVE'}
          </span>
        </div>
      </div>

      {/* Status KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Shield, label: 'PLAN', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), color: 'cyan' },
          { icon: Clock, label: 'STATUS', value: isTrialing ? `${daysLeft}d left` : 'Active', color: isTrialing ? 'amber' : 'green' },
          { icon: Receipt, label: 'BILLING', value: annual ? 'Annual' : 'Monthly', color: 'purple' },
          { icon: TrendingUp, label: 'SAVINGS', value: annual ? '20%' : '0%', color: annual ? 'green' : 'amber' },
        ].map(k => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', amber: 'bg-amber/[0.08] text-amber', purple: 'bg-purple/[0.08] text-purple' }
          return (
            <div key={k.label} className="glass-card rounded-xl p-4 terminal-scanlines relative">
              <div className="relative z-[2]">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cm[k.color]}`}><k.icon size={13} /></div>
                  <span className="text-[9px] font-mono text-t3 uppercase tracking-wider">{k.label}</span>
                </div>
                <p className="font-mono text-[20px] font-black text-t1 terminal-data">{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Trial banner */}
      {isTrialing && (
        <div className="glass-card rounded-2xl p-5 border-cyan/[0.15] terminal-scanlines relative">
          <div className="relative z-[2] flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-cyan/[0.08] flex items-center justify-center"><Clock size={20} className="text-cyan" /></div>
              <div>
                <p className="text-[15px] font-bold">Plan Active</p>
                <p className="text-[13px] text-t3 font-mono">{daysLeft} day{daysLeft !== 1 ? 's' : ''} remaining / No card required</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: 14 }, (_, i) => (
                <div key={i} className={`w-2 h-6 rounded-full transition-all ${i < (14 - daysLeft) ? 'bg-cyan' : 'bg-border/40'}`} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Active subscriber — Manage Billing via Stripe Portal */}
      {org?.plan_status === 'active' && org?.stripe_customer_id && (
        <div className="glass-card rounded-2xl p-5 border-green/[0.15]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-green/[0.08] flex items-center justify-center"><CreditCard size={20} className="text-green" /></div>
              <div>
                <p className="text-[15px] font-bold text-t1">Billing managed by Stripe</p>
                <p className="text-[13px] text-t3">View invoices, update payment method, or cancel subscription.</p>
              </div>
            </div>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-green/90 to-green/70 text-void text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all flex items-center gap-2"
            >
              {portalLoading ? <><Loader2 size={14} className="animate-spin" /> Opening...</> : <>Manage Billing <ExternalLink size={14} /></>}
            </button>
          </div>
          <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border">
            <div className="flex items-center gap-2">
              <Shield size={12} className="text-green" />
              <span className="text-[11px] text-t3 font-mono">PCI Level 1 certified</span>
            </div>
            <div className="flex items-center gap-2">
              <Lock size={12} className="text-green" />
              <span className="text-[11px] text-t3 font-mono">Card data never stored on our servers</span>
            </div>
          </div>
        </div>
      )}

      {/* Checkout success banner */}
      {checkoutSuccess && (
        <div className="glass-card rounded-2xl p-5 border-green/[0.15]">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-green/[0.08] flex items-center justify-center"><CheckCircle2 size={20} className="text-green" /></div>
            <div>
              <p className="text-[15px] font-bold text-green">Checkout Complete</p>
              <p className="text-[13px] text-t3 font-mono">Your subscription is being activated. This page will update automatically.</p>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {checkoutError && (
        <div className="glass-card rounded-xl p-4 border-red/[0.15]">
          <p className="text-[13px] text-red font-mono">{checkoutError}</p>
        </div>
      )}

      {/* Toggle */}
      <div className="flex items-center justify-center gap-4">
        <span className={`text-[14px] font-mono font-medium transition ${!annual ? 'text-t1' : 'text-t3'}`}>MONTHLY</span>
        <button onClick={() => setAnnual(!annual)}
          className={`relative w-14 h-7 rounded-full transition-colors ${annual ? 'bg-cyan' : 'bg-border'}`}>
          <span className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${annual ? 'left-8' : 'left-1'}`} />
        </button>
        <span className={`text-[14px] font-mono font-medium transition ${annual ? 'text-t1' : 'text-t3'}`}>
          ANNUAL <span className="text-green text-[12px] font-bold ml-1 bg-green/[0.06] px-2 py-0.5 rounded border border-green/[0.1]">SAVE 20%</span>
        </span>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {PLANS.map(plan => {
          const isCurrent = currentPlan === plan.name.toLowerCase()
          const price = annual ? plan.yrPrice : plan.moPrice
          const priceId = annual ? plan.yrPriceId : plan.moPriceId
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', purple: 'bg-purple/[0.08] text-purple', green: 'bg-green/[0.08] text-green', amber: 'bg-amber/[0.08] text-amber' }
          return (
            <div key={plan.name} className={`glass-card rounded-2xl p-6 flex flex-col relative transition-all hover:-translate-y-1 active:scale-[0.99] ${plan.featured ? 'border-purple/[0.2] shadow-[0_0_30px_rgba(129,140,248,0.08)]' : ''}`}>
              {plan.featured && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple to-cyan text-void text-[10px] font-mono font-bold px-3 py-1 rounded-full uppercase tracking-wider">MOST POPULAR</span>
              )}
              <div className="flex items-center gap-3 mb-5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cm[plan.color] || cm.cyan}`}><plan.icon size={18} /></div>
                <div>
                  <h3 className="font-display text-[16px] font-bold">{plan.name}</h3>
                  <p className="text-[12px] text-t3 font-mono">{plan.desc}</p>
                </div>
              </div>
              <div className="mb-5">
                {plan.talkToSales ? (
                  <span className="font-display text-[28px] font-black text-t1 tracking-tight">Let's Talk</span>
                ) : (
                  <>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-[36px] font-black text-t1 tracking-tight terminal-data">${price?.toLocaleString()}</span>
                      <span className="text-[13px] text-t3 font-mono">/mo</span>
                    </div>
                    {annual && plan.annual && <p className="text-[12px] text-t3 font-mono mt-1">{plan.annual} billed annually</p>}
                  </>
                )}
              </div>
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-[13px] text-t2">
                    <Check size={13} className="text-green shrink-0 mt-0.5" strokeWidth={2.5} /> {f}
                  </li>
                ))}
              </ul>
              {isCurrent ? (
                <div className="w-full py-3 rounded-xl border border-green/[0.15] text-center text-[13px] font-mono font-bold text-green bg-green/[0.04]">CURRENT PLAN</div>
              ) : plan.talkToSales ? (
                <a href="mailto:sales@vaultline.app" className="w-full py-3 rounded-xl border border-border text-center text-[13px] font-mono font-semibold text-t2 hover:border-amber/[0.3] hover:text-amber transition-all flex items-center justify-center gap-2">
                  TALK TO SALES <ArrowRight size={13} />
                </a>
              ) : (
                <button onClick={() => startCheckout(priceId)} disabled={checkoutLoading === priceId}
                  className={`w-full py-3 rounded-xl text-[13px] font-mono font-bold transition-all flex items-center justify-center gap-2 btn-press ${
                    plan.featured
                      ? 'bg-gradient-to-r from-purple to-cyan text-white shadow-[0_2px_16px_rgba(129,140,248,0.25)] hover:-translate-y-px active:scale-[0.98]'
                      : 'border border-border text-t2 hover:border-cyan/[0.2] hover:text-cyan'
                  }`}>
                  {checkoutLoading === priceId ? <Loader2 size={12} className="animate-spin" /> : <>UPGRADE <ArrowRight size={12} /></>}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Guarantees */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { icon: Shield, label: 'Free Trial', sub: '14 days, no credit card' },
          { icon: CreditCard, label: 'Cancel Anytime', sub: 'No long-term contracts or penalties' },
          { icon: Clock, label: 'Cancel Anytime', sub: 'No contracts or commitments' },
        ].map(g => (
          <div key={g.label} className="glass-card rounded-xl p-4 flex items-center gap-3">
            <g.icon size={16} className="text-t3 shrink-0" />
            <div>
              <p className="text-[13px] font-semibold text-t2">{g.label}</p>
              <p className="text-[12px] text-t3 font-mono">{g.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Ecosystem cross-sell */}
      <div className="glass-card rounded-xl p-5 border-purple/[0.12]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-purple/[0.08] flex items-center justify-center"><Zap size={16} className="text-purple" /></div>
            <div>
              <p className="text-[13px] font-semibold text-t1">Save 15% with the Suite Bundle</p>
              <p className="text-[12px] text-t3 font-mono">Add FinanceOS (FP&A) or Parallax (Compliance) to your stack</p>
            </div>
          </div>
          <Link to="/ecosystem" className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-mono font-semibold text-purple border border-purple/[0.12] hover:bg-purple/[0.04] active:scale-[0.98] transition-all">
            VIEW ECOSYSTEM <ArrowRight size={10} />
          </Link>
        </div>
      </div>

      {/* Terminal status */}
      <div className="terminal-status flex items-center justify-between px-5 py-2 rounded-lg">
        <div className="flex items-center gap-3 text-t3">
          <span className="terminal-live">STRIPE</span>
          <span>PLAN: <span className="text-cyan">{currentPlan.toUpperCase()}</span></span>
        </div>
        <span className="text-t3">PAYMENT: <span className="text-green">STRIPE CHECKOUT</span></span>
      </div>
    </div>
  )
}
