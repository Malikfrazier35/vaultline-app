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
    // Auth
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await supabase.from('profiles').select('org_id, organizations(stripe_customer_id)').eq('id', user.id).single()

    if (!profile?.organizations?.stripe_customer_id) {
      return new Response(JSON.stringify({ error: 'No billing account found. Subscribe to a plan first.' }), { status: 400, headers: cors })
    }

    const returnUrl = req.headers.get('origin') || 'https://vaultline.app'

    // Create Stripe Customer Portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.organizations.stripe_customer_id,
      return_url: `${returnUrl}/billing`,
    })

    return new Response(JSON.stringify({ url: session.url }), { headers: cors })
  } catch (err) {
    console.error('Portal error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
