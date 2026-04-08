import { supabase } from '@/lib/supabase'

// Backend readiness: probe once, skip all calls if edge functions aren't deployed
let backendReady = null // null = unknown, true = ready, false = down
let probePromise = null

async function checkBackend() {
  if (backendReady !== null) return backendReady
  if (probePromise) return probePromise
  probePromise = (async () => {
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL || 'https://cosbviiihkxjdqcpksgv.supabase.co'}/functions/v1/growth-engine`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'health' }),
        signal: AbortSignal.timeout(4000),
      })
      // Any non-404 response means the function exists and is deployed
      backendReady = resp.status !== 404
    } catch {
      // Network error or timeout — assume backend is up, let circuit breaker handle per-function
      backendReady = true
    }
    return backendReady
  })()
  return probePromise
}

// Circuit breaker per function
const failureCount = {}
const CIRCUIT_BREAKER_THRESHOLD = 2

/**
 * Safe wrapper for supabase.functions.invoke.
 * NEVER throws. Always returns { data, error }.
 * Skips all calls if backend isn't deployed.
 * Circuit breaker: after 2 consecutive 404s per function, silently returns null.
 */
export async function safeInvoke(fnName, body) {
  // Backend probe: skip everything if edge functions aren't deployed
  const ready = await checkBackend()
  if (!ready) return { data: null, error: 'Backend not deployed' }

  // Circuit breaker per function
  if ((failureCount[fnName] || 0) >= CIRCUIT_BREAKER_THRESHOLD) {
    return { data: null, error: `${fnName} unavailable` }
  }

  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body })
    if (error) {
      const msg = error.message || String(error)
      if (msg.includes('404') || msg.includes('Failed to send') || msg.includes('non-2xx')) {
        failureCount[fnName] = (failureCount[fnName] || 0) + 1
      }
      return { data: null, error: msg }
    }
    if (data?.error) return { data: null, error: data.error }
    failureCount[fnName] = 0
    return { data, error: null }
  } catch (err) {
    failureCount[fnName] = (failureCount[fnName] || 0) + 1
    return { data: null, error: err?.message || 'Request failed' }
  }
}
