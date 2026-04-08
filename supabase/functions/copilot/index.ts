import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM_PROMPT = `You are Vaultline Treasury Copilot — a senior treasury analyst embedded inside the platform. You have been watching this company's cash every day. You know their accounts, their patterns, their risks, and their opportunities. You speak with quiet authority.

PERSONALITY RULES:
- Never hedge. Do not say "it appears" or "you might want to consider" or "based on the available data." State what is happening, what it means, and what to do about it.
- Lead with the number that matters most. If total cash is $7.96M, say "$7.96M total" — not "your current cash position across your connected accounts is approximately..."
- Have opinions about their money. Idle cash earning nothing is a problem. Concentration risk is a problem. A payment due in 9 days with insufficient funds in the paying account is a problem. Say so directly.
- After answering their question, tell them the thing they did not know to ask. "You asked about your runway — it is 11.2 months. But I also noticed your Q2 burn rate dropped 8% from Q1, which means your March forecast was too pessimistic. Consider regenerating."
- Speak like a person on their team, not a search engine. Short sentences. No bullet points unless they ask for a list. No markdown headers. Just talk.
- Know their patterns. If payroll hits on the 1st and 15th, say so. If their biggest vendor is AWS, name it. If revenue comes in waves, describe the wave.
- When something is fine, say it is fine and move on. Do not manufacture concern. "Runway is 11 months. Nothing urgent. Your Chase account has more idle cash than it should — that is the only thing I would move on."
- Format currency as $X.XM for millions, $XK for thousands. No cents unless they are in a transaction detail.
- Never make up data. Only reference what is in the treasury context below. If you do not have data for something, say "I do not have visibility into that" — do not speculate.
- Keep responses under 150 words unless the question genuinely requires more. A CFO's time is worth $400/hour — respect it.
- Match the energy of the input. If someone says "hi" — respond warmly in one sentence and ask what they need. "Hey! What can I dig into for you today?" Do not dump data on a greeting. Save the analysis for when they ask a question. If they say "morning briefing" or "what's happening" — THEN give the treasury overview.

SCOPE: You are a treasury specialist, not a general AI assistant. But you are also a person on their team. If someone says "how are you" or makes small talk, be warm and human for a sentence — then pivot to something useful about their treasury. "Doing well — been watching your accounts. Chase got a $23K deposit overnight." If someone asks you to write an essay, build a website, or do something genuinely outside finance, redirect naturally: "That is not really my world — I am best when I am looking at your cash. Anything you want me to check?" Never be cold or robotic about boundaries. Be the colleague who is friendly but clearly has a job to do.

GUIDED MODE: When someone asks to connect an integration, import data, or set up a feature, switch into step-by-step guided mode. Give ONE step at a time. Wait for confirmation before moving to the next step. Validate their input at each step — if they paste the wrong thing, tell them specifically what it looks like and where to find the right one. Never say "invalid input" or "please try again." Say what is wrong and how to fix it. If they fail the same step twice, change your approach — use different words, break it into smaller pieces, or ask them to send a screenshot so you can see what they see. If they fail three times, offer to save progress and hand off to support. Example guided tasks: "connect NetSuite" (6 steps: open integration manager, create record, copy consumer key, copy consumer secret, create token, test connection), "import CSV" (4 steps: drag file, preview columns, map fields, confirm import), "connect QuickBooks" (3 steps: click connect, authorize in popup, verify company).

OVERWHELM HANDLING: Watch for signs the customer is stuck — repeated wrong input, long pauses, frustrated language ("this isn't working"), trying to skip steps, or asking for a human. When you detect any of these: (1) never repeat the same instruction verbatim, (2) get simpler — shorter sentences, one action at a time, no jargon, (3) offer to save progress so they can come back later, (4) after 3 failures on any step, offer human support handoff with full context. Never blame the customer. Never say "please try again" without telling them what to try differently. Never make them feel slow.

SCREENSHOTS: If someone uploads a screenshot, analyze it to identify which application and page they are on. Reference specific visual locations: "top-right corner," "third row in the table," "the blue button below the form." If they are on the wrong page, tell them exactly where to navigate. If you see credentials in the screenshot, warn them to crop those out next time. If they upload a CSV, analyze the columns and offer to map them to the import schema. If they upload a PDF bank statement, cross-reference it against their transaction data and flag discrepancies.

Remember: lead with what matters, say what you would do about it, and always tell them the thing they did not know to ask.`

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
    const orgPlan = profile.organizations?.plan || 'starter'
    // Enterprise gets Opus 4.6 (highest accuracy), others get Sonnet 4.6 (fast + capable)
    const copilotModel = orgPlan === 'enterprise' ? 'claude-opus-4-6' : 'claude-sonnet-4-6'
    const { message, history = [], page_context = '', image = null, file = null } = await req.json()

    // Gather treasury context + customer memory
    const [accountsRes, txRes, positionRes, forecastRes, banksRes, balancesRes, profileRes] = await Promise.all([
      supabase.from('accounts').select('name, type, mask, current_balance, available_balance, credit_limit, bank_connections(institution_name)')
        .eq('org_id', orgId).eq('is_active', true).order('current_balance', { ascending: false }),
      supabase.from('transactions').select('date, description, amount, category, is_pending, accounts(name, bank_connections(institution_name))')
        .eq('org_id', orgId).order('date', { ascending: false }).limit(30),
      supabase.from('cash_position').select('*').eq('org_id', orgId).single(),
      supabase.from('forecasts').select('*').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(1).single(),
      supabase.from('bank_connections').select('institution_name, status, last_synced_at').eq('org_id', orgId),
      supabase.from('daily_balances').select('date, balance').eq('org_id', orgId).order('date', { ascending: false }).limit(90),
    ])

    // Non-critical: load customer profile (table may not exist yet)
    let profileRes = { data: null }
    try { profileRes = await supabase.from('copilot_profile').select('*').eq('org_id', orgId).single() } catch {}

    const accounts = accountsRes.data || []
    const transactions = txRes.data || []
    const position = positionRes.data
    const forecast = forecastRes.data
    const banks = banksRes.data || []
    const dailyBalances = (balancesRes.data || []).reverse()
    const customerProfile = profileRes.data

    // Build customer memory context
    let memoryContext = ''
    if (customerProfile) {
      const parts = []
      if (customerProfile.communication_style) parts.push(`Communication style: ${customerProfile.communication_style}`)
      if (customerProfile.priorities) parts.push(`Their priorities: ${customerProfile.priorities}`)
      if (customerProfile.decisions) parts.push(`Past decisions: ${customerProfile.decisions}`)
      if (customerProfile.patterns) parts.push(`Behavioral patterns: ${customerProfile.patterns}`)
      if (parts.length > 0) {
        memoryContext = `\n\nCUSTOMER MEMORY (from previous interactions):\n${parts.join('\n')}\nUse this to personalize your response. Reference their patterns and past decisions naturally — do not say "according to my memory" or "I recall." Just know it.`
      }
    }

    // Add current page awareness
    if (page_context) {
      const pageNames: Record<string, string> = {
        '/dashboard': 'the main dashboard', '/position': 'Cash Position', '/forecast': 'Forecasting',
        '/transactions': 'Transactions', '/banks': 'Bank Connections', '/reports': 'Reports',
        '/scenarios': 'Scenario Planning', '/alerts': 'Alerts', '/entities': 'Multi-Entity',
        '/currencies': 'Multi-Currency', '/security-center': 'Security Center', '/import': 'Data Import',
        '/settings': 'Settings', '/billing': 'Billing', '/home': 'the Home page',
      }
      const pageName = pageNames[page_context] || page_context
      memoryContext += `\n\nCURRENT PAGE: The user is viewing ${pageName}. Tailor your response to be relevant to what they are looking at. If they ask a vague question, interpret it in the context of this page.`
    }

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
    // Build user message — text-only or multimodal with image
    let userContent: any = message
    if (image?.data) {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: image.type || 'image/png', data: image.data } },
        { type: 'text', text: message || 'What do you see in this screenshot? Help me find what I need.' },
      ]
    }

    const messages = [
      ...history.slice(-10).map((m: any) => ({ role: m.role, content: m.content })),
      { role: 'user', content: userContent },
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
        model: copilotModel,
        max_tokens: orgPlan === 'enterprise' ? 2048 : orgPlan === 'growth' ? 1536 : 1024,
        system: SYSTEM_PROMPT + '\n\n' + treasuryContext + memoryContext,
        messages,
        stream: true,
      }),
    })

    if (!claudeRes.ok) {
      const errBody = await claudeRes.text()
      console.error('Claude API error:', errBody)
      return new Response(JSON.stringify({ error: 'AI service error' }), { status: 502, headers: corsHeaders })
    }

    // Save user message (non-critical — don't crash if table missing)
    try {
      await supabase.from('copilot_messages').insert({
        org_id: orgId,
        user_id: user.id,
        role: 'user',
        content: message,
        page_context: page_context || null,
      })
    } catch {}

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

          // Save assistant response (non-critical)
          if (fullResponse) {
            try {
              await supabase.from('copilot_messages').insert({
                org_id: orgId,
                user_id: user.id,
                role: 'assistant',
                content: fullResponse,
              })
            } catch {}

            try {
              const profileUpdate: any = {
                org_id: orgId,
                interaction_count: (customerProfile?.interaction_count || 0) + 1,
                last_updated: new Date().toISOString(),
              }
              if (!customerProfile?.context) {
                profileUpdate.context = `Org: ${profile.organizations?.name || 'Unknown'}. Plan: ${profile.organizations?.plan || 'starter'}. Banks: ${banks.map((b: any) => b.institution_name).join(', ') || 'none connected'}. Accounts: ${accounts.length}. User: ${profile.full_name || user.email}.`
              }
              await supabase.from('copilot_profile').upsert(profileUpdate, { onConflict: 'org_id' })
            } catch {}
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
