import { supabase } from '@/lib/supabase'

const failureCount = {}
const CIRCUIT_BREAKER_THRESHOLD = 3

export async function safeInvoke(fnName, body) {
  if ((failureCount[fnName] || 0) >= CIRCUIT_BREAKER_THRESHOLD) {
    return { data: null, error: `${fnName} circuit open` }
  }
  try {
    const { data, error } = await supabase.functions.invoke(fnName, { body })
    if (error) {
      const msg = error.message || String(error)
      if (msg.includes('404') || msg.includes('Failed to send')) {
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
