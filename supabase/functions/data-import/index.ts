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
    const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })
    const orgId = profile.org_id
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    const { type, ...body } = await req.json()

    switch (type) {
      case 'csv': {
        const { rows, file_name, account_id } = body
        if (!rows?.length) return json({ error: 'No rows provided' })

        // Create import record
        const { data: imp } = await supabase.from('data_imports').insert({
          org_id: orgId, user_id: user.id, type: 'csv', file_name, row_count: rows.length,
        }).select().single()

        let successCount = 0, errorCount = 0
        const errors: any[] = []

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i]
          try {
            const tx = {
              org_id: orgId,
              account_id: account_id || null,
              date: row.date || row.Date || row.DATE,
              description: row.description || row.Description || row.memo || row.Memo || '',
              amount: parseFloat(row.amount || row.Amount || row.AMOUNT || 0),
              category: row.category || row.Category || 'uncategorized',
              is_pending: false,
            }
            if (!tx.date || isNaN(tx.amount)) throw new Error(`Invalid data at row ${i + 1}`)
            const { error } = await supabase.from('transactions').insert(tx)
            if (error) throw error
            successCount++
          } catch (err) {
            errorCount++
            errors.push({ row: i + 1, error: err.message })
          }
        }

        // Update import record
        await supabase.from('data_imports').update({
          success_count: successCount, error_count: errorCount, errors, status: errorCount === rows.length ? 'failed' : 'completed', completed_at: new Date().toISOString(),
        }).eq('id', imp?.id)

        await supabase.from('audit_log').insert({ org_id: orgId, user_id: user.id, action: 'data_import', details: { type: 'csv', file_name, total: rows.length, success: successCount, errors: errorCount } })

        return json({ success: true, import_id: imp?.id, total: rows.length, success_count: successCount, error_count: errorCount, errors: errors.slice(0, 10) })
      }

      case 'manual_transaction': {
        const { date, description, amount, category, account_id } = body
        if (!date || amount == null) return json({ error: 'Date and amount required' })

        const { data, error } = await supabase.from('transactions').insert({
          org_id: orgId, account_id: account_id || null, date, description: description || '', amount: parseFloat(amount), category: category || 'manual', is_pending: false,
        }).select().single()

        if (error) return json({ error: error.message })
        return json({ success: true, transaction: data })
      }

      case 'manual_account': {
        const { name, type: acctType, balance, currency } = body
        if (!name) return json({ error: 'Account name required' })

        const { data, error } = await supabase.from('accounts').insert({
          org_id: orgId, name, type: acctType || 'depository', current_balance: parseFloat(balance || 0), currency: currency || 'USD', is_active: true,
        }).select().single()

        if (error) return json({ error: error.message })
        return json({ success: true, account: data })
      }

      default:
        return json({ error: `Unknown import type: ${type}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
