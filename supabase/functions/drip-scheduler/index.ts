import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
const FROM_EMAIL = 'Vaultline <team@vaultline.app>'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

// Drip schedule: day → email content
const DRIP_SCHEDULE = [
  { day: 0, subject: 'Welcome to Vaultline — connect your first bank in 60 seconds', key: 'drip0' },
  { day: 2, subject: 'Import your transaction history for better forecasts', key: 'drip2' },
  { day: 5, subject: 'Your first AI cash forecast is ready to generate', key: 'drip5' },
  { day: 10, subject: 'Set a cash floor alert — catch shortfalls before they happen', key: 'drip10' },
  { day: 14, subject: 'Your trial is ending — here\'s what Vaultline did for you', key: 'drip14' },
]

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Get all trialing orgs with their owner profiles
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, created_at, plan_status, last_drip_sent, trial_ends_at')
      .eq('plan_status', 'trialing')

    if (!orgs?.length) return new Response(JSON.stringify({ sent: 0, message: 'No trialing orgs' }), { headers: cors })

    const results = { sent: 0, skipped: 0, details: [] as any[] }

    for (const org of orgs) {
      // Calculate days since signup
      const daysSinceSignup = Math.floor((Date.now() - new Date(org.created_at).getTime()) / 86400000)
      const lastDrip = org.last_drip_sent || -1

      // Find the right drip to send
      const nextDrip = DRIP_SCHEDULE.find(d => d.day <= daysSinceSignup && d.day > lastDrip)
      if (!nextDrip) {
        results.skipped++
        continue
      }

      // Get the org owner's email and name
      const { data: owner } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('org_id', org.id)
        .eq('role', 'owner')
        .single()

      if (!owner?.email) { results.skipped++; continue }

      // Check if user already completed the action this drip suggests
      const shouldSkip = await checkIfActionCompleted(supabase, org.id, nextDrip.key)
      if (shouldSkip) {
        // Still update last_drip_sent so we move to next email
        await supabase.from('organizations').update({ last_drip_sent: nextDrip.day }).eq('id', org.id)
        results.skipped++
        results.details.push({ org: org.name, drip: nextDrip.key, status: 'action_already_done' })
        continue
      }

      // Send the email
      const html = buildDripEmail(nextDrip.key, owner.full_name?.split(' ')[0] || 'there', org)
      const sent = await sendEmail(owner.email, nextDrip.subject, html)

      if (sent) {
        await supabase.from('organizations').update({ last_drip_sent: nextDrip.day }).eq('id', org.id)
        results.sent++
        results.details.push({ org: org.name, drip: nextDrip.key, email: owner.email, status: 'sent' })
      } else {
        results.details.push({ org: org.name, drip: nextDrip.key, status: 'send_failed' })
      }
    }

    return new Response(JSON.stringify(results), { headers: cors })
  } catch (err) {
    console.error('Drip scheduler error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})

// Check if the user already did what this drip email asks them to do
async function checkIfActionCompleted(supabase: any, orgId: string, dripKey: string): Promise<boolean> {
  switch (dripKey) {
    case 'drip0': // Connect bank
    case 'drip2': { // Import data
      const { count } = await supabase.from('bank_connections').select('*', { count: 'exact', head: true })
        .eq('org_id', orgId).or('is_sample.is.null,is_sample.eq.false')
      return (count || 0) > 0
    }
    case 'drip5': { // Generate forecast
      const { count } = await supabase.from('forecasts').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
      return (count || 0) > 0
    }
    case 'drip10': { // Set alert
      // Can't easily check localStorage alerts, so always send
      return false
    }
    case 'drip14': // Trial ending — always send
      return false
    default:
      return false
  }
}

function buildDripEmail(key: string, firstName: string, org: any): string {
  const wrap = (body: string) => `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:#1a1a2e;line-height:1.7;font-size:15px;">
      ${body}
      <p style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:11px;color:#999;">
        Vaultline · Treasury intelligence for modern finance teams<br>
        <a href="https://vaultline.app/unsubscribe" style="color:#999;">Unsubscribe</a>
      </p>
    </div>`

  switch (key) {
    case 'drip0':
      return wrap(`
        <p>Hi ${firstName},</p>
        <p>Welcome to Vaultline! Your treasury command center is ready.</p>
        <p>The fastest way to see value is to connect your first bank account. It takes about 60 seconds via Plaid, and your credentials never touch our servers.</p>
        <p><a href="https://vaultline.app/banks" style="display:inline-block;padding:10px 24px;background:linear-gradient(to right,#22D3EE,#38BDF8);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Connect Your First Bank →</a></p>
        <p style="color:#94A3B8;font-size:13px;">Once connected, you'll see real-time balances, categorized transactions, and your cash position dashboard — all within seconds.</p>
        <p>Best,<br>The Vaultline Team</p>`)

    case 'drip2':
      return wrap(`
        <p>Hi ${firstName},</p>
        <p>Vaultline's AI models get more accurate with historical data. If you have transaction exports from your bank or accounting software, importing them takes about 2 minutes.</p>
        <p>We support CSV uploads from most banks — just drag and drop. We auto-detect columns and categorize everything.</p>
        <p><a href="https://vaultline.app/import" style="display:inline-block;padding:10px 24px;background:linear-gradient(to right,#22D3EE,#38BDF8);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Import Transaction History →</a></p>
        <p>Best,<br>The Vaultline Team</p>`)

    case 'drip5':
      return wrap(`
        <p>Hi ${firstName},</p>
        <p>You have enough data for your first AI cash forecast. Vaultline runs three models — linear, EMA, and Monte Carlo — and shows you which one fits your cash flow patterns best.</p>
        <p><a href="https://vaultline.app/forecast" style="display:inline-block;padding:10px 24px;background:linear-gradient(to right,#22D3EE,#38BDF8);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Generate Your Forecast →</a></p>
        <p>Best,<br>The Vaultline Team</p>`)

    case 'drip10':
      return wrap(`
        <p>Hi ${firstName},</p>
        <p>One of the most valuable features in Vaultline is cash floor alerts. Set a threshold, and we'll notify you before your balance drops below it — so you catch shortfalls before they become emergencies.</p>
        <p><a href="https://vaultline.app/alerts" style="display:inline-block;padding:10px 24px;background:linear-gradient(to right,#22D3EE,#38BDF8);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">Set Up Alerts →</a></p>
        <p>Best,<br>The Vaultline Team</p>`)

    case 'drip14': {
      const daysLeft = org.trial_ends_at
        ? Math.max(0, Math.ceil((new Date(org.trial_ends_at).getTime() - Date.now()) / 86400000))
        : 0
      return wrap(`
        <p>Hi ${firstName},</p>
        <p>Your Vaultline trial ${daysLeft <= 0 ? 'has ended' : `ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}.</p>
        <p>To keep your treasury data flowing, upgrade to a paid plan. Your data, connections, and settings will carry over seamlessly.</p>
        <p><a href="https://vaultline.app/billing" style="display:inline-block;padding:10px 24px;background:linear-gradient(to right,#22D3EE,#818CF8);color:#fff;border-radius:10px;text-decoration:none;font-weight:600;">View Plans & Upgrade →</a></p>
        <p style="color:#94A3B8;font-size:13px;">If you have questions or need more time, reply to this email — we're happy to help.</p>
        <p>Best,<br>The Vaultline Team</p>`)
    }

    default:
      return wrap(`<p>Hi ${firstName},</p><p>Thanks for using Vaultline.</p>`)
  }
}

async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.log(`[drip-skip] No RESEND_API_KEY — would send to ${to}: ${subject}`)
    return false
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
    })
    return res.ok
  } catch (err) {
    console.error('Send email error:', err)
    return false
  }
}
