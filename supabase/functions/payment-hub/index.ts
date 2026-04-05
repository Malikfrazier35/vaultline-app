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
    const { data: profile } = await supabase.from('profiles').select('id, org_id, role').eq('id', user.id).single()
    if (!profile) return new Response(JSON.stringify({ error: 'No profile' }), { status: 400, headers: cors })
    const orgId = profile.org_id
    const isAdmin = ['owner', 'admin'].includes(profile.role)
    const { action, ...body } = await req.json()
    const json = (d: any) => new Response(JSON.stringify(d), { headers: { ...cors, 'Content-Type': 'application/json' } })

    switch (action) {
      case 'dashboard': {
        const { data: accounts } = await supabase.from('payment_accounts').select('*').eq('org_id', orgId).eq('status', 'active')
        const { data: recent } = await supabase.from('payment_transactions').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(20)
        const { data: pending } = await supabase.from('payment_transactions').select('*').eq('org_id', orgId).eq('approval_status', 'pending').order('created_at', { ascending: false })
        const { data: payees } = await supabase.from('payees').select('id, payee_name, payee_type, total_paid, payment_count, status').eq('org_id', orgId).eq('status', 'active').order('total_paid', { ascending: false }).limit(10)
        const { data: recurring } = await supabase.from('recurring_payments').select('*, payees(payee_name)').eq('org_id', orgId).eq('status', 'active').order('next_payment_date')
        const { data: batches } = await supabase.from('payment_batches').select('*').eq('org_id', orgId).order('created_at', { ascending: false }).limit(5)

        const allAccts = accounts || []
        const totalBalance = allAccts.reduce((s, a) => s + Number(a.current_balance || 0), 0)
        const allRecent = recent || []
        const todayTotal = allRecent.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString()).reduce((s, t) => s + Number(t.amount || 0), 0)

        return json({
          summary: { total_balance: totalBalance, accounts_count: allAccts.length, pending_approvals: (pending || []).length, today_volume: todayTotal, recurring_active: (recurring || []).length },
          accounts: allAccts, recent_transactions: allRecent, pending_approvals: pending || [],
          top_payees: payees || [], recurring: recurring || [], recent_batches: batches || [],
        })
      }

      // ── PAYEES ──
      case 'list_payees': {
        const { data } = await supabase.from('payees').select('*').eq('org_id', orgId).order('payee_name')
        return json({ payees: data || [] })
      }
      case 'create_payee': {
        const { payee_name, payee_type, bank_name, routing_number, account_number_last4, account_type: acctType, swift_code, iban, email, address_line1, address_city, address_state, address_country, w9_on_file } = body
        const { data } = await supabase.from('payees').insert({ org_id: orgId, payee_name, payee_type: payee_type || 'vendor', bank_name, routing_number, account_number_last4, account_type: acctType, swift_code, iban, email, address_line1, address_city, address_state, address_country, w9_on_file }).select().single()
        return json({ success: true, payee: data })
      }

      // ── SEND PAYMENT ──
      case 'send_payment': {
        const { from_account_id, to_payee_id, to_account_id, amount, currency, payment_method, payment_type, category, memo, invoice_reference, scheduled_date, requires_approval } = body
        if (!amount || amount <= 0) return json({ error: 'Amount must be positive' })
        const ref = `VL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`

        // Check limits
        if (from_account_id) {
          const { data: acct } = await supabase.from('payment_accounts').select('single_transfer_limit, remaining_daily_limit').eq('id', from_account_id).single()
          if (acct?.single_transfer_limit && amount > Number(acct.single_transfer_limit)) return json({ error: `Exceeds single transfer limit of $${acct.single_transfer_limit}` })
          if (acct?.remaining_daily_limit && amount > Number(acct.remaining_daily_limit)) return json({ error: `Exceeds remaining daily limit of $${acct.remaining_daily_limit}` })
        }

        const needsApproval = requires_approval || amount >= 10000
        const status = scheduled_date ? 'scheduled' : needsApproval ? 'pending_approval' : 'processing'
        const statusHistory = [{ status, timestamp: new Date().toISOString(), by: user.id }]

        const { data: tx } = await supabase.from('payment_transactions').insert({
          org_id: orgId, reference_number: ref, from_account_id, to_payee_id, to_account_id,
          amount, currency: currency || 'USD', payment_method: payment_method || 'ach',
          payment_type: payment_type || 'one_time', category, memo, invoice_reference,
          scheduled_date, requires_approval: needsApproval,
          approval_status: needsApproval ? 'pending' : 'not_required',
          status, status_history: statusHistory, initiated_by: user.id,
        }).select().single()

        // Update payee stats
        if (to_payee_id && !needsApproval) {
          const { data: payee } = await supabase.from('payees').select('total_paid, payment_count').eq('id', to_payee_id).single()
          if (payee) await supabase.from('payees').update({ total_paid: Number(payee.total_paid || 0) + amount, payment_count: (payee.payment_count || 0) + 1, last_paid_at: new Date().toISOString() }).eq('id', to_payee_id)
        }

        return json({ success: true, transaction: tx, needs_approval: needsApproval })
      }

      // ── APPROVE / REJECT ──
      case 'approve_payment': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { transaction_id } = body
        const { data: tx } = await supabase.from('payment_transactions').select('status_history, to_payee_id, amount').eq('id', transaction_id).eq('org_id', orgId).single()
        if (!tx) return json({ error: 'Not found' })
        const history = [...(tx.status_history || []), { status: 'approved', timestamp: new Date().toISOString(), by: user.id }]
        await supabase.from('payment_transactions').update({ approval_status: 'approved', approved_by: user.id, approved_at: new Date().toISOString(), status: 'processing', status_history: history }).eq('id', transaction_id)
        // Update payee
        if (tx.to_payee_id) {
          const { data: payee } = await supabase.from('payees').select('total_paid, payment_count').eq('id', tx.to_payee_id).single()
          if (payee) await supabase.from('payees').update({ total_paid: Number(payee.total_paid || 0) + Number(tx.amount), payment_count: (payee.payment_count || 0) + 1, last_paid_at: new Date().toISOString() }).eq('id', tx.to_payee_id)
        }
        return json({ success: true })
      }

      case 'reject_payment': {
        if (!isAdmin) return json({ error: 'Admin only' })
        const { transaction_id, reason } = body
        await supabase.from('payment_transactions').update({ approval_status: 'rejected', status: 'canceled', rejection_reason: reason }).eq('id', transaction_id).eq('org_id', orgId)
        return json({ success: true })
      }

      // ── RECURRING ──
      case 'create_recurring': {
        const { from_account_id, to_payee_id, amount, currency, payment_method, frequency, day_of_month, memo, category, end_date } = body
        const nextDate = new Date(); if (day_of_month) nextDate.setDate(day_of_month)
        if (nextDate < new Date()) nextDate.setMonth(nextDate.getMonth() + 1)
        const { data } = await supabase.from('recurring_payments').insert({
          org_id: orgId, from_account_id, to_payee_id, amount, currency: currency || 'USD',
          payment_method: payment_method || 'ach', category, memo,
          frequency: frequency || 'monthly', day_of_month,
          next_payment_date: nextDate.toISOString().split('T')[0], end_date,
        }).select().single()
        return json({ success: true, recurring: data })
      }

      // ── TRANSACTION HISTORY ──
      case 'list_transactions': {
        const { status: txStatus, payment_method: pm, from_date, to_date, limit: lim } = body
        let q = supabase.from('payment_transactions').select('*, payees(payee_name), payment_accounts(account_label)').eq('org_id', orgId).order('created_at', { ascending: false })
        if (txStatus) q = q.eq('status', txStatus)
        if (pm) q = q.eq('payment_method', pm)
        if (from_date) q = q.gte('created_at', from_date)
        if (to_date) q = q.lte('created_at', to_date)
        const { data } = await q.limit(lim || 50)
        return json({ transactions: data || [] })
      }

      default: return json({ error: `Unknown action: ${action}` })
    }
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: cors })
  }
})
