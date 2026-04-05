import { useState, useEffect, useCallback } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import {
  Building2, Check, Loader2, ChevronRight, Globe, Users, Shield,
  Code, Heart, Factory, Landmark, ShoppingCart, Zap, Briefcase,
  GraduationCap, Truck, BarChart3, Target, Sparkles, ArrowRight, Lock
} from 'lucide-react'

const ICON_MAP = { Code, Heart, Factory, Landmark, ShoppingCart, Zap, Briefcase, GraduationCap, Truck, Building2 }
const SIZE_OPTIONS = [
  { value: 'startup', label: 'Startup', desc: '<$1M revenue, <20 employees' },
  { value: 'smb', label: 'SMB', desc: '$1M–$10M revenue, 20–100 employees' },
  { value: 'mid_market', label: 'Mid-Market', desc: '$10M–$500M revenue, 100–2,000 employees' },
  { value: 'enterprise', label: 'Enterprise', desc: '$500M+ revenue, 2,000+ employees' },
]

export default function IndustryHub() {
  const { org, profile } = useAuth()
  const toast = useToast()
  const [industries, setIndustries] = useState([])
  const [config, setConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('setup') // setup | onboarding | content | diversity
  const [onboarding, setOnboarding] = useState(null)
  const [diversity, setDiversity] = useState([])
  const isAdmin = ['owner', 'admin'].includes(profile?.role)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: ind }, { data: cfg }, { data: onb }] = await Promise.all([
      safeInvoke('industry-ops', { action: 'list_industries' }),
      safeInvoke('industry-ops', { action: 'get_config' }),
      safeInvoke('industry-ops', { action: 'get_onboarding' }),
    ])
    setIndustries(ind?.industries || [])
    setConfig(cfg?.config || null)
    setOnboarding(onb || null)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function selectIndustry(industryId, companySize) {
    await safeInvoke('industry-ops', { action: 'set_industry', industry_id: industryId, company_size: companySize })
    toast.success('Industry profile updated')
    load()
  }

  async function loadDiversity() {
    const { data } = await safeInvoke('industry-ops', { action: 'get_diversity' })
    setDiversity(data?.metrics || [])
  }

  const selected = config?.industry_id
  const selectedIndustry = industries.find(i => i.id === selected)
  const onboardingSteps = onboarding?.steps || []
  const completedSteps = onboardingSteps.filter(s => s.status === 'completed').length

  if (loading) return <div className="flex items-center justify-center py-32"><Loader2 size={20} className="animate-spin text-t3" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-black tracking-tight">Industry Hub</h1>
          <p className="text-[13px] text-t3 mt-0.5">
            {selectedIndustry ? `${selectedIndustry.name} · ${config?.company_size || 'Unknown size'} · Onboarding ${onboarding?.score || 0}%` : 'Select your industry for tailored onboarding'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border/30 pb-px">
        {['setup', 'onboarding', 'content', 'diversity'].map(t => (
          <button key={t} onClick={() => { setTab(t); if (t === 'diversity') loadDiversity() }}
            className={`px-4 py-2 text-[12px] font-semibold transition-all rounded-t-lg ${tab === t ? 'text-cyan border-b-2 border-cyan bg-cyan/[0.04]' : 'text-t3 hover:text-t1'}`}>
            {t === 'setup' ? 'Industry Setup' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* INDUSTRY SELECTION */}
      {tab === 'setup' && (
        <div className="space-y-6">
          {/* Current selection banner */}
          {selectedIndustry && (
            <div className="glass-card rounded-2xl p-6 border-cyan/[0.12]">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-cyan/[0.08] flex items-center justify-center">
                  {ICON_MAP[selectedIndustry.icon] ? (() => { const I = ICON_MAP[selectedIndustry.icon]; return <I size={22} className="text-cyan" /> })() : <Building2 size={22} className="text-cyan" />}
                </div>
                <div className="flex-1">
                  <h2 className="text-[16px] font-bold text-t1">{selectedIndustry.name}</h2>
                  <p className="text-[12px] text-t3">{selectedIndustry.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-[10px] font-mono text-t4">
                    {config?.company_size && <span className="bg-deep px-1.5 py-0.5 rounded uppercase">{config.company_size.replace('_', ' ')}</span>}
                    <span>{selectedIndustry.regulations?.join(', ') || 'No special regulations'}</span>
                    <span>{selectedIndustry.key_metrics?.length || 0} industry KPIs</span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-mono text-[28px] font-black text-cyan terminal-data">{onboarding?.score || 0}%</p>
                  <p className="text-[10px] text-t4">Onboarding</p>
                </div>
              </div>
            </div>
          )}

          {/* Grid of industries */}
          <div>
            <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">SELECT YOUR INDUSTRY</span>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {industries.map(ind => {
                const isSelected = ind.id === selected
                const isComingSoon = ind.tier === 'coming_soon'
                const Icon = ICON_MAP[ind.icon] || Building2
                return (
                  <button key={ind.id} disabled={isComingSoon}
                    onClick={() => !isComingSoon && selectIndustry(ind.id, config?.company_size || 'mid_market')}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected ? 'bg-cyan/[0.04] border-cyan/[0.2]' : isComingSoon ? 'opacity-50 cursor-not-allowed bg-deep/30 border-border/20' : 'bg-deep/50 border-border/30 hover:border-border hover:bg-deep/70'
                    }`}>
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: `${ind.color}12` }}>
                        <Icon size={16} style={{ color: ind.color }} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-t1">{ind.name}</span>
                          {isSelected && <Check size={12} className="text-cyan" />}
                          {isComingSoon && <span className="text-[8px] font-mono text-t4 bg-deep px-1.5 py-0.5 rounded">COMING SOON</span>}
                          {ind.tier === 'specialized' && <Sparkles size={10} className="text-amber" />}
                        </div>
                        <p className="text-[11px] text-t3 mt-0.5 line-clamp-2">{ind.description}</p>
                        {ind.pain_points?.length > 0 && (
                          <p className="text-[10px] text-t4 mt-1.5 italic">{ind.pain_points[0]}</p>
                        )}
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Company size */}
          {selected && isAdmin && (
            <div>
              <span className="text-[10px] font-mono text-t3 uppercase tracking-wider">COMPANY SIZE</span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                {SIZE_OPTIONS.map(s => (
                  <button key={s.value} onClick={() => selectIndustry(selected, s.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${config?.company_size === s.value ? 'bg-cyan/[0.04] border-cyan/[0.15]' : 'bg-deep/50 border-border/30 hover:border-border'}`}>
                    <span className={`text-[12px] font-semibold ${config?.company_size === s.value ? 'text-cyan' : 'text-t1'}`}>{s.label}</span>
                    <p className="text-[10px] text-t4 mt-0.5">{s.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INDUSTRY ONBOARDING */}
      {tab === 'onboarding' && (
        <div className="max-w-2xl space-y-4">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[15px] font-bold text-t1">{selectedIndustry?.name || 'Industry'} Onboarding</h2>
              <span className="font-mono text-[14px] font-bold text-cyan">{completedSteps}/{onboardingSteps.length} steps</span>
            </div>
            <div className="h-2 rounded-full bg-border/20 mb-6">
              <div className="h-full rounded-full bg-gradient-to-r from-cyan to-purple transition-all" style={{ width: `${onboarding?.score || 0}%` }} />
            </div>
            <div className="space-y-3">
              {onboardingSteps.map((step, i) => (
                <div key={step.stepId} className={`flex items-start gap-3 p-4 rounded-xl border ${step.status === 'completed' ? 'bg-green/[0.02] border-green/[0.1]' : 'bg-deep/50 border-border/20'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${step.status === 'completed' ? 'bg-green text-void' : 'bg-border/30 text-t3'}`}>
                    {step.status === 'completed' ? <Check size={12} /> : i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[13px] font-medium ${step.status === 'completed' ? 'text-green' : 'text-t1'}`}>{step.title}</span>
                      {step.required && <span className="text-[8px] font-mono text-amber bg-amber/[0.06] px-1 py-0.5 rounded">REQUIRED</span>}
                    </div>
                    <p className="text-[11px] text-t3 mt-0.5">{step.desc}</p>
                  </div>
                </div>
              ))}
              {onboardingSteps.length === 0 && (
                <div className="text-center py-8"><Globe size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">Select an industry to see tailored onboarding steps</p></div>
              )}
            </div>
          </div>

          {/* Industry terminology */}
          {onboarding?.terminology && Object.keys(onboarding.terminology).length > 0 && (
            <div className="glass-card rounded-xl p-5">
              <h3 className="text-[12px] font-bold text-t1 mb-3">Industry Terminology</h3>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(onboarding.terminology).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="text-[11px] text-t3 capitalize">{key.replace('_', ' ')}</span>
                    <span className="text-[11px] font-mono text-cyan">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* INDUSTRY CONTENT */}
      {tab === 'content' && (
        <div className="space-y-4">
          {selectedIndustry ? (
            <>
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-[15px] font-bold text-t1 mb-2">Why {selectedIndustry.name} Teams Choose Vaultline</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  {(selectedIndustry.value_props || []).map((vp, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-deep/50">
                      <Check size={14} className="text-green mt-0.5 flex-shrink-0" />
                      <span className="text-[12px] text-t2">{vp}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-2xl p-6">
                <h3 className="text-[14px] font-bold text-t1 mb-3">Industry Pain Points We Solve</h3>
                <div className="space-y-2">
                  {(selectedIndustry.pain_points || []).map((pp, i) => (
                    <div key={i} className="flex items-start gap-2 p-3 rounded-xl bg-red/[0.02] border border-red/[0.06]">
                      <Target size={12} className="text-red mt-0.5 flex-shrink-0" />
                      <span className="text-[12px] text-t2">{pp}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="glass-card rounded-xl p-5">
                <h3 className="text-[12px] font-bold text-t1 mb-3">Key Metrics for {selectedIndustry.name}</h3>
                <div className="flex flex-wrap gap-2">
                  {(selectedIndustry.key_metrics || []).map(m => (
                    <span key={m} className="text-[10px] font-mono text-cyan bg-cyan/[0.06] px-2 py-1 rounded-lg border border-cyan/[0.08]">{m.replace(/_/g, ' ')}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="glass-card rounded-2xl p-12 text-center"><Building2 size={28} className="text-t4 mx-auto mb-3" /><p className="text-[14px] text-t2">Select an industry to see tailored content</p></div>
          )}
        </div>
      )}

      {/* DIVERSITY METRICS */}
      {tab === 'diversity' && (
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-6 text-center">
            <Users size={28} className="text-purple mx-auto mb-3" />
            <h2 className="font-display text-lg font-bold">Customer Diversity Dashboard</h2>
            <p className="text-[13px] text-t3 mt-1">Tracking industry representation and organizational diversity across the Vaultline customer base.</p>
          </div>
          {diversity.length > 0 ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Total Organizations', value: diversity[0]?.total_orgs || 0, color: 'cyan' },
                { label: 'Industries Represented', value: diversity[0]?.industries_represented || 0, color: 'purple' },
                { label: 'Geographic Regions', value: diversity[0]?.geographic_regions || 0, color: 'green' },
                { label: 'Target Industries', value: `${diversity[0]?.industries_represented || 0}/${diversity[0]?.target_industry_count || 12}`, color: 'amber' },
              ].map(k => (
                <div key={k.label} className="glass-card rounded-xl p-4">
                  <p className="text-[10px] font-mono text-t4 uppercase">{k.label}</p>
                  <p className={`font-mono text-[24px] font-black text-${k.color} terminal-data mt-1`}>{k.value}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-xl p-8 text-center"><BarChart3 size={20} className="text-t4 mx-auto mb-2" /><p className="text-[12px] text-t3">No diversity data yet. Metrics are calculated monthly.</p></div>
          )}
        </div>
      )}
    </div>
  )
}
