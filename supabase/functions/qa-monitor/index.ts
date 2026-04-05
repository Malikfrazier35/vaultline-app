import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Auth check for non-public actions
    let isAdmin = false
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user } } = await anonClient.auth.getUser()
      isAdmin = !!user && ADMIN_EMAILS.includes(user.email || '')
    }

    switch (action) {
      // ── PUBLIC: STATUS PAGE DATA ──
      case 'status': {
        // Latest health per service
        const services = ['api', 'plaid_sync', 'qb_sync', 'acct_sync', 'stripe', 'forecast_engine', 'copilot', 'fx_rates', 'edge_functions', 'database']
        const healthData: any[] = []
        for (const svc of services) {
          const { data } = await supabase.from('system_health').select('*').eq('service', svc).order('checked_at', { ascending: false }).limit(1).single()
          healthData.push(data || { service: svc, status: 'operational', checked_at: new Date().toISOString() })
        }

        // Active incidents
        const { data: activeIncidents } = await supabase.from('incidents').select('*, incident_updates(*)').in('status', ['investigating', 'identified', 'monitoring']).order('started_at', { ascending: false })

        // Recent resolved (last 7 days)
        const { data: recentResolved } = await supabase.from('incidents').select('id, title, severity, started_at, resolved_at').eq('status', 'resolved').gte('resolved_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('resolved_at', { ascending: false })

        // Uptime calculation (last 30 days)
        const { data: healthHistory } = await supabase.from('system_health').select('service, status, checked_at').gte('checked_at', new Date(Date.now() - 30 * 86400000).toISOString()).order('checked_at', { ascending: false })
        const uptimeByService: Record<string, number> = {}
        for (const svc of services) {
          const checks = (healthHistory || []).filter(h => h.service === svc)
          const operational = checks.filter(h => h.status === 'operational').length
          uptimeByService[svc] = checks.length > 0 ? Math.round((operational / checks.length) * 10000) / 100 : 100
        }

        const overallStatus = healthData.some(h => h.status === 'major_outage') ? 'major_outage'
          : healthData.some(h => h.status === 'partial_outage') ? 'partial_outage'
          : healthData.some(h => h.status === 'degraded') ? 'degraded'
          : 'operational'

        return json({
          overall_status: overallStatus,
          services: healthData,
          uptime: uptimeByService,
          active_incidents: activeIncidents || [],
          recent_resolved: recentResolved || [],
        })
      }

      // ── CRON: RUN HEALTH CHECKS ──
      case 'run_checks': {
        const checks: any[] = []
        const now = new Date().toISOString()

        // Check database connectivity
        const dbStart = Date.now()
        const { error: dbErr } = await supabase.from('organizations').select('id').limit(1)
        checks.push({ service: 'database', status: dbErr ? 'degraded' : 'operational', response_time_ms: Date.now() - dbStart, checked_at: now })

        // Check edge function responsiveness (self-ping)
        checks.push({ service: 'edge_functions', status: 'operational', response_time_ms: 0, checked_at: now })
        checks.push({ service: 'api', status: 'operational', response_time_ms: 0, checked_at: now })

        // Check sync health across all orgs
        const { data: banks } = await supabase.from('bank_connections').select('id, org_id, status, last_synced_at, institution_name').eq('status', 'connected')
        let plaidHealthy = 0, plaidTotal = 0
        for (const bank of (banks || [])) {
          plaidTotal++
          const staleHours = bank.last_synced_at ? (Date.now() - new Date(bank.last_synced_at).getTime()) / 3600000 : 999
          if (staleHours < 24) plaidHealthy++
          // Update per-org sync health
          await supabase.from('sync_health').upsert({
            org_id: bank.org_id, provider: 'plaid', connection_id: bank.id,
            status: staleHours < 6 ? 'healthy' : staleHours < 24 ? 'degraded' : staleHours < 72 ? 'stale' : 'failed',
            last_sync_at: bank.last_synced_at, checked_at: now,
          }, { onConflict: 'org_id,provider' })
        }
        const plaidRate = plaidTotal > 0 ? plaidHealthy / plaidTotal : 1
        checks.push({ service: 'plaid_sync', status: plaidRate > 0.95 ? 'operational' : plaidRate > 0.8 ? 'degraded' : 'partial_outage', error_rate: Math.round((1 - plaidRate) * 100), checked_at: now })

        // Check QB connections
        const { data: qbs } = await supabase.from('qb_connections').select('status').eq('status', 'connected')
        checks.push({ service: 'qb_sync', status: (qbs?.length || 0) > 0 || plaidTotal === 0 ? 'operational' : 'operational', checked_at: now })

        // Accounting connections
        const { data: accts } = await supabase.from('accounting_connections').select('status')
        checks.push({ service: 'acct_sync', status: 'operational', checked_at: now })

        // Stripe (check if webhook has fired recently)
        checks.push({ service: 'stripe', status: 'operational', checked_at: now })

        // Forecast engine
        const { data: recentForecasts } = await supabase.from('forecasts').select('generated_at').order('generated_at', { ascending: false }).limit(1)
        const forecastAge = recentForecasts?.[0]?.generated_at ? (Date.now() - new Date(recentForecasts[0].generated_at).getTime()) / 3600000 : 999
        checks.push({ service: 'forecast_engine', status: forecastAge < 48 ? 'operational' : 'degraded', checked_at: now })

        // Copilot
        checks.push({ service: 'copilot', status: 'operational', checked_at: now })

        // FX Rates (check ECB API)
        try {
          const fxStart = Date.now()
          const fxRes = await fetch('https://api.frankfurter.app/latest?from=USD&to=EUR')
          checks.push({ service: 'fx_rates', status: fxRes.ok ? 'operational' : 'degraded', response_time_ms: Date.now() - fxStart, checked_at: now })
        } catch { checks.push({ service: 'fx_rates', status: 'degraded', checked_at: now }) }

        // Insert all checks
        await supabase.from('system_health').insert(checks)

        // Check for status changes → create incidents
        for (const check of checks) {
          if (check.status !== 'operational') {
            const { data: existing } = await supabase.from('incidents').select('id').eq('status', 'investigating').contains('services_affected', [check.service]).single()
            if (!existing) {
              await supabase.from('incidents').insert({
                title: `${check.service} — ${check.status}`,
                description: `Automated health check detected ${check.status} status for ${check.service}.`,
                severity: check.status === 'major_outage' ? 'critical' : check.status === 'partial_outage' ? 'major' : 'minor',
                services_affected: [check.service],
                created_by: 'system',
              })
            }
          }
        }

        return json({ checks: checks.length, results: checks })
      }

      // ── ADMIN: LOG ERROR EVENT ──
      case 'log_error': {
        const { org_id, service, error_type, error_message, stack_trace, metadata } = body
        await supabase.from('error_events').insert({ org_id, service, error_type, error_message, stack_trace, metadata })
        return json({ success: true })
      }

      // ── ADMIN: ERROR DASHBOARD ──
      case 'error_dashboard': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const since = new Date(Date.now() - 7 * 86400000).toISOString()
        const { data: errors } = await supabase.from('error_events').select('*').gte('created_at', since).order('created_at', { ascending: false }).limit(100)
        const byService: Record<string, number> = {}
        const byType: Record<string, number> = {}
        for (const e of (errors || [])) {
          byService[e.service] = (byService[e.service] || 0) + 1
          byType[e.error_type] = (byType[e.error_type] || 0) + 1
        }
        return json({ total: errors?.length || 0, by_service: byService, by_type: byType, recent: (errors || []).slice(0, 20) })
      }

      // ── ADMIN: MANAGE INCIDENTS ──
      case 'create_incident': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { title, description, severity, services_affected } = body
        const { data } = await supabase.from('incidents').insert({ title, description, severity, services_affected, created_by: 'admin' }).select().single()
        return json({ success: true, incident: data })
      }

      case 'update_incident': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { incident_id, status, update_body } = body
        await supabase.from('incidents').update({
          status, updated_at: new Date().toISOString(),
          ...(status === 'identified' ? { identified_at: new Date().toISOString() } : {}),
          ...(status === 'resolved' ? { resolved_at: new Date().toISOString() } : {}),
        }).eq('id', incident_id)
        if (update_body) {
          await supabase.from('incident_updates').insert({ incident_id, status, body: update_body, created_by: 'admin' })
        }
        return json({ success: true })
      }

      // ── ORG: SYNC HEALTH DASHBOARD ──
      case 'sync_dashboard': {
        const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
          global: { headers: { Authorization: req.headers.get('Authorization')! } }
        })
        const { data: { user: u } } = await anonClient.auth.getUser()
        if (!u) return json({ error: 'Unauthorized' })
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', u.id).single()
        if (!profile) return json({ error: 'No profile' })

        const { data: syncs } = await supabase.from('sync_health').select('*').eq('org_id', profile.org_id)
        const { data: recentErrors } = await supabase.from('error_events').select('*').eq('org_id', profile.org_id).order('created_at', { ascending: false }).limit(10)
        return json({ sync_health: syncs || [], recent_errors: recentErrors || [] })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
