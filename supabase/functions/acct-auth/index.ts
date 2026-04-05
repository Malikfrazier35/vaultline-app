import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

const PROVIDERS: Record<string, { clientId: string, authUrl: string, scopes: string, redirectUri: string }> = {
  xero: {
    clientId: Deno.env.get('XERO_CLIENT_ID') || '',
    authUrl: 'https://login.xero.com/identity/connect/authorize',
    scopes: 'openid profile email accounting.transactions accounting.settings offline_access',
    redirectUri: Deno.env.get('XERO_REDIRECT_URI') || 'https://www.vaultline.app/import?acct_callback=xero',
  },
  sage: {
    clientId: Deno.env.get('SAGE_CLIENT_ID') || '',
    authUrl: 'https://www.sageone.com/oauth2/auth/central',
    scopes: 'full_access',
    redirectUri: Deno.env.get('SAGE_REDIRECT_URI') || 'https://www.vaultline.app/import?acct_callback=sage',
  },
  netsuite: {
    clientId: Deno.env.get('NETSUITE_CLIENT_ID') || '',
    authUrl: '', // NetSuite uses token-based auth, not OAuth redirect
    scopes: '',
    redirectUri: '',
  },
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })

    const { provider } = await req.json()
    const config = PROVIDERS[provider]
    if (!config) return new Response(JSON.stringify({ error: `Unknown provider: ${provider}` }), { status: 400, headers: cors })
    if (!config.clientId) return new Response(JSON.stringify({ error: `${provider} integration not configured. Production keys required.` }), { status: 503, headers: cors })

    const state = btoa(JSON.stringify({ org_id: profile.org_id, user_id: user.id, provider }))
    const url = `${config.authUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&scope=${encodeURIComponent(config.scopes)}&state=${state}`

    return new Response(JSON.stringify({ url }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
