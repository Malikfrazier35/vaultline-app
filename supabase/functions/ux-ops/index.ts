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
    const orgId = profile?.org_id
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'get_ux_prefs': {
        const { data } = await supabase.from('ux_preferences').select('*').eq('user_id', user.id).single()
        return json({ preferences: data || null })
      }
      case 'save_ux_prefs': {
        const allowed = ['reduced_motion','high_contrast','font_size','dyslexia_font','screen_reader_hints','color_mode','accent_color','chart_palette','number_abbreviation','default_landing_page','sidebar_width','show_breadcrumbs','show_page_descriptions','rows_per_page','sticky_headers','column_borders','sound_enabled','desktop_notifications','tooltips_enabled','show_feature_badges','walkthrough_completed']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(body)) { if (allowed.includes(k)) safe[k] = body[k] }
        const { data: existing } = await supabase.from('ux_preferences').select('id').eq('user_id', user.id).single()
        if (existing) await supabase.from('ux_preferences').update(safe).eq('id', existing.id)
        else await supabase.from('ux_preferences').insert({ user_id: user.id, ...safe })
        return json({ success: true })
      }

      case 'submit_feedback': {
        const { page_path, feedback_type, rating, title, description, device_type, viewport_width, browser } = body
        if (!description) return json({ error: 'Description required' })
        await supabase.from('ux_feedback').insert({
          org_id: orgId, user_id: user.id, page_path: page_path || '/',
          feedback_type: feedback_type || 'other', rating, title, description,
          device_type, viewport_width, browser,
        })
        return json({ success: true })
      }
      case 'list_feedback': {
        const isAdmin = ['owner','admin'].includes(profile?.role)
        const { data } = await supabase.from('ux_feedback').select('*')
          .eq(isAdmin ? 'org_id' : 'user_id', isAdmin ? orgId! : user.id)
          .order('created_at', { ascending: false }).limit(50)
        return json({ feedback: data || [] })
      }

      case 'get_walkthroughs': {
        const { data: walks } = await supabase.from('ux_walkthroughs').select('*').eq('enabled', true).order('display_order')
        const { data: prefs } = await supabase.from('ux_preferences').select('walkthrough_completed').eq('user_id', user.id).single()
        const completed = prefs?.walkthrough_completed || []
        return json({ walkthroughs: (walks || []).map(w => ({ ...w, completed: completed.includes(w.id) })) })
      }
      case 'complete_walkthrough': {
        const { walkthrough_id } = body
        const { data: prefs } = await supabase.from('ux_preferences').select('id, walkthrough_completed').eq('user_id', user.id).single()
        const list = new Set([...(prefs?.walkthrough_completed || []), walkthrough_id])
        if (prefs) await supabase.from('ux_preferences').update({ walkthrough_completed: [...list] }).eq('id', prefs.id)
        else await supabase.from('ux_preferences').insert({ user_id: user.id, walkthrough_completed: [...list] })
        return json({ success: true })
      }

      case 'get_announcements': {
        const now = new Date().toISOString()
        const { data } = await supabase.from('ux_announcements').select('*')
          .eq('published', true).lte('starts_at', now)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .order('starts_at', { ascending: false }).limit(10)
        return json({ announcements: data || [] })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
