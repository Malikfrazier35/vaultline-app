import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const ADMIN_EMAILS = (Deno.env.get('ADMIN_EMAILS') || '').split(',')

function generateApiKey() { return `vl_partner_${Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join('')}` }
function generateReferralCode(name: string) { return `VLP-${name.replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}` }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Auth
    let isAdmin = false
    let userId: string | null = null
    if (req.headers.get('Authorization')) {
      const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
        global: { headers: { Authorization: req.headers.get('Authorization')! } }
      })
      const { data: { user } } = await anonClient.auth.getUser()
      if (user) { isAdmin = ADMIN_EMAILS.includes(user.email || ''); userId = user.id }
    }

    switch (action) {
      // ── ADMIN: CREATE PARTNER ──
      case 'create_partner': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { name, type, tier, contact_name, contact_email, company_url, commission_pct, revenue_share_pct, webhook_url, webhook_events } = body
        if (!name || !type) return json({ error: 'Name and type required' })

        const { data: partner, error } = await supabase.from('partners').insert({
          name, type, tier: tier || 'standard', contact_name, contact_email, company_url,
          commission_pct: commission_pct || 10, revenue_share_pct: revenue_share_pct || 0,
          referral_code: generateReferralCode(name), api_key: generateApiKey(),
          webhook_url, webhook_events: webhook_events || ['referral.converted', 'commission.paid'],
          status: 'active', activated_at: new Date().toISOString(),
        }).select().single()
        if (error) return json({ error: error.message })
        return json({ success: true, partner })
      }

      // ── ADMIN: LIST PARTNERS ──
      case 'list_partners': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { data: partners } = await supabase.from('partners').select('*, partner_referrals(count)').order('created_at', { ascending: false })
        return json({ partners: partners || [] })
      }

      // ── ADMIN: UPDATE PARTNER ──
      case 'update_partner': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { partner_id, ...updates } = body
        const allowed = ['name', 'type', 'tier', 'status', 'contact_name', 'contact_email', 'company_url', 'commission_pct', 'revenue_share_pct', 'webhook_url', 'webhook_events']
        const safe: any = { updated_at: new Date().toISOString() }
        for (const k of Object.keys(updates)) { if (allowed.includes(k)) safe[k] = updates[k] }
        await supabase.from('partners').update(safe).eq('id', partner_id)
        return json({ success: true })
      }

      // ── ADMIN: PARTNER DASHBOARD ──
      case 'dashboard': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { data: partners } = await supabase.from('partners').select('*').eq('status', 'active')
        const { data: referrals } = await supabase.from('partner_referrals').select('*').order('created_at', { ascending: false }).limit(100)

        const totalPartners = partners?.length || 0
        const totalReferrals = referrals?.length || 0
        const converted = (referrals || []).filter(r => r.status === 'converted').length
        const totalMRR = (referrals || []).filter(r => r.status === 'converted').reduce((s, r) => s + (r.mrr || 0), 0)
        const totalCommissions = (referrals || []).reduce((s, r) => s + (r.commission_amount || 0), 0)
        const unpaidCommissions = (referrals || []).filter(r => r.commission_amount > 0 && !r.commission_paid).reduce((s, r) => s + r.commission_amount, 0)

        return json({
          stats: { total_partners: totalPartners, total_referrals: totalReferrals, converted, conversion_rate: totalReferrals > 0 ? Math.round((converted / totalReferrals) * 100) : 0, total_mrr: totalMRR, total_commissions: totalCommissions, unpaid_commissions: unpaidCommissions },
          partners: partners || [],
          recent_referrals: (referrals || []).slice(0, 20),
        })
      }

      // ── PUBLIC: TRACK REFERRAL (from partner link) ──
      case 'track_referral': {
        const { referral_code, email } = body
        if (!referral_code || !email) return json({ error: 'Referral code and email required' })

        const { data: partner } = await supabase.from('partners').select('id, name').eq('referral_code', referral_code).eq('status', 'active').single()
        if (!partner) return json({ error: 'Invalid referral code' })

        // Check for duplicate
        const { data: existing } = await supabase.from('partner_referrals').select('id').eq('partner_id', partner.id).eq('referred_email', email.toLowerCase()).single()
        if (existing) return json({ success: true, referral_id: existing.id, message: 'Already tracked' })

        const { data: referral } = await supabase.from('partner_referrals').insert({
          partner_id: partner.id, referred_email: email.toLowerCase(), status: 'pending',
        }).select().single()

        // Update partner stats
        await supabase.from('partners').update({ total_referrals: partner.total_referrals || 0 + 1, last_activity_at: new Date().toISOString() }).eq('id', partner.id)

        return json({ success: true, referral_id: referral?.id, partner_name: partner.name })
      }

      // ── INTERNAL: ATTRIBUTE SIGNUP TO PARTNER ──
      case 'attribute_signup': {
        const { email, org_id } = body
        const { data: referral } = await supabase.from('partner_referrals').select('*, partners(*)').eq('referred_email', email.toLowerCase()).eq('status', 'pending').single()
        if (!referral) return json({ success: false, message: 'No pending referral' })

        await supabase.from('partner_referrals').update({
          status: 'signed_up', referred_org_id: org_id, attributed_at: new Date().toISOString(),
        }).eq('id', referral.id)

        return json({ success: true, partner: referral.partners?.name })
      }

      // ── INTERNAL: MARK CONVERSION (on subscription) ──
      case 'convert_referral': {
        const { org_id, plan, mrr } = body
        const { data: referral } = await supabase.from('partner_referrals').select('*, partners(*)').eq('referred_org_id', org_id).in('status', ['signed_up', 'trialing']).single()
        if (!referral) return json({ success: false })

        const commissionPct = referral.partners?.commission_pct || 10
        const commission = (mrr || 0) * (commissionPct / 100) * 12 // Annual commission on first year MRR

        await supabase.from('partner_referrals').update({
          status: 'converted', plan, mrr, commission_amount: commission, converted_at: new Date().toISOString(),
        }).eq('id', referral.id)

        await supabase.from('partners').update({
          total_customers: (referral.partners?.total_customers || 0) + 1,
          total_revenue: (referral.partners?.total_revenue || 0) + commission,
          last_activity_at: new Date().toISOString(),
        }).eq('id', referral.partner_id)

        // Deliver webhook
        if (referral.partners?.webhook_url && referral.partners?.webhook_events?.includes('referral.converted')) {
          await deliverWebhook(supabase, referral.partner_id, referral.partners.webhook_url, 'referral.converted', {
            referral_id: referral.id, email: referral.referred_email, plan, mrr, commission,
          })
        }

        return json({ success: true, commission })
      }

      // ── ADMIN: PAY COMMISSION ──
      case 'pay_commission': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { referral_id } = body
        await supabase.from('partner_referrals').update({ commission_paid: true, commission_paid_at: new Date().toISOString() }).eq('id', referral_id)

        // Get referral + partner for webhook
        const { data: ref } = await supabase.from('partner_referrals').select('*, partners(*)').eq('id', referral_id).single()
        if (ref?.partners?.webhook_url && ref.partners.webhook_events?.includes('commission.paid')) {
          await deliverWebhook(supabase, ref.partner_id, ref.partners.webhook_url, 'commission.paid', {
            referral_id: ref.id, email: ref.referred_email, amount: ref.commission_amount,
          })
        }
        return json({ success: true })
      }

      // ── PARTNER: SELF-SERVICE PORTAL (via API key) ──
      case 'portal': {
        const { api_key } = body
        if (!api_key) return json({ error: 'API key required' })
        const { data: partner } = await supabase.from('partners').select('*').eq('api_key', api_key).eq('status', 'active').single()
        if (!partner) return json({ error: 'Invalid API key' })

        const { data: referrals } = await supabase.from('partner_referrals').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
        const converted = (referrals || []).filter(r => r.status === 'converted')
        const totalCommission = (referrals || []).reduce((s, r) => s + (r.commission_amount || 0), 0)
        const paidCommission = (referrals || []).filter(r => r.commission_paid).reduce((s, r) => s + r.commission_amount, 0)

        return json({
          partner: { id: partner.id, name: partner.name, type: partner.type, tier: partner.tier, referral_code: partner.referral_code, commission_pct: partner.commission_pct },
          stats: { total_referrals: referrals?.length || 0, converted: converted.length, total_commission: totalCommission, paid_commission: paidCommission, pending_commission: totalCommission - paidCommission },
          referrals: (referrals || []).map(r => ({ id: r.id, email: r.referred_email, status: r.status, mrr: r.mrr, commission: r.commission_amount, paid: r.commission_paid, created_at: r.created_at })),
        })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})

// ── Webhook delivery with retry logging ──
async function deliverWebhook(supabase: any, partnerId: string, url: string, eventType: string, payload: any) {
  let delivered = false
  let responseStatus = 0
  let responseBody = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Vaultline-Event': eventType, 'X-Vaultline-Signature': 'v1' },
      body: JSON.stringify({ event: eventType, data: payload, timestamp: new Date().toISOString() }),
    })
    responseStatus = res.status
    responseBody = await res.text().catch(() => '')
    delivered = res.ok
  } catch (e) { responseBody = e.message }

  await supabase.from('partner_webhooks_log').insert({
    partner_id: partnerId, event_type: eventType, payload, response_status: responseStatus, response_body: responseBody.slice(0, 1000), delivered, attempts: 1,
    ...(!delivered ? { next_retry_at: new Date(Date.now() + 3600000).toISOString() } : {}),
  })
}
