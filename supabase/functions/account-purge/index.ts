import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
const PLAID_BASE = PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Find orgs scheduled for deletion where the grace period has passed
    const { data: orgs } = await supabase
      .from('organizations')
      .select('id, name, deletion_scheduled_at')
      .eq('plan_status', 'pending_deletion')
      .lte('deletion_scheduled_at', new Date().toISOString())

    if (!orgs?.length) {
      return new Response(JSON.stringify({ purged: 0, message: 'No accounts to purge' }), { headers: cors })
    }

    const results = { purged: 0, errors: 0, details: [] as any[] }

    for (const org of orgs) {
      try {
        // Get owner email BEFORE deleting profiles (for final confirmation email)
        const { data: owner } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('org_id', org.id)
          .eq('role', 'owner')
          .single()

        // Get all user IDs for auth deletion
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id')
          .eq('org_id', org.id)

        // Revoke all Plaid access tokens
        const { data: bankConns } = await supabase
          .from('bank_connections')
          .select('id, plaid_access_token, institution_name')
          .eq('org_id', org.id)

        if (bankConns?.length && PLAID_CLIENT_ID && PLAID_SECRET) {
          for (const conn of bankConns) {
            if (conn.plaid_access_token) {
              try {
                await fetch(`${PLAID_BASE}/item/remove`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    client_id: PLAID_CLIENT_ID,
                    secret: PLAID_SECRET,
                    access_token: conn.plaid_access_token,
                  }),
                })
              } catch (e) {
                console.error(`Failed to revoke Plaid token for ${conn.institution_name}:`, e)
              }
            }
          }
        }

        // Cascade delete all data (order matters for foreign keys)
        const tables = [
          'copilot_messages',
          'ticket_messages',
          'support_tickets',
          'notifications',
          'daily_balances',
          'transactions',
          'accounts',
          'bank_connections',
          'forecasts',
          'audit_log',
          'security_events',
          'feature_events',
          'page_views',
          'growth_events',
          'notification_settings',
          'invites',
        ]

        for (const table of tables) {
          try {
            await supabase.from(table).delete().eq('org_id', org.id)
          } catch (e) {
            console.error(`Failed to delete from ${table}:`, e)
          }
        }

        // Delete profiles
        await supabase.from('profiles').delete().eq('org_id', org.id)

        // Delete organization
        await supabase.from('organizations').delete().eq('id', org.id)

        // Delete auth users
        if (profiles?.length) {
          for (const p of profiles) {
            try {
              await supabase.auth.admin.deleteUser(p.id)
            } catch (e) {
              console.error(`Failed to delete auth user ${p.id}:`, e)
            }
          }
        }

        // Send final confirmation email
        if (owner?.email && RESEND_API_KEY) {
          try {
            await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                from: 'Vaultline <team@vaultline.app>',
                to: [owner.email],
                subject: 'Your Vaultline account has been permanently deleted',
                html: `
                  <div style="font-family:-apple-system,sans-serif;max-width:560px;color:#1a1a2e;line-height:1.7;font-size:15px;">
                    <p>Hi ${owner.full_name?.split(' ')[0] || 'there'},</p>
                    <p>Your Vaultline account and all associated data have been permanently deleted as requested.</p>
                    <p>This includes: all bank connections, transactions, forecasts, team members, support tickets, and AI copilot conversations. Plaid access tokens have been revoked.</p>
                    <p>If you ever want to use Vaultline again, you're welcome to create a new account at <a href="https://vaultline.app" style="color:#22D3EE;">vaultline.app</a>.</p>
                    <p>Thank you for trying Vaultline.</p>
                    <p>Best,<br>The Vaultline Team</p>
                  </div>`,
              }),
            })
          } catch {}
        }

        results.purged++
        results.details.push({ org: org.name, status: 'purged', tables_cleared: tables.length })

      } catch (err) {
        console.error(`Failed to purge org ${org.id}:`, err)
        results.errors++
        results.details.push({ org: org.name, status: 'error', error: err.message })
      }
    }

    return new Response(JSON.stringify(results), { headers: cors })
  } catch (err) {
    console.error('Purge cron error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
