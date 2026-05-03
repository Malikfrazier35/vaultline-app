import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

/**
 * GENERATE-REPORT
 * 
 * Orchestrates PDF generation:
 *   1. Validates the request (auth + plan tier)
 *   2. Inserts a `reports` row with status='generating'
 *   3. Calls Browserless API → loads /print/cash-memo/:orgId/:date in headless Chrome → returns PDF
 *   4. Uploads PDF to Supabase Storage 'reports' bucket
 *   5. Updates the row with pdf_url + status='completed'
 * 
 * Errors are caught and stored in `reports.error_message`. Status flips to 'failed'.
 * 
 * Required env vars:
 *   - BROWSERLESS_TOKEN — from browserless.io
 *   - APP_URL — public URL of the React app (e.g. https://vaultline.app)
 *   - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-populated)
 */

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const BROWSERLESS_TOKEN = Deno.env.get('BROWSERLESS_TOKEN')
const APP_URL = Deno.env.get('APP_URL') || 'https://vaultline.app'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  
  try {
    // ── AUTH ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Auth required' }, 401)
    
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await anonClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Invalid auth' }, 401)
    
    // ── PARSE ──
    const { org_id, report_type, period_start, period_end, recipients } = await req.json()
    if (!org_id || !report_type) return json({ error: 'org_id and report_type required' }, 400)
    
    // ── VERIFY USER BELONGS TO ORG ──
    const { data: profile } = await supabase
      .from('profiles')
      .select('org_id, role, organizations(plan, plan_status)')
      .eq('id', user.id)
      .maybeSingle()
    
    if (!profile || profile.org_id !== org_id) {
      return json({ error: 'Not authorized for this org' }, 403)
    }
    
    // ── PLAN GATE ──
    // Reports require Growth or higher
    const plan = profile.organizations?.plan
    const planStatus = profile.organizations?.plan_status
    if (planStatus !== 'active' && planStatus !== 'trialing') {
      return json({ error: 'Active subscription required to generate reports' }, 402)
    }
    if (plan === 'starter') {
      return json({ error: 'Reports are available on Growth plan and higher. Upgrade to access.' }, 402)
    }
    
    // ── INSERT REPORT ROW ──
    const reportDate = period_start || new Date().toISOString().slice(0, 10)
    
    const { data: report, error: insertErr } = await supabase
      .from('reports')
      .insert({
        org_id,
        generated_by: user.id,
        report_type,
        period_start: reportDate,
        period_end: period_end || reportDate,
        status: 'generating',
        recipients: recipients || [],
      })
      .select('id')
      .single()
    
    if (insertErr) throw new Error(`DB insert failed: ${insertErr.message}`)
    
    // ── KICK OFF GENERATION (await but don't block too long) ──
    // We do this synchronously so the user gets feedback. For very long reports
    // we'd push to a queue. Daily memo is 5-8s which is acceptable inline.
    generatePdfAsync(report.id, org_id, report_type, reportDate)
      .catch(async (err) => {
        console.error(`Report ${report.id} generation failed:`, err)
        await supabase
          .from('reports')
          .update({ status: 'failed', error_message: err.message })
          .eq('id', report.id)
      })
    
    return json({ 
      report_id: report.id, 
      status: 'generating',
      message: 'Report queued. Status will update via realtime subscription.' 
    })
    
  } catch (err: any) {
    console.error('generate-report error:', err)
    return json({ error: err.message }, 500)
  }
})

async function generatePdfAsync(
  reportId: string, 
  orgId: string, 
  reportType: string, 
  reportDate: string
) {
  const startedAt = Date.now()
  
  try {
    if (!BROWSERLESS_TOKEN) {
      throw new Error('BROWSERLESS_TOKEN not configured. See setup docs.')
    }
    
    // ── BUILD PRINT URL ──
    // The React app must support a /print/* route family that renders 
    // the report layout without nav/sidebar. CashMemoTemplate.jsx handles this.
    const templateMap: Record<string, string> = {
      daily_cash_position: `${APP_URL}/print/cash-memo/${orgId}/${reportDate}`,
      weekly_cash_flash: `${APP_URL}/print/cash-flash/${orgId}/${reportDate}`,
      monthly_board_package: `${APP_URL}/print/board-package/${orgId}/${reportDate}`,
    }
    const printUrl = templateMap[reportType]
    if (!printUrl) throw new Error(`Unknown report_type: ${reportType}`)
    
    // ── INVOKE BROWSERLESS ──
    // POST to /pdf with options:
    //  - waitForFunction: ensures data has loaded before snapshot
    //  - displayHeaderFooter for page numbers (handled in print.css @page rules)
    //  - format: 'Letter', margins handled by template's own CSS
    const browserlessUrl = `https://chrome.browserless.io/pdf?token=${BROWSERLESS_TOKEN}`
    
    const browserlessRes = await fetch(browserlessUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: printUrl,
        options: {
          format: 'Letter',
          printBackground: true,
          preferCSSPageSize: true,
          margin: { top: '0.6in', right: '0.55in', bottom: '0.7in', left: '0.55in' },
        },
        gotoOptions: {
          waitUntil: 'networkidle0',  // wait for all data fetches to complete
          timeout: 30000,
        },
        // Wait for the cover-title element so we know data has loaded
        waitForSelector: { selector: '.cover-title', timeout: 20000 },
      }),
    })
    
    if (!browserlessRes.ok) {
      const errText = await browserlessRes.text()
      throw new Error(`Browserless ${browserlessRes.status}: ${errText.slice(0, 200)}`)
    }
    
    const pdfBytes = new Uint8Array(await browserlessRes.arrayBuffer())
    if (pdfBytes.length < 1000) {
      throw new Error('Generated PDF suspiciously small — template likely failed to render')
    }
    
    // ── UPLOAD TO SUPABASE STORAGE ──
    // Path: <orgId>/<reportType>/<date>-<reportId>.pdf
    // RLS already restricts reads to org members
    const path = `${orgId}/${reportType}/${reportDate}-${reportId}.pdf`
    const { error: uploadErr } = await supabase.storage
      .from('reports')
      .upload(path, pdfBytes, { 
        contentType: 'application/pdf',
        upsert: true,
      })
    
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)
    
    // ── UPDATE REPORT ROW ──
    const duration = Date.now() - startedAt
    
    await supabase
      .from('reports')
      .update({
        status: 'completed',
        pdf_url: path,
        pdf_size_bytes: pdfBytes.length,
        generation_duration_ms: duration,
        completed_at: new Date().toISOString(),
      })
      .eq('id', reportId)
    
    console.log(`Report ${reportId} generated in ${duration}ms (${pdfBytes.length} bytes)`)
    
  } catch (err: any) {
    const duration = Date.now() - startedAt
    await supabase
      .from('reports')
      .update({
        status: 'failed',
        error_message: err.message,
        generation_duration_ms: duration,
      })
      .eq('id', reportId)
    throw err
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), { headers: cors, status })
}
