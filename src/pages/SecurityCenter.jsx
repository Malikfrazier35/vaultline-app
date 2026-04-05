import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Shield, AlertTriangle, Lock, Eye, Monitor, Globe, Key, Clock,
  Users, RefreshCw, Loader2, Plus, X, Check, ChevronRight,
  Fingerprint, Wifi, Activity, TrendingUp, Zap
} from 'lucide-react'

function ScoreRing({ score, size = 120 }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, pct = (score / 100) * c
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#FBBF24' : score >= 40 ? '#F97316' : '#EF4444'
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(148,163,184,0.08)" strokeWidth="6" />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="6" strokeDasharray={`${pct} ${c}`} strokeLinecap="round" className="transition-all duration-1000" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[28px] font-black terminal-data" style={{ color }}>{score}</span>
        <span className="text-[9px] font-mono text-t4 uppercase tracking-wider">/ 100</span>
      </div>
    </div>
  )
}

export default function SecurityCenter() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | threats | sessions | policies | ips
  const [calculating, setCalculating] = useState(false)
  // IP form
  const [newCidr, setNewCidr] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [ips, setIps] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('security-ops', { action: 'dashboard' })
    setData(d)
    const { data: ipData } = await safeInvoke('security-ops', { action: 'list_ips' })
    setIps(ipData?.ips || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function calcScore() {
    setCalculating(true)
    const { data: d } = await safeInvoke('security-ops', { action: 'calculate_score' })
    if (d?.score != null) toast.success(`Security score: ${d.score}/100`)
    load()
    setCalculating(false)
  }

  async function resolveEvent(id) {
    await safeInvoke('security-ops', { action: 'resolve_event', event_id: id })
    toast.success('Threat resolved')
    load()
  }

  async function revokeSession(id) {
    await safeInvoke('security-ops', { action: 'revoke_session', session_id: id })
    toast.success('Session revoked')
    load()
  }

  async function addIp() {
    if (!newCidr) return
    await safeInvoke('security-ops', { action: 'add_ip', cidr: newCidr, label: newLabel })
    setNewCidr(''); setNewLabel('')
    const { data: d } = await safeInvoke('security-ops', { action: 'list_ips' })
    setIps(d?.ips || [])
    toast.success('IP added')
  }

  async function removeIp(id) {
    await safeInvoke('security-ops', { action: 'remove_ip', ip_id: id })
    setIps(prev => prev.filter(ip => ip.id !== id))
  }

  async function updatePolicy(updates) {
    await safeInvoke('security-ops', { action: 'update_policy', ...updates })
    toast.success('Policy updated')
    load()
  }

  const score = data?.score
  const policy = data?.policy
  const events = data?.events || {}
  const threats = data?.threats || {}

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={20} className="animate-spin text-t3" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Security Center</h1>
          <p className="text-[13px] text-t3 mt-0.5">{threats.unresolved || 0} unresolved threats · {events.last_24h || 0} events (24h)</p>
        </div>
        <button onClick={calcScore} disabled={calculating}
          className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2 disabled:opacity-50">
          {calculating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Recalculate Score
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {[{id:'overview',label:'Overview'},{id:'threats',label:`Threats (${threats.unresolved||0})`},{id:'sessions',label:'Sessions'},{id:'policies',label:'Policies'},{id:'ips',label:'IP Allowlist'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t.id ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Score */}
            <div className="glass-card rounded-2xl p-6 flex flex-col items-center">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider mb-4">SECURITY POSTURE</span>
              <ScoreRing score={score?.overall_score || 0} />
              <div className="grid grid-cols-5 gap-3 mt-4 w-full">
                {[{l:'Auth',v:score?.auth_score},{l:'Access',v:score?.access_score},{l:'Data',v:score?.data_score},{l:'Comply',v:score?.compliance_score},{l:'Network',v:score?.network_score}].map(s => (
                  <div key={s.l} className="text-center">
                    <p className="font-mono text-[14px] font-bold text-t1 terminal-data">{s.v || 0}</p>
                    <p className="text-[8px] font-mono text-t4 uppercase">{s.l}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick stats */}
            <div className="glass-card rounded-2xl p-6 space-y-4">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">ACTIVITY (7 DAYS)</span>
              <div className="space-y-3">
                {Object.entries(events.by_severity || {}).map(([sev, count]) => {
                  const colors = { critical: 'bg-red', high: 'bg-amber', medium: 'bg-cyan', low: 'bg-t3', info: 'bg-purple' }
                  return (
                    <div key={sev} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${colors[sev] || 'bg-t3'}`} />
                        <span className="text-[12px] text-t2 capitalize">{sev}</span>
                      </div>
                      <span className="font-mono text-[13px] font-bold text-t1 terminal-data">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recommendations */}
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">RECOMMENDATIONS</span>
              {(score?.recommendations || []).length === 0 ? (
                <div className="flex items-center gap-2 text-green"><Check size={14} /><span className="text-[13px]">All security checks passing</span></div>
              ) : (
                (score?.recommendations || []).slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <AlertTriangle size={12} className="text-amber mt-0.5 flex-shrink-0" />
                    <span className="text-[12px] text-t2">{r}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent events */}
          <div className="glass-card rounded-2xl p-5">
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">RECENT SECURITY EVENTS</span>
            <div className="mt-3 space-y-2">
              {(events.recent || []).slice(0, 8).map(e => {
                const sevColors = { critical: 'text-red', high: 'text-amber', medium: 'text-cyan', low: 'text-t3', info: 'text-purple' }
                return (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-mono font-bold uppercase ${sevColors[e.severity]}`}>{e.severity}</span>
                      <span className="text-[12px] text-t1">{e.event_type.replace(/_/g, ' ')}</span>
                      {e.ip_address && <span className="text-[9px] font-mono text-t4">{e.ip_address}</span>}
                    </div>
                    <span className="text-[9px] font-mono text-t4">{new Date(e.created_at).toLocaleString()}</span>
                  </div>
                )
              })}
              {(events.recent || []).length === 0 && <p className="text-[12px] text-t3 text-center py-4">No security events recorded yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── THREATS ── */}
      {tab === 'threats' && (
        <div className="space-y-3">
          {(threats.items || []).length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <Shield size={28} className="text-green mx-auto mb-3" />
              <p className="text-[14px] text-t2 font-medium">No unresolved threats</p>
              <p className="text-[12px] text-t3 mt-1">All security events have been reviewed and resolved.</p>
            </div>
          ) : (
            (threats.items).map(t => (
              <div key={t.id} className={`glass-card rounded-xl p-5 border-l-4 ${t.severity === 'critical' ? 'border-l-red' : 'border-l-amber'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${t.severity === 'critical' ? 'bg-red/[0.06] text-red' : 'bg-amber/[0.06] text-amber'}`}>{t.severity}</span>
                      <span className="text-[10px] font-mono text-t3">{t.event_type.replace(/_/g, ' ')}</span>
                    </div>
                    <p className="text-[13px] text-t1">{t.description || t.event_type}</p>
                    <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-t4">
                      {t.ip_address && <span>IP: {t.ip_address}</span>}
                      <span>{new Date(t.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <button onClick={() => resolveEvent(t.id)} className="px-3 py-1.5 rounded-lg text-[11px] text-green border border-green/20 hover:bg-green/[0.06] transition flex items-center gap-1">
                    <Check size={11} /> Resolve
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── SESSIONS ── */}
      {tab === 'sessions' && (
        <div className="space-y-3">
          {(data?.sessions || []).map(s => (
            <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Monitor size={16} className="text-t3" />
                <div>
                  <p className="text-[12px] text-t1">{s.device_type || 'Unknown device'} · {s.ip_address || 'Unknown IP'}</p>
                  <p className="text-[10px] text-t4 font-mono">Last active: {new Date(s.last_active_at).toLocaleString()}</p>
                </div>
              </div>
              <button onClick={() => revokeSession(s.id)} className="px-3 py-1.5 rounded-lg text-[10px] text-red border border-red/20 hover:bg-red/[0.06] transition">Revoke</button>
            </div>
          ))}
          {(data?.sessions || []).length === 0 && <p className="text-center text-[13px] text-t3 py-12">No active sessions</p>}
        </div>
      )}

      {/* ── POLICIES ── */}
      {tab === 'policies' && policy && (
        <div className="space-y-4">
          {[
            { label: 'Require MFA', key: 'mfa_required', type: 'toggle' },
            { label: 'IP Allowlist', key: 'ip_allowlist_enabled', type: 'toggle' },
            { label: 'After-Hours Alerts', key: 'after_hours_alerts', type: 'toggle' },
            { label: 'Export Approval Required', key: 'export_approval_required', type: 'toggle' },
            { label: 'Data Classification', key: 'data_classification_enabled', type: 'toggle' },
            { label: 'Session Timeout (min)', key: 'session_timeout_minutes', type: 'number' },
            { label: 'Max Concurrent Sessions', key: 'concurrent_sessions_max', type: 'number' },
            { label: 'Max Failed Logins', key: 'max_failed_logins', type: 'number' },
            { label: 'Lockout Duration (min)', key: 'lockout_duration_minutes', type: 'number' },
            { label: 'Min Password Length', key: 'password_min_length', type: 'number' },
            { label: 'Audit Retention (days)', key: 'audit_retention_days', type: 'number' },
          ].map(p => (
            <div key={p.key} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <span className="text-[13px] text-t1">{p.label}</span>
              {p.type === 'toggle' ? (
                <button onClick={() => updatePolicy({ [p.key]: !policy[p.key] })}
                  className={`w-10 h-5 rounded-full relative transition-all ${policy[p.key] ? 'bg-cyan' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${policy[p.key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              ) : (
                <input type="number" value={policy[p.key]} onChange={e => updatePolicy({ [p.key]: parseInt(e.target.value) })}
                  className="w-24 px-3 py-1.5 rounded-lg glass-input text-t1 text-[12px] font-mono text-right outline-none focus:border-cyan/40 transition" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── IP ALLOWLIST ── */}
      {tab === 'ips' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <input value={newCidr} onChange={e => setNewCidr(e.target.value)} placeholder="CIDR (e.g. 10.0.0.0/24)"
              className="flex-1 px-4 py-2.5 rounded-xl glass-input text-t1 text-[13px] font-mono outline-none focus:border-cyan/40 transition placeholder:text-t3" />
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Label (optional)"
              className="w-40 px-4 py-2.5 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
            <button onClick={addIp} className="px-4 py-2.5 rounded-xl bg-cyan/[0.08] text-cyan border border-cyan/[0.12] hover:bg-cyan/[0.12] transition"><Plus size={14} /></button>
          </div>
          {ips.map(ip => (
            <div key={ip.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div>
                <span className="font-mono text-[13px] text-t1">{ip.cidr}</span>
                {ip.label && <span className="text-[11px] text-t3 ml-3">{ip.label}</span>}
              </div>
              <button onClick={() => removeIp(ip.id)} className="p-1.5 rounded-lg text-t4 hover:text-red hover:bg-red/[0.06] transition"><X size={13} /></button>
            </div>
          ))}
          {ips.length === 0 && <p className="text-center text-[13px] text-t3 py-8">No IP restrictions configured. All IPs are allowed.</p>}
        </div>
      )}
    </div>
  )
}
