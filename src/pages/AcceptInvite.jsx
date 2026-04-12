import { useState, useEffect } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { safeInvoke } from '@/lib/safeInvoke'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { CheckCircle2, AlertTriangle, Loader2, LogIn, Users } from 'lucide-react'

export default function AcceptInvite() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, refetch } = useAuth()
  const token = searchParams.get('token')
  const [status, setStatus] = useState('loading') // loading | needs_auth | accepting | success | error
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)

  useEffect(() => { document.title = 'Accept Invitation \u2014 Vaultline' }, [])

  useEffect(() => {
    if (!token) { setStatus('error'); setError('No invitation token found.'); return }
    if (!user) { setStatus('needs_auth'); return }
    acceptInvite()
  }, [token, user])

  async function acceptInvite() {
    setStatus('accepting')
    try {
      const { data, error: fnErr } = await safeInvoke('team-manage', { action: 'accept_invite', token })
      if (fnErr || data?.error) {
        setStatus('error')
        setError(data?.error || fnErr || 'Failed to accept invitation')
        return
      }
      setResult(data)
      setStatus('success')
      refetch?.()
      setTimeout(() => navigate('/home'), 3000)
    } catch (err) {
      setStatus('error')
      setError(err.message || 'Something went wrong')
    }
  }

  function handleLogin() {
    const returnUrl = `/accept-invite?token=${token}`
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--color-background-tertiary, #0C1222)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-display font-extrabold tracking-tight">
            Vault<span className="text-cyan">line</span>
          </h1>
        </div>

        <div className="glass-card rounded-2xl p-8 text-center">
          {status === 'loading' && (
            <>
              <Loader2 size={32} className="animate-spin text-cyan mx-auto mb-4" />
              <p className="text-[14px] text-t2">Processing invitation...</p>
            </>
          )}

          {status === 'needs_auth' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-cyan/[0.08] flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-cyan" />
              </div>
              <h2 className="text-[18px] font-display font-bold mb-2">You've been invited</h2>
              <p className="text-[14px] text-t2 mb-6">Sign in or create an account to join your team on Vaultline.</p>
              <div className="space-y-3">
                <button onClick={handleLogin}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                  <LogIn size={16} /> Sign in to accept
                </button>
                <Link to={`/signup?redirect=${encodeURIComponent(`/accept-invite?token=${token}`)}`}
                  className="block w-full px-6 py-3 rounded-xl border border-border text-[14px] text-t2 font-semibold hover:border-border-hover transition text-center">
                  Create an account
                </Link>
              </div>
            </>
          )}

          {status === 'accepting' && (
            <>
              <Loader2 size={32} className="animate-spin text-cyan mx-auto mb-4" />
              <p className="text-[14px] text-t2">Accepting invitation...</p>
              <p className="text-[12px] text-t3 font-mono mt-2">Joining organization</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-green/[0.08] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={24} className="text-green" />
              </div>
              <h2 className="text-[18px] font-display font-bold mb-2">You're in!</h2>
              <p className="text-[14px] text-t2 mb-1">You've joined as <span className="font-semibold text-cyan">{result?.role || 'member'}</span>.</p>
              <p className="text-[12px] text-t3 font-mono">Redirecting to dashboard...</p>
              <Link to="/home" className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition">
                Go to dashboard
              </Link>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-14 h-14 rounded-2xl bg-red/[0.08] flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={24} className="text-red" />
              </div>
              <h2 className="text-[18px] font-display font-bold mb-2">Invitation failed</h2>
              <p className="text-[14px] text-t2 mb-4">{error}</p>
              <div className="space-y-2">
                <Link to="/home" className="block w-full px-6 py-2.5 rounded-xl border border-border text-[13px] text-t2 font-semibold hover:border-border-hover transition text-center">
                  Go to dashboard
                </Link>
                <p className="text-[11px] text-t3 font-mono">Contact your team admin for a new invitation</p>
              </div>
            </>
          )}
        </div>

        <p className="text-center text-[11px] text-t4 font-mono mt-6">Vaultline Treasury Platform</p>
      </div>
    </div>
  )
}
