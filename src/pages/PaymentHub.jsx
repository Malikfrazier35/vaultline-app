import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Send, DollarSign, Users, Clock, Check, X, Loader2, Plus,
  ArrowRight, ArrowUpRight, ArrowDownRight, CreditCard, Building2,
  RefreshCw, ChevronRight, AlertTriangle, Shield, Repeat, FileText
} from 'lucide-react'

function fmt(n) { const a = Math.abs(Number(n||0)); return (n < 0 ? '-' : '') + (a >= 1e6 ? `$${(a/1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(2)}`) }

const STATUS_STYLE = {
  draft: 'bg-t3/[0.06] text-t3', pending_approval: 'bg-amber/[0.06] text-amber', approved: 'bg-green/[0.06] text-green',
  scheduled: 'bg-purple/[0.06] text-purple', processing: 'bg-cyan/[0.06] text-cyan', sent: 'bg-cyan/[0.06] text-cyan',
  settled: 'bg-green/[0.06] text-green', failed: 'bg-red/[0.06] text-red', returned: 'bg-red/[0.06] text-red',
  canceled: 'bg-t3/[0.06] text-t3', reversed: 'bg-amber/[0.06] text-amber',
}
const METHOD_LABELS = { ach: 'ACH', wire: 'Wire', internal_transfer: 'Internal', check: 'Check', card: 'Card', rtp: 'RTP', sepa: 'SEPA', swift: 'SWIFT' }

export default function PaymentHub() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | send | approvals | payees | recurring | history
  const [showPayForm, setShowPayForm] = useState(false)
  const [payForm, setPayForm] = useState({ to_payee_id: '', amount: '', payment_method: 'ach', category: '', memo: '' })
  const [submitting, setSubmitting] = useState(false)
  const isAdmin = ['owner', 'admin'].includes(profile?.role)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('payment-hub', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function sendPayment(e) {
    e.preventDefault(); setSubmitting(true)
    const from = data?.accounts?.[0]?.id
    const { data: res } = await safeInvoke('payment-hub', {
      body: { action: 'send_payment', from_account_id: from, ...payForm, amount: parseFloat(payForm.amount) },
    })
    if (res?.success) { toast.success(res.needs_approval ? 'Payment submitted for approval' : 'Payment initiated'); setShowPayForm(false); setPayForm({ to_payee_id: '', amount: '', payment_method: 'ach', category: '', memo: '' }); load() }
    else toast.error(res?.error || 'Payment failed')
    setSubmitting(false)
  }

  async function approvePayment(txId) {
    await safeInvoke('payment-hub', { action: 'approve_payment', transaction_id: txId })
    toast.success('Payment approved'); load()
  }

  async function rejectPayment(txId) {
    await safeInvoke('payment-hub', { action: 'reject_payment', transaction_id: txId, reason: 'Rejected by admin' })
    toast.success('Payment rejected'); load()
  }

  const summary = data?.summary || {}
  const accounts = data?.accounts || []
  const recent = data?.recent_transactions || []
  const pending = data?.pending_approvals || []
  const payees = data?.top_payees || []
  const recurring = data?.recurring || []

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Payment Hub</h1>
          <p className="text-[13px] text-t3 mt-0.5">{accounts.length} accounts · {pending.length} pending approvals · {recurring.length} recurring</p>
        </div>
        <button onClick={() => setShowPayForm(!showPayForm)} className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[13px] font-semibold glow-sm hover:-translate-y-px transition-all flex items-center gap-2">
          <Send size={14} /> Send Payment
        </button>
      </div>

      {/* Account cards — bank-like */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map(acct => (
          <div key={acct.id} className="glass-card rounded-2xl p-5 border-cyan/[0.06]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-cyan/[0.08] flex items-center justify-center"><CreditCard size={14} className="text-cyan" /></div>
                <div>
                  <p className="text-[12px] font-bold text-t1">{acct.account_label}</p>
                  <p className="text-[9px] font-mono text-t4 uppercase">{acct.account_type} · {acct.currency}</p>
                </div>
              </div>
              <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${acct.status === 'active' ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{acct.status}</span>
            </div>
            <p className="font-mono text-[28px] font-black text-t1 terminal-data">{fmt(acct.current_balance)}</p>
            <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-t4">
              <span>Available: {fmt(acct.available_balance)}</span>
              {acct.pending_balance > 0 && <span className="text-amber">Pending: {fmt(acct.pending_balance)}</span>}
            </div>
            {acct.daily_transfer_limit && <div className="mt-2 h-1 rounded-full bg-border/20"><div className="h-full rounded-full bg-cyan/40" style={{ width: `${Math.min(100, ((Number(acct.daily_transfer_limit) - Number(acct.remaining_daily_limit || 0)) / Number(acct.daily_transfer_limit)) * 100)}%` }} /></div>}
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="col-span-full glass-card rounded-2xl p-8 text-center">
            <CreditCard size={28} className="text-t4 mx-auto mb-3" />
            <p className="text-[14px] text-t2">No payment accounts configured</p>
            <p className="text-[12px] text-t3 mt-1">Payment accounts are created automatically when you connect bank accounts.</p>
          </div>
        )}
      </div>

      {/* Send payment form */}
      {showPayForm && (
        <form onSubmit={sendPayment} className="glass-card rounded-2xl p-6 border-cyan/[0.08] space-y-4">
          <h3 className="text-[14px] font-bold text-t1 flex items-center gap-2"><Send size={14} className="text-cyan" /> Send Payment</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={payForm.to_payee_id} onChange={e => setPayForm({ ...payForm, to_payee_id: e.target.value })} required className="px-3 py-3 rounded-xl glass-input text-[12px] text-t1 outline-none">
              <option value="">Select payee</option>
              {payees.map(p => <option key={p.id} value={p.id}>{p.payee_name}</option>)}
            </select>
            <input type="number" step="0.01" min="0.01" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required placeholder="Amount ($)" className="px-3 py-3 rounded-xl glass-input text-[12px] text-t1 font-mono outline-none placeholder:text-t3" />
            <select value={payForm.payment_method} onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-[12px] text-t1 outline-none">
              {Object.entries(METHOD_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <input value={payForm.memo} onChange={e => setPayForm({ ...payForm, memo: e.target.value })} placeholder="Memo (optional)" className="px-3 py-3 rounded-xl glass-input text-[12px] text-t1 outline-none placeholder:text-t3" />
          </div>
          {parseFloat(payForm.amount) >= 10000 && (
            <div className="flex items-center gap-2 text-[11px] text-amber"><Shield size={12} /> Payments ≥$10,000 require admin approval</div>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void font-semibold text-[13px] hover:-translate-y-px transition-all disabled:opacity-50 flex items-center gap-2">
              {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send
            </button>
            <button type="button" onClick={() => setShowPayForm(false)} className="px-4 py-2 text-[12px] text-t3 hover:text-t1 transition">Cancel</button>
          </div>
        </form>
      )}

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['overview', 'approvals', 'payees', 'recurring', 'history'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'approvals' && pending.length > 0 ? `(${pending.length})` : ''}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">RECENT TRANSACTIONS</span>
          {recent.slice(0, 10).map(tx => (
            <div key={tx.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.to_account_id ? 'bg-purple/[0.08]' : 'bg-red/[0.06]'}`}>
                  {tx.to_account_id ? <ArrowRight size={14} className="text-purple" /> : <ArrowUpRight size={14} className="text-red" />}
                </div>
                <div>
                  <p className="text-[12px] font-medium text-t1">{tx.payees?.payee_name || tx.payment_accounts?.account_label || 'Transfer'}</p>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-t4">
                    <span>{tx.reference_number}</span>
                    <span>{METHOD_LABELS[tx.payment_method] || tx.payment_method}</span>
                    <span className={STATUS_STYLE[tx.status]}>{tx.status}</span>
                    {tx.memo && <span className="truncate max-w-[120px]">{tx.memo}</span>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-mono text-[14px] font-bold text-red terminal-data">-{fmt(tx.amount)}</p>
                <p className="text-[9px] font-mono text-t4">{new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</p>
              </div>
            </div>
          ))}
          {recent.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><FileText size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No transactions yet</p></div>}
        </div>
      )}

      {/* APPROVALS */}
      {tab === 'approvals' && (
        <div className="space-y-3">
          {pending.map(tx => (
            <div key={tx.id} className="glass-card rounded-xl p-5 border-amber/[0.1]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] font-mono font-bold text-amber bg-amber/[0.06] px-1.5 py-0.5 rounded">PENDING APPROVAL</span>
                    <span className="text-[9px] font-mono text-t4">{tx.reference_number}</span>
                  </div>
                  <p className="text-[14px] font-bold text-t1">{fmt(tx.amount)} → {tx.payees?.payee_name || 'Recipient'}</p>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-t4 mt-1">
                    <span>{METHOD_LABELS[tx.payment_method]}</span>
                    {tx.memo && <span>{tx.memo}</span>}
                    <span>{new Date(tx.created_at).toLocaleString()}</span>
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex items-center gap-2">
                    <button onClick={() => approvePayment(tx.id)} className="px-3 py-2 rounded-lg bg-green/[0.08] text-green border border-green/[0.12] hover:bg-green/[0.12] transition text-[11px] font-semibold flex items-center gap-1"><Check size={11} /> Approve</button>
                    <button onClick={() => rejectPayment(tx.id)} className="px-3 py-2 rounded-lg bg-red/[0.08] text-red border border-red/[0.12] hover:bg-red/[0.12] transition text-[11px] font-semibold flex items-center gap-1"><X size={11} /> Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {pending.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Check size={28} className="text-green mx-auto mb-3" /><p className="text-[14px] text-t2">No pending approvals</p></div>}
        </div>
      )}

      {/* PAYEES */}
      {tab === 'payees' && (
        <div className="space-y-2">
          {payees.map(p => (
            <div key={p.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-purple/[0.06] flex items-center justify-center"><Users size={13} className="text-purple" /></div>
                <div>
                  <p className="text-[13px] font-medium text-t1">{p.payee_name}</p>
                  <span className="text-[9px] font-mono text-t4 uppercase">{p.payee_type} · {p.payment_count} payments</span>
                </div>
              </div>
              <span className="font-mono text-[14px] font-bold text-t1 terminal-data">{fmt(p.total_paid)}</span>
            </div>
          ))}
        </div>
      )}

      {/* RECURRING */}
      {tab === 'recurring' && (
        <div className="space-y-2">
          {recurring.map(r => (
            <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Repeat size={14} className="text-purple" />
                <div>
                  <p className="text-[13px] font-medium text-t1">{r.payees?.payee_name || 'Payee'}</p>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-t4">
                    <span>{fmt(r.amount)} {r.frequency}</span>
                    <span>Next: {r.next_payment_date}</span>
                    <span>{r.payments_made} paid ({fmt(r.total_paid)})</span>
                  </div>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${r.status === 'active' ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{r.status}</span>
            </div>
          ))}
          {recurring.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Repeat size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No recurring payments</p></div>}
        </div>
      )}

      {/* HISTORY */}
      {tab === 'history' && (
        <div className="space-y-2">
          {recent.map(tx => (
            <div key={tx.id} className="glass-card rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[tx.status]}`}>{tx.status}</span>
                <span className="text-[12px] text-t1">{tx.payees?.payee_name || tx.reference_number}</span>
                <span className="text-[9px] font-mono text-t4">{METHOD_LABELS[tx.payment_method]}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[12px] font-bold text-t1 terminal-data">{fmt(tx.amount)}</span>
                <span className="text-[9px] font-mono text-t4">{new Date(tx.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
