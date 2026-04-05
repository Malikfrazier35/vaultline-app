import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const QB_CLIENT_ID = Deno.env.get('INTUIT_CLIENT_ID') || ''
const QB_CLIENT_SECRET = Deno.env.get('INTUIT_CLIENT_SECRET') || ''
const QB_BASE = 'https://quickbooks.api.intuit.com/v3/company'

async function refreshQbToken(supabase: any, conn: any) {
  if (!QB_CLIENT_ID || !QB_CLIENT_SECRET) throw new Error('QuickBooks not configured')
  const res = await fetch('https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Authorization: `Basic ${btoa(`${QB_CLIENT_ID}:${QB_CLIENT_SECRET}`)}` },
    body: `grant_type=refresh_token&refresh_token=${conn.refresh_token}`,
  })
  const tokens = await res.json()
  if (tokens.error) throw new Error(tokens.error_description || tokens.error)
  await supabase.from('qb_connections').update({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    status: 'connected',
  }).eq('id', conn.id)
  return tokens.access_token
}

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

    const { data: conn } = await supabase.from('qb_connections').select('*').eq('org_id', profile.org_id).single()
    if (!conn) return new Response(JSON.stringify({ error: 'No QuickBooks connection' }), { status: 400, headers: cors })

    // Refresh token if expired
    let token = conn.access_token
    if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date()) {
      token = await refreshQbToken(supabase, conn)
    }

    const qbFetch = async (query: string) => {
      const res = await fetch(`${QB_BASE}/${conn.realm_id}/query?query=${encodeURIComponent(query)}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      })
      if (!res.ok) throw new Error(`QB API ${res.status}: ${await res.text()}`)
      return res.json()
    }

    // Sync accounts
    const acctData = await qbFetch("SELECT * FROM Account WHERE Active = true MAXRESULTS 100")
    const qbAccounts = acctData?.QueryResponse?.Account || []

    // Sync recent transactions (last 90 days)
    const since = new Date(Date.now() - 90 * 86400000).toISOString().split('T')[0]
    const txData = await qbFetch(`SELECT * FROM Purchase WHERE TxnDate >= '${since}' MAXRESULTS 500`)
    const qbTransactions = txData?.QueryResponse?.Purchase || []

    // Update last synced
    await supabase.from('qb_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)

    return new Response(JSON.stringify({
      success: true,
      accounts: qbAccounts.length,
      transactions: qbTransactions.length,
      company: conn.company_name,
    }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
