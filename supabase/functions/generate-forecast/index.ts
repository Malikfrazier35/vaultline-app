import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// ── Statistical helpers ──
function mean(arr: number[]) { return arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0 }
function stdDev(arr: number[]) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1))
}

// ── Forecast models ──
function linearForecast(actuals: number[], days: number) {
  const changes = actuals.slice(1).map((v, i) => v - actuals[i])
  const avgChange = mean(changes)
  const last = actuals[actuals.length - 1]
  return Array.from({ length: days }, (_, i) => Math.max(0, Math.round(last + avgChange * (i + 1))))
}

function emaForecast(actuals: number[], days: number, span = 14) {
  const changes = actuals.slice(1).map((v, i) => v - actuals[i])
  const avgChange = mean(changes)
  const k = 2 / (span + 1)
  let prev = actuals[actuals.length - 1]
  return Array.from({ length: days }, () => {
    const proj = Math.round(prev + avgChange)
    prev = proj * k + prev * (1 - k)
    return Math.max(0, proj)
  })
}

function monteCarloForecast(actuals: number[], days: number, nPaths = 500) {
  const changes = actuals.slice(1).map((v, i) => v - actuals[i])
  const mu = mean(changes)
  const sigma = stdDev(changes)
  const last = actuals[actuals.length - 1]

  const paths: number[][] = Array.from({ length: days }, () => [])
  for (let d = 0; d < days; d++) {
    for (let p = 0; p < nPaths; p++) {
      const prev = d > 0 ? paths[d - 1][p] : last
      const u1 = Math.random(), u2 = Math.random()
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
      paths[d].push(Math.max(0, prev + mu + sigma * z))
    }
  }

  return {
    p50: paths.map(step => { const s = [...step].sort((a, b) => a - b); return Math.round(s[Math.floor(nPaths * 0.5)]) }),
    p10: paths.map(step => { const s = [...step].sort((a, b) => a - b); return Math.round(s[Math.floor(nPaths * 0.1)]) }),
    p90: paths.map(step => { const s = [...step].sort((a, b) => a - b); return Math.round(s[Math.floor(nPaths * 0.9)]) }),
  }
}

// ── Backtest for confidence scoring ──
function backtestMAPE(actuals: number[], modelFn: (hist: number[], days: number) => number[], horizon = 7, minHistory = 14): number {
  const errors: number[] = []
  for (let t = minHistory; t < actuals.length - horizon; t++) {
    const hist = actuals.slice(0, t)
    const predicted = modelFn(hist, horizon)
    const actual = actuals.slice(t, t + horizon)
    for (let h = 0; h < Math.min(predicted.length, actual.length); h++) {
      if (actual[h] !== 0) errors.push(Math.abs((predicted[h] - actual[h]) / actual[h]) * 100)
    }
  }
  return errors.length > 0 ? mean(errors) : 100
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

    // Can be called with auth (user-triggered) or without (cron/scheduled)
    let orgId: string | null = null
    const authHeader = req.headers.get('Authorization')

    if (authHeader) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: authHeader } }
      })
      const { data: { user } } = await anonClient.auth.getUser()
      if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
      const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
      orgId = profile?.org_id
    } else {
      // Scheduled invocation — process all active orgs
      const body = await req.json().catch(() => ({}))
      orgId = body.org_id || null
    }

    // If specific org, process just that one; otherwise process all active orgs
    const orgIds: string[] = []
    if (orgId) {
      orgIds.push(orgId)
    } else {
      const { data: orgs } = await supabase.from('organizations').select('id').in('plan_status', ['active', 'trialing'])
      orgIds.push(...(orgs || []).map(o => o.id))
    }

    const results: any[] = []

    for (const oid of orgIds) {
      try {
        // Fetch daily balances (aggregate across accounts)
        const { data: balances } = await supabase
          .from('daily_balances')
          .select('date, balance')
          .eq('org_id', oid)
          .order('date')

        if (!balances || balances.length < 14) {
          results.push({ org_id: oid, status: 'skipped', reason: `Insufficient data (${balances?.length || 0} days)` })
          continue
        }

        // Aggregate by date (sum across accounts)
        const byDate: Record<string, number> = {}
        balances.forEach(b => { byDate[b.date] = (byDate[b.date] || 0) + (b.balance || 0) })
        const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
        const dates = sorted.map(([d]) => d)
        const actuals = sorted.map(([_, v]) => v)

        const horizonDays = 90
        const lastBalance = actuals[actuals.length - 1]

        // Run all three models
        const linear = linearForecast(actuals, horizonDays)
        const ema = emaForecast(actuals, horizonDays)
        const mc = monteCarloForecast(actuals, horizonDays)

        // Backtest each model for confidence
        const linearMAPE = backtestMAPE(actuals, linearForecast)
        const emaMAPE = backtestMAPE(actuals, emaForecast)
        const mcMAPE = backtestMAPE(actuals, (h, d) => monteCarloForecast(h, d, 200).p50)

        // Pick best model
        const bestMAPE = Math.min(linearMAPE, emaMAPE, mcMAPE)
        const bestModel = bestMAPE === linearMAPE ? 'linear' : bestMAPE === emaMAPE ? 'ema' : 'monte_carlo'
        const bestProjection = bestModel === 'linear' ? linear : bestModel === 'ema' ? ema : mc.p50

        // Confidence score (0-1): inverse of MAPE, capped
        const confidence = Math.max(0, Math.min(1, 1 - (bestMAPE / 100)))

        // Monthly burn (avg daily outflow * 30)
        const changes = actuals.slice(1).map((v, i) => v - actuals[i])
        const negChanges = changes.filter(c => c < 0)
        const avgDailyBurn = negChanges.length > 0 ? Math.abs(mean(negChanges)) : 0
        const monthlyBurn = Math.round(avgDailyBurn * 30)

        // Runway
        const runway = monthlyBurn > 0 ? lastBalance / monthlyBurn : 999

        // Build forecast data array
        const lastDate = new Date(dates[dates.length - 1])
        const forecastData = Array.from({ length: horizonDays }, (_, i) => {
          const d = new Date(lastDate)
          d.setDate(d.getDate() + i + 1)
          return {
            date: d.toISOString().split('T')[0],
            projected_balance: bestProjection[i],
            upper_bound: mc.p90[i],
            lower_bound: mc.p10[i],
            linear: linear[i],
            ema: ema[i],
            monte_p50: mc.p50[i],
          }
        })

        // Find next low-cash date (below 10% of current balance)
        const lowThreshold = lastBalance * 0.1
        const nextLowCashDate = forecastData.find(d => d.projected_balance < lowThreshold)?.date || null

        // Upsert forecast
        await supabase.from('forecasts').upsert({
          org_id: oid,
          horizon_days: horizonDays,
          data: forecastData,
          confidence,
          monthly_burn: monthlyBurn,
          runway_months: Math.round(runway * 10) / 10,
          next_low_cash_date: nextLowCashDate,
          best_model: bestModel,
          model_accuracy: { linear: linearMAPE, ema: emaMAPE, monte_carlo: mcMAPE },
          generated_at: new Date().toISOString(),
        }, { onConflict: 'org_id' })

        // Refresh cash_position aggregate
        const { data: accounts } = await supabase.from('accounts').select('current_balance, available_balance, credit_limit, type').eq('org_id', oid).eq('is_active', true)
        const { count: bankCount } = await supabase.from('bank_connections').select('id', { count: 'exact', head: true }).eq('org_id', oid).eq('status', 'connected')

        const totalBalance = (accounts || []).reduce((s, a) => s + (a.current_balance || 0), 0)
        const liquidBalance = (accounts || []).filter(a => a.type === 'depository').reduce((s, a) => s + (a.current_balance || 0), 0)
        const availableCredit = (accounts || []).filter(a => a.type === 'credit').reduce((s, a) => s + ((a.credit_limit || 0) - Math.abs(a.current_balance || 0)), 0)

        await supabase.from('cash_position').upsert({
          org_id: oid,
          total_balance: Math.round(totalBalance),
          liquid_balance: Math.round(liquidBalance),
          available_credit: Math.round(Math.max(0, availableCredit)),
          connected_banks: bankCount || 0,
          total_accounts: accounts?.length || 0,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id' })

        results.push({
          org_id: oid,
          status: 'success',
          best_model: bestModel,
          confidence: Math.round(confidence * 100),
          monthly_burn: monthlyBurn,
          runway: Math.round(runway * 10) / 10,
          data_points: actuals.length,
          mape: { linear: Math.round(linearMAPE * 10) / 10, ema: Math.round(emaMAPE * 10) / 10, monte_carlo: Math.round(mcMAPE * 10) / 10 },
        })

        // Trigger notifications for critical findings
        if (runway > 0 && runway < 6) {
          await supabase.from('notifications').insert({
            org_id: oid, type: 'runway_warning', severity: 'critical',
            title: `Cash runway critical: ${Math.round(runway * 10) / 10} months`,
            body: `At $${monthlyBurn.toLocaleString()}/mo burn rate, cash reserves will be depleted in ${Math.round(runway * 10) / 10} months.`,
            metadata: { runway, monthly_burn: monthlyBurn, best_model: bestModel },
            action_url: '/forecast', channels_sent: ['in_app'],
          })
        }
        if (nextLowCashDate) {
          const daysToLow = Math.ceil((new Date(nextLowCashDate).getTime() - Date.now()) / 86400000)
          if (daysToLow <= 30 && daysToLow > 0) {
            await supabase.from('notifications').insert({
              org_id: oid, type: 'low_cash', severity: 'warning',
              title: `Low cash projected in ${daysToLow} days`,
              body: `Forecast model projects cash falling below 10% of current balance by ${nextLowCashDate}.`,
              metadata: { next_low_cash_date: nextLowCashDate, days: daysToLow },
              action_url: '/forecast', channels_sent: ['in_app'],
            })
          }
        }
      } catch (orgErr) {
        results.push({ org_id: oid, status: 'error', error: orgErr.message })
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
