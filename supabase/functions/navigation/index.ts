import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Auth (optional for batch ingestion)
    let user: any = null, profile: any = null, orgId: string | null = null
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user: u } } = await anonClient.auth.getUser()
      user = u
      if (user) {
        const { data: p } = await supabase.from('profiles').select('id, org_id, role').eq('id', user.id).single()
        profile = p; orgId = p?.org_id
      }
    }

    switch (action) {
      // ── TRACK PAGE VIEW ──
      case 'page_view': {
        if (!user) return json({ error: 'Auth required' })
        const { session_id, page_path, page_title, referrer_path, time_on_page_ms, scroll_depth_pct, interactions, entry_point, device_type, viewport_width, viewport_height, utm_source, utm_medium, utm_campaign } = body

        await supabase.from('page_views').insert({
          org_id: orgId, user_id: user.id, session_id, page_path, page_title,
          referrer_path, time_on_page_ms, scroll_depth_pct, interactions,
          entry_point: entry_point || false, device_type, viewport_width, viewport_height,
          utm_source, utm_medium, utm_campaign,
        })

        // Update navigation flow
        const { data: flow } = await supabase.from('navigation_flows').select('id, page_count, path_sequence, total_interactions').eq('session_id', session_id).single()
        if (flow) {
          const seq = [...(flow.path_sequence || []), page_path]
          await supabase.from('navigation_flows').update({
            page_count: (flow.page_count || 0) + 1,
            path_sequence: seq,
            total_interactions: (flow.total_interactions || 0) + (interactions || 0),
            exit_page: page_path,
            ended_at: new Date().toISOString(),
            duration_ms: Date.now() - new Date(flow.started_at || Date.now()).getTime(),
          }).eq('id', flow.id)
        } else {
          await supabase.from('navigation_flows').insert({
            org_id: orgId, user_id: user.id, session_id,
            entry_page: page_path, exit_page: page_path,
            path_sequence: [page_path], page_count: 1,
            referrer: body.referrer, utm_source, utm_medium, device_type,
          })
        }
        return json({ success: true })
      }

      // ── BATCH PAGE VIEWS (flush buffer) ──
      case 'batch_page_views': {
        if (!user) return json({ error: 'Auth required' })
        const { events } = body
        if (!events?.length) return json({ error: 'No events' })
        const rows = events.map((e: any) => ({ org_id: orgId, user_id: user.id, ...e }))
        await supabase.from('page_views').insert(rows)
        return json({ success: true, count: rows.length })
      }

      // ── TRACK FEATURE EVENT ──
      case 'feature_event': {
        if (!user) return json({ error: 'Auth required' })
        const { session_id, feature, feature_action, context } = body
        await supabase.from('feature_events').insert({
          org_id: orgId, user_id: user.id, session_id,
          feature, action: feature_action || 'used', context: context || {},
        })

        // Update flow features
        if (body.session_id) {
          const { data: flow } = await supabase.from('navigation_flows').select('id, features_used').eq('session_id', session_id).single()
          if (flow) {
            const features = new Set([...(flow.features_used || []), feature])
            await supabase.from('navigation_flows').update({ features_used: [...features] }).eq('id', flow.id)
          }
        }
        return json({ success: true })
      }

      // ── UPDATE ONBOARDING STEP ──
      case 'onboarding_step': {
        if (!user) return json({ error: 'Auth required' })
        const { step_id, step_name, status, time_spent_ms, metadata } = body
        await supabase.from('onboarding_progress').upsert({
          org_id: orgId, user_id: user.id, step_id, step_name: step_name || step_id,
          status: status || 'completed',
          ...(status === 'in_progress' ? { started_at: new Date().toISOString() } : {}),
          ...(status === 'completed' ? { completed_at: new Date().toISOString() } : {}),
          time_spent_ms, metadata,
        }, { onConflict: 'org_id,user_id,step_id' })
        return json({ success: true })
      }

      // ── CLOSE SESSION (on page unload) ──
      case 'end_session': {
        const { session_id, exit_page } = body
        await supabase.from('navigation_flows').update({
          ended_at: new Date().toISOString(), exit_page: exit_page || null,
        }).eq('session_id', session_id)
        // Mark last page as exit
        await supabase.from('page_views').update({ exit_point: true })
          .eq('session_id', session_id).eq('page_path', exit_page || '').order('created_at', { ascending: false }).limit(1)
        return json({ success: true })
      }

      // ── CALCULATE ENGAGEMENT SCORES (cron) ──
      case 'calculate_engagement': {
        const today = new Date().toISOString().split('T')[0]
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

        const { data: activeUsers } = await supabase.from('page_views')
          .select('user_id, org_id').gte('created_at', yesterday + 'T00:00:00Z').lte('created_at', today + 'T23:59:59Z')

        // Deduplicate
        const userMap = new Map<string, string>()
        for (const pv of (activeUsers || [])) { if (pv.user_id && pv.org_id) userMap.set(pv.user_id, pv.org_id) }

        const results = []
        for (const [userId, oId] of userMap) {
          // Pages visited today
          const { count: pages } = await supabase.from('page_views').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', today + 'T00:00:00Z')

          // Features used today
          const { data: feats } = await supabase.from('feature_events').select('feature').eq('user_id', userId).gte('created_at', today + 'T00:00:00Z')
          const uniqueFeatures = new Set((feats || []).map(f => f.feature)).size

          // Time spent (sum of page durations)
          const { data: durations } = await supabase.from('page_views').select('time_on_page_ms').eq('user_id', userId).gte('created_at', today + 'T00:00:00Z').not('time_on_page_ms', 'is', null)
          const timeMs = (durations || []).reduce((s, d) => s + (d.time_on_page_ms || 0), 0)
          const timeMin = Math.round(timeMs / 60000)

          // Login streak
          const { data: recentDays } = await supabase.from('engagement_scores').select('date, score').eq('user_id', userId).order('date', { ascending: false }).limit(30)
          let streak = 1
          if (recentDays?.length) {
            for (let i = 0; i < recentDays.length; i++) {
              const expected = new Date(Date.now() - (i + 1) * 86400000).toISOString().split('T')[0]
              if (recentDays[i].date === expected && recentDays[i].score > 0) streak++
              else break
            }
          }

          // Total actions
          const { count: actions } = await supabase.from('page_views').select('id', { count: 'exact', head: true }).eq('user_id', userId).gte('created_at', today + 'T00:00:00Z').gt('interactions', 0)

          // Score calculation (0-100)
          let score = 0
          score += Math.min(20, (pages || 0) * 3) // up to 20 for pages
          score += Math.min(25, uniqueFeatures * 5) // up to 25 for features
          score += Math.min(20, timeMin * 2) // up to 20 for time
          score += Math.min(15, streak * 3) // up to 15 for streak
          score += Math.min(20, (actions || 0) * 2) // up to 20 for actions
          score = Math.min(100, score)

          // Churn risk
          let churnRisk: string = 'low'
          if (score < 10) churnRisk = 'critical'
          else if (score < 25) churnRisk = 'high'
          else if (score < 50) churnRisk = 'medium'

          await supabase.from('engagement_scores').upsert({
            org_id: oId, user_id: userId, date: today, score,
            login_streak: streak, pages_visited: pages || 0, features_used: uniqueFeatures,
            time_spent_minutes: timeMin, actions_taken: actions || 0,
            churn_risk: churnRisk, last_active_at: new Date().toISOString(),
          }, { onConflict: 'org_id,user_id,date' })

          results.push({ user_id: userId, score, churn_risk: churnRisk })
        }
        return json({ processed: results.length, results })
      }

      // ── ANALYTICS DASHBOARD (admin) ──
      case 'dashboard': {
        if (!profile || !['owner', 'admin'].includes(profile.role)) return json({ error: 'Admin only' })
        const since7d = new Date(Date.now() - 7 * 86400000).toISOString()
        const since30d = new Date(Date.now() - 30 * 86400000).toISOString()

        // Top pages (7 days)
        const { data: pvRaw } = await supabase.from('page_views').select('page_path').eq('org_id', orgId!).gte('created_at', since7d)
        const pageCounts: Record<string, number> = {}
        for (const pv of (pvRaw || [])) { pageCounts[pv.page_path] = (pageCounts[pv.page_path] || 0) + 1 }
        const topPages = Object.entries(pageCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([path, views]) => ({ path, views }))

        // Top features (7 days)
        const { data: feRaw } = await supabase.from('feature_events').select('feature').eq('org_id', orgId!).gte('created_at', since7d)
        const featCounts: Record<string, number> = {}
        for (const fe of (feRaw || [])) { featCounts[fe.feature] = (featCounts[fe.feature] || 0) + 1 }
        const topFeatures = Object.entries(featCounts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([feature, count]) => ({ feature, count }))

        // Engagement scores (latest per user)
        const { data: engagement } = await supabase.from('engagement_scores').select('*').eq('org_id', orgId!).order('date', { ascending: false }).limit(50)
        const latestPerUser = new Map<string, any>()
        for (const e of (engagement || [])) { if (!latestPerUser.has(e.user_id)) latestPerUser.set(e.user_id, e) }
        const engagementList = [...latestPerUser.values()]

        // Session stats
        const { data: flows } = await supabase.from('navigation_flows').select('duration_ms, page_count, entry_page, exit_page').eq('org_id', orgId!).gte('started_at', since7d)
        const avgDuration = flows?.length ? Math.round(flows.reduce((s, f) => s + (f.duration_ms || 0), 0) / flows.length / 1000) : 0
        const avgPages = flows?.length ? Math.round(flows.reduce((s, f) => s + (f.page_count || 0), 0) / flows.length * 10) / 10 : 0

        // Churn risk breakdown
        const riskBreakdown = { low: 0, medium: 0, high: 0, critical: 0 }
        engagementList.forEach(e => { if (e.churn_risk) riskBreakdown[e.churn_risk]++ })

        // Onboarding completion
        const { data: onboarding } = await supabase.from('onboarding_progress').select('step_id, status').eq('org_id', orgId!)
        const onboardingComplete = (onboarding || []).filter(o => o.status === 'completed').length
        const onboardingTotal = (onboarding || []).length || 1

        return json({
          top_pages: topPages,
          top_features: topFeatures,
          engagement: engagementList,
          sessions: { total_7d: flows?.length || 0, avg_duration_seconds: avgDuration, avg_pages_per_session: avgPages },
          churn_risk: riskBreakdown,
          onboarding: { completed: onboardingComplete, total: onboardingTotal, rate: Math.round((onboardingComplete / onboardingTotal) * 100) },
        })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
