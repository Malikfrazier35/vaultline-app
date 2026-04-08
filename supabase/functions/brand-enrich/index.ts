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

    const body = await req.json()
    const { action, domain, org_id } = body

    if (!domain) return new Response(JSON.stringify({ error: 'Domain required' }), { status: 400, headers: cors })
    if (!org_id) return new Response(JSON.stringify({ error: 'org_id required' }), { status: 400, headers: cors })

    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '').trim().toLowerCase()

    if (action === 'enrich') {
      let logoUrl = `https://logo.clearbit.com/${cleanDomain}`
      let brandColor = '#22D3EE'
      let companyName = cleanDomain.split('.')[0]
      companyName = companyName.charAt(0).toUpperCase() + companyName.slice(1)

      // Check if Clearbit has the logo (with timeout)
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const logoCheck = await fetch(logoUrl, { method: 'HEAD', signal: controller.signal })
        clearTimeout(timeout)
        if (!logoCheck.ok) {
          logoUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`
        }
      } catch {
        logoUrl = `https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=128`
      }

      // Try to extract brand color from website (with 5s timeout, non-blocking)
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const siteRes = await fetch(`https://${cleanDomain}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VaultlineBot/1.0)' },
          redirect: 'follow',
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (siteRes.ok) {
          // Only read first 50KB to avoid massive pages
          const reader = siteRes.body?.getReader()
          let html = ''
          if (reader) {
            let bytesRead = 0
            while (bytesRead < 50000) {
              const { done, value } = await reader.read()
              if (done) break
              html += new TextDecoder().decode(value)
              bytesRead += value.length
            }
            reader.cancel()
          }

          // Extract title
          const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
          if (titleMatch) {
            const rawTitle = titleMatch[1].split(/[|\-–—]/)[0].trim()
            if (rawTitle.length > 1 && rawTitle.length < 60) companyName = rawTitle
          }

          // Extract theme-color
          const themeMatch = html.match(/<meta[^>]*name=["']theme-color["'][^>]*content=["']([^"']+)["']/i)
          if (themeMatch && /^#[0-9a-fA-F]{3,6}$/.test(themeMatch[1])) {
            brandColor = themeMatch[1]
          }

          // Fallback: most frequent hex color (skip neutrals)
          if (brandColor === '#22D3EE') {
            const hexes = html.match(/#[0-9a-fA-F]{6}/g) || []
            const skip = new Set(['#000000','#ffffff','#333333','#666666','#999999','#f5f5f5','#eeeeee','#e0e0e0','#cccccc','#fafafa','#f0f0f0'])
            const meaningful = hexes.filter(c => !skip.has(c.toLowerCase()))
            if (meaningful.length) {
              const freq: Record<string, number> = {}
              for (const c of meaningful) freq[c.toLowerCase()] = (freq[c.toLowerCase()] || 0) + 1
              const top = Object.entries(freq).sort((a, b) => b[1] - a[1])
              if (top.length) brandColor = top[0][0]
            }
          }
        }
      } catch (e) {
        console.log(`Site scrape skipped for ${cleanDomain}: ${e.message}`)
        // Non-blocking — we still save the domain and logo
      }

      // Save to database — this is the critical part, must not fail
      const { error: updateErr } = await supabase.from('organizations').update({
        domain: cleanDomain,
        brand_logo_url: logoUrl,
        brand_color: brandColor,
        brand_enriched_at: new Date().toISOString(),
      }).eq('id', org_id)

      if (updateErr) {
        console.error('DB update error:', updateErr)
        return new Response(JSON.stringify({ error: `Database update failed: ${updateErr.message}` }), { status: 500, headers: cors })
      }

      // Audit log (non-blocking)
      supabase.from('audit_log').insert({
        org_id, user_id: user.id,
        action: 'brand_enriched',
        resource_type: 'organization',
        details: { domain: cleanDomain, logo: logoUrl, color: brandColor, company: companyName },
      }).catch(() => {})

      return new Response(JSON.stringify({
        success: true,
        domain: cleanDomain,
        logo_url: logoUrl,
        brand_color: brandColor,
        company_name: companyName,
      }), { headers: cors })
    }

    if (action === 'verify_domain') {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        const siteRes = await fetch(`https://${cleanDomain}`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VaultlineBot/1.0)' },
          signal: controller.signal,
        })
        clearTimeout(timeout)
        if (siteRes.ok) {
          const html = await siteRes.text()
          if (html.includes(`vaultline-verify=${org_id}`)) {
            await supabase.from('organizations').update({ domain_verified: true }).eq('id', org_id)
            return new Response(JSON.stringify({ verified: true }), { headers: cors })
          }
        }
      } catch {}
      return new Response(JSON.stringify({
        verified: false,
        instruction: `Add <meta name="vaultline-verify" content="${org_id}" /> to your site's <head>`,
      }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors })
  } catch (err) {
    console.error('Brand enrich error:', err)
    return new Response(JSON.stringify({ error: err.message || 'Unknown error' }), { status: 500, headers: cors })
  }
})
