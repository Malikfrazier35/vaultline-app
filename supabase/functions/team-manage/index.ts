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
    if (!['owner', 'admin'].includes(profile.role)) return new Response(JSON.stringify({ error: 'Insufficient permissions' }), { status: 403, headers: cors })

    const { action, ...body } = await req.json()
    const orgId = profile.org_id
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'invite': {
        const { email, role = 'member' } = body
        if (!email) return json({ error: 'Email required' })
        // Check existing
        const { data: existing } = await supabase.from('invites').select('id').eq('org_id', orgId).eq('email', email).eq('status', 'pending').single()
        if (existing) return json({ error: 'Already invited' })
        const { data: invite, error } = await supabase.from('invites').insert({ org_id: orgId, email, role, invited_by: profile.id }).select().single()
        if (error) return json({ error: error.message })
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'team_invite', details: { email, role } })
        // Send invite email via notify function
        const { data: orgData } = await supabase.from('organizations').select('name').eq('id', orgId).single()
        await supabase.functions.invoke('notify', {
          body: { action: 'invite_email', email, org_name: orgData?.name, inviter_name: profile.full_name || 'A teammate', role, token: invite.token },
        })
        return json({ success: true, invite })
      }

      case 'bulk_invite': {
        const { emails, role = 'member' } = body
        if (!emails?.length) return json({ error: 'Emails required' })
        const results = []
        for (const email of emails.slice(0, 20)) {
          const { data: existing } = await supabase.from('invites').select('id').eq('org_id', orgId).eq('email', email.trim()).eq('status', 'pending').single()
          if (existing) { results.push({ email, success: false, reason: 'already_invited' }); continue }
          const { error } = await supabase.from('invites').insert({ org_id: orgId, email: email.trim(), role, invited_by: profile.id })
          results.push({ email, success: !error, reason: error?.message })
        }
        return json({ success: true, results })
      }

      case 'revoke': {
        const { invite_id } = body
        await supabase.from('invites').update({ status: 'revoked' }).eq('id', invite_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'resend_invite': {
        const { invite_id } = body
        const { data: invite } = await supabase.from('invites').select('*').eq('id', invite_id).eq('org_id', orgId).single()
        if (!invite) return json({ error: 'Invite not found' })
        await supabase.from('invites').update({ expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }).eq('id', invite_id)
        // Re-send email
        const { data: orgData } = await supabase.from('organizations').select('name').eq('id', orgId).single()
        await supabase.functions.invoke('notify', {
          body: { action: 'invite_email', email: invite.email, org_name: orgData?.name, inviter_name: profile.full_name || 'A teammate', role: invite.role, token: invite.token },
        })
        return json({ success: true })
      }

      case 'accept_invite': {
        const { token } = body
        if (!token) return json({ error: 'Invite token required' })
        // Look up invite by token
        const { data: invite, error: invErr } = await supabase.from('invites').select('*').eq('token', token).eq('status', 'pending').single()
        if (invErr || !invite) return json({ error: 'Invalid or expired invitation' })
        // Check expiry
        if (new Date(invite.expires_at) < new Date()) {
          await supabase.from('invites').update({ status: 'expired' }).eq('id', invite.id)
          return json({ error: 'This invitation has expired' })
        }
        // Move user to the invited org with the invited role
        await supabase.from('profiles').update({
          org_id: invite.org_id,
          role: invite.role,
        }).eq('id', user.id)
        // Mark invite accepted
        await supabase.from('invites').update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
        }).eq('id', invite.id)
        // Audit
        await supabase.from('audit_log').insert({
          org_id: invite.org_id, user_id: user.id,
          action: 'invite_accepted',
          details: { email: invite.email, role: invite.role, invited_by: invite.invited_by },
        })
        return json({ success: true, org_id: invite.org_id, role: invite.role })
      }

      case 'update_role': {
        const { profile_id, role } = body
        if (profile.role !== 'owner' && role === 'admin') return json({ error: 'Only owner can promote to admin' })
        await supabase.from('profiles').update({ role }).eq('id', profile_id).eq('org_id', orgId)
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'role_change', details: { target_id: profile_id, new_role: role } })
        return json({ success: true })
      }

      case 'remove_member': {
        const { profile_id } = body
        if (profile_id === user.id) return json({ error: 'Cannot remove yourself' })
        await supabase.from('profiles').update({ status: 'deactivated', role: 'viewer' }).eq('id', profile_id).eq('org_id', orgId)
        // CC6.3 — Revoke all active sessions on removal
        await supabase.from('active_sessions').update({ is_active: false }).eq('user_id', profile_id).eq('org_id', orgId)
        // Force sign-out via admin API
        try { await supabase.auth.admin.signOut(profile_id, 'global') } catch {}
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'member_removed', details: { target_id: profile_id, sessions_revoked: true } })
        await supabase.from('security_events').insert({ org_id: orgId, event_type: 'access_revoked', severity: 'warning', description: `Team member ${profile_id} removed — all sessions revoked`, user_id: profile_id })
        return json({ success: true })
      }

      case 'suspend_member': {
        const { profile_id } = body
        await supabase.from('profiles').update({ status: 'suspended' }).eq('id', profile_id).eq('org_id', orgId)
        // CC6.3 — Revoke sessions on suspension
        await supabase.from('active_sessions').update({ is_active: false }).eq('user_id', profile_id).eq('org_id', orgId)
        try { await supabase.auth.admin.signOut(profile_id, 'global') } catch {}
        await supabase.from('security_events').insert({ org_id: orgId, event_type: 'access_suspended', severity: 'warning', description: `Team member ${profile_id} suspended — sessions revoked`, user_id: profile_id })
        return json({ success: true })
      }

      case 'reactivate_member': {
        const { profile_id } = body
        await supabase.from('profiles').update({ status: 'active' }).eq('id', profile_id).eq('org_id', orgId)
        return json({ success: true })
      }

      case 'transfer_ownership': {
        const { target_profile_id, confirm_email } = body
        if (profile.role !== 'owner') return json({ error: 'Only owner can transfer' })
        if (confirm_email !== user.email) return json({ error: 'Email confirmation required' })
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', user.id)
        await supabase.from('profiles').update({ role: 'owner' }).eq('id', target_profile_id).eq('org_id', orgId)
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'ownership_transferred', details: { new_owner: target_profile_id } })
        return json({ success: true })
      }

      case 'list': {
        const { data: members } = await supabase.from('profiles').select('id, full_name, email:id, role, status, created_at').eq('org_id', orgId).order('created_at')
        const { data: invites } = await supabase.from('invites').select('*').eq('org_id', orgId).in('status', ['pending']).order('created_at', { ascending: false })
        return json({ members: members || [], invites: invites || [] })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
