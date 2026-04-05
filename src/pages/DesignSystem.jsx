import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { Loader2, Palette, Layout, Layers, Box, Sparkles, Sun, Moon, Eye, Type } from 'lucide-react'

export default function DesignSystem() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | components | states | themes

  const load = useCallback(async () => {
    setLoading(true)
    const { data: d } = await safeInvoke('ui-ops', { action: 'dashboard' })
    setData(d)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const comps = data?.components || {}
  const states = data?.page_states || {}
  const themes = data?.themes || []

  if (loading) return <SkeletonPage />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-black tracking-tight">Design System</h1>
        <p className="text-[13px] text-t3 mt-0.5">{comps.total || 0} components · {states.total || 0} page states · {themes.length} themes</p>
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['overview', 'components', 'states', 'themes'].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Components', value: comps.total || 0, icon: Box, color: 'cyan' },
              { label: 'Page States', value: states.total || 0, icon: Layers, color: 'purple' },
              { label: 'Themes', value: themes.length, icon: Palette, color: 'amber' },
              { label: 'Pages Covered', value: Object.keys(states.by_page || {}).length, icon: Layout, color: 'green' },
            ].map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="glass-card rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><Icon size={14} className={`text-${k.color}`} /><span className="text-[11px] text-t3">{k.label}</span></div>
                  <p className={`font-mono text-[24px] font-black text-${k.color} terminal-data`}>{k.value}</p>
                </div>
              )
            })}
          </div>
          <div className="glass-card rounded-2xl p-5">
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">COMPONENTS BY CATEGORY</span>
            <div className="flex flex-wrap gap-3 mt-3">
              {Object.entries(comps.by_category || {}).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="px-3 py-2 rounded-lg bg-deep border border-border/20">
                  <span className="text-[11px] text-t2 capitalize">{cat.replace('_', ' ')}</span>
                  <span className="font-mono text-[14px] font-bold text-cyan ml-2 terminal-data">{String(count)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'components' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(comps.list || []).map(c => (
            <div key={c.id} className="glass-card rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Box size={14} className="text-cyan" />
                <span className="text-[13px] font-bold text-t1">{c.name}</span>
              </div>
              <p className="text-[11px] text-t3">{c.description}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[9px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded uppercase">{c.category.replace('_', ' ')}</span>
                <span className="text-[9px] font-mono text-t4">{(c.pages_used || []).length} pages</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'states' && (
        <div className="space-y-4">
          {Object.entries(states.by_page || {}).map(([page, types]) => (
            <div key={page} className="glass-card rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[13px] font-bold text-t1 font-mono">{page}</span>
                <span className="text-[10px] text-t4">{types.length} states</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {types.map(st => (
                  <span key={st} className={`text-[9px] font-mono font-bold uppercase px-2 py-1 rounded ${st === 'error' ? 'bg-red/[0.06] text-red' : st === 'loading' ? 'bg-cyan/[0.06] text-cyan' : st === 'empty' ? 'bg-purple/[0.06] text-purple' : st === 'offline' ? 'bg-amber/[0.06] text-amber' : 'bg-t3/[0.06] text-t3'}`}>{st}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'themes' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {themes.map(t => {
            const colors = t.colors || {}
            return (
              <div key={t.id} className={`glass-card rounded-2xl p-6 ${t.is_default ? 'border-cyan/[0.15]' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[14px] font-bold text-t1">{t.name}</h3>
                  {t.is_default && <span className="text-[8px] font-mono text-cyan bg-cyan/[0.06] px-1.5 py-0.5 rounded">DEFAULT</span>}
                </div>
                <p className="text-[11px] text-t3 mb-4">{t.description}</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(colors).map(([name, hex]) => (
                    <div key={name} className="flex items-center gap-1.5">
                      <div className="w-6 h-6 rounded-md border border-border/20" style={{ background: String(hex) }} />
                      <div><p className="text-[9px] text-t3 capitalize">{name}</p><p className="text-[8px] font-mono text-t4">{String(hex)}</p></div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-t4 font-mono">
                  {t.font_display} · {t.font_mono}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
