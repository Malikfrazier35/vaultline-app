import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Auth for non-public actions
    let isAdmin = false
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user } } = await anonClient.auth.getUser()
      isAdmin = !!user && ADMIN_EMAILS.includes(user.email || '')
    }

    switch (action) {
      // ── BRAND KIT ──
      case 'brand_kit': {
        const { data } = await supabase.from('brand_assets').select('*').is('org_id', null).order('asset_type')
        return json({ assets: data || [] })
      }

      case 'save_brand_asset': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { asset_type, name, url, file_type, dimensions, colors, metadata } = body
        const { data } = await supabase.from('brand_assets').insert({ asset_type, name, url, file_type, dimensions, colors, metadata }).select().single()
        return json({ success: true, asset: data })
      }

      // ── CAMPAIGNS ──
      case 'list_campaigns': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { data } = await supabase.from('marketing_campaigns').select('*, marketing_content(count)').order('created_at', { ascending: false })
        return json({ campaigns: data || [] })
      }

      case 'create_campaign': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { name, description, campaign_type, start_date, end_date, target_segment, target_audience, budget, channels, utm_source, utm_medium, utm_campaign } = body
        const { data } = await supabase.from('marketing_campaigns').insert({
          name, description, campaign_type, start_date, end_date,
          target_segment, target_audience, budget, channels,
          utm_source, utm_medium, utm_campaign: utm_campaign || name.toLowerCase().replace(/\s+/g, '-'),
        }).select().single()
        return json({ success: true, campaign: data })
      }

      case 'update_campaign': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { campaign_id, ...updates } = body
        const allowed = ['name', 'description', 'status', 'start_date', 'end_date', 'target_segment', 'budget', 'spent', 'impressions', 'clicks', 'conversions', 'leads_generated', 'revenue_attributed']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(updates)) { if (allowed.includes(k)) safe[k] = updates[k] }
        await supabase.from('marketing_campaigns').update(safe).eq('id', campaign_id)
        return json({ success: true })
      }

      // ── CONTENT ──
      case 'list_content': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { campaign_id, content_type, status } = body
        let q = supabase.from('marketing_content').select('*').order('created_at', { ascending: false })
        if (campaign_id) q = q.eq('campaign_id', campaign_id)
        if (content_type) q = q.eq('content_type', content_type)
        if (status) q = q.eq('status', status)
        const { data } = await q.limit(100)
        return json({ content: data || [] })
      }

      case 'create_content': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { campaign_id, content_type, title, content_body, channel, scheduled_at, slug, meta_description, keywords, asset_urls, thumbnail_url } = body
        const { data } = await supabase.from('marketing_content').insert({
          campaign_id, content_type, title, body: content_body, channel,
          scheduled_at, slug, meta_description, keywords, asset_urls, thumbnail_url,
        }).select().single()
        return json({ success: true, content: data })
      }

      case 'update_content': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { content_id, ...updates } = body
        const allowed = ['title', 'body', 'status', 'channel', 'scheduled_at', 'published_at', 'slug', 'meta_description', 'keywords', 'asset_urls', 'thumbnail_url', 'views', 'clicks', 'shares', 'conversions']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(updates)) { if (allowed.includes(k)) safe[k] = updates[k] }
        await supabase.from('marketing_content').update(safe).eq('id', content_id)
        return json({ success: true })
      }

      // ── SOCIAL CALENDAR ──
      case 'calendar': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { start_date, end_date } = body
        let q = supabase.from('social_calendar').select('*, marketing_content(title, content_type, body)').order('scheduled_at')
        if (start_date) q = q.gte('scheduled_at', start_date)
        if (end_date) q = q.lte('scheduled_at', end_date)
        const { data } = await q.limit(200)
        return json({ events: data || [] })
      }

      case 'schedule_post': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { content_id, platform, scheduled_at } = body
        const { data } = await supabase.from('social_calendar').insert({ content_id, platform, scheduled_at }).select().single()
        return json({ success: true, event: data })
      }

      // ── MARKETING DASHBOARD ──
      case 'dashboard': {
        if (!isAdmin) return json({ error: 'Admin only' })

        const { data: campaigns } = await supabase.from('marketing_campaigns').select('*').order('created_at', { ascending: false })
        const { data: content } = await supabase.from('marketing_content').select('content_type, status, views, clicks, conversions').order('created_at', { ascending: false }).limit(200)
        const { data: leads } = await supabase.from('leads').select('source, segment, score, created_at').order('created_at', { ascending: false }).limit(100)
        const { data: upcoming } = await supabase.from('social_calendar').select('*, marketing_content(title, content_type)').eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(10)

        const allCampaigns = campaigns || []
        const activeCampaigns = allCampaigns.filter(c => c.status === 'active')
        const totalSpend = allCampaigns.reduce((s, c) => s + (c.spent || 0), 0)
        const totalLeads = allCampaigns.reduce((s, c) => s + (c.leads_generated || 0), 0)
        const totalRevenue = allCampaigns.reduce((s, c) => s + (c.revenue_attributed || 0), 0)

        const contentByType: Record<string, number> = {}
        const contentByStatus: Record<string, number> = {}
        for (const c of (content || [])) {
          contentByType[c.content_type] = (contentByType[c.content_type] || 0) + 1
          contentByStatus[c.status] = (contentByStatus[c.status] || 0) + 1
        }

        const leadsBySource: Record<string, number> = {}
        for (const l of (leads || [])) { leadsBySource[l.source] = (leadsBySource[l.source] || 0) + 1 }

        return json({
          stats: { total_campaigns: allCampaigns.length, active_campaigns: activeCampaigns.length, total_spend: totalSpend, total_leads: totalLeads, total_revenue: totalRevenue, roi: totalSpend > 0 ? Math.round((totalRevenue / totalSpend) * 100) / 100 : 0 },
          content: { total: content?.length || 0, by_type: contentByType, by_status: contentByStatus },
          leads: { total: leads?.length || 0, by_source: leadsBySource },
          upcoming_posts: upcoming || [],
          campaigns: allCampaigns.slice(0, 10),
        })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
