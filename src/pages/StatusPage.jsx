import AnimatedBackground from "@/components/AnimatedBackground"
import { useState, useEffect } from 'react'
import { useSEO } from '@/hooks/useSEO'
import { Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import ThemeToggle from '@/components/ThemeToggle'
import {
  CheckCircle2, AlertTriangle, XCircle, Clock, Activity,
  Server, CreditCard, BarChart3, Globe, MessageSquare, Zap,
  Database, RefreshCw, Loader2
} from 'lucide-react'

const SERVICE_META = {
  api: { label: 'API', icon: Server },
  plaid_sync: { label: 'Bank Sync (Plaid)', icon: CreditCard },
  qb_sync: { label: 'QuickBooks Sync', icon: RefreshCw },
  acct_sync: { label: 'Accounting Sync', icon: RefreshCw },
  stripe: { label: 'Payments (Stripe)', icon: CreditCard },
  forecast_engine: { label: 'Forecast Engine', icon: BarChart3 },
  copilot: { label: 'AI Copilot', icon: MessageSquare },
  fx_rates: { label: 'FX Rates', icon: Globe },
  edge_functions: { label: 'Edge Functions', icon: Zap },
  database: { label: 'Database', icon: Database },
}
const STATUS_DISPLAY = {
  operational: { icon: CheckCircle2, color: 'text-green', bg: 'bg-green/[0.06]', label: 'Operational' },
  degraded: { icon: AlertTriangle, color: 'text-amber', bg: 'bg-amber/[0.06]', label: 'Degraded' },
  partial_outage: { icon: AlertTriangle, color: 'text-red', bg: 'bg-red/[0.06]', label: 'Partial Outage' },
  major_outage: { icon: XCircle, color: 'text-red', bg: 'bg-red/[0.06]', label: 'Major Outage' },
  maintenance: { icon: Clock, color: 'text-purple', bg: 'bg-purple/[0.06]', label: 'Maintenance' },
}

export default function StatusPage() {
  const [data, setData] = useState(null)
  useSEO({ title: 'System Status', description: 'Vaultline system status: real-time uptime monitoring, active incidents, and service health for all platform components.', canonical: '/status' })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // title set by useSEO
    async function load() {
      const { data: d } = await safeInvoke('qa-monitor', { action: 'status' })
      setData(d)
      setLoading(false)
    }
    load()
    const interval = setInterval(load, 60000)
    return () => clearInterval(interval)
  }, [])

  const overall = data?.overall_status || 'operational'
  const od = STATUS_DISPLAY[overall] || STATUS_DISPLAY.operational
  const OverallIcon = od.icon

  return (
    <div className="min-h-screen bg-void">
      <AnimatedBackground variant="contours" />
      <div className="fixed top-5 right-5 z-50"><ThemeToggle /></div>
      <nav className="flex items-center justify-between px-8 py-5 max-w-4xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="Vaultline" className="w-8 h-8 rounded-lg" />
          <span className="font-display text-lg font-extrabold">Vault<span className="bg-gradient-to-r from-cyan to-purple bg-clip-text text-transparent">line</span></span>
        </Link>
        <span className="text-[12px] font-mono text-t3">System Status</span>
      </nav>

      <div className="max-w-4xl mx-auto px-6 pb-20">
        {loading ? (
          <div className="space-y-4">
            <div className="skeleton h-20 w-full rounded-xl" />
            {[1,2,3,4].map(i => <div key={i} className="skeleton h-16 w-full rounded-xl" style={{ animationDelay: `${i * 0.08}s` }} />)}
          </div>
        ) : (
          <div className="space-y-8">
            {/* Overall status hero */}
            <div className={`rounded-2xl p-8 text-center border ${overall === 'operational' ? 'bg-green/[0.03] border-green/[0.1]' : overall === 'degraded' ? 'bg-amber/[0.03] border-amber/[0.1]' : 'bg-red/[0.03] border-red/[0.1]'}`}>
              <OverallIcon size={32} className={`${od.color} mx-auto mb-3`} />
              <h1 className="font-display text-2xl font-black">{overall === 'operational' ? 'All Systems Operational' : od.label}</h1>
              <p className="text-[13px] text-t3 mt-1">Last checked {new Date().toLocaleTimeString()}</p>
            </div>

            {/* Service grid */}
            <div className="space-y-2">
              <h2 className="text-[11px] font-mono text-t3 uppercase tracking-wider mb-3">SERVICE STATUS</h2>
              {(data?.services || []).map(svc => {
                const meta = SERVICE_META[svc.service] || { label: svc.service, icon: Activity }
                const sd = STATUS_DISPLAY[svc.status] || STATUS_DISPLAY.operational
                const Icon = meta.icon
                const StatusIcon = sd.icon
                const uptime = data?.uptime?.[svc.service] || 100
                return (
                  <div key={svc.service} className="glass-card rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon size={16} className="text-t3" />
                      <span className="text-[13px] font-medium text-t1">{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] font-mono text-t4">{uptime}% uptime (30d)</span>
                      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-mono font-bold ${sd.bg} ${sd.color}`}>
                        <StatusIcon size={11} />{sd.label}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Active incidents */}
            {(data?.active_incidents || []).length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-mono text-t3 uppercase tracking-wider">ACTIVE INCIDENTS</h2>
                {data.active_incidents.map(inc => (
                  <div key={inc.id} className="glass-card rounded-xl p-5 border-red/[0.1]">
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${inc.severity === 'critical' ? 'bg-red/[0.06] text-red' : 'bg-amber/[0.06] text-amber'}`}>{inc.severity}</span>
                        <h3 className="text-[14px] font-bold text-t1 mt-1">{inc.title}</h3>
                      </div>
                      <span className="text-[10px] font-mono text-t4">{new Date(inc.started_at).toLocaleString()}</span>
                    </div>
                    {inc.description && <p className="text-[12px] text-t3 mb-3">{inc.description}</p>}
                    {inc.incident_updates?.length > 0 && (
                      <div className="space-y-2 border-l-2 border-border/30 pl-3 ml-1">
                        {inc.incident_updates.map(u => (
                          <div key={u.id}>
                            <span className="text-[9px] font-mono text-t4">{new Date(u.created_at).toLocaleTimeString()} — <span className="text-cyan">{u.status}</span></span>
                            <p className="text-[11px] text-t2">{u.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Recent resolved */}
            {(data?.recent_resolved || []).length > 0 && (
              <div className="space-y-3">
                <h2 className="text-[11px] font-mono text-t3 uppercase tracking-wider">RECENTLY RESOLVED (7 DAYS)</h2>
                {data.recent_resolved.map(inc => (
                  <div key={inc.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={14} className="text-green" />
                      <span className="text-[13px] text-t1">{inc.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-t4">
                      Resolved {new Date(inc.resolved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
