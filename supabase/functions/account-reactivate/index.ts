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
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })

    const { data: profile } = await supabase.from('profiles').select('*, organizations(*)').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile found' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

    const { action, ...body } = await req.json()
    const org = profile.organizations
    const orgId = profile.org_id
    const json = (d: any, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      // ── CHECK: Return reactivation status and options ──
      case 'check': {
        const isClosedAccount = org?.plan_status === 'pending_deletion' || org?.closed_at
        const isDeactivated = profile.status === 'deactivated'
        const isCanceled = org?.plan_status === 'canceled'

        if (!isClosedAccount && !isDeactivated && !isCanceled) {
          return json({ needs_reactivation: false })
        }

        // Check what data remains
        const [acctRes, txRes, bankRes] = await Promise.all([
          supabase.from('accounts').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
          supabase.from('transactions').select('id', { count: 'exact', head: true }).eq('org_id', orgId),
          supabase.from('bank_connections').select('id, institution_name, status').eq('org_id', orgId),
        ])

        return json({
          needs_reactivation: true,
          org_name: org?.name,
          closed_at: org?.closed_at,
          previous_plan: org?.plan,
          data_remaining: {
            accounts: acctRes.count || 0,
            transactions: txRes.count || 0,
            banks: (bankRes.data || []).map(b => ({ name: b.institution_name, status: b.status })),
          },
          profile_status: profile.status,
          org_status: org?.plan_status,
        })
      }

      // ── REACTIVATE: Restore the existing org with a new subscription ──
      case 'reactivate': {
        const { price_id } = body
        if (!price_id) return json({ error: 'price_id required' }, 400)

        // Get or create Stripe customer
        let customerId = org?.stripe_customer_id
        if (!customerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: org?.name || profile.full_name,
            metadata: { org_id: orgId, reactivation: 'true' },
          })
          customerId = customer.id
          await supabase.from('organizations').update({ stripe_customer_id: customerId }).eq('id', orgId)
        }

        // Create subscription with trial (welcome back — 14 days free)
        const subscription = await stripe.subscriptions.create({
          customer: customerId,
          items: [{ price: price_id }],
          trial_period_days: 14,
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          metadata: { org_id: orgId, reactivation: 'true' },
        })

        // Determine plan from price
        const price = await stripe.prices.retrieve(price_id)
        const amount = (price.unit_amount || 0) / 100
        const plan = amount <= 200 ? 'starter' : amount <= 2000 ? 'growth' : 'enterprise'
        const seatLimits: Record<string, number> = { starter: 3, growth: 15, enterprise: 999 }

        // Restore org
        await supabase.from('organizations').update({
          plan,
          plan_status: 'trialing',
          stripe_subscription_id: subscription.id,
          closed_at: null,
          trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          max_team_members: seatLimits[plan] || 3,
        }).eq('id', orgId)

        // Restore profile
        await supabase.from('profiles').update({
          status: 'active',
          role: profile.role === 'viewer' ? 'owner' : profile.role, // ensure owner access
        }).eq('id', user.id)

        // Log
        await supabase.from('audit_log').insert({
          org_id: orgId, user_id: user.id,
          action: 'account_reactivated',
          details: { plan, price_id, subscription_id: subscription.id, previous_status: org?.plan_status },
        })

        await supabase.from('security_events').insert({
          org_id: orgId, user_id: user.id,
          event_type: 'account_reactivated', severity: 'info',
          description: `Account reactivated on ${plan} plan after closure`,
        })

        // Get client secret for payment form
        const invoice = subscription.latest_invoice as any
        const clientSecret = invoice?.payment_intent?.client_secret || null

        return json({
          success: true,
          plan,
          subscription_id: subscription.id,
          client_secret: clientSecret,
          trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        })
      }

      // ── FRESH START: Create a new org, leave old one archived ──
      case 'fresh_start': {
        const { company_name } = body

        // Create new org
        const { data: newOrg, error: orgErr } = await supabase.from('organizations').insert({
          name: company_name || `${profile.full_name || 'My'} Company`,
          plan: 'starter',
          plan_status: 'trialing',
          trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
          max_team_members: 3,
        }).select().single()

        if (orgErr || !newOrg) return json({ error: orgErr?.message || 'Failed to create org' }, 500)

        // Reassign profile to new org
        await supabase.from('profiles').update({
          org_id: newOrg.id,
          status: 'active',
          role: 'owner',
        }).eq('id', user.id)

        // Log
        await supabase.from('audit_log').insert({
          org_id: newOrg.id, user_id: user.id,
          action: 'fresh_start',
          details: { previous_org_id: orgId, new_org_id: newOrg.id },
        })

        return json({
          success: true,
          org_id: newOrg.id,
          org_name: newOrg.name,
        })
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400)
    }
  } catch (err) {
    console.error('Reactivation error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
