import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'list_components': {
        const { data } = await supabase.from('ui_component_registry').select('*').eq('status', 'active').order('category, name')
        return json({ components: data || [] })
      }
      case 'get_page_state': {
        const { page_path, state_type } = body
        const { data } = await supabase.from('ui_page_states').select('*').eq('page_path', page_path).eq('state_type', state_type).eq('enabled', true).single()
        return json({ state: data })
      }
      case 'list_page_states': {
        const { page_path } = body
        let q = supabase.from('ui_page_states').select('*').eq('enabled', true)
        if (page_path) q = q.eq('page_path', page_path)
        const { data } = await q.order('page_path, state_type')
        return json({ states: data || [] })
      }
      case 'list_themes': {
        const { data } = await supabase.from('ui_themes').select('*').order('is_default', { ascending: false })
        return json({ themes: data || [] })
      }
      case 'dashboard': {
        const { data: components } = await supabase.from('ui_component_registry').select('*').eq('status', 'active')
        const { data: states } = await supabase.from('ui_page_states').select('*').eq('enabled', true)
        const { data: themes } = await supabase.from('ui_themes').select('*')
        const byCat: Record<string, number> = {}
        for (const c of (components || [])) byCat[c.category] = (byCat[c.category] || 0) + 1
        const statesByPage: Record<string, string[]> = {}
        for (const s of (states || [])) { if (!statesByPage[s.page_path]) statesByPage[s.page_path] = []; statesByPage[s.page_path].push(s.state_type) }
        return json({
          components: { total: components?.length || 0, by_category: byCat, list: components || [] },
          page_states: { total: states?.length || 0, by_page: statesByPage, list: states || [] },
          themes: themes || [],
        })
      }
      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
