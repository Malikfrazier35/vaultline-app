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

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase()

    switch (action) {
      case 'enrich': {
        // Fetch company info from multiple free sources
        let logoUrl = null
        let brandColor = null
        let companyName = null

        // 1. Try logo.clearbit.com (free, no API key needed)
        logoUrl = `https://logo.clearbit.com/${cleanDomain}`
        // Verify the logo exists
        try {
          const logoCheck = await fetch(logoUrl, { method: 'HEAD' })
          if (!logoCheck.ok) logoUrl = null
        } catch { logoUrl = null }

        // 2. Fallback: Google favicon
        if (!logoUrl) {
          logoUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`
        }

        // 3. Try to extract brand color from the website
        try {
          const siteRes = await fetch(`https://${cleanDomain}`, {
            headers: { 'User-Agent': 'Vaultline Brand Enrichment Bot' },
            redirect: 'follow',
          })
          if (siteRes.ok) {
            const html = await siteRes.text()

            // Extract title for company name
            const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
            if (titleMatch) {
              companyName = titleMatch[1].split(/[|\-–—]/)[0].trim()
            }

            // Extract theme-color meta tag
            const themeMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
            if (themeMatch) {
              brandColor = themeMatch[1]
            }

            // Fallback: extract most common hex color from inline styles
            if (!brandColor) {
              const hexColors = html.match(/#[0-9a-fA-F]{6}/g) || []
              // Filter out common neutral colors
              const meaningfulColors = hexColors.filter(c =>
                !['#000000', '#ffffff', '#FFFFFF', '#333333', '#666666', '#999999', '#f5f5f5', '#F5F5F5', '#eeeeee', '#e0e0e0'].includes(c)
              )
              if (meaningfulColors.length) {
                // Count frequency
                const freq: Record<string, number> = {}
                for (const c of meaningfulColors) { freq[c.toLowerCase()] = (freq[c.toLowerCase()] || 0) + 1 }
                const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1])
                if (sorted.length) brandColor = sorted[0][0]
              }
            }
          }
        } catch (e) {
          console.error('Failed to fetch site:', e.message)
        }

        // Default brand color if none found
        if (!brandColor) brandColor = '#22D3EE'

        // Update organization
        await supabase.from('organizations').update({
          domain: cleanDomain,
          brand_logo_url: logoUrl,
          brand_color: brandColor,
          brand_enriched_at: new Date().toISOString(),
        }).eq('id', org_id)

        // Log
        await supabase.from('audit_log').insert({
          org_id, user_id: user.id,
          action: 'brand_enriched',
          resource_type: 'organization',
          details: { domain: cleanDomain, logo: !!logoUrl, color: brandColor },
        }).catch(() => {})

        return new Response(JSON.stringify({
          success: true,
          domain: cleanDomain,
          logo_url: logoUrl,
          brand_color: brandColor,
          company_name: companyName,
        }), { headers: cors })
      }

      case 'verify_domain': {
        // Simple domain verification — check if a TXT record or meta tag exists
        // For now, just mark as "verification pending"
        try {
          const siteRes = await fetch(`https://${cleanDomain}`, {
            headers: { 'User-Agent': 'Vaultline Domain Verification' },
            redirect: 'follow',
          })
          if (siteRes.ok) {
            const html = await siteRes.text()
            const hasVerificationTag = html.includes(`vaultline-verify=${org_id}`)
            if (hasVerificationTag) {
              await supabase.from('organizations').update({ domain_verified: true }).eq('id', org_id)
              return new Response(JSON.stringify({ verified: true }), { headers: cors })
            }
          }
        } catch {}
        return new Response(JSON.stringify({
          verified: false,
          instruction: `Add this meta tag to your website's <head>: <meta name="vaultline-verify" content="${org_id}" />`,
        }), { headers: cors })
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors })
    }
  } catch (err) {
    console.error('Brand enrich error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
