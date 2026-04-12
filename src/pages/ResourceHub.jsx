import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  BookOpen, FileText, Link2, Download, Loader2, Search, Star,
  Play, ChevronRight, ExternalLink, Plus, X, Pin, Layout,
  BarChart3, Shield, Zap, Globe, Database, ArrowRight, Check
} from 'lucide-react'

const CATEGORY_ICONS = { onboarding: Zap, cash_management: BarChart3, forecasting: Star, reporting: FileText, integrations: Globe, security: Shield, billing: Link2, api: Database, compliance: Shield, general: BookOpen }
const CATEGORY_COLORS = { onboarding: 'cyan', cash_management: 'green', forecasting: 'purple', reporting: 'amber', integrations: 'cyan', security: 'red', billing: 'green', api: 'purple', compliance: 'amber', general: 't3' }

export default function ResourceHub() {
  const { profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('hub') // hub | library | templates | links
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [resources, setResources] = useState([])
  const [templates, setTemplates] = useState([])
  const [generating, setGenerating] = useState(null)
  const [reportData, setReportData] = useState(null)
  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('resources', { action: 'hub' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function searchResources() {
    const { data: d } = await safeInvoke('resources', { action: 'list_resources', search: searchTerm || undefined, category: filterCat || undefined })
    setResources(d?.resources || [])
  }

  async function loadTemplates() {
    const { data: d } = await safeInvoke('resources', { action: 'list_templates' })
    setTemplates(d?.templates || [])
  }

  useEffect(() => { if (tab === 'library') searchResources() }, [tab, searchTerm, filterCat])
  useEffect(() => { if (tab === 'templates') loadTemplates() }, [tab])

  async function addQuickLink(label, url, icon) {
    await safeInvoke('resources', { action: 'save_quick_link', link_type: 'page', label, url, icon })
    toast.success('Quick link added')
    load()
  }

  async function removeQuickLink(linkId) {
    await safeInvoke('resources', { action: 'remove_quick_link', link_id: linkId })
    load()
  }

  async function generateReport(slug) {
    setGenerating(slug)
    try {
      const { data, error } = await supabase.functions.invoke('report-generate', {
        body: { template_slug: slug, format: 'json', days: 30 },
      })
      if (error) throw new Error(error.message)
      if (data?.error) throw new Error(data.error)
      setReportData(data)
    } catch (err) {
      toast.error(err.message || 'Report generation failed')
    }
    setGenerating(null)
  }

  async function downloadCsv(slug) {
    try {
      const { data, error } = await supabase.functions.invoke('report-generate', {
        body: { template_slug: slug, format: 'csv', days: 30 },
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

  if (loading) return <SkeletonPage />

  const featured = data?.featured || []
  const quickLinks = data?.quick_links || []
  const systemTemplates = data?.templates || []
  const announcements = data?.announcements || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Resources</h1>
          <p className="text-[13px] text-t3 mt-0.5">Guides, templates, quick links, and everything you need to get the most from Vaultline.</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['hub', 'library', 'templates', 'links'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'hub' ? 'Overview' : t === 'links' ? 'Quick Links' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* HUB */}
      {tab === 'hub' && (
        <div className="space-y-6">
          {/* Quick links bar */}
          {quickLinks.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">QUICK ACCESS</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {quickLinks.map(l => (
                  <Link key={l.id} to={l.url} className="px-3 py-2 rounded-lg glass-card border-border/20 text-[11px] text-t1 hover:border-cyan/[0.15] transition flex items-center gap-1.5">
                    <Pin size={10} className="text-cyan" /> {l.label}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Featured resources */}
          <div>
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">FEATURED GUIDES</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
              {featured.map(r => {
                const CatIcon = CATEGORY_ICONS[r.category] || BookOpen
                const color = CATEGORY_COLORS[r.category] || 't3'
                return (
                  <Link key={r.slug} to={`/resources/${r.slug}`} className="glass-card rounded-xl p-5 hover:border-border-hover transition group cursor-pointer block">
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-7 h-7 rounded-lg bg-${color}/[0.08] flex items-center justify-center`}><CatIcon size={13} className={`text-${color}`} /></div>
                      <span className="text-[9px] font-mono text-t4 uppercase">{r.resource_type?.replace('_', ' ')}</span>
                    </div>
                    <h3 className="text-[13px] font-bold text-t1 group-hover:text-cyan transition">{r.title}</h3>
                    <p className="text-[11px] text-t3 mt-1 line-clamp-2">{r.excerpt}</p>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* Report templates */}
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">REPORT TEMPLATES</span>
              <button onClick={() => setTab('templates')} className="text-[10px] text-cyan hover:underline flex items-center gap-0.5">View all <ChevronRight size={10} /></button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {systemTemplates.slice(0, 4).map(t => (
                <div key={t.id} className="glass-card rounded-xl p-4">
                  <FileText size={16} className="text-purple mb-2" />
                  <h3 className="text-[12px] font-bold text-t1">{t.name}</h3>
                  <p className="text-[10px] text-t3 mt-0.5 line-clamp-2">{t.description}</p>
                  <span className="text-[9px] font-mono text-t4 mt-2 inline-block bg-deep px-1.5 py-0.5 rounded">{t.plan_required}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Announcements */}
          {announcements.length > 0 && (
            <div>
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">WHAT'S NEW</span>
              <div className="space-y-2 mt-3">
                {announcements.map(a => (
                  <div key={a.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${a.announcement_type === 'feature' ? 'bg-cyan/[0.06] text-cyan' : 'bg-purple/[0.06] text-purple'}`}>{a.announcement_type}</span>
                      <span className="text-[12px] text-t1">{a.title}</span>
                    </div>
                    {a.cta_url && <a href={a.cta_url} className="text-[10px] text-cyan"><ChevronRight size={12} /></a>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LIBRARY */}
      {tab === 'library' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-t4" />
              <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Search guides, tutorials, docs..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            </div>
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2.5 rounded-xl glass-input text-[12px] text-t1 outline-none">
              <option value="">All categories</option>
              {Object.keys(CATEGORY_ICONS).map(c => <option key={c} value={c}>{c.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {resources.map(r => {
              const CatIcon = CATEGORY_ICONS[r.category] || BookOpen
              return (
                <Link key={r.id} to={`/resources/${r.slug}`} className="glass-card rounded-xl p-4 flex items-center justify-between group hover:border-border-hover transition block">
                  <div className="flex items-center gap-3">
                    <CatIcon size={16} className={`text-${CATEGORY_COLORS[r.category] || 't3'}`} />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-[13px] font-medium text-t1 group-hover:text-cyan transition">{r.title}</h3>
                        {r.featured && <Star size={10} className="text-amber fill-amber" />}
                        {r.pinned && <Pin size={10} className="text-cyan" />}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-t4 mt-0.5">
                        <span>{r.resource_type?.replace('_', ' ')}</span>
                        <span>{r.category?.replace('_', ' ')}</span>
                        <span>{r.views} views</span>
                      </div>
                    </div>
                  </div>
                  {r.video_url ? <Play size={14} className="text-purple" /> : <ChevronRight size={14} className="text-t4" />}
                </Link>
              )
            })}
            {resources.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Search size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">{searchTerm ? 'No results found' : 'Loading resources...'}</p></div>}
          </div>
        </div>
      )}

      {/* TEMPLATES */}
      {tab === 'templates' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(t => (
              <div key={t.id} className="glass-card rounded-xl p-5">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText size={14} className="text-purple" />
                      <span className="text-[9px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded uppercase">{t.template_type?.replace('_', ' ')}</span>
                      {t.is_system && <span className="text-[8px] font-mono text-cyan bg-cyan/[0.06] px-1 py-0.5 rounded">BUILT-IN</span>}
                    </div>
                    <h3 className="text-[14px] font-bold text-t1">{t.name}</h3>
                    <p className="text-[11px] text-t3 mt-1">{t.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-t4">
                      <span>{t.default_format?.toUpperCase()}</span>
                      <span>{t.default_period}</span>
                      <span>{t.usage_count} uses</span>
                      <span className={t.plan_required === 'enterprise' ? 'text-amber' : t.plan_required === 'growth' ? 'text-purple' : 'text-cyan'}>{t.plan_required}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/20">
                  <button onClick={() => generateReport(t.slug)} disabled={generating === t.slug}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-cyan border border-cyan/[0.15] hover:bg-cyan/[0.04] active:scale-[0.98] transition-all disabled:opacity-50">
                    {generating === t.slug ? <><Loader2 size={11} className="animate-spin" /> Generating...</> : <><BarChart3 size={11} /> Preview</>}
                  </button>
                  <button onClick={() => downloadCsv(t.slug)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-t3 border border-border hover:border-green/[0.15] hover:text-green active:scale-[0.98] transition-all">
                    <Download size={11} /> CSV
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Report preview modal */}
          {reportData && (
            <div className="glass-card rounded-2xl p-6 border-cyan/[0.15]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-[16px] font-bold text-t1">{reportData.report?.title}</h3>
                  <p className="text-[11px] font-mono text-t3 mt-0.5">{reportData.report?.subtitle}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => downloadCsv(reportData.template?.slug)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-green border border-green/[0.15] hover:bg-green/[0.04] transition">
                    <Download size={11} /> Download CSV
                  </button>
                  <button onClick={() => setReportData(null)} className="p-1.5 rounded-lg text-t3 hover:text-t1 transition"><X size={14} /></button>
                </div>
              </div>
              <div className="rounded-xl border border-border overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="bg-deep">
                      {(reportData.report?.columns || []).map(c => (
                        <th key={c} className="text-left px-4 py-2.5 font-mono text-t3 font-semibold uppercase tracking-wider text-[10px]">{c.replace('_', ' ')}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(reportData.report?.rows || []).map((row, i) => (
                      <tr key={i} className="border-t border-border/20 hover:bg-deep/50 transition">
                        {(reportData.report?.columns || []).map(c => (
                          <td key={c} className="px-4 py-2.5 font-mono text-t2">{row[c] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center gap-3 mt-3 text-[10px] font-mono text-t4">
                <span>{reportData.report?.row_count} rows</span>
                <span>Generated {new Date(reportData.report?.generated_at).toLocaleString()}</span>
                <span>Template: {reportData.template?.slug}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* QUICK LINKS */}
      {tab === 'links' && (
        <div className="space-y-4 max-w-2xl">
          <p className="text-[12px] text-t3">Pin frequently-used pages for quick access from the Resources hub.</p>
          <div className="space-y-2">
            {quickLinks.map(l => (
              <div key={l.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Pin size={12} className="text-cyan" />
                  <div>
                    <span className="text-[13px] text-t1">{l.label}</span>
                    <span className="text-[10px] font-mono text-t4 ml-2">{l.url}</span>
                  </div>
                </div>
                <button onClick={() => removeQuickLink(l.id)} className="p-1 text-t4 hover:text-red transition"><X size={12} /></button>
              </div>
            ))}
          </div>
          <div className="glass-card rounded-xl p-4">
            <span className="text-[11px] text-t3 mb-3 block">Suggested pages to pin:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { label: 'Dashboard', url: '/dashboard' }, { label: 'Forecast', url: '/forecast' },
                { label: 'Cash Position', url: '/position' }, { label: 'Reports', url: '/reports' },
                { label: 'Alerts', url: '/alerts' }, { label: 'Support', url: '/support' },
              ].filter(s => !quickLinks.some(l => l.url === s.url)).map(s => (
                <button key={s.url} onClick={() => addQuickLink(s.label, s.url)}
                  className="px-3 py-1.5 rounded-lg bg-deep text-[11px] text-t2 border border-border/20 hover:border-cyan/[0.15] hover:text-cyan transition flex items-center gap-1">
                  <Plus size={10} /> {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
