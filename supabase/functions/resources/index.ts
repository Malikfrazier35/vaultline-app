import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Optional auth
    let user: any = null, orgId: string | null = null
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user: u } } = await anonClient.auth.getUser()
      user = u
      if (user) { const { data: p } = await supabase.from('profiles').select('org_id').eq('id', user.id).single(); orgId = p?.org_id }
    }

    switch (action) {
      // ═══ RESOURCE LIBRARY ═══
      case 'list_resources': {
        const { resource_type, category, featured, search } = body
        let q = supabase.from('resource_library').select('id, slug, title, excerpt, resource_type, category, thumbnail_url, video_url, featured, pinned, views, published_at')
          .eq('status', 'published').order('pinned', { ascending: false })
        if (resource_type) q = q.eq('resource_type', resource_type)
        if (category) q = q.eq('category', category)
        if (featured) q = q.eq('featured', true)
        if (search) q = q.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`)
        const { data } = await q.order('views', { ascending: false }).limit(50)
        return json({ resources: data || [] })
      }

      case 'get_resource': {
        const { slug } = body
        const { data } = await supabase.from('resource_library').select('*').eq('slug', slug).eq('status', 'published').single()
        if (data) await supabase.from('resource_library').update({ views: (data.views || 0) + 1 }).eq('id', data.id)
        return json({ resource: data })
      }

      case 'rate_resource': {
        const { slug, helpful } = body
        const { data: res } = await supabase.from('resource_library').select('id, helpful_yes, helpful_no').eq('slug', slug).single()
        if (res) {
          await supabase.from('resource_library').update(helpful ? { helpful_yes: (res.helpful_yes || 0) + 1 } : { helpful_no: (res.helpful_no || 0) + 1 }).eq('id', res.id)
        }
        return json({ success: true })
      }

      // ═══ REPORT TEMPLATES ═══
      case 'list_templates': {
        const { template_type } = body
        let q = supabase.from('report_templates').select('*').eq('status', 'active').order('is_system', { ascending: false })
        if (template_type) q = q.eq('template_type', template_type)
        const { data } = await q.order('usage_count', { ascending: false }).limit(30)
        return json({ templates: data || [] })
      }

      case 'use_template': {
        const { template_id } = body
        const { data } = await supabase.from('report_templates').select('*').eq('id', template_id).single()
        if (data) await supabase.from('report_templates').update({ usage_count: (data.usage_count || 0) + 1, last_used_at: new Date().toISOString() }).eq('id', data.id)
        return json({ template: data })
      }

      // ═══ QUICK LINKS ═══
      case 'get_quick_links': {
        if (!user) return json({ links: [] })
        const { data } = await supabase.from('dashboard_quick_links').select('*').eq('user_id', user.id).order('position')
        return json({ links: data || [] })
      }

      case 'save_quick_link': {
        if (!user) return json({ error: 'Auth required' })
        const { link_type, label, url, icon, color } = body
        const { count } = await supabase.from('dashboard_quick_links').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        await supabase.from('dashboard_quick_links').insert({
          org_id: orgId!, user_id: user.id, link_type: link_type || 'page',
          label, url, icon, color, position: count || 0,
        })
        return json({ success: true })
      }

      case 'remove_quick_link': {
        if (!user) return json({ error: 'Auth required' })
        await supabase.from('dashboard_quick_links').delete().eq('id', body.link_id).eq('user_id', user.id)
        return json({ success: true })
      }

      // ═══ SAMPLE DATA ═══
      case 'list_sample_data': {
        const { data } = await supabase.from('sample_data_sets').select('id, name, description, industry_id, is_default')
        return json({ datasets: data || [] })
      }

      // ═══ DASHBOARD HUB ═══
      case 'hub': {
        const { data: featured } = await supabase.from('resource_library').select('slug, title, excerpt, resource_type, category, thumbnail_url')
          .eq('status', 'published').or('featured.eq.true,pinned.eq.true').order('pinned', { ascending: false }).limit(6)
        const { data: templates } = await supabase.from('report_templates').select('id, slug, name, description, template_type, plan_required')
          .eq('status', 'active').eq('is_system', true).order('usage_count', { ascending: false }).limit(8)
        let quickLinks: any[] = []
        if (user) {
          const { data: links } = await supabase.from('dashboard_quick_links').select('*').eq('user_id', user.id).order('position').limit(10)
          quickLinks = links || []
        }
        const { data: announcements } = await supabase.from('ux_announcements').select('*')
          .eq('published', true).lte('starts_at', new Date().toISOString())
          .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
          .order('starts_at', { ascending: false }).limit(3)
        return json({ featured: featured || [], templates: templates || [], quick_links: quickLinks, announcements: announcements || [] })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
