import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Shield, Eye, FileText, Clock, AlertTriangle, Check, ChevronRight,
  Download, Users, Database, Lock, RefreshCw, Loader2, Plus,
  Archive, Trash2, Globe, Scale, ClipboardCheck
} from 'lucide-react'

const DSR_STATUS = {
  received: { bg: 'bg-cyan/[0.06]', text: 'text-cyan', label: 'Received' },
  verified: { bg: 'bg-purple/[0.06]', text: 'text-purple', label: 'Verified' },
  in_progress: { bg: 'bg-amber/[0.06]', text: 'text-amber', label: 'In Progress' },
  completed: { bg: 'bg-green/[0.06]', text: 'text-green', label: 'Completed' },
  denied: { bg: 'bg-red/[0.06]', text: 'text-red', label: 'Denied' },
  extended: { bg: 'bg-amber/[0.06]', text: 'text-amber', label: 'Extended' },
}
const DSR_TYPES = { access: 'Data Access', rectification: 'Rectification', erasure: 'Erasure', portability: 'Data Portability', restrict_processing: 'Restrict Processing', object_processing: 'Object Processing', withdraw_consent: 'Withdraw Consent' }
const LEGAL_BASIS = { consent: 'Consent', contract: 'Contract', legal_obligation: 'Legal Obligation', vital_interests: 'Vital Interests', public_interest: 'Public Interest', legitimate_interests: 'Legitimate Interests' }

export default function PrivacyCenter() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | dsr | consent | register | retention

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('privacy-ops', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function updateDSR(dsrId, status, notes) {
    await safeInvoke('privacy-ops', { action: 'update_dsr', dsr_id: dsrId, status, notes })
    toast.success(`DSR updated to ${status}`)
    load()
  }

  async function exportUserData(email) {
    const { data: d } = await safeInvoke('privacy-ops', { action: 'export_user_data', target_email: email })
    if (d?.success) {
      const blob = new Blob([JSON.stringify(d.data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `data-export-${email}-${new Date().toISOString().split('T')[0]}.json`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${d.record_count} records`)
    } else toast.error(d?.error || 'Export failed')
  }

  async function enforceRetention() {
    const { data: d } = await safeInvoke('privacy-ops', { action: 'enforce_retention' })
    toast.success(`Retention enforced: ${d?.enforced || 0} policies processed`)
    load()
  }

  const dsrs = data?.dsrs || {}
  const consent = data?.consent || {}
  const records = data?.processing_records || []
  const retention = data?.retention_policies || []

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={20} className="animate-spin text-t3" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Privacy Center</h1>
          <p className="text-[13px] text-t3 mt-0.5">{dsrs.open || 0} open DSRs · {records.length} processing activities · {retention.length} retention policies</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {[{id:'overview',label:'Overview'},{id:'dsr',label:`DSRs (${dsrs.open||0})`},{id:'consent',label:'Consent'},{id:'register',label:'Processing Register'},{id:'retention',label:'Data Retention'}].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t.id ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW ── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Open DSRs', value: dsrs.open || 0, sub: dsrs.overdue > 0 ? `${dsrs.overdue} overdue` : 'All on track', icon: FileText, color: dsrs.overdue > 0 ? 'red' : 'cyan' },
              { label: 'Processing Activities', value: records.length, sub: 'Article 30 register', icon: Database, color: 'purple' },
              { label: 'Consent Records', value: consent.total || 0, sub: `${Object.keys(consent.stats || {}).length} types tracked`, icon: ClipboardCheck, color: 'green' },
              { label: 'Retention Policies', value: retention.length, sub: `${retention.filter(r => r.enabled).length} active`, icon: Clock, color: 'amber' },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-7 h-7 rounded-lg bg-${k.color}/[0.08] flex items-center justify-center`}><Icon size={14} className={`text-${k.color}`} /></div>
                    <span className="text-[11px] text-t3">{k.label}</span>
                  </div>
                  <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
                  <p className="text-[10px] text-t4 font-mono mt-0.5">{k.sub}</p>
                </div>
              )
            })}
          </div>

          {/* Overdue DSR alert */}
          {dsrs.overdue > 0 && (
            <div className="glass-card rounded-xl p-4 border-red/[0.1] bg-red/[0.02] flex items-center gap-3">
              <AlertTriangle size={18} className="text-red flex-shrink-0" />
              <div>
                <p className="text-[13px] font-bold text-red">{dsrs.overdue} overdue data subject request{dsrs.overdue !== 1 ? 's' : ''}</p>
                <p className="text-[11px] text-t3">GDPR requires response within 30 days. Take immediate action.</p>
              </div>
              <button onClick={() => setTab('dsr')} className="ml-auto px-3 py-1.5 rounded-lg text-[11px] text-red border border-red/20 hover:bg-red/[0.06] transition">View DSRs</button>
            </div>
          )}

          {/* Consent breakdown */}
          <div className="glass-card rounded-2xl p-5">
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">CONSENT BREAKDOWN</span>
            <div className="mt-3 space-y-2">
              {Object.entries(consent.stats || {}).map(([type, stats]) => {
                const pct = stats.total > 0 ? Math.round((stats.granted / stats.total) * 100) : 0
                return (
                  <div key={type} className="flex items-center justify-between py-1.5">
                    <span className="text-[12px] text-t2">{type.replace(/_/g, ' ')}</span>
                    <div className="flex items-center gap-3">
                      <div className="w-24 h-1.5 rounded-full bg-border/20">
                        <div className="h-full rounded-full bg-green transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] font-mono text-t3 w-12 text-right">{pct}%</span>
                      <span className="text-[9px] font-mono text-t4">{stats.granted}/{stats.total}</span>
                    </div>
                  </div>
                )
              })}
              {Object.keys(consent.stats || {}).length === 0 && <p className="text-[12px] text-t3 text-center py-4">No consent records yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── DSR MANAGEMENT ── */}
      {tab === 'dsr' && (
        <div className="space-y-3">
          {(dsrs.all || []).length === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center">
              <FileText size={28} className="text-t4 mx-auto mb-3" />
              <p className="text-[14px] text-t2">No data subject requests</p>
              <p className="text-[12px] text-t3 mt-1">DSRs submitted via the privacy portal will appear here.</p>
            </div>
          ) : (
            (dsrs.all).map(d => {
              const st = DSR_STATUS[d.status] || DSR_STATUS.received
              const isOverdue = !['completed', 'denied'].includes(d.status) && new Date(d.due_date) < new Date()
              const daysLeft = Math.ceil((new Date(d.due_date) - Date.now()) / 86400000)
              return (
                <div key={d.id} className={`glass-card rounded-xl p-5 ${isOverdue ? 'border-red/[0.15]' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${st.bg} ${st.text}`}>{st.label}</span>
                        <span className="text-[9px] font-mono text-t4">{DSR_TYPES[d.request_type] || d.request_type}</span>
                        <span className="text-[9px] font-mono text-t4 uppercase">{d.regulation}</span>
                        {isOverdue && <span className="text-[9px] font-mono text-red bg-red/[0.06] px-1.5 py-0.5 rounded">OVERDUE</span>}
                      </div>
                      <p className="text-[13px] text-t1">{d.requester_email}</p>
                      <div className="flex items-center gap-4 mt-1 text-[10px] font-mono text-t4">
                        <span>Due: {new Date(d.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                        <span>{daysLeft > 0 ? `${daysLeft}d remaining` : `${Math.abs(daysLeft)}d overdue`}</span>
                        <span>Submitted: {new Date(d.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {d.request_type === 'access' && !['completed', 'denied'].includes(d.status) && (
                        <button onClick={() => exportUserData(d.requester_email)}
                          className="px-3 py-1.5 rounded-lg text-[10px] text-cyan border border-cyan/20 hover:bg-cyan/[0.06] transition flex items-center gap-1">
                          <Download size={10} /> Export
                        </button>
                      )}
                      {!['completed', 'denied'].includes(d.status) && (
                        <select onChange={e => { if (e.target.value) updateDSR(d.id, e.target.value, '') }} defaultValue=""
                          className="px-2 py-1.5 rounded-lg glass-input text-[10px] font-mono outline-none">
                          <option value="">Update status...</option>
                          <option value="verified">Verified</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="denied">Denied</option>
                          <option value="extended">Extended</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ── CONSENT ── */}
      {tab === 'consent' && (
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">CONSENT TYPES</span>
          </div>
          <div className="space-y-3">
            {['terms_of_service', 'privacy_policy', 'marketing_email', 'analytics_tracking', 'third_party_sharing', 'data_processing', 'financial_data_sync', 'ai_processing'].map(type => {
              const stats = consent.stats?.[type] || { granted: 0, total: 0 }
              const pct = stats.total > 0 ? Math.round((stats.granted / stats.total) * 100) : 0
              return (
                <div key={type} className="glass-card rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[13px] text-t1 capitalize">{type.replace(/_/g, ' ')}</p>
                    <p className="text-[10px] font-mono text-t4">{stats.granted} granted / {stats.total} total</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-20 h-2 rounded-full bg-border/20">
                      <div className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-green' : pct >= 50 ? 'bg-amber' : 'bg-red'}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[12px] font-mono font-bold text-t1 w-10 text-right">{pct}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── PROCESSING REGISTER (Article 30) ── */}
      {tab === 'register' && (
        <div className="space-y-3">
          <p className="text-[11px] text-t3">GDPR Article 30 — Record of Processing Activities</p>
          {records.map(r => (
            <div key={r.id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h3 className="text-[14px] font-bold text-t1">{r.activity_name}</h3>
                  <p className="text-[12px] text-t3 mt-0.5">{r.purpose}</p>
                </div>
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-cyan/[0.06] text-cyan">{LEGAL_BASIS[r.legal_basis]}</span>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-[10px] font-mono">
                <div><span className="text-t4 block">Data Categories</span><span className="text-t2">{(r.data_categories || []).join(', ')}</span></div>
                <div><span className="text-t4 block">Data Subjects</span><span className="text-t2">{(r.data_subjects || []).join(', ')}</span></div>
                <div><span className="text-t4 block">Recipients</span><span className="text-t2">{(r.recipients || []).join(', ')}</span></div>
                <div><span className="text-t4 block">Retention</span><span className="text-t2">{r.retention_period}</span></div>
              </div>
              {r.dpia_required && (
                <div className="mt-2 flex items-center gap-1.5">
                  <AlertTriangle size={10} className={r.dpia_completed ? 'text-green' : 'text-amber'} />
                  <span className={`text-[10px] font-mono ${r.dpia_completed ? 'text-green' : 'text-amber'}`}>
                    DPIA {r.dpia_completed ? 'completed' : 'required'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── DATA RETENTION ── */}
      {tab === 'retention' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-t3">Automated data lifecycle management</p>
            <button onClick={enforceRetention}
              className="px-4 py-2 rounded-xl bg-amber/[0.08] text-amber text-[13px] font-semibold border border-amber/[0.12] hover:bg-amber/[0.12] transition-all flex items-center gap-2">
              <RefreshCw size={13} /> Run Retention Enforcement
            </button>
          </div>
          {retention.map(p => {
            const actionIcon = p.action === 'delete' ? Trash2 : p.action === 'anonymize' ? Eye : Archive
            const ActionIcon = actionIcon
            return (
              <div key={p.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <ActionIcon size={16} className={`${p.enabled ? 'text-amber' : 'text-t4'}`} />
                  <div>
                    <p className="text-[13px] text-t1">{p.data_type}</p>
                    <p className="text-[10px] font-mono text-t4">{p.table_name} · {p.action} after {p.retention_days} days</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {p.last_executed && <span className="text-[9px] font-mono text-t4">Last: {new Date(p.last_executed).toLocaleDateString()}</span>}
                  {p.records_processed > 0 && <span className="text-[9px] font-mono text-t4">{p.records_processed} processed</span>}
                  <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${p.enabled ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>
                    {p.enabled ? 'Active' : 'Disabled'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
