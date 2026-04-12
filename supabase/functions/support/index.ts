import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// SLA targets in hours by priority
const SLA: Record<string, { first_response: number, resolution: number }> = {
  critical: { first_response: 1, resolution: 4 },
  high: { first_response: 4, resolution: 24 },
  medium: { first_response: 8, resolution: 48 },
  low: { first_response: 24, resolution: 120 },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Some actions are public (KB), others require auth
    if (!['kb_list', 'kb_get', 'kb_vote'].includes(action) && !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
    }

    let orgId: string | null = null
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('org_id, full_name, role').eq('id', user.id).single()
      orgId = profile?.org_id
    }

    switch (action) {
      // ── CREATE TICKET ──
      case 'create_ticket': {
        const { subject, body: ticketBody, category, priority } = body
        if (!subject || !ticketBody) return json({ error: 'Subject and body required' })

        const { data: ticket, error } = await supabase.from('support_tickets').insert({
          org_id: orgId, created_by: user!.id, subject,
          category: category || 'general', priority: priority || 'medium',
        }).select().single()
        if (error) return json({ error: error.message })

        // Create initial message
        await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id, sender_type: 'customer', sender_id: user!.id, body: ticketBody,
        })

        // Auto-acknowledge
        await supabase.from('ticket_messages').insert({
          ticket_id: ticket.id, sender_type: 'system',
          body: `Ticket #${ticket.id.slice(0, 8)} created. Our team will respond within ${SLA[priority || 'medium'].first_response} hours.`,
        })

        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user!.id, action: 'ticket_created', details: { ticket_id: ticket.id, category, priority } })

        // Notify admin via Slack + email
        try {
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single()
          const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId).single()
          await supabase.functions.invoke('notify', {
            body: {
              action: 'signup_alert',
              email: user!.email,
              full_name: profile?.full_name || 'Customer',
              company_name: org?.name || 'Unknown',
              source: `Support ticket: ${category || 'general'} (${priority || 'medium'})`,
              utm_source: subject.slice(0, 80),
            },
          })
        } catch {}

        return json({ success: true, ticket })
      }

      // ── LIST TICKETS ──
      case 'list_tickets': {
        const { status: filterStatus, page = 0, limit = 20 } = body
        let q = supabase.from('support_tickets').select('*, ticket_messages(count)').eq('org_id', orgId!).order('created_at', { ascending: false }).range(page * limit, (page + 1) * limit - 1)
        if (filterStatus) q = q.eq('status', filterStatus)
        const { data, error } = await q
        if (error) return json({ error: error.message })

        // Check SLA breaches
        const tickets = (data || []).map(t => {
          const sla = SLA[t.priority]
          const ageHours = (Date.now() - new Date(t.created_at).getTime()) / 3600000
          const firstResponseBreached = !t.first_response_at && ageHours > sla.first_response
          const resolutionBreached = !['resolved', 'closed'].includes(t.status) && ageHours > sla.resolution
          return { ...t, sla_breach: firstResponseBreached || resolutionBreached, sla_target: sla }
        })

        return json({ tickets, total: tickets.length })
      }

      // ── GET TICKET WITH MESSAGES ──
      case 'get_ticket': {
        const { ticket_id } = body
        const { data: ticket } = await supabase.from('support_tickets').select('*').eq('id', ticket_id).eq('org_id', orgId!).single()
        if (!ticket) return json({ error: 'Ticket not found' })
        const { data: messages } = await supabase.from('ticket_messages').select('*').eq('ticket_id', ticket_id).eq('is_internal', false).order('created_at')
        return json({ ticket, messages: messages || [] })
      }

      // ── REPLY TO TICKET ──
      case 'reply_ticket': {
        const { ticket_id, message } = body
        if (!message) return json({ error: 'Message required' })
        await supabase.from('ticket_messages').insert({ ticket_id, sender_type: 'customer', sender_id: user!.id, body: message })
        await supabase.from('support_tickets').update({ status: 'open', updated_at: new Date().toISOString() }).eq('id', ticket_id)
        return json({ success: true })
      }

      // ── CLOSE TICKET ──
      case 'close_ticket': {
        const { ticket_id } = body
        await supabase.from('support_tickets').update({ status: 'closed', resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', ticket_id).eq('org_id', orgId!)
        return json({ success: true })
      }

      // ── RATE TICKET (CSAT) ──
      case 'rate_ticket': {
        const { ticket_id, score, feedback } = body
        await supabase.from('support_tickets').update({ csat_score: score, csat_feedback: feedback }).eq('id', ticket_id)
        await supabase.from('csat_surveys').insert({ org_id: orgId!, user_id: user!.id, trigger_type: 'ticket_resolved', trigger_id: ticket_id, score, feedback })
        return json({ success: true })
      }

      // ── KNOWLEDGE BASE: LIST ──
      case 'kb_list': {
        const { category } = body
        let q = supabase.from('knowledge_base').select('id, slug, title, category, tags, views, helpful_yes, helpful_no, updated_at').eq('status', 'published').order('views', { ascending: false })
        if (category) q = q.eq('category', category)
        const { data } = await q
        return json({ articles: data || [] })
      }

      // ── KNOWLEDGE BASE: GET ARTICLE ──
      case 'kb_get': {
        const { slug } = body
        const { data: article } = await supabase.from('knowledge_base').select('*').eq('slug', slug).eq('status', 'published').single()
        if (!article) return json({ error: 'Article not found' })
        await supabase.from('knowledge_base').update({ views: article.views + 1 }).eq('id', article.id)
        return json({ article })
      }

      // ── KNOWLEDGE BASE: VOTE HELPFUL ──
      case 'kb_vote': {
        const { article_id, helpful } = body
        const field = helpful ? 'helpful_yes' : 'helpful_no'
        await supabase.rpc('increment', { row_id: article_id, table_name: 'knowledge_base', column_name: field }).catch(() => {
          // Fallback: manual increment
          supabase.from('knowledge_base').select(field).eq('id', article_id).single().then(({ data }) => {
            if (data) supabase.from('knowledge_base').update({ [field]: (data[field] || 0) + 1 }).eq('id', article_id)
          })
        })
        return json({ success: true })
      }

      // ── SUBMIT CSAT (generic) ──
      case 'submit_csat': {
        const { trigger_type, trigger_id, score, feedback, tags } = body
        await supabase.from('csat_surveys').insert({ org_id: orgId!, user_id: user!.id, trigger_type, trigger_id, score, feedback, tags })
        return json({ success: true })
      }

      // ── ADMIN: TICKET STATS ──
      case 'admin_stats': {
        const { data: tickets } = await supabase.from('support_tickets').select('status, priority, category, csat_score, created_at, first_response_at, resolved_at').order('created_at', { ascending: false }).limit(500)
        const all = tickets || []
        const open = all.filter(t => ['open', 'in_progress', 'waiting_customer', 'waiting_internal'].includes(t.status))
        const resolved = all.filter(t => ['resolved', 'closed'].includes(t.status))
        const csatScores = resolved.filter(t => t.csat_score).map(t => t.csat_score!)
        const avgCsat = csatScores.length > 0 ? (csatScores.reduce((s, v) => s + v, 0) / csatScores.length) : 0

        // Avg first response time
        const responseTimes = all.filter(t => t.first_response_at).map(t => (new Date(t.first_response_at!).getTime() - new Date(t.created_at).getTime()) / 3600000)
        const avgResponseHours = responseTimes.length > 0 ? responseTimes.reduce((s, v) => s + v, 0) / responseTimes.length : 0

        // Avg resolution time
        const resTimes = resolved.filter(t => t.resolved_at).map(t => (new Date(t.resolved_at!).getTime() - new Date(t.created_at).getTime()) / 3600000)
        const avgResolutionHours = resTimes.length > 0 ? resTimes.reduce((s, v) => s + v, 0) / resTimes.length : 0

        return json({
          total: all.length, open: open.length, resolved: resolved.length,
          avg_csat: Math.round(avgCsat * 10) / 10,
          avg_first_response_hours: Math.round(avgResponseHours * 10) / 10,
          avg_resolution_hours: Math.round(avgResolutionHours * 10) / 10,
          by_category: Object.fromEntries((['general', 'billing', 'integration', 'bug', 'feature_request', 'data_issue', 'security', 'onboarding', 'account'] as const).map(c => [c, all.filter(t => t.category === c).length])),
          by_priority: Object.fromEntries((['critical', 'high', 'medium', 'low'] as const).map(p => [p, all.filter(t => t.priority === p).length])),
          this_week: all.filter(t => new Date(t.created_at) >= new Date(Date.now() - 7 * 86400000)).length,
        })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
