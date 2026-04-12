import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/components/Toast'
import { safeInvoke } from '@/lib/safeInvoke'
import { supabase } from '@/lib/supabase'
import { useNavigate } from 'react-router-dom'
import {
  RefreshCw, Plus, Loader2, CheckCircle2, Shield, Building2,
  Database, CreditCard, ArrowRight, Sparkles
} from 'lucide-react'

const PLANS = [
  { id: 'starter', name: 'Starter', price: '$99', priceId: 'price_1THX62FNFhtB2ZujfPfhaKXc', features: ['3 bank accounts', '3 team members', 'Daily cash position', 'Basic reports'] },
  { id: 'growth', name: 'Growth', price: '$249', priceId: 'price_1THX63FNFhtB2ZujQmJpAnaU', features: ['15 bank accounts', '15 team members', 'Forecasting + scenarios', 'API access'] },
  { id: 'enterprise', name: 'Enterprise', price: '$449', priceId: 'price_1THX64FNFhtB2Zujajul8HIw', features: ['Unlimited accounts', 'Unlimited team', 'SSO + audit center', 'Priority support'] },
]

export default function Reactivate() {
  const { profile, org, user, refetch } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [checkData, setCheckData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null) // null | 'reactivate' | 'fresh'
  const [selectedPlan, setSelectedPlan] = useState('starter')
  const [processing, setProcessing] = useState(false)
  const [companyName, setCompanyName] = useState('')

  useEffect(() => { document.title = 'Welcome Back \u2014 Vaultline' }, [])

  // Check reactivation status
  useEffect(() => {
    async function check() {
      const { data } = await safeInvoke('account-reactivate', { action: 'check' })
      setCheckData(data)
      setLoading(false)
      if (data && !data.needs_reactivation) navigate('/home')
    }
    check()
  }, [])

  async function handleReactivate() {
    const plan = PLANS.find(p => p.id === selectedPlan)
    if (!plan) return
    setProcessing(true)
    try {
      const { data, error } = await safeInvoke('account-reactivate', {
        action: 'reactivate',
        price_id: plan.priceId,
      })
      if (error || data?.error) throw new Error(data?.error || error)
      toast.success(`Account reactivated on ${data.plan} plan with 14-day trial`)
      refetch?.()
      setTimeout(() => navigate('/home'), 1500)
    } catch (err) {
      toast.error(err.message || 'Reactivation failed')
    }
    setProcessing(false)
  }

  async function handleFreshStart() {
    if (!companyName.trim()) { toast.error('Enter a company name'); return }
    setProcessing(true)
    try {
      const { data, error } = await safeInvoke('account-reactivate', {
        action: 'fresh_start',
        company_name: companyName.trim(),
      })
      if (error || data?.error) throw new Error(data?.error || error)
      toast.success('New org created — welcome back!')
      refetch?.()
      setTimeout(() => navigate('/home'), 1500)
    } catch (err) {
      toast.error(err.message || 'Failed to create org')
    }
    setProcessing(false)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-cyan" />
      </div>
    )
  }

  const hasData = checkData?.data_remaining?.accounts > 0 || checkData?.data_remaining?.transactions > 0
  const closedDate = checkData?.closed_at ? new Date(checkData.closed_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: 'var(--color-background-tertiary, #0C1222)' }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-[24px] font-display font-extrabold tracking-tight">
            Vault<span className="text-cyan">line</span>
          </h1>
        </div>

        <div className="glass-card rounded-2xl p-8">
          {/* Welcome back */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-cyan/[0.08] flex items-center justify-center mx-auto mb-4">
              <Sparkles size={28} className="text-cyan" />
            </div>
            <h2 className="text-[22px] font-display font-black tracking-tight mb-2">
              Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
            </h2>
            <p className="text-[14px] text-t2">
              {checkData?.org_name && <>Your organization <span className="font-semibold text-t1">{checkData.org_name}</span> </>}
              {closedDate ? `was closed in ${closedDate}.` : 'is inactive.'}
              {hasData ? ' Your data is still here.' : ''}
            </p>
          </div>

          {/* Data recovery summary */}
          {hasData && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-deep rounded-xl p-3 text-center">
                <p className="font-mono text-[20px] font-black text-cyan">{checkData.data_remaining.accounts}</p>
                <p className="text-[11px] text-t3 font-mono mt-0.5">Accounts</p>
              </div>
              <div className="bg-deep rounded-xl p-3 text-center">
                <p className="font-mono text-[20px] font-black text-green">{checkData.data_remaining.transactions}</p>
                <p className="text-[11px] text-t3 font-mono mt-0.5">Transactions</p>
              </div>
              <div className="bg-deep rounded-xl p-3 text-center">
                <p className="font-mono text-[20px] font-black text-purple">{checkData.data_remaining.banks?.length || 0}</p>
                <p className="text-[11px] text-t3 font-mono mt-0.5">Banks</p>
              </div>
            </div>
          )}

          {/* Mode selector */}
          {!mode && (
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setMode('reactivate')}
                className="glass-card rounded-xl p-5 text-left hover:border-cyan/[0.15] hover:-translate-y-1 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-cyan/[0.08] flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  <RefreshCw size={18} className="text-cyan" />
                </div>
                <h3 className="text-[14px] font-bold mb-1">Reactivate</h3>
                <p className="text-[12px] text-t3 leading-relaxed">
                  {hasData ? 'Restore your org with all existing data. Reconnect banks and pick a plan.' : 'Restore your org and pick a plan to get started again.'}
                </p>
              </button>

              <button onClick={() => setMode('fresh')}
                className="glass-card rounded-xl p-5 text-left hover:border-purple/[0.15] hover:-translate-y-1 transition-all group">
                <div className="w-10 h-10 rounded-xl bg-purple/[0.08] flex items-center justify-center mb-3 group-hover:scale-110 transition">
                  <Plus size={18} className="text-purple" />
                </div>
                <h3 className="text-[14px] font-bold mb-1">Start fresh</h3>
                <p className="text-[12px] text-t3 leading-relaxed">Create a new organization with a clean dashboard. Your old data stays archived.</p>
              </button>
            </div>
          )}

          {/* Reactivate flow — plan picker */}
          {mode === 'reactivate' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="terminal-label">CHOOSE YOUR PLAN</span>
                <button onClick={() => setMode(null)} className="text-[12px] text-t3 hover:text-t1 transition">Back</button>
              </div>
              <div className="space-y-2 mb-6">
                {PLANS.map(p => (
                  <button key={p.id} onClick={() => setSelectedPlan(p.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${selectedPlan === p.id ? 'border-cyan/[0.2] bg-cyan/[0.04]' : 'border-border hover:border-border-hover'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedPlan === p.id ? 'border-cyan' : 'border-t3'}`}>
                        {selectedPlan === p.id && <div className="w-2 h-2 rounded-full bg-cyan" />}
                      </div>
                      <div className="text-left">
                        <span className="text-[14px] font-semibold">{p.name}</span>
                        <span className="text-[12px] text-t3 ml-2">{p.features.slice(0, 2).join(' \u00b7 ')}</span>
                      </div>
                    </div>
                    <span className="font-mono text-[14px] font-bold text-t1">{p.price}<span className="text-[11px] text-t3 font-normal">/mo</span></span>
                  </button>
                ))}
              </div>
              <div className="text-center mb-4">
                <p className="text-[12px] text-green font-mono font-semibold">14-day free trial included — no charge today</p>
              </div>
              <button onClick={handleReactivate} disabled={processing}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan to-sky-400 text-white text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                {processing ? <><Loader2 size={16} className="animate-spin" /> Reactivating...</> : <><RefreshCw size={16} /> Reactivate Account</>}
              </button>
            </div>
          )}

          {/* Fresh start flow */}
          {mode === 'fresh' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="terminal-label">NEW ORGANIZATION</span>
                <button onClick={() => setMode(null)} className="text-[12px] text-t3 hover:text-t1 transition">Back</button>
              </div>
              <div className="mb-6">
                <label className="block text-[12px] font-mono text-t3 mb-2">Company name</label>
                <input value={companyName} onChange={e => setCompanyName(e.target.value)}
                  placeholder="Your company name"
                  className="w-full px-4 py-3 rounded-xl glass-input text-[14px] text-t1 outline-none focus:border-cyan/40 placeholder:text-t3" />
              </div>
              <button onClick={handleFreshStart} disabled={processing || !companyName.trim()}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-gradient-to-r from-purple to-violet-400 text-white text-[14px] font-semibold hover:-translate-y-px active:scale-[0.98] transition-all disabled:opacity-50">
                {processing ? <><Loader2 size={16} className="animate-spin" /> Creating...</> : <><Plus size={16} /> Create New Org</>}
              </button>
              <p className="text-[11px] text-t3 text-center mt-3">Your old organization will remain archived. You can start a trial on any plan from the billing page.</p>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-t4 font-mono mt-6">Vaultline Treasury Platform</p>
      </div>
    </div>
  )
}
