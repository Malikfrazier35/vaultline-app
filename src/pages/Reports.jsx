import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import {
  Activity, DollarSign, PieChart, Calendar, FileText, Landmark,
  Download, Loader2, X, Clock, FileBarChart, TrendingUp, Printer, Lock,
  BarChart3, Shield, Zap, Building2, ChevronDown
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { PLAN_PERIODS } from '@/lib/planEngine'

const TEMPLATE_ICONS = {
  cash_flow: Activity, balance_summary: DollarSign, forecast: Calendar,
  variance: PieChart, bank_fee_analysis: Landmark, fx_exposure: TrendingUp,
  board_deck: FileText, audit_ready: Shield, custom: BarChart3,
}
const TEMPLATE_COLORS = {
  cash_flow: 'cyan', balance_summary: 'green', forecast: 'amber',
  variance: 'purple', bank_fee_analysis: 'green', fx_exposure: 'cyan',
  board_deck: 'purple', audit_ready: 'amber', custom: 'cyan',
}

const PERIODS = [
  { id: '7', label: '7D', days: 7 },
  { id: '30', label: '30D', days: 30 },
  { id: '90', label: '90D', days: 90 },
  { id: 'mtd', label: 'MTD', days: null },
  { id: 'qtd', label: 'QTD', days: null },
  { id: 'fy', label: 'FY', days: null },
]

function getPeriodDays(id) {
  if (id === 'mtd') return new Date().getDate()
  if (id === 'qtd') { const m = new Date().getMonth(); return Math.floor((Date.now() - new Date(new Date().getFullYear(), m - (m % 3), 1).getTime()) / 86400000) }
  if (id === 'fy') return Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 1).getTime()) / 86400000)
  return parseInt(id) || 30
}

export default function Reports() {
  const { org } = useAuth()
  const toast = useToast()
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('30')
  const [generating, setGenerating] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [history, setHistory] = useState([])

  useEffect(() => { document.title = 'Reports \u2014 Vaultline' }, [])

  const loadTemplates = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('report_templates')
      .select('*')
      .eq('status', 'active')
      .order('is_system', { ascending: false })
      .order('usage_count', { ascending: false })
    setTemplates(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadTemplates() }, [loadTemplates])

  const periodDays = getPeriodDays(period)
  const currentPlan = org?.plan || 'starter'
  const planRank = { starter: 1, growth: 2, enterprise: 3 }

  async function generateReport(tpl) {
    setGenerating(tpl.slug)
    setReportData(null)
    try {
      const { data, error } = await supabase.functions.invoke('report-generate', {
        body: { template_slug: tpl.slug, format: 'json', days: periodDays },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setReportData(data)
      setHistory(h => [{ ...data, timestamp: Date.now() }, ...h].slice(0, 10))
    } catch (err) {
      toast.error(err.message || 'Report generation failed')
    }
    setGenerating(null)
  }

  async function downloadCsv(slug) {
    try {
      const { data, error } = await supabase.functions.invoke('report-generate', {
        body: { template_slug: slug, format: 'csv', days: periodDays },
      })
      if (error) throw new Error(error.message)
      const blob = new Blob([data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${slug}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch (err) {
      toast.error(err.message || 'Download failed')
    }
  }

  const starterTemplates = templates.filter(t => t.plan_required === 'starter')
  const growthTemplates = templates.filter(t => t.plan_required === 'growth')
  const enterpriseTemplates = templates.filter(t => t.plan_required === 'enterprise')

  function TemplateCard({ tpl }) {
    const Icon = TEMPLATE_ICONS[tpl.template_type] || FileText
    const color = TEMPLATE_COLORS[tpl.template_type] || 'cyan'
    const cm = { cyan: 'bg-cyan/[0.08] text-cyan', green: 'bg-green/[0.08] text-green', purple: 'bg-purple/[0.08] text-purple', amber: 'bg-amber/[0.08] text-amber' }
    const locked = (planRank[currentPlan] || 1) < (planRank[tpl.plan_required] || 1)
    const isGenerating = generating === tpl.slug

    return (
      <div className={`glass-card rounded-2xl p-5 transition-all ${locked ? 'opacity-60' : 'hover:-translate-y-1 hover:border-border-hover'} terminal-scanlines relative overflow-hidden`}>
        <div className="relative z-[2]">
          <div className="flex items-center justify-between mb-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cm[color]}`}>
              {locked ? <Lock size={18} /> : <Icon size={18} />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-t3 bg-deep px-1.5 py-0.5 rounded uppercase">{tpl.default_format?.toUpperCase()}</span>
              <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${tpl.plan_required === 'enterprise' ? 'text-amber bg-amber/[0.06]' : tpl.plan_required === 'growth' ? 'text-purple bg-purple/[0.06]' : 'text-cyan bg-cyan/[0.06]'}`}>
                {tpl.plan_required?.toUpperCase()}
              </span>
            </div>
          </div>
          <h3 className="font-display text-[14px] font-bold mb-1 tracking-tight">{tpl.name}</h3>
          <p className="text-[12px] text-t3 leading-relaxed mb-3">{tpl.description}</p>
          <div className="flex items-center gap-2 text-[10px] font-mono text-t4 mb-3">
            <span>{tpl.default_period}</span>
            <span>{tpl.usage_count || 0} uses</span>
          </div>
          {locked ? (
            <Link to="/billing" className="flex items-center gap-1.5 w-full justify-center py-2.5 rounded-xl border border-amber/[0.15] text-amber text-[11px] font-mono font-semibold hover:bg-amber/[0.04] transition">
              <Lock size={11} /> Upgrade to {tpl.plan_required}
            </Link>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => generateReport(tpl)} disabled={isGenerating}
                className="flex-1 flex items-center gap-1.5 justify-center py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[11px] font-mono font-bold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                {isGenerating ? <><Loader2 size={11} className="animate-spin" /> Generating...</> : <><BarChart3 size={11} /> Generate</>}
              </button>
              <button onClick={() => downloadCsv(tpl.slug)}
                className="px-3 py-2.5 rounded-xl border border-border text-t3 hover:text-green hover:border-green/[0.15] transition text-[11px] font-mono">
                <Download size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">TREASURY REPORTS</span>
          <span className="text-[12px] font-mono text-t3">{templates.length} templates</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 rounded-lg bg-deep border border-border">
            {PERIODS.map(p => {
              const planPeriodId = p.label.toUpperCase()
              const allowed = (PLAN_PERIODS[currentPlan] || PLAN_PERIODS.starter).includes(planPeriodId)
              return (
                <button key={p.id} onClick={() => allowed && setPeriod(p.id)} disabled={!allowed}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-semibold transition-all ${period === p.id ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.12]' : allowed ? 'text-t3 hover:text-t2' : 'text-t4 opacity-40 cursor-not-allowed line-through'}`}>
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: FileBarChart, label: 'SESSION', value: String(history.length), color: 'cyan' },
          { icon: Clock, label: 'PERIOD', value: PERIODS.find(p => p.id === period)?.label || '30D', color: 'purple' },
          { icon: Zap, label: 'TEMPLATES', value: String(templates.length), color: 'green' },
          { icon: Shield, label: 'PLAN', value: currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1), color: 'amber' },
        ].map(k => {
          const cm = { cyan: 'bg-cyan/[0.08] text-cyan', purple: 'bg-purple/[0.08] text-purple', green: 'bg-green/[0.08] text-green', amber: 'bg-amber/[0.08] text-amber' }
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

      {/* Template grid — grouped by plan tier */}
      {starterTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="terminal-label">STARTER</span>
            <span className="text-[10px] font-mono text-t3">{starterTemplates.length} templates</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {starterTemplates.map(t => <TemplateCard key={t.id} tpl={t} />)}
          </div>
        </div>
      )}

      {growthTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="terminal-label">GROWTH</span>
            <span className="text-[10px] font-mono text-purple bg-purple/[0.06] px-2 py-0.5 rounded">PLAN REQUIRED</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {growthTemplates.map(t => <TemplateCard key={t.id} tpl={t} />)}
          </div>
        </div>
      )}

      {enterpriseTemplates.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="terminal-label">ENTERPRISE</span>
            <span className="text-[10px] font-mono text-amber bg-amber/[0.06] px-2 py-0.5 rounded">PLAN REQUIRED</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {enterpriseTemplates.map(t => <TemplateCard key={t.id} tpl={t} />)}
          </div>
        </div>
      )}

      {/* Report viewer */}
      {reportData && (
        <div className="glass-card rounded-2xl overflow-hidden terminal-scanlines relative">
          <div className="relative z-[2]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-cyan/[0.08] flex items-center justify-center"><FileText size={15} className="text-cyan" /></div>
                <div>
                  <span className="terminal-label">{reportData.report?.title?.toUpperCase()}</span>
                  <p className="text-[11px] text-t3 font-mono mt-0.5">{reportData.report?.subtitle}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => downloadCsv(reportData.template?.slug)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-green/90 to-green/70 text-void text-[12px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all">
                  <Download size={12} /> CSV
                </button>
                <button onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border text-[12px] font-mono text-t3 hover:text-t1 hover:border-border-hover transition-all">
                  <Printer size={12} /> Print
                </button>
                <button onClick={() => setReportData(null)} className="p-2 rounded-xl hover:bg-deep text-t3 hover:text-t1 transition"><X size={14} /></button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="bg-deep">
                    {(reportData.report?.columns || []).map(c => (
                      <th key={c} className="text-left px-5 py-3 font-mono text-t3 font-semibold uppercase tracking-wider text-[10px] whitespace-nowrap">{c.replace(/_/g, ' ')}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(reportData.report?.rows || []).map((row, i) => (
                    <tr key={i} className="border-t border-border/20 hover:bg-deep/50 transition">
                      {(reportData.report?.columns || []).map(c => (
                        <td key={c} className="px-5 py-3 font-mono text-t2 whitespace-nowrap">{row[c] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="terminal-status flex items-center justify-between px-6 py-1.5">
              <div className="flex items-center gap-3 text-t3">
                <span className="terminal-live">LIVE</span>
                <span>ROWS: <span className="text-cyan">{reportData.report?.row_count}</span></span>
                <span>PERIOD: <span className="text-cyan">{PERIODS.find(p => p.id === period)?.label}</span></span>
              </div>
              <span className="text-t3">TYPE: <span className="text-t2">{reportData.template?.type?.replace(/_/g, ' ')}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      {history.length > 0 && !reportData && (
        <div className="glass-card rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border flex items-center gap-2">
            <Clock size={12} className="text-t3" />
            <span className="terminal-label">RECENT</span>
            <span className="text-[11px] font-mono text-t3">{history.length} reports</span>
          </div>
          <div className="divide-y divide-border/20">
            {history.slice(0, 5).map((h, i) => (
              <button key={i} onClick={() => setReportData(h)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-deep active:bg-deep transition text-left">
                <div className="flex items-center gap-3">
                  <FileText size={14} className="text-cyan" />
                  <span className="text-[13px] font-semibold text-t1">{h.report?.title || h.template?.name}</span>
                  <span className="text-[11px] font-mono text-t3">{h.report?.row_count} rows</span>
                </div>
                <span className="text-[11px] font-mono text-t3">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="terminal-status flex items-center justify-between px-5 py-2 rounded-lg">
        <div className="flex items-center gap-3 text-t3">
          <span className="terminal-live">ENGINE</span>
          <span>TEMPLATES: <span className="text-cyan">{templates.length}</span></span>
        </div>
        <span className="text-t3">SOURCE: <span className="text-green">report-generate</span></span>
      </div>
    </div>
  )
}
