import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// Industry benchmark data for Treasury Benchmark tool
const BENCHMARKS: Record<string, { median: number, p25: number, p75: number, unit: string, label: string }> = {
  reconciliation_hours: { median: 12, p25: 6, p75: 20, unit: 'h/week', label: 'Reconciliation Time' },
  bank_connections: { median: 4, p25: 2, p75: 8, unit: '', label: 'Bank Accounts' },
  forecast_accuracy: { median: 72, p25: 55, p75: 85, unit: '%', label: 'Forecast Accuracy' },
  cash_visibility_delay: { median: 24, p25: 4, p75: 48, unit: 'hours', label: 'Cash Visibility Delay' },
  manual_processes_pct: { median: 45, p25: 20, p75: 70, unit: '%', label: 'Manual Process Reliance' },
  error_rate: { median: 3.8, p25: 1.2, p75: 7.5, unit: '%', label: 'Spreadsheet Error Rate' },
  team_size: { median: 3, p25: 1, p75: 6, unit: 'people', label: 'Treasury Team Size' },
  monthly_burn: { median: 250000, p25: 75000, p75: 800000, unit: '$', label: 'Monthly Burn Rate' },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      // ── LIST PUBLISHED TOOLS ──
      case 'list': {
        const { data } = await supabase.from('interactive_tools').select('slug, name, description, category, icon, views, completions, meta_title, meta_description').eq('status', 'published').order('views', { ascending: false })
        return json({ tools: data || [] })
      }

      // ── GET TOOL CONFIG ──
      case 'get': {
        const { slug } = body
        const { data: tool } = await supabase.from('interactive_tools').select('*').eq('slug', slug).eq('status', 'published').single()
        if (!tool) return json({ error: 'Tool not found' })
        await supabase.from('interactive_tools').update({ views: tool.views + 1 }).eq('id', tool.id)
        return json({ tool })
      }

      // ── SUBMIT TOOL RESULTS ──
      case 'submit': {
        const { tool_slug, inputs, results, time_spent_seconds, email, session_id } = body
        const { data: tool } = await supabase.from('interactive_tools').select('id, capture_source').eq('slug', tool_slug).single()
        if (!tool) return json({ error: 'Tool not found' })

        // Link to lead if email provided
        let leadId = null
        if (email) {
          const { data: lead } = await supabase.from('leads').select('id').eq('email', email.toLowerCase()).single()
          leadId = lead?.id
        }

        const { data: sub } = await supabase.from('tool_submissions').insert({
          tool_id: tool.id, lead_id: leadId, session_id,
          inputs: inputs || {}, results: results || {},
          time_spent_seconds, completed: true, email,
        }).select().single()

        // Increment completion count
        await supabase.from('interactive_tools').update({ completions: (await supabase.from('interactive_tools').select('completions').eq('id', tool.id).single()).data?.completions + 1 || 1 }).eq('id', tool.id)

        return json({ success: true, submission_id: sub?.id })
      }

      // ── BENCHMARK DATA (for Treasury Benchmark tool) ──
      case 'benchmark': {
        const { inputs } = body // user's treasury metrics
        if (!inputs) return json({ error: 'Inputs required' })

        const results: any[] = []
        for (const [key, benchmark] of Object.entries(BENCHMARKS)) {
          const userValue = inputs[key]
          if (userValue == null) continue
          const pctile = userValue <= benchmark.p25 ? 75 + 25 * ((benchmark.p25 - userValue) / benchmark.p25)
            : userValue <= benchmark.median ? 50 + 25 * ((benchmark.median - userValue) / (benchmark.median - benchmark.p25))
            : userValue <= benchmark.p75 ? 25 + 25 * ((benchmark.p75 - userValue) / (benchmark.p75 - benchmark.median))
            : Math.max(0, 25 * (1 - (userValue - benchmark.p75) / benchmark.p75))

          // Lower is better for most metrics except forecast_accuracy
          const invertedMetrics = ['forecast_accuracy', 'bank_connections', 'team_size']
          const finalPctile = invertedMetrics.includes(key)
            ? (userValue >= benchmark.p75 ? 85 : userValue >= benchmark.median ? 60 : userValue >= benchmark.p25 ? 35 : 15)
            : Math.round(Math.min(100, Math.max(0, pctile)))

          results.push({
            metric: key, label: benchmark.label, unit: benchmark.unit,
            your_value: userValue, median: benchmark.median, p25: benchmark.p25, p75: benchmark.p75,
            percentile: finalPctile,
            rating: finalPctile >= 75 ? 'excellent' : finalPctile >= 50 ? 'good' : finalPctile >= 25 ? 'below_average' : 'needs_improvement',
          })
        }

        const overallScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentile, 0) / results.length) : 50

        return json({ results, overall_score: overallScore, benchmarks_compared: results.length })
      }

      // ── BURN RATE SIMULATOR ──
      case 'simulate_burn': {
        const { current_cash, monthly_revenue, monthly_expenses, scenarios } = body
        if (!current_cash || !monthly_expenses) return json({ error: 'current_cash and monthly_expenses required' })

        const baseNet = (monthly_revenue || 0) - monthly_expenses
        const baseRunway = baseNet >= 0 ? 999 : Math.abs(current_cash / baseNet)

        const simResults = (scenarios || [
          { name: 'Base Case', revenue_change: 0, expense_change: 0 },
          { name: 'Revenue -20%', revenue_change: -0.2, expense_change: 0 },
          { name: 'Revenue -50%', revenue_change: -0.5, expense_change: 0 },
          { name: 'Expenses +20%', revenue_change: 0, expense_change: 0.2 },
          { name: 'Cut 30% costs', revenue_change: 0, expense_change: -0.3 },
        ]).map((s: any) => {
          const adjRevenue = (monthly_revenue || 0) * (1 + (s.revenue_change || 0))
          const adjExpenses = monthly_expenses * (1 + (s.expense_change || 0))
          const net = adjRevenue - adjExpenses
          const runway = net >= 0 ? 999 : Math.abs(current_cash / net)

          // Monthly projection
          const months: number[] = []
          let balance = current_cash
          for (let m = 0; m < 24; m++) { balance += net; months.push(Math.max(0, Math.round(balance))) }

          return { ...s, monthly_revenue: Math.round(adjRevenue), monthly_expenses: Math.round(adjExpenses), net_monthly: Math.round(net), runway_months: Math.round(runway * 10) / 10, projections: months }
        })

        return json({ current_cash, base_runway: Math.round(baseRunway * 10) / 10, scenarios: simResults })
      }

      // ── TOOL ANALYTICS (admin) ──
      case 'analytics': {
        const { data: tools } = await supabase.from('interactive_tools').select('slug, name, views, completions, avg_time_seconds, status').order('views', { ascending: false })
        const { data: recentSubs } = await supabase.from('tool_submissions').select('tool_id, inputs, results, completed, created_at').order('created_at', { ascending: false }).limit(20)
        return json({ tools: tools || [], recent_submissions: recentSubs || [] })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
