import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || 'malikfrazier35@yahoo.com,financialholdingllc@gmail.com').split(',')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user || !ADMIN_EMAILS.includes(user.email || '')) {
      return new Response(JSON.stringify({ error: 'Unauthorized — admin only' }), { status: 403, headers: cors })
    }

    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'overview': {
        const { data: orgs } = await supabase.from('organizations').select('*, profiles(id, full_name, email:id, role, status, created_at)').order('created_at', { ascending: false })
        const { data: recentEvents } = await supabase.from('growth_events').select('*').order('created_at', { ascending: false }).limit(50)
        const { data: recentAudit } = await supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(50)

        // Aggregate stats
        const allOrgs = orgs || []
        const stats = {
          total_orgs: allOrgs.length,
          active: allOrgs.filter(o => o.plan_status === 'active').length,
          trialing: allOrgs.filter(o => o.plan_status === 'trialing').length,
          canceled: allOrgs.filter(o => o.plan_status === 'canceled').length,
          past_due: allOrgs.filter(o => o.plan_status === 'past_due').length,
          total_users: allOrgs.reduce((s, o) => s + (o.profiles?.length || 0), 0),
        }

        return json({ orgs: allOrgs, stats, recent_events: recentEvents || [], recent_audit: recentAudit || [] })
      }

      case 'update_org': {
        const { org_id, updates } = body
        if (!org_id) return json({ error: 'org_id required' })
        // Whitelist allowed fields
        const allowed = ['plan', 'plan_status', 'max_bank_connections', 'trial_ends_at', 'name']
        const safeUpdates: any = {}
        for (const key of Object.keys(updates || {})) {
          if (allowed.includes(key)) safeUpdates[key] = updates[key]
        }
        const { error } = await supabase.from('organizations').update(safeUpdates).eq('id', org_id)
        if (error) return json({ error: error.message })
        await supabase.from('audit_log').insert({ org_id, user_id: user.id, action: 'admin_org_update', details: safeUpdates })
        return json({ success: true })
      }

      case 'delete_user': {
        const { user_id, org_id } = body
        if (!user_id) return json({ error: 'user_id required' })
        await supabase.from('profiles').update({ status: 'deactivated' }).eq('id', user_id)
        await supabase.from('audit_log').insert({ org_id, user_id: user.id, action: 'admin_user_deactivated', details: { target_id: user_id } })
        return json({ success: true })
      }

      case 'impersonate': {
        // Generate a magic link for admin impersonation (logged in audit)
        const { target_email } = body
        await supabase.from('audit_log').insert({ user_id: user.id, action: 'admin_impersonate_attempt', details: { target_email } })
        return json({ error: 'Impersonation not yet implemented — use Supabase Dashboard' })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
