import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { data: profile } = await supabase.from('profiles').select('id, org_id, role').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })
    const orgId = profile.org_id
    const isAdmin = ['owner', 'admin'].includes(profile.role)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      // ── SECURITY DASHBOARD ──
      case 'dashboard': {
        if (!isAdmin) return json({ error: 'Admin only' })

        const [eventsRes, scoreRes, policyRes, sessionsRes, scanRes] = await Promise.all([
          supabase.from('security_events').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(50),
          supabase.from('security_score').select('*').eq('org_id', orgId).order('calculated_at', { ascending: false }).limit(1).single(),
          supabase.from('security_policies').select('*').eq('org_id', orgId).single(),
          supabase.from('active_sessions').select('*').eq('org_id', orgId).eq('revoked', false).order('last_active_at', { ascending: false }),
          supabase.from('vulnerability_scans').select('*').order('created_at', { ascending: false }).limit(5),
        ])

        const events = eventsRes.data || []
        const unresolvedThreats = events.filter(e => !e.resolved && ['critical', 'high'].includes(e.severity))

        // Event breakdown
        const last24h = events.filter(e => new Date(e.created_at) >= new Date(Date.now() - 86400000))
        const last7d = events.filter(e => new Date(e.created_at) >= new Date(Date.now() - 7 * 86400000))
        const byType: Record<string, number> = {}
        const bySeverity: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
        last7d.forEach(e => { byType[e.event_type] = (byType[e.event_type] || 0) + 1; bySeverity[e.severity]++ })

        return json({
          score: scoreRes.data,
          policy: policyRes.data,
          sessions: sessionsRes.data || [],
          scans: scanRes.data || [],
          events: { recent: events.slice(0, 20), last_24h: last24h.length, last_7d: last7d.length, by_type: byType, by_severity: bySeverity },
          threats: { unresolved: unresolvedThreats.length, items: unresolvedThreats.slice(0, 10) },
        })
      }

      // ── LOG SECURITY EVENT ──
      case 'log_event': {
        const { event_type, severity, description, ip_address, user_agent, geo_location, device_fingerprint, metadata } = body
        await supabase.from('security_events').insert({
          org_id: orgId, user_id: user.id, event_type, severity: severity || 'info',
          description, ip_address, user_agent, geo_location, device_fingerprint, metadata,
        })
        return json({ success: true })
      }

      // ── RESOLVE THREAT ──
      case 'resolve_event': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { event_id } = body
        await supabase.from('security_events').update({ resolved: true, resolved_by: user.id, resolved_at: new Date().toISOString() }).eq('id', event_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ── CALCULATE SECURITY SCORE ──
      case 'calculate_score': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { data: policy } = await supabase.from('security_policies').select('*').eq('org_id', orgId).single()
        if (!policy) return json({ error: 'No security policy' })

        let auth = 0, access = 0, data = 0, compliance = 0, network = 0
        const recommendations: string[] = []

        // Auth scoring (0-20)
        if (policy.mfa_required) auth += 8; else recommendations.push('Enable MFA for all users')
        if (policy.password_min_length >= 12) auth += 4; else recommendations.push('Increase minimum password length to 12+')
        if (policy.password_require_special) auth += 3
        if (policy.max_failed_logins <= 5) auth += 3
        if (policy.lockout_duration_minutes >= 30) auth += 2

        // Access scoring (0-20)
        if (policy.session_timeout_minutes <= 480) access += 5; else recommendations.push('Reduce session timeout to 8 hours or less')
        if (policy.concurrent_sessions_max <= 3) access += 5; else recommendations.push('Limit concurrent sessions to 3')
        if (policy.ip_allowlist_enabled) access += 5; else recommendations.push('Consider enabling IP allowlisting')
        if (policy.after_hours_alerts) access += 5; else recommendations.push('Enable after-hours access alerts')

        // Data scoring (0-20)
        if (policy.export_approval_required) data += 7; else recommendations.push('Require approval for data exports')
        if (policy.data_classification_enabled) data += 7; else recommendations.push('Enable data classification')
        data += 6 // Base: encryption at rest + in transit (always on via Supabase)

        // Compliance scoring (0-20)
        const { count: auditCount } = await supabase.from('audit_log').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
        if ((auditCount || 0) > 0) compliance += 5
        if (policy.audit_retention_days >= 365) compliance += 5; else recommendations.push('Set audit retention to at least 365 days')
        if (policy.security_review_interval_days <= 90) compliance += 5
        if (policy.last_security_review) compliance += 5; else recommendations.push('Schedule a security review')

        // Network scoring (0-20)
        const { count: allowlistCount } = await supabase.from('ip_allowlist').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('enabled', true)
        if (policy.ip_allowlist_enabled && (allowlistCount || 0) > 0) network += 10
        network += 10 // Base: TLS, Supabase network security

        const overall = auth + access + data + compliance + network

        await supabase.from('security_score').insert({
          org_id: orgId, overall_score: overall,
          auth_score: auth, access_score: access, data_score: data,
          compliance_score: compliance, network_score: network,
          breakdown: { auth, access, data, compliance, network },
          recommendations: recommendations.slice(0, 10),
        })

        return json({ score: overall, auth, access, data, compliance, network, recommendations })
      }

      // ── UPDATE SECURITY POLICY ──
      case 'update_policy': {
        if (profile.role !== 'owner') return json({ error: 'Owner only' })
        const allowed = ['mfa_required', 'password_min_length', 'password_require_uppercase', 'password_require_number', 'password_require_special', 'password_expiry_days', 'max_failed_logins', 'lockout_duration_minutes', 'session_timeout_minutes', 'concurrent_sessions_max', 'ip_allowlist_enabled', 'after_hours_alerts', 'business_hours_start', 'business_hours_end', 'export_approval_required', 'api_access_enabled', 'data_classification_enabled', 'audit_retention_days', 'security_review_interval_days']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(body)) { if (allowed.includes(k)) safe[k] = body[k] }
        await supabase.from('security_policies').update(safe).eq('org_id', orgId)
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'security_policy_updated', details: safe })
        return json({ success: true })
      }

      // ── IP ALLOWLIST CRUD ──
      case 'add_ip': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { cidr, label } = body
        if (!cidr) return json({ error: 'CIDR required' })
        await supabase.from('ip_allowlist').insert({ org_id: orgId, cidr, label, created_by: user.id })
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'ip_allowlist_added', details: { cidr, label } })
        return json({ success: true })
      }
      case 'remove_ip': {
        if (!isAdmin) return json({ error: 'Admin only' })
        await supabase.from('ip_allowlist').delete().eq('id', body.ip_id).eq('org_id', orgId)
        return json({ success: true })
      }
      case 'list_ips': {
        const { data } = await supabase.from('ip_allowlist').select('*').eq('org_id', orgId).order('created_at')
        return json({ ips: data || [] })
      }

      // ── SESSION MANAGEMENT ──
      case 'list_sessions': {
        const { data } = await supabase.from('active_sessions').select('*').eq('org_id', orgId).eq('revoked', false).order('last_active_at', { ascending: false })
        return json({ sessions: data || [] })
      }
      case 'revoke_session': {
        if (!isAdmin && body.user_id !== user.id) return json({ error: 'Can only revoke own sessions' })
        await supabase.from('active_sessions').update({ revoked: true }).eq('id', body.session_id)
        await supabase.from('security_events').insert({ org_id: orgId, user_id: user.id, event_type: 'session_revoked', severity: 'info', description: `Session revoked`, metadata: { session_id: body.session_id } })
        return json({ success: true })
      }
      case 'revoke_all_sessions': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const targetUser = body.target_user_id || user.id
        await supabase.from('active_sessions').update({ revoked: true }).eq('org_id', orgId).eq('user_id', targetUser).eq('revoked', false)
        return json({ success: true })
      }

      case 'anomaly_scan': {
        const alerts: any[] = []

        // 1. Velocity check — >20 transactions in 1 hour from single account
        const { data: velocityTx } = await supabase
          .from('transactions')
          .select('account_id, date')
          .eq('org_id', orgId)
          .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        const acctCounts: Record<string, number> = {}
        ;(velocityTx || []).forEach((t: any) => { acctCounts[t.account_id] = (acctCounts[t.account_id] || 0) + 1 })
        Object.entries(acctCounts).forEach(([acctId, count]) => {
          if (count > 20) alerts.push({ type: 'velocity', severity: 'high', message: `${count} transactions in 1 hour on account ${acctId.slice(0,8)}`, account_id: acctId })
        })

        // 2. Balance anomaly — >50% change in 24h
        const { data: accts } = await supabase.from('accounts').select('id, name, current_balance, previous_balance').eq('org_id', orgId)
        ;(accts || []).forEach((a: any) => {
          if (a.previous_balance && a.previous_balance > 0) {
            const pctChange = Math.abs((a.current_balance - a.previous_balance) / a.previous_balance) * 100
            if (pctChange > 50) alerts.push({ type: 'balance_anomaly', severity: 'high', message: `${a.name}: balance changed ${pctChange.toFixed(0)}% in 24h`, account_id: a.id })
          }
        })

        // 3. After-hours activity check
        const { data: afterHours } = await supabase
          .from('security_events')
          .select('*')
          .eq('org_id', orgId)
          .eq('event_type', 'after_hours_login')
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
        if ((afterHours || []).length > 0) {
          alerts.push({ type: 'after_hours', severity: 'medium', message: `${afterHours!.length} after-hours login(s) in last 24h` })
        }

        // 4. Failed login spike
        const { data: failedLogins } = await supabase
          .from('security_events')
          .select('*')
          .eq('org_id', orgId)
          .eq('event_type', 'failed_login')
          .gte('created_at', new Date(Date.now() - 3600000).toISOString())
        if ((failedLogins || []).length >= 5) {
          alerts.push({ type: 'brute_force', severity: 'critical', message: `${failedLogins!.length} failed login attempts in last hour` })
        }

        // 5. Data export check
        const { data: exports } = await supabase
          .from('audit_log')
          .select('*')
          .eq('org_id', orgId)
          .eq('action', 'data_export')
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
        if ((exports || []).length > 3) {
          alerts.push({ type: 'data_exfiltration', severity: 'critical', message: `${exports!.length} data exports in last 24h — possible exfiltration` })
        }

        // 6. Session anomaly — multiple concurrent sessions from different IPs
        const { data: sessions } = await supabase
          .from('active_sessions')
          .select('user_id, ip_address')
          .eq('org_id', orgId)
          .eq('revoked', false)
        const userIps: Record<string, Set<string>> = {}
        ;(sessions || []).forEach((s: any) => {
          if (!userIps[s.user_id]) userIps[s.user_id] = new Set()
          if (s.ip_address) userIps[s.user_id].add(s.ip_address)
        })
        Object.entries(userIps).forEach(([uid, ips]) => {
          if (ips.size > 3) alerts.push({ type: 'session_anomaly', severity: 'high', message: `User ${uid.slice(0,8)} has ${ips.size} active sessions from different IPs`, user_id: uid })
        })

        // Log critical alerts as security events
        for (const alert of alerts.filter(a => a.severity === 'critical')) {
          await supabase.from('security_events').insert({
            org_id: orgId, event_type: `fraud_${alert.type}`, severity: alert.severity,
            description: alert.message, user_id: user.id,
          }).catch(() => {})
        }

        return json({ alerts, scanned_at: new Date().toISOString(), checks: 6 })
      }

      case 'export_check': {
        // Check if user is allowed to export (rate limit + security check)
        const { data: recentExports } = await supabase
          .from('audit_log')
          .select('created_at')
          .eq('org_id', orgId)
          .eq('user_id', user.id)
          .eq('action', 'data_export')
          .gte('created_at', new Date(Date.now() - 86400000).toISOString())
          .order('created_at', { ascending: false })

        const exportCount = (recentExports || []).length
        if (exportCount >= 1) {
          const lastExport = recentExports![0].created_at
          const hoursAgo = Math.round((Date.now() - new Date(lastExport).getTime()) / 3600000)
          return json({ allowed: false, reason: `Rate limited. Last export was ${hoursAgo}h ago. Max 1 per 24h.`, next_allowed_at: new Date(new Date(lastExport).getTime() + 86400000).toISOString() })
        }

        // Check for unresolved security events
        const { data: unresolvedEvents } = await supabase
          .from('security_events')
          .select('id')
          .eq('org_id', orgId)
          .in('severity', ['critical', 'high'])
          .is('resolved_at', null)
          .limit(1)
        if ((unresolvedEvents || []).length > 0) {
          return json({ allowed: false, reason: 'Export blocked. There are unresolved critical security events on this account. Resolve them first.' })
        }

        return json({ allowed: true })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
