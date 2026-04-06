import { SkeletonPage } from "@/components/Skeleton"
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Palette, Accessibility, MessageCircle, Loader2, Check, Send, Eye,
  Type, Sun, Moon, Monitor, Volume2, VolumeX, Columns, Mouse, Bell,
  Sparkles, ChevronRight, Star, Bug, Lightbulb, ThumbsUp, Megaphone
} from 'lucide-react'

const FONT_SIZES = [
  { value: 'compact', label: 'Compact', px: '12px' },
  { value: 'normal', label: 'Normal', px: '14px' },
  { value: 'large', label: 'Large', px: '16px' },
  { value: 'x-large', label: 'X-Large', px: '18px' },
]
const CHART_PALETTES = ['default', 'colorblind', 'monochrome', 'pastel', 'vivid']
const FEEDBACK_TYPES = [
  { value: 'bug', label: 'Bug Report', icon: Bug, color: 'red' },
  { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'amber' },
  { value: 'usability', label: 'Usability Issue', icon: Mouse, color: 'purple' },
  { value: 'praise', label: 'Something Great', icon: ThumbsUp, color: 'green' },
  { value: 'confusion', label: 'Confusing UI', icon: Eye, color: 'cyan' },
]

export default function UXCenter() {
  const { profile } = useAuth()
  const toast = useToast()
  const [prefs, setPrefs] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('preferences') // preferences | feedback | walkthroughs | announcements
  const [walkthroughs, setWalkthroughs] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [feedback, setFeedback] = useState([])
  // Feedback form
  const [fbType, setFbType] = useState('bug')
  const [fbTitle, setFbTitle] = useState('')
  const [fbDesc, setFbDesc] = useState('')
  const [fbRating, setFbRating] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: p }, { data: w }, { data: a }, { data: f }] = await Promise.all([
      safeInvoke('ux-ops', { action: 'get_ux_prefs' }),
      safeInvoke('ux-ops', { action: 'get_walkthroughs' }),
      safeInvoke('ux-ops', { action: 'get_announcements' }),
      safeInvoke('ux-ops', { action: 'list_feedback' }),
    ])
    setPrefs(p?.preferences || {})
    setWalkthroughs(w?.walkthroughs || [])
    setAnnouncements(a?.announcements || [])
    setFeedback(f?.feedback || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function savePref(key, value) {
    setPrefs(p => ({ ...p, [key]: value }))
    await safeInvoke('ux-ops', { action: 'save_ux_prefs', [key]: value })
  }

  async function submitFeedback(e) {
    e.preventDefault()
    setSubmitting(true)
    await safeInvoke('ux-ops', {
      body: { action: 'submit_feedback', page_path: window.location.pathname, feedback_type: fbType, rating: fbRating || null, title: fbTitle, description: fbDesc, device_type: window.innerWidth <= 768 ? 'mobile' : 'desktop', viewport_width: window.innerWidth },
    })
    toast.success('Feedback submitted — thank you!')
    setFbTitle(''); setFbDesc(''); setFbRating(0)
    setSubmitting(false)
    load()
  }

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">UX Preferences</h1>
          <p className="text-[13px] text-t3 mt-0.5">Customize your Vaultline experience — accessibility, display, navigation, and guided help.</p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['preferences', 'feedback', 'walkthroughs', 'announcements'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* PREFERENCES */}
      {tab === 'preferences' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Accessibility */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-[14px] font-bold text-t1 flex items-center gap-2"><Accessibility size={16} className="text-cyan" /> Accessibility</h2>
            {[
              { key: 'reduced_motion', label: 'Reduce Motion', desc: 'Minimize animations and transitions' },
              { key: 'high_contrast', label: 'High Contrast', desc: 'Increase color contrast for better readability' },
              { key: 'dyslexia_font', label: 'Dyslexia-Friendly Font', desc: 'Use OpenDyslexic for easier reading' },
              { key: 'screen_reader_hints', label: 'Screen Reader Hints', desc: 'Add extra ARIA labels for assistive technology' },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <div><span className="text-[12px] text-t1">{opt.label}</span><p className="text-[10px] text-t4">{opt.desc}</p></div>
                <button onClick={() => savePref(opt.key, !prefs?.[opt.key])}
                  className={`w-10 h-5.5 rounded-full relative transition-all ${prefs?.[opt.key] ? 'bg-cyan' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${prefs?.[opt.key] ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
            <div>
              <span className="text-[11px] text-t3">Font Size</span>
              <div className="flex gap-2 mt-1.5">
                {FONT_SIZES.map(fs => (
                  <button key={fs.value} onClick={() => savePref('font_size', fs.value)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition ${prefs?.font_size === fs.value ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.15]' : 'bg-deep text-t3 border border-border/20 hover:border-border'}`}>
                    {fs.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Display */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-[14px] font-bold text-t1 flex items-center gap-2"><Palette size={16} className="text-purple" /> Display</h2>
            <div>
              <span className="text-[11px] text-t3">Color Mode</span>
              <div className="flex gap-2 mt-1.5">
                {[{ v: 'dark', icon: Moon }, { v: 'light', icon: Sun }, { v: 'system', icon: Monitor }].map(cm => {
                  const Icon = cm.icon
                  return (
                    <button key={cm.v} onClick={() => savePref('color_mode', cm.v)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition ${prefs?.color_mode === cm.v ? 'bg-purple/[0.08] text-purple border border-purple/[0.15]' : 'bg-deep text-t3 border border-border/20 hover:border-border'}`}>
                      <Icon size={11} /> {cm.v}
                    </button>
                  )
                })}
              </div>
            </div>
            <div>
              <span className="text-[11px] text-t3">Chart Palette</span>
              <div className="flex gap-2 mt-1.5">
                {CHART_PALETTES.map(cp => (
                  <button key={cp} onClick={() => savePref('chart_palette', cp)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-mono transition ${prefs?.chart_palette === cp ? 'bg-cyan/[0.08] text-cyan border border-cyan/[0.15]' : 'bg-deep text-t3 border border-border/20 hover:border-border'}`}>
                    {cp}
                  </button>
                ))}
              </div>
            </div>
            {[
              { key: 'number_abbreviation', label: 'Abbreviate Numbers', desc: '$1.2M instead of $1,200,000' },
              { key: 'show_breadcrumbs', label: 'Show Breadcrumbs', desc: 'Navigation breadcrumb trail' },
              { key: 'tooltips_enabled', label: 'Show Tooltips', desc: 'Contextual help on hover' },
              { key: 'show_feature_badges', label: 'Feature Badges', desc: 'Show "NEW" badges on features' },
            ].map(opt => (
              <div key={opt.key} className="flex items-center justify-between">
                <div><span className="text-[12px] text-t1">{opt.label}</span><p className="text-[10px] text-t4">{opt.desc}</p></div>
                <button onClick={() => savePref(opt.key, !prefs?.[opt.key])}
                  className={`w-10 h-5.5 rounded-full relative transition-all ${prefs?.[opt.key] !== false ? 'bg-cyan' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-white shadow transition-all ${prefs?.[opt.key] !== false ? 'left-5' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* FEEDBACK */}
      {tab === 'feedback' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={submitFeedback} className="glass-card rounded-2xl p-6 space-y-4">
            <h2 className="text-[14px] font-bold text-t1">Send Feedback</h2>
            <div className="flex flex-wrap gap-2">
              {FEEDBACK_TYPES.map(ft => {
                const Icon = ft.icon
                return (
                  <button key={ft.value} type="button" onClick={() => setFbType(ft.value)}
                    className={`px-3 py-2 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition ${fbType === ft.value ? `bg-${ft.color}/[0.08] text-${ft.color} border border-${ft.color}/[0.15]` : 'bg-deep text-t3 border border-border/20 hover:border-border'}`}>
                    <Icon size={11} /> {ft.label}
                  </button>
                )
              })}
            </div>
            <input value={fbTitle} onChange={e => setFbTitle(e.target.value)} placeholder="Title (optional)" className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none placeholder:text-t3" />
            <textarea value={fbDesc} onChange={e => setFbDesc(e.target.value)} required rows={4} placeholder="Describe your feedback..." className="w-full px-4 py-3 rounded-xl glass-input text-t1 text-[13px] outline-none resize-none placeholder:text-t3" />
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-t4 mr-2">Rating:</span>
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setFbRating(n)} className="p-0.5">
                  <Star size={16} className={n <= fbRating ? 'text-amber fill-amber' : 'text-t4'} />
                </button>
              ))}
            </div>
            <button type="submit" disabled={submitting} className="px-4 py-2 rounded-xl bg-cyan/[0.08] text-cyan text-[12px] font-semibold border border-cyan/[0.12] hover:bg-cyan/[0.12] transition flex items-center gap-1.5 disabled:opacity-50">
              {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />} Submit
            </button>
          </form>
          <div className="space-y-2">
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">YOUR FEEDBACK</span>
            {feedback.slice(0, 10).map(f => (
              <div key={f.id} className="glass-card rounded-xl p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[9px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded uppercase">{f.feedback_type?.replace('_', ' ')}</span>
                  <span className="text-[9px] font-mono text-t4">{new Date(f.created_at).toLocaleDateString()}</span>
                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${f.status === 'resolved' ? 'bg-green/[0.06] text-green' : f.status === 'planned' ? 'bg-cyan/[0.06] text-cyan' : 'bg-t3/[0.06] text-t3'}`}>{f.status}</span>
                </div>
                {f.title && <p className="text-[12px] font-medium text-t1">{f.title}</p>}
                <p className="text-[11px] text-t3 line-clamp-2">{f.description}</p>
              </div>
            ))}
            {feedback.length === 0 && <p className="text-[11px] text-t4 mt-4">No feedback submitted yet.</p>}
          </div>
        </div>
      )}

      {/* WALKTHROUGHS */}
      {tab === 'walkthroughs' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {walkthroughs.map(w => (
            <div key={w.id} className={`glass-card rounded-xl p-5 ${w.completed ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[13px] font-bold text-t1">{w.title}</h3>
                  <p className="text-[11px] text-t3 mt-1">{w.description}</p>
                  <span className="text-[10px] font-mono text-t4 mt-2 inline-block">{(w.steps || []).length} steps · {w.target_page}</span>
                </div>
                {w.completed ? (
                  <span className="text-[9px] font-mono text-green bg-green/[0.06] px-1.5 py-0.5 rounded flex items-center gap-1"><Check size={9} /> Done</span>
                ) : (
                  <a href={w.target_page} className="text-[10px] text-cyan hover:underline flex items-center gap-0.5">Start <ChevronRight size={10} /></a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ANNOUNCEMENTS */}
      {tab === 'announcements' && (
        <div className="space-y-3">
          {announcements.map(a => (
            <div key={a.id} className={`glass-card rounded-xl p-5 ${a.severity === 'urgent' ? 'border-red/[0.12]' : a.severity === 'success' ? 'border-green/[0.1]' : ''}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${a.announcement_type === 'feature' ? 'bg-cyan/[0.06] text-cyan' : a.announcement_type === 'fix' ? 'bg-green/[0.06] text-green' : a.announcement_type === 'security' ? 'bg-red/[0.06] text-red' : 'bg-purple/[0.06] text-purple'}`}>{a.announcement_type}</span>
                <span className="text-[9px] font-mono text-t4">{new Date(a.starts_at).toLocaleDateString()}</span>
              </div>
              <h3 className="text-[14px] font-bold text-t1">{a.title}</h3>
              <p className="text-[12px] text-t3 mt-1">{a.body}</p>
              {a.cta_text && a.cta_url && <a href={a.cta_url} className="text-[11px] text-cyan hover:underline mt-2 inline-flex items-center gap-1">{a.cta_text} <ChevronRight size={10} /></a>}
            </div>
          ))}
          {announcements.length === 0 && <div className="glass-card rounded-2xl p-12 text-center"><Megaphone size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">No announcements right now</p></div>}
        </div>
      )}
    </div>
  )
}
