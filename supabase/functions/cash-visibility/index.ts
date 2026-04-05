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
      case 'dashboard': {
        const { data: positions } = await supabase.from('cash_positions_realtime').select('*').eq('org_id', orgId)
        const { data: buffers } = await supabase.from('liquidity_buffers').select('*').eq('org_id', orgId)
        const { data: rules } = await supabase.from('cash_concentration').select('*').eq('org_id', orgId)
        const { data: snapshots } = await supabase.from('cash_visibility_snapshots').select('snapshot_date, total_cash, total_available, net_position, data_completeness_pct').eq('org_id', orgId).order('snapshot_date', { ascending: false }).limit(30)

        const all = positions || []
        const totalCash = all.reduce((s, p) => s + Number(p.ledger_balance || 0), 0)
        const totalAvailable = all.reduce((s, p) => s + Number(p.available_balance || 0), 0)
        const pendingIn = all.reduce((s, p) => s + Number(p.pending_inflows || 0), 0)
        const pendingOut = all.reduce((s, p) => s + Number(p.pending_outflows || 0), 0)
        const belowMin = all.filter(p => p.below_minimum)
        const stale = all.filter(p => p.stale)

        const allBuffers = buffers || []
        const underfunded = allBuffers.filter(b => b.status !== 'funded')
        const totalRequired = allBuffers.reduce((s, b) => s + Number(b.required_amount || 0), 0)
        const totalFunded = allBuffers.reduce((s, b) => s + Number(b.current_amount || 0), 0)

        return json({
          summary: { total_cash: totalCash, total_available: totalAvailable, pending_inflows: pendingIn, pending_outflows: pendingOut, projected_eod: totalCash + pendingIn - pendingOut, accounts: all.length, stale: stale.length, below_minimum: belowMin.length },
          positions: all,
          buffers: { list: allBuffers, total_required: totalRequired, total_funded: totalFunded, underfunded: underfunded.length },
          concentration_rules: rules || [],
          trend: (snapshots || []).reverse(),
        })
      }

      case 'refresh_position': {
        const { account_id, ledger_balance, available_balance, pending_inflows, pending_outflows, source } = body
        const projected = Number(available_balance || 0) + Number(pending_inflows || 0) - Number(pending_outflows || 0)
        // Check thresholds
        const { data: existing } = await supabase.from('cash_positions_realtime').select('minimum_balance, sweep_threshold').eq('account_id', account_id).eq('org_id', orgId).single()
        const belowMin = existing?.minimum_balance ? Number(available_balance) < Number(existing.minimum_balance) : false
        const aboveSweep = existing?.sweep_threshold ? Number(available_balance) > Number(existing.sweep_threshold) : false

        await supabase.from('cash_positions_realtime').upsert({
          org_id: orgId, account_id, ledger_balance, available_balance,
          pending_inflows: pending_inflows || 0, pending_outflows: pending_outflows || 0,
          projected_eod: projected, source: source || 'api',
          below_minimum: belowMin, above_sweep: aboveSweep, stale: false,
          last_refreshed_at: new Date().toISOString(),
        }, { onConflict: 'org_id,account_id' }).catch(() => {
          supabase.from('cash_positions_realtime').insert({
            org_id: orgId, account_id, ledger_balance, available_balance,
            pending_inflows: pending_inflows || 0, pending_outflows: pending_outflows || 0,
            projected_eod: projected, source: source || 'api', below_minimum: belowMin, above_sweep: aboveSweep,
          })
        })

        // Notify on threshold breach
        if (belowMin) {
          await supabase.from('notifications').insert({
            org_id: orgId, user_id: user.id, type: 'low_cash', severity: 'warning',
            title: 'Account below minimum balance', body: `Account balance ($${Number(available_balance).toLocaleString()}) is below minimum threshold.`,
            channels_sent: ['in_app'],
          }).catch(() => {})
        }
        return json({ success: true, below_minimum: belowMin, above_sweep: aboveSweep })
      }

      case 'set_thresholds': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { account_id, minimum_balance, target_balance, sweep_threshold } = body
        await supabase.from('cash_positions_realtime').update({ minimum_balance, target_balance, sweep_threshold }).eq('account_id', account_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'save_concentration_rule': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { rule_name, rule_type, source_account_id, dest_account_id, trigger_type, trigger_threshold, trigger_target, notify_on_trigger } = body
        const { data } = await supabase.from('cash_concentration').insert({
          org_id: orgId, rule_name, rule_type, source_account_id, dest_account_id,
          trigger_type, trigger_threshold, trigger_target, notify_on_trigger: notify_on_trigger !== false,
        }).select().single()
        return json({ success: true, rule: data })
      }

      case 'save_buffer': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { buffer_name, buffer_type, required_amount, current_amount, entity_id, account_id, alert_below_pct, currency } = body
        const funded = required_amount > 0 ? Math.round((current_amount / required_amount) * 10000) / 100 : 0
        const status = funded >= 100 ? 'excess' : funded >= (alert_below_pct || 80) ? 'funded' : funded >= 50 ? 'underfunded' : 'critical'
        const { data } = await supabase.from('liquidity_buffers').insert({
          org_id: orgId, entity_id, account_id, buffer_name, buffer_type,
          required_amount, current_amount: current_amount || 0, currency: currency || 'USD',
          funded_pct: funded, status, alert_below_pct, last_evaluated_at: new Date().toISOString(),
        }).select().single()
        return json({ success: true, buffer: data })
      }

      // ── DAILY SNAPSHOT (cron) ──
      case 'daily_snapshot': {
        const { data: orgs } = await supabase.from('organizations').select('id')
        let count = 0
        for (const org of (orgs || [])) {
          const { data: positions } = await supabase.from('cash_positions_realtime').select('*').eq('org_id', org.id)
          if (!positions?.length) continue
          const totalCash = positions.reduce((s, p) => s + Number(p.ledger_balance || 0), 0)
          const totalAvail = positions.reduce((s, p) => s + Number(p.available_balance || 0), 0)
          const pendIn = positions.reduce((s, p) => s + Number(p.pending_inflows || 0), 0)
          const pendOut = positions.reduce((s, p) => s + Number(p.pending_outflows || 0), 0)
          const staleCount = positions.filter(p => p.stale).length

          await supabase.from('cash_visibility_snapshots').upsert({
            org_id: org.id, snapshot_date: new Date().toISOString().split('T')[0],
            total_cash: totalCash, total_available: totalAvail,
            total_pending_in: pendIn, total_pending_out: pendOut,
            net_position: totalCash + pendIn - pendOut,
            accounts_reporting: positions.length, accounts_stale: staleCount,
            data_completeness_pct: positions.length > 0 ? Math.round(((positions.length - staleCount) / positions.length) * 100) : 0,
          }, { onConflict: 'org_id,snapshot_date' })
          count++
        }
        return json({ snapshots_taken: count })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
