import { SkeletonPage } from "@/components/Skeleton"
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Palette, Plus, BarChart3, Calendar, FileText, Target,
  DollarSign, TrendingUp, Eye, MousePointer, Users, Loader2,
  Megaphone, Image, Hash, Send, ChevronRight
} from 'lucide-react'

function fmt(n) { const a = Math.abs(n||0); return a >= 1e6 ? `$${(a/1e6).toFixed(1)}M` : a >= 1e3 ? `$${(a/1e3).toFixed(0)}K` : `$${a.toFixed(0)}` }

const CAMPAIGN_TYPES = ['email_sequence', 'social_media', 'content_marketing', 'paid_ads', 'webinar', 'product_launch', 'seasonal', 'referral', 'custom']
const CONTENT_TYPES = ['blog_post', 'social_post', 'email', 'landing_page', 'ad_copy', 'infographic', 'case_study', 'whitepaper', 'newsletter', 'custom']
const CHANNELS = ['linkedin', 'twitter', 'facebook', 'blog', 'email', 'google_ads']

export default function MarketingHub() {
  const { profile } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('dashboard') // dashboard | campaigns | content | brand | calendar
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showContentForm, setShowContentForm] = useState(false)
  const [cf, setCf] = useState({ name: '', campaign_type: 'content_marketing', target_segment: '', budget: 0, channels: [], start_date: '', end_date: '' })
  const [contentForm, setContentForm] = useState({ content_type: 'blog_post', title: '', content_body: '', channel: 'blog', scheduled_at: '' })
  const [brandAssets, setBrandAssets] = useState([])
  const [content, setContent] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('marketing-ops', { action: 'dashboard' })
    setData(d)
    const { data: brand } = await safeInvoke('marketing-ops', { action: 'brand_kit' })
    setBrandAssets(brand?.assets || [])
    const { data: ct } = await safeInvoke('marketing-ops', { action: 'list_content' })
    setContent(ct?.content || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function createCampaign(e) {
    e.preventDefault()
    const { data: d } = await safeInvoke('marketing-ops', { action: 'create_campaign', ...cf, utm_campaign: cf.name.toLowerCase().replace(/\s+/g, '-') })
    if (d?.success) { toast.success('Campaign created'); setShowCampaignForm(false); setCf({ name: '', campaign_type: 'content_marketing', target_segment: '', budget: 0, channels: [], start_date: '', end_date: '' }); load() }
  }

  async function createContent(e) {
    e.preventDefault()
    const { data: d } = await safeInvoke('marketing-ops', { action: 'create_content', ...contentForm })
    if (d?.success) { toast.success('Content created'); setShowContentForm(false); setContentForm({ content_type: 'blog_post', title: '', content_body: '', channel: 'blog', scheduled_at: '' }); load() }
  }

  const stats = data?.stats || {}

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Marketing Hub</h1>
          <p className="text-[13px] text-t3 mt-0.5">{stats.active_campaigns || 0} active campaigns · {data?.leads?.total || 0} leads · {stats.roi ? `${stats.roi}x ROI` : 'No ROI data yet'}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowContentForm(!showContentForm)} className="px-3 py-2 rounded-xl border border-border text-[12px] text-t2 hover:border-border-hover transition flex items-center gap-1.5"><FileText size={12} /> New Content</button>
          <button onClick={() => setShowCampaignForm(!showCampaignForm)} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[13px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition-all flex items-center gap-2"><Plus size={14} /> Campaign</button>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['dashboard', 'campaigns', 'content', 'brand', 'calendar'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Campaign form */}
      {showCampaignForm && (
        <form onSubmit={createCampaign} className="glass-card rounded-2xl p-6 space-y-3">
          <h3 className="text-[14px] font-bold text-t1">New Campaign</h3>
          <div className="grid grid-cols-2 gap-3">
            <input value={cf.name} onChange={e => setCf({ ...cf, name: e.target.value })} required placeholder="Campaign name" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none focus:border-cyan/40 transition placeholder:text-t3" />
            <select value={cf.campaign_type} onChange={e => setCf({ ...cf, campaign_type: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              {CAMPAIGN_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <select value={cf.target_segment} onChange={e => setCf({ ...cf, target_segment: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              <option value="">All segments</option>
              <option value="spreadsheet_dependent">Spreadsheet Dependent</option>
              <option value="scaling">Scaling</option>
              <option value="enterprise_ready">Enterprise Ready</option>
            </select>
            <input type="date" value={cf.start_date} onChange={e => setCf({ ...cf, start_date: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none" />
            <input type="number" value={cf.budget} onChange={e => setCf({ ...cf, budget: parseFloat(e.target.value) })} placeholder="Budget ($)" className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5"><Megaphone size={12} /> Create Campaign</button>
        </form>
      )}

      {/* Content form */}
      {showContentForm && (
        <form onSubmit={createContent} className="glass-card rounded-2xl p-6 space-y-3">
          <h3 className="text-[14px] font-bold text-t1">New Content</h3>
          <div className="grid grid-cols-3 gap-3">
            <select value={contentForm.content_type} onChange={e => setContentForm({ ...contentForm, content_type: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              {CONTENT_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
            </select>
            <input value={contentForm.title} onChange={e => setContentForm({ ...contentForm, title: e.target.value })} required placeholder="Title" className="px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            <select value={contentForm.channel} onChange={e => setContentForm({ ...contentForm, channel: e.target.value })} className="px-3 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none">
              {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <textarea value={contentForm.content_body} onChange={e => setContentForm({ ...contentForm, content_body: e.target.value })} rows={3} placeholder="Content body..." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none resize-none placeholder:text-t3" />
          <button type="submit" className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5"><Send size={12} /> Create Content</button>
        </form>
      )}

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Campaigns', value: stats.total_campaigns || 0, sub: `${stats.active_campaigns || 0} active`, icon: Megaphone, color: 'purple' },
              { label: 'Total Leads', value: data?.leads?.total || 0, icon: Users, color: 'cyan' },
              { label: 'Total Spend', value: fmt(stats.total_spend || 0), icon: DollarSign, color: 'amber' },
              { label: 'Revenue', value: fmt(stats.total_revenue || 0), sub: stats.roi ? `${stats.roi}x ROI` : '', icon: TrendingUp, color: 'green' },
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

          {/* Lead sources */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass-card rounded-2xl p-5">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">LEADS BY SOURCE</span>
              <div className="mt-3 space-y-2">
                {Object.entries(data?.leads?.by_source || {}).sort((a, b) => b[1] - a[1]).map(([src, count]) => (
                  <div key={src} className="flex items-center justify-between py-1">
                    <span className="text-[12px] text-t2 capitalize">{src.replace('_', ' ')}</span>
                    <span className="font-mono text-[13px] font-bold text-cyan terminal-data">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="glass-card rounded-2xl p-5">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">CONTENT BY TYPE</span>
              <div className="mt-3 space-y-2">
                {Object.entries(data?.content?.by_type || {}).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between py-1">
                    <span className="text-[12px] text-t2 capitalize">{type.replace('_', ' ')}</span>
                    <span className="font-mono text-[13px] font-bold text-purple terminal-data">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Upcoming posts */}
          {(data?.upcoming_posts || []).length > 0 && (
            <div className="glass-card rounded-2xl p-5">
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">UPCOMING POSTS</span>
              <div className="mt-3 space-y-2">
                {data.upcoming_posts.map(p => (
                  <div key={p.id} className="flex items-center justify-between py-2 border-b border-border/10 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-mono text-t4 uppercase bg-deep px-1.5 py-0.5 rounded">{p.platform}</span>
                      <span className="text-[12px] text-t1">{p.marketing_content?.title || 'Untitled'}</span>
                    </div>
                    <span className="text-[10px] font-mono text-t4">{new Date(p.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit', hour: 'numeric' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CAMPAIGNS */}
      {tab === 'campaigns' && (
        <div className="space-y-3">
          {(data?.campaigns || []).map(c => (
            <div key={c.id} className="glass-card rounded-xl p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${c.status === 'active' ? 'bg-green/[0.06] text-green' : c.status === 'draft' ? 'bg-t3/[0.06] text-t3' : 'bg-amber/[0.06] text-amber'}`}>{c.status}</span>
                    <span className="text-[9px] font-mono text-t4">{c.campaign_type?.replace('_', ' ')}</span>
                    {c.target_segment && <span className="text-[9px] font-mono text-purple bg-purple/[0.06] px-1.5 py-0.5 rounded">{c.target_segment.replace('_', ' ')}</span>}
                  </div>
                  <h3 className="text-[14px] font-bold text-t1">{c.name}</h3>
                  <div className="flex items-center gap-4 mt-2 text-[10px] font-mono text-t4">
                    <span>{c.impressions || 0} impressions</span><span>{c.clicks || 0} clicks</span><span>{c.leads_generated || 0} leads</span><span>{fmt(c.revenue_attributed || 0)} revenue</span>
                  </div>
                </div>
                {c.budget > 0 && <span className="font-mono text-[12px] text-t3">{fmt(c.spent || 0)} / {fmt(c.budget)}</span>}
              </div>
            </div>
          ))}
          {(data?.campaigns || []).length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Megaphone size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No campaigns yet</p></div>}
        </div>
      )}

      {/* CONTENT */}
      {tab === 'content' && (
        <div className="space-y-2">
          {content.map(c => (
            <div key={c.id} className="glass-card rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded bg-deep text-t3">{c.content_type?.replace('_', ' ')}</span>
                <span className="text-[13px] text-t1">{c.title}</span>
                <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${c.status === 'published' ? 'bg-green/[0.06] text-green' : c.status === 'draft' ? 'bg-t3/[0.06] text-t3' : 'bg-amber/[0.06] text-amber'}`}>{c.status}</span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-mono text-t4">
                {c.channel && <span>{c.channel}</span>}
                {c.views > 0 && <span><Eye size={9} className="inline" /> {c.views}</span>}
                {c.clicks > 0 && <span><MousePointer size={9} className="inline" /> {c.clicks}</span>}
              </div>
            </div>
          ))}
          {content.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><FileText size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No content pieces yet</p></div>}
        </div>
      )}

      {/* BRAND KIT */}
      {tab === 'brand' && (
        <div className="space-y-4">
          {brandAssets.map(a => (
            <div key={a.id} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Palette size={14} className="text-purple" />
                <span className="text-[13px] font-bold text-t1">{a.name}</span>
                <span className="text-[9px] font-mono text-t4">{a.asset_type.replace('_', ' ')}</span>
              </div>
              {a.colors?.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {a.colors.map((c, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg border border-border/20" style={{ background: c.hex }} />
                      <div><p className="text-[11px] text-t1">{c.name}</p><p className="text-[9px] font-mono text-t4">{c.hex}</p></div>
                    </div>
                  ))}
                </div>
              )}
              {a.metadata?.font_display && (
                <div className="mt-3 text-[11px] text-t3">
                  Display: <span className="font-semibold text-t1">{a.metadata.font_display}</span> · Mono: <span className="font-mono text-t1">{a.metadata.font_mono || a.metadata?.mono}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* CALENDAR (placeholder) */}
      {tab === 'calendar' && (
        <div className="glass-card rounded-2xl p-8 text-center">
          <Calendar size={28} className="text-t4 mx-auto mb-3" />
          <p className="text-[14px] text-t2 font-medium">Content Calendar</p>
          <p className="text-[12px] text-t3 mt-1">Schedule posts and track publication dates across all channels.</p>
          {(data?.upcoming_posts || []).length > 0 ? (
            <div className="mt-6 max-w-md mx-auto space-y-2">
              {data.upcoming_posts.map(p => (
                <div key={p.id} className="glass-card rounded-xl p-3 flex items-center justify-between text-left">
                  <span className="text-[12px] text-t1">{p.marketing_content?.title || 'Post'}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-t4 uppercase bg-deep px-1.5 py-0.5 rounded">{p.platform}</span>
                    <span className="text-[10px] font-mono text-t4">{new Date(p.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <p className="text-[11px] text-t4 mt-4">No upcoming posts scheduled. Create content and schedule it to channels.</p>}
        </div>
      )}
    </div>
  )
}
