import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

// ── Lead scoring rules ──
function scoreLead(lead: any): { score: number, segment: string } {
  let score = 0

  // Company size scoring
  const sizeScores: Record<string, number> = { '1-10': 5, '11-50': 15, '51-200': 30, '201-500': 40, '500+': 50 }
  score += sizeScores[lead.company_size] || 0

  // Source scoring (higher intent sources score more)
  const sourceScores: Record<string, number> = { demo_request: 40, roi_calculator: 30, assessment: 25, resource_download: 10, newsletter: 5, referral: 20, direct: 15 }
  score += sourceScores[lead.source] || 0

  // Title scoring (decision makers score higher)
  const title = (lead.title || '').toLowerCase()
  if (title.includes('cfo') || title.includes('chief financial')) score += 25
  else if (title.includes('vp') || title.includes('director') || title.includes('head of')) score += 20
  else if (title.includes('controller') || title.includes('treasurer')) score += 20
  else if (title.includes('manager') || title.includes('analyst')) score += 10

  // Assessment answers scoring
  if (lead.assessment_answers) {
    const answers = lead.assessment_answers
    // High pain = high score
    if (answers.reconciliation_time === 'hours') score += 15
    if (answers.spreadsheet_reliance === 'heavy') score += 15
    if (answers.bank_count >= 3) score += 10
    if (answers.multi_currency === true) score += 10
    if (answers.team_size >= 3) score += 10
    if (answers.current_tool === 'spreadsheets') score += 20
    if (answers.current_tool === 'basic_accounting') score += 10
    if (answers.budget_range === '$500-2500') score += 15
    if (answers.budget_range === '$2500+') score += 20
    if (answers.timeline === 'immediate') score += 15
    if (answers.timeline === '1-3months') score += 10
  }

  // ROI inputs scoring
  if (lead.roi_inputs) {
    const roi = lead.roi_inputs
    if ((roi.monthly_cash || 0) >= 10000000) score += 15 // $10M+
    if ((roi.bank_accounts || 0) >= 5) score += 10
    if ((roi.hours_per_week || 0) >= 10) score += 15 // high pain
  }

  // Segment based on score
  let segment = 'unscored'
  if (score >= 60) segment = 'enterprise_ready'
  else if (score >= 35) segment = 'scaling'
  else segment = 'spreadsheet_dependent'

  return { score: Math.min(100, score), segment }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'capture': {
        const { email, full_name, company_name, company_size, title, source, assessment_answers, roi_inputs, roi_result, utm_source, utm_medium, utm_campaign, referrer, page_url } = body
        if (!email) return json({ error: 'Email required' })

        // Score and segment
        const { score, segment } = scoreLead(body)

        // Assessment result label
        let assessment_result = null
        if (assessment_answers) {
          if (segment === 'enterprise_ready') assessment_result = 'Treasury-ready — you need a dedicated TMS'
          else if (segment === 'scaling') assessment_result = 'Scaling — you\'re outgrowing spreadsheets'
          else assessment_result = 'Getting started — time to professionalize your treasury'
        }

        // Upsert by email (update if exists, insert if new)
        const { data: existing } = await supabase.from('leads').select('id, score').eq('email', email.toLowerCase().trim()).single()

        if (existing) {
          // Update with new data, keep higher score
          const updates: any = { updated_at: new Date().toISOString() }
          if (full_name) updates.full_name = full_name
          if (company_name) updates.company_name = company_name
          if (company_size) updates.company_size = company_size
          if (title) updates.title = title
          if (assessment_answers) { updates.assessment_answers = assessment_answers; updates.assessment_result = assessment_result }
          if (roi_inputs) updates.roi_inputs = roi_inputs
          if (roi_result) updates.roi_result = roi_result
          const newScore = Math.max(existing.score, score)
          updates.score = newScore
          updates.segment = newScore >= 60 ? 'enterprise_ready' : newScore >= 35 ? 'scaling' : 'spreadsheet_dependent'

          await supabase.from('leads').update(updates).eq('id', existing.id)
          return json({ success: true, lead_id: existing.id, score: newScore, segment: updates.segment, assessment_result, returning: true })
        } else {
          const { data: lead, error } = await supabase.from('leads').insert({
            email: email.toLowerCase().trim(), full_name, company_name, company_size, title, source: source || 'direct',
            segment, score, assessment_answers, assessment_result, roi_inputs, roi_result,
            utm_source, utm_medium, utm_campaign, referrer, page_url,
          }).select().single()

          if (error) return json({ error: error.message })
          return json({ success: true, lead_id: lead.id, score, segment, assessment_result, returning: false })
        }
      }

      case 'track_resource': {
        const { lead_id, session_id, resource_slug, resource_type, time_spent_seconds, scroll_depth } = body
        await supabase.from('resource_views').insert({
          lead_id, session_id, resource_slug, resource_type: resource_type || 'guide', time_spent_seconds, scroll_depth,
        })
        return json({ success: true })
      }

      case 'pipeline_stats': {
        // Admin endpoint for pipeline visibility
        const { data: leads } = await supabase.from('leads').select('segment, source, score, status, created_at').order('created_at', { ascending: false }).limit(500)

        const all = leads || []
        const stats = {
          total: all.length,
          by_segment: {
            enterprise_ready: all.filter(l => l.segment === 'enterprise_ready').length,
            scaling: all.filter(l => l.segment === 'scaling').length,
            spreadsheet_dependent: all.filter(l => l.segment === 'spreadsheet_dependent').length,
          },
          by_source: {} as Record<string, number>,
          by_status: {} as Record<string, number>,
          avg_score: all.length > 0 ? Math.round(all.reduce((s, l) => s + l.score, 0) / all.length) : 0,
          this_week: all.filter(l => new Date(l.created_at) >= new Date(Date.now() - 7 * 86400000)).length,
          this_month: all.filter(l => new Date(l.created_at) >= new Date(Date.now() - 30 * 86400000)).length,
        }
        all.forEach(l => { stats.by_source[l.source] = (stats.by_source[l.source] || 0) + 1 })
        all.forEach(l => { stats.by_status[l.status] = (stats.by_status[l.status] || 0) + 1 })

        return json({ stats, recent: all.slice(0, 20) })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
