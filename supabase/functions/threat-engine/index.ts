import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const LIKELIHOOD_SCORE: Record<string, number> = { rare: 10, unlikely: 25, possible: 50, likely: 75, almost_certain: 95 }
const IMPACT_SCORE: Record<string, number> = { insignificant: 10, minor: 25, moderate: 50, major: 75, catastrophic: 95 }

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
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'dashboard': {
        const { data: threats } = await supabase.from('threats').select('*').eq('org_id', orgId).order('risk_score', { ascending: false }).limit(50)
        const { data: monitors } = await supabase.from('threat_monitors').select('*').or(`org_id.eq.${orgId},org_id.is.null`).eq('enabled', true)
        const { data: matrix } = await supabase.from('swot_matrix').select('*').eq('org_id', orgId).order('period', { ascending: false }).limit(6)
        const all = threats || []
        const active = all.filter(t => ['active', 'monitoring'].includes(t.status))
        const byCategory: Record<string, number> = {}; const byLikelihood: Record<string, number> = {}
        let totalExposure = 0
        for (const t of active) {
          byCategory[t.category] = (byCategory[t.category] || 0) + 1
          byLikelihood[t.likelihood] = (byLikelihood[t.likelihood] || 0) + 1
          totalExposure += Number(t.potential_loss_max || t.expected_loss || 0)
        }
        const escalated = active.filter(t => t.escalated)
        const worsening = active.filter(t => t.trend === 'worsening' || t.trend === 'escalating')
        return json({
          summary: { total: all.length, active: active.length, escalated: escalated.length, worsening: worsening.length, total_exposure: totalExposure, avg_risk: active.length ? Math.round(active.reduce((s, t) => s + t.risk_score, 0) / active.length) : 0 },
          by_category: byCategory, by_likelihood: byLikelihood,
          threats: all, monitors: monitors || [], swot_trend: matrix || [],
        })
      }

      case 'update_threat': {
        const { threat_id, status, likelihood, impact_level, trend, assigned_to, countermeasures, contingency_plan, escalated } = body
        const updates: any = { updated_at: new Date().toISOString(), last_reviewed_at: new Date().toISOString(), review_count: 0 }
        if (status) {
          updates.status = status
          if (status === 'mitigated') updates.mitigated_at = new Date().toISOString()
          if (status === 'materialized') updates.materialized_at = new Date().toISOString()
        }
        if (likelihood) { updates.likelihood = likelihood; updates.risk_score = Math.round((LIKELIHOOD_SCORE[likelihood] || 50) * (IMPACT_SCORE[updates.impact_level || 'moderate'] || 50) / 100) }
        if (impact_level) { updates.impact_level = impact_level }
        if (likelihood && impact_level) updates.risk_score = Math.round((LIKELIHOOD_SCORE[likelihood] || 50) * (IMPACT_SCORE[impact_level] || 50) / 100)
        if (trend) updates.trend = trend
        if (assigned_to) updates.assigned_to = assigned_to
        if (countermeasures) updates.countermeasures = countermeasures
        if (contingency_plan) updates.contingency_plan = contingency_plan
        if (escalated != null) { updates.escalated = escalated; if (escalated) updates.escalated_at = new Date().toISOString() }
        // Increment review count
        const { data: existing } = await supabase.from('threats').select('review_count').eq('id', threat_id).single()
        updates.review_count = (existing?.review_count || 0) + 1
        await supabase.from('threats').update(updates).eq('id', threat_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'create_threat': {
        const { title, description, threat_type, category, likelihood, impact_level, velocity, potential_loss_min, potential_loss_max, countermeasures, contingency_plan, exploits_weaknesses, monitor_frequency } = body
        const riskScore = Math.round((LIKELIHOOD_SCORE[likelihood || 'possible'] || 50) * (IMPACT_SCORE[impact_level || 'moderate'] || 50) / 100)
        const expected = potential_loss_max ? Math.round(Number(potential_loss_max) * (LIKELIHOOD_SCORE[likelihood || 'possible'] || 50) / 100) : null
        const { data } = await supabase.from('threats').insert({
          org_id: orgId, title, description, threat_type: threat_type || 'custom',
          category: category || 'financial', likelihood: likelihood || 'possible',
          impact_level: impact_level || 'moderate', risk_score: riskScore,
          velocity: velocity || 'medium', potential_loss_min, potential_loss_max,
          expected_loss: expected, source: 'user_reported',
          countermeasures: countermeasures || [], contingency_plan,
          exploits_weaknesses: exploits_weaknesses || [],
          monitor_frequency: monitor_frequency || 'daily',
          next_review_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
        }).select().single()
        return json({ success: true, threat: data })
      }

      // ── THREAT MONITORING SCAN (cron) ──
      case 'scan': {
        const { data: orgs } = await supabase.from('organizations').select('id')
        let totalFound = 0
        for (const org of (orgs || [])) {
          const oId = org.id

          // 1. Bank connection instability
          const { data: errorSources } = await supabase.from('data_sources').select('source_name, status, last_sync_at').eq('org_id', oId).in('status', ['error', 'disconnected'])
          for (const src of (errorSources || [])) {
            const existing = await supabase.from('threats').select('id').eq('org_id', oId).eq('threat_type', 'vendor_failure').like('title', `%${src.source_name}%`).in('status', ['active', 'monitoring']).limit(1)
            if (!existing.data?.length) {
              await supabase.from('threats').insert({
                org_id: oId, title: `${src.source_name} connection failure — cash visibility at risk`,
                description: `Data source "${src.source_name}" is in ${src.status} state. This creates a blind spot in cash positions and may cause forecast drift.`,
                threat_type: 'vendor_failure', category: 'operational',
                likelihood: 'likely', impact_level: 'moderate',
                risk_score: Math.round(LIKELIHOOD_SCORE.likely * IMPACT_SCORE.moderate / 100),
                velocity: 'fast', source: 'system', detected_by: 'threat_scanner',
                countermeasures: [{ measure: 'Re-authenticate connection', status: 'pending', effectiveness: 'high' }],
                action_url: '/integrations',
              })
              totalFound++
            }
          }

          // 2. Cash below critical levels
          const { data: positions } = await supabase.from('cash_positions_realtime').select('available_balance, minimum_balance').eq('org_id', oId).eq('below_minimum', true)
          if ((positions || []).length > 0) {
            const existing = await supabase.from('threats').select('id').eq('org_id', oId).eq('threat_type', 'counterparty_risk').like('title', '%cash below minimum%').in('status', ['active', 'monitoring']).limit(1)
            if (!existing.data?.length) {
              await supabase.from('threats').insert({
                org_id: oId, title: `${positions.length} account(s) with cash below minimum balance`,
                description: `Operating accounts have dropped below minimum balance thresholds, risking overdraft fees, failed payments, or covenant violations.`,
                threat_type: 'counterparty_risk', category: 'financial',
                likelihood: 'likely', impact_level: 'major',
                risk_score: Math.round(LIKELIHOOD_SCORE.likely * IMPACT_SCORE.major / 100),
                velocity: 'immediate', source: 'system', detected_by: 'threat_scanner',
                action_url: '/cash-visibility',
              })
              totalFound++
            }
          }

          // 3. High open weakness count → systemic threat
          const { count: openWeaknesses } = await supabase.from('weaknesses').select('id', { count: 'exact', head: true }).eq('org_id', oId).in('status', ['open', 'acknowledged']).in('severity', ['high', 'critical'])
          if ((openWeaknesses || 0) >= 5) {
            const existing = await supabase.from('threats').select('id').eq('org_id', oId).eq('threat_type', 'technology_obsolescence').like('title', '%systemic%').in('status', ['active']).limit(1)
            if (!existing.data?.length) {
              await supabase.from('threats').insert({
                org_id: oId, title: `Systemic risk: ${openWeaknesses} high/critical weaknesses unresolved`,
                description: `The accumulation of ${openWeaknesses} unresolved high/critical weaknesses creates compounding risk across operations, data, and compliance.`,
                threat_type: 'technology_obsolescence', category: 'operational',
                likelihood: 'possible', impact_level: 'major',
                risk_score: Math.round(LIKELIHOOD_SCORE.possible * IMPACT_SCORE.major / 100),
                velocity: 'slow', source: 'system', detected_by: 'threat_scanner',
              })
              totalFound++
            }
          }

          // 4. Update trend on existing threats
          const { data: activeThreats } = await supabase.from('threats').select('id, risk_score, created_at, trend').eq('org_id', oId).in('status', ['active', 'monitoring'])
          for (const threat of (activeThreats || [])) {
            const ageHours = (Date.now() - new Date(threat.created_at).getTime()) / 3600000
            if (ageHours > 168 && threat.risk_score >= 70 && threat.trend !== 'escalating') { // >7 days, high risk
              await supabase.from('threats').update({ trend: 'worsening', updated_at: new Date().toISOString() }).eq('id', threat.id)
            }
          }
        }
        return json({ threats_found: totalFound })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
