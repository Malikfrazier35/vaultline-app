import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Bell, X, Check, CheckCheck, AlertTriangle, TrendingDown,
  CreditCard, Clock, RefreshCw, Zap, Shield, Gift, Users,
  BarChart3, ChevronRight, Loader2
} from 'lucide-react'

const TYPE_CONFIG = {
  low_cash: { icon: AlertTriangle, color: 'red' },
  large_transaction: { icon: CreditCard, color: 'amber' },
  forecast_deviation: { icon: BarChart3, color: 'purple' },
  runway_warning: { icon: TrendingDown, color: 'red' },
  sync_failure: { icon: RefreshCw, color: 'amber' },
  payment_failed: { icon: CreditCard, color: 'red' },
  payment_success: { icon: Check, color: 'green' },
  trial_expiring: { icon: Clock, color: 'amber' },
  team_invite: { icon: Users, color: 'cyan' },
  team_joined: { icon: Users, color: 'green' },
  anomaly_detected: { icon: Zap, color: 'purple' },
  forecast_ready: { icon: BarChart3, color: 'cyan' },
  account_activity: { icon: Shield, color: 'cyan' },
  system: { icon: Bell, color: 'cyan' },
  milestone: { icon: Gift, color: 'green' },
}

function timeAgo(date) {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function NotificationCenter() {
  const { org, profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const panelRef = useRef(null)

  const unreadCount = notifications.filter(n => !n.read_at && !n.dismissed_at).length

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!org?.id) return
    setLoading(true)
    try {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('org_id', org.id)
        .is('dismissed_at', null)
        .order('created_at', { ascending: false })
        .limit(30)
      setNotifications(data || [])
    } catch { /* table may not exist yet */ }
    setLoading(false)
  }, [org?.id])

  useEffect(() => { fetchNotifications() }, [fetchNotifications])

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!org?.id) return
    let channel
    try {
      channel = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `org_id=eq.${org.id}`,
        }, (payload) => {
          setNotifications(prev => [payload.new, ...prev].slice(0, 30))
        })
        .subscribe()
    } catch { /* table may not exist */ }
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [org?.id])

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function markRead(id) {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await safeInvoke('notify', { action: 'mark_read', notification_ids: [id] })
  }

  async function dismiss(id) {
    setNotifications(prev => prev.filter(n => n.id !== id))
    await safeInvoke('notify', { action: 'dismiss', notification_id: id })
  }

  async function markAllRead() {
    setMarkingAll(true)
    setNotifications(prev => prev.map(n => ({ ...n, read_at: n.read_at || new Date().toISOString() })))
    await safeInvoke('notify', { action: 'mark_all_read', org_id: org?.id, user_id: profile?.id })
    setMarkingAll(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button onClick={() => { setOpen(!open); if (!open) fetchNotifications() }}
        className="relative p-2 rounded-lg hover:bg-deep text-t2 hover:text-t1 transition">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-[18px] h-[18px] rounded-full bg-red text-void text-[10px] font-bold flex items-center justify-center shadow-[0_2px_6px_rgba(239,68,68,0.4)]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-12 w-[380px] max-h-[480px] glass-card rounded-2xl shadow-[0_16px_64px_rgba(0,0,0,0.4)] border-border/50 overflow-hidden z-[100]"
          style={{ animation: 'slideInRight 0.2s ease-out' }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-t1">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono font-bold bg-cyan/[0.08] text-cyan px-1.5 py-0.5 rounded">{unreadCount} new</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} disabled={markingAll}
                  className="text-[11px] text-t3 hover:text-cyan transition flex items-center gap-1 px-2 py-1 rounded hover:bg-deep">
                  {markingAll ? <Loader2 size={10} className="animate-spin" /> : <CheckCheck size={12} />}
                  Mark all read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-deep text-t3 hover:text-t1 transition">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[380px] scrollbar-none">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={18} className="animate-spin text-t3" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Bell size={24} className="text-t4 mx-auto mb-3" />
                <p className="text-[13px] text-t3">No notifications yet</p>
                <p className="text-[11px] text-t4 mt-1">Treasury alerts will appear here when triggered</p>
              </div>
            ) : (
              notifications.map(n => {
                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system
                const Icon = config.icon
                const isUnread = !n.read_at
                const cm = {
                  red: 'bg-red/[0.08] text-red', amber: 'bg-amber/[0.08] text-amber',
                  cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green',
                  purple: 'bg-purple/[0.08] text-purple',
                }

                return (
                  <div key={n.id}
                    onClick={() => { if (isUnread) markRead(n.id) }}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border/10 transition-colors cursor-pointer ${
                      isUnread ? 'bg-cyan/[0.02] hover:bg-cyan/[0.04]' : 'hover:bg-deep/50'
                    }`}>
                    {/* Icon */}
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${cm[config.color] || cm.cyan}`}>
                      <Icon size={13} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-[12px] leading-tight ${isUnread ? 'font-semibold text-t1' : 'text-t2'}`}>{n.title}</p>
                        <span className="text-[9px] font-mono text-t4 flex-shrink-0">{timeAgo(n.created_at)}</span>
                      </div>
                      {n.body && <p className="text-[11px] text-t3 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>}
                      {n.action_url && (
                        <Link to={n.action_url} onClick={(e) => { e.stopPropagation(); setOpen(false); if (isUnread) markRead(n.id) }}
                          className="text-[10px] text-cyan hover:underline mt-1 inline-flex items-center gap-0.5">
                          View details <ChevronRight size={10} />
                        </Link>
                      )}
                    </div>

                    {/* Unread dot + dismiss */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {isUnread && <span className="w-2 h-2 rounded-full bg-cyan" />}
                      <button onClick={(e) => { e.stopPropagation(); dismiss(n.id) }}
                        className="p-0.5 rounded hover:bg-deep text-t4 hover:text-t2 transition opacity-0 group-hover:opacity-100">
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border/20 text-center">
              <Link to="/alerts" onClick={() => setOpen(false)} className="text-[11px] text-t3 hover:text-cyan transition">
                View all alerts & notification settings
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
