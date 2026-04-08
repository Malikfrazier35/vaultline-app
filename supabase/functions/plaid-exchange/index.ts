import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
const PLAID_BASE = PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, // Service role to bypass RLS for writes
    )

    // Verify auth with anon client
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: profile } = await anonClient.from('profiles').select('org_id, organizations(max_bank_connections)').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: corsHeaders })

    const orgId = profile.org_id

    // Check connection limit
    const { count } = await supabase.from('bank_connections').select('*', { count: 'exact', head: true }).eq('org_id', orgId)
    const maxConns = profile.organizations?.max_bank_connections || 3
    if ((count || 0) >= maxConns) {
      return new Response(JSON.stringify({ error: 'Connection limit reached. Upgrade your plan.' }), { status: 403, headers: corsHeaders })
    }

    const { public_token, institution } = await req.json()

    // Exchange public token for access token
    const exchangeRes = await fetch(`${PLAID_BASE}/item/public_token/exchange`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        public_token,
      }),
    })
    const exchangeData = await exchangeRes.json()
    if (!exchangeRes.ok) {
      return new Response(JSON.stringify({ error: 'Token exchange failed' }), { status: 500, headers: corsHeaders })
    }

    const { access_token, item_id } = exchangeData

    // Save bank connection
    const { data: bankConn, error: connErr } = await supabase.from('bank_connections').insert({
      org_id: orgId,
      plaid_item_id: item_id,
      plaid_access_token: access_token, // In production, encrypt this
      institution_id: institution?.institution_id,
      institution_name: institution?.name || 'Unknown Bank',
      institution_color: institution?.primary_color || '#1565C0',
      status: 'syncing',
      last_synced_at: new Date().toISOString(),
    }).select().single()

    if (connErr) {
      console.error('DB error:', connErr)
      return new Response(JSON.stringify({ error: 'Failed to save connection' }), { status: 500, headers: corsHeaders })
    }

    // Fetch accounts from Plaid
    const acctRes = await fetch(`${PLAID_BASE}/accounts/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET,
        access_token,
      }),
    })
    const acctData = await acctRes.json()

    if (acctRes.ok && acctData.accounts) {
      const accountRows = acctData.accounts.map((a: any) => ({
        org_id: orgId,
        bank_connection_id: bankConn.id,
        plaid_account_id: a.account_id,
        name: a.name,
        official_name: a.official_name,
        type: mapPlaidType(a.type),
        subtype: a.subtype,
        mask: a.mask,
        currency: 'USD',
        current_balance: a.balances.current || 0,
        available_balance: a.balances.available,
        credit_limit: a.balances.limit,
      }))

      await supabase.from('accounts').insert(accountRows)
    }

    // Mark connection as connected
    await supabase.from('bank_connections').update({ status: 'connected' }).eq('id', bankConn.id)

    // Log audit event
    await supabase.from('audit_log').insert({
      org_id: orgId,
      user_id: user.id,
      action: 'bank_connected',
      resource_type: 'bank_connection',
      resource_id: bankConn.id,
      details: { institution_name: institution?.name },
    })

    // Transition from sample data to real data
    await supabase.from('organizations').update({ has_real_data: true }).eq('id', orgId)

    return new Response(
      JSON.stringify({ success: true, connection_id: bankConn.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

function mapPlaidType(plaidType: string): string {
  const map: Record<string, string> = {
    depository: 'checking',
    credit: 'credit',
    loan: 'loan',
    investment: 'investment',
  }
  return map[plaidType] || 'other'
}
