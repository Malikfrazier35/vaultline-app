import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { usePlaid } from '@/hooks/usePlaid'
import { supabase } from '@/lib/supabase'
import { ArrowRight, ArrowLeft, Shield, CreditCard, BarChart3, CheckCircle2, X, Sparkles } from 'lucide-react'

const SLIDES = [
  {
    id: 'welcome',
    icon: Sparkles,
    title: 'Welcome to Vaultline',
    subtitle: 'Your treasury command center is ready.',
    body: 'See every bank account, forecast your cash flow, and catch anomalies before they become problems — all in one place.',
    image: true, // show dashboard screenshot
  },
  {
    id: 'connect',
    icon: CreditCard,
    title: 'Connect your banks',
    subtitle: '12,000+ banks supported via Plaid.',
    body: 'Your credentials never touch our servers. Plaid handles authentication directly with your bank. Connect in under 60 seconds.',
    action: 'plaid', // triggers Plaid Link
  },
  {
    id: 'security',
    icon: Shield,
    title: 'Your data is protected',
    subtitle: 'Enterprise-grade from day one.',
    badges: ['SOC 2 Ready', 'AES-256', 'Row-Level Isolation', 'HSTS Enforced', 'Audit Trail'],
    body: 'Every query is cryptographically isolated to your organization. Full audit trail on every action. Encrypted at rest and in transit.',
  },
  {
    id: 'ready',
    icon: CheckCircle2,
    title: 'You\'re all set',
    subtitle: null, // dynamic based on bank connection
    body: null, // dynamic
    action: 'finish',
  },
]

export default function OnboardingWizard({ onComplete }) {
  const { profile, org } = useAuth()
  const { openPlaidLink, linking } = usePlaid()
  const [step, setStep] = useState(0)
  const [bankConnected, setBankConnected] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Check if onboarding already completed
  useEffect(() => {
    if (org?.onboarding_completed) setDismissed(true)
  }, [org])

  if (dismissed) return null

  const slide = SLIDES[step]
  const isLast = step === SLIDES.length - 1
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  async function handlePlaidConnect() {
    await openPlaidLink()
    setBankConnected(true)
    // Auto-advance to next slide after connection
    setTimeout(() => setStep(s => Math.min(s + 1, SLIDES.length - 1)), 500)
  }

  async function finish() {
    // Mark onboarding as completed
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
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl overflow-hidden shadow-2xl">
        
        {/* Progress dots */}
        <div className="flex items-center justify-between px-6 pt-5">
          <div className="flex gap-2">
            {SLIDES.map((_, i) => (
              <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? 'w-8 bg-cyan' : i < step ? 'w-4 bg-cyan/40' : 'w-4 bg-border'
              }`} />
            ))}
          </div>
          <button onClick={finish} className="text-t3 hover:text-t1 transition p-1" title="Skip setup">
            <X size={16} />
          </button>
        </div>

        {/* Slide content */}
        <div className="px-8 py-8">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan/[0.12] to-purple/[0.08] flex items-center justify-center mb-6">
            <slide.icon size={24} className="text-cyan" />
          </div>

          {/* Welcome personalization */}
          {step === 0 && (
            <p className="text-[13px] text-cyan font-mono font-semibold tracking-wider mb-2">
              Hi {firstName}
            </p>
          )}

          <h2 className="text-2xl font-black tracking-tight mb-2">{slide.title}</h2>
          
          {slide.subtitle && (
            <p className="text-t2 text-[14px] mb-4">{slide.subtitle}</p>
          )}

          {/* Last slide - dynamic content */}
          {isLast && (
            <>
              <p className="text-t2 text-[14px] mb-4">
                {bankConnected
                  ? 'We\'re syncing your accounts now. Your dashboard will be ready in a few seconds.'
                  : 'You can connect your banks anytime from the Bank Connections page.'}
              </p>
            </>
          )}

          {slide.body && <p className="text-t3 text-[13px] leading-relaxed mb-6">{slide.body}</p>}

          {/* Dashboard screenshot placeholder for slide 1 */}
          {slide.image && (
            <div className="rounded-xl border border-border bg-deep p-4 mb-6">
              <div className="flex gap-3 mb-3">
                <div className="flex-1 rounded-lg bg-surface border border-border p-3">
                  <p className="text-[9px] font-mono text-t3 uppercase tracking-wider">Total cash</p>
                  <p className="text-[18px] font-black text-cyan font-mono">$2.26M</p>
                  <p className="text-[10px] text-green font-mono">+3.2%</p>
                </div>
                <div className="flex-1 rounded-lg bg-surface border border-border p-3">
                  <p className="text-[9px] font-mono text-t3 uppercase tracking-wider">Net flow</p>
                  <p className="text-[18px] font-black text-green font-mono">+$47K</p>
                  <p className="text-[10px] text-t3 font-mono">30 days</p>
                </div>
                <div className="flex-1 rounded-lg bg-surface border border-border p-3">
                  <p className="text-[9px] font-mono text-t3 uppercase tracking-wider">Runway</p>
                  <p className="text-[18px] font-black text-t1 font-mono">14.2 mo</p>
                  <p className="text-[10px] text-t3 font-mono">Stable</p>
                </div>
              </div>
              <div className="h-16 rounded-lg bg-gradient-to-r from-cyan/[0.06] to-purple/[0.04] border border-border flex items-center justify-center">
                <BarChart3 size={20} className="text-cyan/40" />
                <span className="text-[10px] text-t3 ml-2 font-mono">90-day balance chart</span>
              </div>
            </div>
          )}

          {/* Security badges for slide 3 */}
          {slide.badges && (
            <div className="flex flex-wrap gap-2 mb-6">
              {slide.badges.map(b => (
                <span key={b} className="text-[10px] font-mono font-semibold uppercase tracking-wider px-3 py-1.5 rounded-lg border border-cyan/[0.15] bg-cyan/[0.04] text-cyan">
                  {b}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-8 pb-8 flex items-center justify-between gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="flex items-center gap-1 text-[13px] text-t3 hover:text-t1 transition">
              <ArrowLeft size={14} /> Back
            </button>
          ) : <div />}

          <div className="flex items-center gap-3">
            {!isLast && (
              <button onClick={skip} className="text-[13px] text-t3 hover:text-t1 transition">
                Skip
              </button>
            )}

            {slide.action === 'plaid' ? (
              <button
                onClick={handlePlaidConnect}
                disabled={linking}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all"
              >
                {linking ? 'Connecting...' : <>Connect Bank <ArrowRight size={14} /></>}
              </button>
            ) : slide.action === 'finish' ? (
              <button
                onClick={finish}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-purple text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all"
              >
                Go to Dashboard <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[13px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all"
              >
                Next <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
