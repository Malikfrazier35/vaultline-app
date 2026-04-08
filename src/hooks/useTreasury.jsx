import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const POLL_INTERVAL = 60_000 // 60 seconds
const STALE_THRESHOLD = 120_000 // 2 minutes = stale

export function useTreasury() {
  const { org } = useAuth()
  const [accounts, setAccounts] = useState([])
  const [transactions, setTransactions] = useState([])
  const [cashPosition, setCashPosition] = useState(null)
  const [bankConnections, setBankConnections] = useState([])
  const [forecast, setForecast] = useState(null)
  const [dailyBalances, setDailyBalances] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastFetched, setLastFetched] = useState(null)

  const orgId = org?.id
  const fetchingRef = useRef(false)
  const mountedRef = useRef(true)

  const fetchAll = useCallback(async (opts = {}) => {
    if (!orgId) { setLoading(false); return }
    if (fetchingRef.current && !opts.force) return // prevent concurrent fetches
    fetchingRef.current = true
    if (!opts.silent) setLoading(true)

    try {
      const [acctRes, txRes, posRes, bankRes, fcRes, balRes] = await Promise.all([
        supabase.from('accounts')
          .select('*, bank_connections(institution_name, institution_color, status)')
          .eq('org_id', orgId).eq('is_active', true)
          .order('current_balance', { ascending: false }),

        supabase.from('transactions')
          .select('*, accounts(name, bank_connections(institution_name))')
          .eq('org_id', orgId)
          .order('date', { ascending: false })
          .limit(500),

        supabase.from('cash_position').select('*').eq('org_id', orgId).maybeSingle(),

        supabase.from('bank_connections').select('*').eq('org_id', orgId)
          .order('created_at', { ascending: true }),

        supabase.from('forecasts').select('*').eq('org_id', orgId)
          .order('generated_at', { ascending: false }).limit(1).maybeSingle(),

        supabase.from('daily_balances').select('date, balance')
          .eq('org_id', orgId).order('date').limit(180),
      ])

      if (!mountedRef.current) return

      {
        setAccounts(Array.isArray(acctRes?.data) ? acctRes.data : [])
        setTransactions(Array.isArray(txRes?.data) ? txRes.data : [])
        setCashPosition(posRes?.data ?? null)
        setBankConnections(Array.isArray(bankRes?.data) ? bankRes.data : [])
        setForecast(fcRes?.data ?? null)
        setDailyBalances(Array.isArray(balRes?.data) ? balRes.data : [])
        setLastFetched(Date.now())
      }
    } catch (err) {
      console.error('Treasury fetch error:', err)
    } finally {
      fetchingRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }, [orgId])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true
    fetchAll()
    return () => { mountedRef.current = false }
  }, [fetchAll])

  // Polling interval — silent background refresh every 60s
  useEffect(() => {
    if (!orgId) return
    const interval = setInterval(() => fetchAll({ silent: true }), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [orgId, fetchAll])

  // Visibility refetch — when user tabs back, refetch if stale
  useEffect(() => {
    if (!orgId) return
    function handleVisibility() {
      if (document.visibilityState === 'visible') {
        const stale = !lastFetched || (Date.now() - lastFetched > STALE_THRESHOLD)
        if (stale) fetchAll({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [orgId, fetchAll, lastFetched])

  // Window focus refetch — handles alt-tab without full tab switch
  useEffect(() => {
    if (!orgId) return
    function handleFocus() {
      const stale = !lastFetched || (Date.now() - lastFetched > STALE_THRESHOLD)
      if (stale) fetchAll({ silent: true })
    }
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [orgId, fetchAll, lastFetched])

  // Realtime subscription
  useEffect(() => {
    if (!orgId) return
    let channel
    try {
      channel = supabase
        .channel('treasury-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `org_id=eq.${orgId}` }, () => fetchAll({ silent: true }))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` }, () => fetchAll({ silent: true }))
        .subscribe()
    } catch { /* tables may not exist */ }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [orgId, fetchAll])

  return {
    accounts, transactions, cashPosition, bankConnections, forecast, dailyBalances,
    loading, lastFetched, refetch: fetchAll,
    isStale: lastFetched && (Date.now() - lastFetched > STALE_THRESHOLD),
  }
}
