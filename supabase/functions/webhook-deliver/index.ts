import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

const MAX_RETRIES = 3
const RETRY_DELAYS = [60, 300, 900] // 1min, 5min, 15min

async function hmacSign(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
}

async function deliverWebhook(endpoint: any, eventType: string, payload: any): Promise<{ success: boolean; statusCode?: number; body?: string; latency: number }> {
  const start = Date.now()
  const payloadStr = JSON.stringify(payload)
  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await hmacSign(endpoint.secret, `${timestamp}.${payloadStr}`)

  try {
    const resp = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Vaultline-Event': eventType,
        'X-Vaultline-Signature': `v1=${signature}`,
        'X-Vaultline-Timestamp': String(timestamp),
        'X-Vaultline-Delivery': crypto.randomUUID(),
        'User-Agent': 'Vaultline-Webhooks/1.0',
      },
      body: payloadStr,
      signal: AbortSignal.timeout(10000),
    })

    const body = await resp.text().catch(() => '')
    return { success: resp.ok, statusCode: resp.status, body: body.slice(0, 500), latency: Date.now() - start }
  } catch (err) {
    return { success: false, statusCode: 0, body: err.message, latency: Date.now() - start }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const { action, ...body } = await req.json()

    // ═══ DISPATCH: fire event to all matching endpoints ═══
    if (action === 'dispatch') {
      const { org_id, event_type, data } = body
      if (!org_id || !event_type || !data) {
        return new Response(JSON.stringify({ error: 'org_id, event_type, and data required' }), { status: 400, headers: cors })
      }

      const { data: endpoints } = await supabase
        .from('webhook_endpoints')
        .select('*')
        .eq('org_id', org_id)
        .eq('status', 'active')
        .contains('events', [event_type])

      if (!endpoints?.length) {
        return new Response(JSON.stringify({ dispatched: 0, message: 'No matching endpoints' }), { headers: cors })
      }

      const payload = {
        id: `evt_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`,
        type: event_type,
        created: Math.floor(Date.now() / 1000),
        data,
        api_version: 'v1',
      }

      const results = []
      for (const ep of endpoints) {
        const result = await deliverWebhook(ep, event_type, payload)

        await supabase.from('webhook_deliveries').insert({
          org_id, endpoint_id: ep.id, event_type,
          payload, response_status: result.statusCode,
          response_body: result.body, latency_ms: result.latency,
          attempt: 1, status: result.success ? 'success' : 'retrying',
          next_retry_at: result.success ? null : new Date(Date.now() + RETRY_DELAYS[0] * 1000).toISOString(),
        })

        if (result.success) {
          await supabase.from('webhook_endpoints').update({
            last_success_at: new Date().toISOString(), failure_count: 0,
          }).eq('id', ep.id)
        } else {
          await supabase.from('webhook_endpoints').update({
            last_failure_at: new Date().toISOString(),
            failure_count: ep.failure_count + 1,
            status: ep.failure_count >= 9 ? 'paused' : 'active',
          }).eq('id', ep.id)
        }

        results.push({ endpoint_id: ep.id, url: ep.url, success: result.success, status: result.statusCode })
      }

      return new Response(JSON.stringify({ dispatched: results.length, results }), { headers: cors })
    }

    // ═══ RETRY: retry failed deliveries ═══
    if (action === 'retry') {
      const { data: pending } = await supabase
        .from('webhook_deliveries')
        .select('*, webhook_endpoints(*)')
        .eq('status', 'retrying')
        .lte('next_retry_at', new Date().toISOString())
        .lt('attempt', MAX_RETRIES + 1)
        .limit(50)

      let retried = 0
      for (const delivery of pending || []) {
        const ep = delivery.webhook_endpoints
        if (!ep || ep.status !== 'active') continue

        const result = await deliverWebhook(ep, delivery.event_type, delivery.payload)
        const nextAttempt = delivery.attempt + 1

        await supabase.from('webhook_deliveries').update({
          response_status: result.statusCode,
          response_body: result.body,
          latency_ms: result.latency,
          attempt: nextAttempt,
          status: result.success ? 'success' : (nextAttempt >= MAX_RETRIES ? 'failed' : 'retrying'),
          next_retry_at: result.success || nextAttempt >= MAX_RETRIES
            ? null
            : new Date(Date.now() + (RETRY_DELAYS[nextAttempt - 1] || 900) * 1000).toISOString(),
        }).eq('id', delivery.id)

        if (result.success) {
          await supabase.from('webhook_endpoints').update({ last_success_at: new Date().toISOString(), failure_count: 0 }).eq('id', ep.id)
        }

        retried++
      }

      return new Response(JSON.stringify({ retried }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: cors })
  } catch (err) {
    console.error('Webhook delivery error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
