import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Clock, AlertTriangle, Zap, ArrowRight, X, Crown, Star,
  TrendingUp, CheckCircle2, Gift, CreditCard, Shield, Heart,
  ThumbsUp, ThumbsDown, Send, Sparkles, BarChart3, RefreshCw
} from 'lucide-react'

// ── 1. TRIAL COUNTDOWN BAR ──
// Shows urgency banner for trialing users — escalates color as expiry approaches
export function TrialBar() {
  const { org } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (org?.plan_status !== 'trialing') return null

  const trialEndsAt = org?.trial_ends_at ? new Date(org.trial_ends_at) : null
  if (!trialEndsAt) return null

  const daysLeft = Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400000))
  const isUrgent = daysLeft <= 3
  const isCritical = daysLeft <= 1
  const progress = Math.max(0, Math.min(100, ((14 - daysLeft) / 14) * 100))

  return (
    <div className={`flex items-center justify-between px-5 py-2.5 border-b transition-colors ${
      isCritical ? 'bg-red/[0.06] border-red/[0.12]' :
      isUrgent ? 'bg-amber/[0.06] border-amber/[0.12]' :
      'bg-cyan/[0.03] border-cyan/[0.08]'
    }`}>
      <div className="flex items-center gap-3">
        <Clock size={14} className={isCritical ? 'text-red' : isUrgent ? 'text-amber' : 'text-cyan'} />
        <span className="text-[12px] font-mono font-semibold text-t1">
          {daysLeft === 0 ? 'Trial expires today' :
           daysLeft === 1 ? '1 day left in trial' :
           `${daysLeft} days left in your plan`}
        </span>
        {/* Mini progress bar */}
        <div className="w-24 h-[3px] rounded-full bg-border/20 hidden sm:block">
          <div className={`h-full rounded-full transition-all ${
            isCritical ? 'bg-red' : isUrgent ? 'bg-amber' : 'bg-cyan'
          }`} style={{ width: `${progress}%` }} />
        </div>
        <span className="text-[11px] text-t3 font-mono hidden sm:inline">30-day money-back guarantee</span>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/billing"
          className={`px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all flex items-center gap-1.5 ${
            isUrgent
              ? 'bg-gradient-to-r from-amber to-orange-400 text-void shadow-[0_2px_8px_rgba(245,158,11,0.3)]'
              : 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12] hover:bg-cyan/[0.12]'
          }`}>
          <Crown size={11} /> Upgrade Now
        </Link>
        <button onClick={() => setDismissed(true)} className="p-1 rounded text-t4 hover:text-t2 transition">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

// ── 2. DUNNING / PAST DUE BANNER ──
// Shows when payment fails — blocks are softer than hard paywall
export function DunningBanner() {
  const { org } = useAuth()

  if (org?.plan_status !== 'past_due') return null

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-red/[0.06] border-b border-red/[0.15]">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-red/[0.1] flex items-center justify-center">
          <CreditCard size={14} className="text-red" />
        </div>
        <div>
          <span className="text-[13px] font-semibold text-red">Payment failed</span>
          <span className="text-[12px] text-t3 ml-2">Update your payment method to avoid service interruption.</span>
        </div>
      </div>
      <Link to="/billing"
        className="px-4 py-1.5 rounded-lg bg-red text-white text-[11px] font-semibold hover:bg-red/90 transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(239,68,68,0.3)]">
        <CreditCard size={11} /> Update Payment
      </Link>
    </div>
  )
}

// ── 3. WIN-BACK BANNER ──
// Shows for canceled accounts that still have data (30-day retention window)
export function WinBackBanner() {
  const { org } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null
  if (org?.plan_status !== 'canceled') return null

  const closedAt = org?.closed_at ? new Date(org.closed_at) : null
  const daysRemaining = closedAt ? Math.max(0, 30 - Math.ceil((Date.now() - closedAt.getTime()) / 86400000)) : 30

  return (
    <div className="flex items-center justify-between px-5 py-3 bg-purple/[0.04] border-b border-purple/[0.12]">
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-purple/[0.1] flex items-center justify-center">
          <RefreshCw size={14} className="text-purple" />
        </div>
        <div>
          <span className="text-[13px] font-semibold text-t1">Your account was canceled</span>
          <span className="text-[12px] text-t3 ml-2">
            Data retained for {daysRemaining} more day{daysRemaining !== 1 ? 's' : ''}. Reactivate to pick up where you left off.
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/billing"
          className="px-4 py-1.5 rounded-lg bg-purple text-white text-[11px] font-semibold hover:bg-purple/90 transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(139,92,246,0.3)]">
          <Zap size={11} /> Reactivate
        </Link>
        <button onClick={() => setDismissed(true)} className="p-1 rounded text-t4 hover:text-t2 transition">
          <X size={12} />
        </button>
      </div>
    </div>
  )
}

// ── 4. FEATURE GATE PROMPT ──
// Reusable component: shows when user hits a plan limit
export function FeatureGate({ feature, currentPlan, requiredPlan, limit, current, children }) {
  const [showUpgrade, setShowUpgrade] = useState(false)
  const isLocked = current != null && limit != null && current >= limit

  if (!isLocked) return children || null

  return (
    <div className="relative">
      {children && <div className="opacity-40 pointer-events-none">{children}</div>}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="glass-card rounded-2xl p-6 max-w-sm text-center shadow-[0_8px_32px_rgba(0,0,0,0.2)]">
          <div className="w-10 h-10 rounded-xl bg-amber/[0.08] flex items-center justify-center mx-auto mb-3">
            <Crown size={20} className="text-amber" />
          </div>
          <h3 className="text-[15px] font-bold text-t1 mb-1">{feature} limit reached</h3>
          <p className="text-[13px] text-t3 mb-4">
            You've used {current} of {limit} on the {currentPlan} plan.
            Upgrade to {requiredPlan} for more.
          </p>
          <Link to="/billing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold shadow-[0_2px_12px_rgba(34,211,238,0.2)] hover:-translate-y-px transition-all">
            <Crown size={13} /> Upgrade to {requiredPlan}
          </Link>
        </div>
      </div>
    </div>
  )
}

// ── 5. VALUE REINFORCEMENT PANEL ──
// Shows monthly value summary — "here's what Vaultline did for you"
export function ValueReinforcement() {
  const { org, profile } = useAuth()
  const { transactions, accounts, cashPosition, dailyBalances } = useTreasury()
  const [dismissed, setDismissed] = useState(() => {
    const saved = localStorage.getItem('vaultline-value-dismissed')
    if (!saved) return false
    const dismissedMonth = new Date(JSON.parse(saved)).getMonth()
    return dismissedMonth === new Date().getMonth()
  })

  const stats = useMemo(() => {
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0)

    const monthTx = (transactions || []).filter(t => {
      const d = new Date(t.date)
      return d >= lastMonth && d <= lastMonthEnd
    })

    const totalReconciled = monthTx.length
    const totalVolume = monthTx.reduce((s, t) => s + Math.abs(t.amount || 0), 0)
    const hoursSaved = Math.round((totalReconciled * 2 / 60) + (30 * 22 / 60))
    const balanceChecks = (accounts || []).length * 22

    return {
      totalReconciled,
      totalVolume,
      hoursSaved,
      balanceChecks,
      accounts: (accounts || []).length,
    }
  }, [transactions, accounts])

  // All hooks above — safe to return early below
  const dayOfMonth = new Date().getDate()
  if (dismissed || dayOfMonth > 7) return null
  if (!org || (org.plan_status !== 'active' && org.plan_status !== 'trialing')) return null
  if (!(transactions || []).length && !(accounts || []).length) return null
  if (stats.totalReconciled === 0 && stats.accounts === 0) return null

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('vaultline-value-dismissed', JSON.stringify(new Date()))
  }

  const monthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
    .toLocaleDateString('en-US', { month: 'long' })

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-green/[0.1] mb-5">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green/[0.08] flex items-center justify-center">
            <Sparkles size={14} className="text-green" />
          </div>
          <span className="terminal-label text-green">YOUR {monthName.toUpperCase()} RECAP</span>
        </div>
        <button onClick={dismiss} className="p-1.5 rounded-lg hover:bg-deep text-t3 hover:text-t1 transition">
          <X size={12} />
        </button>
      </div>
      <div className="px-5 pb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Hours Saved', value: `${stats.hoursSaved}h`, icon: Clock, color: 'green', sub: 'vs manual treasury' },
          { label: 'Transactions', value: stats.totalReconciled.toLocaleString(), icon: BarChart3, color: 'cyan', sub: 'auto-reconciled' },
          { label: 'Balance Checks', value: stats.balanceChecks.toLocaleString(), icon: Shield, color: 'purple', sub: 'automated' },
          { label: 'Accounts Monitored', value: stats.accounts, icon: CreditCard, color: 'amber', sub: 'real-time' },
        ].map(s => {
          const Icon = s.icon
          const cm = { green: 'bg-green/[0.08] text-green', cyan: 'bg-cyan/[0.08] text-cyan', purple: 'bg-purple/[0.08] text-purple', amber: 'bg-amber/[0.08] text-amber' }
          return (
            <div key={s.label} className="p-3 rounded-xl bg-deep/50">
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-5 h-5 rounded flex items-center justify-center ${cm[s.color]}`}><Icon size={10} /></div>
                <span className="text-[10px] font-mono text-t4 uppercase tracking-wider">{s.label}</span>
              </div>
              <p className="font-mono text-[20px] font-black text-t1 terminal-data">{s.value}</p>
              <p className="text-[10px] text-t3 font-mono mt-0.5">{s.sub}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 6. NPS MICRO-SURVEY ──
// Appears after 14+ days of active use, dismissable, stores in localStorage
export function NPSSurvey() {
  const { org, profile } = useAuth()
  const [score, setScore] = useState(null)
  const [feedback, setFeedback] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    const saved = localStorage.getItem('vaultline-nps-dismissed')
    if (!saved) return false
    // Allow re-survey every 90 days
    const dismissedDate = new Date(JSON.parse(saved))
    return (Date.now() - dismissedDate.getTime()) < 90 * 86400000
  })

  if (dismissed || submitted) return null
  if (!org || org.plan_status === 'canceled') return null

  // Only show after 14 days of account existence
  const accountAge = org?.created_at ? Math.ceil((Date.now() - new Date(org.created_at).getTime()) / 86400000) : 0
  if (accountAge < 14) return null

  function dismiss() {
    setDismissed(true)
    localStorage.setItem('vaultline-nps-dismissed', JSON.stringify(new Date()))
  }

  async function submit() {
    try {
      await safeInvoke('support', { action: 'submit_csat', trigger_type: 'nps', score, feedback, tags: [score >= 9 ? 'promoter' : score >= 7 ? 'passive' : 'detractor'] })
    } catch (e) { console.error('NPS submit error:', e) }
    setSubmitted(true)
    localStorage.setItem('vaultline-nps-dismissed', JSON.stringify(new Date()))
  }

  const scoreLabel = score === null ? null : score >= 9 ? 'Promoter' : score >= 7 ? 'Passive' : 'Detractor'
  const scoreColor = score === null ? '' : score >= 9 ? 'text-green' : score >= 7 ? 'text-amber' : 'text-red'

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-purple/[0.1] mb-5">
      <div className="px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple/[0.08] flex items-center justify-center">
            <Heart size={14} className="text-purple" />
          </div>
          <span className="terminal-label text-purple">QUICK FEEDBACK</span>
          <span className="text-[10px] text-t4 font-mono">Takes 10 seconds</span>
        </div>
        <button onClick={dismiss} className="p-1.5 rounded-lg hover:bg-deep text-t3 hover:text-t1 transition">
          <X size={12} />
        </button>
      </div>
      <div className="px-5 pb-5">
        <p className="text-[13px] text-t2 mb-3">How likely are you to recommend Vaultline to a colleague?</p>

        {/* Score selector 0-10 */}
        <div className="flex items-center gap-1 mb-2">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} onClick={() => setScore(i)}
              className={`w-9 h-9 rounded-lg text-[12px] font-mono font-bold transition-all ${
                score === i
                  ? i >= 9 ? 'bg-green text-void' : i >= 7 ? 'bg-amber text-void' : 'bg-red text-void'
                  : 'bg-deep border border-border text-t3 hover:border-border-hover hover:text-t1'
              }`}>
              {i}
            </button>
          ))}
        </div>
        <div className="flex justify-between text-[10px] font-mono text-t4 mb-3">
          <span>Not likely</span>
          {scoreLabel && <span className={`font-bold ${scoreColor}`}>{scoreLabel}</span>}
          <span>Very likely</span>
        </div>

        {/* Feedback + submit */}
        {score !== null && (
          <div className="flex items-center gap-2 mt-3">
            <input
              value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder={score >= 9 ? "What do you love most?" : score >= 7 ? "What would make it a 10?" : "What's not working?"}
              className="flex-1 px-3.5 py-2 rounded-xl bg-deep border border-border text-[12px] text-t1 placeholder:text-t4 focus:outline-none focus:border-cyan/[0.3] transition"
            />
            <button onClick={submit}
              className="px-4 py-2 rounded-xl bg-purple text-white text-[11px] font-semibold hover:bg-purple/90 transition-all flex items-center gap-1.5 shadow-[0_2px_8px_rgba(139,92,246,0.2)]">
              <Send size={11} /> Send
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── 7. USAGE MILESTONE CELEBRATION ──
// Toast-like celebration when user hits engagement milestones
export function useMilestones() {
  const { org } = useAuth()
  const { transactions, accounts, dailyBalances } = useTreasury()
  const [celebrated, setCelebrated] = useState(() => {
    try { return JSON.parse(localStorage.getItem('vaultline-milestones') || '{}') } catch { return {} }
  })

  const milestones = useMemo(() => {
    const hits = []
    const txCount = transactions.length
    const acctCount = accounts.length
    const dayCount = dailyBalances.length

    if (txCount >= 100 && !celebrated['tx-100']) hits.push({ id: 'tx-100', title: '100 transactions synced', desc: 'Your treasury data is building real intelligence.', icon: '📊' })
    if (txCount >= 1000 && !celebrated['tx-1000']) hits.push({ id: 'tx-1000', title: '1,000 transactions', desc: 'Serious treasury data. Your forecasts are getting smarter.', icon: '🚀' })
    if (acctCount >= 5 && !celebrated['acct-5']) hits.push({ id: 'acct-5', title: '5 accounts connected', desc: 'Multi-account visibility unlocked.', icon: '🏦' })
    if (acctCount >= 10 && !celebrated['acct-10']) hits.push({ id: 'acct-10', title: '10 accounts connected', desc: 'Enterprise-grade treasury coverage.', icon: '⚡' })
    if (dayCount >= 30 && !celebrated['30d-data']) hits.push({ id: '30d-data', title: '30 days of data', desc: 'Forecast accuracy is now meaningful.', icon: '📈' })
    if (dayCount >= 90 && !celebrated['90d-data']) hits.push({ id: '90d-data', title: '90 days of data', desc: 'Seasonal patterns are now detectable.', icon: '🎯' })

    return hits
  }, [transactions.length, accounts.length, dailyBalances.length, celebrated])

  function acknowledge(id) {
    const next = { ...celebrated, [id]: true }
    setCelebrated(next)
    localStorage.setItem('vaultline-milestones', JSON.stringify(next))
  }

  return { milestones, acknowledge }
}

export function MilestoneBanner() {
  const { milestones, acknowledge } = useMilestones()

  if (milestones.length === 0) return null

  const m = milestones[0] // Show one at a time

  return (
    <div className="glass-card rounded-2xl overflow-hidden border-cyan/[0.12] mb-5">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="text-[24px]">{m.icon}</span>
          <div>
            <p className="text-[13px] font-semibold text-t1">{m.title}</p>
            <p className="text-[12px] text-t3 mt-0.5">{m.desc}</p>
          </div>
        </div>
        <button onClick={() => acknowledge(m.id)}
          className="px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-cyan bg-cyan/[0.06] border border-cyan/[0.1] hover:bg-cyan/[0.1] transition-all">
          Nice!
        </button>
      </div>
    </div>
  )
}
