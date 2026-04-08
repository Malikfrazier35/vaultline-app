import { useState, useEffect, useCallback, useRef, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const POLL_INTERVAL = 300_000
const STALE_THRESHOLD = 120_000

const TreasuryContext = createContext(null)

export function TreasuryProvider({ children }) {
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
    if (fetchingRef.current && !opts.force) return
    fetchingRef.current = true
    if (!opts.silent) setLoading(true)

    try {
      const hideSample = org?.has_real_data === true

      let acctQuery = supabase.from('accounts')
        .select('*, bank_connections(institution_name, institution_color, status)')
        .eq('org_id', orgId).eq('is_active', true)
      if (hideSample) acctQuery = acctQuery.eq('is_sample', false)

      let txQuery = supabase.from('transactions')
        .select('*, accounts(name, bank_connections(institution_name))')
        .eq('org_id', orgId)
      if (hideSample) txQuery = txQuery.eq('is_sample', false)

      let bankQuery = supabase.from('bank_connections').select('*').eq('org_id', orgId)
      if (hideSample) bankQuery = bankQuery.eq('is_sample', false)

      let balQuery = supabase.from('daily_balances').select('date, balance')
        .eq('org_id', orgId)
      if (hideSample) balQuery = balQuery.eq('is_sample', false)

      const [acctRes, txRes, posRes, bankRes, fcRes, balRes] = await Promise.all([
        acctQuery.order('current_balance', { ascending: false }),
        txQuery.order('date', { ascending: false }).limit(100),
        supabase.from('cash_position').select('*').eq('org_id', orgId).maybeSingle(),
        bankQuery.order('created_at', { ascending: true }),
        supabase.from('forecasts').select('*').eq('org_id', orgId)
          .order('generated_at', { ascending: false }).limit(1).maybeSingle(),
        balQuery.order('date').limit(180),
      ])

      if (!mountedRef.current) return

      setAccounts(Array.isArray(acctRes?.data) ? acctRes.data : [])
      setTransactions(Array.isArray(txRes?.data) ? txRes.data : [])
      setCashPosition(posRes?.data ?? null)
      setBankConnections(Array.isArray(bankRes?.data) ? bankRes.data : [])
      setForecast(fcRes?.data ?? null)
      setDailyBalances(Array.isArray(balRes?.data) ? balRes.data : [])
      setLastFetched(Date.now())
    } catch (err) {
      console.error('Treasury fetch error:', err)
    } finally {
      fetchingRef.current = false
      if (mountedRef.current) setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    mountedRef.current = true
    fetchAll()
    return () => { mountedRef.current = false }
  }, [fetchAll])

  useEffect(() => {
    if (!orgId) return
    const interval = setInterval(() => fetchAll({ silent: true }), POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [orgId, fetchAll])

  useEffect(() => {
    if (!orgId) return
    let timer = null
    function refocus() {
      if (timer) return
      const stale = !lastFetched || (Date.now() - lastFetched > STALE_THRESHOLD)
      if (stale) { timer = setTimeout(() => { fetchAll({ silent: true }); timer = null }, 300) }
    }
    function onVis() { if (document.visibilityState === 'visible') refocus() }
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('focus', refocus)
    return () => { document.removeEventListener('visibilitychange', onVis); window.removeEventListener('focus', refocus); if (timer) clearTimeout(timer) }
  }, [orgId, fetchAll, lastFetched])

  useEffect(() => {
    if (!orgId) return
    let channel
    try {
      channel = supabase.channel('treasury-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'accounts', filter: `org_id=eq.${orgId}` }, () => fetchAll({ silent: true }))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transactions', filter: `org_id=eq.${orgId}` }, () => fetchAll({ silent: true }))
        .subscribe()
    } catch {}
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [orgId, fetchAll])

  return (
    <TreasuryContext.Provider value={{
      accounts, transactions, cashPosition, bankConnections, forecast, dailyBalances,
      loading, lastFetched, refetch: fetchAll,
      isStale: lastFetched && (Date.now() - lastFetched > STALE_THRESHOLD),
    }}>
      {children}
    </TreasuryContext.Provider>
  )
}

export function useTreasury() {
  const ctx = useContext(TreasuryContext)
  if (!ctx) throw new Error('useTreasury must be inside TreasuryProvider')
  return ctx
}
