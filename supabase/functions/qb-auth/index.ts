import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const QB_CLIENT_ID = Deno.env.get('INTUIT_CLIENT_ID') || ''
const QB_CLIENT_SECRET = Deno.env.get('INTUIT_CLIENT_SECRET') || ''
const QB_REDIRECT_URI = Deno.env.get('INTUIT_REDIRECT_URI') || 'https://www.vaultline.app/import?qb_callback=true'

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

    if (!QB_CLIENT_ID) {
      return new Response(JSON.stringify({ error: 'QuickBooks integration not configured. Intuit production keys required.' }), { status: 503, headers: cors })
    }

    const state = btoa(JSON.stringify({ org_id: profile.org_id, user_id: user.id }))
    const scopes = 'com.intuit.quickbooks.accounting com.intuit.quickbooks.payment'
    const authUrl = `https://appcenter.intuit.com/connect/oauth2?client_id=${QB_CLIENT_ID}&redirect_uri=${encodeURIComponent(QB_REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(scopes)}&state=${state}`

    return new Response(JSON.stringify({ url: authUrl }), { headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
