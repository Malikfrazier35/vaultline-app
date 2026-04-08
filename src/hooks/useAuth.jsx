import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({})
const IDLE_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [org, setOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mfaRequired, setMfaRequired] = useState(false)
  const fetchedRef = useRef(false)
  const idleTimerRef = useRef(null)
  const profileRef = useRef(null)

  const signedInRef = useRef(false)

  // ── Idle timeout ──
  const resetIdleTimer = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    idleTimerRef.current = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        try {
          if (profileRef.current?.org_id) {
            await supabase.from('audit_log').insert({
              org_id: profileRef.current.org_id, user_id: session.user.id,
              action: 'session_timeout', resource_type: 'auth',
              details: { reason: 'idle_30m' },
            })
          }
        } catch {}
        await supabase.auth.signOut()
        window.location.href = '/login?reason=timeout'
      }
    }, IDLE_TIMEOUT_MS)
  }, [])

  useEffect(() => {
    if (!user) return
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    events.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }))
    resetIdleTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetIdleTimer))
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current)
    }
  }, [user, resetIdleTimer])

  // ── Audit logger ──
  async function logAuditEvent(action, resourceType, resourceId, details) {
    try {
      const p = profileRef.current
      if (!p?.org_id) return
      await supabase.from('audit_log').insert({
        org_id: p.org_id, user_id: user?.id, action,
        resource_type: resourceType, resource_id: resourceId,
        details: { ...details, user_agent: navigator.userAgent?.slice(0, 200) },
      })
    } catch (err) { console.error('Audit log error:', err) }
  }

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id, mounted)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        const u = session?.user ?? null
        setUser(u)

        if (u) {
          if (!fetchedRef.current) fetchProfile(u.id, mounted)
          if (event === 'SIGNED_IN') {
            signedInRef.current = true
            try {
              await supabase.from('profiles').update({
                last_login: new Date().toISOString(),
                last_active: new Date().toISOString(),
              }).eq('id', u.id)
            } catch { /* non-critical — don't block auth */ }
          }
        } else {
          setProfile(null); setOrg(null); setMfaRequired(false)
          profileRef.current = null; fetchedRef.current = false
          setLoading(false)
        }
      }
    )

    return () => { mounted = false; subscription.unsubscribe() }
  }, [])

  async function fetchProfile(userId, mounted = true) {
    try {
      const { data: prof, error } = await supabase
        .from('profiles').select('*, organizations(*)').eq('id', userId).single()
      if (!mounted) return
      if (prof && !error) {
        setProfile(prof); setOrg(prof.organizations)
        profileRef.current = prof; fetchedRef.current = true

        // Log login event only on fresh sign-in (not page refresh)
        if (signedInRef.current) {
          signedInRef.current = false
          // Fire-and-forget — don't block login on audit writes
          const oid = prof.org_id
          supabase.from('audit_log').insert({
            org_id: oid, user_id: userId,
            action: 'login', resource_type: 'auth',
            details: {
              email: prof.email,
              user_agent: navigator.userAgent?.slice(0, 200),
              timestamp: new Date().toISOString(),
              login_method: 'password',
            },
          }).then(() => {}).catch(() => {})
          supabase.from('security_events').insert({
            org_id: oid,
            event_type: 'successful_login',
            severity: 'info',
            description: `User ${prof.email} signed in`,
            user_id: userId,
          }).then(() => {}).catch(() => {})
          // After-hours detection (CC7.2)
          const hour = new Date().getHours()
          if (hour < 6 || hour > 22) {
            supabase.from('security_events').insert({
              org_id: oid,
              event_type: 'after_hours_login',
              severity: 'warning',
              description: `After-hours login by ${prof.email} at ${new Date().toLocaleTimeString()}`,
              user_id: userId,
            }).then(() => {}).catch(() => {})
          }
        }

        // Check MFA requirement — completely non-throwing
        try {
          const { data: factors, error: mfaErr } = await supabase.auth.mfa.listFactors()
          if (!mfaErr && factors?.totp) {
            const hasVerifiedTOTP = factors.totp.some(f => f.status === 'verified')
            let secSettings = prof.organizations?.security_settings
            if (typeof secSettings === 'string') try { secSettings = JSON.parse(secSettings) } catch { secSettings = {} }
            if (secSettings?.require_mfa && !hasVerifiedTOTP) setMfaRequired(true)
            else setMfaRequired(false)
          }
        } catch { /* MFA not available on this project — safe to ignore */ }
      }
    } catch (err) { console.error('Profile fetch error:', err) }
    finally { if (mounted) setLoading(false) }
  }

  async function signUp({ email, password, fullName, companyName, referralCode }) {
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, company_name: companyName, referral_code: referralCode || null } },
    })
    return { data, error }
  }

  async function signIn({ email, password }) {
    fetchedRef.current = false
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    
    // Log failed login attempts (SOC 2 CC7.2 — monitoring)
    if (error) {
      try {
        await supabase.from('security_events').insert({
          org_id: null,
          event_type: 'failed_login',
          severity: 'warning',
          description: `Failed login attempt for ${email}: ${error.message}`,
          source_ip: null, // server-side only
          user_id: null,
        })
      } catch {} // non-critical
    }
    
    return { data, error }
  }

  async function signOut() {
    try {
      if (profileRef.current?.org_id) {
        await supabase.from('audit_log').insert({
          org_id: profileRef.current.org_id, user_id: user?.id,
          action: 'logout', resource_type: 'auth',
          details: { email: user?.email },
        })
      }
      await supabase.auth.signOut()
    } catch (err) { console.error('Sign out error:', err) }
    finally {
      setUser(null); setProfile(null); setOrg(null); setMfaRequired(false)
      profileRef.current = null; fetchedRef.current = false
      window.location.href = '/'
    }
  }

  // ── MFA ──
  async function enrollMFA() {
    return await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator App' })
  }
  async function verifyMFA(factorId, code) {
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr) return { error: chErr }
    const { data, error } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code })
    if (!error) {
      setMfaRequired(false)
      await logAuditEvent('mfa_enrolled', 'auth', factorId, { method: 'totp' })
    }
    return { data, error }
  }
  async function unenrollMFA(factorId) {
    const { data, error } = await supabase.auth.mfa.unenroll({ factorId })
    if (!error) await logAuditEvent('mfa_unenrolled', 'auth', factorId, {})
    return { data, error }
  }
  async function listMFAFactors() {
    return await supabase.auth.mfa.listFactors()
  }

  // ── SSO ──
  async function signInWithSSO(domain) {
    return await supabase.auth.signInWithSSO({ domain })
  }

  async function refetch() {
    if (user?.id) await fetchProfile(user.id)
  }

  return (
    <AuthContext.Provider value={{
      user, profile, org, loading, mfaRequired,
      signUp, signIn, signOut, refetch, logAuditEvent,
      enrollMFA, verifyMFA, unenrollMFA, listMFAFactors, signInWithSSO,
      isOwner: profile?.role === 'owner',
      isAdmin: ['owner', 'admin'].includes(profile?.role),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
