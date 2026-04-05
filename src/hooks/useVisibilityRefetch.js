import { useEffect, useRef } from 'react'

const STALE_MS = 120_000 // 2 minutes

/**
 * Calls `refetchFn` when tab becomes visible after being hidden for > STALE_MS,
 * and optionally polls on an interval while visible.
 */
export function useVisibilityRefetch(refetchFn, { pollMs = 0, enabled = true } = {}) {
  const lastRef = useRef(Date.now())

  // Visibility change
  useEffect(() => {
    if (!enabled) return
    function handle() {
      if (document.visibilityState === 'visible' && Date.now() - lastRef.current > STALE_MS) {
        lastRef.current = Date.now()
        refetchFn()
      }
    }
    document.addEventListener('visibilitychange', handle)
    return () => document.removeEventListener('visibilitychange', handle)
  }, [refetchFn, enabled])

  // Window focus (alt-tab)
  useEffect(() => {
    if (!enabled) return
    function handle() {
      if (Date.now() - lastRef.current > STALE_MS) {
        lastRef.current = Date.now()
        refetchFn()
      }
    }
    window.addEventListener('focus', handle)
    return () => window.removeEventListener('focus', handle)
  }, [refetchFn, enabled])

  // Optional polling
  useEffect(() => {
    if (!enabled || !pollMs) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        lastRef.current = Date.now()
        refetchFn()
      }
    }, pollMs)
    return () => clearInterval(id)
  }, [refetchFn, pollMs, enabled])

  return { markFresh: () => { lastRef.current = Date.now() } }
}
