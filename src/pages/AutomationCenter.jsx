import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Zap, Plus, Loader2, Check, X, Play, Pause, ChevronRight,
  Globe, Clock, AlertTriangle, FileText, RefreshCw, Settings,
  Webhook, History, Sparkles, ArrowRight, Bell, Tag, Send
} from 'lucide-react'

const TRIGGER_TYPES = [
  { value: 'transaction_created', label: 'Transaction Created' },
  { value: 'balance_threshold', label: 'Balance Threshold' },
  { value: 'forecast_deviation', label: 'Forecast Deviation' },
  { value: 'payment_due', label: 'Payment Due' },
  { value: 'sync_completed', label: 'Sync Completed' },
  { value: 'sync_failed', label: 'Sync Failed' },
  { value: 'alert_triggered', label: 'Alert Triggered' },
  { value: 'invoice_overdue', label: 'Invoice Overdue' },
  { value: 'scheduled', label: 'Scheduled (Cron)' },
]
const ACTION_TYPES = [
  { value: 'notify', label: 'Send Notification', icon: Bell },
  { value: 'categorize', label: 'Auto-Categorize', icon: Tag },
  { value: 'webhook', label: 'Call Webhook', icon: Globe },
  { value: 'tag', label: 'Apply Tag', icon: Tag },
]

export default function AutomationCenter() {
  const { profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('rules') // rules | executions | webhooks | changelog
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ rule_name: '', trigger_type: 'transaction_created', actions: [{ type: 'notify', config: { title: '', body: '' } }] })
  const isAdmin = ['owner', 'admin'].includes(profile?.role)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('automation', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createRule(e) {
    e.preventDefault()
    const { data: d } = await safeInvoke('automation', { action: 'create_rule', ...form })
    if (d?.success) { toast.success('Automation rule created'); setShowForm(false); setForm({ rule_name: '', trigger_type: 'transaction_created', actions: [{ type: 'notify', config: { title: '', body: '' } }] }); load() }
    else toast.error(d?.error || 'Failed')
  }

  async function toggleRule(ruleId, enabled) {
    await safeInvoke('automation', { action: 'update_rule', rule_id: ruleId, enabled: !enabled })
    load()
  }

  async function deleteRule(ruleId) {
    await safeInvoke('automation', { action: 'delete_rule', rule_id: ruleId })
    toast.success('Rule deleted'); load()
  }

  const rules = data?.rules || {}
  const executions = data?.executions || {}
  const webhooks = data?.webhooks || []
  const changelog = data?.changelog || []

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Automation</h1>
          <p className="text-[13px] text-t3 mt-0.5">{rules.active || 0} active rules · {executions.total_recent || 0} recent executions · {webhooks.length} webhooks</p>
        </div>
        {isAdmin && <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2"><Plus size={14} /> New Rule</button>}
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['rules', 'executions', 'webhooks', 'changelog'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createRule} className="glass-card rounded-2xl p-6 space-y-4">
          <h3 className="text-[14px] font-bold text-t1 flex items-center gap-2"><Zap size={14} className="text-cyan" /> New Automation Rule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input value={form.rule_name} onChange={e => setForm({ ...form, rule_name: e.target.value })} required placeholder="Rule name" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            <select value={form.trigger_type} onChange={e => setForm({ ...form, trigger_type: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-2 block">WHEN triggered, DO:</span>
            {form.actions.map((act, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <select value={act.type} onChange={e => { const a = [...form.actions]; a[i] = { ...a[i], type: e.target.value }; setForm({ ...form, actions: a }) }} className="px-3 py-2 rounded-lg glass-input text-[11px] text-t1 outline-none">
                  {ACTION_TYPES.map(at => <option key={at.value} value={at.value}>{at.label}</option>)}
                </select>
                <input value={act.config?.title || ''} onChange={e => { const a = [...form.actions]; a[i] = { ...a[i], config: { ...a[i].config, title: e.target.value } }; setForm({ ...form, actions: a }) }} placeholder="Title / URL" className="flex-1 px-3 py-2 rounded-lg glass-input text-[11px] text-t1 outline-none placeholder:text-t3" />
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, actions: [...form.actions, { type: 'notify', config: {} }] })} className="text-[10px] text-t3 hover:text-cyan transition flex items-center gap-1"><Plus size={10} /> Add action</button>
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5"><Zap size={12} /> Create Rule</button>
        </form>
      )}

      {/* RULES */}
      {tab === 'rules' && (
        <div className="space-y-3">
          {(rules.list || []).map(r => (
            <div key={r.id} className="glass-card rounded-xl p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Zap size={16} className={r.enabled ? 'text-cyan' : 'text-t4'} />
                <div>
                  <h3 className="text-[13px] font-bold text-t1">{r.rule_name}</h3>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-t4 mt-1">
                    <span className="bg-deep px-1.5 py-0.5 rounded uppercase">{r.trigger_type.replace(/_/g, ' ')}</span>
                    <span>{(r.actions || []).length} actions</span>
                    <span>{r.trigger_count || 0}x triggered</span>
                    {r.last_triggered_at && <span>Last: {new Date(r.last_triggered_at).toLocaleDateString()}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => toggleRule(r.id, r.enabled)} className={`w-10 h-5.5 rounded-full relative transition-all ${r.enabled ? 'bg-cyan' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${r.enabled ? 'left-5' : 'left-0.5'}`} />
                </button>
                {isAdmin && <button onClick={() => deleteRule(r.id)} className="p-1 text-t4 hover:text-red transition"><X size={12} /></button>}
              </div>
            </div>
          ))}
          {(rules.list || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Zap size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No automation rules</p><p className="text-[12px] text-t3 mt-1">Create rules to automate notifications, categorization, webhooks, and more.</p></div>}
        </div>
      )}

      {/* EXECUTIONS */}
      {tab === 'executions' && (
        <div className="space-y-2">
          {(executions.recent || []).map(ex => (
            <div key={ex.id} className="glass-card rounded-xl p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${ex.status === 'success' ? 'bg-green/[0.06] text-green' : ex.status === 'failed' ? 'bg-red/[0.06] text-red' : ex.status === 'partial' ? 'bg-amber/[0.06] text-amber' : 'bg-cyan/[0.06] text-cyan'}`}>{ex.status}</span>
                <span className="text-[12px] text-t1">{ex.actions_executed}/{ex.actions_executed + ex.actions_failed} actions</span>
                {ex.duration_ms && <span className="text-[9px] font-mono text-t4">{ex.duration_ms}ms</span>}
              </div>
              <span className="text-[9px] font-mono text-t4">{new Date(ex.created_at).toLocaleString()}</span>
            </div>
          ))}
          {(executions.recent || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><History size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No executions yet</p></div>}
        </div>
      )}

      {/* WEBHOOKS */}
      {tab === 'webhooks' && (
        <div className="space-y-3">
          {webhooks.map(w => (
            <div key={w.id} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] font-mono text-t1 truncate max-w-[400px]">{w.url}</p>
                  <div className="flex items-center gap-2 text-[9px] font-mono text-t4 mt-1">
                    <span>{(w.events || []).length} events</span>
                    <span>{w.deliveries_total} deliveries ({w.deliveries_failed} failed)</span>
                    <span className={w.enabled ? 'text-green' : 'text-t4'}>{w.enabled ? 'ACTIVE' : 'DISABLED'}</span>
                  </div>
                </div>
                {w.consecutive_failures > 0 && <span className="text-[9px] font-mono text-red">{w.consecutive_failures} failures</span>}
              </div>
            </div>
          ))}
          {webhooks.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Globe size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No webhook subscriptions</p></div>}
        </div>
      )}

      {/* CHANGELOG */}
      {tab === 'changelog' && (
        <div className="space-y-4">
          {changelog.map(c => (
            <div key={c.id} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-[12px] font-bold text-cyan">v{c.version}</span>
                <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${c.entry_type === 'feature' ? 'bg-cyan/[0.06] text-cyan' : c.entry_type === 'fix' ? 'bg-green/[0.06] text-green' : c.entry_type === 'security' ? 'bg-red/[0.06] text-red' : 'bg-purple/[0.06] text-purple'}`}>{c.entry_type}</span>
                {c.category && <span className="text-[9px] font-mono text-t4">{c.category}</span>}
                <span className="text-[9px] font-mono text-t4">{new Date(c.published_at).toLocaleDateString()}</span>
              </div>
              <h3 className="text-[14px] font-bold text-t1">{c.title}</h3>
              <p className="text-[12px] text-t3 mt-1">{c.body_markdown}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
