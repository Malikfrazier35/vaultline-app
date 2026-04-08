import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (data: any, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const RESEND_API = 'https://api.resend.com/emails'
const FROM = 'Vaultline Team <team@vaultline.app>'
const REPLY_TO = 'malik@vaultline.app'
const UNSUBSCRIBE_URL = 'https://vaultline.app/unsubscribe'
const PHYSICAL_ADDRESS = 'Financial Holding LLC' // Update with actual mailing address

// ── Email Templates ────────────────────────────────────────────────
function emailTemplate(step: number, contact: { name: string; company: string; title: string }) {
  const firstName = contact.name.split(' ')[0]
  const companyShort = contact.company

  if (step === 1) {
    return {
      subject: `${companyShort}'s treasury visibility`,
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; color: #1a1a2e; line-height: 1.7; font-size: 15px;">
  <p>Hi ${firstName},</p>
  <p>Quick question — how does your finance team track cash positions across all your bank accounts today?</p>
  <p>We built Vaultline specifically for ${contact.title}s at companies like ${companyShort} who are managing multi-bank treasury operations without real-time visibility.</p>
  <p>One dashboard. Every bank. Live balances, forecasting, and anomaly detection — with SOC 2 controls built in from day one.</p>
  <p>Would a 15-minute walkthrough be worth your time this week?</p>
  <p style="margin-top: 24px;">Best,<br/>The Vaultline Team</p>
  <p style="font-size: 11px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px;">
    ${PHYSICAL_ADDRESS}<br/>
    <a href="${UNSUBSCRIBE_URL}" style="color: #999;">Unsubscribe</a>
  </p>
</div>`,
    }
  }

  if (step === 2) {
    return {
      subject: `Re: ${companyShort}'s treasury visibility`,
      html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; color: #1a1a2e; line-height: 1.7; font-size: 15px;">
  <p>Hi ${firstName},</p>
  <p>Following up — I know treasury visibility isn't always top of mind until month-end close hits or a cash forecast misses.</p>
  <p>Vaultline connects to your banks via Plaid, normalizes every transaction, and gives your team a single source of truth for cash positioning. No spreadsheets, no manual reconciliation.</p>
  <p>We also built compliance reporting into the platform — one-click SOC 2 evidence packages, encryption at rest, and a full audit trail. The kind of infrastructure that makes auditors happy without making your team miserable.</p>
  <p>Happy to show you in 15 minutes if you're open to it.</p>
  <p style="margin-top: 24px;">Best,<br/>The Vaultline Team</p>
  <p style="font-size: 11px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px;">
    ${PHYSICAL_ADDRESS}<br/>
    <a href="${UNSUBSCRIBE_URL}" style="color: #999;">Unsubscribe</a>
  </p>
</div>`,
    }
  }

  // Step 3 — breakup email
  return {
    subject: `Closing the loop — ${companyShort}`,
    html: `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 580px; color: #1a1a2e; line-height: 1.7; font-size: 15px;">
  <p>Hi ${firstName},</p>
  <p>I'll keep this short — I don't want to clutter your inbox.</p>
  <p>If treasury visibility isn't a priority right now, totally understand. But if it becomes one, Vaultline is here: <a href="https://vaultline.app" style="color: #06b6d4;">vaultline.app</a></p>
  <p>Wishing you and the ${companyShort} team a strong quarter.</p>
  <p style="margin-top: 24px;">Best,<br/>The Vaultline Team</p>
  <p style="font-size: 11px; color: #999; margin-top: 32px; border-top: 1px solid #eee; padding-top: 12px;">
    ${PHYSICAL_ADDRESS}<br/>
    <a href="${UNSUBSCRIBE_URL}" style="color: #999;">Unsubscribe</a>
  </p>
</div>`,
  }
}

// ── Send via Resend ────────────────────────────────────────────────
async function sendEmail(to: string, subject: string, html: string, scheduledAt?: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) throw new Error('RESEND_API_KEY not set')

  const body: any = {
    from: FROM,
    to: [to],
    reply_to: REPLY_TO,
    subject,
    html,
  }
  if (scheduledAt) body.scheduled_at = scheduledAt

  const res = await fetch(RESEND_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || `Resend error ${res.status}`)
  return data
}

// ── Schedule for next 6-8am ET window ──────────────────────────────
function nextSendWindow(daysFromNow = 0): string {
  const now = new Date()
  const target = new Date(now)
  target.setDate(target.getDate() + daysFromNow)

  // Set to 6:30am ET (randomize between 6:00-7:45am)
  const minuteOffset = Math.floor(Math.random() * 105) // 0-104 minutes after 6am
  const etHour = 6 + Math.floor(minuteOffset / 60)
  const etMinute = minuteOffset % 60

  // Convert ET to UTC (ET = UTC-4 during EDT, UTC-5 during EST)
  // April = EDT = UTC-4
  const utcHour = etHour + 4
  target.setUTCHours(utcHour, etMinute, 0, 0)

  // Skip weekends
  const day = target.getUTCDay()
  if (day === 0) target.setDate(target.getDate() + 1) // Sunday → Monday
  if (day === 6) target.setDate(target.getDate() + 2) // Saturday → Monday

  return target.toISOString()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, contacts, step, dryRun } = await req.json()

    // ── Queue drip sequence ────────────────────────────────────────
    if (action === 'queue_drip') {
      // contacts: [{ name, email, company, title }]
      const results = []

      for (const contact of contacts) {
        if (!contact.email) { results.push({ ...contact, status: 'skipped', reason: 'no email' }); continue }

        // Step 1: next business day 6-8am
        const step1Time = nextSendWindow(1)
        // Step 2: 3 days after step 1
        const step2Time = nextSendWindow(4)
        // Step 3: 5 days after step 2
        const step3Time = nextSendWindow(9)

        const emails = [
          { step: 1, scheduledAt: step1Time, ...emailTemplate(1, contact) },
          { step: 2, scheduledAt: step2Time, ...emailTemplate(2, contact) },
          { step: 3, scheduledAt: step3Time, ...emailTemplate(3, contact) },
        ]

        for (const email of emails) {
          if (dryRun) {
            results.push({
              contact: contact.name,
              company: contact.company,
              step: email.step,
              scheduledAt: email.scheduledAt,
              subject: email.subject,
              status: 'dry_run',
            })
          } else {
            try {
              const res = await sendEmail(contact.email, email.subject, email.html, email.scheduledAt)
              results.push({
                contact: contact.name,
                step: email.step,
                scheduledAt: email.scheduledAt,
                resendId: res.id,
                status: 'scheduled',
              })
            } catch (err) {
              results.push({
                contact: contact.name,
                step: email.step,
                status: 'error',
                error: err.message,
              })
            }
          }
        }
      }

      // Log to audit
      await supabase.from('audit_log').insert({
        action: 'outreach_queued',
        resource_type: 'marketing',
        details: { total: contacts.length, dryRun, results_summary: results.length },
      }).catch(() => {})

      return json({ results, total: results.length })
    }

    // ── Send single email (for testing) ────────────────────────────
    if (action === 'send_single') {
      const { to, step: emailStep, contact } = await req.json()
      const template = emailTemplate(emailStep || 1, contact)
      const res = await sendEmail(to, template.subject, template.html)
      return json({ status: 'sent', resendId: res.id })
    }

    // ── Preview templates ──────────────────────────────────────────
    if (action === 'preview') {
      const contact = contacts?.[0] || { name: 'Jane Doe', company: 'Acme Corp', title: 'CFO' }
      return json({
        step1: emailTemplate(1, contact),
        step2: emailTemplate(2, contact),
        step3: emailTemplate(3, contact),
        schedule: {
          step1: nextSendWindow(1),
          step2: nextSendWindow(4),
          step3: nextSendWindow(9),
        },
      })
    }

    return json({ error: 'Unknown action. Use: queue_drip, send_single, preview' }, 400)
  } catch (err) {
    console.error(err)
    return json({ error: err.message }, 500)
  }
})
