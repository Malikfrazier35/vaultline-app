import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { useChartTheme } from '@/hooks/useChartTheme'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { ChartTooltip } from '@/components/ChartTooltip'
import {
  Eye, DollarSign, TrendingUp, TrendingDown, AlertTriangle, RefreshCw,
  Loader2, Shield, ArrowUpRight, ArrowDownRight, Clock, Zap,
  Plus, Settings, Building2, Target, BarChart3
} from 'lucide-react'

function fmt(n) { const a = Math.abs(Number(n||0)); return a >= 1e6 ? `$${(a/1e6).toFixed(2)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}` }

const BUFFER_TYPES = ['operating_reserve', 'emergency_fund', 'debt_service', 'regulatory_capital', 'payroll_reserve', 'tax_reserve', 'custom']

export default function CashVisibility() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const ct = useChartTheme()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('positions') // positions | concentration | buffers | trend

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('cash-visibility', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const summary = data?.summary || {}
  const positions = data?.positions || []
  const buffers = data?.buffers || {}
  const trend = data?.trend || []
  const rules = data?.concentration_rules || []
  const isAdmin = ['owner', 'admin'].includes(profile?.role)

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Cash Visibility</h1>
          <p className="text-[13px] text-t3 mt-0.5">{summary.accounts || 0} accounts · {summary.stale || 0} stale · {summary.below_minimum || 0} below minimum</p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-border text-[12px] text-t2 hover:border-border-hover transition flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Cash', value: fmt(summary.total_cash), icon: DollarSign, color: 'cyan' },
          { label: 'Available', value: fmt(summary.total_available), icon: Eye, color: 'green' },
          { label: 'Pending In', value: `+${fmt(summary.pending_inflows)}`, icon: ArrowUpRight, color: 'green' },
          { label: 'Pending Out', value: `-${fmt(summary.pending_outflows)}`, icon: ArrowDownRight, color: 'red' },
          { label: 'Projected EOD', value: fmt(summary.projected_eod), icon: Target, color: summary.projected_eod >= 0 ? 'cyan' : 'red' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="glass-card rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1"><Icon size={13} className={`text-${k.color}`} /><span className="text-[10px] text-t3 uppercase">{k.label}</span></div>
              <p className={`font-mono text-[20px] font-black text-${k.color} terminal-data`}>{k.value}</p>
            </div>
          )
        })}
      </div>

      {/* Alerts */}
      {(summary.below_minimum > 0 || summary.stale > 0) && (
        <div className="flex gap-3">
          {summary.below_minimum > 0 && (
            <div className="flex-1 p-3 rounded-xl bg-red/[0.04] border border-red/[0.1] flex items-center gap-2">
              <AlertTriangle size={14} className="text-red" /><span className="text-[12px] text-red font-medium">{summary.below_minimum} account{summary.below_minimum > 1 ? 's' : ''} below minimum balance</span>
            </div>
          )}
          {summary.stale > 0 && (
            <div className="flex-1 p-3 rounded-xl bg-amber/[0.04] border border-amber/[0.1] flex items-center gap-2">
              <Clock size={14} className="text-amber" /><span className="text-[12px] text-amber font-medium">{summary.stale} stale connection{summary.stale > 1 ? 's' : ''}</span>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['positions', 'concentration', 'buffers', 'trend'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'concentration' ? 'Sweep Rules' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* POSITIONS */}
      {tab === 'positions' && (
        <div className="space-y-3">
          {positions.map(p => {
            const pctUsed = p.target_balance ? Math.round((Number(p.available_balance) / Number(p.target_balance)) * 100) : null
            return (
              <div key={p.id} className={`glass-card rounded-xl p-5 ${p.below_minimum ? 'border-red/[0.15]' : p.stale ? 'border-amber/[0.1]' : ''}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${p.stale ? 'bg-amber' : p.below_minimum ? 'bg-red' : 'bg-green'}`} />
                    <div>
                      <span className="text-[13px] font-bold text-t1">{p.currency} Account</span>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-t4 mt-0.5">
                        <span>{p.source}</span>
                        <span>Refreshed: {p.last_refreshed_at ? new Date(p.last_refreshed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Never'}</span>
                        {p.stale && <span className="text-amber">STALE</span>}
                      </div>
                    </div>
                  </div>
                  <span className="font-mono text-[22px] font-black text-t1 terminal-data">{fmt(p.available_balance)}</span>
                </div>
                <div className="grid grid-cols-4 gap-4 text-[10px] font-mono">
                  <div><span className="text-t4">Ledger</span><p className="text-t2 mt-0.5">{fmt(p.ledger_balance)}</p></div>
                  <div><span className="text-t4">Pending In</span><p className="text-green mt-0.5">+{fmt(p.pending_inflows)}</p></div>
                  <div><span className="text-t4">Pending Out</span><p className="text-red mt-0.5">-{fmt(p.pending_outflows)}</p></div>
                  <div><span className="text-t4">Projected EOD</span><p className="text-cyan mt-0.5">{fmt(p.projected_eod)}</p></div>
                </div>
                {(p.minimum_balance || p.target_balance) && (
                  <div className="mt-3 pt-3 border-t border-border/10 flex items-center gap-4 text-[10px] font-mono text-t4">
                    {p.minimum_balance && <span className={p.below_minimum ? 'text-red' : ''}>Min: {fmt(p.minimum_balance)}</span>}
                    {p.target_balance && <span>Target: {fmt(p.target_balance)}</span>}
                    {p.sweep_threshold && <span>Sweep at: {fmt(p.sweep_threshold)}</span>}
                  </div>
                )}
              </div>
            )
          })}
          {positions.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Eye size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No cash positions yet</p><p className="text-[12px] text-t3 mt-1">Connect bank accounts to see real-time balances.</p></div>}
        </div>
      )}

      {/* CONCENTRATION */}
      {tab === 'concentration' && (
        <div className="space-y-3">
          {rules.map(r => (
            <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[13px] font-bold text-t1">{r.rule_name}</span>
                <div className="flex items-center gap-3 text-[10px] font-mono text-t4 mt-1">
                  <span className="bg-deep px-1.5 py-0.5 rounded uppercase">{r.rule_type}</span>
                  <span>{r.trigger_type.replace('_', ' ')}</span>
                  {r.trigger_threshold && <span>Threshold: {fmt(r.trigger_threshold)}</span>}
                  <span>{r.execution_count}x triggered</span>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${r.enabled ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{r.enabled ? 'ACTIVE' : 'PAUSED'}</span>
            </div>
          ))}
          {rules.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Zap size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No sweep rules configured</p><p className="text-[12px] text-t3 mt-1">Set up automated cash concentration rules to optimize idle cash.</p></div>}
        </div>
      )}

      {/* BUFFERS */}
      {tab === 'buffers' && (
        <div className="space-y-3">
          {(buffers.list || []).map(b => (
            <div key={b.id} className={`glass-card rounded-xl p-5 ${b.status === 'critical' ? 'border-red/[0.15]' : b.status === 'underfunded' ? 'border-amber/[0.1]' : ''}`}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="text-[13px] font-bold text-t1">{b.buffer_name}</span>
                  <span className="text-[9px] font-mono text-t4 ml-2 bg-deep px-1.5 py-0.5 rounded uppercase">{b.buffer_type.replace('_', ' ')}</span>
                </div>
                <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${b.status === 'funded' || b.status === 'excess' ? 'bg-green/[0.06] text-green' : b.status === 'underfunded' ? 'bg-amber/[0.06] text-amber' : 'bg-red/[0.06] text-red'}`}>{b.status}</span>
              </div>
              <div className="flex items-end gap-2 mb-2">
                <span className="font-mono text-[18px] font-bold text-t1 terminal-data">{fmt(b.current_amount)}</span>
                <span className="text-[11px] text-t3">of {fmt(b.required_amount)} required</span>
              </div>
              <div className="h-2 rounded-full bg-border/20">
                <div className={`h-full rounded-full transition-all ${b.funded_pct >= 100 ? 'bg-green' : b.funded_pct >= 80 ? 'bg-cyan' : b.funded_pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${Math.min(100, b.funded_pct)}%` }} />
              </div>
              <span className="text-[9px] font-mono text-t4 mt-1">{b.funded_pct}% funded</span>
            </div>
          ))}
          {(buffers.list || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Shield size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No liquidity buffers configured</p></div>}
        </div>
      )}

      {/* TREND */}
      {tab === 'trend' && (
        <div className="glass-card rounded-2xl p-6">
          <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">30-DAY CASH TREND</span>
          {trend.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={trend} margin={{ top: 20, right: 10, left: 0, bottom: 0 }}>
                <defs><linearGradient id="cvGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#22D3EE" stopOpacity={0.15} /><stop offset="100%" stopColor="#22D3EE" stopOpacity={0} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="2 4" stroke={ct.grid} vertical={false} />
                <XAxis dataKey="snapshot_date" tick={{ fill: ct.tick, fontSize: 10 }} tickFormatter={v => new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} />
                <YAxis tick={{ fill: ct.tick, fontSize: 10 }} tickFormatter={v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`} width={65} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="total_cash" name="Total Cash" stroke="#22D3EE" strokeWidth={2.5} fill="url(#cvGrad)" dot={false} />
                <Area type="monotone" dataKey="total_available" name="Available" stroke="#22C55E" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
              </AreaChart>
            </ResponsiveContainer>
          ) : <p className="text-[12px] text-t3 mt-4">No trend data yet. Daily snapshots are captured automatically.</p>}
        </div>
      )}
    </div>
  )
}
