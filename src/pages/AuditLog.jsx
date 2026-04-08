import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { Shield, Search, ChevronLeft, ChevronRight, Filter, Download, Clock, User, Key, CreditCard, FileText, Users, Settings } from 'lucide-react'

const ACTION_CONFIG = {
  invite_sent: { icon: Users, color: 'cyan', label: 'Invite Sent' },
  member_removed: { icon: Users, color: 'red', label: 'Member Removed' },
  role_changed: { icon: Shield, color: 'amber', label: 'Role Changed' },
  bank_connected: { icon: CreditCard, color: 'green', label: 'Bank Connected' },
  bank_disconnected: { icon: CreditCard, color: 'red', label: 'Bank Disconnected' },
  report_generated: { icon: FileText, color: 'purple', label: 'Report Generated' },
  settings_updated: { icon: Settings, color: 'amber', label: 'Settings Updated' },
  login: { icon: Key, color: 'cyan', label: 'Login' },
  logout: { icon: Key, color: 'red', label: 'Logout' },
}

const PAGE_SIZE = 15

export default function AuditLog() {
  const { org } = useAuth()
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)

  useEffect(() => { document.title = 'Audit Log — Vaultline' }, [])

  useEffect(() => {
    if (!org?.id) return
    loadLogs()
  }, [org?.id, page])

  async function loadLogs() {
    setLoading(true)
    const { data, count } = await supabase
      .from('audit_log')
      .select('*, profiles(full_name, email)', { count: 'exact' })
      .eq('org_id', org.id)
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
    setLogs(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  const filtered = logs.filter(l => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (l.action || '').toLowerCase().includes(q) ||
      (l.profiles?.full_name || '').toLowerCase().includes(q) ||
      (l.resource_type || '').toLowerCase().includes(q) ||
      JSON.stringify(l.details || {}).toLowerCase().includes(q)
  })

  const totalPages = Math.ceil(total / PAGE_SIZE)

  function timeAgo(date) {
    const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (s < 60) return 'Just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    if (s < 604800) return `${Math.floor(s / 86400)}d ago`
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-7">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-purple/[0.1] flex items-center justify-center">
            <Shield size={20} className="text-purple" />
          </div>
          <div>
            <span className="terminal-label">AUDIT LOG</span>
            <p className="text-[13px] text-t2">{total} events recorded · {org?.name}</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border text-[13px] font-semibold text-t3 hover:text-t1 hover:border-border-hover active:border-border-hover transition">
          <Download size={13} /> Export
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: total.toString(), icon: Clock, color: 'cyan' },
          { label: 'Today', value: logs.filter(l => new Date(l.created_at).toDateString() === new Date().toDateString()).length.toString(), icon: Shield, color: 'green' },
          { label: 'Team Actions', value: logs.filter(l => ['invite_sent', 'member_removed', 'role_changed'].includes(l.action)).length.toString(), icon: Users, color: 'purple' },
          { label: 'Security Events', value: logs.filter(l => ['login', 'logout'].includes(l.action)).length.toString(), icon: Key, color: 'amber' },
        ].map(s => (
          <div key={s.label} className="glass-card rounded-xl p-4 terminal-scanlines relative">
            <div className={`w-8 h-8 rounded-lg bg-${s.color}/[0.1] flex items-center justify-center mb-2`}>
              <s.icon size={14} className={`text-${s.color}`} />
            </div>
            <p className="font-display text-[22px] font-extrabold text-t1">{s.value}</p>
            <p className="text-[12px] text-t3 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Log table */}
      <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative hover:border-border-hover active:border-border-hover transition-colors">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <span className="terminal-label">ACTIVITY TIMELINE</span>
          <div className="flex items-center gap-2 glass-input rounded-xl px-3.5 py-2">
            <Search size={13} className="text-t3" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="bg-transparent text-[13px] font-mono terminal-data text-t1 outline-none w-40 placeholder:text-t3" placeholder="Search events..." />
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-12 w-full rounded-lg" style={{ animationDelay: `${i * 0.05}s` }} />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="divide-y divide-border/15">
            {filtered.map(log => {
              const ac = ACTION_CONFIG[log.action] || { icon: Clock, color: 'cyan', label: log.action }
              const colorMap = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', red: 'bg-red/[0.08] text-red', amber: 'bg-amber/[0.08] text-amber', purple: 'bg-purple/[0.08] text-purple' }
              return (
                <div key={log.id} className="flex items-center px-6 py-3.5 hover:bg-deep active:bg-deep transition">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mr-4 ${colorMap[ac.color]}`}>
                    <ac.icon size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[14px] font-semibold text-t1">{ac.label}</span>
                      {log.resource_type && <span className="text-[12px] text-t3 bg-border/30 px-1.5 py-0.5 rounded">{log.resource_type}</span>}
                    </div>
                    <p className="text-[12px] text-t3 font-mono">
                      {log.profiles?.full_name || 'System'}
                      {log.details?.email ? ` → ${log.details.email}` : ''}
                      {log.details?.role ? ` (${log.details.role})` : ''}
                    </p>
                  </div>
                  <span className="text-[13px] text-t2 shrink-0">{timeAgo(log.created_at)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-2xl bg-cyan/[0.06] flex items-center justify-center mx-auto mb-3">
              <Shield size={20} className="text-t3" />
            </div>
            <p className="text-[14px] text-t2 font-medium">No audit events yet</p>
            <p className="text-[13px] text-t2 mt-1">Actions will be logged as your team uses Vaultline</p>
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-border bg-deep">
            <p className="text-[13px] text-t2">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} of {total}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-border hover:border-border-hover text-t3 hover:text-t1 transition disabled:opacity-20">
                <ChevronLeft size={14} />
              </button>
              <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-border hover:border-border-hover text-t3 hover:text-t1 transition disabled:opacity-20">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
