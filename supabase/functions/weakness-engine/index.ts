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
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'dashboard': {
        const { data: weaks } = await supabase.from('weaknesses').select('*').eq('org_id', orgId).order('risk_score', { ascending: false }).limit(50)
        const { data: scans } = await supabase.from('weakness_scans').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5)
        const all = weaks || []
        const open = all.filter(w => !['resolved', 'wont_fix', 'mitigated'].includes(w.status))
        const bySeverity: Record<string, number> = {}; const byCategory: Record<string, number> = {}; const byType: Record<string, number> = {}
        let totalExposure = 0
        for (const w of open) {
          bySeverity[w.severity] = (bySeverity[w.severity] || 0) + 1
          byCategory[w.category] = (byCategory[w.category] || 0) + 1
          byType[w.weakness_type] = (byType[w.weakness_type] || 0) + 1
          totalExposure += Number(w.financial_exposure || 0)
        }
        const avgRisk = open.length ? Math.round(open.reduce((s, w) => s + w.risk_score, 0) / open.length) : 0
        return json({
          summary: { total: all.length, open: open.length, critical: open.filter(w => w.severity === 'critical').length, high: open.filter(w => w.severity === 'high').length, avg_risk: avgRisk, total_exposure: totalExposure },
          by_severity: bySeverity, by_category: byCategory, by_type: byType,
          weaknesses: all, recent_scans: scans || [],
        })
      }

      case 'update_weakness': {
        const { weakness_id, status, assigned_to, remediation_plan, accepted_reason } = body
        const updates: any = { updated_at: new Date().toISOString() }
        if (status) {
          updates.status = status
          if (status === 'acknowledged') updates.acknowledged_at = new Date().toISOString()
          if (status === 'in_progress') updates.remediation_started_at = new Date().toISOString()
          if (status === 'resolved' || status === 'mitigated') updates.resolved_at = new Date().toISOString()
          if (status === 'accepted') updates.accepted_reason = accepted_reason
        }
        if (assigned_to) updates.assigned_to = assigned_to
        if (remediation_plan) updates.remediation_plan = remediation_plan
        await supabase.from('weaknesses').update(updates).eq('id', weakness_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'create_weakness': {
        const { title, description, weakness_type, category, severity, risk_score, affected_areas, financial_exposure, remediation_plan, estimated_fix_effort } = body
        const { data } = await supabase.from('weaknesses').insert({
          org_id: orgId, title, description, weakness_type: weakness_type || 'custom',
          category: category || 'process', severity: severity || 'medium',
          risk_score: risk_score || 50, affected_areas: affected_areas || [],
          financial_exposure, remediation_plan: remediation_plan || [],
          estimated_fix_effort, source: 'user_reported',
        }).select().single()
        return json({ success: true, weakness: data })
      }

      // ── WEAKNESS SCAN (cron) ──
      case 'scan': {
        const { data: orgs } = await supabase.from('organizations').select('id')
        let totalFound = 0
        for (const org of (orgs || [])) {
          const oId = org.id
          const scanStart = Date.now()
          let checksRun = 0, found = 0, newFound = 0

          // 1. Data quality gaps
          checksRun++
          const { data: sources } = await supabase.from('data_sources').select('source_name, quality_score, completeness_pct, status').eq('org_id', oId)
          for (const src of (sources || [])) {
            if (src.quality_score < 50) {
              const existing = await supabase.from('weaknesses').select('id').eq('org_id', oId).eq('weakness_type', 'data_quality_gap').like('title', `%${src.source_name}%`).in('status', ['open', 'acknowledged', 'in_progress']).limit(1)
              if (!existing.data?.length) {
                await supabase.from('weaknesses').insert({
                  org_id: oId, title: `${src.source_name} data quality at ${src.quality_score}%`,
                  description: `Data source "${src.source_name}" has quality score of ${src.quality_score}% and completeness of ${src.completeness_pct}%. This degrades forecast accuracy and reporting reliability.`,
                  weakness_type: 'data_quality_gap', category: 'data', severity: src.quality_score < 25 ? 'critical' : 'high',
                  risk_score: 100 - src.quality_score, affected_areas: ['forecasting', 'reporting', 'cash_visibility'],
                  source: 'quality_check', detected_by: 'weakness_scanner',
                  estimated_fix_effort: 'small', estimated_fix_days: 3,
                })
                newFound++
              }
              found++
            }
          }

          // 2. Missing integrations
          checksRun++
          const { count: sourceCount } = await supabase.from('data_sources').select('id', { count: 'exact', head: true }).eq('org_id', oId)
          if ((sourceCount || 0) < 2) {
            const existing = await supabase.from('weaknesses').select('id').eq('org_id', oId).eq('weakness_type', 'integration_missing').in('status', ['open', 'acknowledged']).limit(1)
            if (!existing.data?.length) {
              await supabase.from('weaknesses').insert({
                org_id: oId, title: `Only ${sourceCount || 0} data source(s) connected`,
                description: 'Limited data sources reduce cash visibility and forecast accuracy. Connect additional bank accounts, accounting systems, or ERPs.',
                weakness_type: 'integration_missing', category: 'technology', severity: 'medium',
                risk_score: 45, affected_areas: ['cash_visibility', 'forecasting'],
                source: 'quality_check', detected_by: 'weakness_scanner',
                estimated_fix_effort: 'small', estimated_fix_days: 1,
              })
              newFound++
            }
            found++
          }

          // 3. Stale connections
          checksRun++
          const { data: stale } = await supabase.from('data_sources').select('source_name').eq('org_id', oId).eq('status', 'error')
          for (const src of (stale || [])) {
            const existing = await supabase.from('weaknesses').select('id').eq('org_id', oId).eq('weakness_type', 'single_point_failure').like('title', `%${src.source_name}%`).in('status', ['open', 'acknowledged']).limit(1)
            if (!existing.data?.length) {
              await supabase.from('weaknesses').insert({
                org_id: oId, title: `${src.source_name} connection in error state`,
                description: `The ${src.source_name} data source is currently in error state, creating a gap in cash visibility.`,
                weakness_type: 'single_point_failure', category: 'technology', severity: 'high',
                risk_score: 70, affected_areas: ['cash_visibility'],
                source: 'quality_check', detected_by: 'weakness_scanner',
                estimated_fix_effort: 'trivial', estimated_fix_days: 1,
              })
              newFound++
            }
            found++
          }

          // 4. Security weaknesses
          checksRun++
          const { data: secScore } = await supabase.from('security_score').select('overall_score').eq('org_id', oId).order('calculated_at', { ascending: false }).limit(1).single()
          if (secScore && secScore.overall_score < 60) {
            const existing = await supabase.from('weaknesses').select('id').eq('org_id', oId).eq('weakness_type', 'security_vulnerability').in('status', ['open', 'acknowledged']).limit(1)
            if (!existing.data?.length) {
              await supabase.from('weaknesses').insert({
                org_id: oId, title: `Security posture score at ${secScore.overall_score}/100`,
                description: `Security score is below 60. Review MFA enrollment, password policies, session settings, and IP restrictions.`,
                weakness_type: 'security_vulnerability', category: 'compliance', severity: secScore.overall_score < 40 ? 'critical' : 'high',
                risk_score: 100 - secScore.overall_score, affected_areas: ['security', 'compliance'],
                source: 'quality_check', detected_by: 'weakness_scanner',
                estimated_fix_effort: 'medium', estimated_fix_days: 7,
              })
              newFound++
            }
            found++
          }

          // Count resolved
          const { count: resolvedSinceLast } = await supabase.from('weaknesses').select('id', { count: 'exact', head: true }).eq('org_id', oId).in('status', ['resolved', 'mitigated']).gte('resolved_at', new Date(Date.now() - 7 * 86400000).toISOString())
          const healthScore = Math.max(0, Math.min(100, 80 - found * 8 + (resolvedSinceLast || 0) * 5))

          await supabase.from('weakness_scans').insert({
            org_id: oId, scan_type: 'comprehensive', completed_at: new Date().toISOString(),
            duration_ms: Date.now() - scanStart, checks_run: checksRun,
            weaknesses_found: found, new_weaknesses: newFound,
            resolved_since_last: resolvedSinceLast || 0, overall_health_score: healthScore, status: 'completed',
          })
          totalFound += newFound
        }
        return json({ weaknesses_found: totalFound })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
