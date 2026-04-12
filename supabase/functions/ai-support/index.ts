import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY') || ''
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: profile } = await supabase.from('profiles').select('*, organizations(*)').eq('id', user.id).single()
    if (!profile) return json({ error: 'No profile' }, 400)

    const { message, conversation_id } = await req.json()
    if (!message?.trim()) return json({ error: 'Message required' }, 400)

    const org = profile.organizations
    const orgId = profile.org_id
    const orgPlan = org?.plan || 'starter'
    const aiModel = orgPlan === 'starter' ? 'claude-sonnet-4-6' : 'claude-opus-4-6'

    // ═══ LOAD CUSTOMER CONTEXT ═══
    const [acctRes, txRes, bankRes, fcRes, alertRes, ticketRes] = await Promise.all([
      supabase.from('accounts').select('id, account_name, institution_name, current_balance, available_balance, type, currency').eq('org_id', orgId).eq('is_active', true),
      supabase.from('transactions').select('id, date, name, amount, category').eq('org_id', orgId).order('date', { ascending: false }).limit(20),
      supabase.from('bank_connections').select('id, institution_name, status, last_synced_at, error_count').eq('org_id', orgId),
      supabase.from('forecasts').select('monthly_burn, runway_months, model, confidence, generated_at').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('notifications').select('id, title, severity, created_at').eq('org_id', orgId).is('dismissed_at', null).order('created_at', { ascending: false }).limit(5),
      supabase.from('support_tickets').select('id, subject, status, priority, created_at').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5),
    ])

    const accounts = acctRes.data || []
    const transactions = txRes.data || []
    const banks = bankRes.data || []
    const forecast = fcRes.data
    const alerts = alertRes.data || []
    const tickets = ticketRes.data || []
    const totalCash = accounts.reduce((s, a) => s + (a.current_balance || 0), 0)
    const memberCount = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active')

    // ═══ LOAD CONVERSATION HISTORY ═══
    let convId = conversation_id
    let history: any[] = []
    if (convId) {
      const { data: msgs } = await supabase.from('ai_messages').select('role, content')
        .eq('conversation_id', convId).order('created_at').limit(20)
      history = (msgs || []).map(m => ({ role: m.role, content: m.content }))
    } else {
      const { data: conv } = await supabase.from('ai_conversations').insert({
        org_id: orgId, user_id: user.id, channel: 'in_app',
      }).select().single()
      convId = conv?.id
    }

    // ═══ SYSTEM PROMPT ═══
    const systemPrompt = `You are a Vaultline treasury support specialist. You have direct access to this customer's live financial data. You are knowledgeable, concise, and professional.

CUSTOMER CONTEXT:
- Organization: ${org?.name || 'Unknown'} (${org?.plan || 'starter'} plan, status: ${org?.plan_status})
- User: ${profile.full_name || user.email} (role: ${profile.role})
- Team: ${memberCount.count || 1} members, max ${org?.max_team_members || 3} seats

FINANCIAL SNAPSHOT:
- Total cash: $${totalCash.toLocaleString('en-US', { minimumFractionDigits: 2 })} across ${accounts.length} accounts
- Accounts: ${accounts.map(a => `${a.institution_name || ''} ${a.account_name}: $${(a.current_balance || 0).toLocaleString()}`).join('; ') || 'None connected'}
- Runway: ${forecast?.runway_months ? forecast.runway_months.toFixed(1) + ' months' : 'Not calculated'}
- Monthly burn: ${forecast?.monthly_burn ? '$' + forecast.monthly_burn.toLocaleString() : 'Unknown'}
- Forecast model: ${forecast?.model || 'None'} (confidence: ${forecast?.confidence || 'N/A'})

BANK CONNECTIONS:
${banks.map(b => `- ${b.institution_name}: ${b.status}${b.last_synced_at ? ', last sync ' + new Date(b.last_synced_at).toLocaleDateString() : ''}${b.error_count > 0 ? ' (' + b.error_count + ' errors)' : ''}`).join('\n') || '- No banks connected'}

RECENT TRANSACTIONS (last 20):
${transactions.slice(0, 10).map(t => `- ${t.date} | ${t.name} | $${Math.abs(t.amount).toLocaleString()} ${t.amount < 0 ? '(inflow)' : '(outflow)'} | ${t.category || 'uncategorized'}`).join('\n') || '- No transactions'}

ACTIVE ALERTS: ${alerts.length > 0 ? alerts.map(a => a.title).join('; ') : 'None'}
OPEN TICKETS: ${tickets.length > 0 ? tickets.map(t => `#${t.id.slice(0,8)} ${t.subject} (${t.status})`).join('; ') : 'None'}

RULES:
- Answer questions about their treasury data using the context above
- For questions needing deeper data (specific date ranges, category breakdowns), use the available tools
- For write actions (inviting team members, creating tickets, triggering syncs), confirm with the customer before executing
- If asked about billing disputes, refunds, data deletion, or security concerns, say you'll escalate to the team and create a support ticket
- Be concise. CFOs and treasury managers don't want fluff.
- Use dollar amounts and percentages. Be specific.
- If you don't have enough data to answer, say so — don't guess.`

    // ═══ TOOLS ═══
    const tools = [
      {
        name: 'query_transactions',
        description: 'Search transactions with filters. Use when the customer asks about specific spending, date ranges, or categories.',
        input_schema: {
          type: 'object',
          properties: {
            days: { type: 'number', description: 'Number of days to look back (default 30)' },
            category: { type: 'string', description: 'Filter by category (revenue, payroll, vendor, saas, tax, transfer, operations)' },
            min_amount: { type: 'number', description: 'Minimum absolute amount' },
            limit: { type: 'number', description: 'Max results (default 20)' },
          },
        },
      },
      {
        name: 'get_cash_position',
        description: 'Get detailed cash position breakdown by account, type, and currency.',
        input_schema: { type: 'object', properties: {} },
      },
      {
        name: 'create_support_ticket',
        description: 'Create a support ticket on behalf of the customer. Always confirm with the customer first.',
        input_schema: {
          type: 'object',
          properties: {
            subject: { type: 'string', description: 'Ticket subject' },
            body: { type: 'string', description: 'Ticket description' },
            priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
            category: { type: 'string', enum: ['general', 'billing', 'integration', 'bug', 'feature_request', 'data_issue', 'security'] },
          },
          required: ['subject', 'body'],
        },
      },
      {
        name: 'invite_team_member',
        description: 'Send a team invite. Always confirm email and role with the customer first.',
        input_schema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email to invite' },
            role: { type: 'string', enum: ['admin', 'member', 'viewer'] },
          },
          required: ['email', 'role'],
        },
      },
      {
        name: 'generate_report',
        description: 'Generate a treasury report from available templates.',
        input_schema: {
          type: 'object',
          properties: {
            template: { type: 'string', enum: ['daily-cash', 'weekly-summary', 'monthly-forecast', 'variance-analysis', 'bank-fees', 'fx-exposure', 'board-deck', 'audit-ready'] },
            days: { type: 'number', description: 'Period in days (default 30)' },
          },
          required: ['template'],
        },
      },
      {
        name: 'escalate_to_human',
        description: 'Escalate to human support. Use for billing disputes, security concerns, data deletion, or when the customer explicitly asks for a human.',
        input_schema: {
          type: 'object',
          properties: {
            reason: { type: 'string', description: 'Why escalation is needed' },
          },
          required: ['reason'],
        },
      },
    ]

    // ═══ CALL CLAUDE ═══
    const messages = [...history, { role: 'user', content: message }]

    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: aiModel,
        max_tokens: 1024,
        system: systemPrompt,
        tools,
        messages,
      }),
    })

    if (!claudeRes.ok) {
      const err = await claudeRes.text()
      console.error('Claude API error:', err)
      return json({ error: 'AI service unavailable' }, 502)
    }

    const claudeData = await claudeRes.json()
    let responseText = ''
    const toolResults: any[] = []

    // ═══ PROCESS RESPONSE — handle tool use ═══
    for (const block of claudeData.content) {
      if (block.type === 'text') {
        responseText += block.text
      } else if (block.type === 'tool_use') {
        let toolResult = ''

        // Log tool call
        await supabase.from('ai_tool_calls').insert({
          conversation_id: convId, tool_name: block.name,
          input: block.input, org_id: orgId,
        }).catch(() => {})

        switch (block.name) {
          case 'query_transactions': {
            const { days = 30, category, min_amount, limit: lim = 20 } = block.input
            const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
            let q = supabase.from('transactions').select('date, name, amount, category')
              .eq('org_id', orgId).gte('date', cutoff).order('date', { ascending: false }).limit(lim)
            if (category) q = q.eq('category', category)
            const { data } = await q
            const filtered = min_amount ? (data || []).filter(t => Math.abs(t.amount) >= min_amount) : (data || [])
            const totalIn = filtered.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
            const totalOut = filtered.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
            toolResult = JSON.stringify({ transactions: filtered.slice(0, 15), count: filtered.length, total_inflows: totalIn, total_outflows: totalOut })
            break
          }
          case 'get_cash_position': {
            const byType: Record<string, number> = {}
            accounts.forEach(a => { byType[a.type || 'other'] = (byType[a.type || 'other'] || 0) + (a.current_balance || 0) })
            toolResult = JSON.stringify({ total: totalCash, accounts: accounts.map(a => ({ name: `${a.institution_name} - ${a.account_name}`, balance: a.current_balance, available: a.available_balance, type: a.type, currency: a.currency })), by_type: byType })
            break
          }
          case 'create_support_ticket': {
            const { subject, body: ticketBody, priority = 'medium', category: cat = 'general' } = block.input
            const { data: ticket } = await supabase.from('support_tickets').insert({
              org_id: orgId, created_by: user.id, subject, category: cat, priority,
            }).select().single()
            if (ticket) {
              await supabase.from('ticket_messages').insert({ ticket_id: ticket.id, sender_type: 'customer', sender_id: user.id, body: ticketBody })
              toolResult = JSON.stringify({ success: true, ticket_id: ticket.id })
            } else {
              toolResult = JSON.stringify({ error: 'Failed to create ticket' })
            }
            break
          }
          case 'invite_team_member': {
            const { email, role } = block.input
            const { data, error } = await supabase.functions.invoke('team-manage', {
              body: { action: 'invite', email, role },
              headers: { Authorization: req.headers.get('Authorization')! },
            })
            toolResult = JSON.stringify(data || { error: error?.message })
            break
          }
          case 'generate_report': {
            const { template, days = 30 } = block.input
            const { data, error } = await supabase.functions.invoke('report-generate', {
              body: { template_slug: template, format: 'json', days },
              headers: { Authorization: req.headers.get('Authorization')! },
            })
            if (data?.report) {
              toolResult = JSON.stringify({ title: data.report.title, rows: data.report.rows?.slice(0, 10), row_count: data.report.row_count })
            } else {
              toolResult = JSON.stringify({ error: error?.message || 'Report generation failed' })
            }
            break
          }
          case 'escalate_to_human': {
            const { reason } = block.input
            await supabase.from('support_tickets').insert({
              org_id: orgId, created_by: user.id, subject: `[AI Escalation] ${reason}`,
              category: 'general', priority: 'high',
            })
            await supabase.functions.invoke('notify', {
              body: { action: 'signup_alert', email: user.email, full_name: profile.full_name, company_name: org?.name, source: `AI escalation: ${reason}` },
            }).catch(() => {})
            toolResult = JSON.stringify({ escalated: true, reason })
            break
          }
        }

        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: toolResult })
      }
    }

    // If there were tool calls, send results back to Claude for final response
    if (toolResults.length > 0) {
      const followUp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: aiModel,
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...messages,
            { role: 'assistant', content: claudeData.content },
            { role: 'user', content: toolResults },
          ],
        }),
      })

      if (followUp.ok) {
        const followUpData = await followUp.json()
        responseText = followUpData.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
      }
    }

    // ═══ SAVE MESSAGES ═══
    if (convId) {
      await supabase.from('ai_messages').insert([
        { conversation_id: convId, role: 'user', content: message },
        { conversation_id: convId, role: 'assistant', content: responseText },
      ]).catch(() => {})
    }

    return json({
      response: responseText,
      conversation_id: convId,
      tools_used: toolResults.length > 0 ? claudeData.content.filter((b: any) => b.type === 'tool_use').map((b: any) => b.name) : [],
    })

  } catch (err) {
    console.error('AI support error:', err)
    return json({ error: err.message }, 500)
  }
})

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
