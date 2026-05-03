import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Crown, Sparkles, Building2, Users, Eye, ArrowUpRight, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'

/**
 * BILLING & PLANS — in-app subscription management.
 * 
 * Differs from public /pricing in that it shows:
 *  - Current plan badge + seat usage upfront
 *  - Upgrade / Current plan / Downgrade CTAs (not "Sign up")
 *  - Overage warnings if applicable
 *  - 14-day trial language (transparent for new product)
 *  - Stripe Customer Portal for invoices/payment
 */

const TIERS = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'Small teams getting organized',
    icon: Sparkles,
    monthly: 499,
    annual: 399,
    fullSeats: 3,
    readonlySeats: 0,
    maxFullSeats: 10,
    overage: 49,
    features: [
      'Up to 3 bank connections',
      'Real-time cash position',
      '30-day cash forecast',
      'Daily Cash Position memo',
      'Print-anywhere PDFs',
      'Email & Slack alerts',
      'Basic reports & exports',
    ],
    notIncluded: ['AI Treasury Copilot', 'Multi-currency', 'API access', 'Read-only seats'],
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'Treasury teams running operations',
    icon: Crown,
    monthly: 1499,
    annual: 1199,
    fullSeats: 10,
    readonlySeats: 5,
    maxFullSeats: 50,
    overage: 39,
    badge: 'Most popular',
    features: [
      'Up to 10 bank connections',
      '90-day cash forecast',
      'Daily Cash Position memo',
      'Weekly Cash Flash',
      'AI Treasury Copilot',
      'Multi-currency support',
      'API access',
      'Unlimited free read-only seats',
      'Auto-categorization',
      'Slack + email alerts',
    ],
    notIncluded: ['Multi-entity consolidation', 'White-label reports', 'SSO/SCIM'],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'Large finance organizations',
    icon: Building2,
    monthly: 3499,
    annual: 2799,
    fullSeats: 25,
    readonlySeats: null,
    maxFullSeats: null,
    overage: 29,
    features: [
      'Unlimited bank connections',
      '365-day cash forecast',
      'All standard reports',
      'Custom report builder',
      'White-label PDFs (your brand only)',
      'AI Treasury Copilot — unlimited',
      'Multi-entity consolidation',
      'Multi-currency & FX alerts',
      'SSO + SCIM provisioning',
      'Audit log + security center',
      'Dedicated CSM',
    ],
    notIncluded: [],
  },
  {
    key: 'custom',
    name: 'Custom',
    tagline: 'Tailored for your treasury',
    icon: null,
    monthly: null,
    annual: null,
    customCta: 'Talk to sales',
    features: [
      'Everything in Enterprise',
      'Custom SLA & uptime guarantee',
      'Dedicated onboarding',
      'Custom API integrations',
      'Volume discounts',
      'Quarterly business reviews',
    ],
    notIncluded: [],
  },
]

export default function Billing() {
  const { org } = useAuth()
  const toast = useToast()
  
  const [annual, setAnnual] = useState(false)
  const [seatCounts, setSeatCounts] = useState(null)
  const [planLimits, setPlanLimits] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(null)

  useEffect(() => { document.title = 'Billing & Plans — Vaultline' }, [])

  useEffect(() => {
    if (!org?.id) return
    let mounted = true
    
    Promise.all([
      supabase.from('org_seat_counts').select('*').eq('org_id', org.id).maybeSingle(),
      supabase.from('plan_seat_limits').select('*').eq('plan', org.plan || 'starter').maybeSingle(),
    ]).then(([seats, limits]) => {
      if (!mounted) return
      setSeatCounts(seats.data)
      setPlanLimits(limits.data)
      setLoading(false)
    })
    
    return () => { mounted = false }
  }, [org?.id, org?.plan])

  async function handleAction(tierKey) {
    if (tierKey === 'custom') {
      window.location.href = 'mailto:sales@vaultline.app?subject=Custom plan inquiry'
      return
    }
    
    setSubmitting(tierKey)
    try {
      const { data, error } = await supabase.functions.invoke('stripe-checkout', {
        body: { plan: tierKey, billing_cycle: annual ? 'annual' : 'monthly' },
      })
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } catch (e) {
      toast.error('Could not start checkout', e.message)
      setSubmitting(null)
    }
  }
  
  async function openStripePortal() {
    try {
      const { data, error } = await supabase.functions.invoke('stripe-portal')
      if (error) throw error
      if (data?.url) window.location.href = data.url
    } catch (e) {
      toast.error('Could not open billing portal', e.message)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <Loader2 size={20} className="animate-spin text-t2" />
    </div>
  )

  const currentPlan = org?.plan || 'starter'
  const planStatus = org?.plan_status || 'inactive'
  const fullUsed = seatCounts?.active_full_seats || 0
  const fullIncluded = planLimits?.included_full_seats || 0
  const fullCap = planLimits?.max_full_seats
  const fullOverage = Math.max(0, fullUsed - fullIncluded)
  const fullOverageCost = fullOverage * ((planLimits?.overage_full_seat_cents || 0) / 100)
  const fullPctOfCap = fullCap ? (fullUsed / fullCap) * 100 : 0
  const roUsed = seatCounts?.active_readonly_seats || 0

  return (
    <div className="space-y-8 max-w-7xl">
      {/* ─── HEADER ─── */}
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-[28px] font-display text-t1">Billing & Plans</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-cyan/10 text-cyan text-[11px] font-semibold uppercase tracking-wider border border-cyan/20">
              {currentPlan}
            </span>
            {planStatus === 'trialing' && (
              <span className="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 text-[11px] font-semibold uppercase tracking-wider border border-amber-500/20">
                Trial
              </span>
            )}
          </div>
          <p className="text-[14px] text-t2">
            {org?.name} · Manage your subscription, seats, and invoices.
          </p>
        </div>
        {org?.stripe_customer_id && (
          <button
            onClick={openStripePortal}
            className="px-4 py-2 rounded-lg border border-border text-t1 text-[13px] font-medium hover:border-border-hover inline-flex items-center gap-2"
          >
            Manage payment & invoices <ArrowUpRight size={14} />
          </button>
        )}
      </header>

      {/* ─── SEAT USAGE STRIP ─── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users size={14} className="text-t2" />
            <span className="text-[11px] uppercase tracking-wider text-t3 font-medium">Full seats</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-[28px] font-display text-t1 font-semibold">{fullUsed}</span>
            <span className="text-[13px] text-t2">
              / {fullCap || '∞'}{fullIncluded ? ` · ${fullIncluded} included` : ''}
            </span>
          </div>
          {fullCap && (
            <div className="w-full h-1 rounded-full bg-deep mb-2">
              <div 
                className={`h-full rounded-full ${fullPctOfCap > 95 ? 'bg-red-500' : fullPctOfCap > 80 ? 'bg-amber-500' : 'bg-cyan'}`}
                style={{ width: `${Math.min(100, fullPctOfCap)}%` }}
              />
            </div>
          )}
          {fullOverage > 0 && (
            <p className="text-[12px] text-t2">
              <strong className="text-t1">{fullOverage}</strong> over included · <strong className="text-t1">+${fullOverageCost}/mo</strong>
            </p>
          )}
        </div>
        
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <Eye size={14} className="text-t2" />
            <span className="text-[11px] uppercase tracking-wider text-t3 font-medium">Read-only seats</span>
          </div>
          <div className="flex items-baseline gap-1.5 mb-2">
            <span className="text-[28px] font-display text-t1 font-semibold">{roUsed}</span>
            <span className="text-[13px] text-t2">
              {currentPlan === 'starter' ? '· upgrade required' : '· unlimited free'}
            </span>
          </div>
          <p className="text-[12px] text-t2">
            {currentPlan === 'starter' 
              ? 'Read-only seats available on Growth+'
              : 'Invite CFOs, board, auditors at no cost'}
          </p>
        </div>
        
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] uppercase tracking-wider text-t3 font-medium">Manage team</span>
          </div>
          <Link 
            to="/settings/team"
            className="text-[14px] text-cyan hover:underline inline-flex items-center gap-1 font-medium"
          >
            View team & invite members <ArrowUpRight size={14} />
          </Link>
          <p className="text-[12px] text-t2 mt-2">
            Add admins, members, and read-only seats from one place.
          </p>
        </div>
      </section>

      {/* ─── BILLING TOGGLE ─── */}
      <div className="flex items-center justify-center">
        <div className="inline-flex items-center gap-1 p-1 rounded-full border border-border bg-deep">
          <button 
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-full text-[13px] font-medium transition-all ${
              !annual ? 'bg-canvas text-t1 shadow-sm' : 'text-t2'
            }`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-full text-[13px] font-medium transition-all ${
              annual ? 'bg-canvas text-t1 shadow-sm' : 'text-t2'
            }`}
          >
            Annual <span className="text-cyan ml-1">save 20%</span>
          </button>
        </div>
      </div>

      {/* ─── TIER CARDS ─── */}
      <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {TIERS.map(tier => {
          const isCurrent = currentPlan === tier.key
          const tierIndex = TIERS.findIndex(t => t.key === tier.key)
          const currentIndex = TIERS.findIndex(t => t.key === currentPlan)
          const isUpgrade = tierIndex > currentIndex && tier.key !== 'custom'
          const isDowngrade = tierIndex < currentIndex
          const isSubmitting = submitting === tier.key
          const Icon = tier.icon
          const price = annual ? tier.annual : tier.monthly
          const isHighlighted = tier.key === 'growth' && !isCurrent
          
          return (
            <div 
              key={tier.key}
              className={`relative rounded-2xl border p-5 flex flex-col ${
                isCurrent 
                  ? 'border-cyan bg-cyan/[0.04]' 
                  : isHighlighted
                    ? 'border-cyan/30 bg-canvas'
                    : 'border-border bg-canvas'
              }`}
            >
              {tier.badge && !isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan text-white text-[10px] font-semibold uppercase tracking-wider">
                  {tier.badge}
                </span>
              )}
              {isCurrent && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-cyan text-white text-[10px] font-semibold uppercase tracking-wider">
                  Current plan
                </span>
              )}
              
              <div className="flex items-center gap-2 mb-1">
                {Icon && <Icon size={16} className="text-t2" />}
                <h3 className="text-[18px] font-display text-t1 font-semibold">{tier.name}</h3>
              </div>
              <p className="text-[12px] text-t2 mb-4 leading-relaxed">{tier.tagline}</p>
              
              <div className="mb-4">
                {price != null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-[32px] font-display text-t1 font-semibold">${price.toLocaleString()}</span>
                      <span className="text-[13px] text-t2">/mo</span>
                    </div>
                    {annual && (
                      <p className="text-[11px] text-t3 mt-1">Billed ${(price * 12).toLocaleString()}/yr</p>
                    )}
                  </>
                ) : (
                  <div className="text-[24px] font-display text-t1 font-semibold">Let's talk</div>
                )}
              </div>

              {/* Seat block */}
              {tier.fullSeats && (
                <div className="mb-4 p-3 rounded-lg bg-deep/40 border border-border/60 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[12px] text-t1">
                    <Users size={12} className="text-t2" />
                    <span><strong>{tier.fullSeats}</strong> full seats</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px] text-t1">
                    <Eye size={12} className="text-t2" />
                    {tier.readonlySeats === null ? (
                      <span><strong>Unlimited</strong> read-only <span className="text-cyan">free</span></span>
                    ) : tier.readonlySeats === 0 ? (
                      <span className="text-t3">No read-only seats</span>
                    ) : (
                      <span><strong>{tier.readonlySeats}</strong> read-only, then unlimited <span className="text-cyan">free</span></span>
                    )}
                  </div>
                  <div className="text-[11px] text-t3 pt-1.5 border-t border-border/60">
                    {tier.maxFullSeats 
                      ? `Cap ${tier.maxFullSeats} · +$${tier.overage}/seat` 
                      : `No cap · +$${tier.overage}/seat`}
                  </div>
                </div>
              )}
              
              <ul className="space-y-1.5 mb-5 flex-1 text-[12.5px]">
                {tier.features.slice(0, 8).map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <Check size={13} className="text-t2 mt-0.5 flex-shrink-0" />
                    <span className="text-t1 leading-relaxed">{f}</span>
                  </li>
                ))}
                {tier.features.length > 8 && (
                  <li className="text-[11px] text-t3 italic ml-5">+ {tier.features.length - 8} more</li>
                )}
              </ul>
              
              <button
                onClick={() => handleAction(tier.key)}
                disabled={isCurrent || isSubmitting}
                className={`w-full py-2.5 rounded-lg text-[13px] font-medium transition-all inline-flex items-center justify-center gap-2 ${
                  isCurrent 
                    ? 'bg-deep text-t2 cursor-default'
                    : isHighlighted
                      ? 'bg-cyan text-white hover:opacity-90'
                      : 'border border-border text-t1 hover:border-border-hover'
                }`}
              >
                {isSubmitting ? (
                  <><Loader2 size={13} className="animate-spin" /> Loading…</>
                ) : isCurrent ? (
                  'Current plan'
                ) : tier.customCta ? (
                  tier.customCta
                ) : isUpgrade ? (
                  <>Upgrade <ArrowUpRight size={13} /></>
                ) : isDowngrade ? (
                  'Downgrade'
                ) : (
                  'Choose plan'
                )}
              </button>
            </div>
          )
        })}
      </section>

      {/* ─── BOTTOM ASSURANCES ─── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-card p-4 flex items-start gap-3">
          <div className="text-[20px]">⏱</div>
          <div>
            <div className="text-[13px] font-semibold text-t1 mb-0.5">14-day free trial</div>
            <div className="text-[12px] text-t2">Full access. Cancel before day 14, no charge.</div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-start gap-3">
          <div className="text-[20px]">↺</div>
          <div>
            <div className="text-[13px] font-semibold text-t1 mb-0.5">Cancel anytime</div>
            <div className="text-[12px] text-t2">No long-term contracts or penalties.</div>
          </div>
        </div>
        <div className="glass-card p-4 flex items-start gap-3">
          <div className="text-[20px]">⚡</div>
          <div>
            <div className="text-[13px] font-semibold text-t1 mb-0.5">Instant access</div>
            <div className="text-[12px] text-t2">Set up in under 60 seconds.</div>
          </div>
        </div>
      </section>
    </div>
  )
}
