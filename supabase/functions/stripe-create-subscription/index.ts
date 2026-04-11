import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import Stripe from 'https://esm.sh/stripe@14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    // ── AUTH ──
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    const authHeader = req.headers.get('Authorization')
    let user = null

    if (authHeader) {
      const anonClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      )
      const { data, error } = await anonClient.auth.getUser()
      if (!error && data?.user) user = data.user

      if (!user) {
        const token = authHeader.replace('Bearer ', '')
        const { data: d2, error: e2 } = await supabase.auth.getUser(token)
        if (!e2 && d2?.user) user = d2.user
      }
    }

    if (!user) {
      return new Response(JSON.stringify({ error: 'Authentication failed' }), { status: 401, headers: cors })
    }

    // ── PARSE ──
    const { price_id } = await req.json()
    if (!price_id) {
      return new Response(JSON.stringify({ error: 'price_id required' }), { status: 400, headers: cors })
    }

    // ── PROFILE + ORG ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, organizations(id, name, stripe_customer_id)')
      .eq('id', user.id)
      .single()

    const orgId = profile?.org_id || null
    const orgName = profile?.organizations?.name || null
    let stripeCustomerId = profile?.organizations?.stripe_customer_id || null

    // ── GET OR CREATE STRIPE CUSTOMER ──
    if (!stripeCustomerId) {
      const existing = await stripe.customers.list({ email: user.email!, limit: 1 })
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id
      } else {
        const customer = await stripe.customers.create({
          email: user.email!,
          name: orgName || user.user_metadata?.full_name || undefined,
          metadata: { supabase_uid: user.id, ...(orgId ? { org_id: orgId } : {}) },
        })
        stripeCustomerId = customer.id
      }

      if (orgId) {
        await supabase.from('organizations')
          .update({ stripe_customer_id: stripeCustomerId })
          .eq('id', orgId)
      }
    }

    // ── CREATE SUBSCRIPTION WITH TRIAL (incomplete until card confirmed) ──
    const subscription = await stripe.subscriptions.create({
      customer: stripeCustomerId,
      items: [{ price: price_id }],
      trial_period_days: 14,
      payment_behavior: 'default_incomplete',
      payment_settings: {
        save_default_payment_method: 'on_subscription',
      },
      metadata: { ...(orgId ? { org_id: orgId } : {}), supabase_uid: user.id },
      expand: ['pending_setup_intent'],
    })

    // For trials, Stripe creates a SetupIntent (no charge yet)
    const setupIntent = subscription.pending_setup_intent as Stripe.SetupIntent
    if (!setupIntent?.client_secret) {
      // Fallback: if there's a latest_invoice with a payment_intent (shouldn't happen for trials)
      throw new Error('No setup intent returned — check Stripe subscription configuration')
    }

    console.log('Subscription created:', subscription.id, 'status:', subscription.status)

    return new Response(JSON.stringify({
      subscriptionId: subscription.id,
      clientSecret: setupIntent.client_secret,
    }), { headers: cors })

  } catch (err) {
    console.error('Create subscription error:', err.message, err.stack)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
