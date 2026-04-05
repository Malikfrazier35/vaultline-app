import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  AlertTriangle, Shield, Loader2, Check, Plus, ChevronRight,
  Target, Clock, Eye, X, Wrench, BarChart3, Activity
} from 'lucide-react'

function fmt(n) { const a = Math.abs(Number(n||0)); return a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}` }

const SEV_STYLE = { critical: 'bg-red/[0.08] text-red border-red/[0.12]', high: 'bg-red/[0.06] text-red', medium: 'bg-amber/[0.06] text-amber', low: 'bg-t3/[0.06] text-t3' }
const CAT_COLORS = { process: 'amber', technology: 'cyan', people: 'purple', data: 'red', compliance: 'green', financial: 'cyan' }

export default function WeaknessCenter() {
  const { profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | open | scans
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', weakness_type: 'custom', category: 'process', severity: 'medium', risk_score: 50, affected_areas: '' })

  const load = useCallback(async () => { setLoading(true); const { data: d } = await safeInvoke('weakness-engine', { action: 'dashboard' }); setData(d); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  async function updateWeak(id, status, extra = {}) {
    await safeInvoke('weakness-engine', { action: 'update_weakness', weakness_id: id, status, ...extra })
    toast.success(`Weakness ${status.replace('_', ' ')}`); load()
  }

  async function createWeak(e) {
    e.preventDefault()
    await safeInvoke('weakness-engine', { action: 'create_weakness', ...form, affected_areas: form.affected_areas.split(',').map(s => s.trim()).filter(Boolean) })
    toast.success('Weakness reported'); setShowForm(false); load()
  }

  const summary = data?.summary || {}
  const weaks = data?.weaknesses || []
  const open = weaks.filter(w => !['resolved', 'wont_fix', 'mitigated'].includes(w.status))
  const scans = data?.recent_scans || []

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Weaknesses</h1>
          <p className="text-[13px] text-t3 mt-0.5">{summary.open || 0} open · {summary.critical || 0} critical · {summary.high || 0} high · {fmt(summary.total_exposure)} exposure</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-amber/[0.08] text-amber text-[13px] font-semibold border border-amber/[0.12] hover:bg-amber/[0.12] transition-all flex items-center gap-2"><Plus size={14} /> Report Weakness</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: summary.open || 0, icon: AlertTriangle, color: 'amber' },
          { label: 'Critical', value: summary.critical || 0, icon: Shield, color: 'red' },
          { label: 'Avg Risk Score', value: summary.avg_risk || 0, icon: Target, color: summary.avg_risk >= 60 ? 'red' : summary.avg_risk >= 30 ? 'amber' : 'green' },
          { label: 'Exposure', value: fmt(summary.total_exposure), icon: Activity, color: 'red' },
        ].map(k => { const Icon = k.icon; return (
          <div key={k.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Icon size={13} className={`text-${k.color}`} /><span className="text-[10px] text-t3">{k.label}</span></div>
            <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
          </div>
        )})}
      </div>

      {/* Severity breakdown bar */}
      {open.length > 0 && (
        <div className="glass-card rounded-xl p-4">
          <div className="flex items-center gap-2 h-4 rounded-full overflow-hidden">
            {['critical', 'high', 'medium', 'low'].map(sev => {
              const count = (data?.by_severity || {})[sev] || 0; const pct = open.length ? (count / open.length) * 100 : 0
              return pct > 0 ? <div key={sev} className={`h-full ${sev === 'critical' ? 'bg-red' : sev === 'high' ? 'bg-red/70' : sev === 'medium' ? 'bg-amber' : 'bg-t3/30'}`} style={{ width: `${pct}%` }} title={`${sev}: ${count}`} /> : null
            })}
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-t4">
            {['critical', 'high', 'medium', 'low'].map(sev => <span key={sev}><span className={`inline-block w-2 h-2 rounded-full mr-1 ${sev === 'critical' ? 'bg-red' : sev === 'high' ? 'bg-red/70' : sev === 'medium' ? 'bg-amber' : 'bg-t3/30'}`} />{sev}: {(data?.by_severity || {})[sev] || 0}</span>)}
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={createWeak} className="glass-card rounded-2xl p-6 space-y-3">
          <h3 className="text-[14px] font-bold text-t1">Report Weakness</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Weakness title" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            <select value={form.severity} onChange={e => setForm({ ...form, severity: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={2} placeholder="Description..." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none resize-none placeholder:text-t3" />
          <input value={form.affected_areas} onChange={e => setForm({ ...form, affected_areas: e.target.value })} placeholder="Affected areas (comma-separated)" className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
          <button type="submit" className="px-4 py-2 rounded-xl bg-amber/[0.08] text-amber text-[12px] font-semibold border border-amber/[0.12] transition flex items-center gap-1.5"><AlertTriangle size={12} /> Report</button>
        </form>
      )}

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['overview', 'open', 'scans'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'open' ? `Open (${open.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {(tab === 'overview' || tab === 'open') && (
        <div className="space-y-3">
          {(tab === 'overview' ? open.slice(0, 10) : open).map(w => (
            <div key={w.id} className={`glass-card rounded-xl p-5 ${w.severity === 'critical' ? 'border-red/[0.15]' : w.severity === 'high' ? 'border-red/[0.08]' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${SEV_STYLE[w.severity]}`}>{w.severity}</span>
                    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-${CAT_COLORS[w.category] || 't3'}/[0.06] text-${CAT_COLORS[w.category] || 't3'}`}>{w.category}</span>
                    <span className="text-[8px] font-mono text-t4">{w.weakness_type.replace(/_/g, ' ')}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-t1">{w.title}</h3>
                  <p className="text-[12px] text-t3 mt-1 line-clamp-2">{w.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-t4">
                    <span>Risk: <span className={w.risk_score >= 70 ? 'text-red' : w.risk_score >= 40 ? 'text-amber' : 'text-green'}>{w.risk_score}</span></span>
                    {w.financial_exposure && <span>Exposure: {fmt(w.financial_exposure)}</span>}
                    {w.estimated_fix_effort && <span>Fix: {w.estimated_fix_effort}</span>}
                    {w.affected_areas?.length > 0 && <span>Areas: {w.affected_areas.join(', ')}</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${w.status === 'in_progress' ? 'bg-cyan/[0.06] text-cyan' : 'bg-t3/[0.06] text-t3'}`}>{w.status.replace('_', ' ')}</span>
                  <div className="flex gap-1 mt-1">
                    {w.status === 'open' && <button onClick={() => updateWeak(w.id, 'acknowledged')} className="px-2 py-1 rounded-lg bg-purple/[0.06] text-purple text-[9px] font-semibold hover:bg-purple/[0.1] transition">Ack</button>}
                    {w.status === 'acknowledged' && <button onClick={() => updateWeak(w.id, 'in_progress')} className="px-2 py-1 rounded-lg bg-cyan/[0.06] text-cyan text-[9px] font-semibold hover:bg-cyan/[0.1] transition"><Wrench size={9} className="inline" /> Fix</button>}
                    {w.status === 'in_progress' && <button onClick={() => updateWeak(w.id, 'resolved')} className="px-2 py-1 rounded-lg bg-green/[0.06] text-green text-[9px] font-semibold hover:bg-green/[0.1] transition"><Check size={9} className="inline" /> Resolve</button>}
                    <button onClick={() => updateWeak(w.id, 'accepted', { accepted_reason: 'Accepted risk' })} className="px-2 py-1 rounded-lg text-[9px] text-t4 hover:text-amber transition">Accept</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {open.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Shield size={28} className="text-green mx-auto mb-3" /><p className="text-[14px] text-t2">No open weaknesses</p><p className="text-[12px] text-t3 mt-1">Automated scans run daily to detect data quality gaps, missing integrations, and security issues.</p></div>}
        </div>
      )}

      {tab === 'scans' && (
        <div className="space-y-3">
          {scans.map(s => (
            <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="text-[12px] font-medium text-t1">{s.scan_type} scan</span>
                <div className="flex items-center gap-3 text-[10px] font-mono text-t4 mt-0.5">
                  <span>{s.checks_run} checks</span><span>{s.weaknesses_found} found</span><span className="text-cyan">{s.new_weaknesses} new</span><span className="text-green">{s.resolved_since_last} resolved</span>
                  {s.duration_ms && <span>{s.duration_ms}ms</span>}
                </div>
              </div>
              <div className="text-right">
                {s.overall_health_score != null && <span className={`font-mono text-[16px] font-bold terminal-data ${s.overall_health_score >= 70 ? 'text-green' : s.overall_health_score >= 40 ? 'text-amber' : 'text-red'}`}>{s.overall_health_score}</span>}
                <p className="text-[9px] font-mono text-t4">{new Date(s.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {scans.length === 0 && <p className="text-[12px] text-t3 text-center py-8">No scans run yet. Scans execute automatically on a daily schedule.</p>}
        </div>
      )}
    </div>
  )
}
