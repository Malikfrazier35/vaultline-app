import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import { Loader2, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => { document.title = 'Reset Password — Vaultline' }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    if (error) setError(error.message)
    else setSent(true)
    setSubmitting(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-void relative">
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[800px] h-[800px] top-[-300px] right-[-200px] bg-[radial-gradient(circle,rgba(34,211,238,0.06)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan to-purple flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(34,211,238,0.25)]">
            <span className="text-void font-black text-lg">V</span>
          </div>
          <h1 className="font-display text-3xl font-black tracking-tight">
            Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span>
          </h1>
        </div>

        <div className="glass-card backdrop-blur-xl rounded-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green/[0.08] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={28} className="text-green" />
              </div>
              <h2 className="font-display text-[20px] font-bold mb-2">Check your email</h2>
              <p className="text-[14px] text-t3 leading-relaxed mb-6">
                We sent a password reset link to <span className="text-t1 font-medium">{email}</span>. Click the link to set a new password.
              </p>
              <p className="text-[12px] text-t4 mb-6">Didn't get the email? Check your spam folder or try again.</p>
              <button onClick={() => { setSent(false); setEmail('') }}
                className="text-[13px] text-cyan font-semibold hover:underline">
                Send again
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <div className="w-11 h-11 rounded-xl bg-cyan/[0.06] flex items-center justify-center mx-auto mb-3">
                  <Mail size={20} className="text-cyan" />
                </div>
                <h2 className="font-display text-[20px] font-bold mb-1">Reset your password</h2>
                <p className="text-[13px] text-t3">Enter your email and we'll send you a reset link.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Email address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
                    className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] font-mono outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                    placeholder="you@company.com" />
                </div>

                {error && <div className="text-red text-[13px] bg-red/[0.06] rounded-xl px-3.5 py-2.5 border border-red/[0.1]">{error}</div>}

                <button type="submit" disabled={submitting}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] shadow-[0_2px_12px_rgba(34,211,238,0.2)] hover:shadow-[0_4px_20px_rgba(34,211,238,0.3)] hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {submitting ? <><Loader2 size={15} className="animate-spin" /> Sending...</> : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>

        <div className="text-center mt-6">
          <Link to="/login" className="inline-flex items-center gap-2 text-[13px] text-t3 hover:text-cyan transition">
            <ArrowLeft size={14} /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
