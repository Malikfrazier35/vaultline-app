import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { ArrowLeft, Clock, Eye, ThumbsUp, ThumbsDown, BookOpen, Zap, BarChart3, Shield, Globe, Database, FileText, Star } from 'lucide-react'

const CATEGORY_ICONS = { onboarding: Zap, cash_management: BarChart3, forecasting: Star, reporting: FileText, integrations: Globe, security: Shield, billing: Globe, api: Database, compliance: Shield, general: BookOpen }
const CATEGORY_COLORS = { onboarding: 'cyan', cash_management: 'green', forecasting: 'purple', reporting: 'amber', integrations: 'cyan', security: 'red', billing: 'green', api: 'purple', compliance: 'amber', general: 't3' }

function renderMarkdown(md) {
  if (!md) return ''
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:16px;font-weight:700;margin:24px 0 8px">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:18px;font-weight:700;margin:28px 0 10px">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:22px;font-weight:800;margin:0 0 12px">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code style="background:var(--color-bg-deep, rgba(0,0,0,0.15));padding:1px 5px;border-radius:4px;font-family:var(--font-mono, monospace);font-size:12px">$1</code>')
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre style="background:rgba(0,0,0,0.2);border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px;overflow-x:auto;margin:12px 0;font-family:var(--font-mono, monospace);font-size:13px;line-height:1.6">${code.trim()}</pre>`)
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter(c => c.trim()).map(c => c.trim())
      return `<tr>${cells.map(c => c.match(/^[-:]+$/) ? '' : `<td style="padding:6px 12px;border-bottom:1px solid rgba(255,255,255,0.06);font-size:13px">${c}</td>`).join('')}</tr>`
    })
    .replace(/(<tr>.*<\/tr>\n?)+/g, (block) => {
      if (block.includes('<tr></tr>')) return block.replace('<tr></tr>', '')
      return `<table style="width:100%;border-collapse:collapse;margin:12px 0">${block}</table>`
    })
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;font-size:14px;line-height:1.7">$1</li>')
    .replace(/^- (.+)$/gm, '<li style="margin:4px 0;padding-left:4px;font-size:14px;line-height:1.7">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul style="margin:8px 0 8px 16px;list-style:disc">$&</ul>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color:var(--color-cyan, #22d3ee);text-decoration:none">$1</a>')
    .replace(/^(?!<[huplt])((?!<\/)[^\n]+)$/gm, '<p style="font-size:14px;line-height:1.7;margin:8px 0;color:var(--color-t2, rgba(255,255,255,0.7))">$1</p>')
}

export default function ResourceDetail() {
  const { slug } = useParams()
  const [resource, setResource] = useState(null)
  const [loading, setLoading] = useState(true)
  const [rated, setRated] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await safeInvoke('resources', { action: 'get_resource', slug })
    setResource(data?.resource || null)
    setLoading(false)
  }, [slug])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (resource) document.title = `${resource.title} — Vaultline` }, [resource])

  async function rate(helpful) {
    if (rated) return
    await safeInvoke('resources', { action: 'rate_resource', slug, helpful })
    setRated(true)
  }

  if (loading) return (
    <div className="max-w-[720px] mx-auto py-12 space-y-4">
      {[1,2,3].map(i => <div key={i} className="h-4 bg-border/20 rounded animate-pulse" style={{ width: `${70 + i * 10}%` }} />)}
    </div>
  )

  if (!resource) return (
    <div className="max-w-[720px] mx-auto py-16 text-center">
      <BookOpen size={32} className="text-t3 mx-auto mb-4" />
      <h2 className="text-xl font-bold mb-2">Resource not found</h2>
      <p className="text-t3 text-[14px] mb-6">This guide may have been moved or removed.</p>
      <Link to="/resources" className="text-cyan text-[13px] font-semibold hover:underline">Back to Resources</Link>
    </div>
  )

  const CatIcon = CATEGORY_ICONS[resource.category] || BookOpen
  const color = CATEGORY_COLORS[resource.category] || 't3'

  return (
    <div className="max-w-[720px] mx-auto">
      <Link to="/resources" className="flex items-center gap-1.5 text-[13px] text-t3 hover:text-cyan transition mb-6">
        <ArrowLeft size={14} /> Back to Resources
      </Link>

      <div className="flex items-center gap-3 mb-4">
        <div className={`w-9 h-9 rounded-lg bg-${color}/[0.08] flex items-center justify-center`}>
          <CatIcon size={16} className={`text-${color}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-t3 bg-deep px-2 py-0.5 rounded border border-border">{resource.resource_type?.replace('_', ' ')}</span>
          <span className="text-[10px] font-mono text-t4">{resource.category?.replace('_', ' ')}</span>
        </div>
      </div>

      <h1 className="text-[28px] font-black tracking-tight mb-3">{resource.title}</h1>

      {resource.excerpt && (
        <p className="text-t2 text-[15px] leading-relaxed mb-6">{resource.excerpt}</p>
      )}

      <div className="flex items-center gap-4 mb-8 text-[11px] font-mono text-t3">
        <span className="flex items-center gap-1"><Eye size={11} /> {resource.views || 0} views</span>
        {resource.published_at && <span className="flex items-center gap-1"><Clock size={11} /> {new Date(resource.published_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
      </div>

      {/* Video embed */}
      {resource.video_url && (
        <div className="rounded-xl overflow-hidden border border-border mb-8 aspect-video">
          <iframe src={resource.video_url} className="w-full h-full" allowFullScreen />
        </div>
      )}

      {/* Body content */}
      {resource.body_markdown ? (
        <div
          className="prose-content"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(resource.body_markdown) }}
        />
      ) : resource.body_html ? (
        <div className="prose-content" dangerouslySetInnerHTML={{ __html: resource.body_html }} />
      ) : (
        <div className="glass-card rounded-xl p-8 text-center">
          <p className="text-t3 text-[14px]">Full content coming soon.</p>
        </div>
      )}

      {/* Download */}
      {resource.download_url && (
        <div className="glass-card rounded-xl p-4 mt-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText size={16} className="text-purple" />
            <span className="text-[13px] font-semibold">Download resource</span>
          </div>
          <a href={resource.download_url} target="_blank" rel="noopener"
            className="px-4 py-2 rounded-lg text-[12px] font-mono font-semibold text-cyan border border-cyan/[0.15] hover:bg-cyan/[0.04] transition">
            Download
          </a>
        </div>
      )}

      {/* Feedback */}
      <div className="glass-card rounded-xl p-5 mt-8">
        <p className="text-[14px] font-semibold mb-3">Was this helpful?</p>
        {rated ? (
          <p className="text-[13px] text-green font-mono">Thanks for your feedback.</p>
        ) : (
          <div className="flex items-center gap-3">
            <button onClick={() => rate(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-[13px] text-t2 hover:border-green/[0.3] hover:text-green transition">
              <ThumbsUp size={14} /> Yes
            </button>
            <button onClick={() => rate(false)} className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-[13px] text-t2 hover:border-red/[0.3] hover:text-red transition">
              <ThumbsDown size={14} /> No
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
