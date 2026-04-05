import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })
    const { data: profile } = await supabase.from('profiles').select('id, org_id, role').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })
    const orgId = profile.org_id
    const isAdmin = ['owner', 'admin'].includes(profile.role)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'dashboard': {
        const { data: opps } = await supabase.from('opportunities').select('*').eq('org_id', orgId).order('priority_score', { ascending: false }).limit(50)
        const { data: rules } = await supabase.from('opportunity_rules').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('enabled', true)
        const allOpps = opps || []
        const byStatus: Record<string, number> = {}
        const byType: Record<string, number> = {}
        let totalValue = 0
        for (const o of allOpps) {
          byStatus[o.status] = (byStatus[o.status] || 0) + 1
          byType[o.opportunity_type] = (byType[o.opportunity_type] || 0) + 1
          if (['new', 'evaluating', 'approved', 'in_progress'].includes(o.status)) totalValue += Number(o.estimated_annual_value || 0)
        }
        const captured = allOpps.filter(o => o.status === 'captured').reduce((s, o) => s + Number(o.captured_value || 0), 0)
        return json({
          summary: { total: allOpps.length, active: allOpps.filter(o => !['captured', 'declined', 'expired'].includes(o.status)).length, pipeline_value: totalValue, captured_value: captured },
          by_status: byStatus, by_type: byType,
          opportunities: allOpps, rules: rules || [],
        })
      }

      case 'update_opportunity': {
        const { opportunity_id, status, assigned_to, captured_value, declined_reason } = body
        const updates: any = { updated_at: new Date().toISOString() }
        if (status) {
          updates.status = status
          if (status === 'evaluating') updates.evaluated_at = new Date().toISOString()
          if (status === 'approved') updates.approved_at = new Date().toISOString()
          if (status === 'captured') { updates.captured_at = new Date().toISOString(); updates.captured_value = captured_value }
          if (status === 'declined') updates.declined_reason = declined_reason
        }
        if (assigned_to) updates.assigned_to = assigned_to
        await supabase.from('opportunities').update(updates).eq('id', opportunity_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'create_opportunity': {
        const { title, description, opportunity_type, category, estimated_annual_value, estimated_one_time_value, impact_score, effort_score, confidence_score, recommended_actions } = body
        const { data } = await supabase.from('opportunities').insert({
          org_id: orgId, title, description, opportunity_type: opportunity_type || 'custom',
          category: category || 'financial', impact_score: impact_score || 50,
          effort_score: effort_score || 50, confidence_score: confidence_score || 50,
          estimated_annual_value, estimated_one_time_value,
          source: 'user_reported', recommended_actions: recommended_actions || [],
        }).select().single()
        return json({ success: true, opportunity: data })
      }

      // ── SCAN FOR OPPORTUNITIES (cron) ──
      case 'scan': {
        const { data: orgs } = await supabase.from('organizations').select('id')
        let totalFound = 0
        for (const org of (orgs || [])) {
          const oId = org.id
          // Idle cash: check accounts with balance > sweep threshold or target * 1.5
          const { data: positions } = await supabase.from('cash_positions_realtime').select('account_id, available_balance, target_balance, sweep_threshold').eq('org_id', oId)
          for (const pos of (positions || [])) {
            const target = Number(pos.target_balance || pos.sweep_threshold || 100000)
            if (Number(pos.available_balance) > target * 1.5) {
              const excess = Number(pos.available_balance) - target
              const existing = await supabase.from('opportunities').select('id').eq('org_id', oId).eq('opportunity_type', 'idle_cash_optimization').in('status', ['new', 'evaluating']).limit(1)
              if (!existing.data?.length) {
                await supabase.from('opportunities').insert({
                  org_id: oId, title: `$${Math.round(excess).toLocaleString()} idle cash detected`,
                  description: `Account has $${Math.round(Number(pos.available_balance)).toLocaleString()} available, ${Math.round(excess / target * 100)}% above target. Consider sweep to high-yield or short-term investment.`,
                  opportunity_type: 'idle_cash_optimization', category: 'financial',
                  impact_score: Math.min(90, Math.round(excess / 10000)), effort_score: 15, confidence_score: 90,
                  estimated_annual_value: Math.round(excess * 0.045), // ~4.5% yield
                  source: 'ai_detected', detected_by: 'idle_cash_scanner',
                  evidence: { account_id: pos.account_id, available: pos.available_balance, target, excess },
                  recommended_actions: [{ action: 'Sweep excess to high-yield savings', effort: 'small', impact: 'high' }],
                  action_url: '/cash-visibility', expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
                })
                totalFound++
              }
            }
          }

          // Data quality improvement opportunities
          const { data: sources } = await supabase.from('data_sources').select('source_name, quality_score, completeness_pct, fields_mapped, fields_total').eq('org_id', oId)
          for (const src of (sources || [])) {
            if (src.fields_total > 0 && src.fields_mapped < src.fields_total * 0.7) {
              const existing = await supabase.from('opportunities').select('id').eq('org_id', oId).eq('opportunity_type', 'process_automation').like('title', `%${src.source_name}%`).in('status', ['new', 'evaluating']).limit(1)
              if (!existing.data?.length) {
                await supabase.from('opportunities').insert({
                  org_id: oId, title: `Improve ${src.source_name} field mapping (${Math.round(src.fields_mapped / src.fields_total * 100)}% mapped)`,
                  description: `Only ${src.fields_mapped} of ${src.fields_total} fields are mapped. Completing the mapping will improve forecast accuracy and reporting coverage.`,
                  opportunity_type: 'process_automation', category: 'technology',
                  impact_score: 40, effort_score: 25, confidence_score: 85,
                  source: 'ai_detected', detected_by: 'data_quality_scanner',
                  action_url: '/data-intelligence',
                })
                totalFound++
              }
            }
          }
        }
        return json({ opportunities_found: totalFound })
      }

      // ── SWOT MATRIX SNAPSHOT (cron) ──
      case 'swot_snapshot': {
        const period = new Date().toISOString().slice(0, 10)
        const { data: orgs } = await supabase.from('organizations').select('id')
        for (const org of (orgs || [])) {
          const oId = org.id
          const { count: oppCount } = await supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('org_id', oId).in('status', ['new', 'evaluating', 'approved', 'in_progress'])
          const { count: weakCount } = await supabase.from('weaknesses').select('id', { count: 'exact', head: true }).eq('org_id', oId).in('status', ['open', 'acknowledged', 'remediation_planned', 'in_progress'])
          const { count: threatCount } = await supabase.from('threats').select('id', { count: 'exact', head: true }).eq('org_id', oId).in('status', ['active', 'monitoring'])

          const { data: topOpps } = await supabase.from('opportunities').select('id, title, priority_score, estimated_annual_value').eq('org_id', oId).in('status', ['new', 'evaluating']).order('priority_score', { ascending: false }).limit(3)
          const { data: topWeaks } = await supabase.from('weaknesses').select('id, title, severity, risk_score').eq('org_id', oId).in('status', ['open', 'acknowledged']).order('risk_score', { ascending: false }).limit(3)
          const { data: topThreats } = await supabase.from('threats').select('id, title, risk_score, potential_loss_max').eq('org_id', oId).in('status', ['active', 'monitoring']).order('risk_score', { ascending: false }).limit(3)

          const oppValue = (topOpps || []).reduce((s, o) => s + Number(o.estimated_annual_value || 0), 0)
          const threatExposure = (topThreats || []).reduce((s, t) => s + Number(t.potential_loss_max || 0), 0)
          const oppScore = Math.min(100, (oppCount || 0) * 15)
          const riskScore = Math.min(100, ((weakCount || 0) + (threatCount || 0)) * 10)
          const health = Math.max(0, Math.min(100, 70 + oppScore / 5 - riskScore / 3))

          await supabase.from('swot_matrix').upsert({
            org_id: oId, period, opportunities_count: oppCount || 0, weaknesses_count: weakCount || 0, threats_count: threatCount || 0,
            overall_health_score: Math.round(health), opportunity_score: oppScore, risk_score: riskScore,
            top_opportunities: topOpps || [], top_weaknesses: topWeaks || [], top_threats: topThreats || [],
            total_opportunity_value: oppValue, total_threat_exposure: threatExposure,
          }, { onConflict: 'org_id,period' })
        }
        return json({ success: true })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
