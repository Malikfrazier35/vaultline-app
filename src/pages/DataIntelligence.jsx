import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Brain, Database, AlertTriangle, Loader2, Check, X, Eye, Lightbulb,
  Shield, TrendingUp, Zap, BarChart3, RefreshCw, ChevronRight,
  FileText, GitBranch, Clock, Activity, ThumbsUp, ThumbsDown, Target
} from 'lucide-react'

const SEVERITY_STYLE = {
  info: { bg: 'bg-t3/[0.06]', text: 'text-t3', icon: Eye },
  suggestion: { bg: 'bg-cyan/[0.06]', text: 'text-cyan', icon: Lightbulb },
  warning: { bg: 'bg-amber/[0.06]', text: 'text-amber', icon: AlertTriangle },
  alert: { bg: 'bg-red/[0.06]', text: 'text-red', icon: Zap },
  critical: { bg: 'bg-red/[0.08]', text: 'text-red', icon: Shield },
}

const SOURCE_STATUS = {
  active: { text: 'text-green', label: 'ACTIVE' },
  degraded: { text: 'text-amber', label: 'DEGRADED' },
  error: { text: 'text-red', label: 'ERROR' },
  disconnected: { text: 'text-red', label: 'DISCONNECTED' },
  pending: { text: 'text-t3', label: 'PENDING' },
}

export default function DataIntelligence() {
  const { org } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | sources | quality | insights | lineage | reports

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('data-intel', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function resolveIssue(issueId, notes) {
    await safeInvoke('data-intel', { action: 'resolve_issue', issue_id: issueId, resolution_notes: notes || 'Resolved' })
    toast.success('Issue resolved')
    load()
  }

  async function updateInsight(insightId, status, helpful) {
    await safeInvoke('data-intel', { action: 'update_insight', insight_id: insightId, status, helpful })
    load()
  }

  const sources = data?.sources || {}
  const quality = data?.quality || {}
  const insights = data?.insights || {}

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Data Intelligence</h1>
          <p className="text-[13px] text-t3 mt-0.5">
            {sources.total || 0} sources · {sources.avg_quality || 0}% avg quality · {quality.open_issues || 0} open issues · {insights.new || 0} new insights
          </p>
        </div>
        <button onClick={load} className="px-3 py-2 rounded-xl border border-border text-[12px] text-t2 hover:border-border-hover transition flex items-center gap-1.5"><RefreshCw size={12} /> Refresh</button>
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px overflow-x-auto">
        {['overview', 'sources', 'quality', 'insights', 'lineage', 'reports'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg whitespace-nowrap ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Data Sources', value: sources.total || 0, sub: `${sources.healthy || 0} healthy`, icon: Database, color: 'cyan' },
              { label: 'Avg Quality', value: `${sources.avg_quality || 0}%`, icon: Shield, color: sources.avg_quality >= 80 ? 'green' : sources.avg_quality >= 50 ? 'amber' : 'red' },
              { label: 'Open Issues', value: quality.open_issues || 0, sub: `${quality.critical || 0} critical`, icon: AlertTriangle, color: quality.critical > 0 ? 'red' : 'amber' },
              { label: 'New Insights', value: insights.new || 0, sub: `${insights.total || 0} total`, icon: Brain, color: 'purple' },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><div className={`w-7 h-7 rounded-lg bg-${k.color}/[0.08] flex items-center justify-center`}><Icon size={14} className={`text-${k.color}`} /></div><span className="text-[11px] text-t3">{k.label}</span></div>
                  <p className={`font-mono text-[22px] font-black text-${k.color} terminal-data`}>{k.value}</p>
                  {k.sub && <p className="text-[10px] text-t4 font-mono mt-0.5">{k.sub}</p>}
                </div>
              )
            })}
          </div>

          {/* Recent insights */}
          {(insights.list || []).filter(i => i.status === 'new').length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">NEW INSIGHTS</span>
                <button onClick={() => setTab('insights')} className="text-[10px] text-cyan hover:underline flex items-center gap-0.5">View all <ChevronRight size={10} /></button>
              </div>
              <div className="space-y-2">
                {(insights.list || []).filter(i => i.status === 'new').slice(0, 5).map(insight => {
                  const style = SEVERITY_STYLE[insight.severity] || SEVERITY_STYLE.info
                  const Icon = style.icon
                  return (
                    <div key={insight.id} className={`p-3 rounded-xl ${style.bg} border border-${insight.severity === 'critical' || insight.severity === 'alert' ? 'red' : insight.severity === 'warning' ? 'amber' : 'border'}/[0.08]`}>
                      <div className="flex items-start gap-3">
                        <Icon size={14} className={`${style.text} mt-0.5`} />
                        <div className="flex-1">
                          <p className="text-[12px] font-medium text-t1">{insight.title}</p>
                          <p className="text-[11px] text-t3 mt-0.5">{insight.description}</p>
                          {insight.recommended_action && (
                            <p className="text-[10px] text-cyan mt-1">{insight.recommended_action}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {insight.confidence_score > 0 && <span className="text-[9px] font-mono text-t4">{insight.confidence_score}%</span>}
                          <button onClick={() => updateInsight(insight.id, 'acknowledged')} className="p-1 text-t4 hover:text-green transition"><Check size={12} /></button>
                          <button onClick={() => updateInsight(insight.id, 'dismissed')} className="p-1 text-t4 hover:text-red transition"><X size={12} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quality breakdown */}
          {Object.keys(quality.by_severity || {}).length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">QUALITY ISSUES BY SEVERITY</span>
              <div className="flex items-center gap-4 mt-3">
                {Object.entries(quality.by_severity || {}).map(([sev, count]) => (
                  <div key={sev} className="flex items-center gap-2">
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${sev === 'critical' ? 'bg-red/[0.06] text-red' : sev === 'error' ? 'bg-red/[0.06] text-red' : sev === 'warning' ? 'bg-amber/[0.06] text-amber' : 'bg-t3/[0.06] text-t3'}`}>{sev}</span>
                    <span className="font-mono text-[14px] font-bold text-t1">{String(count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* DATA SOURCES */}
      {tab === 'sources' && (
        <div className="space-y-3">
          {(sources.list || []).map(src => {
            const st = SOURCE_STATUS[src.status] || SOURCE_STATUS.pending
            return (
              <div key={src.id} className="glass-card rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Database size={16} className="text-t3" />
                    <div>
                      <h3 className="text-[13px] font-bold text-t1">{src.source_name}</h3>
                      <div className="flex items-center gap-3 mt-1 text-[10px] font-mono text-t4">
                        <span className={`font-bold ${st.text}`}>{st.label}</span>
                        <span>{src.source_type.replace('_', ' ')}</span>
                        <span>{src.records_synced.toLocaleString()} records</span>
                        {src.last_sync_at && <span>Last sync: {new Date(src.last_sync_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric', minute: '2-digit' })}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-mono text-[18px] font-black terminal-data ${src.quality_score >= 80 ? 'text-green' : src.quality_score >= 50 ? 'text-amber' : 'text-red'}`}>{src.quality_score}%</p>
                    <p className="text-[9px] text-t4">Quality</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-3 pt-3 border-t border-border/10">
                  <div><p className="text-[9px] font-mono text-t4">Completeness</p><div className="h-1.5 rounded-full bg-border/20 mt-1"><div className="h-full rounded-full bg-cyan" style={{ width: `${src.completeness_pct}%` }} /></div></div>
                  <div><p className="text-[9px] font-mono text-t4">Accuracy</p><div className="h-1.5 rounded-full bg-border/20 mt-1"><div className="h-full rounded-full bg-green" style={{ width: `${src.accuracy_score}%` }} /></div></div>
                  <div><p className="text-[9px] font-mono text-t4">Fields Mapped</p><p className="font-mono text-[11px] text-t2 mt-0.5">{src.fields_mapped}/{src.fields_total}</p></div>
                </div>
              </div>
            )
          })}
          {(sources.list || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Database size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No data sources connected</p><p className="text-[12px] text-t3 mt-1">Connect bank accounts and accounting systems to start tracking data quality.</p></div>}
        </div>
      )}

      {/* QUALITY ISSUES */}
      {tab === 'quality' && (
        <div className="space-y-2">
          {(insights.list || []).length === 0 && (quality.open_issues || 0) === 0 ? (
            <div className="glass-card rounded-2xl p-12 text-center"><Check size={28} className="text-green mx-auto mb-3" /><p className="text-[14px] text-t2">No open quality issues</p></div>
          ) : (
            <p className="text-[11px] text-t3 mb-3">{quality.open_issues || 0} open issues. Resolve critical issues first for best data accuracy.</p>
          )}
        </div>
      )}

      {/* INSIGHTS */}
      {tab === 'insights' && (
        <div className="space-y-3">
          {(insights.list || []).map(insight => {
            const style = SEVERITY_STYLE[insight.severity] || SEVERITY_STYLE.info
            const Icon = style.icon
            return (
              <div key={insight.id} className="glass-card rounded-xl p-5">
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-lg ${style.bg} flex items-center justify-center`}>
                    <Icon size={14} className={style.text} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${style.bg} ${style.text}`}>{insight.severity}</span>
                      <span className="text-[9px] font-mono text-t4">{insight.insight_type?.replace('_', ' ')}</span>
                      <span className="text-[9px] font-mono text-t4">{new Date(insight.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                      {insight.confidence_score > 0 && <span className="text-[9px] font-mono text-t4">{insight.confidence_score}% confidence</span>}
                    </div>
                    <h3 className="text-[13px] font-bold text-t1">{insight.title}</h3>
                    <p className="text-[12px] text-t3 mt-1">{insight.description}</p>
                    {insight.recommended_action && (
                      <div className="mt-2 p-2 rounded-lg bg-cyan/[0.03] border border-cyan/[0.06]">
                        <p className="text-[11px] text-cyan">{insight.recommended_action}</p>
                      </div>
                    )}
                    {insight.financial_impact && (
                      <p className="text-[10px] font-mono text-amber mt-1">Potential impact: ${Math.abs(insight.financial_impact).toLocaleString()}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${insight.status === 'new' ? 'bg-cyan/[0.06] text-cyan' : insight.status === 'acted_on' ? 'bg-green/[0.06] text-green' : 'bg-t3/[0.06] text-t3'}`}>{insight.status}</span>
                    {insight.status === 'new' && (
                      <div className="flex gap-1">
                        <button onClick={() => updateInsight(insight.id, 'acted_on', true)} className="p-1 text-t4 hover:text-green transition" title="Helpful"><ThumbsUp size={11} /></button>
                        <button onClick={() => updateInsight(insight.id, 'dismissed', false)} className="p-1 text-t4 hover:text-red transition" title="Dismiss"><ThumbsDown size={11} /></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {(insights.list || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Brain size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No insights generated yet</p><p className="text-[12px] text-t3 mt-1">Insights are generated automatically as data flows through the system.</p></div>}
        </div>
      )}

      {/* LINEAGE */}
      {tab === 'lineage' && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <GitBranch size={28} className="text-purple mx-auto mb-3" />
          <h2 className="font-display text-lg font-bold mb-2">Data Lineage</h2>
          <p className="text-[13px] text-t3 max-w-md mx-auto">Track exactly where every data point in your treasury came from, how it was transformed, and where it flows. Every sync, import, and computation is traced.</p>
          <div className="mt-6 inline-flex items-center gap-4 text-[11px] font-mono text-t4">
            <span>Plaid → transactions</span><ChevronRight size={10} /><span>categorization</span><ChevronRight size={10} /><span>cash_position</span><ChevronRight size={10} /><span>forecast</span>
          </div>
        </div>
      )}

      {/* REPORTS */}
      {tab === 'reports' && (
        <div className="space-y-3">
          {(data?.reports || []).map(r => (
            <div key={r.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileText size={14} className="text-purple" />
                <div>
                  <span className="text-[13px] font-medium text-t1">{r.title}</span>
                  <div className="flex items-center gap-2 text-[10px] font-mono text-t4 mt-0.5">
                    <span>{r.report_type.replace('_', ' ')}</span>
                    <span>{new Date(r.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                </div>
              </div>
              <ChevronRight size={14} className="text-t4" />
            </div>
          ))}
          {(data?.reports || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><FileText size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No intelligence reports yet</p><p className="text-[12px] text-t3 mt-1">Reports are generated automatically on a daily and weekly cadence.</p></div>}
        </div>
      )}
    </div>
  )
}
