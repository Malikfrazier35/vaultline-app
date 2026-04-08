import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import Stripe from 'https://esm.sh/stripe@14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret)
  } catch (err) {
    console.error('Webhook sig verification failed:', err.message)
    await supabase.from('security_events').insert({
      event_type: 'webhook_signature_failed',
      severity: 'critical',
      description: `Stripe webhook signature verification failed: ${err.message}`,
      metadata: { source: 'stripe', error: err.message },
    }).catch(() => {})
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Replay protection — reject duplicate event IDs
  const { data: existing } = await supabase
    .from('audit_log')
    .select('id')
    .eq('resource_type', 'stripe_webhook')
    .eq('resource_id', event.id)
    .limit(1)
  if (existing && existing.length > 0) {
    return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
  }

  // Log all webhook events for audit trail
  await supabase.from('audit_log').insert({
    action: 'stripe_webhook_received',
    resource_type: 'stripe_webhook',
    resource_id: event.id,
    details: { type: event.type, created: event.created, livemode: event.livemode },
  }).catch(() => {})

  const orgFromSub = async (subId: string) => {
    const sub = await stripe.subscriptions.retrieve(subId)
    return sub.metadata?.org_id || null
  }

  const orgFromCustomer = async (custId: string) => {
    const { data } = await supabase.from('organizations').select('id').eq('stripe_customer_id', custId).single()
    return data?.id || null
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.subscription ? (await orgFromSub(session.subscription as string)) : null
        if (orgId) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const plan = sub.items.data[0]?.price?.metadata?.plan || 'starter'

          // Plan-based limits
          const PLAN_LIMITS: Record<string, any> = {
            starter:    { max_bank_connections: 3,   forecast_days: 30,  copilot_enabled: false, api_access: false,  multi_currency: false },
            growth:     { max_bank_connections: 10,  forecast_days: 90,  copilot_enabled: false, api_access: true,   multi_currency: false },
            enterprise: { max_bank_connections: 999, forecast_days: 365, copilot_enabled: true,  api_access: true,   multi_currency: true  },
          }
          const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

          await supabase.from('organizations').update({
            plan_status: 'active',
            plan,
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            ...limits,
          }).eq('id', orgId)
          await supabase.from('growth_events').insert({ org_id: orgId, event: 'conversion', metadata: { plan, price_id: sub.items.data[0]?.price?.id } })
          await supabase.from('audit_log').insert({ org_id: orgId, action: 'subscription_created', details: { plan, subscription_id: session.subscription } })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id || await orgFromCustomer(sub.customer as string)
        if (orgId) {
          const status = sub.status === 'active' ? 'active' : sub.status === 'past_due' ? 'past_due' : sub.status === 'trialing' ? 'trialing' : 'canceled'
          const plan = sub.items.data[0]?.price?.metadata?.plan || 'starter'

          const PLAN_LIMITS: Record<string, any> = {
            starter:    { max_bank_connections: 3,   forecast_days: 30,  copilot_enabled: false, api_access: false,  multi_currency: false },
            growth:     { max_bank_connections: 10,  forecast_days: 90,  copilot_enabled: false, api_access: true,   multi_currency: false },
            enterprise: { max_bank_connections: 999, forecast_days: 365, copilot_enabled: true,  api_access: true,   multi_currency: true  },
          }
          const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

          await supabase.from('organizations').update({ plan_status: status, plan, stripe_subscription_id: sub.id, ...limits }).eq('id', orgId)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id || await orgFromCustomer(sub.customer as string)
        if (orgId) {
          await supabase.from('organizations').update({ plan_status: 'canceled', stripe_subscription_id: null }).eq('id', orgId)
          await supabase.from('growth_events').insert({ org_id: orgId, event: 'churn', metadata: { reason: 'subscription_deleted' } })
          await supabase.from('audit_log').insert({ org_id: orgId, action: 'subscription_canceled', details: { subscription_id: sub.id } })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = invoice.subscription ? (await orgFromSub(invoice.subscription as string)) : null
        if (orgId) {
          await supabase.from('organizations').update({ plan_status: 'past_due' }).eq('id', orgId)
          await supabase.from('audit_log').insert({ org_id: orgId, action: 'payment_failed', details: { invoice_id: invoice.id, amount: invoice.amount_due } })
          // Trigger notification
          await supabase.from('notifications').insert({
            org_id: orgId, type: 'payment_failed', severity: 'critical',
            title: 'Payment failed', body: `Your subscription payment of $${((invoice.amount_due || 0) / 100).toLocaleString()} was declined. Update your payment method to avoid service interruption.`,
            metadata: { invoice_id: invoice.id, amount: invoice.amount_due }, action_url: '/billing', channels_sent: ['in_app'],
          })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = invoice.subscription ? (await orgFromSub(invoice.subscription as string)) : null
        if (orgId) {
          await supabase.from('organizations').update({ plan_status: 'active' }).eq('id', orgId)
          await supabase.from('notifications').insert({
            org_id: orgId, type: 'payment_success', severity: 'success',
            title: 'Payment successful', body: `Subscription payment of $${((invoice.amount_due || 0) / 100).toLocaleString()} processed successfully.`,
            metadata: { invoice_id: invoice.id }, action_url: '/billing', channels_sent: ['in_app'],
          })
        }
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
