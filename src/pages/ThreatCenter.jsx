import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  ShieldAlert, Loader2, Plus, Check, X, ChevronRight, Target,
  TrendingDown, TrendingUp, AlertTriangle, Eye, Zap, Clock,
  ArrowUp, ArrowDown, Minus, BarChart3, Activity
} from 'lucide-react'

function fmt(n) { const a = Math.abs(Number(n||0)); return a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}` }

const LIKELIHOOD_ORDER = ['rare', 'unlikely', 'possible', 'likely', 'almost_certain']
const IMPACT_ORDER = ['insignificant', 'minor', 'moderate', 'major', 'catastrophic']
const TREND_ICON = { improving: TrendingDown, stable: Minus, worsening: TrendingUp, escalating: ArrowUp }
const TREND_COLOR = { improving: 'text-green', stable: 'text-t3', worsening: 'text-amber', escalating: 'text-red' }
const CAT_COLORS = { financial: 'cyan', operational: 'amber', regulatory: 'purple', market: 'green', technology: 'red', geopolitical: 'red' }

export default function ThreatCenter() {
  const { profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('active') // active | matrix | monitors | swot
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', threat_type: 'custom', category: 'financial', likelihood: 'possible', impact_level: 'moderate', potential_loss_max: '' })

  const load = useCallback(async () => { setLoading(true); const { data: d } = await safeInvoke('threat-engine', { action: 'dashboard' }); setData(d); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  async function updateThreat(id, updates) {
    await safeInvoke('threat-engine', { action: 'update_threat', threat_id: id, ...updates })
    toast.success('Threat updated'); load()
  }

  async function createThreat(e) {
    e.preventDefault()
    await safeInvoke('threat-engine', { action: 'create_threat', ...form, potential_loss_max: parseFloat(form.potential_loss_max) || undefined })
    toast.success('Threat registered'); setShowForm(false); load()
  }

  const summary = data?.summary || {}
  const threats = data?.threats || []
  const active = threats.filter(t => ['active', 'monitoring'].includes(t.status))
  const monitors = data?.monitors || []
  const swotTrend = data?.swot_trend || []

  if (loading) return <SkeletonPage />

  // Build risk matrix data
  const matrixCells = {}
  for (const t of active) {
    const key = `${t.likelihood}-${t.impact_level}`
    if (!matrixCells[key]) matrixCells[key] = []
    matrixCells[key].push(t)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Threat Monitor</h1>
          <p className="text-[13px] text-t3 mt-0.5">{summary.active || 0} active · {summary.escalated || 0} escalated · {summary.worsening || 0} worsening · {fmt(summary.total_exposure)} exposure</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-red/[0.08] text-red text-[13px] font-semibold border border-red/[0.12] hover:bg-red/[0.12] transition-all flex items-center gap-2"><Plus size={14} /> Report Threat</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Active Threats', value: summary.active || 0, icon: ShieldAlert, color: 'red' },
          { label: 'Avg Risk', value: summary.avg_risk || 0, icon: Target, color: summary.avg_risk >= 60 ? 'red' : summary.avg_risk >= 30 ? 'amber' : 'green' },
          { label: 'Escalated', value: summary.escalated || 0, icon: ArrowUp, color: 'red' },
          { label: 'Total Exposure', value: fmt(summary.total_exposure), icon: Activity, color: 'amber' },
        ].map(k => { const Icon = k.icon; return (
          <div key={k.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Icon size={13} className={`text-${k.color}`} /><span className="text-[10px] text-t3">{k.label}</span></div>
            <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
          </div>
        )})}
      </div>

      {showForm && (
        <form onSubmit={createThreat} className="glass-card rounded-2xl p-6 space-y-3">
          <h3 className="text-[14px] font-bold text-t1">Register Threat</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Threat title" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            <input type="number" value={form.potential_loss_max} onChange={e => setForm({ ...form, potential_loss_max: e.target.value })} placeholder="Max potential loss ($)" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] font-mono outline-none placeholder:text-t3" />
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={2} placeholder="Description..." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none resize-none placeholder:text-t3" />
          <div className="grid grid-cols-3 gap-3">
            <select value={form.likelihood} onChange={e => setForm({ ...form, likelihood: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[12px] outline-none">
              {LIKELIHOOD_ORDER.map(l => <option key={l} value={l}>{l.replace('_', ' ')}</option>)}
            </select>
            <select value={form.impact_level} onChange={e => setForm({ ...form, impact_level: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[12px] outline-none">
              {IMPACT_ORDER.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[12px] outline-none">
              {Object.keys(CAT_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-red/[0.08] text-red text-[12px] font-semibold border border-red/[0.12] transition flex items-center gap-1.5"><ShieldAlert size={12} /> Register</button>
        </form>
      )}

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['active', 'matrix', 'monitors', 'swot'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'active' ? `Active (${active.length})` : t === 'matrix' ? 'Risk Matrix' : t === 'swot' ? 'SWOT Trend' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'active' && (
        <div className="space-y-3">
          {active.sort((a, b) => b.risk_score - a.risk_score).map(t => {
            const TIcon = TREND_ICON[t.trend] || Minus
            return (
              <div key={t.id} className={`glass-card rounded-xl p-5 ${t.risk_score >= 70 ? 'border-red/[0.15]' : t.risk_score >= 40 ? 'border-amber/[0.08]' : ''}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono text-[11px] font-black ${t.risk_score >= 70 ? 'bg-red/[0.08] text-red' : t.risk_score >= 40 ? 'bg-amber/[0.08] text-amber' : 'bg-green/[0.08] text-green'}`}>{t.risk_score}</span>
                      <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-${CAT_COLORS[t.category] || 't3'}/[0.06] text-${CAT_COLORS[t.category] || 't3'}`}>{t.category}</span>
                      <span className="text-[8px] font-mono text-t4">{t.threat_type.replace(/_/g, ' ')}</span>
                      <TIcon size={12} className={TREND_COLOR[t.trend]} />
                      {t.escalated && <span className="text-[8px] font-mono font-bold text-red bg-red/[0.06] px-1.5 py-0.5 rounded">ESCALATED</span>}
                      {t.source === 'system' && <Zap size={10} className="text-amber" />}
                    </div>
                    <h3 className="text-[14px] font-bold text-t1">{t.title}</h3>
                    <p className="text-[12px] text-t3 mt-1 line-clamp-2">{t.description}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-t4">
                      <span>Likelihood: {t.likelihood?.replace('_', ' ')}</span>
                      <span>Impact: {t.impact_level}</span>
                      <span>Velocity: {t.velocity}</span>
                      {t.potential_loss_max && <span>Max loss: {fmt(t.potential_loss_max)}</span>}
                      {t.review_count > 0 && <span>{t.review_count} reviews</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex gap-1">
                      {!t.escalated && t.risk_score >= 50 && <button onClick={() => updateThreat(t.id, { escalated: true })} className="px-2 py-1 rounded-lg bg-red/[0.06] text-red text-[9px] font-semibold hover:bg-red/[0.1] transition"><ArrowUp size={9} className="inline" /> Escalate</button>}
                      <button onClick={() => updateThreat(t.id, { status: 'mitigated' })} className="px-2 py-1 rounded-lg bg-green/[0.06] text-green text-[9px] font-semibold hover:bg-green/[0.1] transition"><Check size={9} className="inline" /> Mitigate</button>
                      <button onClick={() => updateThreat(t.id, { status: 'accepted' })} className="px-2 py-1 rounded-lg text-[9px] text-t4 hover:text-amber transition">Accept</button>
                    </div>
                    {t.countermeasures?.length > 0 && <span className="text-[9px] text-t4">{t.countermeasures.length} countermeasures</span>}
                  </div>
                </div>
              </div>
            )
          })}
          {active.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><ShieldAlert size={28} className="text-green mx-auto mb-3" /><p className="text-[14px] text-t2">No active threats</p></div>}
        </div>
      )}

      {/* RISK MATRIX */}
      {tab === 'matrix' && (
        <div className="glass-card rounded-2xl p-6 overflow-x-auto">
          <h3 className="text-[12px] font-bold text-t1 mb-4">Likelihood × Impact Risk Matrix</h3>
          <div className="grid grid-cols-6 gap-1 min-w-[500px]">
            <div />
            {IMPACT_ORDER.map(i => <div key={i} className="text-[9px] font-mono text-t4 text-center uppercase py-2">{i}</div>)}
            {[...LIKELIHOOD_ORDER].reverse().map(l => (
              <>
                <div key={`l-${l}`} className="text-[9px] font-mono text-t4 text-right pr-2 py-3 uppercase">{l.replace('_', ' ')}</div>
                {IMPACT_ORDER.map(i => {
                  const key = `${l}-${i}`
                  const cells = matrixCells[key] || []
                  const li = LIKELIHOOD_ORDER.indexOf(l); const ii = IMPACT_ORDER.indexOf(i)
                  const heat = (li + ii) / 8
                  const bg = heat >= 0.7 ? 'bg-red/[0.12]' : heat >= 0.4 ? 'bg-amber/[0.08]' : heat >= 0.2 ? 'bg-green/[0.04]' : 'bg-deep/50'
                  return (
                    <div key={key} className={`${bg} rounded-lg p-2 min-h-[48px] border border-border/10 flex flex-wrap gap-1`}>
                      {cells.map(t => <div key={t.id} className="w-3 h-3 rounded-full bg-red/60 border border-red/20" title={t.title} />)}
                    </div>
                  )
                })}
              </>
            ))}
          </div>
          <p className="text-[10px] text-t4 mt-3 text-center">Each dot represents an active threat. Red zones = high risk, amber = medium, green = low.</p>
        </div>
      )}

      {tab === 'monitors' && (
        <div className="space-y-2">
          {monitors.map(m => (
            <div key={m.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div><span className="text-[13px] font-medium text-t1">{m.monitor_name}</span><div className="text-[10px] font-mono text-t4 mt-0.5">{m.monitor_type.replace(/_/g, ' ')} · {m.threats_generated} threats · {m.checks_run} checks</div></div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${m.enabled ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{m.enabled ? 'ACTIVE' : 'OFF'}</span>
            </div>
          ))}
          {monitors.length === 0 && <p className="text-[12px] text-t3 text-center py-8">No active monitors. Threat scanning runs on automated schedules.</p>}
        </div>
      )}

      {tab === 'swot' && (
        <div className="space-y-4">
          {swotTrend.length > 0 ? swotTrend.map(s => (
            <div key={s.id} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-bold text-t1">{new Date(s.period).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                <span className={`font-mono text-[18px] font-black terminal-data ${s.overall_health_score >= 70 ? 'text-green' : s.overall_health_score >= 40 ? 'text-amber' : 'text-red'}`}>{s.overall_health_score}/100</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><span className="text-[10px] font-mono text-cyan">Opportunities</span><p className="font-mono text-[16px] font-bold text-cyan terminal-data">{s.opportunities_count}<span className="text-[10px] text-t4 ml-1">{fmt(s.total_opportunity_value)}</span></p></div>
                <div><span className="text-[10px] font-mono text-amber">Weaknesses</span><p className="font-mono text-[16px] font-bold text-amber terminal-data">{s.weaknesses_count}</p></div>
                <div><span className="text-[10px] font-mono text-red">Threats</span><p className="font-mono text-[16px] font-bold text-red terminal-data">{s.threats_count}<span className="text-[10px] text-t4 ml-1">{fmt(s.total_threat_exposure)}</span></p></div>
              </div>
            </div>
          )) : <div className="glass-card rounded-xl p-8 text-center"><BarChart3 size={20} className="text-t4 mx-auto mb-2" /><p className="text-[12px] text-t3">SWOT snapshots are generated weekly. Check back after the first scan cycle.</p></div>}
        </div>
      )}
    </div>
  )
}
