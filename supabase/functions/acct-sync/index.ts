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
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })

    const { provider } = await req.json()
    const { data: conn } = await supabase.from('accounting_connections').select('*').eq('org_id', profile.org_id).eq('provider', provider).single()
    if (!conn) return new Response(JSON.stringify({ error: `No ${provider} connection found` }), { status: 400, headers: cors })

    // Token refresh logic (provider-specific)
    let token = conn.access_token
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      // Refresh token based on provider
      const clientId = Deno.env.get(`${provider.toUpperCase()}_CLIENT_ID`) || ''
      const clientSecret = Deno.env.get(`${provider.toUpperCase()}_CLIENT_SECRET`) || ''
      if (!clientId || !clientSecret) throw new Error(`${provider} credentials not configured`)

      const tokenUrl = provider === 'xero'
        ? 'https://identity.xero.com/connect/token'
        : provider === 'sage'
        ? 'https://oauth.accounting.sage.com/token'
        : ''

      if (tokenUrl) {
        const res = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}` },
          body: `grant_type=refresh_token&refresh_token=${conn.refresh_token}`,
        })
        const tokens = await res.json()
        if (tokens.error) throw new Error(tokens.error_description || tokens.error)
        token = tokens.access_token
        await supabase.from('accounting_connections').update({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token || conn.refresh_token,
          token_expires_at: new Date(Date.now() + (tokens.expires_in || 1800) * 1000).toISOString(),
          status: 'connected',
        }).eq('id', conn.id)
      }
    }

    // Provider-specific API calls
    let accounts = 0, transactions = 0
    if (provider === 'xero') {
      const tenantId = conn.tenant_id
      const headers = { Authorization: `Bearer ${token}`, 'Xero-tenant-id': tenantId, Accept: 'application/json' }
      const acctRes = await fetch('https://api.xero.com/api.xro/2.0/Accounts', { headers })
      const acctData = await acctRes.json()
      accounts = acctData?.Accounts?.length || 0

      const since = new Date(Date.now() - 90 * 86400000).toISOString()
      const txRes = await fetch(`https://api.xero.com/api.xro/2.0/BankTransactions?where=Date>DateTime(${since})`, { headers })
      const txData = await txRes.json()
      transactions = txData?.BankTransactions?.length || 0
    }

    await supabase.from('accounting_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)

    return new Response(JSON.stringify({ success: true, provider, accounts, transactions, company: conn.company_name }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
