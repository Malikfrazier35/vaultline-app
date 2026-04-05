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
    const isAdmin = ['owner', 'admin'].includes(profile.role)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      // ── TASK DASHBOARD ──
      case 'dashboard': {
        const { data: tasks } = await supabase.from('scheduled_tasks').select('*, task_completions(count)').eq('org_id', orgId).order('next_due_at')
        const { data: tzConfig } = await supabase.from('timezone_configs').select('*').eq('org_id', orgId).single()
        const { data: recentTime } = await supabase.from('time_entries').select('category, duration_minutes, started_at').eq('org_id', orgId).gte('started_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('started_at', { ascending: false })

        const activeTasks = (tasks || []).filter(t => t.status === 'active')
        const overdue = activeTasks.filter(t => t.next_due_at && new Date(t.next_due_at) < new Date())
        const dueToday = activeTasks.filter(t => t.next_due_at && new Date(t.next_due_at).toDateString() === new Date().toDateString())

        // Time breakdown by category
        const timeByCategory: Record<string, number> = {}
        for (const te of (recentTime || [])) { timeByCategory[te.category] = (timeByCategory[te.category] || 0) + (te.duration_minutes || 0) }
        const totalMinutes = Object.values(timeByCategory).reduce((s, v) => s + v, 0)

        return json({
          tasks: tasks || [], overdue: overdue.length, due_today: dueToday.length,
          timezone: tzConfig || { primary_timezone: 'America/New_York', display_format: '12h' },
          time_this_week: { total_minutes: totalMinutes, by_category: timeByCategory },
        })
      }

      // ── CREATE TASK ──
      case 'create_task': {
        const { title, description, task_type, recurrence, scheduled_date, scheduled_time, day_of_week, day_of_month, timezone, notify_before_minutes, notify_channels, linked_page } = body
        if (!title) return json({ error: 'Title required' })

        // Calculate next_due_at
        let nextDue = null
        if (scheduled_date) {
          nextDue = new Date(`${scheduled_date}T${scheduled_time || '09:00'}:00`)
        } else if (recurrence === 'daily') {
          nextDue = new Date(); nextDue.setHours(parseInt((scheduled_time || '09:00').split(':')[0]), parseInt((scheduled_time || '09:00').split(':')[1] || '0'), 0)
          if (nextDue < new Date()) nextDue.setDate(nextDue.getDate() + 1)
        }

        const { data: task } = await supabase.from('scheduled_tasks').insert({
          org_id: orgId, user_id: user.id, title, description,
          task_type: task_type || 'custom', recurrence: recurrence || 'once',
          scheduled_date, scheduled_time: scheduled_time || '09:00',
          day_of_week, day_of_month, timezone: timezone || 'America/New_York',
          next_due_at: nextDue?.toISOString(), notify_before_minutes, notify_channels, linked_page,
        }).select().single()
        return json({ success: true, task })
      }

      // ── COMPLETE TASK ──
      case 'complete_task': {
        const { task_id, duration_minutes, notes, skipped } = body
        await supabase.from('task_completions').insert({ task_id, completed_by: user.id, duration_minutes, notes, skipped: skipped || false })
        // Update task
        const { data: task } = await supabase.from('scheduled_tasks').select('*').eq('id', task_id).single()
        if (task) {
          const updates: any = { last_completed_at: new Date().toISOString(), completion_count: (task.completion_count || 0) + 1 }
          // Calculate next due
          if (task.recurrence !== 'once') {
            const intervals: Record<string, number> = { daily: 1, weekly: 7, biweekly: 14, monthly: 30, quarterly: 91, annual: 365 }
            const daysToAdd = intervals[task.recurrence] || 1
            const next = new Date(task.next_due_at || Date.now())
            next.setDate(next.getDate() + daysToAdd)
            updates.next_due_at = next.toISOString()
          } else { updates.status = 'completed' }
          await supabase.from('scheduled_tasks').update(updates).eq('id', task_id)
        }
        return json({ success: true })
      }

      // ── UPDATE / DELETE TASK ──
      case 'update_task': {
        const { task_id, ...updates } = body
        const allowed = ['title', 'description', 'task_type', 'recurrence', 'scheduled_date', 'scheduled_time', 'status', 'notify_before_minutes', 'linked_page']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(updates)) { if (allowed.includes(k)) safe[k] = updates[k] }
        await supabase.from('scheduled_tasks').update(safe).eq('id', task_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'delete_task': {
        await supabase.from('scheduled_tasks').update({ status: 'canceled' }).eq('id', body.task_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ── TIMEZONE CONFIG ──
      case 'get_timezone': {
        const { data } = await supabase.from('timezone_configs').select('*').eq('org_id', orgId).single()
        return json({ config: data || { primary_timezone: 'America/New_York', display_format: '12h', fiscal_year_start_month: 1 } })
      }

      case 'save_timezone': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const allowed = ['primary_timezone', 'display_format', 'week_start', 'business_days', 'business_start', 'business_end', 'additional_timezones', 'fiscal_year_start_month', 'fiscal_quarter_offset']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(body)) { if (allowed.includes(k)) safe[k] = body[k] }
        await supabase.from('timezone_configs').upsert({ org_id: orgId, ...safe }, { onConflict: 'org_id' })
        return json({ success: true })
      }

      // ── TIME ENTRIES ──
      case 'log_time': {
        const { category, description, started_at, ended_at, duration_minutes, task_id, billable } = body
        const dur = duration_minutes || (ended_at && started_at ? Math.round((new Date(ended_at).getTime() - new Date(started_at).getTime()) / 60000) : null)
        const { data } = await supabase.from('time_entries').insert({
          org_id: orgId, user_id: user.id, task_id, category: category || 'other',
          description, started_at: started_at || new Date().toISOString(),
          ended_at, duration_minutes: dur, billable: billable || false,
        }).select().single()
        return json({ success: true, entry: data })
      }

      case 'list_time': {
        const { start_date, end_date, category } = body
        let q = supabase.from('time_entries').select('*').eq(isAdmin ? 'org_id' : 'user_id', isAdmin ? orgId : user.id).order('started_at', { ascending: false })
        if (start_date) q = q.gte('started_at', start_date)
        if (end_date) q = q.lte('started_at', end_date)
        if (category) q = q.eq('category', category)
        const { data } = await q.limit(200)
        return json({ entries: data || [] })
      }

      // ── TASK REMINDERS (cron) ──
      case 'send_reminders': {
        const now = new Date()
        const { data: dueTasks } = await supabase.from('scheduled_tasks').select('*, profiles(full_name)').eq('status', 'active').lte('next_due_at', new Date(now.getTime() + 60 * 60000).toISOString()).gte('next_due_at', now.toISOString())

        let sent = 0
        for (const task of (dueTasks || [])) {
          if (!task.notify_before_minutes) continue
          const dueAt = new Date(task.next_due_at)
          const notifyAt = new Date(dueAt.getTime() - task.notify_before_minutes * 60000)
          if (now >= notifyAt && now <= dueAt) {
            await supabase.from('notifications').insert({
              org_id: task.org_id, user_id: task.user_id, type: 'system', severity: 'info',
              title: `Task due: ${task.title}`,
              body: `"${task.title}" is due at ${dueAt.toLocaleTimeString()}${task.linked_page ? '. Click to open.' : ''}`,
              action_url: task.linked_page, channels_sent: ['in_app'],
            })
            sent++
          }
        }
        return json({ reminders_sent: sent })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
