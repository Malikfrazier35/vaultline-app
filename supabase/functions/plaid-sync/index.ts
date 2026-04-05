import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID')!
const PLAID_SECRET = Deno.env.get('PLAID_SECRET')!
const PLAID_ENV = Deno.env.get('PLAID_ENV') || 'sandbox'
const PLAID_BASE = PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
    ? 'https://development.plaid.com'
    : 'https://sandbox.plaid.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    // Auth check
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders })

    const { data: profile } = await anonClient.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: corsHeaders })

    const orgId = profile.org_id

    // Get all active bank connections with access tokens
    const { data: connections } = await supabase
      .from('bank_connections')
      .select('id, plaid_access_token, plaid_item_id')
      .eq('org_id', orgId)
      .in('status', ['connected', 'syncing'])
      .not('plaid_access_token', 'is', null)

    if (!connections?.length) {
      return new Response(JSON.stringify({ synced: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let syncedCount = 0
    const today = new Date().toISOString().split('T')[0]
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    for (const conn of connections) {
      try {
        // Mark as syncing
        await supabase.from('bank_connections').update({ status: 'syncing' }).eq('id', conn.id)

        // 1. Sync balances
        const balRes = await fetch(`${PLAID_BASE}/accounts/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: conn.plaid_access_token,
          }),
        })
        const balData = await balRes.json()

        if (balRes.ok && balData.accounts) {
          for (const a of balData.accounts) {
            // Update account balance
            await supabase.from('accounts')
              .update({
                current_balance: a.balances.current || 0,
                available_balance: a.balances.available,
              })
              .eq('bank_connection_id', conn.id)
              .eq('plaid_account_id', a.account_id)

            // Snapshot daily balance
            const { data: acctRow } = await supabase
              .from('accounts')
              .select('id')
              .eq('bank_connection_id', conn.id)
              .eq('plaid_account_id', a.account_id)
              .single()

            if (acctRow) {
              await supabase.from('daily_balances').upsert({
                org_id: orgId,
                account_id: acctRow.id,
                date: today,
                balance: a.balances.current || 0,
              }, { onConflict: 'account_id,date' })
            }
          }
        }

        // 2. Sync transactions
        const txRes = await fetch(`${PLAID_BASE}/transactions/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: conn.plaid_access_token,
            start_date: thirtyDaysAgo,
            end_date: today,
            options: { count: 500, offset: 0 },
          }),
        })
        const txData = await txRes.json()

        if (txRes.ok && txData.transactions) {
          for (const tx of txData.transactions) {
            // Find matching account
            const { data: acctRow } = await supabase
              .from('accounts')
              .select('id')
              .eq('bank_connection_id', conn.id)
              .eq('plaid_account_id', tx.account_id)
              .single()

            if (!acctRow) continue

            // Upsert transaction (skip if plaid_transaction_id already exists)
            const { error: txErr } = await supabase.from('transactions').upsert({
              org_id: orgId,
              account_id: acctRow.id,
              plaid_transaction_id: tx.transaction_id,
              date: tx.date,
              description: tx.name || tx.merchant_name || 'Unknown',
              amount: tx.amount, // Plaid: positive = debit, negative = credit
              currency: tx.iso_currency_code || 'USD',
              category: categorizeTransaction(tx),
              is_pending: tx.pending,
              merchant_name: tx.merchant_name,
              plaid_category: tx.category,
            }, { onConflict: 'plaid_transaction_id', ignoreDuplicates: false })
          }
        }

        // Mark as connected
        await supabase.from('bank_connections').update({
          status: 'connected',
          last_synced_at: new Date().toISOString(),
          error_message: null,
        }).eq('id', conn.id)

        syncedCount++
      } catch (connErr) {
        console.error(`Sync error for connection ${conn.id}:`, connErr)
        await supabase.from('bank_connections').update({
          status: 'error',
          error_message: connErr.message,
        }).eq('id', conn.id)
      }
    }

    return new Response(
      JSON.stringify({ synced: syncedCount, total: connections.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders })
  }
})

// Simple rule-based categorization from Plaid categories
function categorizeTransaction(tx: any): string {
  const cats = tx.category || []
  const name = (tx.name || '').toLowerCase()
  const merchant = (tx.merchant_name || '').toLowerCase()

  // Payroll
  if (cats.includes('Payroll') || name.includes('payroll') || name.includes('gusto') || name.includes('adp') || name.includes('deel'))
    return 'payroll'

  // Tax
  if (cats.includes('Tax') || name.includes('tax') || name.includes('irs') || name.includes('state tax'))
    return 'tax'

  // SaaS / Software
  if (name.includes('aws') || name.includes('google cloud') || name.includes('azure') ||
      name.includes('salesforce') || name.includes('hubspot') || name.includes('datadog') ||
      name.includes('figma') || name.includes('vercel') || name.includes('slack') ||
      name.includes('github') || name.includes('notion'))
    return 'saas'

  // Transfer
  if (cats.includes('Transfer') || name.includes('transfer') || name.includes('wire'))
    return 'transfer'

  // Revenue (credits)
  if (tx.amount < 0 && (name.includes('stripe') || name.includes('payment') || name.includes('deposit') || name.includes('invoice')))
    return 'revenue'

  // Rent / Operations
  if (name.includes('rent') || name.includes('lease') || name.includes('insurance') || name.includes('office'))
    return 'operations'

  // Default: vendor for debits, revenue for credits
  return tx.amount > 0 ? 'vendor' : 'revenue'
}
