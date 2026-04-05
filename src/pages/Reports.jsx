import { useState, useEffect, useMemo } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useTreasury } from '@/hooks/useTreasury'
import { supabase } from '@/lib/supabase'
import {
  Activity, DollarSign, PieChart, Calendar, FileText, Landmark,
  Download, Loader2, X, Clock, FileBarChart, TrendingUp, ChevronDown, Printer, Lock
} from 'lucide-react'

const EXPORT_LIMITS = { starter: 5, growth: 50, enterprise: Infinity }

function fmt(n) { return '$' + Math.abs(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtK(n) { return n >= 1000000 ? '$' + (n / 1000000).toFixed(1) + 'M' : '$' + (n / 1000).toFixed(0) + 'K' }

const REPORTS = [
  { id: 'cashflow', icon: Activity, color: 'cyan', title: 'Cash Flow Statement', desc: 'Operating, investing, and financing cash flows', format: 'TXT', lines: '~30' },
  { id: 'position', icon: DollarSign, color: 'green', title: 'Daily Cash Position', desc: 'End-of-day balances with reconciliation status', format: 'TXT', lines: '~20' },
  { id: 'spend', icon: PieChart, color: 'purple', title: 'Spend by Category', desc: 'Outflows breakdown by vendor, payroll, SaaS', format: 'TXT', lines: '~25' },
  { id: 'forecast', icon: Calendar, color: 'amber', title: 'Forecast vs Actual', desc: 'Compare prior forecasts against actuals', format: 'TXT', lines: '~20' },
  { id: 'board', icon: FileText, color: 'cyan', title: 'Board Treasury Summary', desc: 'One-click executive summary for board meetings', format: 'TXT', lines: '~35' },
  { id: 'fees', icon: Landmark, color: 'green', title: 'Bank Fee Analysis', desc: 'Aggregate and compare fees across institutions', format: 'TXT', lines: '~25' },
]

export default function Reports() {
  const { org, profile } = useAuth()
  const { accounts, transactions, bankConnections } = useTreasury()
  const [generating, setGenerating] = useState(null)
  const [report, setReport] = useState(null)
  const [period, setPeriod] = useState('30d')
  const [history, setHistory] = useState([])

  useEffect(() => { document.title = "Reports \u2014 Vaultline" }, [])

  const periodDays = period === 'mtd' ? new Date().getDate() : period === 'qtd' ? (() => { const m = new Date().getMonth(); const qStart = m - (m % 3); return Math.floor((Date.now() - new Date(new Date().getFullYear(), qStart, 1).getTime()) / 86400000) })() : period === 'fy' ? Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000) : parseInt(period)

  async function generateReport(id) {
    setGenerating(id)
    setReport(null)
    await new Promise(r => setTimeout(r, 300))

    const today = new Date()
    const startDate = new Date(Date.now() - periodDays * 86400000)
    const periodLabel = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} \u2013 ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

    const recentTx = transactions.filter(t => new Date(t.date) >= startDate)
    const inflows = recentTx.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0)
    const outflows = recentTx.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
    const netFlow = inflows - outflows
    const totalBalance = accounts.reduce((s, a) => s + (a.current_balance || 0), 0)

    let title = '', content = ''

    if (id === 'cashflow') {
      title = 'Cash Flow Statement'
      const payroll = recentTx.filter(t => t.category === 'payroll' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const saas = recentTx.filter(t => t.category === 'saas' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const vendor = recentTx.filter(t => t.category === 'vendor' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const ops = recentTx.filter(t => t.category === 'operations' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const tax = recentTx.filter(t => t.category === 'tax' && t.amount > 0).reduce((s, t) => s + t.amount, 0)
      const transfers = recentTx.filter(t => t.category === 'transfer').reduce((s, t) => s + t.amount, 0)
      content = [`OPERATING ACTIVITIES`,`  Revenue / Inflows:          ${fmt(inflows)}`,`  Payroll:                   (${fmt(payroll)})`,`  SaaS / Software:           (${fmt(saas)})`,`  Vendors:                   (${fmt(vendor)})`,`  Operations:                (${fmt(ops)})`,`  Tax:                       (${fmt(tax)})`,`  \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,`  Net Operating Cash Flow:    ${fmt(netFlow - Math.abs(transfers))}`,``,`FINANCING ACTIVITIES`,`  Internal Transfers:         ${fmt(transfers)}`,``,`NET CHANGE IN CASH:           ${fmt(netFlow)}`,``,`ENDING CASH POSITION:         ${fmt(totalBalance)}`].join('\n')
    } else if (id === 'position') {
      title = 'Daily Cash Position'
      content = [`ACCOUNT BALANCES`,`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,...accounts.map(a => `  ${(a.name || 'Unknown').padEnd(28)} ${(a.type || '').padEnd(10)} ${fmt(a.current_balance).padStart(16)}`),`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,`  ${'TOTAL'.padEnd(28)} ${''.padEnd(10)} ${fmt(totalBalance).padStart(16)}`,``,`CONNECTED BANKS: ${bankConnections.length}`,...bankConnections.map(b => `  ${(b.institution_name || '').padEnd(30)} ${(b.status || '').padEnd(12)} Last sync: ${b.last_synced_at ? new Date(b.last_synced_at).toLocaleString() : 'never'}`)].join('\n')
    } else if (id === 'spend') {
      title = 'Spend by Category'
      const categories = ['payroll','saas','vendor','operations','tax','transfer','other']
      const catTotals = categories.map(c => ({ category: c, total: recentTx.filter(t => t.category === c && t.amount > 0).reduce((s, t) => s + t.amount, 0), count: recentTx.filter(t => t.category === c && t.amount > 0).length })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)
      content = [`CATEGORY BREAKDOWN`,`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,...catTotals.map(c => { const pct = outflows > 0 ? ((c.total / outflows) * 100) : 0; return `  ${c.category.toUpperCase().padEnd(14)} ${fmt(c.total).padStart(14)}  ${pct.toFixed(1).padStart(5)}%  (${c.count} txns)` }),`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,`  ${'TOTAL OUTFLOWS'.padEnd(14)} ${fmt(outflows).padStart(14)}`,``,`TOP 5 LARGEST OUTFLOWS`,...recentTx.filter(t => t.amount > 0).sort((a, b) => b.amount - a.amount).slice(0, 5).map((t, i) => `  ${i + 1}. ${(t.description || '').substring(0, 35).padEnd(35)} ${fmt(t.amount).padStart(14)}  ${t.date}`)].join('\n')
    } else if (id === 'forecast') {
      title = 'Forecast vs Actual'
      const { data: forecasts } = await supabase.from('forecasts').select('*').order('generated_at', { ascending: false }).limit(1).single()
      content = [`FORECAST SUMMARY`,`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,`  Monthly Burn Rate:          ${forecasts ? fmt(forecasts.monthly_burn) : 'N/A'}`,`  Runway:                     ${forecasts ? forecasts.runway_months + ' months' : 'N/A'}`,`  Forecast Confidence:        ${forecasts ? (forecasts.confidence * 100).toFixed(0) + '%' : 'N/A'}`,``,`ACTUAL (${periodLabel})`,`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,`  Total Inflows:              ${fmt(inflows)}`,`  Total Outflows:             ${fmt(outflows)}`,`  Net Cash Flow:              ${fmt(netFlow)}`,``,forecasts ? `  Variance:    ${outflows > forecasts.monthly_burn ? 'OVER BUDGET by ' + fmt(outflows - forecasts.monthly_burn) : 'UNDER BUDGET by ' + fmt(forecasts.monthly_burn - outflows)}` : ''].join('\n')
    } else if (id === 'board') {
      title = 'Board Treasury Summary'
      const liquidBalance = accounts.filter(a => ['checking', 'savings'].includes(a.type)).reduce((s, a) => s + (a.current_balance || 0), 0)
      const { data: forecasts } = await supabase.from('forecasts').select('*').order('generated_at', { ascending: false }).limit(1).single()
      content = [`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,`  BOARD TREASURY SUMMARY`,`  ${org?.name || 'Company'} | ${today.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,`  Prepared by: ${profile?.full_name || 'Treasury'}`,`\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550`,``,`KEY METRICS`,`  Total Cash:                 ${fmtK(totalBalance)}`,`  Liquid Cash:                ${fmtK(liquidBalance)}`,`  Banks Connected:            ${bankConnections.length}`,`  Accounts:                   ${accounts.length}`,``,`CASH FLOW (${periodLabel})`,`  Inflows:                    ${fmtK(inflows)}`,`  Outflows:                   ${fmtK(outflows)}`,`  Net:                        ${fmtK(netFlow)}`,``,`RUNWAY`,`  Monthly Burn:               ${forecasts ? fmtK(forecasts.monthly_burn) : 'N/A'}`,`  Runway:                     ${forecasts ? forecasts.runway_months + ' months' : 'N/A'}`,``,`STATUS: ${netFlow >= 0 ? 'POSITIVE cash flow' : 'NEGATIVE \u2014 monitor closely'}`].join('\n')
    } else if (id === 'fees') {
      title = 'Bank Fee Analysis'
      const feeTx = recentTx.filter(t => { const d = (t.description || '').toLowerCase(); return d.includes('fee') || d.includes('charge') || d.includes('maintenance') })
      const totalFees = feeTx.reduce((s, t) => s + Math.abs(t.amount), 0)
      content = [`BANK FEE ANALYSIS`,`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`,`  Total Fees (${periodDays}d):          ${fmt(totalFees)}`,`  Fee Transactions:           ${feeTx.length}`,``,feeTx.length > 0 ? 'FEE DETAIL' : 'No bank fee transactions detected.',...feeTx.map(t => `  ${t.date}  ${(t.description || '').substring(0, 35).padEnd(35)} ${fmt(Math.abs(t.amount)).padStart(12)}`),``,`CONNECTED INSTITUTIONS`,...bankConnections.map(b => `  ${(b.institution_name || '')} (${b.status || ''})`)].join('\n')
    }

    const header = [`\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557`,`\u2551  VAULTLINE \u2014 ${title.toUpperCase()}`,`\u2551  ${org?.name || 'Company'} | Period: ${periodLabel}`,`\u2551  Generated: ${today.toLocaleString()}`,`\u255A\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255D`,``].join('\n')
    const result = { id, title, content: header + content, timestamp: new Date().toISOString(), periodLabel }
    setReport(result)
    setHistory(prev => [result, ...prev].slice(0, 10))
    setGenerating(null)
  }

  const plan = org?.plan || 'starter'
  const exportLimit = EXPORT_LIMITS[plan] || 5
  const [exportCount, setExportCount] = useState(() => {
    const key = `vaultline-exports-${new Date().toISOString().slice(0, 7)}`
    return parseInt(localStorage.getItem(key) || '0', 10)
  })
  const atExportLimit = exportCount >= exportLimit

  function downloadReport() {
    if (!report || atExportLimit) return
    const blob = new Blob([report.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `vaultline-${report.id}-${new Date().toISOString().split('T')[0]}.txt`; a.click()
    URL.revokeObjectURL(url)
    const key = `vaultline-exports-${new Date().toISOString().slice(0, 7)}`
    const newCount = exportCount + 1
    localStorage.setItem(key, String(newCount))
    setExportCount(newCount)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">TREASURY REPORTS</span>
          <span className="text-[12px] font-mono text-t3">{REPORTS.length} available</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-deep border border-border">
            {['30d', 'mtd', 'qtd', 'fy'].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-all ${period === p ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2'}`}>
                {p.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: FileBarChart, label: 'GENERATED', value: history.length.toString(), color: 'cyan' },
          { icon: Clock, label: 'PERIOD', value: period.toUpperCase(), color: 'purple' },
          { icon: TrendingUp, label: 'NET FLOW', value: fmtK(transactions.filter(t => new Date(t.date) >= new Date(Date.now() - periodDays * 86400000)).reduce((s, t) => s + (t.amount < 0 ? Math.abs(t.amount) : -t.amount), 0)), color: 'green' },
          { icon: DollarSign, label: 'ACCOUNTS', value: accounts.length.toString(), color: 'amber' },
        ].map(k => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', purple: 'bg-purple/[0.08] text-purple', green: 'bg-green/[0.08] text-green', amber: 'bg-amber/[0.08] text-amber' }
          return (
            <div key={k.label} className="glass-card rounded-xl p-4 terminal-scanlines relative">
              <div className="relative z-[2]">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${cm[k.color]}`}><k.icon size={13} /></div>
                  <span className="text-[9px] font-mono text-t3 uppercase tracking-wider">{k.label}</span>
                </div>
                <p className="font-mono text-[20px] font-black text-t1 terminal-data">{k.value}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Report grid */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="terminal-label">GENERATE</span>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {REPORTS.map(r => {
            const cm = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', purple: 'bg-purple/[0.08] text-purple', amber: 'bg-amber/[0.08] text-amber' }
            return (
              <button key={r.id} onClick={() => generateReport(r.id)} disabled={generating === r.id}
                className="glass-card rounded-2xl p-6 text-left hover:border-border-cyan hover:-translate-y-1 active:scale-[0.98] transition-all cursor-pointer group disabled:opacity-60 terminal-scanlines relative overflow-hidden">
                <div className="relative z-[2]">
                  <div className="flex items-center justify-between mb-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${cm[r.color]} group-hover:scale-110 transition-transform`}>
                      {generating === r.id ? <Loader2 size={20} className="animate-spin" /> : <r.icon size={20} />}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-t3 bg-deep px-2 py-0.5 rounded">{r.format}</span>
                      <span className="text-[10px] font-mono text-t3 bg-deep px-2 py-0.5 rounded">{r.lines}</span>
                    </div>
                  </div>
                  <h3 className="font-display text-[15px] font-bold mb-1.5 group-hover:text-cyan transition tracking-tight">{r.title}</h3>
                  <p className="text-[13px] text-t2 leading-relaxed">{r.desc}</p>
                  <div className="mt-4 flex items-center gap-1.5 text-[12px] font-mono font-semibold text-t3 group-hover:text-cyan transition">
                    GENERATE <span className="group-hover:translate-x-1 transition-transform">\u2192</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Report viewer */}
      {report && (
        <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative">
          <div className="relative z-[2]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan/[0.08] flex items-center justify-center"><FileText size={15} className="text-cyan" /></div>
                <div>
                  <span className="terminal-label">{report.title.toUpperCase()}</span>
                  <p className="text-[11px] text-t3 font-mono mt-0.5">{report.periodLabel} / {new Date(report.timestamp).toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {atExportLimit ? (
                  <Link to="/billing" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber/[0.08] border border-amber/[0.12] text-amber text-[12px] font-semibold transition-all">
                    <Lock size={12} /> {exportCount}/{exportLimit} exports — Upgrade
                  </Link>
                ) : (
                  <button onClick={downloadReport}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[12px] font-semibold shadow-[0_2px_12px_rgba(34,211,238,0.15)] hover:-translate-y-px active:scale-[0.98] transition-all">
                    <Download size={12} /> DOWNLOAD {exportLimit !== Infinity ? `(${exportCount}/${exportLimit})` : ''}
                  </button>
                )}
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-[12px] font-mono text-t3 hover:text-t1 hover:border-border-hover transition-all">
                  <Printer size={12} /> PRINT
                </button>
                <button onClick={() => setReport(null)} className="p-2 rounded-xl hover:bg-deep border border-transparent hover:border-border text-t3 hover:text-t1 transition"><X size={14} /></button>
              </div>
            </div>
            <pre className="p-6 text-[13px] font-mono text-t2 leading-[1.8] overflow-x-auto max-h-[500px] overflow-y-auto whitespace-pre terminal-data">{report.content}</pre>
            <div className="terminal-status flex items-center justify-between px-6 py-1.5">
              <div className="flex items-center gap-3 text-t3">
                <span className="terminal-live">LIVE</span>
                <span>PERIOD: <span className="text-cyan">{period.toUpperCase()}</span></span>
                <span>LINES: <span className="text-t2">{report.content.split('\n').length}</span></span>
              </div>
              <span className="text-t3">FORMAT: <span className="text-t2">TXT</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Report history */}
      {history.length > 0 && !report && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Clock size={12} className="text-t3" />
            <span className="terminal-label">RECENT</span>
            <span className="text-[11px] font-mono text-t3">{history.length} reports</span>
          </div>
          <div className="divide-y divide-border/20">
            {history.slice(0, 5).map((h, i) => (
              <button key={i} onClick={() => setReport(h)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-deep active:bg-deep transition text-left">
                <div className="flex items-center gap-3">
                  <FileText size={14} className="text-cyan" />
                  <span className="text-[13px] font-semibold text-t1">{h.title}</span>
                  <span className="text-[11px] font-mono text-t3">{h.periodLabel}</span>
                </div>
                <span className="text-[11px] font-mono text-t3">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
