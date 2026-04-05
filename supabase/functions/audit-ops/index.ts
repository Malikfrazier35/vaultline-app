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
        const { data: programs } = await supabase.from('audit_programs').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        const { data: findings } = await supabase.from('audit_findings').select('*').eq('org_id', orgId).order('reported_at', { ascending: false }).limit(50)
        const { data: checklists } = await supabase.from('audit_checklists').select('*').eq('org_id', orgId).order('created_at', { ascending: false })
        const { data: templates } = await supabase.from('audit_checklists').select('id, name, checklist_type, total_items').is('org_id', null)
        const { data: schedules } = await supabase.from('audit_schedules').select('*').eq('org_id', orgId).eq('enabled', true).order('next_date')

        const allFindings = findings || []
        const openFindings = allFindings.filter(f => !['closed', 'accepted_risk'].includes(f.status))
        const overdueFindings = allFindings.filter(f => f.overdue)
        const bySeverity: Record<string, number> = {}
        const byStatus: Record<string, number> = {}
        for (const f of openFindings) { bySeverity[f.severity] = (bySeverity[f.severity] || 0) + 1; byStatus[f.status] = (byStatus[f.status] || 0) + 1 }
        const avgDaysOpen = openFindings.length ? Math.round(openFindings.reduce((s, f) => s + (f.days_open || 0), 0) / openFindings.length) : 0

        const allChecklists = checklists || []
        const avgPassRate = allChecklists.filter(c => c.status === 'completed').length ? Math.round(allChecklists.filter(c => c.status === 'completed').reduce((s, c) => s + (c.pass_rate || 0), 0) / allChecklists.filter(c => c.status === 'completed').length) : 0

        return json({
          summary: { programs: (programs || []).length, active_programs: (programs || []).filter(p => !['completed', 'archived'].includes(p.status)).length, total_findings: allFindings.length, open_findings: openFindings.length, overdue_findings: overdueFindings.length, critical_findings: openFindings.filter(f => f.severity === 'critical').length, avg_days_open: avgDaysOpen, checklists: allChecklists.length, avg_pass_rate: avgPassRate },
          findings: { by_severity: bySeverity, by_status: byStatus, list: allFindings },
          programs: programs || [], checklists: allChecklists, templates: templates || [], schedules: schedules || [],
        })
      }

      // ── PROGRAMS ──
      case 'create_program': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { name, description, program_type, scope_areas, regulatory_framework, frequency, period_start, period_end, lead_auditor, budget_hours } = body
        const { data } = await supabase.from('audit_programs').insert({
          org_id: orgId, name, description, program_type, scope_areas, regulatory_framework,
          frequency: frequency || 'annual', period_start, period_end,
          lead_auditor: lead_auditor || user.id, budget_hours, created_by: user.id,
        }).select().single()
        return json({ success: true, program: data })
      }

      case 'update_program': {
        const { program_id, status, overall_score, risk_rating, actual_hours } = body
        const updates: any = { updated_at: new Date().toISOString() }
        if (status) updates.status = status
        if (overall_score != null) updates.overall_score = overall_score
        if (risk_rating) updates.risk_rating = risk_rating
        if (actual_hours != null) updates.actual_hours = actual_hours
        // Count findings
        const { count: fc } = await supabase.from('audit_findings').select('id', { count: 'exact', head: true }).eq('program_id', program_id)
        const { count: ofc } = await supabase.from('audit_findings').select('id', { count: 'exact', head: true }).eq('program_id', program_id).not('status', 'in', '("closed","accepted_risk")')
        updates.findings_count = fc || 0; updates.open_findings = ofc || 0
        await supabase.from('audit_programs').update(updates).eq('id', program_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ── CHECKLISTS ──
      case 'create_checklist': {
        const { name, description, checklist_type, items, program_id, assigned_to } = body
        const { data } = await supabase.from('audit_checklists').insert({
          org_id: orgId, program_id, name, description, checklist_type,
          items: items || [], total_items: (items || []).length, assigned_to,
        }).select().single()
        return json({ success: true, checklist: data })
      }

      case 'clone_template': {
        const { template_id, program_id, assigned_to } = body
        const { data: tmpl } = await supabase.from('audit_checklists').select('*').eq('id', template_id).single()
        if (!tmpl) return json({ error: 'Template not found' })
        const { data } = await supabase.from('audit_checklists').insert({
          org_id: orgId, program_id, name: tmpl.name, description: tmpl.description,
          checklist_type: tmpl.checklist_type, items: tmpl.items, total_items: tmpl.total_items,
          assigned_to,
        }).select().single()
        return json({ success: true, checklist: data })
      }

      // ── RESPOND TO CHECKLIST ITEM ──
      case 'respond': {
        const { checklist_id, item_id, response, score, notes, evidence_url, evidence_type } = body
        await supabase.from('audit_checklist_responses').upsert({
          checklist_id, item_id, response, score, notes, evidence_url, evidence_type,
          respondent_id: user.id, responded_at: new Date().toISOString(),
          requires_follow_up: response === 'fail',
        }, { onConflict: 'checklist_id,item_id' })

        // Update checklist progress
        const { data: responses } = await supabase.from('audit_checklist_responses').select('response').eq('checklist_id', checklist_id)
        const { data: checklist } = await supabase.from('audit_checklists').select('total_items').eq('id', checklist_id).single()
        const total = checklist?.total_items || 1
        const completed = (responses || []).filter(r => r.response !== 'pending').length
        const passed = (responses || []).filter(r => r.response === 'pass').length
        const failed = (responses || []).filter(r => r.response === 'fail').length
        const na = (responses || []).filter(r => r.response === 'na').length
        const effective = total - na
        await supabase.from('audit_checklists').update({
          completed_items: completed, passed_items: passed, failed_items: failed, na_items: na,
          completion_pct: Math.round((completed / total) * 100),
          pass_rate: effective > 0 ? Math.round((passed / effective) * 100) : 0,
          status: completed >= total ? 'completed' : 'in_progress',
          ...(completed >= total ? { completed_at: new Date().toISOString() } : {}),
          ...(!checklist?.started_at ? { started_at: new Date().toISOString() } : {}),
          updated_at: new Date().toISOString(),
        }).eq('id', checklist_id)

        // Auto-create finding for failures
        if (response === 'fail') {
          const { data: cl } = await supabase.from('audit_checklists').select('program_id, items').eq('id', checklist_id).single()
          const item = (cl?.items || []).find((i: any) => i.id === item_id)
          const findingNum = `F-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
          await supabase.from('audit_findings').insert({
            org_id: orgId, program_id: cl?.program_id, checklist_id,
            finding_number: findingNum, title: `Failed: ${item?.question?.slice(0, 80) || item_id}`,
            description: notes || `Checklist item "${item?.question || item_id}" failed during audit.`,
            finding_type: 'control_deficiency', severity: (item?.risk_weight || 5) >= 9 ? 'critical' : (item?.risk_weight || 5) >= 7 ? 'high' : 'medium',
            category: item?.category || 'operational', reported_by: user.id,
          })
        }
        return json({ success: true, completion_pct: Math.round((completed / total) * 100) })
      }

      // ── FINDINGS ──
      case 'create_finding': {
        const { program_id, title, description, finding_type, severity, category, root_cause, recommendation, remediation_owner, remediation_due_date } = body
        const findingNum = `F-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`
        const { data } = await supabase.from('audit_findings').insert({
          org_id: orgId, program_id, finding_number: findingNum, title, description,
          finding_type: finding_type || 'observation', severity: severity || 'medium',
          category, root_cause, recommendation, remediation_owner, remediation_due_date,
          reported_by: user.id,
        }).select().single()
        return json({ success: true, finding: data })
      }

      case 'update_finding': {
        const { finding_id, status, management_response, remediation_plan, remediation_owner, remediation_due_date } = body
        const updates: any = { updated_at: new Date().toISOString() }
        if (status) { updates.status = status; if (status === 'closed') { updates.closed_by = user.id; updates.closed_at = new Date().toISOString() } }
        if (management_response) updates.management_response = management_response
        if (remediation_plan) updates.remediation_plan = remediation_plan
        if (remediation_owner) updates.remediation_owner = remediation_owner
        if (remediation_due_date) updates.remediation_due_date = remediation_due_date
        await supabase.from('audit_findings').update(updates).eq('id', finding_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ── AUTOMATED HEALTH CHECK (cron) ──
      case 'health_check': {
        const { data: orgs } = await supabase.from('organizations').select('id')
        for (const org of (orgs || [])) {
          const oId = org.id
          // Check overdue findings
          const { data: overdue } = await supabase.from('audit_findings').select('id, title, remediation_owner').eq('org_id', oId).eq('overdue', true)
          for (const f of (overdue || [])) {
            await supabase.from('notifications').insert({
              org_id: oId, user_id: f.remediation_owner, type: 'system', severity: 'warning',
              title: `Audit finding overdue: ${f.title.slice(0, 60)}`,
              body: 'This finding has passed its remediation due date. Please update status or request an extension.',
              action_url: '/audit-center', channels_sent: ['in_app'],
            }).catch(() => {})
          }
          // Check upcoming audit schedules
          const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
          const { data: upcoming } = await supabase.from('audit_schedules').select('*').eq('org_id', oId).eq('enabled', true).lte('next_date', nextWeek)
          for (const s of (upcoming || [])) {
            await supabase.from('notifications').insert({
              org_id: oId, user_id: s.assigned_to, type: 'system', severity: 'info',
              title: `Upcoming audit: ${s.title}`,
              body: `Scheduled for ${s.next_date}. Prepare by reviewing the associated checklist.`,
              action_url: '/audit-center', channels_sent: ['in_app'],
            }).catch(() => {})
          }
        }
        return json({ success: true })
      }

      // ── GET CHECKLIST WITH RESPONSES ──
      case 'get_checklist': {
        const { checklist_id } = body
        const { data: checklist } = await supabase.from('audit_checklists').select('*').eq('id', checklist_id).single()
        const { data: responses } = await supabase.from('audit_checklist_responses').select('*').eq('checklist_id', checklist_id)
        const responseMap: Record<string, any> = {}
        for (const r of (responses || [])) responseMap[r.item_id] = r
        return json({ checklist, responses: responseMap })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
