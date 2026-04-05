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
      // ═══ PUBLIC: INDUSTRY PROFILES ═══
      case 'list_industries': {
        const { data } = await supabase.from('industry_profiles').select('*').in('tier', ['supported', 'specialized', 'coming_soon']).order('display_order')
        return json({ industries: data || [] })
      }

      case 'get_industry': {
        const { industry_id } = body
        const { data } = await supabase.from('industry_profiles').select('*').eq('id', industry_id).single()
        return json({ industry: data })
      }

      // ═══ ORG INDUSTRY CONFIG ═══
      case 'get_config': {
        if (!orgId) return json({ error: 'Auth required' })
        const { data } = await supabase.from('org_industry_config').select('*, industry_profiles(*)').eq('org_id', orgId).single()
        return json({ config: data })
      }

      case 'set_industry': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { industry_id, sub_vertical, company_size, annual_revenue_range, employee_count_range } = body
        await supabase.from('org_industry_config').upsert({
          org_id: orgId, industry_id, sub_vertical, company_size, annual_revenue_range, employee_count_range, updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id' })
        return json({ success: true })
      }

      case 'update_config': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const allowed = ['sub_vertical', 'company_size', 'annual_revenue_range', 'employee_count_range', 'custom_terminology', 'custom_categories', 'custom_reports', 'compliance_acknowledged', 'dpa_required', 'dpa_signed', 'kyb_status', 'risk_tier']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(body)) { if (allowed.includes(k)) safe[k] = body[k] }
        await supabase.from('org_industry_config').update(safe).eq('org_id', orgId)
        return json({ success: true })
      }

      // ═══ INDUSTRY ONBOARDING ═══
      case 'get_onboarding': {
        if (!orgId) return json({ error: 'Auth required' })
        const { data: config } = await supabase.from('org_industry_config').select('industry_id, onboarding_score').eq('org_id', orgId).single()
        if (!config) return json({ steps: [], score: 0 })
        const { data: industry } = await supabase.from('industry_profiles').select('onboarding_steps, default_categories, default_alerts, terminology').eq('id', config.industry_id).single()
        const { data: progress } = await supabase.from('onboarding_progress').select('step_id, status').eq('org_id', orgId).eq('user_id', user.id)
        const progressMap: Record<string, string> = {}
        for (const p of (progress || [])) progressMap[p.step_id] = p.status
        const steps = (industry?.onboarding_steps || []).map((s: any) => ({ ...s, status: progressMap[s.stepId] || 'pending' }))
        const completed = steps.filter((s: any) => s.status === 'completed').length
        const score = steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0
        if (score !== config.onboarding_score) {
          await supabase.from('org_industry_config').update({ onboarding_score: score, ...(score === 100 ? { onboarding_completed_at: new Date().toISOString() } : {}) }).eq('org_id', orgId)
        }
        return json({ steps, score, terminology: industry?.terminology, default_categories: industry?.default_categories })
      }

      // ═══ INDUSTRY CONTENT ═══
      case 'get_content': {
        const { industry_id, content_type, funnel_stage } = body
        let q = supabase.from('industry_content').select('*').eq('status', 'published')
        if (industry_id) q = q.eq('industry_id', industry_id)
        if (content_type) q = q.eq('content_type', content_type)
        if (funnel_stage) q = q.eq('funnel_stage', funnel_stage)
        const { data } = await q.order('created_at', { ascending: false }).limit(20)
        return json({ content: data || [] })
      }

      // ═══ DIVERSITY METRICS (admin/cron) ═══
      case 'calculate_diversity': {
        const period = new Date().toISOString().slice(0, 7) + '-01'
        const { data: orgs } = await supabase.from('org_industry_config').select('industry_id, company_size')
        const industryBreakdown: Record<string, number> = {}
        const sizeBreakdown: Record<string, number> = {}
        for (const o of (orgs || [])) {
          industryBreakdown[o.industry_id] = (industryBreakdown[o.industry_id] || 0) + 1
          if (o.company_size) sizeBreakdown[o.company_size] = (sizeBreakdown[o.company_size] || 0) + 1
        }
        await supabase.from('diversity_metrics').upsert({
          period, total_orgs: orgs?.length || 0,
          industries_represented: Object.keys(industryBreakdown).length,
          company_sizes: sizeBreakdown, industry_breakdown: industryBreakdown,
        }, { onConflict: 'period' })
        return json({ success: true, industries: Object.keys(industryBreakdown).length, total: orgs?.length || 0 })
      }

      case 'get_diversity': {
        const { data } = await supabase.from('diversity_metrics').select('*').order('period', { ascending: false }).limit(12)
        return json({ metrics: data || [] })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
