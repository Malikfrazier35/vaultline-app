import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import {
  CheckCircle2, Circle, CreditCard, Building2, Users, Bell,
  ChevronDown, ChevronUp, Sparkles, X, ArrowRight, Zap
} from 'lucide-react'

const STEPS = [
  {
    id: 'bank',
    title: 'Connect a bank account',
    desc: 'Link your first bank via Plaid to see real-time balances and transactions.',
    link: '/banks',
    cta: 'Connect Bank',
    icon: CreditCard,
    check: (ctx) => ctx.bankCount > 0,
  },
  {
    id: 'company',
    title: 'Complete company profile',
    desc: 'Add your company name, industry, and currency so reports are accurate.',
    link: '/settings',
    cta: 'Open Settings',
    icon: Building2,
    check: (ctx) => !!(ctx.org?.name && ctx.org?.name !== 'My Organization'),
  },
  {
    id: 'team',
    title: 'Invite a team member',
    desc: 'Add your CFO, controller, or finance lead for shared visibility.',
    link: '/team',
    cta: 'Invite Team',
    icon: Users,
    check: (ctx) => ctx.teamCount > 1,
  },
  {
    id: 'alerts',
    title: 'Set up cash alerts',
    desc: 'Get notified when balances drop below thresholds or large transactions hit.',
    link: '/alerts',
    cta: 'Configure Alerts',
    icon: Bell,
    check: (ctx) => ctx.hasAlerts,
  },
]

export default function OnboardingChecklist() {
  const { org, profile } = useAuth()
  const { cashPosition, transactions } = useTreasury()
  const [expanded, setExpanded] = useState(true)
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('vaultline-onboarding-dismissed') === 'true')

  const ctx = useMemo(() => ({
    org,
    bankCount: cashPosition?.accounts?.length || 0,
    teamCount: 1, // Would query profiles table in production
    hasAlerts: false, // Would query alerts table in production
  }), [org, cashPosition])

  const completed = STEPS.filter(s => s.check(ctx)).length
  const allDone = completed === STEPS.length
  const progress = (completed / STEPS.length) * 100

  // Auto-dismiss when all complete
  useEffect(() => {
    if (allDone && !dismissed) {
      const timer = setTimeout(() => dismiss(), 5000)
      return () => clearTimeout(timer)
    }
  }, [allDone])

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('vaultline-onboarding-dismissed', 'true')
  }

  if (dismissed) return null

  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-cyan/[0.1] mb-5 transition-all">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan/20 to-purple/20 flex items-center justify-center">
            <Sparkles size={16} className="text-cyan" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-t1">
              {allDone ? 'You\'re all set!' : `Welcome, ${firstName}. Let's get you started.`}
            </h3>
            <p className="text-[12px] text-t3 mt-0.5">
              {allDone ? 'Your treasury is fully configured.' : `${completed} of ${STEPS.length} steps complete`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg hover:bg-deep text-t3 hover:text-t1 transition">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={dismiss}
            className="p-1.5 rounded-lg hover:bg-deep text-t3 hover:text-t1 transition" title="Dismiss">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-3">
        <div className="h-[4px] rounded-full bg-border/30 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan to-purple transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      {expanded && (
        <div className="px-5 pb-5 space-y-1.5">
          {STEPS.map((step) => {
            const done = step.check(ctx)
            const Icon = step.icon
            return (
              <div key={step.id}
                className={`flex items-center gap-3.5 p-3 rounded-xl transition-all ${
                  done ? 'bg-green/[0.02] opacity-60' : 'bg-deep/50 hover:bg-deep'
                }`}>
                <div className="flex-shrink-0">
                  {done ? (
                    <CheckCircle2 size={18} className="text-green" />
                  ) : (
                    <Circle size={18} className="text-t4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium ${done ? 'text-t3 line-through' : 'text-t1'}`}>{step.title}</p>
                  {!done && <p className="text-[11px] text-t3 mt-0.5">{step.desc}</p>}
                </div>
                {!done && (
                  <Link to={step.link}
                    className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-cyan/[0.06] text-cyan border border-cyan/[0.1] hover:bg-cyan/[0.1] active:scale-[0.98] transition-all">
                    {step.cta} <ArrowRight size={10} />
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* All done celebration */}
      {allDone && expanded && (
        <div className="px-5 pb-5">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green/[0.04] border border-green/[0.1]">
            <Zap size={16} className="text-green" />
            <div className="flex-1">
              <p className="text-[13px] font-semibold text-green">Treasury setup complete</p>
              <p className="text-[11px] text-t3 mt-0.5">Your dashboard is now powered by live data. Explore forecasting, scenarios, and reports.</p>
            </div>
            <button onClick={dismiss}
              className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-t2 border border-border hover:border-green/[0.15] hover:text-green transition-all">
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
