import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are Vaultline Treasury Copilot, an AI assistant for corporate treasury teams. You have access to the user's real-time treasury data provided in the context below.

Your job is to:
- Answer questions about cash position, balances, and transactions
- Identify idle cash that could earn yield
- Flag upcoming risks (low cash events, large upcoming payments)
- Suggest optimizations (payment timing, sweep strategies)
- Generate executive summaries for board reporting
- Explain trends in cash flow
- Interpret anomaly alerts and classify unusual cash movements
- Compare forecast model accuracy and recommend the best model
- Explain what anomalies mean in plain business terms (e.g. "this looks like a payroll cycle" or "this appears to be a one-time vendor payment")

When discussing anomalies, always:
1. State what happened (the cash movement)
2. Classify it (payroll, revenue collection, one-time, seasonal, etc.)
3. Assess if action is needed

When discussing forecasts, reference model accuracy metrics (MAPE, directional accuracy) to explain confidence levels.

Be concise, specific, and always reference actual numbers from the data. Use dollar formatting.
Never make up data — only reference what's in the treasury context. If asked about data you don't have, say so.
Format currency as $X.XM for millions, $XK for thousands.`

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    // Auth
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: profile } = await anonClient.from('profiles').select('org_id, full_name, organizations(name, plan)').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: corsHeaders })

    const orgId = profile.org_id
    const { message, history = [] } = await req.json()

    // Gather treasury context
    const [accountsRes, txRes, positionRes, forecastRes, banksRes, balancesRes] = await Promise.all([
      supabase.from('accounts').select('name, type, mask, current_balance, available_balance, credit_limit, bank_connections(institution_name)')
        .eq('org_id', orgId).eq('is_active', true).order('current_balance', { ascending: false }),
      supabase.from('transactions').select('date, description, amount, category, is_pending, accounts(name, bank_connections(institution_name))')
        .eq('org_id', orgId).order('date', { ascending: false }).limit(30),
      supabase.from('cash_position').select('*').eq('org_id', orgId).single(),
      supabase.from('forecasts').select('*').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(1).single(),
      supabase.from('bank_connections').select('institution_name, status, last_synced_at').eq('org_id', orgId),
      supabase.from('daily_balances').select('date, balance').eq('org_id', orgId).order('date', { ascending: false }).limit(90),
    ])

    const accounts = accountsRes.data || []
    const transactions = txRes.data || []
    const position = positionRes.data
    const forecast = forecastRes.data
    const banks = banksRes.data || []
    const dailyBalances = (balancesRes.data || []).reverse()

    // Server-side anomaly detection for copilot context
    const anomalies = detectAnomalies(dailyBalances)

    // Build treasury context
    const treasuryContext = buildContext({
      orgName: profile.organizations?.name,
      userName: profile.full_name,
      accounts,
      transactions,
      position,
      forecast,
      banks,
      dailyBalances,
      anomalies,
    })

    // Build messages array
    const messages = [
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: message },
    ]

    // Call Claude API with streaming
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT + '\n\n' + treasuryContext,
        messages,
        stream: true,
      }),
    })

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text()
      console.error('Claude API error:', errBody)
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 502, headers: corsHeaders })
    }

    // Save user message to DB
    await supabase.from('copilot_messages').insert({
      org_id: orgId,
      user_id: user.id,
      role: 'user',
      content: message,
    })

    // Stream response through
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeRes.body!.getReader()
        const decoder = new TextDecoder()
        let fullResponse = ''

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6)
                if (data === '[DONE]') continue

                try {
                  const parsed = JSON.parse(data)
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    fullResponse += parsed.delta.text
                    controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ text: parsed.delta.text })}\n\n`))
                  }
                } catch {}
              }
            }
          }

          // Save assistant response to DB
          if (fullResponse) {
            await supabase.from('copilot_messages').insert({
              org_id: orgId,
              user_id: user.id,
              role: 'assistant',
              content: fullResponse,
            })
          }

          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

function detectAnomalies(balances: any[]): any[] {
  if (balances.length < 7) return []
  
  const changes = balances.slice(1).map((b: any, i: number) => ({
    date: b.date,
    balance: b.balance,
    delta: b.balance - balances[i].balance,
    pctChange: balances[i].balance > 0 ? ((b.balance - balances[i].balance) / balances[i].balance) * 100 : 0,
  }))
  
  const deltas = changes.map((c: any) => c.delta)
  const mean = deltas.reduce((s: number, d: number) => s + d, 0) / deltas.length
  const std = Math.sqrt(deltas.reduce((s: number, d: number) => s + (d - mean) ** 2, 0) / (deltas.length - 1))
  if (std === 0) return []
  
  const detected: any[] = []
  
  changes.forEach((c: any) => {
    const z = (c.delta - mean) / std
    if (Math.abs(z) >= 2.0) {
      const dayOfMonth = new Date(c.date).getDate()
      const lastDay = new Date(new Date(c.date).getFullYear(), new Date(c.date).getMonth() + 1, 0).getDate()
      
      let classification = 'unclassified'
      if ((dayOfMonth <= 2 || (dayOfMonth >= 14 && dayOfMonth <= 16) || dayOfMonth >= lastDay - 1) && c.delta < 0) classification = 'payroll_cycle'
      else if (dayOfMonth <= 5 && c.delta > 0) classification = 'revenue_collection'
      else if (dayOfMonth >= lastDay - 2) classification = 'month_end_settlement'
      else if (Math.abs(z) >= 3) classification = 'one_time_event'
      
      detected.push({
        date: c.date,
        delta: c.delta,
        pctChange: c.pctChange,
        zScore: z,
        severity: Math.abs(z) >= 3 ? 'critical' : 'warning',
        direction: c.delta > 0 ? 'inflow' : 'outflow',
        classification,
      })
    }
  })
  
  // Check for consecutive decline
  let streak = 0
  for (let i = changes.length - 1; i >= 0; i--) {
    if (changes[i].delta < 0) streak++
    else break
  }
  if (streak >= 5) {
    detected.push({
      date: changes[changes.length - 1].date,
      delta: 0,
      pctChange: 0,
      zScore: 0,
      severity: 'warning',
      direction: 'trend',
      classification: `${streak}_day_consecutive_decline`,
    })
  }
  
  return detected.slice(0, 8)
}

function buildContext(data: any): string {
  const { orgName, userName, accounts, transactions, position, forecast, banks, dailyBalances, anomalies } = data
  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

  let ctx = `<treasury_data>
<date>${today}</date>
<organization>${orgName || 'Unknown'}</organization>
<user>${userName || 'Unknown'}</user>

<cash_position>
Total Balance: $${(position?.total_balance || 0).toLocaleString()}
Liquid Balance: $${(position?.liquid_balance || 0).toLocaleString()}
Available Credit: $${(position?.available_credit || 0).toLocaleString()}
Connected Banks: ${position?.connected_banks || 0}
Total Accounts: ${position?.total_accounts || 0}
</cash_position>

<accounts>
`
  for (const a of accounts) {
    ctx += `- ${a.bank_connections?.institution_name || a.name} (${a.type}, ****${a.mask || '????'}): Balance $${a.current_balance?.toLocaleString()}`
    if (a.available_balance && a.available_balance !== a.current_balance) ctx += `, Available $${a.available_balance.toLocaleString()}`
    if (a.credit_limit) ctx += `, Limit $${a.credit_limit.toLocaleString()}`
    ctx += '\n'
  }

  ctx += `</accounts>

<recent_transactions>
`
  for (const tx of transactions.slice(0, 20)) {
    const sign = tx.amount < 0 ? '+' : '-'
    ctx += `- ${tx.date} | ${tx.description} | ${sign}$${Math.abs(tx.amount).toLocaleString()} | ${tx.category || 'uncategorized'} | ${tx.is_pending ? 'PENDING' : 'cleared'} | ${tx.accounts?.bank_connections?.institution_name || ''}\n`
  }

  ctx += `</recent_transactions>

<forecast>
`
  if (forecast) {
    ctx += `Horizon: ${forecast.horizon_days} days
Monthly Burn: $${(forecast.monthly_burn || 0).toLocaleString()}
Runway: ${forecast.runway_months || 'N/A'} months
Confidence: ${((forecast.confidence || 0) * 100).toFixed(0)}%
Next Low-Cash Date: ${forecast.next_low_cash_date || 'None projected'}
`
  } else {
    ctx += 'No forecast data available.\n'
  }

  ctx += `</forecast>

<bank_connections>
`
  for (const b of banks) {
    ctx += `- ${b.institution_name}: ${b.status} (last synced: ${b.last_synced_at ? new Date(b.last_synced_at).toLocaleString() : 'never'})\n`
  }

  ctx += `</bank_connections>

<anomaly_alerts>
`
  if (anomalies && anomalies.length > 0) {
    for (const a of anomalies) {
      ctx += `- ${a.date} | ${a.severity.toUpperCase()} | ${a.direction} | $${Math.abs(a.delta).toLocaleString()} (${a.pctChange > 0 ? '+' : ''}${a.pctChange.toFixed(1)}%) | z=${Math.abs(a.zScore).toFixed(1)} | ${a.classification}\n`
    }
  } else {
    ctx += 'No anomalies detected in recent data.\n'
  }

  ctx += `</anomaly_alerts>

<balance_trend>
`
  if (dailyBalances && dailyBalances.length > 0) {
    const recent = dailyBalances.slice(-14)
    const first = recent[0]?.balance || 0
    const last = recent[recent.length - 1]?.balance || 0
    const change = last - first
    const pct = first > 0 ? ((change / first) * 100).toFixed(1) : '0'
    ctx += `14-day trend: $${first.toLocaleString()} → $${last.toLocaleString()} (${change >= 0 ? '+' : ''}$${change.toLocaleString()}, ${pct}%)\n`
    ctx += `Data points: ${dailyBalances.length} days\n`
    
    // Weekly averages
    const weeks = []
    for (let i = dailyBalances.length - 1; i >= 0; i -= 7) {
      const weekSlice = dailyBalances.slice(Math.max(0, i - 6), i + 1)
      const avg = weekSlice.reduce((s: number, b: any) => s + (b.balance || 0), 0) / weekSlice.length
      weeks.unshift({ endDate: weekSlice[weekSlice.length - 1]?.date, avg: Math.round(avg) })
      if (weeks.length >= 4) break
    }
    ctx += `Weekly averages (recent): ${weeks.map(w => `${w.endDate}: $${w.avg.toLocaleString()}`).join(' | ')}\n`
  } else {
    ctx += 'No daily balance history available.\n'
  }

  ctx += `</balance_trend>
</treasury_data>`

  return ctx
}
