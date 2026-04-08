import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Get all active orgs
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, plan, plan_status')
      .in('plan_status', ['active', 'trialing'])

    if (!orgs?.length) return new Response(JSON.stringify({ evaluated: 0 }), { headers: cors })

    const results = { evaluated: 0, alerts_created: 0, details: [] as any[] }

    for (const org of orgs) {
      const orgAlerts: string[] = []

      // Fetch org data
      const [
        { data: accounts },
        { data: connections },
        { data: forecast },
      ] = await Promise.all([
        supabase.from('accounts').select('id, name, current_balance, type')
          .eq('org_id', org.id).eq('is_active', true)
          .or('is_sample.is.null,is_sample.eq.false'),
        supabase.from('bank_connections').select('id, institution_name, status, last_synced_at, error_count')
          .eq('org_id', org.id)
          .or('is_sample.is.null,is_sample.eq.false'),
        supabase.from('forecasts').select('monthly_burn, runway_months')
          .eq('org_id', org.id).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      const totalCash = (accounts || []).reduce((s, a) => s + (a.current_balance || 0), 0)
      const runway = forecast?.runway_months || 0
      const burn = forecast?.monthly_burn || 0

      // ── ALERT: Low cash (below $10K) ──
      if (totalCash > 0 && totalCash < 10000) {
        await createAlert(supabase, org.id, {
          type: 'low_cash',
          title: 'Cash balance critically low',
          message: `Total cash across all accounts is $${totalCash.toLocaleString()}. Review your cash position immediately.`,
          severity: 'critical',
          action_url: '/position',
        })
        orgAlerts.push('low_cash')
      }

      // ── ALERT: Short runway (<3 months) ──
      if (runway > 0 && runway < 3) {
        await createAlert(supabase, org.id, {
          type: 'short_runway',
          title: `Runway is ${runway.toFixed(1)} months`,
          message: `At the current burn rate of $${Math.round(burn).toLocaleString()}/mo, cash will run out in ${runway.toFixed(1)} months.`,
          severity: 'critical',
          action_url: '/forecast',
        })
        orgAlerts.push('short_runway')
      } else if (runway > 0 && runway < 6) {
        await createAlert(supabase, org.id, {
          type: 'moderate_runway',
          title: `Runway is ${runway.toFixed(1)} months`,
          message: `Cash runway is under 6 months. Consider reducing burn or raising capital.`,
          severity: 'warning',
          action_url: '/forecast',
        })
        orgAlerts.push('moderate_runway')
      }

      // ── ALERT: Bank connection errors ──
      const errorConns = (connections || []).filter(c => c.status === 'error')
      for (const conn of errorConns) {
        await createAlert(supabase, org.id, {
          type: 'bank_error',
          title: `${conn.institution_name} sync failed`,
          message: `Bank connection has been in error state. Re-authenticate to resume data syncing.`,
          severity: 'warning',
          action_url: '/banks',
          dedup_key: `bank_error_${conn.id}`,
        })
        orgAlerts.push(`bank_error:${conn.institution_name}`)
      }

      // ── ALERT: Stale data (no sync in 7+ days) ──
      const staleConns = (connections || []).filter(c => {
        if (c.status !== 'connected') return false
        if (!c.last_synced_at) return true
        const daysSince = (Date.now() - new Date(c.last_synced_at).getTime()) / 86400000
        return daysSince > 7
      })
      for (const conn of staleConns) {
        await createAlert(supabase, org.id, {
          type: 'stale_data',
          title: `${conn.institution_name} hasn't synced in over 7 days`,
          message: `Data may be outdated. Click Sync on the Bank Connections page to refresh.`,
          severity: 'info',
          action_url: '/banks',
          dedup_key: `stale_${conn.id}`,
        })
        orgAlerts.push(`stale:${conn.institution_name}`)
      }

      // ── ALERT: Individual account low balance ──
      for (const acct of (accounts || [])) {
        if (acct.type === 'checking' && acct.current_balance < 5000 && acct.current_balance > 0) {
          await createAlert(supabase, org.id, {
            type: 'account_low',
            title: `${acct.name} balance below $5K`,
            message: `Account balance is $${acct.current_balance.toLocaleString()}. Consider transferring funds.`,
            severity: 'warning',
            action_url: '/position',
            dedup_key: `acct_low_${acct.id}`,
          })
          orgAlerts.push(`acct_low:${acct.name}`)
        }
      }

      results.evaluated++
      if (orgAlerts.length) {
        results.alerts_created += orgAlerts.length
        results.details.push({ org: org.name, alerts: orgAlerts })
      }
    }

    return new Response(JSON.stringify(results), { headers: cors })
  } catch (err) {
    console.error('Alert evaluator error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})

// Create alert with deduplication (don't spam same alert within 24h)
async function createAlert(
  supabase: any,
  orgId: string,
  alert: { type: string; title: string; message: string; severity: string; action_url?: string; dedup_key?: string }
) {
  const dedupKey = alert.dedup_key || `${alert.type}_${orgId}`

  // Check if same alert was created in last 24h
  const dayAgo = new Date(Date.now() - 86400000).toISOString()
  const { data: existing } = await supabase
    .from('notifications')
    .select('id')
    .eq('org_id', orgId)
    .eq('type', alert.type)
    .gte('created_at', dayAgo)
    .limit(1)

  if (existing?.length) return // Already alerted recently

  await supabase.from('notifications').insert({
    org_id: orgId,
    type: alert.type,
    title: alert.title,
    message: alert.message,
    severity: alert.severity,
    action_url: alert.action_url,
    is_read: false,
  })
}
