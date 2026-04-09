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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── AUTH: Try multiple methods to identify the user ──
    const authHeader = req.headers.get('Authorization')
    let user = null
    let userEmail = null

    if (authHeader) {
      // Method 1: Use anon client with user's JWT
      try {
        const anonClient = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_ANON_KEY')!,
          { global: { headers: { Authorization: authHeader } } }
        )
        const { data, error } = await anonClient.auth.getUser()
        if (!error && data?.user) {
          user = data.user
          userEmail = user.email
        } else {
          console.log('Anon auth failed:', error?.message)
        }
      } catch (e) {
        console.log('Anon auth exception:', e.message)
      }

      // Method 2: Try with service role + JWT token directly
      if (!user) {
        try {
          const token = authHeader.replace('Bearer ', '')
          const { data, error } = await supabase.auth.getUser(token)
          if (!error && data?.user) {
            user = data.user
            userEmail = user.email
          } else {
            console.log('Service auth failed:', error?.message)
          }
        } catch (e) {
          console.log('Service auth exception:', e.message)
        }
      }
    }

    if (!user) {
      console.error('All auth methods failed. Header present:', !!authHeader)
      return new Response(JSON.stringify({ error: 'Authentication failed. Please sign out and sign back in.' }), { status: 401, headers: cors })
    }

    console.log('Authenticated user:', user.id, userEmail)

    // ── PARSE REQUEST ──
    const { price_id } = await req.json()
    if (!price_id) {
      return new Response(JSON.stringify({ error: 'price_id required' }), { status: 400, headers: cors })
    }

    // ── PROFILE + ORG LOOKUP (defensive) ──
    let orgId = null
    let orgName = null
    let stripeCustomerId = null

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('org_id, organizations(id, name, stripe_customer_id)')
        .eq('id', user.id)
        .single()

      if (profile) {
        orgId = profile.org_id
        orgName = profile.organizations?.name
        stripeCustomerId = profile.organizations?.stripe_customer_id
        console.log('Profile found:', { orgId, orgName, stripeCustomerId })
      } else {
        console.log('No profile found for user', user.id)
      }
    } catch (e) {
      console.log('Profile lookup failed (table may not exist):', e.message)
    }

    // ── GET OR CREATE STRIPE CUSTOMER ──
    if (!stripeCustomerId) {
      // Check if customer already exists in Stripe by email
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 })
      if (existing.data.length > 0) {
        stripeCustomerId = existing.data[0].id
        console.log('Found existing Stripe customer:', stripeCustomerId)
      } else {
        const customer = await stripe.customers.create({
          email: userEmail,
          name: orgName || user.user_metadata?.full_name || undefined,
          metadata: { supabase_uid: user.id, ...(orgId ? { org_id: orgId } : {}) },
        })
        stripeCustomerId = customer.id
        console.log('Created new Stripe customer:', stripeCustomerId)
      }

      // Save back to org if possible
      if (orgId) {
        await supabase.from('organizations').update({ stripe_customer_id: stripeCustomerId }).eq('id', orgId).then(() => {}).catch(() => {})
      }
    }

    // ── CREATE CHECKOUT SESSION ──
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: 'subscription',
      line_items: [{ price: price_id, quantity: 1 }],
      success_url: `${req.headers.get('origin') || 'https://www.vaultline.app'}/billing?checkout=success`,
      cancel_url: `${req.headers.get('origin') || 'https://www.vaultline.app'}/billing`,
      subscription_data: {
        trial_period_days: 14,
        metadata: { ...(orgId ? { org_id: orgId } : {}), supabase_uid: user.id },
      },
      allow_promotion_codes: true,
    })

    console.log('Checkout session created:', session.id)
    return new Response(JSON.stringify({ url: session.url }), { headers: cors })
  } catch (err) {
    console.error('Checkout error:', err.message, err.stack)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
