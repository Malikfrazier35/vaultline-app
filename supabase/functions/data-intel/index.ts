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
      // ═══ DASHBOARD ═══
      case 'dashboard': {
        const { data: sources } = await supabase.from('data_sources').select('*').eq('org_id', orgId)
        const { data: issues } = await supabase.from('data_quality_issues').select('severity, status').eq('org_id', orgId)
        const { data: insights } = await supabase.from('data_insights').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20)
        const { data: reports } = await supabase.from('intelligence_reports').select('id, report_type, title, generated_at').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(5)

        const allSources = sources || []
        const healthySources = allSources.filter(s => s.status === 'active')
        const avgQuality = allSources.length ? Math.round(allSources.reduce((s, d) => s + (d.quality_score || 0), 0) / allSources.length) : 0

        const allIssues = issues || []
        const openIssues = allIssues.filter(i => i.status === 'open')
        const criticalIssues = openIssues.filter(i => i.severity === 'critical')
        const issueBySeverity: Record<string, number> = {}
        for (const i of openIssues) issueBySeverity[i.severity] = (issueBySeverity[i.severity] || 0) + 1

        const newInsights = (insights || []).filter(i => i.status === 'new')
        const insightsByType: Record<string, number> = {}
        for (const i of (insights || [])) insightsByType[i.insight_type] = (insightsByType[i.insight_type] || 0) + 1

        return json({
          sources: { total: allSources.length, healthy: healthySources.length, avg_quality: avgQuality, list: allSources },
          quality: { open_issues: openIssues.length, critical: criticalIssues.length, by_severity: issueBySeverity },
          insights: { total: insights?.length || 0, new: newInsights.length, by_type: insightsByType, list: insights || [] },
          reports: reports || [],
        })
      }

      // ═══ DATA SOURCES ═══
      case 'list_sources': {
        const { data } = await supabase.from('data_sources').select('*').eq('org_id', orgId).order('source_name')
        return json({ sources: data || [] })
      }

      case 'update_source': {
        const { source_id, status, quality_score, completeness_pct, accuracy_score, last_sync_status, records_synced } = body
        const updates: any = { updated_at: new Date().toISOString() }
        if (status) updates.status = status
        if (quality_score != null) updates.quality_score = quality_score
        if (completeness_pct != null) updates.completeness_pct = completeness_pct
        if (accuracy_score != null) updates.accuracy_score = accuracy_score
        if (last_sync_status) { updates.last_sync_status = last_sync_status; updates.last_sync_at = new Date().toISOString() }
        if (records_synced != null) updates.records_synced = records_synced
        await supabase.from('data_sources').update(updates).eq('id', source_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ═══ DATA QUALITY ═══
      case 'list_issues': {
        const { status: issueStatus, severity } = body
        let q = supabase.from('data_quality_issues').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        if (issueStatus) q = q.eq('status', issueStatus)
        if (severity) q = q.eq('severity', severity)
        const { data } = await q.limit(100)
        return json({ issues: data || [] })
      }

      case 'resolve_issue': {
        const { issue_id, resolution_notes } = body
        await supabase.from('data_quality_issues').update({
          status: 'resolved', resolved_by: user.id, resolved_at: new Date().toISOString(), resolution_notes,
        }).eq('id', issue_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'ignore_issue': {
        await supabase.from('data_quality_issues').update({ status: 'ignored' }).eq('id', body.issue_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ═══ QUALITY RULES ═══
      case 'list_rules': {
        const { data } = await supabase.from('data_quality_rules').select('*').eq('org_id', orgId).order('target_table, rule_name')
        return json({ rules: data || [] })
      }

      case 'create_rule': {
        const { rule_name, description, rule_type, target_table, target_field, condition, severity: sev, auto_fix, fix_action } = body
        const { data } = await supabase.from('data_quality_rules').insert({
          org_id: orgId, rule_name, description, rule_type, target_table, target_field,
          condition: condition || {}, severity: sev || 'warning', auto_fix: auto_fix || false, fix_action,
        }).select().single()
        return json({ success: true, rule: data })
      }

      // ═══ RUN QUALITY CHECKS (cron) ═══
      case 'run_checks': {
        const { data: rules } = await supabase.from('data_quality_rules').select('*').eq('enabled', true)
        let totalViolations = 0
        for (const rule of (rules || [])) {
          const ruleOrgId = rule.org_id
          // Basic completeness check
          if (rule.rule_type === 'completeness' && rule.target_field) {
            const { count } = await supabase.from(rule.target_table).select('id', { count: 'exact', head: true })
              .eq('org_id', ruleOrgId).is(rule.target_field, null)
            if ((count || 0) > 0) {
              await supabase.from('data_quality_issues').insert({
                org_id: ruleOrgId, rule_id: rule.id, issue_type: 'missing_value', severity: rule.severity,
                table_name: rule.target_table, field_name: rule.target_field,
                description: `${count} records have null ${rule.target_field} in ${rule.target_table}`,
                affected_records: count || 0,
              })
              totalViolations += count || 0
            }
            await supabase.from('data_quality_rules').update({ last_run_at: new Date().toISOString(), last_result: (count || 0) > 0 ? 'fail' : 'pass', violations_count: count || 0 }).eq('id', rule.id)
          }
          // Timeliness: check if data is stale
          if (rule.rule_type === 'timeliness') {
            const { data: sources } = await supabase.from('data_sources').select('id, source_name, last_sync_at, freshness_hours').eq('org_id', ruleOrgId)
            for (const src of (sources || [])) {
              if (src.last_sync_at) {
                const hoursStale = (Date.now() - new Date(src.last_sync_at).getTime()) / 3600000
                const threshold = (rule.condition as any)?.max_hours || 24
                if (hoursStale > threshold) {
                  await supabase.from('data_quality_issues').insert({
                    org_id: ruleOrgId, rule_id: rule.id, source_id: src.id, issue_type: 'stale_data', severity: rule.severity,
                    table_name: 'data_sources', description: `${src.source_name} data is ${Math.round(hoursStale)}h stale (threshold: ${threshold}h)`,
                  })
                  totalViolations++
                }
              }
            }
            await supabase.from('data_quality_rules').update({ last_run_at: new Date().toISOString() }).eq('id', rule.id)
          }
        }
        return json({ rules_checked: rules?.length || 0, violations_found: totalViolations })
      }

      // ═══ DATA INSIGHTS ═══
      case 'list_insights': {
        const { insight_type, status: insightStatus } = body
        let q = supabase.from('data_insights').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        if (insight_type) q = q.eq('insight_type', insight_type)
        if (insightStatus) q = q.eq('status', insightStatus)
        const { data } = await q.limit(50)
        return json({ insights: data || [] })
      }

      case 'update_insight': {
        const { insight_id, status: newStatus, helpful, feedback_text } = body
        const updates: any = {}
        if (newStatus) {
          updates.status = newStatus
          if (newStatus === 'viewed') updates.viewed_at = new Date().toISOString()
          if (newStatus === 'acted_on') updates.acted_on_at = new Date().toISOString()
          if (newStatus === 'dismissed') updates.dismissed_at = new Date().toISOString()
        }
        if (helpful != null) updates.helpful = helpful
        if (feedback_text) updates.feedback_text = feedback_text
        await supabase.from('data_insights').update(updates).eq('id', insight_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ═══ GENERATE INSIGHTS (cron) ═══
      case 'generate_insights': {
        let generated = 0
        // For each org, scan for patterns
        const { data: orgs } = await supabase.from('organizations').select('id')
        for (const org of (orgs || [])) {
          const oId = org.id
          // Check source health
          const { data: degraded } = await supabase.from('data_sources').select('id, source_name, status, last_sync_at').eq('org_id', oId).neq('status', 'active')
          for (const src of (degraded || [])) {
            const existing = await supabase.from('data_insights').select('id').eq('org_id', oId).eq('insight_type', 'risk_signal').like('title', `%${src.source_name}%`).eq('status', 'new').single()
            if (!existing.data) {
              await supabase.from('data_insights').insert({
                org_id: oId, insight_type: 'risk_signal', severity: 'warning',
                title: `${src.source_name} connection is ${src.status}`,
                description: `Your ${src.source_name} data source has status "${src.status}". This may cause gaps in cash visibility and forecasting accuracy.`,
                recommended_action: 'Check the connection in Integrations and re-authenticate if needed.',
                action_url: '/integrations', confidence_score: 95,
                expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
              })
              generated++
            }
          }

          // Check data quality score trends
          const { data: sources } = await supabase.from('data_sources').select('quality_score, source_name').eq('org_id', oId)
          const lowQuality = (sources || []).filter(s => s.quality_score < 50)
          for (const src of lowQuality) {
            const existing = await supabase.from('data_insights').select('id').eq('org_id', oId).eq('insight_type', 'anomaly').like('title', `%${src.source_name}%quality%`).eq('status', 'new').single()
            if (!existing.data) {
              await supabase.from('data_insights').insert({
                org_id: oId, insight_type: 'anomaly', severity: 'alert',
                title: `${src.source_name} data quality below 50%`,
                description: `Quality score is ${src.quality_score}%. Missing or inconsistent data may affect forecast accuracy and reporting.`,
                recommended_action: 'Review field mappings and re-sync to improve data completeness.',
                action_url: '/data-import', confidence_score: 90,
              })
              generated++
            }
          }

          // Open quality issues summary
          const { count: openIssues } = await supabase.from('data_quality_issues').select('id', { count: 'exact', head: true }).eq('org_id', oId).eq('status', 'open')
          if ((openIssues || 0) > 10) {
            const existing = await supabase.from('data_insights').select('id').eq('org_id', oId).eq('insight_type', 'risk_signal').like('title', '%quality issues%').eq('status', 'new').single()
            if (!existing.data) {
              await supabase.from('data_insights').insert({
                org_id: oId, insight_type: 'risk_signal', severity: 'warning',
                title: `${openIssues} open data quality issues`,
                description: `You have ${openIssues} unresolved data quality issues. Addressing critical issues first will improve overall data reliability.`,
                recommended_action: 'Review and resolve critical issues in the Data Intelligence dashboard.',
                action_url: '/data-intelligence', confidence_score: 85,
              })
              generated++
            }
          }
        }
        return json({ insights_generated: generated })
      }

      // ═══ DATA LINEAGE ═══
      case 'get_lineage': {
        const { dest_table, dest_field, limit: lim } = body
        let q = supabase.from('data_lineage').select('*').eq('org_id', orgId).order('processed_at', { ascending: false })
        if (dest_table) q = q.eq('dest_table', dest_table)
        if (dest_field) q = q.eq('dest_field', dest_field)
        const { data } = await q.limit(lim || 50)
        return json({ lineage: data || [] })
      }

      // ═══ INTELLIGENCE REPORTS ═══
      case 'list_reports': {
        const { data } = await supabase.from('intelligence_reports').select('*').eq('org_id', orgId).order('generated_at', { ascending: false }).limit(20)
        return json({ reports: data || [] })
      }

      case 'get_report': {
        const { data } = await supabase.from('intelligence_reports').select('*').eq('id', body.report_id).eq('org_id', orgId).single()
        return json({ report: data })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
