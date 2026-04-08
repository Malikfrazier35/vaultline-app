import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
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

    const { action, domain, org_id } = await req.json()
    if (!domain) return new Response(JSON.stringify({ error: 'Domain required' }), { status: 400, headers: cors })
    if (!org_id) return new Response(JSON.stringify({ error: 'org_id required' }), { status: 400, headers: cors })

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase()

    if (action === 'enrich') {
      const logoUrl = `https://logo.clearbit.com/${cleanDomain}`
      const companyName = cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1)

      const { error: updateErr } = await supabase.from('organizations').update({
        domain: cleanDomain,
        brand_logo_url: logoUrl,
        brand_color: '#0060F0',
        brand_enriched_at: new Date().toISOString(),
      }).eq('id', org_id)

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), { status: 500, headers: cors })
      }

      return new Response(JSON.stringify({
        success: true,
        domain: cleanDomain,
        logo_url: logoUrl,
        brand_color: '#0060F0',
        company_name: companyName,
      }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: cors })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: cors })
  }
})
