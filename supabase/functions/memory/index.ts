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

    const { data: profile } = await supabase.from('profiles').select('id, org_id').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })
    const orgId = profile.org_id
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      // ═══ DRAFTS ═══

      // ── SAVE DRAFT (auto or manual) ──
      case 'save_draft': {
        const { draft_type, draft_key, title, data: draftData, auto_saved } = body
        if (!draft_type || !draft_key) return json({ error: 'draft_type and draft_key required' })

        const { data: existing } = await supabase.from('user_drafts')
          .select('id, version').eq('org_id', orgId).eq('user_id', user.id)
          .eq('draft_type', draft_type).eq('draft_key', draft_key).single()

        if (existing) {
          await supabase.from('user_drafts').update({
            data: draftData || {}, title, version: (existing.version || 1) + 1,
            auto_saved: auto_saved !== false, last_saved_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
          }).eq('id', existing.id)
          return json({ success: true, draft_id: existing.id, version: (existing.version || 1) + 1, updated: true })
        } else {
          const { data: draft } = await supabase.from('user_drafts').insert({
            org_id: orgId, user_id: user.id, draft_type, draft_key,
            title, data: draftData || {}, auto_saved: auto_saved !== false,
          }).select().single()
          return json({ success: true, draft_id: draft?.id, version: 1, created: true })
        }
      }

      // ── GET DRAFT ──
      case 'get_draft': {
        const { draft_type, draft_key } = body
        const { data: draft } = await supabase.from('user_drafts')
          .select('*').eq('user_id', user.id)
          .eq('draft_type', draft_type).eq('draft_key', draft_key).single()
        return json({ draft: draft || null })
      }

      // ── LIST DRAFTS ──
      case 'list_drafts': {
        const { draft_type } = body
        let q = supabase.from('user_drafts').select('id, draft_type, draft_key, title, version, auto_saved, last_saved_at')
          .eq('user_id', user.id).order('last_saved_at', { ascending: false })
        if (draft_type) q = q.eq('draft_type', draft_type)
        const { data } = await q.limit(50)
        return json({ drafts: data || [] })
      }

      // ── DELETE DRAFT ──
      case 'delete_draft': {
        const { draft_id, draft_type, draft_key } = body
        if (draft_id) {
          await supabase.from('user_drafts').delete().eq('id', draft_id).eq('user_id', user.id)
        } else if (draft_type && draft_key) {
          await supabase.from('user_drafts').delete().eq('user_id', user.id).eq('draft_type', draft_type).eq('draft_key', draft_key)
        }
        return json({ success: true })
      }

      // ── RESTORE DRAFT ──
      case 'restore_draft': {
        const { draft_id } = body
        const { data: draft } = await supabase.from('user_drafts').select('*').eq('id', draft_id).eq('user_id', user.id).single()
        if (!draft) return json({ error: 'Draft not found' })
        await supabase.from('user_drafts').update({ restored_at: new Date().toISOString() }).eq('id', draft_id)
        return json({ success: true, draft })
      }

      // ═══ PREFERENCES ═══

      // ── GET PREFERENCES ──
      case 'get_prefs': {
        const { data: prefs } = await supabase.from('user_preferences').select('*').eq('user_id', user.id).single()
        return json({ preferences: prefs || null })
      }

      // ── SAVE PREFERENCES ──
      case 'save_prefs': {
        const allowed = ['preferences', 'default_dashboard_period', 'default_forecast_model', 'default_chart_type', 'sidebar_collapsed', 'theme', 'table_density', 'date_format', 'number_format', 'timezone', 'copilot_suggestions_shown', 'onboarding_completed', 'command_palette_recent', 'pinned_pages']
        const updates: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(body)) { if (allowed.includes(k)) updates[k] = body[k] }

        const { data: existing } = await supabase.from('user_preferences').select('id').eq('user_id', user.id).single()
        if (existing) {
          await supabase.from('user_preferences').update(updates).eq('id', existing.id)
        } else {
          await supabase.from('user_preferences').insert({ user_id: user.id, ...updates })
        }
        return json({ success: true })
      }

      // ── MERGE PREFERENCES (partial update to jsonb) ──
      case 'merge_prefs': {
        const { key, value } = body // e.g. key='forecast_page', value={ model: 'ema', period: 'QTD' }
        const { data: prefs } = await supabase.from('user_preferences').select('id, preferences').eq('user_id', user.id).single()
        const merged = { ...(prefs?.preferences || {}), [key]: value }
        if (prefs) {
          await supabase.from('user_preferences').update({ preferences: merged, updated_at: new Date().toISOString() }).eq('id', prefs.id)
        } else {
          await supabase.from('user_preferences').insert({ user_id: user.id, preferences: merged })
        }
        return json({ success: true })
      }

      // ═══ SESSION SNAPSHOTS ═══

      // ── SAVE SNAPSHOT ──
      case 'save_snapshot': {
        const { session_id, page_path, page_state, scroll_position, active_tab, active_modal, form_data } = body
        // Upsert: one snapshot per session+page
        await supabase.from('session_snapshots').upsert({
          org_id: orgId, user_id: user.id, session_id, page_path,
          page_state: page_state || {}, scroll_position, active_tab, active_modal,
          form_data: form_data || {}, snapshot_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 3600000).toISOString(),
        }, { onConflict: 'user_id,session_id,page_path' }).catch(() => {
          // Fallback: insert without conflict resolution
          supabase.from('session_snapshots').insert({
            org_id: orgId, user_id: user.id, session_id, page_path,
            page_state: page_state || {}, scroll_position, active_tab, active_modal,
            form_data: form_data || {},
          })
        })
        return json({ success: true })
      }

      // ── GET SNAPSHOT (for crash recovery) ──
      case 'get_snapshot': {
        const { page_path } = body
        const { data: snap } = await supabase.from('session_snapshots')
          .select('*').eq('user_id', user.id).eq('page_path', page_path)
          .gt('expires_at', new Date().toISOString())
          .order('snapshot_at', { ascending: false }).limit(1).single()
        return json({ snapshot: snap || null })
      }

      // ═══ UNDO / REDO ═══

      // ── PUSH UNDO ENTRY ──
      case 'push_undo': {
        const { session_id, operation_type, entity_type, entity_id, previous_state, new_state } = body
        await supabase.from('undo_history').insert({
          org_id: orgId, user_id: user.id, session_id,
          operation_type, entity_type, entity_id: entity_id || null,
          previous_state: previous_state || {}, new_state: new_state || {},
        })
        return json({ success: true })
      }

      // ── UNDO (pop last operation) ──
      case 'undo': {
        const { session_id } = body
        const { data: entry } = await supabase.from('undo_history')
          .select('*').eq('user_id', user.id).eq('session_id', session_id).eq('undone', false)
          .order('created_at', { ascending: false }).limit(1).single()
        if (!entry) return json({ error: 'Nothing to undo' })

        await supabase.from('undo_history').update({ undone: true, undone_at: new Date().toISOString() }).eq('id', entry.id)
        return json({ success: true, entry, restore_state: entry.previous_state })
      }

      // ── REDO ──
      case 'redo': {
        const { session_id } = body
        const { data: entry } = await supabase.from('undo_history')
          .select('*').eq('user_id', user.id).eq('session_id', session_id).eq('undone', true)
          .order('undone_at', { ascending: false }).limit(1).single()
        if (!entry) return json({ error: 'Nothing to redo' })

        await supabase.from('undo_history').update({ undone: false, undone_at: null }).eq('id', entry.id)
        return json({ success: true, entry, restore_state: entry.new_state })
      }

      // ═══ CLEANUP (cron) ═══

      // ── PURGE EXPIRED ──
      case 'cleanup': {
        const now = new Date().toISOString()
        const { count: snaps } = await supabase.from('session_snapshots').delete({ count: 'exact' }).lt('expires_at', now)
        const { count: drafts } = await supabase.from('user_drafts').delete({ count: 'exact' }).lt('expires_at', now)
        const { count: undos } = await supabase.from('undo_history').delete({ count: 'exact' }).lt('expires_at', now)
        return json({ purged: { snapshots: snaps || 0, drafts: drafts || 0, undo_entries: undos || 0 } })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
