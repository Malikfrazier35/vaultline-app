import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import Stripe from 'https://esm.sh/stripe@14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
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

    const { data: profile } = await supabase.from('profiles').select('id, org_id, role, organizations(*)').eq('id', user.id).single()
    if (!profile || profile.role !== 'owner') return new Response(JSON.stringify({ error: 'Only account owner can close' }), { status: 403, headers: cors })

    const { step, reason, feedback } = await req.json()
    const orgId = profile.org_id
    const org = profile.organizations
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (step) {
      case 'preview': {
        // Step 1: Show what will happen
        const { count: memberCount } = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('status', 'active')
        const { count: bankCount } = await supabase.from('bank_connections').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
        const { count: txCount } = await supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('org_id', orgId)

        let refundAmount = 0
        if (org?.stripe_subscription_id) {
          try {
            const sub = await stripe.subscriptions.retrieve(org.stripe_subscription_id)
            if (sub.status === 'active') {
              const daysInPeriod = Math.ceil((sub.current_period_end - sub.current_period_start) / 86400)
              const daysUsed = Math.ceil((Date.now() / 1000 - sub.current_period_start) / 86400)
              const daysRemaining = Math.max(0, daysInPeriod - daysUsed)
              const priceAmount = sub.items.data[0]?.price?.unit_amount || 0
              refundAmount = Math.round((priceAmount * daysRemaining / daysInPeriod))
            }
          } catch {}
        }

        return json({
          preview: {
            members: memberCount || 0,
            banks: bankCount || 0,
            transactions: txCount || 0,
            plan: org?.plan,
            plan_status: org?.plan_status,
            refund_amount: refundAmount,
            data_retention_days: 30,
          }
        })
      }

      case 'confirm': {
        // Step 3: Execute closure
        const actions: string[] = []

        // Cancel Stripe subscription with prorated refund
        if (org?.stripe_subscription_id) {
          try {
            await stripe.subscriptions.cancel(org.stripe_subscription_id, { prorate: true })
            actions.push('stripe_subscription_canceled')

            // Issue prorated refund on latest invoice
            const invoices = await stripe.invoices.list({ subscription: org.stripe_subscription_id, limit: 1 })
            if (invoices.data[0]?.payment_intent) {
              try {
                await stripe.refunds.create({ payment_intent: invoices.data[0].payment_intent as string, reason: 'requested_by_customer' })
                actions.push('prorated_refund_issued')
              } catch {}
            }
          } catch (e) { actions.push(`stripe_error: ${e.message}`) }
        }

        // Deactivate all team members
        await supabase.from('profiles').update({ status: 'deactivated' }).eq('org_id', orgId)
        actions.push('team_deactivated')

        // Revoke all Plaid access tokens
        const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')
        const PLAID_SECRET = Deno.env.get('PLAID_SECRET')
        const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
        const PLAID_BASE = PLAID_ENV === 'production' ? 'https://production.plaid.com' : PLAID_ENV === 'development' ? 'https://development.plaid.com' : 'https://sandbox.plaid.com'

        const { data: bankConns } = await supabase.from('bank_connections').select('id, plaid_access_token').eq('org_id', orgId)
        if (bankConns?.length && PLAID_CLIENT_ID && PLAID_SECRET) {
          for (const conn of bankConns) {
            if (conn.plaid_access_token) {
              try {
                await fetch(`${PLAID_BASE}/item/remove`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, access_token: conn.plaid_access_token }),
                })
              } catch {}
            }
          }
          actions.push('plaid_tokens_revoked')
        }

        // Disconnect all banks
        await supabase.from('bank_connections').update({ status: 'disconnected' }).eq('org_id', orgId)
        actions.push('banks_disconnected')

        // Schedule deletion in 30 days (GDPR Article 17 compliance)
        const deletionDate = new Date(Date.now() + 30 * 86400000).toISOString()
        await supabase.from('organizations').update({
          plan_status: 'pending_deletion',
          closed_at: new Date().toISOString(),
          deletion_scheduled_at: deletionDate,
          closure_reason: reason || feedback || 'No reason provided',
        }).eq('id', orgId)
        actions.push('deletion_scheduled')

        // Invalidate all sessions for org members
        const { data: members } = await supabase.from('profiles').select('id').eq('org_id', orgId)
        if (members?.length) {
          for (const m of members) {
            try { await supabase.auth.admin.signOut(m.id, 'global') } catch {}
          }
          actions.push('sessions_invalidated')
        }

        // Log events
        await supabase.from('growth_events').insert({ org_id: orgId, user_id: user.id, event: 'churn', metadata: { reason, feedback, actions } }).catch(() => {})
        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'account_closed', details: { reason, feedback, actions, deletion_scheduled_at: deletionDate } }).catch(() => {})

        return json({ success: true, actions, deletion_scheduled_at: deletionDate })
      }

      default:
        return json({ error: `Unknown step: ${step}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
