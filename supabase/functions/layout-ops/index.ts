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
      // ── WIDGET REGISTRY ──
      case 'list_widgets': {
        const { data } = await supabase.from('widgets').select('*').eq('enabled', true).order('category, name')
        return json({ widgets: data || [] })
      }

      // ── GET LAYOUT ──
      case 'get_layout': {
        const { page } = body
        const { data: layout } = await supabase.from('dashboard_layouts').select('*').eq('user_id', user.id).eq('page', page || 'dashboard').single()
        if (layout) return json({ layout })
        // Return default layout from widget registry
        const { data: widgets } = await supabase.from('widgets').select('*').eq('enabled', true).order('category')
        const defaultLayout = (widgets || []).map((w, i) => ({
          widgetId: w.id, x: (i % 2) * 6, y: Math.floor(i / 2) * 4,
          w: w.default_width, h: w.default_height, visible: true, config: {},
        }))
        return json({ layout: { layout: defaultLayout, preset: 'default' }, isDefault: true })
      }

      // ── SAVE LAYOUT ──
      case 'save_layout': {
        const { page, layout, preset } = body
        await supabase.from('dashboard_layouts').upsert({
          org_id: orgId, user_id: user.id, page: page || 'dashboard',
          layout: layout || [], preset: preset || 'custom', updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id,user_id,page' })
        return json({ success: true })
      }

      // ── RESET LAYOUT ──
      case 'reset_layout': {
        const { page } = body
        await supabase.from('dashboard_layouts').delete().eq('user_id', user.id).eq('page', page || 'dashboard')
        return json({ success: true })
      }

      // ── SAVED VIEWS ──
      case 'list_views': {
        const { page } = body
        const { data } = await supabase.from('saved_views').select('*')
          .eq('org_id', orgId).eq('page', page)
          .or(`user_id.eq.${user.id},shared.eq.true`)
          .order('is_default', { ascending: false })
        return json({ views: data || [] })
      }

      case 'save_view': {
        const { page, name, filters, sort_by, sort_order, visible_columns, group_by, date_range, shared, is_default } = body
        const { data: view } = await supabase.from('saved_views').insert({
          org_id: orgId, user_id: user.id, page, name,
          filters, sort_by, sort_order, visible_columns, group_by, date_range,
          shared: shared || false, is_default: is_default || false,
        }).select().single()
        if (is_default) {
          await supabase.from('saved_views').update({ is_default: false })
            .eq('org_id', orgId).eq('page', page).eq('user_id', user.id).neq('id', view.id)
        }
        return json({ success: true, view })
      }

      case 'delete_view': {
        await supabase.from('saved_views').delete().eq('id', body.view_id).eq('user_id', user.id)
        return json({ success: true })
      }

      // ── KEYBOARD SHORTCUTS ──
      case 'get_shortcuts': {
        const { data } = await supabase.from('keyboard_shortcuts').select('*').eq('user_id', user.id).order('shortcut_key')
        return json({ shortcuts: data || [] })
      }

      case 'set_shortcut': {
        const { shortcut_key, shortcut_action } = body
        await supabase.from('keyboard_shortcuts').upsert(
          { user_id: user.id, shortcut_key, action: shortcut_action, enabled: true },
          { onConflict: 'user_id,shortcut_key' }
        )
        return json({ success: true })
      }

      case 'remove_shortcut': {
        await supabase.from('keyboard_shortcuts').delete().eq('user_id', user.id).eq('shortcut_key', body.shortcut_key)
        return json({ success: true })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
