import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sec-gpc' }
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Optional auth
    let user: any = null, isAdmin = false
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user: u } } = await anonClient.auth.getUser()
      user = u
      isAdmin = !!user && ADMIN_EMAILS.includes(user.email || '')
    }

    // Detect GPC signal
    const gpcDetected = req.headers.get('sec-gpc') === '1'

    switch (action) {
      // ═══ PUBLIC: LEGAL DOCUMENTS ═══

      case 'get_legal_doc': {
        const { slug, version } = body
        let q = supabase.from('legal_documents').select('*').eq('slug', slug).eq('status', 'published')
        if (version) q = q.eq('version', version)
        else q = q.order('effective_date', { ascending: false }).limit(1)
        const { data: doc } = await q.single()
        return json({ document: doc || null })
      }

      case 'list_legal_docs': {
        const { data } = await supabase.from('legal_documents').select('slug, title, version, effective_date, summary_of_changes, jurisdiction, regulation')
          .eq('status', 'published').order('slug, effective_date desc')
        // Deduplicate: latest per slug
        const latest = new Map<string, any>()
        for (const d of (data || [])) { if (!latest.has(d.slug)) latest.set(d.slug, d) }
        return json({ documents: [...latest.values()] })
      }

      case 'get_doc_history': {
        const { slug } = body
        const { data } = await supabase.from('legal_documents').select('version, effective_date, summary_of_changes, status')
          .eq('slug', slug).order('effective_date', { ascending: false })
        return json({ versions: data || [] })
      }

      // ═══ LEGAL ACCEPTANCE ═══

      case 'accept_document': {
        const { document_id, email, method } = body
        if (!document_id) return json({ error: 'document_id required' })
        await supabase.from('legal_acceptances').insert({
          document_id, user_id: user?.id, email: email || user?.email,
          ip_address: body.ip_address, user_agent: body.user_agent,
          method: method || 'click',
        })
        return json({ success: true })
      }

      case 'my_acceptances': {
        if (!user) return json({ error: 'Auth required' })
        const { data } = await supabase.from('legal_acceptances').select('*, legal_documents(slug, title, version)')
          .eq('user_id', user.id).is('withdrawn_at', null).order('accepted_at', { ascending: false })
        return json({ acceptances: data || [] })
      }

      // ═══ COOKIE PREFERENCES ═══

      case 'get_cookie_prefs': {
        const { visitor_id } = body
        const id = visitor_id || user?.id
        if (!id) return json({ preferences: null, gpc_detected: gpcDetected })
        const { data: prefs } = await supabase.from('cookie_preferences')
          .select('*').or(`visitor_id.eq.${id},user_id.eq.${id}`).order('updated_at', { ascending: false }).limit(1).single()
        return json({ preferences: prefs, gpc_detected: gpcDetected })
      }

      case 'save_cookie_prefs': {
        const { visitor_id, essential, functional, analytics, advertising, social_media, geo_country, geo_region } = body
        const vid = visitor_id || user?.id || `anon_${Date.now()}`

        // If GPC detected, auto-disable advertising
        const effectiveAds = gpcDetected ? false : (advertising || false)
        const effectiveSocial = gpcDetected ? false : (social_media || false)

        await supabase.from('cookie_preferences').upsert({
          visitor_id: vid, user_id: user?.id,
          essential: true, // always on
          functional: functional !== false,
          analytics: analytics || false,
          advertising: effectiveAds,
          social_media: effectiveSocial,
          gpc_detected: gpcDetected, dnt_detected: false,
          gpc_honored: gpcDetected,
          ip_address: body.ip_address, user_agent: body.user_agent,
          geo_country, geo_region,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'visitor_id' }).catch(() => {
          // Insert if upsert fails on unique
          supabase.from('cookie_preferences').insert({
            visitor_id: vid, user_id: user?.id,
            essential: true, functional: functional !== false,
            analytics: analytics || false, advertising: effectiveAds, social_media: effectiveSocial,
            gpc_detected: gpcDetected, gpc_honored: gpcDetected,
          })
        })
        return json({ success: true, gpc_honored: gpcDetected })
      }

      // ═══ DNSSPI: DO NOT SELL OR SHARE ═══

      case 'dnsspi_status': {
        const email = body.email || user?.email
        if (!email) return json({ opted_out: false })
        const { data: optout } = await supabase.from('dnsspi_optouts')
          .select('*').eq('email', email.toLowerCase()).is('revoked_at', null).order('opted_out_at', { ascending: false }).limit(1).single()
        return json({ opted_out: !!optout, details: optout })
      }

      case 'dnsspi_opt_out': {
        const { email, opt_out_sale, opt_out_sharing, opt_out_targeted_ads, opt_out_profiling, opt_out_matched_identifiers, method, jurisdiction } = body
        const targetEmail = (email || user?.email || '').toLowerCase()
        if (!targetEmail) return json({ error: 'Email required' })

        await supabase.from('dnsspi_optouts').insert({
          user_id: user?.id, email: targetEmail,
          opt_out_sale: opt_out_sale !== false,
          opt_out_sharing: opt_out_sharing !== false,
          opt_out_targeted_ads: opt_out_targeted_ads !== false,
          opt_out_profiling: opt_out_profiling || false,
          opt_out_matched_identifiers: opt_out_matched_identifiers !== false,
          method: method || (gpcDetected ? 'gpc_signal' : 'web_form'),
          gpc_signal: gpcDetected,
          jurisdiction: jurisdiction || body.geo_region,
          ip_address: body.ip_address, user_agent: body.user_agent,
        })

        // Also update cookie preferences if they exist
        if (user?.id) {
          await supabase.from('cookie_preferences').update({ advertising: false, social_media: false, updated_at: new Date().toISOString() }).eq('user_id', user.id)
        }

        // Record consent revocation
        if (user?.id) {
          const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
          if (profile) {
            await supabase.from('consent_records').insert([
              { org_id: profile.org_id, user_id: user.id, email: targetEmail, consent_type: 'third_party_sharing', granted: false, revoked_at: new Date().toISOString() },
              { org_id: profile.org_id, user_id: user.id, email: targetEmail, consent_type: 'cookie_advertising', granted: false, revoked_at: new Date().toISOString() },
              { org_id: profile.org_id, user_id: user.id, email: targetEmail, consent_type: 'cookie_marketing', granted: false, revoked_at: new Date().toISOString() },
            ])
          }
        }

        await supabase.from('audit_log').insert({ user_id: user?.id, action: 'dnsspi_opt_out', details: { email: targetEmail, method: method || 'web_form', gpc: gpcDetected } })

        return json({ success: true, message: 'Your opt-out has been recorded. This applies to sale, sharing, and targeted advertising.' })
      }

      case 'dnsspi_revoke': {
        if (!user) return json({ error: 'Auth required to revoke opt-out' })
        await supabase.from('dnsspi_optouts').update({ revoked_at: new Date().toISOString() }).eq('user_id', user.id).is('revoked_at', null)
        return json({ success: true })
      }

      // ═══ PRIVACY RIGHTS PORTAL (public, no auth required) ═══

      case 'submit_privacy_request': {
        const { requester_email, requester_name, requester_phone, requester_relationship, request_type, regulation, jurisdiction, data_categories, specific_data, response_method } = body
        if (!requester_email || !request_type) return json({ error: 'Email and request type required' })

        // Calculate due date based on regulation
        const dueDays = regulation === 'gdpr' ? 30 : regulation === 'ccpa' || regulation === 'cpra' ? 45 : 30
        const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + dueDays)

        // Generate verification token
        const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('')

        const { data: request, error } = await supabase.from('privacy_rights_requests').insert({
          requester_email: requester_email.toLowerCase(), requester_name, requester_phone,
          requester_relationship: requester_relationship || 'self',
          request_type, regulation: regulation || 'ccpa', jurisdiction,
          data_categories: data_categories || [], specific_data,
          response_method: response_method || 'email',
          due_date: dueDate.toISOString().split('T')[0],
          verification_token: token, status: 'verification_sent',
          audit_trail: [{ action: 'submitted', timestamp: new Date().toISOString(), detail: `Privacy rights request submitted by ${requester_email}` }],
        }).select().single()

        if (error) return json({ error: error.message })

        return json({
          success: true, request_id: request.id, due_date: dueDate.toISOString().split('T')[0],
          message: `Your ${request_type.replace(/_/g, ' ')} request has been submitted. You will receive a verification email within 24 hours. Response deadline: ${dueDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`,
        })
      }

      case 'check_request_status': {
        const { request_id, email } = body
        const { data: request } = await supabase.from('privacy_rights_requests')
          .select('id, request_type, regulation, status, due_date, fulfilled_at, denial_reason, appeal_status, created_at')
          .eq('id', request_id).eq('requester_email', email.toLowerCase()).single()
        return json({ request: request || null })
      }

      // ═══ SUBPROCESSORS (public) ═══

      case 'list_subprocessors': {
        const { data } = await supabase.from('subprocessors').select('name, purpose, data_categories, location, transfer_mechanism, security_certifications, added_date')
          .eq('status', 'active').order('name')
        return json({ subprocessors: data || [] })
      }

      // ═══ ADMIN: COMPLIANCE DASHBOARD ═══

      case 'compliance_dashboard': {
        if (!isAdmin) return json({ error: 'Admin only' })

        const { data: compliance } = await supabase.from('regulatory_compliance').select('*').order('regulation, requirement_id')
        const { data: rights } = await supabase.from('privacy_rights_requests').select('*').order('created_at', { ascending: false }).limit(50)
        const { data: optouts } = await supabase.from('dnsspi_optouts').select('*').is('revoked_at', null).order('opted_out_at', { ascending: false }).limit(50)
        const { data: docs } = await supabase.from('legal_documents').select('slug, title, version, status, effective_date').order('slug, effective_date desc')

        const allComp = compliance || []
        const compByReg: Record<string, any> = {}
        for (const c of allComp) {
          if (!compByReg[c.regulation]) compByReg[c.regulation] = { total: 0, compliant: 0, non_compliant: 0, in_progress: 0, not_started: 0 }
          compByReg[c.regulation].total++
          compByReg[c.regulation][c.status]++
        }

        const allRights = rights || []
        const openRights = allRights.filter(r => !['fulfilled', 'denied'].includes(r.status))
        const overdueRights = openRights.filter(r => new Date(r.due_date) < new Date())

        return json({
          compliance: { by_regulation: compByReg, all: allComp },
          rights: { total: allRights.length, open: openRights.length, overdue: overdueRights.length, recent: allRights.slice(0, 15) },
          optouts: { total: optouts?.length || 0, recent: (optouts || []).slice(0, 10) },
          documents: docs || [],
        })
      }

      case 'update_compliance': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { requirement_id: reqId, regulation, status, notes, evidence_url, owner } = body
        const updates: any = { status, updated_at: new Date().toISOString(), last_reviewed: new Date().toISOString() }
        if (notes) updates.notes = notes
        if (evidence_url) updates.evidence_url = evidence_url
        if (owner) updates.owner = owner
        await supabase.from('regulatory_compliance').update(updates).eq('regulation', regulation).eq('requirement_id', reqId)
        return json({ success: true })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
