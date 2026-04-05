import { useState, useEffect, useRef, useCallback } from 'react'
import { safeInvoke } from '@/lib/safeInvoke'
import { SESSION_ID } from '@/hooks/useNavigation'

/**
 * useAutosave — Auto-saves form/page state to Supabase with debounce.
 * 
 * @param {string} draftType — e.g. 'ticket', 'report', 'invoice', 'scenario'
 * @param {string} draftKey — unique key, e.g. 'new_ticket', 'report_cash_flow'
 * @param {object} data — the state to persist
 * @param {object} options — { debounceMs, enabled, title }
 * 
 * Returns: { saving, lastSaved, version, hasDraft, restore, discard }
 * 
 * Usage:
 *   const { saving, lastSaved, hasDraft, restore, discard } = useAutosave('ticket', 'new', formData)
 *   // formData auto-saves every 2s of inactivity
 *   // On mount, check hasDraft — if true, call restore() to get previous state
 */
export function useAutosave(draftType, draftKey, data, options = {}) {
  const { debounceMs = 2000, enabled = true, title } = options
  const [saving, setSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [version, setVersion] = useState(0)
  const [hasDraft, setHasDraft] = useState(false)
  const [draftData, setDraftData] = useState(null)
  const timerRef = useRef(null)
  const prevDataRef = useRef(null)
  const mountedRef = useRef(true)

  // Check for existing draft on mount
  useEffect(() => {
    if (!draftType || !draftKey || !enabled) return
    safeInvoke('memory', { action: 'get_draft', draft_type: draftType, draft_key: draftKey }).then(({ data: res }) => {
      if (res?.draft?.data && Object.keys(res.draft.data).length > 0) {
        setHasDraft(true)
        setDraftData(res.draft.data)
        setVersion(res.draft.version || 0)
        setLastSaved(res.draft.last_saved_at)
      }
    }).catch(() => {})
    return () => { mountedRef.current = false }
  }, [draftType, draftKey, enabled])

  // Debounced auto-save
  useEffect(() => {
    if (!enabled || !draftType || !draftKey) return
    if (!data || JSON.stringify(data) === JSON.stringify(prevDataRef.current)) return
    if (Object.keys(data).length === 0) return

    prevDataRef.current = data

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      if (!mountedRef.current) return
      setSaving(true)
      try {
        const { data: res } = await safeInvoke('memory', { action: 'save_draft', draft_type: draftType, draft_key: draftKey, title, data, auto_saved: true })
        if (mountedRef.current && res?.success) {
          setLastSaved(new Date().toISOString())
          setVersion(res.version || version + 1)
        }
      } catch (e) { /* silent */ }
      if (mountedRef.current) setSaving(false)
    }, debounceMs)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [data, draftType, draftKey, debounceMs, enabled, title])

  // Restore draft data
  const restore = useCallback(() => {
    if (draftData) {
      setHasDraft(false)
      return draftData
    }
    return null
  }, [draftData])

  // Discard draft
  const discard = useCallback(async () => {
    setHasDraft(false)
    setDraftData(null)
    await safeInvoke('memory', { action: 'delete_draft', draft_type: draftType, draft_key: draftKey }).catch(() => {})
  }, [draftType, draftKey])

  return { saving, lastSaved, version, hasDraft, draftData, restore, discard }
}

/**
 * usePreferences — Load/save user preferences from Supabase.
 * 
 * Returns: { prefs, loading, savePref, mergePref }
 */
export function usePreferences() {
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    safeInvoke('memory', { action: 'get_prefs' })
      .then(({ data }) => { setPrefs(data?.preferences || {}); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const savePref = useCallback(async (key, value) => {
    setPrefs(prev => ({ ...prev, [key]: value }))
    await safeInvoke('memory', { action: 'save_prefs', [key]: value }).catch(() => {})
  }, [])

  const mergePref = useCallback(async (pageKey, value) => {
    setPrefs(prev => ({ ...prev, preferences: { ...(prev?.preferences || {}), [pageKey]: value } }))
    await safeInvoke('memory', { action: 'merge_prefs', key: pageKey, value }).catch(() => {})
  }, [])

  return { prefs, loading, savePref, mergePref }
}

/**
 * useUndo — Undo/redo stack backed by Supabase.
 * 
 * Returns: { pushUndo, undo, redo }
 */
export function useUndo() {
  const pushUndo = useCallback(async (operationType, entityType, entityId, previousState, newState) => {
    await safeInvoke('memory', { action: 'push_undo', session_id: SESSION_ID, operation_type: operationType, entity_type: entityType, entity_id: entityId, previous_state: previousState, new_state: newState }).catch(() => {})
  }, [])

  const undo = useCallback(async () => {
    const { data } = await safeInvoke('memory', { action: 'undo', session_id: SESSION_ID })
    return data?.restore_state || null
  }, [])

  const redo = useCallback(async () => {
    const { data } = await safeInvoke('memory', { action: 'redo', session_id: SESSION_ID })
    return data?.restore_state || null
  }, [])

  return { pushUndo, undo, redo }
}

/**
 * useSessionSnapshot — Auto-saves page state for crash recovery.
 * Saves every 30s. On mount, checks for existing snapshot.
 * 
 * Usage:
 *   const { hasSnapshot, snapshotData, clearSnapshot } = useSessionSnapshot('/forecast', pageState)
 */
export function useSessionSnapshot(pagePath, pageState, options = {}) {
  const { intervalMs = 30000, enabled = true } = options
  const [hasSnapshot, setHasSnapshot] = useState(false)
  const [snapshotData, setSnapshotData] = useState(null)

  // Check for existing snapshot on mount
  useEffect(() => {
    if (!enabled || !pagePath) return
    safeInvoke('memory', { action: 'get_snapshot', page_path: pagePath })
      .then(({ data }) => {
        if (data?.snapshot) { setHasSnapshot(true); setSnapshotData(data.snapshot) }
      }).catch(() => {})
  }, [pagePath, enabled])

  // Periodic snapshot
  useEffect(() => {
    if (!enabled || !pagePath || !pageState) return
    const interval = setInterval(() => {
      safeInvoke('memory', {
          action: 'save_snapshot', session_id: SESSION_ID, page_path: pagePath,
          page_state: pageState, scroll_position: window.scrollY,
      }).catch(() => {})
    }, intervalMs)
    return () => clearInterval(interval)
  }, [pagePath, pageState, intervalMs, enabled])

  const clearSnapshot = useCallback(() => { setHasSnapshot(false); setSnapshotData(null) }, [])

  return { hasSnapshot, snapshotData, clearSnapshot }
}
