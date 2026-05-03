import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, X, Users, Eye } from 'lucide-react'

/**
 * PRICING PAGE
 * 
 * Strategic intent:
 *  - Anchor on Growth (highlight) — that's the primary conversion target
 *  - Make seat structure unambiguous so customers do their own math
 *  - Read-only seats free on Growth+ is the wedge vs Trovata
 *  - Overage pricing visible builds trust ("no surprise charges")
 *  - Hard caps drive natural tier graduation
 */

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    tagline: 'For small finance teams getting started',
    monthly: 499,
    annual: 399,
    fullSeats: 3,
    readonlySeats: 0,
    maxFullSeats: 10,
    overage: 49,
    readonlyOverage: null,
    features: [
      { label: 'Up to 3 bank connections', included: true },
      { label: '30-day cash forecast', included: true },
      { label: 'Daily Cash Position memo (auto)', included: true },
      { label: 'Print-anywhere PDFs', included: true },
      { label: 'Email + Slack alerts', included: true },
      { label: 'AI Treasury Copilot', included: false },
      { label: 'Multi-currency', included: false },
      { label: 'API access', included: false },
      { label: 'Read-only seats', included: false },
    ],
    seatNote: 'Need read-only access for your CFO or board? Upgrade to Growth.',
    cta: 'Start with Starter',
    highlight: false,
  },
  {
    key: 'growth',
    name: 'Growth',
    tagline: 'For finance teams running treasury operations',
    monthly: 1499,
    annual: 1199,
    fullSeats: 10,
    readonlySeats: 5,
    maxFullSeats: 50,
    overage: 39,
    readonlyOverage: 0,
    features: [
      { label: 'Up to 10 bank connections', included: true },
      { label: '90-day cash forecast', included: true },
      { label: 'Daily Cash Position memo (auto)', included: true },
      { label: 'Weekly Cash Flash (auto)', included: true },
      { label: 'Print-anywhere PDFs', included: true },
      { label: 'AI Treasury Copilot', included: true },
      { label: 'Multi-currency', included: true },
      { label: 'API access', included: true },
      { label: 'Unlimited read-only seats (free)', included: true, accent: true },
    ],
    seatNote: 'Read-only seats are unlimited and free — invite your CFO, board, and auditors.',
    cta: 'Start with Growth',
    highlight: true,
    badge: 'Most popular',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    tagline: 'For large finance organizations',
    monthly: 3499,
    annual: 2799,
    fullSeats: 25,
    readonlySeats: null, // unlimited
    maxFullSeats: null,
    overage: 29,
    readonlyOverage: 0,
    features: [
      { label: 'Unlimited bank connections', included: true },
      { label: '365-day cash forecast', included: true },
      { label: 'All standard reports', included: true },
      { label: 'Custom report builder', included: true },
      { label: 'White-label PDFs (your brand only)', included: true, accent: true },
      { label: 'AI Treasury Copilot', included: true },
      { label: 'Multi-entity consolidation', included: true },
      { label: 'SSO + SCIM provisioning', included: true },
      { label: 'Dedicated CSM', included: true },
    ],
    seatNote: 'Need more than 25 seats or multi-entity? We design custom packages.',
    cta: 'Talk to sales',
    highlight: false,
  },
]

export default function Pricing() {
  const [annual, setAnnual] = useState(true)
  
  return (
    <div className="min-h-screen bg-canvas">
      {/* ── HEADER ── */}
      <header className="px-6 py-5 border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link to="/" className="text-[18px] font-display text-t1 font-semibold">Vaultline</Link>
          <nav className="flex items-center gap-6 text-[14px] text-t2">
            <Link to="/" className="hover:text-t1">Home</Link>
            <Link to="/pricing" className="text-t1 font-medium">Pricing</Link>
            <Link to="/login" className="hover:text-t1">Sign in</Link>
            <Link to="/signup" className="px-4 py-2 rounded-lg bg-cyan text-white font-medium hover:opacity-90">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="px-6 pt-16 pb-12 text-center">
        <h1 className="text-[48px] md:text-[56px] font-display text-t1 leading-tight tracking-tight max-w-3xl mx-auto mb-4">
          Simple, transparent treasury pricing
        </h1>
        <p className="text-[17px] text-t2 max-w-2xl mx-auto leading-relaxed">
          Every plan includes the full Vaultline platform. Choose based on team size and operational needs.
        </p>
        
        {/* ── BILLING TOGGLE ── */}
        <div className="inline-flex items-center gap-3 mt-8 p-1 rounded-full border border-border bg-deep">
          <button 
            onClick={() => setAnnual(false)}
            className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all ${
              !annual ? 'bg-canvas text-t1 shadow-sm' : 'text-t2'
            }`}
          >
            Monthly
          </button>
          <button 
            onClick={() => setAnnual(true)}
            className={`px-5 py-2 rounded-full text-[14px] font-medium transition-all ${
              annual ? 'bg-canvas text-t1 shadow-sm' : 'text-t2'
            }`}
          >
            Annual <span className="text-cyan ml-1">save 20%</span>
          </button>
        </div>
      </section>

      {/* ── PLAN CARDS ── */}
      <section className="px-6 pb-20">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {PLANS.map(plan => {
            const price = annual ? plan.annual : plan.monthly
            return (
              <div 
                key={plan.key}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  plan.highlight 
                    ? 'border-cyan/40 bg-cyan/[0.03] shadow-lg' 
                    : 'border-border bg-canvas'
                }`}
              >
                {plan.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-cyan text-white text-[11px] font-semibold uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}
                
                <div className="mb-6">
                  <h2 className="text-[24px] font-display text-t1 mb-1">{plan.name}</h2>
                  <p className="text-[13px] text-t2 leading-relaxed">{plan.tagline}</p>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[42px] font-display text-t1 font-semibold">
                      ${price.toLocaleString()}
                    </span>
                    <span className="text-[14px] text-t2">/mo</span>
                  </div>
                  {annual && (
                    <p className="text-[12px] text-t3 mt-1">
                      Billed ${(price * 12).toLocaleString()}/year
                    </p>
                  )}
                </div>

                {/* SEAT BLOCK — the differentiator */}
                <div className="mb-6 p-4 rounded-lg bg-deep/40 border border-border/60 space-y-2">
                  <div className="flex items-start gap-2">
                    <Users size={14} className="text-t2 mt-0.5 flex-shrink-0" />
                    <div className="text-[13px] text-t1">
                      <span className="font-semibold">{plan.fullSeats} full seats</span>
                      <span className="text-t2"> included</span>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-2">
                    <Eye size={14} className="text-t2 mt-0.5 flex-shrink-0" />
                    <div className="text-[13px] text-t1">
                      {plan.readonlySeats === null ? (
                        <>
                          <span className="font-semibold">Unlimited read-only seats</span>
                          <span className="text-cyan"> (free)</span>
                        </>
                      ) : plan.readonlySeats === 0 ? (
                        <span className="text-t2">No read-only seats</span>
                      ) : (
                        <>
                          <span className="font-semibold">{plan.readonlySeats} read-only seats</span>
                          <span className="text-cyan"> (then unlimited free)</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-[12px] text-t3 pt-2 border-t border-border/60">
                    {plan.maxFullSeats ? (
                      <>Add up to {plan.maxFullSeats - plan.fullSeats} more full seats at ${plan.overage}/mo each.</>
                    ) : (
                      <>Add additional full seats at ${plan.overage}/mo each. No cap.</>
                    )}
                  </div>
                </div>
                
                <ul className="space-y-2.5 mb-8 flex-1">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[13.5px]">
                      {f.included ? (
                        <Check size={16} className={`mt-0.5 flex-shrink-0 ${f.accent ? 'text-cyan' : 'text-t2'}`} />
                      ) : (
                        <X size={16} className="mt-0.5 flex-shrink-0 text-t4" />
                      )}
                      <span className={f.included ? (f.accent ? 'text-cyan font-medium' : 'text-t1') : 'text-t3 line-through'}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                
                <Link
                  to={plan.key === 'enterprise' ? '/contact' : `/signup?plan=${plan.key}`}
                  className={`w-full text-center py-3 rounded-lg font-medium transition-all text-[14px] ${
                    plan.highlight 
                      ? 'bg-cyan text-white hover:opacity-90' 
                      : 'border border-border text-t1 hover:border-border-hover'
                  }`}
                >
                  {plan.cta}
                </Link>
                
                <p className="text-[12px] text-t3 mt-4 leading-relaxed text-center">
                  {plan.seatNote}
                </p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── COMPARISON TABLE ── */}
      <section className="px-6 pb-20 max-w-5xl mx-auto">
        <h2 className="text-[28px] font-display text-t1 mb-2 text-center">Detailed comparison</h2>
        <p className="text-[14px] text-t2 text-center mb-8">Everything in every plan, side by side.</p>
        
        <div className="rounded-2xl border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-deep/40 border-b border-border">
                <th className="px-6 py-4 text-left text-[13px] font-semibold text-t1">Feature</th>
                <th className="px-6 py-4 text-center text-[13px] font-semibold text-t1">Starter</th>
                <th className="px-6 py-4 text-center text-[13px] font-semibold text-t1">Growth</th>
                <th className="px-6 py-4 text-center text-[13px] font-semibold text-t1">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              <ComparisonRow label="Full seats included" starter="3" growth="10" enterprise="25" />
              <ComparisonRow label="Read-only seats included" starter="—" growth="5" enterprise="Unlimited" />
              <ComparisonRow label="Maximum full seats" starter="10" growth="50" enterprise="Unlimited" />
              <ComparisonRow label="Per-seat overage" starter="$49/mo" growth="$39/mo" enterprise="$29/mo" />
              <ComparisonRow label="Read-only seat cost" starter="—" growth="Free" enterprise="Free" highlighted />
              <ComparisonRow label="Bank connections" starter="3" growth="10" enterprise="Unlimited" />
              <ComparisonRow label="Forecast horizon" starter="30 days" growth="90 days" enterprise="365 days" />
              <ComparisonRow label="AI Treasury Copilot" starter="—" growth="✓" enterprise="✓" />
              <ComparisonRow label="Multi-currency" starter="—" growth="✓" enterprise="✓" />
              <ComparisonRow label="API access" starter="—" growth="✓" enterprise="✓" />
              <ComparisonRow label="Multi-entity consolidation" starter="—" growth="—" enterprise="✓" />
              <ComparisonRow label="SSO / SCIM" starter="—" growth="—" enterprise="✓" />
              <ComparisonRow label="White-label reports" starter="—" growth="—" enterprise="✓" />
              <ComparisonRow label="Dedicated CSM" starter="—" growth="—" enterprise="✓" />
            </tbody>
          </table>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="px-6 pb-20 max-w-3xl mx-auto">
        <h2 className="text-[28px] font-display text-t1 mb-8 text-center">Common questions</h2>
        <dl className="space-y-6">
          <FaqItem 
            q="What's the difference between full and read-only seats?"
            a="Full seats can connect banks, edit forecasts, run reports, and use the Treasury Copilot. Read-only seats can view dashboards and download reports — perfect for CFOs, board members, and auditors who need visibility but don't operate the platform."
          />
          <FaqItem 
            q="Can I add seats mid-month?"
            a="Yes. Adding a seat that exceeds your included count is prorated to your billing date. Removing a seat credits the proration to your next invoice."
          />
          <FaqItem 
            q="What happens when I hit my seat cap?"
            a="When you reach the maximum for your tier, the next invite prompts an upgrade. Starter caps at 10 total seats; Growth caps at 50 full seats with unlimited read-only. Enterprise has no cap."
          />
          <FaqItem 
            q="Can I downgrade?"
            a="Yes — at any time. If you have more seats than the lower tier includes, you'll be asked to remove the excess before the downgrade takes effect."
          />
          <FaqItem 
            q="Do unused seats roll over?"
            a="No. Seats are billed monthly based on active members. We don't credit unused seats, and we don't charge you for them either."
          />
        </dl>
      </section>
    </div>
  )
}

function ComparisonRow({ label, starter, growth, enterprise, highlighted }) {
  const cellClass = highlighted ? 'text-cyan font-medium' : 'text-t1'
  return (
    <tr className={highlighted ? 'bg-cyan/[0.02]' : ''}>
      <td className="px-6 py-3 text-[13px] text-t1">{label}</td>
      <td className={`px-6 py-3 text-center text-[13px] ${cellClass}`}>{starter}</td>
      <td className={`px-6 py-3 text-center text-[13px] ${cellClass}`}>{growth}</td>
      <td className={`px-6 py-3 text-center text-[13px] ${cellClass}`}>{enterprise}</td>
    </tr>
  )
}

function FaqItem({ q, a }) {
  return (
    <div>
      <dt className="text-[15px] font-semibold text-t1 mb-2">{q}</dt>
      <dd className="text-[14px] text-t2 leading-relaxed">{a}</dd>
    </div>
  )
}
