import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'
import Stripe from 'https://esm.sh/stripe@14.14.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, { apiVersion: '2023-10-16' })
const endpointSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

const PLAN_LIMITS: Record<string, any> = {
  starter:    { max_bank_connections: 3,   max_team_members: 3,   forecast_days: 30,  copilot_enabled: false, api_access: false,  multi_currency: false },
  growth:     { max_bank_connections: 10,  max_team_members: 15,  forecast_days: 90,  copilot_enabled: true,  api_access: true,   multi_currency: true  },
  enterprise: { max_bank_connections: 999, max_team_members: 999, forecast_days: 365, copilot_enabled: true,  api_access: true,   multi_currency: true  },
}

// Wrap every DB write so a single failed insert can't 500 the entire webhook
const safeInsert = async (table: string, row: any) => {
  try {
    const { error } = await supabase.from(table).insert(row)
    if (error) console.error(`[${table}] insert failed:`, error.message)
  } catch (e: any) {
    console.error(`[${table}] insert threw:`, e?.message)
  }
}

const safeUpdate = async (table: string, patch: any, match: any) => {
  try {
    const { error } = await supabase.from(table).update(patch).match(match)
    if (error) console.error(`[${table}] update failed:`, error.message)
  } catch (e: any) {
    console.error(`[${table}] update threw:`, e?.message)
  }
}

async function dispatchWebhook(orgId: string, eventType: string, data: any) {
  try {
    await supabase.functions.invoke('webhook-deliver', {
      body: { action: 'dispatch', org_id: orgId, event_type: eventType, data },
    })
  } catch {}
}

serve(async (req) => {
  const sig = req.headers.get('stripe-signature')
  if (!sig) return new Response('Missing signature', { status: 400 })

  let event: Stripe.Event
  try {
    const body = await req.text()
    event = await stripe.webhooks.constructEventAsync(body, sig, endpointSecret)
  } catch (err: any) {
    console.error('Webhook sig verification failed:', err.message)
    await safeInsert('security_events', {
      event_type: 'webhook_signature_failed',
      severity: 'critical',
      description: `Stripe webhook signature verification failed: ${err.message}`,
      metadata: { source: 'stripe', error: err.message },
    })
    return new Response(`Webhook Error: ${err.message}`, { status: 400 })
  }

  // Idempotency via dedicated stripe_event_log (org-agnostic, text PK fits stripe event IDs)
  try {
    const { data: existing } = await supabase
      .from('stripe_event_log')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle()
    if (existing) {
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 })
    }
  } catch (e: any) {
    console.error('event_log lookup failed:', e?.message)
  }

  await safeInsert('stripe_event_log', {
    event_id: event.id,
    event_type: event.type,
    livemode: event.livemode,
    created_at_stripe: new Date(event.created * 1000).toISOString(),
  })

  const orgFromSub = async (subId: string) => {
    try {
      const sub = await stripe.subscriptions.retrieve(subId)
      return sub.metadata?.org_id || null
    } catch { return null }
  }

  const orgFromCustomer = async (custId: string) => {
    try {
      const { data } = await supabase.from('organizations').select('id').eq('stripe_customer_id', custId).maybeSingle()
      return data?.id || null
    } catch { return null }
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.subscription
          ? (await orgFromSub(session.subscription as string)) || (session.customer ? await orgFromCustomer(session.customer as string) : null)
          : null

        if (orgId && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const plan = sub.items.data[0]?.price?.metadata?.plan || 'starter'
          const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

          await safeUpdate('organizations', {
            plan_status: 'active',
            plan,
            stripe_subscription_id: session.subscription,
            stripe_customer_id: session.customer,
            ...limits,
          }, { id: orgId })

          await safeInsert('growth_events', {
            org_id: orgId,
            event: 'conversion',
            metadata: { plan, price_id: sub.items.data[0]?.price?.id },
          })

          await safeInsert('audit_log', {
            org_id: orgId,
            action: 'subscription_created',
            details: { plan, subscription_id: session.subscription },
          })

          await dispatchWebhook(orgId, 'subscription.created', { plan, status: 'active' })
        } else {
          console.error('checkout.session.completed: could not resolve org_id', { customer: session.customer, subscription: session.subscription })
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id || await orgFromCustomer(sub.customer as string)
        if (orgId) {
          const status = sub.status === 'active' ? 'active'
            : sub.status === 'past_due' ? 'past_due'
            : sub.status === 'trialing' ? 'trialing'
            : 'canceled'
          const plan = sub.items.data[0]?.price?.metadata?.plan || 'starter'
          const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.starter

          await safeUpdate('organizations', {
            plan_status: status, plan, stripe_subscription_id: sub.id, ...limits,
          }, { id: orgId })

          await dispatchWebhook(orgId, 'subscription.updated', { plan, status })
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const orgId = sub.metadata?.org_id || await orgFromCustomer(sub.customer as string)
        if (orgId) {
          await safeUpdate('organizations', {
            plan_status: 'canceled', stripe_subscription_id: null,
          }, { id: orgId })

          await safeInsert('growth_events', {
            org_id: orgId, event: 'churn', metadata: { reason: 'subscription_deleted' },
          })

          await safeInsert('audit_log', {
            org_id: orgId, action: 'subscription_canceled', details: { subscription_id: sub.id },
          })

          await dispatchWebhook(orgId, 'subscription.canceled', { reason: 'subscription_deleted' })
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = invoice.subscription ? (await orgFromSub(invoice.subscription as string)) : null
        if (orgId) {
          await safeUpdate('organizations', { plan_status: 'past_due' }, { id: orgId })

          await safeInsert('audit_log', {
            org_id: orgId, action: 'payment_failed',
            details: { invoice_id: invoice.id, amount: invoice.amount_due },
          })

          await safeInsert('notifications', {
            org_id: orgId, type: 'payment_failed', severity: 'critical',
            title: 'Payment failed',
            body: `Your subscription payment of $${((invoice.amount_due || 0) / 100).toLocaleString()} was declined. Update your payment method to avoid service interruption.`,
            metadata: { invoice_id: invoice.id, amount: invoice.amount_due },
            action_url: '/billing',
            channels_sent: ['in_app'],
          })

          await dispatchWebhook(orgId, 'payment.failed', { invoice_id: invoice.id, amount: invoice.amount_due })
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice
        const orgId = invoice.subscription ? (await orgFromSub(invoice.subscription as string)) : null
        if (orgId) {
          await safeUpdate('organizations', { plan_status: 'active' }, { id: orgId })

          await safeInsert('notifications', {
            org_id: orgId, type: 'payment_success', severity: 'success',
            title: 'Payment successful',
            body: `Subscription payment of $${((invoice.amount_due || 0) / 100).toLocaleString()} processed successfully.`,
            metadata: { invoice_id: invoice.id },
            action_url: '/billing',
            channels_sent: ['in_app'],
          })

          await dispatchWebhook(orgId, 'payment.succeeded', { invoice_id: invoice.id, amount: invoice.amount_due })
        }
        break
      }
    }

    // Mark event as processed
    await safeUpdate('stripe_event_log', { status: 'processed' }, { event_id: event.id })
  } catch (err: any) {
    console.error('Webhook handler error:', err)
    await safeUpdate('stripe_event_log', { status: 'failed', error_message: err?.message }, { event_id: event.id })
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 })
})
