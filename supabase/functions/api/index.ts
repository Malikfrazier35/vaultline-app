import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Content-Type': 'application/json',
}

// ── SHA-256 hash ──
async function sha256(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Auth: validate API key ──
async function authenticate(req: Request): Promise<{ orgId: string; keyId: string; rateLimit: number; scopes: string[] } | null> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer vl_')) return null

  const token = authHeader.replace('Bearer ', '')
  const hash = await sha256(token)

  const { data: key } = await supabase
    .from('api_keys')
    .select('id, org_id, scopes, rate_limit_per_min, revoked_at, expires_at')
    .eq('key_hash', hash)
    .is('revoked_at', null)
    .single()

  if (!key) return null
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null

  // Update last_used_at
  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id)

  return { orgId: key.org_id, keyId: key.id, rateLimit: key.rate_limit_per_min, scopes: key.scopes || [] }
}

// ── Rate limit check ──
async function checkRateLimit(orgId: string, keyId: string, limit: number): Promise<boolean> {
  const oneMinAgo = new Date(Date.now() - 60000).toISOString()
  const { count } = await supabase
    .from('api_usage')
    .select('id', { count: 'exact', head: true })
    .eq('key_id', keyId)
    .gte('created_at', oneMinAgo)

  return (count || 0) < limit
}

// ── Log usage ──
async function logUsage(orgId: string, keyId: string, endpoint: string, method: string, statusCode: number, latencyMs: number, ip: string | null) {
  await supabase.from('api_usage').insert({
    org_id: orgId, key_id: keyId, endpoint, method,
    status_code: statusCode, latency_ms: latencyMs,
    request_ip: ip,
  }).catch(() => {})
}

// ── Scope check ──
function hasScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes('*')
}

// ── Response helpers ──
const json = (data: any, status = 200) => new Response(JSON.stringify(data), { status, headers: cors })
const err = (message: string, status: number) => new Response(JSON.stringify({ error: message }), { status, headers: cors })

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const start = Date.now()
  const url = new URL(req.url)
  // Parse path: /api/v1/accounts → /v1/accounts
  const fullPath = url.pathname
  const pathMatch = fullPath.match(/\/api(.*)/) || fullPath.match(/\/v1(.*)/)
  const path = pathMatch ? (pathMatch[0].startsWith('/api') ? pathMatch[1] : pathMatch[0]) : fullPath
  const method = req.method
  const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || null

  // ── AUTH ──
  const auth = await authenticate(req)
  if (!auth) {
    return err('Invalid or missing API key. Include: Authorization: Bearer vl_live_...', 401)
  }

  // ── RATE LIMIT ──
  const allowed = await checkRateLimit(auth.orgId, auth.keyId, auth.rateLimit)
  if (!allowed) {
    await logUsage(auth.orgId, auth.keyId, path, method, 429, Date.now() - start, ip)
    return err(`Rate limit exceeded (${auth.rateLimit}/min). Upgrade for higher limits.`, 429)
  }

  let status = 200
  let body: any = { error: 'Not found' }

  try {
    // ═══════════════════════════════════════
    // ROUTE DISPATCHER
    // ═══════════════════════════════════════

    // GET /v1/accounts
    if (path === '/v1/accounts' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:accounts')) return err('Insufficient scope: read:accounts required', 403)
      const { data } = await supabase.from('bank_accounts')
        .select('id, account_name, institution_name, account_type, mask, current_balance, available_balance, currency, last_synced_at')
        .eq('org_id', auth.orgId)
        .order('institution_name')
      body = { accounts: data || [], count: data?.length || 0 }
    }

    // GET /v1/transactions
    else if (path === '/v1/transactions' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:transactions')) return err('Insufficient scope: read:transactions required', 403)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
      const offset = parseInt(url.searchParams.get('offset') || '0')
      const accountId = url.searchParams.get('account_id')
      const from = url.searchParams.get('from')
      const to = url.searchParams.get('to')
      const category = url.searchParams.get('category')

      let q = supabase.from('transactions')
        .select('id, date, name, amount, category, account_id, pending, merchant_name')
        .eq('org_id', auth.orgId)
        .order('date', { ascending: false })
        .range(offset, offset + limit - 1)

      if (accountId) q = q.eq('account_id', accountId)
      if (from) q = q.gte('date', from)
      if (to) q = q.lte('date', to)
      if (category) q = q.eq('category', category)

      const { data, count } = await q
      body = { transactions: data || [], count: data?.length || 0, limit, offset }
    }

    // GET /v1/cash-position
    else if (path === '/v1/cash-position' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:accounts')) return err('Insufficient scope: read:accounts required', 403)
      const { data: accounts } = await supabase.from('bank_accounts')
        .select('current_balance, available_balance, currency, account_type')
        .eq('org_id', auth.orgId)

      const totalBalance = (accounts || []).reduce((sum: number, a: any) => sum + (a.current_balance || 0), 0)
      const totalAvailable = (accounts || []).reduce((sum: number, a: any) => sum + (a.available_balance || 0), 0)
      const byType: Record<string, number> = {}
      for (const a of accounts || []) {
        byType[a.account_type || 'other'] = (byType[a.account_type || 'other'] || 0) + (a.current_balance || 0)
      }
      body = {
        total_balance: totalBalance,
        total_available: totalAvailable,
        account_count: accounts?.length || 0,
        currency: 'USD',
        by_type: byType,
        as_of: new Date().toISOString(),
      }
    }

    // GET /v1/forecast
    else if (path === '/v1/forecast' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:forecast')) return err('Insufficient scope: read:forecast required', 403)
      const { data } = await supabase.from('forecast_snapshots')
        .select('id, model, forecast_json, mape, recommended, created_at')
        .eq('org_id', auth.orgId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        body = {
          model: data.model,
          mape: data.mape,
          recommended: data.recommended,
          forecast: data.forecast_json,
          generated_at: data.created_at,
        }
      } else {
        body = { forecast: null, message: 'No forecast generated yet. Ensure bank accounts are connected.' }
      }
    }

    // GET /v1/balances/daily
    else if (path === '/v1/balances/daily' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:accounts')) return err('Insufficient scope: read:accounts required', 403)
      const days = Math.min(parseInt(url.searchParams.get('days') || '30'), 365)
      const cutoff = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

      const { data } = await supabase.from('daily_balances')
        .select('date, total_balance, account_count')
        .eq('org_id', auth.orgId)
        .gte('date', cutoff)
        .order('date')

      body = { balances: data || [], days, from: cutoff }
    }

    // GET /v1/entities
    else if (path === '/v1/entities' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:accounts')) return err('Insufficient scope: read:accounts required', 403)
      const { data } = await supabase.from('entities')
        .select('id, name, entity_type, currency, country')
        .eq('org_id', auth.orgId)
        .order('name')

      body = { entities: data || [], count: data?.length || 0 }
    }

    // GET /v1/fx/rates
    else if (path === '/v1/fx/rates' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:accounts')) return err('Insufficient scope: read:accounts required', 403)
      const { data } = await supabase.from('fx_rates')
        .select('base_currency, quote_currency, rate, updated_at')
        .order('updated_at', { ascending: false })
        .limit(20)

      body = { rates: data || [] }
    }

    // GET /v1/audit
    else if (path === '/v1/audit' && method === 'GET') {
      if (!hasScope(auth.scopes, 'read:audit')) return err('Insufficient scope: read:audit required', 403)
      const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 200)
      const { data } = await supabase.from('audit_log')
        .select('id, action, resource_type, resource_id, details, created_at')
        .eq('org_id', auth.orgId)
        .order('created_at', { ascending: false })
        .limit(limit)

      body = { events: data || [], count: data?.length || 0 }
    }

    // POST /v1/transactions
    else if (path === '/v1/transactions' && method === 'POST') {
      if (!hasScope(auth.scopes, 'write:transactions')) return err('Insufficient scope: write:transactions required', 403)
      const { account_id, name, amount, date, category } = await req.json()
      if (!account_id || !name || amount === undefined) return err('account_id, name, and amount are required', 400)

      const { data, error: insertErr } = await supabase.from('transactions').insert({
        org_id: auth.orgId, account_id, name, amount,
        date: date || new Date().toISOString().split('T')[0],
        category: category || 'uncategorized',
        source: 'api',
      }).select().single()

      if (insertErr) { status = 400; body = { error: insertErr.message } }
      else body = { transaction: data }
    }

    // POST /v1/webhooks
    else if (path === '/v1/webhooks' && method === 'POST') {
      if (!hasScope(auth.scopes, 'write:webhooks')) return err('Insufficient scope: write:webhooks required', 403)
      const { url: hookUrl, events } = await req.json()
      if (!hookUrl) return err('url is required', 400)

      const { data, error: insertErr } = await supabase.from('webhook_endpoints').insert({
        org_id: auth.orgId, url: hookUrl,
        events: events || ['balance.updated', 'transaction.created'],
        status: 'active',
      }).select().single()

      if (insertErr) { status = 400; body = { error: insertErr.message } }
      else body = { webhook: data }
    }

    // DELETE /v1/webhooks/:id
    else if (path.startsWith('/v1/webhooks/') && method === 'DELETE') {
      if (!hasScope(auth.scopes, 'write:webhooks')) return err('Insufficient scope: write:webhooks required', 403)
      const webhookId = path.split('/').pop()
      await supabase.from('webhook_endpoints')
        .update({ status: 'deleted' })
        .eq('id', webhookId)
        .eq('org_id', auth.orgId)
      body = { deleted: true }
    }

    // Unknown endpoint
    else {
      status = 404
      body = { error: `Unknown endpoint: ${method} ${path}`, docs: 'https://vaultline.app/docs' }
    }

  } catch (e) {
    status = 500
    body = { error: 'Internal server error' }
    console.error('API error:', e)
  }

  const latency = Date.now() - start
  await logUsage(auth.orgId, auth.keyId, path, method, status, latency, ip)

  return new Response(JSON.stringify({
    ...body,
    _meta: { latency_ms: latency, api_version: 'v1' },
  }), {
    status,
    headers: { ...cors, 'X-Request-Id': crypto.randomUUID(), 'X-Ratelimit-Limit': String(auth.rateLimit) },
  })
})
