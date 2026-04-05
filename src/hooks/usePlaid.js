import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function usePlaid({ onSuccess } = {}) {
  const [linking, setLinking] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState(null)

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  // Step 1: Get link token from our edge function
  const openPlaidLink = useCallback(async () => {
    setLinking(true)
    setError(null)

    try {
      const session = await getSession()
      if (!session) throw new Error('Not authenticated')

      // supabase.functions.invoke auto-includes auth headers
      const { data, error: fnError } = await supabase.functions.invoke('plaid-link')

      if (fnError) throw new Error(fnError.message || 'Failed to get link token')
      if (!data?.link_token) throw new Error(data?.error || data?.detail || 'No link token returned')

      const link_token = data.link_token

      // Step 2: Open Plaid Link UI
      // Plaid Link is loaded via CDN script in index.html
      if (!window.Plaid) {
        throw new Error('Plaid Link not loaded. Add the Plaid CDN script to index.html.')
      }

      const handler = window.Plaid.create({
        token: link_token,
        onSuccess: async (publicToken, metadata) => {
          // Step 3: Exchange token via our edge function
          try {
            const { data: exchangeData, error: exchangeErr } = await supabase.functions.invoke('plaid-exchange', {
              body: {
                public_token: publicToken,
                institution: metadata.institution,
              },
            })

            if (exchangeErr) throw new Error(exchangeErr.message)

            // Step 4: Trigger initial sync
            await syncAccounts()

            onSuccess?.()
          } catch (err) {
            setError(err.message)
          } finally {
            setLinking(false)
          }
        },
        onExit: (err) => {
          if (err) setError(err.display_message || err.error_message || 'Link exited with error')
          setLinking(false)
        },
        onEvent: (eventName) => {
          console.log('[Plaid Event]', eventName)
        },
      })

      handler.open()
    } catch (err) {
      setError(err.message)
      setLinking(false)
    }
  }, [onSuccess])

  // Sync all connected accounts
  const syncAccounts = useCallback(async () => {
    setSyncing(true)
    setError(null)

    try {
      const session = await getSession()
      if (!session) throw new Error('Not authenticated')

      const { data, error: fnError } = await supabase.functions.invoke('plaid-sync')

      if (fnError) throw new Error(fnError.message)

      return data
    } catch (err) {
      setError(err.message)
    } finally {
      setSyncing(false)
    }
  }, [])

  return {
    openPlaidLink,
    syncAccounts,
    linking,
    syncing,
    error,
  }
}
