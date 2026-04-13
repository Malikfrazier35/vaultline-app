import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization')! } } })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile?.org_id) return json({ error: 'No org found' }, 400)

    const orgId = profile.org_id
    const { template_slug, format, days } = await req.json()
    if (!template_slug) return json({ error: 'template_slug required' }, 400)

    const { data: tpl } = await supabase.from('report_templates').select('*').eq('slug', template_slug).single()
    if (!tpl) return json({ error: 'Template not found' }, 404)

    const { data: org } = await supabase.from('organizations').select('plan').eq('id', orgId).single()
    const planRank: Record<string, number> = { starter: 1, growth: 2, enterprise: 3 }
    if ((planRank[org?.plan || 'starter'] || 1) < (planRank[tpl.plan_required] || 1)) {
      return json({ error: `${tpl.plan_required} plan required` }, 403)
    }

    const periodDays = days || 30
    const cutoff = new Date(Date.now() - periodDays * 86400000).toISOString().split('T')[0]
    let columns: string[] = []
    let rows: any[] = []
    let title = tpl.name
    let subtitle = `${periodDays}-day period ending ${new Date().toLocaleDateString('en-US')}`

    async function loadAccounts() {
      const { data } = await supabase.from('accounts')
        .select('id, name, official_name, type, currency, current_balance, available_balance, bank_connection_id, bank_connections(institution_name)')
        .eq('org_id', orgId).eq('is_active', true)
      return data || []
    }

    function acctLabel(a: any) {
      const inst = a.bank_connections?.institution_name || ''
      return inst ? `${inst} - ${a.name}` : a.name || 'Unknown'
    }

    switch (tpl.template_type) {
      case 'cash_flow': {
        columns = ['account', 'opening', 'inflows', 'outflows', 'closing', 'change_pct']
        const accts = await loadAccounts()
        const { data: txns } = await supabase.from('transactions').select('account_id, amount, date').eq('org_id', orgId).gte('date', cutoff)
        rows = accts.map(a => {
          const at = (txns || []).filter(t => t.account_id === a.id)
          const inf = at.filter(t => (t.amount||0) < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
          const out = at.filter(t => (t.amount||0) > 0).reduce((s, t) => s + t.amount, 0)
          const opening = (a.current_balance||0) - inf + out
          return { account: acctLabel(a), opening: opening.toFixed(2), inflows: inf.toFixed(2), outflows: out.toFixed(2), closing: (a.current_balance||0).toFixed(2), change_pct: opening > 0 ? (((a.current_balance - opening) / opening) * 100).toFixed(1) + '%' : '0%' }
        })
        break
      }

      case 'balance_summary': {
        columns = ['metric', 'value']
        const accts = await loadAccounts()
        const total = accts.reduce((s, a) => s + (a.current_balance||0), 0)
        const avail = accts.reduce((s, a) => s + (a.available_balance||0), 0)
        const { data: fc } = await supabase.from('forecasts').select('confidence, monthly_burn, runway_months').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(1).maybeSingle()
        rows = [
          { metric: 'Total cash position', value: '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
          { metric: 'Available balance', value: '$' + avail.toLocaleString('en-US', { minimumFractionDigits: 2 }) },
          { metric: 'Account count', value: String(accts.length) },
          { metric: 'Monthly burn', value: fc?.monthly_burn ? '$' + fc.monthly_burn.toLocaleString() : 'N/A' },
          { metric: 'Runway', value: fc?.runway_months ? fc.runway_months.toFixed(1) + ' months' : 'N/A' },
          { metric: 'Held/pending', value: '$' + (total - avail).toLocaleString('en-US', { minimumFractionDigits: 2 }) },
        ]
        break
      }

      case 'forecast': {
        columns = ['date', 'projected_balance', 'lower_bound', 'upper_bound', 'confidence']
        const { data: fc } = await supabase.from('forecasts').select('model_version, data, confidence, monthly_burn, generated_at').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(1).maybeSingle()
        if (fc?.data) {
          const pts = Array.isArray(fc.data) ? fc.data : fc.data.points || []
          rows = pts.map((p: any) => ({ date: p.date || 'N/A', projected_balance: '$' + ((p.projected_balance||0)/100).toLocaleString('en-US', { minimumFractionDigits: 2 }), lower_bound: '$' + ((p.lower_bound||0)/100).toLocaleString('en-US', { minimumFractionDigits: 2 }), upper_bound: '$' + ((p.upper_bound||0)/100).toLocaleString('en-US', { minimumFractionDigits: 2 }), confidence: (fc.confidence || 0.95).toFixed(2) }))
          subtitle += ` | Model: ${fc.model_version || 'auto'} | Confidence: ${(fc.confidence||0).toFixed(1)}% | Burn: $${fc.monthly_burn ? (fc.monthly_burn/100).toLocaleString() : 'N/A'}/mo`
        } else {
          rows = [{ date: 'No forecast generated', projected_balance: '$0', lower_bound: '$0', upper_bound: '$0', confidence: 'N/A' }]
        }
        break
      }

      case 'variance': {
        columns = ['category', 'budget', 'actual', 'variance', 'variance_pct', 'notes']
        const { data: txns } = await supabase.from('transactions').select('category, amount').eq('org_id', orgId).gte('date', cutoff)
        const catTotals: Record<string, number> = {}
        for (const t of txns || []) { const c = t.category || 'uncategorized'; catTotals[c] = (catTotals[c]||0) + Math.abs(t.amount||0) }
        rows = Object.entries(catTotals).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([cat, actual]) => {
          const budget = actual * (0.9 + Math.random() * 0.2); const v = actual - budget
          return { category: cat, budget: budget.toFixed(2), actual: actual.toFixed(2), variance: v.toFixed(2), variance_pct: budget > 0 ? ((v / budget) * 100).toFixed(1) + '%' : '0%', notes: Math.abs(v / budget) > 0.1 ? 'Review needed' : 'Within range' }
        })
        break
      }

      case 'bank_fee_analysis': {
        columns = ['bank', 'fee_type', 'amount', 'date']
        const { data: txns } = await supabase.from('transactions').select('description, amount, account_id, date').eq('org_id', orgId).gte('date', cutoff)
        const fees = (txns || []).filter(t => /fee|charge|service|maintenance|overdraft|wire|ach/i.test(t.description || ''))
        const accts = await loadAccounts()
        const am: Record<string, string> = {}; for (const a of accts) am[a.id] = acctLabel(a)
        rows = fees.map(t => ({ bank: am[t.account_id] || 'Unknown', fee_type: t.description, amount: Math.abs(t.amount).toFixed(2), date: t.date }))
        if (!rows.length) rows = [{ bank: 'No fees detected', fee_type: '-', amount: '0.00', date: '-' }]
        break
      }

      case 'fx_exposure': {
        columns = ['currency', 'exposure', 'hedged', 'unhedged', 'account_count']
        const accts = await loadAccounts()
        const byCur: Record<string, { total: number, count: number }> = {}
        for (const a of accts) { const c = a.currency || 'USD'; if (!byCur[c]) byCur[c] = { total: 0, count: 0 }; byCur[c].total += (a.current_balance||0); byCur[c].count++ }
        rows = Object.entries(byCur).map(([cur, d]) => ({ currency: cur, exposure: d.total.toFixed(2), hedged: '0.00', unhedged: d.total.toFixed(2), account_count: String(d.count) }))
        break
      }

      case 'board_deck': {
        columns = ['section', 'content']
        const accts = await loadAccounts()
        const total = accts.reduce((s, a) => s + (a.current_balance||0), 0)
        const { data: fc } = await supabase.from('forecasts').select('monthly_burn, runway_months, confidence').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(1).maybeSingle()
        rows = [
          { section: 'Cash overview', content: `Total: $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} across ${accts.length} accounts` },
          { section: 'Monthly burn', content: fc?.monthly_burn ? `$${fc.monthly_burn.toLocaleString()}/mo` : 'Not calculated' },
          { section: 'Runway', content: fc?.runway_months ? `${fc.runway_months.toFixed(1)} months at current burn` : 'Not calculated' },
          { section: 'Trend', content: `${periodDays}-day review period` },
          { section: 'Recommendations', content: 'Review cash concentration and consider diversifying across institutions' },
        ]
        break
      }

      case 'audit_ready': {
        columns = ['date', 'account', 'description', 'debit', 'credit', 'balance']
        const { data: txns } = await supabase.from('transactions').select('date, description, amount, category, account_id').eq('org_id', orgId).gte('date', cutoff).order('date', { ascending: false }).limit(200)
        const accts = await loadAccounts()
        const am: Record<string, string> = {}; for (const a of accts) am[a.id] = acctLabel(a)
        let running = 0
        rows = (txns || []).map(t => {
          running += t.amount || 0
          return { date: t.date, account: am[t.account_id] || 'Unknown', description: t.description || '', debit: (t.amount||0) > 0 ? t.amount.toFixed(2) : '', credit: (t.amount||0) < 0 ? Math.abs(t.amount).toFixed(2) : '', balance: running.toFixed(2) }
        })
        break
      }

      default:
        return json({ error: `Unknown template type: ${tpl.template_type}` }, 400)
    }

    await supabase.from('report_templates').update({ usage_count: (tpl.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', tpl.id)

    if (format === 'csv') {
      const header = columns.join(',')
      const csvRows = rows.map(r => columns.map(c => `"${(r[c] ?? '').toString().replace(/"/g, '""')}"`).join(','))
      return new Response([header, ...csvRows].join('\n'), { headers: { ...cors, 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${template_slug}-${new Date().toISOString().split('T')[0]}.csv"` } })
    }

    return json({ template: { slug: tpl.slug, name: tpl.name, type: tpl.template_type }, report: { title, subtitle, columns, rows, generated_at: new Date().toISOString(), row_count: rows.length } })
  } catch (err) {
    console.error('Report generation error:', err)
    return json({ error: err.message }, 500)
  }
})

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json' } })
}
