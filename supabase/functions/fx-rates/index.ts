import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const ECB_API = 'https://api.frankfurter.app'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { symbols = 'EUR,GBP,JPY,CAD,AUD,CHF', days = 30, base = 'USD' } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Latest rates
    const latestRes = await fetch(`${ECB_API}/latest?from=${base}&to=${symbols}`)
    const latest = await latestRes.json()

    // Historical rates
    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
    const histRes = await fetch(`${ECB_API}/${startDate}..${endDate}?from=${base}&to=${symbols}`)
    const hist = await histRes.json()

    // Compute daily changes and trends
    const currencies = symbols.split(',').map((s: string) => s.trim())
    const trends: Record<string, any> = {}

    for (const curr of currencies) {
      const dates = Object.keys(hist.rates || {}).sort()
      const values = dates.map(d => hist.rates[d]?.[curr]).filter(Boolean)
      if (values.length >= 2) {
        const first = values[0]
        const last = values[values.length - 1]
        const change = last - first
        const pctChange = (change / first) * 100
        const high = Math.max(...values)
        const low = Math.min(...values)
        trends[curr] = { current: latest.rates?.[curr], change, pctChange, high, low, dataPoints: values.length }
      }
    }

    return json({ base, date: latest.date, rates: latest.rates, history: hist.rates, trends })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
