import { SkeletonPage } from "@/components/Skeleton"
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Users, Plus, DollarSign, TrendingUp, Target, ArrowRight,
  Copy, Check, Globe, Zap, ExternalLink, ChevronRight,
  Loader2, Building2, Award
} from 'lucide-react'

const TIER_BADGE = {
  standard: { bg: 'bg-t3/[0.06]', text: 'text-t2' },
  silver: { bg: 'bg-cyan/[0.06]', text: 'text-cyan' },
  gold: { bg: 'bg-amber/[0.06]', text: 'text-amber' },
  platinum: { bg: 'bg-purple/[0.06]', text: 'text-purple' },
}
const TYPE_LABEL = { referral: 'Referral', reseller: 'Reseller', technology: 'Technology', consulting: 'Consulting', integration: 'Integration' }

function fmt(n) { return n >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n/1e3).toFixed(1)}K` : `$${n.toFixed(0)}` }

export default function PartnerAdmin() {
  const { profile } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('overview') // overview | partners | referrals | create
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  // Create form
  const [form, setForm] = useState({ name: '', type: 'referral', tier: 'standard', contact_name: '', contact_email: '', company_url: '', commission_pct: 10, webhook_url: '' })
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('partners', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(e) {
    e.preventDefault()
    setCreating(true)
    const { data: d } = await safeInvoke('partners', { action: 'create_partner', ...form })
    if (d?.success) {
      toast.success(`Partner "${form.name}" created`)
      setForm({ name: '', type: 'referral', tier: 'standard', contact_name: '', contact_email: '', company_url: '', commission_pct: 10, webhook_url: '' })
      setTab('partners'); load()
    } else { toast.error(d?.error || 'Failed') }
    setCreating(false)
  }

  async function payCommission(refId) {
    await safeInvoke('partners', { action: 'pay_commission', referral_id: refId })
    toast.success('Commission marked as paid')
    load()
  }

  function copyCode(code) {
    navigator.clipboard.writeText(`https://www.vaultline.app/signup?ref=${code}`)
    setCopied(code)
    setTimeout(() => setCopied(''), 2000)
  }

  const stats = data?.stats || {}

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Partner Program</h1>
          <p className="text-[13px] text-t3 mt-0.5">{stats.total_partners || 0} active partners · {stats.total_referrals || 0} referrals</p>
        </div>
        <button onClick={() => setTab('create')} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2">
          <Plus size={14} /> Add Partner
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['overview', 'partners', 'referrals', 'create'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'create' ? 'Add Partner' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Partners', value: stats.total_partners, icon: Users, color: 'cyan' },
              { label: 'Referrals', value: stats.total_referrals, sub: `${stats.conversion_rate}% conversion`, icon: Target, color: 'purple' },
              { label: 'Partner MRR', value: fmt(stats.total_mrr || 0), icon: TrendingUp, color: 'green' },
              { label: 'Unpaid Commissions', value: fmt(stats.unpaid_commissions || 0), icon: DollarSign, color: 'amber' },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg bg-${k.color}/[0.08] flex items-center justify-center`}><Icon size={14} className={`text-${k.color}`} /></div>
                    <span className="text-[11px] text-t3">{k.label}</span>
                  </div>
                  <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
                  {k.sub && <p className="text-[10px] text-t4 font-mono mt-0.5">{k.sub}</p>}
                </div>
              )
            })}
          </div>

          {/* Recent referrals */}
          {(data?.recent_referrals || []).length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <h3 className="text-[13px] font-bold text-t2 mb-3">Recent Referrals</h3>
              <div className="space-y-2">
                {data.recent_referrals.slice(0, 8).map(r => (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                    <div>
                      <span className="text-[12px] text-t1">{r.referred_email}</span>
                      <span className={`ml-2 text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${r.status === 'converted' ? 'bg-green/[0.06] text-green' : r.status === 'pending' ? 'bg-amber/[0.06] text-amber' : 'bg-cyan/[0.06] text-cyan'}`}>{r.status}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {r.commission_amount > 0 && (
                        <span className="font-mono text-[11px] text-green terminal-data">{fmt(r.commission_amount)}</span>
                      )}
                      {r.commission_amount > 0 && !r.commission_paid && (
                        <button onClick={() => payCommission(r.id)} className="text-[10px] text-amber hover:text-green transition">Pay</button>
                      )}
                      <span className="text-[9px] font-mono text-t4">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PARTNERS LIST ── */}
      {tab === 'partners' && (
        <div className="space-y-3">
          {(data?.partners || []).length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Building2 size={28} className="text-t4 mx-auto mb-3" />
              <p className="text-[14px] text-t2">No partners yet</p>
            </div>
          ) : (
            (data.partners).map(p => {
              const tb = TIER_BADGE[p.tier] || TIER_BADGE.standard
              return (
                <div key={p.id} className="glass-card rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-[14px] font-bold text-t1">{p.name}</h3>
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${tb.bg} ${tb.text}`}>{p.tier}</span>
                        <span className="text-[9px] font-mono text-t4">{TYPE_LABEL[p.type]}</span>
                      </div>
                      <p className="text-[11px] text-t3">{p.contact_name} · {p.contact_email}</p>
                      <div className="flex items-center gap-4 mt-2">
                        <span className="text-[10px] font-mono text-t4">{p.total_referrals} referrals</span>
                        <span className="text-[10px] font-mono text-t4">{p.total_customers} customers</span>
                        <span className="text-[10px] font-mono text-green">{fmt(p.total_revenue)} revenue</span>
                        <span className="text-[10px] font-mono text-t4">{p.commission_pct}% commission</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => copyCode(p.referral_code)}
                        className="px-2.5 py-1.5 rounded-lg text-[10px] font-mono bg-deep border border-border text-t2 hover:text-cyan hover:border-cyan/20 transition flex items-center gap-1.5">
                        {copied === p.referral_code ? <Check size={10} className="text-green" /> : <Copy size={10} />}
                        {p.referral_code}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── REFERRALS ── */}
      {tab === 'referrals' && (
        <div className="glass-card rounded-2xl p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-t3 font-mono uppercase text-[10px] tracking-wider">
                  <th className="text-left py-2 pr-3">Email</th>
                  <th className="text-left py-2 pr-3">Status</th>
                  <th className="text-left py-2 pr-3">Plan</th>
                  <th className="text-right py-2 pr-3">MRR</th>
                  <th className="text-right py-2 pr-3">Commission</th>
                  <th className="text-right py-2">Paid</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recent_referrals || []).map(r => (
                  <tr key={r.id} className="border-t border-border/10">
                    <td className="py-2.5 pr-3 text-t1">{r.referred_email}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${r.status === 'converted' ? 'bg-green/[0.06] text-green' : 'bg-amber/[0.06] text-amber'}`}>{r.status}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-t2">{r.plan || '—'}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-t2">{r.mrr ? fmt(r.mrr) : '—'}</td>
                    <td className="py-2.5 pr-3 text-right font-mono text-green">{r.commission_amount > 0 ? fmt(r.commission_amount) : '—'}</td>
                    <td className="py-2.5 text-right">
                      {r.commission_paid ? <Check size={12} className="text-green inline" /> : r.commission_amount > 0 ? (
                        <button onClick={() => payCommission(r.id)} className="text-[10px] text-amber hover:text-green transition">Pay</button>
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CREATE ── */}
      {tab === 'create' && (
        <form onSubmit={handleCreate} className="glass-card rounded-2xl p-6 space-y-4 max-w-2xl">
          <h2 className="text-[15px] font-bold text-t1">Add New Partner</h2>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Partner name"
              className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              <option value="referral">Referral</option><option value="reseller">Reseller</option><option value="technology">Technology</option><option value="consulting">Consulting</option><option value="integration">Integration</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.contact_name} onChange={e => setForm({ ...form, contact_name: e.target.value })} placeholder="Contact name"
              className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
            <input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} type="email" placeholder="Contact email"
              className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <input value={form.company_url} onChange={e => setForm({ ...form, company_url: e.target.value })} placeholder="Company URL"
              className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
            <select value={form.tier} onChange={e => setForm({ ...form, tier: e.target.value })}
              className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              <option value="standard">Standard</option><option value="silver">Silver</option><option value="gold">Gold</option><option value="platinum">Platinum</option>
            </select>
            <div className="flex items-center gap-2">
              <input value={form.commission_pct} onChange={e => setForm({ ...form, commission_pct: parseFloat(e.target.value) || 0 })} type="number" min="0" max="50" step="1"
                className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition" />
              <span className="text-[12px] text-t3 flex-shrink-0">% commission</span>
            </div>
          </div>
          <input value={form.webhook_url} onChange={e => setForm({ ...form, webhook_url: e.target.value })} placeholder="Webhook URL (optional)"
            className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
          <button type="submit" disabled={creating}
            className="px-5 py-2.5 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2 disabled:opacity-50">
            {creating ? <><Loader2 size={13} className="animate-spin" /> Creating...</> : <><Plus size={13} /> Create Partner</>}
          </button>
        </form>
      )}
    </div>
  )
}
