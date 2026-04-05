import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

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

    const { data: profile } = await supabase.from('profiles').select('id, org_id, role, organizations(name, plan, plan_status, referral_code, created_at, stripe_subscription_id)').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })

    const { action, ...body } = await req.json()
    const orgId = profile.org_id
    const org = profile.organizations
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'dashboard': {
        // Generate nudges based on org state
        const nudges: any[] = []
        const accountAge = org?.created_at ? Math.ceil((Date.now() - new Date(org.created_at).getTime()) / 86400000) : 0

        // Trial → upgrade nudge
        if (org?.plan_status === 'trialing' && accountAge >= 7) {
          nudges.push({ type: 'upgrade', title: 'Your trial is going well', desc: 'Upgrade now to keep your data flowing without interruption.', cta: 'View Plans', priority: 1 })
        }

        // Cross-sell if only on Vaultline
        const { data: ecoProducts } = await supabase.from('ecosystem_products').select('product, status').eq('org_id', orgId)
        const activeProducts = (ecoProducts || []).filter(p => p.status === 'active' || p.status === 'trialing').map(p => p.product)
        if (!activeProducts.includes('financeos') && accountAge >= 14) {
          nudges.push({ type: 'cross_sell', title: 'Complete your finance stack', desc: 'Add FinanceOS for budget vs actuals, variance analysis, and board reporting.', cta: 'Explore FinanceOS', product: 'financeos', priority: 2 })
        }

        // Referral nudge
        if (org?.referral_code && accountAge >= 7) {
          nudges.push({ type: 'referral', title: 'Earn $100 per referral', desc: `Share your code and earn $100 credit when they subscribe.`, cta: 'Copy Link', priority: 3 })
        }

        // Tier upgrade for starter plan
        if (org?.plan === 'starter' && accountAge >= 30) {
          const { count } = await supabase.from('bank_connections').select('id', { count: 'exact', head: true }).eq('org_id', orgId)
          if ((count || 0) >= 2) {
            nudges.push({ type: 'tier_upgrade', title: 'Outgrowing Starter?', desc: 'Growth plan unlocks AI Copilot, 90-day forecasting, and API access.', cta: 'Compare Plans', priority: 2 })
          }
        }

        // Referral stats
        const { data: referrals } = await supabase.from('growth_events').select('*').eq('org_id', orgId).in('event', ['referral_sent', 'referral_converted']).order('created_at', { ascending: false }).limit(20)

        const { count: totalReferrals } = await supabase.from('growth_events').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('event', 'referral_sent')
        const { count: convertedReferrals } = await supabase.from('growth_events').select('id', { count: 'exact', head: true }).eq('org_id', orgId).eq('event', 'referral_converted')

        return json({
          nudges: nudges.sort((a, b) => a.priority - b.priority).slice(0, 3),
          referral_code: org?.referral_code,
          referrals: referrals || [],
          stats: { total_sent: totalReferrals || 0, total_converted: convertedReferrals || 0 },
        })
      }

      case 'create_referral': {
        const { email } = body
        if (!email) return json({ error: 'Email required' })
        await supabase.from('growth_events').insert({ org_id: orgId, user_id: user.id, event: 'referral_sent', metadata: { email } })
        return json({ success: true })
      }

      case 'cross_sell_interest': {
        const { product } = body
        await supabase.from('growth_events').insert({ org_id: orgId, user_id: user.id, event: 'cross_sell_interest' as any, metadata: { product } })
        return json({ success: true })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
