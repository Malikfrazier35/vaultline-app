import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Shield, ClipboardCheck, AlertTriangle, Loader2, Check, X, Plus,
  ChevronRight, FileText, Target, Clock, Users, BarChart3, Eye,
  Search, Calendar, TrendingUp, ArrowRight, Star, Zap, Lock
} from 'lucide-react'

function fmt(n) { const a = Math.abs(Number(n||0)); return a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}` }

// ═══ DIGITAL AUDIT WOMAN — Inline SVG brand illustration ═══
function AuditHeroIllustration({ isDark }) {
  const skin = '#D4A574'
  const hair = '#2C1810'
  const blouse = isDark ? '#22D3EE' : '#0E9AAA'
  const accent = isDark ? '#818CF8' : '#7C3AED'
  const bg1 = isDark ? 'rgba(34,211,238,0.06)' : 'rgba(14,154,170,0.06)'
  const bg2 = isDark ? 'rgba(129,140,248,0.04)' : 'rgba(124,58,237,0.04)'
  const doc = isDark ? '#1E293B' : '#F8FAFC'
  const docLine = isDark ? 'rgba(148,163,184,0.2)' : 'rgba(100,116,139,0.15)'
  const check = '#22C55E'

  return (
    <svg viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[280px]" role="img" aria-label="Illustration of a woman reviewing an audit document with checkmarks">
      {/* Background circles */}
      <circle cx="140" cy="100" r="90" fill={bg1} />
      <circle cx="160" cy="85" r="60" fill={bg2} />

      {/* Document/clipboard */}
      <rect x="130" y="50" width="80" height="105" rx="6" fill={doc} stroke={docLine} strokeWidth="1.5" />
      <rect x="155" y="42" width="30" height="16" rx="4" fill={accent} opacity="0.9" />
      {/* Document lines */}
      <rect x="142" y="70" width="56" height="3" rx="1.5" fill={docLine} />
      <rect x="142" y="80" width="45" height="3" rx="1.5" fill={docLine} />
      <rect x="142" y="90" width="52" height="3" rx="1.5" fill={docLine} />
      <rect x="142" y="100" width="38" height="3" rx="1.5" fill={docLine} />
      <rect x="142" y="110" width="48" height="3" rx="1.5" fill={docLine} />
      <rect x="142" y="120" width="30" height="3" rx="1.5" fill={docLine} />
      {/* Checkmarks on document */}
      <circle cx="149" cy="131" r="5" fill={check} opacity="0.15" />
      <path d="M146.5 131 L148.5 133 L152 129" stroke={check} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="162" cy="131" r="5" fill={check} opacity="0.15" />
      <path d="M159.5 131 L161.5 133 L165 129" stroke={check} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="175" cy="131" r="5" fill={check} opacity="0.15" />
      <path d="M172.5 131 L174.5 133 L178 129" stroke={check} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Magnifying glass */}
      <circle cx="198" cy="67" r="14" fill="none" stroke={accent} strokeWidth="2.5" opacity="0.7" />
      <line x1="208" y1="77" x2="218" y2="87" stroke={accent} strokeWidth="2.5" strokeLinecap="round" opacity="0.7" />
      <path d="M193 64 L197 68 L203 62" stroke={check} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

      {/* Woman figure */}
      {/* Hair */}
      <ellipse cx="85" cy="68" rx="24" ry="26" fill={hair} />
      <path d="M62 75 Q60 95 68 105" fill={hair} />
      {/* Face */}
      <ellipse cx="87" cy="72" rx="18" ry="20" fill={skin} />
      {/* Eyes */}
      <ellipse cx="80" cy="70" rx="2.5" ry="2" fill={hair} />
      <ellipse cx="94" cy="70" rx="2.5" ry="2" fill={hair} />
      {/* Slight smile */}
      <path d="M82 79 Q87 83 92 79" stroke={hair} strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Glasses */}
      <rect x="75" y="66" width="12" height="8" rx="3" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.8" />
      <rect x="89" y="66" width="12" height="8" rx="3" fill="none" stroke={accent} strokeWidth="1.2" opacity="0.8" />
      <line x1="87" y1="70" x2="89" y2="70" stroke={accent} strokeWidth="1" opacity="0.6" />
      {/* Hair detail — side sweep */}
      <path d="M63 60 Q70 45 90 45 Q105 45 110 60" fill={hair} />
      {/* Earring */}
      <circle cx="68" cy="78" r="2" fill={accent} opacity="0.6" />

      {/* Body / blouse */}
      <path d="M65 95 Q65 105 60 130 Q58 145 80 155 L110 155 Q132 145 130 130 Q125 105 125 95 Q110 88 87 88 Q70 88 65 95Z" fill={blouse} />
      {/* Collar detail */}
      <path d="M78 95 L87 105 L96 95" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round" />
      {/* Arm reaching toward document */}
      <path d="M120 110 Q128 105 138 100 Q142 98 142 103 Q140 108 132 112 Q125 115 120 115Z" fill={skin} />

      {/* Small data visualization element */}
      <rect x="60" y="140" width="50" height="25" rx="4" fill={doc} stroke={docLine} strokeWidth="1" />
      <rect x="66" y="148" width="4" height="12" rx="1" fill={blouse} opacity="0.5" />
      <rect x="73" y="152" width="4" height="8" rx="1" fill={blouse} opacity="0.7" />
      <rect x="80" y="145" width="4" height="15" rx="1" fill={blouse} opacity="0.9" />
      <rect x="87" y="149" width="4" height="11" rx="1" fill={accent} opacity="0.6" />
      <rect x="94" y="146" width="4" height="14" rx="1" fill={check} opacity="0.5" />

      {/* Shield badge */}
      <path d="M225 140 L225 152 Q225 160 215 165 Q205 160 205 152 L205 140 Q215 136 225 140Z" fill={accent} opacity="0.15" />
      <path d="M225 140 L225 152 Q225 160 215 165 Q205 160 205 152 L205 140 Q215 136 225 140Z" fill="none" stroke={accent} strokeWidth="1.5" opacity="0.4" />
      <path d="M210 150 L213 153 L220 146" stroke={check} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SEV_STYLE = { critical: 'bg-red/[0.08] text-red', high: 'bg-red/[0.06] text-red', medium: 'bg-amber/[0.06] text-amber', low: 'bg-t3/[0.06] text-t3' }
const FINDING_STATUS = { draft: 'text-t3', open: 'text-amber', management_review: 'text-purple', remediation_planned: 'text-cyan', in_remediation: 'text-cyan', verification: 'text-green', closed: 'text-green', accepted_risk: 'text-t3' }
const PROGRAM_TYPES = ['internal_audit', 'external_audit', 'sox_compliance', 'security_audit', 'financial_controls', 'operational_audit', 'self_assessment', 'continuous_monitoring']

export default function AuditCenter() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | programs | checklists | findings | schedules
  const [activeChecklist, setActiveChecklist] = useState(null)
  const [checklistData, setChecklistData] = useState(null)
  const [showProgramForm, setShowProgramForm] = useState(false)
  const [programForm, setProgramForm] = useState({ name: '', program_type: 'internal_audit', scope_areas: '' })
  const [showFindingForm, setShowFindingForm] = useState(false)
  const [findingForm, setFindingForm] = useState({ title: '', description: '', finding_type: 'observation', severity: 'medium', recommendation: '' })
  const isAdmin = ['owner', 'admin'].includes(profile?.role)

  // Detect theme for illustration
  const isDark = document.documentElement.style.getPropertyValue('--color-void')?.includes('03') || true

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('audit-ops', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function loadChecklist(id) {
    const { data: d } = await safeInvoke('audit-ops', { action: 'get_checklist', checklist_id: id })
    setChecklistData(d)
    setActiveChecklist(id)
  }

  async function respond(checklistId, itemId, response, notes = '') {
    await safeInvoke('audit-ops', { action: 'respond', checklist_id: checklistId, item_id: itemId, response, notes })
    loadChecklist(checklistId)
    load()
  }

  async function cloneTemplate(templateId) {
    const { data: d } = await safeInvoke('audit-ops', { action: 'clone_template', template_id: templateId, assigned_to: profile?.id })
    if (d?.success) { toast.success('Checklist created from template'); load() }
  }

  async function createProgram(e) {
    e.preventDefault()
    await safeInvoke('audit-ops', { action: 'create_program', ...programForm, scope_areas: programForm.scope_areas.split(',').map(s => s.trim()).filter(Boolean) })
    toast.success('Audit program created'); setShowProgramForm(false); load()
  }

  async function createFinding(e) {
    e.preventDefault()
    await safeInvoke('audit-ops', { action: 'create_finding', ...findingForm })
    toast.success('Finding reported'); setShowFindingForm(false); load()
  }

  async function updateFinding(id, status) {
    await safeInvoke('audit-ops', { action: 'update_finding', finding_id: id, status })
    toast.success('Finding updated'); load()
  }

  const summary = data?.summary || {}
  const findings = data?.findings || {}
  const programs = data?.programs || []
  const checklists = data?.checklists || []
  const templates = data?.templates || []
  const schedules = data?.schedules || []

  if (loading) return <SkeletonPage />

  // If viewing a checklist
  if (activeChecklist && checklistData) {
    const cl = checklistData.checklist
    const resps = checklistData.responses || {}
    return (
      <div className="space-y-4">
        <button onClick={() => { setActiveChecklist(null); setChecklistData(null) }} className="text-[12px] text-t3 hover:text-cyan transition flex items-center gap-1">← Back to Audit Center</button>
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-[16px] font-bold text-t1">{cl.name}</h2>
              <p className="text-[12px] text-t3">{cl.description} · {cl.completion_pct || 0}% complete · {cl.pass_rate || 0}% pass rate</p>
            </div>
            <div className="h-2 w-32 rounded-full bg-border/20"><div className="h-full rounded-full bg-gradient-to-r from-cyan to-green transition-all" style={{ width: `${cl.completion_pct || 0}%` }} /></div>
          </div>
          <div className="space-y-3">
            {(cl.items || []).map((item, i) => {
              const resp = resps[item.id]
              return (
                <div key={item.id} className={`p-4 rounded-xl border ${resp?.response === 'fail' ? 'border-red/[0.15] bg-red/[0.02]' : resp?.response === 'pass' ? 'border-green/[0.08] bg-green/[0.01]' : 'border-border/20 bg-deep/30'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-[10px] font-mono text-t4 w-6 pt-1">{i + 1}.</span>
                    <div className="flex-1">
                      <p className="text-[13px] text-t1">{item.question}</p>
                      {item.help_text && <p className="text-[10px] text-t4 mt-1">{item.help_text}</p>}
                      <div className="flex items-center gap-2 mt-1">
                        {item.category && <span className="text-[9px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded">{item.category}</span>}
                        <span className="text-[9px] font-mono text-t4">Risk weight: {item.risk_weight}/10</span>
                        {item.evidence_required && <span className="text-[9px] font-mono text-amber">Evidence required</span>}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {['pass', 'fail', 'partial', 'na'].map(r => (
                        <button key={r} onClick={() => respond(cl.id, item.id, r)}
                          className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition ${resp?.response === r
                            ? (r === 'pass' ? 'bg-green text-void' : r === 'fail' ? 'bg-red text-void' : r === 'partial' ? 'bg-amber text-void' : 'bg-t3 text-void')
                            : 'bg-deep text-t3 border border-border/20 hover:border-border'}`}>
                          {r === 'pass' ? '✓ Pass' : r === 'fail' ? '✗ Fail' : r === 'partial' ? '◐ Partial' : 'N/A'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* ═══ HERO with Digital Woman Illustration ═══ */}
      <div className="glass-card rounded-2xl p-6 overflow-hidden relative">
        <div className="flex items-center gap-8">
          <div className="flex-1">
            <span className="text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-cyan">AUDIT CENTER</span>
            <h1 className="font-display text-2xl font-black tracking-tight mt-1">Treasury Audit & Compliance</h1>
            <p className="text-[13px] text-t3 mt-2 max-w-md">Manage audit programs, run checklists, track findings, and maintain continuous compliance — all from one command center.</p>
            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green/[0.06] border border-green/[0.08]">
                <div className="w-2 h-2 rounded-full bg-green animate-[pulse_3s_ease-in-out_infinite]" />
                <span className="text-[11px] font-mono text-green">{summary.avg_pass_rate || 0}% pass rate</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber/[0.06] border border-amber/[0.08]">
                <AlertTriangle size={11} className="text-amber" />
                <span className="text-[11px] font-mono text-amber">{summary.open_findings || 0} open findings</span>
              </div>
              {summary.overdue_findings > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red/[0.06] border border-red/[0.08]">
                  <Clock size={11} className="text-red" />
                  <span className="text-[11px] font-mono text-red">{summary.overdue_findings} overdue</span>
                </div>
              )}
            </div>
          </div>
          {/* Digital Woman Illustration */}
          <div className="hidden lg:block shrink-0">
            <AuditHeroIllustration isDark={isDark} />
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Programs', value: summary.active_programs || 0, icon: Shield, color: 'cyan' },
          { label: 'Checklists', value: summary.checklists || 0, icon: ClipboardCheck, color: 'purple' },
          { label: 'Open Findings', value: summary.open_findings || 0, icon: AlertTriangle, color: 'amber' },
          { label: 'Critical', value: summary.critical_findings || 0, icon: Zap, color: 'red' },
          { label: 'Avg Days Open', value: summary.avg_days_open || 0, icon: Clock, color: summary.avg_days_open > 30 ? 'red' : 'green' },
        ].map(k => { const Icon = k.icon; return (
          <div key={k.label} className="glass-card rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1"><Icon size={13} className={`text-${k.color}`} /><span className="text-[10px] text-t3">{k.label}</span></div>
            <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
          </div>
        )})}
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['overview', 'programs', 'checklists', 'findings', 'schedules'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)} {t === 'findings' && (summary.open_findings || 0) > 0 ? `(${summary.open_findings})` : ''}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Findings severity breakdown */}
          {Object.keys(findings.by_severity || {}).length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">OPEN FINDINGS BY SEVERITY</span>
              <div className="flex items-center gap-4 mt-3">
                {['critical', 'high', 'medium', 'low'].map(sev => (
                  <div key={sev} className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-bold uppercase px-2 py-1 rounded ${SEV_STYLE[sev]}`}>{sev}</span>
                    <span className="font-mono text-[16px] font-bold text-t1 terminal-data">{(findings.by_severity || {})[sev] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">CHECKLIST TEMPLATES</span>
              <span className="text-[10px] text-t4">{templates.length} available</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {templates.map(t => (
                <div key={t.id} className="glass-card rounded-xl p-4">
                  <ClipboardCheck size={16} className="text-purple mb-2" />
                  <h3 className="text-[13px] font-bold text-t1">{t.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-[10px] font-mono text-t4">
                    <span>{t.total_items} items</span>
                    <span>{t.checklist_type?.replace('_', ' ')}</span>
                  </div>
                  <button onClick={() => cloneTemplate(t.id)} className="mt-3 px-3 py-1.5 rounded-lg bg-purple/[0.06] text-purple text-[10px] font-semibold hover:bg-purple/[0.1] transition flex items-center gap-1">
                    <Plus size={10} /> Start Audit
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Recent findings */}
          {(findings.list || []).slice(0, 5).length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">RECENT FINDINGS</span>
              <div className="space-y-2 mt-3">
                {(findings.list || []).slice(0, 5).map(f => (
                  <div key={f.id} className={`glass-card rounded-xl p-4 flex items-center justify-between ${f.overdue ? 'border-red/[0.12]' : ''}`}>
                    <div className="flex items-center gap-3">
                      <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${SEV_STYLE[f.severity]}`}>{f.severity}</span>
                      <div>
                        <p className="text-[12px] font-medium text-t1">{f.title}</p>
                        <div className="flex items-center gap-2 text-[9px] font-mono text-t4 mt-0.5">
                          <span>{f.finding_number}</span>
                          <span className={FINDING_STATUS[f.status]}>{f.status.replace('_', ' ')}</span>
                          <span>{f.days_open}d open</span>
                          {f.overdue && <span className="text-red">OVERDUE</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROGRAMS */}
      {tab === 'programs' && (
        <div className="space-y-4">
          {isAdmin && <button onClick={() => setShowProgramForm(!showProgramForm)} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5"><Plus size={12} /> New Program</button>}
          {showProgramForm && (
            <form onSubmit={createProgram} className="glass-card rounded-2xl p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={programForm.name} onChange={e => setProgramForm({ ...programForm, name: e.target.value })} required placeholder="Program name" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
                <select value={programForm.program_type} onChange={e => setProgramForm({ ...programForm, program_type: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
                  {PROGRAM_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              <input value={programForm.scope_areas} onChange={e => setProgramForm({ ...programForm, scope_areas: e.target.value })} placeholder="Scope areas (comma-separated)" className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] transition flex items-center gap-1.5"><Shield size={12} /> Create</button>
            </form>
          )}
          {programs.map(p => (
            <div key={p.id} className="glass-card rounded-xl p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${p.status === 'completed' ? 'bg-green/[0.06] text-green' : p.status === 'fieldwork' ? 'bg-cyan/[0.06] text-cyan' : 'bg-t3/[0.06] text-t3'}`}>{p.status}</span>
                    <span className="text-[8px] font-mono text-t4">{p.program_type.replace(/_/g, ' ')}</span>
                  </div>
                  <h3 className="text-[14px] font-bold text-t1">{p.name}</h3>
                  <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-t4">
                    <span>{p.findings_count || 0} findings ({p.open_findings || 0} open)</span>
                    {p.overall_score != null && <span>Score: {p.overall_score}/100</span>}
                    {p.scope_areas?.length > 0 && <span>{p.scope_areas.join(', ')}</span>}
                  </div>
                </div>
                {p.risk_rating && <span className={`text-[9px] font-mono font-bold uppercase px-2 py-1 rounded ${p.risk_rating === 'critical' ? 'bg-red/[0.06] text-red' : p.risk_rating === 'high' ? 'bg-red/[0.06] text-red' : p.risk_rating === 'moderate' ? 'bg-amber/[0.06] text-amber' : 'bg-green/[0.06] text-green'}`}>{p.risk_rating} risk</span>}
              </div>
            </div>
          ))}
          {programs.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Shield size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No audit programs</p></div>}
        </div>
      )}

      {/* CHECKLISTS */}
      {tab === 'checklists' && (
        <div className="space-y-3">
          {checklists.map(c => (
            <div key={c.id} className="glass-card rounded-xl p-4 flex items-center justify-between group hover:border-border-hover transition cursor-pointer" onClick={() => loadChecklist(c.id)}>
              <div className="flex items-center gap-3">
                <ClipboardCheck size={16} className={c.status === 'completed' ? 'text-green' : 'text-purple'} />
                <div>
                  <h3 className="text-[13px] font-bold text-t1 group-hover:text-cyan transition">{c.name}</h3>
                  <div className="flex items-center gap-3 text-[10px] font-mono text-t4 mt-0.5">
                    <span>{c.completion_pct || 0}% complete</span>
                    <span>{c.passed_items || 0}/{c.total_items} passed</span>
                    {c.failed_items > 0 && <span className="text-red">{c.failed_items} failed</span>}
                    <span>Pass rate: {c.pass_rate || 0}%</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 rounded-full bg-border/20"><div className="h-full rounded-full bg-gradient-to-r from-cyan to-green" style={{ width: `${c.completion_pct || 0}%` }} /></div>
                <ChevronRight size={14} className="text-t4 group-hover:text-cyan transition" />
              </div>
            </div>
          ))}
          {checklists.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><ClipboardCheck size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No active checklists</p><p className="text-[12px] text-t3 mt-1">Start an audit from the templates in Overview.</p></div>}
        </div>
      )}

      {/* FINDINGS */}
      {tab === 'findings' && (
        <div className="space-y-3">
          <button onClick={() => setShowFindingForm(!showFindingForm)} className="px-3 py-2 rounded-xl bg-amber/[0.08] text-amber text-[12px] font-semibold border border-amber/[0.12] transition flex items-center gap-1.5"><Plus size={12} /> Report Finding</button>
          {showFindingForm && (
            <form onSubmit={createFinding} className="glass-card rounded-2xl p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <input value={findingForm.title} onChange={e => setFindingForm({ ...findingForm, title: e.target.value })} required placeholder="Finding title" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
                <select value={findingForm.severity} onChange={e => setFindingForm({ ...findingForm, severity: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
                  {['low', 'medium', 'high', 'critical'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <textarea value={findingForm.description} onChange={e => setFindingForm({ ...findingForm, description: e.target.value })} required rows={2} placeholder="Description..." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none resize-none placeholder:text-t3" />
              <button type="submit" className="px-4 py-2 rounded-xl bg-amber/[0.08] text-amber text-[12px] font-semibold border border-amber/[0.12] transition flex items-center gap-1.5"><AlertTriangle size={12} /> Report</button>
            </form>
          )}
          {(findings.list || []).map(f => (
            <div key={f.id} className={`glass-card rounded-xl p-5 ${f.overdue ? 'border-red/[0.15]' : ''}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[8px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${SEV_STYLE[f.severity]}`}>{f.severity}</span>
                    <span className="text-[8px] font-mono text-t4">{f.finding_number}</span>
                    <span className="text-[8px] font-mono text-t4">{f.finding_type?.replace(/_/g, ' ')}</span>
                    {f.overdue && <span className="text-[8px] font-mono font-bold text-red bg-red/[0.06] px-1.5 py-0.5 rounded">OVERDUE</span>}
                  </div>
                  <h3 className="text-[14px] font-bold text-t1">{f.title}</h3>
                  <p className="text-[12px] text-t3 mt-1 line-clamp-2">{f.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-t4">
                    <span className={FINDING_STATUS[f.status]}>{f.status.replace(/_/g, ' ')}</span>
                    <span>{f.days_open}d open</span>
                    {f.remediation_due_date && <span>Due: {f.remediation_due_date}</span>}
                    {f.root_cause && <span>Root cause: {f.root_cause.slice(0, 40)}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  {f.status === 'open' && <button onClick={() => updateFinding(f.id, 'remediation_planned')} className="px-2 py-1 rounded-lg bg-cyan/[0.06] text-cyan text-[9px] font-semibold hover:bg-cyan/[0.1] transition">Plan Fix</button>}
                  {f.status === 'in_remediation' && <button onClick={() => updateFinding(f.id, 'verification')} className="px-2 py-1 rounded-lg bg-green/[0.06] text-green text-[9px] font-semibold hover:bg-green/[0.1] transition">Verify</button>}
                  {f.status === 'verification' && <button onClick={() => updateFinding(f.id, 'closed')} className="px-2 py-1 rounded-lg bg-green/[0.06] text-green text-[9px] font-semibold hover:bg-green/[0.1] transition"><Check size={9} className="inline" /> Close</button>}
                </div>
              </div>
            </div>
          ))}
          {(findings.list || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Check size={28} className="text-green mx-auto mb-3" /><p className="text-[14px] text-t2">No findings</p></div>}
        </div>
      )}

      {/* SCHEDULES */}
      {tab === 'schedules' && (
        <div className="space-y-2">
          {schedules.map(s => (
            <div key={s.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Calendar size={14} className="text-cyan" />
                <div>
                  <span className="text-[13px] font-medium text-t1">{s.title}</span>
                  <div className="text-[10px] font-mono text-t4 mt-0.5">{s.audit_type} · {s.frequency} · Next: {s.next_date}</div>
                </div>
              </div>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${s.enabled ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{s.enabled ? 'ACTIVE' : 'OFF'}</span>
            </div>
          ))}
          {schedules.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Calendar size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No scheduled audits</p></div>}
        </div>
      )}
    </div>
  )
}
