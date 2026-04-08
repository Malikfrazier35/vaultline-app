import { useTreasury } from '@/hooks/useTreasury'
import { SkeletonPage } from '@/components/Skeleton'
import BankLogo from '@/components/BankLogo'
import { useState, useMemo, useEffect } from 'react'
import { TrendingUp, TrendingDown, List, AlertCircle, Search, Download, ChevronLeft, ChevronRight, ArrowUpRight, ArrowDownRight, Filter } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { ChartTooltip } from '@/components/ChartTooltip'
import { useChartTheme } from '@/hooks/useChartTheme'
import { useTheme } from '@/hooks/useTheme'

const CAT = {
  revenue: { bg: 'bg-green/[0.08]', text: 'text-green', label: 'Revenue', color: '#34D399' },
  payroll: { bg: 'bg-purple/[0.08]', text: 'text-purple', label: 'Payroll', color: '#818CF8' },
  vendor: { bg: 'bg-amber/[0.08]', text: 'text-amber', label: 'Vendor', color: '#FBBF24' },
  saas: { bg: 'bg-[rgba(129,140,248,0.08)]', text: 'text-purple', label: 'SaaS', color: '#A78BFA' },
  tax: { bg: 'bg-red/[0.08]', text: 'text-red', label: 'Tax', color: '#FB7185' },
  transfer: { bg: 'bg-cyan/[0.08]', text: 'text-cyan', label: 'Transfer', color: '#22D3EE' },
  operations: { bg: 'bg-[rgba(148,163,184,0.06)]', text: 'text-t2', label: 'Ops', color: '#94A3B8' },
  other: { bg: 'bg-[rgba(148,163,184,0.06)]', text: 'text-t3', label: 'Other', color: '#64748B' },
}

const PAGE_SIZE = 20

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e5) return '$' + (abs / 1e3).toFixed(0) + 'K'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

export default function Transactions() {
  const { transactions, loading } = useTreasury()
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('all')
  const [page, setPage] = useState(0)
  const ct = useChartTheme()
  const { isDark } = useTheme()
  const [toastMsg, setToastMsg] = useState(null)

  useEffect(() => { document.title = 'Transactions — Vaultline' }, [])
  useEffect(() => { setPage(0) }, [search, catFilter])

  const filtered = useMemo(() => {
    return transactions.filter((tx) => {
      const q = search.toLowerCase()
      const matchSearch = !search || (tx.description || '').toLowerCase().includes(q) || (tx.accounts?.bank_connections?.institution_name || '').toLowerCase().includes(q)
      const matchCat = catFilter === 'all' || tx.category === catFilter
      return matchSearch && matchCat
    })
  }, [transactions, search, catFilter])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const totalInflows = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
  const totalOutflows = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const untagged = transactions.filter(t => !t.category).length

  // Category breakdown for pie chart
  const catData = useMemo(() => {
    const map = {}
    transactions.forEach(t => {
      const c = t.category || 'other'
      map[c] = (map[c] || 0) + Math.abs(t.amount)
    })
    return Object.entries(map).map(([cat, total]) => ({
      name: CAT[cat]?.label || cat, value: total, color: CAT[cat]?.color || '#64748B'
    })).sort((a, b) => b.value - a.value)
  }, [transactions])

  // Daily volume for sparkline
  const dailyVolume = useMemo(() => {
    const map = {}
    transactions.slice(0, 100).forEach(t => {
      if (!map[t.date]) map[t.date] = { date: t.date, in: 0, out: 0 }
      if (t.amount < 0) map[t.date].in += Math.abs(t.amount)
      else map[t.date].out += t.amount
    })
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).slice(-14)
  }, [transactions])

  function exportCSV() {
    setToastMsg('Exporting CSV...'); setTimeout(() => setToastMsg(null), 2000)
    const headers = ['Date', 'Description', 'Amount', 'Category', 'Account', 'Status']
    const rows = filtered.map(tx => [tx.date, `"${(tx.description || '').replace(/"/g, '""')}"`, tx.amount, tx.category || '', tx.accounts?.bank_connections?.institution_name || '', tx.is_pending ? 'Pending' : 'Cleared'])
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `vaultline-transactions-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
  }

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-7">
      {/* Premium stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <PremiumStat icon={TrendingUp} color="green" label="Inflows" value={fmt(totalInflows)} sub="Last 30 days" arrow="up" />
        <PremiumStat icon={TrendingDown} color="red" label="Outflows" value={fmt(totalOutflows)} sub="Last 30 days" arrow="down" />
        <PremiumStat icon={List} color="cyan" label="Total Transactions" value={transactions.length.toString()} sub={`${filtered.length} filtered`} />
        <PremiumStat icon={AlertCircle} color="amber" label="Untagged" value={untagged.toString()} sub={untagged > 0 ? 'Need categorization' : 'All categorized'} />
      </div>

      {/* Charts row — category pie + daily volume */}
      {transactions.length > 0 && (
        <div className="grid grid-cols-[1fr_1.5fr] gap-4">
          <div className="glass-card rounded-2xl p-5 terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors">
            <span className="terminal-label mb-1">SPEND BY CATEGORY</span>
            <p className="text-[12px] text-t3 mb-3">Transaction volume breakdown</p>
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                    {catData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip isDark={isDark} />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2">
              {catData.slice(0, 6).map(d => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: d.color }} />
                  <span className="text-[12px] text-t3 truncate">{d.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors">
            <span className="terminal-label mb-1">DAILY VOLUME</span>
            <p className="text-[12px] text-t3 mb-3">Inflows vs outflows by day</p>
            <div className="h-[200px]">
              {dailyVolume.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dailyVolume} barGap={1}>
                    <XAxis dataKey="date" tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false}
                      tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })} />
                    <YAxis tick={{ fontSize: 9, fill: ct.tick }} tickLine={false} axisLine={false} width={50}
                      tickFormatter={v => `$${(v/1e3).toFixed(0)}K`} />
                    <Tooltip content={<ChartTooltip isDark={isDark} formatLabel={v => new Date(v).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: '2-digit' })} />} />
                    <Bar dataKey="in" name="Inflows" fill={ct.bar.inflows} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="out" name="Outflows" fill={ct.bar.outflows} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex items-center justify-center text-[13px] text-t2">Not enough data</div>}
            </div>
          </div>
        </div>
      )}

      {/* Premium table */}
      <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors">
        <div className="flex items-center justify-between px-6 py-5 border-b border-border">
          <div>
            <span className="terminal-label">ALL TRANSACTIONS</span>
            <p className="text-[13px] text-t2 mt-0.5">{filtered.length} results {catFilter !== 'all' ? `· filtered by ${CAT[catFilter]?.label}` : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 glass-input rounded-xl px-3.5 py-2">
              <Search size={14} className="text-t3" />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-[13px] text-t1 outline-none w-44 placeholder:text-t3" placeholder="Search transactions..." />
            </div>
            <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
              className="glass-input rounded-xl px-3 py-2 text-[13px] text-t2 outline-none cursor-pointer hover:border-border-hover active:border-border-hover transition">
              <option value="all">All Categories</option>
              {Object.entries(CAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <button onClick={exportCSV} disabled={filtered.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-[13px] font-semibold text-t3 hover:text-t1 hover:border-border-hover active:border-border-hover transition disabled:opacity-30">
              <Download size={13} /> Export
            </button>
          </div>
        </div>
        <div className="overflow-x-auto -mx-5 px-5"><table className="w-full min-w-[640px]">
          <thead>
            <tr className="terminal-inset">
              {['Date', 'Description', 'Category', 'Account', 'Amount', 'Status'].map((h) => (
                <th key={h} className="text-left px-6 py-3 text-[12px] font-semibold text-t3 uppercase tracking-[0.08em] border-b border-border">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paged.map((tx) => {
              const cat = CAT[tx.category] || CAT.other
              const isCredit = tx.amount < 0
              return (
                <tr key={tx.id} className="hover:bg-deep active:bg-deep transition border-b border-border last:border-0 group">
                  <td className="px-6 py-3.5 text-[14px] text-t2">{new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</td>
                  <td className="px-6 py-3.5 text-[14px] text-t1 font-medium max-w-[280px] truncate">{tx.description}</td>
                  <td className="px-6 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2 py-[3px] rounded-md text-[12px] font-semibold ${cat.bg} ${cat.text}`}>
                      <span className="w-[5px] h-[5px] rounded-full" style={{ background: cat.color }} />{cat.label}
                    </span>
                  </td>
                  <td className="px-6 py-3.5 text-[13px] text-t2">
                    <span className="inline-flex items-center gap-2">
                      <BankLogo name={tx.accounts?.bank_connections?.institution_name} size={20} className="shrink-0" />
                      {tx.accounts?.bank_connections?.institution_name || '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className={`font-mono text-[14px] font-bold terminal-data tracking-tight ${isCredit ? 'text-green' : 'text-t1'}`}>
                      {isCredit ? '+' : '-'}${Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits: 0 })}
                    </span>
                  </td>
                  <td className="px-6 py-3.5">
                    <span className="flex items-center gap-1.5 text-[13px] text-t2">
                      <span className={`w-[5px] h-[5px] rounded-full ${tx.is_pending ? 'bg-amber' : 'bg-green'}`} />
                      {tx.is_pending ? 'Pending' : 'Cleared'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-cyan/[0.06] flex items-center justify-center mx-auto mb-3">
              <List size={20} className="text-t3" />
            </div>
            <p className="text-[14px] text-t2 font-medium">{search || catFilter !== 'all' ? 'No transactions match your filters' : 'No transactions yet'}</p>
            <p className="text-[13px] text-t2 mt-1">Connect a bank to start syncing</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-deep">
            <p className="text-[13px] text-t2 font-medium">
              {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-border hover:border-border-hover text-t3 hover:text-t1 transition disabled:opacity-20">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                const p = totalPages <= 5 ? i : Math.min(Math.max(page - 2, 0), totalPages - 5) + i
                return (
                  <button key={p} onClick={() => setPage(p)}
                    className={`w-7 h-7 rounded-lg text-[13px] font-semibold transition ${p === page ? 'bg-cyan text-void' : 'text-t3 hover:text-t1'}`}>
                    {p + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-border hover:border-border-hover text-t3 hover:text-t1 transition disabled:opacity-20">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
        {/* Status bar */}
        <div className="terminal-status flex items-center justify-between px-5 py-1.5">
          <div className="flex items-center gap-4 text-t3">
            <span className="terminal-live">LIVE</span>
            <span>SHOWING: <span className="text-t2">{paged.length}/{filtered.length}</span></span>
            <span>PAGE: <span className="text-t2">{page + 1}/{totalPages || 1}</span></span>
          </div>
          <div className="flex items-center gap-4 text-t3">
            <span>FILTER: <span className="text-cyan">{catFilter === 'all' ? 'ALL' : catFilter.toUpperCase()}</span></span>
          </div>
        </div>
      </div>
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15] animate-[slideUp_0.3s_ease-out]">
          <p className="text-[13px] text-cyan font-mono">{toastMsg}</p>
        </div>
      )}
    </div>
  )
}

function PremiumStat({ icon: Icon, color, label, value, sub, arrow }) {
  const colors = {
    green: { icon: 'bg-green/[0.1] text-green', border: 'border-green/[0.08] hover:border-green/[0.15]', glow: 'from-green/[0.04] to-transparent' },
    red: { icon: 'bg-red/[0.1] text-red', border: 'border-red/[0.08] hover:border-red/[0.15]', glow: 'from-red/[0.04] to-transparent' },
    cyan: { icon: 'bg-cyan/[0.1] text-cyan', border: 'border-cyan/[0.08] hover:border-cyan/[0.15]', glow: 'from-cyan/[0.04] to-transparent' },
    amber: { icon: 'bg-amber/[0.1] text-amber', border: 'border-amber/[0.08] hover:border-amber/[0.15]', glow: 'from-amber/[0.04] to-transparent' },
  }
  const c = colors[color] || colors.cyan
  return (
    <div className={`bg-gradient-to-br ${c.glow} rounded-2xl p-5 border ${c.border} transition-all`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.icon}`}><Icon size={17} strokeWidth={2} /></div>
        {arrow && (arrow === 'up' ? <ArrowUpRight size={16} className="text-green" /> : <ArrowDownRight size={16} className="text-red" />)}
      </div>
      <p className="font-mono text-[26px] font-black text-t1 tracking-tight leading-none">{value}</p>
      <p className="text-[13px] text-t2 mt-2">{label} <span className="text-border mx-1">·</span> {sub}</p>
      {toastMsg && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15] animate-[slideUp_0.3s_ease-out]">
          <p className="text-[13px] text-cyan font-mono">{toastMsg}</p>
        </div>
      )}
    </div>
  )
}
