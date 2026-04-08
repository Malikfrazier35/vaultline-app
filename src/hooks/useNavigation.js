import { useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { safeInvoke } from '@/lib/safeInvoke'

// Generate a stable session ID per browser tab
const SESSION_ID = `s_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
const DEVICE_TYPE = window.innerWidth <= 768 ? 'mobile' : window.innerWidth <= 1024 ? 'tablet' : 'desktop'

let pageEnteredAt = Date.now()
let maxScrollDepth = 0
let interactionCount = 0
let isFirstPage = true

// Track scroll depth
function updateScrollDepth() {
  const scrollTop = window.scrollY || document.documentElement.scrollTop
  const scrollHeight = document.documentElement.scrollHeight - window.innerHeight
  if (scrollHeight > 0) {
    const pct = Math.round((scrollTop / scrollHeight) * 100)
    if (pct > maxScrollDepth) maxScrollDepth = pct
  }
}

// Track interactions (clicks, inputs)
function countInteraction() { interactionCount++ }

/**
 * useNavigation — Drop into Layout, auto-tracks every page transition.
 * 
 * Tracks: page views, time on page, scroll depth, interactions, entry/exit.
 * Sends data to `navigation` edge function.
 * 
 * Usage: useNavigation() — call once in Layout.jsx
 */
export function useNavigation() {
  const location = useLocation()
  const { profile, org } = useAuth()
  const prevPath = useRef(null)
  const flushing = useRef(false)

  // Flush previous page data
  const flushPage = useCallback(async (path) => {
    if (!profile?.id || !path || flushing.current) return
    flushing.current = true
    try {
      const timeOnPage = Date.now() - pageEnteredAt
      // Only track pages with >500ms dwell (skip instant redirects)
      if (timeOnPage > 500) {
        safeInvoke('navigation', {
            action: 'page_view',
            session_id: SESSION_ID,
            page_path: path,
            page_title: document.title,
            referrer_path: prevPath.current,
            time_on_page_ms: timeOnPage,
            scroll_depth_pct: maxScrollDepth,
            interactions: interactionCount,
            entry_point: isFirstPage,
            device_type: DEVICE_TYPE,
            viewport_width: window.innerWidth,
            viewport_height: window.innerHeight,
            ...(isFirstPage ? {
              utm_source: new URLSearchParams(window.location.search).get('utm_source'),
              utm_medium: new URLSearchParams(window.location.search).get('utm_medium'),
              utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
              referrer: document.referrer,
            } : {}),
        })
        if (isFirstPage) isFirstPage = false
      }
    } catch (e) { /* silent — analytics should never break UX */ }
    flushing.current = false
  }, [profile?.id])

  // Track page transitions
  useEffect(() => {
    // Flush previous page
    if (prevPath.current && prevPath.current !== location.pathname) {
      flushPage(prevPath.current)
    }

    // Reset counters for new page
    prevPath.current = location.pathname
    pageEnteredAt = Date.now()
    maxScrollDepth = 0
    interactionCount = 0

    // Attach listeners
    window.addEventListener('scroll', updateScrollDepth, { passive: true })
    document.addEventListener('click', countInteraction, { passive: true })
    document.addEventListener('input', countInteraction, { passive: true })

    return () => {
      window.removeEventListener('scroll', updateScrollDepth)
      document.removeEventListener('click', countInteraction)
      document.removeEventListener('input', countInteraction)
    }
  }, [location.pathname, flushPage])

  // Flush on tab close / navigate away
  useEffect(() => {
    const handleUnload = () => {
      if (!profile?.id || !prevPath.current) return
      const timeOnPage = Date.now() - pageEnteredAt
      // Use sendBeacon for reliable delivery on unload
      const payload = JSON.stringify({
        action: 'end_session',
        session_id: SESSION_ID,
        exit_page: prevPath.current,
      })
      navigator.sendBeacon?.(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/navigation`,
        new Blob([payload], { type: 'application/json' })
      )
    }
    window.addEventListener('beforeunload', handleUnload)
    return () => window.removeEventListener('beforeunload', handleUnload)
  }, [profile?.id])

  return SESSION_ID
}

/**
 * trackFeature — Call from anywhere to log feature adoption.
 * 
 * Usage: trackFeature('copilot_opened', 'used', { page: '/dashboard' })
 */
export function trackFeature(feature, action = 'used', context = {}) {
  safeInvoke('navigation', { action: 'feature_event', session_id: SESSION_ID, feature, feature_action: action, context }).catch(() => {})
}

/**
 * trackOnboarding — Log onboarding step completion.
 */
export function trackOnboarding(stepId, stepName, status = 'completed', metadata = {}) {
  safeInvoke('navigation', { action: 'onboarding_step', step_id: stepId, step_name: stepName, status, metadata }).catch(() => {})
}

export { SESSION_ID }
