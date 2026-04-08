import AnimatedBackground from "@/components/AnimatedBackground"
import { useState } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useSEO } from '@/hooks/useSEO'
import { useAuth } from '@/hooks/useAuth'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import { Loader2, Check } from 'lucide-react'

export default function Signup() {
  const { user, loading, signUp } = useAuth()
  const [searchParams] = useSearchParams()
  const refCode = searchParams.get('ref')
  const [form, setForm] = useState({ fullName: '', companyName: '', email: '', password: '' })
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [socialLoading, setSocialLoading] = useState(null)
  useSEO({ title: 'Create Account', description: 'Start your free trial. No credit card required. Real-time treasury management for mid-market finance teams.', canonical: '/signup' })

  if (loading) return null
  if (user) return <Navigate to="/dashboard" replace />

  function update(field) {
    return (e) => setForm({ ...form, [field]: e.target.value })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    // CC6.2 — Password complexity enforcement
    const p = form.password
    if (p.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(p)) { setError('Password must include an uppercase letter'); return }
    if (!/[a-z]/.test(p)) { setError('Password must include a lowercase letter'); return }
    if (!/[0-9]/.test(p)) { setError('Password must include a number'); return }
    if (!/[^A-Za-z0-9]/.test(p)) { setError('Password must include a special character (!@#$%)'); return }
    setSubmitting(true)
    const { error } = await signUp({ ...form, referralCode: refCode })
    if (error) setError(error.message)
    else setSuccess(true)
    setSubmitting(false)
  }

  async function handleSocial(provider) {
    setSocialLoading(provider)
    setError(null)
    const redirectUrl = refCode
      ? `${window.location.origin}/dashboard?ref=${refCode}`
      : `${window.location.origin}/dashboard`
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: redirectUrl }
    })
    if (error) { setError(error.message); setSocialLoading(null) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ background:'#FAFBFC', '--color-void':'#FAFBFC','--color-deep':'#F1F5F9','--color-surface':'#FFFFFF','--color-card':'#FFFFFF','--color-elevated':'#F8FAFC','--color-t1':'#0F172A','--color-t2':'#475569','--color-t3':'#94A3B8','--color-t4':'#CBD5E1','--color-border':'rgba(15,23,42,0.08)','--color-border-hover':'rgba(15,23,42,0.16)','--color-border-cyan':'rgba(14,165,180,0.22)','--color-cyan':'#0891B2','--color-cyan-bright':'#06B6D4','--color-cyan-glow':'rgba(8,145,178,0.06)','--color-green':'#16A34A','--color-red':'#DC2626','--color-amber':'#D97706','--color-purple':'#7C3AED' }}>
      <AnimatedBackground variant="dots" />
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[800px] h-[800px] top-[-300px] right-[-200px] bg-[radial-gradient(circle,var(--color-cyan-glow)_0%,transparent_60%)] pointer-events-none" />
      <div className="absolute w-[600px] h-[600px] bottom-[-200px] left-[-100px] bg-[radial-gradient(circle,rgba(129,140,248,0.04)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan to-purple flex items-center justify-center mx-auto mb-4 glow-md">
            <span className="text-void font-black text-lg">V</span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight">
            Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
          </h1>
          <p className="text-[13px] text-t3 mt-2">14-day free trial · No credit card required</p>
          <div className="flex items-center justify-center gap-4 mt-4">
            {['SOC 2 Ready', 'AES-256', 'Bank-Grade Security'].map(b => (
              <span key={b} className="text-[9px] font-mono text-t4 border border-border/40 rounded px-2 py-0.5">{b}</span>
            ))}
          </div>
          {refCode && (
            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green/[0.06] border border-green/[0.08]">
              <Check size={12} className="text-green" />
              <span className="text-[12px] font-mono text-green font-semibold">Referral applied — 20% off your first month</span>
            </div>
          )}
        </div>

        <div className="glass-card backdrop-blur-xl rounded-2xl p-8">
          {success ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green/[0.08] flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-green" />
              </div>
              <h3 className="text-[18px] font-bold mb-2">Check your email</h3>
              <p className="text-[14px] text-t2">We sent a confirmation link to <strong className="text-t1">{form.email}</strong></p>
            </div>
          ) : (
            <>
              {/* Social signup */}
              <div className="space-y-2.5 mb-6">
                <button onClick={() => handleSocial('apple')} disabled={socialLoading === 'apple'}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-black text-[14px] font-semibold hover:bg-gray-100 transition-all disabled:opacity-50">
                  {socialLoading === 'apple' ? <Loader2 size={18} className="animate-spin" /> : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
                  )}
                  Sign up with Apple
                </button>

                <button onClick={() => handleSocial('google')} disabled={socialLoading === 'google'}
                  className="w-full flex items-center justify-center gap-3 py-3 rounded-xl glass-card text-t1 text-[14px] font-semibold hover:border-border-hover active:bg-deep transition-all disabled:opacity-50">
                  {socialLoading === 'google' ? <Loader2 size={18} className="animate-spin" /> : (
                    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                  )}
                  Sign up with Google
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[13px] text-t2 font-medium uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Email form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Full Name</label>
                    <input type="text" value={form.fullName} onChange={update('fullName')} required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-deep border border-border text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                      placeholder="Jane Smith" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Company</label>
                    <input type="text" value={form.companyName} onChange={update('companyName')} required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-deep border border-border text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                      placeholder="Acme Corp" />
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Work Email</label>
                  <input type="email" value={form.email} onChange={update('email')} required
                    className="w-full px-3.5 py-2.5 rounded-xl bg-deep border border-border text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                    placeholder="you@company.com" />
                </div>
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Password</label>
                  <input type="password" value={form.password} onChange={update('password')} required minLength={8}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-deep border border-border text-t1 text-[14px] outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                    placeholder="Minimum 8 characters" />
                  {form.password.length > 0 && (() => {
                    const p = form.password
                    const checks = [p.length >= 8, /[A-Z]/.test(p), /[a-z]/.test(p), /[0-9]/.test(p), /[^A-Za-z0-9]/.test(p)]
                    const score = checks.filter(Boolean).length
                    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
                    const colors = ['', 'bg-red', 'bg-amber', 'bg-amber', 'bg-green', 'bg-green']
                    const textColors = ['', 'text-red', 'text-amber', 'text-amber', 'text-green', 'text-green']
                    return (
                      <div className="mt-2">
                        <div className="flex gap-1 mb-1.5">
                          {[1,2,3,4,5].map(i => (
                            <div key={i} className={`h-[3px] flex-1 rounded-full transition-all duration-300 ${i <= score ? colors[score] : 'bg-border/30'}`} />
                          ))}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-mono font-bold ${textColors[score]}`}>{labels[score]}</span>
                          <div className="flex gap-3 text-[10px] font-mono text-t4">
                            <span className={checks[0] ? 'text-green' : ''}>8+ chars</span>
                            <span className={checks[1] ? 'text-green' : ''}>A-Z</span>
                            <span className={checks[3] ? 'text-green' : ''}>0-9</span>
                            <span className={checks[4] ? 'text-green' : ''}>!@#</span>
                          </div>
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {error && <div className="text-red text-[13px] bg-red/[0.06] rounded-xl px-3.5 py-2.5 border border-red/[0.1]">{error}</div>}

                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] glow-sm hover:glow-md hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Creating account...</> : 'Create Account'}
                </button>

                <p className="text-center text-[12px] text-t3">Card collected at checkout · Not charged until day 15</p>
              </form>
            </>
          )}

          {!success && (
            <p className="text-center text-[13px] text-t2 mt-6">
              Already have an account?{' '}
              <Link to="/login" className="text-cyan font-semibold hover:underline">Sign in</Link>
            </p>
          )}
        </div>

        <p className="text-center text-[12px] text-t3 mt-6">
          By signing up, you agree to our <Link to="/terms" className="text-t3 hover:text-cyan">Terms</Link> and <Link to="/privacy" className="text-t3 hover:text-cyan">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}
