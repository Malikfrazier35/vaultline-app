import { supabase } from '@/lib/supabase'

// Backend readiness: probe once, skip all calls if edge functions aren't deployed
let backendReady = null // null = unknown, true = ready, false = down
let probePromise = null

async function checkBackend() {
  if (backendReady !== null) return backendReady
  if (probePromise) return probePromise
  probePromise = (async () => {
    // Always assume backend is ready — let per-function circuit breaker handle failures
    backendReady = true
    return backendReady
  })()
  return probePromise
}

// Circuit breaker per function
const failureCount = {}
const CIRCUIT_BREAKER_THRESHOLD = 5

/**
 * Safe wrapper for supabase.functions.invoke.
 * NEVER throws. Always returns { data, error }.
 * Circuit breaker: after 5 consecutive 404s per function, silently returns null.
 */
export async function safeInvoke(fnName, body) {
  // Backend probe
  const ready = await checkBackend()
  if (!ready) return { data: null, error: 'Backend not deployed' }

  // Circuit breaker per function
  if ((failureCount[fnName] || 0) >= CIRCUIT_BREAKER_THRESHOLD) {
    console.warn(`[safeInvoke] Circuit breaker open for ${fnName} (${failureCount[fnName]} failures)`)
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
