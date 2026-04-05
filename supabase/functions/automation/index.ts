import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Optional auth
    let user: any = null, profile: any = null, orgId: string | null = null, isAdmin = false
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user: u } } = await anonClient.auth.getUser()
      user = u
      if (user) {
        const { data: p } = await supabase.from('profiles').select('id, org_id, role').eq('id', user.id).single()
        profile = p; orgId = p?.org_id; isAdmin = ['owner', 'admin'].includes(p?.role)
      }
    }

    switch (action) {
      // ═══ AUTOMATION RULES ═══
      case 'dashboard': {
        if (!orgId) return json({ error: 'Auth required' })
        const { data: rules } = await supabase.from('automation_rules').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        const { data: executions } = await supabase.from('automation_executions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20)
        const { data: webhooks } = await supabase.from('webhook_subscriptions').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        const { data: changelog } = await supabase.from('changelog_entries').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(10)

        const allRules = rules || []
        const activeRules = allRules.filter(r => r.enabled)
        const totalExecs = (executions || []).length
        const failedExecs = (executions || []).filter(e => e.status === 'failed').length

        return json({
          rules: { total: allRules.length, active: activeRules.length, list: allRules },
          executions: { recent: executions || [], total_recent: totalExecs, failed: failedExecs },
          webhooks: webhooks || [],
          changelog: changelog || [],
        })
      }

      case 'create_rule': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { rule_name, description, trigger_type, trigger_conditions, actions: ruleActions, schedule_cron, max_executions_per_day } = body
        const { data } = await supabase.from('automation_rules').insert({
          org_id: orgId, rule_name, description, trigger_type,
          trigger_conditions: trigger_conditions || {}, actions: ruleActions || [],
          schedule_cron, max_executions_per_day: max_executions_per_day || 100,
          created_by: user.id,
        }).select().single()
        return json({ success: true, rule: data })
      }

      case 'update_rule': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { rule_id, enabled, rule_name, description, trigger_conditions, actions: ruleActions } = body
        const updates: any = { updated_at: new Date().toISOString() }
        if (enabled != null) updates.enabled = enabled
        if (rule_name) updates.rule_name = rule_name
        if (description) updates.description = description
        if (trigger_conditions) updates.trigger_conditions = trigger_conditions
        if (ruleActions) updates.actions = ruleActions
        await supabase.from('automation_rules').update(updates).eq('id', rule_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'delete_rule': {
        if (!isAdmin) return json({ error: 'Admin only' })
        await supabase.from('automation_rules').delete().eq('id', body.rule_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ═══ EXECUTE RULE (called by triggers or cron) ═══
      case 'execute_rule': {
        const { rule_id, trigger_event } = body
        const { data: rule } = await supabase.from('automation_rules').select('*').eq('id', rule_id).single()
        if (!rule || !rule.enabled) return json({ error: 'Rule not found or disabled' })
        if (rule.executions_today >= rule.max_executions_per_day) return json({ error: 'Daily limit reached', skipped: true })

        const { data: exec } = await supabase.from('automation_executions').insert({
          rule_id, org_id: rule.org_id, trigger_event: trigger_event || {},
        }).select().single()

        let actionsExecuted = 0, actionsFailed = 0
        const results: any[] = []

        for (const act of (rule.actions || [])) {
          try {
            switch (act.type) {
              case 'notify': {
                await supabase.from('notifications').insert({
                  org_id: rule.org_id, type: 'system', severity: act.config?.severity || 'info',
                  title: act.config?.title || `Automation: ${rule.rule_name}`,
                  body: act.config?.body || 'Automation rule triggered.',
                  channels_sent: ['in_app'],
                })
                results.push({ action_type: 'notify', status: 'success' })
                actionsExecuted++
                break
              }
              case 'categorize': {
                if (trigger_event?.transaction_id && act.config?.category) {
                  await supabase.from('transactions').update({ category: act.config.category }).eq('id', trigger_event.transaction_id)
                  results.push({ action_type: 'categorize', status: 'success', detail: act.config.category })
                  actionsExecuted++
                }
                break
              }
              case 'webhook': {
                if (act.config?.url) {
                  const resp = await fetch(act.config.url, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rule_name: rule.rule_name, trigger_event, timestamp: new Date().toISOString() }),
                  })
                  results.push({ action_type: 'webhook', status: resp.ok ? 'success' : 'failed', status_code: resp.status })
                  if (resp.ok) actionsExecuted++; else actionsFailed++
                }
                break
              }
              case 'tag': {
                results.push({ action_type: 'tag', status: 'success', detail: act.config?.tag })
                actionsExecuted++
                break
              }
              default:
                results.push({ action_type: act.type, status: 'skipped', detail: 'Unknown action type' })
            }
          } catch (err) {
            actionsFailed++
            results.push({ action_type: act.type, status: 'failed', error: err.message })
          }
        }

        const execStatus = actionsFailed === 0 ? 'success' : actionsExecuted === 0 ? 'failed' : 'partial'
        await supabase.from('automation_executions').update({
          completed_at: new Date().toISOString(),
          duration_ms: Date.now() - new Date(exec.started_at).getTime(),
          status: execStatus, actions_executed: actionsExecuted, actions_failed: actionsFailed, results,
        }).eq('id', exec.id)

        await supabase.from('automation_rules').update({
          last_triggered_at: new Date().toISOString(), trigger_count: (rule.trigger_count || 0) + 1,
          executions_today: (rule.executions_today || 0) + 1,
        }).eq('id', rule_id)

        return json({ success: true, execution_id: exec.id, status: execStatus, actions_executed: actionsExecuted })
      }

      // ═══ WEBHOOKS ═══
      case 'create_webhook': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { url, events } = body
        const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')
        const { data } = await supabase.from('webhook_subscriptions').insert({ org_id: orgId, url, events: events || [], secret }).select().single()
        return json({ success: true, webhook: data })
      }

      case 'list_webhooks': {
        const { data } = await supabase.from('webhook_subscriptions').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        return json({ webhooks: data || [] })
      }

      case 'delete_webhook': {
        if (!isAdmin) return json({ error: 'Admin only' })
        await supabase.from('webhook_subscriptions').delete().eq('id', body.webhook_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'webhook_deliveries': {
        const { data } = await supabase.from('webhook_deliveries').select('*').eq('subscription_id', body.webhook_id).order('created_at', { ascending: false }).limit(20)
        return json({ deliveries: data || [] })
      }

      // ═══ CHANGELOG ═══
      case 'list_changelog': {
        const { data } = await supabase.from('changelog_entries').select('*').eq('status', 'published').order('published_at', { ascending: false }).limit(20)
        return json({ entries: data || [] })
      }

      // ═══ RESET DAILY LIMITS (cron — daily midnight) ═══
      case 'reset_daily_limits': {
        await supabase.from('automation_rules').update({ executions_today: 0 }).gt('executions_today', 0)
        return json({ success: true })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
