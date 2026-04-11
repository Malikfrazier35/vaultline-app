import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.0'

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anonClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: req.headers.get('Authorization')! } }
    })
    const { data: { user } } = await anonClient.auth.getUser()
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: cors })

    const { action, org_id } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    // Get user's org
    const { data: profile } = await supabase.from('profiles').select('org_id, role').eq('id', user.id).single()
    const orgId = org_id || profile?.org_id
    if (!orgId) return json({ error: 'No organization found' })

    switch (action) {

      // ── CHECK — has this org already purged? ──
      case 'check': {
        const { data: org } = await supabase.from('organizations').select('sample_data_purged, sample_data_purged_at, first_real_connection_at').eq('id', orgId).single()
        const { count: sampleCount } = await supabase.from('bank_connections').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_sample', true)
        const { count: realCount } = await supabase.from('bank_connections').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_sample', false)
        return json({
          purged: org?.sample_data_purged || false,
          purged_at: org?.sample_data_purged_at,
          first_real_connection_at: org?.first_real_connection_at,
          sample_connections: sampleCount || 0,
          real_connections: realCount || 0,
        })
      }

      // ── AUTO-PURGE — called by plaid-exchange after first real connection ──
      case 'auto_purge': {
        // Check if already purged
        const { data: org } = await supabase.from('organizations').select('sample_data_purged').eq('id', orgId).single()
        if (org?.sample_data_purged) return json({ already_purged: true })

        // Check if this is genuinely the first real connection
        const { count: realCount } = await supabase.from('bank_connections').select('*', { count: 'exact', head: true }).eq('org_id', orgId).eq('is_sample', false)
        if ((realCount || 0) < 1) return json({ error: 'No real connections found — cannot purge yet' })

        // ── Execute purge in dependency order ──
        const results: Record<string, number> = {}

        // 1. Get sample account IDs for this org
        const { data: sampleBanks } = await supabase.from('bank_connections').select('id').eq('org_id', orgId).eq('is_sample', true)
        const bankIds = (sampleBanks || []).map(b => b.id)

        if (bankIds.length > 0) {
          const { data: sampleAccounts } = await supabase.from('accounts').select('id').in('bank_connection_id', bankIds)
          const accountIds = (sampleAccounts || []).map(a => a.id)

          if (accountIds.length > 0) {
            // 2. Delete sample transactions
            const { count: txCount } = await supabase.from('transactions').delete({ count: 'exact' }).in('account_id', accountIds).eq('is_sample', true)
            results.transactions = txCount || 0

            // 3. Delete sample daily_balances
            const { count: balCount } = await supabase.from('daily_balances').delete({ count: 'exact' }).in('account_id', accountIds).eq('is_sample', true)
            results.daily_balances = balCount || 0

            // 4. Delete sample accounts
            const { count: acctCount } = await supabase.from('accounts').delete({ count: 'exact' }).in('bank_connection_id', bankIds).eq('is_sample', true)
            results.accounts = acctCount || 0
          }

          // 5. Delete sample bank_connections
          const { count: bankCount } = await supabase.from('bank_connections').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
          results.bank_connections = bankCount || 0
        }

        // 6. Delete sample invoices/payables
        const { count: invCount } = await supabase.from('invoices').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
        results.invoices = invCount || 0

        const { count: payCount } = await supabase.from('payables').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
        results.payables = payCount || 0

        // 7. Delete sample forecasts
        const { count: fcstCount } = await supabase.from('forecasts').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
        results.forecasts = fcstCount || 0

        // 8. Refresh cash_position aggregate
        const { data: realAccounts } = await supabase.from('accounts').select('balance, type').eq('org_id', orgId)
        const totalBalance = (realAccounts || []).reduce((s, a) => s + (a.balance || 0), 0)
        const liquidBalance = (realAccounts || []).filter(a => a.type !== 'credit').reduce((s, a) => s + (a.balance || 0), 0)
        await supabase.from('cash_position').upsert({
          org_id: orgId,
          total_balance: totalBalance,
          liquid_balance: liquidBalance,
          connected_banks: bankIds.length > 0 ? undefined : 0,
          total_accounts: (realAccounts || []).length,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'org_id' })

        // 9. Mark org as purged
        await supabase.from('organizations').update({
          sample_data_purged: true,
          sample_data_purged_at: new Date().toISOString(),
          first_real_connection_at: new Date().toISOString(),
        }).eq('id', orgId)

        // 10. Audit log
        await supabase.from('audit_log').insert({
          org_id: orgId,
          user_id: user.id,
          action: 'sample_data_purged',
          resource_type: 'organization',
          details: { results, trigger: 'first_real_bank_connection' },
        })

        const totalPurged = Object.values(results).reduce((s, v) => s + v, 0)
        return json({ success: true, total_purged: totalPurged, results })
      }

      // ── MANUAL PURGE — admin triggers from settings ──
      case 'manual_purge': {
        if (!['owner', 'admin'].includes(profile?.role)) return json({ error: 'Admin only' })

        // Same logic as auto_purge but without the real connection check
        const { data: org } = await supabase.from('organizations').select('sample_data_purged').eq('id', orgId).single()
        if (org?.sample_data_purged) return json({ already_purged: true })

        const { data: sampleBanks } = await supabase.from('bank_connections').select('id').eq('org_id', orgId).eq('is_sample', true)
        const bankIds = (sampleBanks || []).map(b => b.id)
        const results: Record<string, number> = {}

        if (bankIds.length > 0) {
          const { data: sampleAccounts } = await supabase.from('accounts').select('id').in('bank_connection_id', bankIds)
          const accountIds = (sampleAccounts || []).map(a => a.id)
          if (accountIds.length > 0) {
            const { count: txCount } = await supabase.from('transactions').delete({ count: 'exact' }).in('account_id', accountIds).eq('is_sample', true)
            results.transactions = txCount || 0
            const { count: balCount } = await supabase.from('daily_balances').delete({ count: 'exact' }).in('account_id', accountIds).eq('is_sample', true)
            results.daily_balances = balCount || 0
            const { count: acctCount } = await supabase.from('accounts').delete({ count: 'exact' }).in('bank_connection_id', bankIds).eq('is_sample', true)
            results.accounts = acctCount || 0
          }
          const { count: bankCount } = await supabase.from('bank_connections').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
          results.bank_connections = bankCount || 0
        }

        const { count: invCount } = await supabase.from('invoices').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
        results.invoices = invCount || 0
        const { count: payCount } = await supabase.from('payables').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
        results.payables = payCount || 0
        const { count: fcstCount } = await supabase.from('forecasts').delete({ count: 'exact' }).eq('org_id', orgId).eq('is_sample', true)
        results.forecasts = fcstCount || 0

        await supabase.from('organizations').update({
          sample_data_purged: true,
          sample_data_purged_at: new Date().toISOString(),
        }).eq('id', orgId)

        await supabase.from('audit_log').insert({
          org_id: orgId, user_id: user.id, action: 'sample_data_purged',
          resource_type: 'organization',
          details: { results, trigger: 'manual_admin' },
        })

        const totalPurged = Object.values(results).reduce((s, v) => s + v, 0)
        return json({ success: true, total_purged: totalPurged, results })
      }

      default:
        return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
