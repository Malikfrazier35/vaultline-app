import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import ThemeToggle from '@/components/ThemeToggle'
import { useToast } from '@/components/Toast'
import { Loader2, KeyRound, Check, Eye, EyeOff } from 'lucide-react'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => { document.title = 'Set New Password — Vaultline' }, [])

  // Password strength
  const checks = password.length > 0
    ? [password.length >= 8, /[A-Z]/.test(password), /[a-z]/.test(password), /[0-9]/.test(password), /[^A-Za-z0-9]/.test(password)]
    : []
  const score = checks.filter(Boolean).length
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent']
  const colors = ['', 'bg-red', 'bg-amber', 'bg-amber', 'bg-green', 'bg-green']
  const textColors = ['', 'text-red', 'text-amber', 'text-amber', 'text-green', 'text-green']

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setSubmitting(true)
    const { error } = await supabase.auth.updateUser({ password })
    setSubmitting(false)
    if (error) {
      setError(error.message)
      toast.error(error.message, 'Password update failed')
    } else {
      setDone(true)
      toast.success('Password updated successfully')
      setTimeout(() => navigate('/dashboard'), 3000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-void relative">
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <div className="absolute w-[800px] h-[800px] top-[-300px] right-[-200px] bg-[radial-gradient(circle,rgba(34,211,238,0.06)_0%,transparent_60%)] pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px] px-6">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan to-purple flex items-center justify-center mx-auto mb-4 shadow-[0_4px_20px_rgba(34,211,238,0.25)]">
            <KeyRound size={22} className="text-void" />
          </div>
          <h1 className="font-display text-2xl font-black tracking-tight">Set new password</h1>
          <p className="text-[13px] text-t3 mt-2">Choose a strong password for your account</p>
        </div>

        <div className="glass-card backdrop-blur-xl rounded-2xl p-8">
          {done ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 rounded-2xl bg-green/[0.06] border border-green/[0.12] flex items-center justify-center mx-auto mb-4">
                <Check size={28} className="text-green" />
              </div>
              <h2 className="text-[18px] font-bold text-t1 mb-2">Password updated</h2>
              <p className="text-[14px] text-t3">Redirecting to dashboard...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">New password</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    required minLength={8} autoFocus
                    className="w-full px-4 py-3 pr-10 rounded-xl glass-input text-t1 text-[14px] font-mono outline-none focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20 transition placeholder:text-t3"
                    placeholder="Minimum 8 characters"
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-t4 hover:text-t2 transition">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password.length > 0 && (
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
                )}
              </div>

              <div>
                <label className="block text-[11px] font-mono font-semibold text-t3 uppercase tracking-[0.08em] mb-1.5">Confirm password</label>
                <input
                  type={showPw ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)}
                  required minLength={8}
                  className={`w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] font-mono outline-none transition placeholder:text-t3 ${
                    confirm.length > 0 && confirm !== password ? 'border-red/40 focus:border-red/60 focus:ring-red/20' : 'focus:border-cyan/40 focus:ring-1 focus:ring-cyan/20'
                  }`}
                  placeholder="Re-enter password"
                />
                {confirm.length > 0 && confirm !== password && (
                  <p className="text-[11px] text-red mt-1 font-mono">Passwords don't match</p>
                )}
                {confirm.length > 0 && confirm === password && password.length >= 8 && (
                  <p className="text-[11px] text-green mt-1 font-mono flex items-center gap-1"><Check size={10} /> Passwords match</p>
                )}
              </div>

              {error && <div className="text-red text-[13px] bg-red/[0.06] rounded-xl px-3.5 py-2.5 border border-red/[0.1]">{error}</div>}

              <button type="submit" disabled={submitting || password.length < 8 || password !== confirm}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[14px] shadow-[0_2px_12px_rgba(34,211,238,0.2)] hover:shadow-[0_4px_20px_rgba(34,211,238,0.3)] hover:-translate-y-px active:scale-[0.98] active:translate-y-0 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting ? <><Loader2 size={15} className="animate-spin" /> Updating...</> : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
