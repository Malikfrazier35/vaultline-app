import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') || ''
const FROM_EMAIL = 'Vaultline <alerts@vaultline.app>'

// ── Email delivery via Resend ──
async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) { console.log(`[email-skip] No RESEND_API_KEY — would send to ${to}: ${subject}`); return false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    })
    return res.ok
  } catch (e) { console.error('Email send error:', e); return false }
}

// ── Slack delivery ──
async function sendSlack(webhookUrl: string, text: string, blocks?: any[]): Promise<boolean> {
  if (!webhookUrl) return false
  try {
    const body: any = { text }
    if (blocks) body.blocks = blocks
    const res = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return res.ok
  } catch (e) { console.error('Slack send error:', e); return false }
}

// ── Email templates ──
function alertEmailHtml(title: string, body: string, actionUrl?: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0C1222;color:#F1F5F9;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:20px;font-weight:800;letter-spacing:-0.02em;">Vault<span style="background:linear-gradient(90deg,#22D3EE,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">line</span></span>
      </div>
      <div style="background:#1E293B;border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:24px;">
        <h2 style="margin:0 0 8px;font-size:16px;color:#F1F5F9;">${title}</h2>
        <p style="margin:0;font-size:14px;color:#94A3B8;line-height:1.6;">${body}</p>
        ${actionUrl ? `<a href="${actionUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#22D3EE;color:#0C1222;font-weight:600;font-size:13px;border-radius:8px;text-decoration:none;">View in Vaultline</a>` : ''}
      </div>
      <p style="text-align:center;margin-top:20px;font-size:11px;color:#64748B;">
        <a href="https://www.vaultline.app/settings" style="color:#64748B;text-decoration:underline;">Manage notification preferences</a>
      </p>
    </div>
  `
}

function inviteEmailHtml(orgName: string, inviterName: string, role: string, token: string): string {
  const acceptUrl = `https://www.vaultline.app/accept-invite?token=${token}`
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#0C1222;color:#F1F5F9;border-radius:16px;">
      <div style="text-align:center;margin-bottom:24px;">
        <span style="font-size:20px;font-weight:800;">Vault<span style="background:linear-gradient(90deg,#22D3EE,#8B5CF6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">line</span></span>
      </div>
      <div style="background:#1E293B;border:1px solid rgba(148,163,184,0.1);border-radius:12px;padding:24px;text-align:center;">
        <h2 style="margin:0 0 8px;font-size:18px;">You're invited to ${orgName}</h2>
        <p style="margin:0 0 20px;font-size:14px;color:#94A3B8;">${inviterName} invited you as <strong>${role}</strong> on Vaultline.</p>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 32px;background:#22D3EE;color:#0C1222;font-weight:700;font-size:14px;border-radius:10px;text-decoration:none;">Accept Invitation</a>
        <p style="margin-top:16px;font-size:12px;color:#64748B;">This invitation expires in 7 days.</p>
      </div>
    </div>
  `
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      // ── EVALUATE ALERTS: Server-side alert checking for an org ──
      case 'evaluate': {
        const { org_id } = body
        if (!org_id) return json({ error: 'org_id required' })

        const [settingsRes, acctRes, posRes, fcRes, bankRes] = await Promise.all([
          supabase.from('notification_settings').select('*').eq('org_id', org_id).single(),
          supabase.from('accounts').select('id, name, current_balance, bank_connections(institution_name)').eq('org_id', org_id).eq('is_active', true),
          supabase.from('cash_position').select('*').eq('org_id', org_id).single(),
          supabase.from('forecasts').select('monthly_burn, runway_months, confidence').eq('org_id', org_id).order('generated_at', { ascending: false }).limit(1).single(),
          supabase.from('bank_connections').select('id, institution_name, status, last_synced_at').eq('org_id', org_id),
        ])

        const settings = settingsRes.data
        const accounts = acctRes.data || []
        const position = posRes.data
        const forecast = fcRes.data
        const banks = bankRes.data || []

        if (!settings) return json({ error: 'No notification settings' })

        // Get org owner for email delivery
        const { data: owners } = await supabase.from('profiles').select('id, full_name, email:id').eq('org_id', org_id).eq('role', 'owner').eq('status', 'active')
        const { data: org } = await supabase.from('organizations').select('name').eq('id', org_id).single()

        const created: any[] = []

        // Check for duplicate notifications in last 24h
        const { data: recent } = await supabase.from('notifications').select('type, metadata').eq('org_id', org_id).gte('created_at', new Date(Date.now() - 24 * 3600000).toISOString())
        const recentTypes = new Set((recent || []).map(n => `${n.type}-${JSON.stringify(n.metadata)}`))
        const isDuplicate = (type: string, meta: any) => recentTypes.has(`${type}-${JSON.stringify(meta)}`)

        // ── Low cash alerts ──
        if (settings.low_cash_alerts) {
          for (const acct of accounts) {
            if (acct.current_balance < (settings.low_cash_threshold || 100000)) {
              const meta = { account_id: acct.id }
              if (!isDuplicate('low_cash', meta)) {
                const title = `Low balance: ${acct.bank_connections?.institution_name || acct.name}`
                const bodyText = `Balance is $${acct.current_balance.toLocaleString()} — below your $${(settings.low_cash_threshold || 100000).toLocaleString()} threshold.`
                const notif = await createNotification(supabase, org_id, null, 'low_cash', 'critical', title, bodyText, meta, '/position', settings, owners, org?.name)
                if (notif) created.push(notif)
              }
            }
          }
        }

        // ── Large transaction alerts ──
        if (settings.large_transaction_alerts) {
          const since = new Date(Date.now() - 24 * 3600000).toISOString()
          const { data: largeTx } = await supabase.from('transactions').select('id, date, description, amount, accounts(name)').eq('org_id', org_id).gte('date', since.split('T')[0]).order('amount', { ascending: true }).limit(10)
          for (const tx of (largeTx || [])) {
            if (Math.abs(tx.amount) >= (settings.large_transaction_threshold || 50000)) {
              const meta = { transaction_id: tx.id }
              if (!isDuplicate('large_transaction', meta)) {
                const direction = tx.amount < 0 ? 'Inflow' : 'Outflow'
                const title = `Large ${direction.toLowerCase()}: $${Math.abs(tx.amount).toLocaleString()}`
                const bodyText = `${tx.description || 'Transaction'} on ${tx.accounts?.name || 'account'} — ${tx.date}`
                const notif = await createNotification(supabase, org_id, null, 'large_transaction', 'warning', title, bodyText, meta, '/transactions', settings, owners, org?.name)
                if (notif) created.push(notif)
              }
            }
          }
        }

        // ── Runway warning ──
        if (forecast?.runway_months && forecast.runway_months < 12 && forecast.runway_months > 0) {
          const meta = { runway: forecast.runway_months }
          if (!isDuplicate('runway_warning', {})) {
            const severity = forecast.runway_months < 6 ? 'critical' : 'warning'
            const title = `Cash runway: ${forecast.runway_months.toFixed(1)} months`
            const bodyText = `At current burn rate of $${(forecast.monthly_burn || 0).toLocaleString()}/mo, cash will be depleted in ${forecast.runway_months.toFixed(1)} months.`
            const notif = await createNotification(supabase, org_id, null, 'runway_warning', severity, title, bodyText, meta, '/forecast', settings, owners, org?.name)
            if (notif) created.push(notif)
          }
        }

        // ── Sync failure alerts ──
        for (const bank of banks) {
          if (bank.status === 'error' || bank.status === 'disconnected') {
            const meta = { bank_id: bank.id }
            if (!isDuplicate('sync_failure', meta)) {
              const title = `Bank sync failed: ${bank.institution_name}`
              const bodyText = `Connection to ${bank.institution_name} is ${bank.status}. Reconnect to resume data sync.`
              const notif = await createNotification(supabase, org_id, null, 'sync_failure', 'warning', title, bodyText, meta, '/banks', settings, owners, org?.name)
              if (notif) created.push(notif)
            }
          }
        }

        return json({ evaluated: true, created: created.length, notifications: created })
      }

      // ── TRIGGERED NOTIFICATION: Direct notification from another function ──
      case 'send': {
        const { org_id, user_id, type, severity, title, body: notifBody, metadata, action_url } = body
        const { data: settings } = await supabase.from('notification_settings').select('*').eq('org_id', org_id).single()
        const { data: owners } = await supabase.from('profiles').select('id, full_name, email:id').eq('org_id', org_id).eq('role', 'owner').eq('status', 'active')
        const { data: org } = await supabase.from('organizations').select('name').eq('id', org_id).single()

        const notif = await createNotification(supabase, org_id, user_id, type, severity || 'info', title, notifBody, metadata || {}, action_url, settings, owners, org?.name)
        return json({ success: true, notification: notif })
      }

      // ── SEND TEAM INVITE EMAIL ──
      case 'invite_email': {
        const { email, org_name, inviter_name, role, token } = body
        const html = inviteEmailHtml(org_name || 'a team', inviter_name || 'A teammate', role || 'member', token)
        const sent = await sendEmail(email, `You're invited to ${org_name || 'Vaultline'}`, html)
        return json({ success: true, email_sent: sent })
      }

      // ── MARK READ ──
      case 'mark_read': {
        const { notification_ids } = body
        if (notification_ids?.length) {
          await supabase.from('notifications').update({ read_at: new Date().toISOString() }).in('id', notification_ids)
        }
        return json({ success: true })
      }

      // ── MARK ALL READ ──
      case 'mark_all_read': {
        const { org_id, user_id } = body
        await supabase.from('notifications').update({ read_at: new Date().toISOString() })
          .eq('org_id', org_id).is('read_at', null).is('dismissed_at', null)
        return json({ success: true })
      }

      // ── SIGNUP ALERT: Real-time notification to founder on new signups ──
      case 'signup_alert': {
        const { email, full_name, company_name, source, utm_source, utm_medium, utm_campaign } = body
        const SLACK_WEBHOOK = Deno.env.get('SLACK_SIGNUP_WEBHOOK') || ''
        const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',').map(e => e.trim()).filter(Boolean)
        const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })
        const utmInfo = [utm_source, utm_medium, utm_campaign].filter(Boolean).join(' / ') || 'Direct'

        // Slack notification with rich formatting
        if (SLACK_WEBHOOK) {
          await sendSlack(SLACK_WEBHOOK, '', [
            {
              type: 'header',
              text: { type: 'plain_text', text: '🎉 New Signup', emoji: true }
            },
            {
              type: 'section',
              fields: [
                { type: 'mrkdwn', text: `*Name:*\n${full_name || 'Not provided'}` },
                { type: 'mrkdwn', text: `*Email:*\n${email}` },
                { type: 'mrkdwn', text: `*Company:*\n${company_name || 'Not provided'}` },
                { type: 'mrkdwn', text: `*Source:*\n${utmInfo}` },
              ]
            },
            {
              type: 'context',
              elements: [{ type: 'mrkdwn', text: `${timestamp} ET` }]
            }
          ])
        }

        // Email to admin(s)
        for (const admin of ADMIN_EMAILS) {
          await sendEmail(admin, `New signup: ${full_name || email}`, `
            <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#0C1222;color:#F1F5F9;border-radius:12px;">
              <h2 style="margin:0 0 16px;font-size:18px;color:#22D3EE;">New Vaultline Signup</h2>
              <table style="width:100%;font-size:14px;color:#94A3B8;">
                <tr><td style="padding:6px 0;font-weight:600;color:#F1F5F9;">Name</td><td>${full_name || '—'}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;color:#F1F5F9;">Email</td><td>${email}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;color:#F1F5F9;">Company</td><td>${company_name || '—'}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;color:#F1F5F9;">Source</td><td>${utmInfo}</td></tr>
                <tr><td style="padding:6px 0;font-weight:600;color:#F1F5F9;">Time</td><td>${timestamp} ET</td></tr>
              </table>
              <a href="https://www.vaultline.app/super-admin" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#22D3EE;color:#0C1222;font-weight:600;font-size:13px;border-radius:8px;text-decoration:none;">View in Admin</a>
            </div>
          `)
        }

        return json({ success: true, slack: !!SLACK_WEBHOOK, email: ADMIN_EMAILS.length })
      }

      // ── DISMISS ──
      case 'dismiss': {
        const { notification_id } = body
        await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', notification_id)
        return json({ success: true })
      }

      // ── BATCH EVALUATE: Process all active orgs (for cron) ──
      case 'evaluate_all': {
        const { data: orgs } = await supabase.from('organizations').select('id').in('plan_status', ['active', 'trialing'])
        const results = []
        for (const org of (orgs || [])) {
          try {
            // Recursive call to evaluate
            const evalRes = await fetch(Deno.env.get('SUPABASE_URL')! + '/functions/v1/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
              body: JSON.stringify({ action: 'evaluate', org_id: org.id }),
            })
            const data = await evalRes.json()
            results.push({ org_id: org.id, created: data.created || 0 })
          } catch (e) { results.push({ org_id: org.id, error: e.message }) }
        }
        return json({ processed: results.length, results })
      }

      // ── TRIAL EXPIRY CHECK: Notify orgs whose trial is ending soon ──
      case 'trial_check': {
        const now = new Date()
        const checkDays = [3, 1, 0] // days before expiry to notify
        const results = []

        for (const daysLeft of checkDays) {
          const targetDate = new Date(now.getTime() + daysLeft * 86400000)
          const dayStart = targetDate.toISOString().split('T')[0] + 'T00:00:00Z'
          const dayEnd = targetDate.toISOString().split('T')[0] + 'T23:59:59Z'

          const { data: expiringOrgs } = await supabase.from('organizations').select('id, name, trial_ends_at')
            .eq('plan_status', 'trialing')
            .gte('trial_ends_at', dayStart).lte('trial_ends_at', dayEnd)

          for (const org of (expiringOrgs || [])) {
            const { data: owners } = await supabase.from('profiles').select('id, full_name, email:id').eq('org_id', org.id).eq('role', 'owner')
            const { data: settings } = await supabase.from('notification_settings').select('*').eq('org_id', org.id).single()

            const title = daysLeft === 0 ? 'Your trial expires today' : `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your trial`
            const body = daysLeft === 0
              ? 'Upgrade now to keep your treasury data flowing. All your data will be preserved.'
              : `Your 14-day free trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}. Upgrade to continue using Vaultline.`

            await createNotification(supabase, org.id, null, 'trial_expiring', daysLeft === 0 ? 'critical' : 'warning', title, body, { days_left: daysLeft }, '/billing', settings, owners, org.name)
            results.push({ org_id: org.id, days_left: daysLeft })
          }
        }
        return json({ checked: results.length, results })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})

// ── Helper: Create notification + deliver via enabled channels ──
async function createNotification(
  supabase: any, orgId: string, userId: string | null,
  type: string, severity: string, title: string, body: string,
  metadata: any, actionUrl: string | undefined,
  settings: any, owners: any[], orgName: string | undefined
) {
  const channels: string[] = ['in_app']
  let emailSentAt = null
  let slackSentAt = null

  // Email delivery
  if (settings?.daily_position_email !== false && owners?.length) {
    const ownerEmail = owners[0]?.email // In production, resolve from auth.users
    // For now, use Supabase auth to get email
    if (ownerEmail) {
      const fullUrl = actionUrl ? `https://www.vaultline.app${actionUrl}` : undefined
      const sent = await sendEmail(
        ownerEmail,
        `[Vaultline] ${title}`,
        alertEmailHtml(title, body, fullUrl)
      )
      if (sent) { channels.push('email'); emailSentAt = new Date().toISOString() }
    }
  }

  // Slack delivery
  if (settings?.slack_enabled && settings?.slack_webhook_url) {
    const severityEmoji: Record<string, string> = { critical: '🔴', warning: '🟡', info: '🔵', success: '🟢' }
    const slackText = `${severityEmoji[severity] || '📌'} *${title}*\n${body}`
    const sent = await sendSlack(settings.slack_webhook_url, slackText)
    if (sent) { channels.push('slack'); slackSentAt = new Date().toISOString() }
  }

  // Store in DB
  const { data, error } = await supabase.from('notifications').insert({
    org_id: orgId, user_id: userId, type, severity, title, body, metadata,
    action_url: actionUrl, channels_sent: channels, email_sent_at: emailSentAt, slack_sent_at: slackSentAt,
  }).select().single()

  if (error) console.error('Notification insert error:', error)
  return data
}
