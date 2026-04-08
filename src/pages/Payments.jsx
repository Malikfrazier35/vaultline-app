import { useState, useEffect, useMemo, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import {
  ArrowUpRight, ArrowDownLeft, Clock, CheckCircle2, AlertTriangle,
  Plus, Search, Filter, Download, Send, FileText, DollarSign,
  TrendingUp, TrendingDown, Calendar, Building2, CreditCard, Zap,
  ChevronRight, BarChart3, RefreshCw, Eye
} from 'lucide-react'

function fmt(n) { const a = Math.abs(n||0); return a >= 1e6 ? '$'+(a/1e6).toFixed(2)+'M' : a >= 1e3 ? '$'+(a/1e3).toFixed(1)+'K' : '$'+a.toFixed(0) }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) }
function daysUntil(d) { return Math.ceil((new Date(d) - new Date()) / 86400000) }

// Demo data — replaced with Supabase queries in production
const DEMO_RECEIVABLES = [
  { id: 'INV-001', client: 'Meridian Corp', amount: 48500, issued: '2026-02-15', due: '2026-03-17', status: 'overdue', category: 'subscription' },
  { id: 'INV-002', client: 'Apex Manufacturing', amount: 125000, issued: '2026-03-01', due: '2026-03-31', status: 'pending', category: 'subscription' },
  { id: 'INV-003', client: 'Horizon Labs', amount: 32000, issued: '2026-03-05', due: '2026-04-04', status: 'pending', category: 'services' },
  { id: 'INV-004', client: 'Stratus Holdings', amount: 89000, issued: '2026-02-20', due: '2026-03-22', status: 'pending', category: 'subscription' },
  { id: 'INV-005', client: 'Beacon Financial', amount: 215000, issued: '2026-03-10', due: '2026-04-09', status: 'sent', category: 'subscription' },
  { id: 'INV-006', client: 'Cerulean Partners', amount: 67500, issued: '2026-01-15', due: '2026-02-14', status: 'paid', paidDate: '2026-02-12', category: 'services' },
  { id: 'INV-007', client: 'Vantage Analytics', amount: 41000, issued: '2026-02-01', due: '2026-03-03', status: 'paid', paidDate: '2026-03-01', category: 'subscription' },
]

const DEMO_PAYABLES = [
  { id: 'AP-001', vendor: 'AWS', amount: 12400, due: '2026-03-20', status: 'scheduled', category: 'infrastructure' },
  { id: 'AP-002', vendor: 'Supabase', amount: 599, due: '2026-03-25', status: 'scheduled', category: 'infrastructure' },
  { id: 'AP-003', vendor: 'Vercel', amount: 320, due: '2026-03-28', status: 'pending', category: 'infrastructure' },
  { id: 'AP-004', vendor: 'Plaid', amount: 2500, due: '2026-04-01', status: 'pending', category: 'integrations' },
  { id: 'AP-005', vendor: 'Stripe', amount: 8900, due: '2026-03-30', status: 'pending', category: 'payments' },
  { id: 'AP-006', vendor: 'Google Workspace', amount: 1800, due: '2026-04-01', status: 'pending', category: 'operations' },
  { id: 'AP-007', vendor: 'Legal Counsel', amount: 15000, due: '2026-03-22', status: 'overdue', category: 'professional' },
]

const STATUS_STYLES = {
  paid: { bg: 'bg-green/[0.06]', text: 'text-green', border: 'border-green/[0.08]', icon: CheckCircle2, label: 'PAID' },
  sent: { bg: 'bg-blue-400/[0.06]', text: 'text-blue-400', border: 'border-blue-400/[0.08]', icon: Send, label: 'SENT' },
  pending: { bg: 'bg-amber/[0.06]', text: 'text-amber', border: 'border-amber/[0.08]', icon: Clock, label: 'PENDING' },
  scheduled: { bg: 'bg-purple/[0.06]', text: 'text-purple', border: 'border-purple/[0.08]', icon: Calendar, label: 'SCHEDULED' },
  overdue: { bg: 'bg-red/[0.06]', text: 'text-red', border: 'border-red/[0.08]', icon: AlertTriangle, label: 'OVERDUE' },
}

function StatusBadge({ status }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${s.bg} ${s.text} ${s.border}`}>
      <Icon size={10} />
      {s.label}
    </span>
  )
}

export default function Payments() {
  const { org, profile } = useAuth()
  const { transactions } = useTreasury()
  const { isDark } = useTheme()
  const [tab, setTab] = useState('receivables') // receivables | payables | overview
  const [searchQ, setSearchQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [liveInvoices, setLiveInvoices] = useState(null)
  const [livePayables, setLivePayables] = useState(null)

  useEffect(() => { document.title = 'Payments — Vaultline' }, [])

  // Fetch live data, fall back to demo
  useEffect(() => {
    if (!org?.id) return
    supabase.from('invoices').select('*').eq('org_id', org.id).order('due_date', { ascending: false }).then(({ data }) => {
      if (data?.length) setLiveInvoices(data.map(d => ({ ...d, id: d.invoice_number || d.id.slice(0, 8), client: d.client_name, issued: d.issued_date, due: d.due_date })))
    })
    supabase.from('payables').select('*').eq('org_id', org.id).order('due_date', { ascending: false }).then(({ data }) => {
      if (data?.length) setLivePayables(data.map(d => ({ ...d, id: d.bill_number || d.id.slice(0, 8), vendor: d.vendor_name, due: d.due_date })))
    })
  }, [org?.id])

  const receivables = liveInvoices || DEMO_RECEIVABLES
  const payables = livePayables || DEMO_PAYABLES

  // AR metrics
  const arMetrics = useMemo(() => {
    const active = receivables.filter(r => r.status !== 'paid')
    const outstanding = active.reduce((s, r) => s + r.amount, 0)
    const overdue = active.filter(r => r.status === 'overdue')
    const overdueTotal = overdue.reduce((s, r) => s + r.amount, 0)
    const paid30d = receivables.filter(r => r.status === 'paid')
    const collected = paid30d.reduce((s, r) => s + r.amount, 0)
    const avgDSO = paid30d.length > 0 ? paid30d.reduce((s, r) => s + daysUntil(r.paidDate) + Math.abs(daysUntil(r.issued)), 0) / paid30d.length : 0
    return { outstanding, overdueTotal, overdueCount: overdue.length, collected, avgDSO: Math.round(Math.abs(avgDSO)) }
  }, [])

  // AP metrics
  const apMetrics = useMemo(() => {
    const active = payables.filter(p => p.status !== 'paid')
    const outstanding = active.reduce((s, p) => s + p.amount, 0)
    const overdue = active.filter(p => p.status === 'overdue')
    const overdueTotal = overdue.reduce((s, p) => s + p.amount, 0)
    const dueSoon = active.filter(p => p.status !== 'overdue' && daysUntil(p.due) <= 7)
    const dueSoonTotal = dueSoon.reduce((s, p) => s + p.amount, 0)
    return { outstanding, overdueTotal, overdueCount: overdue.length, dueSoonTotal, dueSoonCount: dueSoon.length }
  }, [])

  // Net position
  const netPosition = arMetrics.outstanding - apMetrics.outstanding

  // Filtered items
  const filteredAR = useMemo(() => {
    return receivables
      .filter(r => statusFilter === 'all' || r.status === statusFilter)
      .filter(r => !searchQ || r.client.toLowerCase().includes(searchQ.toLowerCase()) || r.id.toLowerCase().includes(searchQ.toLowerCase()))
      .sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1
        if (b.status === 'overdue' && a.status !== 'overdue') return 1
        return new Date(a.due) - new Date(b.due)
      })
  }, [searchQ, statusFilter])

  const filteredAP = useMemo(() => {
    return payables
      .filter(p => statusFilter === 'all' || p.status === statusFilter)
      .filter(p => !searchQ || p.vendor.toLowerCase().includes(searchQ.toLowerCase()) || p.id.toLowerCase().includes(searchQ.toLowerCase()))
      .sort((a, b) => {
        if (a.status === 'overdue' && b.status !== 'overdue') return -1
        if (b.status === 'overdue' && a.status !== 'overdue') return 1
        return new Date(a.due) - new Date(b.due)
      })
  }, [searchQ, statusFilter])

  const tabs = [
    { id: 'overview', label: 'OVERVIEW', icon: BarChart3 },
    { id: 'receivables', label: 'RECEIVABLES', icon: ArrowDownLeft, count: receivables.filter(r => r.status !== 'paid').length },
    { id: 'payables', label: 'PAYABLES', icon: ArrowUpRight, count: payables.filter(p => p.status !== 'paid').length },
  ]

  return (
    <div className="space-y-5">
      {/* Header + Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">PAYMENTS</span>
          <span className="text-[11px] font-mono text-t3">AP/AR</span>
        </div>
        <div className="flex items-center gap-2">
          {tabs.map(t => {
            const Icon = t.icon
            return (
              <button key={t.id} onClick={() => { setTab(t.id); setStatusFilter('all'); setSearchQ('') }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-bold transition-all ${
                  tab === t.id ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'
                }`}>
                <Icon size={12} />
                {t.label}
                {t.count != null && <span className={`ml-1 px-1.5 py-0.5 rounded text-[9px] ${tab === t.id ? 'bg-cyan/[0.12]' : 'bg-deep'}`}>{t.count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === 'overview' && (
        <>
          {/* Net Position Hero */}
          <div className="glass-card rounded-2xl p-6 terminal-scanlines relative hover:border-border-hover transition-colors">
            <div className="relative z-[2]">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-cyan/[0.08]">
                  <DollarSign size={16} className="text-cyan" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">NET AR/AP POSITION</span>
                </div>
              </div>
              <div className="flex items-baseline gap-3">
                <span className={`font-mono text-[32px] font-black tracking-tight terminal-data ${netPosition >= 0 ? 'text-green' : 'text-red'}`}>
                  {netPosition >= 0 ? '+' : ''}{fmt(netPosition)}
                </span>
                <span className="text-[13px] text-t3">
                  {netPosition >= 0 ? 'Net receivable — healthy position' : 'Net payable — monitor closely'}
                </span>
              </div>
            </div>
          </div>

          {/* AR / AP Side by Side */}
          <div className="grid grid-cols-2 gap-4">
            {/* AR Summary */}
            <div className="glass-card rounded-2xl p-5 hover:border-border-hover transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-green/[0.08]">
                    <ArrowDownLeft size={14} className="text-green" />
                  </div>
                  <span className="terminal-label text-green">ACCOUNTS RECEIVABLE</span>
                </div>
                <button onClick={() => setTab('receivables')} className="text-[11px] font-mono text-t3 hover:text-cyan flex items-center gap-1 transition-colors">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Outstanding</span>
                  <span className="font-mono text-[18px] font-bold text-t1 terminal-data">{fmt(arMetrics.outstanding)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Overdue ({arMetrics.overdueCount})</span>
                  <span className="font-mono text-[15px] font-bold text-red terminal-data">{fmt(arMetrics.overdueTotal)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Collected (30d)</span>
                  <span className="font-mono text-[15px] font-bold text-green terminal-data">{fmt(arMetrics.collected)}</span>
                </div>
                <div className="h-px bg-border/30 my-2" />
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Avg DSO</span>
                  <span className="font-mono text-[15px] font-bold text-t2 terminal-data">{arMetrics.avgDSO} days</span>
                </div>
              </div>
            </div>

            {/* AP Summary */}
            <div className="glass-card rounded-2xl p-5 hover:border-border-hover transition-colors">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-red/[0.08]">
                    <ArrowUpRight size={14} className="text-red" />
                  </div>
                  <span className="terminal-label text-red">ACCOUNTS PAYABLE</span>
                </div>
                <button onClick={() => setTab('payables')} className="text-[11px] font-mono text-t3 hover:text-cyan flex items-center gap-1 transition-colors">
                  View all <ChevronRight size={12} />
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Outstanding</span>
                  <span className="font-mono text-[18px] font-bold text-t1 terminal-data">{fmt(apMetrics.outstanding)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Overdue ({apMetrics.overdueCount})</span>
                  <span className="font-mono text-[15px] font-bold text-red terminal-data">{fmt(apMetrics.overdueTotal)}</span>
                </div>
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Due within 7d ({apMetrics.dueSoonCount})</span>
                  <span className="font-mono text-[15px] font-bold text-amber terminal-data">{fmt(apMetrics.dueSoonTotal)}</span>
                </div>
                <div className="h-px bg-border/30 my-2" />
                <div className="flex justify-between items-baseline">
                  <span className="text-[12px] text-t3">Scheduled</span>
                  <span className="font-mono text-[15px] font-bold text-purple terminal-data">{payables.filter(p => p.status === 'scheduled').length} payments</span>
                </div>
              </div>
            </div>
          </div>

          {/* Cash Impact Timeline */}
          <div className="glass-card rounded-2xl p-5 hover:border-border-hover transition-colors">
            <div className="flex items-center gap-2 mb-4">
              <Calendar size={14} className="text-cyan" />
              <span className="terminal-label">UPCOMING CASH IMPACT (NEXT 14 DAYS)</span>
            </div>
            <div className="space-y-2">
              {[...receivables.filter(r => r.status !== 'paid' && daysUntil(r.due) <= 14 && daysUntil(r.due) >= -7).map(r => ({ ...r, type: 'ar', name: r.client })),
                ...payables.filter(p => p.status !== 'paid' && daysUntil(p.due) <= 14 && daysUntil(p.due) >= -7).map(p => ({ ...p, type: 'ap', name: p.vendor }))]
                .sort((a, b) => new Date(a.due) - new Date(b.due))
                .map(item => {
                  const days = daysUntil(item.due)
                  const isAR = item.type === 'ar'
                  return (
                    <div key={item.id} className="flex items-center justify-between py-2 px-3 rounded-xl bg-deep/50 border border-border/30">
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${isAR ? 'bg-green/[0.08]' : 'bg-red/[0.08]'}`}>
                          {isAR ? <ArrowDownLeft size={12} className="text-green" /> : <ArrowUpRight size={12} className="text-red" />}
                        </div>
                        <div>
                          <span className="text-[13px] text-t1 font-medium">{item.name}</span>
                          <span className="text-[11px] text-t3 ml-2 font-mono">{item.id}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-[11px] font-mono ${days < 0 ? 'text-red' : days <= 3 ? 'text-amber' : 'text-t3'}`}>
                          {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d`}
                        </span>
                        <span className={`font-mono text-[14px] font-bold terminal-data ${isAR ? 'text-green' : 'text-red'}`}>
                          {isAR ? '+' : '-'}{fmt(item.amount)}
                        </span>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </>
      )}

      {/* ── RECEIVABLES TAB ── */}
      {tab === 'receivables' && (
        <>
          {/* AR KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'OUTSTANDING', value: fmt(arMetrics.outstanding), icon: DollarSign, color: 'cyan' },
              { label: 'OVERDUE', value: fmt(arMetrics.overdueTotal), icon: AlertTriangle, color: 'red', sub: `${arMetrics.overdueCount} invoices` },
              { label: 'COLLECTED 30D', value: fmt(arMetrics.collected), icon: CheckCircle2, color: 'green' },
              { label: 'AVG DSO', value: `${arMetrics.avgDSO}d`, icon: Clock, color: 'amber' },
            ].map(k => {
              const Icon = k.icon
              const cm = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', red: 'bg-red/[0.08] text-red', amber: 'bg-amber/[0.08] text-amber' }
              return (
                <div key={k.label} className="glass-card rounded-xl p-4 hover:border-border-hover transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm[k.color]}`}><Icon size={15} /></div>
                    <span className="text-[9px] font-mono text-t3 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className="font-mono text-[22px] font-black text-t1 terminal-data tracking-tight">{k.value}</p>
                  {k.sub && <p className="text-[11px] text-t3 font-mono mt-1">{k.sub}</p>}
                </div>
              )
            })}
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3" />
              <input
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search invoices..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-deep border border-border text-[13px] text-t1 placeholder:text-t4 focus:outline-none focus:border-cyan/[0.3] transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
              {['all', 'overdue', 'pending', 'sent', 'paid'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                    statusFilter === s ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'
                  }`}>{s.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Invoice Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Invoice', 'Client', 'Amount', 'Issued', 'Due', 'Status'].map(h => (
                    <th key={h} className="text-left text-[10px] font-mono text-t3 uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAR.map(inv => {
                  const days = daysUntil(inv.due)
                  return (
                    <tr key={inv.id} className="border-b border-border/30 hover:bg-deep/50 transition-colors cursor-pointer">
                      <td className="px-5 py-3"><span className="font-mono text-[13px] text-cyan">{inv.id}</span></td>
                      <td className="px-5 py-3"><span className="text-[13px] text-t1 font-medium">{inv.client}</span></td>
                      <td className="px-5 py-3"><span className="font-mono text-[13px] text-t1 font-bold terminal-data">{fmt(inv.amount)}</span></td>
                      <td className="px-5 py-3"><span className="font-mono text-[12px] text-t3">{fmtDate(inv.issued)}</span></td>
                      <td className="px-5 py-3">
                        <span className={`font-mono text-[12px] ${days < 0 ? 'text-red' : days <= 3 ? 'text-amber' : 'text-t3'}`}>
                          {fmtDate(inv.due)} {days < 0 ? `(${Math.abs(days)}d late)` : days <= 7 ? `(${days}d)` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                    </tr>
                  )
                })}
                {filteredAR.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-t3">No invoices match filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ── PAYABLES TAB ── */}
      {tab === 'payables' && (
        <>
          {/* AP KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'OUTSTANDING', value: fmt(apMetrics.outstanding), icon: DollarSign, color: 'cyan' },
              { label: 'OVERDUE', value: fmt(apMetrics.overdueTotal), icon: AlertTriangle, color: 'red', sub: `${apMetrics.overdueCount} bills` },
              { label: 'DUE 7D', value: fmt(apMetrics.dueSoonTotal), icon: Clock, color: 'amber', sub: `${apMetrics.dueSoonCount} payments` },
              { label: 'SCHEDULED', value: `${payables.filter(p => p.status === 'scheduled').length}`, icon: Calendar, color: 'purple' },
            ].map(k => {
              const Icon = k.icon
              const cm = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', red: 'bg-red/[0.08] text-red', amber: 'bg-amber/[0.08] text-amber', purple: 'bg-purple/[0.08] text-purple' }
              return (
                <div key={k.label} className="glass-card rounded-xl p-4 hover:border-border-hover transition-all">
                  <div className="flex items-center justify-between mb-2">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cm[k.color]}`}><Icon size={15} /></div>
                    <span className="text-[9px] font-mono text-t3 uppercase tracking-wider">{k.label}</span>
                  </div>
                  <p className="font-mono text-[22px] font-black text-t1 terminal-data tracking-tight">{k.value}</p>
                  {k.sub && <p className="text-[11px] text-t3 font-mono mt-1">{k.sub}</p>}
                </div>
              )
            })}
          </div>

          {/* Search + Filter */}
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t3" />
              <input
                value={searchQ} onChange={e => setSearchQ(e.target.value)}
                placeholder="Search vendors..."
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-deep border border-border text-[13px] text-t1 placeholder:text-t4 focus:outline-none focus:border-cyan/[0.3] transition-colors"
              />
            </div>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-deep border border-border">
              {['all', 'overdue', 'pending', 'scheduled'].map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-bold transition-all ${
                    statusFilter === s ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'
                  }`}>{s.toUpperCase()}</button>
              ))}
            </div>
          </div>

          {/* Payables Table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['ID', 'Vendor', 'Amount', 'Due', 'Category', 'Status'].map(h => (
                    <th key={h} className="text-left text-[10px] font-mono text-t3 uppercase tracking-wider px-5 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAP.map(bill => {
                  const days = daysUntil(bill.due)
                  return (
                    <tr key={bill.id} className="border-b border-border/30 hover:bg-deep/50 transition-colors cursor-pointer">
                      <td className="px-5 py-3"><span className="font-mono text-[13px] text-cyan">{bill.id}</span></td>
                      <td className="px-5 py-3"><span className="text-[13px] text-t1 font-medium">{bill.vendor}</span></td>
                      <td className="px-5 py-3"><span className="font-mono text-[13px] text-t1 font-bold terminal-data">{fmt(bill.amount)}</span></td>
                      <td className="px-5 py-3">
                        <span className={`font-mono text-[12px] ${days < 0 ? 'text-red' : days <= 3 ? 'text-amber' : 'text-t3'}`}>
                          {fmtDate(bill.due)} {days < 0 ? `(${Math.abs(days)}d late)` : days <= 7 ? `(${days}d)` : ''}
                        </span>
                      </td>
                      <td className="px-5 py-3"><span className="text-[12px] text-t3 capitalize">{bill.category}</span></td>
                      <td className="px-5 py-3"><StatusBadge status={bill.status} /></td>
                    </tr>
                  )
                })}
                {filteredAP.length === 0 && (
                  <tr><td colSpan={6} className="px-5 py-12 text-center text-[13px] text-t3">No payables match filters</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Terminal status */}
      <div className="glass-card rounded-xl overflow-hidden">
        <div className="px-4 py-2 flex items-center justify-between border-t border-border/30 text-[10px] font-mono text-t4">
          <div className="flex items-center gap-5">
            <span className="terminal-live">LIVE</span>
            <span>AR: <span className="text-green">{fmt(arMetrics.outstanding)}</span></span>
            <span>AP: <span className="text-red">{fmt(apMetrics.outstanding)}</span></span>
            <span>NET: <span className={netPosition >= 0 ? 'text-green' : 'text-red'}>{netPosition >= 0 ? '+' : ''}{fmt(netPosition)}</span></span>
          </div>
          <span className="text-t4">DEMO DATA • Connect ERP for live sync</span>
        </div>
      </div>
    </div>
  )
}
