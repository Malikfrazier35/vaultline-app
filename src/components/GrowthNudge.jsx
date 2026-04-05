import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { safeInvoke } from '@/lib/safeInvoke'
import { Link } from 'react-router-dom'
import { X, ArrowRight, Gift, Zap, Users, Star, Package, TrendingUp, Copy, Check, ExternalLink } from 'lucide-react'

const ICON_MAP = { upgrade: TrendingUp, cross_sell: Package, referral: Gift, loyalty: Star, tier_upgrade: Zap }
const COLOR_MAP = { upgrade: 'cyan', cross_sell: 'purple', referral: 'green', loyalty: 'amber', tier_upgrade: 'cyan' }

export default function GrowthNudge() {
  const { org } = useAuth()
  const [nudges, setNudges] = useState([])
  const [dismissed, setDismissed] = useState(new Set())
  const [referralCode, setReferralCode] = useState(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!org?.id) return
    fetchNudges()
    const saved = localStorage.getItem('vaultline-dismissed-nudges')
    if (saved) setDismissed(new Set(JSON.parse(saved)))
  }, [org?.id])

  async function fetchNudges() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const { data } = await safeInvoke('growth-engine', { action: 'dashboard' })
      if (data?.nudges) setNudges(data.nudges)
      if (data?.referral_code) setReferralCode(data.referral_code)
    } catch (e) { console.error('Growth nudge error:', e) }
    finally { setLoading(false) }
  }

  function dismiss(type) {
    const next = new Set([...dismissed, type])
    setDismissed(next)
    localStorage.setItem('vaultline-dismissed-nudges', JSON.stringify([...next]))
  }

  async function trackCrossSell(product) {
    const { data: { session } } = await supabase.auth.getSession()
    await safeInvoke('growth-engine', { action: 'cross_sell_interest', product })
  }

  function copyCode() {
    if (!referralCode) return
    navigator.clipboard.writeText(`https://www.vaultline.app/signup?ref=${referralCode}`)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const visible = nudges.filter(n => !dismissed.has(n.type)).slice(0, 2)
  if (loading || visible.length === 0) return null

  return (
    <div className="space-y-2.5 mb-5">
      {visible.map(nudge => {
        const Icon = ICON_MAP[nudge.type] || Zap
        const color = COLOR_MAP[nudge.type] || 'cyan'
        return (
          <div key={nudge.type} className={`glass-card rounded-xl p-4 border-${color}/[0.12] relative group`}>
            <button onClick={() => dismiss(nudge.type)} className="absolute top-3 right-3 p-1 rounded-md hover:bg-deep text-t3 hover:text-t1 transition opacity-0 group-hover:opacity-100"><X size={12} /></button>
            <div className="flex items-start gap-3.5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-${color}/[0.08]`}>
                <Icon size={16} className={`text-${color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-t1">{nudge.title}</p>
                <p className="text-[12px] text-t3 mt-0.5">{nudge.desc}</p>
                <div className="flex items-center gap-2 mt-2.5">
                  {nudge.type === 'referral' && (
                    <>
                    <button onClick={copyCode} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-${color}/[0.06] text-${color} border border-${color}/[0.1] hover:bg-${color}/[0.1] active:scale-[0.98] transition-all`}>
                      {copied ? <><Check size={10} /> Copied!</> : <><Copy size={10} /> Copy Link</>}
                    </button>
                    <Link to="/ecosystem" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-t2 border border-border hover:border-${color}/[0.15] hover:text-${color} transition-all`}>
                      Manage <ArrowRight size={9} />
                    </Link>
                    </>
                  )}
                  {nudge.type === 'cross_sell' && (
                    <Link to="/ecosystem" onClick={() => trackCrossSell(nudge.product)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-${color}/[0.06] text-${color} border border-${color}/[0.1] hover:bg-${color}/[0.1] active:scale-[0.98] transition-all`}>
                      {nudge.cta} <ArrowRight size={9} />
                    </Link>
                  )}
                  {nudge.type === 'tier_upgrade' && (
                    <Link to="/billing" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-${color}/[0.06] text-${color} border border-${color}/[0.1] hover:bg-${color}/[0.1] active:scale-[0.98] transition-all`}>
                      {nudge.cta} <ArrowRight size={9} />
                    </Link>
                  )}
                  {nudge.type === 'upgrade' && (
                    <Link to="/billing" className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-${color}/[0.06] text-${color} border border-${color}/[0.1] hover:bg-${color}/[0.1] active:scale-[0.98] transition-all`}>
                      {nudge.cta} <ArrowRight size={9} />
                    </Link>
                  )}
                  {nudge.type === 'loyalty' && (
                    <button onClick={() => dismiss(nudge.type)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold bg-${color}/[0.06] text-${color} border border-${color}/[0.1] hover:bg-${color}/[0.1] active:scale-[0.98] transition-all`}>
                      {nudge.cta} <Gift size={9} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
