import { useState, useEffect, useMemo, useCallback } from 'react'
import { useToast } from '@/components/Toast'
import { SkeletonPage } from '@/components/Skeleton'
import { useTreasury } from '@/hooks/useTreasury'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { Link } from 'react-router-dom'
import {
  Bell, AlertTriangle, TrendingDown, TrendingUp, CreditCard, ArrowDownRight,
  DollarSign, Check, Clock, Filter, RefreshCw, ChevronRight, Zap, Shield, Trash2,
  Loader2, CheckCircle2, Eye, Mail, MessageSquare, Play
} from 'lucide-react'

function fmt(n) {
  const abs = Math.abs(n || 0)
  if (abs >= 1e6) return '$' + (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return '$' + (abs / 1e3).toFixed(1) + 'K'
  return '$' + abs.toFixed(0)
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const SEVERITY_CONFIG = {
  critical: { icon: AlertTriangle, color: 'red', bg: 'bg-red/[0.08]', border: 'border-red/[0.12]', text: 'text-red' },
  warning: { icon: TrendingDown, color: 'amber', bg: 'bg-amber/[0.08]', border: 'border-amber/[0.12]', text: 'text-amber' },
  info: { icon: Bell, color: 'cyan', bg: 'bg-cyan/[0.08]', border: 'border-cyan/[0.12]', text: 'text-cyan' },
  success: { icon: CheckCircle2, color: 'green', bg: 'bg-green/[0.08]', border: 'border-green/[0.12]', text: 'text-green' },
}

export default function Alerts() {
  const { accounts, bankConnections, cashPosition, forecast, loading: treasuryLoading } = useTreasury()
  const { org, user } = useAuth()
  const toast = useToast()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [evaluating, setEvaluating] = useState(false)
  const [filter, setFilter] = useState('all')

  useEffect(() => { document.title = 'Alerts \u2014 Vaultline' }, [])

  // Load notifications from DB
  const loadNotifications = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    const { data } = await supabase.from('notifications')
      .select('*')
      .eq('org_id', org.id)
      .is('dismissed_at', null)
      .order('created_at', { ascending: false })
      .limit(50)
    setNotifications(data || [])
    setLoading(false)
  }, [org?.id])

  useEffect(() => { loadNotifications() }, [loadNotifications])

  // Run server-side evaluation
  async function runEvaluation() {
    if (!org?.id) return
    setEvaluating(true)
    try {
      const { data, error } = await safeInvoke('notify', { action: 'evaluate', org_id: org.id })
      if (error) throw new Error(error)
      toast.success(`Evaluation complete \u2014 ${data?.created || 0} new alerts`)
      loadNotifications()
    } catch (err) {
      toast.error(err.message || 'Evaluation failed')
    }
    setEvaluating(false)
  }

  // Mark as read
  async function markRead(id) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    setNotifications(n => n.map(x => x.id === id ? { ...x, read_at: new Date().toISOString() } : x))
  }

  // Dismiss
  async function dismiss(id) {
    await supabase.from('notifications').update({ dismissed_at: new Date().toISOString() }).eq('id', id)
    setNotifications(n => n.filter(x => x.id !== id))
    toast.info('Alert dismissed')
  }

  // Mark all read
  async function markAllRead() {
    if (!org?.id) return
    await safeInvoke('notify', { action: 'mark_read', org_id: org.id, user_id: user?.id })
    setNotifications(n => n.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })))
    toast.success('All alerts marked as read')
  }

  // Generate real-time client-side alerts from useTreasury (supplement server-side)
  const clientAlerts = useMemo(() => {
    if (treasuryLoading) return []
    const alerts = []
    const totalCash = (accounts || []).reduce((s, a) => s + (a.current_balance || 0), 0)
    const runway = forecast?.runway_months || 0

    // No bank connections
    if ((bankConnections || []).length === 0) {
      alerts.push({ id: 'client_no_banks', type: 'info', severity: 'info', title: 'No bank accounts connected', body: 'Connect a bank to get real-time alerts on your cash position.', action_url: '/banks', source: 'realtime', created_at: new Date().toISOString() })
    }

    // All systems normal
    if (accounts.length > 0 && totalCash > 0 && alerts.length === 0) {
      alerts.push({ id: 'client_healthy', type: 'success', severity: 'success', title: 'Treasury status: healthy', body: `${fmt(totalCash)} total cash across ${accounts.length} accounts. No critical issues.`, source: 'realtime', created_at: new Date().toISOString() })
    }

    return alerts
  }, [accounts, bankConnections, forecast, treasuryLoading])

  // Merge server + client alerts
  const allAlerts = useMemo(() => {
    const serverIds = new Set(notifications.map(n => n.type))
    // Don't duplicate server alerts with client ones
    const deduped = clientAlerts.filter(c => !serverIds.has(c.type))
    return [...notifications, ...deduped]
  }, [notifications, clientAlerts])

  const filtered = filter === 'all' ? allAlerts : allAlerts.filter(a => a.severity === filter)
  const unreadCount = notifications.filter(n => !n.read_at).length
  const criticalCount = allAlerts.filter(a => a.severity === 'critical').length
  const warningCount = allAlerts.filter(a => a.severity === 'warning').length

  if (loading && treasuryLoading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">ALERTS</span>
          {unreadCount > 0 && <span className="text-[10px] font-mono font-bold text-red bg-red/[0.08] px-2 py-0.5 rounded-full border border-red/[0.12]">{unreadCount} UNREAD</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={runEvaluation} disabled={evaluating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[12px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
            {evaluating ? <><Loader2 size={12} className="animate-spin" /> Evaluating...</> : <><Play size={12} /> Run evaluation</>}
          </button>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-[12px] font-mono text-t3 hover:text-t1 transition">
              <Check size={12} /> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Bell, label: 'TOTAL', value: String(allAlerts.length), color: 'cyan' },
          { icon: AlertTriangle, label: 'CRITICAL', value: String(criticalCount), color: criticalCount > 0 ? 'red' : 'green' },
          { icon: TrendingDown, label: 'WARNINGS', value: String(warningCount), color: warningCount > 0 ? 'amber' : 'green' },
          { icon: Shield, label: 'SOURCE', value: notifications.length > 0 ? 'Server' : 'Client', color: 'purple' },
        ].map(k => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', red: 'bg-red/[0.08] text-red', amber: 'bg-amber/[0.08] text-amber', green: 'bg-green/[0.08] text-green', purple: 'bg-purple/[0.08] text-purple' }
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

      {/* Filter strip */}
      <div className="flex items-center gap-2">
        {['all', 'critical', 'warning', 'info', 'success'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition ${filter === f ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : 'text-t3 hover:text-t2 border border-transparent'}`}>
            {f.toUpperCase()} {f !== 'all' && <span className="text-[9px] ml-1">({allAlerts.filter(a => a.severity === f).length})</span>}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <div className="glass-card rounded-2xl p-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-green/[0.08] flex items-center justify-center mx-auto mb-3"><CheckCircle2 size={20} className="text-green" /></div>
            <p className="text-[14px] font-semibold text-t1">No alerts</p>
            <p className="text-[13px] text-t3 mt-1">Everything looks good. Run an evaluation to check for new issues.</p>
          </div>
        )}
        {filtered.map(a => {
          const sev = SEVERITY_CONFIG[a.severity] || SEVERITY_CONFIG.info
          const SevIcon = sev.icon
          const isServer = !a.source // server notifications don't have 'source' field
          const isUnread = isServer && !a.read_at

          return (
            <div key={a.id} className={`glass-card rounded-xl p-4 transition hover:border-border-hover ${isUnread ? `${sev.border} border-l-2` : ''}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${sev.bg}`}>
                  <SevIcon size={14} className={sev.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <h4 className={`text-[13px] font-semibold ${isUnread ? 'text-t1' : 'text-t2'}`}>{a.title}</h4>
                    {isUnread && <span className="w-1.5 h-1.5 rounded-full bg-cyan animate-pulse" />}
                  </div>
                  <p className="text-[12px] text-t3 leading-relaxed">{a.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-t4">
                    <span>{timeAgo(a.created_at)}</span>
                    {a.channels_sent?.includes('email') && <span className="flex items-center gap-0.5"><Mail size={9} /> Email sent</span>}
                    {a.channels_sent?.includes('slack') && <span className="flex items-center gap-0.5"><MessageSquare size={9} /> Slack sent</span>}
                    {a.source === 'realtime' && <span className="text-cyan">LIVE</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {a.action_url && (
                    <Link to={a.action_url} className="p-1.5 rounded-lg text-t3 hover:text-cyan hover:bg-cyan/[0.04] transition">
                      <ChevronRight size={14} />
                    </Link>
                  )}
                  {isServer && isUnread && (
                    <button onClick={() => markRead(a.id)} className="p-1.5 rounded-lg text-t3 hover:text-green hover:bg-green/[0.04] transition" title="Mark read">
                      <Eye size={13} />
                    </button>
                  )}
                  {isServer && (
                    <button onClick={() => dismiss(a.id)} className="p-1.5 rounded-lg text-t3 hover:text-red hover:bg-red/[0.04] transition" title="Dismiss">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="terminal-status flex items-center justify-between px-5 py-2 rounded-lg">
        <div className="flex items-center gap-3 text-t3">
          <span className="terminal-live">ENGINE</span>
          <span>SERVER: <span className="text-cyan">{notifications.length}</span></span>
          <span>CLIENT: <span className="text-purple">{clientAlerts.length}</span></span>
        </div>
        <Link to="/settings" className="text-[11px] font-mono text-t3 hover:text-cyan transition">
          Configure thresholds \u2192
        </Link>
      </div>
    </div>
  )
}
