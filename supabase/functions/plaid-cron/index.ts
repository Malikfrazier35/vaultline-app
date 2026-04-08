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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Get all active bank connections (not sample, not disconnected)
    const { data: connections, error: connErr } = await supabase
      .from('bank_connections')
      .select('id, org_id, plaid_access_token, institution_name, status, error_count')
      .in('status', ['connected', 'syncing', 'error'])
      .or('is_sample.is.null,is_sample.eq.false')

    if (connErr) throw connErr
    if (!connections?.length) {
      return new Response(JSON.stringify({ message: 'No connections to sync', synced: 0 }), { headers: cors })
    }

    const results = { synced: 0, errors: 0, skipped: 0, details: [] as any[] }

    for (const conn of connections) {
      // Skip connections with too many consecutive errors (circuit breaker)
      const errorCount = conn.error_count || 0
      if (errorCount >= 5) {
        results.skipped++
        results.details.push({ id: conn.id, institution: conn.institution_name, status: 'circuit_breaker', errors: errorCount })
        continue
      }

      try {
        // Mark as syncing
        await supabase.from('bank_connections').update({ status: 'syncing' }).eq('id', conn.id)

        // Fetch latest balances
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

        if (!balRes.ok) {
          // Check for ITEM_LOGIN_REQUIRED
          if (balData.error_code === 'ITEM_LOGIN_REQUIRED') {
            await supabase.from('bank_connections').update({
              status: 'error',
              error_message: 'Bank login expired — please re-authenticate',
              error_count: errorCount + 1,
              updated_at: new Date().toISOString(),
            }).eq('id', conn.id)

            // Create notification for the user
            await supabase.from('notifications').insert({
              org_id: conn.org_id,
              type: 'bank_error',
              title: `${conn.institution_name} needs re-authentication`,
              message: 'Your bank connection has expired. Please reconnect to resume syncing.',
              severity: 'warning',
              action_url: '/banks',
            }).catch(() => {})

            results.errors++
            results.details.push({ id: conn.id, institution: conn.institution_name, status: 'login_required' })
            continue
          }

          // Other Plaid errors
          await supabase.from('bank_connections').update({
            status: 'error',
            error_message: balData.error_message || 'Sync failed',
            error_count: errorCount + 1,
            updated_at: new Date().toISOString(),
          }).eq('id', conn.id)

          results.errors++
          results.details.push({ id: conn.id, institution: conn.institution_name, status: 'error', error: balData.error_code })
          continue
        }

        // Update account balances
        if (balData.accounts) {
          for (const acct of balData.accounts) {
            const prevBalance = await supabase.from('accounts')
              .select('current_balance')
              .eq('plaid_account_id', acct.account_id)
              .eq('org_id', conn.org_id)
              .single()

            await supabase.from('accounts').update({
              current_balance: acct.balances.current || 0,
              available_balance: acct.balances.available,
              updated_at: new Date().toISOString(),
            }).eq('plaid_account_id', acct.account_id).eq('org_id', conn.org_id)

            // Anomaly detection: >50% balance change
            const prev = prevBalance?.data?.current_balance || 0
            const curr = acct.balances.current || 0
            if (prev > 0 && Math.abs(curr - prev) / prev > 0.5) {
              await supabase.from('notifications').insert({
                org_id: conn.org_id,
                type: 'balance_anomaly',
                title: `Large balance change on ${acct.name}`,
                message: `Balance changed from $${prev.toLocaleString()} to $${curr.toLocaleString()} (${((curr - prev) / prev * 100).toFixed(0)}%)`,
                severity: curr < prev ? 'critical' : 'info',
                action_url: '/position',
              }).catch(() => {})
            }
          }
        }

        // Fetch new transactions (last 7 days)
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 86400000)
        const txRes = await fetch(`${PLAID_BASE}/transactions/get`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET,
            access_token: conn.plaid_access_token,
            start_date: weekAgo.toISOString().slice(0, 10),
            end_date: now.toISOString().slice(0, 10),
            options: { count: 500, offset: 0 },
          }),
        })
        const txData = await txRes.json()

        if (txRes.ok && txData.transactions) {
          for (const tx of txData.transactions) {
            // Upsert — don't create duplicates
            const { data: existing } = await supabase
              .from('transactions')
              .select('id')
              .eq('plaid_transaction_id', tx.transaction_id)
              .eq('org_id', conn.org_id)
              .maybeSingle()

            if (!existing) {
              // Get the account_id from our DB
              const { data: acct } = await supabase
                .from('accounts')
                .select('id')
                .eq('plaid_account_id', tx.account_id)
                .eq('org_id', conn.org_id)
                .single()

              if (acct) {
                await supabase.from('transactions').insert({
                  org_id: conn.org_id,
                  account_id: acct.id,
                  plaid_transaction_id: tx.transaction_id,
                  date: tx.date,
                  description: tx.name,
                  amount: tx.amount,
                  merchant_name: tx.merchant_name,
                  is_pending: tx.pending,
                  plaid_category: tx.category,
                  category: categorizeTransaction(tx),
                })
              }
            }
          }
        }

        // Snapshot daily balance
        const today = now.toISOString().slice(0, 10)
        if (balData.accounts) {
          for (const acct of balData.accounts) {
            const { data: dbAcct } = await supabase
              .from('accounts')
              .select('id')
              .eq('plaid_account_id', acct.account_id)
              .eq('org_id', conn.org_id)
              .single()

            if (dbAcct) {
              await supabase.from('daily_balances').upsert({
                org_id: conn.org_id,
                account_id: dbAcct.id,
                date: today,
                balance: acct.balances.current || 0,
              }, { onConflict: 'account_id,date' })
            }
          }
        }

        // Mark as connected, reset error count
        await supabase.from('bank_connections').update({
          status: 'connected',
          last_synced_at: new Date().toISOString(),
          error_message: null,
          error_count: 0,
          updated_at: new Date().toISOString(),
        }).eq('id', conn.id)

        results.synced++
        results.details.push({ id: conn.id, institution: conn.institution_name, status: 'synced', accounts: balData.accounts?.length || 0 })

      } catch (err) {
        console.error(`Sync error for ${conn.institution_name}:`, err)
        await supabase.from('bank_connections').update({
          status: 'error',
          error_message: err.message,
          error_count: errorCount + 1,
          updated_at: new Date().toISOString(),
        }).eq('id', conn.id)
        results.errors++
        results.details.push({ id: conn.id, institution: conn.institution_name, status: 'error', error: err.message })
      }
    }

    // Log the cron run
    await supabase.from('audit_log').insert({
      action: 'plaid_daily_sync',
      resource_type: 'system',
      details: { synced: results.synced, errors: results.errors, skipped: results.skipped },
    }).catch(() => {})

    return new Response(JSON.stringify(results), { headers: cors })
  } catch (err) {
    console.error('Cron sync error:', err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})

// Transaction categorization brain
function categorizeTransaction(tx: any): string {
  const name = (tx.name || '').toLowerCase()
  const merchant = (tx.merchant_name || '').toLowerCase()
  const combined = `${name} ${merchant}`

  // Payroll patterns
  if (/gusto|adp|paychex|payroll|paycom|rippling|justworks/i.test(combined)) return 'payroll'

  // SaaS/software
  if (/aws|amazon web|google cloud|gcp|azure|microsoft 365|salesforce|hubspot|slack|notion|figma|linear|datadog|stripe fee|twilio|sendgrid|vercel|supabase|github|atlassian|jira|confluence/i.test(combined)) return 'saas'

  // Tax
  if (/irs|internal revenue|state tax|franchise tax|estimated tax|tax payment/i.test(combined)) return 'tax'

  // Revenue (negative amounts in Plaid = money coming in)
  if (tx.amount < 0 && /deposit|wire.*in|ach.*credit|payment.*received|stripe.*payout|shopify.*payout/i.test(combined)) return 'revenue'

  // Transfer
  if (/transfer|sweep|zelle.*transfer|internal/i.test(combined)) return 'transfer'

  // Vendor
  if (/office|rent|lease|insurance|legal|accounting|consulting|cleaning|fedex|ups|shipping/i.test(combined)) return 'vendor'

  // Operations
  if (/comcast|at&t|verizon|internet|phone|utility|electric|water|gas/i.test(combined)) return 'operations'

  return 'other'
}
