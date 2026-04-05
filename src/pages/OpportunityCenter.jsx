import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Sparkles, DollarSign, Loader2, Check, X, ChevronRight, Target,
  TrendingUp, ArrowRight, Zap, Clock, Star, Plus, BarChart3, Eye
} from 'lucide-react'

function fmt(n) { const a = Math.abs(Number(n||0)); return (n < 0 ? '-' : '') + (a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}`) }

const STATUS_STYLE = {
  new: 'bg-cyan/[0.06] text-cyan', evaluating: 'bg-purple/[0.06] text-purple', approved: 'bg-green/[0.06] text-green',
  in_progress: 'bg-amber/[0.06] text-amber', captured: 'bg-green/[0.08] text-green', declined: 'bg-t3/[0.06] text-t3', expired: 'bg-t3/[0.06] text-t3',
}
const CATEGORY_COLORS = { financial: 'cyan', operational: 'amber', strategic: 'purple', market: 'green', technology: 'red' }

export default function OpportunityCenter() {
  const { profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('pipeline') // pipeline | rules | captured
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', opportunity_type: 'custom', category: 'financial', estimated_annual_value: '', impact_score: 60, effort_score: 30, confidence_score: 70 })

  const load = useCallback(async () => { setLoading(true); const { data: d } = await safeInvoke('opportunity-engine', { action: 'dashboard' }); setData(d); setLoading(false) }, [])
  useEffect(() => { load() }, [load])

  async function updateOpp(id, status, extra = {}) {
    await safeInvoke('opportunity-engine', { action: 'update_opportunity', opportunity_id: id, status, ...extra })
    toast.success(`Opportunity ${status}`); load()
  }

  async function createOpp(e) {
    e.preventDefault()
    await safeInvoke('opportunity-engine', { action: 'create_opportunity', ...form, estimated_annual_value: parseFloat(form.estimated_annual_value) || 0 })
    toast.success('Opportunity created'); setShowForm(false); load()
  }

  const summary = data?.summary || {}
  const opps = data?.opportunities || []
  const active = opps.filter(o => !['captured', 'declined', 'expired'].includes(o.status))
  const captured = opps.filter(o => o.status === 'captured')

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Opportunities</h1>
          <p className="text-[13px] text-t3 mt-0.5">{summary.active || 0} active · {fmt(summary.pipeline_value)} pipeline · {fmt(summary.captured_value)} captured</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2"><Plus size={14} /> Report Opportunity</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pipeline Value', value: fmt(summary.pipeline_value), icon: DollarSign, color: 'cyan' },
          { label: 'Active', value: summary.active || 0, icon: Target, color: 'purple' },
          { label: 'Captured', value: fmt(summary.captured_value), icon: Check, color: 'green' },
          { label: 'Avg Priority', value: active.length ? Math.round(active.reduce((s, o) => s + (o.priority_score || 0), 0) / active.length) : 0, icon: Star, color: 'amber' },
        ].map(k => { const Icon = k.icon; return (
          <div key={k.label} className="glass-card rounded-xl p-4 warm-kpi">
            <div className="flex items-center gap-2 mb-1"><Icon size={13} className={`text-${k.color}`} /><span className="text-[10px] text-t3">{k.label}</span></div>
            <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
          </div>
        )})}
      </div>

      {showForm && (
        <form onSubmit={createOpp} className="glass-card rounded-2xl p-6 space-y-3">
          <h3 className="text-[14px] font-bold text-t1">Report New Opportunity</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Opportunity title" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            <input type="number" value={form.estimated_annual_value} onChange={e => setForm({ ...form, estimated_annual_value: e.target.value })} placeholder="Est. annual value ($)" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] font-mono outline-none placeholder:text-t3" />
          </div>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={2} placeholder="Description..." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none resize-none placeholder:text-t3" />
          <div className="grid grid-cols-3 gap-3">
            {[{ k: 'impact_score', l: 'Impact' }, { k: 'effort_score', l: 'Effort' }, { k: 'confidence_score', l: 'Confidence' }].map(s => (
              <div key={s.k}><span className="text-[10px] text-t3">{s.l}: {form[s.k]}</span>
                <input type="range" min={0} max={100} value={form[s.k]} onChange={e => setForm({ ...form, [s.k]: parseInt(e.target.value) })}
                  className="w-full h-[3px] rounded-full appearance-none cursor-pointer" style={{ background: `linear-gradient(to right, #22D3EE ${form[s.k]}%, rgba(148,163,184,0.15) ${form[s.k]}%)` }} /></div>
            ))}
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5"><Sparkles size={12} /> Create</button>
        </form>
      )}

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['pipeline', 'captured', 'rules'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'pipeline' ? `(${active.length})` : t === 'captured' ? `(${captured.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'pipeline' && (
        <div className="space-y-3">
          {active.sort((a, b) => (b.priority_score || 0) - (a.priority_score || 0)).map(o => (
            <div key={o.id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${STATUS_STYLE[o.status]}`}>{o.status.replace('_', ' ')}</span>
                    <span className={`text-[8px] font-mono uppercase px-1.5 py-0.5 rounded bg-${CATEGORY_COLORS[o.category] || 't3'}/[0.06] text-${CATEGORY_COLORS[o.category] || 't3'}`}>{o.category}</span>
                    <span className="text-[8px] font-mono text-t4">{o.opportunity_type.replace(/_/g, ' ')}</span>
                    {o.source === 'ai_detected' && <Zap size={10} className="text-amber" />}
                  </div>
                  <h3 className="text-[14px] font-bold text-t1">{o.title}</h3>
                  <p className="text-[12px] text-t3 mt-1 line-clamp-2">{o.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-t4">
                    <span>Impact: <span className="text-cyan">{o.impact_score}</span></span>
                    <span>Effort: <span className="text-amber">{o.effort_score}</span></span>
                    <span>Confidence: <span className="text-green">{o.confidence_score}</span></span>
                    <span>Priority: <span className="text-purple font-bold">{o.priority_score}</span></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {o.estimated_annual_value > 0 && <p className="font-mono text-[18px] font-black text-green terminal-data">{fmt(o.estimated_annual_value)}<span className="text-[10px] text-t4">/yr</span></p>}
                  <div className="flex items-center gap-1 mt-2">
                    {o.status === 'new' && <button onClick={() => updateOpp(o.id, 'evaluating')} className="px-2 py-1 rounded-lg bg-purple/[0.06] text-purple text-[10px] font-semibold hover:bg-purple/[0.1] transition">Evaluate</button>}
                    {o.status === 'evaluating' && <button onClick={() => updateOpp(o.id, 'approved')} className="px-2 py-1 rounded-lg bg-green/[0.06] text-green text-[10px] font-semibold hover:bg-green/[0.1] transition">Approve</button>}
                    {(o.status === 'approved' || o.status === 'in_progress') && <button onClick={() => updateOpp(o.id, 'captured', { captured_value: o.estimated_annual_value })} className="px-2 py-1 rounded-lg bg-green/[0.06] text-green text-[10px] font-semibold hover:bg-green/[0.1] transition"><Check size={10} className="inline" /> Capture</button>}
                    <button onClick={() => updateOpp(o.id, 'declined', { declined_reason: 'Declined by user' })} className="px-2 py-1 rounded-lg text-[10px] text-t4 hover:text-red transition"><X size={10} /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {active.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Sparkles size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No active opportunities</p><p className="text-[12px] text-t3 mt-1">AI scans run daily to detect idle cash, vendor renegotiation, FX arbitrage, and more.</p></div>}
        </div>
      )}

      {tab === 'captured' && (
        <div className="space-y-2">
          {captured.map(o => (
            <div key={o.id} className="glass-card rounded-xl p-4 flex items-center justify-between border-green/[0.06]">
              <div><h3 className="text-[13px] font-medium text-t1">{o.title}</h3><span className="text-[10px] font-mono text-t4">{o.opportunity_type.replace(/_/g, ' ')} · Captured {new Date(o.captured_at).toLocaleDateString()}</span></div>
              <span className="font-mono text-[16px] font-bold text-green terminal-data">{fmt(o.captured_value)}</span>
            </div>
          ))}
          {captured.length === 0 && <div className="glass-card rounded-xl p-8 text-center"><Check size={20} className="text-t4 mx-auto mb-2" /><p className="text-[12px] text-t3">No captured opportunities yet.</p></div>}
        </div>
      )}

      {tab === 'rules' && (
        <div className="space-y-2">
          {(data?.rules || []).map(r => (
            <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div><h3 className="text-[13px] font-medium text-t1">{r.rule_name}</h3><span className="text-[10px] font-mono text-t4">{r.trigger_type.replace(/_/g, ' ')} · {r.opportunities_generated} generated</span></div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${r.enabled ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{r.enabled ? 'ACTIVE' : 'OFF'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
