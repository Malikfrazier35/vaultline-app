import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Auth (optional for some actions like DSR submission)
    let user: any = null, profile: any = null, orgId: string | null = null, isAdmin = false
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user: u } } = await anonClient.auth.getUser()
      user = u
      if (user) {
        const { data: p } = await supabase.from('profiles').select('id, org_id, role').eq('id', user.id).single()
        profile = p; orgId = p?.org_id; isAdmin = ['owner', 'admin'].includes(p?.role)
      }
    }

    switch (action) {
      // ── PRIVACY DASHBOARD ──
      case 'dashboard': {
        if (!isAdmin) return json({ error: 'Admin only' })

        const [dsrRes, consentRes, dprRes, retentionRes, dpiaRes] = await Promise.all([
          supabase.from('data_subject_requests').select('*').order('created_at', { ascending: false }).limit(50),
          supabase.from('consent_records').select('consent_type, granted').eq('org_id', orgId!),
          supabase.from('data_processing_records').select('*').eq('status', 'active').order('activity_name'),
          supabase.from('data_retention_policies').select('*').order('table_name'),
          supabase.from('privacy_impact_assessments').select('*').order('created_at', { ascending: false }).limit(10),
        ])

        const dsrs = dsrRes.data || []
        const openDSRs = dsrs.filter(d => !['completed', 'denied'].includes(d.status))
        const overdueDSRs = openDSRs.filter(d => new Date(d.due_date) < new Date())

        // Consent stats
        const consents = consentRes.data || []
        const consentStats: Record<string, { granted: number, total: number }> = {}
        consents.forEach(c => {
          if (!consentStats[c.consent_type]) consentStats[c.consent_type] = { granted: 0, total: 0 }
          consentStats[c.consent_type].total++
          if (c.granted) consentStats[c.consent_type].granted++
        })

        return json({
          dsrs: { all: dsrs.slice(0, 20), open: openDSRs.length, overdue: overdueDSRs.length, total: dsrs.length },
          consent: { stats: consentStats, total: consents.length },
          processing_records: dprRes.data || [],
          retention_policies: retentionRes.data || [],
          dpias: dpiaRes.data || [],
        })
      }

      // ── RECORD CONSENT ──
      case 'record_consent': {
        const { consent_type, granted, email, version, ip_address, user_agent } = body
        if (!consent_type) return json({ error: 'consent_type required' })

        await supabase.from('consent_records').insert({
          org_id: orgId, user_id: user?.id, email: email || user?.email,
          consent_type, granted: granted !== false, version: version || '1.0',
          ip_address, user_agent,
          ...(granted !== false ? { granted_at: new Date().toISOString() } : { revoked_at: new Date().toISOString() }),
        })
        return json({ success: true })
      }

      // ── REVOKE CONSENT ──
      case 'revoke_consent': {
        const { consent_type } = body
        // Mark latest consent record as revoked
        const { data: latest } = await supabase.from('consent_records').select('id').eq('org_id', orgId!).eq('consent_type', consent_type).eq('granted', true).order('created_at', { ascending: false }).limit(1).single()
        if (latest) {
          await supabase.from('consent_records').update({ granted: false, revoked_at: new Date().toISOString() }).eq('id', latest.id)
        }
        // Insert revocation record
        await supabase.from('consent_records').insert({
          org_id: orgId, user_id: user?.id, email: user?.email,
          consent_type, granted: false, revoked_at: new Date().toISOString(),
        })
        return json({ success: true })
      }

      // ── GET USER CONSENTS ──
      case 'my_consents': {
        if (!user) return json({ error: 'Unauthorized' })
        const { data } = await supabase.from('consent_records').select('consent_type, granted, version, granted_at, revoked_at, created_at')
          .eq('user_id', user.id).order('created_at', { ascending: false })
        // Deduplicate: latest per consent_type
        const latest: Record<string, any> = {}
        for (const c of (data || [])) { if (!latest[c.consent_type]) latest[c.consent_type] = c }
        return json({ consents: Object.values(latest) })
      }

      // ── SUBMIT DATA SUBJECT REQUEST (public — no auth required) ──
      case 'submit_dsr': {
        const { requester_email, requester_name, request_type, regulation, data_categories } = body
        if (!requester_email || !request_type) return json({ error: 'Email and request type required' })

        // Find org by email
        let dsrOrgId = orgId
        if (!dsrOrgId) {
          const { data: p } = await supabase.from('profiles').select('org_id').eq('email', requester_email).limit(1).single()
          dsrOrgId = p?.org_id || null
        }

        const dueDate = new Date()
        dueDate.setDate(dueDate.getDate() + (regulation === 'ccpa' ? 45 : 30))

        const { data: dsr, error } = await supabase.from('data_subject_requests').insert({
          org_id: dsrOrgId, requester_email, requester_name,
          request_type, regulation: regulation || 'gdpr',
          data_categories: data_categories || [],
          due_date: dueDate.toISOString().split('T')[0],
          audit_trail: [{ action: 'submitted', timestamp: new Date().toISOString(), detail: `DSR submitted by ${requester_email}` }],
        }).select().single()

        if (error) return json({ error: error.message })
        return json({ success: true, dsr_id: dsr.id, due_date: dueDate.toISOString().split('T')[0] })
      }

      // ── UPDATE DSR STATUS ──
      case 'update_dsr': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { dsr_id, status, notes, assigned_to, export_url, extension_reason, extended_to } = body

        const updates: any = { status, updated_at: new Date().toISOString() }
        if (notes) updates.notes = notes
        if (assigned_to) updates.assigned_to = assigned_to
        if (export_url) { updates.export_url = export_url; updates.export_expires_at = new Date(Date.now() + 7 * 86400000).toISOString() }
        if (status === 'verified') updates.verified_at = new Date().toISOString()
        if (status === 'completed') { updates.completed_at = new Date().toISOString(); if (['erasure'].includes(body.request_type)) updates.deletion_confirmed = true }
        if (status === 'extended' && extended_to) { updates.extended_to = extended_to; updates.extension_reason = extension_reason }

        // Append to audit trail
        const { data: existing } = await supabase.from('data_subject_requests').select('audit_trail').eq('id', dsr_id).single()
        const trail = existing?.audit_trail || []
        trail.push({ action: `status_changed_to_${status}`, timestamp: new Date().toISOString(), by: user?.email, detail: notes || '' })
        updates.audit_trail = trail

        await supabase.from('data_subject_requests').update(updates).eq('id', dsr_id)
        return json({ success: true })
      }

      // ── DATA PROCESSING REGISTER (Article 30) ──
      case 'list_processing': {
        const { data } = await supabase.from('data_processing_records').select('*').eq('status', 'active').order('activity_name')
        return json({ records: data || [] })
      }

      case 'add_processing': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { activity_name, purpose, legal_basis, data_categories, data_subjects, recipients, retention_period, retention_days, security_measures, third_country_transfers, transfer_safeguards, automated_decision_making, dpia_required } = body
        const { data, error } = await supabase.from('data_processing_records').insert({
          activity_name, purpose, legal_basis, data_categories, data_subjects, recipients,
          retention_period, retention_days, security_measures, third_country_transfers,
          transfer_safeguards, automated_decision_making, dpia_required,
        }).select().single()
        if (error) return json({ error: error.message })
        return json({ success: true, record: data })
      }

      // ── RETENTION ENFORCEMENT (cron) ──
      case 'enforce_retention': {
        const { data: policies } = await supabase.from('data_retention_policies').select('*').eq('enabled', true)
        const results = []
        for (const p of (policies || [])) {
          try {
            const cutoff = new Date(Date.now() - p.retention_days * 86400000).toISOString()
            let processed = 0
            if (p.action === 'delete') {
              const { count } = await supabase.from(p.table_name).delete({ count: 'exact' }).lt(p.filter_column, cutoff)
              processed = count || 0
            } else if (p.action === 'archive') {
              // Archive = delete old records after logging the purge event
              const { count } = await supabase.from(p.table_name).delete({ count: 'exact' }).lt(p.filter_column, cutoff)
              processed = count || 0
              if (processed > 0) {
                await supabase.from('audit_log').insert({
                  action: 'retention_archive',
                  details: { table: p.table_name, records_purged: processed, cutoff, retention_days: p.retention_days, policy_id: p.id },
                })
              }
            } else if (p.action === 'anonymize') {
              // Anonymize by nullifying PII columns — table-specific logic would go here
              processed = 0
            }
            await supabase.from('data_retention_policies').update({ last_executed: new Date().toISOString(), records_processed: (p.records_processed || 0) + processed }).eq('id', p.id)
            results.push({ table: p.table_name, action: p.action, processed })
          } catch (e) { results.push({ table: p.table_name, error: e.message }) }
        }
        return json({ enforced: results.length, results })
      }

      // ── DATA EXPORT (for access/portability DSR fulfillment) ──
      case 'export_user_data': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { target_email } = body
        if (!target_email) return json({ error: 'target_email required' })

        // Gather all data for this user across tables
        const { data: targetProfile } = await supabase.from('profiles').select('*, organizations(name)').eq('email', target_email).single()
        if (!targetProfile) return json({ error: 'User not found' })

        const targetOrgId = targetProfile.org_id
        const [txRes, acctRes, msgRes, auditRes, consentRes] = await Promise.all([
          supabase.from('transactions').select('date, description, amount, category').eq('org_id', targetOrgId).order('date', { ascending: false }).limit(1000),
          supabase.from('accounts').select('name, type, current_balance, currency').eq('org_id', targetOrgId),
          supabase.from('copilot_messages').select('role, content, created_at').order('created_at', { ascending: false }).limit(100),
          supabase.from('audit_log').select('action, resource_type, created_at').eq('user_id', targetProfile.id).order('created_at', { ascending: false }).limit(200),
          supabase.from('consent_records').select('consent_type, granted, created_at').eq('user_id', targetProfile.id),
        ])

        const exportData = {
          exported_at: new Date().toISOString(),
          user: { email: target_email, name: targetProfile.full_name, role: targetProfile.role, created_at: targetProfile.created_at },
          organization: targetProfile.organizations,
          accounts: acctRes.data || [],
          transactions: txRes.data || [],
          copilot_messages: msgRes.data || [],
          audit_history: auditRes.data || [],
          consent_records: consentRes.data || [],
        }

        return json({ success: true, data: exportData, record_count: Object.values(exportData).reduce((s, v) => s + (Array.isArray(v) ? v.length : 1), 0) })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
