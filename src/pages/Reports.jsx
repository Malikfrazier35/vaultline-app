import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Download, Loader2, Plus, Calendar, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import PrintButton from '@/components/PrintButton'

const REPORT_TYPES = {
  daily_cash_position: {
    label: 'Daily Cash Position',
    description: 'Consolidated cash position across all accounts with day-over-day variance and material movements.',
    icon: FileText,
    available: true,
  },
  weekly_cash_flash: {
    label: 'Weekly Cash Flash',
    description: 'Week-over-week summary with variance vs. forecast and runway change.',
    icon: FileText,
    available: false, // coming next
  },
  monthly_board_package: {
    label: 'Monthly Board Package',
    description: 'Multi-section package for board and audit committee review.',
    icon: FileText,
    available: false,
  },
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { 
  month: 'short', day: 'numeric', year: 'numeric' 
})
const fmtTime = (d) => new Date(d).toLocaleString('en-US', { 
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
})

export default function Reports() {
  const { org } = useAuth()
  const toast = useToast()
  const [reports, setReports] = useState([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(null) // report_type currently being generated

  useEffect(() => { document.title = 'Reports — Vaultline' }, [])

  useEffect(() => {
    if (!org?.id) return
    let mounted = true
    
    async function load() {
      const { data, error } = await supabase
        .from('reports')
        .select('id, report_type, period_start, period_end, status, pdf_url, page_count, generation_duration_ms, created_at, completed_at, error_message')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (mounted) {
        if (error) console.error('Reports load error:', error)
        setReports(data || [])
        setLoading(false)
      }
    }
    load()
    
    // Subscribe to realtime updates so status flips appear live
    const channel = supabase.channel('reports-changes')
      .on('postgres_changes', { 
        event: '*', schema: 'public', table: 'reports', filter: `org_id=eq.${org.id}` 
      }, (payload) => {
        if (!mounted) return
        load()
      })
      .subscribe()
    
    return () => { mounted = false; supabase.removeChannel(channel) }
  }, [org?.id])

  async function generateReport(reportType) {
    if (!org?.id) return
    setGenerating(reportType)
    
    try {
      const today = new Date().toISOString().slice(0, 10)
      
      const { data, error } = await supabase.functions.invoke('generate-report', {
        body: {
          org_id: org.id,
          report_type: reportType,
          period_start: today,
          period_end: today,
        },
      })
      
      if (error) throw error
      
      toast.success('Report queued', 'Generation typically takes 5-10 seconds.')
    } catch (e) {
      console.error('Generate error:', e)
      toast.error('Could not generate report', e.message || 'Please try again')
    } finally {
      setGenerating(null)
    }
  }

  async function downloadReport(report) {
    if (!report.pdf_url) return
    try {
      // Pdf_url is a signed Storage path; get a fresh signed URL
      const { data, error } = await supabase.storage
        .from('reports')
        .createSignedUrl(report.pdf_url, 60)
      
      if (error) throw error
      window.open(data.signedUrl, '_blank')
    } catch (e) {
      toast.error('Could not download', e.message)
    }
  }

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-display text-t1 mb-1">Reports</h1>
          <p className="text-[14px] text-t2">
            Generate professional treasury reports as PDFs. Print any dashboard with Cmd+P.
          </p>
        </div>
        <PrintButton variant="outline" />
      </header>

      {/* ─── Available report types ─── */}
      <section>
        <h2 className="text-[16px] font-display text-t1 mb-4">Generate a Report</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(REPORT_TYPES).map(([key, type]) => {
            const Icon = type.icon
            const isGenerating = generating === key
            return (
              <div 
                key={key}
                className={`glass-card p-5 ${!type.available ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="p-2 rounded-lg bg-deep">
                    <Icon size={18} className="text-cyan" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-[14px] font-semibold text-t1">{type.label}</h3>
                    {!type.available && (
                      <span className="text-[11px] uppercase tracking-wider text-t3">Coming soon</span>
                    )}
                  </div>
                </div>
                <p className="text-[13px] text-t2 mb-4 leading-relaxed">{type.description}</p>
                
                <div className="flex items-center gap-2">
                  {type.available && (
                    <>
                      <button
                        onClick={() => generateReport(key)}
                        disabled={isGenerating || !type.available}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan text-white text-[13px] font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {isGenerating ? (
                          <><Loader2 size={14} className="animate-spin" /> Generating…</>
                        ) : (
                          <><Plus size={14} /> Generate</>
                        )}
                      </button>
                      <Link
                        to={`/print/cash-memo/${org?.id}/${new Date().toISOString().slice(0, 10)}`}
                        target="_blank"
                        className="px-3 py-2 rounded-lg border border-border text-t2 hover:text-t1 hover:border-border-hover text-[13px] font-medium inline-flex items-center gap-1.5"
                        title="Preview without generating PDF"
                      >
                        <ExternalLink size={13} /> Preview
                      </Link>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── Past reports ─── */}
      <section>
        <h2 className="text-[16px] font-display text-t1 mb-4">Past Reports</h2>
        
        {loading && (
          <div className="text-[13px] text-t2 py-8 text-center">Loading…</div>
        )}
        
        {!loading && reports.length === 0 && (
          <div className="glass-card p-8 text-center">
            <FileText size={32} className="text-t3 mx-auto mb-3" />
            <p className="text-[14px] text-t2 mb-1">No reports yet</p>
            <p className="text-[13px] text-t3">Generate your first report above to get started.</p>
          </div>
        )}
        
        {!loading && reports.length > 0 && (
          <div className="glass-card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border text-[11px] uppercase tracking-wider text-t3">
                  <th className="px-4 py-3 text-left font-medium">Report</th>
                  <th className="px-4 py-3 text-left font-medium">Period</th>
                  <th className="px-4 py-3 text-left font-medium">Generated</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map(r => {
                  const type = REPORT_TYPES[r.report_type] || { label: r.report_type }
                  const statusStyles = {
                    pending: 'bg-amber-100 text-amber-900',
                    generating: 'bg-blue-100 text-blue-900',
                    completed: 'bg-green-100 text-green-900',
                    failed: 'bg-red-100 text-red-900',
                    delivered: 'bg-purple-100 text-purple-900',
                  }
                  return (
                    <tr key={r.id} className="border-b border-border/50 last:border-0 hover:bg-deep/40">
                      <td className="px-4 py-3 text-[13px] text-t1 font-medium">{type.label}</td>
                      <td className="px-4 py-3 text-[13px] text-t2">{fmtDate(r.period_start)}</td>
                      <td className="px-4 py-3 text-[13px] text-t2">{fmtTime(r.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium ${statusStyles[r.status] || 'bg-gray-100 text-gray-900'}`}>
                          {r.status === 'generating' && <Loader2 size={10} className="animate-spin" />}
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {r.status === 'completed' && r.pdf_url && (
                          <button
                            onClick={() => downloadReport(r)}
                            className="inline-flex items-center gap-1.5 text-[13px] text-cyan hover:underline"
                          >
                            <Download size={13} /> Download
                          </button>
                        )}
                        {r.status === 'failed' && (
                          <span className="text-[12px] text-red-600" title={r.error_message}>
                            Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
