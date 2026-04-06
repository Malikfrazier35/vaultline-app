import { SkeletonPage } from "@/components/Skeleton"
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Clock, Plus, Check, Calendar, AlertTriangle, Play, Pause,
  RefreshCw, Loader2, Globe, Timer, ChevronRight, Settings,
  BarChart3, Target, X
} from 'lucide-react'

const TASK_TYPES = ['reconciliation', 'report_generation', 'review_forecast', 'check_alerts', 'payment_approval', 'vendor_review', 'audit_prep', 'team_sync', 'custom']
const RECURRENCE = ['once', 'daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'annual']
const TIME_CATEGORIES = ['reconciliation', 'forecasting', 'reporting', 'payment_processing', 'vendor_management', 'audit_compliance', 'data_entry', 'meeting', 'other']

export default function TimeManager() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('tasks') // tasks | time | timezone
  // Task form
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', task_type: 'custom', recurrence: 'once', scheduled_date: '', scheduled_time: '09:00', linked_page: '' })
  // Timer
  const [timerRunning, setTimerRunning] = useState(false)
  const [timerStart, setTimerStart] = useState(null)
  const [timerCategory, setTimerCategory] = useState('other')
  const [timerDesc, setTimerDesc] = useState('')
  const [elapsed, setElapsed] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('time-ops', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Timer tick
  useEffect(() => {
    if (!timerRunning || !timerStart) return
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - timerStart) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [timerRunning, timerStart])

  async function createTask(e) {
    e.preventDefault()
    const { data: d } = await safeInvoke('time-ops', { action: 'create_task', ...form })
    if (d?.success) { toast.success('Task created'); setShowForm(false); setForm({ title: '', task_type: 'custom', recurrence: 'once', scheduled_date: '', scheduled_time: '09:00', linked_page: '' }); load() }
    else toast.error(d?.error || 'Failed')
  }

  async function completeTask(taskId) {
    await safeInvoke('time-ops', { action: 'complete_task', task_id: taskId })
    toast.success('Task completed')
    load()
  }

  function startTimer() { setTimerRunning(true); setTimerStart(Date.now()); setElapsed(0) }
  async function stopTimer() {
    setTimerRunning(false)
    const dur = Math.ceil(elapsed / 60)
    if (dur > 0) {
      await safeInvoke('time-ops', { action: 'log_time', category: timerCategory, description: timerDesc, started_at: new Date(timerStart).toISOString(), ended_at: new Date().toISOString(), duration_minutes: dur })
      toast.success(`Logged ${dur} min to ${timerCategory.replace('_', ' ')}`)
    }
    setTimerStart(null); setElapsed(0); setTimerDesc('')
    load()
  }

  async function saveTz(updates) {
    await safeInvoke('time-ops', { action: 'save_timezone', ...updates })
    toast.success('Timezone settings saved')
    load()
  }

  const tasks = data?.tasks || []
  const tz = data?.timezone || {}
  const timeWeek = data?.time_this_week || {}
  const fmtTime = s => { const m = Math.floor(s / 60); const sec = s % 60; return `${m}:${sec.toString().padStart(2, '0')}` }

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Time Manager</h1>
          <p className="text-[13px] text-t3 mt-0.5">{data?.overdue || 0} overdue · {data?.due_today || 0} due today · {Math.round((timeWeek.total_minutes || 0) / 60 * 10) / 10}h logged this week</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2">
          <Plus size={14} /> New Task
        </button>
      </div>

      {/* Timer bar */}
      <div className="glass-card rounded-xl p-4 flex items-center gap-4 flex-wrap">
        <Timer size={16} className={timerRunning ? 'text-green animate-pulse' : 'text-t3'} />
        <select value={timerCategory} onChange={e => setTimerCategory(e.target.value)} className="px-3 py-2 rounded-lg glass-input text-[12px] text-t1 outline-none">
          {TIME_CATEGORIES.map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
        </select>
        <input value={timerDesc} onChange={e => setTimerDesc(e.target.value)} placeholder="What are you working on?" className="flex-1 min-w-[150px] px-3 py-2 rounded-lg glass-input text-[12px] text-t1 outline-none placeholder:text-t3" />
        <span className="font-mono text-[18px] font-bold text-t1 terminal-data w-16 text-center">{fmtTime(elapsed)}</span>
        {!timerRunning ? (
          <button onClick={startTimer} className="px-3 py-2 rounded-lg bg-green/[0.08] text-green border border-green/[0.12] hover:bg-green/[0.12] transition flex items-center gap-1.5 text-[12px] font-semibold"><Play size={12} /> Start</button>
        ) : (
          <button onClick={stopTimer} className="px-3 py-2 rounded-lg bg-red/[0.08] text-red border border-red/[0.12] hover:bg-red/[0.12] transition flex items-center gap-1.5 text-[12px] font-semibold"><Pause size={12} /> Stop</button>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['tasks', 'time', 'timezone'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'timezone' ? 'Timezone & Calendar' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={createTask} className="glass-card rounded-2xl p-6 space-y-3">
          <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required placeholder="Task title" className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[14px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <select value={form.task_type} onChange={e => setForm({ ...form, task_type: e.target.value })} className="px-3 py-2.5 rounded-xl glass-input text-[12px] text-t1 outline-none">
              {TASK_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <select value={form.recurrence} onChange={e => setForm({ ...form, recurrence: e.target.value })} className="px-3 py-2.5 rounded-xl glass-input text-[12px] text-t1 outline-none">
              {RECURRENCE.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input type="date" value={form.scheduled_date} onChange={e => setForm({ ...form, scheduled_date: e.target.value })} className="px-3 py-2.5 rounded-xl glass-input text-[12px] text-t1 outline-none" />
            <input type="time" value={form.scheduled_time} onChange={e => setForm({ ...form, scheduled_time: e.target.value })} className="px-3 py-2.5 rounded-xl glass-input text-[12px] text-t1 outline-none" />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5"><Plus size={12} /> Create</button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl text-[12px] text-t3 hover:text-t1 transition">Cancel</button>
          </div>
        </form>
      )}

      {/* TASKS */}
      {tab === 'tasks' && (
        <div className="space-y-2">
          {tasks.filter(t => t.status === 'active').length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center"><Calendar size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No scheduled tasks</p></div>
          ) : tasks.filter(t => t.status === 'active').map(t => {
            const isOverdue = t.next_due_at && new Date(t.next_due_at) < new Date()
            return (
              <div key={t.id} className={`glass-card rounded-xl p-4 flex items-center justify-between ${isOverdue ? 'border-red/[0.15]' : ''}`}>
                <div className="flex items-center gap-3">
                  <button onClick={() => completeTask(t.id)} className="w-5 h-5 rounded-full border-2 border-border hover:border-green hover:bg-green/[0.08] transition flex items-center justify-center"><Check size={10} className="text-transparent hover:text-green" /></button>
                  <div>
                    <p className="text-[13px] font-medium text-t1">{t.title}</p>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-t4">
                      <span>{t.task_type.replace('_', ' ')}</span>
                      <span>{t.recurrence}</span>
                      {t.next_due_at && <span className={isOverdue ? 'text-red' : ''}>{isOverdue ? 'Overdue' : 'Due'}: {new Date(t.next_due_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>}
                      <span>{t.completion_count}x completed</span>
                    </div>
                  </div>
                </div>
                {t.linked_page && <a href={t.linked_page} className="text-[10px] text-cyan hover:underline flex items-center gap-0.5">Open <ChevronRight size={10} /></a>}
              </div>
            )
          })}
        </div>
      )}

      {/* TIME LOG */}
      {tab === 'time' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(timeWeek.by_category || {}).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, min]) => (
              <div key={cat} className="glass-card rounded-xl p-4">
                <p className="text-[10px] font-mono text-t4 uppercase">{cat.replace('_', ' ')}</p>
                <p className="font-mono text-[20px] font-black text-cyan terminal-data">{Math.round(min / 60 * 10) / 10}h</p>
                <div className="h-1.5 rounded-full bg-border/20 mt-2">
                  <div className="h-full rounded-full bg-cyan transition-all" style={{ width: `${Math.min(100, (min / (timeWeek.total_minutes || 1)) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="glass-card rounded-xl p-4 text-center">
            <p className="text-[13px] text-t2">Total this week: <span className="font-mono font-bold text-cyan">{Math.round((timeWeek.total_minutes || 0) / 60 * 10) / 10} hours</span></p>
          </div>
        </div>
      )}

      {/* TIMEZONE */}
      {tab === 'timezone' && (
        <div className="space-y-4 max-w-2xl">
          {[
            { label: 'Primary Timezone', key: 'primary_timezone', type: 'select', options: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney', 'UTC'] },
            { label: 'Time Format', key: 'display_format', type: 'select', options: ['12h', '24h'] },
            { label: 'Week Starts On', key: 'week_start', type: 'select', options: ['monday', 'sunday'] },
            { label: 'Fiscal Year Start', key: 'fiscal_year_start_month', type: 'select', options: [1,2,3,4,5,6,7,8,9,10,11,12], labels: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] },
            { label: 'Business Hours Start', key: 'business_start', type: 'time' },
            { label: 'Business Hours End', key: 'business_end', type: 'time' },
          ].map(f => (
            <div key={f.key} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <span className="text-[13px] text-t1">{f.label}</span>
              {f.type === 'select' ? (
                <select value={tz[f.key] || ''} onChange={e => saveTz({ [f.key]: f.key === 'fiscal_year_start_month' ? parseInt(e.target.value) : e.target.value })}
                  className="px-3 py-2 rounded-lg glass-input text-[12px] text-t1 font-mono outline-none">
                  {f.options.map((o, i) => <option key={o} value={o}>{f.labels ? f.labels[i] : o}</option>)}
                </select>
              ) : (
                <input type="time" value={tz[f.key] || ''} onChange={e => saveTz({ [f.key]: e.target.value })}
                  className="px-3 py-2 rounded-lg glass-input text-[12px] text-t1 font-mono outline-none" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
