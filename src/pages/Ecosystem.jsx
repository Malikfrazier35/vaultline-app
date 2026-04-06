import { useState, useEffect } from 'react'
import { SkeletonPage } from '@/components/Skeleton'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { Link } from 'react-router-dom'
import { Package, Gift, Copy, Check, ExternalLink, TrendingUp, Shield, Users, Zap, Globe, ArrowRight, Star, Loader2, RefreshCw } from 'lucide-react'

const PRODUCTS = [
  { id: 'vaultline', name: 'Vaultline', tagline: 'Treasury Management', desc: 'Real-time cash visibility, AI forecasting, multi-currency FX, bank integrations, scenario modeling.', color: 'cyan', features: ['Cash position dashboard', 'AI forecast (3 models)', 'Multi-currency FX', 'Plaid + QuickBooks + Xero', 'API + Webhooks'], internal: true, path: '/dashboard' },
  { id: 'financeos', name: 'FinanceOS', tagline: 'Cloud FP&A', desc: 'Planning, budgeting, multi-entity consolidation, variance analysis, and AI-powered financial modeling.', color: 'green', features: ['Budget vs actuals', 'Multi-entity consolidation', 'Variance detective', 'Scenario modeling', 'Board reporting'], url: 'https://financeos.app' },
  { id: 'parallax', name: 'Parallax', tagline: 'Supplier Compliance OS', desc: 'Aerospace supplier compliance, questionnaire management, CAPA tracking, audit readiness, training matrix.', color: 'amber', features: ['IA9100 / CMMC frameworks', 'Questionnaire management', 'CAPA lifecycle', 'Audit calendar', 'Training matrix'], url: 'https://parallax.app' },
]

const BUNDLE = {
  name: 'Suite Bundle', desc: 'All three products at 15% off', moPrice: '$2,799', yrPrice: '$2,239',
  savings: 'Save $499/mo vs separate plans', moPriceId: 'price_1TBjU5FV8yRihVmrrk34Cb7s', yrPriceId: 'price_1TBjU9FV8yRihVmrPzu68UYk',
}

export default function Ecosystem() {
  const { org, profile, isAdmin } = useAuth()
  const [ecoProducts, setEcoProducts] = useState([])
  const [referrals, setReferrals] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [toast, setToast] = useState(null)
  const [annual, setAnnual] = useState(false)

  useEffect(() => { document.title = 'Ecosystem \u2014 Vaultline' }, [])

  useEffect(() => {
    if (!org?.id) return
    loadData()
  }, [org?.id])

  async function loadData() {
    setLoading(true)
    const [epRes, growthRes] = await Promise.all([
      supabase.from('ecosystem_products').select('*').eq('org_id', org.id),
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession()
          const { data } = await safeInvoke('growth-engine', {
            body: { action: 'dashboard' },
            headers: { Authorization: `Bearer ${session?.access_token}` },
          })
          return data
        } catch { return null }
      })(),
    ])
    setEcoProducts(epRes.data || [])
    if (growthRes) {
      setReferrals(growthRes.referrals || [])
      setStats(growthRes.stats || null)
    }
    setLoading(false)
  }

  function copyReferral() {
    if (!org?.referral_code) return
    navigator.clipboard.writeText(`https://www.vaultline.app/signup?ref=${org.referral_code}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  async function sendReferral() {
    if (!inviteEmail.trim()) return
    setInviteLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data } = await safeInvoke('growth-engine', {
        body: { action: 'create_referral', email: inviteEmail.trim() },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      })
      if (data?.success) { setInviteEmail(''); setToast('Referral sent!'); loadData() }
      else setToast(data?.error || 'Failed')
    } catch (e) { setToast(e.message) }
    finally { setInviteLoading(false); setTimeout(() => setToast(null), 3000) }
  }

  async function trackInterest(productId) {
    const { data: { session } } = await supabase.auth.getSession()
    await safeInvoke('growth-engine', {
      body: { action: 'cross_sell_interest', product: productId, source: 'ecosystem_page' },
      headers: { Authorization: `Bearer ${session?.access_token}` },
    })
  }

  const getProductStatus = (id) => ecoProducts.find(p => p.product === id)
  const activeCount = ecoProducts.filter(p => p.status === 'active' || p.status === 'trialing').length
  const referralCode = org?.referral_code || 'VL-XXXX'
  const convertedRefs = referrals.filter(r => r.status === 'converted' || r.status === 'rewarded').length
  const totalRewards = referrals.filter(r => r.status === 'rewarded').reduce((s, r) => s + (r.reward_amount || 0), 0)

  if (loading) return <SkeletonPage />

  return (
    <div className="max-w-[1000px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="terminal-label">ECOSYSTEM</span>
          <span className="text-[12px] font-mono text-t3">{activeCount}/3 products active</span>
        </div>
        <span className="text-[10px] font-mono text-green bg-green/[0.06] border border-green/[0.08] px-2.5 py-1 rounded">15% BUNDLE DISCOUNT</span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { icon: Package, label: 'PRODUCTS', value: `${activeCount}/3`, color: 'cyan' },
          { icon: Gift, label: 'REFERRALS', value: referrals.length.toString(), color: 'purple' },
          { icon: TrendingUp, label: 'CONVERTED', value: convertedRefs.toString(), color: 'green' },
          { icon: Star, label: 'REWARDS', value: `$${totalRewards}`, color: 'amber' },
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

      {/* Product cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PRODUCTS.map(product => {
          const status = getProductStatus(product.id)
          const isActive = status?.status === 'active' || status?.status === 'trialing'
          return (
            <div key={product.id} className={`glass-card rounded-2xl p-5 flex flex-col transition-all hover:-translate-y-1 ${isActive ? `border-${product.color}/[0.15] shadow-[0_0_24px_rgba(34,211,238,0.04)]` : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <span className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded border border-border text-t2`}>{product.tagline}</span>
                {isActive ? (
                  <span className="text-[9px] font-mono text-green bg-green/[0.06] border border-green/[0.08] px-2 py-0.5 rounded">{status?.status === 'trialing' ? 'TRIAL' : 'ACTIVE'}</span>
                ) : (
                  <span className="text-[9px] font-mono text-t3 bg-deep px-2 py-0.5 rounded border border-border">AVAILABLE</span>
                )}
              </div>
              <h3 className="font-display text-[18px] font-bold mb-1.5">{product.name}</h3>
              <p className="text-[12px] text-t3 leading-relaxed mb-4 flex-1">{product.desc}</p>
              <div className="space-y-1.5 mb-4">
                {product.features.map(f => (
                  <div key={f} className="flex items-center gap-2 text-[11px] text-t2">
                    <Check size={10} className="text-green shrink-0" /> <span className="font-mono">{f}</span>
                  </div>
                ))}
              </div>
              {product.internal ? (
                <Link to={product.path} className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan/90 to-cyan/70 text-void text-[12px] font-mono font-semibold text-center hover:-translate-y-px active:scale-[0.98] transition-all flex items-center justify-center gap-1.5">
                  GO TO DASHBOARD <ArrowRight size={11} />
                </Link>
              ) : isActive ? (
                <a href={product.url} target="_blank" rel="noopener noreferrer" className="w-full py-2.5 rounded-xl border border-green/[0.15] text-green text-[12px] font-mono font-semibold text-center hover:bg-green/[0.04] transition-all flex items-center justify-center gap-1.5">
                  OPEN {product.name.toUpperCase()} <ExternalLink size={10} />
                </a>
              ) : (
                <a href={`mailto:sales@vaultline.app?subject=Interest in ${product.name}&body=Hi, I'd like to learn more about adding ${product.name} to our stack. Our org: ${org?.name}`}
                  onClick={() => trackInterest(product.id)}
                  className="w-full py-2.5 rounded-xl border border-border text-t2 text-[12px] font-mono font-semibold text-center hover:border-cyan/[0.15] hover:text-cyan transition-all flex items-center justify-center gap-1.5">
                  GET STARTED <ArrowRight size={10} />
                </a>
              )}
            </div>
          )
        })}
      </div>

      {/* Bundle offer */}
      <div className="glass-card rounded-2xl p-6 border-purple/[0.12] terminal-scanlines relative">
        <div className="relative z-[2]">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={16} className="text-purple" />
                <span className="terminal-label">SUITE BUNDLE</span>
                <span className="text-[10px] font-mono text-purple bg-purple/[0.06] border border-purple/[0.08] px-2 py-0.5 rounded">SAVE 15%</span>
              </div>
              <h3 className="font-display text-[18px] font-bold mb-1">{BUNDLE.name}</h3>
              <p className="text-[13px] text-t3">Vaultline + FinanceOS + Parallax. {BUNDLE.savings}.</p>
            </div>
            <div className="text-right">
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-[12px] font-mono ${!annual ? 'text-t1 font-semibold' : 'text-t3'} cursor-pointer`} onClick={() => setAnnual(false)}>Monthly</span>
                <button onClick={() => setAnnual(!annual)} className={`relative w-10 h-5 rounded-full transition ${annual ? 'bg-purple' : 'bg-border'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${annual ? 'left-5.5' : 'left-0.5'}`} />
                </button>
                <span className={`text-[12px] font-mono ${annual ? 'text-t1 font-semibold' : 'text-t3'} cursor-pointer`} onClick={() => setAnnual(true)}>Annual</span>
              </div>
              <p className="font-mono text-[28px] font-black text-t1 terminal-data">{annual ? BUNDLE.yrPrice : BUNDLE.moPrice}<span className="text-[14px] text-t3 font-normal">/mo</span></p>
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <a href={`mailto:sales@vaultline.app?subject=Suite Bundle Inquiry&body=Hi, I'd like to discuss the Suite Bundle for our team at ${org?.name}.`}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple to-cyan text-white text-[13px] font-mono font-semibold hover:-translate-y-px active:scale-[0.98] transition-all shadow-[0_2px_16px_rgba(129,140,248,0.2)]">
              CONTACT SALES <ArrowRight size={12} />
            </a>
            <span className="text-[12px] text-t3 font-mono">or add products individually above</span>
          </div>
        </div>
      </div>

      {/* Referral Program */}
      <div className="grid grid-cols-[1fr_360px] gap-4">
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Gift size={15} className="text-green" />
            <span className="terminal-label">REFERRAL PROGRAM</span>
          </div>
          <p className="text-[13px] text-t2 mb-4">Share your referral link. When someone signs up and subscribes, <span className="text-green font-semibold">you get $100 credit</span> and they get <span className="text-green font-semibold">20% off</span> their first month.</p>

          {/* Referral link */}
          <div className="terminal-inset p-4 rounded-xl mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-mono text-t3">YOUR REFERRAL LINK</span>
              <button onClick={copyReferral} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono text-cyan border border-cyan/[0.1] hover:bg-cyan/[0.06] active:scale-[0.98] transition-all">
                {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy</>}
              </button>
            </div>
            <code className="text-[13px] font-mono text-cyan terminal-data break-all">https://www.vaultline.app/signup?ref={referralCode}</code>
          </div>

          {/* Send invite */}
          <div className="flex gap-2">
            <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
              onKeyDown={e => e.key === 'Enter' && sendReferral()}
              className="flex-1 px-3.5 py-2.5 rounded-xl glass-input text-[13px] font-mono text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
            <button onClick={sendReferral} disabled={inviteLoading || !inviteEmail.trim()}
              className="px-4 py-2.5 rounded-xl bg-green/[0.08] text-green text-[12px] font-mono font-semibold border border-green/[0.1] hover:bg-green/[0.12] active:scale-[0.98] transition-all disabled:opacity-50">
              {inviteLoading ? <Loader2 size={13} className="animate-spin" /> : 'SEND'}
            </button>
          </div>
        </div>

        {/* Referral history */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="terminal-label">HISTORY</span>
            <span className="text-[10px] font-mono text-t3">{referrals.length} sent</span>
          </div>
          {referrals.length > 0 ? (
            <div className="space-y-2 max-h-[240px] overflow-y-auto">
              {referrals.slice(0, 10).map(r => {
                const sc = { pending: 'text-t3', signed_up: 'text-amber', converted: 'text-green', rewarded: 'text-cyan' }
                return (
                  <div key={r.id} className="flex items-center justify-between py-2 border-b border-border/20 last:border-0">
                    <div>
                      <p className="text-[12px] font-mono text-t2 truncate max-w-[180px]">{r.referred_email}</p>
                      <p className="text-[10px] text-t3 font-mono">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <span className={`text-[10px] font-mono font-bold uppercase ${sc[r.status] || 'text-t3'}`}>{r.status}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-[12px] text-t3 font-mono text-center py-8">No referrals yet. Share your link above.</p>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 glass-card rounded-xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.3)] border-cyan/[0.15] animate-[slideUp_0.3s_ease-out]">
          <p className="text-[13px] text-cyan font-mono">{toast}</p>
        </div>
      )}
    </div>
  )
}
