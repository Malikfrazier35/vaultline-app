import AnimatedBackground from "@/components/AnimatedBackground"
import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { Navigate, Link, useSearchParams } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import { Loader2, ArrowRight, Shield } from 'lucide-react'

export default function Login() {
  const { user, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [socialLoading, setSocialLoading] = useState(null)
  const [searchParams] = useSearchParams()

  const isReturning = searchParams.get('expired') === 'true' || localStorage.getItem('vaultline-has-session')
  const savedEmail = localStorage.getItem('vaultline-last-email') || ''
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  useEffect(() => {
    document.title = 'Sign In \u2014 Vaultline'
    if (savedEmail && !email) setEmail(savedEmail)
  }, [])

  if (loading) return <LoadingScreen />
  if (user) {
    localStorage.setItem('vaultline-has-session', 'true')
    localStorage.setItem('vaultline-last-email', user.email || '')
    return <Navigate to={redirectTo} replace />
  }

  const [failedAttempts, setFailedAttempts] = useState(0)

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (failedAttempts >= 5) {
      setError('Too many failed attempts. Please wait a few minutes or reset your password.')
      return
    }
    setSubmitting(true)
    const { error } = await signIn({ email, password })
    if (error) {
      setError(error.message)
      setFailedAttempts(prev => prev + 1)
    } else {
      setFailedAttempts(0)
    }
    setSubmitting(false)
  }

  async function handleSocial(provider) {
    setSocialLoading(provider)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}${redirectTo}` }
    })
    if (error) { setError(error.message); setSocialLoading(null) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center relative" style={{ background:'var(--color-void)' }}>
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
          {isReturning ? (
            <div className="mt-3">
              <p className="text-[16px] text-t1 font-semibold">Welcome back</p>
              <p className="text-[14px] text-t2 mt-0.5">Sign in to pick up where you left off</p>
            </div>
          ) : (
            <p className="text-[13px] text-t3 mt-2">Real-time treasury intelligence for mid-market teams</p>
          )}
        </div>

        {/* Session expired notice */}
        {searchParams.get('expired') === 'true' && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber/[0.04] border border-amber/[0.12] text-[13px] text-amber">
            <Shield size={14} className="shrink-0" />
            Your session has ended for security. Please sign in again.
          </div>
        )}
        {searchParams.get('reason') === 'timeout' && (
          <div className="mb-4 flex items-center gap-2.5 px-4 py-3 rounded-xl bg-amber/[0.04] border border-amber/[0.12] text-[13px] text-amber">
            <Shield size={14} className="shrink-0" />
            Session timed out after 30 minutes of inactivity. Please sign in again.
          </div>
        )}

        <div className="glass-card backdrop-blur-xl rounded-2xl p-8">
          {/* Social login buttons */}
          <div className="space-y-2.5 mb-6">
            <button onClick={() => handleSocial('apple')} disabled={socialLoading === 'apple'}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-surface border border-border text-t1 text-[14px] font-semibold hover:border-border-hover active:bg-deep transition-all disabled:opacity-50">
              {socialLoading === 'apple' ? <Loader2 size={18} className="animate-spin" /> : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
              )}
              Continue with Apple
            </button>

            <button onClick={() => handleSocial('google')} disabled={socialLoading === 'google'}
              className="w-full flex items-center justify-center gap-3 py-3 rounded-xl glass-card text-t1 text-[14px] font-semibold hover:border-border-hover active:bg-deep transition-all disabled:opacity-50">
              {socialLoading === 'google' ? <Loader2 size={18} className="animate-spin" /> : (
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              )}
              Continue with Google
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
            <div>
              <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] font-mono outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                placeholder="you@company.com" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em]">Password</label>
                <Link to="/forgot-password" className="text-[11px] text-cyan hover:underline font-medium">Forgot password?</Link>
              </div>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required
                className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] font-mono outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                placeholder="Enter your password" />
            </div>

            {error && <div className="text-red text-[13px] bg-red/[0.06] rounded-xl px-3.5 py-2.5 border border-red/[0.1]">{error}</div>}

            <button type="submit" disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] glow-sm hover:glow-md hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <><Loader2 size={15} className="animate-spin" /> SIGNING IN...</> : <><span>SIGN IN</span> <ArrowRight size={14} /></>}
            </button>
          </form>

          <p className="text-center text-[13px] text-t2 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-cyan font-semibold hover:underline">Get started</Link>
          </p>
        </div>

        <p className="text-center text-[12px] text-t3 mt-6">
          By signing in, you agree to our <Link to="/terms" className="text-t3 hover:text-cyan">Terms</Link> and <Link to="/privacy" className="text-t3 hover:text-cyan">Privacy Policy</Link>
        </p>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return <div className="min-h-screen flex items-center justify-center bg-void"><div className="w-8 h-8 border-2 border-cyan border-t-transparent rounded-full animate-spin" /></div>
}
